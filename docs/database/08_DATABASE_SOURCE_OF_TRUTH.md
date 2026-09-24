# 08. EPMS DATABASE SOURCE OF TRUTH SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-08`  
> **Phase**: **PHASE D2.0.1 — DATABASE SOURCE OF TRUTH REFINEMENT**  
> **Status**: **OFFICIAL TECHNICAL CONSTITUTION (PERMANENT REGULATION)**  
> **Core Mandate**: Physical Database Runtime (MariaDB/MySQL) is the SINGLE SOURCE OF TRUTH  
> **References**: `docs/database/*` & `docs/database/07_COMPATIBILITY_MATRIX.md`  

---

## 1. PURPOSE OF DATABASE SOURCE OF TRUTH

Dokumen ini menetapkan secara sah dan mengikat bahwa **Physical Database Runtime (MariaDB / MySQL)** adalah **SATU-SATUNYA SINGLE SOURCE OF TRUTH (SOT)** untuk seluruh ekosistem aplikasi EPMS.

Tujuannya adalah menghentikan secara permanen paradigma salah masa lalu di mana pengembang menganggap TypeORM Entity sebagai penentu skema database. Dengan menjadikan Database sebagai Source of Truth, seluruh lapisan perangkat lunak (Entity, Service, Controller, dan UI Frontend) tunduk secara ketat pada struktur skema fisik database yang telah ter-baku-kan.

---

## 2. BUSINESS REQUIREMENT HIERARCHY

Setiap perubahan sistem EPMS WAJIB secara mutlak mengikuti hierarki ketergantungan dari atas ke bawah:

```
                  +-----------------------------------+
                  |       BUSINESS REQUIREMENT        |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |          DATABASE DESIGN          |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |  PHYSICAL DATABASE RUNTIME (SOT)  |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |        TYPEORM REPOSITORY         |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |          TYPEORM ENTITY           |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |          NESTJS SERVICE           |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |        CONTROLLER / API           |
                  +-----------------------------------+
                                    │
                                    ▼
                  +-----------------------------------+
                  |         FRONTEND NEXT.JS          |
                  +-----------------------------------+
```

### Prinsip Utama Hierarki:
1. **Database is the Single Source of Truth**: Database fisik MariaDB/MySQL adalah penentu utama struktur data.
2. **Changes Originate from Business Requirements**: Perubahan skema database fisik WAJIB selalu berakar dari kebutuhan bisnis (Business Requirement) yang telah disetujui resmi oleh stakeholder.

---

## 3. SUMMARY OF HISTORICAL DRIFT PROBLEMS

Berdasarkan audit forensik komprehensif pada STAGE D1.1 hingga D1.5, ditemukan 9 masalah utama yang menyebabkan regresi sistem:

1. **Entity Drift**: Pengembang menambahkan properti `@Column()` pada TypeORM Entity TypeScript tanpa membuat atau mengeksekusi DDL fisik di database.
2. **Migration Drift**: File migration TypeORM dibuat di folder repositori tetapi tidak pernah dieksekusi di database MariaDB runtime server.
3. **Runtime Schema Drift**: Terjadi jurang pemisah (*gap*) antara struktur fisik database runtime dengan definisi Entity di dalam kode.
4. **Silent Error Suppression**: Service layer me-catch SQL Error secara senyap (`catch(e) { return []; }`), menyembunyikan exception `ER_BAD_FIELD_ERROR`.
5. **Unknown Column Errors**: MariaDB melempar `QueryFailedError: Unknown column 'Tender.go_nogo_status'` saat API dipanggil.
6. **Empty API Responses**: Endpoint `GET /api/v1/marketing/tenders` mengembalikan HTTP 200 OK dengan payload `data: []` kosong akibat silent catch.
7. **Blank Kanban Board**: UI Frontend Next.js menerima array kosong sehingga Kanban Board tampak blank/hilang total.
8. **Internal Server Error**: Operasi mutation (POST/PUT) melempar HTTP 500 karena kolom target tidak ditemukan di tabel fisik.
9. **Deployment Drift**: Kompilasi TypeScript (`npx tsc --noEmit`) berhasil 100%, tetapi aplikasi gagal total saat dijalankan di lingkungan staging/production.

---

## 4. OFFICIAL ARCHITECTURAL RULES

1. **Database is the Single Source of Truth**: Skema fisik database MariaDB/MySQL adalah penentu utama struktur data.
2. **Entity Follows Database**: TypeORM Entity hanya bertindak sebagai *Object Mapper* terhadap kolom fisik yang sudah eksis di database.
3. **No Assumed Columns in Service**: Service layer DILARANG menyusun kueri SQL/QueryBuilder pada kolom yang belum terbukti ada di database fisik.
4. **Frontend Strictly Uses API Contract**: Frontend Next.js hanya menggunakan data DTO yang dipaparkan oleh Controller/API Contract.
5. **No Entity-Only Field Addition**: DILARANG menambahkan field baru hanya di Entity tanpa membuat DDL di Database Baseline terlebih dahulu.
6. **No Unapproved Migration Generation**: DILARANG membuat file migration TypeORM tanpa desain skema yang telah diaudit dan disetujui.
7. **No `synchronize: true` in Production**: Pengaturan `synchronize: true` DILARANG KERAS diaktifkan pada lingkungan staging maupun production.
8. **No Direct DDL on Production**: DILARANG KERAS menjalankan `ALTER TABLE`, `DROP COLUMN`, `CREATE INDEX`, atau `DROP INDEX` langsung di Production tanpa *Design Review*, *SQL Review*, *Architect Approval*, dan *Rollback Plan*.
9. **Every Database Change Must Have Audit Record**: Setiap perubahan skema database WAJIB memiliki *Business Reason*, *SQL Script*, *Impacted Modules*, *Rollback Plan*, *Designated Reviewer*, dan *Approval Date*.

---

## 5. DATABASE CHANGE CHECKLIST

Seluruh checklist berikut WAJIB terpenuhi (100% PASS) sebelum perubahan skema database di-merge ke branch utama:

- [ ] **[ ] Business Requirement Approved**: Kebutuhan bisnis disetujui stakeholder.
- [ ] **[ ] ERD Updated**: Diagram ERD diselaraskan.
- [ ] **[ ] SQL Reviewed**: Script SQL DDL di-review lead architect.
- [ ] **[ ] Foreign Key Reviewed**: Relasi FK terverifikasi ON DELETE/ON UPDATE.
- [ ] **[ ] Index Reviewed**: B-Tree Index kueri terpasang presisi.
- [ ] **[ ] Default Value Reviewed**: Nullability & default values diselaraskan.
- [ ] **[ ] Existing Data Safe**: 100% data produksi aman (zero data loss).
- [ ] **[ ] Rollback Available**: Script rollback DDL/DML teruji.
- [ ] **[ ] Repository Updated**: Layer QueryBuilder diselaraskan.
- [ ] **[ ] Entity Updated**: TypeORM Entity TypeScript diselaraskan.
- [ ] **[ ] Service Updated**: Service error handling terbebas dari silent catch.
- [ ] **[ ] API Tested**: REST API mengembalikan status & payload valid.
- [ ] **[ ] Frontend Tested**: UI Next.js render data dengan benar.
- [ ] **[ ] Smoke Test Passed**: Regression smoke test 100% SUCCESS.
- [ ] **[ ] Documentation Updated**: Changelog & governance doc diperbarui.

---

## 6. CHANGE GOVERNANCE FLOW

Alur tata kelola perubahan skema dari awal hingga rilis:

```
Business Requirement
        ↓
Architecture Review
        ↓
Database Design
        ↓
DDL Review
        ↓
Development
        ↓
Testing
        ↓
Release
        ↓
Post Release Audit
```

---

## 7. DEFINITION OF DONE (DOD) FOR DATABASE CHANGES

Sebuah perubahan skema database dinyatakan **SELESAI (DONE)** apabila memenuhi seluruh tahapan sekuensial berikut:

```
✓ Database Finished     ➔ DDL SQL dieksekusi & terverifikasi di MariaDB server.
        ↓
✓ Entity Synchronized   ➔ TypeORM Entity (*.entity.ts) 100% selaras dengan skema DB.
        ↓
✓ Repository Verified   ➔ Repository QueryBuilder menguji kueri tanpa SQL Error.
        ↓
✓ Service Passed        ➔ Service unit test & error handling lolos tanpa silent catch.
        ↓
✓ API Passed            ➔ Controller REST API mengembalikan HTTP 200/201 dengan payload valid.
        ↓
✓ Frontend Passed       ➔ UI Next.js render data dengan benar tanpa konsol warning/error.
        ↓
✓ Smoke Test Passed     ➔ End-to-end regression smoke test 100% SUCCESS.
```

---

## 8. LONG TERM POLICY

Mulai hari ini, seluruh pengembangan EPMS wajib mematuhi aturan jangka panjang:

1. **Database Runtime adalah Single Source of Truth.**
2. **Semua perubahan skema WAJIB dimulai dari Business Requirement & Database Design.**
3. **TIDAK BOLEH ada Entity Drift (Entity murni cerminan Database fisik).**
4. **TIDAK BOLEH ada Runtime Schema Drift.**
5. **TIDAK BOLEH ada Silent Error Suppression (`catch (e) { return []; }`).**
6. **TIDAK BOLEH ada perubahan skema tanpa audit record & dokumentasi resmi.**
