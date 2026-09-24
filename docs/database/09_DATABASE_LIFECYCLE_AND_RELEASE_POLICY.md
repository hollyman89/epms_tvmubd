# 09. EPMS DATABASE LIFECYCLE AND RELEASE POLICY (SOP)

> **Document ID**: `EPMS-DOC-DB-09`  
> **Phase**: **PHASE D2.1 — DATABASE LIFECYCLE & RELEASE POLICY**  
> **Status**: **OFFICIAL STANDARD OPERATING PROCEDURE (MANDATORY SOP)**  
> **Scope**: Enterprise Database Change Lifecycle, Versioning, Startup Validation, & Release Management  
> **Complements**: `docs/database/07_COMPATIBILITY_MATRIX.md` & `docs/database/08_DATABASE_SOURCE_OF_TRUTH.md`  

---

## BAB 1. DATABASE LIFECYCLE

SOP Lifecycle resmi perubahan skema database EPMS wajib mengikuti 20 tahapan sekuensial ter-standarisasi:

```
Business Requirement
        ↓
Business Approval
        ↓
Functional Specification
        ↓
ERD Update
        ↓
Database Design
        ↓
Database Review
        ↓
DDL Review
        ↓
Development Database
        ↓
Validation Database
        ↓
Repository
        ↓
Entity
        ↓
Service
        ↓
API
        ↓
Frontend
        ↓
Integration Test
        ↓
Smoke Test
        ↓
Staging
        ↓
Production
        ↓
Post Release Audit
```

---

## BAB 2. DATABASE VERSIONING POLICY

1. **Mandatory Versioning**: Setiap perubahan skema database physical MariaDB WAJIB menaikkan nomor versi resmi.
2. **Format Semantic Versioning (SemVer)**: `DB_VERSION = MAJOR.MINOR.PATCH` (Contoh: `v1.0.0`, `v1.1.0`, `v2.3.0`).
3. **Table Tracking**: Versi database fisik dicatat secara permanen pada tabel metadata system `database_versions` di MariaDB.
4. **Versioning Criteria**:
   - **MAJOR (X.0.0)**: Breaking Schema Changes (Penghapusan/Restrukturisasi kolom/tabel utama).
   - **MINOR (1.X.0)**: Non-breaking Schema Additions (Penambahan kolom baru/tabel baru/indeks).
   - **PATCH (1.0.X)**: Maintenance Seeder & Non-structural index optimization.

---

## BAB 3. BACKEND STARTUP VALIDATION (FAIL-FAST PROTOCOL)

Untuk mengeliminasi 100% insiden `Unknown Column`, `Unknown Enum`, dan `Unknown Table` pada lingkungan aktif:

1. **Startup Check**: Saat NestJS Backend di-boot, bootstrap initializer WAJIB membandingkan `BACKEND_COMPATIBLE_DB_VERSION` terhadap `DB_VERSION` aktual di MariaDB.
2. **Fail-Fast Enforcement**: Jika versi database fisik di MariaDB **LEBIH RENDAH** atau **TIDAK SINKRON** dengan versi yang diminta backend, Backend WAJIB **FAIL FAST (STOP / EXIT PROCESS)**.
3. **No Execution Guarantee**: Backend DILARANG KERAS melanjutkan startup server jika versi database tidak cocok. Ini mencegah server menerima HTTP Request yang dapat menyebabkan silent catch atau blank UI.

---

## BAB 4. DATABASE RELEASE POLICY

Deployment resmi skema database ke lingkungan Staging/Production wajib secara ketat melalui alur rilis resmi:

```
Business Approval
        ↓
Database Backup (mysqldump / snapshot)
        ↓
DDL Execute (Physics SQL / TypeORM Migration)
        ↓
Data Migration (State Seeding & Fallback Data)
        ↓
Schema Validation (SHOW COLUMNS & SHOW INDEX)
        ↓
Repository Validation
        ↓
Entity Validation
        ↓
API Validation (Swagger / Endpoint Test)
        ↓
Frontend Validation (UI Render Test)
        ↓
Smoke Test (End-to-End Test)
        ↓
Release (Live Traffic Handling)
        ↓
Post Release Audit
```

---

## BAB 5. DATABASE CHANGE CLASSIFICATION

Perubahan skema database diklasifikasikan menjadi 4 tingkat risiko:

| Level | Classification | Description | Approval | Testing Requirement | Deployment Strategy |
|---|---|---|---|---|---|
| **Level 1** | **Hotfix** | Minor data patch / Index non-breaking fix | Tech Lead | Unit Test + Integration Test | In-place Hotfix Deployment |
| **Level 2** | **Minor Schema** | Add new column / Add non-null default / Add table | Lead Architect | Full Test Suite + Staging Dry Run | Rolling Zero-Downtime Release |
| **Level 3** | **Major Schema** | Modify column data type / Rename column / Alter FK | Lead Arch + Product Owner | Full Regression + Staging Data Migration | Scheduled Maintenance Window |
| **Level 4** | **Breaking Schema** | Drop table / Drop column / Restructure 3NF | Executive Sponsor + Board | Full End-to-End Simulation + Parallel DB Run | Maintenance Window + Dual-Write |

---

## BAB 6. ROLLBACK POLICY

Setiap usulan perubahan skema WAJIB dilengkapi dengan 4 komponen Disaster Recovery:

1. **Rollback SQL Script (`DOWN.sql`)**: Skrip DDL/DML teruji untuk membatalkan perubahan skema tanpa merusak data terisolasi.
2. **Backup Strategy**: Snapshot `mysqldump` lengkap yang diambil persis sebelum langkah DDL Execute.
3. **Recovery Procedure**: Langkah-langkah restorasi data jika eksekusi DDL gagal di pertengahan jalan.
4. **Validation Checklist**: Pengujian pasca-rollback untuk menjamin database kembali ke state stabil semula.

---

## BAB 7. DEPLOYMENT CHECKLIST

Seluruh 14 poin checklist wajib bernilai **100% PASS** sebelum rilis diizinkan (Go Live Gate):

- [ ] **[ ] Backup Database**: Snapshot backup produksi terbuat & terverifikasi.
- [ ] **[ ] SQL Reviewed**: DDL SQL script disetujui Lead Architect.
- [ ] **[ ] DDL Executed**: DDL sukses dijalankan di MariaDB tanpa error.
- [ ] **[ ] Data Validated**: Data legacy & fallback seeding terverifikasi 100%.
- [ ] **[ ] Repository Validated**: Layer QueryBuilder terbebas dari SQL error.
- [ ] **[ ] Entity Validated**: TypeORM Entity TypeScript 100% sinkron.
- [ ] **[ ] Service Validated**: Error handling service transparan.
- [ ] **[ ] API Tested**: Endpoint REST API mengembalikan status 200/201.
- [ ] **[ ] Frontend Tested**: UI Next.js render data dengan benar.
- [ ] **[ ] Integration Test Passed**: Integration test suite 100% PASS.
- [ ] **[ ] Smoke Test Passed**: End-to-end smoke test 100% PASS.
- [ ] **[ ] Rollback Tested**: Skrip rollback `DOWN.sql` teruji di Staging.
- [ ] **[ ] Documentation Updated**: Changelog & SemVer DB terbarui.
- [ ] **[ ] Release Approved**: Approval resmi tertulis dari Tech Lead.

---

## BAB 8. POST RELEASE AUDIT

Setelah rilis production selesai, tim devops & QA WAJIB melakukan audit 7 aspek kesehatan sistem:

1. **Error Log Audit**: Memastikan 0 `QueryFailedError` atau `ER_BAD_FIELD_ERROR` di `logs/nest.log`.
2. **Slow Query Audit**: Memeriksa MariaDB slow query log untuk mendeteksi kueri yang butuh optimasi indeks.
3. **Database Health**: Memastikan koneksi pool database stabil tanpa *deadlock* atau *connection leak*.
4. **API Health**: Memastikan latency & status code REST API 200 OK.
5. **Frontend Health**: Memastikan 0 runtime error di browser console.
6. **Scheduler Health**: Memastikan cron jobs (Tender Deadline, Grace Period) berjalan sesuai jadwal.
7. **Notification Health**: Memastikan WebSocket alerts & in-app notifications terkirim lancar.

---

## BAB 9. LONG TERM DATABASE GOVERNANCE PRINCIPLES

12 Prinsip Tata Kelola Database EPMS:

1. **Database Runtime adalah Single Source of Truth.**
2. **Semua perubahan skema WAJIB dimulai dari Business Requirement.**
3. **Database adalah fondasi utama seluruh arsitektur sistem.**
4. **Entity WAJIB mengikuti Database.**
5. **Repository WAJIB mengikuti Database.**
6. **Service WAJIB mengikuti Repository.**
7. **API WAJIB mengikuti Service.**
8. **Frontend WAJIB mengikuti API.**
9. **TIDAK BOLEH ada Runtime Schema Drift.**
10. **TIDAK BOLEH ada Entity Drift.**
11. **TIDAK BOLEH ada Silent Error Suppression (`catch(e) { return []; }`).**
12. **TIDAK BOLEH melakukan deploy aplikasi tanpa validasi kecocokan Database Version.**
