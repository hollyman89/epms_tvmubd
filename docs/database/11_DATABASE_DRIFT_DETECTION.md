# 11. EPMS DATABASE DRIFT DETECTION SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-11`  
> **Phase**: **PHASE D2.3 — DATABASE DRIFT DETECTION SPECIFICATION**  
> **Status**: **OFFICIAL DRIFT DETECTION SOP & VALIDATION PROTOCOL**  
> **Scope**: Schema Hashing, Entity-DB Sync, Fail-Fast Startup, & Severity Matrix  
> **Complements**: `docs/database/08_DATABASE_SOURCE_OF_TRUTH.md` & `docs/database/10_DATABASE_DEVELOPMENT_STANDARD.md`  

---

## BAB 1. TUJUAN DOKUMEN

Dokumen **Database Drift Detection Specification** ini diterbitkan sebagai SOP resmi pengujian dan pendeteksian otomatis ketidakcocokan skema (*schema drift*) di seluruh lapisan ekosistem EPMS.

Masalah utama yang dieliminasi secara total:
- **Unknown Column**: SQL error akibat properti Entity dipanggil padahal kolom belum ada di MariaDB.
- **Unknown Table**: Error akibat tabel baru belum terbentuk di runtime database.
- **Unknown Enum**: Error akibat nilai enum pada aplikasi tidak ada di definisi DDL fisik.
- **Runtime Drift**: Ketidakcocokan antara DDL di repositori dengan instance database MariaDB aktif.
- **Entity Drift**: Ketidakcocokan antara properti TypeScript Entity dengan kolom fisik database.
- **Migration Drift**: Berkas migration ada di repositori tetapi tidak pernah di-run di database.
- **Silent Error Suppression**: Praktik buruk menyembunyikan SQL Error dengan `catch(e) { return []; }`.
- **Blank Dashboard & Blank Kanban**: Tampilan UI kosong akibat API mengembalikan payload `[]` palsu.
- **Internal Server Error**: Status HTTP 500 yang tidak terprediksi di lingkungan rilis.

---

## BAB 2. DEFINISI DATABASE DRIFT

1. **Database Drift**: Perbedaan antara struktur fisik database MariaDB runtime dengan berkas `database/epms_tvmubd_db.sql` (SQL Baseline).
2. **Entity Drift**: Perbedaan antara dekorator `@Column()` di TypeORM Entity TypeScript dengan kolom aktual di database fisik.
3. **Migration Drift**: Adanya berkas migration terdaftar di repositori yang belum ter-eksekusi di tabel `migrations` database runtime.
4. **Repository Drift**: Kueri QueryBuilder/SQL pada Repository yang mengasumsikan nama kolom/tabel yang tidak terdaftar di database.
5. **API Drift**: Perubahan struktur response DTO API yang meminta data dari kolom database yang telah dihapus/di-rename.
6. **Frontend Drift**: Tipe data TypeScript Frontend yang tidak cocok dengan DTO API Contract.
7. **Runtime Drift**: Kondisi di mana kompilasi aplikasi lulus (`npx tsc`), namun gagal saat dijalankan di staging/production akibat jurang skema database.

---

## BAB 3. DRIFT DETECTION ARCHITECTURE

Diagram alur kerja mesin pemeriksa ketidakcocokan skema (Validation Engine):

```
Business Requirement
        ↓
Database Baseline (database/epms_tvmubd_db.sql)
        ↓
Runtime Database (MariaDB Server)
        ↓
Repository Layer
        ↓
Entity Layer (*.entity.ts)
        ↓
Service Layer (*.service.ts)
        ↓
API Layer (Controllers & DTOs)
        ↓
Frontend Layer (Next.js Types)
        ↓
VALIDATION ENGINE (Schema Hash & Parity Check)
        │
        ├───────────► [ PASS ]  ➔ Continue Server Startup / Deployment
        │
        └───────────► [ FAIL ]  ➔ FAIL FAST! (Halt Startup & Block Build)
```

---

## BAB 4. DRIFT DETECTION LEVELS

Pendeteksian drift dilakukan pada 6 tingkatan berurutan:

- **Level 1 (Database Structure)**: Audit fisik MariaDB (Table, Column, Datatype, Nullable, Default, Index, Foreign Key, Enum).
- **Level 2 (Repository)**: Audit kueri SQL/QueryBuilder terhadap kolom fisik.
- **Level 3 (Entity)**: Audit dekorator `@Entity()` dan `@Column()` TypeScript terhadap DDL.
- **Level 4 (Service)**: Audit penanganan error service layer (0% silent error suppression).
- **Level 5 (API Contract)**: Audit Swagger OpenAPI Spec & DTO terhadap kueri repository.
- **Level 6 (Frontend Contract)**: Audit antarmuka TypeScript Frontend terhadap API DTO response.

---

## BAB 5. DATABASE HASH VALIDATION

Konsep validasi keutuhan skema berbasis Kriptografi Hash (SHA-256):

```
Information Schema (MariaDB System Catalog)
        ↓
Generate Schema Hash (SHA256 dari tabel, kolom, tipe, nullability)
        ↓
Generate DDL Hash (SHA256 dari database/epms_tvmubd_db.sql)
        ↓
Compare Hash Values
        │
        ├─── Equal Hash    ➔ PASS (Zero Schema Drift Verified)
        └─── Differ Hash   ➔ FAIL (Schema Drift Detected!)
```

---

## BAB 6. ENTITY VALIDATION SPECIFICATION

Prosedur inspeksi otomatis TypeORM Entity terhadap MariaDB Physical DB:

1. **Table Check**: Memastikan nama tabel pada `@Entity('table_name')` ada di `SHOW TABLES`.
2. **Column Check**: Memastikan seluruh properti `@Column({ name: 'col_name' })` ada di `SHOW COLUMNS`.
3. **Datatype Parity**: Memastikan tipe TypeScript (`number`, `string`, `Date`) selaras dengan tipe DDL (`bigint`, `varchar`, `datetime`).
4. **Nullable Parity**: Memastikan properti tanpa `nullable: true` bersifat `NOT NULL` di MariaDB.
5. **Enum Parity**: Memastikan nilai TypeScript Enum 100% cocok dengan DDL ENUM string.
6. **Relation Check**: Memastikan dekorator `@ManyToOne` / `@OneToMany` memiliki Foreign Key fisik di DB.
7. **Primary Key Parity**: Memastikan `@PrimaryGeneratedColumn()` sesuai dengan Clustered Primary Key `id`.
8. **Foreign Key Parity**: Memastikan `@JoinColumn({ name: 'fk_id' })` memiliki B-Tree Index.

---

## BAB 7. STARTUP VALIDATION FLOW

Prosedur boot server NestJS Backend untuk mencegah `Unknown Column` di runtime:

```
Read Manifest (BACKEND_EXPECTED_SCHEMA_HASH)
        ↓
Read Database Version (SELECT version FROM database_versions)
        ↓
Read Runtime Schema (Query INFORMATION_SCHEMA)
        ↓
Generate Runtime Hash
        ↓
Compare Manifest Hash vs Runtime Hash
        │
        ├─── MATCH      ➔ PASS: Proceed NestApplication.listen(4000)
        └─── MISMATCH   ➔ FAIL FAST: Log Error & process.exit(1)
```

---

## BAB 8. FAIL FAST POLICY

Apabila pada saat startup atau CI/CD pipeline ditemukan salah satu dari kondisi berikut:
- ❌ **Unknown Column** (Properti Entity tidak ada di MariaDB).
- ❌ **Unknown Table** (Entity mereferensikan tabel yang belum terbuat).
- ❌ **Missing Foreign Key** (Relasi tanpa FK fisik).
- ❌ **Missing Index** (Kolom FK tanpa B-Tree Index).
- ❌ **Schema Drift** (Hash skema berbeda).
- ❌ **Version Drift** (Versi DB lebih rendah daripada versi backend).

Maka backend **WAJIB SEGERA BERHENTI (FAIL FAST / STOP PROCESS)**. Server DILARANG KERAS tetap berjalan dalam keadaan skema cacat.

---

## BAB 9. DRIFT REPORT FORMAT

Format laporan otomatis pendeteksian drift:

```markdown
### EPMS DATABASE DRIFT DETECTION REPORT
- **Timestamp**: 2026-08-05T08:50:00Z
- **Runtime Database**: epms_tvmubd_db @ 127.0.0.1:3306
- **Overall Result**: FAIL (Drift Detected)

| Table Name | Expected Column / Constraint | Actual DB Status | Severity | Required Action |
|---|---|---|---|---|
| `tenders` | `go_nogo_status ENUM('PENDING','GO','NO_GO')` | MISSING IN DB | CRITICAL | Execute DDL `ALTER TABLE tenders ADD COLUMN go_nogo_status...` |
| `tenders` | `revision_status ENUM('NOT_REQUIRED',...)` | MISSING IN DB | CRITICAL | Execute DDL `ALTER TABLE tenders ADD COLUMN revision_status...` |
```

---

## BAB 10. DRIFT SEVERITY MATRIX

| Severity Level | Definition | Business & System Impact | Required Action |
|---|---|---|---|
| **CRITICAL** | Kolom/tabel yang dipanggil kueri aktif tidak ada di DB | API melempar HTTP 500 / Kanban blank | **BLOCK BUILD & FAIL FAST STARTUP IMMEDIATELY** |
| **HIGH** | Tipe data / Enum value mismatch | Potensi data truncation atau corrupt | Fix DDL/Entity within 24 hours |
| **MEDIUM** | Indeks Foreign Key hilang | Performa kueri lambat (> 200ms) | Add B-Tree Index during next release |
| **LOW** | Kolom fisik ada di DB tetapi belum di-map di Entity | Tidak merusak kueri, data unmapped | Update Entity definition |
| **INFO** | Perbedaan komentar DDL / Collation minor | Tidak ada dampak fungsional | Log info warning |

---

## BAB 11. DRIFT DETECTION CHECKLIST

Checklist audit otomatis CI/CD & Startup System:

- [ ] **[ ] Schema Hash Parity**: Hash DDL Baseline == Hash Information Schema DB.
- [ ] **[ ] Entity Parity**: 100% `@Column()` terbukti ada di `SHOW COLUMNS`.
- [ ] **[ ] Enum Value Parity**: TypeScript Enum values == Physical DDL ENUM strings.
- [ ] **[ ] Foreign Key Parity**: Seluruh `@ManyToOne` memiliki FK fisik di MariaDB.
- [ ] **[ ] Index Parity**: Seluruh kolom `_id` ter-index B-Tree.
- [ ] **[ ] Zero Silent Error**: 0 `catch(e) { return []; }` di Service layer.
- [ ] **[ ] Fail-Fast Verified**: System exit `code 1` saat hash mismatch disimulasikan.

---

## BAB 12. 25 ENTERPRISE BEST PRACTICES

1. Selalu jalankan Schema Hash Check pada boot sequence backend.
2. Selalu terapkan Fail-Fast Policy saat versi DB tidak sesuai.
3. Selalu gunakan `INFORMATION_SCHEMA` untuk mengekstrak metadata fisik.
4. Selalu pastikan TypeScript Enum identik dengan string DDL ENUM.
5. Selalu verifikasi bahwa seluruh kolom FK `_id` ter-index B-Tree.
6. Selalu simpan manifest schema hash pada versi ter-tag.
7. Selalu kunci eksekusi CI/CD jika pendeteksian drift bernilai FAIL.
8. Selalu buat laporan drift otomatis format Markdown.
9. Selalu bedakan Severity Level drift (Critical s/d Info).
10. Selalu pastikan `@PrimaryGeneratedColumn()` sesuai PK `id`.
11. Selalu verifikasi nullability `@Column({ nullable: true })`.
12. Selalu bandingkan jumlah tabel `SHOW TABLES` dengan Entity count.
13. Selalu lemparkan HTTP Exception transparan daripada silent catch.
14. Selalu sertakan check `deleted_at IS NULL` di kueri active data.
15. Selalu simpan log temuan drift di folder `logs/drift.log`.
16. Selalu verifikasi kueri repository dengan parameter binding.
17. Selalu pastikan DTO API Contract tidak meminta kolom ghost.
18. Selalu jalankan smoke test API pasca-verifikasi hash.
19. Selalu uji mekanisme rollback skrip DDL.
20. Selalu pastikan `synchronize: false` aktif di TypeORM config.
21. Selalu audit kueri slow log pasca-penambahan indeks.
22. Selalu komunikasikan perubahan DDL ke tim pengembang.
23. Selalu gunakan transactional outbox untuk event streaming.
24. Selalu kunci versi MariaDB server di Docker/Environment.
25. Selalu patuhi konstitusi Database Source of Truth.

---

## BAB 13. 25 ANTI-PATTERNS (LARANGAN KERAS)

1. ❌ **Mengabaikan Unknown Column error di log**.
2. ❌ **Meng-catch SQL error lalu mengembalikan array kosong `[]`**.
3. ❌ **Deploy aplikasi walau skema database berbeda**.
4. ❌ **Entity TypeScript lebih baru daripada database fisik**.
5. ❌ **Migration dibuat tetapi tidak dieksekusi di database**.
6. ❌ **Backend startup tanpa melakukan validasi skema**.
7. ❌ **Aplikasi berjalan tanpa berkas SQL Baseline**.
8. ❌ **Manual ALTER TABLE di Production tanpa audit SOP**.
9. ❌ **Menyembunyikan `QueryFailedError` dari respons API**.
10. ❌ **Membiarkan Kanban Board blank akibat error DB disembunyikan**.
11. ❌ **Mengabaikan perbedaan nilai ENUM antara DB dan Entity**.
12. ❌ **Membuat properti Entity tanpa kolom fisik di MariaDB**.
13. ❌ **Membiarkan Foreign Key tanpa B-Tree Index**.
14. ❌ **Melanjutkan build CI/CD saat pendeteksian drift FAIL**.
15. ❌ **Mengabaikan perbedaan versi database di startup**.
16. ❌ **Mengubah skema fisik tanpa memperbarui berkas SQL Baseline**.
17. ❌ **Menjalankan `synchronize: true` pada Production**.
18. ❌ **Mengabaikan slow query warning (> 200ms)**.
19. ❌ **Menghapus kolom fisik tanpa audit dampak modul**.
20. ❌ **Menggunakan kueri raw string concatenation**.
21. ❌ **Membiarkan orphan records tanpa Foreign Key Restrict**.
22. ❌ **Menghilangkan fail-fast check demi "aplikasi tetap nyala"**.
23. ❌ **Menuliskan DDL hardcoded di dalam Service Layer**.
24. ❌ **Menyembunyikan laporan drift dari tim QA/Architect**.
25. ❌ **Melakukan Merge PR tanpa menyetujui Drift Checklist**.

---

## BAB 14. SUMMARY

Dokumen **Database Drift Detection Specification** ini menetapkan fondasi otomatisasi pengujian keutuhan skema EPMS. Dengan menerapkan pendeteksian drift berbasis Hash Validation dan Fail-Fast Policy, sistem EPMS dijamin 100% terbebas dari insiden `Unknown Column`, silent catch, dan Kanban kosong selamanya.
