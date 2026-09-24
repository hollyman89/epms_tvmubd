# 12. EPMS DATABASE BASELINE STRATEGY SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-12`  
> **Phase**: **PHASE D2.4 — DATABASE BASELINE STRATEGY (FINAL DATABASE GOVERNANCE)**  
> **Status**: **OFFICIAL EPMS DATABASE GOVERNANCE CONSTITUTION (FINAL CROWN SPECIFICATION)**  
> **Scope**: One Official Baseline, Environment Policy, Disaster Recovery, & 3-5 Year Strategy  
> **Complements**: `docs/database/08_DATABASE_SOURCE_OF_TRUTH.md` S/D `11_DATABASE_DRIFT_DETECTION.md`  

---

## BAB 1. TUJUAN DOKUMEN

Dokumen **Database Baseline Strategy** ini merupakan **Dokumen Penutup Resmi (Cap Stone)** dari seluruh rangkaian EPMS Database Governance Series.

Fokus utama strategi ini:
- **Satu Baseline Resmi**: Menetapkan `database/epms_tvmubd_db.sql` sebagai muara akhir seluruh DDL.
- **Eliminasi 100% Schema Drift**: Menjamin 0 drift antara Database, Entity, dan Migration.
- **Deployment Konsisten**: Menjamin rilis aplikasi aman tanpa risiko `Unknown Column` atau Kanban blank.
- **Onboarding Developer Mudah**: Memfasilitasi setup lingkungan pengembangan lokal sub-5 menit.
- **Disaster Recovery Ter-standarisasi**: SOP restorasi data & rollback teruji dalam hitungan menit.

---

## BAB 2. DATABASE SOURCE OF TRUTH

Ditetapkan secara mutlak bahwa berkas **`database/epms_tvmubd_db.sql` ADALAH SATU-SATUNYA SINGLE SOURCE OF TRUTH (SOT)** untuk seluruh ekosistem EPMS.

Seluruh komponen perangkat lunak WAJIB tunduk pada hirarki arsitektur sekuensial berikut:

```
Business Rules
       ↓
Database Baseline (database/epms_tvmubd_db.sql)
       ↓
Runtime Database (MariaDB / MySQL Server)
       ↓
Repository Layer (TypeORM QueryBuilder)
       ↓
Entity Layer (*.entity.ts)
       ↓
Service Layer (*.service.ts)
       ↓
API Layer (Controllers & DTOs)
       ↓
Frontend Layer (Next.js Application)
```

---

## BAB 3. DATABASE LIFECYCLE

Siklus hidup perubahan skema database dari usulan bisnis hingga versi berikutnya:

```
Business Change Request  ➔  Database Design  ➔  Baseline SQL Update  ➔  Peer DDL Review
                                                                              │
Next Version Cycle  <──  Monitoring  <──  Release  <──  Testing  <──  Approval ◄┘
```

---

## BAB 4. DATABASE VERSIONING POLICY

Setiap perubahan skema DDL fisik WAJIB menaikkan nomor versi resmi berbasis SemVer (`MAJOR.MINOR.PATCH`):

- **DB v1.0.0**: Initial Baseline EPMS Database (35 Tables).
- **DB v1.1.0**: Schema Alignment GO / NO GO Gate (`tenders.go_nogo_status`, `tenders.revision_status`).
- **DB v1.2.0**: Penambahan modul pendukung baru (Non-breaking additions).
- **DB v2.0.0**: Breaking Schema Restructuring.

---

## BAB 5. BASELINE RELEASE FLOW

Diagram alur pelepasan rilis skema baseline:

```
Developer Proposal
       ↓
DDL Review & Architect Sign-off
       ↓
Update Baseline SQL (database/epms_tvmubd_db.sql)
       ↓
Hash Generation (SHA256 Manifest)
       ↓
Update TypeORM Repository & Entity
       ↓
CI Automated Drift Check (Validation Engine)
       ↓
Staging Environment Deployment & Verification
       ↓
Production Live Release
```

---

## BAB 6. FRESH INSTALL SOP (DEVELOPER ONBOARDING)

Prosedur instalasi fresh lingkungan lokal dalam 7 langkah sekuensial:

```
1. Git Clone Repo      ➔ git clone https://github.com/epms/epms_tvmubd.git
2. Restore Baseline SQL ➔ mysql -u root -p epms_tvmubd_db < database/epms_tvmubd_db.sql
3. Environment Config  ➔ Copy .env.example ke .env pada backend & frontend.
4. Start Backend       ➔ cd backend && npm run start:dev
5. Start Frontend      ➔ cd frontend && npm run dev
6. Health Check        ➔ Access GET http://localhost:4000/api/v1/health
7. Ready               ➔ Login dengan lukas@epms.com (Password: password123)
```

---

## BAB 7. DATABASE UPGRADE SOP

Prosedur upgrade skema database fisik di Staging/Production:

1. **Pre-check**: Verifikasi integritas disk space, koneksi MariaDB, dan hash skema aktif.
2. **Backup**: Jalankan `mysqldump` snapshot lengkap sebelum DDL executed.
3. **Validation**: Dry-run skrip DDL/DML di database staging terisolasi.
4. **Upgrade Execution**: Eksekusi DDL resmi via TypeORM migration atau skrip SQL ter-setujui.
5. **Verification**: Jalankan `SHOW COLUMNS` dan panggil endpoint API sintetis.
6. **Rollback Plan**: Eksekusi skrip `DOWN.sql` jika ditemukan indikasi deviasi.

---

## BAB 8. DATABASE ROLLBACK SOP

1. **Kapan Rollback Wajib Dilakukan**: Saat terjadi DDL syntax failure, data corruption saat seeding, atau backend startup Fail-Fast Mismatch.
2. **Recovery Procedure**:
   - Langkah A: Hentikan server aplikasi (`pm2 stop epms-backend`).
   - Langkah B: Jalankan skrip `DOWN.sql` atau restore snapshot backup pre-upgrade.
   - Langkah C: Kembalikan repositori kode ke tag commit stabil sebelumnya.
   - Langkah D: Jalankan startup validation test.
   - Langkah E: Nyalakan kembali server aplikasi (`pm2 start epms-backend`).

---

## BAB 9. DISASTER RECOVERY (DR) POLICY

1. **Automated Backup**: Backup Harian (`mysqldump` full dump) + Binary Log Archiving setiap 15 menit.
2. **Restore Testing**: Uji coba pemulihan data backup harian ke server DR setiap minggu.
3. **Point In Time Recovery (PITR)**: Memungkinkan pemulihan data hingga detik sebelum insiden bencana terjadi.
4. **Verification**: Pengecekan paritas record count pasca-restore.
5. **Recovery Checklist**: Checklist 10 poin kesiapan infrastruktur DR.

---

## BAB 10. ENVIRONMENT STRATEGY

Aturan tata kelola 4 lingkungan:

| Environment | Database Target | Backup Policy | Restore Policy | Approval Level |
|---|---|---|---|---|
| **Development** | Local MariaDB (`epms_tvmubd_db`) | Optional | Self-service via baseline SQL | Developer |
| **Testing / CI** | Ephemeral Docker DB | Per-build clean | Auto-restore per build | QA Automation |
| **Staging** | Staging Dedicated MariaDB | Daily Snapshot | Auto-sync weekly from Prod (masked) | Lead Architect |
| **Production** | Production High-Availability Cluster | Continuous + Binary Log | Strict SOP Disaster Recovery | Executive VP / C-Level |

---

## BAB 11. DATABASE GOVERNANCE MATRIX

Matriks Wewenang Tata Kelola Database EPMS:

| Role / Persona | Modify Schema (DDL) | Approve Schema | Release to Staging | Release to Production | Rollback / Restore DB |
|---|---|---|---|---|---|
| **Software Engineer** | Propose Only | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| **Lead Architect** | Authorize | ✅ YES | ✅ YES | ❌ NO | ✅ Staging Only |
| **Database Administrator (DBA)** | Execute | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **DevOps Engineer** | Automate CI | ❌ NO | ✅ YES | ✅ YES | ✅ YES |
| **Release Manager** | Sign-off | ❌ NO | ✅ YES | ✅ YES | ❌ NO |

---

## BAB 12. DATABASE RELEASE CHECKLIST

Checklist Rilis Produksi (100% PASS Required):

- [ ] **[ ] Baseline SQL Terbaru**: Berkas `database/epms_tvmubd_db.sql` sinkron.
- [ ] **[ ] Schema Hash Match**: SHA256 Hash Manifest terverifikasi.
- [ ] **[ ] Schema Parity**: 100% kolom fisik sesuai spesifikasi.
- [ ] **[ ] Foreign Keys B-Tree Indexed**: Seluruh FK ter-index B-Tree.
- [ ] **[ ] Enums Validated**: Values ENUM 100% identik.
- [ ] **[ ] Stored Data Safe**: 0 Data loss pada data produksi existing.
- [ ] **[ ] Pre-Backup Completed**: Snapshot mysqldump terbuat & terverifikasi.
- [ ] **[ ] Rollback Plan Verified**: Skrip `DOWN.sql` teruji di Staging.
- [ ] **[ ] Smoke Test PASS**: End-to-end API & UI Smoke test 100% PASS.
- [ ] **[ ] Sign-off Approved**: Approval tertulis dari DBA & Lead Architect.

---

## BAB 13. LONG TERM MAINTENANCE (STRATEGI 3–5 TAHUN)

1. **Schema Hygiene**: Audit skema berkala setiap kuartal untuk mengidentifikasi kolom yang tidak digunakan (*deprecated columns*).
2. **Zero Duplicate Columns**: Mencegah redundansi data dengan menegaskan pembatasan normalisasi 3NF.
3. **Zero Orphan Tables**: Menghapus tabel sementara/transien yang berusia > 90 hari.
4. **Migration Reconciliation**: Mengkonsolidasikan file migration lama secara berkala ke dalam skrip Baseline SQL utama setiap pergantian versi MAJOR.
5. **Capacity Planning**: Perencanaan pertumbuhan data dan strategi partitioning untuk tabel transaksi besar (seperti `audit_logs` dan `tender_activities`).

---

## BAB 14. 30 ENTERPRISE BEST PRACTICES

1. Jadikan `database/epms_tvmubd_db.sql` sebagai acuan mutlak.
2. Selalu naikkan nomor versi database saat DDL berubah.
3. Gunakan Semantic Versioning `MAJOR.MINOR.PATCH`.
4. Lakukan mysqldump full backup sebelum eksekusi DDL rilis.
5. Verifikasi hash skema fisik di boot sequence backend.
6. Terapkan Fail-Fast Policy jika versi database tidak cocok.
7. Gunakan `READ COMMITTED` isolation level pada transaksi.
8. Bebaskan QueryRunner di blok `finally` tanpa kecuali.
9. Uji kueri dengan `EXPLAIN` untuk mencegah Full Table Scan.
10. Batasi eksekusi kueri dengan waktu timeout 200ms.
11. Wajibkan pagination pada kueri berukuran > 100 records.
12. Terapkan soft delete `deleted_at` untuk data bisnis.
13. Gunakan `DECIMAL(19,2)` untuk nilai uang dan moneter.
14. Berikan B-Tree Index pada seluruh kolom Foreign Key `_id`.
15. Gunakan `utf8mb4_unicode_ci` untuk seluruh tabel teks.
16. Gunakan `BIGINT UNSIGNED AUTO_INCREMENT` untuk Primary Key.
17. Gunakan Parameterized Binding pada QueryBuilder.
18. Sediakan skrip Rollback `DOWN.sql` teruji untuk tiap rilis.
19. Audit data secara berkala dengan `INFORMATION_SCHEMA`.
20. Topup data seeding legacy secara aman tanpa overwriting.
21. Kunci versi server MariaDB di seluruh lingkungan deployment.
22. Lakukan restorasi backup berkala ke server Disaster Recovery.
23. Pisahkan log audit trail ke dalam kolom bertipe `JSON`.
24. Lemparkan HTTP 500 Exception transparan saat error DB.
25. Gunakan transactional outbox pattern untuk event streaming.
26. Masking data sensitif saat melakukan sync dari Prod ke Staging.
27. Gunakan `ON UPDATE CASCADE` pada relasi Foreign Key.
28. Gunakan `RESTRICT` untuk melindungi data referensi utama.
29. Wajibkan persetujuan tertulis DBA untuk rilis Production.
30. Patuhi Konstitusi Database Source of Truth EPMS.

---

## BAB 15. 30 ANTI-PATTERNS (LARANGAN KERAS)

1. ❌ Edit database produksi secara langsung tanpa berkas baseline.
2. ❌ Deploy skema DDL tanpa proses Peer & Architect Review.
3. ❌ Update TypeORM Entity tanpa menyinkronkan berkas SQL Baseline.
4. ❌ Menjalankan migration tanpa validasi di lingkungan Staging.
5. ❌ Rilis ke Production tanpa melakukan full database backup.
6. ❌ Startup server backend tanpa mekanisme Drift Detection.
7. ❌ Melakukan Rollback skema tanpa memiliki file backup verified.
8. ❌ Manual `ALTER TABLE` langsung di server Production.
9. ❌ Mengaktifkan `synchronize: true` di lingkungan rilis.
10. ❌ Menyembunyikan SQL Error dengan `catch(e) { return []; }`.
11. ❌ Membiarkan Kanban Board atau Dashboard blank akibat DB error.
12. ❌ Menggunakan `SELECT *` pada kueri berkinerja tinggi.
13. ❌ Membiarkan kolom Foreign Key tanpa B-Tree Index.
14. ❌ Menggunakan tipe data FLOAT/DOUBLE untuk kalkulasi uang.
15. ❌ Membuat tabel bisnis tanpa Primary Key `id`.
16. ❌ Hard delete data bisnis utama (`DELETE FROM`).
17. ❌ Mengabaikan peringatan slow query log (> 200ms).
18. ❌ Menuliskan String Concatenation pada kueri SQL.
19. ❌ Mengabaikan deviasi versi database saat server boot.
20. ❌ Menghapus nilai ENUM yang masih digunakan oleh data legacy.
21. ❌ Menambah properti `@Column()` hanya pada kode TypeScript.
22. ❌ Menjalankan N+1 Query Loop pada Service layer.
23. ❌ Menyimpan nilai tanggal/waktu dalam format string VARCHAR.
24. ❌ Lupa me-release DB Connection di blok `finally`.
25. ❌ Menggunakan UUID v4 sebagai Clustered Primary Key.
26. ❌ Rilis kode baru tanpa memperbarui dokumentasi skema.
27. ❌ Mengabaikan kegagalan CI/CD Automated Schema Audit.
28. ❌ Menyimpan rahasia password dalam format plaintext.
29. ❌ Melakukan transaksi DB tanpa penanganan Rollback di `catch`.
30. ❌ Melakukan Merge Pull Request tanpa 100% Release Checklist PASS.

---

## BAB 16. EPMS DATABASE GOVERNANCE FRAMEWORK

Diagram Kerangka Tata Kelola Database EPMS (Hulu ke Hilir):

```
Business Requirement
        ↓
Database Design
        ↓
Baseline SQL (database/epms_tvmubd_db.sql)
        ↓
Hash Validation (SHA256 Manifest Check)
        ↓
Runtime Database (MariaDB Server)
        ↓
Repository Layer (TypeORM QueryBuilder)
        ↓
Entity Layer (*.entity.ts)
        ↓
Service Layer (*.service.ts)
        ↓
API Layer (Controllers & DTOs)
        ↓
Frontend Layer (Next.js Application)
        ↓
Monitoring (Log & Performance Audit)
        ↓
Continuous Audit (Automation Drift Engine)
```

---

## BAB 17. SUMMARY

Dokumen **Database Baseline Strategy Specification** ini merupakan **PENUTUP RESMI DARI SELURUH SERI EPMS DATABASE GOVERNANCE (Dokumen 01 s/d 12)**.

Mulai saat ini:
1. Physical Database Runtime (`database/epms_tvmubd_db.sql`) adalah **FONDASI UTAMA ABSOLUT** ekosistem EPMS.
2. Seluruh perubahan sistem **WAJIB MENGIKUTI BASELINE RESMI**.
3. Insiden **Schema Drift, Entity Drift, Unknown Column, dan Silent Error TIDAK BOLEH TERJADI LAGI**.
4. Seluruh deployment ke lingkungan Staging/Production **WAJIB TERVALIDASI 100%**.
5. Pengembangan fitur-fitur baru EPMS ke depan dilakukan di atas fondasi database yang stabil, kokoh, dan ter-standarisasi.
