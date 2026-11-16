# EPMS UBD & TVM — Six-Tab Management Intelligence UI/UX Specification
## Component Hierarchy, Interaction Architecture & Executive Responsive Design

**Project:** Enterprise Procurement Management System (EPMS) — UBD & TVM
**Target Surface:** `/reports` (Web Desktop, Tablet & PWA Mobile)
**Governing Baseline Commit:** `4a6f88c7fd335652c4d9028cbc77267f7165bb65` (`origin/main`)
**Design System:** Ant Design 5.x + EPMS Custom Enterprise Tokens (`@/components/dashboard/tokens.css`)
**Reference Date:** 16 November 2026
**Execution Mode:** `DESIGN SPECIFICATION & DOCUMENTATION ONLY`

---

## 1. Global Layout & Unified Control Architecture

The redesigned `/reports` workspace eliminates fragmented tab-level controls and introduces a unified **Executive Global Control Bar** sticky at the top of all six tabs.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ EPMS Executive Intelligence Workspace                                             [ Director Mode ]    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Entitas: [ Semua Entitas (Konsolidasi) ▼ ]   Periode: [ Year-to-Date (2026) ▼ ]                       │
│ Cakupan Data: [ Komersial Bersih (Default) ⚪──🔘 Termasuk Data Uji ]                                  │
│ Data Quality Pill: ⚠ 7 transaksi uji (Rp 100,98B) dikecualikan · 115 tender belum ber-entity PT         │
│ Data Freshness: Diperbarui: 16 Nov 2026, 17:36 WIB   [ 🔄 Segarkan Data ]  [ 📥 Ekspor Laporan ▼ ]    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Tab 1: Executive Overview ] [ Tab 2: Sales & Pipeline ] [ Tab 3: Project Delivery ]                  │
│ [ Tab 4: Procurement Intelligence ] [ Tab 5: Finance & Tax ] [ Tab 6: Legal & Compliance ]             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Global Control Bar Specifications
1. **Entity Selector (`entity`):**
   - Options: `ALL` (Konsolidasi), `PT_UBD` (PT Usaha Bersama Digital), `PT_TVM` (PT Tri Visi Mandiri), `UNCLASSIFIED` (Perlu Klasifikasi).
   - Invariant: $\text{PT UBD} + \text{PT TVM} + \text{UNCLASSIFIED} = \text{KONSOLIDASI}$ across all metrics.
2. **Period Selector (`period`):**
   - Options: `THIS_MONTH` (Bulan Ini), `THIS_QUARTER` (Kuartal Ini), `YEAR_TO_DATE` (Tahun Berjalan / Default), `ALL_TIME` (Sepanjang Masa), `CUSTOM` (Kustom Rentang Tanggal).
   - Calendar Engine: Strict `Asia/Jakarta` (`UTC+07:00`) boundary math.
3. **Data Scope Toggle (`dataScope`):**
   - Modes: `COMMERCIAL_ONLY` (Default — excludes `TEST_SANDBOX`) vs `INCLUDE_TEST` (Includes sandbox with audited warning watermark).
4. **Persistent Data Quality Pill:**
   - Shows dynamic badge indicating exact excluded test volume and unclassified entity count.
5. **Freshness & Export Actions:**
   - Refresh button with loading spinner; Export button offering Governed PDF Board Pack, Excel, and CSV.

---

## 2. Strict Six-State Semantic KPI Card Component Contract

Every KPI card across all six tabs implements a discriminated union contract that prevents numeric fabrication:

```typescript
type KpiState =
  | { state: 'ACTUAL'; value: number; formatted: string; target?: TargetObject; trend?: TrendObject }
  | { state: 'TARGET'; targetValue: number; approvedBy: string; approvedAt: string; version: number }
  | { state: 'FORECAST'; expectedValue: number; confidenceLevel: number; assumptions: string[] }
  | { state: 'UNAVAILABLE'; reasonCode: 'NO_LEDGER_MODULE' | 'ZERO_DENOMINATOR'; explanationText: string }
  | { state: 'UNVERIFIED'; reasonCode: 'HISTORICAL_NO_SLA' | 'UNMAPPED_ENTITY'; coveragePct: number }
  | { state: 'DATA_EXCEPTION'; exceptionType: 'NEGATIVE_MARGIN' | 'SOD_BREACH'; severity: 'CRITICAL' | 'WARNING' };
```

- When a target is not approved: Badge renders **`TARGET BELUM DISAHKAN`** (never displays hardcoded `35%` or `90%`).
- When a denominator is zero: Renders **`UNAVAILABLE`** with subtitle *"Tidak ada data pembanding / hasil penutupan"*.
- When Customer Revenue is requested: Renders **`UNAVAILABLE`** with explicit disclaimer *"Modul Billing & Piutang Customer Belum Tersedia"*.

---

## 3. Tab-by-Tab Detailed UI/UX Specifications

### TAB 1 — EXECUTIVE OVERVIEW (Director Landing Page)
The Director landing page strictly answers the three core executive questions:

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 01. PENCAPAIAN UTAMA (Executive Key Achievements)                                                      │
├────────────────────────────────┬───────────────────────────────┬───────────────────────────────────────┤
│ Pipeline Komersial Terverifikasi│ Kontrak Aktif Berjalan        │ Realisasi Pembayaran Vendor (AP)      │
│ Rp 9.709.906.874               │ 29 Kontrak (Rp 5,47B Komersial)│ Rp 595.587.750 (11 Pembayaran)        │
│ 26 Menang · 1 Kalah · 135 Buka │ 8 Selesai Tepat Waktu (100%)  │ 100% Didukung Rekapitulasi Kas        │
│ Tingkat Kemenangan: 96,3%      │ S-Curve: On-Track pada 15 Proy│ Outstanding Faktur AP: Rp 21,96M      │
└────────────────────────────────┴───────────────────────────────┴───────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 02. HAMBATAN UTAMA (Quantified Blockers & Exposure)                                                    │
├────────────────────────────────┬───────────────────────────────┬───────────────────────────────────────┤
│ ⚠ 135 Tender Terbuka Stagnan   │ ⚠ 12 Proyek Belum Ada Baseline│ ⚠ 4 Kontrak Tertahan Legal Review     │
│ Rp 3.867.580.424 total nilai   │ Rp 4.314.150.000 komitmen     │ Tertahan 16–18 Hari Kalender          │
│ 100% melewati deadline tender  │ Tanpa jadwal & bobot WBS S-Curv│ Rp 36.848.453 total nilai tertunda    │
│ 134 tidak ada aktivitas >14 hr │ Resiko penundaan kickoff      │ Menghambat aktivasi kontrak operasiona│
├────────────────────────────────┴───────────────────────────────┴───────────────────────────────────────┤
│ ⚠ Resiko Marjin Negatif Pra-Kickoff: Proyek #50 (JNT Bogor) Estimasi Biaya (RAB) melebihi Kontrak!     │
│   Nilai Kontrak: Rp 1.775.000.000 | Estimasi Biaya: Rp 1.776.594.600 | Defisit: -Rp 1.594.600 (-0,09%)│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 03. ACTION & DECISION NEEDED (Pemisahan Tegas Otoritas Direktur vs Operasional PIC)                   │
├────────────────────────────────────────────────────────────────┬───────────────────────────────────────┤
│ 👑 KEPUTUSAN DIREKTUR (4 Butuh Persetujuan Eksekutif)          │ 🛠 TINDAK LANJUT OPERASIONAL PIC      │
├────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
│ 1. [GO_NOGO_APPROVAL] Tender #262 (Age: 6.1d)                  │ 1. Legal Review: Selesaikan 4 kontrak │
│    Customer: PT Global Jet Express | Nilai: Rp 450M            │    tertahan (#16, #17, #26, #30)      │
│    [ Review & Putuskan → ]                                     │    PIC: Tim Legal [ Buka Antrean → ]  │
│ 2. [DIRECTOR FINAL APPROVAL] 3 Penugasan Proyek (Age: 5.1d)    │ 2. Revisi Go/No-Go: Perbarui 3 tender │
│    Task #393, #394, #396 (Proyek Kudus, Pasir, JNT)            │    revisi (#146, #211, #212)          │
│    [ Setujui Penugasan Proyek → ]                              │    PIC: Marketing [ Buka Revisi → ]   │
│ 3. [MARGIN OVERRIDE] Draf RAB Negatif Proyek #50               │ 3. Jadwal PMO: Tetapkan baseline 12   │
│    Setujui revisi pemotongan RAB atau batalkan tender          │    proyek perencanaan                 │
│    [ Buka Form Override Marjin → ]                             │    PIC: PMO Lead [ Buat Jadwal → ]    │
│                                                                │ 4. Treasury AP: Eksekusi pembayaran   │
│                                                                │    PRQ-20261115-001 (Rp 990.000)      │
│                                                                │    PIC: Finance [ Buka Antrean Kas → ]│
└────────────────────────────────────────────────────────────────┴───────────────────────────────────────┘
```

---

### TAB 2 — SALES & MARKETING INTELLIGENCE
- **Header KPI Row:**
  - *Tender Closed Win Rate (Count %):* `26 / (26 + 1) = 96,3%` (Commercial scope).
  - *Tender Closed Win Rate (Value %):* `Rp 5,47B / (Rp 5,47B + Rp 375M) = 93,6%`.
  - *Pipeline Conversion Yield:* `26 / 162 = 16,0%` (Commercial scope).
  - *Active Open Pipeline:* `Rp 3.867.580.424` (`135` Open Tenders).
  - *Average Won Deal Size:* `Rp 210.281.787` (Excluding test tenders).
- **Interactive Visualizations:**
  - **Stage-Transition Conversion Funnel:** Renders historical flow: `Prospek Masuk (162)` $\rightarrow$ `Lolos Go/No-Go (31)` $\rightarrow$ `Kualifikasi (30)` $\rightarrow$ `Proposal (28)` $\rightarrow$ `Negosiasi (27)` $\rightarrow$ `Menang (26)`. (Excludes LOST from intermediate steps).
  - **12-Month Monotonic Trendline:** Monthly pipeline creation with clean ascending Y-axis in `Juta / Miliar` (fixing inverted labels).
- **PIC Performance Leaderboard (With Unassigned Queue Isolation):**
  - Displays distinct columns: `Nama PIC`, `Nilai Open`, `Nilai Won`, `Nilai Lost`, `Win Rate %`, `Status Kinerja`.
  - Real PICs: `Dwi Ragil` (36 Open Rp 1,13B, 14 Won Rp 463M), `Lukas` (0 Open, 3 Won Rp 4,65B).
  - **Unassigned / Marketing Desk Queue:** Dedicated sub-table for `marketing@epms.com` (`id=4709`, 99 Open Rp 2,74B, 9 Won Rp 353M commercial) labeled *"Antrean Prospek Belum Terdistribusi"*.
- **Overdue Opportunity Watchlist:**
  - Table of 135 open tenders past `bid_submission_deadline`, showing Days Overdue, Customer, Estimated Budget, and Action Link (`Perbarui Deadline` or `Tandai Lost`).

---

### TAB 3 — PROJECT DELIVERY & PROGRESS CONTROL
- **Header KPI Row:**
  - *Total Active Projects:* `19 Proyek` (`12 PLANNING`, `7 IN_PROGRESS`).
  - *Closed On-Time Completion Rate:* `100,0%` (`8 / 8 Proyek Selesai Tepat Waktu` vs `end_date`).
  - *Weighted Schedule Health:* `15 Baselined Projects` (`14 ON_TRACK`, `1 SLIGHT_DELAY`, `0 BEHIND`).
  - *Unbaselined Planning Exposure:* `12 Proyek` (`Rp 4.314.150.000` tanpa tanggal).
- **PMO S-Curve Portfolio Table (Powered by `project-control.calculator.ts`):**
  - Columns: `Kode Proyek`, `Nama Proyek`, `Manajer Proyek`, `Target Selesai`, `Progress Rencana (%)`, `Progress Aktual (%)`, `Deviasi (pp)`, `Status Kesehatan`, `Task Overdue`, `Aksi`.
  - Health Badges: Green (`ON_TRACK` variance $\ge -5\%$), Yellow (`SLIGHT_DELAY` variance $-15\%$ to $-5\%$), Red (`BEHIND` variance $< -15\%$), Gray (`NO_BASELINE`).
- **Unbaselined Planning Watchlist:**
  - Dedicated callout panel for Projects `#50, #51, #52, #54, #55, #56, #58, #59, #60, #89, #90, #91` warning that physical execution cannot begin without approved baseline S-curve.
- **Pre-Kickoff RAB Margin Risk Register:**
  - Highlighting Project `#50` (`JNT Bogor`, Contract Rp 1,775B vs RAB Rp 1,777B, **`-Rp 1,59M`** deficit) and Project `#51` (`J&T Kudus`, Contract Rp 377,4M vs RAB Rp 375M, **`+0,64%`** thin buffer).

---

### TAB 4 — PROCUREMENT & COST CONTROL (Standalone Management Domain)
- **Header KPI Row:**
  - *Total PO Commitments:* `Rp 17.788.506.821` (`24 PO`: `13 Material` Rp 16,27B + `11 Service` Rp 1,52B raw; `Rp 607,9M` commercial).
  - *Material Physical Receipt (GR) Rate:* `100,0%` (`13 / 13 Material PO Selesai Diterima`).
  - *Service Progressive Fulfillment Rate:* `25,2%` (`Rp 383,35M Klaim Disetujui` dari `Rp 1,52B Komitmen Servis`).
  - *Uninvoiced PO Exposure:* **`Rp 1.443.322.470`** (`PO #18 & PO #21 Belum Ditagihkan Vendor`).
  - *Segregation of Duties Compliance:* `13 Peringatan SOD` (`Klaim Servis Disetujui Pembuat`).
- **Procurement Waterfall Visualization:**
  - Multi-stage funnel: `PR Diajukan (Rp 17,79B)` $\rightarrow$ `PO Diterbitkan (Rp 17,79B)` $\rightarrow$ `Fisik/Servis Diterima (Rp 16,65B)` $\rightarrow$ `Faktur Terverifikasi (Rp 16,34B)` $\rightarrow$ `Kas Terbayar (Rp 16,32B)`.
- **Open Service PO Backlog Table:**
  - List of 11 Service POs in `ISSUED` status showing Subcontractor, Service Order details, Approved Claims, and Remaining Unclaimed Balance.
- **Vendor Performance & Lead Time Matrix:**
  - Average PR-to-PO conversion turnaround time and vendor fulfillment delivery punctuality.

---

### TAB 5 — FINANCE & TAX GOVERNANCE
- **Header KPI Row:**
  - *Realisasi Pembayaran Vendor (AP Paid):* `Rp 16.323.222.707` (`19 Pembayaran`: `Rp 595,6M` komersial + `Rp 15,73B` test).
  - *Faktur Vendor Belum Lunas (Outstanding AP):* `Rp 21.961.644` (`4 Faktur Terverifikasi`).
  - *Antrean Kas Siap Bayar:* `1 PRQ` (`Rp 990.000` di `APPROVED_FOR_PAYMENT`).
  - *PRQ Terkendala Revisi:* `3 PRQ` (`Rp 19.862.644` di `NEEDS_REVISION`).
  - *Customer Sales Revenue / AR / Gross Margin:* **`NOT AVAILABLE (Belum Tersedia)`**.
- **AP Aging & Invoice Settlement Schedule:**
  - Invoices grouped by aging from `invoice_date`: Current ($0-30\text{d}$), Overdue ($31-60\text{d}$, $61-90\text{d}$, $>90\text{d}$).
- **Entity Bank Account Outflow Matrix:**
  - Attribution of disbursements to company bank accounts: PT UBD BCA Account (`id=1`) vs unclassified historical payments.
- **Tax Governance & Compliance Panel:**
  - *PPN Masukan (Input VAT):* `Rp 2.083.500` (PT UBD, creditable with e-Faktur Pajak).
  - *PPh Withholding Liability:* Tax withheld from vendors (statutory liability owed to state treasury).
  - *Bukti Setor Pajak (NTPN):* Displaying explicit counter: *"0 Transaksi Setoran Pajak Terverifikasi NTPN"*.
  - *Customer AR Disclosure Box:* Formal callout explaining that EPMS operates as an Operational Procurement and Cost Management system; Customer Billing and Accounts Receivable remain outside the current database boundary.

---

### TAB 6 — LEGAL & COMPLIANCE GOVERNANCE
- **Header KPI Row:**
  - *Portofolio Kontrak Aktif:* `29 Kontrak` (`Rp 106.422.378.808` total nilai komitmen).
  - *Antrean Review Legal Tertunda:* `4 Kontrak` (`Rp 36.848.453`, tertahan `16–18 Hari Kalender`).
  - *Kepatuhan Grace Period SPK Tender (48 Jam):* `29 VERIFIED`, `4 PENDING_REVIEW`, `0 SPK_REQUIRED`.
  - *Kepatuhan Revisi Kontrak (72 Jam SLA):* `0 Kontrak Kedaluwarsa (REVISION_EXPIRED)`.
  - *Kepatuhan SLA Alur Kerja:* `Tanpa Batas Waktu (412 Task Historis due_at = NULL)`.
- **Aged Legal Review Queue Table:**
  - Detailed listing of Contracts `#16, #17, #26, #30` showing Contract Number, Customer, Value, Created Date, Elapsed Days (16.8d to 18.1d), Assigned Reviewer, and Urgent Review Action Link.
- **Rule Separation Architecture:**
  - Separate visual cards for:
    1. *Tender SPK 48h Grace Expiration* (demotes tender to `SPK_REQUIRED`).
    2. *Contract 72h Revision Expiration* (moves contract to `REVISION_EXPIRED`).
    3. *Workflow Task SLA Turnaround* (measured against `workflow_tasks.due_at`).
- **Entity & Master Data Quality Register:**
  - Identifies customer duplicates (`PT Asianet Media Teknologi` vs `PT. ASIANET MEDIA TEKNOLOGI`, `JNT EXPRESS` vs `PT GLOBAL JET EXPRESS`) and unnormalized sector tags.

---

## 4. Responsive Viewport & PWA Specifications

| Viewport Range | Grid Architecture | Navigation Behavior | Card & Table Adjustments |
| :--- | :--- | :--- | :--- |
| **Desktop ($> 1200\text{px}$)** | 24-column Ant Design grid; 3 to 4 KPI cards per row; full-width data tables. | Horizontal tab header with icons and badge counters; sticky global control bar. | Full interactive charts with hover tooltips; multi-column action tables. |
| **Tablet ($768\text{px} - 1199\text{px}$)** | 24-column grid; 2 KPI cards per row (`Col span={12}`); scrollable tables. | Horizontal scrollable tab strip; stacked global control bar. | Condensed chart axes; tables enable horizontal scroll with frozen key columns. |
| **Mobile / PWA ($< 768\text{px}$)** | Single column (`Col span={24}`); full-width stacked cards. | Mobile tab bar or drawer dropdown; sticky bottom action sheet for critical alerts. | Simplified KPI cards with swipeable carousel; tables render as mobile-friendly cards. |

---

*End of Six-Tab Management Intelligence UI/UX Specification.*
