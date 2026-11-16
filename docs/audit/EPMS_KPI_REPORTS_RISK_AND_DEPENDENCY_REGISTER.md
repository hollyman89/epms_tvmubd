# EPMS UBD & TVM — KPI & REPORTS RISK & DEPENDENCY REGISTER
## Enterprise Risk Assessment, Impact Analysis, Mitigation Strategies & Dependencies

**Document Reference:** `EPMS-RISK-DEP-20261116-001`
**Classification:** Enterprise Risk Management & Project Governance Register
**System Target:** EPMS UBD & TVM — `/reports` & Executive Decision Support
**Reference Date:** 16 November 2026
**Execution Mode:** PLANNING & RISK AUDIT ONLY (Implementation Authorization: PENDING)
**Author:** Principal Enterprise Solution Architect & Technical Risk Officer

---

## 1. RISK GOVERNANCE & METHODOLOGY

This register identifies, evaluates, and ranks operational, financial, technical, and governance risks associated with the EPMS KPI & Reports Transformation.

Risks are categorized based on **Severity (Impact)** and **Probability (Likelihood)** on a standard enterprise risk matrix:

```mermaid
quadrantChart
    title Risk Priority Matrix
    x-axis Low Likelihood --> High Likelihood
    y-axis Low Severity --> High Severity
    quadrant-1 Immediate Mitigation (Critical)
    quadrant-2 Executive Attention (High)
    quadrant-3 Routine Management (Low)
    quadrant-4 Active Monitoring (Medium)
    "RSK-01: Revenue Masquerade": [0.85, 0.95]
    "RSK-02: Unbilled PO Exposure": [0.75, 0.90]
    "RSK-03: SOD Bypass Exceptions": [0.90, 0.85]
    "RSK-04: Project Schedule Vacuum": [0.95, 0.80]
    "RSK-05: Legal Review Backlog": [0.80, 0.75]
    "RSK-06: Next.js Process Conflict": [0.40, 0.85]
    "RSK-07: N+1 Query Cascade": [0.60, 0.65]
    "RSK-08: Premature Phase Execution": [0.35, 0.90]
    "RSK-09: Tax Remittance Exposure": [0.70, 0.70]
    "RSK-10: Multi-Tenant Data Leakage": [0.25, 0.95]
```

---

## 2. TOP 10 ENTERPRISE RISK PROFILES

### RSK-01: Misleading Revenue Reporting (AP Expense Masquerading as Revenue)
- **Category:** Financial Integrity & Executive Governance
- **Severity:** `CRITICAL` | **Probability:** `HIGH` | **Risk Score:** `9.5 / 10`
- **Root Cause:** Legacy `DashboardService.getSummary()` falls back to `paidInvoicesSum` (Accounts Payable payments to vendors) when calculating company revenue.
- **Business Impact:** Executive board makes strategic cash flow, capital expenditure, and dividend decisions based on inverted figures where costs are reported as earnings.
- **Mitigation Strategy:**
  1. Deprecate `totalRevenue` fallback immediately in Phase Gate B.
  2. Implement `AuditableMetric<number>` contract with status `UNAVAILABLE` and explanatory UI badge `"Modul AR Belum Terpasang"`.
  3. Require explicit approval of Management Decision `DEC-BI-02`.
- **Contingency / Fallback:** If leadership insists on seeing top-line commercial figures, display strictly `Total Kontrak Dimenangkan (Won Tenders Sum: Rp 26,70 M)` with clear disclosure.
- **Risk Owner:** Finance Controller & Principal Solution Architect.

---

### RSK-02: Unbilled Purchase Order Liability Exposure (Rp 1,44 B Hidden Exposure)
- **Category:** Treasury, Cash Flow & Contractual Risk
- **Severity:** `CRITICAL` | **Probability:** `HIGH` | **Risk Score:** `9.0 / 10`
- **Root Cause:** PO #18 (Rp 1,41 B) and PO #21 (Rp 33,65 M) are legally issued to subcontractors without milestone claims or invoices logged in the system.
- **Business Impact:** Treasury prepares liquidity plans based solely on active Invoices (Rp 164,65 M pending AP), leaving company unprepared for sudden Rp 1,44 B subcontractor billing.
- **Mitigation Strategy:**
  1. Mandate the Procurement Waterfall in Tab 4 displaying **Unbilled PO Exposure** as a top-level metric.
  2. Implement aging alert for active POs older than 30 days without claims.
  3. Formalize Management Decision `DEC-BI-04`.
- **Contingency / Fallback:** Establish weekly procurement-treasury commitment sync until all service claims are reconciled.
- **Risk Owner:** Head of Procurement & Treasury Lead.

---

### RSK-03: Internal Control Vulnerability & Segregation of Duties (SOD) Bypass
- **Category:** Regulatory Compliance & Corporate Governance
- **Severity:** `HIGH` | **Probability:** `CERTAIN` (13 instances documented) | **Risk Score:** `8.8 / 10`
- **Root Cause:** In all 13 service claim records, claim submitter ID and commercial verifier ID are identical (`SERVICE_CLAIM_SOD_EXCEPTION` in `audit_logs`).
- **Business Impact:** Potential vendor fraud, improper milestone sign-offs, and severe audit qualification by external financial auditors.
- **Mitigation Strategy:**
  1. Prominently display SOD Compliance Rate (currently 0.0%) on Tab 4.
  2. Implement strict backend validator blocking `submitter == verifier` in Phase Gate B.
  3. Formalize Management Decision `DEC-BI-06` for historical disposition.
- **Contingency / Fallback:** Implement mandatory dual-authorization Director PIN override for emergency claims.
- **Risk Owner:** Head of Internal Audit & Lead Architect.

---

### RSK-04: Project Schedule Vacuum & Undetected Cost Overrun
- **Category:** PMO, Project Delivery & Cost Control
- **Severity:** `HIGH` | **Probability:** `HIGH` | **Risk Score:** `8.5 / 10`
- **Root Cause:** 12 of 27 projects (100% of Planning status) lack start/end dates and baselines. Project #50 has a planned deficit of `-Rp 1.594.600`.
- **Business Impact:** Inability to generate S-Curves or detect delays; commercial execution begins at a net financial deficit.
- **Mitigation Strategy:**
  1. Display explicit `"Jadwal Belum Ditetapkan"` notice instead of zero-percent or runtime errors.
  2. Implement Project Deficit Alert banner on Tab 3 highlighting Project #50.
  3. Enforce Gate C prerequisite requiring baseline entry before moving projects to `IN_PROGRESS`.
- **Contingency / Fallback:** Lock project procurement (block PR/PO creation) for any project lacking an approved baseline.
- **Risk Owner:** PMO Lead & Cost Control Manager.

---

### RSK-05: Legal Review Backlog & Commercial Stagnation
- **Category:** Legal Governance & Contract Execution
- **Severity:** `HIGH` | **Probability:** `HIGH` | **Risk Score:** `8.0 / 10`
- **Root Cause:** Contracts #16, #17, #26, and #30 (total Rp 36,85 M) have remained in `PENDING_LEGAL_REVIEW` for **16.8 to 18.1 calendar days** (vs. 72-hour SLA).
- **Business Impact:** Vendors cannot commence work or bill; project milestones are delayed due to unsigned agreements.
- **Mitigation Strategy:**
  1. Surface Legal Review Backlog card on Tab 6 with exact aging days.
  2. Configure automated notification escalation to Director when review exceeds 72 hours.
  3. Formalize Management Decision `DEC-BI-07`.
- **Contingency / Fallback:** Establish standard contract fast-track templates for recurring low-value agreements ($< \text{Rp 50 M}$).
- **Risk Owner:** Corporate Legal Specialist & Director.

---

### RSK-06: Next.js Process Conflict & Webpack Chunk 404 Incident
- **Category:** DevOps & System Availability
- **Severity:** `CRITICAL` | **Probability:** `LOW` (Controlled by Rule) | **Risk Score:** `7.8 / 10`
- **Root Cause:** Running `npm run build` while `npm run dev` is active on port 3000 overwrites `.next` build chunks, causing runtime white screen.
- **Business Impact:** Immediate dashboard outage for executive users during business hours.
- **Mitigation Strategy:**
  1. Strict adherence to `nextjs-process-management.md` rule.
  2. Mutual exclusion enforcement: check port 3000 PID, verify process, kill dev server before build, and verify HTTP 200 after.
- **Contingency / Fallback:** Execute Canonical Incident Recovery Flow (Rule 20).
- **Risk Owner:** Lead DevOps Engineer & Frontend Architect.

---

### RSK-07: Performance Degradation & N+1 Database Query Cascade
- **Category:** Scalability & Application Performance
- **Severity:** `MEDIUM` | **Probability:** `MEDIUM` | **Risk Score:** `6.8 / 10`
- **Root Cause:** Calculating complex metrics across 6 tabs via nested loops and unindexed queries.
- **Business Impact:** Page load times $> 5$ seconds; executive dashboard feels sluggish; high CPU utilization on MySQL server.
- **Mitigation Strategy:**
  1. Single-pass SQL aggregation with `SUM(CASE WHEN ...)`.
  2. Redis caching with 300s TTL and event-driven invalidation hooks.
  3. Enforce strict SLA: p95 $< 500\text{ms}$ (cached), $< 1.5\text{s}$ (cold).
- **Contingency / Fallback:** Offload analytics queries to a read-replica MySQL instance if transaction volume doubles.
- **Risk Owner:** Backend Engineering Lead & Database Administrator.

---

### RSK-08: Premature Phase Execution without Executive Sign-Off
- **Category:** Project Management & Technical Discipline
- **Severity:** `CRITICAL` | **Probability:** `LOW` (Enforced by Gate) | **Risk Score:** `6.5 / 10`
- **Root Cause:** Automated tools or development teams modifying source code or running migrations before business decisions are approved.
- **Business Impact:** Regression in live production system, corrupted financial audit trail, and loss of management trust.
- **Mitigation Strategy:**
  1. Strict Stage-Gate control: Phase A is strictly read-only audit.
  2. Implementation authorization explicitly set to `NOT GRANTED`.
  3. Mandatory multi-stakeholder sign-off before entering Gate B, C, D, or E.
- **Contingency / Fallback:** Git branch protection rules requiring two executive approvals to merge into `main`.
- **Risk Owner:** Principal Enterprise Solution Architect & Technical Governance Lead.

---

### RSK-09: Tax Compliance & Treasury Remittance Exposure
- **Category:** Tax Regulatory & Legal Compliance
- **Severity:** `MEDIUM` | **Probability:** `HIGH` | **Risk Score:** `6.5 / 10`
- **Root Cause:** Invoices record PPh 21, 23, and Final tax withholdings, but zero tax remittance records (NTPN proof) exist in the system.
- **Business Impact:** Exposure to Directorate General of Taxes (DJP) penalties, interest, and tax audit fines for delayed tax deposit.
- **Mitigation Strategy:**
  1. Tab 5 explicitly tracks tax withholding liability separately from vendor payments.
  2. Implement Tax Remittance verification workflow under Management Decision `DEC-BI-08`.
- **Contingency / Fallback:** Treasury conducts bi-weekly offline reconciliation with DJP e-Billing portals.
- **Risk Owner:** Tax Specialist & Finance Controller.

---

### RSK-10: Multi-Tenant Data Leakage between UBD and TVM
- **Category:** Information Security & Tenant Isolation
- **Severity:** `CRITICAL` | **Probability:** `VERY LOW` | **Risk Score:** `5.5 / 10`
- **Root Cause:** Missing `company_id` filters in analytics queries allowing UBD staff to view confidential TVM commercial bids or margins.
- **Business Impact:** Breach of commercial confidentiality, internal friction, and violation of multi-entity governance.
- **Mitigation Strategy:**
  1. NestJS `CompanyContextGuard` enforced across all `/analytics/*` routes.
  2. Automated integration tests verifying cross-tenant isolation.
- **Contingency / Fallback:** Enforce row-level security (RLS) or views partitioned by `company_id`.
- **Risk Owner:** Lead Security Engineer & Backend Architect.

---

## 3. MASTER DEPENDENCY CHAIN

```
[DEC-BI-01: Win Rate Formula] ────────────┐
[DEC-BI-02: Customer AR Policy] ──────────┼──> [Phase Gate B: Backend API Hardening]
[DEC-BI-04: Unbilled PO Exposure] ────────┤                      │
[DEC-BI-06: SOD Exception Policy] ────────┘                      │
                                                                 ▼
[DEC-BI-05: Planning Baseline Backfill] ─────> [Phase Gate C: Data Backfill & Cleansing]
[DEC-BI-08: Tax Remittance Ledger] ───────┘                      │
                                                                 ▼
[DEC-BI-03: Standalone Tab 4 Mandate] ───────> [Phase Gate D: Frontend Six-Tab MIDSS Redesign]
[DEC-BI-07: Legal Review SLA Threshold] ───┘                      │
                                                                 ▼
                                               [Phase Gate E: Human Staging UAT & Release]
                                                                 │
                                                                 ▼
                                               [Production Go-Live: MIDSS v2.0]
```

---

*End of Risk and Dependency Register.*
