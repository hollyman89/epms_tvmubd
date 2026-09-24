# PHASE MKT-4.3 FINAL ACCEPTANCE AUDIT REPORT

**MODE**: READ ONLY FORENSIC VERIFICATION  
**DATABASE**: `epms_tvmubd_db`  
**TEST SUBJECT**: Tender ID `#40` (Fresh Test Tender) & Database Ecosystem  
**RULES**: 0 Code Changes | 0 Schema Changes | 0 Data Cleanup | Pure Empirical Audit

---

# Executive Summary

Audit **PHASE MKT-4.3 FINAL ACCEPTANCE AUDIT** bertujuan memverifikasi kesiapan tata kelola bisnis Marketing $\rightarrow$ Legal $\rightarrow$ PMO secara end-to-end sebelum database dibersihkan (*database cleanup*).

$$\text{NEGOTIATION} \xrightarrow{\text{Grace 48h}} \text{WON + Grace} \xrightarrow{\text{Demotion}} \text{NEGOTIATION (SPK\_REQUIRED)} \xrightarrow{\text{Bypass Try (HTTP 400)}} \xrightarrow{\text{Upload SPK}} \text{WON} \rightarrow \text{Legal Queue} \rightarrow \text{PMO}$$

---

# AUDIT MATRIX & TEST SCENARIOS (A THROUGH G)

| Scenario | Objective | Empirical Proof / Result | Status |
|----------|-----------|--------------------------|--------|
| **Scenario A** | Grace Expired | Tender `#40` revert ke `stage=NEGOTIATION`, `status=NEGOTIATION`, `spk_verification_status=SPK_REQUIRED`, `grace_deadline=NULL`, `contract count=0`, `legal queue count=0`, `notif count=7` | **PASS 🟢** |
| **Scenario B** | Recovery (Upload SPK) | Upload SPK pada Tender `#40` menghasilkan `stage=WON`, `status=WON`, `spk_file_key != NULL`, `contract count=1`, `legal_status=DRAFT`, `status=PENDING_LEGAL_REVIEW`, `legal queue count=1` | **PASS 🟢** |
| **Scenario C** | Duplicate Protection | Re-upload SPK kedua kali pada Tender `#40` mempertahankan `contract count = 1` | **PASS 🟢** |
| **Scenario D** | Bypass Protection | Direct `PATCH /status` stage `WON` dari `NEGOTIATION` ditolak dengan **`HTTP 400 Bad Request`** dan DB tidak berubah | **PASS 🟢** |
| **Scenario E** | Notification Governance | Notifikasi `title = SPK Belum Diunggah` & `action_type = SPK_REQUIRED` terverifikasi di DB & API `GET /notifications` | **PASS 🟢** |
| **Scenario F** | Legal Protection | Pengujian menemukan **1 Kontrak Legacy (Contract ID `#2` / Tender `#28`)** buatan pra-MKT4 tanpa SPK (`spk_file_url IS NULL`) masih aktif di Legal Queue | **FAIL 🔴** |
| **Scenario G** | PMO Protection | API `GET /project/operational-board` 100% bersih dari tender/kontrak prematur (`legal_status != APPROVED`) | **PASS 🟢** |

---

# DETAILED SCENARIO EVIDENCE

## Scenario A — Grace Expired
- **Tender State After Expiration (Tender `#40`)**:
  ```sql
  SELECT id, stage, status, spk_verification_status, grace_deadline FROM tenders WHERE id = 40;
  -- Result: id=40, stage='NEGOTIATION', status='NEGOTIATION', spk_verification_status='SPK_REQUIRED', grace_deadline=NULL
  ```
- **Contracts Count**: `0 Rows`
- **Legal Queue Count**: `0 Kontrak`
- **Notification Count**: `7 Notifikasi` (`title = 'SPK Belum Diunggah'`)
- **Status**: **`PASS 🟢`**

## Scenario B — Recovery
- **Request**: `POST /api/v1/marketing/tenders/40/upload-spk`
- **Response**: `HTTP 201 Created`
- **Database & Queue State**:
  - `tenders`: `stage = 'WON'`, `status = 'WON'`, `spk_file_key = 'contracts/spk-40-...'`
  - `contracts`: `Contract #8` (`CONT-20260810-0008`), `status = 'PENDING_LEGAL_REVIEW'`, `legal_status = 'DRAFT'`, `spk_file_url != NULL`
  - `Legal Queue API`: `1 Kontrak` (`Contract #8`)
- **Status**: **`PASS 🟢`**

## Scenario C — Duplicate Protection
- **Request**: `POST /api/v1/marketing/tenders/40/upload-spk` (Second Upload)
- **Contract Count**: `SELECT COUNT(*) FROM contracts WHERE tender_id = 40` $\rightarrow$ **`1 Row`**
- **Status**: **`PASS 🟢`**

## Scenario D — Bypass Protection
- **Request**: `PATCH /api/v1/marketing/tenders/40/status` (`{"stage": "WON"}`)
- **Response**: **`HTTP 400 Bad Request`** (`{"message": "Stage WON membutuhkan upload file SPK atau Grace Period aktif."}`)
- **Status**: **`PASS 🟢`**

## Scenario E — Notification Governance
- **API `GET /notifications` Response**:
  ```json
  {
    "id": 971,
    "title": "SPK Belum Diunggah",
    "message": "Grace Period 2x24 jam telah berakhir. Tender dikembalikan ke NEGOTIATION...",
    "metaData": { "action_type": "SPK_REQUIRED", "tender_id": 40 }
  }
  ```
- **Status**: **`PASS 🟢`**

## Scenario F — Legal Protection
- **Query Contract Tanpa SPK di DB**:
  ```sql
  SELECT id, tender_id, contract_number, status, legal_status, spk_file_url, deleted_at 
  FROM contracts 
  WHERE (spk_file_url IS NULL OR spk_file_url = '');
  ```
- **Empirical Output**:
  ```json
  [
    {
      "id": 2,
      "tender_id": 28,
      "contract_number": "CONT-20260810-5081",
      "status": "PENDING_LEGAL_REVIEW",
      "legal_status": "DRAFT",
      "spk_file_url": null,
      "deleted_at": null
    }
  ]
  ```
- **Temuan**: Contract `#2` dibuat untuk Tender `#28` pada uji coba Grace Period pra-MKT4 (sebelum logika MKT-4 diimplementasikan). Karena belum di-soft-delete, kontrak legacy ini masih muncul di `GET /legal/contracts/pending`.
- **Status**: **`FAIL 🔴`**

## Scenario G — PMO Protection
- **API `GET /project/operational-board` Response**:
  Tender `#40` dan `#28` yang belum ber-status `legal_status = APPROVED` **TIDAK MUNCUL** di Operational Board PMO.
- **Status**: **`PASS 🟢`**

---

# FINAL GOVERNANCE QUESTIONS & ANSWERS

1. **Apakah Marketing wajib upload SPK sebelum masuk Legal?**  
   👉 **YA ✅** (*Tender baru di Grace Period tidak membuat kontrak, dan direct status bypass ditolak HTTP 400. Kontrak baru dibuat dan masuk Legal Queue saat SPK di-upload*).

2. **Apakah Legal Queue bersih dari contract tanpa SPK?**  
   👉 **TIDAK ❌** (*Masih ditemukan 1 kontrak legacy tanpa SPK, yaitu Contract ID `#2` / Tender `#28` buatan pra-MKT4 yang belum di-soft-delete*).

3. **Apakah scheduler mengembalikan tender ke NEGOTIATION?**  
   👉 **YA ✅** (*Saat Grace Period 48h expired, scheduler mengembalikan `stage` dan `status` ke `NEGOTIATION`*).

4. **Apakah status SPK_REQUIRED muncul dengan benar?**  
   👉 **YA ✅** (*Demotion scheduler memperbarui `spk_verification_status = 'SPK_REQUIRED'`*).

5. **Apakah duplicate contract berhasil dicegah?**  
   👉 **YA ✅** (*Upload SPK kedua kali mempertahankan `contract count = 1`*).

6. **Apakah PMO terlindungi dari data prematur?**  
   👉 **YA ✅** (*`GET /project/operational-board` 100% bersih dari tender/kontrak yang belum APPROVED*).

7. **Apakah flow siap digunakan pada production?**  
   👉 **BELUM ❌** (*Diperlukan pembersihan/soft-delete terhadap Contract ID `#2` legacy agar antrian Legal Queue 100% bersih dari data pra-MKT4*).

---

# FINAL VERDICT

## **`FINAL VERDICT: NOT READY FOR DATABASE CLEANUP`**

*(Alasan: Ditemukan 1 Kontrak Legacy tanpa SPK yaitu Contract ID `#2` untuk Tender `#28` yang dibuat pra-MKT4 masih aktif di `contracts` table & `GET /legal/contracts/pending`. Diperlukan pembersihan/soft-delete terhadap Contract ID `#2` terlebih dahulu).*
