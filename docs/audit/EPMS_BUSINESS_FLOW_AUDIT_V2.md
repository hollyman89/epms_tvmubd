# EPMS Business Flow Audit V2

## Executive Summary

Audit ini dilakukan berdasarkan **Flow Bisnis Resmi EPMS (SSOT)** yang meliputi tahapan Customer, Tender, Go/No-Go Review, Qualification, Proposal, Negotiation, WON, dan Legal Review.

### Key Audit Highlights:
- **Flow Alignment**: Implementasi utama alur Sales Pipeline (LEAD → WAITING_GO_NO_GO → QUALIFICATION → PROPOSAL → NEGOTIATION → WON → LEGAL REVIEW) telah terbangun di Backend & Frontend.
- **Bypass & Missing Validation**: Ditemukan celah di mana validasi prasyarat (seperti wajib upload Proposal sebelum stage PROPOSAL, wajib detail negosiasi sebelum stage NEGOTIATION, dan wajib upload SPK sebelum stage WON) **hanya berada di layer Frontend (Kanban UI)** dan dapat di-bypass melalui direct HTTP call ke Backend API.
- **PMO, Procurement, Finance Scope Note**: Proses otomatisasi kelanjutan dari Legal Approval ke PMO, Procurement, dan Project Closeout belum terhubung secara langsung via otomatisasi event listener di kode backend aktif (**NOT FOUND IN CODEBASE**).

---

## Current Business Flow

Alur bisnis aktual yang terdeteksi pada codebase:

```text
[Customer Creation] ──> [Tender Creation (Stage: LEAD)]
                               │
                               ▼
                   [Submit GO/NO-GO Review]
                               │
                   (Director Review Action)
                   ┌───────────┴───────────┐
                [NO GO]                 [GO]
                   │                       │
           (Back to LEAD)          (Stage: QUALIFICATION)
                                           │
                                           ▼
                                 [Upload Proposal]
                                           │
                                   (Stage: PROPOSAL)
                                           │
                                           ▼
                                [Price Negotiation]
                                           │
                                  (Stage: NEGOTIATION)
                                           │
                                           ▼
                                 [Upload SPK / Grace]
                                           │
                                      (Stage: WON)
                                           │
                                           ▼
                              [Legal Review Contract Queue]
```

---

## Backend Validation Audit

### 1. Customer & Tender Creation
- **SSOT Rule**: Marketing membuat Customer -> Tender wajib terhubung ke Customer -> Stage awal = `LEAD`.
- **Backend Check**:
  - `createCustomer` (`backend/src/modules/marketing/marketing.service.ts#L93`): Validasi nama customer, email, dan PIC marketing.
  - `createTender` (`marketing.service.ts#L165`): Memaksa `finalStage = TenderStage.LEAD` dan memvalidasi `customerId` via `customerRepo.findOne()`.
  - **Verdict**: **COMPLIANT 🟢**

### 2. Go / No-Go Decision Gate
- **SSOT Rule**: LEAD → WAITING_GO_NO_GO → Review Director (NO GO -> LEAD / GO -> QUALIFICATION).
- **Backend Check**:
  - `submitGoNoGoReview` (`marketing.service.ts#L684`): Mengharuskan stage saat ini = `LEAD`. Memindahkan stage ke `WAITING_GO_NO_GO` dan `go_nogo_status = PENDING`.
  - `submitGoNoGo` (`marketing.service.ts#L795`): Memerlukan role `DIRECTOR`/`GENERAL_MANAGER`/`SUPER_ADMIN`.
    - Decision `GO` → stage = `QUALIFICATION`, `go_nogo_status = GO`.
    - Decision `NO_GO` → stage = `LEAD`, `go_nogo_status = NO_GO`, `revision_status = REQUIRED`.
  - Hard Gate Validation (`marketing.service.ts#L450 & L497`): Memblokir pergerakan stage melampaui `LEAD`/`WAITING_GO_NO_GO` jika `go_nogo_status !== 'GO'`.
  - **Verdict**: **COMPLIANT 🟢**

### 3. Qualification → Proposal Stage Transition
- **SSOT Rule**: Wajib upload Proposal sebelum stage berpindah ke `PROPOSAL`. Jika belum ada, perpindahan harus ditolak.
- **Backend Check**:
  - Endpoint `uploadProposal` (`marketing.service.ts#L916`): Menyimpan file proposal ke disk, mencatat `Document`, dan memperbarui stage ke `PROPOSAL`.
  - **MISSING CONTROL**: Pada endpoint `PATCH /marketing/tenders/:id` (`updateTender` - `L447`) dan `PATCH /marketing/tenders/:id/status` (`updateTenderStatusTransactionally` - `L497`), pengguna dapat mengirim payload `{ stage: 'PROPOSAL' }` **tanpa mengunggah file proposal terlebih dahulu**. Backend tidak memeriksa keberadaan record `Document` berjenis `PROPOSAL`.
  - **Verdict**: **NON-COMPLIANT 🔴 (API Bypass Possible)**

### 4. Proposal → Negotiation Stage Transition
- **SSOT Rule**: Marketing wajib mengisi info perubahan harga, detail perubahan harga, dan keterangan hasil negosiasi sebelum pindah ke `NEGOTIATION`.
- **Backend Check**:
  - Endpoint `negotiatePrice` (`marketing.service.ts#L979`): Mencatat riwayat harga di `price_history` dan catatan negosiasi.
  - **MISSING CONTROL**: Backend endpoint `updateTender` atau `updateTenderStatusTransactionally` mengizinkan pergerakan stage langsung ke `NEGOTIATION` tanpa memeriksa apakah ada record di `tender_price_history` atau catatan negosiasi.
  - **Verdict**: **NON-COMPLIANT 🔴 (API Bypass Possible)**

### 5. Negotiation → WON Stage Transition
- **SSOT Rule**: Marketing wajib upload SPK. Jika SPK belum ada, WON harus ditolak.
- **Backend Check**:
  - Endpoint `uploadSpk` / `saveSPKAndUpdateContract` (`marketing.service.ts#L1249`): Menyimpan file SPK dan memperbarui status kontrak.
  - Endpoint `setGracePeriod` (`marketing.service.ts#L1165`): Mengaktifkan grace period 2x24 jam untuk pengunggahan SPK.
  - **MISSING CONTROL**: Endpoint `PATCH /marketing/tenders/:id/status` (`updateTenderStatusTransactionally` - `L501`) mengizinkan pengubahan `stage = WON` dan `status = WON` **tanpa memeriksa apakah `spk_file_key`/`spk_file_url` terisi atau grace period aktif**.
  - **Verdict**: **NON-COMPLIANT 🔴 (API Bypass Possible)**

### 6. Legal Review Queue
- **SSOT Rule**: Ketika Tender menjadi WON, SPK otomatis masuk ke antrian Legal Review.
- **Backend Check**:
  - Endpoint `saveSPKAndUpdateContract` (`marketing.service.ts#L1306`): Mengeset `status = 'PENDING_LEGAL_REVIEW'`, `legal_status = 'DRAFT'`.
  - Event `marketing.tender.won` dan `emitLegalQueueUpdated` menyiarkan pembaruan antrian Legal via WebSockets ke antrian review Legal.
  - **Verdict**: **COMPLIANT 🟢**

---

## Frontend Validation Audit

### 1. Kanban Drag & Drop Constraints (`frontend/src/components/KanbanBoard.tsx`)
- **LEAD & WAITING_GO_NO_GO Gate** (`L544`): Memblokir drag ke stage selanjutnya jika `go_nogo_status !== 'GO'`. (**Valid 🟢**)
- **PROPOSAL Target Intercept** (`L549`): Mencegat drag ke `PROPOSAL` dan membuka `Upload Proposal Modal` (`L581`). Mengharuskan file dipilih sebelum submit API `uploadProposal`. (**Valid 🟢**)
- **NEGOTIATION Target Intercept** (`L557`): Mencegat drag ke `NEGOTIATION` dan membuka `Negotiation Modal` (`L615`). Mengharuskan catatan negosiasi minimal 10 karakter. (**Valid 🟢**)
- **WON Target Intercept** (`L563`): Mencegat drag ke `WON` dan membuka `WON Modal` (`L661`). Mengharuskan upload file SPK atau memilih tombol Grace Period 2x24 jam. (**Valid 🟢**)

### 2. Visual Feedback & Lockdown
- **WON / LOST Card Locking**: Kartu dengan status `WON` atau `LOST` dikunci dari modifikasi biasa dan menampilkan badge alert khusus. (**Valid 🟢**)

---

## Missing Controls

| ID | Module / Endpoint | Missing Control Description | Impact |
|----|-------------------|-----------------------------|--------|
| **MC-001** | Backend `updateTender` & `updateTenderStatusTransactionally` | Ketiadaan pengecekan file Proposal saat memindahkan stage ke `PROPOSAL`. | User dapat melewati kewajiban upload proposal via HTTP Client/Postman. |
| **MC-002** | Backend `updateTender` & `updateTenderStatusTransactionally` | Ketiadaan pengecekan catatan negosiasi/riwayat harga saat memindahkan stage ke `NEGOTIATION`. | Stage dapat diubah ke `NEGOTIATION` tanpa mencatat detail negosiasi. |
| **MC-003** | Backend `updateTenderStatusTransactionally` | Ketiadaan pengecekan keberadaan `spk_file_key` atau `grace_deadline` aktif saat memindahkan stage ke `WON`. | Status tender dapat diubah menjadi `WON` tanpa dokumen SPK resmi atau grace period. |
| **MC-004** | PMO, Procurement & Project Closeout | **NOT FOUND IN CODEBASE**: Ketiadaan otomatisasi pembentukan Project PMO atau sinkronisasi Procurement setelah Legal Review diapprove. | Alur terputus setelah Legal Approval dan memerlukan intervensi manual. |

---

## Broken Flow Findings

### Finding BF-001 (P1 - Critical): Direct API Stage Transition Bypass
- **Severity**: P1 (Critical)
- **Location**: `backend/src/modules/marketing/marketing.service.ts#L447 & L497`
- **Description**:
  Validasi prasyarat stage (Proposal File, Negotiation Detail, SPK File) seluruhnya diterapkan di layer UI Frontend (`KanbanBoard.tsx`). Backend endpoint `PATCH /marketing/tenders/:id/status` hanya memvalidasi `go_nogo_status === 'GO'`.
- **Business Impact**:
  Seorang pengguna dapat membypass alur operasional resmi dengan menembak API secara langsung untuk mengubah status tender menjadi `WON` tanpa mengunggah dokumen SPK atau proposal.
- **Reproduction**:
  1. Buat tender dan dapatkan persetujuan `GO` dari Director.
  2. Panggil HTTP request: `PATCH /marketing/tenders/123/status` dengan payload `{"stage": "WON"}`.
  3. Response mengembalikan `200 OK` dan tender berubah menjadi `WON` tanpa file SPK.

---

## Data Integrity Findings

### Finding DI-001 (P2 - High): Potential Duplicate Contract on Rapid Status Change
- **Severity**: P2 (High)
- **Location**: `backend/src/modules/marketing/marketing.service.ts#L516-L524`
- **Description**:
  Pemasukan record `Proposal` dan `Contract` saat tender berstatus `WON` tidak dilindungi oleh constraint `UNIQUE` pada `contracts(tender_id)` atau pessimistic DB lock.
- **Business Impact**:
  Panggilan API bersamaan (*concurrent request*) dapat menghasilkan dua record Kontrak untuk satu Tender ID yang sama.

---

## Audit Trail Findings

### Finding AT-001 (P3 - Medium): Activity Log Content Inconsistency
- **Severity**: P3 (Medium)
- **Location**: `backend/src/modules/marketing/marketing.service.ts#L608-L615`
- **Description**:
  Aktivitas perubahan stage dicatat di `tender_activities`, namun informasi mendalam seperti link dokumen proposal yang diunggah atau detail persentase diskon negosiasi tidak selalu terekam di audit trail log secara terstruktur.

---

## Risk Matrix

| ID | Severity | Area | Finding | Impact |
|----|----------|------|---------|--------|
| **BF-001** | **P1 (Critical)** | Backend Validation | Bypass validasi Proposal, Negosiasi & SPK via Direct API | Penetapan status WON tanpa dokumen hukum resmi |
| **DI-001** | **P2 (High)** | Data Integrity | Duplikasi Record Contract saat mutasi WON bersamaan | Data ganda di antrian Legal Review |
| **MC-004** | **P2 (High)** | Workflow Integration | PMO & Procurement Integration **NOT FOUND IN CODEBASE** | Alur bisnis terhenti setelah Legal Approval |
| **AT-001** | **P3 (Medium)** | Audit Trail | Detail pendukung pada activity log tidak lengkap | Kesulitan penelusuran riwayat audit |

---

## Recommended Fix Priority

### Priority 1 (P1 - Critical)
1. **Hardening Backend Stage Transition Validation**:
   - Tambahkan check `Document` record berjenis `PROPOSAL` sebelum mengizinkan pergerakan stage ke `PROPOSAL` di `marketing.service.ts`.
   - Tambahkan check `tender_price_history` atau `notes` negosiasi sebelum mengizinkan pergerakan stage ke `NEGOTIATION`.
   - Tambahkan check `spk_file_key !== null` atau `grace_deadline > NOW()` sebelum mengizinkan pergerakan status ke `WON`.

### Priority 2 (P2 - High)
1. **Idempotensi Pengubahan Status WON**:
   - Tambahkan database unique index `contracts(tender_id)` atau bungkus pembuatan kontrak dalam transaksi ber-lock (*pessimistic lock*) untuk mencegah duplikasi.
2. **Pengembangan Integrasi PMO & Procurement** (jika dipersyaratkan di masa mendatang):
   - Sambungkan event `contract.approved` dari modul Legal untuk membuat record `Project` secara otomatis.

### Priority 3 (P3 - Medium)
1. **Penyempurnaan Audit Trail Activity Log**:
   - Catat metadata lengkap (file URL, persentase diskon, nama uploader) ke dalam `tender_activities` setiap kali stage berubah.

---

**AUDIT SELESAI.** Laporan ini disusun secara empiris berdasarkan pengujian terhadap kode aktual backend & frontend EPMS.
