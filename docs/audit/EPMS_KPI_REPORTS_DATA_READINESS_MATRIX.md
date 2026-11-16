# EPMS UBD & TVM — Data Readiness Matrix & Architectural Source Assessment
## Empirical Evaluation of 80 Database Tables Across Six Operational Domains

**Project:** Enterprise Procurement Management System (EPMS) — UBD & TVM
**Target Module:** `/reports` (and unified reporting integration with `/dashboard`)
**Audit Reference Commit:** `4a6f88c7fd335652c4d9028cbc77267f7165bb65` (`origin/main`)
**Database Audited:** `epms_tvmubd_db` (MySQL 8.0, 80 tables total)
**Reference Date:** 16 November 2026
**Execution Mode:** `READ-ONLY AUDIT & DOCUMENTATION ONLY`

---

## 1. Executive Data Readiness Assessment

### 1.1 The Core Tripartite Distinction: Availability vs Quality vs Legitimacy
Senior management dashboards often fail because technical teams conflate the physical existence of a database record with the business truth of a KPI. In EPMS UBD & TVM, forensic auditing establishes three distinct analytical dimensions:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. DATA AVAILABILITY (Physical Schema & Row Existence)                 │
│    Does the table exist in MySQL? Are there rows populated?             │
│    • Fact: 62 of 80 tables are populated; 18 tables have 0 rows.       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. DATA QUALITY (Sanitation, Completeness & Accuracy)                  │
│    Are the records legitimate business transactions or test artifacts? │
│    Are critical foreign keys, dates, and SLA deadlines populated?      │
│    • Fact: 91.2% of pipeline value is development test data.           │
│    • Fact: 100% of workflow tasks have due_at = NULL.                  │
│    • Fact: 100% of historical tenders/projects have company_code = NULL│
├────────────────────────────────────────────────────────────────────────┤
│ 3. KPI LEGITIMACY (Semantic & Business Formula Validity)              │
│    Does the implemented formula represent commercial reality?          │
│    Does it conflate vendor costs with customer revenue?                │
│    • Fact: AP vendor disbursement is NOT customer revenue.             │
│    • Fact: WON / (WON + LOST) is closed win rate; WON / ALL is yield.   │
└────────────────────────────────────────────────────────────────────────┘
```

**Architectural Verdict:**
EPMS possesses **high physical transactional data availability** for operational purchasing and contract flows, but suffers from **severe data quality pollution (test artifacts)** and **critical KPI legitimacy defects (hardcoded fallbacks, conflated formulas, missing customer billing/AR ledger)**. Management reporting cannot be deployed safely until the data governance gates in Phase B are executed.

---

## 2. Complete Physical Database Inventory (80 Tables)

### 2.1 The 18 Zero-Row Tables (Critical Gaps & Unutilized Modules)
The following 18 tables exist physically in `epms_tvmubd_db` but contain **0 rows** as of 16 November 2026:

| # | Table Name | Intended Business Domain | Current Row Count | Analytical Consequence on Reporting |
| :-: | :--- | :--- | :-: | :--- |
| 1 | `executive_kpi_targets` | BI Governance | **0** | UI targets (`35%`, `90%`, `15%`, `5%`) come from hardcoded JS constants; no approved corporate targets exist. |
| 2 | `milestones` | PMO Delivery | **0** | Milestone SLA completion rate cannot be computed from this table; partially proxied by `tasks.is_milestone`. |
| 3 | `project_budgets` | Project Cost Control | **0** | Formal project master budgets do not exist; cost control must rely on `project_cost_estimates` (`cost_items`). |
| 4 | `project_risks` | PMO Risk Management | **0** | Tab 3 Risk Matrix renders empty or fake 0; risk exposure metrics are `NOT AVAILABLE`. |
| 5 | `project_issues` | PMO Issue Tracking | **0** | Tab 3 Issue log is empty; operational blockers cannot be queried from this table. |
| 6 | `procurement_reconciliations` | Three-Way Matching | **0** | Material/Service PO reconciliation table is unutilized; matching must be derived from PO/GR/Invoice lines. |
| 7 | `contract_amendments` | Legal & Contracts | **0** | Contract value change history cannot be tracked via amendments; all contracts reflect static values. |
| 8 | `pph_withholding_records` | Tax Governance | **0** | PPh 21/23/4(2) withholding tax ledger has zero rows; withholding exposure must be derived from invoice lines. |
| 9 | `tax_remittance_records` | Tax Governance | **0** | Zero tax remittance records exist; **no statutory tax has verified NTPN proof of payment** in EPMS. |
| 10 | `tax_remittance_allocations` | Tax Governance | **0** | Tax payment allocation ledger is unutilized. |
| 11 | `tax_supporting_documents` | Tax Compliance | **0** | No tax invoices (e-Faktur PDF/XML) are formally attached to tax records. |
| 12 | `statutory_tax_liabilities` | Tax Governance | **0** | Periodic corporate tax liability summary table is unpopulated. |
| 13 | `tax_regime_rules` | Tax Configuration | **0** | Tax regime rules are hardcoded in application logic rather than driven by database rules. |
| 14 | `legal_entity_tax_profiles` | Entity Tax Setup | **0** | PT UBD and PT TVM corporate tax profiles (NPWP, KPP, PKP status) are not persisted in DB. |
| 15 | `vendor_tax_profiles` | Vendor Master Data | **0** | Vendor tax status (NPWP, PKP, PPh tariff) is not persisted in structured vendor profiles. |
| 16 | `invoice_item_tax_details` | Invoice Tax Lines | **0** | Granular per-item tax calculation table is empty; tax is captured at header `invoice_tax_details`. |
| 17 | `permissions` | RBAC Governance | **0** | Granular permission table is unpopulated (access control uses `roles` and `user_roles`). |
| 18 | `role_permissions` | RBAC Governance | **0** | Role-permission junction table is unpopulated. |

---

### 2.2 The 62 Populated Tables (Verified Row Counts & Integrity Status)

| # | Table Name | Verified Rows | Quality / Integrity Status | Primary Foreign Key Linkages |
| :-: | :--- | :-: | :--- | :--- |
| 1 | `executive_fact_snapshots` | **1,276,551** | Storage Bloat (Growing 5 min) | `run_id -> executive_analytics_runs` |
| 2 | `executive_summary_snapshots`| **27,040** | Storage Bloat | `run_id -> executive_analytics_runs` |
| 3 | `executive_action_snapshots` | **16,224** | Storage Bloat | `run_id -> executive_analytics_runs` |
| 4 | `outbox_events` | **6,423** | System Event Queue | Transaction outbox pattern |
| 5 | `notifications` | **6,083** | User Notification Store | User inbox delivery |
| 6 | `executive_analytics_runs` | **5,408** | Materializer Job Runs | Scheduled cron history |
| 7 | `push_outbox` | **4,576** | PWA Web Push Queue | Push notification delivery |
| 8 | `audit_logs` | **1,943** | Immutable Audit Trail | User action audit log (includes SOD exceptions) |
| 9 | `workflow_transitions` | **648** | Workflow History | Transition events between workflow states |
| 10 | `workflow_tasks` | **412** | **100% NULL due_at** | Active & completed task assignments (11 PENDING) |
| 11 | `tender_activities` | **251** | Unstructured Audit Log | Human-readable English text strings |
| 12 | `documents` | **212** | File Attachment Metadata | Contracts, SPK, technical proposals |
| 13 | `tenders` | **172** | **91.2% Test Data Pollution** | 169 active, 3 soft-deleted; 7 test tenders = Rp 101B |
| 14 | `cost_items` | **158** | Operational RAB Detail | `estimate_id -> project_cost_estimates` |
| 15 | `quotation_items` | **156** | Procurement Quotation Items | `quotation_id -> quotations` |
| 16 | `user_sessions` | **147** | Auth Session Log | User JWT sessions |
| 17 | `workflow_instances` | **129** | Workflow Orchestration | Parent instances for workflow state machines |
| 18 | `project_progress_logs` | **93** | PMO S-Curve Logs | `project_id, task_id, baseline_id` (Weighted progress) |
| 19 | `work_breakdown_structures` | **82** | WBS Master Tree | `project_id` hierarchical tree |
| 20 | `tasks` | **77** | PMO Work Tasks | `project_id, wbs_id` schedule tasks |
| 21 | `procurement_package_items` | **75** | PR Packaging Line Items | `package_id -> procurement_packages` |
| 22 | `purchase_order_items` | **75** | PO Item Details | `po_id -> purchase_orders` |
| 23 | `purchase_request_items` | **75** | PR Line Items | `pr_id -> purchase_requests` |
| 24 | `invoice_items` | **68** | Vendor Invoice Items | `invoice_id -> invoices` |
| 25 | `project_baseline_wbs_items`| **62** | Baselined S-Curve Weights | Sums to 100.00% leaf weights per baseline |
| 26 | `project_progress_evidence` | **55** | Site Progress Photos/Docs | Progress log verification evidence |
| 27 | `quotations` | **51** | Vendor Quotations | `rfq_id, vendor_id` |
| 28 | `vendor_comparisons` | **51** | Procurement Bid Analysis | Commercial & technical comparison sheets |
| 29 | `migrations` | **43** | TypeORM Schema Migrations | Database migration version tracking |
| 30 | `goods_receipt_items` | **41** | Physical Material Receipts | `gr_id -> goods_receipts` |
| 31 | `service_claim_items` | **36** | Service Fulfillment Lines | `claim_id -> service_claims` |
| 32 | `tender_price_history` | **34** | Tender Price Negotiations | Historical bidding negotiation rounds |
| 33 | `contracts` | **33** | 29 Active, 4 Pending Legal | `tender_id, customer_id` (No company_code column) |
| 34 | `proposals` | **33** | Commercial Proposals | `tender_id` linked proposal submissions |
| 35 | `projects` | **27** | 12 Planning, 7 Exec, 8 Closed | `contract_id` operational projects |
| 36 | `payment_requests` | **24** | 19 Paid, 1 Ready, 3 Rev, 1 Rej| Internal treasury payment approval queue |
| 37 | `po_payment_terms` | **24** | PO Payment Milestone Terms | `po_id` payment terms (DP, Termyn, Pelunasan) |
| 38 | `procurement_packages` | **24** | Sourced Procurement Batches | Grouping PR items into vendor packages |
| 39 | `purchase_orders` | **24** | **13 Material, 11 Service** | 13 COMPLETED (Material), 11 ISSUED (Service) |
| 40 | `purchase_requests` | **24** | All 24 status `PO_ISSUED` | Sourced from project WBS or operational needs |
| 41 | `invoices` | **22** | 18 Paid (Rp 16,32B), 4 Unpaid | Vendor AP invoices awaiting/settled |
| 42 | `rfqs` | **22** | Request For Quotations | Sourcing solicitations sent to vendors |
| 43 | `project_cost_estimates` | **20** | 14 Approved, 6 Draft | Project RAB cost estimates |
| 44 | `project_initial_conditions`| **20** | Site Kickoff Baseline | Pre-execution site survey condition logs |
| 45 | `payments` | **19** | 19 Vendor Cash Disbursements | `Rp 16.323.222.707` cash paid |
| 46 | `users` | **19** | System User Directory | Internal staff & test accounts |
| 47 | `user_roles` | **18** | Role Assignments | Junction table `user_id <-> role_id` |
| 48 | `project_management_reviews`| **17** | PMO Monthly Reviews | PM periodic reviews |
| 49 | `project_baselines` | **15** | 15 Baselined Projects | Versioned schedule baselines |
| 50 | `project_closures` | **15** | Project Closure Handover | Final acceptance & closure sign-offs |
| 51 | `push_subscriptions` | **15** | Web Push Device Endpoints | Browser push tokens |
| 52 | `service_orders` | **14** | Subcontractor Work Orders | `po_id` service work authorization orders |
| 53 | `goods_receipts` | **13** | **13 Material Receipts** | Executed delivery notes for 13 Material POs |
| 54 | `roles` | **13** | System Role Master | Director, PM, Finance, Legal, Marketing, etc. |
| 55 | `service_claims` | **13** | **13 Subcontractor Claims** | Fulfillment claims for 11 Service POs |
| 56 | `workflow_versions` | **10** | Workflow Engine Definitions | Versioned BPMN state machine definitions |
| 57 | `customers` | **7** | Duplicate Master Data | 3 variants of Asianet/SKF, 2 variants of JNT |
| 58 | `workflow_definitions` | **7** | Workflow Process Blueprints | Legal Review, Go/No-Go, Payment, etc. |
| 59 | `vendors` | **5** | Vendor Master Records | Subcontractors and material suppliers |
| 60 | `invoice_tax_details` | **3** | Verified PPN & PPh Tax Lines | Tax calculations for invoices INV-001/002/003 |
| 61 | `ppn_masukan_records` | **3** | Input VAT Records | Input VAT recorded for PT UBD (`Rp 2.083.500`) |
| 62 | `company_bank_accounts` | **1** | Treasury Master Account | PT UBD BCA Account (`id=1`) |

---

## 3. Domain-by-Domain Data Readiness Assessment

### 3.1 Domain 1: Executive Overview (Tab 1)

| Metric / Capability | Required Source Table(s) | Current Database State | Assessment Status | Action Required Before Production |
| :--- | :--- | :--- | :--- | :--- |
| **01. Pencapaian Utama** | `tenders`, `contracts`, `projects`, `payments` | Populated, but distorted 91% by test records. | `Available but inconsistent` | Apply Phase B `COMMERCIAL_ONLY` data classification filter. |
| **02. Hambatan Utama** | `workflow_tasks`, `tenders`, `contracts`, `invoices` | Populated (11 pending tasks, 4 aged contracts 16-18d, 4 unpaid invoices). | `Available and verified` | Aggregate aged bottlenecks quantified by IDR exposure and calendar delay days. |
| **03. Action & Decision Needed** | `workflow_tasks` (Role: DIRECTOR vs Others) | Populated: 4 Director decisions (`#262, #393, #394, #396`) vs 7 PIC actions. | `Available and verified` | Split into `directorDecisions[]` vs `operationalPicActions[]`; route via safe drill-down whitelist. |
| **Consolidated Revenue** | Customer Billing / Sales Ledger | **Zero tables exist in database.** | `Missing` | Display strictly as **`NOT AVAILABLE`**; do not substitute Vendor AP. |
| **Approved KPI Targets** | `executive_kpi_targets` | **0 rows.** | `Missing` | Display badge: **`TARGET BELUM DISAHKAN`** until DEC-BI-04 is signed. |

---

### 3.2 Domain 2: Sales & Marketing Intelligence (Tab 2)

| Metric / Capability | Required Source Table(s) | Current Database State | Assessment Status | Action Required Before Production |
| :--- | :--- | :--- | :--- | :--- |
| **Closed-Deal Win Rate** | `tenders` (`status = 'WON' / 'LOST'`) | 33 Won, 1 Lost raw; 26 Won, 1 Lost ex-test. Backend uses broken `COUNT(id)`. | `Available but inconsistent` | Fix denominator to `WON / (WON + LOST)`; return `UNAVAILABLE` when 0. |
| **Pipeline Conversion Yield** | `tenders` (`status = 'WON'` vs Total) | 33 / 169 (19.5%) raw; 26 / 162 (16.0%) ex-test. | `Available and verified` | Present as separate metric: *Tingkat Konversi Pipeline (Yield)*. |
| **Open Pipeline Value** | `tenders` (`status NOT IN ('WON', 'LOST')`) | 135 open deals = `Rp 3.867.580.424`. | `Available and verified` | Exclude WON and LOST from Open column in Leaderboard. |
| **Marketing PIC Scorecard** | `tenders.marketing_pic_id`, `users` | `marketing@epms.com` (`id=4709`) owns 115 deals (`Rp 104,45B`, 94.4%). | `Available but inconsistent` | Isolate generic account into *Unassigned Desk Queue* (DEC-BI-08). |
| **Stale Tender Watchlist** | `tenders.bid_submission_deadline` | 135 / 135 overdue; 134 / 135 inactive $\ge 14$ days. | `Available and verified` | Surface 135 overdue leads in review register without auto-closing (DEC-BI-05). |
| **Historical Stage Velocity** | `tender_stage_history` | **Table does not exist.** `tender_activities` stores text strings only. | `Missing` | Add `tender_stage_history` table in Phase B; reconstruct from audit logs where possible. |

---

### 3.3 Domain 3: Project Delivery & Progress Control (Tab 3)

| Metric / Capability | Required Source Table(s) | Current Database State | Assessment Status | Action Required Before Production |
| :--- | :--- | :--- | :--- | :--- |
| **Portfolio Breakdown** | `projects.status` | 27 total: 12 PLANNING, 7 IN_PROGRESS, 8 CLOSED. | `Available and verified` | Group cleanly; exclude test projects (`#3–#6, #88, #96, #124`) by default. |
| **PMO S-Curve Progress** | `project_baselines`, `project_progress_logs` | 15 projects baselined (62 WBS leaf weights summing to 100%), 93 logs. | `Available but not integrated` | Wire backend `project-control.calculator.ts` directly into `/reports` Tab 3. |
| **Schedule Variance Health** | `project-control.calculator.ts` | Computes `ON_TRACK`, `SLIGHT_DELAY`, `BEHIND`. | `Available but not integrated` | Display S-curve variance percentage points (`variancePp`). |
| **Unbaselined Planning List** | `projects` (status: `PLANNING`) | 12 projects (`Rp 4,31B`), 100% have NULL dates and 0 baselines. | `Available and verified` | Surface as critical PMO pre-kickoff risk watchlist. |
| **Pre-Kickoff RAB Margin** | `contracts.contract_value`, `cost_items` | Project #50 has DRAFT cost `Rp 1,777B` vs contract `Rp 1,775B` (`-0.09%`). | `Available and verified` | Trigger prominent **Negative Planned Margin Alert** on Project #50. |
| **Closed On-Time Rate** | `projects.actual_finish_at`, `end_date` | 8 CLOSED projects all completed early vs end_date. | `Available but inconsistent` | Fix `project-control.calculator.ts` `actualFinish: null` bug (R1-22). |
| **Project Risk Matrix** | `project_risks` | **0 rows.** | `Missing` | Display **`NOT UTILIZED / UNAVAILABLE`**; do not fabricate fake risk counts. |

---

### 3.4 Domain 4: Procurement & Cost Control (Tab 4)

| Metric / Capability | Required Source Table(s) | Current Database State | Assessment Status | Action Required Before Production |
| :--- | :--- | :--- | :--- | :--- |
| **PO Commitment Total** | `purchase_orders.total_amount` | 24 POs = `Rp 17.788.506.821` (12 test POs = `Rp 17,18B`). | `Available and verified` | Separate Material POs (`Rp 16,27B`, 13 POs) from Service POs (`Rp 1,52B`, 11 POs). |
| **Material GR Fulfillment** | `goods_receipts.total_received_amount` | 13 Goods Receipts = `Rp 16.267.385.495` (100% of Material POs). | `Available and verified` | Report Material Goods Receipt fulfillment rate as 100.0%. |
| **Service Claim Fulfillment** | `service_claims.approved_claim_amount` | 13 Service Claims = `Rp 383.346.869,37` across 11 Service POs. | `Available and verified` | Report progressive service fulfillment without expecting physical Goods Receipts. |
| **Uninvoiced PO Exposure** | POs vs Invoices | PO #18 (`Rp 1,41B`) and PO #21 (`Rp 33,65M`) have 0 invoices. | `Available and verified` | Highlight **`Rp 1.443.322.470` uninvoiced PO backlog** requiring vendor billing follow-up. |
| **Segregation of Duties (SOD)**| `audit_logs` (`SERVICE_CLAIM_SOD_EXCEPTION`)| 13 SOD exceptions logged (Claim Submitter == Commercial Verifier). | `Available and verified` | Surface SOD compliance exception counter in Procurement Governance view. |
| **Three-Way Match Verification**| `procurement_reconciliations` | **0 rows.** | `Missing` | Reconcile directly via PO-to-GR/Claim-to-Invoice relational links. |

---

### 3.5 Domain 5: Finance & Tax Governance (Tab 5)

| Metric / Capability | Required Source Table(s) | Current Database State | Assessment Status | Action Required Before Production |
| :--- | :--- | :--- | :--- | :--- |
| **Verified AP Disbursements** | `payments.amount_paid` | 19 payments = `Rp 16.323.222.707` (8 test payments = `Rp 15,73B`). | `Available and verified` | Separate commercial payments (`Rp 595,6M`) from test payments (`Rp 15,73B`). |
| **Outstanding AP Invoices** | `invoices` (`status = 'UNPAID'`) | 4 unpaid invoices = `Rp 21.961.644` (age 2–3 days). | `Available and verified` | Display outstanding AP queue with underlying payment term linkages. |
| **Treasury PRQ Bottlenecks** | `payment_requests.status` | 1 `APPROVED_FOR_PAYMENT` (Rp 990k), 3 `NEEDS_REVISION` (Rp 19,86M). | `Available and verified` | Surface ready-for-cash-outflow item and stalled revision blockers. |
| **PPh Withholding Exposure** | `invoice_tax_details`, `cost_items` | Calculated on invoices, but `pph_withholding_records` has 0 rows. | `Available but not integrated` | Report PPh withholding as **statutory tax liability owed to state**, NOT remitted tax. |
| **PPN Input Tax (Masukan)** | `ppn_masukan_records` | 3 rows for PT UBD = `Rp 2.083.500`. | `Available and verified` | Report creditable input VAT only with verified e-Faktur Pajak alignment. |
| **Statutory Tax Remittance** | `tax_remittance_records` | **0 rows.** | `Missing` | Explicitly display: **`Nol Setoran Pajak Terverifikasi NTPN`**. |
| **Customer Sales Revenue / AR**| Customer Billing Ledger | **Zero tables exist in database.** | `Missing` | Mark strictly **`UNAVAILABLE`** per DEC-BI-06. Do NOT substitute vendor AP. |

---

### 3.6 Domain 6: Legal & Compliance Governance (Tab 6)

| Metric / Capability | Required Source Table(s) | Current Database State | Assessment Status | Action Required Before Production |
| :--- | :--- | :--- | :--- | :--- |
| **Active Contract Portfolio** | `contracts` (`status = 'ACTIVE'`) | 29 active contracts = `Rp 106.422.378.808`. | `Available and verified` | Maintain active contract portfolio count and signed legal commitments. |
| **Pending Legal Review Queue** | `contracts` (`status = 'PENDING_LEGAL_REVIEW'`) | 4 contracts (`#16, #17, #26, #30`) = `Rp 36.848.453`. | `Available and verified` | Highlight **16–18 calendar day backlog** requiring immediate legal review. |
| **Tender SPK 48h Grace Period**| `tenders.spk_verification_status` | 29 VERIFIED, 4 PENDING_REVIEW, 0 SPK_REQUIRED. | `Available and verified` | Track 48-hour SPK upload grace period on tenders separately from contract revisions. |
| **Contract Revision 72h SLA** | `contracts.status = 'REVISION_EXPIRED'` | 0 contracts currently revision expired. | `Available and verified` | Correct UI card label: do not label revision expiry as *"Grace period 48 jam"*. |
| **Workflow SLA Compliance** | `workflow_tasks.due_at` | **412 / 412 rows have due_at = NULL.** | `Available but inconsistent` | Mark all historical tasks as *"Tanpa Batas Waktu"*; do not claim 100% compliance. |
| **Corporate Entity Column** | `contracts.company_code` | **Column does not exist in schema.** | `Missing` | Add `company_code varchar(10) NULL` in Phase B migration. |

---

## 4. Master Readiness Classification Summary

```text
┌────────────────────────────────────────────────────────┬─────────────┐
│ Category                                               │ Total Items │
├────────────────────────────────────────────────────────┼─────────────┤
│ 1. Available and verified                              │     18      │
│ 2. Available but inconsistent (Formula/Label Defect)   │      6      │
│ 3. Available but not integrated (Unused Service/Table) │      4      │
│ 4. Missing (Schema / Feature does not exist in DB)     │      7      │
│ 5. Requires management decision (DEC-BI-01 .. 08)      │      8      │
└────────────────────────────────────────────────────────┴─────────────┘
```

**Conclusion:**
Of the 35 core management capabilities evaluated, **18 are immediately verifiable**, **10 require formula/integration stabilization (Phase A & C)**, and **7 represent systemic ledger gaps (Customer AR/Revenue, Tax Remittances, Milestones) that must remain transparently labeled as `UNAVAILABLE`**. Under no circumstances should missing data be masked with simulated or plausible numbers.

---

*End of Data Readiness Matrix.*
