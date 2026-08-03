# 📄 EPMS - SIT READY & QA HANDOVER REPORT
**Tanggal:** 20 Juli 2026  
**Status Lingkungan:** Staging Ready (SIT Level)  
**Branch / Commit:** `develop` / `a1b2c3d`  

---

## 1. 🚀 Ringkasan Status Fitur (Completed Today)

| No | Modul / Fitur | Status SIT | Deskripsi Ringkas |
|---|---|---|---|
| 1 | **BullMQ & Redis Architecture** | ✅ Ready | Pengantrean job asinkron dengan Redis backend untuk Email & PDF Worker. |
| 2 | **Email Queue Processor** | ✅ Ready | `EmailProcessor` (`email-send` queue) dengan Nodemailer & Mailtrap mock. |
| 3 | **PDF Generator Worker** | ✅ Ready | `PdfProcessor` (`pdf-generation` queue) rendering PDFKit & upload otomatis ke AWS S3. |
| 4 | **Non-blocking PDF Endpoints** | ✅ Ready | `GET /contracts/:id/pdf` mengembalikan `{ jobId, status: 'processing' }` dalam **< 50ms**. |
| 5 | **PDF Job Status Endpoint** | ✅ Ready | `GET /contracts/pdf-status/:jobId` untuk polling status rendering & URL S3. |
| 6 | **Split-Screen Legal Review UI** | ✅ Ready | Halaman `/legal/review` (Ant Design 2-Column Grid) + `LegalReviewForm` (Polling + 4 Checklist Kepatuhan). |
| 7 | **Logging & Monitoring Staging** | ✅ Ready | File log Winston JSON di `backend/logs/nest.log` + script alert `backend/monitor.sh`. |
| 8 | **Script Relocation & Cleanup** | ✅ Ready | Skrip migrasi terpusat di `backend/src/database/scripts/`. 100% *clean build* TypeScript. |
| 9 | **Queue Concurrency & Load Safety** | ✅ Ready | Concurrency limit: 10 (Email) & 5 (PDF) + Proteksi fallback jika Redis luring. |

---

## 2. 🔌 Daftar Endpoint Baru & Dokumentasi API (Swagger)

Seluruh endpoint telah ter-register di Swagger API Docs:  
📌 **URL Swagger UI:** `http://localhost:4000/api/docs`

### A. Endpoint Asinkron Kontrak & PDF (BullMQ)
* **`GET /api/v1/contracts/:id/pdf`**
  * **Fungsi:** Memicu *job* pembuataan PDF kontrak secara asinkron ke antrean BullMQ.
  * **Response (< 50ms):** `{ "jobId": "123", "status": "processing" }`
* **`GET /api/v1/contracts/pdf-status/:jobId`**
  * **Fungsi:** Memeriksa status rendering PDF dan mengambil S3 URL.
  * **Response:** `{ "jobId": "123", "status": "completed", "result": { "url": "https://s3..." } }`

### B. Endpoint Legal Review
* **`POST /api/v1/legal/review`** (atau `POST /api/v1/legal/contracts/review`)
  * **Fungsi:** Mengirimkan hasil pemeriksaan kepatuhan hukum kontrak.
  * **Payload Body:**
    ```json
    {
      "contractId": 1,
      "legalStatus": "APPROVED", // 'APPROVED' | 'REJECTED'
      "legalNotes": "Semua klausul nominal dan SLA telah sesuai."
    }
    ```

---

## 3. 🧪 Petunjuk Pengujian E2E & Postman Collection

File Postman Collection `epms_e2e_collection.json` dan Environment `.postman_environment.json` telah diperbarui dengan validasi *Clean Architecture DTO*.

### Urutan Eksekusi Alur P2P (Procurement-to-Payment):
1. **`POST /api/v1/auth/login`**
   - Mendapatkan `access_token` JWT. Script otomatis menyimpan token ke `{{token}}`.
2. **`POST /api/v1/procurement/pr`**
   - Membuat Purchase Request (Wajib mengirim `totalEstimatedAmount` dan array `items`).
3. **`POST /api/v1/procurement/vendor-comparison`**
   - Mengirim perbandingan vendor (Wajib memasukkan array `vendors` berisi `vendorId`, `offeredAmount`, `isWinner`).
4. **`POST /api/v1/procurement/purchase-orders`**
   - Menerbitkan PO (Wajib mengirim `purchase_request_id`, `vendor_id`, dan array `po_items`).
5. **`POST /api/v1/procurement/goods-receipts`**
   - Penerimaan barang GR (Mengirim `purchaseOrderId`, `receiptDate`, dan `items`).
6. **`POST /api/v1/finance/invoices`**
   - Pencatatan Invoice Finance (Mengirim `purchaseOrderId`, `invoiceDate`, dan `items`).
7. **`POST /api/v1/finance/payments`**
   - Pemrosesan Pembayaran (Mengirim `invoiceId`, `paymentAmount`, `paymentMethod`, `referenceNumber`).

> ⚠️ **Catatan Penting untuk QA:** Alur State Machine mewajibkan PR dan Kontrak berstatus *Approved* sebelum dapat dilanjutkan ke tahap PO/Payment. Pastikan mengekstrak ID dinamis dari respon sebelumnya.

---

## 4. ⚙️ Catatan Konfigurasi Environment Variables (`.env`)

Untuk mendeploy ke staging penuh, pastikan variabel berikut terkonfigurasi di `backend/.env`:

```env
# Server & Database
PORT=4000
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=epms_tvmubd_db

# Redis & BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS S3 Integration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=epms-staging-bucket

# SMTP Mailer
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

---

## 5. 🛠 Standby Log Monitoring
Untuk memantau log sistem secara *real-time* saat pengujian QA:
```bash
cd backend
bash monitor.sh
```
Script akan menyaring log dari `backend/logs/nest.log` dan memberikan notifikasi terisolasi jika terjadi galat (ERROR).

---
**Disiapkan oleh:** Enterprise Solution Architect & Senior Software Delivery Manager  
**Ditinjau oleh:** QA Governance Lead
