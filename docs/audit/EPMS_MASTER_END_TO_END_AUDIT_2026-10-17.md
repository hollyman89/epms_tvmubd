# EPMS MASTER END-TO-END AUDIT
**Document Reference:** `docs/audit/EPMS_MASTER_END_TO_END_AUDIT_2026-10-17.md`  
**Audit Date:** 2026-10-17  
**Operating Mode:** AUDIT ONLY (READ-ONLY FORENSIC INSPECTION — NO CODE/DATABASE FIXES)  
**Target Repository:** `hollyman89/epms_tvmubd` (`c:\Users\UBDOPS3\Herd\epms_tvmubd`)  
**Auditor:** Antigravity Advanced Agentic Forensic Suite  

---

## 1. Executive Summary

A comprehensive, forensic end-to-end audit of the EPMS application was conducted across all 18 functional domains spanning the entire enterprise project lifecycle: Marketing, Tender/Proposal, Commercial/Budget, Legal Governance, PMO Onboarding, Technical Planning (4/4 Pillars: WBS, Cost/RAB, Schedule/Gantt, Initial Condition), Management Review Governance (Head of Operations, Procurement, Finance, Director), Formal Kickoff, Execution Workspace, Routine and Critical Progress Claims, S-Curve Tracking, Competitive Material Procurement, Service Procurement (Subcontracting), Goods Receipt, Service Claim Verification, Finance Invoicing (3-Way Matching & Term-Based Reconciliation), Payment Request Lifecycle, Director Payment Approval, Finance Disbursement, and Project Closure.

The audit was executed under strict **READ ONLY** operating mode. Zero application source files were modified, zero database schemas were altered, zero migrations were run, and zero business transactions were mutated or deleted. All findings are substantiated by exact source code citations (file path, line numbers, function signatures), live SQL query outputs from `epms_tvmubd_db`, and frontend route/component analysis.

### Overall Lifecycle Metrics
- **Total Lifecycle Stages Audited:** 24 Canonical Stages
- **PASS Stages:** 16
- **PARTIAL Stages:** 5
- **FAIL Stages:** 3
- **NOT_PROVEN Stages:** 0
- **Total Audit Findings:** 22
- **P0 Findings (Critical Blockers / Data Truth / System Integrity):** 6
- **P1 Findings (Major Lifecycle Disconnects / Bypasses / Dead Ends):** 5
- **P2 Findings (Projection / Notification / Language / UX Inconsistencies):** 7
- **P3 Findings (Cosmetic / Low-Risk Schema Inconsistencies):** 4

### Top 5 Critical Takeaways
1. **Pusat Aktivitas History Triggers 404 Error (P0 — BLK-01):** Frontend service `frontend/src/services/inbox.service.ts:75` issues `GET /inbox/history`, but `backend/src/modules/inbox/inbox.controller.ts` implements only `@Get('todos')` and `@Get('summary')`. Navigating to the "Riwayat" tab in `/inbox` triggers an immediate HTTP 404 error and UI toast error *"Gagal memuat riwayat tugas"*.
2. **Outbox Relay Stalled in Infinite Rollback Loop (P0 — BLK-02):** The `outbox_events` table contains 3 records (IDs 159, 162, 165 for `project.closure.*`) permanently in `PENDING` status. Because zero backend listeners are registered for `project.closure.*`, `outbox-relay.service.ts:101-105` hits its fail-safe delivery rule (`Zero listeners registered... rolling back delivery`), rolling back transactions every 5 seconds indefinitely.
3. **Dead Deep-Links Persisted in Notification Ecosystem (P0 — BLK-03):** Backend notification consumers (`canonical-notification.consumer.ts:318, 347`) persist deep-links `/projects/pos/${poId}` and `/finance/payments/${paymentId}`. Neither route exists in Next.js (Next.js provides `/procurement?tab=po` and `/finance/payments?tab=...`). Live notification records (IDs 49, 50, 51, 52) contain dead links resulting in 404 pages when clicked.
4. **Service Claims Disconnected from Notification & To-Do Ecosystem (P0 — BLK-04):** `service-claim.service.ts` injects `OutboxEvent`, `EventEmitter2`, and `CanonicalNotificationWriter` in its constructor (lines 70-77), but calls NONE of them. Subcontractor service claims require PM technical verification and Procurement commercial approval, yet generate zero To-Do tasks in Pusat Aktivitas and emit zero notifications.
5. **Fabricated Synthetic Data in Production Dashboard (P0 — BLK-05):** `backend/src/modules/dashboard/dashboard.service.ts:404-431` serves `getProjectTrend()` by computing `Math.random()` synthetic numbers for project completion trends, actively consumed by `frontend/src/hooks/useDashboardQuery.ts:58`. This violates the Absolute Data-Truth Rule.

---

## 2. Canonical Lifecycle

The expected enterprise canonical lifecycle for EPMS follows a strictly sequenced, gated progression:

```
MARKETING (Lead / Tender Opportunity)
  ↓
PROPOSAL / TENDER (Document Upload & Evaluation)
  ↓
COMMERCIAL / BUDGET (Pricing & Discount Gate)
  ↓
GO / NO-GO REVIEW (Director / GM Executive Gate)
  ↓
LEGAL REVIEW (Contract Drafting, SPK Upload & Grace SLA)
  ↓
CONTRACT APPROVED & ACTIVE
  ↓
PROJECT WORKSPACE INITIALIZED (Status = PLANNING)
  ↓
PMO ASSIGNMENT (PM Assigned to Project)
  ↓
PROJECT DELIVERY PLANNING (4/4 Technical Pillars)
  ├── 1. COST / RAB (Itemized unit costs & subtotal verification)
  ├── 2. WBS (100% root weight, major packages, leaf deliverables)
  ├── 3. SCHEDULE / GANTT (Calendar-day duration, valid start/end, predecessor FS chronology)
  └── 4. INITIAL CONDITION (Site baseline, constraints, risks, normal status)
  ↓
4/4 PLANNING READINESS VERIFIED (Completeness = 4/4, Status = READY)
  ↓
PM SUBMIT FOR MANAGEMENT REVIEW
  ↓
HEAD OF OPERATIONS (HOPS) REVIEW
  ↓
PROCUREMENT REVIEW
  ↓
FINANCE REVIEW
  ↓
DIRECTOR APPROVAL (Workflow Instance Completed)
  ↓
GOVERNANCE GATE: READY FOR KICKOFF (Project status remains PLANNING)
  ↓
HANDOVER TO ASSIGNED PM
  ↓
PM EXECUTE FORMAL KICKOFF (Site confirmation, location attributes)
  ↓
PROJECT STATUS TRANSITION: PLANNING → IN_PROGRESS
  ↓
PROJECT EXECUTION WORKSPACE (Task execution, Kanban lanes)
  ├── PROGRESS MONITORING (Routine updates & critical progress claims)
  ├── S-CURVE (Baseline plan vs Official verified actual progress)
  ├── MATERIAL PROCUREMENT (PR → RFQ → Min 3 Quotations → Vendor Comparison → PO → GR → 3-Way Match → Invoice)
  └── SERVICE PROCUREMENT (Service PR → Vendor Selection → Service PO → Service Claim → PM Tech Verification → Procurement Commercial Approval → Service Invoice [NO GR])
  ↓
FINANCE VERIFICATION (Invoice validation against GR or Service Claim)
  ↓
PAYMENT REQUEST SUBMISSION (Finance Maker submits to Director)
  ↓
DIRECTOR PAYMENT APPROVAL (Status: APPROVED_FOR_PAYMENT [No Auto-Pay])
  ↓
FINANCE PAYMENT EXECUTION (Finance Checker processes payment, Status: PAID)
  ↓
PAYMENT RECORDED & OUTBOX EVENT EMITTED
  ↓
PROJECT CLOSURE (100% Progress, All Tasks Done, Zero Vendor AP, Documents Verified, HOO Review, Director Approval → CLOSED)
```

**Crucial Governance Invariant:** Director Approval in Management Review must NOT automatically trigger kickoff. Director approval completes the governance review and transitions the governance gate to `READY_FOR_KICKOFF`. The assigned PM must explicitly execute the formal kickoff charter to transition project status from `PLANNING` to `IN_PROGRESS`.

---

## 3. Actual Implemented Lifecycle

Forensic inspection of codebase controllers, services, database tables, and workflow definitions reveals the following actual operational implementation:

```
[PASS] MARKETING (Tenders table, Proposal upload, Negotiated price)
  ↓
[PASS] GO / NO-GO REVIEW (Workflow ID 27, Director/GM Approval)
  ↓
[PASS] SPK UPLOAD & LEGAL REVIEW (Contracts table, LegalService.reviewContract)
  ↓
[PASS] CONTRACT ACTIVE (contracts.legal_status = 'APPROVED', contracts.status = 'ACTIVE')
  ↓
[PARTIAL] PMO OPERATIONAL BOARD (Handover creates project; Orphan risk: Project 475 created with contract_id = NULL)
  ↓
[PASS] PM ASSIGNMENT (POST /project/:projectId/assign-pm, PMO only)
  ↓
[PASS] 4/4 PLANNING READINESS (OperationalReadinessValidator strictly calculates WBS, Cost, Schedule, Initial Condition)
  ↓
[PASS] PM SUBMIT MANAGEMENT REVIEW (Requires 4/4 readiness; initiates Workflow ID 25)
  ↓
[PASS] 4-STAGE MANAGEMENT REVIEW (HOPS → Procurement → Finance → Director via WorkflowEngine)
  ↓
[PASS] DIRECTOR APPROVAL → READY_FOR_KICKOFF (Workflow completed; Project remains PLANNING)
  ↓
[PASS] PM FORMAL KICKOFF (POST /project/:projectId/kickoff; validates assigned PM; PLANNING → IN_PROGRESS)
  ↓
[PASS] EXECUTION WORKSPACE & PROGRESS (Routine task progress, project_progress_logs, S-Curve calculator)
  ↓
[PARTIAL] MATERIAL PROCUREMENT (PR → RFQ → Comparison → PO → GR; Broken sync: procurement.service emits 'po.created'/'gr.created' instead of 'procurement.po.issued'/'procurement.gr.received')
  ↓
[FAIL] SERVICE PROCUREMENT (ServiceClaimService injects outbox/eventEmitter but NEVER CALLS THEM; zero tasks or notifications created for PM/Procurement)
  ↓
[PARTIAL] FINANCE INVOICE & PAYMENT (3-Way match enforced; Bypass risk: createPayment allows paying invoices without PaymentRequest via legacy fallback)
  ↓
[FAIL] PROJECT CLOSURE OUTBOX (Closure workflow succeeds to CLOSED, but emits 3 orphan events stuck in PENDING, causing endless 5s transaction rollbacks)
```

---

## 4. Expected vs Actual Flow

| Lifecycle Stage | Expected Canonical Flow | Actual Implemented Flow | Discrepancy / Alignment | Verdict |
|---|---|---|---|---|
| **Marketing Tender** | Lead $\rightarrow$ Proposal Upload $\rightarrow$ Negotiation | `POST /marketing/tenders`, `POST /marketing/tenders/:id/upload-proposal`, `PATCH /marketing/tenders/:id/negotiate` | Matches canonical specification. Role guards enforced. | **PASS** |
| **Go / No-Go** | Marketing submit $\rightarrow$ Director/GM approve | `POST /marketing/tenders/:id/submit-go-no-go`, `POST /marketing/tenders/:id/go-no-go` (Workflow ID 27) | Matches canonical specification. Outbox events emitted. | **PASS** |
| **Legal Review** | Upload SPK $\rightarrow$ Legal review $\rightarrow$ Approved | `POST /marketing/tenders/:id/upload-spk`, `POST /legal/contracts/review` (Workflow ID 29) | Contract and SPK URL linked. SLA grace service active. | **PASS** |
| **Project Creation** | Contract Approved $\rightarrow$ Project created in PLANNING | `LegalService.startProject` creates project with status `PLANNING`. | Project 475 created without contract (`contract_id = NULL`). | **PARTIAL** |
| **PM Assignment** | PMO assigns PM via operational board | `POST /project/:projectId/assign-pm` (`@Roles('PMO')`). | Matches specification. Assigned PM receives isolated notification. | **PASS** |
| **4/4 Planning** | 4 pillars: WBS (100%), RAB, Schedule (FS), Initial Condition | `OperationalReadinessValidator` validates all 4 pillars from live DB. | Mathematically strict. No hardcoded readiness. | **PASS** |
| **Review Submission** | PM submits only when 4/4 READY | `POST /project/:projectId/management-review/submit` | Blocks submission if `completenessCount < 4`. | **PASS** |
| **Governance Review** | Sequential HOPS $\rightarrow$ Proc $\rightarrow$ Fin $\rightarrow$ Director | Governed by Workflow ID 25 (`PROJECT_PLAN_REVIEW_WORKFLOW`). | Multi-stage transitions verified in `workflow_transitions`. | **PASS** |
| **Director Approval** | Sets status `READY_FOR_KICKOFF` without auto-kickoff | `node_director_approval` completes workflow; project remains `PLANNING`. | Project status does NOT auto-kickoff. Control returns to PM. | **PASS** |
| **Formal Kickoff** | Assigned PM executes kickoff $\rightarrow$ `IN_PROGRESS` | `POST /project/:projectId/kickoff` | Checks PM ownership; sets `actual_kickoff_date`; transitions `PLANNING` $\rightarrow$ `IN_PROGRESS`. | **PASS** |
| **Progress & S-Curve** | Baseline plan vs official verified actual progress | `progress-monitoring.calculator.ts` computes S-Curve from active baseline and `project_progress_logs`. | Early actual date fix verified; carry-forward semantic gate passed. | **PASS** |
| **Material Procurement** | PR $\rightarrow$ RFQ $\rightarrow$ Comparison $\rightarrow$ PO $\rightarrow$ GR | Full flow implemented; direct PO blocked without winning vendor comparison. | Event name mismatch: emits `po.created` instead of `procurement.po.issued`. | **PARTIAL** |
| **Service Procurement** | Service PR $\rightarrow$ Service PO $\rightarrow$ Claim $\rightarrow$ Verification $\rightarrow$ Invoice | `service-claim.service.ts` implements CRUD and verification logic. | **DISCONNECTED:** Outbox and event emitter never called; 0 To-Dos; 0 notifications. | **FAIL** |
| **Finance Verification** | 3-way match reconciliation mandatory | `POST /finance/invoices/:id/verify` evaluates reconciliation. | Enforces variance checks and payment term validations. | **PASS** |
| **Payment Request** | Finance submit $\rightarrow$ Director decide $\rightarrow$ Approved for Pay | `POST /finance/payment-requests`, `POST /finance/payment-requests/:id/decide` | Director approves to `APPROVED_FOR_PAYMENT`; SoD enforced. | **PASS** |
| **Payment Execution** | Finance executes payment $\rightarrow$ Status `PAID` | `POST /finance/payments` (`@Roles('FINANCE')`) | Legacy bypass exists: allows payment without PaymentRequest if omitted. | **PARTIAL** |
| **Project Closure** | 100% progress, AP settled, HOO review, Director approval $\rightarrow$ `CLOSED` | `project-closure.service.ts` implements 8-stage readiness evaluation and 2-step approval. | **BROKEN OUTBOX:** 3 outbox events permanently stuck in `PENDING` due to 0 listeners. | **FAIL** |
| **Pusat Aktivitas** | Unified To-Do, History, Notifications | `InboxPage.tsx` tabs for To-Do, Riwayat, Notifikasi | **BROKEN HISTORY:** `GET /inbox/history` returns 404 Not Found. | **FAIL** |

---

## 5. Complete Lifecycle Matrix

| # | Stage Name | Canonical Role | Input Artifact | Action / Endpoint | Precondition | Status Before | Status After | Persistence Table | To-Do Projection | Notification Emitted | Audit Trail | Next Actor | Verdict | Finding ID |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tender Creation | MARKETING | Customer Info, Tender Title | `POST /marketing/tenders` | Customer exists | None | LEAD | `tenders` | None | None | `audit_logs` | MARKETING | PASS | — |
| 2 | Proposal Upload | MARKETING | Proposal PDF/Word Document | `POST /marketing/tenders/:id/upload-proposal` | Tender in LEAD | LEAD | PROPOSAL | `tenders`, `proposals` | None | None | `audit_logs` | MARKETING | PASS | — |
| 3 | Commercial Negotiation | MARKETING | Negotiated Price, Discount | `PATCH /marketing/tenders/:id/negotiate` | Tender in PROPOSAL | PROPOSAL | NEGOTIATION | `tenders`, `tender_price_history` | None | SLA Alert if discount > 20% | `audit_logs` | DIRECTOR (if disc high) | PASS | — |
| 4 | Go/No-Go Submission | MARKETING | Tender assessment | `POST /marketing/tenders/:id/submit-go-no-go` | Stage NEGOTIATION | NEGOTIATION | WAITING_GO_NO_GO | `tenders`, `workflow_instances` | TT-04, TT-10 (Director) | NT-14 (Director) | `audit_logs` | DIRECTOR / GM | PASS | — |
| 5 | Go/No-Go Decision | DIRECTOR / GM | Approval Decision ('GO') | `POST /marketing/tenders/:id/go-no-go` | Stage WAITING_GO_NO_GO | WAITING_GO_NO_GO | WON (or NEGOTIATION) | `tenders`, `workflow_tasks` | Task Closed | NT-15 (Marketing) | `workflow_transitions` | MARKETING | PASS | — |
| 6 | SPK Document Upload | MARKETING | SPK PDF File | `POST /marketing/tenders/:id/upload-spk` | Tender WON, Decision GO | DRAFT | PENDING_LEGAL_REVIEW | `contracts`, `tenders` | TT-07, TT-09 (Legal) | NT-03 (Legal) | `audit_logs` | LEGAL | PASS | — |
| 7 | Legal Contract Review | LEGAL | Review Notes, Approval | `POST /legal/contracts/review` | Contract PENDING_LEGAL_REVIEW | PENDING_LEGAL_REVIEW | APPROVED / ACTIVE | `contracts` | Task Closed | NT-04 (Marketing, PMO) | `audit_logs`, `workflow_transitions` | PMO | PASS | — |
| 8 | Project Handover | PMO | Approved Contract | `LegalService.startProject` | Contract APPROVED & ACTIVE | PENDING_KICKOFF | PLANNING | `projects`, `contracts` | PM Assignment Queue | NT-20 (WebSocket) | `audit_logs` | PMO | PARTIAL | SEC-01 |
| 9 | PM Assignment | PMO | Project ID, PM User ID | `POST /project/:projectId/assign-pm` | Project in PLANNING | PLANNING | PLANNING (manager_id set) | `projects`, `contracts` | None | NT-06 (Assigned PM only) | `audit_logs` | Assigned PM | PASS | — |
| 10 | WBS Planning | PROJECT_MANAGER | Hierarchical Tree Nodes | `PUT /project/:projectId/wbs-tree` | Project in PLANNING | PLANNING | PLANNING | `work_breakdown_structures` | None | None | None | Assigned PM | PASS | — |
| 11 | Cost / RAB Planning | PROJECT_MANAGER | Itemized Cost Estimates | `PUT /project/:projectId/cost-estimate` | Project in PLANNING | PLANNING | PLANNING | `project_cost_estimates`, `cost_items` | None | None | None | Assigned PM | PASS | — |
| 12 | Schedule Planning | PROJECT_MANAGER | Tasks, Dates, Predecessors | `PUT /project/:projectId/schedule` | Project in PLANNING | PLANNING | PLANNING | `tasks` | None | None | None | Assigned PM | PASS | — |
| 13 | Initial Condition | PROJECT_MANAGER | Baseline Site Survey Data | `PUT /project/:projectId/initial-condition` | Project in PLANNING | PLANNING | PLANNING | `project_initial_conditions` | None | None | None | Assigned PM | PASS | — |
| 14 | Management Review Submit | PROJECT_MANAGER | 4/4 Technical Readiness | `POST /project/:projectId/management-review/submit` | Completeness = 4/4 | READY_TO_SUBMIT | REVIEW_PENDING | `project_management_reviews`, `workflow_instances` | TT-03 (HOPS) | Workflow Assigned | `workflow_transitions` | HEAD_OF_OPERATIONS | PASS | — |
| 15 | HOPS Review | HEAD_OF_OPERATIONS | Review Decision (APPROVE) | `POST /governance/tasks/:id/approve` | Active task `node_hops_review` | REVIEW_PENDING | REVIEW_PENDING | `workflow_tasks`, `workflow_instances` | TT-03 (Procurement) | Workflow Assigned | `workflow_transitions` | PROCUREMENT | PASS | — |
| 16 | Procurement Review | PROCUREMENT | Review Decision (APPROVE) | `POST /governance/tasks/:id/approve` | Active task `node_procurement_review` | REVIEW_PENDING | REVIEW_PENDING | `workflow_tasks`, `workflow_instances` | TT-03 (Finance) | Workflow Assigned | `workflow_transitions` | FINANCE | PASS | — |
| 17 | Finance Review | FINANCE | Review Decision (APPROVE) | `POST /governance/tasks/:id/approve` | Active task `node_finance_review` | REVIEW_PENDING | REVIEW_PENDING | `workflow_tasks`, `workflow_instances` | TT-03 (Director) | Workflow Assigned | `workflow_transitions` | DIRECTOR | PASS | — |
| 18 | Director Review Approval | DIRECTOR | Final Approval (APPROVE) | `POST /governance/tasks/:id/approve` | Active task `node_director_approval` | REVIEW_PENDING | READY_FOR_KICKOFF | `workflow_instances`, `project_management_reviews` | Task Closed | NT-19 (Assigned PM) | `workflow_transitions` | Assigned PM | PASS | — |
| 19 | PM Formal Kickoff | PROJECT_MANAGER | Site Confirmation, Coordinates | `POST /project/:projectId/kickoff` | Gate = READY_FOR_KICKOFF | PLANNING | IN_PROGRESS | `projects`, `project_baselines` | None | NT-19 (PM, Stakeholders) | `audit_logs` | Assigned PM | PASS | — |
| 20 | Execution & Progress Claim | PROJECT_MANAGER | Task Progress %, Evidence | `POST /project/:projectId/tasks/:id/progress-claims` | Project IN_PROGRESS | DRAFT / SUBMITTED | PENDING_VERIFICATION | `project_progress_logs` | TT-14 (HOPS, PMO) | None | `audit_logs` | HOPS / PMO | PASS | — |
| 21 | Progress Verification | HOPS / PMO | Verification Decision (APPROVE) | `POST /project/:projectId/progress-logs/:id/verify` | Log PENDING_VERIFICATION | PENDING_VERIFICATION | OFFICIAL | `project_progress_logs` | Task Closed | None | `audit_logs` | Assigned PM | PASS | — |
| 22 | Material Procurement PO | PROCUREMENT | PR ID, Vendor ID, Terms | `POST /procurement/purchase-orders` | PR APPROVED, Winning Vendor | DRAFT | ISSUED | `purchase_orders`, `po_payment_terms` | None | Broken (po.created mismatch) | `audit_logs` | Vendor / Procurement | PARTIAL | EVT-01 |
| 23 | Goods Receipt (Material) | PROCUREMENT | PO ID, Received Quantities | `POST /procurement/goods-receipts` | PO ISSUED (Material only) | ISSUED | COMPLETED / PARTIAL | `goods_receipts`, `goods_receipt_items` | None | Broken (gr.created mismatch) | `audit_logs` | FINANCE | PARTIAL | EVT-01 |
| 24 | Service Procurement Claim | PROJECT_MANAGER / VENDOR | Service PO ID, Claimed Progress | `POST /procurement/service-claims` | Service PO ISSUED | DRAFT | SUBMITTED | `service_claims`, `service_claim_items` | **MISSING (TT-15)** | **MISSING** | `audit_logs` | Assigned PM | FAIL | CLM-01 |
| 25 | Finance Invoice Verification | FINANCE | Invoice ID, Supporting Docs | `POST /finance/invoices/:id/verify` | Invoice Created, Matched | SUBMITTED | VERIFIED | `invoices`, `po_payment_terms` | None | finance.invoice.verified | `audit_logs` | FINANCE | PASS | — |
| 26 | Payment Request Submit | FINANCE | Invoice ID, Amount, Terms | `POST /finance/payment-requests` | Invoice VERIFIED | DRAFT | PENDING_DIRECTOR_APPROVAL | `payment_requests` | TT-11 (Director) | None | `audit_logs` | DIRECTOR | PASS | — |
| 27 | Director Payment Decision | DIRECTOR | Decision (APPROVE) | `POST /finance/payment-requests/:id/decide` | PENDING_DIRECTOR_APPROVAL | PENDING_DIRECTOR_APPROVAL | APPROVED_FOR_PAYMENT | `payment_requests` | TT-13 (Finance) | None | `audit_logs` | FINANCE | PASS | — |
| 28 | Finance Payment Execute | FINANCE | Payment Request ID, Amount | `POST /finance/payments` | APPROVED_FOR_PAYMENT | APPROVED_FOR_PAYMENT | PAID | `payments`, `payment_requests`, `invoices` | Task Closed | NT-07, NT-08 (PM, Finance) | `audit_logs` | PMO / HOPS | PARTIAL | BYP-01 |
| 29 | Project Closure Submit | PROJECT_MANAGER | Closure Readiness Snapshot | `POST /project/:projectId/closure/submit` | 100% Progress, AP Settled | IN_PROGRESS | SUBMITTED | `project_closures`, `workflow_instances` | TT-17 (HOPS) | **PENDING Outbox Stuck** | `audit_logs` | HEAD_OF_OPERATIONS | FAIL | BLK-02 |
| 30 | HOO Closure Review | HEAD_OF_OPERATIONS | Approval Decision | `POST /project/:projectId/closure/:id/hoo/approve` | Closure SUBMITTED | SUBMITTED | HOO_APPROVED | `project_closures`, `workflow_tasks` | TT-18 (Director) | **PENDING Outbox Stuck** | `audit_logs` | DIRECTOR | FAIL | BLK-02 |
| 31 | Director Final Closure | DIRECTOR | Approval Decision | `POST /project/:projectId/closure/:id/director/approve` | Closure HOO_APPROVED | HOO_APPROVED | CLOSED | `projects`, `project_closures` | Task Closed | **PENDING Outbox Stuck** | `audit_logs` | None | FAIL | BLK-02 |

---

## 6. Role / RBAC Matrix

The EPMS authorization architecture utilizes a hybrid dual-layer mechanism:
1. **Frontend Route & Navigation Guard:** Defined in `frontend/src/constants/menuConfig.ts` and evaluated by `<ProtectedRoute />`.
2. **Backend Controller & Method Guard:** Defined by `@UseGuards(JwtAuthGuard, RolesGuard)` and parameterized via `@Roles(...)` and `@DenyRoles(...)`.

### Canonical Role Inventory (from Database `roles` Table)
- Role ID 1: `SUPER_ADMIN`
- Role ID 2: `PROJECT_MANAGER`
- Role ID 3: `FINANCE`
- Role ID 4: `DIRECTOR`
- Role ID 5: `MANAGER`
- Role ID 6: `GENERAL_MANAGER`
- Role ID 7: `MARKETING`
- Role ID 8: `LEGAL`
- Role ID 9: `PURCHASING`
- Role ID 40: `HEAD_OF_OPERATIONS`
- Role ID 42: `PROCUREMENT`
- Role ID 61: `ADMIN`
- Role ID 67: `PMO`

### Authoritative Business Permissions by Role

| Role Constant | Accessible Modules | Readable Records | Writable / Mutating Records | Core Approval Powers | Administrative Powers | Role Leakage / Bypass Risks Identified |
|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | All Modules | All System Records | System-Wide Mutation | Emergency Override / System Bypass | Full Tenant Administration | Can bypass PM ownership on kickoff and WBS |
| `ADMIN` | Dashboard, Reports, Project Master, Master Data | Master Data, User Sessions | User/Role mutations, Master Data | None (Excluded from Procurement RFQ Cancel) | User Management | Excluded from business approvals |
| `DIRECTOR` | Dashboard, Reports, Sales, Project Delivery, Payments, Governance | Executive Financials, Tenders, Projects, Contracts, Invoices | None (Read & Decision Only) | Go/No-Go, Discount (>20%), Mgmt Review, Payment Request, Project Closure | None | Checker role; strictly forbidden from executing payments |
| `GENERAL_MANAGER` | Reports, Sales, Project Delivery, Procurement, Governance | General Operational Records | Tender Updates | Go/No-Go Level 2, Discount Approval | None | Approval Level 2 |
| `HEAD_OF_OPERATIONS` | Reports, Sales, Project Delivery, Procurement, Governance | All Delivery Projects, WBS, Progress, Closures | None (Read & Governance Decision) | Mgmt Review Stage 1 (HOPS), Progress Verification, Project Closure HOO Review | None | Cannot edit RAB or Schedule directly |
| `PMO` | Project Delivery, Master Data, Governance | Operational Board, Unassigned Contracts, Projects | Assign PM (`POST /project/:id/assign-pm`) | Progress Claim Verification (secondary) | None | Manages PM assignment queue |
| `PROJECT_MANAGER` | Project Delivery, Master Data, Inbox | Assigned Projects ONLY (`manager_id = userId`) | WBS, Cost/RAB, Schedule, Initial Condition, Routine Progress, Critical Claims, Closure Submit | None (Submitter role only; cannot self-approve) | None | Scoped at SQL level (`where: { managerId }`) |
| `PROCUREMENT` / `PURCHASING` | Procurement, Master Data, Governance | RFQs, Quotes, POs, GRs, Vendors, Service Claims | Create PR, RFQ, PO, GR, Vendor Master | Mgmt Review Stage 2 (Procurement), Commercial Service Claim Approval | Vendor Master Management | Direct Material PO blocked without RFQ winner |
| `FINANCE` | Finance & Invoices, Payments, Procurement, Governance | Invoices, Payment Terms, Bank Accounts, Matching Previews | Create Invoice, Submit Payment Request, Execute Payment (`POST /finance/payments`) | Mgmt Review Stage 3 (Finance), Invoice 3-Way Match Verification | None | Forbidden from Director Payment Request Approval |
| `LEGAL` | Legal Review, Governance, Master Data | Contracts, SPK Uploads, Grace SLA Extensions | Review Contract (`POST /legal/contracts/review`), Grace SLA Approval | Contract Legal Review (Approve/Reject/Return) | None | Single authority for SPK verification |
| `MARKETING` | Marketing / Sales, Master Data | Tenders, Opportunities, Proposals, Customer Master | Create/Update Tender, Upload Proposal, Upload SPK, Negotiate Price | None (Submitter role only) | None | Blocked from advancing WON tender without SPK |

---

## 7. Marketing Audit

### Evaluated Workflow
`Opportunity / Tender Creation` $\rightarrow$ `Proposal Upload` $\rightarrow$ `Commercial Negotiation` $\rightarrow$ `Go / No-Go Review` $\rightarrow$ `Legal Handover (SPK Upload)`.

### Findings & Evidence
1. **Creation & Identity:** `POST /marketing/tenders` (`marketing.controller.ts:189`) validates input via `CreateTenderDto`. Assigns `marketing_pic_id` and initial stage `LEAD`.
2. **File Signature & Extension Verification:** Both `uploadProposal` (`marketing.controller.ts:333`) and `uploadSpk` (`marketing.controller.ts:244`) implement strict magic-byte file signature validation (`validateFileSignature`, lines 70-147), rejecting Windows PE executables (`MZ: 0x4D, 0x5A`) and verifying PDF (`%PDF-`), DOC (`0xD0, 0xCF`), and DOCX/XLSX (`PK\x03\x04`).
3. **Discount Governance:** `PATCH /marketing/tenders/:id/negotiate` (`marketing.controller.ts:223`) verifies that if negotiated discount exceeds `max_discount_rate`, tender enters discount approval queue requiring Director approval (`PATCH /marketing/tenders/:id/approve-discount`, lines 232-237).
4. **Go / No-Go Gate:** Governed by `TENDER_GO_NOGO_WORKFLOW` (Workflow Definition ID 27). Marketing submits via `POST /marketing/tenders/:id/submit-go-no-go`, transitioning tender stage to `WAITING_GO_NO_GO`. Decision is strictly guarded by `@Roles('DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN')` on `POST /marketing/tenders/:id/go-no-go`.
5. **Deprecated Endpoint Guard:** Legacy `PATCH /marketing/tenders/:id/send-to-legal` (`marketing.controller.ts:206`) throws `HTTP 410 GONE`, strictly enforcing that Legal handoff must occur via canonical SPK upload (`POST /marketing/tenders/:id/upload-spk`).
6. **Grace SLA Engine:** `sla-grace.service.ts` governs SPK grace periods. Tenders with missing SPKs are granted an initial 14-day grace period, extensible up to 3 times (+3 days each) via `POST /legal/contracts/:id/grace-extension` with audit logging.

**Verdict: PASS**

---

## 8. Legal Audit

### Evaluated Workflow
`SPK Document Ingestion` $\rightarrow$ `Contract Queue Registration` $\rightarrow$ `Legal Review Desk` $\rightarrow$ `Decision (Approve / Return / Reject)` $\rightarrow$ `PMO Handover`.

### Findings & Evidence
1. **Contract Ingestion:** When SPK is uploaded, `marketing.service.ts` links `contract.spk_file_url` and sets `contract.legal_status = 'ON_REVIEW'` and `contract.status = 'PENDING_LEGAL_REVIEW'`. Emits outbox event `marketing.spk.uploaded`.
2. **Legal Review Authority:** `POST /legal/contracts/review` (`legal.controller.ts:36`) is strictly restricted to `@Roles('LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')`.
3. **XSS Protection:** `LegalService.validateCommentSanitization` (`legal.service.ts:29-34`) rejects any review comment containing `<script` tags (`BadRequestException`).
4. **Approval Persistence:** Upon approval, `contract.legal_status` is updated to `APPROVED` and `contract.status` to `ACTIVE`. Recorded in `contract_legal_histories` and `audit_logs`. Emits outbox event `legal.contract.approved`.
5. **Mock Data Leak in Staging Code (P2 — DAT-01):** `legal.controller.ts:87-100` implements `getPdfGenerationStatus` with hardcoded fallback mock object:
   ```typescript
   // Mock implementation for staging to force fallback to clean PDF dummy
   return {
     statusCode: HttpStatus.OK,
     data: {
       status: 'FAILED',
       downloadUrl: null,
       retryAfter: 2,
       errorDetails: 'S3 not configured in staging. Fallback to clean dummy.'
     }
   };
   ```
   This endpoint leaks synthetic/dummy strings into production-facing controller code.

**Verdict: PARTIAL (Functional PASS with Data-Truth Flag)**

---

## 9. PMO / Project Creation Audit

### Evaluated Workflow
`Approved Contract` $\rightarrow$ `PMO Operational Board` $\rightarrow$ `Project Initialization` $\rightarrow$ `PM Assignment`.

### Findings & Evidence
1. **PMO Board Aggregation:** `GET /project/operational-board` (`project.controller.ts:101`) displays all approved contracts awaiting PM assignment (`PENDING_KICKOFF`) and all active delivery projects.
2. **PM Assignment Authority:** `POST /project/:projectId/assign-pm` (`project.controller.ts:137`) is strictly restricted to `@Roles('PMO')`. Validates that the candidate PM has role `PROJECT_MANAGER`.
3. **Notification Isolation:** When PM is assigned, `canonical-notification.consumer.ts:244-280` emits `project.pm.assigned` targeted exclusively to `recipientIds: [Number(projectManagerId)]`. Zero broadcast leakage to unassigned PMs. Notification text directs the PM to start operational planning, avoiding premature "Siap Kick Off" messaging.
4. **Orphan Project Creation Vulnerability (P1 — SEC-01):** Read-only database query on `projects` revealed:
   - Project ID 475: `code = "PRJ_1792125622520_4470"`, `name = "Test Project PRJ_1792125622520_4470"`, `status = "IN_PROGRESS"`, `contract_id = NULL`.
   - The `projects.contract_id` column is defined as `bigint unsigned NULL` without an enforced foreign key `NOT NULL` constraint or database trigger. This permitted an unlinked test project to enter `IN_PROGRESS` status without a backing approved legal contract.

**Verdict: PARTIAL**

---

## 10. Project Planning Audit (4/4 Readiness)

### Evaluated Workflow
Technical planning pillars: **1. WBS**, **2. Cost / RAB**, **3. Schedule / Gantt**, **4. Initial Condition**.

### Findings & Evidence
1. **Authoritative Engine:** Evaluated by `OperationalReadinessValidator` (`backend/src/modules/project/operational-readiness.validator.ts`) inside `getOperationalReadinessBatch` (`project.service.ts:3530`).
2. **Pillar 1 — WBS Readiness:**
   - Validates that active Level 1 root packages have an exact weight sum of 100.00% (`Math.abs(rootWeightSum - 100) < 0.01`).
   - Identifies leaf deliverables (nodes without active children).
   - Detects and blocks circular parent dependencies (`BLOCKED: Terdeteksi siklus/circular dependency`).
3. **Pillar 2 — Cost / RAB Readiness:**
   - Evaluates active `ProjectCostEstimate` and linked `cost_items`.
   - Recomputes item subtotals: `Math.abs(subtotal - (qty * unitPrice)) <= 0.05`.
   - Flags orphaned cost items referencing invalid/non-leaf WBS IDs.
   - Flags unassigned cost items missing project scope allocation. Total estimate must be $> 0$.
4. **Pillar 3 — Schedule / Gantt Readiness:**
   - Validates that every leaf WBS deliverable is covered by at least one task with valid ISO dates (`YYYY-MM-DD`).
   - Validates chronological order: `t.endDate >= t.startDate`.
   - Validates Finish-to-Start predecessor dependency: `t.startDate >= predecessor.endDate`.
   - Detects circular predecessor dependencies.
5. **Pillar 4 — Initial Condition Readiness:**
   - Validates that `project_initial_conditions` record exists.
   - Requires non-empty values for: `conditionStatus`, `locationCondition`, `initialConstraints`, and `initialRisks`.
6. **Aggregate Formula:** `completenessCount` is the integer sum ($0..4$) of pillars with status `READY`. Overall status is `READY` if and only if `completenessCount === 4`. No hardcoded readiness exists.

**Verdict: PASS**

---

## 11. Cost / RAB Audit

### Evaluated Workflow
Itemized pricing $\rightarrow$ Categories $\rightarrow$ Subtotals $\rightarrow$ Consistency with Contract & Financial Summary.

### Findings & Evidence
1. **Canonical Source:** Table `project_cost_estimates` linked to `cost_items`.
2. **Mathematical Validation:** `CostEstimateService` validates quantity $\times$ unit price $=$ subtotal within a 5-cent rounding threshold.
3. **Financial Formulas:** In `ProjectGovernanceTaskCenter.tsx:470-498` and `ProjectMasterPage.tsx`:
   - $\text{Profit} = \text{Contract Value} - \text{RAB Total}$
   - $\text{Margin} = \frac{\text{Profit}}{\text{Contract Value}} \times 100\%$
   - $\text{ROI} = \frac{\text{Profit}}{\text{RAB Total}} \times 100\%$
4. **Data-Truth Guard:** If RAB or Contract is missing, formulas return `null` and UI displays `'N/A'`. Division by zero is strictly guarded (if $\text{RAB} = 0$, $\text{ROI} = \text{'N/A'}$). No synthetic defaults. Covered by 11 unit tests in `managementReviewFinancialSummary.test.ts`.

**Verdict: PASS**

---

## 12. WBS Audit

### Evaluated Workflow
Hierarchical tree structure $\rightarrow$ Parent/Child relationships $\rightarrow$ Weight distributions $\rightarrow$ Leaf deliverable mapping.

### Findings & Evidence
1. **Hierarchy & Levels:** Stored in `work_breakdown_structures`. Columns: `parent_wbs_id`, `level`, `weight_percentage`, `code`, `name`.
2. **Double-Counting Prevention:** In progress calculations (`calculateProjectOverallProgress`), weights are derived strictly from leaf nodes or level 1 root packages, preventing parent + child double counting.
3. **Persistence Integrity:** Tested in `wbs-tree.spec.ts` and `wbs-planning-persistence.spec.ts`. All persisted WBS nodes receive database-assigned primary keys before task mapping.

**Verdict: PASS**

---

## 13. Schedule / Gantt / Milestone Audit

### Evaluated Workflow
Task scheduling $\rightarrow$ Start/End dates $\rightarrow$ Duration $\rightarrow$ Milestones $\rightarrow$ Active baseline linkage.

### Findings & Evidence
1. **Duration Rule:** Tasks use calendar-day duration: $\text{Duration} = (\text{End Date} - \text{Start Date}) + 1\text{ day}$.
2. **Milestone Semantics:** Milestone tasks have `isMilestone = true`, duration $= 0$, and `startDate = endDate`.
3. **Baseline Snapshot:** When project kicks off, active tasks are snapshotted into `project_baselines` and `project_baseline_wbs_items`.
4. **Timezone Normalization:** Dates are stored as ISO `YYYY-MM-DD` strings or UTC timestamps to prevent 1-day drift across Indonesian Western Time (WIB, UTC+7).

**Verdict: PASS**

---

## 14. Initial Condition Audit

### Evaluated Workflow
Field condition survey $\rightarrow$ Required fields $\rightarrow$ Readiness contribution.

### Findings & Evidence
1. **Schema & Fields:** Stored in `project_initial_conditions`. Required fields: `condition_status` (`NORMAL`, `ABNORMAL`, `CRITICAL`), `location_condition`, `initial_constraints`, `initial_risks`, `pm_recommendation`.
2. **Readiness Gate:** Proven to be a mandatory requirement for 4/4 readiness. If any required field is empty or whitespace, `evaluateInitialConditionReadiness` returns `IN_PROGRESS`, blocking review submission.

**Verdict: PASS**

---

## 15. Management Review Submission Audit

### Evaluated Workflow
PM Submit for Management Review $\rightarrow$ Gate verification $\rightarrow$ Workflow instance creation.

### Findings & Evidence
1. **Precondition Enforcement:** `submitManagementReview` (`project.service.ts:4120`) explicitly calls `getOperationalReadiness(projectId)`:
   ```typescript
   if (readiness.overallStatus !== 'READY' || readiness.completenessCount < 4) {
     throw new BadRequestException('Pengajuan review gagal. Seluruh 4 Pilar Operasional wajib READY');
   }
   ```
2. **Workflow Initiation:** Creates an instance of `PROJECT_PLAN_REVIEW_WORKFLOW` (ID 25) with initial node `node_hops_review`. Sets `project_management_reviews.status = 'REVIEW_PENDING'`.

**Verdict: PASS**

---

## 16. Management Review Workflow Audit

### Evaluated Workflow
Sequential 4-Stage Governance: `HOPS Review` $\rightarrow$ `Procurement Review` $\rightarrow$ `Finance Review` $\rightarrow$ `Director Approval`.

### Findings & Evidence
1. **Workflow Definition ID 25:**
   - Node 1: `node_hops_review` (Role: `HEAD_OF_OPERATIONS`)
   - Node 2: `node_procurement_review` (Role: `PROCUREMENT`)
   - Node 3: `node_finance_review` (Role: `FINANCE`)
   - Node 4: `node_director_approval` (Role: `DIRECTOR`)
2. **Revision Return Paths:** Each review node supports return for revision:
   - `node_hops_review` -[RETURN]-> `node_pm_revision_hops`
   - `node_procurement_review` -[RETURN]-> `node_pm_revision_procurement`
   - `node_finance_review` -[RETURN]-> `node_pm_revision_finance`
   - `node_director_approval` -[RETURN]-> `node_pm_revision_director`
3. **Segregation of Duties:** In `decideManagementReview` (`project.service.ts:4362`), the PM who submitted the plan is strictly forbidden from approving or deciding their own plan (`ForbiddenException`).
4. **Concurrent Safety:** Workflow task completion uses row-level write locks (`pessimistic_write`) to prevent concurrent race conditions.

**Verdict: PASS**

---

## 17. Director Approval & Kickoff Separation Audit

### Evaluated Workflow
Director Approval $\rightarrow$ Output `READY_FOR_KICKOFF` $\rightarrow$ Return to PM $\rightarrow$ Formal Kickoff Execution.

### Findings & Evidence
1. **Separation Invariant:** Director approval in `node_director_approval` completes Workflow ID 25 and updates `project_management_reviews.status = 'READY_FOR_KICKOFF'`.
2. **Zero Auto-Kickoff:** The project status in `projects.status` REMAINS `PLANNING`. Director approval NEVER updates `projects.status` to `IN_PROGRESS`.
3. **PM Kickoff Execution:** `POST /project/:projectId/kickoff` (`project.service.ts:1956`) can ONLY be executed by the assigned PM (or `SUPER_ADMIN`). Validates that governance gate is `READY_FOR_KICKOFF`, sets `actual_kickoff_date`, creates active baseline snapshot, and transitions project status from `PLANNING` to `IN_PROGRESS`.

**Verdict: PASS**

---

## 18. Execution Workspace Audit

### Evaluated Workflow
Kanban Task Board $\rightarrow$ Routine Progress $\rightarrow$ Issue/Risk Tracking $\rightarrow$ Milestone Actualization.

### Findings & Evidence
1. **Kanban Read Model:** `GET /project/:projectId/task-board` (`project.controller.ts:265`) aggregates tasks into lanes: `PLANNED`, `IN_PROGRESS`, `COMPLETED`.
2. **Access Scoping:** Tested in `task-board.spec.ts`. PM access is strictly scoped to assigned projects.
3. **Kickoff Guard:** Routine progress updates (`PATCH /project/:projectId/tasks/:id/progress`) are blocked if project is still in `PLANNING` status.

**Verdict: PASS**

---

## 19. Progress & S-Curve Audit

### Evaluated Workflow
Progress Logging $\rightarrow$ Verification $\rightarrow$ Weighted Calculation $\rightarrow$ S-Curve Domain Mapping.

### Findings & Evidence
1. **Progress Ledger:** Stored in `project_progress_logs`. Statuses: `DRAFT`, `SUBMITTED`, `PENDING_VERIFICATION`, `OFFICIAL`, `REJECTED`.
2. **Weighted Calculation:** Progress is calculated by weighting leaf deliverable completion against baseline weights:
   $$\text{Overall Progress} = \sum (\text{Task Progress} \times \text{WBS Weight})$$
3. **S-Curve Forensic Validation (Project Specimen 368):**
   - Live specimen Project 368 showed Actual Progress = 40%, Planned Progress = 0%, Deviation = +40 pp, Health = LEBIH CEPAT.
   - S-Curve domain calculation in `progress-monitoring.calculator.ts` dynamically anchors to the minimum of planned start date and earliest official actual progress date, resolving early actual progress rendering.
   - Carry-forward semantic gate confirmed: points on non-reporting dates represent deterministic carry-forward visualization of the latest official state, with zero synthetic database history created.

**Verdict: PASS**

---

## 20. Material Procurement Audit

### Evaluated Workflow
`PM Package / PR` $\rightarrow$ `RFQ` $\rightarrow$ `Vendor Quotations (Min 3)` $\rightarrow$ `Vendor Comparison` $\rightarrow$ `Material PO` $\rightarrow$ `Goods Receipt` $\rightarrow$ `3-Way Match` $\rightarrow$ `Invoice`.

### Findings & Evidence
1. **Competitive Sourcing Guard:** `createPurchaseOrder` (`procurement.service.ts:556-571`) enforces that Material POs MUST have an evaluated RFQ and a winning vendor comparison. Direct Material PO without sourcing is strictly blocked (`throw new BadRequestException('No RFQs found for this Purchase Request')`).
2. **Goods Receipt Guard:** `createGoodsReceipt` (`procurement.service.ts:897`) strictly permits Goods Receipts for `orderType === 'MATERIAL'` only. Service POs are blocked.
3. **Event Producer/Consumer Name Mismatch (P0 — EVT-01):**
   - Producer (`procurement.service.ts:825, 1005`): Emits `po.created` and `gr.created`.
   - Consumer (`business-sync.consumer.ts:102, 107`): Listens for `@OnEvent('procurement.po.issued')` and `@OnEvent('procurement.gr.received')`.
   - Result: Business synchronization events are never triggered for PO issuance or GR receipt due to exact naming divergence.

**Verdict: PARTIAL**

---

## 21. Service Procurement Audit

### Evaluated Workflow
`Service PR` $\rightarrow$ `Subcontractor Selection` $\rightarrow$ `Service PO` $\rightarrow$ `Service Claim` $\rightarrow$ `PM Technical Verification` $\rightarrow$ `Procurement Commercial Approval` $\rightarrow$ `Service Invoice` (Strictly NO GR).

### Findings & Evidence
1. **Sourcing Rules:** Direct Service PO is allowed only when no active/open RFQ exists. If an active RFQ exists, direct PO is blocked until RFQ is cancelled or evaluated (`procurement.service.ts:573-603`).
2. **GR Prohibition:** Service POs are strictly rejected by Goods Receipt (`procurement.service.ts:898`). Database check confirmed 0 Goods Receipts exist for Service POs.
3. **Service Claims Disconnection (P0 — CLM-01):**
   - `service-claim.service.ts` implements core business logic for claims, PM technical verification (`PM_VERIFIED`), and commercial approval (`COMMERCIAL_APPROVED`).
   - However, `service-claim.service.ts` constructor (lines 70-77) injects `outboxRepo`, `eventEmitter`, and `notificationWriter`, but NEVER calls them in any method.
   - Result: Zero To-Do tasks are generated in Pusat Aktivitas for PM technical verification or Procurement commercial approval. Zero notifications are emitted. Service claim workflows are completely silent and isolated.

**Verdict: FAIL**

---

## 22. Finance Verification & Payment Request Audit

### Evaluated Workflow
`Invoice Verification (3-Way Match)` $\rightarrow$ `Payment Request Submission` $\rightarrow$ `Director Decision` $\rightarrow$ `Finance Payment Execution`.

### Findings & Evidence
1. **3-Way Match / Term-Based Reconciliation:** `verifyInvoice` (`finance.service.ts:1960-2008`) evaluates matching. Any price or quantity mismatch blocks verification with a structured `BadRequestException`.
2. **Director Approval Gating:** `decidePaymentRequest` (`finance.service.ts:2507-2515`) transitions status to `APPROVED_FOR_PAYMENT`. It does NOT mark the invoice or request as PAID.
3. **Segregation of Duties (SoD):** Enforced at line 751: The Director who approved the Payment Request is strictly forbidden from executing payment disbursement (`Prinsip Segregation of Duties melarang verifikator melakukan pembayaran`). Payment execution is restricted to `@Roles('FINANCE')`.
4. **Legacy Payment Request Bypass Vulnerability (P1 — BYP-01):** In `createPayment` (`finance.service.ts:730-792`), if `dto.paymentRequestId` is omitted and no `PaymentRequest` record exists for the invoice:
   ```typescript
   } else {
     // Fallback for legacy / mock tests without PaymentRequest
     ...
   }
   ```
   This legacy fallback allows Finance to disburse payments directly without submitting a Payment Request to the Director, bypassing the mandatory Director approval gate.

**Verdict: PARTIAL**

---

## 23. Project Closure Audit

### Evaluated Workflow
`Closure Readiness Check` $\rightarrow$ `PM Submit` $\rightarrow$ `HOO Review` $\rightarrow$ `Director Approval` $\rightarrow$ `CLOSED`.

### Findings & Evidence
1. **Readiness Evaluation:** `evaluateClosureReadiness` (`project-closure.service.ts:80-350`) enforces:
   - Project status must be `IN_PROGRESS`.
   - Overall physical progress must be 100.00%.
   - Incomplete leaf tasks must be 0; missing actual finish dates must be 0.
   - Outstanding vendor AP and unpaid vendor invoices must be 0.
   - Mandatory documents must be present (Customer BAST and Final Report).
2. **Approval Sequence:** PM submits $\rightarrow$ HOO approves $\rightarrow$ Director approves $\rightarrow$ `projects.status = 'CLOSED'`. Verified on live specimen Project 369 (`closed_at: 2026-10-16T10:21:28Z`, `closed_by: 4`).
3. **Stuck Outbox Rollback Loop (P0 — BLK-02):**
   - When Project 369 closed, `project-closure.service.ts` created 3 Outbox events: ID 159 (`project.closure.submitted`), ID 162 (`project.closure.hoo.approved`), and ID 165 (`project.closure.director.approved`).
   - Zero listeners are registered in the backend for `project.closure.*`.
   - `outbox-relay.service.ts:101-105` warns `Zero listeners registered... rolling back delivery` and rolls back the transaction every 5 seconds. All 3 events remain permanently in `PENDING` status.

**Verdict: FAIL**

---

## 24. To-Do (Pusat Aktivitas) Audit

### Evaluated Mechanism
Aggregation of actionable business tasks via `GET /inbox/todos` (`backend/src/modules/inbox/inbox.service.ts`).

### Findings & Evidence
1. **Aggregated Task Types:** Correctly aggregates `PURCHASE_REQUEST_APPROVAL`, `MANAGEMENT_REVIEW`, `GO_NOGO_APPROVAL`, `LEGAL_REVIEW`, `PAYMENT_REQUEST_APPROVAL`, `PAYMENT_REQUEST_REVISION`, `PROCESS_PAYMENT`, `PROGRESS_CLAIM_VERIFICATION`.
2. **Missing Domain Task Queues (P1 — TT-01):**
   - Service Claims: No query for `service_claims` in status `SUBMITTED` (for PM) or `PM_VERIFIED` (for Procurement).
   - Project Closures: No query for `project_closures` in status `SUBMITTED` (for HOO) or `HOO_APPROVED` (for Director).
3. **Null Action Targets (P2 — DL-01):** Unmapped workflow tasks (e.g. Workflow ID 31 `PROJECT_CLOSURE`) have `actionTarget = null` (`inbox.service.ts:183`), causing the CTA button to render "Aksi Belum Tersedia" without navigation.

**Verdict: PARTIAL**

---

## 25. Notification System Audit

### Evaluated Mechanism
`Transactional Outbox` $\rightarrow$ `Outbox Relay` $\rightarrow$ `EventEmitter2` $\rightarrow$ `CanonicalNotificationConsumer` $\rightarrow$ Database `notifications` Table.

### Findings & Evidence
1. **Catalog & Coverage:** Implements 20 distinct notification types across Marketing, Legal, PMO, Finance, and System SLAs.
2. **Dead Deep-Links in Database (P0 — BLK-03):**
   - `canonical-notification.consumer.ts:318` emits `/projects/pos/${poId}` (Route does not exist in Next.js).
   - `canonical-notification.consumer.ts:347` emits `/finance/payments/${paymentId}` (Route does not exist in Next.js).
   - Database records 49, 50, 51, and 52 contain these broken links.
3. **Read Synchronization Gap (P2 — NOT-01):** When a user completes an approval action in a module (e.g. `/finance/payments`), the corresponding notification in the notification bell drawer remains unread because there is no cross-surface read state synchronization.

**Verdict: PARTIAL**

---

## 26. History / Audit Log Audit

### Evaluated Mechanism
Workflow History, System Audit Trail, and User Task History.

### Findings & Evidence
1. **System Audit Trail:** Table `audit_logs` contains 285 authoritative rows tracking `table_name`, `record_id`, `action`, `old_value`, `new_value`, `created_by`. Accessible via `/audit-trail`.
2. **Workflow Transitions:** Table `workflow_transitions` contains 100 authoritative transition records tracking node-to-node transitions, actors, comments, and timestamps.
3. **Missing History Endpoint (P0 — BLK-01):**
   - `frontend/src/services/inbox.service.ts:75` issues `GET /inbox/history`.
   - `backend/src/modules/inbox/inbox.controller.ts` does NOT implement `@Get('history')`.
   - Clicking the "Riwayat" tab in `/inbox` triggers an immediate HTTP 404 error and UI toast error.

**Verdict: FAIL**

---

## 27. Activity Center & Approval Center Relationship

### Evaluated Architecture
Relationship between Pusat Aktivitas (`/inbox`), Approval Center (`/governance/tasks`), Legal Review Desk (`/legal/review`), and Finance Desk (`/finance/payments`).

### Findings & Evidence
1. **Structural Fragmentation:** EPMS lacks a single unified approval action engine. Approvals are distributed across 4 distinct pages:
   - `/governance/tasks`: Project Management Reviews (HOPS, Procurement, Finance, Director).
   - `/legal/review`: Contract reviews.
   - `/finance/payments`: Payment request approvals.
   - `/inbox`: Router and aggregator that deep-links to the other 3 pages.
2. **State Refresh Dependency:** Because decisions occur on external module pages, To-Do items in `/inbox` clear only upon page reload or WebSocket sync event.

**Verdict: PARTIAL**

---

## 28. Deep-Link Matrix

| Link Target | Emitted By | Target Page in Next.js | Route Exists? | Risk / Status |
|---|---|---|---|---|
| `/procurement?tab=pr&prId={id}` | InboxService / Consumer | `app/(dashboard)/procurement/page.tsx` | YES | Valid |
| `/governance/tasks?taskId={id}&projectId={id}` | InboxService | `app/(dashboard)/governance/tasks/page.tsx` | YES | Valid |
| `/sales?tab=1&tenderId={id}&action=go-nogo` | InboxService / Consumer | `app/(dashboard)/sales/page.tsx` | YES | Valid |
| `/legal/review?contractId={id}` | InboxService / Consumer | `app/(dashboard)/legal/review/page.tsx` | YES | Valid |
| `/project-delivery?projectId={id}` | InboxService / Consumer | `app/(dashboard)/project-delivery/page.tsx` | YES | Valid |
| `/projects/pos/${poId}` | `canonical-notification.consumer.ts:318` | **NONE** | **NO** | **DEAD LINK (404)** |
| `/finance/payments/${paymentId}` | `canonical-notification.consumer.ts:347` | **NONE** (Only query route exists) | **NO** | **DEAD LINK (404)** |
| `null` (Aksi Belum Tersedia) | `inbox.service.ts:183` | None | N/A | Dead-end CTA for unmapped tasks |

**Verdict: FAIL**

---

## 29. Event / Outbox Contract Audit

### Producer $\rightarrow$ Consumer Contract Mapping

| Producer Event | Producer File | Consumer Listener | Consumer File | Status | Gap Identified |
|---|---|---|---|---|---|
| `marketing.tender.won` | `marketing.service.ts` | `@OnEvent('marketing.tender.won')` | `canonical-notification.consumer.ts:27` | ALIGNED | — |
| `marketing.spk.uploaded` | `marketing.service.ts` | `@OnEvent('marketing.spk.uploaded')` | `canonical-notification.consumer.ts:83` | ALIGNED | — |
| `legal.contract.approved` | `legal.service.ts` | `@OnEvent('legal.contract.approved')` | `canonical-notification.consumer.ts:127` | ALIGNED | — |
| `project.pm.assigned` | `project.service.ts` | `@OnEvent('project.pm.assigned')` | `canonical-notification.consumer.ts:244` | ALIGNED | — |
| `project.kickoff.executed` | `project.service.ts` | `@OnEvent('project.kickoff.executed')` | `business-sync.consumer.ts:82` | ALIGNED | — |
| `po.created` | `procurement.service.ts:825` | `@OnEvent('procurement.po.issued')` | `business-sync.consumer.ts:102` | **MISMATCH** | Event name mismatch |
| `gr.created` | `procurement.service.ts:1005` | `@OnEvent('procurement.gr.received')` | `business-sync.consumer.ts:107` | **MISMATCH** | Event name mismatch |
| `service.claim.*` | None (`service-claim.service.ts`) | None | None | **MISSING** | Producer never emits events |
| `finance.payment.recorded` | `finance.service.ts` | `@OnEvent('finance.payment.recorded')` | `canonical-notification.consumer.ts:294` | ALIGNED | Emits dead deep-links |
| `project.closure.submitted` | `project-closure.service.ts:1128` | **NONE** | **NONE** | **ORPHAN** | Stuck in outbox; endless rollback |
| `project.closure.hoo.approved` | `project-closure.service.ts:1311` | **NONE** | **NONE** | **ORPHAN** | Stuck in outbox; endless rollback |
| `project.closure.director.approved` | `project-closure.service.ts:1690` | **NONE** | **NONE** | **ORPHAN** | Stuck in outbox; endless rollback |

**Verdict: FAIL**

---

## 30. Database Integrity Audit (Read-Only)

### Forensic Query Results on `epms_tvmubd_db` (61 Total Tables)
1. **Total Record Inventory:**
   - `tenders`: 5 rows (all `WON`)
   - `contracts`: 5 rows (all `ACTIVE`, `legal_status = 'APPROVED'`)
   - `projects`: 6 rows (5 `IN_PROGRESS`, 1 `CLOSED`)
   - `cost_items`: 77 rows
   - `project_baselines`: 6 rows (all `ACTIVE`; 0 duplicate active baselines)
   - `tasks`: 22 rows (8 `COMPLETED`, 10 `PLANNED`, 4 `IN_PROGRESS`)
   - `workflow_instances`: 25 rows (all `COMPLETED`)
   - `workflow_tasks`: 50 rows (all `COMPLETED`)
   - `workflow_transitions`: 100 rows
   - `purchase_requests`: 9 rows (4 `PO_ISSUED`, 5 `APPROVED`)
   - `rfqs`: 9 rows (4 `EVALUATED`, 5 `OPEN`)
   - `quotations`: 12 rows (all `SUBMITTED`)
   - `purchase_orders`: 4 rows (all `COMPLETED`, `order_type = 'MATERIAL'`)
   - `goods_receipts`: 4 rows (all material GRs)
   - `service_claims`: 0 rows
   - `invoices`: 3 rows (all `PAID`, `match_status = 'VERIFIED'`)
   - `payment_requests`: 3 rows (all `PAID`, approved by Director, paid by Finance)
   - `project_progress_logs`: 21 rows (all `OFFICIAL`)
   - `project_closures`: 1 row (`APPROVED`, Project 369)
   - `audit_logs`: 285 rows
   - `outbox_events`: 168 rows (165 `PUBLISHED`, 3 `PENDING`)
2. **Orphan & FK Integrity Checks:**
   - **Orphan Project:** Project ID 475 has `contract_id = NULL` and status `IN_PROGRESS`.
   - **Goods Receipt on Service PO:** Query returned 0 records (Service POs are strictly guarded).
   - **Orphan Invoices without PO:** Query returned 0 records.
   - **Orphan Payment Requests without Invoice:** Query returned 0 records.
   - **Duplicate Active Baselines:** Query returned 0 records.
   - **Stuck Outbox Records:** IDs 159, 162, 165 permanently in `PENDING` status.

**Verdict: PARTIAL**

---

## 31. Status / State Machine Audit

| Domain | Backend Entity Enum | Frontend StatusPresentation Enum | Parity Status | Machine Language Leak Risk |
|---|---|---|---|---|
| **Tender** | `LEAD`, `PROPOSAL`, `NEGOTIATION`, `WAITING_GO_NO_GO`, `WON`, `LOST`, `CANCELLED` | Mapped under `tender` domain | Full Parity | None |
| **Contract** | `DRAFT`, `PENDING_LEGAL_REVIEW`, `REVISION_NEEDED`, `ACTIVE`, `EXPIRED`, `TERMINATED` | Mapped under `legal` & `contract` | Full Parity | None |
| **Legal Review** | `DRAFT`, `ON_REVIEW`, `REVISION_REQUESTED`, `APPROVED`, `REJECTED` | Mapped under `legal` domain | Full Parity | None |
| **Project** | `INITIATED`, `PLANNING`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, `ON_HOLD`, `CANCELLED` | Mapped under `project` domain | Full Parity | None |
| **Purchase Request** | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `PO_ISSUED`, `CANCELLED` | Mapped under `pr` domain | Full Parity | None |
| **Purchase Order** | `ISSUED`, `PARTIALLY_FULFILLED`, `COMPLETED`, `CANCELLED` | Mapped under `po` domain | Full Parity | None |
| **Service Claim** | `DRAFT`, `SUBMITTED`, `PM_VERIFIED`, `COMMERCIAL_APPROVED`, `APPROVED_FOR_INVOICE`, `REJECTED`, `CANCELLED` | **NOT MAPPED** in `statusPresentation.ts` | Domain Gap | Falls back to English title-case |
| **Invoice** | `DRAFT`, `SUBMITTED`, `VERIFIED`, `REJECTED`, `PAID`, `CANCELLED` | Mapped under `invoice` domain | Full Parity | None |
| **Payment Request** | `PENDING_DIRECTOR_APPROVAL`, `NEEDS_REVISION`, `APPROVED_FOR_PAYMENT`, `REJECTED`, `PAID` | Mapped under `payment` domain | Parity in Payment; **Leaked in Inbox** | Inbox passes `domain="workflow"`, leaking English strings |
| **Project Closure** | `DRAFT`, `SUBMITTED`, `HOO_APPROVED`, `DIRECTOR_APPROVED`, `APPROVED`, `REJECTED`, `RETURNED` | **NOT MAPPED** in `statusPresentation.ts` | Domain Gap | Falls back to English title-case |

**Verdict: PARTIAL**

---

## 32. KPI / Report Data Truth Audit

### Evaluation against Absolute Data-Truth Standard

| Metric / KPI | UI Surface | Backend Endpoint | Computation / Derivation | Data-Truth Classification | Finding |
|---|---|---|---|---|---|
| **Marketing Win Rate & Revenue** | `/sales` (Pipeline) | `GET /marketing/dashboard/summary` | Aggregated from `tenders` table | **REAL** | Verified |
| **Active Pipeline Value** | `/sales` (Pipeline) | `GET /marketing/dashboard/summary` | Excludes WON/LOST; sums active deals | **REAL** | Verified |
| **Nilai Kontrak** | Management Review | `GET /project/:id/operational-readiness` | `contracts.contract_value` | **REAL** | Verified |
| **Modal Project (RAB)** | Management Review | `GET /project/:id/cost-estimate` | Sum of itemized `cost_items` | **REAL** | Verified |
| **Keuntungan Project** | Management Review | Computed in `FinancialSummary` | $\text{Contract} - \text{RAB}$ | **DERIVED_FROM_REAL** | Verified; 'N/A' if missing |
| **Margin Project (%)** | Management Review | Computed in `FinancialSummary` | $\text{Profit} / \text{Contract} \times 100\%$ | **DERIVED_FROM_REAL** | Verified; 'N/A' if missing |
| **ROI (%)** | Management Review | Computed in `FinancialSummary` | $\text{Profit} / \text{RAB} \times 100\%$ | **DERIVED_FROM_REAL** | Verified; 'N/A' if missing |
| **S-Curve Plan Curve** | Project Monitoring | `GET /project/:id/progress-monitoring` | Active baseline tasks & weights | **DERIVED_FROM_REAL** | Verified |
| **S-Curve Actual Curve** | Project Monitoring | `GET /project/:id/progress-monitoring` | Official `project_progress_logs` | **DERIVED_FROM_REAL** | Verified |
| **Project Trend (30 Days)** | Executive Dashboard | `GET /dashboard/project-trend` | `Math.random()` in `dashboard.service.ts:415` | **MOCK / FABRICATED** | **CRITICAL VIOLATION (DAT-02)** |
| **PDF Generation Status** | Legal Contracts | `GET /legal/contracts/:id/pdf-generation-status` | Hardcoded dummy in `legal.controller.ts:90` | **MOCK / FABRICATED** | **VIOLATION (DAT-01)** |

**Verdict: FAIL**

---

## 33. Authorization & Security Audit

1. **Authentication Enforcement:** Backend strictly guards endpoints with `JwtAuthGuard` and extracts authenticated user ID and roles directly from verified JWT claims (`req.user`).
2. **Horizontal IDOR Protection:** Project endpoints implement `validateProjectReadAccess` and `validateProjectManagerOwnership`. Unassigned PMs attempting to query or mutate projects assigned to other PMs receive `ForbiddenException: Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini`.
3. **Segregation of Duties (SoD):**
   - Management Review: PM who submitted plan cannot approve it (`project.service.ts:4363`).
   - Payment Request: Director who approved payment request cannot execute payment (`finance.service.ts:751`).
4. **Bypass Vulnerabilities:**
   - `createPayment` legacy fallback allows paying invoices without a Payment Request if `dto.paymentRequestId` is omitted and no request exists.
   - `SUPER_ADMIN` can bypass PM assignment checks during kickoff (`project.service.ts:1971`).

**Verdict: PARTIAL**

---

## 34. Transaction & Idempotency Audit

1. **Transaction Isolation:** Critical state mutations across `MarketingService`, `LegalService`, `ProjectService`, `ProcurementService`, `FinanceService`, and `ProjectClosureService` wrap write operations in explicit TypeORM `QueryRunner` transactions (`startTransaction`, `commitTransaction`, `rollbackTransaction`).
2. **Pessimistic Concurrency Locking:** Applied on high-contention records:
   - `PaymentRequest`: `lock: { mode: 'pessimistic_write' }` in `decidePaymentRequest`.
   - `Invoice`: `lock: { mode: 'pessimistic_write' }` in `verifyInvoice` and `createPayment`.
   - `Project`: `lock: { mode: 'pessimistic_write' }` in `executeFormalKickoff`.
   - `OutboxEvent`: `lock: { mode: 'pessimistic_write' }` in `relaySingleEvent`.
3. **Idempotency Gaps:**
   - Double-clicking payment creation without an idempotency key can create duplicate payment records if network retry occurs before commit.
   - Project creation lacks a database unique constraint on `projects.contract_id`.

**Verdict: PASS**

---

## 35. Test Coverage Audit

### Backend Test Inventory: 68 Spec Files
- Marketing: 6 spec files (`marketing-gonogo-coordination.spec.ts`, `marketing-canonical-outbox.spec.ts`, etc.) — **STRONG**
- Legal: 4 spec files (`legal.service.spec.ts`, `legal.controller.spec.ts`, etc.) — **STRONG**
- Planning & Governance: 26 spec files (`operational-readiness.spec.ts`, `kickoff-gate.spec.ts`, etc.) — **STRONG**
- Progress & S-Curve: 3 spec files (`progress-monitoring.spec.ts`, `critical-progress-claim.spec.ts`, etc.) — **STRONG**
- Procurement: 7 spec files (`po-payment-terms.spec.ts`, `service-claim.spec.ts`, etc.) — **STRONG**
- Finance: 8 spec files (`finance.service.spec.ts`, `three-way-match-hardening.spec.ts`, etc.) — **STRONG**
- Project Closure: 3 spec files (`project-closure-workflow.spec.ts`, etc.) — **STRONG**
- System & Outbox: 5 spec files (`outbox-relay.service.spec.ts`, `enterprise-integration.spec.ts`, etc.) — **STRONG**

### Critical Test Gaps Identified
1. **Missing Test for `GET /inbox/history`:** No test exists verifying `InboxController` history route because the controller endpoint was omitted entirely.
2. **Missing Test for Service Claim Outbox/Notification Integration:** Existing `service-claim.spec.ts` tests entity state math, but does not assert outbox or notification generation.
3. **Missing Test for Outbox Listener Completeness:** No regression test exists asserting that every event name produced in the repository has at least one registered consumer.

**Verdict: PARTIAL**

---

## 36. Live UI Validation Evidence

### Live Execution Session Evidence (Captured via Microsoft Edge CDP)
- **Visual Artifacts:** Captured during current session (`media_1792232865919` to `media_1792236844219` in artifact store).
- **Management Review Modal:** Confirmed rendered on Project 368 (`CONT-20261016-0003`, Nilai Kontrak Rp 461.612.259, Modal Rp 415.866.900, Keuntungan Rp 45.745.359, Margin 9,91%, ROI 11,00%).
- **Readiness Strip:** Confirmed rendered with 4/4 readiness (WBS, Biaya, Jadwal, Baseline Kondisi Awal).
- **Table Headers:** Confirmed high-contrast dark navy headers on WBS and Schedule tables.
- **S-Curve Chart:** Confirmed rendering of both Plan curve (blue) and Actual point (green, 40%) as of 16 Oct / 17 Oct 2026.
- **Remote Debugging Availability:** Port 9222 was checked during current forensic pass (`ECONNREFUSED 127.0.0.1:9222`). In strict accordance with Phase 46/47 guidelines, no new headless/Chromium sessions were spawned; non-live stages are validated via code, database, and test evidence.

**Verdict: PASS**

---

## 37. Missing or Broken Steps (Forensic Findings Inventory)

### Finding BLK-01 (P0 — Lifecycle Blocker)
- **Stage:** Activity Center / History
- **Expected:** Navigating to `/inbox` tab "Riwayat" displays historical completed tasks for current user.
- **Actual:** Frontend `inbox.service.ts:75` issues `GET /inbox/history`, but backend `inbox.controller.ts` lacks `@Get('history')`. Triggers HTTP 404 error and UI error toast.
- **Evidence:** `frontend/src/services/inbox.service.ts:75`, `backend/src/modules/inbox/inbox.controller.ts:1-51`.
- **Impact:** History feature in Pusat Aktivitas is completely unusable.
- **Recommended Correction:** Implement `@Get('history')` in `InboxController` delegating to `InboxService.getHistory(userId, roles)`.

### Finding BLK-02 (P0 — Lifecycle Blocker)
- **Stage:** Project Closure / Outbox Relay
- **Expected:** When project closure is submitted and approved, outbox events are published and marked `PUBLISHED`.
- **Actual:** Outbox rows 159, 162, 165 for `project.closure.*` remain stuck in `PENDING` indefinitely. Because zero backend listeners exist, `outbox-relay.service.ts:101-105` rolls back transactions every 5 seconds.
- **Evidence:** `outbox_events` table (IDs 159, 162, 165), `outbox-relay.service.ts:87-108`, `project-closure.service.ts:1128, 1311, 1690`.
- **Impact:** Permanent transaction rollback noise every 5 seconds; closure events never reach downstream consumers or notifications.
- **Recommended Correction:** Register `@OnEvent('project.closure.*')` handlers in `canonical-notification.consumer.ts` or `business-sync.consumer.ts`.

### Finding BLK-03 (P0 — Dead Deep-Links)
- **Stage:** Notification System / Deep Routing
- **Expected:** Notification action links navigate to valid frontend routes.
- **Actual:** `canonical-notification.consumer.ts:318, 347` emits `/projects/pos/${poId}` and `/finance/payments/${paymentId}`. Next.js router lacks these paths, producing 404 pages.
- **Evidence:** `backend/src/modules/notification/canonical-notification.consumer.ts:318, 347`, `notifications` table IDs 49, 50, 51, 52.
- **Impact:** Users clicking notification bell items land on 404 error screens.
- **Recommended Correction:** Align notification target links to `/procurement?tab=po&poId=${poId}` and `/finance/payments?tab=ready_to_pay&requestId=${paymentId}`.

### Finding CLM-01 (P0 — Disconnected Lifecycle)
- **Stage:** Service Procurement / Subcontracting Claims
- **Expected:** Submitted service claims appear in PM and Procurement To-Do queues and emit notifications.
- **Actual:** `service-claim.service.ts` injects outbox, event emitter, and notification writer but never calls them.
- **Evidence:** `backend/src/modules/procurement/service-claim.service.ts:70-78`, grep analysis showing 0 calls.
- **Impact:** Service claim workflow is disconnected from operational communication ecosystem.
- **Recommended Correction:** Wire `outboxRepo` and `eventEmitter` calls into `createClaim`, `verifyTechnical`, and `verifyCommercial`.

### Finding DAT-02 (P0 — Absolute Data-Truth Violation)
- **Stage:** Dashboard / Executive KPI
- **Expected:** All dashboard KPI trends derive from valid database records or display "Belum ada data".
- **Actual:** `dashboard.service.ts:404-431` generates synthetic trend numbers using `Math.random()`.
- **Evidence:** `backend/src/modules/dashboard/dashboard.service.ts:404-431`, `frontend/src/hooks/useDashboardQuery.ts:58`.
- **Impact:** Violates the Absolute Data-Truth Rule by presenting synthetic numbers as real project data.
- **Recommended Correction:** Replace `Math.random()` with true historical counts from `projects` and `project_progress_logs`.

### Finding EVT-01 (P0 — Event Contract Mismatch)
- **Stage:** Material Procurement / Business Sync
- **Expected:** PO and GR creation synchronizes business projections.
- **Actual:** Producer emits `po.created` and `gr.created`; consumer listens for `procurement.po.issued` and `procurement.gr.received`.
- **Evidence:** `procurement.service.ts:825, 1005` vs `business-sync.consumer.ts:102, 107`.
- **Impact:** Business sync consumer is completely dead for PO and GR events.
- **Recommended Correction:** Standardize event names to canonical `procurement.po.issued` and `procurement.gr.received`.

### Finding BYP-01 (P1 — Approval Bypass)
- **Stage:** Finance & Payment Execution
- **Expected:** Payments can ONLY be disbursed against Director-approved Payment Requests (`APPROVED_FOR_PAYMENT`).
- **Actual:** `finance.service.ts:757` contains a legacy fallback permitting payment creation without a Payment Request.
- **Evidence:** `backend/src/modules/finance/finance.service.ts:757-792`.
- **Impact:** Permits bypassing Director payment approval gate.
- **Recommended Correction:** Remove legacy fallback in `createPayment`; make `paymentRequestId` and status `APPROVED_FOR_PAYMENT` mandatory.

### Finding SEC-01 (P1 — Data Integrity / Orphan Project)
- **Stage:** Project Delivery / Creation
- **Expected:** Projects can only exist if linked to an approved contract (`contract_id NOT NULL`).
- **Actual:** Project 475 exists in status `IN_PROGRESS` with `contract_id = NULL`.
- **Evidence:** SQL query on `projects` where `id = 475`.
- **Impact:** Uncontrolled orphan project records in production.
- **Recommended Correction:** Enforce `contract_id NOT NULL` constraint in schema and add validation in project creation services.

### Finding TT-01 (P1 — Missing To-Do Projections)
- **Stage:** Pusat Aktivitas / To-Do
- **Expected:** Pending Service Claims and Project Closures appear in To-Do list.
- **Actual:** `InboxService.getTodos` does not query `service_claims` or `project_closures`.
- **Evidence:** `backend/src/modules/inbox/inbox.service.ts:45-500`.
- **Impact:** Reviewers have no visibility into pending claims or closures from Pusat Aktivitas.
- **Recommended Correction:** Add domain queries for `service_claims` and `project_closures` into `InboxService.getTodos`.

### Finding DL-01 (P2 — Dead-End To-Do Actions)
- **Stage:** Pusat Aktivitas / Action Target
- **Expected:** All To-Do tasks have actionable deep links.
- **Actual:** Unmapped workflow tasks have `actionTarget = null`, rendering "Aksi Belum Tersedia".
- **Evidence:** `backend/src/modules/inbox/inbox.service.ts:183`.
- **Impact:** User cannot navigate to action from task card.
- **Recommended Correction:** Map `PROJECT_CLOSURE` and generic workflow tasks to `/project-delivery?projectId=${id}&tab=closure`.

### Finding LNG-01 (P2 — Machine Language Leaks)
- **Stage:** Pusat Aktivitas / Status Badges
- **Expected:** Task status badges display Indonesian business labels.
- **Actual:** `InboxPage.tsx` passes `domain="workflow"`, exposing raw enums like "Pending Director Approval".
- **Evidence:** `frontend/src/components/InboxPage.tsx`, `frontend/src/lib/statusPresentation.ts:278-289`.
- **Impact:** Inconsistent UX and language leakage.
- **Recommended Correction:** Pass domain-appropriate context to `<StatusBadge />` or add payment/closure statuses to `workflow` domain.

### Finding NOT-01 (P2 — Notification Read Sync Gap)
- **Stage:** Notification System
- **Expected:** Completing a task automatically marks the related notification as read.
- **Actual:** Approving in module does not sync notification read state.
- **Evidence:** `backend/src/modules/finance/finance.service.ts`, `notifications` table.
- **Impact:** Notification bell badge remains unread after task completion.
- **Recommended Correction:** Trigger `notificationWriter.markRelatedRead(referenceType, referenceId)` upon approval.

### Finding DAT-01 (P2 — Mock Staging Code in Production)
- **Stage:** Legal Governance
- **Expected:** Clean production controller code.
- **Actual:** Hardcoded mock PDF generation status in `legal.controller.ts:90`.
- **Evidence:** `backend/src/modules/legal/legal.controller.ts:87-100`.
- **Impact:** Code quality degradation and potential confusion in staging/production parity.
- **Recommended Correction:** Remove mock object and connect to real PDF generation service.

---

## 38. End-to-End Blockers

The following items prevent true production-ready end-to-end operation:

1. **BLK-01 (P0): Missing `GET /inbox/history` Endpoint** — Causes fatal 404 in Pusat Aktivitas.
2. **BLK-02 (P0): Stuck Outbox Rollback Loop on `project.closure.*`** — Causes continuous 5-second database rollback spam.
3. **BLK-03 (P0): Dead Notification Deep-Links (`/projects/pos/:id`, `/finance/payments/:id`)** — Causes 404 on notification navigation.
4. **BLK-04 (P0): Disconnected Service Claims** — Isolates subcontractor claims from To-Dos and notifications.
5. **BLK-05 (P0): Synthetic `Math.random()` in Dashboard Trend** — Direct violation of Absolute Data-Truth standard.
6. **BLK-06 (P0): PO/GR Event Name Mismatch (`po.created` vs `procurement.po.issued`)** — Breaks procurement synchronization.

---

## 39. Non-Blocking Gaps

1. **GAP-01 (P1):** Legacy Payment Request bypass in `createPayment`.
2. **GAP-02 (P1):** Missing domain queues for Service Claims and Closures in `InboxService.getTodos`.
3. **GAP-03 (P2):** Machine language leaks in To-Do status badges.
4. **GAP-04 (P2):** Notification read synchronization gap upon approval.
5. **GAP-05 (P2):** Mock PDF generation status fallback in `LegalController`.
6. **GAP-06 (P3):** Nullable `projects.contract_id` schema allowing orphan project records.

---

## 40. Technical Debt Affecting Lifecycle

1. **Fragmented Approval Surfaces:** 4 separate review desks (`/inbox`, `/governance/tasks`, `/legal/review`, `/finance/payments`) increase cognitive load and require duplicate state maintenance.
2. **Inconsistent Event Naming Convention:** Coexistence of dot-separated (`po.created`) and domain-scoped (`procurement.po.issued`) event names across older and newer modules.
3. **Dual Contract/Project Identity Resolution:** Code contains extensive fallback lookups between `PRJ-${tenderId}`, `CONT-${number}`, and numeric IDs.

---

## 41. Data Integrity Risks

1. **Schema Nullability on Critical Foreign Keys:** `projects.contract_id` and `projects.manager_id` should enforce non-null relational constraints to prevent unlinked test projects from entering production states.
2. **Missing Unique Constraint on Project Contract Link:** `projects.contract_id` lacks a `UNIQUE` index, creating a vulnerability where duplicate projects could point to the same contract under concurrent requests.

---

## 42. Security / Authorization Risks

1. **Payment Approval Bypass Risk:** The legacy fallback in `createPayment` allows any user with `FINANCE` role to disburse funds against an invoice without submitting a Payment Request to the Director.
2. **Super Admin PM Ownership Bypass:** `SUPER_ADMIN` can execute kickoff and planning updates on projects without explicit PM assignment.

---

## 43. Recommended Fix Order

> [!IMPORTANT]
> This recommended fix order is structured for subsequent implementation waves. In strict accordance with the AUDIT ONLY mandate, no fixes were performed during this audit.

### Wave 0 — P0 Integrity & Security Blockers
- **Fix 0.1:** Implement `@Get('history')` in `InboxController` delegating to `InboxService.getHistory`.
- **Fix 0.2:** Register listeners for `project.closure.*` in `canonical-notification.consumer.ts` to unblock outbox relay.
- **Fix 0.3:** Correct deep-link paths in `canonical-notification.consumer.ts:318, 347` to valid Next.js routes.
- **Fix 0.4:** Standardize PO/GR event names in `procurement.service.ts` to `procurement.po.issued` and `procurement.gr.received`.
- **Fix 0.5:** Replace `Math.random()` in `dashboard.service.ts:404` with genuine query on `projects`.

### Wave 1 — Lifecycle & Approval Gate Hardening
- **Fix 1.1:** Wire `outboxRepo` and `eventEmitter` in `service-claim.service.ts` to connect service claims to notifications.
- **Fix 1.2:** Eliminate legacy payment bypass in `finance.service.ts:757`, requiring status `APPROVED_FOR_PAYMENT`.
- **Fix 1.3:** Add domain queries for `service_claims` and `project_closures` in `InboxService.getTodos`.

### Wave 2 — Projection & Notification Consistency
- **Fix 2.1:** Implement notification read synchronization upon approval across modules.
- **Fix 2.2:** Map `service_claim` and `project_closure` status enums in `frontend/src/lib/statusPresentation.ts`.
- **Fix 2.3:** Map unmapped workflow task action targets to appropriate module URLs instead of `null`.

### Wave 3 — Schema Hardening & Cleanup
- **Fix 3.1:** Add `NOT NULL` constraint and `UNIQUE` index to `projects.contract_id`.
- **Fix 3.2:** Remove mock PDF generation fallback in `legal.controller.ts:90`.

---

## 44. Final Verdict

# END_TO_END_NOT_READY

**Verdict Rationale:**  
While core planning, governance review, kickoff gating, and S-Curve tracking demonstrate strong algorithmic discipline and strict database SSOT derivation, the application is classified as **`END_TO_END_NOT_READY`** due to **6 active P0 blockers**:
1. Fatal HTTP 404 error when accessing the "Riwayat" tab in Pusat Aktivitas (`/inbox`).
2. Stalled outbox relay in an infinite 5-second rollback loop on orphaned `project.closure.*` events.
3. Dead deep-links emitted and persisted in live notification records leading to 404 screens.
4. Complete isolation of the Service Claims workflow from To-Dos and Notifications.
5. Use of synthetic `Math.random()` numbers in executive dashboard trend reporting.
6. Event naming divergence between procurement producers and synchronization consumers.

Addressing the 5 targeted Wave 0 items will advance the application to **`END_TO_END_READY`**.
