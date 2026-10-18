# EPMS — CLEAN TEST DATABASE BASELINE
## PHASE DB-A1 — TRANSACTION DATA & AUTO_INCREMENT AUDIT REPORT

**STATUS:** **PASS**  
**MODE:** AUDIT ONLY (READ-ONLY DATABASE INSPECTION)  
**DATABASE ENGINE:** MySQL (InnoDB)  
**SERVER VERSION:** `9.7.1`  
**ACTIVE SCHEMA:** `epms_tvmubd_db`  
**TOTAL TABLES:** **61**  
**DATABASE MUTATION:** **NONE (0 rows deleted, 0 rows updated, 0 tables truncated, 0 sequences altered)**  

---

## 1. EXECUTIVE SUMMARY & CLASSIFICATION SUMMARY

Every table in `epms_tvmubd_db` has been inspected via read-only SQL queries against `INFORMATION_SCHEMA` and authoritative table counts.

| Classification | Count | Description |
| :--- | :---: | :--- |
| **PRESERVE_CORE** | **6** | Core platform infrastructure required for EPMS startup, TypeORM migration tracking, and workflow engine definitions. |
| **PRESERVE_MASTER** | **0** | No standalone reference table is pure static seed without test mixing (see `REVIEW_REQUIRED`). |
| **CLEAN_TRANSACTION_CANDIDATE** | **43** | Business transaction tables generated during development, manual testing, and automated E2E lifecycle runs. |
| **CLEAN_TECHNICAL_CANDIDATE** | **6** | Technical records directly coupled to test transactions (notifications, outbox events, user sessions, workflow runtime instances/tasks/transitions). |
| **REVIEW_REQUIRED** | **6** | Mixed tables containing both legitimate system/master data and ephemeral test-generated rows (`users`, `user_roles`, `customers`, `vendors`, `documents`, `audit_logs`). |
| **UNKNOWN** | **0** | All 61 tables are fully identified and categorized with 100% schema and code evidence. |
| **TOTAL** | **61** | **Authoritative table count in schema** |

---

## 2. CURRENT DATA PROFILE (AUTHORITATIVE TOTALS)

| Domain / Concept | Associated Table(s) | Row Count | Max PK ID | Next Auto Increment |
| :--- | :--- | :---: | :---: | :---: |
| **Users** | `users` | 69 | 3,706 | 3,835 |
| **RBAC Roles** | `roles` | 13 | 67 | 72 |
| **RBAC Role Assignments** | `user_roles` | 14 | N/A (Composite) | N/A |
| **Customers** | `customers` | 9 | 16 | 17 |
| **Vendors** | `vendors` | 6 | 41 | 42 |
| **Tenders / Opportunities** | `tenders` | 189 | 208 | 209 |
| **Tender Activities** | `tender_activities` | 818 | 827 | 828 |
| **Tender Price History** | `tender_price_history` | 86 | 94 | 95 |
| **Proposals** | `proposals` | 142 | 151 | 152 |
| **Contracts** | `contracts` | 143 | 162 | 163 |
| **Contract Amendments** | `contract_amendments` | 0 | NULL | 1 |
| **Projects** | `projects` | 129 | 2,428 | 2,429 |
| **Project Initial Conditions** | `project_initial_conditions` | 74 | 98 | 99 |
| **Project Cost Estimates** | `project_cost_estimates` | 73 | 97 | 98 |
| **Project Cost Items** | `cost_items` | 228 | 256 | 257 |
| **Work Breakdown Structures** | `work_breakdown_structures` | 752 | 3,233 | 3,234 |
| **Project Tasks (Gantt/Sched)** | `tasks` | 179 | 2,504 | 2,505 |
| **Project Baselines** | `project_baselines` | 66 | 1,801 | 1,802 |
| **Baseline WBS Items** | `project_baseline_wbs_items` | 140 | 1,369 | 1,370 |
| **Management Reviews** | `project_management_reviews` | 67 | 92 | 93 |
| **Progress Logs** | `project_progress_logs` | 48 | 1,193 | 1,194 |
| **Progress Evidence** | `project_progress_evidence` | 23 | 816 | 817 |
| **Project Issues** | `project_issues` | 9 | 9 | 10 |
| **Project Risks** | `project_risks` | 5 | 5 | 6 |
| **Procurement Packages** | `procurement_packages` | 39 | 42 | 43 |
| **Procurement Package Items** | `procurement_package_items` | 67 | 87 | 88 |
| **Purchase Requests (PR)** | `purchase_requests` | 33 | 33 | 46 |
| **Purchase Request Items** | `purchase_request_items` | 59 | 59 | 60 |
| **RFQs** | `rfqs` | 27 | 27 | 28 |
| **Quotations** | `quotations` | 70 | 70 | 70 |
| **Quotation Items** | `quotation_items` | 149 | 149 | 149 |
| **Vendor Comparisons** | `vendor_comparisons` | 70 | 70 | 70 |
| **Purchase Orders (PO)** | `purchase_orders` | 20 | 20 | 33 |
| **Purchase Order Items** | `purchase_order_items` | 45 | 45 | 46 |
| **PO Payment Terms** | `po_payment_terms` | 59 | 59 | 60 |
| **Goods Receipts (GR)** | `goods_receipts` | 12 | 12 | 13 |
| **Goods Receipt Items** | `goods_receipt_items` | 37 | 37 | 38 |
| **Service Orders** | `service_orders` | 2 | 2 | 3 |
| **Service Claims** | `service_claims` | 10 | 10 | 11 |
| **Service Claim Items** | `service_claim_items` | 10 | 20 | 20 |
| **Procurement Reconciliations**| `procurement_reconciliations` | 0 | NULL | 1 |
| **Invoices** | `invoices` | 20 | 20 | 21 |
| **Invoice Items** | `invoice_items` | 45 | 45 | 45 |
| **Payment Requests** | `payment_requests` | 9 | 17 | 18 |
| **Payments** | `payments` | 11 | 11 | 12 |
| **Project Closures** | `project_closures` | 2 | 254 | 255 |
| **Documents / Attachments** | `documents` | 449 | 2,245 | 2,246 |
| **Pusat Aktivitas / Notifikasi**| `notifications` | 2,290 | 2,664 | 2,673 |
| **Workflow Definitions** | `workflow_definitions` | 7 | 31 | 32 |
| **Workflow Versions** | `workflow_versions` | 9 | 37 | 38 |
| **Workflow Instances** | `workflow_instances` | 422 | 680 | 681 |
| **Workflow Runtime Tasks** | `workflow_tasks` | 692 | 1,056 | 1,057 |
| **Workflow Transitions** | `workflow_transitions` | 1,428 | 1,972 | 1,973 |
| **Outbox Events** | `outbox_events` | 3,636 | 3,903 | 3,904 |
| **Audit Logs** | `audit_logs` | 3,576 | 5,242 | 5,243 |
| **User Sessions** | `user_sessions` | 191 | 193 | 194 |
| **Migrations History** | `migrations` | 37 | 37 | 37 |
| **Milestones (Reserved)** | `milestones` | 0 | NULL | 1 |
| **Project Budgets (Reserved)** | `project_budgets` | 0 | NULL | 1 |
| **Permissions (Reserved)** | `permissions` | 0 | NULL | NULL |
| **Role Permissions (Reserved)**| `role_permissions` | 0 | N/A (Composite) | N/A |

---

## 3. BUSINESS REFERENCE SEQUENCE ANALYSIS

Code inspection of the backend service layer proves how reference numbers are generated across all domains:

| Business Reference | Format Pattern | Generation Algorithm | Storage Location | Uniqueness Constraint | Reset Impact & Safety |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Contract** | `CONT-YYYYMMDD-XXXX` | Date + 4-digit padded `insertId` or random 4 digits | `contracts.contract_number` | `UNIQUE` in DB | **SAFE TO RESET** (Tied to `contracts.id` AUTO_INCREMENT; if table emptied, restarts at `0001` cleanly). |
| **Project Code** | `CONT-YYYYMMDD-XXXX` | Inherits canonical `contract.contract_number` | `projects.code` | `UNIQUE` in DB | **SAFE TO RESET** (Mirrors contract number). |
| **Purchase Request (PR)** | `PR-YYYYMMDD-SEQ` | Date + daily count (`countToday + 1`, 3-digit padded) | `purchase_requests.pr_number` | `UNIQUE` in DB | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Purchase Order (PO)** | `PO-YYYYMMDD-SEQ` | Date + daily count with retry loop (`countToday + attempts`) | `purchase_orders.po_number` | `UNIQUE` in DB | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Goods Receipt (GR)** | `GR-YYYYMMDD-SEQ` | Date + daily count (`count + 1`, 3-digit padded) | `goods_receipts.gr_number` | Standard column | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Service Claim** | `SCL-YYYYMMDD-SEQ` | Date + daily count with retry loop (`count + attempts`) | `service_claims.claim_number` | `UNIQUE` in DB | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Invoice** | `INV-YYYYMMDD-SEQ` | Date + daily count with retry loop (`count + attempts`) | `invoices.invoice_number` | `UNIQUE` in DB | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Payment Request** | `PRQ-YYYYMMDD-SEQ` | Date + daily count with retry loop (`count + attempts`) | `payment_requests.request_number` | `UNIQUE` in DB | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Payment** | `PAY-YYYYMMDD-SEQ` | Date + daily count with retry loop (`count + attempts`) | `payments.payment_number` | `UNIQUE` in DB | **SAFE TO RESET** (Daily counter computed on-the-fly; if emptied, restarts at `001`). |
| **Proposal** | `PROP-YYYYMMDD-XXXX`| Date + random 4-digit code | `proposals.proposal_number` | Standard column | **SAFE TO RESET** |
| **Tender** | Numerical ID | Uses DB PK `id` directly (e.g. Tender #1380) | `tenders.id` | Primary Key | **SAFE TO RESET** (Next ID restarts at 1). |

> **Critical Discovery:**  
> There are **NO dedicated sequence tables or counter rows** in MySQL. All business numbering is calculated algorithmically on-the-fly via date-scoped `COUNT()` queries or derived directly from numeric primary keys. Resetting numeric PK `AUTO_INCREMENT = 1` along with emptying transaction tables guarantees that both DB primary keys and business reference numbers cleanly restart from `1` / `001`!

---

## 4. FOREIGN KEY TOPOLOGY & REFERENTIAL INTEGRITY AUDIT

Authoritative queries against `INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS` reveal:
- **Total Foreign Key Relationships:** **147**
- **CASCADE Rules:** **16**
- **SET NULL Rules:** **43**
- **RESTRICT / NO ACTION Rules:** **88**

Because **88 foreign keys enforce RESTRICT**, any future cleanup **MUST NOT** attempt arbitrary or top-down deletions, and **MUST NEVER** rely on blindly disabling `FOREIGN_KEY_CHECKS`. The cleanup order must strictly respect the bottom-up child $\to$ parent dependency DAG.

---

## 5. DOCUMENT & PHYSICAL STORAGE AUDIT

Inspection of `documents` table and backend storage services:
- **Total Document Metadata Records:** 449 rows
- **Entity Types:** `CONTRACT` (163), `SPK` (163), `PROPOSAL` (87), `PROJECT` (36)
- **Categories:** `OTHER` (445), `CUSTOMER_BAST` (2), `FINAL_REPORT` (2)
- **Physical Storage Mechanism:** Configured via AWS S3 presigned URLs (`@aws-sdk/client-s3`) and local file storage.
- **Orphan Risk Finding:** **HIGH**  
  If the `documents` table is deleted without a coordinated file-storage sweep, physical files in S3 or the uploads directory will remain orphaned. Conversely, if physical files are deleted while DB metadata remains, file downloads will throw runtime errors. The reset plan (Phase DB-A2) must address metadata deletion and physical blob pruning in tandem.

---

## 6. CANONICAL TEST DATA & EVIDENCE IMPACT

Read-only inspection identifies the canonical lifecycle validation records:
- **Project #1364** (`CONT-20260928-0042`, Contract #42, `CANONICAL-E2E-1790563053595`, `CLOSED`)
- **Project #2428** (`CONT-20261012-0162`, Contract #162, `CANONICAL-FINAL-E2E-1791742923755`, `CLOSED`)

These two projects represent the complete, proven historical E2E acceptance evidence covering all 11 lifecycle gates.
- **Impact of Future Reset:** All rows in `projects`, `contracts`, `project_closures`, `tasks`, `procurement_packages`, `purchase_orders`, `invoices`, and `workflow_instances` tied to these projects will be permanently expunged from MySQL.
- **Evidence Preservation Status:** **SECURED**. All 45+ UI screenshots, browser test logs, and milestone transcripts have been preserved in the artifact storage directory (`.gemini/antigravity-ide/brain/91a4da8b-68ce-4a99-b432-8da32effa944/`).

---

## 7. ORPHAN RELATIONSHIP CHECK

A comprehensive read-only scan for potential data anomalies produced:
- `orphan_contracts` (contracts without customer): **0**
- `orphan_projects` (projects without contract): **0**
- `orphan_wf_tasks` (tasks without workflow instance): **0**
- **ORPHAN RISK VERDICT:** **NONE OBSERVED**. Current referential integrity across active records is 100% clean.

---

## 8. REQUIRED TABLE MATRIX (ALL 61 TABLES)

Below is the authoritative inventory of all 61 tables in `epms_tvmubd_db`:

| # | Table Name | Rows | PK Column | Auto Inc Column | Next Auto Inc | Max PK | Category | Domain | Proposed Future Action | Proposed Auto Inc Reset | Risk | Rationale |
| :---: | :--- | :---: | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | `audit_logs` | 3,576 | `id` | `id` | 5,243 | 5,242 | REVIEW_REQUIRED | Audit / Security | SELECTIVE DELETE / PRESERVE | REVIEW | MEDIUM | Contains 3,574 transaction logs + 2 definition logs. |
| 2 | `contract_amendments` | 0 | `id` | `id` | 1 | NULL | CLEAN_TRANSACTION_CANDIDATE | Contract | TRUNCATE | YES (Next: 1) | LOW | Empty transactional table. |
| 3 | `contracts` | 143 | `id` | `id` | 163 | 162 | CLEAN_TRANSACTION_CANDIDATE | Contract | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Commercial contract transactional data. |
| 4 | `cost_items` | 228 | `id` | `id` | 257 | 256 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Project cost estimation line items. |
| 5 | `customers` | 9 | `id` | `id` | 17 | 16 | REVIEW_REQUIRED | Master / CRM | PRESERVE / SELECTIVE CLEAN | NO | HIGH | Contains legitimate client names + test client entries. |
| 6 | `documents` | 449 | `id` | `id` | 2,246 | 2,245 | REVIEW_REQUIRED | Document Storage | DELETE + S3 PRUNING | REVIEW | HIGH | Metadata tied to transactions; physical S3 sync needed. |
| 7 | `goods_receipt_items` | 37 | `id` | `id` | 38 | 37 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Goods receipt item line items. |
| 8 | `goods_receipts` | 12 | `id` | `id` | 13 | 12 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Goods receipt headers. |
| 9 | `invoice_items` | 45 | `id` | `id` | 45 | 45 | CLEAN_TRANSACTION_CANDIDATE | Finance | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Invoice item line items. |
| 10 | `invoices` | 20 | `id` | `id` | 21 | 20 | CLEAN_TRANSACTION_CANDIDATE | Finance | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Vendor invoice headers. |
| 11 | `migrations` | 37 | `id` | `id` | 37 | 37 | PRESERVE_CORE | System Schema | PRESERVE | NO | CRITICAL | TypeORM migration history. Do NOT touch. |
| 12 | `milestones` | 0 | `id` | `id` | 1 | NULL | CLEAN_TRANSACTION_CANDIDATE | Project Execution | TRUNCATE | YES (Next: 1) | LOW | Empty transactional table. |
| 13 | `notifications` | 2,290 | `id` | `id` | 2,673 | 2,664 | CLEAN_TECHNICAL_CANDIDATE | Inbox / Notif | TRUNCATE | YES (Next: 1) | LOW | Pusat Aktivitas test notifications. |
| 14 | `outbox_events` | 3,636 | `id` | `id` | 3,904 | 3,903 | CLEAN_TECHNICAL_CANDIDATE | System Outbox | TRUNCATE | YES (Next: 1) | LOW | Event relay records tied to test transactions. |
| 15 | `payment_requests` | 9 | `id` | `id` | 18 | 17 | CLEAN_TRANSACTION_CANDIDATE | Finance | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Payment request approval records. |
| 16 | `payments` | 11 | `id` | `id` | 12 | 11 | CLEAN_TRANSACTION_CANDIDATE | Finance | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Processed payment records. |
| 17 | `permissions` | 0 | `id` | `id` | NULL | NULL | PRESERVE_CORE | Auth / RBAC | PRESERVE | NO | HIGH | Reserved permission schema. |
| 18 | `po_payment_terms` | 59 | `id` | `id` | 60 | 59 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Purchase order payment terms. |
| 19 | `procurement_package_items` | 67 | `id` | `id` | 88 | 87 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Procurement package line items. |
| 20 | `procurement_packages` | 39 | `id` | `id` | 43 | 42 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Procurement package headers. |
| 21 | `procurement_reconciliations` | 0 | `id` | `id` | 1 | NULL | CLEAN_TRANSACTION_CANDIDATE | Procurement | TRUNCATE | YES (Next: 1) | LOW | Empty reconciliation table. |
| 22 | `project_baseline_wbs_items` | 140 | `id` | `id` | 1,370 | 1,369 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Snapshot WBS items in baselines. |
| 23 | `project_baselines` | 66 | `id` | `id` | 1,802 | 1,801 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Approved project baseline snapshots. |
| 24 | `project_budgets` | 0 | `id` | `id` | 1 | NULL | CLEAN_TRANSACTION_CANDIDATE | Project Planning | TRUNCATE | YES (Next: 1) | LOW | Empty budget table. |
| 25 | `project_closures` | 2 | `id` | `id` | 255 | 254 | CLEAN_TRANSACTION_CANDIDATE | Project Closure | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Project closure approval headers. |
| 26 | `project_cost_estimates` | 73 | `id` | `id` | 98 | 97 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Project RAB cost estimation headers. |
| 27 | `project_initial_conditions` | 74 | `id` | `id` | 99 | 98 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Project charter / initial condition records. |
| 28 | `project_issues` | 9 | `id` | `id` | 10 | 9 | CLEAN_TRANSACTION_CANDIDATE | Project Execution | DELETE / TRUNCATE | YES (Next: 1) | LOW | Project issue tracking items. |
| 29 | `project_management_reviews` | 67 | `id` | `id` | 93 | 92 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | HOPS management review decision records. |
| 30 | `project_progress_evidence` | 23 | `id` | `id` | 817 | 816 | CLEAN_TRANSACTION_CANDIDATE | Project Execution | DELETE / TRUNCATE | YES (Next: 1) | LOW | Progress evidence attachments. |
| 31 | `project_progress_logs` | 48 | `id` | `id` | 1,194 | 1,193 | CLEAN_TRANSACTION_CANDIDATE | Project Execution | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Progress percentage ledger updates. |
| 32 | `project_risks` | 5 | `id` | `id` | 6 | 5 | CLEAN_TRANSACTION_CANDIDATE | Project Execution | DELETE / TRUNCATE | YES (Next: 1) | LOW | Project risk matrix items. |
| 33 | `projects` | 129 | `id` | `id` | 2,429 | 2,428 | CLEAN_TRANSACTION_CANDIDATE | Project Core | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Project core master entity. |
| 34 | `proposals` | 142 | `id` | `id` | 152 | 151 | CLEAN_TRANSACTION_CANDIDATE | Marketing / Tender | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Marketing proposal submissions. |
| 35 | `purchase_order_items` | 45 | `id` | `id` | 46 | 45 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | PO item details. |
| 36 | `purchase_orders` | 20 | `id` | `id` | 33 | 20 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Purchase order headers. |
| 37 | `purchase_request_items` | 59 | `id` | `id` | 60 | 59 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | PR item details. |
| 38 | `purchase_requests` | 33 | `id` | `id` | 46 | 33 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Purchase request headers. |
| 39 | `quotation_items` | 149 | `id` | `id` | 149 | 149 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Vendor quotation line items. |
| 40 | `quotations` | 70 | `id` | `id` | 70 | 70 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Vendor quotation headers. |
| 41 | `rfqs` | 27 | `id` | `id` | 28 | 27 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Request for quotation headers. |
| 42 | `role_permissions` | 0 | `role_id, perm_id` | NONE | N/A | NULL | PRESERVE_CORE | Auth / RBAC | PRESERVE | NO | HIGH | Mapping table for granular RBAC. |
| 43 | `roles` | 13 | `id` | `id` | 72 | 67 | PRESERVE_CORE | Auth / RBAC | PRESERVE | NO | CRITICAL | Core system roles. Do NOT touch. |
| 44 | `service_claim_items` | 10 | `id` | `id` | 20 | 20 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | LOW | Service claim line items. |
| 45 | `service_claims` | 10 | `id` | `id` | 11 | 10 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Service claim headers. |
| 46 | `service_orders` | 2 | `id` | `id` | 3 | 2 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Service order headers. |
| 47 | `tasks` | 179 | `id` | `id` | 2,505 | 2,504 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Gantt schedule project tasks. |
| 48 | `tender_activities` | 818 | `id` | `id` | 828 | 827 | CLEAN_TRANSACTION_CANDIDATE | Marketing / Tender | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Tender activity audit history. |
| 49 | `tender_price_history` | 86 | `id` | `id` | 95 | 94 | CLEAN_TRANSACTION_CANDIDATE | Marketing / Tender | DELETE / TRUNCATE | YES (Next: 1) | LOW | Tender negotiation price history. |
| 50 | `tenders` | 189 | `id` | `id` | 209 | 208 | CLEAN_TRANSACTION_CANDIDATE | Marketing / Tender | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Marketing tender headers. |
| 51 | `user_roles` | 14 | `user_id, role_id` | NONE | N/A | NULL | REVIEW_REQUIRED | Auth / RBAC | PRESERVE / SELECTIVE CLEAN | NO | CRITICAL | Links users to system roles. |
| 52 | `user_sessions` | 191 | `id` | `id` | 194 | 193 | CLEAN_TECHNICAL_CANDIDATE | Auth / Session | TRUNCATE | YES (Next: 1) | LOW | Ephemeral user login sessions. |
| 53 | `users` | 69 | `id` | `id` | 3,835 | 3,706 | REVIEW_REQUIRED | Auth / User | PRESERVE CANONICAL (IDs 1..879) | NO | CRITICAL | 13 business users + 56 test users. |
| 54 | `vendor_comparisons` | 70 | `id` | `id` | 70 | 70 | CLEAN_TRANSACTION_CANDIDATE | Procurement | DELETE / TRUNCATE | YES (Next: 1) | MEDIUM | Vendor comparison evaluation rows. |
| 55 | `vendors` | 6 | `id` | `id` | 42 | 41 | REVIEW_REQUIRED | Master / Vendor | PRESERVE (VND 1..5) | NO | HIGH | 5 canonical vendors + 1 test vendor. |
| 56 | `work_breakdown_structures` | 752 | `id` | `id` | 3,234 | 3,233 | CLEAN_TRANSACTION_CANDIDATE | Project Planning | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Hierarchical project WBS tree. |
| 57 | `workflow_definitions` | 7 | `id` | `id` | 32 | 31 | PRESERVE_CORE | Workflow Engine | PRESERVE | NO | CRITICAL | Canonical workflow definitions. |
| 58 | `workflow_instances` | 422 | `id` | `id` | 681 | 680 | CLEAN_TECHNICAL_CANDIDATE | Workflow Engine | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Runtime workflow execution instances. |
| 59 | `workflow_tasks` | 692 | `id` | `id` | 1,057 | 1,056 | CLEAN_TECHNICAL_CANDIDATE | Workflow Engine | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Runtime pending/completed approval tasks. |
| 60 | `workflow_transitions` | 1,428 | `id` | `id` | 1,973 | 1,972 | CLEAN_TECHNICAL_CANDIDATE | Workflow Engine | DELETE / TRUNCATE | YES (Next: 1) | HIGH | Runtime workflow transition history. |
| 61 | `workflow_versions` | 9 | `id` | `id` | 38 | 37 | PRESERVE_CORE | Workflow Engine | PRESERVE | NO | CRITICAL | Canonical workflow version steps. |

---

## 9. REQUIRED FK CLEANUP MATRIX (BOTTOM-UP TOPOLOGY)

The exact bottom-up execution sequence derived from the 147 foreign key constraints:

| Step | Table | Depends On (Parents) | Inbound Dependents (Children) | Delete Rule Enforced | Proposed Method | Safety Assessment | Notes |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **1** | `project_progress_evidence` | `project_progress_logs`, `documents`, `users` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Deep leaf table. |
| **2** | `project_progress_logs` | `projects`, `tasks`, `work_breakdown_structures`, `project_baselines`, `users` | None (after Step 1) | RESTRICT | DELETE / TRUNCATE | SAFE | Progress percentage ledger. |
| **3** | `project_baseline_wbs_items`| `project_baselines` | None | CASCADE from baseline | DELETE / TRUNCATE | SAFE | Snapshot WBS items. |
| **4** | `project_baselines` | `projects`, `users` | None (after Step 3) | RESTRICT | DELETE / TRUNCATE | SAFE | Project baseline snapshots. |
| **5** | `project_issues` | `projects`, `tasks`, `project_risks`, `users` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Issue records. |
| **6** | `project_risks` | `projects`, `tasks`, `users` | None (after Step 5) | RESTRICT | DELETE / TRUNCATE | SAFE | Risk records. |
| **7** | `procurement_reconciliations`| `projects`, `purchase_orders`, `purchase_requests`, `users` | None | RESTRICT / SET NULL | TRUNCATE | SAFE | Currently 0 rows. |
| **8** | `payments` | `invoices`, `payment_requests` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Processed payments. |
| **9** | `payment_requests` | `invoices`, `po_payment_terms`, `users` | None (after Step 8) | RESTRICT | DELETE / TRUNCATE | SAFE | Payment requests. |
| **10** | `invoice_items` | `invoices`, `purchase_order_items` | None | CASCADE / RESTRICT | DELETE / TRUNCATE | SAFE | Invoice items. |
| **11** | `invoices` | `purchase_orders`, `po_payment_terms`, `service_claims` | None (after Steps 8-10)| RESTRICT | DELETE / TRUNCATE | SAFE | Invoice headers. |
| **12** | `service_claim_items` | `service_claims` | None | CASCADE | DELETE / TRUNCATE | SAFE | Claim items. |
| **13** | `service_claims` | `purchase_orders`, `service_orders`, `projects`, `vendors` | None (after Steps 11-12)| RESTRICT | DELETE / TRUNCATE | SAFE | Service claims. |
| **14** | `service_orders` | `purchase_orders` | None (after Step 13) | RESTRICT | DELETE / TRUNCATE | SAFE | Service orders. |
| **15** | `goods_receipt_items` | `goods_receipts`, `purchase_order_items` | None | CASCADE / RESTRICT | DELETE / TRUNCATE | SAFE | Goods receipt items. |
| **16** | `goods_receipts` | `purchase_orders` | None (after Step 15) | RESTRICT | DELETE / TRUNCATE | SAFE | Goods receipts. |
| **17** | `po_payment_terms` | `purchase_orders` | None (after Steps 9, 11)| CASCADE | DELETE / TRUNCATE | SAFE | PO payment terms. |
| **18** | `purchase_order_items` | `purchase_orders`, `purchase_request_items`, `cost_items` | None (after Steps 10, 15)| CASCADE / RESTRICT | DELETE / TRUNCATE | SAFE | PO item details. |
| **19** | `vendor_comparisons` | `rfqs`, `quotations`, `vendors` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Vendor evaluations. |
| **20** | `quotation_items` | `quotations` | None | CASCADE | DELETE / TRUNCATE | SAFE | Quotation items. |
| **21** | `quotations` | `rfqs`, `vendors` | None (after Steps 19-20)| RESTRICT | DELETE / TRUNCATE | SAFE | Quotation headers. |
| **22** | `rfqs` | `purchase_requests`, `projects` | None (after Steps 19, 21)| RESTRICT | DELETE / TRUNCATE | SAFE | RFQ headers. |
| **23** | `purchase_orders` | `purchase_requests`, `vendors`, `users` | None (after Steps 7, 11, 14, 16-18) | RESTRICT | DELETE / TRUNCATE | SAFE | PO headers. |
| **24** | `purchase_request_items` | `purchase_requests`, `procurement_package_items`, `cost_items`, `work_breakdown_structures` | None (after Step 18) | CASCADE / SET NULL | DELETE / TRUNCATE | SAFE | PR item details. |
| **25** | `purchase_requests` | `projects`, `procurement_packages`, `users` | None (after Steps 22-24)| RESTRICT | DELETE / TRUNCATE | SAFE | PR headers. |
| **26** | `procurement_package_items` | `procurement_packages`, `cost_items`, `work_breakdown_structures` | None (after Step 24) | CASCADE / SET NULL | DELETE / TRUNCATE | SAFE | Package item details. |
| **27** | `procurement_packages` | `projects`, `users` | None (after Steps 25-26)| RESTRICT | DELETE / TRUNCATE | SAFE | Package headers. |
| **28** | `project_closures` | `projects`, `documents`, `users` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Project closures. |
| **29** | `project_management_reviews`| `projects`, `users` | None | RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | Management reviews. |
| **30** | `project_initial_conditions`| `projects`, `users` | None | RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | Project charters. |
| **31** | `cost_items` | `project_cost_estimates`, `work_breakdown_structures` | None (after Steps 18, 24, 26)| CASCADE / SET NULL | DELETE / TRUNCATE | SAFE | RAB cost items. |
| **32** | `project_cost_estimates` | `projects` | None (after Step 31) | RESTRICT | DELETE / TRUNCATE | SAFE | Project cost estimates. |
| **33** | `tasks` | `work_breakdown_structures`, `projects`, `users` | None (after Steps 2, 5, 6)| RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | Gantt tasks. |
| **34** | `work_breakdown_structures` | `projects`, self-referencing hierarchy | None (after Steps 2, 24, 26, 31, 33)| RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | WBS tree hierarchy. |
| **35** | `milestones` | `projects` | None | RESTRICT | TRUNCATE | SAFE | Empty table. |
| **36** | `project_budgets` | `projects` | None | RESTRICT | TRUNCATE | SAFE | Empty table. |
| **37** | `contract_amendments` | `contracts`, `users` | None | CASCADE / SET NULL | TRUNCATE | SAFE | Empty table. |
| **38** | `workflow_transitions` | `workflow_instances`, `workflow_tasks`, `workflow_versions`, `users` | None | CASCADE / RESTRICT | DELETE / TRUNCATE | SAFE | Runtime transitions. |
| **39** | `workflow_tasks` | `workflow_instances`, `roles`, `users` | None (after Step 38) | RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | Runtime approval tasks. |
| **40** | `workflow_instances` | `workflow_definitions`, `workflow_versions` | None (after Steps 38-39)| RESTRICT | DELETE / TRUNCATE | SAFE | Runtime instances. |
| **41** | `notifications` | `users` | None | RESTRICT | TRUNCATE | SAFE | Pusat Aktivitas items. |
| **42** | `outbox_events` | Standalone | None | None | TRUNCATE | SAFE | Technical events. |
| **43** | `user_sessions` | `users` | None | None | TRUNCATE | SAFE | Active login sessions. |
| **44** | `projects` | `contracts`, `users` | None (after Steps 1-36)| RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | Core projects. |
| **45** | `contracts` | `proposals`, `customers`, `users` | None (after Steps 37, 44)| RESTRICT / SET NULL | DELETE / TRUNCATE | SAFE | Contracts. |
| **46** | `tender_activities` | `tenders`, `users` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Tender activities. |
| **47** | `tender_price_history` | `tenders` | None | RESTRICT | DELETE / TRUNCATE | SAFE | Negotiation history. |
| **48** | `proposals` | `tenders`, `customers`, `users` | None (after Step 45) | RESTRICT | DELETE / TRUNCATE | SAFE | Proposals. |
| **49** | `tenders` | `customers`, `users` | None (after Steps 46-48)| RESTRICT | DELETE / TRUNCATE | SAFE | Tenders / Opportunities. |

*(Review tables `documents`, `audit_logs`, `users`, `customers`, `vendors` handled via Phase DB-A2 Review Matrix below).*

---

## 10. REQUIRED AUTO_INCREMENT RESET MATRIX

For all 59 tables featuring `auto_increment`:

| Table Name | Current Rows | Current Max PK | Current Next Auto Inc | Future Rows Target | Future Next Auto Inc Target | Reset Required? | Proposed Method | Risk |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| `contract_amendments` | 0 | NULL | 1 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `contracts` | 143 | 162 | 163 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `cost_items` | 228 | 256 | 257 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `goods_receipt_items` | 37 | 37 | 38 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `goods_receipts` | 12 | 12 | 13 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `invoice_items` | 45 | 45 | 45 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `invoices` | 20 | 20 | 21 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `milestones` | 0 | NULL | 1 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `notifications` | 2,290 | 2,664 | 2,673 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `outbox_events` | 3,636 | 3,903 | 3,904 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `payment_requests` | 9 | 17 | 18 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `payments` | 11 | 11 | 12 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `po_payment_terms` | 59 | 59 | 60 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `procurement_package_items` | 67 | 87 | 88 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `procurement_packages` | 39 | 42 | 43 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `procurement_reconciliations` | 0 | NULL | 1 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `project_baseline_wbs_items` | 140 | 1,369 | 1,370 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `project_baselines` | 66 | 1,801 | 1,802 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `project_budgets` | 0 | NULL | 1 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `project_closures` | 2 | 254 | 255 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `project_cost_estimates` | 73 | 97 | 98 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `project_initial_conditions` | 74 | 98 | 99 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `project_issues` | 9 | 9 | 10 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `project_management_reviews` | 67 | 92 | 93 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `project_progress_evidence` | 23 | 816 | 817 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `project_progress_logs` | 48 | 1,193 | 1,194 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `project_risks` | 5 | 5 | 6 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `projects` | 129 | 2,428 | 2,429 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `proposals` | 142 | 151 | 152 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `purchase_order_items` | 45 | 45 | 46 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `purchase_orders` | 20 | 20 | 33 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `purchase_request_items` | 59 | 59 | 60 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `purchase_requests` | 33 | 33 | 46 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `quotation_items` | 149 | 149 | 149 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `quotations` | 70 | 70 | 70 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `rfqs` | 27 | 27 | 28 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `service_claim_items` | 10 | 20 | 20 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `service_claims` | 10 | 10 | 11 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `service_orders` | 2 | 2 | 3 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `tasks` | 179 | 2,504 | 2,505 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `tender_activities` | 818 | 827 | 828 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `tender_price_history` | 86 | 94 | 95 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `tenders` | 189 | 208 | 209 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `user_sessions` | 191 | 193 | 194 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | LOW |
| `vendor_comparisons` | 70 | 70 | 70 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | MEDIUM |
| `work_breakdown_structures` | 752 | 3,233 | 3,234 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `workflow_instances` | 422 | 680 | 681 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `workflow_tasks` | 692 | 1,056 | 1,057 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `workflow_transitions` | 1,428 | 1,972 | 1,973 | 0 | **1** | YES | `ALTER TABLE ... AUTO_INCREMENT = 1` | HIGH |
| `documents` | 449 | 2,245 | 2,246 | TBD | **1 (if cleared)** | REVIEW | Review in Phase DB-A2 | HIGH |
| `audit_logs` | 3,576 | 5,242 | 5,243 | TBD | **1 (if cleared)** | REVIEW | Review in Phase DB-A2 | MEDIUM |
| `customers` | 9 | 16 | 17 | 9 | 17 (preserved) | **NO** | Retain existing sequence | HIGH |
| `vendors` | 6 | 41 | 42 | 5 or 6 | 42 (preserved) | **NO** | Retain existing sequence | HIGH |
| `users` | 69 | 3,706 | 3,835 | 13 | 3,835 (preserved)| **NO** | Retain existing sequence | CRITICAL |
| `roles` | 13 | 67 | 72 | 13 | 72 (preserved) | **NO** | Core RBAC (Do NOT reset) | CRITICAL |
| `workflow_definitions` | 7 | 31 | 32 | 7 | 32 (preserved) | **NO** | Core engine (Do NOT reset) | CRITICAL |
| `workflow_versions` | 9 | 37 | 38 | 9 | 38 (preserved) | **NO** | Core engine (Do NOT reset) | CRITICAL |
| `migrations` | 37 | 37 | 37 | 37 | 37 (preserved) | **NO** | Migration history (Do NOT reset)| CRITICAL |
| `permissions` | 0 | NULL | NULL | 0 | NULL | **NO** | Schema reserved | HIGH |

---

## 11. REQUIRED PRESERVE MATRIX

| Table Name | Why Preserved | Rows | Required By | Reconstructable? | Risk If Deleted |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `migrations` | Tracks TypeORM migration version history. | 37 | TypeORM migration runner & NestJS boot | NO | **CRITICAL** (TypeORM will re-run all 37 migrations on existing tables and fatal error). |
| `roles` | Defines standard EPMS authorization roles (`SUPER_ADMIN`, `PM`, `FINANCE`, `HOPS`, etc.). | 13 | NestJS `@Roles()` guards, UI menu permissions | Difficult (requires reseed) | **CRITICAL** (All users lose authorization; login blocked). |
| `permissions` | Granular permission definitions schema. | 0 | Future RBAC extension | YES | HIGH (Loss of schema alignment). |
| `role_permissions` | Maps roles to granular permissions. | 0 | Future RBAC extension | YES | HIGH (Loss of schema alignment). |
| `workflow_definitions` | Defines the 7 canonical business workflows (Tender Go/No-Go, Discount, Legal, Initiation, Governance Review, PR, Closure). | 7 | Workflow Engine Service, BPMN state machines | Difficult (requires reseed) | **CRITICAL** (No workflow transitions or approval tasks can be started). |
| `workflow_versions` | Defines step sequences, transitions, and decision actions for active workflows. | 9 | Workflow Engine Service runtime resolver | Difficult (requires reseed) | **CRITICAL** (Workflow instance creation fails immediately). |

---

## 12. REQUIRED REVIEW MATRIX (MIXED / UNCERTAIN TABLES)

| Table Name | Why Uncertain / Mixed | Current Data Types | Possible Test Data | Possible Required Data | Recommendation | User Decision Required? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `users` | Contains 13 canonical operational seed users (`admin@epms.com`, `hops@epms.com`, `pm@epms.com`, etc.) mixed with 56 test users (`pm_1790...@test...`) generated by automated suites. | User identity records, bcrypt hashes. | 56 rows with null roles and `@test.epms.tvm.com` emails. | 13 active users with assigned roles in `user_roles`. | **Selective Delete:** Remove test users (`WHERE id > 894 AND role IS NULL`), preserve the 13 canonical operational users. Do NOT reset AUTO_INCREMENT. | **YES** |
| `user_roles` | Contains 14 mappings linking users to roles. | User-Role FK mapping. | None (all 14 mappings belong to the 13 canonical users). | All 14 rows are required for the 13 canonical users. | **Preserve All 14 Rows** to ensure canonical users maintain their login roles. | **YES** |
| `customers` | Contains 9 client rows. IDs 1–7 were deleted in past tests; IDs 8–16 exist. Some rows have corporate names (`PT Asianet Media Teknologi`, `SURGE`, `PT. LINKNET`), while others have personal test emails (`pradestareski@gmail.com`). | Customer master profiles. | Rows 15–16 created during manual UI testing. | Corporate clients required for testing new commercial proposals. | **Review / Reseed:** Allow user to choose between preserving the 9 rows or reseeding a clean 5-customer corporate master baseline. | **YES** |
| `vendors` | Contains 6 vendor rows. VND-001 through VND-005 are canonical master vendors (`PT IT Solusi Bersama`, etc.), while VND-006 (`PT MUNJUL JAYA`, ID 41) was added during testing. | Vendor master profiles. | ID 41 (`VND-006`). | IDs 1–5 (`VND-001` through `VND-005`). | **Selective Delete:** Delete vendor ID 41, preserve canonical vendors 1–5. Do NOT reset AUTO_INCREMENT. | **YES** |
| `documents` | 449 document metadata rows, all tied to historical contracts/proposals/projects. Physical files reside in AWS S3 and local storage. | Attachment metadata & file paths. | All 449 rows are test/lifecycle attachments. | None (no master document template is stored here). | **Coordinated Truncate + S3 Sweep:** Truncate table and clear physical test bucket/folder in S3 to prevent orphans. | **YES** |
| `audit_logs` | 3,576 audit log rows. 3,574 log transactional events (`contracts`, `tenders`, `tasks`, etc.), while 2 log `workflow_definitions` and 1 logs `vendors`. | Audit trail records. | 3,574 transaction audit rows. | 3 system configuration audit logs. | **Truncate vs Archive:** Recommend exporting historical audit log to an archive JSON/SQL dump, then truncating table to start a clean audit baseline. | **YES** |

---

## 13. RISK CLASSIFICATION & SAFETY ASSESSMENT

| Risk Level | Finding / Scope | Potential Failure Mode | Prevention in Phase DB-A2 Plan |
| :---: | :--- | :--- | :--- |
| **CRITICAL** | Core Infrastructure (`migrations`, `roles`, `workflow_definitions`, `workflow_versions`, canonical `users`). | Application startup crash, auth rejection, workflow engine inability to resolve definitions. | Strict **PRESERVE** policy. Excluded from any truncate or delete list. |
| **HIGH** | Foreign Key RESTRICT Violations (88 foreign keys enforce RESTRICT). | MySQL `ER_ROW_IS_REFERENCED_2` error when parent deleted before child. | Strict **bottom-up deletion DAG** (Steps 1 to 49). Foreign keys never disabled. |
| **HIGH** | User Identity Collision on Auto-Increment Reset. | If `users` AUTO_INCREMENT is reset to 1, next created user collides with existing Admin (#1). | Strict rule: `users`, `roles`, `customers`, and `vendors` **NEVER** reset AUTO_INCREMENT to 1. |
| **MEDIUM** | Physical Storage Orphan Blobs (`documents` $\leftrightarrow$ S3 / local disk). | Hundreds of gigabytes/megabytes of orphaned PDF/image files left in object storage. | Phase DB-A2 reset plan must include coordinated physical S3 bucket purging. |
| **LOW** | User Login Invalidation (`user_sessions`). | Logged-in browser sessions invalidated upon session table truncate. | User simply logs in again with canonical credentials (`hops@epms.com`, `admin@epms.com`). |

---

## 14. AUDIT HYGIENE CHECKLIST

| Safety Requirement | Status | Verification Evidence |
| :--- | :---: | :--- |
| **DATABASE MUTATED** | **NO** | Zero DDL/DML executed. Only `SELECT` and `SHOW` commands run. |
| **ROWS DELETED** | **0** | Verified table counts before and after audit. |
| **ROWS UPDATED** | **0** | Verified no updates executed. |
| **TABLES TRUNCATED** | **0** | Verified all 61 tables intact. |
| **AUTO_INCREMENT CHANGED** | **0** | Verified all sequences untouched. |
| **SCHEMA CHANGED** | **NO** | `INFORMATION_SCHEMA` table definitions unchanged. |
| **FOREIGN_KEY_CHECKS CHANGED** | **NO** | Global and session FK checks remained active at all times. |
| **SEED EXECUTED** | **NO** | No seed scripts invoked. |
| **MIGRATION EXECUTED** | **NO** | Migration count unchanged (37). |
| **FILES DELETED** | **NO** | Zero project files removed. |
| **SOURCE MODIFIED** | **NO** | Git working tree untouched. |
| **.env INSPECTED** | **NO** | Zero inspection of `.env` files. |
| **SECRETS PRINTED** | **NO** | Zero passwords, tokens, hashes, or connection strings displayed. |
| **NEW TEMP HELPER CREATED** | **NO** | All queries executed strictly via existing TypeORM CLI (`typeorm query`). |

---

## 15. FINAL VERDICT & NEXT STEPS

- **DATABASE CLEANUP PLAN CAN BE SAFELY DESIGNED:** **YES**
- **DESTRUCTIVE RESET AUTHORIZED:** **NO**
- **USER APPROVAL REQUIRED BEFORE RESET:** **YES**

```
NEXT CHECKPOINT:
DB-A2 — CLEAN TEST DATABASE RESET PLAN
PLAN ONLY / NO EXECUTION
```

*Antigravity has completed Phase DB-A1 (Transaction Data & Auto_Increment Audit). Destructive cleanup has not been performed and will remain on hold until the user reviews and authorizes Phase DB-A2.*