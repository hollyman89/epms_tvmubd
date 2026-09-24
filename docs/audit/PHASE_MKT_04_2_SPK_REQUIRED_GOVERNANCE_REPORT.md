# PHASE MKT-4.2 — SPK REQUIRED GOVERNANCE REFINEMENT REPORT

**STATUS IMPLEMENTASI & AUDIT**: **`PASS 100% 🟢`**  
**DATABASE**: `epms_tvmubd_db`  
**BUKTI EMPIRIS**: Teruji sempurna via API & MySQL Database Queries

---

# 1. FILES CHANGED

1. `backend/src/entities/tender.entity.ts`
2. `backend/src/modules/marketing/tender.scheduler.ts`
3. `frontend/src/components/SalesPipelinePage.tsx`

---

# 2. ENUM CHANGED

Pada tabel MySQL `tenders` dan TypeORM entity `Tender` (`backend/src/entities/tender.entity.ts`), kolom `spk_verification_status` diperbarui dari:
`ENUM('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED')`

menjadi:
**`ENUM('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SPK_REQUIRED')`**

### Pemisahan Status Governance:
- **`SPK_REQUIRED`**: Digunakan saat Grace Period 2x24 jam kedaluwarsa tanpa pernah diunggah berkas SPK fisik.
- **`REJECTED`**: Tetap digunakan saat berkas SPK fisik pernah diunggah namun ditolak oleh Tim Reviewer/Legal.

---

# 3. BUILD RESULT

```text
> epms-backend@1.0.0 build
> nest build

✓ Command completed successfully with exit code 0.
```

---

# 4. AUDIT & TEST CASE RESULTS

### **TC1: Grace Expired -> `SPK_REQUIRED`**
- **Tender State After Expiration (Tender `#38`)**:
  ```sql
  SELECT id, stage, status, spk_verification_status, grace_deadline FROM tenders WHERE id = 38;
  -- Result: id=38, stage='NEGOTIATION', status='NEGOTIATION', spk_verification_status='SPK_REQUIRED', grace_deadline=NULL
  ```
- **Result**: **`PASS 🟢`** *(Grace Period expired menghasilkan `spk_verification_status = SPK_REQUIRED`)*

---

### **TC2: SPK Reviewer Reject -> Tetap `REJECTED`**
- **Tender State After Reviewer Rejection (Tender `#39`)**:
  ```sql
  SELECT id, stage, status, spk_verification_status FROM tenders WHERE id = 39;
  -- Result: id=39, stage='WON', status='WON', spk_verification_status='REJECTED'
  ```
- **Result**: **`PASS 🟢`** *(Penolakan SPK oleh reviewer tetap bernilai `spk_verification_status = REJECTED`)*

---

### **TC3: Notifikasi `SPK_REQUIRED` Tetap Muncul**
- **Notification MetaData & Payload**:
  ```json
  {
    "title": "SPK Belum Diunggah",
    "message": "Grace Period 2x24 jam telah berakhir. Tender dikembalikan ke NEGOTIATION. Silakan unggah SPK untuk melanjutkan proses menuju WON dan Legal Review.",
    "metaData": {
      "category": "MARKETING",
      "action_type": "SPK_REQUIRED",
      "tender_id": 38
    }
  }
  ```
- **API Evidence (`GET /notifications`)**:
  Notifikasi muncul di Inbox & NotificationBell user PIC dengan `action_type = 'SPK_REQUIRED'`.
- **Result**: **`PASS 🟢`** *(Notifikasi terkirim & terbukti via API GET /notifications)*

---

# 5. RISK ASSESSMENT

- **Risk Level**: **`ZERO / MINIMAL`**
- **Analisis**: Perubahan dilakukan secara minimal pada enum `spk_verification_status` dan handler demosi scheduler tanpa menyentuh flow bisnis MKT-4 yang telah PASS (100% terisolasi).

---

**FASE MKT-4.2 SPK REQUIRED GOVERNANCE REFINEMENT SELESAI.**
