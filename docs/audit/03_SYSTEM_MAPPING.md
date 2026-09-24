# SYSTEM MAPPING V1

## Executive Summary
Dokumen **SYSTEM MAPPING V1** ini menyajikan pemetaan menyeluruh (*end-to-end mapping*) keterhubungan arsitektural antara layer **Frontend (Next.js App Router)**, **Backend (NestJS)**, dan **Database (TypeORM / MySQL)** pada sistem EPMS (Enterprise Project Management System).

Dokumen ini disusun secara **READ ONLY** berbasis bukti (*evidence-based*) untuk dijadikan kompas utama dalam melakukan refactoring, pengujian integrasi, pembersihan *dead code*, serta persiapan deployment produksi.

---

## 1. Domain Mapping

Tabel pemetaan utuh hubungan komponen perangkat lunak per domain bisnis:

| Domain Bisnis | Frontend Pages | Frontend Components | Frontend Services | Backend Controllers | Backend DTO | Backend Entities | Database Tables |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth & User** | `app/login`, `app/profile`, `app/admin/users` | `AdminUserPage`, `UserSessionManagerUI` | `AuthService` | `AuthController`, `AdminUserController` | `LoginDto`, `CreateUserDto`, `UpdateUserRolesDto` | `User`, `Role`, `UserSession` | `users`, `roles`, `user_sessions` |
| **Marketing & Sales** | `app/sales`, `app/sales/tenders/[id]`, `app/customers` | `SalesPipelinePage`, `KanbanBoard`, `CustomersPage`, `EditCustomerModal`, `TenderActivityStream` | `useTendersQuery` (Hook) | `MarketingController`, `CustomersController` | `CreateTenderDto`, `CreateCustomerDto`, `CreateTenderActivityDto` | `Customer`, `Tender`, `Proposal`, `TenderActivity`, `TenderPriceHistory` | `customers`, `tenders`, `proposals`, `tender_activities`, `tender_price_histories` |
| `app/legal/review`, `app/governance/contracts` | `LegalTaskQueue`, `LegalWorkstationHeader`, `GroupedLegalChecklist`, `LegalReviewForm` | `LegalService` | `LegalController`, `ContractController`, `PdfTemplateController` | `LegalReviewDto`, `CreateContractDto` | `Contract`, `ContractAmendment`, `PdfTemplate` | `contracts`, `contract_amendments`, `pdf_templates` |
| **Project PMO** | `app/project-delivery`, `app/project-operational`, `app/project/wbs` | `ProjectOperationTab` | `ProjectService` | `ProjectController` | `CreateWbsDto`, `CreateTaskDto` | `Project`, `WorkBreakdownStructure`, `Task` | `projects`, `work_breakdown_structures`, `tasks` |
| **Procurement** | `app/procurement`, `app/procurement/pr/create`, `app/procurement/po`, `app/procurement/gr/create`, `app/procurement/vendor-comparison` | `ProcurementPage`, `SpkCardList` | `ProcurementService` | `ProcurementController` | `CreatePurchaseRequestDto`, `CreateRfqDto`, `CreatePurchaseOrderDto`, `CreateGoodsReceiptDto` | `PurchaseRequest`, `PurchaseRequestItem`, `Rfq`, `Vendor`, `VendorComparison`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem` | `purchase_requests`, `purchase_request_items`, `rfqs`, `vendors`, `vendor_comparisons`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` |
| **Finance** | `app/finance/invoices`, `app/finance/payments` | Inline UI Tables | `getInvoices`, `createPayment` (`api.ts`) | `FinanceController` | `CreateInvoiceDto`, `CreatePaymentDto` | `Invoice`, `InvoiceItem`, `Payment` | `invoices`, `invoice_items`, `payments` |
| **System & Shared** | `app/documents`, `app/inbox`, `app/workflow` | `MainLayout`, `NotificationBell`, `NotificationInbox`, `DocumentUpload`, `WorkflowDesigner`, `DebugCachePanel` | `apiClient` (`axios.ts`) | `DocumentController`, `NotificationController`, `WorkflowController`, `ObservabilityController` | `UploadDocumentDto`, `SendNotificationDto` | `Document`, `Notification`, `AuditLog`, `OutboxEvent`, `DashboardKpi` | `documents`, `notifications`, `audit_logs`, `outbox_events`, `dashboard_kpis` |

---

## 2. Frontend Mapping

Pemetaan alur pemanggilan data dari Halaman UI hingga Endpoint API Backend:

```
[Page Route] ──> [UI Component] ──> [Client Layer / Service] ──> [Backend API Endpoint]
```

### Pemetaan Rute Utama:
1. `app/login/page.tsx` ──> `LoginPage` ──> `apiClient.post` ──> `POST /api/v1/auth/login`
2. `app/sales/page.tsx` ──> `SalesPipelinePage` & `KanbanBoard` ──> `useTendersQuery` / `apiClient` ──> `GET /api/v1/marketing/tenders` & `POST /api/v1/marketing/tenders/:id/upload-spk`
3. `app/legal/review/page.tsx` ──> `LegalReviewForm` & `LegalTaskQueue` ──> `LegalService` ──> `GET /api/v1/legal/contracts` & `POST /api/v1/legal/contracts/review`
4. `app/project-delivery/page.tsx` ──> `ProjectOperationTab` ──> `ProjectService` ──> `GET /api/v1/projects/operational-board`
5. `app/admin/users/page.tsx` ──> `AdminUserPage` ──> **Direct Axios (Bypass)** ──> `GET/POST /api/v1/admin/users`
6. `app/workflow/page.tsx` ──> `WorkflowDesigner` ──> Static Dummy Text ──> **None (Dead Page)**

---

## 3. Backend Mapping

Pemetaan alur eksekusi request di Backend NestJS:

```
[Controller Method] ──> [Service Method] ──> [TypeORM Repository / QueryRunner] ──> [MySQL Table]
```

### Contoh Alur Eksekusi Utama:
1. `AuthController.login()` ──> `AuthService.login()` ──> `userRepo.findOne()` ──> Table `users` & `user_sessions`
2. `MarketingController.uploadSpk()` ──> `MarketingService.uploadSpkAndPromoteTender()` ──> `tenderRepo.save()` & `contractRepo.query()` ──> Table `tenders` & `contracts`
3. `LegalController.submitReview()` ──> `LegalService.submitReviewAtomic()` ──> `DataSource.createQueryRunner()` ──> Table `contracts`, `proposals`, `tenders`, `projects`, `audit_logs`
4. `ProcurementController.createPR()` ──> `ProcurementService.createAndSubmitPurchaseRequest()` ──> `prRepo.save()` ──> Table `purchase_requests` & `purchase_request_items`

---

## 4. API Mapping & Unused Endpoints Audit

Tabel pemetaan endpoint REST API NestJS beserta caller-nya di Frontend:

| Method | URL Path | Controller | Backend Service Method | Primary Entity | Frontend Caller / Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `AuthController` | `AuthService.login()` | `User` | `app/login/page.tsx` |
| `POST` | `/api/v1/auth/refresh` | `AuthController` | `AuthService.refreshSession()` | `UserSession` | `AuthContext.tsx` & `AuthService.ts` |
| `GET` | `/api/v1/marketing/tenders` | `MarketingController` | `MarketingService.getTenders()` | `Tender` | `useTendersQuery.ts` |
| `POST` | `/api/v1/marketing/tenders/:id/upload-spk` | `MarketingController` | `MarketingService.uploadSpkAndPromoteTender()` | `Contract` | `KanbanBoard.tsx` |
| `GET` | `/api/v1/legal/contracts` | `LegalController` | `LegalService.getPendingContracts()` | `Contract` | `app/legal/review/page.tsx` |
| `POST` | `/api/v1/legal/contracts/review` | `LegalController` | `LegalService.submitReviewAtomic()` | `Contract` | `LegalReviewForm.tsx` |
| `GET` | `/api/v1/documents` | `DocumentController` | `DocumentService.findAll()` | `Document` | `app/documents/page.tsx` |
| `POST` | `/api/v1/documents/upload` | `DocumentController` | `DocumentService.uploadFile()` | `Document` | `DocumentUpload.tsx` |
| `GET` | `/api/v1/workflow/visualizer/:id`| `WorkflowController` | `WorkflowService.getWorkflowVisualizerData()`| N/A | `BpmnWorkflowVisualizer.tsx` |
| `GET` | `/api/v1/system/deep-health` | `ObservabilityController`| `ObservabilityService.getDeepHealthCheck()`| `OutboxEvent`| **Unused Endpoint (Belum ada caller UI)** |
| `POST` | `/api/v1/legal/review` | `LegalController` | `LegalService.submitReviewLegacy()` | `Contract` | **Deprecated / Unused Endpoint** |

---

## 5. Entity Mapping

Pemetaan 31 Entity ke modul, service, controller, dan tabel:

| Entity Name | Module Owner | Related DTO | Primary Service | Primary Controller | DB Table | Status Penggunaan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `User` | Auth | `CreateUserDto` | `AuthService`, `UserSessionService` | `AuthController`, `AdminUserController` | `users` | Active |
| `Role` | Auth | `UpdateUserRolesDto` | `AuthService` | `AdminUserController` | `roles` | Active |
| `UserSession` | Auth | N/A | `UserSessionService` | `UserSessionManagerUI` | `user_sessions` | Active |
| `Customer` | Marketing | `CreateCustomerDto` | `CustomersService` | `CustomersController` | `customers` | Active |
| `Tender` | Marketing | `CreateTenderDto` | `MarketingService` | `MarketingController` | `tenders` | Active |
| `Proposal` | Marketing | N/A | `MarketingService` | `MarketingController` | `proposals` | Active |
| `Contract` | Legal | `LegalReviewDto` | `LegalService`, `MarketingService` | `LegalController`, `ContractController` | `contracts` | Active |
| `Project` | Project | `CreateWbsDto` | `ProjectService`, `LegalService` | `ProjectController` | `projects` | Active |
| `DashboardKpi` | Dashboard | N/A | `ObservabilityService` | `ObservabilityController` | `dashboard_kpis` | **Minimal Usage** |

---

## 6. DTO Mapping & Validation Audit

| DTO Name | Module | Type | Validation Decorator Used? | Usage Status |
| :--- | :--- | :--- | :---: | :--- |
| `CreateTenderDto` | Marketing | Request DTO | Yes (`@IsString()`, `@IsNumber()`, `@IsEnum()`) | Active (`POST /marketing/tenders`) |
| `CreateCustomerDto` | Marketing | Request DTO | Yes (`@IsString()`, `@IsEmail()`) | Active (`POST /customers`) |
| `LegalReviewDto` | Legal | Request DTO | Yes (`@IsNumber()`, `@IsEnum()`, `@IsOptional()`) | Active (`POST /legal/contracts/review`) |
| `CreatePurchaseRequestDto`| Procurement| Request DTO | Yes (`@IsArray()`, `@ValidateNested()`) | Active (`POST /procurement/pr`) |
| `TenderDetailResponseDto` | Marketing | Response DTO | No (Interface DTO) | **Unused DTO (Tidak di-inject di Response)** |

---

## 7. Service Method & Cross-Domain Audit

| Service Class | Public Method | Called By (Caller) | Target Entity | Audit Finding |
| :--- | :--- | :--- | :--- | :--- |
| `MarketingService` | `uploadSpkAndPromoteTender` | `MarketingController` | `Tender`, `Contract` | **Cross-Domain Mutation**: Memutasi tabel `contracts` & mengeksekusi raw DDL. |
| `LegalService` | `submitReviewAtomic` | `LegalController` | `Contract`, `Proposal`, `Tender`, `Project` | **Cross-Domain Mutation**: Langsung membuat record `Project` di DB. |
| `AuthService` | `validateUser` | `AuthController` | `User` | **Security Vulnerability**: Mengandung backdoor password `password123` / `123456`. |
| `LegalService` | `submitReviewLegacy` | N/A | `Contract` | **Dead / Deprecated Method**. |

---

## 8. Component Mapping Audit

### 1. Shared Components
- `MainLayout.tsx` (303 baris): Header, Sider menu, User Profile Avatar, Notification Bell integration.
- `NotificationBell.tsx` (283 baris): In-app badge notification popover dengan real-time Socket.io listener.

### 2. Over-Sized God Components
- `SalesPipelinePage.tsx`: **1.547 baris** (66.311 bytes)
- `KanbanBoard.tsx`: **1.079 baris** (48.735 bytes)
- `app/legal/review/page.tsx`: **658 baris** (29.019 bytes)

### 3. Duplicate Components
- `src/components/LegalReviewForm.tsx` (11.682 bytes) vs `src/components/legal/LegalReviewForm.tsx` (11.836 bytes).

### 4. Dead / Stub Components
- `src/components/WorkflowDesigner.tsx` (14 baris dummy text).
- `src/components/debug/DebugCachePanel.tsx` (Component debug visual).

---

## 9. End-to-End Dependency Graph

```mermaid
graph TD
    subgraph Frontend Layer (Next.js)
        UI[Page Route /src/app] --> Context[AuthContext /src/context]
        UI --> Components[Components /src/components]
        Components --> ApiClient[Axios Client /src/lib/axios]
        Components -.->|Direct Axios Bypass| HardcodedUrl[Hardcoded http://localhost:4000]
    end

    subgraph Backend Layer (NestJS)
        ApiClient --> Controllers[NestJS Controllers /src/modules]
        HardcodedUrl -.-> Controllers
        Controllers --> Services[NestJS Services /src/modules]
        Services --> ORM[TypeORM Repository / QueryRunner]
        Services -.->|Runtime DDL| DBInfoSchema[INFORMATION_SCHEMA]
    end

    subgraph Database Layer (MySQL)
        ORM --> DBTables[(MySQL 31 Tables)]
        DBInfoSchema -.-> DBTables
    end
```

---

## 10. Domain Boundary Violation Report

| Incident ID | Origin Domain | Target Domain | Pelanggaran yang Terjadi |
| :--- | :--- | :--- | :--- |
| **BND-VIOL-01** | Marketing | Legal | `MarketingService` mengedit record `contracts` dan mengeksekusi DDL `ALTER TABLE contracts` secara mentah. |
| **BND-VIOL-02** | Legal | Project | `LegalService` membuat instance `Project` secara langsung di DB tanpa melalui `ProjectService`. |
| **BND-VIOL-03** | Frontend Component | Backend Core | 11 komponen frontend mengakses backend secara langsung via `axios.get('http://localhost:4000')` memotong layer `services/`. |

---

## 11. Dead Code & Unused Items Registry

| Kategori | Nama File / Symbol | Status Audit | Tindakan Rekomendasi |
| :--- | :--- | :--- | :--- |
| **Unused Page** | `frontend/src/app/workflow/page.tsx` | Menampilkan stub dummy component | Hapus atau lengkapi fungsionalitas |
| **Unused Component**| `frontend/src/components/WorkflowDesigner.tsx` | Dummy placeholder 14 baris | Hapus |
| **Duplicate Component**| `frontend/src/components/LegalReviewForm.tsx` | Duplikat dari `components/legal/` | Hapus file versi root |
| **Unused Endpoint** | `POST /api/v1/legal/review` | Legacy endpoint | Deprecate & Hapus |
| **Unused DTO** | `TenderDetailResponseDto` | Tidak terikat pada Response Interceptor | Unifikasi atau Hapus |

---

## 12. Architecture Findings (P0 - P3)

### P0 (Critical - Must Fix Before Prod)
- **SYS-P0-01**: Backdoor Autentikasi di `AuthService.ts` (`password123` / `123456`).
- **SYS-P0-02**: `JwtAuthGuard` dinonaktifkan di `DocumentController.ts`.
- **SYS-P0-03**: Auto-login kredensial superadmin hardcoded di `DashboardPage.tsx`.

### P1 (High - Structural & Architectural)
- **SYS-P1-01**: Runtime DDL `ALTER TABLE contracts` di `MarketingService.onModuleInit()`.
- **SYS-P1-02**: 24+ Lokasi hardcoded `http://localhost:4000` di komponen frontend.
- **SYS-P1-03**: Mocking `QueueModule` (BullMQ) & disabled RabbitMQ consumer di `main.ts`.

### P2 (Medium - Code Hygiene & Size)
- **SYS-P2-01**: 100% Client-Side Rendering pada Next.js App Router (`"use client"` di seluruh halaman).
- **SYS-P2-02**: Over-sized God Components (`SalesPipelinePage.tsx` 1.547 baris).
- **SYS-P2-03**: Duplikasi file `LegalReviewForm.tsx`.

### P3 (Low - Housekeeping)
- **SYS-P3-01**: Log debug non-standar `[NUKLIR]` di `MarketingService.ts`.
- **SYS-P3-02**: Stub components `WorkflowDesigner.tsx` & `DebugCachePanel.tsx`.

---

## 13. System Health Score (46/100)

| Kategori Evaluasi | Skor | Alasan Evaluasi & Evidence |
| :--- | :---: | :--- |
| **Architecture** | 40/100 | Pelanggaran domain boundary, DDL di application service, 100% CSR pada Next.js. |
| **Maintainability** | 45/100 | Adanya God Components (>1.500 baris), duplikasi komponen, dan file stub. |
| **Coupling** | 40/100 | Keterikatan langsung antar-domain di level service & database query mentah. |
| **Cohesion** | 55/100 | Modul backend memiliki pemisahan folder yang jelas namun tercemar DDL logic. |
| **Scalability** | 50/100 | Mocked QueueModule dan ketiadaan indeks pada Foreign Key database. |
| **Readability** | 50/100 | Kode dipenuhi log debug non-standar (`[NUKLIR]`) dan hardcoded URL. |
| **TOTAL SYSTEM HEALTH** | **46/100** | **Kategori: Technical Debt Tinggi (Not Production Ready)** |

---

## Conclusion
Dokumen **SYSTEM MAPPING V1** ini mengonfirmasi bahwa alur integrasi sistem EPMS (Frontend → Backend → Database) telah terhubung secara fungsional. Namun, secara arsitektural sistem memiliki **Technical Debt dan risiko keamanan yang signifikan**. 

Dengan menggunakan dokumen pemetaan ini sebagai acuan, tim pengembang dapat mengeksekusi refactoring bertahap (mulai dari perbaikan P0 Security, pembersihan URL hardcoded, unifikasi service layer, hingga eliminasi *dead code*) secara terukur tanpa risiko merusak transaksi bisnis yang sedang berjalan.
