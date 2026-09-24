# 03. DATABASE BASELINE AUDIT DOCUMENT

> **Document ID**: `EPMS-DOC-DB-03`  
> **Stage**: **STAGE D1.1 — DATABASE AS SOURCE OF TRUTH**  
> **Source of Truth**: `database/epms_tvmubd_db.sql`  
> **Scope**: Comparative Audit of Database Baseline vs TypeORM Entities vs Migrations vs Services  
> **Status**: **READ-ONLY AUDIT & STRATEGIC BASELINE ALIGNMENT**  

---

## 1. EXECUTIVE SUMMARY

Dalam STAGE D1.1 ini, ditetapkan prinsip fundamental: **DATABASE ADALAH SINGLE SOURCE OF TRUTH (`database/epms_tvmubd_db.sql`)**.

Berdasarkan audit komparatif mendalam antara physical SQL dump baseline (`database/epms_tvmubd_db.sql`), 33 file TypeORM Entity (`backend/src/entities/*.entity.ts`), 8 file migration (`backend/src/migrations/*.ts`), dan modul service backend:

### Key Findings:
1. **Physical Baseline SQL Dump**: Memiliki **35 tabel** yang terdefinisi utuh dengan 275+ kolom, 26 Foreign Keys, dan 0 error DDL.
2. **TypeORM Entity Drift**: Ditemukan properti pada Entity `Tender` (`go_nogo_status`, `go_nogo_notes`, `go_nogo_by`, `go_nogo_at`, `revision_status`) yang **TIDAK ADA di Source of Truth Database**.
3. **Migration Drift & Invalidation**: Seluruh 8 file migration yang ada di folder `backend/src/migrations` berstatus **UNEXECUTED** pada database baseline. Migration `1785600000000` dan `1785700000000` mencoba mengubah tabel yang tidak ada di skema baseline tanpa menyinkronkan database terlebih dahulu.
4. **Service Level Failure**: `MarketingService.getTenders()` menangkap error SQL akibat Entity Drift secara senyap (`catch(e) { return []; }`), yang menyebabkan Kanban Board tampak blank total.

---

## 2. DATABASE INVENTORY (SOURCE OF TRUTH)

Ringkasan spesifikasi fisik database `epms_tvmubd_db` dari file baseline SQL:

- **Total Tables**: 35 Tabel
- **Primary Keys**: 35 Primary Keys (`id` bigint UNSIGNED AUTO_INCREMENT)
- **Foreign Keys**: 26 Foreign Key constraints
- **Storage Engine**: 100% `InnoDB`
- **Charset / Collation**: `utf8mb4` / `utf8mb4_unicode_ci`

### Daftar 35 Tabel Baseline:
```
audit_logs, contracts, contract_amendments, customers, dashboard_kpis, documents,
goods_receipts, invoices, milestones, notifications, outbox_events, payments,
permissions, projects, project_budgets, proposals, purchase_orders, purchase_order_items,
purchase_requests, purchase_request_items, rfqs, roles, role_permissions, tasks,
tenders, tender_activities, tender_price_history, users, user_roles, vendors,
vendor_comparisons, workflow_definitions, workflow_instances, workflow_tasks,
work_breakdown_structures
```

---

## 3. ENTITY INVENTORY

Ditemukan **33 file Entity TypeScript** di `backend/src/entities/`:

| No | Entity Class | Target Table | Defined Properties Count | Foreign Key Relations |
|---|---|---|---|---|
| 1 | `AuditLog` | `audit_logs` | 8 columns | Analyzed |
| 2 | `ContractAmendment` | `contract_amendments` | 6 columns | Analyzed |
| 3 | `Contract` | `contracts` | 17 columns | Analyzed |
| 4 | `Customer` | `customers` | 13 columns | Analyzed |
| 5 | `DashboardKpi` | `dashboard_kpis` | 4 columns | Analyzed |
| 6 | `Document` | `documents` | 8 columns | Analyzed |
| 7 | `GoodsReceiptItem` | `goods_receipt_items` | 10 columns | Analyzed |
| 8 | `GoodsReceipt` | `goods_receipts` | 10 columns | Analyzed |
| 9 | `InvoiceItem` | `invoice_items` | 11 columns | Analyzed |
| 10 | `Invoice` | `invoices` | 12 columns | Analyzed |
| 11 | `Notification` | `notifications` | 12 columns | Analyzed |
| 12 | `OutboxEvent` | `outbox_events` | 12 columns | Analyzed |
| 13 | `Payment` | `payments` | 10 columns | Analyzed |
| 14 | `PdfTemplate` | `pdf_templates` | 5 columns | Analyzed |
| 15 | `Project` | `projects` | 6 columns | Analyzed |
| 16 | `Proposal` | `proposals` | 7 columns | Analyzed |
| 17 | `PurchaseOrderItem` | `purchase_order_items` | 6 columns | Analyzed |
| 18 | `PurchaseOrder` | `purchase_orders` | 5 columns | Analyzed |
| 19 | `PurchaseRequestItem` | `purchase_request_items` | 6 columns | Analyzed |
| 20 | `PurchaseRequest` | `purchase_requests` | 5 columns | Analyzed |
| 21 | `Rfq` | `rfqs` | 4 columns | Analyzed |
| 22 | `Role` | `roles` | 2 columns | Analyzed |
| 23 | `Task` | `tasks` | 6 columns | Analyzed |
| 24 | `TenderActivity` | `tender_activities` | 4 columns | Analyzed |
| 25 | `TenderPriceHistory` | `tender_price_history` | 5 columns | Analyzed |
| 26 | `Tender` | `tenders` | 32 columns | Analyzed |
| 27 | `UserSession` | `user_sessions` | 7 columns | Analyzed |
| 28 | `User` | `users` | 5 columns | Analyzed |
| 29 | `VendorComparison` | `vendor_comparisons` | 5 columns | Analyzed |
| 30 | `Vendor` | `vendors` | 8 columns | Analyzed |
| 31 | `WorkBreakdownStructure` | `work_breakdown_structures` | 5 columns | Analyzed |

---

## 4. MIGRATION INVENTORY

Audit 8 file migration pada `backend/src/migrations/`:

| No | Migration File | Target Table | Primary Operation | Status di DB | Relevansi |
|---|---|---|---|---|---|
| 1 | `1721180000000-UpdateTenderStatusEnum.ts` | `tenders` | Modify ENUM status | UNEXECUTED | Obsolete / Deprecated |
| 2 | `1721182000000-EvolveContractsModule.ts` | `contracts` | Add legal_status, project_manager_id | UNEXECUTED | Obsolete (Kolom sudah ada di Baseline SQL) |
| 3 | `1721387600000-AddRefreshTokenToUsers.ts` | `users` | Add refresh_token column | UNEXECUTED | Obsolete (Kolom sudah ada di Baseline SQL) |
| 4 | `1721500000000-AddOptimisticLockVersionColumns.ts` | `tenders`, `contracts` | Add version column | UNEXECUTED | Obsolete (Kolom sudah ada di Baseline SQL) |
| 5 | `1785484532784-AddRevisionRequestedEnum.ts` | `contracts` | Add REVISION_REQUESTED enum | UNEXECUTED | Obsolete (Kolom sudah ada di Baseline SQL) |
| 6 | `1785500000000-CleanupOrphanedContracts.ts` | `contracts` | Delete orphaned contracts | UNEXECUTED | Dangerous / Non-Relevan |
| 7 | `1785600000000-AddGoNoGoGateToTenders.ts` | `tenders` | Add go_nogo_status columns | UNEXECUTED | **UNALIGNED WITH BASELINE DB** |
| 8 | `1785700000000-AddRevisionStatusToTenders.ts` | `tenders` | Add revision_status column | UNEXECUTED | **UNALIGNED WITH BASELINE DB** |

---

## 5. DATABASE DRIFT MATRIX

Matriks keberadaan komponen utama di antara 4 Layer Sistem:

| Component / Table | Database Baseline | TypeORM Entity | Migration File | Status Alignment |
|---|---|---|---|---|
| `tenders` (Base Table) | YES (24 cols) | YES (29 cols) | YES | ⚠️ **ENTITY DRIFT** |
| `tenders.go_nogo_status` | ❌ NO | YES | YES (`1785600000000`) | ❌ **UNSYNCHRONIZED (Entity & Migration ahead of DB)** |
| `tenders.go_nogo_notes` | ❌ NO | YES | YES (`1785600000000`) | ❌ **UNSYNCHRONIZED** |
| `tenders.go_nogo_by` | ❌ NO | YES | YES (`1785600000000`) | ❌ **UNSYNCHRONIZED** |
| `tenders.go_nogo_at` | ❌ NO | YES | YES (`1785600000000`) | ❌ **UNSYNCHRONIZED** |
| `tenders.revision_status` | ❌ NO | YES | YES (`1785700000000`) | ❌ **UNSYNCHRONIZED** |
| `contracts.legal_status` | YES | YES | YES (`1721182000000`) | ✅ IN BASELINE DB |
| `users.refresh_token` | YES | YES | YES (`1721387600000`) | ✅ IN BASELINE DB |
| `tenders.version` | YES | YES | YES (`1721500000000`) | ✅ IN BASELINE DB |

---

## 6. ENTITY DRIFT MATRIX

### A. Property ada di Entity tetapi TIDAK ADA di Database Source of Truth:
1. `Tender.go_nogo_status` (`GoNoGoStatus` Enum)
2. `Tender.go_nogo_notes` (`text`)
3. `Tender.go_nogo_by` (`bigint`)
4. `Tender.go_nogo_at` (`datetime`)
5. `Tender.revision_status` (`RevisionStatus` Enum)

### B. Property ada di Database tetapi TIDAK ADA di Entity:
- 0 Column (Seluruh kolom fisik di baseline SQL sudah dipetakan ke Entity).

### C. Discrepancy pada Service Layer:
- `MarketingService.getTenders()` menggunakan query filter `marketing_pic_id` tanpa fallback `created_by` untuk tender legacy yang dibuat sebelum `marketing_pic_id` wajib diisi.

---

## 7. MIGRATION DRIFT MATRIX

1. **Migration Valid & Relevan**: `1785600000000-AddGoNoGoGateToTenders.ts`, `1785700000000-AddRevisionStatusToTenders.ts` *(Memerlukan eksekusi terkoordinasi pasca penetapan baseline)*.
2. **Migration Obsolete (Sudah Ada di Baseline SQL)**:
   - `1721182000000-EvolveContractsModule.ts`
   - `1721387600000-AddRefreshTokenToUsers.ts`
   - `1721500000000-AddOptimisticLockVersionColumns.ts`
   - `1785484532784-AddRevisionRequestedEnum.ts`
3. **Migration Berbahaya / Non-Relevan**: `1785500000000-CleanupOrphanedContracts.ts` *(Dilarang dijalankan ulang di production)*.

---

## 8. DAFTAR PRIORITAS PERBAIKAN

### Priority P0 (Production Blocking & Core Integrity):
1. **Sinkronisasi Skema Database MariaDB terhadap Entity**: Menjalankan penambahan 5 kolom (`go_nogo_status`, `go_nogo_notes`, `go_nogo_by`, `go_nogo_at`, `revision_status`) di database MariaDB server agar TypeORM QueryBuilder tidak melempar `ER_BAD_FIELD_ERROR`.
2. **Seeding Legacy State**: Set `go_nogo_status = 'GO'` pada tender-tender lama yang sudah di stage pasca-LEAD agar tidak terikat Hard Gate secara keliru.

### Priority P1 (Feature & High Stability):
1. **Pembersihan Migration History**: Memasukkan record 6 migration obsolete ke tabel `migrations` agar TypeORM CLI tidak mencoba mengeksekusi ulang ddl yang sudah ada di database.
2. **Refactoring Service Error Suppression**: Mengubah `catch(e) { return []; }` di `MarketingService.getTenders()` menjadi exception handler transparan.

### Priority P2 (Maintenance & Code Hygiene):
1. **Regenerasi Entity**: Menyelaraskan seluruh decorator TypeORM Entity dengan tipe data presisi pada `database/epms_tvmubd_db.sql`.

---

## 9. REKOMENDASI BASELINE & LANGKAH NEXT STAGE

1. **Source of Truth**:  
   Ditetapkan secara mutlak bahwa **`database/epms_tvmubd_db.sql` ADALAH SINGLE SOURCE OF TRUTH UTAMA PROYEK EPMS**.
2. **Migration Management Strategy**:  
   - Migration `1721180000000` s/d `1785500000000` dipensiunkan / ditandai sebagai `APPLIED_IN_BASELINE`.
   - Migration `1785600000000` & `1785700000000` dipertahankan sebagai migration resmi penambahan fitur GO / NO GO Gate.
3. **Langkah Berikutnya (Menunggu Persetujuan Masuk ke STAGE D1.2)**:  
   Menyiapkan skrip penyelarasan skema DB resmi tanpa merusak 49 data tender yang ada saat ini.
