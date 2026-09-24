# 06. EPMS DATA MIGRATION STRATEGY SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-06`  
> **Stage**: **STAGE D1.4 — DATA MIGRATION STRATEGY**  
> **Status**: **OFFICIAL MIGRATION & TRANSITION POLICY (READ-ONLY SPECIFICATION)**  
> **Core Objective**: Zero Data Loss Data Migration Protocol for Target EPMS Architecture  

---

## 1. EXECUTIVE SUMMARY

Dokumen strategi migrasi data ini menetapkan panduan teknis perpindahan data dari skema legacy menuju **Target EPMS Database Design** secara aman, dapat diuji, dan dapat diulang (*repeatable*).

### Core Migration Objectives:
1. **Zero Data Loss Guarantee**: Seluruh 49 record tender, 48 proposal, 25 kontrak, 17 user, dan 138 audit trail dilindungi 100%.
2. **Zero Downtime Preparedness**: Strategi migrasi in-place & backward-compatible DDL untuk menjamin ketersediaan layanan.
3. **Backward Compatibility**: Data legacy yang dibuat sebelum berlakunya fitur GO / NO GO Gate otomatis diberikan state default `GO` agar tidak merusak alur kerja bisnis existing.
4. **Repeatability & Auditability**: Seluruh langkah transformasi data dituliskan sebagai skrip DDL/DML idempotent yang mencatat log audit transaksi.

---

## 2. SOURCE DATABASE VS TARGET ARCHITECTURE

Hubungan antar-komponen database dalam proses transisi:

- **Database Legacy**: Snapshot awal data produksi sebelum adopsi fitur baru.
- **Runtime Database**: Database MariaDB `epms_tvmubd_db` aktif saat ini yang melayani kueri backend.
- **SQL Baseline (`database/epms_tvmubd_db.sql`)**: Single Source of Truth fisik berkas SQL dump.
- **Target Database**: Skema hasil penyelarasan (35 tabel + 5 kolom resmi GO / NO GO Gate).

```
+--------------------+        +---------------------+        +---------------------+
|  Database Legacy   |  --->  |  SQL Baseline Dump  |  --->  |   Target Database   |
| (epms_tvmubd_db)   |        | (epms_tvmubd_db.sql)|        | (Schema Aligned DB) |
+--------------------+        +---------------------+        +---------------------+
```

---

## 3. TARGET DATABASE AS NEW BASELINE

Setelah proses migrasi diselesaikan, **Target Database Design menjadi Baseline Tunggal Baru**.
Seluruh komponen aplikasi wajib tunduk pada hirarki ini:

```
Target Database Design
       ↓
TypeORM Entity Mapping (*.entity.ts)
       ↓
Repository & Service Logic (*.service.ts)
       ↓
API Controllers & DTOs
       ↓
Frontend Application (Next.js)
```

---

## 4. DATA MIGRATION FLOW (9-STAGE PROTOCOL)

```
Legacy Database
       ↓
Stage 1: Data Assessment (Forensic Count)
       ↓
Stage 2: Data Cleaning (Nullability & Format Sanitization)
       ↓
Stage 3: Data Mapping (Column-to-Column Rules)
       ↓
Stage 4: Transformation (State Seeding & Legacy GO Fallback)
       ↓
Stage 5: Validation (Dry-Run Integrity Checks)
       ↓
Stage 6: Migration Execution (Idempotent DDL/DML Batch)
       ↓
Stage 7: Verification (Record Count & FK Consistency)
       ↓
Stage 8: Application Smoke Test (API & Kanban Validation)
       ↓
Go Live
```

---

## 5. DATA MAPPING SPECIFICATION

Pemetaan Perubahan Tabel & Kolom dari Legacy ke Target Database:

| Target Table | Column Name | Source Column | Transformation / Default Rule | Action Type |
|---|---|---|---|---|
| `tenders` | `go_nogo_status` | *(NEW)* | Set `GO` if stage != 'LEAD', else `PENDING` | **ADD COLUMN & SEED** |
| `tenders` | `go_nogo_notes` | *(NEW)* | Set `NULL` for legacy records | **ADD COLUMN** |
| `tenders` | `go_nogo_by` | *(NEW)* | Set `created_by` or `NULL` | **ADD COLUMN** |
| `tenders` | `go_nogo_at` | *(NEW)* | Set `created_at` or `NULL` | **ADD COLUMN** |
| `tenders` | `revision_status` | *(NEW)* | Set `NOT_REQUIRED` for legacy records | **ADD COLUMN & SEED** |
| `tenders` | `marketing_pic_id` | `marketing_pic_id` | Keep value; Fallback `created_by` in service | **PRESERVE VALUE** |
| `contracts` | `legal_status` | `legal_status` | Keep existing ENUM (`DRAFT`,`APPROVED`, etc) | **PRESERVE VALUE** |
| `users` | `id` | `id` | Keep PK `bigint UNSIGNED` | **PRESERVE VALUE** |

---

## 6. DATA QUALITY CHECK & SANITIZATION RULES

Pengujian Kualitas Data sebelum & sesudah eksekusi migrasi:

1. **NULL Check**: Memastikan kolom `NOT NULL` (seperti `title`, `stage`, `customer_id`) tidak bernilai `NULL`.
2. **Duplicate Check**: Memastikan tidak ada duplikasi `contract_number`, `user.email`, atau `customer.code`.
3. **Orphan Data Check**: Memastikan seluruh `customer_id` di `tenders` dan `contracts` mereferensikan `id` yang ada di tabel `customers`.
4. **Foreign Key Check**: Memastikan seluruh relasi FK valid tanpa *dangling reference*.
5. **Enum Validation**: Memastikan string ENUM pada `stage` dan `status` sesuai spesifikasi (`LEAD`, `PROPOSAL`, `WON`, dll).
6. **Date Validation**: Memastikan `end_date >= start_date` pada kontrak.
7. **Soft Delete Check**: Memastikan record ber-status deleted (`deleted_at IS NOT NULL`) terisolasi dari pencarian aktif.

---

## 7. MIGRATION RULES & SAFETY PROTOCOL

- 🔒 **Rule 1 (No Overwrite)**: Dilarang melakukan overwriting atau destruksi data produksi existing.
- 🔒 **Rule 2 (Reversibility)**: Setiap skrip migrasi WAJIB menyertakan skrip rollback DDL/DML teruji (`DOWN` migration).
- 🔒 **Rule 3 (Audit Logging)**: Setiap eksekusi migrasi wajib mencatat entry timestamp, total affected rows, dan operator ID ke dalam tabel audit.
- 🔒 **Rule 4 (Mandatory Backup)**: Wajib menjalankan `mysqldump` full backup sebelum DDL executed.

---

## 8. MIGRATION VALIDATION CHECKLIST

Kriteria Lolos Uji Validasi Migrasi (100% PASS Required):

- [ ] **[ ] Record Count Parity Users**: Total user sama (17 records).
- [ ] **[ ] Record Count Parity Tenders**: Total tender sama (49 records).
- [ ] **[ ] Record Count Parity Contracts**: Total kontrak sama (25 records).
- [ ] **[ ] Record Count Parity Customers**: Total customer sama (2 records).
- [ ] **[ ] Foreign Key Integrity**: 0 orphaned foreign keys.
- [ ] **[ ] Enum Constraint Validation**: 0 invalid enum strings.
- [ ] **[ ] Index Verification**: B-Tree Indexes terpasang sempurna.
- [ ] **[ ] Service Layer Compatibility**: Endpoint `GET /marketing/tenders` mengembalikan 200 OK dengan payload utuh.

---

## 9. ROLLBACK STRATEGY & DISASTER RECOVERY

Apabila terjadi anomali atau kegagalan saat migrasi berlangsung:

```
1. STOP MIGRATION  ➔ Hentikan segera eksekusi skrip DDL/DML.
2. RESTORE BACKUP  ➔ Restore snapshot mysqldump pre-migration.
3. REVALIDATE      ➔ Uji kueri database pasca-restore.
4. INCIDENT LOG    ➔ Catat error log dan akar masalah.
5. RETRY FIX      ➔ Perbaiki skrip migrasi di staging sebelum uji ulang.
```

---

## 10. MIGRATION BATCHING PLAN

Migrasi dibagi menjadi 4 Batch Terstruktur:

1. **Batch 1 (Schema DDL Alignment)**: Eksekusi `ALTER TABLE tenders ADD COLUMN go_nogo_*`.
2. **Batch 2 (Legacy Data Seeding)**: Update `go_nogo_status = 'GO'` untuk tender pasca-LEAD.
3. **Batch 3 (Migration Table Reconciliation)**: Menyuntikkan entri migration lama yang sudah applied ke tabel `migrations`.
4. **Batch 4 (Final Verification & Clean Up)**: Re-index, analyze tables, dan jalankan API integration test.

---

## 11. SUCCESS CRITERIA

Migrasi Data dinyatakan **100% SUCCESS** apabila:
1. 100% data berpindah tanpa ada 1 byte pun yang terhapus.
2. 0 Orphan record pada seluruh tabel relasi.
3. 0 Foreign Key violation error.
4. 0 Invalid NULL value pada kolom required.
5. API `GET /api/v1/marketing/tenders` mengembalikan HTTP 200 OK dengan seluruh data Kanban muncul utuh.
6. Web Application Frontend berjalan lancar tanpa error konsol.
