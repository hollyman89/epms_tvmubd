# PHASE MKT-4 PRE-IMPLEMENTATION AUDIT REPORT

**MODE**: READ ONLY FORENSIC AUDIT  
**RULES**: 0 Code Changes | 0 Database Changes | Pure Evidence-Based Analysis  
**SCOPE**: Marketing Backend, Legal Module, PMO Module, Frontend UI

---

# 1. CURRENT BEHAVIOUR (Perilaku Sistem Saat Ini)

Berdasarkan analisis source code aktual:

1. **Eksekusi `PATCH /marketing/tenders/:id/grace-period`**:
   - `marketing.service.ts#L1284-L1291`: Mengeset `tender.stage = WON` dan `tender.status = WON`.
   - Mengisi `tender.grace_deadline = NOW() + 48h`.
   - **Langsung memanggil `ensureContractForWonTender()`**, yang meng-insert row baru ke tabel `contracts` dengan `status = PENDING_LEGAL_REVIEW`, `legal_status = DRAFT`, dan `spk_file_url = NULL`.
   - **Langsung memicu `emitLegalQueueUpdated()`**, sehingga draf kontrak tanpa SPK **langsung muncul di antrian Legal Review**.

2. **Eksekusi Scheduler Expired (`tender.scheduler.ts#L38-L43`)**:
   - Memeriksa tender dengan `status = WON` dan `grace_deadline < NOW()`.
   - Mengubah `tender.status = NEGOTIATION` dan `tender.grace_deadline = NULL`.
   - **TIDAK mengubah `tender.stage`** (membiarkan `stage` bernilai `WON`).
   - **TIDAK menghapus/mendemutkan record `Contract`** yang pernah terbuat, sehingga draf kontrak tanpa SPK **tetap menggantung secara permanen di antrian Legal Review**.

3. **Eksekusi `POST /marketing/tenders/:id/upload-spk`**:
   - Upload file fisik SPK ke folder `/uploads/contracts/`.
   - Memperbarui `contracts.spk_file_url` dan `tenders.spk_file_key`.
   - Mengeset `tender.stage = WON` dan `tender.status = WON`.

---

# 2. GAP ANALYSIS (Selisih Kondisi Aktual vs Target Bisnis)

| Komponen Evaluasi | Kondisi Saat Ini (Current) | Target Bisnis Diinginkan (MKT-4) | Gap Status |
|-------------------|----------------------------|----------------------------------|------------|
| **Grace Period Active** | Contract **LANGSUNG DIBUAT** & masuk Legal Queue (`spk_file_url = NULL`) | Stage/Status `WON` + Grace 48h, **Contract BELUM dibuat**, **BELUM masuk Legal Queue** | **GAP KONTRAK LEAK 🔴** |
| **SPK Uploaded** | Updates existing Contract (`spk_file_url = publicUrl`) | **Contract BARU dibuat** saat SPK fisik di-upload & masuk Legal Queue | **GAP TIMING CREATION 🔴** |
| **Grace Expired** | Only resets `status = NEGOTIATION`, **Stage TETAP WON**, **Contract TETAP ADA di Legal Queue** | Resets **Stage & Status = NEGOTIATION**, Grace `NULL`, **Contract & Legal Queue BERSIH** | **GAP CLEANUP SCHEDULER 🔴** |

---

# 3. IMPACT & DEPENDENCY ANALYSIS

### Dependency Matrix (`TenderStage.WON` & `TenderStatus.WON`):

| File | Method | Dependency | Impact Pasca MKT-4 |
|------|--------|------------|--------------------|
| `backend/src/entities/tender.entity.ts` | Enum Definitions | `TenderStatus.WON`, `TenderStage.WON` | Schema Base (Tetap) |
| `backend/src/modules/marketing/marketing.service.ts` | `calculateProbabilityPercentage()` | `status === WON \|\| stage === WON` | Return 100% Win Rate |
| `backend/src/modules/marketing/marketing.service.ts` | `validateTenderStateTransition()` | `target === WON` | Memastikankan Grace / SPK valid |
| `backend/src/modules/marketing/marketing.service.ts` | `setGracePeriod()` | `ensureContractForWonTender()` | **Dihapus dari setGracePeriod** (Contract dibuat saat Upload SPK saja) |
| `backend/src/modules/marketing/marketing.service.ts` | `saveSPKAndUpdateContract()` | `ensureContractForWonTender()` | **Satu-satunya tempat pembuatan Contract** |
| `backend/src/modules/marketing/tender.scheduler.ts` | `handleGracePeriodAndTimeouts()` | Expiry Demotion | **Ditambah logic resetting `stage = NEGOTIATION` & Soft-Delete Contract** |
| `backend/src/modules/legal/legal.service.ts` | `getPendingContracts()` | Filter Queue | **Ditambah filter `spk_file_url IS NOT NULL`** |
| `frontend/src/components/KanbanBoard.tsx` | UI Rendering | Column WON & Grace Warning Tag | Display Badge SPK Pending / Grace Active |
| `frontend/src/app/(dashboard)/sales/tenders/[id]/page.tsx` | Detail Page UI | Status Badges & Action Buttons | Display Tag Grace Period |

### Evaluasi Pertanyaan Arsitektur (Audit 5):

- **A. Apakah flow target valid secara arsitektur?**  
  **SANGAT VALID 🟢**. Alur target menjamin Legal Review hanya memproses draf kontrak yang sudah memiliki ikatan hukum resmi (SPK Customer), mencegah *contract orphaned leak* pada scheduler.
- **B. Berapa file yang harus diubah?**  
  Total **4 File Backend** + **2 File Frontend** (~6 File Terisolasi).
- **C. Endpoint apa saja terdampak?**  
  `PATCH /marketing/tenders/:id/grace-period`, `POST /marketing/tenders/:id/upload-spk`, `GET /legal/contracts/pending`.
- **D. Frontend apa saja terdampak?**  
  `KanbanBoard.tsx` (Grace badge) dan `tenders/[id]/page.tsx`.
- **E. Legal Module terdampak atau tidak?**  
  **TERDAMPAK MINIMAL 🟢** (1 Filter tambahan pada `getPendingContracts()` untuk menjamin `spk_file_url IS NOT NULL`).
- **F. PMO Module terdampak atau tidak?**  
  **TIDAK TERDAMPAK 🟢** (PMO hanya menarik kontrak berstatus `legal_status = 'APPROVED'`).

---

# 4. FILES TO CHANGE (Daftar File Yang Akan Diubah)

1. `backend/src/modules/marketing/marketing.service.ts`
2. `backend/src/modules/marketing/tender.scheduler.ts`
3. `backend/src/modules/legal/legal.service.ts`
4. `frontend/src/components/KanbanBoard.tsx`
5. `frontend/src/app/(dashboard)/sales/tenders/[id]/page.tsx`

---

# 5. RISK LEVEL

**RISK LEVEL: `LOW TO MEDIUM (TERISOLASI & SERBA MINIMAL)`**

- **Alasan Risk Low**: Tidak ada migrasi database/perubahan schema DB. Hanya menggeser lokasi pemanggilan `ensureContractForWonTender()` dari `setGracePeriod()` ke `saveSPKAndUpdateContract()`, serta menyempurnakan fungsi kebersihan (*cleanup*) pada scheduler.

---

# 6. RECOMMENDED IMPLEMENTATION PLAN (MKT-4)

### STEP 1: Penyesuaian `setGracePeriod()` (`marketing.service.ts`)
- Hapus pemanggilan `ensureContractForWonTender()` dari `setGracePeriod()`.
- Saat Grace Period diaktifkan:
  - `tender.stage = WON`
  - `tender.status = WON`
  - `tender.grace_deadline = NOW() + 48h`
  - `tender.probability_percentage = 100`
  - **TIDAK ADA record Contract yang terbuat di DB.**

### STEP 2: Penyesuaian `saveSPKAndUpdateContract()` (`marketing.service.ts`)
- Panggil `ensureContractForWonTender()` **SETELAH** file fisik SPK berhasil disimpan ke disk storage.
- Buat/update record `Contract` dengan `spk_file_url = publicUrl`, `status = PENDING_LEGAL_REVIEW`, `legal_status = DRAFT`.
- Memicu event `emitLegalQueueUpdated()`.

### STEP 3: Penyempurnaan Scheduler Expired (`tender.scheduler.ts`)
- Ketika Grace Period 48 jam expired (`grace_deadline < NOW()` & `!spk_file_key`):
  - `tender.status = NEGOTIATION`
  - `tender.stage = NEGOTIATION`
  - `tender.grace_deadline = null`
  - **Soft-delete record `Contract` terkait jika terlanjur ada**, sehingga antrian Legal Review 100% bersih.

### STEP 4: Pengetatan Filter Legal Queue (`legal.service.ts`)
- Tambahkan filter `AND contract.spk_file_url IS NOT NULL` pada query `getPendingContracts()`.

### STEP 5: Verifikasi End-to-End Test (API Test Script)
- Jalankan skrip uji otomatis untuk memverifikasi 3 skenario:
  1. Grace Period Aktif -> Contract = 0, Legal Queue = 0.
  2. Upload SPK -> Contract = 1, Legal Queue = 1.
  3. Grace Expired -> Stage & Status = NEGOTIATION, Contract = 0, Legal Queue = 0.

---

**AUDIT PHASE MKT-4 SELESAI.** Laporan disusun secara *read-only* tanpa modifikasi kode atau database.
