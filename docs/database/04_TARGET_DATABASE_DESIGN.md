# 04. TARGET DATABASE DESIGN SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-04`  
> **Stage**: **STAGE D1.2 — TARGET DATABASE DESIGN**  
> **Architecture Principle**: **DATABASE AS THE SINGLE SOURCE OF TRUTH**  
> **Flow Paradigm**: `DATABASE TARGET` ➔ `DATABASE SQL` ➔ `ENTITY` ➔ `REPOSITORY` ➔ `SERVICE` ➔ `API` ➔ `FRONTEND`  
> **References**: `docs/database/02_RUNTIME_DATABASE_AUDIT.md`, `docs/database/03_DATABASE_BASELINE_AUDIT.md`  
> **Status**: **STRATEGIC TECHNICAL SPECIFICATION (READ-ONLY DESIGN)**  

---

## 1. EXECUTIVE SUMMARY

STAGE D1.2 ini menetapkan Arsitektur Target Database resmi untuk Enterprise Project Management System (EPMS).
Tujuannya adalah mengeliminasi *System Drift* (Entity vs Migration vs Database mismatch) dengan menjadikan **Target Database Design sebagai Fondasi Absolut**.

### Core Technical Pillars:
1. **Normalization & Data Integrity**: Seluruh tabel diselaraskan ke 3rd Normal Form (3NF) dengan aturan foreign key constraint bertipe `RESTRICT`/`CASCADE` yang presisi.
2. **GO / NO GO Gate Data Model**: Mengadopsi **Hybrid Data Model** (Fast Querying Columns on `tenders` + Immutable Activity Log on `tender_activities` + Global Audit Trail on `audit_logs`).
3. **Audit Trail Standardization**: Pemisahan tegas antara Application Stream Activity (`tender_activities`), Transactional Outbox (`outbox_events`), dan Data Audit Trail (`audit_logs`).
4. **Clean Schema Alignment**: Penyelarasan tipe data, nullability, default values, dan enum across 35 tables.

---

## 2. EPMS DATABASE PRINCIPLES

1. **Database First Hierarchy**: Skema database fisik di MariaDB/MySQL adalah Source of Truth. TypeORM Entity hanya bertindak sebagai object mapper terhadap database fisik.
2. **Explicit Foreign Key Enforcement**: Mencegah orphan record dengan menegaskan constraint `FOREIGN KEY` pada seluruh relasi antar-domain.
3. **Strict Column Typing**: Menggunakan `bigint UNSIGNED` untuk Primary Keys, `decimal(19,2)` untuk moneter, dan `utf8mb4_unicode_ci` untuk pengkodean teks.
4. **Soft Delete Standard**: Seluruh tabel domain utama menggunakan `deleted_at datetime DEFAULT NULL` untuk compliance auditing.
5. **No Blind Error Suppression**: Service backend dilarang menyembunyikan SQL Error sebagai array kosong `[]`.

---

## 3. TARGET ARCHITECTURE

```
+-----------------------------------------------------------------------+
|                    EPMS TARGET DATABASE ARCHITECTURE                  |
+-----------------------------------------------------------------------+
|                                                                       |
|  [ Authentication & RBAC ]                                            |
|  users <---> user_roles <---> roles <---> role_permissions <---> permissions
|                                                                       |
|  [ Commercial & Tender Pipeline ]                                     |
|  customers ---> tenders ---> proposals ---> contracts                 |
|                   |               |             |                     |
|                   v               v             v                     |
|            tender_activities  tender_price  contract_amendments       |
|                                                 |                     |
|  [ Project Execution & Delivery ]               v                     |
|  projects <-------------------------------------+                     |
|     |---> project_budgets                                             |
|     |---> milestones                                                  |
|     |---> tasks                                                       |
|     |---> work_breakdown_structures                                   |
|                                                                       |
|  [ Procurement & Inventory ]                                          |
|  vendors ---> purchase_requests ---> rfqs ---> purchase_orders        |
|                                                     |---> goods_receipts |
|                                                                       |
|  [ Finance & Billing ]                                                |
|  invoices ---> payments                                               |
|                                                                       |
|  [ Workflow & System Audit ]                                          |
|  workflow_definitions ---> workflow_instances ---> workflow_tasks    |
|  audit_logs | notifications | outbox_events | dashboard_kpis         |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 4. TABLE-BY-TABLE REVIEW (35 TABLES)

Berikut audit & desain spesifik untuk 35 tabel EPMS:

### 4.1 Domain: Authentication & RBAC
1. **`users`**: **DIPERTAHANKAN**. Tambahkan kolom `last_login_at datetime NULL`. Tipe data ID `bigint UNSIGNED AUTO_INCREMENT`.
2. **`roles`**: **DIPERTAHANKAN**. Unique `name`.
3. **`permissions`**: **DIPERTAHANKAN**. Tambahkan seeder permission standar (`tender.create`, `contract.approve`, dll).
4. **`user_roles`**: **DIPERTAHANKAN**. PK Composite `(user_id, role_id)`. FK `ON DELETE CASCADE`.
5. **`role_permissions`**: **DIPERTAHANKAN**. PK Composite `(role_id, permission_id)`. FK `ON DELETE CASCADE`.

### 4.2 Domain: Marketing & Commercial Pipeline
6. **`customers`**: **DIPERTAHANKAN**. Unique `code`/`email`. Tipe data budget `decimal(19,2)`.
7. **`tenders`**: **DIPERTAHANKAN & RE-ARCHITECTED**.
   - Tambahkan 5 kolom resmi: `go_nogo_status` (ENUM: `PENDING`,`GO`,`NO_GO`), `go_nogo_notes` (text), `go_nogo_by` (bigint UNSIGNED), `go_nogo_at` (datetime), `revision_status` (ENUM: `NOT_REQUIRED`,`REQUIRED`,`COMPLETED`).
   - Ubah default `marketing_pic_id` agar mereferensikan user penanggung jawab secara eksplisit.
8. **`proposals`**: **DIPERTAHANKAN**. Relasi ke `tenders` (1:N or 1:1 active).
9. **`tender_activities`**: **DIPERTAHANKAN**. Digunakan sebagai Immutable Event Log stream perubahan stage & approval.
10. **`tender_price_history`**: **DIPERTAHANKAN**. Mencatat jejak negosiasi harga.

### 4.3 Domain: Legal & Contract Management
11. **`contracts`**: **DIPERTAHANKAN**.
    - Pastikan kolom `legal_status` (ENUM: `DRAFT`,`ON_REVIEW`,`APPROVED`,`REJECTED`,`REVISION_REQUESTED`) aktif.
    - Kolom `tender_id` & `proposal_id` ter-index dengan baik.
12. **`contract_amendments`**: **DIPERTAHANKAN**. Mencatat adendum nilai & durasi kontrak.
13. **`documents`**: **DIPERTAHANKAN**. Repositori file SPK, Proposal, dan Dokumen Legal.

### 4.4 Domain: Project Execution & Delivery (PMO)
14. **`projects`**: **DIPERTAHANKAN**. Terhubung 1:1 ke `contracts`.
15. **`project_budgets`**: **DIPERTAHANKAN**. Mengontrol anggaran Rab vs Realisasi.
16. **`milestones`**: **DIPERTAHANKAN**. Tahapan penyerahan pekerjaan.
17. **`tasks`**: **DIPERTAHANKAN**. Task operasional lapangan.
18. **`work_breakdown_structures`**: **DIPERTAHANKAN**. WBS hirarkis proyek.

### 4.5 Domain: Procurement & Vendor Management
19. **`vendors`**: **DIPERTAHANKAN**. Master data subkontraktor & supplier.
20. **`vendor_comparisons`**: **DIPERTAHANKAN**. Matriks komparasi penawaran vendor.
21. **`purchase_requests`**: **DIPERTAHANKAN**. Permintaan pembelian dari PMO.
22. **`purchase_request_items`**: **DIPERTAHANKAN**. Rincian barang/jasa PR.
23. **`rfqs`**: **DIPERTAHANKAN**. Request for Quotation ke vendor.
24. **`purchase_orders`**: **DIPERTAHANKAN**. Order pembelian ke supplier.
25. **`purchase_order_items`**: **DIPERTAHANKAN**. Rincian barang PO.
26. **`goods_receipts`**: **DIPERTAHANKAN**. Surat jalan / BAST penerimaan barang.

### 4.6 Domain: Finance & Billing
27. **`invoices`**: **DIPERTAHANKAN**. Tagihan termijn proyek.
28. **`payments`**: **DIPERTAHANKAN**. Pembayaran masuk & keluar.

### 4.7 Domain: Workflow Engine & System Audit
29. **`workflow_definitions`**: **DIPERTAHANKAN**. Master template BPMN/state machine.
30. **`workflow_instances`**: **DIPERTAHANKAN**. Instance workflow yang sedang berjalan.
31. **`workflow_tasks`**: **DIPERTAHANKAN**. Task approval yang menggantung di user.
32. **`audit_logs`**: **DIPERTAHANKAN**. Global data change audit log (old_value vs new_value).
33. **`notifications`**: **DIPERTAHANKAN**. In-app notification center.
34. **`outbox_events`**: **DIPERTAHANKAN**. Reliable messaging & event streaming pattern.
35. **`dashboard_kpis`**: **DIPERTAHANKAN**. Cache aggregasi snapshot performa.

---

## 5. RELATIONSHIPS REVIEW

Target Foreign Key Cardinality & Constraints:

| Source Table | Source Column | Target Table | Target Column | Cardinality | ON DELETE | ON UPDATE |
|---|---|---|---|---|---|---|
| `tenders` | `customer_id` | `customers` | `id` | N:1 | RESTRICT | CASCADE |
| `tenders` | `marketing_pic_id` | `users` | `id` | N:1 | SET NULL | CASCADE |
| `proposals` | `tender_id` | `tenders` | `id` | N:1 | CASCADE | CASCADE |
| `contracts` | `tender_id` | `tenders` | `id` | N:1 | SET NULL | CASCADE |
| `contracts` | `proposal_id` | `proposals` | `id` | N:1 | SET NULL | CASCADE |
| `contracts` | `customer_id` | `customers` | `id` | N:1 | RESTRICT | CASCADE |
| `projects` | `contract_id` | `contracts` | `id` | 1:1 | RESTRICT | CASCADE |
| `user_roles` | `user_id` | `users` | `id` | N:1 | CASCADE | CASCADE |
| `user_roles` | `role_id` | `roles` | `id` | N:1 | CASCADE | CASCADE |

---

## 6. ENUMS REVIEW

Desain Standar ENUM Database Target:

1. **`tenders.stage`**: `'LEAD'`, `'WAITING_GO_NO_GO'`, `'QUALIFICATION'`, `'PROPOSAL'`, `'NEGOTIATION'`, `'WON'`, `'LOST'`
2. **`tenders.status`**: `'NEW'`, `'IN_PROGRESS'`, `'WON'`, `'LOST'`, `'CANCELLED'`
3. **`tenders.go_nogo_status`**: `'PENDING'`, `'GO'`, `'NO_GO'`
4. **`tenders.revision_status`**: `'NOT_REQUIRED'`, `'REQUIRED'`, `'COMPLETED'`
5. **`contracts.legal_status`**: `'DRAFT'`, `'ON_REVIEW'`, `'APPROVED'`, `'REJECTED'`, `'REVISION_REQUESTED'`
6. **`contracts.status`**: `'PENDING'`, `'PENDING_LEGAL_REVIEW'`, `'ACTIVE'`, `'COMPLETED'`, `'TERMINATED'`, `'REJECTED'`

---

## 7. FOREIGN KEYS & INDEXES SPECIFICATION

Target Indexing Strategy:
1. **Primary Indexes**: Seluruh 35 tabel pada `id`.
2. **Foreign Key Indexes**: Seluruh kolom yang berakhiran `_id` atau `_by` WAJIB memiliki B-Tree Index untuk performa SQL JOIN.
3. **Search & Filter Indexes**:
   - `tenders` ➔ Index pada `(stage, go_nogo_status, deleted_at)`
   - `tenders` ➔ Index pada `(marketing_pic_id, created_by, deleted_at)`
   - `contracts` ➔ Index pada `(legal_status, status, deleted_at)`
   - `projects` ➔ Index pada `(contract_id, status)`

---

## 8. GO / NO GO DATA MODEL REVIEW

### Analisis 3 Pendekatan Arsitektur:
- **Option A (Pure Columns on `tenders`)**: Kueri cepat, namun kehilangan historis keputusan jika ada revisi ulang.
- **Option B (Separate Entity `go_no_go_approvals`)**: Historis sempurna, namun menambah JOIN berlebih untuk kueri sederhana.
- **Option C (Hybrid Architecture - RECOMMENDED TARGET)**:
  - **State Kolom Utama (`tenders` table)**: `go_nogo_status`, `go_nogo_notes`, `go_nogo_by`, `go_nogo_at`, dan `revision_status`. Memberikan respon instant pada Kanban Board & Hard Gate Validation.
  - **Event Audit Stream (`tender_activities` table)**: Setiap submit/re-submit/GO/NO_GO melempar record immutable ke `tender_activities` dengan type `SYSTEM`/`APPROVAL`.
  - **Global Audit Trail (`audit_logs` table)**: Merekam `old_value` dan `new_value` JSON saat status berubah.

---

## 9. DATABASE NORMALIZATION REVIEW

1. **First Normal Form (1NF)**: Seluruh kolom menyimpan nilai atomik. Kolom JSON (`old_value`, `new_value`) hanya digunakan untuk payload audit trail.
2. **Second Normal Form (2NF)**: Seluruh kolom non-key bergantung penuh pada Primary Key tabel masing-masing.
3. **Third Normal Form (3NF)**: Tidak ada ketergantungan transitif. Misal `customer_name` di-JOIN dari `customers.name` melalui `customer_id` (tidak di-duplikasi di tabel `tenders`).

---

## 10. SCALABILITY, SECURITY & PERFORMANCE REVIEW

1. **Read Performance**: Kueri Kanban Pipeline ter-index sempurna pada `(stage, go_nogo_status, marketing_pic_id, deleted_at)`.
2. **Security & Ownership**: Menerapkan kolom `created_by` dan `marketing_pic_id` di level DDL untuk memfasilitasi RBAC Data Isolation.
3. **Data Integrity**: Penggunaan `decimal(19,2)` untuk seluruh kalkulasi moneter memisahkan pembulatan floating point error.

---

## 11. DAFTAR PERUBAHAN SKEMA TARGET (SCHEMA DRIFT RESOLUTION PLAN)

### 11.1 Kolom yang Perlu Ditambah pada Database Baseline Target:
- **Tabel `tenders`**:
  1. `go_nogo_status` ENUM('PENDING', 'GO', 'NO_GO') NOT NULL DEFAULT 'PENDING'
  2. `go_nogo_notes` TEXT NULL
  3. `go_nogo_by` BIGINT UNSIGNED NULL
  4. `go_nogo_at` DATETIME NULL
  5. `revision_status` ENUM('NOT_REQUIRED', 'REQUIRED', 'COMPLETED') NOT NULL DEFAULT 'NOT_REQUIRED'

### 11.2 Kolom yang Perlu Dimodifikasi / Diselaraskan:
- **Tabel `tenders`**: Seeding `go_nogo_status = 'GO'` dan `revision_status = 'NOT_REQUIRED'` untuk seluruh data legacy yang berada pada stage pasca-LEAD (`QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `WON`).

### 11.3 Kolom / Tabel yang Perlu Dihapus:
- **Tidak ada tabel/kolom yang dihapus** untuk menjaga 100% backward compatibility dengan data existing.

---

## 12. KESIMPULAN AKHIR ARSITEKTUR TARGET

### Pertanyaan Evaluasi:
**"Apakah Database EPMS saat ini sudah layak menjadi fondasi jangka panjang?"**

### Jawaban Resmi:
👉 **BELUM (Namun Sangat Dekat / Near Ready).**

### Alasan Teknis:
1. Baseline database (`database/epms_tvmubd_db.sql`) sudah memiliki struktur 35 tabel relational yang sangat solid dan ternormalisasi dengan baik (3NF).
2. Namun, database fisik belum layak dijadikan fondasi jangka panjang sebelum dilakukan **penyelarasan skema resmi (Schema Drift Resolution)** untuk menambahkan 5 kolom pendukung fitur GO / NO GO Gate pada tabel `tenders`.
3. Setelah 5 kolom tersebut ditambahkan melalui skrip penyelarasan resmi dan data legacy disesuaikan, **Database EPMS Target akan 100% LAYAK DAN SANGAT KOKOH MENJADI FONDASI JANGKA PANJANG**.
