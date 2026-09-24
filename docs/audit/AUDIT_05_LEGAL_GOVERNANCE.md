# AUDIT 05 — LEGAL GOVERNANCE & CONTRACT STATE MACHINE

## Executive Summary

Audit forensik ini berfokus pada **Modul Legal & Governance**, **State Machine Kontrak** (`DRAFT`, `ON_REVIEW`, `REVISION_REQUESTED`, `APPROVED`, `REJECTED`), **Authorization & Role Access Control**, serta **PMO Auto-Handover Mechanics**.

### Key Audit Findings:
1. **Critical Authorization Deficit (P1 - Critical)**: Endpoint `POST /legal/contracts/review` dan `POST /legal/review` hanya dilindungi oleh `JwtAuthGuard` tanpa `RolesGuard` atau decorator `@Roles()`. **Semua pengguna terautentikasi (termasuk role `MARKETING`, `PMO`, `FINANCE`, `USER`) dapat menyetujui (`APPROVED`) atau menolak (`REJECTED`) kontrak legal.**
2. **Missing State Transition Enforcement (P1 - Critical)**: Metode `reviewContract` di `legal.service.ts` langsung mengeset `contract.legal_status = dto.legalStatus` **tanpa memvalidasi status kontrak saat ini**. Hal ini mengizinkan seluruh lompatan state ilegal (seperti `DRAFT` → `APPROVED`, `REJECTED` → `APPROVED`, atau `APPROVED` → `ON_REVIEW`).
3. **Self-Approval & Ownership Deficit (P1 - Critical)**: Ketiadaan validasi pemisahan tugas (*Segregation of Duties*) mengizinkan pembuat/pemilik kontrak (misal Marketing) untuk melakukan *self-approval* atas kontraknya sendiri.
4. **Auto-Handover Mechanism**: Penetapan status `APPROVED` pada Legal Review mengubah `contract.status = 'ACTIVE'`, tetapi pendaftaran `Project` di tabel `projects` ditunda hingga aksi manual `POST /legal/start-project` atau Kick-off di PMO Board.

---

## Authorization Matrix

| User Role | View Pending Legal Contracts | Submit Legal Review (`APPROVED`) | Reject Legal Contract (`REJECTED`) | Request Legal Revision | Request Grace Extension | Start PMO Project |
|-----------|------------------------------|----------------------------------|------------------------------------|------------------------|-------------------------|-------------------|
| `SUPER_ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `LEGAL` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DIRECTOR` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GENERAL_MANAGER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MARKETING` | ✅ | **BYPASS 🔴** | **BYPASS 🔴** | **BYPASS 🔴** | ✅ | ✅ |
| `PMO` | ✅ | **BYPASS 🔴** | **BYPASS 🔴** | **BYPASS 🔴** | ✅ | ✅ |
| `PROCUREMENT` | ✅ | **BYPASS 🔴** | **BYPASS 🔴** | **BYPASS 🔴** | ✅ | ✅ |
| `FINANCE` | ✅ | **BYPASS 🔴** | **BYPASS 🔴** | **BYPASS 🔴** | ✅ | ✅ |

> **Bukti Kode**: `legal.controller.ts` (Lines 10, 32, 39) menggunakan `@UseGuards(JwtAuthGuard)` di level controller tetapi **TIDAK MENGGUNAKAN `RolesGuard` ATAU `@Roles('LEGAL')`** pada endpoint review.

---

## State Transition Matrix

| Current Legal Status | Target Legal Status | Enforced by Backend? | Allowed Bypasses Found | Code Location |
|----------------------|---------------------|----------------------|------------------------|---------------|
| `DRAFT` | `ON_REVIEW` | **NO 🔴** | Langsung lompat ke `APPROVED` / `REJECTED` | `legal.service.ts#L95` |
| `DRAFT` | `APPROVED` | **NO 🔴 (ILLEGAL)** | Mengizinkan approval tanpa tahapan `ON_REVIEW` | `legal.service.ts#L95` |
| `DRAFT` | `REJECTED` | **NO 🔴 (ILLEGAL)** | Mengizinkan rejection langsung dari `DRAFT` | `legal.service.ts#L95` |
| `ON_REVIEW` | `APPROVED` | **YES 🟢** | Alur normal | `legal.service.ts#L100` |
| `ON_REVIEW` | `REVISION_REQUESTED` | **YES 🟢** | Alur normal | `legal.service.ts#L138` |
| `ON_REVIEW` | `REJECTED` | **YES 🟢** | Alur normal | `legal.service.ts#L117` |
| `REVISION_REQUESTED` | `ON_REVIEW` | **PARTIAL 🟡** | Tidak ada pengecekan submit ulang revisi | `legal.service.ts#L95` |
| `APPROVED` | `ON_REVIEW` | **NO 🔴 (ILLEGAL)** | Mengizinkan pengembalian kontrak yang sudah `APPROVED` ke review | `legal.service.ts#L95` |
| `APPROVED` | `REJECTED` | **NO 🔴 (ILLEGAL)** | Mengizinkan pembatalan kontrak `APPROVED` menjadi `REJECTED` | `legal.service.ts#L95` |
| `REJECTED` | `APPROVED` | **NO 🔴 (ILLEGAL)** | Mengizinkan pengubahan kontrak `REJECTED` langsung menjadi `APPROVED` | `legal.service.ts#L95` |

---

## Ownership Findings

### Finding OW-LEGAL-001 (P1 - Critical): Missing Legal Role Restriction on Review Endpoints
- **File**: `backend/src/modules/legal/legal.controller.ts` (Lines 10, 32–44)
- **Description**: Endpoint `POST /legal/contracts/review` dan `POST /legal/review` tidak memverifikasi role pengguna.
- **Business Impact**: Pengguna Marketing atau PMO dapat memanggil API ini untuk menyetujui kontrak milik mereka sendiri tanpa persetujuan Petugas Legal resmi (*Self-Approval Hazard*).

### Finding OW-LEGAL-002 (P2 - High): Absence of Reviewer Segregation of Duties
- **File**: `backend/src/modules/legal/legal.service.ts` (Lines 61–98)
- **Description**: Tidak ada pengecekan backend yang memverifikasi bahwa `contract.created_by !== userId` atau `tender.marketing_pic_id !== userId`.
- **Business Impact**: Jika seorang anggota tim Legal juga bertindak sebagai Marketing PIC pada suatu tender, sistem mengizinkannya meninjau dan menyetujui kontrak yang ia buat sendiri.

---

## API Bypass Findings

1. **`POST /legal/contracts/review` & `POST /legal/review`** (`legal.controller.ts#L32 & L39`)
   - **Celah**: Mengizinkan peran non-Legal untuk mengubah `legal_status` ke `APPROVED` atau `REJECTED`.
   - **Bypass State**: Bebas mengubah `legal_status` tanpa memeriksa status sebelumnya.

2. **`POST /legal/start-project`** (`legal.controller.ts#L86`, `legal.service.ts#L195`)
   - Membuat record `Project` dengan status `INITIATED` berdasarkan `tenderId`.
   - **Idempotensi**: Memeriksa `where: { code: PRJ-${tender.id} }` sehingga mencegah duplikasi pada panggilan berurutan. Panggilan *concurrent* milidetik yang sama tanpa DB pessimistic lock masih berisiko race condition.

---

## Risk Matrix

| ID | Severity | Category | Finding Summary | Business Impact |
|----|----------|----------|-----------------|-----------------|
| **LG-001** | **P1 (Critical)** | Authorization | Missing `@Roles('LEGAL')` guard pada endpoint review | Siapapun dapat melakukan approval/rejection kontrak Legal |
| **LG-002** | **P1 (Critical)** | State Machine | `reviewContract` mengabaikan validasi status sebelumnya | Lompatan state ilegal (`DRAFT` → `APPROVED`, `REJECTED` → `APPROVED`) |
| **LG-003** | **P2 (High)** | Segregation of Duties | Pemilik Kontrak/Marketing dapat melakukan *self-approval* | Risiko fraud dan pengabaian verifikasi kepatuhan hukum |
| **LG-004** | **P3 (Medium)** | Concurrency | Potensi race condition pada `startProject` | Pendaftaran proyek ganda saat concurrent kick-off |

---

## Recommended Fix Priority

### Priority 1 (P1 - Critical)
1. **Legal Role Guard Enforcement**:
   - Tambahkan `@UseGuards(JwtAuthGuard, RolesGuard)` dan `@Roles('LEGAL', 'SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER')` pada endpoint `POST /legal/contracts/review` dan `POST /legal/review` di `legal.controller.ts`.
2. **Contract State Machine Validation**:
   - Terapkan validasi matriks transisi ketat di `legal.service.ts#L95`:
     - Disetujui (`APPROVED`) atau Ditolak (`REJECTED`) hanya diizinkan jika status saat ini = `ON_REVIEW`.
     - Revisi (`REVISION_REQUESTED`) hanya diizinkan jika status saat ini = `ON_REVIEW`.
     - Kontrak berstatus `APPROVED` atau `REJECTED` dikunci dari modifikasi ulang tanpa prosedur pembukaan kembali resmi (*Reopen Procedure*).

### Priority 2 (P2 - High)
1. **Segregation of Duties Check**:
   - Tambahkan pengecekan `if (contract.created_by === userId || contract.proposal?.tender?.marketing_pic_id === userId) throw new ForbiddenException('Tidak dapat meninjau kontrak milik sendiri');`.

### Priority 3 (P3 - Medium)
1. **Pessimistic Locking on PMO Handover**:
   - Bungkus metode `startProject` dengan transaksi DB yang menggunakan pessimistic lock untuk menjamin pembentukan 1 proyek unik per Tender ID.

---

**AUDIT SELESAI.** Laporan forensik Legal Governance & Contract State Machine ini disusun berdasarkan bukti langsung dari codebase backend EPMS.
