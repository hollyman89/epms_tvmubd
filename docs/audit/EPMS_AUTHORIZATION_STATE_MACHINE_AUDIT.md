# EPMS Authorization & State Machine Audit

## Executive Summary

Audit ini melakukan investigasi forensik terhadap mekanisme **Authorization (RBAC)**, **Data Ownership Isolation**, **State Machine Enforcement**, dan **API Bypass Vulnerabilities** pada modul Marketing, Tender, Go/No-Go, dan Legal Review.

### Summary Findings:
- **RBAC Audit**: Role yang terdefinisi mencakup `SUPER_ADMIN`, `ADMIN`, `DIRECTOR`, `GENERAL_MANAGER`, `MANAGER`, `MARKETING`, `LEGAL`, `PMO`, `PROCUREMENT`, `FINANCE`, `USER`.
- **Horizontal Access Control Vulnerability (HIGH)**: Pengguna berinisial Marketing A yang memiliki role `MARKETING` dapat mengedit, melakukan negosiasi harga, mengunggah proposal/SPK, dan mengubah status/stage pada Tender milik Marketing B melalui endpoint API langsung (karena ketiadaan validasi kepemilikan/PIC pada endpoint mutasi).
- **State Machine Enforcement Deficit (CRITICAL)**: Backend API `updateTenderStatusTransactionally` mengizinkan **lompatan stage ilegal** (misalnya `LEAD` → `WON` atau `QUALIFICATION` → `WON`) selama `go_nogo_status === 'GO'`, tanpa memaksa urutan tahapan sekuensial resmi.
- **Customer Lifecycle**: Endpoint edit dan delete Customer **`NOT FOUND IN CODEBASE`**.

---

## Role Matrix

| User Role | Customer Create | Tender Create | Tender Edit | Tender Delete | Go/No-Go Submit | Go/No-Go Decision | Upload Proposal | Negotiate Price | Mark WON | Upload SPK | Legal Review |
|-----------|-----------------|---------------|-------------|---------------|-----------------|-------------------|-----------------|-----------------|----------|------------|--------------|
| `SUPER_ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ADMIN` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DIRECTOR` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GENERAL_MANAGER` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MANAGER` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `MARKETING` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `LEGAL` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `PMO` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `PROCUREMENT` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `FINANCE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Catatan Penting**: Endpoint `POST /marketing/customers` dan `POST /marketing/tenders` tidak menggunakan decorator `@Roles()`, sehingga **seluruh pengguna terautentikasi (termasuk role non-marketing)** diizinkan secara teknis oleh backend untuk membuat Customer dan Tender.

---

## Authorization Findings

### Finding AU-001 (P2 - High): Missing Role Decorator on Customer & Tender Creation
- **File**: `backend/src/modules/marketing/marketing.controller.ts` (Lines 72 & 97)
- **Description**: Endpoint `POST /marketing/customers` dan `POST /marketing/tenders` hanya dilindungi oleh `@UseGuards(JwtAuthGuard, RolesGuard)` di level controller tanpa decorator `@Roles('MARKETING', ...)`.
- **Business Impact**: User dengan role apapun (misal `FINANCE` atau `PROCUREMENT`) dapat membuat record Customer dan Tender di sistem.

---

## Ownership Findings

### Finding OW-001 (P1 - Critical): Horizontal Privilege Escalation on Tender Mutation
- **File**: `backend/src/modules/marketing/marketing.service.ts` (Lines 433, 482, 916, 979, 1249)
- **Description**:
  - `getTenders` (L220) memfilter daftar tender berdasarkan `marketing_pic_id` atau `created_by` untuk pengguna non-manajemen.
  - **Namun**, endpoint mutasi seperti `updateTender`, `updateTenderStatusTransactionally`, `uploadProposal`, `negotiatePrice`, `uploadSpk`, dan `submitGoNoGoReview` **TIDAK** memverifikasi apakah `tender.marketing_pic_id === userId` atau `tender.created_by === userId`.
- **Business Impact**: Marketing A dapat mengubah data, mengunggah file, mengubah harga negosiasi, atau mengubah stage pada Tender yang dimiliki oleh Marketing B jika mengetahui ID tender tersebut.

---

## State Transition Matrix

| Current State | Target State | State Machine Enforced by Backend? | Enforcement Validation Detail | Source Code Location |
|---------------|--------------|-----------------------------------|-------------------------------|----------------------|
| `LEAD` | `WAITING_GO_NO_GO` | **YES 🟢** | Memerlukan `stage == LEAD` & `revision_status !== REQUIRED` | `marketing.service.ts#L696` |
| `WAITING_GO_NO_GO` | `QUALIFICATION` | **YES 🟢** | Memerlukan Keputusan Director (`decision == GO`) | `marketing.service.ts#L828` |
| `WAITING_GO_NO_GO` | `LEAD` | **YES 🟢** | Memerlukan Keputusan Director (`decision == NO_GO`) | `marketing.service.ts#L834` |
| `QUALIFICATION` | `PROPOSAL` | **PARTIAL 🟡** | Mengizinkan pergerakan stage via DTO tanpa mengecek keberadaan dokumen proposal | `marketing.service.ts#L447` |
| `PROPOSAL` | `NEGOTIATION` | **PARTIAL 🟡** | Mengizinkan pergerakan stage tanpa mengecek detail negosiasi | `marketing.service.ts#L447` |
| `NEGOTIATION` | `WON` | **PARTIAL 🟡** | Mengizinkan pergerakan ke `WON` tanpa mengecek ketersediaan SPK file key | `marketing.service.ts#L501` |
| `LEAD` / `QUALIFICATION` | `WON` | **NO 🔴 (BYPASS)** | **TIDAK MEMAKSA URUTAN SEKUANSIAL**. Dapat melompat langsung ke `WON` asal `go_nogo_status === 'GO'` | `marketing.service.ts#L497` |

---

## Illegal Transition Findings

### Finding IT-001 (P1 - Critical): Sequential Stage Enforcement Bypass
- **File**: `backend/src/modules/marketing/marketing.service.ts` (Lines 496–501)
- **Description**:
  Pengecekan hard gate `updateTenderStatusTransactionally` hanya memastikan `tender.go_nogo_status === GoNoGoStatus.GO`.
  Backend **TIDAK** memeriksa apakah stage sebelumnya adalah `NEGOTIATION`.
- **Business Impact**:
  Panggilan API `PATCH /marketing/tenders/:id/status` dengan payload `{"stage": "WON"}` mengizinkan tender berstatus `LEAD` atau `QUALIFICATION` langsung menjadi `WON`.

---

## API Bypass Findings

1. **`PATCH /marketing/tenders/:id/status`** (`marketing.controller.ts#L200`)
   - Memungkinkan pengubahan status/stage langsung ke `WON`, `LOST`, `PROPOSAL`, `NEGOTIATION` tanpa melewati urutan sekuensial.
2. **`PATCH /marketing/tenders/:id`** (`marketing.controller.ts#L113`)
   - Memungkinkan pengubahan properti `stage` langsung via DTO.
3. **`POST /marketing/tenders/:id/upload-proposal`** (`marketing.controller.ts#L207`)
   - Langsung mengeset stage ke `PROPOSAL` tanpa memvalidasi stage saat ini harus `QUALIFICATION`.

---

## Risk Matrix

| ID | Severity | Area | Finding | Impact |
|----|----------|------|---------|--------|
| **OW-001** | **P1 (Critical)** | Data Ownership | Ketiadaan validasi PIC pada endpoint mutasi tender | Marketing user dapat mengedit/mengubah tender milik user lain |
| **IT-001** | **P1 (Critical)** | State Machine | Backend mengizinkan lompatan stage langsung dari `LEAD` ke `WON` | Penetapan status WON tanpa tahap kualifikasi, proposal & negosiasi |
| **AU-001** | **P2 (High)** | Authorization | Missing `@Roles()` pada pembuatan Customer & Tender | User non-marketing dapat membuat master data |
| **BP-001** | **P2 (High)** | API Security | Stage transition dapat di-bypass via direct PATCH API call | Pengabaian kontrol validasi prasyarat dokumen di backend |

---

## Recommended Fix Priority

### Priority 1 (P1 - Critical)
1. **Ownership Enforcement Guard**:
   - Tambahkan pengecekan kepemilikan di `marketing.service.ts` pada metode `updateTender`, `updateTenderStatusTransactionally`, `uploadProposal`, dan `negotiatePrice`:
     `if (!isManagement && tender.marketing_pic_id !== userId && tender.created_by !== userId) throw new ForbiddenException();`
2. **Strict Sequential State Machine Enforcement**:
   - Terapkan matriks transisi state ketat di backend:
     - `LEAD` hanya boleh ke `WAITING_GO_NO_GO` / `LOST`.
     - `WAITING_GO_NO_GO` hanya boleh ke `QUALIFICATION` (via Director GO) atau `LEAD` (via Director NO_GO).
     - `QUALIFICATION` hanya boleh ke `PROPOSAL` (wajib file proposal).
     - `PROPOSAL` hanya boleh ke `NEGOTIATION` (wajib data negosiasi).
     - `NEGOTIATION` hanya boleh ke `WON` (wajib file SPK / Grace Period).

### Priority 2 (P2 - High)
1. **Strict Role Binding Decorators**:
   - Tambahkan `@Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER')` pada `POST /marketing/customers` dan `POST /marketing/tenders`.

---

**AUDIT SELESAI.** Laporan forensik Authorization & State Machine ini disusun berdasarkan bukti nyata dari codebase backend & frontend EPMS.
