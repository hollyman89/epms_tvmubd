# EPMS UBD & TVM — Master KPI & Metric Governance Dictionary
## Formal Business Definitions, Mathematical Formulas & Lineage Catalog

**Project:** Enterprise Procurement Management System (EPMS) — UBD & TVM
**Target Module:** `/reports` (and unified reporting integration with `/dashboard`)
**Audit Reference Commit:** `4a6f88c7fd335652c4d9028cbc77267f7165bb65` (`origin/main`)
**Semantic State Model:** `ACTUAL`, `TARGET`, `FORECAST`, `UNAVAILABLE`, `UNVERIFIED`, `DATA_EXCEPTION`
**Reference Date:** 16 November 2026
**Execution Mode:** `SPECIFICATION & DOCUMENTATION ONLY`

---

## 1. Dictionary Architecture & Standard Format (15 Mandatory Fields)

Every KPI defined below is governed by 15 mandatory fields. No metric may be rendered on any EPMS dashboard without satisfying this specification:

```text
1. KPI Code & Name         : Unique identifier and official display name
2. Business Definition     : Plain-language operational meaning
3. Mathematical Formula    : Exact LaTeX equation
4. Numerator               : Precise database calculation for numerator
5. Denominator             : Precise database calculation for denominator (or N/A)
6. Source Tables           : MySQL table(s) queried
7. Source Fields           : Specific columns used in computation
8. Filters & Exclusions    : Exact WHERE clauses, status conditions, and soft-deletes
9. Entity Scope            : Resolution rule across PT UBD, PT TVM, UNCLASSIFIED, and ALL
10. Data Classification    : COMMERCIAL_ONLY vs INCLUDE_TEST (Quarantine rule)
11. Period Definition      : Time window application (Asia/Jakarta boundaries)
12. Refresh Frequency      : Real-time, 5-minute cache, or daily EOD snapshot
13. Responsible Owner      : Department head / executive PIC accountable for metric
14. Verification Method    : Automated test area or query script verifying correctness
15. Known Limitations      : Documented audit gaps, schema caveats, or unpopulated fields
```

---

## 2. Sales & Marketing Intelligence Domain (Tab 2 & Executive)

### `KPI-SAL-01` — Active Open Commercial Pipeline Value
1. **Name:** Active Open Commercial Pipeline Value (*Nilai Pipeline Terbuka Komersial*)
2. **Business Definition:** Total value of active prospective tenders currently being pursued that have not yet reached a final winning or losing outcome.
3. **Formula:**
   $$\text{Pipeline}_{\text{open}} = \sum \text{COALESCE}(\text{negotiated\_price}, \text{estimated\_budget})$$
4. **Numerator:** Sum of negotiated price (or estimated budget fallback) for all open tenders.
5. **Denominator:** `N/A` (Currency Amount in IDR).
6. **Source Tables:** `tenders`.
7. **Source Fields:** `tenders.negotiated_price`, `tenders.estimated_budget`, `tenders.status`, `tenders.deleted_at`.
8. **Filters & Exclusions:** `status NOT IN ('WON', 'LOST') AND deleted_at IS NULL`. Default excludes `data_classification = 'TEST_SANDBOX'`.
9. **Entity Scope:** Filtered by `tenders.company_code` (`UBD` / `TVM` / `UNCLASSIFIED` / `ALL`).
10. **Data Classification:** `COMMERCIAL_ONLY` returns `Rp 3.867.580.424` (`135` open deals); `INCLUDE_TEST` returns `Rp 3.867.580.424` (all 7 test tenders are status WON).
11. **Period Definition:** As of current query moment (active inventory), or filtered by `created_at` within period window.
12. **Refresh Frequency:** Near real-time / 5-minute cached.
13. **Responsible Owner:** Director of Marketing.
14. **Verification Method:** Test Area 13; cross-checked against `SELECT SUM(...) FROM tenders WHERE status NOT IN ('WON', 'LOST')`.
15. **Known Limitations:** 135 of 135 open deals have already passed their bid submission deadline (addressed in `DEC-BI-05`).

---

### `KPI-SAL-02` — Closed-Deal Tender Win Rate (Count % & Value %)
1. **Name:** Closed-Deal Tender Win Rate (*Tingkat Kemenangan Tender Tertutup*)
2. **Business Definition:** Percentage of concluded tender opportunities won against all decided tender outcomes (excluding open/in-progress opportunities).
3. **Formula:**
   $$\text{Win Rate}_{\text{count}} = \frac{\text{COUNT}(\text{status} = \text{'WON'})}{\text{COUNT}(\text{status} = \text{'WON'}) + \text{COUNT}(\text{status} = \text{'LOST'})} \times 100\%$$
   $$\text{Win Rate}_{\text{value}} = \frac{\sum \text{Value}(\text{status} = \text{'WON'})}{\sum \text{Value}(\text{status} = \text{'WON'}) + \sum \text{Value}(\text{status} = \text{'LOST'})} \times 100\%$$
4. **Numerator:** Count (or IDR sum) of tenders where `status = 'WON'`.
5. **Denominator:** Count (or IDR sum) of tenders where `status IN ('WON', 'LOST')`. Returns `UNAVAILABLE` (`null`) when denominator is 0.
6. **Source Tables:** `tenders`.
7. **Source Fields:** `tenders.status`, `tenders.negotiated_price`, `tenders.estimated_budget`.
8. **Filters & Exclusions:** `status IN ('WON', 'LOST') AND deleted_at IS NULL`. Excludes open, draft, cancelled, and test tenders.
9. **Entity Scope:** `tenders.company_code`.
10. **Data Classification:** `COMMERCIAL_ONLY` returns **`26 Won / 27 Decided = 96,30%`** (`Rp 5,47B / Rp 5,84B = 93,58%`); `INCLUDE_TEST` returns `33 / 34 = 97,06%` (`Rp 106,45B / Rp 106,83B = 99,65%`).
11. **Period Definition:** Filtered by decision timestamp (fallback `tenders.updated_at` or `contracts.created_at`) within `[start, end]`.
12. **Refresh Frequency:** 5-minute cache.
13. **Responsible Owner:** Director of Marketing.
14. **Verification Method:** Test Area 1 (Mock fixtures testing 0 outcomes, 1 win / 0 lost, and standard cohorts).
15. **Known Limitations:** Pending management ratification under `DEC-BI-01`. High win rate reflects historical practice of recording tenders only when closing confidence was very high.

---

### `KPI-SAL-03` — Pipeline Funnel Conversion Yield
1. **Name:** Pipeline Funnel Conversion Yield (*Tingkat Konversi Hasil Funnel*)
2. **Business Definition:** Percentage of all registered tender leads in a cohort that successfully convert into won contracts.
3. **Formula:**
   $$\text{Funnel Yield} = \frac{\text{COUNT}(\text{status} = \text{'WON'})}{\text{COUNT}(\text{Total Tenders in Cohort})} \times 100\%$$
4. **Numerator:** Count of `WON` tenders created in period.
5. **Denominator:** Total count of tenders created in period (`WON + LOST + OPEN`).
6. **Source Tables:** `tenders`.
7. **Source Fields:** `tenders.status`, `tenders.created_at`.
8. **Filters & Exclusions:** `deleted_at IS NULL`. Excludes test records in commercial mode.
9. **Entity Scope:** `tenders.company_code`.
10. **Data Classification:** `COMMERCIAL_ONLY` returns **`26 / 162 = 16,05%`**; `INCLUDE_TEST` returns `33 / 169 = 19,53%`.
11. **Period Definition:** Cohort based on `tenders.created_at` within period bounds.
12. **Refresh Frequency:** 5-minute cache.
13. **Responsible Owner:** Director of Marketing.
14. **Verification Method:** Test Area 1; verified distinct from `KPI-SAL-02`.
15. **Known Limitations:** Sensitive to backlog of dormant leads (135 unclosed tenders depress this metric).

---

### `KPI-SAL-04` — Average Won Deal Size
1. **Name:** Average Won Deal Size (*Nilai Rata-rata Kontrak Menang*)
2. **Business Definition:** The arithmetic mean value of signed and won commercial tender awards.
3. **Formula:**
   $$\text{Avg Deal Size} = \frac{\sum_{\text{status}=\text{'WON'}} \text{COALESCE}(\text{negotiated\_price}, \text{estimated\_budget})}{\text{COUNT}(\text{status}=\text{'WON'})}$$
4. **Numerator:** Sum of contract values for won deals.
5. **Denominator:** Total count of won deals. Returns `UNAVAILABLE` when 0 won deals.
6. **Source Tables:** `tenders`.
7. **Source Fields:** `tenders.negotiated_price`, `tenders.estimated_budget`, `tenders.status`.
8. **Filters & Exclusions:** `status = 'WON' AND deleted_at IS NULL`.
9. **Entity Scope:** `tenders.company_code`.
10. **Data Classification:** `COMMERCIAL_ONLY` returns **`Rp 210.281.787`** (`26 WON = Rp 5,47B`); `INCLUDE_TEST` returns `Rp 3.225.819.509` (distorted 15.3x by single Rp 100B test tender #166).
11. **Period Definition:** Award date within period window.
12. **Refresh Frequency:** 5-minute cache.
13. **Responsible Owner:** Head of Sales.
14. **Verification Method:** SQL comparison: `SELECT AVG(...) FROM tenders WHERE status = 'WON'`.
15. **Known Limitations:** In commercial data, deals range from Rp 300k to Rp 2,13B (wide dispersion requires median supplement).

---

### `KPI-SAL-05` — Overdue / Stagnant Tender Exposure
1. **Name:** Overdue / Stagnant Tender Exposure (*Eksposur Prospek Melewati Batas Waktu*)
2. **Business Definition:** Total count and IDR value of active open tenders whose submission deadline has expired or that have had zero activity for $\ge 14$ days.
3. **Formula:**
   $$\text{Stagnant Value} = \sum_{\text{open}} \text{Value} \quad \text{where } (\text{bid\_submission\_deadline} < \text{NOW}() \text{ OR DATEDIFF}(\text{NOW}(), \text{updated\_at}) \ge 14)$$
4. **Numerator:** Sum of value of overdue/stagnant tenders.
5. **Denominator:** `N/A` (and count of stagnant deals).
6. **Source Tables:** `tenders`.
7. **Source Fields:** `tenders.bid_submission_deadline`, `tenders.submission_deadline`, `tenders.updated_at`, `tenders.status`.
8. **Filters & Exclusions:** `status NOT IN ('WON', 'LOST') AND deleted_at IS NULL`.
9. **Entity Scope:** `tenders.company_code`.
10. **Data Classification:** Currently **`135 / 135` (`100%`)** open tenders are overdue, totaling **`Rp 3.867.580.424`**.
11. **Period Definition:** Current live inventory status.
12. **Refresh Frequency:** Real-time / Hourly.
13. **Responsible Owner:** Director of Marketing & Marketing PICs.
14. **Verification Method:** Test Area 4; cross-checked against `DEC-BI-05` review register.
15. **Known Limitations:** Deadlines may have been verbally extended by customers without system update.

---

### `KPI-SAL-06` — Marketing PIC Sales Performance
1. **Name:** Marketing PIC Sales Performance (*Kinerja Penjualan per PIC Marketing*)
2. **Business Definition:** Per-salesperson breakdown strictly separating Active Open Pipeline, Won Contract Value, Lost Value, and Closed Win Rate.
3. **Formula:** Multi-column array per `marketing_pic_id`:
   $$\{\text{openCount}, \text{openValue}, \text{wonCount}, \text{wonValue}, \text{lostCount}, \text{winRate}\}$$
4. **Numerator / Denominator:** Computed independently per column according to its respective definition.
5. **Source Tables:** `tenders`, `users`.
6. **Source Fields:** `tenders.marketing_pic_id`, `tenders.created_by`, `users.id`, `users.full_name`.
7. **Filters & Exclusions:** Excludes soft-deleted tenders. Generic account `marketing@epms.com` (`id=4709`) segregated into an Unassigned section.
8. **Entity Scope:** Optional entity filter.
9. **Data Classification:** Commercial vs test split.
10. **Period Definition:** Decision date within period bounds.
11. **Refresh Frequency:** 5-minute cache.
12. **Responsible Owner:** Head of Marketing.
13. **Verification Method:** Test Area 4; assert that summing table columns equals summary cards exactly.
14. **Known Limitations:** Historical deals handled by generic account cannot be attributed to individuals without `DEC-BI-08` review.

---

## 3. Project Delivery / PMO Domain (Tab 3 & Executive)

### `KPI-PMO-01` — Active Project Portfolio Breakdown
1. **Name:** Active Project Portfolio Breakdown (*Komposisi Portofolio Proyek Aktif*)
2. **Business Definition:** Distribution of all operational projects across lifecycle states: Planning, In Progress (Execution), and Closed.
3. **Formula:** Counts grouped by `projects.status`.
4. **Numerator:** Count per status.
5. **Denominator:** Total project count (`27`).
6. **Source Tables:** `projects`.
7. **Source Fields:** `projects.id`, `projects.status`, `projects.deleted_at`.
8. **Filters & Exclusions:** `deleted_at IS NULL`. Excludes test projects (`#3–#6, #88, #96, #124`) in commercial view.
9. **Entity Scope:** `projects.company_code`.
10. **Data Classification:** Raw: `12 PLANNING, 7 IN_PROGRESS, 8 CLOSED`; Commercial: `12 PLANNING, 3 IN_PROGRESS (#7, #49, #57), 5 CLOSED (#1, #2, #8, #9, #53)`.
11. **Period Definition:** Current live portfolio inventory.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** PMO Director.
14. **Verification Method:** Test Area 9; verified against `projects` table.
15. **Known Limitations:** 12 of 12 PLANNING projects have NULL start and end dates.

---

### `KPI-PMO-02` — Closed Project On-Time Delivery Rate
1. **Name:** Closed Project On-Time Delivery Rate (*Tingkat Ketepatan Waktu Proyek Selesai*)
2. **Business Definition:** Percentage of closed projects whose actual physical finish date was on or before the contractual/planned end date.
3. **Formula:**
   $$\text{On-Time Rate} = \frac{\text{COUNT}(\text{status} = \text{'CLOSED'} \land \text{actual\_finish\_at} \le \text{end\_date})}{\text{COUNT}(\text{status} = \text{'CLOSED'})} \times 100\%$$
4. **Numerator:** Count of closed projects where `actual_finish_at <= end_date`.
5. **Denominator:** Total count of projects with `status = 'CLOSED'`.
6. **Source Tables:** `projects`.
7. **Source Fields:** `projects.status`, `projects.actual_finish_at`, `projects.end_date`.
8. **Filters & Exclusions:** `status = 'CLOSED' AND deleted_at IS NULL`.
9. **Entity Scope:** `projects.company_code`.
10. **Data Classification:** **`8 / 8 = 100,0%`** (all 8 closed projects have recorded `actual_finish_at` prior to `end_date`).
11. **Period Definition:** Closed within period window.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** PMO Director.
14. **Verification Method:** Test Area 9; verify calculator reads `actualFinishAt` instead of null.
15. **Known Limitations:** Does not measure mid-project milestone punctuality (since `milestones` table has 0 rows).

---

### `KPI-PMO-03` — Weighted Schedule S-Curve Variance
1. **Name:** Weighted Schedule S-Curve Variance (*Deviasi Jadwal Kurva-S Berbobot*)
2. **Business Definition:** Cumulative percentage point difference between earned progress and planned baseline progress across baselined active projects.
3. **Formula:**
   $$\text{Variance (pp)} = \text{Actual Progress \%} - \text{Planned Baseline Progress \%}$$
4. **Numerator / Denominator:** Calculated via `project-control.calculator.ts` from `project_baseline_wbs_items` leaf weights and verified `project_progress_logs`.
5. **Source Tables:** `project_baselines`, `project_baseline_wbs_items`, `project_progress_logs`.
6. **Source Fields:** `weight_percentage`, `reported_progress`, `effective_date`.
7. **Filters & Exclusions:** Active baselines (`active_project_id IS NOT NULL`) on `IN_PROGRESS` projects.
8. **Entity Scope:** `projects.company_code`.
9. **Data Classification:** 15 projects baselined (all 15 have 100% leaf weight totals).
10. **Period Definition:** Effective as of latest verified progress log.
11. **Refresh Frequency:** Hourly / Daily.
12. **Responsible Owner:** Lead Project Manager / PMO.
13. **Verification Method:** Test Area 9; test S-curve calculator against isolated fixture with intentional schedule delay.
14. **Known Limitations:** Unavailable for the 12 PLANNING projects that lack baselines.

---

### `KPI-PMO-04` — Unbaselined Planning Project Exposure
1. **Name:** Unbaselined Planning Project Exposure (*Eksposur Proyek Perencanaan Tanpa Baseline*)
2. **Business Definition:** Total signed contract value of projects sitting in `PLANNING` status without baseline schedules or start/end dates.
3. **Formula:**
   $$\text{Unbaselined Value} = \sum_{\text{status}=\text{'PLANNING'}} \text{contract\_value} \quad \text{where baseline\_count} = 0$$
4. **Numerator:** Sum of contract values for unbaselined projects.
5. **Denominator:** Total project count in planning (`12`).
6. **Source Tables:** `projects`, `contracts`, `project_baselines`.
7. **Source Fields:** `projects.status`, `projects.start_date`, `projects.end_date`, `contracts.contract_value`.
8. **Filters & Exclusions:** `status = 'PLANNING' AND deleted_at IS NULL`.
9. **Entity Scope:** `projects.company_code`.
10. **Data Classification:** **`12 Proyek` totaling `Rp 4.314.150.000`** (100% unbaselined).
11. **Period Definition:** Current live inventory.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** PMO Lead.
14. **Verification Method:** Test Area 9; verified from `check_projects.js` script.
15. **Known Limitations:** All 12 projects created between 29–30 October 2026.

---

### `KPI-PMO-05` — Pre-Kickoff Project RAB Planned Margin
1. **Name:** Pre-Kickoff Project RAB Planned Margin (*Marjin Estimasi Biaya RAB Pra-Kickoff*)
2. **Business Definition:** Expected gross profit margin computed by subtracting estimated total cost (RAB) from contract value prior to execution.
3. **Formula:**
   $$\text{Margin \%} = \frac{\text{Contract Value} - \sum \text{cost\_items.subtotal}}{\text{Contract Value}} \times 100\%$$
4. **Numerator:** Contract Value minus Cost Estimate Total.
5. **Denominator:** Contract Value. Returns `UNAVAILABLE` when no cost estimate exists.
6. **Source Tables:** `contracts`, `project_cost_estimates`, `cost_items`.
7. **Source Fields:** `contracts.contract_value`, `cost_items.subtotal`, `project_cost_estimates.status`.
8. **Filters & Exclusions:** `cost_items.deleted_at IS NULL`. Includes both `APPROVED` and `DRAFT` estimates (flagged accordingly).
9. **Entity Scope:** `projects.company_code`.
10. **Data Classification:** Flags critical anomaly on **Project #50 (`JNT Bogor`)**: Contract `Rp 1.775.000.000` vs DRAFT RAB `Rp 1.776.594.600` = **`-Rp 1.594.600` (`-0,09%` Planned Deficit)**. Also flags Project #51 (`+0,64%` thin margin).
11. **Period Definition:** As of cost estimate version.
12. **Refresh Frequency:** Daily / On estimate update.
13. **Responsible Owner:** Cost Control Lead & PM.
14. **Verification Method:** Test Area 9; script verifying contract vs cost_items calculation.
15. **Known Limitations:** 6 planning projects currently lack any cost estimate.

---

## 4. Procurement & Cost Control Domain (Tab 4 & Executive)

### `KPI-PRO-01` — Total Purchase Order Commitments
1. **Name:** Total Purchase Order Commitments (*Total Komitmen Purchase Order*)
2. **Business Definition:** Legal purchasing obligations committed to suppliers and subcontractors across Material and Service orders.
3. **Formula:**
   $$\text{PO Commitment} = \sum \text{purchase\_orders.total\_amount}$$
4. **Numerator:** Sum of `total_amount` on issued purchase orders.
5. **Denominator:** `N/A`.
6. **Source Tables:** `purchase_orders`.
7. **Source Fields:** `purchase_orders.total_amount`, `purchase_orders.status`.
8. **Filters & Exclusions:** `status IN ('ISSUED', 'COMPLETED') AND deleted_at IS NULL`. Default excludes test POs.
9. **Entity Scope:** `purchase_orders.company_code`.
10. **Data Classification:** Raw: `Rp 17.788.506.821` (`24 PO`: `13 Material` Rp 16,27B + `11 Service` Rp 1,52B); Commercial: **`Rp 607.874.394`** (`12 PO`).
11. **Period Definition:** PO issue date within period window.
12. **Refresh Frequency:** Real-time / 5-minute cache.
13. **Responsible Owner:** Head of Procurement.
14. **Verification Method:** Test Area 6; query verified via `check_po_lifecycle.js`.
15. **Known Limitations:** 12 of 24 POs are tied to test projects (e.g. PO #19 = Rp 15,13B).

---

### `KPI-PRO-02` — Material Goods Receipt (GR) Fulfillment Rate
1. **Name:** Material Goods Receipt Fulfillment Rate (*Tingkat Pemenuhan Fisik Barang GR*)
2. **Business Definition:** Percentage of committed Material purchase orders that have verified physical Goods Receipt documentation.
3. **Formula:**
   $$\text{Material GR Rate} = \frac{\text{COUNT}(\text{Material PO with GR})}{\text{COUNT}(\text{Total Material POs})} \times 100\%$$
4. **Numerator:** Count of Material POs with linked `goods_receipts`.
5. **Denominator:** Total count of Material POs (`13`).
6. **Source Tables:** `purchase_orders`, `goods_receipts`.
7. **Source Fields:** `goods_receipts.po_id`, `purchase_orders.id`.
8. **Filters & Exclusions:** Limited to Material POs (`resource_type = 'MATERIAL'`).
9. **Entity Scope:** `purchase_orders.company_code`.
10. **Data Classification:** **`13 / 13 = 100,0%`** (`Rp 16.267.385.495` received).
11. **Period Definition:** Cumulative or filtered by PO date.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** Warehouse / Logistics Lead.
14. **Verification Method:** Test Area 6; cross-checked against 13 GR records.
15. **Known Limitations:** Applies strictly to physical goods; services must NEVER be measured by this metric.

---

### `KPI-PRO-03` — Service Claim Approved Delivery Fulfillment Rate
1. **Name:** Service Claim Fulfillment Rate (*Tingkat Realisasi Klaim Progres Jasa*)
2. **Business Definition:** Value of approved subcontractor service claims compared to total committed Service purchase orders.
3. **Formula:**
   $$\text{Service Fulfillment \%} = \frac{\sum \text{service\_claims.approved\_claim\_amount}}{\sum \text{Service PO total\_amount}} \times 100\%$$
4. **Numerator:** Sum of `approved_claim_amount` on verified service claims (`Rp 383.346.869,37`).
5. **Denominator:** Total value of committed Service POs (`Rp 1.521.121.326,00`).
6. **Source Tables:** `service_claims`, `purchase_orders`.
7. **Source Fields:** `service_claims.approved_claim_amount`, `purchase_orders.total_amount`.
8. **Filters & Exclusions:** `status = 'APPROVED_FOR_INVOICE'` on claims; Service POs only.
9. **Entity Scope:** `purchase_orders.company_code`.
10. **Data Classification:** **`Rp 383,35M / Rp 1,52B = 25,20%`**.
11. **Period Definition:** Cumulative active contract balance.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** Subcontractor Management / PM.
14. **Verification Method:** Test Area 6; query verified via `check_po_lifecycle.js`.
15. **Known Limitations:** Service POs remain in `ISSUED` status until contract closeout.

---

### `KPI-PRO-04` — Uninvoiced Open PO Exposure
1. **Name:** Uninvoiced Open PO Exposure (*Eksposur Komitmen PO Belum Ditagih Vendor*)
2. **Business Definition:** Total committed purchase order value where vendor invoices have not yet been received or entered into the system.
3. **Formula:**
   $$\text{Uninvoiced PO} = \sum (\text{PO Total} - \text{Invoiced Total})$$
4. **Numerator:** Difference between PO amount and total approved invoice lines.
5. **Denominator:** `N/A`.
6. **Source Tables:** `purchase_orders`, `invoices`.
7. **Source Fields:** `purchase_orders.total_amount`, `invoices.total_amount`, `invoices.po_id`.
8. **Filters & Exclusions:** POs without invoices or with remaining uninvoiced balance.
9. **Entity Scope:** `purchase_orders.company_code`.
10. **Data Classification:** Specifically identifies **`PO #18` (Rp 1.409.669.970)** and **`PO #21` (Rp 33.652.500)** = **`Rp 1.443.322.470` uninvoiced exposure**.
11. **Period Definition:** Current live ledger status.
12. **Refresh Frequency:** Daily.
13. **Responsible Owner:** Procurement Specialist.
14. **Verification Method:** Test Area 6; verified from `check_po_lifecycle.js`.
15. **Known Limitations:** Represents future incoming AP liability that has not yet hit the balance sheet.

---

### `KPI-PRO-05` — Procurement Segregation of Duties (SOD) Compliance
1. **Name:** Segregation of Duties Compliance (*Kepatuhan Pemisahan Tugas Pengadaan*)
2. **Business Definition:** Count of transaction approval actions where the creator/submitter also acted as the commercial verifier or approver.
3. **Formula:** Count of audit log entries matching `SERVICE_CLAIM_SOD_EXCEPTION`.
4. **Numerator:** SOD breach instances.
5. **Denominator:** Total approved service claims (`13`).
6. **Source Tables:** `audit_logs`, `service_claims`.
7. **Source Fields:** `audit_logs.action`, `service_claims.submitted_by`, `service_claims.commercial_verifier_id`.
8. **Filters & Exclusions:** Action = `SERVICE_CLAIM_SOD_EXCEPTION`.
9. **Entity Scope:** Corporate-wide.
10. **Data Classification:** **`13 Pelanggaran SOD Tercatat`** in `audit_logs`.
11. **Period Definition:** Historical cumulative.
12. **Refresh Frequency:** Real-time on event.
13. **Responsible Owner:** Internal Audit / Governance Lead.
14. **Verification Method:** Test Area 12; SQL query on `audit_logs`.
15. **Known Limitations:** Occurred during initial testing/staging workflows; highlights need for strict software enforcement.

---

## 5. Finance & Tax Governance Domain (Tab 5 & Executive)

### `KPI-FIN-01` — Verified Vendor Cash Disbursements (AP Paid)
1. **Name:** Verified Vendor Cash Disbursements (*Realisasi Pengeluaran Kas Vendor*)
2. **Business Definition:** Actual cash disbursed from company bank accounts to suppliers and subcontractors supported by executed payment records.
3. **Formula:**
   $$\text{AP Paid} = \sum \text{payments.amount\_paid}$$
4. **Numerator:** Sum of `amount_paid` on executed payments.
5. **Denominator:** `N/A`.
6. **Source Tables:** `payments`.
7. **Source Fields:** `payments.amount_paid`, `payments.company_bank_account_id`.
8. **Filters & Exclusions:** `payments.deleted_at IS NULL`.
9. **Entity Scope:** `payments.company_code` (and linked bank account).
10. **Data Classification:** Raw: `Rp 16.323.222.707` (`19` payments); Commercial: **`Rp 595.587.750`** (`11` payments; 8 test payments = Rp 15,73B).
11. **Period Definition:** Payment execution date within period window.
12. **Refresh Frequency:** Real-time on payment settlement.
13. **Responsible Owner:** Finance Manager / Treasurer.
14. **Verification Method:** Test Area 6; matches 19 rows in `payments`.
15. **Known Limitations:** Must NEVER be labeled or substituted as Customer Sales Revenue.

---

### `KPI-FIN-02` — Outstanding Verified Vendor AP Invoices
1. **Name:** Outstanding Verified Vendor AP Invoices (*Tagihan Vendor Terverifikasi Belum Lunas*)
2. **Business Definition:** Total verified vendor billing invoices awaiting cash settlement.
3. **Formula:**
   $$\text{Outstanding AP} = \sum_{\text{status}=\text{'UNPAID'}} \text{invoices.total\_amount}$$
4. **Numerator:** Sum of `total_amount` where `status = 'UNPAID'`.
5. **Denominator:** `N/A`.
6. **Source Tables:** `invoices`.
7. **Source Fields:** `invoices.total_amount`, `invoices.status`, `invoices.invoice_date`.
8. **Filters & Exclusions:** `status = 'UNPAID' AND deleted_at IS NULL`.
9. **Entity Scope:** `invoices.company_code`.
10. **Data Classification:** **`4 Faktur` totaling `Rp 21.961.644`** (aged 2–3 days).
11. **Period Definition:** Current live balance.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** AP Supervisor.
14. **Verification Method:** Test Area 6; query verified via `scratch/check_po_lifecycle.js`.
15. **Known Limitations:** Invoices lack a dedicated `due_date` column; aging computed from `invoice_date`.

---

### `KPI-FIN-03` — Treasury Payment Request (PRQ) Bottleneck Volume
1. **Name:** Treasury PRQ Bottleneck Volume (*Volume Antrean & Hambatan Permohonan Pembayaran*)
2. **Business Definition:** Monitoring of Payment Requests stalled in revision or waiting in the treasury disbursement queue.
3. **Formula:** Counts and sums grouped by `payment_requests.status`.
4. **Numerator:** IDR sum and count per status.
5. **Denominator:** `N/A`.
6. **Source Tables:** `payment_requests`.
7. **Source Fields:** `payment_requests.status`, `payment_requests.requested_amount`, `payment_requests.approved_amount`.
8. **Filters & Exclusions:** `deleted_at IS NULL`.
9. **Entity Scope:** `payment_requests.company_code`.
10. **Data Classification:**
    - `APPROVED_FOR_PAYMENT`: **`1 PRQ = Rp 990.000`** (Ready for disbursement).
    - `NEEDS_REVISION`: **`3 PRQ = Rp 19.862.644`** (Stalled in revision).
    - `REJECTED`: `1 PRQ = Rp 18.067.056`.
    - `PAID`: `19 PRQ = Rp 16.323.619.707`.
11. **Period Definition:** Current live queue.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** Treasury Lead / Finance Director.
14. **Verification Method:** Test Area 6; query verified via `scratch/check_po_lifecycle.js`.
15. **Known Limitations:** 3 stalled PRQs are the direct root cause of the 4 unpaid invoices.

---

### `KPI-FIN-04` — Creditable PPN Input Tax (Masukan)
1. **Name:** Creditable PPN Input Tax (*PPN Masukan Dapat Dikreditkan*)
2. **Business Definition:** Value-Added Tax (VAT) paid to suppliers on procurement purchases that can be credited against output VAT liabilities.
3. **Formula:**
   $$\text{PPN Masukan} = \sum \text{ppn\_masukan\_records.ppn\_amount} \quad \text{where creditable} = \text{true}$$
4. **Numerator:** Sum of validated PPN Masukan amounts.
5. **Denominator:** `N/A`.
6. **Source Tables:** `ppn_masukan_records`, `invoice_tax_details`.
7. **Source Fields:** `ppn_masukan_records.ppn_amount`, `ppn_masukan_records.is_creditable`, `ppn_masukan_records.faktur_pajak_number`.
8. **Filters & Exclusions:** Valid e-Faktur Pajak alignment.
9. **Entity Scope:** PT UBD (`Rp 2.083.500` across 3 records).
10. **Data Classification:** 3 commercial tax records.
11. **Period Definition:** Tax period (Masa Pajak).
12. **Refresh Frequency:** Daily / On tax entry.
13. **Responsible Owner:** Tax Specialist / Controller.
14. **Verification Method:** Test Area 7; query on `ppn_masukan_records`.
15. **Known Limitations:** Must not be automatically assumed recoverable without formal e-Faktur validation.

---

### `KPI-FIN-05` — Statutory Tax Liabilities & Verified NTPN Remittance
1. **Name:** Statutory Tax Liabilities & NTPN Remittance (*Kewajiban Pajak & Bukti Setor Kas Negara*)
2. **Business Definition:** Total withholding tax obligations (PPh 21, 23, 4(2)) owed to the state treasury versus payments validated with state receipt numbers (NTPN).
3. **Formula:**
   $$\text{Remittance Rate} = \frac{\sum \text{tax\_remittance\_records.remittance\_amount}}{\sum \text{pph\_withholding\_records.withholding\_amount}} \times 100\%$$
4. **Numerator:** Sum of verified tax remittances.
5. **Denominator:** Sum of tax withheld from vendor payments.
6. **Source Tables:** `tax_remittance_records`, `pph_withholding_records`.
7. **Source Fields:** `remittance_amount`, `ntpn_number`, `withholding_amount`.
8. **Filters & Exclusions:** Verified NTPN records only.
9. **Entity Scope:** `company_code`.
10. **Data Classification:** Current state: **`0 Rows in tax_remittance_records`** $\rightarrow$ **`Nol Setoran Terverifikasi NTPN`**.
11. **Period Definition:** Monthly statutory tax period.
12. **Refresh Frequency:** Monthly.
13. **Responsible Owner:** Tax Specialist / CFO.
14. **Verification Method:** Test Area 7; query on tax tables.
15. **Known Limitations:** Withholding tax is an operational liability; it must NEVER be reported as remitted without NTPN proof.

---

### `KPI-FIN-06` — Customer Sales Revenue & Accounts Receivable (AR)
1. **Name:** Customer Sales Revenue & Accounts Receivable (*Pendapatan Penjualan & Piutang Pelanggan*)
2. **Business Definition:** Recognized customer billings, customer receivables, and project gross profit margin based on customer invoicing.
3. **Formula:** `N/A` — Formula cannot be computed because **zero customer billing tables exist in EPMS**.
4. **Numerator / Denominator:** `N/A`.
5. **Source Tables:** `NONE` (Table does not exist).
6. **Source Fields:** `NONE`.
7. **Filters & Exclusions:** `N/A`.
8. **Entity Scope:** `N/A`.
9. **Data Classification:** Strictly designated as **`UNAVAILABLE`** per `DEC-BI-06`.
10. **Period Definition:** `N/A`.
11. **Refresh Frequency:** `N/A`.
12. **Responsible Owner:** Chief Financial Officer (CFO).
13. **Verification Method:** Test Area 6; assert that `/reports` and `/dashboard` render `UNAVAILABLE` and never substitute Vendor AP.
14. **Known Limitations:** EPMS is currently an operational procurement and cost control system; customer billing must be deployed or integrated from corporate ERP before this metric can exist.

---

## 6. Legal & Governance Domain (Tab 6 & Executive)

### `KPI-LEG-01` — Active Contract Portfolio Value
1. **Name:** Active Contract Portfolio Value (*Nilai Portofolio Kontrak Aktif*)
2. **Business Definition:** Total legal commitment value of executed customer contracts currently in active status.
3. **Formula:**
   $$\text{Contract Portfolio} = \sum_{\text{status}=\text{'ACTIVE'}} \text{contracts.contract\_value}$$
4. **Numerator:** Sum of `contract_value` where `status = 'ACTIVE'`.
5. **Denominator:** `N/A`.
6. **Source Tables:** `contracts`.
7. **Source Fields:** `contracts.contract_value`, `contracts.status`.
8. **Filters & Exclusions:** `status = 'ACTIVE' AND deleted_at IS NULL`.
9. **Entity Scope:** Resolved via `contracts -> tenders.company_code` (pending `contracts.company_code`).
10. **Data Classification:** Raw: `29 Kontrak = Rp 106.422.378.808` (includes Contract #8 debug Rp 100B); Commercial: **`28 Kontrak = Rp 6.422.378.808`**.
11. **Period Definition:** Active inventory as of query date.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** Head of Legal.
14. **Verification Method:** Test Area 8; query verified via `scratch/check_contracts.js`.
15. **Known Limitations:** Contract value represents total commercial commitment, NOT recognized revenue.

---

### `KPI-LEG-02` — Aged Pending Legal Review Queue
1. **Name:** Aged Pending Legal Review Queue (*Antrean Tertunda Review Legal Usia Tinggi*)
2. **Business Definition:** Count and value of contracts waiting in Legal Review whose elapsed time exceeds standard SLA thresholds.
3. **Formula:**
   $$\text{Aged Legal Backlog} = \text{COUNT}(\text{status} = \text{'PENDING\_LEGAL\_REVIEW'} \land \text{DATEDIFF}(\text{NOW}(), \text{created\_at}) > 3\text{d})$$
4. **Numerator:** Count of contracts stuck $> 3$ business days.
5. **Denominator:** Total pending legal contracts (`4`).
6. **Source Tables:** `contracts`.
7. **Source Fields:** `contracts.status`, `contracts.created_at`, `contracts.contract_value`.
8. **Filters & Exclusions:** `status = 'PENDING_LEGAL_REVIEW' AND deleted_at IS NULL`.
9. **Entity Scope:** `company_code`.
10. **Data Classification:** Identifies **`4 Kontrak` (`#16, #17, #26, #30`) totaling `Rp 36.848.453` stuck for `16.8 to 18.1 Calendar Days`**.
11. **Period Definition:** Current live queue.
12. **Refresh Frequency:** Real-time.
13. **Responsible Owner:** Head of Legal & Legal Specialist.
14. **Verification Method:** Test Area 8; query verified via `scratch/check_contracts.js`.
15. **Known Limitations:** Contracts are waiting for tender SPK review and formal legal sign-off.

---

### `KPI-LEG-03` — Tender SPK 48-Hour Upload Grace Compliance
1. **Name:** Tender SPK 48-Hour Upload Grace Compliance (*Kepatuhan Batas Waktu Unggah SPK Tender 48 Jam*)
2. **Business Definition:** Tracking of winning tenders that must upload client SPK documents within 48 hours before automated demotion to `SPK_REQUIRED`.
3. **Formula:**
   $$\text{SPK Grace Compliance \%} = \frac{\text{COUNT}(\text{spk\_verification\_status} = \text{'VERIFIED'})}{\text{COUNT}(\text{tenders in WON stage})} \times 100\%$$
4. **Numerator:** Tenders with verified SPK upload within 48h.
5. **Denominator:** Total tenders in won stage (`33`).
6. **Source Tables:** `tenders`.
7. **Source Fields:** `tenders.spk_verification_status`, `tenders.grace_deadline`.
8. **Filters & Exclusions:** `status = 'WON' AND deleted_at IS NULL`.
9. **Entity Scope:** `tenders.company_code`.
10. **Data Classification:** Currently **`29 VERIFIED`**, **`4 PENDING_REVIEW`**, **`0 SPK_REQUIRED`**.
11. **Period Definition:** Cumulative won tenders.
12. **Refresh Frequency:** Real-time on event.
13. **Responsible Owner:** Head of Legal & Marketing PIC.
14. **Verification Method:** Test Area 8; cross-checked against `tenders.spk_verification_status`.
15. **Known Limitations:** Operates at the Tender level, completely distinct from contract revision expiration.

---

### `KPI-LEG-04` — Contract 72-Hour Legal Revision Expiration SLA
1. **Name:** Contract 72-Hour Legal Revision Expiration SLA (*Kepatuhan Batas Waktu Revisi Kontrak 72 Jam*)
2. **Business Definition:** Monitoring contracts returned by Legal for revision that must be resubmitted within 72 hours before transitioning to `REVISION_EXPIRED`.
3. **Formula:** Count of contracts where `contracts.status = 'REVISION_EXPIRED'`.
4. **Numerator:** Expired revision contracts.
5. **Denominator:** Total contracts returned for revision.
6. **Source Tables:** `contracts`.
7. **Source Fields:** `contracts.status`, `contracts.legal_status`.
8. **Filters & Exclusions:** `deleted_at IS NULL`.
9. **Entity Scope:** `company_code`.
10. **Data Classification:** Currently **`0 Kontrak`** in `REVISION_EXPIRED` status.
11. **Period Definition:** Current live status.
12. **Refresh Frequency:** Real-time on event.
13. **Responsible Owner:** Head of Legal.
14. **Verification Method:** Test Area 8; assert UI never labels revision expiry as *"Grace period 48 jam"*.
15. **Known Limitations:** Must never be conflated with Tender SPK 48h grace.

---

### `KPI-LEG-05` — Workflow Task SLA Compliance & Null-Deadline Disclosure
1. **Name:** Workflow Task SLA Compliance (*Kepatuhan SLA Alur Kerja & Keterbukaan Batas Waktu*)
2. **Business Definition:** Percentage of workflow tasks completed before their assigned deadline (`due_at`).
3. **Formula:**
   $$\text{Task SLA Compliance \%} = \frac{\text{COUNT}(\text{decided\_at} \le \text{due\_at})}{\text{COUNT}(\text{completed tasks with } \text{due\_at} \ne \text{NULL})} \times 100\%$$
4. **Numerator:** Tasks decided on or before deadline.
5. **Denominator:** Tasks with non-null `due_at`. Returns `UNVERIFIED` if denominator is 0.
6. **Source Tables:** `workflow_tasks`.
7. **Source Fields:** `workflow_tasks.due_at`, `workflow_tasks.decided_at`, `workflow_tasks.status`.
8. **Filters & Exclusions:** `status IN ('COMPLETED', 'RETURNED') AND deleted_at IS NULL`.
9. **Entity Scope:** Corporate-wide.
10. **Data Classification:** Current state: **`412 / 412 rows have due_at = NULL`** $\rightarrow$ Metric is designated **`UNVERIFIED (Tanpa Batas Waktu)`**.
11. **Period Definition:** Historical tasks.
12. **Refresh Frequency:** Real-time on task decision.
13. **Responsible Owner:** Operations Director.
14. **Verification Method:** Test Area 8; assert UI displays *"Tanpa Batas Waktu"* and never claims 100% compliance.
15. **Known Limitations:** Historical tasks predated the SLA deadline engine; `due_at` will be populated for new tasks in Phase B.

---

*End of Master KPI & Metric Governance Dictionary.*
