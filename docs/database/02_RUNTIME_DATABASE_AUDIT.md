# 02. RUNTIME DATABASE AUDIT DOCUMENT

> **Document ID**: `EPMS-DOC-DB-02`  
> **Audit Type**: **READ-ONLY COMPARATIVE RUNTIME AUDIT**  
> **Source of Truth (Baseline)**: `database/epms_tvmubd_db.sql` & `docs/database/01_DATABASE_BASELINE.md`  
> **Target Environment**: Runtime MariaDB `127.0.0.1:3306/epms_tvmubd_db`  
> **Audit Date**: 2026-08-05  

---

## 1. DATABASE SUMMARY & CONNECTION AUDIT

- **Database Host**: `127.0.0.1`
- **Database Port**: `3306`
- **Database Engine**: MariaDB / MySQL `9.7.1`
- **Database Name**: `epms_tvmubd_db`
- **Database User**: `epms_app_user`
- **TypeORM Synchronize**: `false` (Disabled in `app.module.ts`)
- **Backend & Script Connection Parity**: **100% MATCH** (Both backend on port 4000 and audit scripts connect to the exact same MariaDB instance).

---

## 2. TABLE DRIFT MATRIX

Comparison of all 35 tables between **Baseline SQL** (`epms_tvmubd_db.sql`) vs **Runtime Database**:

| Table Name | Baseline | Runtime | Row Count | Status |
|---|---|---|---|---|
| `audit_logs` | YES | YES | 11 | MATCH |
| `contracts` | YES | YES | 25 | MATCH |
| `contract_amendments` | YES | YES | 0 | MATCH |
| `customers` | YES | YES | 2 | MATCH |
| `dashboard_kpis` | YES | YES | 0 | MATCH |
| `documents` | YES | YES | 5 | MATCH |
| `goods_receipts` | YES | YES | 0 | MATCH |
| `invoices` | YES | YES | 0 | MATCH |
| `milestones` | YES | YES | 0 | MATCH |
| `notifications` | YES | YES | 11 | MATCH |
| `outbox_events` | YES | YES | 11 | MATCH |
| `payments` | YES | YES | 0 | MATCH |
| `permissions` | YES | YES | 0 | MATCH |
| `projects` | YES | YES | 3 | MATCH |
| `project_budgets` | YES | YES | 0 | MATCH |
| `proposals` | YES | YES | 48 | MATCH |
| `purchase_orders` | YES | YES | 0 | MATCH |
| `purchase_order_items` | YES | YES | 0 | MATCH |
| `purchase_requests` | YES | YES | 0 | MATCH |
| `purchase_request_items` | YES | YES | 0 | MATCH |
| `rfqs` | YES | YES | 0 | MATCH |
| `roles` | YES | YES | 11 | MATCH |
| `role_permissions` | YES | YES | 0 | MATCH |
| `tasks` | YES | YES | 0 | MATCH |
| `tenders` | YES | YES | 49 | MATCH |
| `tender_activities` | YES | YES | 138 | MATCH |
| `tender_price_history` | YES | YES | 0 | MATCH |
| `users` | YES | YES | 17 | MATCH |
| `user_roles` | YES | YES | 17 | MATCH |
| `vendors` | YES | YES | 0 | MATCH |
| `vendor_comparisons` | YES | YES | 0 | MATCH |
| `workflow_definitions` | YES | YES | 0 | MATCH |
| `workflow_instances` | YES | YES | 0 | MATCH |
| `workflow_tasks` | YES | YES | 0 | MATCH |
| `work_breakdown_structures` | YES | YES | 0 | MATCH |

---

## 3. COLUMN DRIFT MATRIX

Comparison of Column Specifications between **Baseline SQL** vs **Runtime Database**:

| Table Name | Column Name | Baseline | Runtime | Status |
|---|---|---|---|---|
| *(All 35 Tables)* | *(All 275+ Columns)* | YES | YES | **100% STRUCTURAL MATCH** |

*Note*: The physical Runtime Database matches the Baseline SQL Dump 100% column by column. The drift exists between **TypeORM Entities in Code** and the **Runtime Database**.

---

## 4. ENUM DRIFT MATRIX

Audited ENUM columns in Runtime Database:

| Table Name | Column Name | Runtime ENUM Specification | Baseline ENUM Specification | Status |
|---|---|---|---|---|
| `contracts` | `legal_status` | `enum('DRAFT','ON_REVIEW','APPROVED','REJECTED','REVISION_REQUESTED')` | Same | MATCH |
| `documents` | `access_level` | `enum('ALL','LEGAL_ONLY','DIRECTOR_ONLY')` | Same | MATCH |
| `purchase_requests` | `urgency` | `enum('LOW','MEDIUM','HIGH','CRITICAL')` | Same | MATCH |
| `rfqs` | `procurement_type` | `enum('DIRECT_PURCHASE','DIRECT_SELECTION','LIMITED_TENDER','OPEN_TENDER')` | Same | MATCH |
| `tenders` | `procurement_type` | `enum('DIRECT_SELECTION','DIRECT_APPOINTMENT','LIMITED_TENDER','OPEN_TENDER')` | Same | MATCH |
| `tenders` | `priority` | `enum('LOW','MEDIUM','HIGH','URGENT')` | Same | MATCH |
| `tenders` | `spk_verification_status` | `enum('UNVERIFIED','PENDING_REVIEW','APPROVED','REJECTED')` | Same | MATCH |
| `vendors` | `vendor_type` | `enum('MATERIAL_SUPPLIER','SUBCONTRACTOR','EQUIPMENT_RENTAL','SERVICE_PROVIDER','CONSULTANT')` | Same | MATCH |

---

## 5. FOREIGN KEY DRIFT

- **Total Foreign Keys in Runtime DB**: 26 active Foreign Keys.
- **Drift Status**: **0 Foreign Key Drift** between Baseline SQL and Runtime DB.

---

## 6. INDEX DRIFT

- **Primary Keys**: 35 of 35 tables possess explicit Primary Keys on `id`.
- **Secondary Indexes & Unique Constraints**: 100% in parity with Baseline SQL.

---

## 7. ENTITY DRIFT (TYPEORM CODE VS DATABASE)

Major structural discrepancy discovered between TypeORM Entity files (`backend/src/entities/*.entity.ts`) and the physical Runtime Database:

| Entity Class | Table | Column Name | Defined in Code | Present in Runtime DB | Status |
|---|---|---|---|---|---|
| `Tender` | `tenders` | `go_nogo_status` | YES (`enum: GoNoGoStatus`) | ❌ NO | **ENTITY DRIFT (MISSING IN DB)** |
| `Tender` | `tenders` | `go_nogo_notes` | YES (`text`) | ❌ NO | **ENTITY DRIFT (MISSING IN DB)** |
| `Tender` | `tenders` | `go_nogo_by` | YES (`bigint`) | ❌ NO | **ENTITY DRIFT (MISSING IN DB)** |
| `Tender` | `tenders` | `go_nogo_at` | YES (`datetime`) | ❌ NO | **ENTITY DRIFT (MISSING IN DB)** |
| `Tender` | `tenders` | `revision_status` | YES (`enum: RevisionStatus`) | ❌ NO | **ENTITY DRIFT (MISSING IN DB)** |

---

## 8. MIGRATION STATUS

- **Table `migrations` in Database**: ❌ **DOES NOT EXIST** (`Table 'epms_tvmubd_db.migrations' doesn't exist`).
- **Physical Migration Files in Repo** (`backend/src/migrations`): 8 Files.
- **Executed Migrations**: **0**
- **Unexecuted Migrations**: **8**
  1. `1721180000000-UpdateTenderStatusEnum.ts` (UNEXECUTED)
  2. `1721182000000-EvolveContractsModule.ts` (UNEXECUTED)
  3. `1721387600000-AddRefreshTokenToUsers.ts` (UNEXECUTED)
  4. `1721500000000-AddOptimisticLockVersionColumns.ts` (UNEXECUTED)
  5. `1785484532784-AddRevisionRequestedEnum.ts` (UNEXECUTED)
  6. `1785500000000-CleanupOrphanedContracts.ts` (UNEXECUTED)
  7. `1785600000000-AddGoNoGoGateToTenders.ts` (UNEXECUTED)
  8. `1785700000000-AddRevisionStatusToTenders.ts` (UNEXECUTED)

---

## 9. ROOT CAUSE

1. **Unexecuted Migration Lifecycle**:
   Developers modified TypeORM Entities and generated migration files (`1785600000000-AddGoNoGoGateToTenders.ts` and `1785700000000-AddRevisionStatusToTenders.ts`), but never executed `npx typeorm migration:run` on the running database server. Because `synchronize: false` is set in `app.module.ts`, the physical DB columns were never created.

2. **Runtime Error Impact**:
   When `GET /api/v1/marketing/tenders` is called, TypeORM attempts to select `tender.go_nogo_status` and `tender.revision_status`. MariaDB throws:
   `QueryFailedError: Unknown column 'Tender.go_nogo_status' in 'field list'` (SQLState `42S22`).

3. **Silent Exception Catching**:
   In `marketing.service.ts` L267-270, the `catch (e)` block catches the SQL Exception and returns `[]` (empty array) with HTTP 200, causing the Kanban Board to render blank.

---

## 10. RECOMMENDATION

*(Read-Only Audit Recommendation for Future Synchronization)*

1. Execute pending migrations via TypeORM CLI (`npx typeorm migration:run`) or execute DDL SQL statements to create the missing 5 columns on table `tenders`.
2. Seed `go_nogo_status = 'GO'` for legacy active tenders past LEAD stage to ensure hard gate compatibility.
3. Harden error logging in `MarketingService.getTenders()` so SQL errors throw explicit HTTP 500 errors instead of returning empty arrays.
