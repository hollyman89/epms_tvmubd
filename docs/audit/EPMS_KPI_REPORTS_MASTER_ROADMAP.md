# EPMS UBD & TVM — KPI & Reports Master Transformation Roadmap
## Architecture Blueprint, Strategic Phasing & Management Intelligence Foundation

**Project:** Enterprise Procurement Management System (EPMS) — PT Usaha Bersama Digital (UBD) & PT Tri Visi Mandiri (TVM)
**Target Module:** `/reports` (and unified reporting integration with `/dashboard` and Marketing Pipeline Analytics)
**Governing Baseline Commit:** `4a6f88c7fd335652c4d9028cbc77267f7165bb65` (`origin/main`)
**Audit & Reference Date:** 16 November 2026
**Execution Mode:** `PLANNING, READ-ONLY AUDIT & DOCUMENTATION ONLY`
**Implementation Authorization:** `NOT GRANTED — ALL WORK DOCUMENTATION ONLY`

---

## 1. Executive Charter & Architectural Mission

### 1.1 Objective and Scope
The objective of this master roadmap is to transform the existing EPMS KPI & Reports module from a fragmented collection of operational vanity indicators into a unified, evidence-based:

$$\textbf{Management Intelligence \& Decision Support System (MIDSS)}$$

The transformed workspace serves the Managing Director, Board of Directors, and six operational management domains:
1. **Executive Overview** — Cross-functional synthesis answering *Pencapaian Utama*, *Hambatan Utama*, and *Action & Decision Needed*.
2. **Sales & Marketing** — Pipeline conversion, closed deal win rate, stagnant lead exposure, and PIC accountability.
3. **Project Delivery / PMO** — Weighted S-curve schedule health, unbaselined planning watchlists, and pre-kickoff RAB margin alerts.
4. **Procurement & Cost Control** — Standalone procurement lifecycle intelligence (`PR -> PO -> GR / Service Claim -> Invoice -> Payment`), open commitment backlog, uninvoiced exposure, and Segregation of Duties (SOD) compliance.
5. **Finance & Tax Governance** — Verified vendor AP disbursements, invoice aging, treasury bottleneck queues, bank account outflow split, statutory tax liabilities (PPh withholding, PPN input tax, NTPN remittances), and strict Customer AR/Revenue accounting boundary disclaimers.
6. **Legal & Compliance** — Active contract portfolio, aged legal review queues, Tender SPK verification (48h grace) vs Contract revision expiration (72h SLA) rule separation, and workflow task turnaround governance.

### 1.2 Preservation Invariants (What EPMS Is NOT Doing)
- This is an **in-place transformation of the existing EPMS reporting capabilities**, NOT a proposal to build a greenfield application.
- All existing branding, navigation frameworks, Ant Design design tokens, authentication (JWT/bcrypt), role-based access control (RBAC), and transactional business workflows are strictly preserved.
- No production business data is altered, deleted, or backfilled during this planning phase.

---

## 2. Mandatory Governance & Safety Charter

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   STRICT GOVERNANCE SAFETY RULES                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Code Modification: No source code (.ts, .tsx, .js) touched.     │
│ 2. Zero Database Migrations: No DDL or DML executed on MySQL.           │
│ 3. Zero Transaction Mutation: Historical ledger rows 100% preserved.   │
│ 4. Zero Production Contamination: No test data inserted into DB.       │
│ 5. Decisions Unapproved: DEC-BI-01 .. DEC-BI-08 remain PENDING.        │
│ 6. No Automatic Phase Progression: Each phase requires signed gates.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Master Phased Execution Architecture

Implementation is structured across **five sequential, strictly gated phases (Phase A through Phase E)**. No downstream phase may commence until its governing phase gate is formally unlocked.

```text
[DEC-BI-01 Approved]
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase A (P0 — Immediate): KPI Defect & Credibility Stabilization       │
│ • Fix Win Rate denominator (WON / (WON + LOST)) & conversion yield     │
│ • Eliminate fake 100% MoM growth when baseline is 0                    │
│ • Strip hardcoded numeric fallbacks (75, 31, 1.20B, 2.32B) & targets   │
│ • Fix chart Y-axis scale inversion & mislabeled "Open" table columns   │
│ • Separate 48h Tender SPK grace from 72h Contract revision SLA         │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼ [Gate A Passed + DEC-BI-02, 03, 04, 05, 08 Approved]
┌────────────────────────────────────────────────────────────────────────┐
│ Phase B (P1 — Foundation): Data Governance & Entity Foundation         │
│ • Implement tri-state data classification: COMMERCIAL / TEST_SANDBOX   │
│   with mandatory system default: LEGACY_UNVERIFIED                     │
│ • Quarantine 7 test tenders (Rp 100,98B) & test POs/Payments with UI   │
│   reconciliation toggle: CONSOLIDATED = COMM + UNVERIFIED + SANDBOX    │
│ • Add contracts.company_code & enforce UBD + TVM + UNCLASSIFIED = TOTAL│
│ • Populate workflow_tasks.due_at rule-engine; mark historical as NULL  │
│ • Seed executive_kpi_targets under Director sign-off                   │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼ [Gate B Passed + DEC-BI-06, 07 Approved + UX Wireframe Sign-Off]
┌────────────────────────────────────────────────────────────────────────┐
│ Phase C (P1 — Core Product): Management Intelligence 6-Tab Redesign    │
│ • Tab 1: Executive Overview (Pencapaian, Hambatan, Action/Decision)    │
│ • Tab 2: Sales & Pipeline Intelligence (Clean Win Rate & Yield)        │
│ • Tab 3: Project Delivery (PMO S-Curve, Baselined S-Curve, RAB Margin) │
│ • Tab 4: Procurement Intelligence (Waterfall, Uninvoiced PO, SOD)      │
│ • Tab 5: Finance & Tax Governance (AP Aging, Tax Ledger, AR UNAVAIL)   │
│ • Tab 6: Legal & Compliance (16-18d Queue, SLA Health, Turnaround)     │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼ [Gate C Passed Staging UAT + Board Pack Format Sign-Off]
┌────────────────────────────────────────────────────────────────────────┐
│ Phase D (P2 — Decision Automation): Historical Snapshots & Exports     │
│ • Immutable daily & monthly portfolio trend snapshots                  │
│ • Deterministic bottleneck & exception engine tied to Activity Center  │
│ • Governed management exports: Watermarked PDF Board Pack, Excel, CSV  │
│ • Database snapshot retention policy (prune intraday, keep EOD)        │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼ [Gate D Passed + Architecture Review Sign-Off]
┌────────────────────────────────────────────────────────────────────────┐
│ Phase E (P2 — Consolidation): Unified BI Core & CI Gate Lock           │
│ • Single Source of Truth: Converge /reports, /dashboard & Marketing   │
│ • Eliminate duplicate SQL queries across backend services              │
│ • Automated 15-area isolated BI test regression locked into CI         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase-by-Phase Execution Specifications

### 4.1 Phase A (`P0` — Immediate): KPI Defect & Credibility Stabilization
* **Strategic Objective:** Eliminate glaring mathematical defects, misleading labels, and hardcoded numeric illusions that destroy executive trust in current reporting.
* **Scope of Technical Work:**
  - **Backend (`AnalyticsService`, `DashboardService`):**
    - Correct `getKpi()`: Win Rate denominator changed from `COUNT(id)` to decided outcomes (`WON / (WON + LOST)`). Expose `wonCount`, `lostCount`, `openCount`, `openPipelineValue`, `closedValueWinRate`, and `funnelConversionYield`. Return `UNAVAILABLE` (`null`) when `wonCount + lostCount = 0`.
    - Correct Growth calculation: Replace `if (prevTotal === 0 && currTotal > 0) momGrowth = 1` with `growthStatus: 'NO_PRIOR_BASELINE'`. Suppress `"Pipeline tumbuh fantastis 100.0%"` promotional NLG text. Match comparison labels dynamically (`MoM`, `QoQ`, `YTD`).
    - Fix Leaderboard: Separate `Open` vs `Won` vs `Lost` vs `Total` in `GET /analytics/marketing-performance`. Never display total pipeline under an open column.
    - Isolate generic account `marketing@epms.com` (`id=4709`) from individual sales representative rankings.
    - Exclude `LOST` from `NEGOTIATION` step inside `getFunnel()`. Support `ALL_TIME` filter cleanly.
    - Apply matching date and PO status predicates to `DashboardService.getUnclassifiedMetadata()` so `Consolidated = PT UBD + PT TVM + Unclassified`.
    - Deprecate/block legacy `DashboardService.getSummary()` AP-as-Revenue and static fallback constants (`5,000,000,000`, `25.5%`, `92.4%`).
  - **Frontend (`reports/page.tsx`, `analytics.d.ts`, `PipelineAnalyticsView.tsx`):**
    - Delete all hardcoded numeric fallbacks (`?? 75`, `?? 40`, `?? 35`, `?? 31`, `?? 3`, `?? 2`, `?? 89`, `?? 1201126000`, `?? 2318679600`, `?? 18`) and hardcoded `KPI_TARGET_CONFIG`. Render explicit `TARGET BELUM DISAHKAN` or error retry banner.
    - Enforce strict TypeScript types matching backend payloads.
    - Fix Legal Tab 5 label mismatch: Stop labeling `contracts.status = 'REVISION_EXPIRED'` (72h revision SLA) as *"Grace period 48 jam terlewati"*; display Tender `SPK_REQUIRED` (48h SPK grace) separately.
    - Fix chart Y-axis formatting and sorting bugs (`Rp 120.0 M` scaling; `/dashboard` inverted tick labels `32.4 M` above `66.2 M`).
* **Dependencies:** Formal approval of **`DEC-BI-01`**. Zero database migrations required.
* **Risks & Mitigations:**
  - *Risk:* Breaking frontend callers if DTO field names change.
  - *Mitigation:* Add new fields additively while marking deprecated fields; provide backward-compatible transformation wrappers.
* **Automated Tests:** Area 1 (Win Rate Math), Area 2 (Growth Baseline), Area 4 (PIC Breakdown), Area 8 (Legal Rule Separation), Area 13 (Calendar Bounds), Area 14 (Safe URLs).
* **Human UAT:** Director of Marketing and Technical Lead verify `/reports` Tabs 1 and 2 in browser; verify that `0/0` and `19.5%` mismatch is gone; verify that 100% fake growth is eliminated.
* **Rollback Plan:** Git commit revert on frontend and backend branches. Zero database impact.

---

### 4.2 Phase B (`P1` — Foundation): Data Governance & Entity Foundation
* **Strategic Objective:** Establish legal entity separation (`PT UBD` vs `PT TVM`), quarantine sandbox data, establish workflow SLA metadata, and seed authorized executive targets.
* **Scope of Technical Work:**
  - **Audited Database Migrations:**
    - Add `company_code varchar(10) NULL` to `contracts` (closing schema gap with tenders, projects, POs, invoices, payments).
    - Add `data_classification ENUM('COMMERCIAL', 'TEST_SANDBOX', 'LEGACY_UNVERIFIED') DEFAULT 'LEGACY_UNVERIFIED'` on `tenders` and `projects` (propagated via lineage to downstream contracts, POs, invoices, payments). **Mandatory Default:** All unverified historical records default to `'LEGACY_UNVERIFIED'`.
    - Add lifecycle audit columns: `contracts.submitted_for_review_at`, `contracts.revision_requested_at`, `contracts.approved_at`, `invoices.due_date`, and `tender_stage_history`.
  - **Management-Approved Backfill (Zero Blind Guessing):**
    - Flag approved test tenders (`IDs 133, 163–166, 171, 172`), test projects (`#3–#6, #88, #96, #124`), and linked POs/Invoices/Payments as `TEST_SANDBOX`.
    - Backfill `company_code` (`UBD` vs `TVM`) across all 7 entities per Director-approved mapping matrix; retain unresolved records as `UNCLASSIFIED`.
    - Reassign active leads from `marketing@epms.com` (`id=4709`) to named PICs per policy; normalize duplicate customer records (`Asianet`, `SKF`, `JNT`) and business sectors.
    - Populate `workflow_tasks.due_at` rule-engine at task creation for new tasks (`LEGAL_REVIEW` 48h, `GO_NOGO_APPROVAL` 24h, `Director Final Approval` 48h), while preserving historical `NULL` tasks explicitly marked *"Tanpa Batas Waktu"*.
    - Seed approved `executive_kpi_targets` with versioning and Director sign-off.
  - **Central `EntityOwnershipResolver` & `DataQualityFilter` Service:**
    - Remove marketing email heuristics; share canonical resolution hierarchy across Finance, Dashboard, and Reports.
    - Expose `entity` (`ALL`, `UBD`, `TVM`, `UNCLASSIFIED`), `period`, and `dataScope` (`COMMERCIAL_ONLY` default vs `INCLUDE_TEST`) parameters across all BI endpoints.
* **Dependencies:** Phase A completed; formal approvals **`DEC-BI-02`**, **`DEC-BI-03`**, **`DEC-BI-04`**, **`DEC-BI-05`**, **`DEC-BI-08`**.
* **Risks & Mitigations:**
  - *Risk:* Table locking or data corruption during migration; stakeholder alarm when commercial pipeline drops from Rp 110,7B to Rp 9,7B (-91%).
  - *Mitigation:* Staging dry-run with full database snapshot backup; prominent UI disclosure pill explaining test exclusion and showing exact reconciliation counter.
* **Automated Tests:** Area 5 (Entity Balancing), Area 7 (Tax/Partial Math), Area 8 (Workflow Null SLA), Area 11 (Test Data Quarantine).
* **Human UAT:** Finance Controller and PMO Lead verify cross-entity reconciliation across all 7 transaction entities ($\text{UBD} + \text{TVM} + \text{UNCLASSIFIED} = \text{CONSOLIDATED}$).
* **Rollback Plan:** Tested SQL down-migrations; restoration from verified MySQL dump snapshot.

---

### 4.3 Phase C (`P1` — Core Product): Management Intelligence & Six-Tab Redesign
* **Strategic Objective:** Deliver the primary executive decision workspace answering *Pencapaian Utama*, *Hambatan Utama*, and *Action & Decision Needed* across six dedicated operational tabs.
* **Scope of Technical Work:**
  - **Backend Intelligence Aggregators:**
    - Build **3-Pillar Executive Overview Aggregator** (`GET /analytics/executive-intelligence`) returning structured `pencapaianUtama[]`, `hambatanUtama[]`, and `actionDecisionNeeded[]` (strictly separating `directorDecisions[]` from `operationalPicActions[]`).
    - Wire Project Delivery bulk portfolio endpoint: Fix `project-control.calculator.ts` `actualFinish: null` to read `actualFinishAt`; return per-project S-curve `plannedPct`, `actualPct`, `variancePp`, `health`, overdue tasks, unbaselined planning watchlist (12 projects), and pre-kickoff RAB margin alerts (`#50` negative margin `-Rp 1,59M`).
    - Wire Procurement reconciliation funnel endpoint (`PR -> PO -> GR / Service Claim -> Invoice -> Payment`), exposing uninvoiced PO exposure (`Rp 1,44B` across PO #18 & #21) and SOD exception counts (`13x`).
    - Wire Finance AP & Tax Governance endpoint: AP aging vs payment terms, PRQ bottleneck states (`1 APPROVED_FOR_PAYMENT` Rp 990k, `3 NEEDS_REVISION` Rp 19,86M, `1 REJECTED` Rp 18,07M), bank outflow split, tax exposure matrix (PPh withholding liability, creditable PPN input tax, NTPN remittances), and strict Customer AR/Revenue `UNAVAILABLE` notices.
    - Wire Legal Governance endpoint: Aged review queue (4 contracts stuck 16–18 days), turnaround time P50/P90, separated 48h Tender SPK grace vs 72h Contract revision expiry.
  - **Frontend Six-Tab Management Redesign (`reports/page.tsx` & Shared Components):**
    - Implement Global Control Bar: Entity, Period (incl. `ALL_TIME`), Data Scope, Freshness, and Data Exception Pill.
    - Build strict 6-state KPI card renderer (`ACTUAL`, `TARGET`, `FORECAST`, `UNAVAILABLE`, `UNVERIFIED`, `DATA_EXCEPTION`).
    - Reorganize `/reports` into **6 Management Intelligence Tabs**:
      1. `Executive Overview` (3 Mandatory Pillars + Safe Drill-Down Actions)
      2. `Sales & Pipeline Intelligence` (Clean Win Rate & Yield, Funnel, PIC Leaderboard, Stale Leads)
      3. `Project Delivery & Progress Control` (PMO S-Curve, Baselined S-Curve, 12 Unbaselined Projects, Margin Alerts)
      4. `Procurement & Cost Control` (Standalone Domain: Waterfall, Material vs Service, Uninvoiced POs, SOD)
      5. `Finance & Tax Governance` (AP Aging, PRQ Bottlenecks, Tax Matrix, AR/Revenue Unavailable Notice)
      6. `Legal & Compliance` (16–18d Review Backlog, 48h vs 72h Rules, SLA Null Disclosure)
* **Dependencies:** Phase B completed; formal approvals **`DEC-BI-06`**, **`DEC-BI-07`**, and executive UX wireframe sign-off.
* **Risks & Mitigations:**
  - *Risk:* Performance lag on bulk S-curve and procurement queries; executive pushback on exposed backlogs.
  - *Mitigation:* Implement indexed batch queries with Redis/in-memory caching (`p95 < 500ms`); align backlog visibility with actionable escalation protocols.
* **Automated Tests:** Area 3 (Funnel Conversion), Area 6 (Financial Non-Substitution), Area 9 (S-Curve & Closure), Area 12 (RBAC Parity), Area 14 (Safe Drill-Downs).
* **Human UAT:** Managing Director and Department Heads conduct complete walkthrough of all 6 tabs; verify that every action item routes to the correct operational screen.
* **Rollback Plan:** Frontend route feature toggle switching between legacy 5-tab and new 6-tab views. Backend endpoints are strictly additive.

---

### 4.4 Phase D (`P2` — Decision Automation): Historical Snapshots & Governed Exports
* **Strategic Objective:** Enable immutable historical trend analysis, deterministic bottleneck notifications, and audit-ready board exports.
* **Scope of Technical Work:**
  - **Immutable Monthly Snapshots (`executive_portfolio_monthly_snapshots`):** Capture end-of-month and end-of-day immutable snapshots parameterized by `(snapshot_date, company_code, data_classification)`. Historical trend points remain frozen regardless of subsequent edits.
  - **Deterministic Exception Engine:** Rule-driven scoring generating alerts for SLA breaches, margin anomalies, and stagnant leads, integrated cleanly with the Activity Center without creating redundant task tables.
  - **Governed Management Exports:** Multi-sheet Excel, audited CSV, and watermarked PDF Board Pack containing mandatory disclosure metadata (Timestamp WIB, User/Role, Entity Scope, Data Scope, Excluded Test Value, and Accounting Boundary Disclaimer).
  - **Snapshot Retention Governance:** Move materializer from 5-minute polling to hourly + event-triggered invalidation, pruning redundant intraday runs while retaining daily and monthly EOD snapshots.
* **Dependencies:** Phase C stable in staging UAT; Board/Director sign-off on Board Pack visual template and alert thresholds.
* **Risks & Mitigations:**
  - *Risk:* Storage bloat in snapshot tables; discrepancy between export files and UI.
  - *Mitigation:* Automated daily retention pruning; export serialization sharing identical query pipeline with UI endpoints.
* **Automated Tests:** Area 10 (Historical Snapshot Immutability), Area 15 (Cross-Module SSOT Reconciliation).
* **Human UAT:** Finance Manager and Board Secretary generate monthly board packs and verify reconciliation against live screens.
* **Rollback Plan:** Disable snapshot background scheduler via environment variable; disable export buttons via feature flag.

---

### 4.5 Phase E (`P2` — Architectural Consolidation): Unified BI Core & CI Gate Lock
* **Strategic Objective:** Consolidate duplicate calculations into a single canonical BI engine and lock all 15 verification areas into automated CI gates.
* **Scope of Technical Work:**
  - **Calculation Core Convergence:** Merge calculation logic from `/dashboard` (`DashboardService`), `/reports` (`AnalyticsModule`), `PipelineAnalyticsView`, and `ExecutiveAnalyticsModule` into one shared library.
  - **Database Cleanup:** Prune historical run clutter in `executive_fact_snapshots` (1.27M rows) under verified retention policy, reducing weekly table growth by $> 90\%$.
  - **CI Gate Lock:** Integrate all 15 automated BI verification test suites into continuous integration pre-merge gates (`git push` / pull request hooks).
* **Dependencies:** Phases A through D completed and verified in staging.
* **Risks & Mitigations:**
  - *Risk:* Regressions on legacy dashboard widgets during calculation engine consolidation.
  - *Mitigation:* Comprehensive test suites with 100% fixture coverage before deprecating duplicate legacy code.
* **Automated Tests:** Full regression suite across all 15 verification areas running in CI.
* **Human UAT:** Multi-departmental sign-off confirming identical numbers across all EPMS screens under identical filters.
* **Rollback Plan:** Blue/green deployment canary rollback; retained database snapshot backup.

---

## 5. Cross-Document Governance Dependency Matrix

| Governing Document | Role in Transformation | Key Sections & Linkages |
| :--- | :--- | :--- |
| **`EPMS_KPI_REPORTS_COMPREHENSIVE_AUDIT_REPORT.md`** | Forensic Audit Baseline | Empirical evidence of 96% test data, 100% missing SLA due dates, 0 target rows, and broken formula denominators. |
| **`EPMS_KPI_REPORTS_DATA_READINESS_MATRIX.md`** | Data Source Evaluation | Evaluates all 80 MySQL tables across the 6 domains (Available vs Inconsistent vs Missing vs Decision Needed). |
| **`EPMS_KPI_REPORTS_SIX_TAB_UI_SPECIFICATION.md`** | UI/UX & Interaction Design | Detailed component layout, responsive styles, 6-state KPI cards, and wireframe definitions for all 6 tabs. |
| **`EPMS_KPI_REPORTS_KPI_DICTIONARY.md`** | Metric Governance & SSOT | Complete dictionary of all proposed KPIs with all 15 mandatory governance fields per metric. |
| **`EPMS_KPI_REPORTS_PROCUREMENT_INTELLIGENCE_SPEC.md`** | Domain Specification | Dedicated procurement lifecycle spec (`PR -> PO -> GR / Claim -> Inv -> Pay`), Waterfall chart, and SOD audit rules. |
| **`EPMS_KPI_REPORTS_API_ARCHITECTURE.md`** | Backend Technical Design | REST endpoints, DTO contracts, performance SLA (`< 500ms`), and safe drill-down URL whitelist mapping. |
| **`EPMS_KPI_REPORTS_TEST_AND_UAT_STRATEGY.md`** | Quality Assurance Plan | Detailed automated test specifications for the 15 verification areas and human UAT protocols. |
| **`EPMS_KPI_REPORTS_PHASE_GATE_REGISTER.md`** | Phase Gate Control | Actionable gate entry/exit criteria, prerequisites, required evidence, and sign-off authority for Gates A to E. |
| **`EPMS_KPI_REPORTS_RISK_AND_DEPENDENCY_REGISTER.md`** | Risk Management | Ranked risk register (10 critical risks), mitigation strategies, fallback options, and ownership assignments. |
| **`EPMS_KPI_REPORTS_MANAGEMENT_DECISION_REGISTER.md`** | Policy & Decision Charters | Documents `DEC-BI-01` through `DEC-BI-08`, all explicitly `PENDING MANAGEMENT APPROVAL`. |
| **`EPMS_KPI_REPORTS_IMPLEMENTATION_READINESS_CHECKLIST.md`** | Actionable Checklist | Pre-implementation checklist specifying required artifacts before each phase can be unlocked. |

---

## 6. Implementation Status & Stop Condition

```text
================================================================================
                    IMPLEMENTATION STATUS: NOT GRANTED
================================================================================
• Status of Decisions: DEC-BI-01 .. DEC-BI-08 strictly PENDING APPROVAL.
• Application Source Code Changes: ZERO (0 files modified).
• Database Changes / Migrations: ZERO (0 tables/columns modified).
• Production Transactions: 100% PRESERVED.
• Next Required Action: Executive meeting to review Decision Register and unlock Gate A.
================================================================================
```

*End of Master Transformation Roadmap. Implementation authorization not granted.*
