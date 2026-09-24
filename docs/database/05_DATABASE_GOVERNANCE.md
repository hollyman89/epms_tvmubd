# 05. EPMS DATABASE GOVERNANCE SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-05`  
> **Stage**: **STAGE D1.3 — DATABASE GOVERNANCE**  
> **Status**: **OFFICIAL GOVERNANCE & ARCHITECTURAL POLICY (PERMANENT STANDARD)**  
> **Scope**: Enterprise Database Change Control, Zero-Drift Protocol, & Deployment Policy  

---

## 1. EXECUTIVE SUMMARY

Dokumen Database Governance ini dibuat secara resmi untuk menghentikan seluruh bentuk **Schema Drift** dan regresi sistem pada Enterprise Project Management System (EPMS).

### Root Cause Analysis (Akar Masalah Historis):
1. **Entity-First Drift**: Pengembang mengubah TypeORM Entity secara langsung di TypeScript tanpa menyinkronkan database fisik, yang menyebabkan `QueryFailedError: Unknown column`.
2. **Unexecuted Migration Cycle**: Migration dibuat di repositori namun tidak pernah dieksekusi di server database runtime.
3. **Baseline vs Runtime Mismatch**: Terdapat kontradiksi antara SQL Dump Baseline, Migration History, dan Runtime Database.
4. **Silent Error Suppression**: Service backend me-catch SQL Error secara senyap (`catch(e) { return []; }`), menyembunyikan `ER_BAD_FIELD_ERROR` dan mengembalikan HTTP 200 OK dengan array kosong `[]` yang merusak UI Kanban Board.
5. **Failure of Build Alignment**: Kode backend lulus kompilasi TypeScript (`npx tsc --noEmit`), namun aplikasi gagal total saat runtime karena ketidakcocokan skema database.

---

## 2. SINGLE SOURCE OF TRUTH HIERARCHY

Ditetapkan secara sah dan mutlak bahwa **DATABASE IS THE SINGLE SOURCE OF TRUTH**.
Entity, Migration, Service, dan Frontend **BUKAN** Source of Truth.

### Mandatory Architectural Hierarchy:
```
Business Requirement
       ↓
Target Database Design
       ↓
SQL Baseline (database/epms_tvmubd_db.sql)
       ↓
Runtime Database (MariaDB / MySQL)
       ↓
TypeORM Entity (*.entity.ts)
       ↓
TypeORM Repository
       ↓
NestJS Service (*.service.ts)
       ↓
NestJS Controller / API Contract
       ↓
Frontend Application (Next.js / React)
```

---

## 3. DATABASE CHANGE POLICY (SOP PERUBAHAN SKEMA)

Setiap perubahan struktur database WAJIB secara ketat mengikuti 12 langkah sekuensial:

1. **Business Requirement**: Persetujuan kebutuhan bisnis resmi.
2. **Database Design**: Penyusunan usulan desain skema pada dokumen arsitektur target.
3. **Peer & Lead Review**: Peninjauan dampak DDL terhadap kueri existing dan indeks.
4. **SQL Baseline Update**: Pembaruan berkas baseline resmi `database/epms_tvmubd_db.sql`.
5. **Architect Approval**: Persetujuan tertulis dari Lead Architect.
6. **Migration Generation**: Pembuatan file TypeORM Migration berbasis perubahan SQL Baseline.
7. **Migration Testing**: Pengujian `migration:run` dan `migration:revert` di lingkungan isolasi.
8. **Runtime Validation**: Verifikasi `SHOW COLUMNS` dan `SHOW INDEX` di runtime staging.
9. **Entity Update**: Pembaruan file TypeScript Entity (*.entity.ts) agar identik dengan skema fisik.
10. **Repository & Service Update**: Penyesuaian kueri DTO dan logic di layer Service.
11. **API Contract Verification**: Validasi OpenAPI / Swagger spec.
12. **Frontend Update**: Penyesuaian tipe TypeScript dan UI di layer Frontend.

---

## 4. PROHIBITED PRACTICES (LARANGAN KERAS)

Berikut adalah praktik berbahaya yang **DILARANG KERAS (STRICTLY PROHIBITED)** di seluruh repositori EPMS:

- ❌ **DILARANG** mengaktifkan `synchronize: true` pada TypeORM Configuration di lingkungan mana pun.
- ❌ **DILARANG** menjalankan `ALTER TABLE`, `DROP TABLE`, atau `CREATE TABLE` di dalam Service / Controller / Custom Script aplikasi.
- ❌ **DILARANG** menuliskan Hardcoded DDL di luar berkas Migration resmi.
- ❌ **DILARANG** menambahkan properti `@Column()` pada TypeORM Entity tanpa persetujuan SQL Baseline terlebih dahulu.
- ❌ **DILARANG** menambahkan file Migration baru tanpa menyinkronkan berkas SQL Baseline `database/epms_tvmubd_db.sql`.
- ❌ **DILARANG** melakukan perubahan skema di database Production secara manual tanpa tiket Change Management & dokumentasi.
- ❌ **DILARANG** menggunakan silent error suppression (`catch (e) { return []; }`) yang menyembunyikan SQL Error.
- ❌ **DILARANG** menyembunyikan `QueryFailedError` atau `ER_BAD_FIELD_ERROR`. Error database wajib dilempar sebagai HTTP 500 / InternalServerErrorException yang transparan.
- ❌ **DILARANG** adanya perbedaan definisi ENUM antara Database fisik dan TypeScript Entity / Enum.

---

## 5. DATABASE VERSIONING POLICY

Skema database EPMS dikelola menggunakan Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR (X.0.0)**: Breaking changes, perombakan struktur tabel besar, penghapusan kolom/tabel.
- **MINOR (1.X.0)**: Penambahan tabel baru, penambahan kolom baru (backwards-compatible), penambahan indeks.
- **PATCH (1.0.X)**: Perbaikan seeder, optimasi indeks non-breaking, pembaruan komentar DDL.

Setiap rilis versi database WAJIB mencantumkan changelog resmi pada `docs/database/CHANGELOG.md`.

---

## 6. PRE-MERGE REVIEW CHECKLIST

Sebelum Pull Request (PR) atau Code Merge dilakukan, seluruh checklist wajib terverifikasi (100% PASS):

- [ ] **[ ] SQL Baseline Updated**: Berkas `database/epms_tvmubd_db.sql` sudah diperbarui.
- [ ] **[ ] Runtime Database Validated**: Teruji pada MariaDB server tanpa syntax/schema error.
- [ ] **[ ] Entity Synchronized**: TypeORM Entity 100% selaras dengan skema fisik.
- [ ] **[ ] Migration Generated**: Migration TypeORM resmi sudah terbuat.
- [ ] **[ ] Migration Tested Both Ways**: `migration:run` dan `migration:revert` sukses tanpa sisa error.
- [ ] **[ ] Seeders Updated**: Master data seeder sudah diselaraskan.
- [ ] **[ ] API Contract Verified**: DTO dan Swagger OpenAPI spec sudah sesuai.
- [ ] **[ ] Frontend Compatibility Verified**: UI dan tipe data TypeScript Frontend valid.
- [ ] **[ ] Automated Audit Passed**: Tidak ada temuan schema drift.

*Apabila 1 poin checklist gagal, Merge DILARANG KERAS dilakukan.*

---

## 7. DEPLOYMENT POLICY & PIPELINE SOP

Alur Deployment Skema Database:
```
Development ➔ Staging ➔ Production
```

### SOP Langkah Deployment Production:
1. **Pre-Deployment Backup**: Lakukan `mysqldump` lengkap data + struktur sebelum proses migration dimulai.
2. **Dry-Run Migration**: Jalankan migration script pada staging environment yang identik.
3. **Execution**: Eksekusi `npx typeorm migration:run` di lingkungan production.
4. **Runtime Schema Audit**: Jalankan verifikasi `SHOW COLUMNS FROM table_name`.
5. **Smoke Test**: Jalankan pengujian API sintetis untuk memastikan GET/POST berjalan 200 OK.
6. **Rollback Plan**: Jika terjadi kegagalan pada langkah 3-5, segera jalankan `npx typeorm migration:revert` atau restore snapshot mysqldump.

---

## 8. AUTOMATED DATABASE AUDIT POLICY

Audit otomatis WAJIB dijalankan pada CI/CD pipeline setiap terjadi perubahan skema:

1. **Runtime Database Audit**: Membandingkan DDL MariaDB aktual terhadap SQL Baseline.
2. **Schema Drift Audit**: Mendeteksi kolom ekstra/hilang antara Entity vs Database.
3. **Entity Parity Audit**: Memastikan tipe data TypeScript mencerminkan tipe DDL MariaDB.
4. **Migration Parity Audit**: Memastikan jumlah file migration selaras dengan entri tabel `migrations`.
5. **API Contract Audit**: Memastikan DTO tidak meminta kolom yang tidak ada di database.

---

## 9. LONG-TERM ARCHITECTURAL VISION

1. **Database sebagai Fondasi Utama**: Database adalah jangkar stabilitas seluruh ekosistem EPMS.
2. **Unidirectional Dependency**: Layer atas (Entity, Service, Controller, UI) WAJIB tunduk pada struktur Database. Database TIDAK BOLEH lagi diubah demi mengikuti keinginan kuisif Entity.
3. **Zero Data Loss Integrity**: Seluruh adopsi fitur baru (seperti GO / NO GO Gate) wajib menyertakan strategi backward compatibility dan legacy data migration.

---

## 10. 10 PRINSIP RESMI DATABASE EPMS

1. **DATABASE IS THE SINGLE SOURCE OF TRUTH.**
2. **SQL BASELINE (`database/epms_tvmubd_db.sql`) WAJIB SELALU SINKRON.**
3. **ENTITY HANYA OBJECT MAPPER, BUKAN PENENTU SKEMA.**
4. **MIGRATION ADALAH MEKANISME DEPLOYMENT, BUKAN TEMPAT DESAIN.**
5. **RUNTIME DATABASE WAJIB TERVALIDASI SEBELUM KODE DI-MERGE.**
6. **TIDAK BOLEH ADA SCHEMA DRIFT ANTARA KODE DAN DATABASE.**
7. **TIDAK BOLEH ADA SILENT SQL ERROR (`catch (e) { return []; }`).**
8. **SEMUA PERUBAHAN SKEMA WAJIB TERDOKUMENTASI DI GOVERNANCE CHANGELOG.**
9. **SEMUA DEPLOYMENT SKEMA WAJIB MEMILIKI STRATEGI ROLLBACK VERIFIED.**
10. **AUDIT SKEMA WASPADA WAJIB 100% PASS SEBELUM MERGE DILAKUKAN.**
