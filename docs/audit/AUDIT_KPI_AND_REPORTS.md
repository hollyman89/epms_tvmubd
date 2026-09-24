# AUDIT KPI & REPORTS REPORT — EPMS UBD & TVM

**MODE**: READ ONLY AUDIT  
**DATABASE**: `epms_tvmubd_db`  
**RULES**: 0 Code Changes | 0 Database Changes | 0 Implementation | Pure Diagnostic Audit  

---

# EXECUTIVE SUMMARY

Audit **KPI & REPORTS** bertujuan memetakan kesiapan data aktual pada sistem EPMS untuk mendukung pembuatan Dashboard Eksekutif, Analisis Pemasaran, Performa Proyek, Analisis Keuangan, dan Tata Kelola Legal secara realistis tanpa berasumsi.

---

# PHASE 1 — DATA INVENTORY BY MODULE

### 1. Marketing Module
- **Entities & Tables**: `tenders`, `proposals`, `customers`, `tender_activities`, `tender_price_history`.
- **Field Kunci KPI**: `estimated_budget`, `negotiated_price`, `stage` (`QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`), `status`, `go_nogo_status`, `spk_verification_status` (`UNVERIFIED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`, `SPK_REQUIRED`), `marketing_pic_id`, `customer_id`.
- **Status Data Completeness**: **LENGKAP (Schema Ready)**.
- **Relasi Entity**: `tenders.customer_id` $\rightarrow$ `customers.id`, `tenders.marketing_pic_id` $\rightarrow$ `users.id`, `proposals.tender_id` $\rightarrow$ `tenders.id`.
- **Endpoint Tersedia**: `GET /api/v1/marketing/tenders`, `GET /api/v1/customers`.
- **Endpoint Belum Tersedia**: `GET /api/v1/marketing/analytics/kpi` (Agregasi Win Rate, Pipeline Funnel).

### 2. Project Delivery Module
- **Entities & Tables**: `projects`, `milestones`, `work_breakdown_structures`, `tasks`.
- **Field Kunci KPI**: `projects.status`, `start_date`, `end_date`, `milestones.is_completed`, `target_date`, `tasks.status`, `due_date`.
- **Status Data Completeness**: **PARSIAL (Schema 0 Rows saat ini, butuh entri transaksi)**.
- **Relasi Entity**: `projects.contract_id` $\rightarrow$ `contracts.id`, `milestones.project_id` $\rightarrow$ `projects.id`, `tasks.wbs_id` $\rightarrow$ `work_breakdown_structures.id`.
- **Endpoint Tersedia**: `GET /api/v1/project/operational-board`, `GET /api/v1/projects`.
- **Endpoint Belum Tersedia**: `GET /api/v1/projects/analytics/kpi` (Schedule Performance Index / Delay Ratio).

### 3. Finance & Cost Module
- **Entities & Tables**: `contracts`, `project_budgets`, `invoices`, `payments`.
- **Field Kunci KPI**: `contracts.contract_amount`, `tax_amount`, `total_amount`, `dp_amount`, `dp_percentage`, `margin_percentage`, `gross_profit`, `project_budgets.planned_amount`, `actual_amount`, `remaining_amount`, `invoices.status`, `payments.amount_paid`.
- **Status Data Completeness**: **LENGKAP PADA CONTRACTS, PARSIAL PADA INVOICE/BUDGET**.
- **Relasi Entity**: `contracts.proposal_id` $\rightarrow$ `proposals.id`, `project_budgets.project_id` $\rightarrow$ `projects.id`, `payments.invoice_id` $\rightarrow$ `invoices.id`.
- **Endpoint Tersedia**: `GET /api/v1/legal/contracts`, `GET /api/v1/governance/contracts`.
- **Endpoint Belum Tersedia**: `GET /api/v1/finance/analytics/kpi` (Margin Variance, Budget vs Actual).

### 4. Procurement Module
- **Entities & Tables**: `vendors`, `purchase_requests`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `vendor_comparisons`.
- **Field Kunci KPI**: `vendors.vendor_type`, `purchase_requests.total_estimated_amount`, `purchase_orders.total_amount`, `status`, `vendor_comparisons.is_winner`.
- **Status Data Completeness**: **PARSIAL (Schema Ready, 0 Rows)**.
- **Relasi Entity**: `purchase_orders.vendor_id` $\rightarrow$ `vendors.id`, `purchase_requests.project_id` $\rightarrow$ `projects.id`.
- **Endpoint Tersedia**: `GET /api/v1/procurement/prs`, `GET /api/v1/procurement/pos`, `GET /api/v1/procurement/vendors`.
- **Endpoint Belum Tersedia**: `GET /api/v1/procurement/analytics/kpi` (Vendor Expenditure & Fulfillment).

### 5. Legal & Governance Module
- **Entities & Tables**: `contracts`, `contract_amendments`, `audit_logs`.
- **Field Kunci KPI**: `contracts.legal_status` (`DRAFT`, `ON_REVIEW`, `APPROVED`, `REJECTED`), `spk_file_url`, `contract_amendments.id`, `audit_logs.action`.
- **Status Data Completeness**: **LENGKAP**.
- **Relasi Entity**: `contracts.legal_reviewer_id` $\rightarrow$ `users.id`, `contract_amendments.contract_id` $\rightarrow$ `contracts.id`.
- **Endpoint Tersedia**: `GET /api/v1/legal/contracts/pending`, `GET /api/v1/governance/contracts`.
- **Endpoint Belum Tersedia**: `GET /api/v1/legal/analytics/kpi` (Legal Approval Rate, Governance Health).

---

# PHASE 2 — KPI FEASIBILITY ANALYSIS

| KPI Name | Data Source | Formula / Logic | Feasibility Status |
|----------|-------------|-----------------|-------------------|
| **1. Tender Win Rate (%)** | `tenders` | `WON / (WON + LOST) * 100` | **READY 🟢** |
| **2. Total Pipeline Value (Rp)** | `tenders` | `SUM(estimated_budget)` grouped by `stage` | **READY 🟢** |
| **3. Go / No-Go Approval Ratio (%)** | `tenders` | `COUNT(GO) / COUNT(GO + NO_GO) * 100` | **READY 🟢** |
| **4. SPK Compliance & Demotion Count** | `tenders` | `COUNT(spk_verification_status = 'SPK_REQUIRED')` | **READY 🟢** |
| **5. Contract Gross Profit & Margin (%)** | `contracts` | `SUM(gross_profit)`, `AVG(margin_percentage)` | **READY 🟢** |
| **6. Legal Review Approval Rate (%)** | `contracts` | `APPROVED / (APPROVED + REJECTED) * 100` | **READY 🟢** |
| **7. Customer Distribution by Industry** | `customers` | `COUNT(id)` grouped by `industry` | **READY 🟢** |
| **8. Tender Distribution per PIC** | `tenders` | `COUNT(tenders)` grouped by `marketing_pic_id` | **READY 🟢** |
| **9. Down-Payment (DP) Realization** | `contracts` | `AVG(dp_percentage)`, `SUM(dp_amount)` | **READY 🟢** |
| **10. Negotiation Discount Rate (%)** | `tenders` | `AVG((estimated_budget - negotiated_price) / estimated_budget) * 100` | **READY 🟢** |
| **11. Project Budget Variance** | `project_budgets` | `SUM(actual_amount) - SUM(planned_amount)` | **PARTIAL 🟡** |
| **12. Milestone Completion Rate (%)** | `milestones` | `COUNT(is_completed = 1) / COUNT(*) * 100` | **PARTIAL 🟡** |
| **13. Invoice Payment Realization (%)** | `invoices`, `payments` | `SUM(amount_paid) / SUM(total_amount) * 100` | **PARTIAL 🟡** |
| **14. Legal Review Turnaround Time** | `contracts` | `AVG(approved_at - submitted_at)` | **NOT READY 🔴** |
| **15. Project Schedule Delay Index** | `projects`, `tasks` | `DATEDIFF(actual_end_date, end_date)` | **NOT READY 🔴** |

---

# PHASE 3 — GAP ANALYSIS

| Missing KPI | Missing Data / Field | Missing Endpoint | Effort Estimation |
|-------------|----------------------|------------------|-------------------|
| **Legal Review Turnaround Time** | `submitted_at`, `approved_at` timestamps in `contracts` | `GET /legal/analytics/turnaround` | **Low** (2 DB columns + listener) |
| **Sales Cycle Pipeline Velocity** | Stage transition timestamps per tender | `GET /marketing/analytics/velocity` | **Low-Medium** (Query `tender_activities`) |
| **Project Schedule Delay (SPI)** | `actual_start_date`, `actual_end_date` in `projects`/`tasks` | `GET /project/analytics/delay` | **Medium** (Schema update & task progress) |
| **Vendor Delivery SLA Rating** | `expected_date`, `actual_date`, `rating` in `goods_receipts` | `GET /procurement/analytics/sla` | **Medium** (Schema update) |
| **AR Aging Analysis (30/60/90 Days)** | Invoice payment schedule & overdue tracking | `GET /finance/analytics/ar-aging` | **Medium** (Invoice aging logic) |

---

# PHASE 4 — ENTERPRISE KPI RECOMMENDATION

### 1. Executive Dashboard
- **READY**: Tender Win Rate, Total Contract Value, Total Active Pipeline Value, Active Customer Count, SPK Compliance Status.
- **PARTIAL**: Total Contract Gross Profit, Overall Budget Variance.
- **NOT READY**: Project Schedule Performance Index (SPI), Total Cashflow Realization.

### 2. Marketing Analytics
- **READY**: Win/Loss Rate by Stage, Pipeline Value Distribution, Go/No-Go Decision Rate, SPK Required Expiration Count, Deal Size per PIC.
- **PARTIAL**: Conversion Rate per Customer Tier.
- **NOT READY**: Sales Cycle Velocity (Average Days to Close).

### 3. Project Performance
- **READY**: Total Active Projects Count.
- **PARTIAL**: Milestone Completion Rate, Budget Consumption per Category, Task Completion Status.
- **NOT READY**: Earned Value Management (EVM), Project Delay Days.

### 4. Finance Analytics
- **READY**: Total Contract Amount, Average Gross Margin %, Total DP Collected Amount.
- **PARTIAL**: Invoice Payment Realization Rate, Pending Invoice Collection.
- **NOT READY**: Accounts Receivable (AR) Aging (30/60/90 Days).

### 5. Governance Analytics
- **READY**: Legal Approval vs Rejection Rate, SPK Required Demotion Count, Contract Amendment Count.
- **PARTIAL**: Audit Log Action Count per Module.
- **NOT READY**: Legal Review Turnaround Time (Average Days).

---

# OUTPUT WAJIB

## 1. Current Data Maturity Score: `6.5 / 10`
*Alasan*: Schema database `epms_tvmubd_db` sangat matang dengan 36 tabel komprehensif. Seluruh field transaksi utama (seperti budget, negotiated price, stage, SPK verification status, margin percentage, gross profit, go/no-go status, legal status) **sudah 100% tersedia**. Nilai belum 10/10 karena KPI tingkat lanjut yang membutuhkan timestamp historis (seperti review turnaround time dan actual vs planned project dates) memerlukan beberapa kolom timestamp tambahan.

## 2. Top 10 KPI yang Bisa Dibuat SEKARANG (Tanpa Perubahan Backend)
1. **Tender Win Rate (%)**: `WON / (WON + LOST)`
2. **Total Sales Pipeline Value (Rp)**: `SUM(estimated_budget)` per stage
3. **Go / No-Go Pass Ratio (%)**: `GO vs NO_GO`
4. **SPK Compliance & Grace Period Expiration Count**: `COUNT(SPK_REQUIRED)`
5. **Contract Gross Profit (Rp) & Average Margin (%)**: `SUM(gross_profit)`, `AVG(margin_percentage)`
6. **Legal Review Approval Rate (%)**: `APPROVED / (APPROVED + REJECTED)`
7. **Active Customer Count & Distribution by Industry**: `COUNT(customers)` per `industry`
8. **Tender Distribution per Marketing PIC**: `COUNT(tenders)` per `marketing_pic_id`
9. **Contract Down-Payment (DP) Realization**: `AVG(dp_percentage)` & `SUM(dp_amount)`
10. **Negotiation Discount Rate (%)**: `AVG(estimated_budget - negotiated_price)`

## 3. Top 10 KPI yang Membutuhkan Enhancement
1. **Average Legal Review Turnaround Time (Hari)** (*Butuh timestamps `submitted_at` / `approved_at`*).
2. **Sales Cycle Pipeline Velocity (Hari per Stage)** (*Butuh stage transition log timestamps*).
3. **Project Schedule Delay Index (SPI)** (*Butuh `actual_start_date` / `actual_end_date`*).
4. **Earned Value Management (EVM - EV/PV/AC)** (*Butuh column progress % pada WBS/tasks*).
5. **Vendor Delivery SLA & Fulfillment Rate (%)** (*Butuh expected vs actual delivery date di GR*).
6. **Accounts Receivable (AR) Aging (30/60/90 Hari)** (*Butuh invoice payment aging tracker*).
7. **Contract Revision Cycles Count** (*Butuh tracking siklus revisi legal*).
8. **Cost Variance at Completion (VAC)** (*Butuh real-time sync budget vs actual PO/Invoice*).
9. **Vendor Quality Performance Rating (1-5 Stars)** (*Butuh column rating pada vendor comparison*).
10. **User Adoption & System Usage Velocity** (*Butuh sesi audit log aggregation per departemen*).

## 4. Rekomendasi Struktur Menu KPI & Reports
- **Lokasi Sidebar**: `KPI & Reports` (URL: `/reports`)
- **Navigasi Tab Internal**:
  - `Tab 1`: **Executive Overview** (Kuesioner Eksekutif: Win Rate, Active Pipeline, Total Margin, Customer Count)
  - `Tab 2`: **Marketing Analytics** (Pipeline Funnel, Win/Loss Rate, PIC Performance, SPK Compliance)
  - `Tab 3`: **Project Performance** (Project Operational Status, Milestone Track, Budget Utilization)
  - `Tab 4`: **Finance & Margin Analytics** (Gross Profit, Margin %, DP Realization)
  - `Tab 5`: **Governance & Legal** (Legal Approval Rate, Contract Amendments, Audit Trail)

## 5. Daftar File yang HARUS Diubah (Jika Implementasi Disetujui)
- **Backend Files**:
  1. `backend/src/modules/marketing/marketing.service.ts` (Metode agregasi KPI Pemasaran)
  2. `backend/src/modules/legal/legal.service.ts` (Metode agregasi KPI Legal/Governance)
  3. `backend/src/modules/project/project.service.ts` (Metode agregasi KPI Proyek)
  4. `backend/src/modules/dashboard/dashboard.service.ts` (Service aggregator utama KPI)
  5. `backend/src/modules/dashboard/dashboard.controller.ts` (Pengikatan REST API Endpoints KPI)
- **Frontend Files**:
  1. `frontend/src/components/MainLayout.tsx` (Pengaktifan route `/reports` dari menu sidebar)
  2. `frontend/src/app/(dashboard)/reports/page.tsx` (Halaman utama Dashboard KPI & Analytics)
  3. `frontend/src/components/reports/ExecutiveDashboardTab.tsx` (Tab Eksekutif)
  4. `frontend/src/components/reports/MarketingAnalyticsTab.tsx` (Tab Analytics Pemasaran)
  5. `frontend/src/components/reports/GovernanceAnalyticsTab.tsx` (Tab Governance & Legal)

---

**STOP.**  
Audit selesai. Tidak ada kode yang diubah, tidak ada file baru yang diimplementasikan. Menunggu persetujuan pengguna.
