# KPI & REPORT MODULE AUDIT REPORT — EPMS UBD & TVM

**MODE**: READ ONLY AUDIT  
**DATABASE**: `epms_tvmubd_db`  
**BACKEND**: NestJS (`analytics.service.ts`, `dashboard.service.ts`, `marketing.service.ts`, `legal.service.ts`)  
**RULES**: 0 Code Changes | 0 DB Changes | 0 Endpoints Created | Pure Empirical Diagnostic Audit  

---

# 1. EXISTING DATA SOURCES

Audit sistem menunjukkan bahwa EPMS memiliki **36 tabel database** yang terbagi dalam modul-modul berikut sebagai sumber data KPI:

| Module Domain | Source Table | Key Columns / Fields | Current Data Status |
|---------------|--------------|----------------------|---------------------|
| **Marketing** | `tenders` | `estimated_budget`, `negotiated_price`, `stage`, `status`, `go_nogo_status`, `spk_verification_status`, `marketing_pic_id`, `customer_id`, `business_sector` | **Schema Ready & Functional** |
| **Marketing** | `proposals` | `proposed_amount`, `status`, `proposal_number`, `tender_id` | **Schema Ready** |
| **Marketing** | `customers` | `company_name`, `industry`, `tier`, `status`, `total_deals_count`, `total_revenue` | **Schema Ready** |
| **Marketing Log** | `tender_activities` | `type`, `content`, `tender_id`, `user_id`, `created_at` | **Schema Ready** |
| **Marketing Log** | `tender_price_history` | `old_price`, `new_price`, `reason`, `changed_by` | **Schema Ready** |
| **Legal** | `contracts` | `contract_amount`, `tax_amount`, `total_amount`, `dp_amount`, `dp_percentage`, `margin_percentage`, `gross_profit`, `legal_status`, `status`, `spk_file_url` | **Schema Ready & Functional** |
| **Legal** | `contract_amendments` | `contract_id`, `amendment_number`, `reason`, `approved_by` | **Schema Ready** |
| **Project Delivery**| `projects` | `code`, `name`, `status`, `start_date`, `end_date`, `contract_id`, `manager_id` | **Schema Ready** |
| **Project Delivery**| `milestones` | `project_id`, `name`, `target_date`, `is_completed` | **Schema Ready** |
| **Project Delivery**| `tasks` | `wbs_id`, `assignee_id`, `name`, `status`, `due_date` | **Schema Ready** |
| **Finance & Cost** | `project_budgets` | `project_id`, `category`, `planned_amount`, `actual_amount`, `remaining_amount` | **Schema Ready** |
| **Finance & Cost** | `invoices` | `po_id`, `invoice_number`, `total_amount`, `status` | **Schema Ready** |
| **Finance & Cost** | `payments` | `invoice_id`, `payment_number`, `amount_paid`, `payment_date` | **Schema Ready** |
| **Procurement** | `vendors` | `code`, `name`, `vendor_type`, `tax_id` | **Schema Ready** |
| **Procurement** | `purchase_requests` | `project_id`, `requester_id`, `pr_number`, `total_estimated_amount`, `status` | **Schema Ready** |
| **Procurement** | `purchase_orders` | `pr_id`, `vendor_id`, `po_number`, `total_amount`, `status` | **Schema Ready** |
| **System & Log** | `audit_logs` | `action`, `entity_name`, `entity_id`, `performed_by` | **Schema Ready** |
| **System & Log** | `notifications` | `user_id`, `title`, `is_read`, `notification_type`, `meta_data` | **Schema Ready** |

---

# 2. KPI CANDIDATE MATRIX

| KPI Name | Source Table | Feasibility Status | Description & Logic |
|----------|--------------|-------------------|---------------------|
| **1. Total Pipeline Value** | `tenders` | **READY 🟢** | `SUM(negotiated_price || estimated_budget)` |
| **2. Tender Win Rate (%)** | `tenders` | **READY 🟢** | `WON / (WON + LOST) * 100` (Sudah ada di `AnalyticsService`) |
| **3. Average Deal Size** | `tenders` | **READY 🟢** | `AVG(negotiated_price)` for `status='WON'` |
| **4. Pipeline Funnel by Stage** | `tenders` | **READY 🟢** | Kumulatif count per stage (`LEAD` $\rightarrow$ `QUALIFICATION` $\rightarrow$ `PROPOSAL` $\rightarrow$ `NEGOTIATION` $\rightarrow$ `WON`) |
| **5. Business Sector Revenue Share** | `tenders` | **READY 🟢** | `SUM(budget)` per `business_sector` (%) |
| **6. Go / No-Go Decision Ratio** | `tenders` | **READY 🟢** | `COUNT(GO) / COUNT(GO + NO_GO) * 100` |
| **7. SPK Governance Compliance** | `tenders` | **READY 🟢** | `COUNT(spk_verification_status = 'SPK_REQUIRED')` |
| **8. Legal Review Approval Rate** | `contracts` | **READY 🟢** | `COUNT(legal_status='APPROVED') / COUNT(APPROVED + REJECTED) * 100` |
| **9. Total Contract Value & Gross Profit** | `contracts` | **READY 🟢** | `SUM(total_amount)`, `SUM(gross_profit)` |
| **10. Average Contract Gross Margin (%)** | `contracts` | **READY 🟢** | `AVG(margin_percentage)` |
| **11. Customer Distribution & Top Clients** | `customers`, `tenders` | **READY 🟢** | `COUNT(customers)` per `industry` & top revenue clients |
| **12. Pending Approvals Count** | `purchase_requests`, `purchase_orders` | **READY 🟢** | `COUNT(PR status='DRAFT') + COUNT(PO status='DRAFT')` |
| **13. Budget Consumption Variance** | `project_budgets` | **PARTIAL 🟡** | `SUM(actual_amount) - SUM(planned_amount)` per `category` |
| **14. Milestone Completion Progress** | `milestones` | **PARTIAL 🟡** | `COUNT(is_completed = 1) / COUNT(*) * 100` |
| **15. Total PO Expenditure by Vendor** | `purchase_orders`, `vendors` | **PARTIAL 🟡** | `SUM(total_amount)` per `vendor_id` |
| **16. Actual Invoice Collection vs Revenue** | `invoices`, `payments` | **PARTIAL 🟡** | `SUM(amount_paid) / SUM(total_amount) * 100` |
| **17. Average Legal Review Turnaround Time** | `contracts` | **MISSING 🔴** | Membutuhkan kolom `submitted_to_legal_at` & `legal_approved_at` |
| **18. Sales Cycle Pipeline Velocity** | `tenders` | **MISSING 🔴** | Membutuhkan timestamp perubahan stage per tender |
| **19. Project Schedule Performance (SPI)** | `projects`, `tasks` | **MISSING 🔴** | Membutuhkan `actual_start_date` & `actual_end_date` |
| **20. Vendor Delivery SLA Rating** | `goods_receipts` | **MISSING 🔴** | Membutuhkan `expected_delivery_date` vs `actual_delivery_date` |

---

# 3. QUICK WINS (TANPA BACKEND BARU)

Berikut adalah KPI yang **bisa langsung dibuat pada frontend** menggunakan REST API yang sudah tersedia di backend (`analytics.service.ts` & `dashboard.service.ts`):

1. **Total Pipeline Value (Rp)** — Via `GET /api/v1/analytics/dashboard`
2. **Tender Win Rate (%)** — Via `GET /api/v1/analytics/dashboard`
3. **Average Deal Size (Rp)** — Via `GET /api/v1/analytics/dashboard`
4. **Total Deals Count** — Via `GET /api/v1/analytics/dashboard`
5. **12-Month Pipeline Trend Line** — Via `GET /api/v1/analytics/dashboard`
6. **Sector Value Distribution (%)** — Via `GET /api/v1/analytics/dashboard`
7. **Sales Funnel Breakdown** — Via `GET /api/v1/analytics/dashboard`
8. **NLG Smart Insights (Auto-Generated Text)** — Via `GET /api/v1/analytics/dashboard`
9. **Active Projects Count** — Via `GET /api/v1/dashboard/summary`
10. **Total Invoiced Revenue & PO Expenses** — Via `GET /api/v1/dashboard/summary`

---

# 4. MEDIUM EFFORT (AGREGASI SQL TAMBAHAN IN BACKEND)

KPI berikut memerlukan penambahan metode agregasi ringan di service backend yang ada (`marketing.service.ts`, `legal.service.ts`, `project.service.ts`):

1. **Go / No-Go Decision Pass Rate (%)**: Query count `go_nogo_status = 'GO'` pada `tenders`.
2. **SPK Grace Expiration Demotion Metric**: Query count `spk_verification_status = 'SPK_REQUIRED'` pada `tenders`.
3. **Legal Review Approval vs Rejection Rate (%)**: Query count `legal_status` pada `contracts`.
4. **Average Contract Margin (%) & Total Gross Profit**: Query `AVG(margin_percentage)` & `SUM(gross_profit)` pada `contracts`.
5. **Customer Concentration by Industry / Tier**: Query count `customers` grouped by `industry`.
6. **Tender Distribution per Marketing PIC**: Query `tenders` grouped by `marketing_pic_id`.

---

# 5. MISSING DATA (GAP ANALYSIS)

1. **Average Legal Review Turnaround Time (Hari)**:  
   *Data Kurang*: Belum ada kolom `submitted_at` dan `approved_at` pada tabel `contracts`.  
   *Solusi*: Menambahkan 2 kolom datetime pada `Contract` entity atau membaca dari `audit_logs`.
2. **Sales Cycle Pipeline Velocity (Durasi per Stage)**:  
   *Data Kurang*: Perubahan `stage` tender dicatat di `tender_activities`, namun belum ada timestamp terstruktur `stage_changed_at`.  
   *Solusi*: Melakukan query agregasi terhadap `tender_activities`.
3. **Project Schedule Delay & SPI (Schedule Performance Index)**:  
   *Data Kurang*: Tabel `projects` dan `tasks` belum memiliki kolom `actual_start_date` dan `actual_end_date`.  
   *Solusi*: Menambahkan kolom tanggal aktual eksekusi pada `Project` & `Task` entity.
4. **Vendor Fulfillment & Delivery SLA**:  
   *Data Kurang*: Tabel `goods_receipts` belum mencatat `expected_delivery_date` vs `actual_delivery_date`.  
   *Solusi*: Menambahkan kolom tracking penerimaan barang pada Procurement module.

---

# 6. RECOMMENDED KPI DASHBOARD V1

Struktur Dashboard V1 diurutkan berdasarkan prioritas bisnis dan kesiapan data 100%:

### Section 1: Executive Summary (High-Level KPIs)
- Total Active Pipeline Value (Rp)
- Tender Win Rate (%)
- Total Active Projects Count
- Total Contract Gross Profit & Average Margin (%)
- SPK Governance Compliance Count

### Section 2: Sales & Marketing Analytics
- Pipeline Funnel Stage Distribution (Lead $\rightarrow$ Qual $\rightarrow$ Prop $\rightarrow$ Neg $\rightarrow$ Won)
- 12-Month Pipeline Trend Chart
- Business Sector Market Share (%)
- Go / No-Go Decision Pass Rate (%)
- Marketing PIC Deal Load & Win Rate

### Section 3: Project Delivery Performance
- Active vs Completed Projects Count
- Operational Board Status Breakdown (Draft, In Progress, Completed)
- Milestone Completion Percentage
- Budget Consumption Rate (Planned vs Actual)

### Section 4: Finance & Cost Analytics
- Contract Total Value & Down Payment (DP) Realization
- Average Margin % per Project Category
- Total Procurement PO Expenses vs Revenue
- Pending Payment Invoices Count

### Section 5: Legal & Governance
- Legal Queue Review Status (Draft, On Review, Approved, Rejected)
- Legal Approval vs Rejection Rate (%)
- SPK Required Demotion Alert Counter
- Contract Amendments Count

---

# 7. ENTERPRISE BENCHMARK

| System Benchmark | Key Capability | EPMS Alignment & Current Gap |
|------------------|----------------|------------------------------|
| **Jira Cloud** | Velocity Charts, Burndown, Cycle Time, Issue Lead Time | EPMS memiliki status tracking solid, namun belum mencatat *cycle time* (durasi per stage). |
| **Salesforce** | Opportunity Funnel, Win/Loss Rate, Pipeline Velocity, Forecast | EPMS **SUDAH MEMILIKI** Funnel, Win Rate, Sector Distribution, & NLG Insights yang setara Salesforce V1. |
| **SAP Fiori 4.0** | Financial Margin, Budget vs Actual, Procurement PO Variance | EPMS memiliki `margin_percentage` & `gross_profit` pada `contracts`. Perlu penguatan sync ke `project_budgets`. |
| **ServiceNow** | SLA Adherence, Legal Review Lead Time, Approval Bottlenecks | EPMS memiliki Legal Review Status Queue yang bersih. Perlu timestamp untuk mengukur *turnaround lead time*. |
| **Microsoft Dynamics 365** | 360 Client Health, Customer LTV, Deal Size Distribution | EPMS memiliki tabel `customers` dengan `total_deals_count` & `total_revenue` yang siap ditampilkan. |

---

# 8. FINAL RECOMMENDATION

### **KPI & Reports V1 (Wajib Dibuat Pertama / Low Effort, High Value)**
- Menggunakan endpoint existing `GET /api/v1/analytics/dashboard` & `GET /api/v1/dashboard/summary`.
- Menampilkan: Executive Summary Cards, Pipeline Funnel Chart, 12-Month Trend Line, Sector Distribution, Win Rate %, Total Pipeline Value, Active Projects, dan NLG Insights Text.
- **Effort**: Frontend Only (`/reports` page).

### **KPI & Reports V2 (Medium Effort / Next Sprint)**
- Menambahkan 3 endpoint agregasi baru di backend: Marketing PIC Performance, Legal Approval Rate %, dan Contract Margin Breakdown.
- Menampilkan: Legal Governance Health, Go/No-Go Pass Rate, SPK Required Expiration Counter, dan Customer Industry Distribution.
- **Effort**: Backend Light Aggregation + Frontend Tabs.

### **KPI & Reports V3 (Advanced Enterprise / Future Roadmap)**
- Menambahkan timestamp columns (`submitted_at`, `approved_at`, `actual_start_date`, `actual_end_date`).
- Menampilkan: Legal Review Turnaround Time (Avg Days), Project Schedule Delay Index (SPI), Vendor Delivery SLA Rating, dan AR Aging (30/60/90 Days).
- **Effort**: DB Migration + Full Module Tracking.

---

**STOP.**  
Audit selesai. Tidak ada perubahan kode, migration, atau file baru yang dibuat. Menunggu persetujuan pengguna.
