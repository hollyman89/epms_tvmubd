# EPMS IMPLEMENTATION STATE — DEVELOPMENT SSOT

> **Document Version:** 2.0.0  
> **Last Repository Audit:** 2026-08-28  
> **Primary Authority:** Actual Source Code & Database Schema  
> **Status:** Active Canonical Reference Document (SSOT)

---

## 1. Development Rules

### 1.1 Guiding Principles
1. **"Process recovery MUST be evidence-driven."**
2. **"Never perform broad process termination when an exact process can be identified."**
3. **"Do not modify application code to solve a process management problem."**
4. **"DEV SERVER and PRODUCTION BUILD are mutually exclusive operating modes on the same frontend repository."**

### 1.2 Core Architectural Axioms
1. **Source Code Actual is Primary Authority:** Laporan historis, audit markdown lama, atau catatan riwayat hanya bersifat evidence sekunder. Jika terdapat diskrepansi antara dokumen teks dan repository, **source code aktual yang berlaku**.
2. **Zero Assumptions:** Jangan berasumsi sebuah fitur telah selesai tanpa memeriksa kode aktual, file migrasi resmi, DTO, controller, service, dan komponen frontend terkait.
3. **Database as SSOT:** Struktur data dan integritas relasional wajib dijamin oleh schema database (MySQL TypeORM) dengan foreign keys, constraints, dan soft-delete columns (`deleted_at`, `deleted_by`).
4. **Backend as Business Authority:** Seluruh kalkulasi numerik, validasi hierarki pohon, otorisasi peran, dan mutasi status wajib dilakukan secara otoritatif di server NestJS. Subtotal atau kalkulasi yang dikirim oleh client diabaikan dan dihitung ulang di backend.
5. **Frontend as Consumer:** Next.js frontend bertindak murni sebagai presentation layer, interaction handler, dan API consumer. Frontend tidak boleh menyimpan status bisnis di `localStorage` sebagai pengganti database SSOT.
6. **LocalStorage for Recovery Only:** `localStorage` hanya diperbolehkan untuk migrasi legacy, recovery draft lokal saat koneksi terputus, dan UI preference sementara.
7. **Next.js Dev/Build Mutual Exclusion:** `npm run dev` dan `npm run build` dilarang berjalan bersamaan pada repository yang sama. Jika dev server aktif, wajib dihentikan sebelum menjalankan build produksi untuk mencegah artefak `.next` tertimpa dan memicu 404 chunk error.
8. **Graphify as Knowledge Tool:** Graphify adalah repository query/indexing tool, BUKAN database bisnis aplikasi.
9. **Strict Single Scope:** Setiap task pengerjaan hanya memiliki **1 (satu) objektif / phase spesifik** (*One phase = one objective*). Dilarang mengubah file di luar lingkup phase yang sedang dikerjakan.

---

## 2. Source of Truth Hierarchy

### 2.1 Governance Hierarchy
```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 1: EPMS_IMPLEMENTATION_STATE.md                                          │
│ Primary Development State of Truth, architecture state, module state,         │
│ phase status matrix, canonical next phase, technical debt, and global rules.  │
├────────────────────────────────────────────────────────────────────────────────┤
│ LEVEL 2: .agents/rules/*.md                                                    │
│ IDE & agent runtime operational rules, specific execution constraints.         │
├────────────────────────────────────────────────────────────────────────────────┤
│ LEVEL 3: Task Prompt                                                           │
│ Objective of the current active phase, file scope, acceptance criteria.        │
└────────────────────────────────────────────────────────────────────────────────┘
```
- **Rule of Precedence:** Task prompt **TIDAK BOLEH** bertentangan dengan Development SSOT (`EPMS_IMPLEMENTATION_STATE.md`). Jika terjadi konflik, Development SSOT memiliki prioritas lebih tinggi daripada asumsi task prompt.

### 2.2 Factual Implementation Resolution Priority
Saat menentukan status aktual implementasi sistem, urutan otoritas pembuktian adalah:
1. **Actual Source Code** (TypeScript classes, services, controllers, components)
2. **Actual Database Schema & Tables** (MySQL live schema, columns, foreign keys)
3. **Actual API & Runtime Behavior** (HTTP responses, unit/integration test assertions)
4. **`EPMS_IMPLEMENTATION_STATE.md`** (Development SSOT)
5. **Previous Reports & Historical Markdown**
6. **Task Prompt Assumptions**

> [!IMPORTANT]
> Jika report lama berbeda dengan source code actual: **SOURCE CODE MENANG**.  
> Jika state file berbeda dengan source code: **Lakukan READ-ONLY AUDIT lalu perbarui state file**. JANGAN melakukan coding berdasarkan report yang sudah basi (*stale*).

---

## 3. Current Architecture

```text
┌────────────────────────┐      REST API / WebSocket      ┌────────────────────────┐
│   Next.js 14 App Router│ ◄────────────────────────────► │   NestJS 10 Framework  │
│   (React 18 + AntD v5) │       (Bearer JWT / RBAC)      │  (TypeScript Modular)  │
└────────────────────────┘                                └───────────┬────────────┘
                                                                      │ TypeORM
                                                                      ▼
                                                          ┌────────────────────────┐
                                                          │   MySQL 8.0 Database   │
                                                          │   (Relational SSOT)    │
                                                          └────────────────────────┘
```

- **Backend:** NestJS v10 (TypeScript)
  - Modular architecture dengan 17+ domain modules (`Auth`, `Project`, `Procurement`, `Finance`, `Legal`, `Marketing`, `Customers`, `Analytics`, `Audit`, `Notification`, `Workflow Engine`, dll.).
  - Database ORM: MySQL 8 via TypeORM (`synchronize: false` permanen, migrasi berbasis timestamp class resmi).
  - Background Processing: BullMQ + Redis (`ioredis`).
  - Realtime: WebSocket Gateway (`Socket.IO`).
  - API Documentation: Swagger / OpenAPI 3.0 di `/api/docs`.
  - Global API Prefix: `/api/v1`.
- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript
  - UI Library: Ant Design (antd v5), Ant Design Icons, Ant Design Charts.
  - State & Data Fetching: TanStack React Query v5 + Centralized Axios client (`/src/lib/axios.ts`).
  - Realtime Client: `socket.io-client` via `SocketProvider`.
  - Styling: Vanilla CSS Modules + global theme tokens (Ant Design tokens).

---

## 4. Module State

### Project Master
- **Status:** `COMPLETE`
- **Database Entity:** [`Project`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/project.entity.ts) (tabel `projects`).
- **Core Endpoints:**
  - `GET /api/v1/project/operational-board` — Mengambil daftar proyek aktif dan antrean charter kickoff (`PENDING_KICKOFF`).
  - `POST/PATCH /api/v1/project/charters/:id/claim` — Klaim project charter dan transisi ke status `IN_PROGRESS` (kicking off project).
  - `POST/PATCH /api/v1/project/charters/:id/reject` — Pengembalian charter ke Marketing dengan alasan revisi.
  - `POST/PATCH /api/v1/project/charters/:id/resubmit` — Pengajuan ulang charter setelah revisi.
- **Frontend Components:**
  - [`ProjectOperationTab.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/ProjectOperationTab.tsx)
  - [`ProjectDetailDrawer.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/ProjectDetailDrawer.tsx)
  - [`project.service.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/services/project.service.ts)

### Project Location
- **Status:** `COMPLETE`
- **Database Schema:** Kolom `site_name`, `address`, `city`, `province`, `postal_code`, `latitude`, `longitude` pada tabel `projects`.
- **Migration:** [`1787800000000-AddProjectLocationColumns.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/migrations/1787800000000-AddProjectLocationColumns.ts).
- **Backend Service:** Validasi koordinat GPS dan payload lokasi pada [`claimCharter`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.ts#L423-L525).
- **Unit Test:** [`project-location.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-location.spec.ts) (Passed).

### WBS (Work Breakdown Structure)
- **Status:** `COMPLETE`
- **Database Entity:** [`WorkBreakdownStructure`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/wbs.entity.ts) (tabel `work_breakdown_structures`).
- **Migration:** [`1787900000000-AddWbsPlanningColumns.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/migrations/1787900000000-AddWbsPlanningColumns.ts).
- **Backend API & Validator:**
  - `PUT /api/v1/project/:projectId/wbs-tree` — Atomically persists 3-level hierarchical WBS tree.
  - `GET /api/v1/project/:projectId/wbs` — Flat WBS fetch.
  - Aturan: Total bobot Root Level 1 wajib 100.00% ($\pm 0.01\%$), kedalaman maksimal 3 tingkat, deteksi siklus/circular dependency, kode unik.
  - Persistent ID: Stable ID preservation dengan diff-based sync dan soft-delete.
- **Frontend Integration:**
  - [`WbsTreeTableModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/WbsTreeTableModal.tsx)
  - `ProjectService.saveWbsTree` & `ProjectService.getWbsByProject` di [`project.service.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/services/project.service.ts#L90-L109).
  - Deprekasi `localStorage` selesai; sinkronisasi state 100% via API.
- **Tests & UAT:**
  - [`wbs-tree.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/wbs-tree.spec.ts) (Passed).
  - [`wbs-validation.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/wbs-validation.spec.ts) (Passed).
  - [`wbs-frontend-api-uat.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/wbs-frontend-api-uat.spec.ts) (Passed).

### Cost / RAB (Rencana Anggaran Biaya)
- **Status:** `COMPLETE`
- **Sub-Phase Details:**
  - **R11.1.3-A (Database Schema & Entities):** `COMPLETE`  
    Entity [`ProjectCostEstimate`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/project-cost-estimate.entity.ts) & [`CostItem`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/cost-item.entity.ts).  
    Migration: [`1788000000000-CreateProjectCostEstimateAndItems.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/migrations/1788000000000-CreateProjectCostEstimateAndItems.ts).
  - **R11.1.3-B (DTO & Validator):** `COMPLETE`  
    DTO [`save-cost-estimate.dto.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/dto/save-cost-estimate.dto.ts) & Validator [`cost-estimate.validator.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/cost-estimate.validator.ts).  
    Aturan: Server-authoritative subtotal, validasi WBS scope leaf node, pemetaan kategori ke grup (DIRECT, INDIRECT, RISK), pembulatan desimal.
  - **R11.1.3-C (Backend API & Controller):** `COMPLETE`  
    Endpoints `GET /api/v1/project/:projectId/cost-estimate` dan `PUT /api/v1/project/:projectId/cost-estimate`.
  - **R11.1.3-C-HARDENING (Transactional Sync & Guards):** `COMPLETE`  
    Database transaction, diff-based upsert, stable ID preservation, item ownership verification, guard `APPROVED` status immutability, hierarchical WBS rollup summary.
  - **R11.1.3-D (Frontend UI Modal & Service Integration):** `COMPLETE`  
    [`PmCostEstimationModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/PmCostEstimationModal.tsx), [`PmOperationalPlanModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/PmOperationalPlanModal.tsx), [`project.service.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/services/project.service.ts#L110-L126).
  - **R11.1.3-D-VERIFY (E2E Frontend ↔ API Browser UAT):** `COMPLETE`  
    [`cost-estimate-frontend-api-uat.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/cost-estimate-frontend-api-uat.spec.ts) (11 tests passed, 100%).
- **Automated Tests:**
  - [`cost-estimate-validation.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/cost-estimate-validation.spec.ts) (21 tests passed).
  - [`cost-estimate-service.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/cost-estimate-service.spec.ts) (23 tests passed).

### Schedule & Gantt
- **Status:** `COMPLETE`
- **Sub-Phase Details:**
  - **R11.1.4-A (Architecture Audit & Data Model Decisions):** `COMPLETE`  
    Analisis arsitektur, granularitas harian, semantik durasi, penegakan isolasi proyek via `project_id`, dan dependensi finish-to-start.
  - **R11.1.4-B (Database Schema Evolution & Task Entity Hardening):** `COMPLETE`  
    Migration: [`1788100000000-EvolveTasksTableForGanttPlanning.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/migrations/1788100000000-EvolveTasksTableForGanttPlanning.ts).  
    Entity: [`Task`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/task.entity.ts) terpetakan lengkap (`projectId`, `wbsId`, `name`, `isMilestone`, `startDate`, `endDate`, `duration`, `predecessorTaskId`, `dependencyType`, `progress`, `status`, `assigneeId`, audit columns).
  - **R11.1.4-C (DTO, Validator & Backend REST API):** `COMPLETE`  
    DTO [`save-project-schedule.dto.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/dto/save-project-schedule.dto.ts) & Validator [`schedule.validator.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/schedule.validator.ts).  
    Endpoints: `GET /api/v1/project/:projectId/schedule` dan `PUT /api/v1/project/:projectId/schedule`.  
    Aturan: Leaf-only WBS, server-authoritative duration (`endDate - startDate`), milestone duration = 0, Finish-to-Start date integrity, cycle detection, stable task IDs, atomic transactional diff-based upsert, soft deletion removed tasks.
  - **R11.1.4-D (Schedule/Gantt Frontend API Integration & E2E UAT):** `COMPLETE`  
    Frontend Service: `ProjectService.getProjectSchedule` & `saveProjectSchedule`.  
    Komponen: [`ScheduleGanttTab.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/ScheduleGanttTab.tsx), [`PmOperationalPlanModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/PmOperationalPlanModal.tsx).  
    E2E UAT: [`schedule-frontend-api-uat.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/schedule-frontend-api-uat.spec.ts) (13 tests passed, 100% success).  
    Backend wins over localStorage, task ID preservation, WBS leaf-level scheduling, milestone zero duration, Finish-to-Start predecessor mapping, day-level Gantt chart, double-save protection.
- **Automated Tests:**
  - [`task-schema.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/task-schema.spec.ts) (20 tests passed).
  - [`schedule-validation.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/schedule-validation.spec.ts) (24 tests passed).
  - [`schedule-service.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/schedule-service.spec.ts) (18 tests passed).
  - [`schedule-frontend-api-uat.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/schedule-frontend-api-uat.spec.ts) (13 tests passed).

### Operational Plan Readiness Engine
- **Status:** `COMPLETE`
- **Backend API & Validator:**
  - `GET /api/v1/project/:projectId/operational-readiness` — Mengkalkulasi kesiapan teknis 4 Pilar (WBS, Cost, Schedule, Initial Condition) dan Procurement Gate secara deterministik langsung dari Database SSOT.
  - Validator: [`operational-readiness.validator.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/operational-readiness.validator.ts).
  - DTO: [`operational-readiness.dto.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/dto/operational-readiness.dto.ts).
  - Aturan: Evaluasi WBS (100% root weight, major package >= 1, leaf >= 1, no cycles), Cost (total > 0, math valid, 0 orphaned WBS items), Schedule (100% leaf deliverables scheduled, valid dates, Finish-to-Start chronology, zero cycles), Initial Condition (`NOT_STARTED` di server sampai R11.1.5-C), Procurement Gate (`NOT_SUBMITTED` di server sampai R11.1.5-C).
- **Unit Tests:**
  - [`operational-readiness.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/operational-readiness.spec.ts) (27 tests passed, 100%).

### Initial Condition
- **Status:** `COMPLETE` (Frontend) / `PENDING_DB_PERSISTENCE` (Backend Phase R11.1.5-C)
- **Frontend Component:** [`ProjectInitialConditionModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/ProjectInitialConditionModal.tsx).
- **Scope:** Menampilkan baseline snapshot tender, customer profile, nilai kontrak SPK, dan deskripsi lingkup awal saat PMO kickoff.

### Management Review & Procurement Gate
- **Status:** `COMPLETE` (Frontend + Backend Database SSOT — Phase R11.1.5-C & R11.1.5-D)
- **Frontend Components:**
  - [`ReviewTrackingTimeline.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/ReviewTrackingTimeline.tsx)
  - [`PmOperationalPlanReviewModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/PmOperationalPlanReviewModal.tsx)
  - [`ProjectInitialConditionModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/ProjectInitialConditionModal.tsx)
  - [`PmOperationalPlanModal.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/PmOperationalPlanModal.tsx)
  - [`ProjectOperationTab.tsx`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/ProjectOperationTab.tsx)
- **Backend SSOT:** REST APIs for `initial-condition`, `management-review/submit`, `management-review/decide`, `operational-readiness`. Audit trail event logging pada MySQL DB.

### Other Domain Modules
- **Procurement:** `PARTIAL` (Procurement Flow aktif, Purchase Request terintegrasi WBS budget check dan Database SSOT Procurement Gate). Entity: `PurchaseRequest`, `PurchaseOrder`, `GoodsReceipt`.
- **Finance:** `PARTIAL` (Invoicing, Payment milestones, 3-way matching).
- **Marketing & Legal:** `COMPLETE` (Tender lifecycle, SPK workflow, Legal review queue, SLA grace period).

---

## 5. Phase Status Matrix

| Phase | Scope | Status | Evidence | Last Verified |
|---|---|:---:|---|:---:|
| **R11.1.1** | Project Charter Kickoff & Site Location Columns | `COMPLETE` | `1787800000000-AddProjectLocationColumns.ts`, `project-location.spec.ts` (Passed), `ProjectOperationTab.tsx` | 2026-08-28 |
| **R11.1.2** | WBS Planning & Hierarchical Tree API SSOT | `COMPLETE` | `1787900000000-AddWbsPlanningColumns.ts`, `save-wbs-tree.dto.ts`, `wbs-tree.spec.ts` (Passed), `wbs-frontend-api-uat.spec.ts` (Passed) | 2026-08-28 |
| **R11.1.3-A** | Cost Estimate / RAB Database Schema & Entities | `COMPLETE` | `1788000000000-CreateProjectCostEstimateAndItems.ts`, `ProjectCostEstimate`, `CostItem` | 2026-08-28 |
| **R11.1.3-B** | Cost Estimate DTO & Validation Layer | `COMPLETE` | `save-cost-estimate.dto.ts`, `cost-estimate.validator.ts`, `cost-estimate-validation.spec.ts` (Passed) | 2026-08-28 |
| **R11.1.3-C** | Cost Estimate Backend API & Controller | `COMPLETE` | `ProjectController.saveCostEstimate`, `ProjectController.getCostEstimate` | 2026-08-28 |
| **R11.1.3-C-HARDENING** | Transaction, Immutability & Stable ID Preservation | `COMPLETE` | `cost-estimate-service.spec.ts` (23 tests passed), Diff-based upsert in `project.service.ts` | 2026-08-28 |
| **R11.1.3-D** | Cost Estimate Frontend UI Modal & Service Integration | `COMPLETE` | `ProjectService.saveCostEstimate`, `PmCostEstimationModal.tsx`, `PmOperationalPlanModal.tsx` | 2026-08-28 |
| **R11.1.3-D-VERIFY** | Cost Estimate E2E Frontend ↔ API Browser UAT | `COMPLETE` | `cost-estimate-frontend-api-uat.spec.ts` (11 test suites / 100% Passed) | 2026-08-28 |
| **R11.1.4-A** | Schedule Architecture & Data Model Decisions | `COMPLETE` | `R11.1.4-B0 Decision Report`, `ScheduleGanttTab.tsx` audit | 2026-08-28 |
| **R11.1.4-B** | Schedule Schema Evolution & Task Entity Hardening | `COMPLETE` | `1788100000000-EvolveTasksTableForGanttPlanning.ts`, `task-schema.spec.ts` (20 tests passed) | 2026-08-28 |
| **R11.1.4-C** | Schedule DTO, Validator & Backend REST API | `COMPLETE` | `schedule.validator.ts`, `schedule-validation.spec.ts` (24 tests passed), `schedule-service.spec.ts` (18 tests passed) | 2026-08-28 |
| **R11.1.4-D** | Schedule/Gantt Frontend API Integration & E2E UAT | `COMPLETE` | `ScheduleGanttTab.tsx`, `PmOperationalPlanModal.tsx`, `schedule-frontend-api-uat.spec.ts` (13 tests passed) | 2026-08-28 |
| **R11.1.5-A** | Project Operational Plan Comprehensive Review | `COMPLETE` | `R11.1.5-A Comprehensive Review Report` (182 Tests passed) | 2026-08-28 |
| **R11.1.5-A1** | Operational Plan Readiness Business Contract Final Lock | `COMPLETE` | `R11.1.5-A1 Final Contract Correction Report` | 2026-08-28 |
| **R11.1.5-B** | Backend Operational Plan Readiness Engine & API | `COMPLETE` | `GET /api/v1/project/:projectId/operational-readiness`, `operational-readiness.validator.ts`, `operational-readiness.spec.ts` (27 tests passed) | 2026-08-28 |
| **R11.1.5-C0** | Initial Condition + Management Review Data Model & Workflow Audit | `COMPLETE` | `R11.1.5-C0 Final Architecture Report` | 2026-08-28 |
| **R11.1.5-C1** | Operational Plan Management Schema & Entity Hardening | `COMPLETE` | `1788200000000-CreateOperationalPlanManagementTables.ts`, `ProjectInitialCondition`, `ProjectManagementReview`, `operational-plan-schema.spec.ts` (18 tests passed) | 2026-08-28 |
| **R11.1.5-C2** | Initial Condition + Management Review API & Workflow | `COMPLETE` | `SaveInitialConditionDto`, `DecideManagementReviewDto`, `InitialConditionValidator`, `ManagementReviewValidator`, `GET/PUT initial-condition`, `GET/POST submit/decide management-review`, `management-review-service.spec.ts` (44 tests passed) | 2026-08-28 |
| **R11.1.5-D0** | Operational Plan Frontend LocalStorage / API Audit | `COMPLETE` | `R11.1.5-D0 Audit Report` (19 Sections) | 2026-08-28 |
| **R11.1.5-D0.1** | Legacy LocalStorage Reset / Migration Policy | `COMPLETE` | `R11.1.5-D0.1 Policy Report` (23 Sections) | 2026-08-28 |
| **R11.1.5-D** | Operational Plan Frontend API Integration + LocalStorage Decommission | `COMPLETE` | `project.service.ts` (6 new methods), `ProjectInitialConditionModal.tsx`, `PmOperationalPlanModal.tsx`, `PmOperationalPlanReviewModal.tsx`, `ProjectOperationTab.tsx`, `ProcurementPage.tsx`, `operational-plan-frontend-api-uat.spec.ts` (5 suites / 100% Passed) | 2026-08-28 |

---

## 6. Current Single Next Phase

```text
PHASE: R11.1.6

OBJECTIVE:
Project Operational Plan End-to-End Governance Audit, Final Integration Verification & Production Baseline Readiness.

Acceptance:
- Complete end-to-end verification across 4 pillars (WBS, Cost, Schedule, Initial Condition) + Management Review Gate
- Full regression test execution across backend and frontend
- Verification of zero dependency on localStorage for business authorities
```

---

## 7. Blocked / Deferred Work

- **RabbitMQ Microservice Consumer:** Saat ini dinonaktifkan di `main.ts` untuk memfasilitasi local development tanpa RabbitMQ cluster terpasang (menggunakan internal Event Emitter & BullMQ Redis).
- **Direct Database Table Creation in Code:** TypeORM `synchronize` diatur ke `false` secara permanen untuk mencegah drift schema database; seluruh perubahan skema wajib melalui TypeORM migration file resmi.
- **Vendor Self-Service Portal & Self-Service Password Reset:** Ditangguhkan ke milestone rilis eksternal (Post-V1).

---

## 8. Technical Debt

1. **Deprecated Static Files / Old Layout Cleanups:** Masih ada sisa artefak lama di branch git yang telah ditandai `D` (deleted) namun belum di-commit secara rapi di repository remote.
2. **Next.js App Router Structure Optimization:** Telah direstrukturisasi ke `(dashboard)` route group, memastikan tidak ada duplikasi halaman root lama.
3. **Last-Write-Wins Concurrency:** Saat ini jadwal dan RAB menggunakan model Last-Write-Wins tanpa optimistik lock versi token pada payload draft serentak.

---

## 9. Migration Rules

1. **TypeORM Migration Standard:** Seluruh migrasi wajib menggunakan TypeORM `MigrationInterface` resmi dan dieksekusi via runner TypeORM standar.
2. **File Location & Naming:** File migrasi disimpan di `backend/src/migrations/` dengan penamaan berbasis timestamp integer (e.g. `1788100000000-EvolveTasksTableForGanttPlanning.ts`).
3. **DILARANG:**
   - Standalone migration runner (`run_*_migration.ts`, `sync_*_migration.ts`).
   - Manual `INSERT` / fake history ke tabel `migrations`.
   - Menjalankan DDL di luar transaksi migrasi resmi.
4. **Karakteristik Wajib:**
   - **Deterministic:** Hasil eksekusi `up()` dan `down()` selalu konsisten.
   - **Reversible:** Metode `down()` wajib menghapus/mengembalikan kolom atau tabel secara bersih jika memungkinkan.
   - **Verified:** Wajib lolos verifikasi terhadap live database schema.

---

## 10. API Rules

1. **Project-Scoped:** Endpoint mutasi domain proyek wajib menyertakan `:projectId` pada URL (`/api/v1/project/:projectId/...`).
2. **Centralized & Typed:** DTO request wajib divalidasi via `class-validator` / dedicated validator classes.
3. **Server-Authoritative:** Subtotal finansial, durasi jadwal (`endDate - startDate`), dan agregasi pohon dihitung secara otoritatif oleh backend. Frontend tidak boleh membuat duplicate business rules.
4. **Authorized:** Seluruh endpoint dilindungi oleh `JwtAuthGuard` dan `RolesGuard`.
5. **Standard Response Structure:**
   ```json
   {
     "meta": {
       "code": 200,
       "status": "success",
       "message": "Project schedule saved successfully"
     },
     "data": { ... }
   }
   ```

---

## 11. Frontend Rules

1. **Zero Hardcoded IDs:** Dilarang menggunakan ID statis (e.g. `projectId || 1`). Parameter proyek wajib bersumber dari `Number(charter.id) > 0`.
2. **Zero Hardcoded URLs:** Dilarang hardcode `http://localhost:4000` di dalam komponen; gunakan konfigurasi `ENV.API_URL`.
3. **Centralized Axios Client:** Seluruh komunikasi REST wajib menggunakan `apiClient` dari [`frontend/src/lib/axios.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/axios.ts) yang mengelola token injection dan error handling secara terpusat.
4. **Persistent DB Identities:** Identitas entitas di UI wajib menggunakan Database Primary Key (`id: number`), bukan array index atau generated random keys.
5. **No False Success:** Dilarang menampilkan toast sukses atau menghapus dirty draft sebelum backend mengembalikan response HTTP 200/201.

---

## 12. LocalStorage Rules

1. **Role of LocalStorage:** `localStorage` HANYA diperuntukkan bagi:
   - Recovery draft saat PM mengedit sebelum disimpan ke server.
   - Migrasi data lokal legacy sesi terdahulu.
   - Filter UI dan preferensi tampilan sementara.
2. **DILARANG:** Menyimpan data finansial final, status persetujuan (*approval*), atau data yang sudah di-commit di database sebagai SSOT ke dalam `localStorage`.
3. **Migration Protocol (Backend Wins):**
   - Jika server memiliki data: **Backend data wins**, stale localStorage draft dibersihkan.
   - Jika server kosong & ada draft lokal: Tampilkan banner warning eksplisit *"Draft Lokal Terdeteksi"*. Jangan melakukan auto-sync tanpa interaksi user.
   - Jika sync server gagal: **Pertahankan draft lokal**, tampilkan pesan error deskriptif, jangan hapus input user.

---

## 13. Graphify Rules

1. **Default Mode: QUERY ONLY.**
2. **Perintah Diizinkan:** `graphify query "<question>"` (CLI) atau MCP tools (`query_graph`, `shortest_path`, `get_node`).
3. **DILARANG:** Menjalankan `graphify update .` secara otomatis setelah setiap modifikasi file kode.
4. **Izin Update:** `graphify update .` hanya boleh dijalankan jika:
   - Ada kebutuhan eksplisit sinkronisasi graph secara menyeluruh.
   - Alasan dan lingkup didokumentasikan dalam session log.

---

## 14. Process Management Reference

> Aturan operasional lengkap didefinisikan pada: [`.agents/rules/nextjs-process-management.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/.agents/rules/nextjs-process-management.md).

### Ringkasan Aturan Operasional:
1. **DILARANG:** `taskkill /IM node.exe /F` atau membunuh semua proses Node.js.
2. **DILARANG:** Membunuh backend NestJS (port 4000) untuk menyelesaikan insiden frontend.
3. **Wajib Identifikasi PID:** Cek `netstat -ano | findstr :3000` $\rightarrow$ Verifikasi via `Get-CimInstance Win32_Process` $\rightarrow$ Hanya kill exact PID Next.js frontend (`taskkill /PID <PID> /F`).
4. **Pembersihan `.next` Bersyarat:** Direktori `.next` HANYA boleh dihapus jika terdapat bukti fisik *chunk 404 mismatch* atau *corrupted build artifact*.
5. **DILARANG Blind Reset:** Dilarang menjalankan `npm install`, hapus `node_modules`, hapus `package-lock.json`, atau upgrade dependensi tanpa bukti kerusakan dependensi.

---

## 15. Testing Rules

1. **Evidence-Driven PASS:** Status `PASS` wajib dibuktikan dari log eksekusi command aktual (`npm test`, `npx playwright test`, `npm run type-check`).
2. **DILARANG Faking PASS:** Dilarang menyatakan test PASS hanya karena kode terlihat benar secara visual.
3. **DILARANG Menghapus Test:** Dilarang menghapus atau mengabaikan assertion test yang gagal hanya untuk menghasilkan status hijau semu.
4. **Single-Worker E2E Execution:** Playwright E2E UAT yang mengakses live database wajib dijalankan dengan `--workers=1` untuk mencegah race condition / collision data state.

---

## 16. Security Rules

1. **Backend as Security Boundary:** Proteksi otorisasi dan kontrol akses berada di backend via `JwtAuthGuard` dan `RolesGuard`. Menyembunyikan menu di frontend BUKAN boundary keamanan.
2. **Tenant & Project Isolation:** Akses data proyek wajib diverifikasi berdasarkan `:projectId` dan kepemilikan entitas. Dilarang cross-tenant leakage.
3. **Persistent Identity & Safe Deletes:**
   - Existing record $\rightarrow$ `UPDATE` in-place.
   - New record $\rightarrow$ `INSERT`.
   - Deleted record $\rightarrow$ `Soft Delete` (`deleted_at = NOW()`).
   - **DILARANG:** Pola *delete-all-and-reinsert* pada tabel yang memiliki foreign key references.

---

## 17. Agent Execution Rules (Execution Contract)

Setiap agent yang bekerja pada repositori ini terikat pada kontrak berikut:
1. **Read EPMS_IMPLEMENTATION_STATE.md first.**
2. **Verify repository actual before planning or coding.**
3. **Never repeat a COMPLETE phase.**
4. **Never create duplicate implementations, entities, or endpoints.**
5. **Never expand scope without explicit user instruction.**
6. **Never create ad-hoc migration runners outside TypeORM.**
7. **Never mutate the database outside approved migrations/tests.**
8. **Graphify default is QUERY ONLY (No automatic `graphify update .`).**
9. **Process recovery must be evidence-driven.**
10. **Never broad-kill Node processes (`taskkill /IM node.exe /F` is strictly forbidden).**
11. **Backend is business authority.**
12. **Database is SSOT.**
13. **Frontend is consumer.**
14. **LocalStorage is not canonical business storage.**
15. **If uncertain $\rightarrow$ perform a READ-ONLY AUDIT instead of coding.**
16. **After completion $\rightarrow$ update EPMS_IMPLEMENTATION_STATE.md.**
17. **After reporting $\rightarrow$ STRICT STOP.**

---

## Verification Snapshot — 2026-09-22

Local execution evidence is recorded in [the 22 September test report](../../reports/test_20260922.md). Both frontend and backend TypeScript checks passed. Frontend Jest: 46 passed across 3 suites. Backend Jest, excluding 5 shared-database suites: 1,155 passed and 77 failed across 61 suites (54 passed, 7 failed). Of the backend failures, 67 are missing test-module dependencies; 10 involve fixtures/expectations inconsistent with current project status and progress rules.

Eight existing authentication browser tests initially produced 7 passes and 1 login redirect timeout; the failed test passed on an unchanged targeted recheck. Forty API smoke checks passed with explicit MARKETING-role expectations, including expected 401/403 denials. No production build, shared-database migrations, or business-lifecycle mutations were performed. This snapshot does not supersede historical phase records or establish production readiness.

## 18. Change Governance

Setiap perubahan kode wajib mengikuti siklus 3-tahap:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. BEFORE EDITING                                                               │
│    - Baca EPMS_IMPLEMENTATION_STATE.md                                          │
│    - Verifikasi file scope dan target phase                                     │
│    - Lakukan audit read-only terhadap file eksisting                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. DURING EDITING                                                               │
│    - Terapkan minimal diff (ubah hanya baris yang relevan)                      │
│    - Pertahankan tipe data, komentar, dan backward compatibility                │
│    - Jangan melakukan opportunistic refactor di luar scope                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. AFTER EDITING                                                                │
│    - Jalankan unit tests / E2E UAT terkait                                      │
│    - Jalankan type-check dan build check                                        │
│    - Jalankan git diff untuk memverifikasi zero unintended changes              │
│    - Perbarui EPMS_IMPLEMENTATION_STATE.md                                      │
│    - Sajikan structured report lalu STRICT STOP                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```
