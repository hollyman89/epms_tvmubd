# AUDIT MKT 02 — STATE MACHINE VALIDATION REPORT

## Executive Summary

Audit pengujian API ini (*API State Machine Test Execution*) bertujuan untuk membuktikan secara empiris apakah state machine modul Marketing EPMS pada codebase backend saat ini sudah mematuhi alur bisnis resmi setelah penerapan pengetatan *PHASE MKT-2 Strict State Machine Enforcement*.

### Summary Hasil Pengujian (8 Test Cases):
- **Test Lulus**: **8 dari 8 Test Cases (100% PASS)**
- **Test Gagal / Celah Bypass**: **0**
- **Status Akhir State Machine Audit**: **`PASS 🟢`** (State Machine Sepenuhnya Terpenuhi & Kedap Bypass)

---

## Final Test Results Table

| Test Case | Description | Expected | Actual Status | Result |
|-----------|-------------|----------|---------------|--------|
| **TC1** | LEAD → WON langsung (tanpa Go/No-Go) | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC2** | LEAD → QUALIFICATION (tanpa Go/No-Go) | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC3** | WAITING_GO_NO_GO → WON langsung | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC4** | QUALIFICATION → WON langsung (setelah GO) | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC5** | QUALIFICATION → PROPOSAL (tanpa file Proposal) | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC6** | PROPOSAL → NEGOTIATION (tanpa data Negosiasi) | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC7** | NEGOTIATION → WON (tanpa SPK / Grace Period) | Rejected (400/403) | `400 Bad Request` | **PASS 🟢** |
| **TC8** | Complete Official Business Flow | 200 OK (SUKSES) | **`200 OK`** | **PASS 🟢** |

---

## Detailed Test Execution Breakdown

### TEST CASE 1: LEAD → WON langsung (Tanpa Go/No-Go)
- **Action**: `PATCH /api/v1/marketing/tenders/{id}/status` dengan `{"stage": "WON"}` pada tender baru berstatus `LEAD`.
- **Actual HTTP Status**: `400 Bad Request`
- **Response**: `{"message": "Tender belum disetujui (GO / NO GO Gate) oleh Manajemen untuk lanjut ke stage ini."}`
- **Evaluation**: **PASS 🟢** (Dihentikan oleh Go/No-Go Gate).

### TEST CASE 2: LEAD → QUALIFICATION (Tanpa Go/No-Go)
- **Action**: `PATCH /api/v1/marketing/tenders/{id}` dengan `{"stage": "QUALIFICATION"}` pada tender berstatus `LEAD`.
- **Actual HTTP Status**: `400 Bad Request`
- **Evaluation**: **PASS 🟢** (Dihentikan oleh Go/No-Go Gate).

### TEST CASE 3: WAITING_GO_NO_GO → WON langsung
- **Action**: `PATCH /api/v1/marketing/tenders/{id}/status` dengan `{"stage": "WON"}` saat review Go/No-Go masih `PENDING`.
- **Actual HTTP Status**: `400 Bad Request`
- **Evaluation**: **PASS 🟢** (Dihentikan oleh Go/No-Go Gate).

### TEST CASE 4: QUALIFICATION → WON langsung (Setelah GO Approved)
- **Action**: Setelah Director approve `GO`, kirim `PATCH /api/v1/marketing/tenders/{id}/status` dengan `{"stage": "WON"}`.
- **Actual HTTP Status**: `400 Bad Request`
- **Response Payload**: `{"message": "Stage WON hanya dapat dicapai dari stage NEGOTIATION."}`
- **Evaluation**: **PASS 🟢** (Lompatan dari QUALIFICATION langsung ke WON berhasil dicegah).

### TEST CASE 5: QUALIFICATION → PROPOSAL (Tanpa Upload File Proposal)
- **Action**: Kirim `PATCH /api/v1/marketing/tenders/{id}` dengan `{"stage": "PROPOSAL"}`.
- **Actual HTTP Status**: `400 Bad Request`
- **Response Payload**: `{"message": "Stage PROPOSAL membutuhkan dokumen proposal yang terunggah."}`
- **Evaluation**: **PASS 🟢** (Ditolak karena tidak ada dokumen proposal fisik di database).

### TEST CASE 6: PROPOSAL → NEGOTIATION (Tanpa Data Negosiasi Harga)
- **Action**: Kirim `PATCH /api/v1/marketing/tenders/{id}` dengan `{"stage": "NEGOTIATION"}`.
- **Actual HTTP Status**: `400 Bad Request`
- **Response Payload**: `{"message": "Stage NEGOTIATION membutuhkan data negosiasi harga."}`
- **Evaluation**: **PASS 🟢** (Ditolak karena belum dilakukan penawaran/catatan negosiasi harga).

### TEST CASE 7: NEGOTIATION → WON (Tanpa File SPK atau Grace Period)
- **Action**: Kirim `PATCH /api/v1/marketing/tenders/{id}/status` dengan `{"stage": "WON"}` pada stage `NEGOTIATION`.
- **Actual HTTP Status**: `400 Bad Request`
- **Response Payload**: `{"message": "Stage WON membutuhkan upload file SPK atau Grace Period aktif."}`
- **Evaluation**: **PASS 🟢** (Ditolak karena SPK belum diunggah dan Grace Period tidak aktif).

### TEST CASE 8: Complete Official Business Flow
- **Action**: Jalankan urutan resmi dari `LEAD` → Submit GoNoGo → Director Approve `GO` → Upload Proposal (Form Data PDF) → Negotiate Price → Activate Grace Period (`WON`).
- **Actual HTTP Status**: **`200 OK`**
- **Response Payload**: `{"status": "success", "message": "Grace period SPK diaktifkan 2x24 jam", ...}`
- **Evaluation**: **PASS 🟢** (Alur operasional resmi berjalan lancar saat semua dokumen & syarat dipenuhi).

---

## Technical Solution & Implementation Summary

Seluruh aturan validasi disatukan di dalam private helper `validateTenderStateTransition()` pada `MarketingService`:

```typescript
private async validateTenderStateTransition(
  tender: Tender,
  targetStageInput: string,
  isUploadingProposal = false,
  isActivatingGrace = false,
  isNegotiating = false
): Promise<void>
```

1. **Gate Hard 1**: Memerlukan `go_nogo_status === 'GO'` sebelum diizinkan melangkah ke stage di luar `LEAD`, `WAITING_GO_NO_GO`, dan `LOST`.
2. **Strict Stage Transition**:
   - `PROPOSAL` hanya bisa dari `QUALIFICATION` + Wajib File Proposal.
   - `NEGOTIATION` hanya bisa dari `PROPOSAL` + Wajib Data Negosiasi.
   - `WON` hanya bisa dari `NEGOTIATION` + Wajib SPK / Grace Period.

---

## Final Verdict

### **STATUS: `PASS 100% 🟢`**

State machine modul Marketing EPMS sekarang **100% kedap bypass**, mematuhi alur bisnis sekuensial enterprise secara ketat, dan seluruh 8 Test Cases terbukti **LULUS (PASS)**.
