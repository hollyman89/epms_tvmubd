# EPMS PUSAT AKTIVITAS — TUGAS, RIWAYAT, NOTIFIKASI
**Forensic Reconciliation, Projection Architecture, and Final Live Verification Report**
*Date: 2026-10-17*

---

## 1. Executive Summary

This report establishes the final, authoritative status of **Pusat Aktivitas** within the Enterprise Project Management System (EPMS). Pusat Aktivitas operates strictly as a read-only, unified operational projection of the canonical business lifecycle across its three primary tabs: **Tugas**, **Riwayat**, and **Notifikasi**.

All architectural defects, routing omissions (notably the missing `GET /inbox/history` route resulting in historical 404s), notification event listener mismatches, dead-end deep links, and machine-status leakage have been reconciled without altering any underlying business workflows or database state machines.

### Final Verification Status:
- **Tugas:** PASS (Authoritative To-Do projection with strict role/actor isolation and deduplication)
- **Riwayat:** PASS (`GET /inbox/history` 200 OK, newest-first, completed/decided history only)
- **Notifikasi:** PASS (Exact event listener matching, recipient isolation, read sync, valid canonical deep links)
- **Counters & Reconciliation:** PASS (Actionable unique items match badge invariant)
- **Regression Suites:** PASS (50/50 Backend, 94/94 Frontend, 0 TypeScript errors)
- **Live Browser Validation (Edge CDP):** PASS (Zero console errors, zero network errors, verified in visible browser)

---

## 2. Architecture & Data Flow

Pusat Aktivitas does NOT serve as an independent workflow engine or persist its own task state. Instead, it aggregates canonical state across four domain sources and projects actionable work, completed decision logs, and system notifications into unified presentation models.

```
                              ┌─────────────────────────────────────────┐
                              │       CANONICAL EPMS DOMAINS            │
                              │  - Workflow Engine (WorkflowTask)       │
                              │  - Service Claims (ServiceClaim)        │
                              │  - Payment Requests (PaymentRequest)    │
                              │  - Project Closure (ProjectClosure)     │
                              └────────────────────┬────────────────────┘
                                                   │
                   ┌───────────────────────────────┼───────────────────────────────┐
                   ▼                               ▼                               ▼
       ┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
       │   PENDING WORKFLOW    │       │  HISTORICAL DECISIONS │       │    DOMAIN EVENTS &    │
       │   & DOMAIN CHECKS     │       │  COMPLETED WORKFLOWS  │       │  NOTIFICATION OUTBOX  │
       └───────────┬───────────┘       └───────────┬───────────┘       └───────────┬───────────┘
                   │                               │                               │
                   ▼                               ▼                               ▼
       GET /api/v1/inbox/todos         GET /api/v1/inbox/history       GET /api/v1/notifications
       (InboxService.getTodos)         (InboxService.getHistory)       (NotificationService.find)
                   │                               │                               │
                   └───────────────────────────────┼───────────────────────────────┘
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │    PUSAT AKTIVITAS (UI)     │
                                    │      /inbox (InboxPage)     │
                                    │                             │
                                    │  [ Tugas ]  [ Riwayat ]     │
                                    │       [ Notifikasi ]        │
                                    └─────────────────────────────┘
```

1. **Tugas Projection (`GET /api/v1/inbox/todos`):**
   - Queries actionable `WorkflowTask` rows where `status = 'PENDING'` matching user ID or user roles.
   - Enriches and projects pending domain entities (`ServiceClaim`, `ProjectClosure`, `PaymentRequest`) only when actionable by the exact canonical actor.
   - Applies deterministic composite deduplication to prevent double-counting between workflow tasks and domain records.
2. **Riwayat Projection (`GET /api/v1/inbox/history`):**
   - Queries terminal decisions and completed tasks (`COMPLETED`, `RETURNED`, `REJECTED`, `APPROVED`).
   - Scopes queries strictly to actions decided by the user or visible within the user's role authority.
   - Orders all records in descending order (`decidedAt DESC` / `completedAt DESC`).
3. **Notifikasi Projection (`GET /api/v1/notifications`):**
   - Driven by the asynchronous transactional outbox relay consuming domain event channels.
   - Isolated by recipient `userId`.
   - Generates verified, valid deep-link targets into canonical business views.

---

## 3. Tugas Final State

### Canonical Actor & Lifecycle Rules
To prevent unauthorized task leakage or improper projection, each entity status enforces exact actor verification:

| Domain | Raw Status | Canonical Actionable Actor | Authorization / Scope Rule |
| :--- | :--- | :--- | :--- |
| **Service Claim** | `SUBMITTED` | Assigned Project Manager | `project.managerId === userId`. Claim submitter is SoD-blocked from verifying own claim. |
| **Service Claim** | `PM_VERIFIED` | Procurement Team | User holds role `PROCUREMENT` or `PURCHASING`. |
| **Service Claim** | `NEEDS_REVISION` | Claim Submitter / Creator | `submittedBy === userId` or `createdBy === userId`. PM/Procurement blocked. |
| **Project Closure** | `PENDING_HOO_REVIEW` | Head of Operations | User holds role `HEAD_OF_OPERATIONS` or `SUPER_ADMIN`. |
| **Project Closure** | `PENDING_DIRECTOR_APPROVAL` | Director | User holds role `DIRECTOR` or `SUPER_ADMIN`. |
| **Project Closure** | `RETURNED` | Project Manager (Submitter) | `project.managerId === userId` or `submittedById === userId`. |
| **Payment Request** | `PENDING_DIRECTOR_APPROVAL` | Director | User holds role `DIRECTOR` or `SUPER_ADMIN`. |
| **Payment Request** | `NEEDS_REVISION` | Finance (Requester) | User holds role `FINANCE` and revises/resubmits the returned request. |
| **Payment Request** | `APPROVED_FOR_PAYMENT` | Finance (Disbursement) | User holds role `FINANCE` and executes payment disbursement. |

> [!NOTE]
> **Payment Request Terminal States:**
> - `REJECTED` — Terminal Director rejection; appears in Riwayat and creates no actionable To-Do.
> - `PAID` — Completed payment execution; appears in Riwayat and creates no actionable To-Do.
>
> Revision is exclusively:
> `NEEDS_REVISION` $\rightarrow$ Finance correction $\rightarrow$ resubmit $\rightarrow$ `PENDING_DIRECTOR_APPROVAL`.

### Deduplication
When a business stage is represented by both an active `WorkflowTask` and a domain table record (e.g., Management Review or Project Closure), the backend applies deduplication:
- Canonical key: `${entityType}:${entityId}:${taskKey}`
- If a domain entity matches an existing `WorkflowTask` projection for the user, only the primary canonical entry is returned.
- Deduplication verified: ZERO duplicates rendered.

### Action Targets & Stale-Item Handling
- Every actionable item in Tugas includes a verified `actionTarget` URL (e.g., `/project-delivery?view=workspace&projectId=369&section=closure`).
- Once a business record advances (approved, returned, or completed), the pending task is immediately excluded from `GET /inbox/todos` on subsequent queries.

---

## 4. Riwayat Final State

### Resolution of Historical 404 Defect
- Implemented `@Get('history')` in `InboxController` and `getHistory(userId, roles)` in `InboxService`.
- Fully documented in OpenAPI/Swagger and guarded by `JwtAuthGuard` and `RolesGuard`.
- Unauthenticated requests are strictly rejected with `HTTP 401 Unauthorized`.
- Non-existent route defect eliminated: `GET /api/v1/inbox/history` returns `HTTP 200 OK`.

### Scoping and Integrity Rules
- Queries terminal states across `WorkflowTask`, `PaymentRequest`, and `ProjectClosure`.
- Segregation: Pending tasks are strictly filtered out; only finalized or returned decisions appear.
- Sorting: Strictly newest-first using `decidedAt` / `completedAt` timestamp.
- User Isolation: Regular users view only items they decided or tasks assigned to their role. Administrative roles (`SUPER_ADMIN`, `DIRECTOR`) observe organization-level audit trails.

---

## 5. Notifikasi Final State

### Event Listener Alignment
Project Closure domain services emit explicit, granular event names (`project.closure.submitted`, `project.closure.hoo.approved`, `project.closure.director.approved`, `project.closure.hoo.returned`, `project.closure.director.returned`).
- Fixed `@OnEvent` bindings in `CanonicalNotificationConsumer` from wildcard to explicit event registrations.
- Outbox relay no longer experiences zero-listener rollbacks.
- Existing historical outbox records remain intact; zero artificial database tampering.

### Notification Read Synchronization
- `markRelatedNotificationsRead(userId, referenceType, referenceId)` is wired into milestone transition handlers.
- When an actionable task is completed or approved in the UI, related unread notification records are marked `isRead = true`.

### Deep-Link Precision Matrix

| Domain / Purpose | Canonical Deep-Link Format | Frontend Support Verification |
| :--- | :--- | :--- |
| **Purchase Order** | `/procurement?tab=po&poId=${poId}` | `ProcurementPage.tsx` lines 268–278 and 522–535 parse `tab=po` and `poId` to auto-open PO details. |
| **Finance Payment** | `/finance/payments?tab=approvals&requestId=${id}` | `finance/payments/page.tsx` lines 64–74 and 130–157 parse `tab` and `requestId` parameters. |
| **Payment History** | `/finance/payments?tab=history` | Canonical tab navigation supported. |
| **Project Closure** | `/governance/tasks?projectId=${projectId}` | `ProjectGovernanceTaskCenter.tsx` opens governance review drawer for specified project. |
| **Closure Workspace** | `/project-delivery?view=workspace&projectId=${id}&section=closure` | `ProjectWorkspace.tsx` opens project delivery closure section directly. |
| **Legal Review** | `/legal/review?tab=WAITING` | Tab query parameter supported in legal review suite. |

---

## 6. Status Presentation

To guarantee a clean executive user experience, all raw database enum strings are mapped through `frontend/src/lib/statusPresentation.ts` and `frontend/src/lib/inboxPresentation.ts`.

### Presentation Mapping Table

| Domain | Canonical Raw Status | Indonesian Business Label | Color Class |
| :--- | :--- | :--- | :--- |
| **Workflow** | `COMPLETED` | Selesai | `success` (green) |
| **Workflow** | `APPROVED` | DISETUJUI | `success` (green) |
| **Workflow** | `REJECTED` | Ditolak | `error` (red) |
| **Workflow** | `RETURNED` | Dikembalikan | `warning` (orange) |
| **Workflow** | `PENDING` | Menunggu Persetujuan | `warning` (amber) |
| **Service Claim** | `SUBMITTED` | Menunggu Verifikasi PM | `blue` |
| **Service Claim** | `PM_VERIFIED` | Menunggu Approval Purchasing | `purple` |
| **Service Claim** | `NEEDS_REVISION` | Perlu Revisi Vendor | `orange` |
| **Service Claim** | `APPROVED` | Disetujui | `green` |
| **Project Closure** | `PENDING_HOO_REVIEW` | Menunggu Review HOO | `orange` |
| **Project Closure** | `PENDING_DIRECTOR_APPROVAL` | Menunggu Approval Direktur | `purple` |
| **Project Closure** | `APPROVED` | Proyek Ditutup / Disetujui | `green` |
| **Project Closure** | `RETURNED` | Dikembalikan untuk Revisi | `red` |
| **Payment Request** | `PENDING_DIRECTOR_APPROVAL` | Menunggu Persetujuan Direktur | `warning` (orange) |
| **Payment Request** | `NEEDS_REVISION` | Perlu Revisi | `error` (red) |
| **Payment Request** | `APPROVED_FOR_PAYMENT` | Siap Bayar | `cyan` |
| **Payment Request** | `REJECTED` | Ditolak | `error` (red) |
| **Payment Request** | `PAID` | Sudah Dibayar | `green` |

- **No Stored Status Mutation:** The database retains strict enum keys (`PENDING_DIRECTOR_APPROVAL`, etc.).
- **Zero Enum Leakage:** End-users are never exposed to uppercase underscore enums in badges or headers.

---

## 7. Counter Reconciliation

Counter reconciliation is governed by `frontend/src/lib/attentionCount.ts` and enforced in `InboxPage.tsx`:

$$\text{Unique Actionable Items in Tugas} = \text{Tugas Tab Badge} = \text{Sidebar Pusat Aktivitas Attention Count}$$

- Deduplication rules in `attentionCount.ts` match `SERVICE_CLAIM` and `PROJECT_CLOSURE` against existing workflow tasks to prevent double counting.
- Unread notification count is independent of Tugas tasks:
  $$\text{Unread Notifications} = \text{Notifikasi Tab Badge} = \text{Header Bell Unread Badge}$$
- Live Verification:
  - Actionable items in Tugas: **0** $\rightarrow$ Tugas tab badge: **None** (Clean), Sidebar badge: **None**.
  - Unread notifications: **8** $\rightarrow$ Notifikasi tab badge: **8**, Header Bell badge: **8**.
  - Riwayat items: **54** $\rightarrow$ Riwayat tab badge: **54**.

---

## 8. Regression Tests

All automated suites pass with 100% compliance.

### Backend Test Results:
```text
Test Suites: 3 passed, 3 total
Tests:       50 passed, 50 total
Snapshots:   0 total
Time:        14.28 s
Ran all test suites matching:
  - backend/src/modules/inbox/inbox.service.spec.ts (37 passed)
  - backend/src/modules/inbox/inbox.controller.spec.ts (3 passed)
  - backend/src/modules/notification/canonical-notification-finance.spec.ts (10 passed)
```

### Frontend Test Results:
```text
Test Suites: 4 passed, 4 total
Tests:       94 passed, 94 total
Snapshots:   0 total
Time:        4.82 s
Ran all test suites matching:
  - frontend/src/services/__tests__/inbox.service.test.ts (28 passed)
  - frontend/src/lib/__tests__/inboxPresentation.test.ts (28 passed)
  - frontend/src/lib/__tests__/statusPresentation.test.ts (24 passed)
  - frontend/src/lib/__tests__/notificationBellBehavior.test.ts (14 passed)
```

### TypeScript Static Typecheck:
- Backend (`npx tsc --noEmit`): **PASS** (0 errors)
- Frontend (`npx tsc --noEmit`): **PASS** (0 errors)

---

## 9. Live Validation

Live browser validation was performed via Microsoft Edge CDP connection (`http://127.0.0.1:9222`) against active services without restarting, modifying source code, or mutating database state.

### Dependency Status:
- **3306 MySQL:** UP
- **4000 Backend:** UP
- **3000 Frontend:** UP
- **9222 Edge CDP:** UP

### Live Verification Findings:
1. **Tugas Tab (`live_tugas_tab.png`):**
   - Page loaded successfully at `http://localhost:3000/inbox`.
   - `GET /api/v1/inbox/todos` returned `HTTP 200 OK` (`data: []`).
   - Truthful empty state rendered: *"Tidak ada tugas yang perlu ditindaklanjuti."*
   - Zero duplicate cards, zero machine enums.
2. **Riwayat Tab (`live_riwayat_tab.png`):**
   - `GET /api/v1/inbox/history` returned `HTTP 200 OK`.
   - 54 historical records loaded and rendered in newest-first chronological order.
   - Zero error alerts (historical *"Gagal memuat riwayat tugas"* completely resolved).
   - Clean badges rendered: "Selesai", "DISETUJUI", "Proyek Ditutup".
3. **Notifikasi Tab (`live_notifikasi_tab.png`):**
   - `GET /api/v1/notifications` returned `HTTP 200 OK`.
   - Unread items displayed blue accent indicators and active dots.
   - Valid deep-links verified for Project Closure (`/governance/tasks?projectId=369`), Legal Review (`/legal/review?tab=WAITING`), and Project Delivery (`/project-delivery`).
4. **Counters & Layout (`live_pusat_aktivitas_counters.png`):**
   - Header Bell badge: **8**
   - Notifikasi tab badge: **8**
   - Riwayat tab badge: **54**
   - Tugas tab: **0** (No badge displayed, perfectly aligned with empty actionable set)
5. **Console & Network Errors:**
   - Console Errors: **NONE** (Zero runtime exceptions)
   - Network Errors: **NONE** (Zero failed requests, zero 404s, zero 500s)

---

## 10. Files Modified

The following 14 files were modified as part of this reconciliation task:

### Backend (9 files):
1. `backend/src/modules/inbox/inbox.dto.ts` (Added history query DTOs and response models)
2. `backend/src/modules/inbox/inbox.module.ts` (Registered TypeORM repositories and providers)
3. `backend/src/modules/inbox/inbox.controller.ts` (Implemented `GET /inbox/history` route)
4. `backend/src/modules/inbox/inbox.service.ts` (Implemented `getHistory()` with role/user isolation)
5. `backend/src/modules/inbox/inbox.controller.spec.ts` (Route and authorization unit tests)
6. `backend/src/modules/inbox/inbox.service.spec.ts` (Comprehensive 37-test suite for Todos and History)
7. `backend/src/modules/notification/notification.service.ts` (Added notification mark-related-read helper)
8. `backend/src/modules/notification/canonical-notification.consumer.ts` (Explicit event bindings and canonical targets)
9. `backend/src/modules/notification/canonical-notification-finance.spec.ts` (Consumer regression suite)

### Frontend (5 files):
10. `frontend/src/services/inbox.service.ts` (Added `getHistory()` frontend API client)
11. `frontend/src/lib/statusPresentation.ts` (Domain presentation dictionaries for service claim and closure)
12. `frontend/src/lib/inboxPresentation.ts` (Added `resolveItemStatusDomain` helper)
13. `frontend/src/lib/attentionCount.ts` (Reconciled counter matching for claims and closures)
14. `frontend/src/components/InboxPage.tsx` (Wired history tab, presentation helpers, and counter reconciliation)

---

## 11. Remaining Gaps

Within the defined scope of **Pusat Aktivitas (Tugas, Riwayat, Notifikasi)**:
- **NONE**

All checkpoints (CP1 through CP13) have met their formal invariants, verified by both automated suites and live Edge CDP inspection.

---

## 12. Final Verdict

# PUSAT_AKTIVITAS_CLOSED
