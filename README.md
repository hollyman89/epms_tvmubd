# 🏢 EPMS (Enterprise Procurement Management System) - TVM UBD

![EPMS Architecture](https://img.shields.io/badge/Architecture-Clean%20%26%20Modular-blue)
![NestJS](https://img.shields.io/badge/Backend-NestJS%20v10-red)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%20v14%20App%20Router-black)
![Database](https://img.shields.io/badge/Database-MySQL%208%20%7C%20TypeORM-orange)
![Queue](https://img.shields.io/badge/Queue-BullMQ%20%7C%20Redis-red)
![Status](https://img.shields.io/badge/Status-SIT%20%26%20Staging%20Ready-brightgreen)

Sistem Informasi Manajemen Pengadaan dan Proyek Skala Enterprise (**Enterprise Procurement Management System - TVM UBD**). Platform ini dirancang untuk mengotomatisasi seluruh siklus hidup pengadaan barang & jasa (*Procurement-to-Payment / P2P*), manajemen kontrak & peninjauan hukum (*Legal Review*), proyek operasional, hingga pencatatan keuangan (*Finance & Invoicing*).

---

## 📌 Fitur Utama & Modul Sistem

Sistem terdiri dari modul-modul terintegrasi yang saling terhubung melalui *State Machine* workflow dan pemrosesan latar belakang (*Asynchronous Background Job*):

### 1. 🛒 Procurement & P2P Flow (Procurement-to-Payment)
- **Purchase Request (PR):** Pengajuan kebutuhan barang/jasa dengan estimasi biaya dan item detail.
- **Vendor Comparison:** Perbandingan penawaran harga vendor secara komparatif untuk penentuan pemenang.
- **Purchase Order (PO):** Penerbitan Dokumen Pesanan Pembelian resmi berbasis vendor pemenang.
- **Goods Receipt (GR):** Penerimaan fisik barang/jasa dan verifikasi kuantitas.

### 2. ⚖️ Legal & Contract Review
- **Contract Management:** Pengelolaan draft kontrak kerja sama dan addendum.
- **Split-Screen Legal Review UI:** Antarmuka ulasan hukum berdampingan (*Split-Screen*) dengan checklist kepatuhan & persetujuan (*Approve/Reject*).
- **Asynchronous PDF Generation:** Rendering PDF kontrak secara non-blocking menggunakan **BullMQ** & **PDFKit**, diunggah otomatis ke **AWS S3**.

### 3. 💰 Finance & Payment Processing
- **Invoice Management:** Registrasi dan validasi tagihan dari vendor terhubung dengan PO & GR.
- **Payment Processing:** Pemrosesan pembayaran dengan metode transfer, pencatatan nomor referensi, dan histori transaksi.

### 4. 📊 Sales, Marketing & Tender
- **Customer Relationship:** Pengelolaan basis data klien dan prospek.
- **Tender & Proposal Management:** Pelacakan tender, riwayat penawaran harga (*Tender Price History*), dan aktivitas proyek.

### 5. 🔄 Workflow Engine & Visualizer
- **BPMN Workflow Visualizer:** Visualisasi alur proses bisnis interaktif menggunakan **React Flow**.
- **State Machine Enforcement:** Validasi ketat alur status (PR Approved $\rightarrow$ PO $\rightarrow$ GR $\rightarrow$ Invoice $\rightarrow$ Payment).

### 6. 🔔 Real-time Notification & Logging
- **Asynchronous Queue (BullMQ + Redis):** Antrean terpisah untuk Email Notification (`email-send`) dan PDF Generator (`pdf-generation`).
- **WebSockets (Socket.IO):** Notifikasi *real-time* aktivitas pengadaan dan persetujuan.
- **Winston Centralized Logging:** Logging terstruktur JSON untuk audit trails dan pemantauan error staging (`backend/logs/nest.log`).

---

## 🛠 Tech Stack & Arsitektur

### Frontend (`/frontend`)
- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **UI Components & Styling:** Ant Design (antd v5), Ant Design Icons, Ant Design Charts
- **State Management & Data Fetching:** TanStack React Query v5, Axios
- **Workflow Diagram:** React Flow
- **Real-time:** Socket.IO Client

### Backend (`/backend`)
- **Framework:** NestJS v10 (TypeScript Modular Architecture)
- **Database & ORM:** MySQL 8 + TypeORM
- **Background Queue:** BullMQ + Redis (ioredis)
- **File Storage:** AWS S3 (`@aws-sdk/client-s3`)
- **PDF Generation:** PDFKit
- **Email:** Nodemailer (SMTP / Mailtrap)
- **Authentication & Security:** Passport JWT, Bcrypt
- **API Documentation:** Swagger / OpenAPI 3.0 (`@nestjs/swagger`)
- **Logging:** Winston (`nest-winston`)

---

## 📁 Struktur Direktori Repositori

```text
epms_tvmubd/
├── backend/                  # NestJS Backend API Service
│   ├── logs/                 # File Log Aplikasi (nest.log)
│   ├── src/
│   │   ├── core/             # Interceptor, Filter, Guard, Pipeline
│   │   ├── database/         # Migrasi, Seeders, & Database Scripts
│   │   ├── entities/         # Entity TypeORM Database
│   │   ├── modules/          # 17+ Domain Modules (Auth, Procurement, Legal, Finance, dll)
│   │   └── shared/           # Helper, DTO Universal, Utilities
│   ├── monitor.sh            # Script Log Monitoring Real-time
│   └── package.json
├── frontend/                 # Next.js App Router Frontend Application
│   ├── src/
│   │   ├── app/              # Next.js App Router Pages (15+ Routes)
│   │   ├── components/       # Reusable UI Components & Forms
│   │   ├── hooks/            # Custom React Hooks & State
│   │   ├── services/         # API Service Client Integrations
│   │   └── types/            # TypeScript Interface & Type Definitions
│   └── package.json
├── docker-compose.yml        # Docker Multi-container Specification
├── SIT_READY_REPORT.md       # Laporan Kesiapan Testing SIT & Handover QA
├── EPMS_ARCHITECTURE_AUDIT_V2.md # Laporan Audit Arsitektur V2
├── docs/postman/.postman_environment.json # Postman Environment Config
└── README.md                 # Dokumentasi Proyek ini
```

---

## 🚀 Panduan Memulai (Getting Started)

### Prasyarat System
- **Node.js** v18.x atau v20.x
- **npm** v9.x+ atau **yarn**
- **Docker & Docker Compose** (Rekomendasi untuk lingkungan lokal / staging)
- **MySQL** 8.0 & **Redis** (Jika dijalankan tanpa Docker)

---

### Cara 1: Menggunakan Docker Compose (Direkomendasikan)

1. **Clone Repositori:**
   ```bash
   git clone <repository-url>
   cd epms_tvmubd
   ```

2. **Jalankan Container Infrastructure & Aplikasi:**
   ```bash
   docker-compose up -d --build
   ```

3. **Akses Layanan:**
   - **Frontend UI:** `http://localhost:3000`
   - **Backend API:** `http://localhost:4000/api/v1`
   - **Swagger API Documentation:** `http://localhost:4000/api/docs`

---

### Cara 2: Pengembangan Lokal (Manual / Hybrid)

#### 1. Setup Backend
```bash
cd backend

# 1. Install Dependensi
npm install

# 2. Salin Environment File
cp .env.example .env

# Konfigurasikan variabel DATABASE_HOST, REDIS_HOST, AWS S3, dan SMTP di .env

# 3. Jalankan Database Seeder / Migrasi (Jika diperlukan)
npx ts-node src/database/scripts/seed.ts

# 4. Jalankan Server Backend (Development Mode)
npm run start:dev
```

#### 2. Setup Frontend
```bash
cd frontend

# 1. Install Dependensi
npm install

# 2. Salin Environment File
cp .env.example .env.local

# Salin nilai: NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# 3. Jalankan Development Server
npm run dev
```

---

## ⚙️ Variabel Lingkungan (Environment Variables)

### Backend (`backend/.env`)
```env
# Server Config
PORT=4000

# MySQL Database
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=epms_tvmubd_db

# Redis Queue & Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS S3 Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=epms-staging-bucket

# SMTP Mailer Config
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

---

## 📖 Dokumentasi API & Endpoint Kunci

Dokumentasi lengkap API ter-generate secara otomatis menggunakan Swagger OpenAPI:
📌 **URL Swagger UI:** `http://localhost:4000/api/docs`

### Beberapa Endpoint Utama:
- `POST /api/v1/auth/login` — Autentikasi Pengguna & Penerbitan JWT Token.
- `POST /api/v1/procurement/pr` — Pembuatan Purchase Request.
- `POST /api/v1/procurement/vendor-comparison` — Input Perbandingan Vendor.
- `POST /api/v1/procurement/purchase-orders` — Penerbitan Purchase Order.
- `GET  /api/v1/contracts/:id/pdf` — Trigger pembuatan PDF Kontrak secara asinkron (`BullMQ`).
- `GET  /api/v1/contracts/pdf-status/:jobId` — Polling status PDF & URL AWS S3.
- `POST /api/v1/legal/review` — Pengiriman hasil persetujuan Legal Review.

---

## 🧪 Pengujian & Monitoring

### 1. Standby Log Monitoring (Staging/QA)
Untuk memantau log backend secara *real-time* saat pengujian QA:
```bash
cd backend
bash monitor.sh
```

### 2. Pengujian E2E & Postman Collection
Gunakan file `epms_e2e_collection.json` dan `docs/postman/.postman_environment.json` untuk menjalankan alur pengujian integrasi P2P dari `Login` $\rightarrow$ `PR` $\rightarrow$ `Vendor Comparison` $\rightarrow$ `PO` $\rightarrow$ `GR` $\rightarrow$ `Invoice` $\rightarrow$ `Payment`.

---

## 📄 Lisensi & Tim Pengembang

Proyek ini dikembangkan oleh Tim Pengembang **EPMS TVM UBD**. All rights reserved.
