# EPMS UBD & TVM — KPI & REPORTS PHASE GATE REGISTER
## Governance Charters, Stage-Gate Control, Entry/Exit Criteria & Rollback Plans

**Document Reference:** `EPMS-GATE-REG-20261116-001`
**Classification:** Enterprise Project Governance & Stage-Gate Control Document
**System Target:** EPMS UBD & TVM — `/reports` Transformation
**Reference Date:** 16 November 2026
**Execution Mode:** PLANNING & GOVERNANCE ONLY (Implementation Authorization: PENDING)
**Author:** Principal Enterprise Solution Architect & Technical Project Governance Lead

---

## 1. STAGE-GATE GOVERNANCE FRAMEWORK

To prevent uncontrolled code changes, production regressions, or premature deployment, the EPMS KPI & Reports Transformation adheres to a strict Stage-Gate governance model.

```mermaid
flowchart LR
    GateA[Phase Gate A: Audit & Freeze] -->|DEC-BI-01 to 08 Approval| GateB[Phase Gate B: Backend Hardening]
    GateB -->|API Regression 100%| GateC[Phase Gate C: Data Backfill]
    GateC -->|Data Integrity Certified| GateD[Phase Gate D: Frontend Redesign]
    GateD -->|End-to-End Test PASS| GateE[Phase Gate E: Staging UAT]
    GateE -->|Director Sign-off| Prod[Production Go-Live]

    style GateA fill:#059669,stroke:#047857,color:#fff
    style GateB fill:#f59e0b,stroke:#d97706,color:#fff
    style GateC fill:#6b7280,stroke:#4b5563,color:#fff
    style GateD fill:#6b7280,stroke:#4b5563,color:#fff
    style GateE fill:#6b7280,stroke:#4b5563,color:#fff
```

> [!CRITICAL]
> **GOVERNANCE MANDATE: NO AUTOMATIC PHASE EXECUTION**
> Transition between any two phase gates requires explicit, documented sign-off from all designated stakeholders. No phase may be started automatically by automated agents or engineering teams without formal written authorization.

---

## 2. PHASE GATE CHARTERS

### PHASE GATE A: Read-Only Audit, Baseline Freeze & Roadmap Approval
*Current Operational Phase (Active)*

| Governance Attribute | Specification |
| :--- | :--- |
| **Stage Objective** | Complete forensic audit of live system and database; freeze empirical baseline; formulate master architecture and specifications. |
| **Current Status** | **IN PROGRESS / NEARING COMPLETION** |
| **Prerequisites** | Read-only access to repository and MySQL database `epms_tvmubd_db`. Zero source code or database modifications. |
| **Required Business Approvals** | Management decisions `DEC-BI-01` through `DEC-BI-08` formally reviewed. |
| **Required Evidence Artifacts** | 1. `EPMS_KPI_REPORTS_MASTER_ROADMAP.md`<br>2. `EPMS_KPI_REPORTS_DATA_READINESS_MATRIX.md`<br>3. `EPMS_KPI_REPORTS_SIX_TAB_UI_SPECIFICATION.md`<br>4. `EPMS_KPI_REPORTS_KPI_DICTIONARY.md`<br>5. `EPMS_KPI_REPORTS_PROCUREMENT_INTELLIGENCE_SPEC.md`<br>6. `EPMS_KPI_REPORTS_API_ARCHITECTURE.md`<br>7. `EPMS_KPI_REPORTS_TEST_AND_UAT_STRATEGY.md`<br>8. `EPMS_KPI_REPORTS_PHASE_GATE_REGISTER.md`<br>9. `EPMS_KPI_REPORTS_RISK_AND_DEPENDENCY_REGISTER.md` |
| **Entry Criteria** | Request from leadership to transform reporting into Management Intelligence. |
| **Exit Criteria** | All 9 deliverables completed; zero Git modifications to application code; formal presentation to Board of Directors. |
| **Rollback Plan** | Not applicable (strictly read-only). |
| **Responsible Approvers** | Direktur Utama, Lead Solution Architect. |

---

### PHASE GATE B: Backend API Hardening & AP Non-Substitution Remediation
*Status: PENDING MANAGEMENT APPROVAL*

| Governance Attribute | Specification |
| :--- | :--- |
| **Stage Objective** | Eliminate `paidInvoicesSum` AP-as-Revenue fallback; implement modular `/analytics/*` endpoints with caching and safe drill-down whitelist. |
| **Prerequisites** | Gate A formal sign-off; approval of `DEC-BI-01`, `DEC-BI-02`, and `DEC-BI-04`. |
| **Scope of Work** | 1. Deprecate AP fallback in `DashboardService.getSummary()`.<br>2. Implement `ExecutiveAnalyticsService`, `ProcurementAnalyticsService`, and domain services.<br>3. Implement `safeExecutiveTarget` utility.<br>4. Configure Redis cache-aside (TTL 300s). |
| **Test & Quality Criteria** | 1. 100% pass on backend unit tests (`npm run test`).<br>2. TypeScript compilation 0 errors.<br>3. Verified zero `N+1` database loops; p95 query latency $< 500\text{ms}$.<br>4. Automated test confirming `customerRevenue` returns `UNAVAILABLE`. |
| **Required Evidence Artifacts** | `evidence/phase_b/backend_test_results.log`, API Swagger/OpenAPI snapshot. |
| **Rollback Plan** | **RTO: 15 minutes / RPO: 0 minutes.** Revert to Git commit tag `GATE-A-FREEZE-20261116`. Restart NestJS server. |
| **Responsible Approvers** | Lead Solution Architect, Backend Engineering Lead, QA Lead. |

---

### PHASE GATE C: Controlled Data Backfill & Integrity Remediation
*Status: PENDING MANAGEMENT APPROVAL*

| Governance Attribute | Specification |
| :--- | :--- |
| **Stage Objective** | Remediate missing start/end dates for 12 planning projects; establish initial baselines; verify tax remittance NTPN proof. |
| **Prerequisites** | Gate B completed; approval of `DEC-BI-05`, `DEC-BI-07`, and `DEC-BI-08`. |
| **Scope of Work** | 1. Execute transactional SQL migration scripts with rollback safeguards.<br>2. Backfill valid `start_date` and `end_date` for 12 planning projects based on approved project charters.<br>3. Generate initial approved project cost baselines (`active_baseline = 1`).<br>4. Remediate `due_at = NULL` across active workflow tasks. |
| **Test & Quality Criteria** | 1. Zero data loss or corruption in `projects` and `project_cost_estimates`.<br>2. Dry-run transaction verification with pre/post checksum comparison.<br>3. Foreign key and unique constraint integrity 100% verified. |
| **Required Evidence Artifacts** | Pre-migration database dump, post-migration audit log, data validation diff report. |
| **Rollback Plan** | **RTO: 30 minutes / RPO: 0 minutes.** Restore pre-migration MySQL snapshot `epms_tvmubd_pre_gate_c.sql`. |
| **Responsible Approvers** | Lead Database Administrator (DBA), PMO Lead, Finance Controller. |

---

### PHASE GATE D: Frontend Six-Tab MIDSS Redesign & Activity Center Integration
*Status: PENDING MANAGEMENT APPROVAL*

| Governance Attribute | Specification |
| :--- | :--- |
| **Stage Objective** | Implement responsive Six-Tab UI architecture; integrate Three Management Pillars; implement Procurement Waterfall visualizer. |
| **Prerequisites** | Gate B and C completed; approval of `DEC-BI-03`. |
| **Scope of Work** | 1. Redesign `/reports` layout with modern UI grid.<br>2. Build Tab 1 (Executive) with Pencapaian, Hambatan, and Action Needed.<br>3. Build Tab 4 (Procurement Waterfall) with Material vs. Service split.<br>4. Connect safe drill-down links to Activity Center and entity workspaces. |
| **Test & Quality Criteria** | 1. 100% pass on frontend tests (`npm run test:ui`).<br>2. Production build success (`npm run build`).<br>3. Cross-browser and responsive verification (Desktop 1920x1080, Mobile 360x800, PWA).<br>4. Zero 404 navigation errors across all clickable cards. |
| **Required Evidence Artifacts** | Visual regression screenshots, bundle analyzer report, responsive viewport test logs. |
| **Rollback Plan** | **RTO: 10 minutes / RPO: 0 minutes.** Deploy previous Next.js production build artifact. |
| **Responsible Approvers** | Frontend Lead, UI/UX Designer, QA Lead. |

---

### PHASE GATE E: Human Staging UAT, Security Audit & Production Release
*Status: PENDING MANAGEMENT APPROVAL*

| Governance Attribute | Specification |
| :--- | :--- |
| **Stage Objective** | Conduct formal human acceptance testing across executive roles; security penetration check; production deployment. |
| **Prerequisites** | Gate D completed; all automated test suites green. |
| **Scope of Work** | 1. Execute Human UAT scripts (UAT-DIR, UAT-FIN, UAT-PROC, UAT-PMO, UAT-LEG).<br>2. Conduct RBAC boundary penetration testing.<br>3. Verify mutual exclusion rules (Next.js process management).<br>4. Deploy to production environment with zero-downtime rolling restart. |
| **Test & Quality Criteria** | 1. 5/5 signed human UAT acceptance certificates.<br>2. Zero critical or high-severity security vulnerabilities.<br>3. Production health check HTTP 200 on `/health` and `/reports`. |
| **Required Evidence Artifacts** | Signed UAT sign-off sheets, security penetration audit report, production deployment checklist. |
| **Rollback Plan** | **RTO: 20 minutes / RPO: 0 minutes.** Full-stack blue-green deployment rollback to previous release tag. |
| **Responsible Approvers** | Direktur Utama, Head of IT, Lead Solution Architect, Finance Controller. |

---

## 3. DECISION GATE MATRIX & DEPENDENCY LINKAGE

Every implementation phase gate is directly gated by corresponding management decisions:

| Management Decision | Decision Title | Mandatory Gate Prerequisite | Current Status |
| :--- | :--- | :---: | :---: |
| **DEC-BI-01** | Win Rate Formula Standardization | Gate B | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-02** | Customer Billing / Revenue Module Policy | Gate B | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-03** | Standalone Procurement Intelligence Tab | Gate B, Gate D | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-04** | Unbilled PO Exposure Accounting vs Operational Risk | Gate B, Gate D | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-05** | Planning Projects Schedule & Baseline Backfill | Gate C | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-06** | Service Claim SOD Exception Policy | Gate B, Gate C | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-07** | Contract Legal Review SLA & Escalation Threshold | Gate B, Gate D | **PENDING MANAGEMENT APPROVAL** |
| **DEC-BI-08** | Tax Remittance Ledger Integration Policy | Gate C, Gate D | **PENDING MANAGEMENT APPROVAL** |

---

*End of Phase Gate Register.*
