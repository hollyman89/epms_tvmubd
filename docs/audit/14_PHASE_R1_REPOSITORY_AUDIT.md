# PHASE R1 – REPOSITORY ARCHITECTURE AUDIT REPORT

**DOCUMENT VERSION**: 1.0.0  
**AUDIT DATE**: August 12, 2026  
**MODE**: READ ONLY AUDIT  
**RULES ENFORCED**: 0 Files Modified | 0 Files Deleted | 0 Files Moved | 0 Files Renamed | 0 Database Changes | 0 Migrations Executed

---

## 1. DATABASE LAYER AUDIT (TASK 1)

| Item | Lokasi | Dipakai? | Aman Dipindah? | Alasan & Klasifikasi |
|------|--------|----------|----------------|----------------------|
| `epms_tvmubd_db.sql` | `/database/epms_tvmubd_db.sql` | **YA** | **TIDAK** | **`ACTIVE SSOT`**. Single Source of Truth DDL fisik (36 tabel MariaDB). |
| `master-data.seed.ts` | `/backend/src/database/seeds/` | **YA** | **TIDAK** | **`ACTIVE SSOT`**. Engine Seeder Master Data aktif NestJS (8 Roles, 7 Users, 3 Customers, 5 Vendors). |
| `seed.ts` | `/backend/src/database/scripts/` | **YA** | **TIDAK** | **`ACTIVE SSOT`**. Script pembantu runner seeder `npm run seed:master`. |
| `archive/` | `/database/archive/` | **YA (Histori)** | **SUDAH** | **`ARCHIVE`**. Menyimpan file SQL DDL/Seed legacy (`seed.sql`, `update_tenders.sql`, dll.). |
| `backups/` | `/database/backups/` | **YA (Backup)** | **SUDAH** | **`ARCHIVE`**. Pre-migration snapshots backup fisik database. |

---

## 2. FRONTEND LAYER AUDIT (TASK 4)

Top 10 File Frontend Terbesar (>300 Baris) & Evaluasi Structural Gap:

| No | File | Baris | Evaluasi & Rekomendasi Refaktor | Severity |
|----|------|-------|---------------------------------|----------|
| 1 | `frontend/src/components/SalesPipelinePage.tsx` | **1.552** | Mengelola statistik pipeline, Kanban drag-and-drop, dan modal GO/NO-GO dalam 1 file. **Disarankan dipisah menjadi sub-komponen**. | **MEDIUM 🟡** |
| 2 | `frontend/src/components/KanbanBoard.tsx` | **1.331** | Mengelola logika visualizer Kanban drag-and-drop & status transition. | **MEDIUM 🟡** |
| 3 | `frontend/src/app/(dashboard)/reports/page.tsx` | **1.006** | Dashboard laporan manajemen dengan rendering tab inline & Chart.js. | **LOW 🟢** |
| 4 | `frontend/src/app/(dashboard)/legal/review/page.tsx` | **660** | Workstation peninjauan berkas hukum & versioning. | **LOW 🟢** |
| 5 | `frontend/src/components/CustomersPage.tsx` | **608** | Mengelola drawer & tabel master pelanggan. | **LOW 🟢** |
| 6 | `frontend/src/components/ProjectOperationTab.tsx` | **510** | Modul eksekusi proyek operasional. | **LOW 🟢** |
| 7 | `frontend/src/app/login/page.tsx` | **425** | Form autentikasi login. | **LOW 🟢** |
| 8 | `frontend/src/components/MainLayout.tsx` | **395** | Layout utama navigasi sidebar & header. | **LOW 🟢** |
| 9 | `frontend/src/components/NotificationBell.tsx` | **344** | Drawer notifikasi real-time WebSocket. | **LOW 🟢** |
| 10 | `frontend/src/app/(dashboard)/sales/tenders/[id]/page.tsx` | **343** | Workstation detail tender. | **LOW 🟢** |

---

## 3. BACKEND LAYER AUDIT (TASK 5)

Top File Backend Terbesar & Evaluasi Modular Gap:

| No | File | Baris | Evaluasi & Rekomendasi Refaktor | Severity |
|----|------|-------|---------------------------------|----------|
| 1 | `backend/src/modules/marketing/marketing.service.ts` | **1.647** | File service jumbo yang mengelola GO/NO-GO gate, tender pipeline, upload proposal, upload SPK, & leaderboard. **Disarankan dipisah menjadi `TenderPipelineService` & `GoNoGoService` pada R2**. | **MEDIUM 🟡** |
| 2 | `backend/src/modules/procurement/procurement.service.ts` | **500** | Service P2P yang mengelola PR, RFQ, Vendor Comparison, PO, & GR. | **LOW 🟢** |
| 3 | `backend/src/modules/notification/notification-event.listener.ts` | **387** | Listener consumer notifikasi EventEmitter2 real-time. | **LOW 🟢** |
| 4 | `backend/src/modules/analytics/analytics.service.ts` | **309** | Engine analisis laporan manajemen. | **LOW 🟢** |
| 5 | `backend/src/entities/*.entity.ts` | **31 Files** | Seluruh Entity terpusat di `backend/src/entities/`. Dapat dikolokasikan ke modul domain masing-masing pada ekspansi V3. | **LOW 🟢** |

---

## 6. TOP 10 QUICK WINS

1. **Pembuatan TypeORM Entity `Milestone` (`milestones`)**: Menambah coverage PMO tanpa mengubah skema DDL.
2. **Pembuatan TypeORM Entity `ProjectBudget` (`project_budgets`)**: Menambah coverage Budgeting PMO tanpa mengubah DDL.
3. **Ekstraksi Sub-Komponen Modul Marketing**: Memecah modal GO/NO-GO dari `SalesPipelinePage.tsx` menjadi komponen terisolasi `GoNoGoModal.tsx`.
4. **Ekstraksi Sub-Komponen Modul Report**: Memecah tab visualizer `reports/page.tsx` menjadi `ExecutiveReportTab.tsx`.
5. **Ekstraksi Shared Types DTO**: Mengkonsolidasikan interface API di `frontend/src/types/` agar konsisten dengan NestJS DTOs.
6. **Standardisasi Error Handling Decorator**: Menggunakan `CatchAllFilter` global pada NestJS.
7. **Penyempurnaan Swagger API Documentation**: Menambahkan contoh payload DTO pada endpoint Procurement & Finance.
8. **Optimasi React Query / Client Cache**: Menambahkan caching pada fetching data pelanggan dan tender.
9. **Penambahan Indexing Query Builder PMO**: Memastikan query `where: { projectId }` terindeks sempurna.
10. **Standardisasi Event Logger Constants**: Membukukan event name `EventEmitter2` ke dalam enum `SystemEvent`.

---

## 7. TOP 10 HIGH RISK CHANGES (JANGAN DIEKSEKUSI SEKARANG)

1. ❌ **Restrukturisasi Monorepo Turborepo (`apps/` & `packages/`)**: Risiko membongkar alur build CI/CD & pengerjaan tim.
2. ❌ **Relokasi Folder Entity (`backend/src/entities/` ke modul domain)**: Risiko merusak path import pada 140+ file service & controller.
3. ❌ **Pecah File Service Jumbo (`marketing.service.ts`) secara total**: Risiko merusak alur transaksi GO/NO-GO & upload SPK yang sedang aktif digunakan.
4. ❌ **Perubahan Skema Foreign Key MariaDB**: Risiko merusak constraint relasional `tenders` & `contracts`.
5. ❌ **Pengubahan State Management Frontend**: Mengganti `AuthContext` secara masif dengan Zustand/Redux.
6. ❌ **Modifikasi Engine Workflow Persistence**: Mengubah workflow in-memory menjadi strict TypeORM persistence tanpa testing regression.
7. ❌ **Penghapusan Folder Archive SQL**: Risiko kehilangan rekam jejak migrasi historis.
8. ❌ **Refaktor QueryRunner Transaksi ke Custom Decorator**: Risiko terjadi unhandled rollback pada transaksi `ensureContractForWonTender`.
9. ❌ **Perubahan Endpoint Route API REST**: Mengubah prefix `/api/v1/marketing` atau `/api/v1/procurement`.
10. ❌ **Perubahan Struktur Routing App Router Next.js**: Mengubah nama folder `app/(dashboard)/*`.

---

## 8. PRIORITAS R2 (YANG BOLEH DIEKSEKUSI PASCA APPROVAL)

### **A. Scope R2 Backend (Aman & Zero Risk)**
1. **[NEW]** `backend/src/entities/milestone.entity.ts`: Membuat Entity TypeORM untuk tabel `milestones`.
2. **[NEW]** `backend/src/entities/project-budget.entity.ts`: Membuat Entity TypeORM untuk tabel `project_budgets`.
3. **[MODIFY]** `backend/src/modules/project/project.module.ts`: Daftarkan `Milestone` & `ProjectBudget` ke `TypeOrmModule.forFeature([...])`.

### **B. Scope R2 Frontend (Aman & Zero Risk)**
1. **[NEW]** `frontend/src/components/marketing/GoNoGoModal.tsx`: Memindahkan JSX Modal GO/NO-GO dari `SalesPipelinePage.tsx` ke file komponen terpisah.
2. **[MODIFY]** `frontend/src/components/SalesPipelinePage.tsx`: Import & panggil `GoNoGoModal`.
