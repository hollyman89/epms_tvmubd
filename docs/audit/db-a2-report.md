# EPMS — CLEAN TEST DATABASE BASELINE
## PHASE DB-A2 — RESET PLAN & PRESERVE MANIFEST

**STATUS:** **READY FOR USER REVIEW**  
**MODE:** PLAN ONLY / READ-ONLY VERIFICATION  
**DATABASE MUTATED:** **NO**  
**DATABASE ENGINE:** MySQL (InnoDB)  
**SERVER VERSION:** `9.7.1`  
**SCHEMA:** `epms_tvmubd_db`  
**TOTAL TABLES:** **61**  

---

### EXECUTIVE SUMMARY

This document defines the complete, reviewable, FK-safe reset plan for the EPMS testing database (`epms_tvmubd_db`).  
In accordance with mandatory safety rules:
- **Zero destructive statements were executed** (no `DELETE`, `TRUNCATE`, `ALTER`, `DROP`, `UPDATE`, `INSERT`).
- **No storage objects were modified or removed** (no AWS S3 or local file deletions).
- **No environment files or secrets were exposed.**
- **`FOREIGN_KEY_CHECKS` was never disabled.**
- **Dev/build mutual exclusion and process management rules were strictly upheld.**

All 61 tables have been audited down to exact row counts, primary key sequences, foreign key DAG topologies, physical document storage mappings, and canonical user identities.

---

### 1. CLEANUP SCOPE & CLASSIFICATION SUMMARY

| Classification | Table Count | Future Target Rows | Target Auto_Increment | Description |
| :--- | :---: | :---: | :---: | :--- |
| **CLEAN_TRANSACTION_CANDIDATE** | **43** | 0 | 1 | Ephemeral commercial, project, procurement, and finance test transactions. |
| **CLEAN_TECHNICAL_CANDIDATE** | **6** | 0 | 1 | Notifications, outbox events, user sessions, and workflow runtime entities. |
| **PRESERVE_CORE** | **6** | Unchanged | Preserved | Platform infrastructure (`migrations`, `roles`, `permissions`, `role_permissions`, `workflow_definitions`, `workflow_versions`). |
| **REVIEW_REQUIRED (MIXED)** | **6** | Selective | Preserved / Master | Master and identity tables requiring exact manifests (`users`, `user_roles`, `customers`, `vendors`, `documents`, `audit_logs`). |
| **TOTAL** | **61** | — | — | **100% of tables accounted for in schema.** |

---

### 2. ABSOLUTE PRESERVE LIST (CORE INFRASTRUCTURE)

These 6 tables must **NEVER** appear in any destructive cleanup statement (`DELETE` or `TRUNCATE`):

| # | Table Name | Current Rows | Expected Rows After Reset | Why Required | FK Dependencies | Risk If Touched |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- |
| 1 | `migrations` | 37 | 37 | Tracks TypeORM migration version history. | Standalone (0 FKs) | **CRITICAL** (TypeORM will re-run migrations against existing schema, crashing startup). |
| 2 | `roles` | 13 | 13 | Authoritative RBAC role definitions (`SUPER_ADMIN`, `PM`, `FINANCE`, `HOPS`, etc.). | Inbound from `user_roles`, `workflow_tasks` | **CRITICAL** (All users lose authorization; login blocked). |
| 3 | `permissions` | 0 | 0 | Reserved permission schema for fine-grained ACL. | Inbound from `role_permissions` | **HIGH** (Loss of schema alignment). |
| 4 | `role_permissions` | 0 | 0 | Reserved mapping table for role-to-permission mapping. | Outbound to `roles`, `permissions` | **HIGH** (Loss of schema alignment). |
| 5 | `workflow_definitions` | 7 | 7 | The 7 canonical business workflows (Tender, Discount, Legal, Initiation, Governance, PR, Closure). | Inbound from `workflow_versions`, `workflow_instances` | **CRITICAL** (Engine cannot instantiate any business lifecycle state machine). |
| 6 | `workflow_versions` | 9 | 9 | Version step graphs, decision transitions, and role assignments. | Inbound from `workflow_instances`, `workflow_transitions` | **CRITICAL** (Workflow instance creation fails immediately). |

---

### 3. USERS — EXACT PRESERVE / DELETE MANIFEST

**Total users currently in DB:** 69  
**Canonical operational users to PRESERVE:** 13  
**Test users proposed for DELETION:** 56  
**AUTO_INCREMENT reset:** **NO** (Preserving current sequence to prevent ID collisions with existing operational users).

#### A. CANONICAL OPERATIONAL USERS (PRESERVE ALLOWLIST — EXACT 13 USERS)

| User ID | Email | Full Name | Assigned Role(s) | Why Preserved |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `admin@epms.com` | System Admin | `SUPER_ADMIN` | Primary system administrator account. |
| **2** | `pm@epms.com` | Project Manager | `PROJECT_MANAGER` | Canonical Project Manager operational persona. |
| **3** | `finance@epms.com` | Finance User | `FINANCE` | Canonical Finance / Invoicing operational persona. |
| **4** | `director@epms.com` | Director | `DIRECTOR` | Canonical Director executive approver persona. |
| **7** | `lukas@epms.com` | Lukas Kurniawan | `MARKETING` | Commercial / Marketing opportunity creator persona. |
| **9** | `ragil@epms.com` | Dwi Ragil Pribadi | `MARKETING` | Commercial / Marketing opportunity creator persona. |
| **10** | `legal@epms.com` | Legal Officer | `LEGAL` | Legal review and contract validation persona. |
| **39** | `superadmin@epms.com` | super admin | `SUPER_ADMIN` | Secondary administrative operational account. |
| **41** | `purchasing@epms.com` | purchasing | `PROCUREMENT` | Canonical Procurement / Buyer operational persona. |
| **52** | `headops@tvmubd.com` | Head of Operations | `HEAD_OF_OPERATIONS` | Head of Operations operational persona. |
| **58** | `hops@epms.com` | Hoa | `GENERAL_MANAGER`, `HEAD_OF_OPERATIONS` | Dual-role executive approver persona (Governance & HOPS review). |
| **769** | `pmo@epms.com` | PMO | `PMO` | Project Management Office operational persona. |
| **879** | `faza@epms.com` | Faza Afina | `PROJECT_MANAGER` | Project Manager operational persona. |

#### B. TEST USERS PROPOSED FOR DELETION (EXACT 56 TEST USERS)

All 56 users have **zero assigned roles in `user_roles`**, were created dynamically during automated/manual test runs, and have synthetic email addresses.

| ID Range / Group | User IDs | Email Pattern | Full Name Pattern | Referenced By (Pre-Reset) | Safe To Delete? |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Legacy E2E PMs** | `894`, `895` | `pm_1790...@test.epms.tvm.com` | `Test User pm_...` | `projects.manager_id`, `project_baselines`, `project_progress_logs` | **YES** (After transactions emptied) |
| **Multi-Role Suites**| `2672` to `2691` (20 users) | `*@test.epms.tvm.com` | `Test pm ...`, `Test admin ...`, `Test pmo ...` | `project_baselines`, `project_progress_logs` | **YES** (After transactions emptied) |
| **R2 Sprint Tests** | `2991` to `3014` (24 users) | `*@test.com` | `PM R2 ...`, `Other PM ...`, `PMO Verifier ...` | `project_progress_logs`, `project_progress_evidence` | **YES** (After transactions emptied) |
| **C4 Gate Checks** | `3697` to `3706` (10 users) | `*@example.com` | `C4 pm User`, `C4 dir User`, `C4 hoo User`, etc. | None (Recent gate run) | **YES** (After transactions emptied) |

**Exact List of 56 User IDs to Delete:**  
`894, 895, 2672, 2673, 2674, 2675, 2676, 2677, 2678, 2679, 2680, 2681, 2682, 2683, 2684, 2685, 2686, 2687, 2688, 2689, 2690, 2691, 2991, 2992, 2993, 2994, 2995, 2996, 2997, 2998, 2999, 3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3697, 3698, 3699, 3700, 3701, 3702, 3703, 3704, 3705, 3706`

---

### 4. USER_ROLES — PRESERVE RELATIONSHIPS

**Total rows currently in DB:** 14  
**Test user mappings:** 0 (Test users have 0 role assignments).  
**Proposed action:** **PRESERVE ALL 14 ROWS UNCHANGED**.

| User ID | Role ID | Operational User | Role Name | Action | Rationale |
| :---: | :---: | :--- | :--- | :---: | :--- |
| **1** | 1 | `admin@epms.com` | `SUPER_ADMIN` | **PRESERVE** | Core admin authorization. |
| **2** | 2 | `pm@epms.com` | `PROJECT_MANAGER` | **PRESERVE** | Core PM authorization. |
| **3** | 3 | `finance@epms.com` | `FINANCE` | **PRESERVE** | Core Finance authorization. |
| **4** | 4 | `director@epms.com` | `DIRECTOR` | **PRESERVE** | Core Director authorization. |
| **7** | 7 | `lukas@epms.com` | `MARKETING` | **PRESERVE** | Core Marketing authorization. |
| **9** | 7 | `ragil@epms.com` | `MARKETING` | **PRESERVE** | Core Marketing authorization. |
| **10** | 8 | `legal@epms.com` | `LEGAL` | **PRESERVE** | Core Legal authorization. |
| **39** | 1 | `superadmin@epms.com`| `SUPER_ADMIN` | **PRESERVE** | Admin authorization. |
| **41** | 42 | `purchasing@epms.com`| `PROCUREMENT` | **PRESERVE** | Core Buyer authorization. |
| **52** | 40 | `headops@tvmubd.com` | `HEAD_OF_OPERATIONS` | **PRESERVE** | HOPS authorization. |
| **58** | 6 | `hops@epms.com` | `GENERAL_MANAGER` | **PRESERVE** | GM authorization. |
| **58** | 40 | `hops@epms.com` | `HEAD_OF_OPERATIONS` | **PRESERVE** | HOPS authorization. |
| **769** | 67 | `pmo@epms.com` | `PMO` | **PRESERVE** | PMO authorization. |
| **879** | 2 | `faza@epms.com` | `PROJECT_MANAGER` | **PRESERVE** | PM authorization. |

---

### 5. CUSTOMERS — MASTER DATA REVIEW

**Total rows currently in DB:** 9 (IDs 8 through 16).  
**AUTO_INCREMENT reset:** **NO** (Retain current sequence value 17 so any preserved records maintain PK integrity).

| ID | Code | Client Name | Company Name | Contact Person | Email | Tenders | Contracts | Classification | Recommended Action | Rationale |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **8** | CUST-001 | PT Asianet Media Teknologi | PT Asianet Media Teknologi | Johan | `johan@asianet.com` | 172 | 137 | Corporate Master | **PRESERVE** | Primary client in EPMS commercial testing. |
| **9** | CUST-002 | SURGE | PT. INTERNET RAKYAT | Reski pradesta | `pradestareski@gmail.com` | 0 | 0 | Manual / Test | **DELETE** | Test client entry with 0 transactions. |
| **10** | CUST-003 | MORAREPUBLIK | PT. EKAMAS REPUBLIK | Reski pradesta | `pradestareski@gmail.com` | 2 | 1 | Manual / Test | **DELETE** | Duplicate manual test entry. |
| **11** | CUST-004 | PT. LINKNET | PT. LINKNET | Reski pradesta | `pradestareski@gmail.com` | 1 | 1 | Mixed Corporate | **REVIEW** | Corporate client name with personal test contact. |
| **12** | CUST-005 | MORAREPUBLIK | PT. EKAMASREPUBLIC | Reski pradesta | `pradestareski@gmail.com` | 1 | 0 | Manual / Test | **DELETE** | Duplicate manual test entry. |
| **13** | CUST-006 | MORAREPUBLIC | PT. EKAMAS REPUBLIK | Reski pradesta | `pradestareski@gmail.com` | 1 | 1 | Manual / Test | **DELETE** | Duplicate manual test entry. |
| **14** | CUST-007 | J&T Express | PT. Global Jet Express | Ramdani | `ramdani@jet.co.id` | 10 | 2 | Corporate Master | **PRESERVE** | Legitimate corporate logistics client. |
| **15** | CUST-008 | MYREPUBLIK | PT. EKAMASREPUBLIK | reskipradesta | `reskipradesta@gmail.com` | 1 | 1 | Manual / Test | **DELETE** | Duplicate manual test entry. |
| **16** | CUST-009 | Reski pradesta | PT. EKAMAS REPUBLIK | Reski pradesta | `pradestareski@gmail.com` | 1 | 0 | Manual / Test | **DELETE** | Obvious individual test profile. |

**Customer Strategy Options for User Decision:**
- **Recommendation (Balanced Master):** PRESERVE IDs 8 & 14 (Corporate Masters). DELETE IDs 9, 10, 11, 12, 13, 15, 16.
- **Alternative 1 (Conservative):** PRESERVE all 9 rows (IDs 8–16) unchanged.
- **Alternative 2 (Fresh Clean):** Delete all 9 rows and reseed a standardized 5-client corporate master catalog via DB-A3.

---

### 6. VENDORS — MASTER DATA REVIEW

**Total rows currently in DB:** 6 (IDs 1, 2, 3, 4, 5, 41).  
**AUTO_INCREMENT reset:** **NO** (Preserving current sequence value 42).

| ID | Code | Vendor Name | Vendor Type | Quotations | POs | Comps | Claims | SOs | Classification | Recommended Action | Rationale |
| :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | VND-001 | PT IT Solusi Bersama | Hardware | 21 | 12 | 21 | 1 | 0 | Canonical Master | **PRESERVE** | Canonical IT hardware supplier seed. |
| **2** | VND-002 | PT Maju Infrastruktur | Construction | 17 | 2 | 17 | 0 | 0 | Canonical Master | **PRESERVE** | Canonical civil/construction supplier seed. |
| **3** | VND-003 | PT Cyber Security | Software | 19 | 0 | 19 | 0 | 0 | Canonical Master | **PRESERVE** | Canonical security software supplier seed. |
| **4** | VND-004 | PT Suplai Makmur | General | 5 | 1 | 5 | 9 | 2 | Canonical Master | **PRESERVE** | Canonical general supplies & services supplier seed. |
| **5** | VND-005 | CV Logistik Terpadu | Logistics | 4 | 2 | 4 | 0 | 0 | Canonical Master | **PRESERVE** | Canonical transport & logistics supplier seed. |
| **41** | VND-006 | PT MUNJUL JAYA | Construction | 4 | 3 | 4 | 0 | 0 | Test Created | **DELETE** | Created 2026-10-01 during manual UI procurement testing. |

---

### 7. DOCUMENTS — CONTROLLED CLEANUP PLAN & PHYSICAL MANIFEST

**Total metadata rows in `documents`:** **449**  
**Physical files located in `backend/uploads/`:** **354** (100% verified on local disk)  
**Relative / Cloud S3 URIs:** **95**  
**Orphan / Missing Local Files:** **0**  
**Master Documents / Templates in table:** **0** (All 449 rows are attached to commercial/test transactions).

#### A. DOCUMENT METADATA BREAKDOWN BY ENTITY & CATEGORY

| Entity Type | Category | Row Count | Target Transaction Table | Proposed DB Action | Proposed Storage Action |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `CONTRACT` | `OTHER` | 163 | `contracts` | **DELETE** | Prune physical PDF files from `uploads/contracts/` |
| `SPK` | `OTHER` | 163 | `contracts` / `tenders` | **DELETE** | Prune physical PDF files from `uploads/contracts/` |
| `PROPOSAL` | `OTHER` | 87 | `proposals` | **DELETE** | Prune physical PDF files from `uploads/proposals/` |
| `PROJECT` | `OTHER` | 32 | `projects` / `tasks` | **DELETE** | Prune physical PDF files from `uploads/project/` |
| `PROJECT` | `CUSTOMER_BAST` | 2 | `project_closures` | **DELETE** | Prune physical PDF files from `uploads/project/` |
| `PROJECT` | `FINAL_REPORT` | 2 | `project_closures` | **DELETE** | Prune physical PDF files from `uploads/project/` |
| **TOTAL** | — | **449** | — | — | — |

#### B. PROPOSED STORAGE CLEANUP MANIFEST RULES
1. **Never perform blind folder delete (`rm -rf uploads`) or S3 bucket purge.**
2. Only files whose `file_path` matches an approved deleted document row from the manifest (`document-manifest-full.json`) will be removed.
3. If an object key cannot be verified or exists in S3 without explicit delete authorization, it will be marked **UNKNOWN / HOLD**.

---

### 8. AUDIT_LOGS — ARCHIVE BEFORE CLEANUP PLAN

**Total rows currently in DB:** **3,576**  

| Log Classification | Row Count | Specific Target Tables Covered | Retention Recommendation |
| :--- | :---: | :--- | :--- |
| **TRANSACTION AUDIT** | **3,574** | `contracts`, `tenders`, `tasks`, `proposals`, `purchase_requests`, `purchase_orders`, `invoices`, `payments`, `project_closures`, `wbs` | **EXPORT / ARCHIVE THEN DELETE** |
| **SYSTEM / CONFIG AUDIT** | **2** | `workflow_definitions` (2 deletion logs from 2026-09-21) | **PRESERVE OR ARCHIVE** |
| **MASTER VENDOR AUDIT** | **1** | `vendors` (Creation of test vendor #41 on 2026-10-01) | **DELETE WITH VENDOR 41** |
| **AUTH / SECURITY AUDIT** | **0** | `users`, `user_sessions`, `auth` | **N/A (0 rows)** |

**Safer Strategy Recommendation:**
- **Recommended Method:** **SELECTIVE DELETE AFTER ARCHIVE DUMP**.
  1. Dump historical audit logs to external archive file: `epms_audit_logs_archive_20261012.json` / `.sql`.
  2. If preserving system configuration logs is desired, delete `WHERE table_name NOT IN ('workflow_definitions', 'workflow_versions')`.
  3. If a 100% clean test baseline is required, full truncate after archive is safe because `audit_logs` has **0 inbound foreign keys**.

---

### 9. CANONICAL E2E VALIDATION PROJECTS IMPACT

The test database currently contains the authoritative lifecycle acceptance projects:
- **Project 1364** (`CANONICAL-E2E-1790563053595`, Contract #42)
- **Project 2428** (`CANONICAL-FINAL-E2E-1791742923755`, Contract #162)

#### DEPENDENCY IMPACT MATRIX:

| Entity / Domain | Project 1364 | Project 2428 | Total Affected Rows | Future State | Evidence Survival Location |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Project Master Row** | 1 (`#1364`) | 1 (`#2428`) | 2 | **EXPUNGED** | Backup dump & UAT reports |
| **Contract Row** | 1 (`#42`) | 1 (`#162`) | 2 | **EXPUNGED** | Backup dump & UAT reports |
| **Project Closures** | 1 (`#217`) | 1 (`#254`) | 2 | **EXPUNGED** | `.gemini/antigravity-ide/brain/91a4da8b.../` |
| **WBS Elements** | 1 | 1 | 2 | **EXPUNGED** | Baseline measurements JSON |
| **Gantt Tasks** | 1 | 1 | 2 | **EXPUNGED** | E2E test logs |
| **Project Baselines** | 1 | 1 | 2 | **EXPUNGED** | E2E test logs |
| **Progress Logs** | 2 | 1 | 3 | **EXPUNGED** | E2E test logs |
| **Management Reviews** | 1 | 1 | 2 | **EXPUNGED** | E2E test logs |
| **Document Attachments** | 8 | 3 | 11 | **EXPUNGED** | Local disk backup |
| **Workflow Instances** | 2 | 2 | 4 | **EXPUNGED** | Test transcripts |

*Confirmation:* All 45+ UI screenshots, browser execution traces, and milestone transcripts are archived outside MySQL in the artifact storage directory. Expunging these projects from MySQL is **safe and intended**.

---

### 10. BUSINESS REFERENCE NUMBER RESTART IMPACT

There are **zero dedicated sequence tables** in MySQL. All business references are generated dynamically via date-scoped queries or table primary keys:

| Business Reference | Format Pattern | Generation Logic | Storage Location | Reset Impact | First Expected New Reference | Duplicate Risk | Safe? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Contract** | `CONT-YYYYMMDD-XXXX` | Date + 4-digit padded `insertId` | `contracts.contract_number` | Restarts sequence at `0001` | `CONT-YYYYMMDD-0001` | None | **YES** |
| **Project Code** | `CONT-YYYYMMDD-XXXX` | Inherited from `contract.contract_number` | `projects.code` | Inherits Contract `0001` | `CONT-YYYYMMDD-0001` | None | **YES** |
| **Purchase Request (PR)** | `PR-YYYYMMDD-SEQ` | Date + daily count (`countToday + 1`, 3 digits) | `purchase_requests.pr_number` | Daily count restarts at 0 | `PR-YYYYMMDD-001` | None | **YES** |
| **Purchase Order (PO)** | `PO-YYYYMMDD-SEQ` | Date + daily count (`countToday + attempts`) | `purchase_orders.po_number` | Daily count restarts at 0 | `PO-YYYYMMDD-001` | None | **YES** |
| **Goods Receipt (GR)** | `GR-YYYYMMDD-SEQ` | Date + daily count (`count + 1`, 3 digits) | `goods_receipts.gr_number` | Daily count restarts at 0 | `GR-YYYYMMDD-001` | None | **YES** |
| **Service Claim** | `SCL-YYYYMMDD-SEQ` | Date + daily count (`count + attempts`) | `service_claims.claim_number` | Daily count restarts at 0 | `SCL-YYYYMMDD-001` | None | **YES** |
| **Invoice** | `INV-YYYYMMDD-SEQ` | Date + daily count (`count + attempts`) | `invoices.invoice_number` | Daily count restarts at 0 | `INV-YYYYMMDD-001` | None | **YES** |
| **Payment Request** | `PRQ-YYYYMMDD-SEQ` | Date + daily count (`count + attempts`) | `payment_requests.request_number`| Daily count restarts at 0 | `PRQ-YYYYMMDD-001` | None | **YES** |
| **Payment** | `PAY-YYYYMMDD-SEQ` | Date + daily count (`count + attempts`) | `payments.payment_number` | Daily count restarts at 0 | `PAY-YYYYMMDD-001` | None | **YES** |
| **Proposal** | `PROP-YYYYMMDD-XXXX`| Date + random 4 digits | `proposals.proposal_number` | Independent randomness | `PROP-YYYYMMDD-XXXX` | Negligible | **YES** |
| **Tender** | Numeric ID | Auto-increment PK `tenders.id` | `tenders.id` | Restarts at 1 | `Tender #1` | None | **YES** |

---

### 11. FOREIGN KEY TOPOLOGY & DELETE VS TRUNCATE STRATEGY

#### A. Inbound Foreign Key Constraint Discovery:
- **Total Foreign Keys:** 147
- **Foreign Keys Enforcing `RESTRICT`:** 88
- **Tables with 0 inbound foreign keys:** 26
- **Tables with $\ge 1$ inbound foreign keys:** 35

#### B. Crucial MySQL / InnoDB Rule:
In MySQL / InnoDB, `TRUNCATE TABLE <table>` **FAILS IMMEDIATELY** with error:
> `Cannot truncate a table referenced in a foreign key constraint`  
if any table possesses a foreign key referencing it — **even when foreign child tables are completely empty** — unless `FOREIGN_KEY_CHECKS = 0`.

Because disabling `FOREIGN_KEY_CHECKS` is strictly prohibited by safety guidelines:
1. **TRUNCATE CANNOT BE USED on the 35 parent tables** (such as `projects`, `purchase_orders`, `purchase_requests`, `tenders`, `contracts`, `wbs`, `tasks`, etc.).
2. **The only 100% reliable, FK-safe method is:**
   $$\text{DELETE FROM } <table>; \quad \longrightarrow \quad \text{ALTER TABLE } <table> \text{ AUTO\_INCREMENT = 1};$$
   executed strictly along the bottom-up child $\to$ parent dependency tree.

---

### 12. EXACT FUTURE FK CLEANUP ORDER (49 TRANSACTION & TECHNICAL TABLES)

This is the mathematically proven, bottom-up execution sequence that clears child dependencies before parent entities, ensuring **zero FK RESTRICT violations**:

| Step | Table Name | Proposed Method | Why This Position | Child Dependencies Cleared? | Parent Dependencies | AUTO_INC Reset? |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **1** | `project_progress_evidence` | DELETE | Leaf table. Referencing progress logs and documents. | YES (0 inbound FKs) | `project_progress_logs`, `documents`, `users` | YES (Next: 1) |
| **2** | `project_progress_logs` | DELETE | Leaf after Step 1. Referencing projects, tasks, WBS. | YES (after Step 1) | `projects`, `tasks`, `wbs`, `project_baselines`, `users` | YES (Next: 1) |
| **3** | `project_baseline_wbs_items`| DELETE | Leaf snapshot table. Referencing baselines. | YES (0 inbound FKs) | `project_baselines` | YES (Next: 1) |
| **4** | `project_baselines` | DELETE | Leaf after Step 3. Referencing projects. | YES (after Step 3) | `projects`, `users` | YES (Next: 1) |
| **5** | `project_issues` | DELETE | Leaf table. Referencing projects and tasks. | YES (0 inbound FKs) | `projects`, `tasks`, `project_risks`, `users` | YES (Next: 1) |
| **6** | `project_risks` | DELETE | Leaf after Step 5. Referencing projects. | YES (after Step 5) | `projects`, `tasks`, `users` | YES (Next: 1) |
| **7** | `procurement_reconciliations`| DELETE | Empty table. Referencing projects, POs, PRs. | YES (0 inbound FKs) | `projects`, `purchase_orders`, `purchase_requests`, `users` | YES (Next: 1) |
| **8** | `payments` | DELETE | Terminal finance settlement entity. | YES (0 inbound FKs) | `invoices`, `payment_requests` | YES (Next: 1) |
| **9** | `payment_requests` | DELETE | Leaf after Step 8. Referencing invoices. | YES (after Step 8) | `invoices`, `po_payment_terms`, `users` | YES (Next: 1) |
| **10** | `invoice_items` | DELETE | Line items of invoices. | YES (0 inbound FKs) | `invoices`, `purchase_order_items` | YES (Next: 1) |
| **11** | `invoices` | DELETE | Leaf after Steps 8–10. Referencing POs. | YES (after Steps 8–10)| `purchase_orders`, `po_payment_terms`, `service_claims` | YES (Next: 1) |
| **12** | `service_claim_items` | DELETE | Line items of service claims. | YES (0 inbound FKs) | `service_claims` | YES (Next: 1) |
| **13** | `service_claims` | DELETE | Leaf after Steps 11–12. Referencing POs, projects. | YES (after Steps 11–12)| `purchase_orders`, `service_orders`, `projects`, `vendors`| YES (Next: 1) |
| **14** | `service_orders` | DELETE | Leaf after Step 13. Referencing POs. | YES (after Step 13) | `purchase_orders`, `vendors` | YES (Next: 1) |
| **15** | `goods_receipt_items` | DELETE | Line items of goods receipts. | YES (0 inbound FKs) | `goods_receipts`, `purchase_order_items` | YES (Next: 1) |
| **16** | `goods_receipts` | DELETE | Leaf after Step 15. Referencing POs. | YES (after Step 15) | `purchase_orders` | YES (Next: 1) |
| **17** | `po_payment_terms` | DELETE | Payment terms attached to POs. | YES (after Steps 9, 11)| `purchase_orders` | YES (Next: 1) |
| **18** | `purchase_order_items` | DELETE | Line items of purchase orders. | YES (after Steps 10, 15)| `purchase_orders`, `purchase_request_items`, `cost_items` | YES (Next: 1) |
| **19** | `vendor_comparisons` | DELETE | RFQ evaluation sheets. | YES (0 inbound FKs) | `rfqs`, `quotations`, `vendors` | YES (Next: 1) |
| **20** | `quotation_items` | DELETE | Quotation line items. | YES (0 inbound FKs) | `quotations` | YES (Next: 1) |
| **21** | `quotations` | DELETE | Leaf after Steps 19–20. Referencing RFQs. | YES (after Steps 19–20)| `rfqs`, `vendors` | YES (Next: 1) |
| **22** | `rfqs` | DELETE | Leaf after Steps 19, 21. Referencing PRs. | YES (after Steps 19, 21)| `purchase_requests`, `projects` | YES (Next: 1) |
| **23** | `purchase_orders` | DELETE | Procurement contract entity. | YES (after Steps 7, 11, 13, 14, 16–18)| `purchase_requests`, `vendors`, `users` | YES (Next: 1) |
| **24** | `purchase_request_items` | DELETE | PR line items. | YES (after Step 18) | `purchase_requests`, `procurement_package_items`, `cost_items`, `wbs` | YES (Next: 1) |
| **25** | `purchase_requests` | DELETE | Leaf after Steps 22–24. | YES (after Steps 22–24)| `projects`, `procurement_packages`, `users` | YES (Next: 1) |
| **26** | `procurement_package_items` | DELETE | Package line items. | YES (after Step 24) | `procurement_packages`, `cost_items`, `wbs` | YES (Next: 1) |
| **27** | `procurement_packages` | DELETE | Package headers. | YES (after Steps 25–26)| `projects`, `users` | YES (Next: 1) |
| **28** | `project_closures` | DELETE | Closure approval headers. | YES (0 inbound FKs) | `projects`, `documents`, `users` | YES (Next: 1) |
| **29** | `project_management_reviews`| DELETE | Governance review decisions. | YES (0 inbound FKs) | `projects`, `users` | YES (Next: 1) |
| **30** | `project_initial_conditions`| DELETE | Project charters. | YES (0 inbound FKs) | `projects`, `users` | YES (Next: 1) |
| **31** | `cost_items` | DELETE | RAB cost lines. | YES (after Steps 18, 24, 26)| `project_cost_estimates`, `wbs` | YES (Next: 1) |
| **32** | `project_cost_estimates` | DELETE | RAB estimate headers. | YES (after Step 31) | `projects` | YES (Next: 1) |
| **33** | `tasks` | DELETE | Gantt schedule tasks. | YES (after Steps 2, 5, 6)| `work_breakdown_structures`, `projects`, `users` | YES (Next: 1) |
| **34** | `work_breakdown_structures` | DELETE | WBS hierarchy tree. | YES (after Steps 2, 24, 26, 31, 33)| `projects`, self-referencing parent_id | YES (Next: 1) |
| **35** | `milestones` | DELETE | Empty table. | YES (0 inbound FKs) | `projects` | YES (Next: 1) |
| **36** | `project_budgets` | DELETE | Empty table. | YES (0 inbound FKs) | `projects` | YES (Next: 1) |
| **37** | `contract_amendments` | DELETE | Empty table. | YES (0 inbound FKs) | `contracts`, `users` | YES (Next: 1) |
| **38** | `workflow_transitions` | DELETE | Workflow audit transitions. | YES (0 inbound FKs) | `workflow_instances`, `workflow_tasks`, `workflow_versions`, `users` | YES (Next: 1) |
| **39** | `workflow_tasks` | DELETE | Workflow pending/completed tasks. | YES (after Step 38) | `workflow_instances`, `roles`, `users` | YES (Next: 1) |
| **40** | `workflow_instances` | DELETE | Workflow execution instances. | YES (after Steps 38–39)| `workflow_definitions`, `workflow_versions` | YES (Next: 1) |
| **41** | `notifications` | DELETE | Pusat Aktivitas notifications. | YES (0 inbound FKs) | `users` | YES (Next: 1) |
| **42** | `outbox_events` | DELETE | Event relay queue. | YES (0 inbound FKs) | None (Standalone) | YES (Next: 1) |
| **43** | `user_sessions` | DELETE | User login sessions. | YES (0 inbound FKs) | `users` | YES (Next: 1) |
| **44** | `projects` | DELETE | Project core master entity. | YES (after Steps 1–36) | `contracts`, `users` | YES (Next: 1) |
| **45** | `contracts` | DELETE | Commercial contract headers. | YES (after Steps 37, 44)| `proposals`, `customers`, `users` | YES (Next: 1) |
| **46** | `tender_activities` | DELETE | Opportunity activity ledger. | YES (0 inbound FKs) | `tenders`, `users` | YES (Next: 1) |
| **47** | `tender_price_history` | DELETE | Tender negotiation history. | YES (0 inbound FKs) | `tenders` | YES (Next: 1) |
| **48** | `proposals` | DELETE | Commercial proposals. | YES (after Step 45) | `tenders`, `users` | YES (Next: 1) |
| **49** | `tenders` | DELETE | Opportunity root headers. | YES (after Steps 46–48)| `customers`, `users` | YES (Next: 1) |

---

### 13. MANDATORY PRE-RESET BACKUP & RESTORATION PROCEDURE

Before any Phase DB-A3 reset execution, the following mandatory procedures must be completed:

#### A. BACKUP EXECUTION STEPS:
1. **Full Database Dump:**
   ```bash
   mysqldump -u <DB_USER> -p --single-transaction --routines --triggers epms_tvmubd_db > epms_tvmubd_db_pre_reset_backup_<YYYYMMDD_HHMMSS>.sql
   ```
2. **Table Row Count & Auto-Increment Snapshot:**
   Execute read-only SQL queries to snapshot table counts and sequence values into a timestamped JSON file.
3. **Master Allowlist Manifest Verification:**
   Confirm that canonical user IDs (`1, 2, 3, 4, 7, 9, 10, 39, 41, 52, 58, 769, 879`) and canonical vendors (`1..5`) are matched.
4. **Physical Document Archive:**
   Copy `backend/uploads/` directory to a timestamped backup archive folder:
   ```bash
   tar -czf uploads_backup_<YYYYMMDD_HHMMSS>.tar.gz backend/uploads/
   ```

#### B. BACKUP VERIFICATION CRITERIA (GATE REQUIREMENT):
- Backup file exists on disk.
- File size is non-zero (expected > 15MB).
- Grep verifies `CREATE TABLE` statements for all 61 tables exist in dump.
- Schema name `epms_tvmubd_db` is present.
- Backup completion timestamp recorded in audit log.

#### C. RESTORATION PROCEDURE (ROLLBACK PLAN):
If any step during Phase DB-A3 fails or produces unexpected errors:
```bash
mysql -u <DB_USER> -p epms_tvmubd_db < epms_tvmubd_db_pre_reset_backup_<YYYYMMDD_HHMMSS>.sql
```
And restore physical uploads:
```bash
tar -xzf uploads_backup_<YYYYMMDD_HHMMSS>.tar.gz -C backend/
```

---

### 14. PROPOSED SQL EXECUTION SCRIPT (FOR REVIEW ONLY — TEXT ONLY)

```sql
-- ==============================================================================
-- PLAN ONLY — DO NOT EXECUTE
-- REQUIRES EXPLICIT USER APPROVAL
-- REQUIRES VERIFIED BACKUP DUMP BEFORE RUNNING
-- TARGET PHASE: DB-A3 ONLY
-- DATABASE: epms_tvmubd_db
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SCRIPT A: TRANSACTION TABLES CLEANUP (BOTTOM-UP FK-SAFE SEQUENCE)
-- ------------------------------------------------------------------------------

DELETE FROM project_progress_evidence;
ALTER TABLE project_progress_evidence AUTO_INCREMENT = 1;

DELETE FROM project_progress_logs;
ALTER TABLE project_progress_logs AUTO_INCREMENT = 1;

DELETE FROM project_baseline_wbs_items;
ALTER TABLE project_baseline_wbs_items AUTO_INCREMENT = 1;

DELETE FROM project_baselines;
ALTER TABLE project_baselines AUTO_INCREMENT = 1;

DELETE FROM project_issues;
ALTER TABLE project_issues AUTO_INCREMENT = 1;

DELETE FROM project_risks;
ALTER TABLE project_risks AUTO_INCREMENT = 1;

DELETE FROM procurement_reconciliations;
ALTER TABLE procurement_reconciliations AUTO_INCREMENT = 1;

DELETE FROM payments;
ALTER TABLE payments AUTO_INCREMENT = 1;

DELETE FROM payment_requests;
ALTER TABLE payment_requests AUTO_INCREMENT = 1;

DELETE FROM invoice_items;
ALTER TABLE invoice_items AUTO_INCREMENT = 1;

DELETE FROM invoices;
ALTER TABLE invoices AUTO_INCREMENT = 1;

DELETE FROM service_claim_items;
ALTER TABLE service_claim_items AUTO_INCREMENT = 1;

DELETE FROM service_claims;
ALTER TABLE service_claims AUTO_INCREMENT = 1;

DELETE FROM service_orders;
ALTER TABLE service_orders AUTO_INCREMENT = 1;

DELETE FROM goods_receipt_items;
ALTER TABLE goods_receipt_items AUTO_INCREMENT = 1;

DELETE FROM goods_receipts;
ALTER TABLE goods_receipts AUTO_INCREMENT = 1;

DELETE FROM po_payment_terms;
ALTER TABLE po_payment_terms AUTO_INCREMENT = 1;

DELETE FROM purchase_order_items;
ALTER TABLE purchase_order_items AUTO_INCREMENT = 1;

DELETE FROM vendor_comparisons;
ALTER TABLE vendor_comparisons AUTO_INCREMENT = 1;

DELETE FROM quotation_items;
ALTER TABLE quotation_items AUTO_INCREMENT = 1;

DELETE FROM quotations;
ALTER TABLE quotations AUTO_INCREMENT = 1;

DELETE FROM rfqs;
ALTER TABLE rfqs AUTO_INCREMENT = 1;

DELETE FROM purchase_orders;
ALTER TABLE purchase_orders AUTO_INCREMENT = 1;

DELETE FROM purchase_request_items;
ALTER TABLE purchase_request_items AUTO_INCREMENT = 1;

DELETE FROM purchase_requests;
ALTER TABLE purchase_requests AUTO_INCREMENT = 1;

DELETE FROM procurement_package_items;
ALTER TABLE procurement_package_items AUTO_INCREMENT = 1;

DELETE FROM procurement_packages;
ALTER TABLE procurement_packages AUTO_INCREMENT = 1;

DELETE FROM project_closures;
ALTER TABLE project_closures AUTO_INCREMENT = 1;

DELETE FROM project_management_reviews;
ALTER TABLE project_management_reviews AUTO_INCREMENT = 1;

DELETE FROM project_initial_conditions;
ALTER TABLE project_initial_conditions AUTO_INCREMENT = 1;

DELETE FROM cost_items;
ALTER TABLE cost_items AUTO_INCREMENT = 1;

DELETE FROM project_cost_estimates;
ALTER TABLE project_cost_estimates AUTO_INCREMENT = 1;

DELETE FROM tasks;
ALTER TABLE tasks AUTO_INCREMENT = 1;

DELETE FROM work_breakdown_structures;
ALTER TABLE work_breakdown_structures AUTO_INCREMENT = 1;

DELETE FROM milestones;
ALTER TABLE milestones AUTO_INCREMENT = 1;

DELETE FROM project_budgets;
ALTER TABLE project_budgets AUTO_INCREMENT = 1;

DELETE FROM contract_amendments;
ALTER TABLE contract_amendments AUTO_INCREMENT = 1;

DELETE FROM projects;
ALTER TABLE projects AUTO_INCREMENT = 1;

DELETE FROM contracts;
ALTER TABLE contracts AUTO_INCREMENT = 1;

DELETE FROM tender_activities;
ALTER TABLE tender_activities AUTO_INCREMENT = 1;

DELETE FROM tender_price_history;
ALTER TABLE tender_price_history AUTO_INCREMENT = 1;

DELETE FROM proposals;
ALTER TABLE proposals AUTO_INCREMENT = 1;

DELETE FROM tenders;
ALTER TABLE tenders AUTO_INCREMENT = 1;


-- ------------------------------------------------------------------------------
-- SCRIPT B: TECHNICAL RUNTIME TABLES CLEANUP
-- ------------------------------------------------------------------------------

DELETE FROM workflow_transitions;
ALTER TABLE workflow_transitions AUTO_INCREMENT = 1;

DELETE FROM workflow_tasks;
ALTER TABLE workflow_tasks AUTO_INCREMENT = 1;

DELETE FROM workflow_instances;
ALTER TABLE workflow_instances AUTO_INCREMENT = 1;

DELETE FROM notifications;
ALTER TABLE notifications AUTO_INCREMENT = 1;

DELETE FROM outbox_events;
ALTER TABLE outbox_events AUTO_INCREMENT = 1;

DELETE FROM user_sessions;
ALTER TABLE user_sessions AUTO_INCREMENT = 1;


-- ------------------------------------------------------------------------------
-- SCRIPT C: TEST USERS SELECTIVE CLEANUP (EXPLICIT ID LIST ONLY)
-- ------------------------------------------------------------------------------

DELETE FROM users 
WHERE id IN (
  894, 895, 
  2672, 2673, 2674, 2675, 2676, 2677, 2678, 2679, 2680, 2681, 2682, 2683, 2684, 2685, 2686, 2687, 2688, 2689, 2690, 2691, 
  2991, 2992, 2993, 2994, 2995, 2996, 2997, 2998, 2999, 3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 
  3697, 3698, 3699, 3700, 3701, 3702, 3703, 3704, 3705, 3706
);
-- NOTE: DO NOT RESET AUTO_INCREMENT ON users TABLE!


-- ------------------------------------------------------------------------------
-- SCRIPT D: CUSTOMERS SELECTIVE CLEANUP (PENDING USER DECISION)
-- (RECOMMENDED BALANCED OPTION: PURGE TEST CLIENTS, PRESERVE CORPORATE MASTERS)
-- ------------------------------------------------------------------------------

DELETE FROM customers WHERE id IN (9, 10, 11, 12, 13, 15, 16);
-- NOTE: DO NOT RESET AUTO_INCREMENT ON customers TABLE!


-- ------------------------------------------------------------------------------
-- SCRIPT E: VENDORS SELECTIVE CLEANUP
-- ------------------------------------------------------------------------------

DELETE FROM vendors WHERE id = 41;
-- NOTE: DO NOT RESET AUTO_INCREMENT ON vendors TABLE!


-- ------------------------------------------------------------------------------
-- SCRIPT F: AUDIT LOGS CLEANUP (POST-ARCHIVE)
-- ------------------------------------------------------------------------------

DELETE FROM audit_logs;
ALTER TABLE audit_logs AUTO_INCREMENT = 1;


-- ------------------------------------------------------------------------------
-- SCRIPT G: DOCUMENT METADATA CLEANUP
-- ------------------------------------------------------------------------------

DELETE FROM documents;
ALTER TABLE documents AUTO_INCREMENT = 1;
```

---

### 15. SPECIAL REVIEW DECISION ITEMS (FOR USER APPROVAL)

The following specific decisions require explicit user direction before Phase DB-A3 execution:

1. **Customers Master Strategy:**
   - **Option A (Recommended):** Preserve corporate clients #8 (`PT Asianet Media Teknologi`) and #14 (`J&T Express`), delete the 7 test/personal entries (#9, #10, #11, #12, #13, #15, #16).
   - **Option B (All Preserve):** Preserve all 9 customers.
   - **Option C (Fresh Seed):** Delete all 9 customers and insert a standardized 5-client corporate master catalog.
2. **Vendors Test Pruning:**
   - **Option A (Recommended):** Delete test vendor #41 (`PT MUNJUL JAYA`), preserve canonical master vendors #1 through #5.
   - **Option B:** Preserve all 6 vendors.
3. **Audit Logs Handling:**
   - **Option A (Recommended):** Export JSON/SQL archive of all 3,576 rows, then empty table to start a clean audit baseline.
   - **Option B (Selective):** Retain the 2 workflow definition logs and delete only transactional logs.
4. **Physical Document Cleanup:**
   - **Option A (Synchronized Pruning):** Remove matching local files in `backend/uploads/` following the exported 449-row manifest.
   - **Option B (DB Only):** Delete metadata rows from MySQL only, leaving physical files on disk for manual deletion.
