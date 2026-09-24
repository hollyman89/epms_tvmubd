# Product Requirement Document (PRD)
## EPMS - Enterprise Project Management System

---

# 1. Product Overview

- **Nama Produk**: EPMS (Enterprise Project Management System - TVMUBD)
- **Tujuan Utama**: Menyediakan platform terintegrasi (*Single Source of Truth*) yang mengawal siklus hidup proyek enterprise secara end-to-end mulai dari akuisisi tender (Marketing), penelaahan dan verifikasi persetujuan legalitas kontrak (Legal), inisiasi dan pelaksanaan operasional proyek (PMO/Project Manager), pengadaan material (Procurement), hingga penagihan dan pencatatan pembayaran (Finance).
- **Masalah Bisnis yang Diselesaikan**:
  1. *Kebocoran Margin Diskon*: Pengajuan diskon harga tender tanpa kontrol persetujuan bertingkat dari Direksi.
  2. *Keterlambatan Handover*: Terhambatnya transisi proyek dari fase Legal ke PMO akibat lemahnya sinkronisasi event antar departemen.
  3. *Siloisasi & Stale Data*: Ketidakcocokan data status proyek antar unit kerja yang sering terjadi akibat pembaharuan manual tanpa event realtime.
  4. *Over-Budget Pengadaan*: Potensi pembengkakan pengeluaran yang tidak terkontrol saat penerbitan Purchase Request (PR) dan Purchase Order (PO).
  5. *Jejak Audit Lemah*: Kesulitan dalam melacak riwayat persetujuan, amandemen kontrak, dan aktivitas sensitif.
- **Target Pengguna**:
  - Executive / Direksi (Director)
  - Tim Marketing & Sales
  - Tim Legal & Compliance
  - PMO & Project Manager (PM)
  - Tim Procurement & Finance
  - System Administrator (Super Admin)

---

# 2. Business Context

Siklus hidup bisnis utama EPMS berjalan melalui alur terstruktur berikut:

```
Marketing (Create Tender)
  ↓
Tender Creation (Stage: LEAD)
  ↓
Go / No-Go Approval (Director Review: WAITING_GO_NO_GO -> QUALIFICATION)
  ↓
Proposal Submission (Stage: PROPOSAL)
  ↓
Negotiation (Stage: NEGOTIATION)
  ↓
SPK Upload (Stage: WON & Contract Initialized)
  ↓
Contract Creation (Status: PENDING_LEGAL_REVIEW / DRAFT)
  ↓
Legal Review (Legal Reviewer Inspection)
  ↓
Legal Approval (legal_status: APPROVED, contract status: ACTIVE)
  ↓
PMO Project Kickoff (Antrean Inisiasi SPK -> Claim Charter)
  ↓
Project Execution (Status: IN_PROGRESS, WBS & Task Allocation)
  ↓
Monitoring (Progress Tracking & Expense Control)
```

---

# 3. User Roles

Dokumentasi peran dan hak akses pengguna dalam EPMS:

### 1. Marketing
- **Responsibility**: Mengidentifikasi prospek tender, mengelola data pelanggan (*Customers*), mengajukan penawaran, mengunggah dokumen proposal & SPK, serta menjaga komunikasi dengan klien.
- **Modul yang Digunakan**: Marketing Module (`/sales/*`), Customer Management (`/customers`).
- **Action Utama**: Create Tender, Submit Go/No-Go Review, Upload Proposal, Negotiate Price, Upload SPK (Promote to WON).

### 2. Director
- **Responsibility**: Mengambil keputusan strategis, memberikan persetujuan Go/No-Go Gate, mengevaluasi pengajuan diskon khusus, dan memantau kinerja operasional enterprise.
- **Modul yang Digunakan**: Marketing Module (Kanban Board & Review Drawer), Executive Dashboard (`/`), Governance (`/governance`).
- **Action Utama**: Approve/Reject Go/No-Go Gate, Approve Special Discount (>20%), Monitor High-Level Pipeline.

### 3. Legal
- **Responsibility**: Melakukan penelaahan draf kontrak, memverifikasi keabsahan dokumen SPK, menyetujui/menolak kontrak, dan mengelola amandemen hukum.
- **Modul yang Digunakan**: Legal Module (`/legal/*`), Document Repository (`/documents`).
- **Action Utama**: Review Contract (Approve / Reject / Revision), Verify SPK Document, Generate SHA-256 Digital Signature.

### 4. PMO / Project Manager
- **Responsibility**: Mengklaim proyek yang disetujui Legal, menginisiasi Project Charter, menyusun Structure Breakdown Work (WBS), serta mengawasi pelaksanaan operasional dan alokasi anggaran.
- **Modul yang Digunakan**: PMO / Project Delivery Module (`/project-delivery`, `/project/*`).
- **Action Utama**: Claim Charter (Initiate Kickoff), Setup WBS & Tasks, Assign Operational Team, Monitor Progress & Expense.

### 5. Admin (Super Admin)
- **Responsibility**: Pengelolaan akses pengguna, pengaturan role & permission, audit trail observability, dan pemeliharaan kesehatan sistem.
- **Modul yang Digunakan**: Admin User Management (`/admin/*`), Governance & Audit Logs, System Health.
- **Action Utama**: Manage Users/Roles, View Audit Logs, Monitor System Status.

---

# 4. Main Modules

## Marketing Module
- **Fungsi**:
  - *Create Tender*: Pendaftaran prospek proyek baru dengan validasi tenggat waktu dan alokasi customer.
  - *Tender Pipeline*: Visualisasi papan Kanban interaktif berbasis stage (`LEAD`, `WAITING_GO_NO_GO`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`).
  - *Go/No-Go Gate*: Penguncian transisi stage sebelum disetujui Manajemen/Direktur.
  - *Proposal Submission*: Unggah dan pengelolaan dokumen teknis/komersial penawaran.
  - *Negotiation*: Penyesuaian nilai harga penawaran dan riwayat diskon.
  - *SPK Upload*: Pengunggahan berkas SPK final yang secara otomatis menginisiasi draf `Contract` di tabel `contracts` dan mengubah stage tender menjadi `WON`.
  - *WON Transition*: Pemancaran event realtime `marketing.tender.won` dan `marketing.tender.management_update` (`action: MARKED_WON`).

## Legal Module
- **Fungsi**:
  - *Contract Review*: Antrean penelaahan kontrak yang baru masuk dari proses SPK Upload Marketing.
  - *Approve*: Mengubah `legal_status` kontrak menjadi `APPROVED` dan status kontrak menjadi `ACTIVE`, yang selanjutnya menyinkronkan status proposal/tender dan memicu pencatatan audit log & outbox event.
  - *Reject*: Mengembalikan atau menolak draf kontrak dengan catatan perbaikan.
  - *Revision*: Permintaan revisi klausul hukum yang memicu penyesuaian SLA grace period.

## PMO / Project Delivery Module
- **Fungsi**:
  - *Pending Kickoff*: Menampilkan daftar kontrak berstatus `legal_status = APPROVED` yang belum terdaftar di tabel `projects`.
  - *Project Claim Charter*: Aksi oleh PMO/PM untuk mengeksekusi kickoff, menentukan tanggal estimasi mulai/selesai, serta membuat record proyek aktif di tabel `projects`.
  - *Active Project Monitoring*: Pengawasan proyek yang sedang berjalan (`IN_PROGRESS`), persentase progress operasional, serta alokasi WBS.

## Notification / Realtime Module
- **Fungsi**:
  - *Socket.IO Usage*: Koneksi WebSocket terpisah pada namespace `/sales` (untuk pipeline Marketing/Director) dan namespace `/notifications` (untuk notifikasi umum & PMO handover).
  - *Event-driven Update*: Arsitektur berbasis event (EventEmitter2) yang secara otomatis menyiarkan perubahan state dari backend ke gateway Socket.IO.
  - *Realtime Synchronization*: Pembaruan otomatis UI frontend tanpa memerlukan refresh browser (F5) saat terjadi mutasi data antar departemen.

---

# 5. Core Business Rules

1. **Syarat Antrean PMO Pending Kickoff**:
   Sebuah kontrak **hanya** muncul pada daftar *PMO Pending Kickoff* apabila memenuhi 3 kriteria ketat:
   - `contracts.legal_status = 'APPROVED'`
   - `contracts.deleted_at IS NULL`
   - Nomor kontrak (`contract_number`) **belum terdaftar** di kolom `projects.code` pada tabel `projects`.

2. **Pemisahan Legal Approval dan Inisiasi Proyek**:
   Persetujuan Legal (`legal_status = APPROVED`) **tidak secara otomatis** membuat record proyek aktif di tabel `projects`. Kontrak yang disetujui akan masuk ke status `PENDING_KICKOFF` dan **harus** melalui proses *Claim Charter / Kickoff* oleh PMO/PM.

3. **Aturan Unggah SPK & Inisiasi Kontrak**:
   Proses pengunggahan SPK oleh Marketing (`POST /marketing/tenders/:id/upload-spk`):
   - Mengubah stage tender menjadi `WON` dan status tender menjadi `WON`.
   - Menginisiasi record `Contract` baru di tabel `contracts` dengan `status = PENDING_LEGAL_REVIEW` dan `legal_status = DRAFT`.
   - Memancarkan event realtime `marketing.tender.management_update` (`action: MARKED_WON`) ke namespace `/sales` serta event `legal.queue.updated` (`action: SPK_UPLOADED`).

4. **Transisi Stage Berbasis Gate (Go/No-Go)**:
   Tender pada stage `LEAD` tidak dapat langsung melompat ke `QUALIFICATION` atau `PROPOSAL` sebelum melalui persetujuan Direktur (`go_nogo_status = GO`).

5. **Post-Commit Event Emission**:
   Seluruh pemancaran event realtime backend dipastikan terjadi **setelah** (`POST-COMMIT`) transaksi basis data diselesaikan (`commitTransaction()` atau persistensi ORM selesai) untuk mencegah race condition data stale pada UI.

---

# 6. System Workflow Detail

| Step | Module | Action | Database Entity | Event / Payload |
|---|---|---|---|---|
| 1 | Marketing | Create Tender (`LEAD`) | `tenders` | `marketing.tender.management_update` (`CREATED`) |
| 2 | Marketing | Submit Go/No-Go Review | `tenders`, `tender_activities` | `marketing.tender.management_update` (`GO_NOGO_SUBMITTED`) |
| 3 | Director | Approve Go/No-Go Gate (`GO`) | `tenders`, `tender_activities` | `marketing.tender.management_update` (`GO_NOGO_APPROVED`) |
| 4 | Marketing | Upload Proposal Document | `documents`, `tenders`, `tender_activities` | `marketing.tender.management_update` (`PROPOSAL_UPLOADED`) |
| 5 | Marketing | Price Negotiation | `tenders`, `tender_price_history` | `marketing.tender.management_update` (`STAGE_CHANGED`) |
| 6 | Marketing | Upload SPK (Mark WON) | `contracts`, `proposals`, `tenders` | `marketing.tender.management_update` (`MARKED_WON`), `legal.queue.updated` (`SPK_UPLOADED`) |
| 7 | Legal | Review & Approve Contract | `contracts`, `proposals`, `tenders`, `audit_logs`, `outbox_events` | `legal.contract.approved`, `legal.queue.updated` (`CONTRACT_APPROVED`) |
| 8 | PMO | View Pending Kickoff Queue | `contracts` JOIN `proposals` JOIN `tenders` | REST API `GET /project/operational-board` |
| 9 | PMO | Claim Charter (Project Kickoff) | `projects` | REST API `PATCH /project/charters/:code/claim` |
| 10 | PMO | Execute & Monitor WBS/Tasks | `projects`, `work_breakdown_structures`, `tasks` | TBD (WBS Realtime Update Event) |

---

# 7. Database Domain Model

Model domain utama dalam basis data EPMS (`epms_tvmubd_db`):

- **`customers`**: Menyimpan data master pelanggan, PIC, email, dan nomor telepon.
- **`tenders`**: Menyimpan data prospek tender, nilai anggaran estimasi, stage pipeline, status Go/No-Go, dan tenggat waktu.
- **`proposals`**: Menyimpan data dokumen penawaran teknis/harga yang diajukan ke pelanggan.
- **`contracts`**: Menyimpan data legalitas draf/kontrak final, nomor kontrak (`contract_number`), `legal_status` (`DRAFT`, `ON_REVIEW`, `APPROVED`, `REJECTED`), URL SPK, dan nilai kontrak.
- **`projects`**: Menyimpan data proyek aktif (`IN_PROGRESS`, `COMPLETED`), kode proyek (`code`), dan manajer proyek.
- **`documents`**: Menyimpan metadata berkas yang diunggah (proposal, SPK, syarat lampiran).
- **`audit_logs`**: Catatan jejak audit imutabel untuk seluruh perubahan data sensitif.
- **`notifications`**: Menyimpan notifikasi in-app bagi pengguna berdasarkan role/user.
- **`outbox_events`**: Implementasi *Transactional Outbox Pattern* untuk publikasi event antarsistem yang andal.

### Relasi Entitas Utama:
```text
customers (1) ───< (N) tenders
tenders (1) ───< (N) proposals
proposals (1) ─── (1) contracts
contracts (1) ─── (0..1) projects
projects (1) ───< (N) work_breakdown_structures
work_breakdown_structures (1) ───< (N) tasks
```

---

# 8. API Overview

Daftar endpoint REST API penting:

### Marketing Module
- `POST /api/v1/marketing/tenders`: Membuat prospek tender baru.
- `GET /api/v1/marketing/tenders`: Mengambil seluruh daftar tender untuk papan Kanban/List.
- `POST /api/v1/marketing/tenders/:id/submit-go-no-go`: Mengajukan review Go/No-Go ke Direktur.
- `POST /api/v1/marketing/tenders/:id/go-no-go`: Direktur menyetujui/menolak Go/No-Go Gate.
- `POST /api/v1/marketing/tenders/:id/upload-proposal`: Mengunggah berkas proposal penawaran.
- `POST /api/v1/marketing/tenders/:id/upload-spk`: Mengunggah berkas SPK, memicu pembuatan kontrak, dan mengubah stage tender menjadi `WON`.

### Legal Module
- `GET /api/v1/legal/contracts/pending`: Mengambil daftar draf kontrak yang menunggu penelaahan Legal.
- `POST /api/v1/legal/contracts/review`: Menyerahkan hasil tinjauan Legal (`APPROVED`, `REJECTED`, atau `REVISION`).

### Project / PMO Module
- `GET /api/v1/project/operational-board`: Mengambil data papan operasional PMO (Daftar `pendingKickoff` & `activeProjects`).
- `PATCH /api/v1/project/charters/:charterId/claim`: Melakukan klaim kickoff Project Charter dan mengaktifkan proyek baru di tabel `projects`.

---

# 9. Realtime Architecture

Arsitektur sinkronisasi realtime pada EPMS menggunakan kombinasi NestJS EventEmitter2 dan Socket.IO Gateway:

```
[Service Layer Mutation]
       │
       ▼ (Perubahan DB Sukses & Transaction Committed)
[EventEmitter2 Emit]
       │
       ├──► 'marketing.tender.management_update' ──► [SalesGateway (/sales)] ──► Client 'sales:pipeline_updated'
       │
       └──► 'legal.contract.approved' ──► [NotificationListener]
                                                  │
                                                  ├──► [NotificationGateway (/notifications)] ──► Client 'legal.queue.updated'
                                                  └──► PMO Page Refresh Trigger ──► Refetch GET /project/operational-board
```

---

# 10. Frontend Architecture

- **Framework**: Next.js 14 (App Router Architecture), React 18, TypeScript.
- **Styling**: Ant Design (Antd v5) & Modern Vanilla CSS / CSS Modules.
- **Pattern & State Management**:
  - *Components*: Modul UI terpisah berbasis fungsi (`KanbanBoard.tsx`, `ProjectOperationTab.tsx`, `SalesPipelinePage.tsx`).
  - *Hooks*: Custom React Hooks (`useTendersQuery.ts`) untuk pengelolaan data asynchronous dan sync listener.
  - *API Client*: Terpusat melalui Axios / Service Abstraction Layer (`apiClient.ts`, `ProjectService.ts`, `AuthService.ts`).
  - *Socket Listener*: Pengelolaan socket global (`SocketProvider.tsx`) dan listener terfokus di page level (`project-delivery/page.tsx`).

---

# 11. Current Known Issues / Technical Debt

| Issue Description | Component / Layer | Status | Notes |
|---|---|:---:|---|
| Payload `CREATED` memuat referensi `legal_status` yang belum valid pada entity Tender | Backend `marketing.service.ts` | **FIXED** | Dihapus dari payload event `CREATED` karena `legal_status` berasal dari `Contract` JOIN. |
| Inkonsistensi pemancaran event realtime saat SPK Upload (`uploadSpk`) | Backend `marketing.service.ts` | **FIXED** | Menambahkan `marketing.tender.management_update` (`action: MARKED_WON`) post-commit. |
| Penggunaan socket lokal pada `project-delivery/page.tsx` tanpa listener `reconnect` fallback | Frontend PMO Route | **OPEN / KNOWN** | Socket terhubung ke `/notifications`, namun perlu peningkatan resilience jika koneksi internet terputus secara mendadak. |
| Tabel operasional sekunder (PO, GR, Invoice WBS UI) berupa scaffolding | Frontend UI Pages | **OPEN / KNOWN** | Logic backend API sudah siap, UI visual operasional dalam proses pengikatan data. |

---

# 12. Development Rules

1. **Minimal Diff**: Setiap perubahan kode harus terfokus pada target perbaikan tanpa melakukan refactoring masif yang tidak diminta.
2. **Read-Only / Audit First**: Lakukan investigasi dan runtime trace terlebih dahulu sebelum melakukan mutasi kode.
3. **Strict Scope Control**: Dilarang mengubah modul, entity, atau gateway di luar scope tugas yang telah disepakati.
4. **Database Migration Standard**: Setiap perubahan skema basis data wajib menggunakan file migrasi TypeORM / SQL terstruktur, bukan mutasi manual yang tidak terlacak.
5. **Build Verification**: Setiap perubahan wajib lolos pengecekan kompilasi TypeScript (`npx tsc --noEmit`) pada backend dan frontend.

---

# 13. Future Roadmap

- **Advanced Project Management**: Gantt Chart interaktif, alokasi resource leveling, dan pelacakan lintasan kritis (Critical Path Method).
- **Earned Value Management (EVM) Monitoring**: Perhitungan otomatis Planned Value (PV), Earned Value (EV), dan Actual Cost (AC) untuk indikator CPI & SPI.
- **Procurement Integration**: Otomatisasi pengiriman RFQ via email/vendor portal dan integrasi OCR untuk dokumen Goods Receipt.
- **Executive Reporting Dashboard**: Ekspor laporan keuangan proyek bulanan, analisis margin keuntungan aktual vs estimasi, serta penyesuaian KPI otomatis.
