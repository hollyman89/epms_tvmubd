# 10. EPMS DATABASE DEVELOPMENT STANDARD SPECIFICATION

> **Document ID**: `EPMS-DOC-DB-10`  
> **Phase**: **PHASE D2.2 — DATABASE DEVELOPMENT STANDARD**  
> **Status**: **OFFICIAL TECHNICAL STANDARD (PERMANENT ENGINEERING SPECIFICATION)**  
> **Scope**: Enterprise Database Naming, Types, Keys, Indexes, Transactions, Best Practices, & Anti-Patterns  
> **Complements**: `docs/database/08_DATABASE_SOURCE_OF_TRUTH.md` & `docs/database/09_DATABASE_LIFECYCLE_AND_RELEASE_POLICY.md`  

---

## 1. TUJUAN DOKUMEN

Dokumen **Database Development Standard** ini diterbitkan sebagai pedoman rekayasa teknis resmi bagi seluruh perekayasa perangkat lunak (Software Engineers, Database Engineers, DevOps) di lingkungan EPMS.

Tujuannya adalah menjamin bahwa setiap pembuatan atau pengubahan komponen database fisik MariaDB/MySQL berjalan:
- **Konsisten**: Mematuhi aturan penamaan dan konvensi terstruktur.
- **Mudah Dipelihara (Maintainable)**: Skema ternormalisasi 3NF dengan relasi yang transparan.
- **Bebas Schema Drift**: Menghilangkan 100% jurang pemisah antara skema fisik dan TypeORM Entity.
- **Mudah Diaudit (Auditable)**: Dilengkapi audit columns dan compliance logging ter-standarisasi.
- **Enterprise-Ready**: Sanggup menangani beban transaksi tinggi dengan performa kueri sub-detik.

---

## 2. NAMING CONVENTIONS (KONVENSI PENAMAAN)

Seluruh pengidentifikasi skema WAJIB menggunakan format **`snake_case` (lowercase separated by underscore)**:

- **Database Name**: `epms_tvmubd_db`
- **Table Name**: Jama (Plural), lowercase `snake_case` (Contoh: `users`, `contracts`, `contract_amendments`, `purchase_orders`, `tender_activities`).
- **Column Name**: Tunggal (Singular), lowercase `snake_case` (Contoh: `contract_number`, `marketing_pic_id`, `created_at`).
- **Primary Key**: Wajib dinamai `id`.
- **Foreign Key Column**: Singular target table + `_id` (Contoh: `customer_id`, `tender_id`, `created_by`).
- **Foreign Key Constraint Name**: `fk_{source_table}_{target_table}_{column}` (Contoh: `fk_tenders_customers_customer_id`).
- **B-Tree Index Name**: `idx_{table}_{column1}_{column2}` (Contoh: `idx_tenders_stage_status`).
- **Unique Constraint Name**: `uq_{table}_{column1}` (Contoh: `uq_users_email`, `uq_customers_code`).
- **ENUM Type/Column**: Lowercase `snake_case` untuk kolom, UPPERCASE untuk nilai ENUM (Contoh: `stage` ➔ 'LEAD', 'QUALIFICATION').
- **View Name**: `v_{domain}_{name}` (Contoh: `v_marketing_tenders_summary`).
- **Trigger Name**: `trg_{table}_{action}_{timing}` (Contoh: `trg_tenders_after_update`).
- **Stored Procedure**: `sp_{domain}_{action}` (Contoh: `sp_analytics_recalculate_kpi`).
- **Function**: `fn_{domain}_{action}` (Contoh: `fn_contracts_calculate_margin`).

---

## 3. PRIMARY KEY STANDARD

1. **Mandatory Type**: Seluruh 35 tabel di EPMS WAJIB menggunakan Primary Key tunggal bernama `id` dengan tipe data **`BIGINT UNSIGNED AUTO_INCREMENT`**.
2. **Composite Primary Key Exception**: Hanya diizinkan pada tabel junction M:N tanpa payload tambahan (Contoh: `user_roles` pada `(user_id, role_id)`, `role_permissions` pada `(role_id, permission_id)`).
3. **No UUID as Primary Key**: UUID dilarang dijadikan Clustered Primary Key karena dapat memicu fragmentasi B-Tree Index. Jika butuh UUID publik, gunakan kolom terpisah `uuid VARCHAR(36) UNIQUE`.

---

## 4. FOREIGN KEY STANDARD

Setiap relasi antar-tabel WAJIB ditegaskan dengan aturan Foreign Key Constraint resmi:

1. **Naming Standard**: `fk_{source_table}_{target_table}_{column}`.
2. **Data Type Parity**: Kolom FK WAJIB bertipe `BIGINT UNSIGNED` persis sama dengan PK induknya.
3. **Delete Policy Guidelines**:
   - **`CASCADE`**: Digunakan HANYA jika child record tidak bermakna tanpa parent-nya (Contoh: `purchase_order_items` saat `purchase_orders` dihapus).
   - **`RESTRICT`**: Default untuk data referensi bisnis utama (Contoh: Mencegah penghapusan `customers` jika masih ada `tenders` / `contracts` aktif).
   - **`SET NULL`**: Digunakan jika relasi bersifat opsional/assignment (Contoh: `marketing_pic_id` atau `legal_reviewer_id`).
4. **Update Policy**: Seluruh Foreign Key WAJIB menggunakan `ON UPDATE CASCADE`.

---

## 5. AUDIT COLUMN STANDARD

Seluruh tabel domain utama (seperti `tenders`, `contracts`, `projects`, `users`, `customers`) WAJIB memiliki 6 kolom audit standar:

| Audit Column | Data Type | Nullability | Default Value | Description |
|---|---|---|---|---|
| `created_at` | `DATETIME` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu pembuatan record |
| `updated_at` | `DATETIME` | DEFAULT NULL | `NULL ON UPDATE CURRENT_TIMESTAMP` | Waktu pembaruan terakhir |
| `deleted_at` | `DATETIME` | DEFAULT NULL | `NULL` | Timestamp soft deletion |
| `created_by` | `BIGINT UNSIGNED` | DEFAULT NULL | `NULL` | ID user pembuat record |
| `updated_by` | `BIGINT UNSIGNED` | DEFAULT NULL | `NULL` | ID user pengubah terakhir |
| `deleted_by` | `BIGINT UNSIGNED` | DEFAULT NULL | `NULL` | ID user penghapus record |

---

## 6. SOFT DELETE STANDARD

1. **Soft Delete Mechanism**: Data bisnis dilarang dihapus fisik (`DELETE FROM`). Penghapusan dilakukan dengan meng-update `deleted_at = CURRENT_TIMESTAMP` dan `deleted_by = :userId`.
2. **Default Query Filter**: Seluruh kueri backend QueryBuilder WAJIB menyertakan klausul `WHERE table.deleted_at IS NULL`.
3. **Restore Policy**: Pemulihan data dilakukan dengan mengeset `deleted_at = NULL` dan `deleted_by = NULL`.
4. **Permanent Delete Policy**: Physical Hard Delete (`DELETE FROM`) HANYA diizinkan pada tabel transient (seperti `outbox_events` yang sudah terproses atau `user_sessions` expired) melalui cron job resmi.

---

## 7. ENUM STANDARD

1. **Kapan Menggunakan ENUM**: Digunakan jika kumpulan nilai bersifat tetap, terbatas (< 10 nilai), dan dikendalikan oleh logika bisnis inti (Contoh: `stage`, `status`, `legal_status`, `go_nogo_status`).
2. **Kapan Menggunakan Lookup Table**: Gunakan tabel terpisah jika nilai berjumlah banyak, dinamis, atau memiliki atribut tambahan (Contoh: `roles`, `permissions`, `vendors`).
3. **Aturan Penambahan Values**: Penambahan nilai ENUM baru WAJIB append di akhir list dan diselaraskan melalui DDL resmi di SQL Baseline dan TypeScript Enum.
4. **Larangan Menghapus Values**: DILARANG menghapus nilai ENUM secara langsung dari skema fisik karena akan merusak data historis di database.

---

## 8. INDEX STANDARD

1. **Primary Index**: Otomatis pada `id` (Clustered Index).
2. **Foreign Key Index**: Seluruh kolom FK `_id` WAJIB ter-index B-Tree.
3. **Composite Index**: Buat komposit indeks pada kolom yang sering digunakan bersamaan dalam klausul `WHERE` & `ORDER BY` (Contoh: `idx_tenders_stage_status_deleted` pada `(stage, status, deleted_at)`).
4. **Unique Index**: Terapkan pada nilai unik bisnis (Contoh: `uq_contracts_contract_number`).
5. **Covering Index**: Optimalkan kueri agregasi agar cukup dibaca dari index B-Tree tanpa *table lookup*.
6. **Search Index**: Gunakan Fulltext Index atau B-Tree prefix index pada kolom pencarian teks (`title`, `customer_name`).

---

## 9. DATA TYPE STANDARD

- **`BIGINT UNSIGNED`**: Seluruh Primary Key & Foreign Key IDs.
- **`VARCHAR(N)`**: Teks pendek dengan batas pasti (`varchar(100)` untuk nomor dokumen, `varchar(255)` untuk email/nama).
- **`TEXT`**: Teks deskripsi panjang tanpa batas pencarian presisi (catatan, justifikasi).
- **`LONGTEXT`**: Isi dokumen HTML/Template besar.
- **`DECIMAL(19,2)`**: Seluruh akumulasi moneter, nilai kontrak, budget, invoice, dan estimasi harga.
- **`DATE`**: Tanggal tanpa waktu (`start_date`, `end_date`, `birth_date`).
- **`DATETIME`**: Waktu presisi detik (`created_at`, `go_nogo_at`).
- **`TINYINT(1)`**: Digunakan sebagai representasi Boolean (`is_active`, `is_verified`).
- **`JSON`**: Khusus audit log payload (`old_value`, `new_value`) atau metadata konfigurasi fleksibel.

---

## 10. NULLABILITY STANDARD

1. **`NOT NULL` Rule**: Wajib untuk seluruh kolom identitas inti (`id`, `title`, `stage`, `status`, `customer_id`, `created_at`).
2. **`NULL` Rule**: Digunakan untuk kolom opsional, rincian pasca-proses (`updated_at`, `deleted_at`, `approved_by`, `go_nogo_notes`).
3. **Default Value Integrity**: Default value harus eksplisit di DDL (`DEFAULT 'PENDING'`, `DEFAULT '0.00'`, `DEFAULT CURRENT_TIMESTAMP`).

---

## 11. CONSTRAINT STANDARD

1. **`FOREIGN KEY`**: Menjaga integritas referensi relasi.
2. **`UNIQUE`**: Menjamin keunikan data unik bisnis.
3. **`CHECK` Constraint**: Digunakan di DDL MariaDB untuk memvalidasi batasan domain (Contoh: `CHECK (contract_value >= 0)`).
4. **`DEFAULT` Constraint**: Menjamin kolom memiliki nilai awal aman jika disisipkan tanpa nilai eksplisit.

---

## 12. TRANSACTION STANDARD

1. **Mandatory Transaction**: Transaksi DB (`QueryRunner` / `dataSource.transaction`) WAJIB digunakan pada seluruh mutation yang menyentuh lebih dari 1 tabel (Contoh: `createTender` yang memasukkan `tenders` + `tender_activities` + `outbox_events`).
2. **Isolation Level**: Default `READ COMMITTED` untuk mencegah dirty reads.
3. **Explicit Rollback**: Setiap blok `catch (e)` pada transaksi WAJIB mengeksekusi `await queryRunner.rollbackTransaction()`.
4. **Explicit Release**: Blok `finally` WAJIB mengembalikan koneksi `await queryRunner.release()`.

---

## 13. REPOSITORY STANDARD

1. **Parameterized Queries Only**: Seluruh kueri SQL / TypeORM QueryBuilder WAJIB menggunakan binding parameter (Contoh: `.where('tender.id = :id', { id })`).
2. **No String Concatenation**: DILARANG KERAS menggabungkan string kueri dengan variabel pengguna (`'WHERE id = ' + inputId`).
3. **Zero SQL Injection**: Seluruh masukan wajib melalui sanitasi parameter terikat.

---

## 14. PERFORMANCE STANDARD

1. **EXPLAIN Plan Verification**: Kueri kompleks wajib di-audit menggunakan `EXPLAIN` untuk memastikan tidak ada *ALL Table Scan*.
2. **Slow Query Threshold**: Kueri dengan waktu eksekusi > 200ms dianggap slow query dan wajib di-optimasi.
3. **Mandatory Pagination**: Kueri daftar/list WAJIB menggunakan LIMIT & OFFSET / Keyset Pagination.
4. **Batch Processing**: Operasi masal WAJIB menggunakan batch insert/update (maksimal 500 records per batch).

---

## 15. DOCUMENTATION STANDARD

Setiap terjadi perubahan skema DDL, perekayasa WAJIB memperbarui 6 dokumen pendukung:
1. `database/epms_tvmubd_db.sql` (SQL Baseline)
2. `docs/database/01_DATABASE_BASELINE.md`
3. `docs/database/04_TARGET_DATABASE_DESIGN.md`
4. `docs/database/07_COMPATIBILITY_MATRIX.md`
5. `docs/database/08_DATABASE_SOURCE_OF_TRUTH.md`
6. `docs/database/09_DATABASE_LIFECYCLE_AND_RELEASE_POLICY.md`

---

## 16. PRE-MERGE CHECKLIST

- [ ] **[ ] Naming Convention Passed**: `snake_case` pada seluruh tabel & kolom.
- [ ] **[ ] Primary Key Standard**: `id BIGINT UNSIGNED AUTO_INCREMENT`.
- [ ] **[ ] Foreign Keys B-Tree Indexed**: Seluruh kolom `_id` memiliki indeks.
- [ ] **[ ] Audit Columns Present**: 6 kolom audit terpasang.
- [ ] **[ ] Soft Delete Implemented**: Kueri menyertakan `deleted_at IS NULL`.
- [ ] **[ ] Transactions Enforced**: Multi-table mutation menggunakan `QueryRunner`.
- [ ] **[ ] SQL Injection Clean**: Parameterized queries 100%.
- [ ] **[ ] Migration Rollback Tested**: Skrip `DOWN.sql` teruji.

---

## 17. 30 ENTERPRISE DATABASE BEST PRACTICES

1. Selalu gunakan `BIGINT UNSIGNED` untuk Primary Key.
2. Selalu gunakan `DECIMAL(19,2)` untuk nilai moneter.
3. Selalu sertakan 6 kolom audit pada tabel domain.
4. Selalu buat B-Tree Index pada seluruh Foreign Key `_id`.
5. Selalu gunakan Parameterized Queries.
6. Selalu gunakan Transaksi pada mutation multi-tabel.
7. Selalu bebaskan transaksi di blok `finally`.
8. Selalu uji kueri dengan `EXPLAIN`.
9. Selalu terapkan pagination pada kueri list.
10. Selalu gunakan `utf8mb4_unicode_ci`.
11. Selalu sertakan `ON UPDATE CASCADE` pada FK.
12. Selalu gunakan `RESTRICT` untuk data referensi utama.
13. Selalu gunakan `snake_case` nama tabel jamak.
14. Selalu update SQL Baseline saat DDL berubah.
15. Selalu buat skrip Rollback `DOWN.sql`.
16. Selalu lakukan mysqldump backup sebelum rilis DDL.
17. Selalu saring kueri aktif dengan `deleted_at IS NULL`.
18. Selalu batasi panjang `VARCHAR` secara realistis.
19. Selalu simpan nilai jam dalam UTC.
20. Selalu buat Unique Constraint pada data unik bisnis.
21. Selalu isi nilai default aman pada kolom NOT NULL.
22. Selalu pisahkan payload audit trail ke kolom `JSON`.
23. Selalu gunakan batching saat menginsert banyak record.
24. Selalu konsistenkan tipe data FK dengan PK target.
25. Selalu lemparkan HTTP Exception transparan saat DB error.
26. Selalu uji `migration:run` dan `migration:revert`.
27. Selalu amankan database dari akses publik direct.
28. Selalu review slow query log secara periodik.
29. Selalu update dokumentasi ERD saat skema berubah.
30. Selalu patuhi konstitusi Database Source of Truth.

---

## 18. 30 ANTI-PATTERNS (LARANGAN KERAS)

1. ❌ **SELECT *** di kueri produksi.
2. ❌ **Hardcoded IDs** di kodingan service.
3. ❌ **Duplicate ENUM values** di beda tabel tanpa standar.
4. ❌ **Duplicate Tables** dengan fungsi mirip.
5. ❌ **Nullable Columns tanpa alasan bisnis**.
6. ❌ **Migration tanpa skrip Rollback**.
7. ❌ **Entity TypeScript berbeda dengan database fisik**.
8. ❌ **Manual ALTER TABLE di Production tanpa SOP**.
9. ❌ **Silent Schema Drift**.
10. ❌ **Mengaktifkan `synchronize: true` di Production**.
11. ❌ **String Concatenation di Kueri SQL**.
12. ❌ **Menggunakan FLOAT/DOUBLE untuk Uang**.
13. ❌ **Membuat Tabel Tanpa Primary Key**.
14. ❌ **Menggunakan VARCHAR untuk Tanggal**.
15. ❌ **Hard Delete data bisnis utama**.
16. ❌ **Menyembunyikan SQL Error dengan `catch(e) { return []; }`**.
17. ❌ **Lupa me-release QueryRunner di blok `finally`**.
18. ❌ **Menghapus nilai ENUM yang sudah dipakai data legacy**.
19. ❌ **Foreign Key tanpa B-Tree Index**.
20. ❌ **Menggunakan CamelCase untuk Nama Tabel/Kolom**.
21. ❌ **Menyimpan Password Plaintext**.
22. ❌ **Kueri tanpa LIMIT pada tabel besar**.
23. ❌ **ALTER TABLE di dalam Service Layer**.
24. ❌ **Membuat Migration tanpa menyinkronkan SQL Baseline**.
25. ❌ **Mengabaikan Slow Query Log**.
26. ❌ **Menggunakan UUID v4 sebagai Clustered Primary Key**.
27. ❌ **Melakukan N+1 Query Loop di Service**.
28. ❌ **Menambah Column hanya di Entity TypeScript**.
29. ❌ **Mengubah skema tanpa menguji Rollback Script**.
30. ❌ **Melakukan Merge PR tanpa menyetujui Pre-Merge Checklist**.

---

## 19. SUMMARY

Dokumen **Database Development Standard** ini merupakan pedoman baku permanen EPMS. Seluruh pengembang wajib menundukkan seluruh kode backend, migration, dan entity pada aturan teknis di atas demi menjamin sistem EPMS yang bebas drift, tercepat, dan andal.
