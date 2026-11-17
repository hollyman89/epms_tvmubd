# EPMS UBD & TVM — DAILY OPERATIONS REPORT
## PHASE 1: READ-ONLY TECHNICAL AUDIT & FEASIBILITY ASSESSMENT

- **Repository:** `C:/Users/UBDOPS3/Herd/epms_tvmubd`
- **Branch:** `feature/kpi-reports-implementation`
- **HEAD Commit:** `93f029579dea3b0905f3aca32a484d0cb7bcc2e7`
- **Execution Mode:** Strict Read-Only Static Code & Database Inspection (Zero source/schema/data mutations)
- **Audit Target:** Daily Operations Report (Direct Employee-to-Director Reporting across PT UBD & PT TVM)
- **Target Timeline Evaluated:** 3-Hour Implementation Target (11 Deliverables)
- **Audit Date:** 2026-11-17

> [!IMPORTANT]
> **EXECUTION GOVERNANCE NOTICE:** Consistent with Phase 1 strict read-only safety rules, no application source files, database schemas, database records, migrations, RBAC configurations, Git state, or running processes were altered during this audit. All claims below distinguish between **VERIFIED** repository/database observations, explicit **ASSUMPTIONS**, and **RECOMMENDATIONS**.

---

## Table of Contents

1. [Repository Baseline](#1-repository-baseline)
2. [Relevant Files and Exact Source Locations](#2-relevant-files-and-exact-source-locations)
3. [Current Architecture Findings](#3-current-architecture-findings)
4. [User Identity and Organization Mapping](#4-user-identity-and-organization-mapping)
5. [Director RBAC and Recipient Resolution](#5-director-rbac-and-recipient-resolution)
6. [Notification Architecture Findings](#6-notification-architecture-findings)
7. [Audit Trail Findings](#7-audit-trail-findings)
8. [Proposed Daily Report Data Model](#8-proposed-daily-report-data-model)
9. [Frontend and Navigation Integration Plan](#9-frontend-and-navigation-integration-plan)
10. [Security and Data Integrity Risks](#10-security-and-data-integrity-risks)
11. [Three-Hour Implementation Feasibility](#11-three-hour-implementation-feasibility)
12. [Recommended Implementation Sequence](#12-recommended-implementation-sequence)
13. [Explicit Blockers and Unresolved Decisions](#13-explicit-blockers-and-unresolved-decisions)
14. [Final Recommendation: GO / CONDITIONAL GO / NO-GO](#14-final-recommendation-go--conditional-go--no-go)

---

## 1. Repository Baseline

### 1.1 Git & Working Tree State (**VERIFIED**)
- **Active Branch:** `feature/kpi-reports-implementation`
- **HEAD Commit:** `93f029579dea3b0905f3aca32a484d0cb7bcc2e7`
- **Working Tree (`git status --short`) Preserved Untouched:**
  - `M backend/src/modules/analytics/analytics.service.ts`
  - `M backend/src/modules/dashboard/dashboard.service.ts`
  - `M frontend/src/app/login/page.tsx`
  - `?? backend/src/modules/dashboard/__tests__/dashboard-sandbox-kpi-isolation.spec.ts`
  - `?? backend/src/shared/helpers/sandbox-kpi-filter.helper.ts`
  - `?? backend/test-results.json`

### 1.2 Stack & Runtime Architecture (**VERIFIED**)
| Layer | Technology & Configuration | Source Reference |
|---|---|---|
| **Backend Framework** | NestJS 10 (`@nestjs/common`, `@nestjs/typeorm`, `@nestjs/schedule`, `@nestjs/event-emitter`, `@nestjs/platform-socket.io`, `@nestjs/bullmq`, `class-validator`, `@nestjs/swagger`) | `backend/package.json`, `backend/src/app.module.ts` |
| **HTTP API Pipeline** | Global prefix `/api/v1`; `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`; `TransformInterceptor`; CORS & Swagger enabled | `backend/src/main.ts` |
| **ORM & Database** | TypeORM `0.3.17` (`synchronize: false`) connecting to MySQL 8 `epms_tvmubd_db` (`127.0.0.1:3306`) | `backend/src/data-source.ts`, `backend/src/app.module.ts` |
| **Migrations** | Raw SQL migrations via `QueryRunner` under `backend/src/migrations/` (`npm run migration:run`). Latest: `1794000000000-CreateTaxManagementTables.ts`, `1795000000000-CreateCompanyBankAccountsAndEnhancePayments.ts` | `backend/package.json`, `backend/src/migrations/` |
| **Frontend Stack** | Next.js `14.2.15` App Router, React `18.2.0`, Ant Design `5.10.0`, `@ant-design/charts` `2.6.7`, `@tanstack/react-query` `5.101.4`, `dayjs` `1.11.21`, `socket.io-client` `4.8.3` | `frontend/package.json`, `frontend/src/app/layout.tsx` |
| **Reporting Modules** | Backend: `AnalyticsModule`, `DashboardModule`, `ExecutiveAnalyticsModule`; Frontend: `frontend/src/app/(dashboard)/reports/page.tsx`, `ExecutiveDashboard.tsx`, `DashboardPage.tsx` | `backend/src/modules/`, `frontend/src/components/` |
| **Test Tooling** | Backend: Jest (`npm test`), **136** `*.spec.ts` files in `backend/src/`. Frontend: Jest (`frontend/jest.config.js`, `**/__tests__/**/*.test.ts`) & Playwright (`frontend/playwright.config.ts`, `testDir: './tests'`, modes `chromium`, `chromium-live`, `chrome`) | `backend/package.json`, `frontend/jest.config.js`, `frontend/playwright.config.ts` |
| **Live Process Topology** | Port `3000` (Next.js dev PID `19560`), Port `4000` (NestJS backend PID `11936`), Port `3306` (MySQL PID `6936`) active | Live host check |

### 1.3 Live MySQL Baseline (**VERIFIED — Read-Only SELECT/SHOW**)
- **Timezone Configuration:** `global.time_zone = 'SYSTEM'`, `session.time_zone = 'SYSTEM'`, `system_time_zone = 'SE Asia Standard Time'`; `NOW()` = `2026-11-17 22:01:06`, `UTC_TIMESTAMP()` = `2026-11-17 15:01:06` (+07:00 / `Asia/Jakarta`).
- **Missing Organizational Entities:** Zero tables named `employees`, `divisions`, `departments`, or `companies` exist in `epms_tvmubd_db` or `backend/src/entities/`. No `daily_report*` entities exist.
- **Legal Entity Tables Observed:** `legal_entity_tax_profiles` enforces `CHECK (company_code IN ('UBD', 'TVM'))` and currently contains **0 rows**; `company_bank_accounts` contains **1 row** (`company_code = 'UBD'`).
- **RBAC Tables Observed:** `roles` contains **13 roles** (`SUPER_ADMIN`, `PROJECT_MANAGER`, `FINANCE`, `DIRECTOR`, `MANAGER`, `GENERAL_MANAGER`, `MARKETING`, `LEGAL`, `PURCHASING`, `HEAD_OF_OPERATIONS`, `PROCUREMENT`, `ADMIN`, `PMO`); `permissions` table contains **0 rows**.

---

## 2. Relevant Files and Exact Source Locations

| Domain | File Path | Verified Symbols / Line References | Role in Daily Operations Report |
|---|---|---|---|
| **App Bootstrap** | `backend/src/app.module.ts` | Module imports, `ScheduleModule.forRoot()`, `EventEmitterModule.forRoot()`, `synchronize: false` | Registers new `DailyReportModule` |
| **HTTP Validation** | `backend/src/main.ts` | `api/v1` prefix, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` | Strict DTO contract enforcement |
| **DB Config & Migrations** | `backend/src/data-source.ts`, `backend/src/migrations/1794000000000-CreateTaxManagementTables.ts` | L1–20 (`data-source.ts`); L7–60 (`company_code` added to 6 transactional tables, **not** `users`) | Migration pattern & legal-entity convention (`UBD`/`TVM`) |
| **User & Role Entities** | `backend/src/entities/user.entity.ts`, `backend/src/entities/role.entity.ts` | `User` (`user.entity.ts` L4–40); `Role` (`role.entity.ts` L1–22) | Lacks division and `company_code` fields |
| **Auth & JWT** | `backend/src/modules/auth/auth.service.ts`, `jwt.strategy.ts`, `guards/roles.guard.ts`, `dto/update-profile.dto.ts` | `login()` L106–115, L196–201; `refreshToken()` L217–222; `RolesGuard` `@Roles` / `@DenyRoles` | JWT `companyId` hardcoded `\|\| 1`; `refreshToken()` drops `permissions` & `companyId` |
| **User Management** | `backend/src/modules/admin-user/admin-user.controller.ts`, `admin-user.service.ts`, `dto/create-user.dto.ts` | `SUPER_ADMIN`-only user CRUD; no division/entity inputs | Requires update once organizational attributes are ratified |
| **Division/Entity Precedent** | `backend/src/modules/dashboard/dashboard.service.ts`, `analytics.controller.ts`, `executive.controller.ts` | `dashboard.service.ts` (`scope: 'INSTALLATION'`, `subDivisionEnabled: false`); `analytics.controller.ts` L16–36; `executive.controller.ts` L14–23 | Confirms division allocation unverified; Director analytics lack entity partitioning |
| **Log & Evidence Precedent** | `backend/src/entities/project-progress-log.entity.ts`, `project-progress-evidence.entity.ts`, `backend/src/modules/project/project.service.ts` | `project-progress-evidence.entity.ts` L14–48; `project.service.ts` L5050–5128 | Precedent for atomic log + evidence + `OutboxEvent` persistence (and UTC `effective_date` bug at L5062 to avoid) |
| **Document Uploads** | `backend/src/modules/document/document.service.ts` | `validateDocumentEntityAccess()` L337–484 | Whitelists only `'PROJECT'`, `'CONTRACT'`, `'TENDER'`, `'INVOICE'` |
| **Outbox & Relay** | `backend/src/entities/outbox-event.entity.ts`, `backend/src/modules/system/outbox-relay.service.ts` | `pollAndRelay()` (`outbox-relay.service.ts` L46), `AuditLog` requeue L499–516 | Quarantines events as `[NO_SUBSCRIBER]` if consumers omit event name |
| **Notification Pipeline** | `backend/src/modules/notification/business-sync.consumer.ts`, `canonical-notification.consumer.ts`, `canonical-notification.writer.ts`, `notification.gateway.ts` | `APPROVED_ROLE_SYNC_POLICIES` L42–116; Director SQL lookup L709; `persistCanonicalNotification()` L70–176, L253–258 (`TASK` rejected) | Mandatory integration path for In-App + Socket + Web Push |
| **Web Push Dispatcher** | `backend/src/modules/notification/push-outbox.worker.ts`, `web-push.dispatcher.ts`, `backend/.env` | `push-outbox.worker.ts` L61–72 (`PUSH_WORKER_ENABLED=true`, `PUSH_POLL_INTERVAL_MS=3000`, `FOR UPDATE SKIP LOCKED`, backoff 30s/60s/120s) | Production-ready background Web Push pipeline |
| **Scheduler & Timezone** | `backend/src/modules/marketing/tender.scheduler.ts`, `tender-followup.helper.ts` | `tender.scheduler.ts` L124 (`@Cron('0 9 * * *', { timeZone: 'Asia/Jakarta' })`, `GET_LOCK`); `tender-followup.helper.ts` L6–14 (`toJakartaDateString`) | Reference pattern for cron reminder + safe Jakarta calendar dates |
| **Audit Trail** | `backend/src/entities/audit-log.entity.ts`, `backend/src/modules/audit/audit-log.listener.ts`, `audit.controller.ts` | `audit-log.listener.ts` L16–53 (`@OnEvent('audit.log')`); `audit.controller.ts` L17 (`SUPER_ADMIN` only) | `audit.log` event is async/best-effort; transactional writes use `manager.save(AuditLog, ...)` |
| **Frontend Navigation SSOT** | `frontend/src/constants/menuConfig.ts`, `components/MainLayout.tsx`, `components/ProtectedRoute.tsx` | `MENU_GROUPS` (`MAIN MENU`, `MODULES`, `DATA MASTER`, `PROJECT GOVERNANCE`, `SYSTEM`) | Single source of truth for sidebar rendering and route auth |
| **Frontend Common UI** | `frontend/src/components/common/PageHeader.tsx`, `KpiStatCard.tsx`, `UserIdentityDisplay.tsx`, `StatusBadge.tsx`, `ResponsiveModal.tsx`, `InboxPage.tsx` | `PageHeader.tsx` L1–60; `KpiStatCard.tsx` L1–60; `UserIdentityDisplay.tsx` L1–60; `InboxPage.tsx` L1–90 | Reusable Ant Design layout, KPI strip, user identity, modal, and status components |
| **Frontend Push & Bell** | `frontend/src/components/NotificationBell.tsx`, `lib/notificationSync.ts`, `components/PushNotificationToggle.tsx`, `public/sw.js`, `public/manifest.json` | `NotificationBell.tsx` L560–578; `notificationSync.ts` L188–190; `sw.js` L6–10, L68–105 | Supports relative `/daily-reports?...` deep linking in desktop and standalone PWA |

---

## 3. Current Architecture Findings

1. **Clean Modular Separation Without Mandatory Workflow Engine Coupling (VERIFIED):**
   - While `workflow-engine/` exists in `backend/src/modules/`, operational logging domains such as `ProjectService` progress logs and `TenderActivity` operate without forced Workflow Engine state machines unless approval routing is explicitly modeled.
   - This aligns directly with Business Rules #1–#4: Daily Operations Report MUST NOT create a Workflow Definition/Instance/Task and MUST bypass Head of Division or intermediary approvals.
2. **Existing Log + Evidence + Outbox Pattern Exists in `ProjectService` (VERIFIED):**
   - `backend/src/modules/project/project.service.ts` L5050–5128 writes `ProjectProgressLog`, loops `ProjectProgressEvidence` linking uploaded `Document` rows, emits `audit.log`, and writes `OutboxEvent` inside a single TypeORM transaction (`EntityManager`).
   - However, `ProjectProgressLog` itself is tied strictly to `project_id`, `task_id`, `wbs_id`, `baseline_id`, and `PENDING_VERIFICATION` -> `HEAD_OF_OPERATIONS`/`PMO` approval, so it **cannot** be reused as the storage table for cross-department daily employee reporting.
   - **Critical Pitfall Spotted in `ProjectService` (L5062):** `effective_date` uses `new Date().toISOString().split('T')[0]` (UTC date), which shifts back one calendar day between `00:00–06:59 WIB`. Daily Operations Report **MUST** use `toJakartaDateString()` (`tender-followup.helper.ts` L6–14).
3. **`DocumentService` Entity Whitelist Constraint (VERIFIED):**
   - `DocumentService.validateDocumentEntityAccess()` (`document.service.ts` L337–484) uses a `switch (normalizedType)` permitting ONLY `'PROJECT'`, `'CONTRACT'`, `'TENDER'`, `'INVOICE'`; any other `entityType` throws `BadRequestException`. Supporting optional Daily Report attachments via `documents` requires explicitly extending `DocumentService` (`'DAILY_REPORT'`) with ownership/Director access validation.
4. **Build/Dev Mutual Exclusion Operational Rule (VERIFIED):**
   - `frontend/package.json` includes `build:safe`, which aborts `next build` if port `3000` is occupied (`npm run dev` PID `19560` is currently running). Running `npm run build` for verification requires coordinating an explicit dev-server stop/restart cycle per workspace process rules.

---

## 4. User Identity and Organization Mapping

### 4.1 Verified Gaps Across Entity, API, JWT, and DB Layers
| Requirement | Current Implementation | Status | Evidence |
|---|---|---|---|
| **Authenticated User Identity** | Resolved via `JwtAuthGuard` + `JwtStrategy` (`userId` / `sub`, `email`, `fullName`, `roles`) | **READY** | `backend/src/entities/user.entity.ts` L4–40, `jwt.strategy.ts`, `auth.service.ts` |
| **Employee Division Storage & API** | Not stored anywhere on `users` or in any separate table; not accepted in `CreateUserDto` or `UpdateProfileDto`; not returned by auth/profile APIs | **MISSING / BLOCKED** | `user.entity.ts` L4–40, `create-user.dto.ts`, `update-profile.dto.ts`, `epms_tvmubd_db` schema inspection |
| **Existing Division Heuristic Assessment** | `DashboardService` explicitly flags `subDivisionEnabled: false`, `scope: 'INSTALLATION'`, `allocationStatus: 'DIVISION ALLOCATION RULE NOT VERIFIED'` | **UNUSABLE FOR REPORTS** | `backend/src/modules/dashboard/dashboard.service.ts` |
| **Legal Entity (`PT UBD` / `PT TVM`) per User** | `1794000000000` added `company_code` (`'UBD' \| 'TVM'`) to `projects`, `tenders`, `purchase_orders`, `invoices`, `payment_requests`, `payments`, **but omitted `users`** | **MISSING / BLOCKED** | `1794000000000-CreateTaxManagementTables.ts` L8–29, `user.entity.ts` |
| **JWT Claim Fidelity** | `AuthService.login()` sets `companyId: user.companyId \|\| 1` (always `1` because `User.companyId` is undefined); `AuthService.refreshToken()` omits `permissions`, `companyId`, `branchId`, `tenantId` completely | **DEFECTIVE** | `backend/src/modules/auth/auth.service.ts` L106–115, L196–201, L217–222 |
| **Legal Entity Attribution Heuristic** | Dashboard infers UBD vs TVM only for Marketing PICs (`ragil@epms.com` vs `lukas@epms.com`) | **NON-GENERALIZABLE** | `backend/src/modules/dashboard/dashboard.service.ts` |

### 4.2 Impact Assessment
Because `users` stores zero division or legal entity metadata and `epms_tvmubd_db` has no employee directory/organization table, **reliable automatic capture of Division and Legal Entity (`PT UBD` vs `PT TVM`) at submission time is currently impossible without schema + backfill governance decisions.** Allowing users to freely type/select Division and Company on every daily report as an unverified workaround conflicts with Business Rule #8 ("Legal entity isolation must remain intact") unless explicitly approved as a temporary phase control backed by admin governance.

---

## 5. Director RBAC and Recipient Resolution

### 5.1 Role-Based Mechanism (**VERIFIED**)
- Endpoint protection combines `JwtAuthGuard` with `RolesGuard` (`backend/src/modules/auth/guards/roles.guard.ts`), evaluating `@Roles(...)` and `@DenyRoles(...)` case-insensitively against `user.roles`.
- Although a `permissions` table exists in MySQL, it contains **0 rows** (`epms_tvmubd_db` live query). `AuthService.login()` hardcodes permissions in memory, and `refreshToken()` drops `permissions` from regenerated access tokens (`auth.service.ts` L217–222). **Therefore, `@Roles(...)` plus service-layer ownership/entity predicates—not DB permissions—is the only reliable authorization primitive today.**

### 5.2 Multi-Director Recipient Resolution (**VERIFIED**)
- Live database contains 13 roles including `DIRECTOR` (`id=4`), and currently **1 active `DIRECTOR` user** (`id=4`, `director@epms.com`, `full_name='Director'`, `is_active=1`, with **3 active rows** in `push_subscriptions`).
- Existing modules (`CanonicalNotificationConsumer` L709, `TenderScheduler` L124) resolve Director recipients dynamically by querying active users joined to `roles.name = 'DIRECTOR' AND is_active = 1 AND deleted_at IS NULL`, natively supporting multiple Directors without hardcoded user IDs.

### 5.3 Legal Entity Scoping & Employee Obligation Boundaries (**BLOCKED**)
- **PT UBD vs PT TVM Authorization Gap:** Neither `users` nor `roles` partitions access per legal entity. Both `ExecutiveController` (`@Roles('DIRECTOR','ADMIN','SUPER_ADMIN')`) and `AnalyticsController` (`/marketing-performance`) grant cross-company read access to any Director/Management user without entity predicates. Unless `users.company_code` (or a `user_entities` / `director_entity_scope` mapping allowing `UBD`, `TVM`, or `ALL`) is added, a PT UBD Director could read PT TVM reports and vice versa.
- **Employee-Only Enforcement:** Enforceable cleanly at the service layer by asserting `WHERE report.employee_id = :currentUserId` for all non-Director requests (`GET /daily-reports`, `GET /daily-reports/:id`, `PATCH /daily-reports/:id`, and attachments), unless a future ratified permission explicitly expands visibility.
- **Ambiguity in Active Accounts (`users`):** Live `users` contains system/admin accounts (`id=1 admin@epms.com`, `id=39 superadmin@epms.com`), a generic role account (`id=4709 marketing@epms.com`), executive accounts (`id=4 director@epms.com`), and an unroled test account (`id=4806 pm_1794483970273_5998@test.epms.tvm.com`, `roles=null`). Without an explicit obligation attribute (e.g., `is_daily_report_required`) or role exclusion policy, automated missing-report dashboards and cron reminders will generate invalid non-compliance alerts.

---

## 6. Notification Architecture Findings

EPMS possesses a mature, hardened transactional outbox and Web Push architecture (`OutboxRelayService` -> Consumers -> `CanonicalNotificationWriter` -> `NotificationGateway` / `PushOutboxWorker`). **Building a second notification system is strictly unnecessary and prohibited.**

### 6.1 End-to-End Reuse Pipeline (**VERIFIED**)
1. **Atomic Emission:** Domain service persists the `DailyReport` and an `OutboxEvent` (`status = OutboxStatus.PENDING`, deterministic `event_id` e.g. `daily-report-sub-<reportId>-rev-<rev>`) inside the same TypeORM `EntityManager` transaction.
2. **Polling & Quarantine Guard:** `OutboxRelayService.pollAndRelay()` (`backend/src/modules/system/outbox-relay.service.ts` L46) runs every 5 seconds (`OUTBOX_RELAY_CRON` / `'*/5 * * * * *'`) with pessimistic locking. It requires registered consumers to acknowledge non-`SYNC_ONLY` events or quarantines them as `FAILED [NO_SUBSCRIBER]`.
3. **Mandatory `BusinessSyncConsumer` Registration (CRITICAL GOTCHA):**
   - `BusinessSyncConsumer.APPROVED_ROLE_SYNC_POLICIES` (`backend/src/modules/notification/business-sync.consumer.ts` L42–116) must explicitly register any new Daily Report event names (e.g., `daily_report.submitted`, `daily_report.revised`, `daily_report.director_note_added`, `daily_report.reminder`). Otherwise `OutboxRelayService` will quarantine every event!
4. **Canonical In-App + Push Writer & `'TASK'` Prohibition (CRITICAL GOTCHA):**
   - `CanonicalNotificationConsumer` handles routing (dynamically querying active `DIRECTOR` users or targeting the report author for Director notes/reminders) and calls `CanonicalNotificationWriter.persistCanonicalNotification()` (`canonical-notification.writer.ts` L70–176).
   - `CanonicalNotificationWriter` **rejects `type === 'TASK'` (`ACTIONABLE_TASK_NOT_ALLOWED` at L253–258)**. All Daily Report notifications MUST use informational/alert semantics (`'INFO'` or `'ALERT'`), enforcing Business Rule #4 (no actionable Inbox To-Do / workflow approval tasks).
5. **Deduplication & Retry/Idempotency:**
   - `notifications` enforces DB uniqueness via `idx_notif_user_dedupe (user_id, dedupe_key)`.
   - `CanonicalNotificationWriter` derives deterministic keys (`<eventId>:<recipientId>:<purpose>` and `...:PUSH`), inserts `Notification` + `PushOutbox` atomically, and emits Socket.IO `'new_notification'` to `room:user:${userId}` (`NotificationGateway`, namespace `/notifications`, L132).
   - **Schema Caveat Observed:** Live MySQL `outbox_events` only has `PRIMARY KEY (id)` and no unique constraint on `event_id`; idempotency of outbox emission must be guarded in application logic or via a future unique index migration on `outbox_events(event_id)`.
6. **Web Push Delivery:**
   - `PushOutboxWorker` (`push-outbox.worker.ts` L61–72) is enabled in environment (`PUSH_WORKER_ENABLED=true`, `PUSH_POLL_INTERVAL_MS=3000` in `backend/.env`) and uses `FOR UPDATE SKIP LOCKED`, max 3 delivery attempts, exponential backoff (`30s`, `60s`, `120s`, cap `300s`), and `WebPushDispatcher` (RFC 8291/8292 VAPID + 8-layer SSRF guard).
7. **Notification Preferences & Automated Reminders:**
   - **Preferences (**MISSING**):** No per-user channel/category notification preference table or API exists (`PushNotificationToggle.tsx` only toggles browser device subscription).
   - **Reminders (**PARTIAL / BLOCKED**):** `TenderScheduler` (`tender.scheduler.ts` L124) proves NestJS `@Cron(..., { timeZone: 'Asia/Jakarta' })` + MySQL `GET_LOCK` multi-instance advisory locking works, **but** Daily Report reminder delivery is blocked until the target employee roster flag (`is_daily_report_required`) and cutoff schedule are ratified.

---

## 7. Audit Trail Findings

1. **Existing Mechanism (`AuditLog`):** Stored in `audit_logs` via `AuditLog` entity (`audit-log.entity.ts`) and read via `/api/v1/audit-logs`, which is restricted to `SUPER_ADMIN` (`audit.controller.ts` L17).
2. **Async vs. Transactional Write Distinction (**VERIFIED**):**
   - Most domain modules (e.g., `user-session.service.ts` L82–88; `project.service.ts` L5083–5097) invoke `this.eventEmitter.emit('audit.log', ...)`. `AuditLogListener` (`audit-log.listener.ts` L16–53) handles this **asynchronously outside the primary DB transaction** and catches/logs failures without rolling back the business mutation.
   - `OutboxRelayService` (L499–516) demonstrates transactional persistence (`manager.save(AuditLog, ...)` inside the DB transaction boundary).
3. **Fit for Director Notes & Revision History:**
   - Because `/api/v1/audit-logs` is restricted to `SUPER_ADMIN`, **Directors and employees cannot query `audit_logs` to see revision history or Director guidance notes**.
   - **Recommendation:** Store Director notes in a first-class normalized table (`daily_report_notes`) and field-level edit history in `daily_report_revisions` so UI consumers read structured domain records reliably, while ALSO writing `AuditLog` entries (`DAILY_REPORT_SUBMITTED`, `DAILY_REPORT_REVISED`, `DAILY_REPORT_DIRECTOR_NOTE_ADDED`) inside the transaction (`manager.save(AuditLog, ...)`) for tamper-evident governance.

---

## 8. Proposed Daily Report Data Model

*(Conceptual design only — NOT executed or migrated in Phase 1)*

### 8.1 Reusability Verdict
No existing entity (`ProjectProgressLog`, `TenderActivity`, `Task`) fits enterprise cross-division Daily Operations Reports. A dedicated entity family following EPMS TypeORM/MySQL raw-migration patterns is required.

### 8.2 Proposed Schema Blueprint
| Table | Columns (Key Design) | Constraints & Business Rule Alignment |
|---|---|---|
| `daily_reports` | `id` (`BIGINT UNSIGNED AI PK`), `employee_id` (`FK -> users.id`), `report_date` (`DATE NOT NULL` via `toJakartaDateString()`), `company_code` (`VARCHAR(10) NOT NULL`, `'UBD' \| 'TVM'`), `division_name` (`VARCHAR(100) NOT NULL`), `activities` (`TEXT NOT NULL`), `work_results` (`TEXT NOT NULL`), `obstacles_and_risks` (`TEXT NULL`), `next_day_plan` (`TEXT NOT NULL`), `revision_count` (`INT UNSIGNED DEFAULT 0`), `submitted_at` (`DATETIME NOT NULL`), `last_revised_at` (`DATETIME NULL`), `created_at`, `updated_at`, `deleted_at` | `UNIQUE KEY uk_daily_report_emp_date (employee_id, report_date)` guarantees **strictly 1 report per employee per Jakarta business date** without Workflow Engine statuses (`NO` pending/approved/rejected column needed). `company_code` index enables strict UBD/TVM isolation & Director filtering. |
| `daily_report_revisions` | `id`, `daily_report_id` (`FK -> daily_reports.id`), `revision_number` (`INT UNSIGNED`), `activities`, `work_results`, `obstacles_and_risks`, `next_day_plan`, `revision_reason` (`VARCHAR(500)`), `revised_by` (`FK -> users.id`), `revised_at` (`DATETIME`) | Preserves full immutable pre-edit or post-edit snapshots whenever an employee corrects a report (`correction & revision history`). |
| `daily_report_notes` | `id`, `daily_report_id` (`FK -> daily_reports.id`), `director_id` (`FK -> users.id`), `note` (`TEXT NOT NULL`), `created_at`, `updated_at` | Clean 1:N Director guidance thread directly visible to the report owner & Directors without exposing `SUPER_ADMIN` `audit_logs`. |
| `daily_report_attachments` | `id`, `daily_report_id` (`FK -> daily_reports.id`), `document_id` (`FK -> documents.id`), `created_by` (`FK -> users.id`), `created_at` | Mirrors `ProjectProgressEvidence` (`project-progress-evidence.entity.ts`). **Requires** adding `'DAILY_REPORT'` validation branch to `DocumentService.validateDocumentEntityAccess()` (`document.service.ts` L337–484). |

### 8.3 Timezone & Uniqueness Guarantee (**VERIFIED PATTERN**)
- Server runtime runs in Node.js while MySQL OS clock is `UTC+7` (`SE Asia Standard Time`).
- Report submissions **must compute `report_date` exclusively via `toJakartaDateString()`** (`backend/src/modules/marketing/tender-followup.helper.ts` L6–14), preventing late-night/early-morning UTC date shifts.
- Concurrent double-clicks attempting duplicate daily submissions must catch MySQL `ER_DUP_ENTRY` on `uk_daily_report_emp_date` and return HTTP `409 Conflict` directing the client to Revision mode (`PATCH`).

---

## 9. Frontend and Navigation Integration Plan

1. **Navigation Placement (`frontend/src/constants/menuConfig.ts`):**
   - `menuConfig.ts` acts as the single SSOT for sidebar groups (`MAIN MENU`, `MODULES`, `DATA MASTER`, `PROJECT GOVERNANCE`, `SYSTEM`) rendered in `MainLayout.tsx` and enforced cleanly by `ProtectedRoute.tsx`.
   - **Recommended Location:** Place **`Daily Operations Report`** (`/daily-reports`) inside **`MAIN MENU`** (alongside top-level operational destinations such as dashboard, inbox, and reports), visible to `DIRECTOR` and employee operational roles without hiding daily reporting beneath module-specific silos.
2. **Component & Layout Reuse (`frontend/src/components/common/`):**
   - Reuse `PageHeader.tsx`, `KpiStatCard.tsx`, `UserIdentityDisplay.tsx`, `StatusBadge.tsx`, `ResponsiveModal.tsx`, and existing Ant Design tokens rather than creating bespoke styling systems.
3. **Dual Role-Aware Experience on `/daily-reports` (No Unrelated Page Redesign):**
   - **Employee Workspace:** Shows today's `Asia/Jakarta` date banner (`dayjs`), active `UBD`/`TVM` + Division badge (once ratified), unified Form (`Activities`, `Work Results`, `Obstacles & Risks`, `Next-Day Plan`, optional attachments), auto-switches from "Submit Today's Report" to "Revise Today's Report" once submitted, displays Director Notes callout card, and renders personal report history + revision drawer.
   - **Director Dashboard & Monitoring:** Uses `KpiStatCard` summary strip (Submitted Today, Outstanding, With Obstacles, Noted vs Unnoted), filter bar (Date Range, Legal Entity `PT UBD` / `PT TVM`, Division, Employee search), submission list + slide-over detail drawer to review content/revisions and submit Director guidance notes, plus an **Outstanding Reports** tab listing obligated employees who have not yet reported.
4. **Notification Deep-Linking & Mobile PWA Considerations (**VERIFIED**):**
   - `NotificationBell.tsx` (L560–578), `notificationSync.ts` (L188–190), and `public/sw.js` (L68–105) natively support relative `actionLink` deep links such as `/daily-reports?reportId=123&date=2026-11-17` across both browser tabs and standalone PWA mode.
   - Mobile viewports must fall back from wide Ant Design tables to stacked summary cards (`Grid.useBreakpoint()`) to avoid horizontal clipping on narrow screens.

---

## 10. Security and Data Integrity Risks

| ID | Risk | Severity | Root Cause Verified in Codebase | Mitigation Required Before Implementation |
|---|---|---|---|---|
| **RISK-01** | **Legal Entity Cross-Leakage (`PT UBD` vs `PT TVM`)** | **CRITICAL** | `users` has no `company_code`; `AuthService.login()` sets `companyId: user.companyId \|\| 1`; `refreshToken()` drops `companyId`; existing executive/analytics controllers do not filter per-user company scope | Add `company_code` / `user_entities` schema, backfill users, fix `refreshToken()` JWT claims, enforce entity predicate in every query & push recipient resolver |
| **RISK-02** | **Unverified Division / Entity Self-Declaration** | **HIGH** | No `division` or `department` table/column exists on `users` | Disallow free-text user overrides of organizational identity in production; bind read-only snapshot from DB `users` record |
| **RISK-03** | **IDOR on Daily Reports & Attachments** | **HIGH** | Any shared `GET /daily-reports/:id` or `/documents/:id/download` without owner check exposes peer reports | Enforce `report.employee_id === currentUser.id` for non-Directors and legal-entity scope for `DIRECTOR`; extend `DocumentService` entity checks |
| **RISK-04** | **Silent Notification Quarantine (`NO_SUBSCRIBER`)** | **HIGH** | `OutboxRelayService` quarantines unsubscribed events as `FAILED` if `BusinessSyncConsumer.APPROVED_ROLE_SYNC_POLICIES` lacks the event name | Register every `daily_report.*` event in `BusinessSyncConsumer` and `CanonicalNotificationConsumer` simultaneously |
| **RISK-05** | **`ACTIONABLE_TASK_NOT_ALLOWED` Runtime Crash** | **MEDIUM** | `CanonicalNotificationWriter` (L253–258) throws if notification `type === 'TASK'` | Strictly use `type: 'INFO'` or `'ALERT'` for Daily Report events |
| **RISK-06** | **UTC Midnight Date Shift** | **MEDIUM** | Node `new Date().toISOString()` uses UTC, differing from `Asia/Jakarta` (`UTC+7`) between `00:00–06:59 WIB` | Use `toJakartaDateString()` (`tender-followup.helper.ts` L6–14) for `report_date` calculation & uniqueness |
| **RISK-07** | **False-Positive Outstanding Reports & Spam Reminders** | **MEDIUM** | `users` mixes employees, admins (`admin`, `superadmin`), service accounts (`marketing@epms.com`), `director`, and leftover test user `#4806` (`roles=null`) | Introduce explicit `is_daily_report_required` governance flag + exclude deactivated/non-employee accounts |
| **RISK-08** | **Duplicate Outbox Event Publishing & Non-Atomic Audits** | **MEDIUM** | `outbox_events` lacks unique constraint on `event_id`; `audit.log` event listener runs async outside DB transaction | Enforce deterministic `event_id` checks or unique key on `outbox_events(event_id)`; save critical `AuditLog` rows via `manager.save()` inside transaction |
| **RISK-09** | **Stale Permission Claims After Token Refresh** | **MEDIUM** | `AuthService.refreshToken()` (`auth.service.ts` L217–222) drops `permissions` and `companyId`; `permissions` table has `0` rows | Rely on DB-backed `@Roles()` + server-side user lookup for sensitive report queries, and patch `refreshToken()` payload |

---

## 11. Three-Hour Implementation Feasibility

**Classification Legend (Per Audit Charter):**
- **READY:** Existing infrastructure supports implementation.
- **PARTIAL:** Requires limited development.
- **BLOCKED:** Critical dependency or unresolved architectural issue.
- **NOT VERIFIED:** Insufficient evidence.

| # | Deliverable Scope | Classification | Technical Justification (Verified Basis) | Estimated Realistic Effort |
|---|---|---|---|---|
| **1** | **Backend and data model** | **BLOCKED** | Report tables + DTOs + service + controller + revisions + entity RBAC must be created from scratch (`0` existing daily report files), AND **auto-capturing employee division + legal entity (`UBD`/`TVM`) is blocked** by absent `users` columns/tables and `auth.service.ts` JWT defects | 3.5 – 5.0 hrs |
| **2** | **Employee submission form** | **PARTIAL** | Layout (`PageHeader`), responsive modals, Ant Design form/dayjs, and Axios client exist; requires new `/daily-reports` submission + revision UI, field validation, and history view | 1.5 – 2.5 hrs |
| **3** | **Director dashboard** | **BLOCKED** | Reuses `KpiStatCard` & chart primitives, **but legal-entity (`UBD`/`TVM`) & division filtering + aggregate KPIs are blocked** until organizational ownership on `users` is defined | 2.0 – 3.0 hrs |
| **4** | **New navigation menu** | **READY** | SSOT `MENU_GROUPS` in `frontend/src/constants/menuConfig.ts` integrates cleanly with `MainLayout.tsx` & `ProtectedRoute.tsx` | 0.25 hrs |
| **5** | **Director report monitoring** | **PARTIAL** | Dynamic multi-Director role (`'DIRECTOR'`) and `UserIdentityDisplay` exist; requires building monitoring table/cards, detail drawer, `daily_report_notes` API/UI, and entity-scope enforcement | 1.5 – 2.0 hrs |
| **6** | **Outstanding report monitoring** | **BLOCKED** | Impossible to accurately list non-submitters without distinguishing obligated employees from `admin`/`superadmin`/service/`director`/test user `#4806` across `PT UBD` & `PT TVM` | 1.5 – 2.0 hrs |
| **7** | **In-app notifications** | **PARTIAL** | Outbox -> `CanonicalNotificationWriter` -> Socket.IO `/notifications` -> `NotificationBell` -> `notificationSync.ts` are **ready**, requiring bounded wiring for new event handlers, `BusinessSyncConsumer` registration, and `type: 'INFO'` payload | 0.75 – 1.25 hrs |
| **8** | **Web Push notifications** | **PARTIAL** | `PushOutboxWorker` (`PUSH_WORKER_ENABLED=true`), `WebPushDispatcher`, VAPID keys, `sw.js`, and 3 active `director@epms.com` subscriptions are **ready**; shares dependency on new event emission & multi-Director entity routing | 0.5 – 0.75 hrs |
| **9** | **Automated reminders** | **BLOCKED** | `TenderScheduler` cron (`Asia/Jakarta` + `GET_LOCK`) pattern exists, **but reminder target resolution is blocked** by missing employee obligation flag + zero notification preference controls + undecided schedule policy | 1.5 – 2.0 hrs |
| **10** | **RBAC and audit verification** | **BLOCKED** | `RolesGuard` & `AuditLog` exist, **but entity isolation cannot be verified** until `users.company_code` and `AuthService.refreshToken()` claims are fixed; DB `permissions` table has `0` rows | 1.0 – 1.5 hrs |
| **11** | **Regression testing and production build** | **PARTIAL** | 136 backend Jest suites, frontend Jest, Playwright, and `build:safe` exist; requires new unit/integration/E2E suites plus stopping live Next dev PID `19560` to run `next build` safely | 2.0 – 3.0 hrs |

**Cumulative Realistic Engineering Effort (ASSUMPTION / ESTIMATE for Full 11-Item Scope):** **~15.5 – 23.0 Hours (2 to 3 Engineering Days)** *after* governance blockers are resolved *(assumes standard CRUD/notification patterns without external HR directory sync or Workflow Engine changes)*.

> [!CAUTION]
> **3-HOUR MVP VERDICT:** Implementing all 11 deliverables safely with legal-entity isolation (`PT UBD` / `PT TVM`), division mapping, revision history, Director notes, outstanding tracker, reminders, automated push, RBAC verification, and regression/production build inside **3 hours is NOT REALISTIC**. Attempting all 11 items in 3 hours creates unacceptable security risks (cross-entity leakage, IDOR) and notification bugs (`[NO_SUBSCRIBER]` quarantines, wrong UTC dates).

---

## 12. Recommended Implementation Sequence

Once System Owner governance decisions (Section 13) are signed off:

1. **Step 1 — Organizational Identity & Auth Hardening (Prerequisite Gate):**
   - Migration: Add `company_code` (`'UBD' | 'TVM'` or `user_entities` pivot), `division` (or `division_id`), and `is_daily_report_required` (`TINYINT(1)`) to `users`; clean up/deactivate leftover test accounts (`#4806`).
   - Update `User` entity, `AdminUserService`, `CreateUserDto`, and `AuthService` (`login()` + `refreshToken()` so claims stay consistent).
2. **Step 2 — Core Daily Report Data Model & Module (`Backend`):**
   - Migration: Create `daily_reports` (`UNIQUE(employee_id, report_date)`), `daily_report_revisions`, `daily_report_notes`; defer or pair `daily_report_attachments` + `DocumentService` `'DAILY_REPORT'` branch cleanly.
   - Implement `DailyReportService` using `toJakartaDateString()`, strict ownership/entity guards, transactional `AuditLog` + `OutboxEvent`.
3. **Step 3 — Outbox, Canonical In-App & Web Push Wiring (`Backend`):**
   - Register events in `BusinessSyncConsumer.APPROVED_ROLE_SYNC_POLICIES` and `CanonicalNotificationConsumer` using `type: 'INFO'` and relative `actionLink: /daily-reports?reportId=<id>&date=YYYY-MM-DD`.
   - Resolve active `DIRECTOR` recipients respecting entity scope.
4. **Step 4 — Navigation & Dual Frontend Workspace (`Frontend`):**
   - Add `Daily Operations Report` (`/daily-reports`) to `MAIN MENU` in `frontend/src/constants/menuConfig.ts`.
   - Build Employee Submit/Revise + Director Note view & Director Monitoring Dashboard/Detail Drawer with mobile-friendly responsive cards.
5. **Step 5 — Outstanding Report Tracker & Automated Jakarta Reminder (`Backend + Frontend`):**
   - Build obligated-employee diff query + `@Cron(..., { timeZone: 'Asia/Jakarta' })` + `GET_LOCK` reminder job.
6. **Step 6 — Verification & Controlled Build:**
   - Write Jest unit/RBAC/outbox specs + Playwright desktop/mobile E2E checks, stop port `3000` dev PID `19560`, run `npm run build:safe`, verify, and restart single dev server cleanly.

---

## 13. Explicit Blockers and Unresolved Decisions

Implementation **must not begin** until the System Owner ratifies the following decisions:

| Decision ID | Unresolved Question | Impacted Components |
|---|---|---|
| **DEC-DR-01** | **Authoritative Division Master & Assignment:** Should Division be a controlled enum/master table or a string on `users`, and who will supply the backfill mapping for every existing employee in `epms_tvmubd_db`? | Schema migration, submission snapshot, Director division filter |
| **DEC-DR-02** | **Legal Entity Ownership (`PT UBD` vs `PT TVM`) per User:** Are employees strictly 1-to-1 (`users.company_code IN ('UBD','TVM')`), or can dual-company staff / Directors access **both** `PT UBD` and `PT TVM`? | `users` schema vs `user_entities` table, Director RBAC & recipient filter |
| **DEC-DR-03** | **Daily Reporting Obligation List (`Outstanding Reports` & `Reminders`):** Which exact users/roles must submit daily reports, vs exempt accounts (`DIRECTOR`, `ADMIN`, `SUPER_ADMIN`, shared `marketing@epms.com`, test user `#4806`)? | Outstanding monitor query, automated cron push recipient list |
| **DEC-DR-04** | **Correction / Revision Policy:** Can employees revise a report only on the same `Asia/Jakarta` business date (`report_date == today`), or also retroactively (and should Director be re-notified on every edit)? | `DailyReportService.revise()`, `daily_report_revisions`, notification noise |
| **DEC-DR-05** | **Attachment Scope Decision:** Is optional file attachment support required in Day-1 MVP (`DocumentService` `'DAILY_REPORT'` modification + `daily_report_attachments`), or deferred to Phase 2B? | `document.service.ts`, upload UI, storage policy |
| **DEC-DR-06** | **Automated Reminder Schedule:** At what exact `Asia/Jakarta` hour (e.g., `16:30` or `17:00 WIB`) and on which days (Mon–Fri only, excluding holidays?) should missed-report reminders trigger? | `@Cron` scheduler, operational calendar rules |
| **DEC-DR-07** | **Timeline vs. Scope Trade-Off:** Does Management approve expanding the budget to **2–3 engineering days** for full 11-item delivery, OR approve a **Phased Rollout** (deciding which items are excluded from an emergency thin slice)? | Project schedule & sprint acceptance criteria |

---

## 14. Final Recommendation: GO / CONDITIONAL GO / NO-GO

### **1. Full 11-Item Scope Within 3 Hours:** **NO-GO**
- Trying to deliver the entire 11-item checklist (including new schema/entity foundation, Director entity-isolated dashboard, outstanding tracking, attachments, automated cron reminders, RBAC/audit verification, and production build/tests) inside **3 hours** is technically infeasible and creates severe **BLOCKED** governance defects around legal entity isolation (`PT UBD` vs `PT TVM`), missing division metadata, and stale `refreshToken()` claims.

### **2. Phased Delivery After Blockers Resolved:** **CONDITIONAL GO**
Authorized to proceed into **Phase 2** **ONLY IF** all three conditions below are confirmed by the System Owner:
1. **Decisions DEC-DR-01 through DEC-DR-04** (Division source, Legal Entity mapping per employee/Director, Obligation flag / test user cleanup, Revision window) are formally ratified before writing migrations.
2. **Security Foundation Included First:** `users` organizational schema + `AuthService.refreshToken()` fix + `BusinessSyncConsumer` event registration are treated as mandatory Phase 2A prerequisites—not skipped.
3. **Timeline Alignment:**
   - **Recommended Full Delivery (`2–3 Days`):** Execute Steps 1–6 sequentially with zero governance compromises.
   - **If a Narrow 3–4 Hour Initial Prototype Is Explicitly Authorized Post-Decisions:** Restrict scope strictly to Core Text-Only Report (`daily_reports` + `revisions` + `notes`), fixed/ratified user org mapping, `menuConfig` nav item, basic Employee Form + Director List/Note view + In-App/Web Push for active `DIRECTOR`, **explicitly deferring** Outstanding Tracker (Item 6), File Attachments, Automated Cron Reminders (Item 9), KPI Charts (Item 3), and full E2E production regression (Item 11) to Phase 2B.

---

**AUDIT STATUS:** COMPLETE — Awaiting explicit System Owner / User authorization before initiating Phase 2.
