# EPMS — MASTER TASK / HISTORY / NOTIFICATION / USER-FACING LANGUAGE AUDIT
## FORENSIC END-TO-END AUDIT REPORT (AUDIT ONLY — NO FIX)
**Document Reference:** `docs/audit/EPMS_MASTER_TASK_HISTORY_NOTIFICATION_LANGUAGE_AUDIT_2026-10-16.md`  
**Audit Date:** 2026-10-16  
**Auditor Mode:** READ ONLY / FORENSIC AUDIT  
**Status:** COMPLETE & AUTHORITATIVE  

---

## TABLE OF CONTENTS
1. [A. EXECUTIVE SUMMARY](#a-executive-summary)
2. [B. AUDIT SCOPE & METHODOLOGY](#b-audit-scope--methodology)
3. [C. TASK / TODO INVENTORY](#c-task--todo-inventory)
4. [D. HISTORY INVENTORY](#d-history-inventory)
5. [E. NOTIFICATION INVENTORY](#e-notification-inventory)
6. [F. APPROVAL CENTER RELATIONSHIP](#f-approval-center-relationship)
7. [G. DEEP-LINK MATRIX](#g-deep-link-matrix)
8. [H. ROLE / RECIPIENT MATRIX](#h-role--recipient-matrix)
9. [I. COUNTER PARITY](#i-counter-parity)
10. [J. READ / UNREAD LIFECYCLE](#j-read--unread-lifecycle)
11. [K. GHOST / DUPLICATE / STALE ITEMS](#k-ghost--duplicate--stale-items)
12. [L. MACHINE LANGUAGE LEAKS](#l-machine-language-leaks)
13. [M. MIXED LANGUAGE FINDINGS](#m-mixed-language-findings)
14. [N. LABEL / CAPTION INCONSISTENCIES](#n-label--caption-inconsistencies)
15. [O. NOTIFICATION COPY INCONSISTENCIES](#o-notification-copy-inconsistencies)
16. [P. DATE / ACTOR / REFERENCE FORMATTING](#p-date--actor--reference-formatting)
17. [Q. EVENT DELIVERY / OUTBOX HEALTH](#q-event-delivery--outbox-health)
18. [R. AUTHORIZATION FINDINGS](#r-authorization-findings)
19. [S. FULL USER-FACING STRING INVENTORY](#s-full-user-facing-string-inventory)
20. [T. CANONICAL TERMINOLOGY MATRIX](#t-canonical-terminology-matrix)
21. [U. BUSINESS EVENT → TASK → NOTIFICATION → HISTORY MATRIX](#u-business-event--task--notification--history-matrix)
22. [V. FINDINGS BY SEVERITY](#v-findings-by-severity)
23. [W. ROOT CAUSES](#w-root-causes)
24. [X. RECOMMENDED FIX PHASES](#x-recommended-fix-phases)
25. [Y. MANDATORY FINAL COUNTS](#y-mandatory-final-counts)
26. [Z. FINAL VERDICT](#z-final-verdict)

---

## A. EXECUTIVE SUMMARY

An exhaustive forensic end-to-end audit was conducted across the entire EPMS operational communication ecosystem, encompassing **Tugas (To-Do)**, **Riwayat (History)**, **Notifikasi (Notifications)**, **Pusat Aktivitas (Activity Center)**, **Approval Center relationships**, **Deep-link routing**, **Counters/Badges**, and **User-Facing Language**.

The audit was executed under strict **READ ONLY** operating mode. Zero application source files were altered, zero database records were created, mutated, or deleted, and zero test transactions were executed.

### Critical Takeaways:
1. **Pusat Aktivitas History is 100% Broken (P0):** The frontend service `frontend/src/services/inbox.service.ts` calls `GET /inbox/history`. However, `backend/src/modules/inbox/inbox.controller.ts` only implements `@Get('todos')` and `@Get('summary')`. Navigating to the "Riwayat" tab triggers an HTTP 404 error, toast error *"Gagal memuat riwayat tugas"*, rendering the History surface completely dysfunctional.
2. **Dead Deep-Links Emitted and Persisted (P0):** The backend canonical notification consumer (`canonical-notification.consumer.ts`) emits hardcoded deep-links `/projects/pos/${poId}` and `/finance/payments/${paymentId}`. Neither route exists in Next.js. Four live notification records (IDs 49, 50, 51, 52) in the database contain these dead routes.
3. **Outbox Relay Stalled on Orphan Events (P0):** The `outbox_events` table contains 3 records (IDs 159, 162, 165 for `project.closure.*`) that are perpetually stuck in status `PENDING`. Because zero backend event listeners are registered for `project.closure.*`, the outbox relay rolls back the transaction every 5 seconds, retrying infinitely without publishing.
4. **Service Claims Disconnected from Notification and Task Ecosystem (P0):** `service-claim.service.ts` injects `OutboxEvent`, `EventEmitter2`, and `CanonicalNotificationWriter`, but calls none of them. Service claims require PM technical verification and Procurement commercial approval, yet create zero tasks in Pusat Aktivitas and emit zero notifications.
5. **PO/GR Producer vs Consumer Event Name Mismatch (P0):** `procurement.service.ts` emits `po.created` and `gr.created`, whereas `business-sync.consumer.ts` listens to `procurement.po.issued` and `procurement.gr.received`. Due to this naming mismatch, synchronization never occurs.
6. **Machine Language Leaks in To-Do Status Badges (P2):** In `InboxPage.tsx`, tasks render `<StatusBadge domain="workflow" status={item.status} />`. Because domain task statuses (`PENDING_DIRECTOR_APPROVAL`, `NEEDS_REVISION`, `APPROVED_FOR_PAYMENT`, `PENDING_VERIFICATION`, etc.) are not mapped under the `workflow` domain, `statusPresentation.ts` falls back to splitting by underscores and title-casing into English, exposing raw enum values (e.g., *"Pending Director Approval"*, *"Needs Revision"*).

---

## B. AUDIT SCOPE & METHODOLOGY

### 1. Scope
The audit inspected all producers and consumers across 18 business domains:
Marketing, Tender/Proposal, Commercial/Budget, Legal, Contract, Project Creation, PM Assignment, Planning, Management Review, Project Progress, Progress Verification, Procurement Material, Procurement Service, Procurement Reconciliation, PR, RFQ, Quotation, Vendor Comparison, Material PO, Goods Receipt, Service PO, SPK / Work Order, Service Claim, PM Technical Verification, Procurement Commercial Approval, Finance Invoice, Finance Verification, Payment Request, Director Payment Approval, Finance Payment, Project Closure, Return/Revision, Rejection, and System/SLA Alerts.

### 2. Roles Evaluated
`MARKETING`, `LEGAL`, `PMO`, `PROJECT_MANAGER`, `PURCHASING`, `PROCUREMENT`, `FINANCE`, `HEAD_OF_OPERATIONS`, `DIRECTOR`, `ADMIN`, `SUPER_ADMIN`, `GENERAL_MANAGER`, `MANAGER`.

### 3. Classification Standards
- `VERIFIED_SOURCE`: Confirmed by static analysis of repository source code with exact file and line numbers.
- `VERIFIED_DATABASE`: Confirmed by read-only SQL queries on the active database (`epms_tvmubd_db`).
- `VERIFIED_LIVE_UI`: Confirmed via frontend routing and rendering inspection.
- `INFERRED`: Derived from logical deduction based on verified evidence.
- `NOT_PROVEN`: Inconclusive or unobservable without mutating state.

---

## C. TASK / TODO INVENTORY

Pusat Aktivitas (`/inbox`) To-Do items are aggregated by `backend/src/modules/inbox/inbox.service.ts` via `GET /inbox/todos`. It merges two primary mechanisms:
1. **Authoritative Workflow Tasks (`workflow_tasks`)**
2. **Authoritative Domain Queues**

### Task Type Master Table (18 Task Types)

| ID | Task Type | Source Table | Source Service / Mechanism | Actionable Role | Status Filter / Open Condition | Deep Link Target | Primary Action | Human Label (Indonesian) | Status |
|---|---|---|---|---|---|---|---|---|---|
| TT-01 | `PURCHASE_REQUEST_APPROVAL` | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `PMO`, `MANAGER`, `DIRECTOR` | `wt.status = 'PENDING'` | `/procurement?tab=pr&prId={id}` | Review PR | Review & Persetujuan Purchase Request | VERIFIED_SOURCE |
| TT-02 | `PM_REVISION` | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `PROJECT_MANAGER` | `nodeId IN PM_REVISION_NODES` | `/project-delivery?projectId={id}&action=operational-plan` | Revisi Rencana | Revisi Rencana Operasional Proyek | VERIFIED_SOURCE |
| TT-03 | `MANAGEMENT_REVIEW` | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `HEAD_OF_OPERATIONS`, `PROCUREMENT`, `FINANCE`, `DIRECTOR` | `nodeId IN GOVERNANCE_MANAGEMENT_REVIEW_NODES` | `/governance/tasks?taskId={id}&projectId={id}` | Review Rencana | Review Rencana Operasional Proyek | VERIFIED_SOURCE |
| TT-04 | `GO_NOGO_APPROVAL` | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `DIRECTOR`, `GENERAL_MANAGER` | `task_key = 'GO_NOGO_APPROVAL'` | `/sales?tab=1&tenderId={id}&action=go-nogo` | Keputusan Go/No-Go | Persetujuan GO / NO-GO | VERIFIED_SOURCE |
| TT-05 | `GO_NOGO_REVISION` | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `MARKETING` | `task_key = 'GO_NOGO_REVISION'` | `/sales?tab=1&tenderId={id}&action=go-nogo` | Revisi Tender | Revisi GO / NO-GO | VERIFIED_SOURCE |
| TT-06 | `LEGAL_DOCUMENT_REVISION` | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `MARKETING` | `task_key = 'LEGAL_DOCUMENT_REVISION'` | `/sales?tab=1&tenderId={id}` | Revisi Dokumen | Revisi Dokumen SPK / Kontrak | VERIFIED_SOURCE |
| TT-07 | `LEGAL_REVIEW` (Workflow) | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `LEGAL` | `task_key = 'LEGAL_REVIEW'` | `/legal/review?contractId={id}` | Review Legal | Review Legal Kontrak | VERIFIED_SOURCE |
| TT-08 | `PROJECT_CLOSURE` (Workflow) | `workflow_tasks` | `WorkflowEngineService.getMyTasks` | `HEAD_OF_OPERATIONS`, `DIRECTOR` | `entity_type = 'PROJECT_CLOSURE'` | `null` (Aksi Belum Tersedia) | Tidak ada | Tugas Alur Kerja Penutupan | VERIFIED_SOURCE (BROKEN) |
| TT-09 | `LEGAL_REVIEW` (Domain) | `contracts` | `InboxService.getTodos` | `LEGAL`, `SUPER_ADMIN`, `ADMIN` | `status = 'PENDING_LEGAL_REVIEW'` | `/legal/review?contractId={id}` | Review Legal | Review Kontrak | VERIFIED_SOURCE |
| TT-10 | `GO_NOGO_APPROVAL` (Domain) | `tenders` | `InboxService.getTodos` | `DIRECTOR`, `GENERAL_MANAGER`, `SUPER_ADMIN` | `stage = 'WAITING_GO_NO_GO'` | `/sales?tab=1&tenderId={id}&action=go-nogo` | Keputusan Go/No-Go | Persetujuan GO / NO-GO | VERIFIED_SOURCE |
| TT-11 | `PAYMENT_REQUEST_APPROVAL` | `payment_requests` | `InboxService.getTodos` | `DIRECTOR`, `SUPER_ADMIN` | `status = 'PENDING_DIRECTOR_APPROVAL'` | `/finance/payments?tab=approvals&requestId={id}` | Setujui Pembayaran | Persetujuan Pembayaran | VERIFIED_SOURCE |
| TT-12 | `PAYMENT_REQUEST_REVISION` | `payment_requests` | `InboxService.getTodos` | `FINANCE`, `SUPER_ADMIN` | `status = 'NEEDS_REVISION'` | `/finance/payments?tab=requests&requestId={id}` | Revisi Pengajuan | Revisi Pengajuan Pembayaran | VERIFIED_SOURCE |
| TT-13 | `PROCESS_PAYMENT` | `payment_requests` | `InboxService.getTodos` | `FINANCE`, `SUPER_ADMIN` | `status = 'APPROVED_FOR_PAYMENT'` | `/finance/payments?tab=ready_to_pay&requestId={id}` | Catat Pembayaran | Proses Pembayaran | VERIFIED_SOURCE |
| TT-14 | `PROGRESS_CLAIM_VERIFICATION` | `project_progress_logs` | `InboxService.getTodos` | `HEAD_OF_OPERATIONS`, `PMO`, `SUPER_ADMIN` | `status = 'PENDING_VERIFICATION'` | `/project-delivery?view=workspace&projectId={id}&section=tasks&progressClaimId={id}` | Verifikasi Progres | Verifikasi Klaim Progres | VERIFIED_SOURCE |
| TT-15 | `SERVICE_CLAIM_PM_VERIFICATION` | `service_claims` | None (Missing Producer) | `PROJECT_MANAGER` | `status = 'SUBMITTED'` | `/procurement?tab=service-claim&claimId={id}` | Verifikasi Teknis | Verifikasi Teknis Klaim Jasa | NOT_PROVEN (MISSING) |
| TT-16 | `SERVICE_CLAIM_COMMERCIAL_APPROVAL` | `service_claims` | None (Missing Producer) | `PROCUREMENT` | `status = 'PM_VERIFIED'` | `/procurement?tab=service-claim&claimId={id}` | Persetujuan Komersial | Persetujuan Komersial Klaim Jasa | NOT_PROVEN (MISSING) |
| TT-17 | `PROJECT_CLOSURE_HOO_REVIEW` | `project_closures` | None (Missing Domain Queue) | `HEAD_OF_OPERATIONS` | `status = 'SUBMITTED'` | `/project-delivery?projectId={id}&tab=closure` | Review Penutupan | Review Penutupan Proyek | NOT_PROVEN (MISSING) |
| TT-18 | `PROJECT_CLOSURE_DIRECTOR_APPROVAL` | `project_closures` | None (Missing Domain Queue) | `DIRECTOR` | `status = 'HOO_APPROVED'` | `/project-delivery?projectId={id}&tab=closure` | Persetujuan Penutupan | Persetujuan Penutupan Proyek | NOT_PROVEN (MISSING) |

---

## D. HISTORY INVENTORY

### History Sources Analysis (7 Sources)

1. **`workflow_transitions` (Authoritative Table):**
   - 88 rows in active database.
   - Captures workflow actions: `START` (22), `APPROVE` (44), `END` (22).
   - Contains: `workflow_instance_id`, `from_node_id`, `to_node_id`, `action`, `actor_user_id`, `actor_role_id`, `comment`, `created_at`.
2. **`audit_logs` (System Audit Trail):**
   - 255 rows in active database.
   - Captures: `action`, `entity_name`, `entity_id`, `user_id`, `old_values`, `new_values`, `ip_address`, `created_at`.
   - Accessible via `/audit-trail` (Super Admin / Admin only).
3. **`project_progress_logs`:**
   - 4 rows in active database.
   - Tracks submission and verification of project progress claims.
4. **`notifications` Table:**
   - 52 rows (49 unread, 3 read).
   - Functions as an activity stream for notifications, but lacks business transition commentary.
5. **`contract_legal_histories` / Contract Review Timeline:**
   - Tracks legal status changes, review comments, and revision requests.
6. **`payment_requests` Transition Timestamps:**
   - Tracks `submitted_at`, `approved_at`, `returned_at`, `paid_at`, and `revision_notes`.
7. **`GET /inbox/history` (Missing Backend Endpoint):**
   - Expected by `frontend/src/services/inbox.service.ts:L75`.
   - Intended to provide unified task completion history for the current user in Pusat Aktivitas.
   - **Current Status: 404 NOT FOUND.**

---

## E. NOTIFICATION INVENTORY

### Notification Catalogue (20 Distinct Notification Types)

| Code | Event Name | Handler Location | Channel | Title | Target Role | Default Target Link | Actionable / Informational | Status |
|---|---|---|---|---|---|---|---|---|
| NT-01 | `marketing.tender.won` | `canonical-notification.consumer.ts:27` | DB Notification | Tender Dimenangkan | `MARKETING`, `PMO` | `/sales` | Informational | VERIFIED_SOURCE |
| NT-02 | `marketing.tender.lost` | `canonical-notification.consumer.ts:55` | DB Notification | Tender Tidak Berhasil | `MARKETING` | `/sales` | Informational | VERIFIED_SOURCE |
| NT-03 | `marketing.spk.uploaded` | `canonical-notification.consumer.ts:83` | DB Notification | SPK Baru Diunggah | `LEGAL` | `/legal/review?tab=WAITING` | Actionable | VERIFIED_SOURCE |
| NT-04 | `legal.contract.approved` | `canonical-notification.consumer.ts:127` | DB Notification | Kontrak Disetujui Legal | `MARKETING`, `PMO` | `/project-delivery` | Informational | VERIFIED_SOURCE |
| NT-05 | `legal.contract.revision_requested` | `canonical-notification.consumer.ts:196` | DB Notification | Revisi Dokumen Kontrak | `MARKETING` | `/sales/tenders/{id}` | Actionable | VERIFIED_SOURCE |
| NT-06 | `project.pm.assigned` | `canonical-notification.consumer.ts:244` | DB Notification | Penugasan Project Manager | `PROJECT_MANAGER` | `/project-delivery` | Actionable | VERIFIED_SOURCE |
| NT-07 | `finance.payment.recorded` (PM) | `canonical-notification.consumer.ts:294` | DB Notification | Pembayaran Diterima | `PROJECT_MANAGER` | `/projects/pos/{id}` (BROKEN) | Informational | VERIFIED_SOURCE |
| NT-08 | `finance.payment.recorded` (Payer) | `canonical-notification.consumer.ts:294` | DB Notification | Transaksi Berhasil | `FINANCE` | `/finance/payments/{id}` (BROKEN) | Informational | VERIFIED_SOURCE |
| NT-09 | `system.sla.spk_grace_expired` | `canonical-notification.consumer.ts:376` | DB Notification | SLA SPK Berakhir | `MARKETING`, `LEGAL` | `/sales/tenders/{id}` | Actionable | VERIFIED_SOURCE |
| NT-10 | `system.sla.revision_expired` | `canonical-notification.consumer.ts:410` | DB Notification | SLA Revisi Berakhir | `MARKETING` | `/sales/tenders/{id}` | Actionable | VERIFIED_SOURCE |
| NT-11 | `system.sla.revision_reminder_h1` | `canonical-notification.consumer.ts:448` | DB Notification | Pengingat SLA H-1 | `MARKETING` | `/sales/tenders/{id}` | Informational | VERIFIED_SOURCE |
| NT-12 | `system.sla.discount_timeout` | `canonical-notification.consumer.ts:485` | DB Notification | URGENT: Tender Approval Escalated | `DIRECTOR` | `/sales/tenders/{id}` | Actionable | VERIFIED_SOURCE |
| NT-13 | `system.sla.grace_extended` | `canonical-notification.consumer.ts:528` | DB Notification | Masa Tenggang SPK Diperpanjang | `LEGAL` | `/legal/review?tab=REVISION` | Informational | VERIFIED_SOURCE |
| NT-14 | `marketing.gonogo.submitted` | `canonical-notification.consumer.ts:565` | DB Notification | Pengajuan Go/No-Go Tender | `DIRECTOR` | `/sales/tenders/{id}` | Actionable | VERIFIED_SOURCE |
| NT-15 | `marketing.gonogo.approved` | `canonical-notification.consumer.ts:596` | DB Notification | Persetujuan Go/No-Go Diberikan | `MARKETING` | `/sales/tenders/{id}` | Informational | VERIFIED_SOURCE |
| NT-16 | `marketing.discount.critical_warning` | `canonical-notification.consumer.ts:627` | DB Notification | Peringatan Diskon Kritis | `DIRECTOR` | `/sales?tab=1&tenderId={id}&action=discount-approval` | Actionable | VERIFIED_SOURCE |
| NT-17 | `marketing.discount.rejected` | `canonical-notification.consumer.ts:666` | DB Notification | Pengajuan Diskon Ditolak | `MARKETING` | `/sales/tenders/{id}` | Informational | VERIFIED_SOURCE |
| NT-18 | `marketing.discount.approved` | `canonical-notification.consumer.ts:698` | DB Notification | Pengajuan Diskon Disetujui | `MARKETING` | `/sales/tenders/{id}` | Informational | VERIFIED_SOURCE |
| NT-19 | `project.started` | `canonical-notification.consumer.ts:730` | DB Notification | Proyek Dimulai | `PROJECT_MANAGER` | `/project-delivery` | Informational | VERIFIED_SOURCE |
| NT-20 | `legal.queue.updated` / `contract.resubmitted` | `notification.listener.ts:11-87` | WebSocket / Socket.io | Update Antrean Legal | `LEGAL`, `MARKETING` | WebSocket Push | Informational | VERIFIED_SOURCE |

---

## F. APPROVAL CENTER RELATIONSHIP

### Fragmentation of Approval Surfaces

EPMS lacks a single unified approval action engine. Approval actions are fragmented across 4 separate surfaces:

1. **Pusat Aktivitas (`/inbox`):**
   - Displays aggregated To-Do items.
   - Provides deep links directly to module review drawers/modals.
   - Does NOT host approval decision buttons directly on the cards (acts as a dispatch router).
2. **Project Governance Task Center (`/governance/tasks`):**
   - Dedicated management review surface for Project Operational Plans (`node_hops_review`, `node_procurement_review`, `node_finance_review`, `node_director_approval`).
   - Executes transitions via `POST /governance/tasks/:id/approve` and `POST /governance/tasks/:id/return`.
3. **Legal Review Desk (`/legal/review`):**
   - Dedicated legal review surface for contracts.
   - Executes decisions via `PATCH /contracts/:id/legal-review`.
4. **Finance Payments Desk (`/finance/payments`):**
   - Dedicated payment request approval surface for Director and payment processing for Finance.
   - Executes decisions via `PATCH /finance/payment-requests/:id/approve`.

### State Divergence Risk
Because approvals occur on module pages, if an item is approved on `/finance/payments`, the corresponding To-Do item in `/inbox` disappears only on page refresh. Furthermore, unread notifications for the same event remain in the notification bell drawer because there is no automatic read-state synchronization upon completing an action.

---

## G. DEEP-LINK MATRIX

### Deep-Link Analysis (26 Deep Links Evaluated)

| Link ID | Event / Task | Generated Deep-Link | Target Page in Next.js | Query Parameters | Route Status | Risk / Defect |
|---|---|---|---|---|---|---|
| DL-01 | Purchase Request Approval | `/procurement?tab=pr&prId={id}` | `app/(dashboard)/procurement/page.tsx` | `tab`, `prId` | VALID | Opens PR drawer correctly. |
| DL-02 | PM Operational Plan Revision | `/project-delivery?projectId={id}&action=operational-plan` | `app/(dashboard)/project-delivery/page.tsx` | `projectId`, `action` | VALID | Auto-opens PM revision modal. |
| DL-03 | Project Management Review | `/governance/tasks?taskId={id}&projectId={id}` | `app/(dashboard)/governance/tasks/page.tsx` | `taskId`, `projectId` | VALID | Selects task card in task center. |
| DL-04 | Go/No-Go Decision (Workflow) | `/sales?tab=1&tenderId={id}&action=go-nogo` | `app/(dashboard)/sales/page.tsx` | `tab`, `tenderId`, `action` | VALID | Auto-opens Go/No-Go decision modal. |
| DL-05 | Tender Revision (Workflow) | `/sales?tab=1&tenderId={id}&action=go-nogo` | `app/(dashboard)/sales/page.tsx` | `tab`, `tenderId`, `action` | VALID | Auto-opens revision modal. |
| DL-06 | Legal Document Revision | `/sales?tab=1&tenderId={id}` | `app/(dashboard)/sales/page.tsx` | `tab`, `tenderId` | VALID | Opens tender detail. |
| DL-07 | Legal Review (Workflow) | `/legal/review?contractId={id}` | `app/(dashboard)/legal/review/page.tsx` | `contractId` | VALID | Auto-selects contract for review. |
| DL-08 | Unmapped Workflow Task | `null` | None | None | BROKEN | Card renders disabled *"Aksi Belum Tersedia"*. |
| DL-09 | Legal Review (Domain) | `/legal/review?contractId={id}` | `app/(dashboard)/legal/review/page.tsx` | `contractId` | VALID | Opens legal desk. |
| DL-10 | Go/No-Go Decision (Domain) | `/sales?tab=1&tenderId={id}&action=go-nogo` | `app/(dashboard)/sales/page.tsx` | `tab`, `tenderId`, `action` | VALID | Opens Go/No-Go modal. |
| DL-11 | Director Payment Approval | `/finance/payments?tab=approvals&requestId={id}` | `app/(dashboard)/finance/payments/page.tsx` | `tab`, `requestId` | VALID | Opens approval drawer. |
| DL-12 | Finance Payment Revision | `/finance/payments?tab=requests&requestId={id}` | `app/(dashboard)/finance/payments/page.tsx` | `tab`, `requestId` | VALID | Opens revision request drawer. |
| DL-13 | Finance Payment Execution | `/finance/payments?tab=ready_to_pay&requestId={id}` | `app/(dashboard)/finance/payments/page.tsx` | `tab`, `requestId` | VALID | Opens disbursement drawer. |
| DL-14 | Progress Claim Verification | `/project-delivery?view=workspace&projectId={id}&section=tasks&progressClaimId={id}` | `app/(dashboard)/project-delivery/page.tsx` | `view`, `projectId`, `section`, `progressClaimId` | VALID | Opens task verification drawer. |
| DL-15 | Tender Won Notification | `/sales` | `app/(dashboard)/sales/page.tsx` | None | VALID | Generic landing without record focus. |
| DL-16 | Tender Lost Notification | `/sales` | `app/(dashboard)/sales/page.tsx` | None | VALID | Generic landing. |
| DL-17 | SPK Uploaded Notification | `/legal/review?tab=WAITING` | `app/(dashboard)/legal/review/page.tsx` | `tab` | VALID | Lands on review queue. |
| DL-18 | Contract Approved Notification | `/project-delivery` | `app/(dashboard)/project-delivery/page.tsx` | None | VALID | Generic project delivery landing. |
| DL-19 | Contract Revision Requested | `/sales/tenders/{id}` | `app/(dashboard)/sales/tenders/[id]/page.tsx` | Dynamic Route `[id]` | VALID | Opens tender view. |
| DL-20 | PM Assigned Notification | `/project-delivery` | `app/(dashboard)/project-delivery/page.tsx` | None | VALID | Generic project landing. |
| DL-21 | Finance Payment Recorded (PM) | `/projects/pos/{id}` | None (Route Does Not Exist) | Path param | BROKEN/404 | 404 in direct navigation; patched only in `notificationSync.ts`. |
| DL-22 | Finance Payment Recorded (Payer) | `/finance/payments/{id}` | None (Route Does Not Exist) | Path param | BROKEN/404 | 404 in direct navigation; patched only in `notificationSync.ts`. |
| DL-23 | SLA Expired Notification | `/sales/tenders/{id}` | `app/(dashboard)/sales/tenders/[id]/page.tsx` | Dynamic Route `[id]` | VALID | Opens tender. |
| DL-24 | Discount Timeout Escalation | `/sales/tenders/{id}` | `app/(dashboard)/sales/tenders/[id]/page.tsx` | Dynamic Route `[id]` | VALID | Opens tender. |
| DL-25 | Grace Extended Notification | `/legal/review?tab=REVISION` | `app/(dashboard)/legal/review/page.tsx` | `tab` | VALID | Lands on legal review tab. |
| DL-26 | Project Started Notification | `/project-delivery` | `app/(dashboard)/project-delivery/page.tsx` | None | VALID | Generic project landing. |

---

## H. ROLE / RECIPIENT MATRIX

### Recipient Audit and Segregation of Duties (SoD)

| Role | Authoritative Business Actions | Current System Visibility | SoD Leaks / Ingestion Anomalies |
|---|---|---|---|
| `MARKETING` | Submit Tender, Upload SPK, Revise Go/No-Go, Revise Contract Doc | Sales pipeline, Customer Master, Inbox | Correctly isolated. |
| `LEGAL` | Legal Contract Review, Request Revision, Grant Approval | Contract review desk, Governance contracts | Correctly isolated. |
| `PROJECT_MANAGER` | Submit Operational Plan, Submit Closure, Verify Service Claim | Project delivery, WBS, Procurement PR | PM receives payment recorded notifications via broken `/projects/pos/:id` link. |
| `HEAD_OF_OPERATIONS` | Review Operational Plan, Verify Progress Claims, Review Closure | Project Delivery, Governance Tasks, Inbox | Correctly isolated. |
| `PROCUREMENT` | Review PR, Review Operational Plan, Commercial Sourcing | Procurement desk, PO, GR, Vendor Comparison | Service Claim commercial approval missing from To-Do stream. |
| `FINANCE` | Review Operational Plan (Budget), Verify Invoice, Pay PRQ | Finance desk, Payments, Invoices, Approvals | Receives payment recorded alert with broken `/finance/payments/:id` link. |
| `DIRECTOR` | Go/No-Go Approval, Operational Plan Approval, Payment Approval | Executive dashboards, Governance Tasks, Inbox | Correctly isolated for executive decisions. |
| `SUPER_ADMIN` | Technical Administration, Audit Trail, User Management | Global system access | **SoD Leak:** Included in `LEGAL_REVIEW_ROLES` and `TENDER_GO_NOGO_ROLES`, receiving operational business tasks. |
| `ADMIN` | User Administration, Role Management | Administrative screens | **SoD Leak:** Included in `LEGAL_REVIEW_ROLES`, receiving legal review tasks. |

---

## I. COUNTER PARITY

### Counter and Badge Comparison

| UI Surface / Counter | Frontend Calculation | Backend Source of Truth Query | Discrepancy / Parity Status | Evidence |
|---|---|---|---|---|
| Notification Bell Badge | `calculateAttentionCount(params)` in `attentionCount.ts` | `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0` | PARITY (Deduplicated) | Deduplicates matching To-Dos from unread notifications. |
| Pusat Aktivitas: "Tugas" Tab | `todos.length` | `inboxService.getTodos(userId, roles)` | PARITY | Accurately reflects returned array length. |
| Pusat Aktivitas: "Riwayat" Tab | `historyItems.length` | `GET /inbox/history` (DOES NOT EXIST) | **MISMATCH (HTTP 404)** | Frontend catches error, sets empty array; counter permanently 0 or undefined. |
| Pusat Aktivitas: "Notifikasi" Tab | `unreadNotificationCount` | `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0` | PARITY | Accurately matches backend count. |
| Sidebar "Pusat Aktivitas" Badge | Derived from `inboxSummary.todoCount` | `inboxService.getSummary(userId, roles).todoCount` | PARITY | Reflects actionable task count. |

---

## J. READ / UNREAD LIFECYCLE

### Notification Lifecycle Evaluation

1. **Mark as Read (`PATCH /notifications/:id/read`):**
   - Successfully sets `is_read = 1` and `read_at = NOW()`.
   - Verified on database: 3 records marked as read (IDs 1, 2, 3 for user 1 & user 2).
2. **Mark All as Read (`PATCH /notifications/mark-all-read`):**
   - Updates all records where `user_id = currentUserId AND is_read = 0`.
   - User scope isolation is strictly enforced.
3. **Deep-Link Auto-Read:**
   - Handled on frontend in `NotificationBell.tsx:L104`.
   - Clicking a notification marks it as read before navigating.
4. **Action Completion Synchronization (Defect):**
   - Completing a task in `/governance/tasks` or approving a payment in `/finance/payments` does NOT mark corresponding informational notifications as read.
   - Result: Users retain unread notifications for actions they have already completed.

---

## K. GHOST / DUPLICATE / STALE ITEMS

### Database Forensic Findings

1. **Ghost Tasks:** **0** (All 44 workflow tasks link to valid workflow instances and entities).
2. **Duplicate Tasks:** **0** (Transitional deduplication in `inbox.service.ts:L264-273` successfully prevents duplicate DOMAIN_TENDER when WORKFLOW_TASK exists).
3. **Stale Tasks:** **0** (All 44 workflow tasks are COMPLETED; zero pending workflow tasks remain orphaned).
4. **Duplicate Notifications:** **0** (Enforced by unique index on `dedupe_key` in `notifications` table).
5. **Stale Notifications:** **4** (Notification IDs 49, 50, 51, 52 remain unread with dead links to non-existent `/projects/pos/3`, `/finance/payments/2`, `/projects/pos/2`, `/finance/payments/3`).
6. **Orphan Outbox Events:** **3** (Outbox event IDs 159, 162, 165 stuck in status `PENDING` indefinitely due to zero listeners).

---

## L. MACHINE LANGUAGE LEAKS

### Leaked Enums and Internal Keys (12 Leaks Identified)

| Leak ID | Machine String | Display Location | Source Code | Expected Human Caption | Severity |
|---|---|---|---|---|---|
| ML-01 | `Pending Director Approval` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Menunggu Persetujuan Direktur | P2 |
| ML-02 | `Needs Revision` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Perlu Revisi | P2 |
| ML-03 | `Approved For Payment` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Disetujui untuk Pembayaran | P2 |
| ML-04 | `Pending Verification` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Menunggu Verifikasi | P2 |
| ML-05 | `Waiting Go No Go` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Menunggu Keputusan Go/No-Go | P2 |
| ML-06 | `Pending Legal Review` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Menunggu Review Legal | P2 |
| ML-07 | `Revision Requested` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Diminta Revisi | P2 |
| ML-08 | `On Review` | Pusat Aktivitas To-Do Card Status | `InboxPage.tsx:484` via `statusPresentation.ts:279` | Dalam Review Legal | P2 |
| ML-09 | `PROJECT_CLOSURE` | Pusat Aktivitas Card Subtitle | `InboxPage.tsx:476` (raw entityType) | Penutupan Proyek | P2 |
| ML-10 | `DIRECTOR_APPROVAL` | Database `workflow_tasks.task_key` | `workflow-engine.service.ts` | Persetujuan Direktur | P2 |
| ML-11 | `HOO_REVIEW` | Database `workflow_tasks.task_key` | `workflow-engine.service.ts` | Review Head of Operations | P2 |
| ML-12 | `GO_NOGO_APPROVAL` | Database `workflow_tasks.task_key` | `workflow-engine.service.ts` | Persetujuan Go/No-Go | P2 |

---

## M. MIXED LANGUAGE FINDINGS

### Mixed Indonesian/English Strings (8 Identified)

| Ref ID | Mixed String | Location | Current Text | Proposed Canonical Indonesian |
|---|---|---|---|---|
| MX-01 | Mixed Verb/Title | `canonical-notification.consumer.ts:581` | `"sedang menunggu APPROVE Director"` | `"sedang menunggu Persetujuan Direktur"` |
| MX-02 | English Prefix | `canonical-notification.consumer.ts:683, 715` | `"Notes: ${notes}"` | `"Catatan: ${notes}"` |
| MX-03 | English Title | `canonical-notification.consumer.ts:507` | `"URGENT: Tender Approval Escalated"` | `"MENDESAK: Eskalasi Persetujuan Tender"` |
| MX-04 | Mixed Header | `inbox.service.ts:74` | `"Review & Persetujuan Purchase Request #${entityId}"` | `"Tinjauan & Persetujuan Purchase Request #${entityId}"` |
| MX-05 | Mixed Header | `inbox.service.ts:159` | `"Revisi Dokumen SPK / Kontrak #${contractNumber}"` | `"Revisi Dokumen SPK / Kontrak #${contractNumber}"` |
| MX-06 | Mixed Header | `inbox.service.ts:97` | `"Review Rencana Operasional Proyek #${entityId}"` | `"Tinjauan Rencana Operasional Proyek #${entityId}"` |
| MX-07 | Mixed Title | `inbox.service.ts:108` | `"Persetujuan GO / NO-GO"` | `"Persetujuan Go / No-Go"` |
| MX-08 | Mixed Task Prefix | `inbox.service.ts:432` | `"Verifikasi Klaim Progres: Task #${claim.task_id}"` | `"Verifikasi Klaim Progres: Aktivitas #${claim.task_id}"` |

---

## N. LABEL / CAPTION INCONSISTENCIES

### Terminology Divergence

1. **Task vs To-Do:**
   - Sidebar: *"Pusat Aktivitas"*
   - Page Header: *"Pusat Aktivitas (Unified Inbox)"*
   - Tab 1: *"Tugas"*
   - Subtitle: *"Daftar seluruh tugas operasional dan notifikasi alur kerja"*
   - Filter Option: *"Semua To-Do"*
2. **Review vs Tinjau vs Verifikasi:**
   - Legal desk uses *"Review Legal"*.
   - Project delivery uses *"Verifikasi Progres"*.
   - Governance tasks use *"Review Rencana"*.
   - Recommended standard: **"Tinjau"** for general review, **"Verifikasi"** for technical/accounting checks, **"Setujui"** for authoritative sign-off.
3. **Return vs Revisi:**
   - Governance modal button: *"Kembalikan"*
   - Status badge: *"Perlu Revisi"* / *"Dikembalikan ke PM"*
   - Workflow node: `node_pm_revision_*`

---

## O. NOTIFICATION COPY INCONSISTENCIES

### Notification Template Evaluation

1. **Vague Titles:**
   - Notification ID 50 & 52: Title is *"Transaksi Berhasil"*, Body is *"Pembayaran senilai Rp 224.274.000 berhasil dicatat"*. Lacks PO reference, vendor name, or payment request number in title.
2. **Missing Actor Names:**
   - In `inbox.service.ts:330`: `submittedByName: prq.requester?.fullName || 'Finance User'`. Leaks hardcoded English fallback string.
   - In `inbox.service.ts:368`: `returnedByName: prq.approver?.fullName || 'Direktur'`.

---

## P. DATE / ACTOR / REFERENCE FORMATTING

### Standards & Formatting Parity

| Category | Recommended Standard | Current System Behavior | Defect / Finding |
|---|---|---|---|
| Date / Time | `16 Okt 2026, 14:32` (Indonesian locale) | `new Date(item.createdAt).toLocaleDateString('id-ID')` in `InboxPage.tsx:497` | Mixed formatting: some cards show date only without time; drawer shows relative time (`x menit yang lalu`). |
| Actor Identity | `Nama Lengkap (Role)` | `item.submittedByName`, `item.returnedByName` | When relations are unhydrated, falls back to `'Finance User'` or empty. |
| Business Reference | Prefix + Year + Sequence (e.g. `PR-20261016-001`) | Mixed: Shows raw database IDs (`#1`, `#2`) when entity numbers are unhydrated. | Raw IDs exposed in `Tugas Alur Kerja: #1`. |

---

## Q. EVENT DELIVERY / OUTBOX HEALTH

### Outbox Health Statistics

- **Total Outbox Events:** 165
- **Status PUBLISHED:** 162
- **Status PENDING:** 3
- **Status FAILED:** 0
- **Total Retries:** 0

### Forensic Outbox Defect: Orphan Events
Records #159, #162, #165 are perpetually stuck in `PENDING`:
- **Event #159:** `project.closure.submitted` (Aggregate: `ProjectClosure`, ID: 1, Created: 2026-10-16 10:19:02)
- **Event #162:** `project.closure.hoo.approved` (Aggregate: `ProjectClosure`, ID: 1, Created: 2026-10-16 10:20:35)
- **Event #165:** `project.closure.director.approved` (Aggregate: `ProjectClosure`, ID: 1, Created: 2026-10-16 10:21:28)

**Root Cause:**
In `backend/src/modules/system/outbox-relay.service.ts:L100-106`:
```typescript
if (!delivered) {
  this.logger.debug(
    `Zero listeners accepted canonical event '${canonicalEvent.eventName}' (id: ${event.id}). Retaining as PENDING.`,
  );
  await queryRunner.rollbackTransaction();
  return 'SKIPPED';
}
```
No service registers `@OnEvent('project.closure.*')`. The outbox relay re-evaluates these records every 5 seconds, finds 0 listeners, rolls back, and retains them as `PENDING` indefinitely.

---

## R. AUTHORIZATION FINDINGS

1. **Administrative Role Contamination (SoD Defect):**
   - In `backend/src/modules/inbox/inbox.service.ts:12`:
     `const LEGAL_REVIEW_ROLES = ['LEGAL', 'SUPER_ADMIN', 'ADMIN'];`
   - In `backend/src/modules/inbox/inbox.service.ts:13`:
     `const TENDER_GO_NOGO_ROLES = ['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'];`
   - System administrators (`ADMIN`, `SUPER_ADMIN`) are injected as business actors into legal review and tender decision queues.
2. **Frontend-Only Page Guards:**
   - `frontend/src/app/(dashboard)/legal/review/page.tsx` checks user roles on the client, but backend controller endpoints must strictly ensure role validation on `PATCH /contracts/:id/legal-review`.

---

## S. FULL USER-FACING STRING INVENTORY

| String | File | Surface | Classification | Canonical Indonesian Replacement |
|---|---|---|---|---|
| `"Pusat Aktivitas (Unified Inbox)"` | `InboxPage.tsx:415` | Page Header | ENGLISH / MIXED | `"Pusat Aktivitas"` |
| `"Daftar seluruh tugas operasional dan notifikasi alur kerja"` | `InboxPage.tsx:418` | Subtitle | STANDARD | Preserved |
| `"Tugas"` | `InboxPage.tsx:432` | Tab 1 Label | STANDARD | Preserved |
| `"Riwayat"` | `InboxPage.tsx:442` | Tab 2 Label | STANDARD | Preserved |
| `"Notifikasi"` | `InboxPage.tsx:452` | Tab 3 Label | STANDARD | Preserved |
| `"Semua To-Do"` | `InboxPage.tsx:327` | Filter Dropdown | MIXED_LANGUAGE | `"Semua Tugas"` |
| `"Tugas Alur Kerja"` | `InboxPage.tsx:328` | Filter Dropdown | STANDARD | Preserved |
| `"Review Kontrak Legal"` | `InboxPage.tsx:329` | Filter Dropdown | STANDARD | Preserved |
| `"Persetujuan Tender"` | `InboxPage.tsx:330` | Filter Dropdown | STANDARD | Preserved |
| `"Persetujuan Pembayaran"` | `InboxPage.tsx:331` | Filter Dropdown | STANDARD | Preserved |
| `"Verifikasi Progres Proyek"` | `InboxPage.tsx:332` | Filter Dropdown | STANDARD | Preserved |
| `"Aksi Belum Tersedia"` | `InboxPage.tsx:551` | Button | AMBIGUOUS | `"Tinjau Dokumen"` / `"Buka Detail"` |
| `"Tandai Semua Dibaca"` | `InboxPage.tsx:460` | Button | STANDARD | `"Tandai Semua Sudah Dibaca"` |
| `"Gagal memuat riwayat tugas"` | `InboxPage.tsx:84` | Toast Error | STANDARD | Preserved |
| `"Belum ada tugas yang memerlukan tindakan Anda"` | `InboxPage.tsx:566` | Empty State | STANDARD | Preserved |
| `"Belum ada riwayat aktivitas tugas"` | `InboxPage.tsx:603` | Empty State | STANDARD | Preserved |
| `"Belum ada notifikasi"` | `InboxPage.tsx:640` | Empty State | STANDARD | Preserved |
| `"Pending Director Approval"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Menunggu Persetujuan Direktur"` |
| `"Needs Revision"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Perlu Revisi"` |
| `"Approved For Payment"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Disetujui untuk Pembayaran"` |
| `"Pending Verification"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Menunggu Verifikasi"` |
| `"Waiting Go No Go"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Menunggu Go/No-Go"` |
| `"Pending Legal Review"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Menunggu Review Legal"` |
| `"Revision Requested"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Diminta Revisi"` |
| `"On Review"` | `statusPresentation.ts:282` | Badge | MACHINE_LANGUAGE | `"Dalam Review"` |

---

## T. CANONICAL TERMINOLOGY MATRIX

| Current Term | Used In | Problem | Canonical Indonesian Term |
|---|---|---|---|
| `To-Do` / `Todo` / `Task` | Pusat Aktivitas, Header, Badges | Inconsistent English terms | **Tugas** |
| `History` / `Audit Trail` / `Aktivitas` | Tab 2, Audit Log, Timeline | Mixed terms for historical logs | **Riwayat** (Task history), **Jejak Audit** (System logs) |
| `Notification` / `Notifications` | Bell icon, Tab 3, Modals | English terminology | **Notifikasi** |
| `Approve` | Modals, Buttons, Handlers | English verb | **Setujui** |
| `Reject` | Modals, Buttons, Handlers | English verb | **Tolak** |
| `Return` | Governance tasks, Workflow buttons | English verb | **Kembalikan** |
| `Review` | Headers, Drawer titles | English noun/verb | **Tinjau** (Verb) / **Tinjauan** (Noun) |
| `Verify` | Claim buttons, Handlers | English verb | **Verifikasi** |
| `Pending` | Status badges, Tables | English state | **Menunggu** |
| `Completed` | Workflow status badges | English state | **Selesai** |
| `Cancelled` / `Canceled` | Status badges | English state | **Dibatalkan** |
| `Closed` | Project closure status | English state | **Ditutup** |
| `Revision` | Rejection/Return notes | English term | **Revisi** |
| `Requested By` | To-Do cards | English label | **Diajukan oleh** |
| `Assigned To` | Workflow cards | English label | **Ditugaskan kepada** |
| `Open` | Procurement statuses | English state | **Aktif** / **Terbuka** |
| `Action Required` | Notification headers | English term | **Perlu Tindakan** |
| `Approval Required` | Notification titles | English term | **Persetujuan Diperlukan** |
| `Verified` | Progress badges | English status | **Terverifikasi** |
| `Paid` | Payment request badges | English status | **Dibayar** |
| `Submitted` | Progress & Claim badges | English status | **Diajukan** |

---

## U. BUSINESS EVENT → TASK → NOTIFICATION → HISTORY MATRIX

| Business Event | Module | Actor | Primary Recipient | Task Created? | Notification Created? | History Created? | Canonical Target Link |
|---|---|---|---|---|---|---|---|
| `tender.created` | Marketing | Marketing | Director | No | No | AuditLog | `/sales/tenders/{id}` |
| `tender.submitted_gonogo` | Marketing | Marketing | Director | Yes (DOMAIN_TENDER) | Yes (DB Alert) | AuditLog | `/sales?tab=1&tenderId={id}&action=go-nogo` |
| `tender.gonogo_approved` | Marketing | Director | Marketing | Clears Task | Yes (DB Alert) | AuditLog | `/sales/tenders/{id}` |
| `tender.won` | Marketing | Marketing | PMO, PM | No | Yes (DB Alert) | AuditLog | `/sales` |
| `spk.uploaded` | Marketing | Marketing | Legal | Yes (DOMAIN_CONTRACT) | Yes (DB Alert) | AuditLog | `/legal/review?contractId={id}` |
| `contract.legal_review_started` | Legal | Legal | None | In Progress | No | ContractHistory | `/legal/review?contractId={id}` |
| `contract.revision_requested` | Legal | Legal | Marketing | Yes (LEGAL_DOC_REV) | Yes (DB Alert) | ContractHistory | `/sales?tab=1&tenderId={id}` |
| `contract.approved` | Legal | Legal | PMO, Marketing | Clears Task | Yes (DB Alert) | ContractHistory | `/project-delivery` |
| `project.pm_assigned` | PMO | PMO | PM | Yes (PM_REVISION) | Yes (DB Alert) | AuditLog | `/project-delivery?projectId={id}` |
| `project.plan_submitted` | Project | PM | HOO, Procurement, Finance, Director | Yes (MANAGEMENT_REV) | No (Task Only) | WorkflowTransitions | `/governance/tasks?taskId={id}&projectId={id}` |
| `project.plan_approved` | Governance | Management | PM | Advances Workflow | No (Task Only) | WorkflowTransitions | `/governance/tasks?taskId={id}&projectId={id}` |
| `procurement.pr_submitted` | Procurement | PM | PMO / Manager | Yes (PR_APPROVAL) | No (Task Only) | WorkflowTransitions | `/procurement?tab=pr&prId={id}` |
| `procurement.service_claim_submitted` | Procurement | Vendor/PM | PM | No (DEFECT: MISSING) | No (DEFECT: MISSING) | AuditLog | `/procurement?tab=service-claim&claimId={id}` |
| `procurement.service_claim_verified` | Procurement | PM | Procurement | No (DEFECT: MISSING) | No (DEFECT: MISSING) | AuditLog | `/procurement?tab=service-claim&claimId={id}` |
| `finance.payment_request_submitted` | Finance | Requester | Director | Yes (PRQ_APPROVAL) | No (Task Only) | PaymentRequest | `/finance/payments?tab=approvals&requestId={id}` |
| `finance.payment_request_approved` | Finance | Director | Finance | Yes (PROCESS_PAY) | No (Task Only) | PaymentRequest | `/finance/payments?tab=ready_to_pay&requestId={id}` |
| `finance.payment_recorded` | Finance | Finance | PM, Requester | Clears Task | Yes (DB Alert) | PaymentRequest | `/procurement?tab=po&poId={id}` |
| `project.closure_submitted` | Project | PM | HOO | Yes (Generic/Unmapped) | No (DEFECT: STUCK) | WorkflowTransitions | `/project-delivery?projectId={id}&tab=closure` |
| `project.closure_hoo_approved` | Project | HOO | Director | Yes (Generic/Unmapped) | No (DEFECT: STUCK) | WorkflowTransitions | `/project-delivery?projectId={id}&tab=closure` |
| `project.closure_director_approved` | Project | Director | PM, PMO | Clears Task | No (DEFECT: STUCK) | WorkflowTransitions | `/project-delivery?projectId={id}&tab=closure` |

---

## V. FINDINGS BY SEVERITY

### P0 Findings (Critical / Blocker)

#### Finding ID: `THN-P0-001`
- **Severity:** P0
- **Title:** Missing `GET /inbox/history` Endpoint Completely Breaks Pusat Aktivitas "Riwayat" Tab with HTTP 404
- **Module:** Inbox / Pusat Aktivitas
- **Role(s):** All Roles
- **Surface:** UI Pusat Aktivitas (`/inbox` → Tab Riwayat)
- **Source File:** `frontend/src/services/inbox.service.ts` (Line 75) vs `backend/src/modules/inbox/inbox.controller.ts`
- **Source Method:** `InboxService.getHistory()` vs `InboxController`
- **Backend Endpoint:** `GET /inbox/history` (Missing)
- **Database Table:** `workflow_transitions`, `audit_logs`
- **Current Behavior:** Clicking the "Riwayat" tab triggers an HTTP 404 error, toast error *"Gagal memuat riwayat tugas"*, rendering history empty.
- **Expected Behavior:** Controller must implement `@Get('history')` aggregating completed workflow transitions and domain history for the authenticated user.
- **Evidence:** Verified by static source inspection and verified in controller route decorator list.
- **Business Impact:** Users cannot inspect historical task sign-offs, causing complete loss of operational traceability.
- **Recommended Fix Phase:** FIX-P0

#### Finding ID: `THN-P0-002`
- **Severity:** P0
- **Title:** Canonical Notification Consumer Emits Broken Dead Deep-Links (`/projects/pos/:id`, `/finance/payments/:id`)
- **Module:** Notification
- **Role(s):** `PROJECT_MANAGER`, `FINANCE`
- **Surface:** Notification Bell Drawer & Notification DB Table
- **Source File:** `backend/src/modules/notification/canonical-notification.consumer.ts` (Lines 327, 351)
- **Source Method:** `handleFinancePaymentRecorded()`
- **Backend Endpoint:** None (Event Consumer)
- **Database Table:** `notifications` (Records #49, #50, #51, #52)
- **Current Behavior:** Emits dead URLs (`/projects/pos/${poId}`, `/finance/payments/${paymentId}`) which do not exist in Next.js, causing 404 errors when clicked directly.
- **Expected Behavior:** Must emit canonical routes: `/procurement?tab=po&poId=${poId}` and `/finance/payments?tab=history&paymentId=${paymentId}`.
- **Evidence:** Verified in DB table `notifications` rows 49-52 and verified route tree in Next.js app router.
- **Business Impact:** Direct navigation from notifications fails, confusing users and interrupting business workflows.
- **Recommended Fix Phase:** FIX-P0

#### Finding ID: `THN-P0-003`
- **Severity:** P0
- **Title:** Outbox Relay Stalled on Orphan Events Due to Missing `project.closure.*` Listeners
- **Module:** Outbox / Project Closure
- **Role(s):** `HEAD_OF_OPERATIONS`, `DIRECTOR`, `PROJECT_MANAGER`
- **Surface:** Backend Outbox Relay Service
- **Source File:** `backend/src/modules/system/outbox-relay.service.ts` (Lines 100-106) & `backend/src/modules/project/project-closure.service.ts`
- **Source Method:** `processSingleEvent()`
- **Database Table:** `outbox_events` (Records #159, #162, #165)
- **Current Behavior:** Events remain in status `PENDING` indefinitely; relay retries every 5 seconds, finds zero listeners, logs debug warning, and rolls back transaction.
- **Expected Behavior:** Handlers for `project.closure.*` must be registered in notification consumers or relay must mark unhandled events as published.
- **Evidence:** Active database records 159, 162, 165 confirmed with `status = 'PENDING'` and `retry_count = 0`.
- **Business Impact:** Project closure notifications are never generated or delivered.
- **Recommended Fix Phase:** FIX-P0

#### Finding ID: `THN-P0-004`
- **Severity:** P0
- **Title:** Service Claim Workflow Completely Omitted from Task and Notification Ecosystem
- **Module:** Procurement / Service Claim
- **Role(s):** `PROJECT_MANAGER`, `PROCUREMENT`
- **Surface:** Pusat Aktivitas (`/inbox`) & Notification Bell
- **Source File:** `backend/src/modules/procurement/service-claim.service.ts` (Lines 70-78) & `backend/src/modules/inbox/inbox.service.ts`
- **Source Method:** Constructor injection vs business methods
- **Database Table:** `service_claims`
- **Current Behavior:** Service claims submitted for PM verification or Procurement commercial approval create zero To-Do items and emit zero notifications.
- **Expected Behavior:** Service claim transitions must save outbox events, notify actors, and project into `inbox.service.ts` domain queues.
- **Evidence:** Verified in `service-claim.service.ts`: `outboxRepo`, `eventEmitter`, and `notificationWriter` are injected but never called.
- **Business Impact:** Subcontractor and service claims remain unreviewed, halting vendor payments.
- **Recommended Fix Phase:** FIX-P0

#### Finding ID: `THN-P0-005`
- **Severity:** P0
- **Title:** Event Name Mismatch Between Procurement Producers and Business Sync Consumer
- **Module:** Procurement / Notification
- **Role(s):** `PROCUREMENT`, `FINANCE`
- **Surface:** Backend In-Process Event Stream
- **Source File:** `backend/src/modules/procurement/procurement.service.ts` (Lines 825, 1005) vs `backend/src/modules/notification/business-sync.consumer.ts` (Lines 102, 107)
- **Source Method:** `createPurchaseOrder()`, `createGoodsReceipt()`
- **Current Behavior:** Producer emits `po.created` and `gr.created`; consumer listens to `procurement.po.issued` and `procurement.gr.received`. Events are dropped.
- **Expected Behavior:** Producer and consumer must use standardized canonical event names.
- **Evidence:** Static grep matches in `procurement.service.ts` vs `business-sync.consumer.ts`.
- **Business Impact:** Downstream financial and procurement synchronization fails.
- **Recommended Fix Phase:** FIX-P0

---

### P1 Findings (High Priority)

#### Finding ID: `THN-P1-001`
- **Severity:** P1
- **Title:** Project Closure Tasks Render Disabled "Aksi Belum Tersedia" Due to Missing Action Target Mapping
- **Module:** Inbox / Project Closure
- **Role(s):** `HEAD_OF_OPERATIONS`, `DIRECTOR`
- **Surface:** Pusat Aktivitas To-Do Cards
- **Source File:** `backend/src/modules/inbox/inbox.service.ts` (Lines 181-184)
- **Current Behavior:** Workflow tasks for `PROJECT_CLOSURE` fall into the unmapped catch-all, setting `actionTarget = null`. The card displays a disabled button *"Aksi Belum Tersedia"*.
- **Expected Behavior:** Action target must be mapped to `/project-delivery?projectId=${projectId}&tab=closure`.
- **Recommended Fix Phase:** FIX-P1

#### Finding ID: `THN-P1-002`
- **Severity:** P1
- **Title:** Missing Notification Projections for Project Plan Management Reviews
- **Module:** Governance / Project Management
- **Role(s):** `HEAD_OF_OPERATIONS`, `PROCUREMENT`, `FINANCE`, `DIRECTOR`
- **Surface:** Notification Bell
- **Source File:** `backend/src/modules/notification/canonical-notification.consumer.ts`
- **Current Behavior:** Project plan reviews generate workflow tasks in `/governance/tasks` but emit zero database notifications to reviewers.
- **Expected Behavior:** Operational plan submission must notify each management reviewer.
- **Recommended Fix Phase:** FIX-P1

#### Finding ID: `THN-P1-003`
- **Severity:** P1
- **Title:** Segregation of Duties Leak in Admin/Super Admin Role Ingestion for Domain Queues
- **Module:** Inbox / Authorization
- **Role(s):** `SUPER_ADMIN`, `ADMIN`
- **Surface:** Pusat Aktivitas To-Do Stream
- **Source File:** `backend/src/modules/inbox/inbox.service.ts` (Lines 12, 13)
- **Current Behavior:** Admins receive legal review and tender Go/No-Go tasks.
- **Expected Behavior:** Domain queues must strictly evaluate business roles (`LEGAL`, `DIRECTOR`), excluding IT administrators.
- **Recommended Fix Phase:** FIX-P1

#### Finding ID: `THN-P1-004`
- **Severity:** P1
- **Title:** Riwayat Tab Counter Mismatch and Broken State Hydration
- **Module:** Inbox
- **Role(s):** All Roles
- **Surface:** Pusat Aktivitas Header
- **Source File:** `frontend/src/components/InboxPage.tsx` (Lines 76-87)
- **Current Behavior:** Counter shows 0 or fails to render due to missing backend history endpoint.
- **Expected Behavior:** Counter must reflect total completed tasks for the current user.
- **Recommended Fix Phase:** FIX-P1

#### Finding ID: `THN-P1-005`
- **Severity:** P1
- **Title:** Attention Bell Badge Contaminated by Historical Dead-Route Notifications
- **Module:** Notification Bell
- **Role(s):** `PROJECT_MANAGER`, `FINANCE`
- **Surface:** Main Layout Header Bell
- **Source File:** `frontend/src/lib/attentionCount.ts`
- **Current Behavior:** Dead-link notifications (IDs 49-52) remain unread, artificially inflating the attention badge count.
- **Expected Behavior:** Historical unroutable notifications should be dismissed or migrated.
- **Recommended Fix Phase:** FIX-P1

#### Finding ID: `THN-P1-006`
- **Severity:** P1
- **Title:** Lack of Automatic Read State Synchronization When Actionable To-Do Is Completed
- **Module:** Inbox / Notification Sync
- **Role(s):** All Roles
- **Surface:** Notification Drawer
- **Source File:** `frontend/src/lib/notificationSync.ts`
- **Current Behavior:** Completing a task leaves corresponding notification marked as unread.
- **Expected Behavior:** Completing a task should automatically mark associated notifications as read.
- **Recommended Fix Phase:** FIX-P1

---

### P2 Findings (Medium Priority)

#### Finding ID: `THN-P2-001`
- **Severity:** P2
- **Title:** Machine Language & English Status Enum Exposure in To-Do Cards via Default StatusBadge Fallback
- **Module:** Inbox / UI
- **Role(s):** All Roles
- **Surface:** Pusat Aktivitas To-Do Cards
- **Source File:** `frontend/src/lib/statusPresentation.ts` (Lines 278-283) & `InboxPage.tsx` (Line 484)
- **Current Behavior:** Renders title-cased English enums (`"Pending Director Approval"`, `"Needs Revision"`, `"Approved For Payment"`).
- **Expected Behavior:** Must map all domain statuses to standardized Indonesian labels.
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-002`
- **Severity:** P2
- **Title:** Mixed Indonesian/English Strings in Canonical Notification Copy
- **Module:** Notification
- **Role(s):** All Roles
- **Surface:** Notification Bell Drawer
- **Source File:** `backend/src/modules/notification/canonical-notification.consumer.ts` (Lines 507, 581, 683, 715)
- **Current Behavior:** Contains phrases like `"sedang menunggu APPROVE Director"`, `"Notes: ..."`, `"URGENT: Tender Approval Escalated"`.
- **Expected Behavior:** 100% standardized Indonesian business copy.
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-003`
- **Severity:** P2
- **Title:** Inconsistent Database Task Keys in `workflow_tasks` Table
- **Module:** Workflow Engine
- **Role(s):** All Roles
- **Surface:** Database `workflow_tasks`
- **Source File:** `backend/src/modules/workflow-engine/workflow-engine.service.ts`
- **Current Behavior:** Database mixes `DIRECTOR_APPROVAL`, `Director Approval`, `HOO_REVIEW`, `Head of Operations Review`.
- **Expected Behavior:** Consistent uppercase snake_case for internal keys, human-mapped on presentation.
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-004`
- **Severity:** P2
- **Title:** Ambiguous Notification Titles Without Business Entity Context
- **Module:** Notification
- **Role(s):** `FINANCE`
- **Surface:** Notification Bell Drawer
- **Source File:** `backend/src/modules/notification/canonical-notification.consumer.ts` (Line 345)
- **Current Behavior:** Emits generic title `"Transaksi Berhasil"`.
- **Expected Behavior:** Must include entity reference (e.g. `"Pembayaran PAY-20261016-001 Berhasil Dicatat"`).
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-005`
- **Severity:** P2
- **Title:** Missing Business Reference Formatting for Generic Workflow Tasks
- **Module:** Inbox
- **Role(s):** All Roles
- **Surface:** Pusat Aktivitas Cards
- **Source File:** `backend/src/modules/inbox/inbox.service.ts` (Line 63)
- **Current Behavior:** Card title renders `"Tugas Alur Kerja: 12"`.
- **Expected Behavior:** Card title must include business document number (e.g. `"Tinjauan Rencana Operasional: Proyek CONT-20261016-0001"`).
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-006`
- **Severity:** P2
- **Title:** Inconsistent Terminology Between Approval Center, Governance Tasks, and Pusat Aktivitas
- **Module:** All Modules
- **Role(s):** All Roles
- **Surface:** Navigation and Headers
- **Source File:** `frontend/src/constants/menuConfig.ts`
- **Current Behavior:** Mixes *To-Do*, *Tugas*, *Review*, *Persetujuan*, *Verifikasi*.
- **Expected Behavior:** Uniform vocabulary across all navigation items.
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-007`
- **Severity:** P2
- **Title:** Fallback Actor Name Leaking Technical Defaults
- **Module:** Inbox
- **Role(s):** `FINANCE`, `DIRECTOR`
- **Surface:** Pusat Aktivitas Cards
- **Source File:** `backend/src/modules/inbox/inbox.service.ts` (Line 330)
- **Current Behavior:** Submitter name falls back to `"Finance User"`.
- **Expected Behavior:** Fallback to `"Sistem EPMS"` or user's authoritative role title.
- **Recommended Fix Phase:** FIX-P2

#### Finding ID: `THN-P2-008`
- **Severity:** P2
- **Title:** Date / Timestamp Display Format Discrepancies
- **Module:** UI
- **Role(s):** All Roles
- **Surface:** Cards, Tables, Drawers
- **Source File:** `frontend/src/components/InboxPage.tsx` (Line 497)
- **Current Behavior:** Inconsistent display (some show date only, some relative time).
- **Expected Behavior:** Canonical standard: `DD MMM YYYY, HH:mm` (e.g. `16 Okt 2026, 14:32`).
- **Recommended Fix Phase:** FIX-P2

---

### P3 Findings (Low Priority / Polish)

#### Finding ID: `THN-P3-001`
- **Severity:** P3
- **Title:** Card Padding and Visual Hierarchy Inconsistencies Between To-Do and History Items
- **Module:** Inbox UI
- **Role(s):** All Roles
- **Surface:** `InboxPage.tsx`
- **Current Behavior:** Slight padding variance between task cards and history cards.
- **Expected Behavior:** Identical card elevation and token spacing.
- **Recommended Fix Phase:** FIX-P3

#### Finding ID: `THN-P3-002`
- **Severity:** P3
- **Title:** Drawer Empty State Typography and Icon Alignment
- **Module:** Notification Bell
- **Role(s):** All Roles
- **Surface:** `NotificationBell.tsx`
- **Current Behavior:** Empty state icon is slightly misaligned vertically on mobile breakpoints.
- **Expected Behavior:** Centered flex alignment across all viewports.
- **Recommended Fix Phase:** FIX-P3

#### Finding ID: `THN-P3-003`
- **Severity:** P3
- **Title:** Redundant Action Buttons in Notification Bell Drawer for Informational Alerts
- **Module:** Notification Bell
- **Role(s):** All Roles
- **Surface:** `NotificationBell.tsx`
- **Current Behavior:** Informational notifications display clickable target arrow even when no actionable context exists.
- **Expected Behavior:** Informational items should only show mark-as-read button.
- **Recommended Fix Phase:** FIX-P3

#### Finding ID: `THN-P3-004`
- **Severity:** P3
- **Title:** Filter Dropdown Label Discrepancies in Pusat Aktivitas
- **Module:** Inbox UI
- **Role(s):** All Roles
- **Surface:** `InboxPage.tsx` (Line 327)
- **Current Behavior:** Dropdown uses `"Semua To-Do"` while tab uses `"Tugas"`.
- **Expected Behavior:** Rename dropdown item to `"Semua Tugas"`.
- **Recommended Fix Phase:** FIX-P3

#### Finding ID: `THN-P3-005`
- **Severity:** P3
- **Title:** Tooltip Inconsistencies for Truncated Business References
- **Module:** UI
- **Role(s):** All Roles
- **Surface:** Table Columns
- **Current Behavior:** Some truncated references show full tooltips, others clip with ellipsis without tooltip.
- **Expected Behavior:** Standardized `<Tooltip title={fullText}>` on all truncated IDs.
- **Recommended Fix Phase:** FIX-P3

---

## W. ROOT CAUSES

1. **Architectural Asynchrony Between Inbox Service and Controller:**
   The frontend `inbox.service.ts` was designed assuming a RESTful resource `/inbox/history`, but the backend implementation in `InboxController` only exposed `/todos` and `/summary`, leaving the history feature unfinished.
2. **Hardcoded Deep-Link Path Assumptions:**
   Backend event consumers constructed URLs assuming legacy subroutes (`/projects/pos/:id`, `/finance/payments/:id`) that were never implemented in the Next.js App Router, forcing the frontend to maintain defensive regex normalization rules in `notificationSync.ts`.
3. **Outbox Relay Strictness Without Full Domain Consumer Coverage:**
   The outbox relay enforces a strict delivery guarantee (rolling back if 0 in-process listeners accept the event). Because `project.closure.*` events were implemented in the domain service without registering corresponding listeners in `canonical-notification.consumer.ts`, events remain stuck in `PENDING` forever.
4. **Domain Queue Omission in Inbox Aggregator:**
   `inbox.service.ts` hardcoded queries for Contracts, Tenders, Payment Requests, and Progress Claims, but omitted Service Claims and Project Closures entirely.
5. **Fallback Title-Casing in Status Presentation:**
   The status presentation helper titles-cases any unmapped status string into English as a default fallback instead of routing unmapped domain statuses to a centralized dictionary.

---

## X. RECOMMENDED FIX PHASES

### FIX-P0: Functional Integrity, Authorization & Deep-Link Blockers
- **Scope:**
  - Implement `@Get('history')` in `backend/src/modules/inbox/inbox.controller.ts` and `inbox.service.ts`.
  - Fix dead deep-link generation in `canonical-notification.consumer.ts` for PO and Payment events.
  - Register listeners for `project.closure.*` in notification consumers to unlock stuck outbox events.
  - Implement outbox event emission and domain queue ingestion for Service Claims.
  - Standardize PO/GR event names between `procurement.service.ts` and `business-sync.consumer.ts`.
- **Finding IDs:** `THN-P0-001`, `THN-P0-002`, `THN-P0-003`, `THN-P0-004`, `THN-P0-005`
- **Affected Files:**
  - `backend/src/modules/inbox/inbox.controller.ts`
  - `backend/src/modules/inbox/inbox.service.ts`
  - `backend/src/modules/notification/canonical-notification.consumer.ts`
  - `backend/src/modules/procurement/service-claim.service.ts`
  - `backend/src/modules/procurement/procurement.service.ts`
- **Regression Suites Required:** `inbox.spec.ts`, `outbox-relay.spec.ts`, `service-claim.spec.ts`.
- **Risk:** High (Core event delivery and routing).

### FIX-P1: Task Projections, Counters & Segregation of Duties
- **Scope:**
  - Map Project Closure action targets in `inbox.service.ts`.
  - Strip `ADMIN` and `SUPER_ADMIN` from `LEGAL_REVIEW_ROLES` and `TENDER_GO_NOGO_ROLES`.
  - Implement automatic read-state synchronization when actionable tasks are completed.
  - Clean up historical dead-route notifications in the database.
- **Finding IDs:** `THN-P1-001`, `THN-P1-002`, `THN-P1-003`, `THN-P1-004`, `THN-P1-005`, `THN-P1-006`
- **Affected Files:**
  - `backend/src/modules/inbox/inbox.service.ts`
  - `frontend/src/lib/attentionCount.ts`
  - `frontend/src/lib/notificationSync.ts`
- **Risk:** Medium.

### FIX-P2: Language, Copy & Machine Language Normalization
- **Scope:**
  - Extend `DOMAIN_STATUS_MAP` in `frontend/src/lib/statusPresentation.ts` with all domain statuses mapped to Indonesian.
  - Normalize mixed Indonesian/English copy in notification templates.
  - Enforce business reference formatting on generic workflow cards.
- **Finding IDs:** `THN-P2-001` through `THN-P2-008`
- **Affected Files:**
  - `frontend/src/lib/statusPresentation.ts`
  - `backend/src/modules/notification/canonical-notification.consumer.ts`
  - `frontend/src/components/InboxPage.tsx`
- **Risk:** Low (UI / Copy polish).

### FIX-P3: Visual Consistency & UX Polish
- **Scope:**
  - Card padding, icon alignments, empty state styling, and tooltip consistency.
- **Finding IDs:** `THN-P3-001` through `THN-P3-005`
- **Affected Files:**
  - `frontend/src/components/InboxPage.tsx`
  - `frontend/src/components/NotificationBell.tsx`
- **Risk:** Negligible.

---

## Y. MANDATORY FINAL COUNTS

```text
TOTAL TASK TYPES: 18
TOTAL NOTIFICATION TYPES: 20
TOTAL HISTORY SOURCES: 7
TOTAL DEEP LINKS: 26
BROKEN DEEP LINKS: 4
MISSING TASK PROJECTIONS: 4
GHOST TASKS: 0
DUPLICATE TASKS: 0
STALE TASKS: 0
DUPLICATE NOTIFICATIONS: 0
WRONG RECIPIENTS: 2
MISSING NOTIFICATIONS: 5
COUNTER MISMATCHES: 2
MACHINE LANGUAGE LEAKS: 12
MIXED LANGUAGE STRINGS: 8
INCONSISTENT LABELS: 6
AMBIGUOUS CAPTIONS: 4
AUTHORIZATION ISSUES: 3
DATA SCOPE LEAKS: 1
ACTION SCOPE LEAKS: 1
DEAD DEEP LINKS: 4
STALE NOTIFICATIONS: 4
ORPHAN OUTBOX EVENTS: 3
P0 FINDINGS: 5
P1 FINDINGS: 6
P2 FINDINGS: 8
P3 FINDINGS: 5
```

---

## Z. FINAL VERDICT

```text
TASK ECOSYSTEM: PARTIAL
HISTORY ECOSYSTEM: FAIL
NOTIFICATION ECOSYSTEM: PARTIAL
APPROVAL CENTER INTEGRITY: PARTIAL
DEEP LINK INTEGRITY: FAIL
ROLE / RECIPIENT INTEGRITY: PARTIAL
COUNTER PARITY: PARTIAL
READ / UNREAD LIFECYCLE: PARTIAL
EVENT DELIVERY / OUTBOX: FAIL
LANGUAGE STANDARDIZATION: PARTIAL
CAPTION STANDARDIZATION: PARTIAL
MACHINE LANGUAGE EXPOSURE: FOUND
AUTHORIZATION INTEGRITY: PARTIAL
READY FOR FIX PHASE: YES
BUSINESS DATA MUTATED: NO
APPLICATION SOURCE CODE MODIFIED: NO
AUDIT ARTIFACT CREATED: YES
```

---
*End of Audit Artifact.*
