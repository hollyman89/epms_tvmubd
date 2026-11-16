# EPMS UBD & TVM — PHASE 2B STEP 3
# DOCUMENTATION CLOSURE & PRE-STEP 4 GOVERNANCE GATE REPORT
## Formal Record of Specification Acceptance, Architectural Baseline Immutability, Relational Invariant Preservation, and Pre-Step 4 Governance Sign-Off Register

**Document Version:** 1.0.0 (Official Governance Gate Baseline)  
**Document Path:** `docs/audit/EPMS_PHASE_2B_STEP_3_CLOSURE_AND_GOVERNANCE_GATE.md`  
**Target Specification Closed:** [`docs/audit/EPMS_PHASE_2B_STEP_3_DATABASE_SCHEMA_SPECIFICATION.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_3_DATABASE_SCHEMA_SPECIFICATION.md) (v1.3.2)  
**Governing Architectural Baseline:** [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md) (v1.1.1 — Immutable)  
**Governance Audit Reference:** [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_GOVERNANCE_CORRECTION_AUDIT.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_GOVERNANCE_CORRECTION_AUDIT.md)  
**Step 3 Review Status:** `SPECIFICATION REVIEW CLOSED — ACCEPTED`  
**Phase 2B Step 4 Status:** `BLOCKED — GOVERNANCE APPROVAL REQUIRED`  
**Git Baseline Commit:** `ba8987d5336de10557caa35fc2d9f6547c789bd8` (Branch: `main`)  
**Execution Mode:** STRICT DOCUMENTATION-ONLY (Zero Application Code, Schema, or Migration Execution Authorized)  
**Date:** November 13, 2026  

---

## 1. Executive Summary & Objective

This governance checkpoint establishes the formal documentation closure of **Phase 2B Step 3 (Database Schema Specification)** and institutes the formal **Pre-Step 4 Governance Gate** for PPN and PPh tax integration in the Enterprise Project Management System (EPMS) serving **PT Urus Bangun Digital (PT UBD)** and **PT Trans Visi Media (PT TVM)**.

### Primary Checkpoint Determinations:
1. **Step 3 Review Formally Closed & Accepted:** [`docs/audit/EPMS_PHASE_2B_STEP_3_DATABASE_SCHEMA_SPECIFICATION.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_3_DATABASE_SCHEMA_SPECIFICATION.md) (Version 1.3.2) is officially recorded as **`SPECIFICATION REVIEW CLOSED — ACCEPTED`**. All schema definitions, TypeORM mappings, MySQL 8 check constraints, and referential integrity mechanisms have been audited and accepted.
2. **Step 2 Architectural Baseline Preserved:** [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md) (Version 1.1.1) remains the **immutable governing architectural baseline**. No modifications have been made to Step 2.
3. **Approved 11-Table Architecture Preserved:** All 11 approved tax domain tables are preserved without table bloat or redundant junction structures.
4. **Relational Integrity Invariants Preserved:** All composite candidate keys, composite foreign keys, fail-closed defaults, and cancellation mathematical invariants established in Step 3 v1.3.2 remain intact.
5. **Pre-Step 4 Governance Sign-Off Register Established:** Canonical decisions `DEC-TAX-01` through `DEC-TAX-08` are compiled into an actionable, formal sign-off register. In accordance with enterprise audit standards, **every decision remains strictly `OPEN`** until formally approved with documentary evidence by its designated corporate authority.
6. **Step 4 Formally Blocked:** Phase 2B Step 4 (software implementation and database migration creation) is recorded as **`BLOCKED — GOVERNANCE APPROVAL REQUIRED`**.
7. **Strict Non-Implementation Guarantee:** Zero application source code, TypeORM entities, DTOs, services, controllers, SQL scripts, or database migrations have been created, modified, or executed. All pre-existing worktree changes (7 CP1.2 tracked files and 10 deleted evidence PNGs) remain preserved untouched.

---

## 2. Step 3 Review Closure & Acceptance Record

The Phase 2B Step 3 Database Schema Specification underwent rigorous architectural and relational audit across versions 1.0.0 through 1.3.2:

| Baseline Version | Audit Focus / Correction Scope | Audit Outcome |
|:---:|:---|:---:|
| **v1.0.0** | Initial Database Schema Specification (10 tables, baseline DDL) | Pass with Design Gaps |
| **v1.1.0** | Mathematical reconciliation of Six-Dimension Settlement Model ($D_{\text{cash}}$) and Input VAT creditability decoupling | Pass with Remittance Integrity Findings |
| **v1.2.0** | Separation of remittance execution proofs (`tax_remittance_records`) from allocations (`tax_remittance_allocations`) — approved 11-table architecture established | Pass with Dimensional Key Findings |
| **v1.3.0** | Enforcement of multi-dimensional composite FKs locking company, period, regime, and exact statutory liability across remittance and withholding ledgers | Pass with PPh Rule Traceability Gap |
| **v1.3.1** | Explicit non-withholding deliverable representation, `chk_iitd_pph_category_guard`, and rule version snapshots | Pass with Item-to-Withholding Lock Gap |
| **v1.3.2** | Engine-level referential lock `fk_pwr_item_tax_determination` locking withholding rule identity to originating line deliverable determination; MySQL 8 MATCH SIMPLE milestone support | **SPECIFICATION REVIEW CLOSED — ACCEPTED** |

### Verified Specifications in Step 3 v1.3.2:
- **Exact Line-Item Rule Lock:** Candidate key `uk_iitd_item_rule_category (invoice_item_id, pph_tax_regime_rule_id, pph_tax_category)` in `invoice_item_tax_details` referenced directly by `pph_withholding_records (invoice_item_id, tax_regime_rule_id, pph_tax_category)`. An item-derived withholding record is physically prevented by MySQL InnoDB from referencing any rule other than the one determined on its originating deliverable line.
- **Engine-Enforced Non-Withholding Lock:** Non-withholding deliverables store `pph_tax_regime_rule_id = NULL`. Because `tax_regime_rule_id` is `NOT NULL` in `pph_withholding_records`, attempts to generate withholding obligations for non-withholding items fail foreign key evaluation at the database engine level.
- **Support for Unitemized Milestones:** In accordance with CP1.2-04 Rule 4, Down Payment and Retention invoices have `invoice_item_id IS NULL`. Under MySQL MATCH SIMPLE semantics, `fk_pwr_item_tax_determination` evaluates as satisfied, while independent composite FK `fk_pwr_regime_rule_category` validates that the rule exists in `tax_regime_rules` with `tax_category = 'PPH'`.
- **Exact Liability Identity & Dimensional Integrity:** Remittance allocations are bound to withholdings and statutory liabilities via composite FKs enforcing identical entity, tax period, regime, and exact liability record identity.
- **Collision-Free Historical Reversal:** Generated column `active_allocation_token` guarantees at most one active `ALLOCATED` record per pair while allowing unlimited historical `REVERSED` records without unique key collision.
- **Cancellation Invariant:** Withholding cancellation strictly sets `outstanding = 0.00` and `total_remitted = 0.00`, retains positive historical `withheld_amount` for audit, and requires audit justification fields.

---

## 3. Preservation of Approved 11-Table Architecture

The approved 11-table schema architecture is preserved in its entirety without table bloat or redundant junction structures:

| Table # | Table Name | Owning Module | Functional Classification | Relational Baseline Keys |
|:---:|:---|:---|:---|:---|
| **1** | `legal_entity_tax_profiles` | Master Data / Governance | Root Entity Tax Configuration | `PRIMARY KEY (id)`, `UNIQUE KEY (company_code)` |
| **2** | `vendor_tax_profiles` | Procurement / Master Data | Vendor Statutory Tax Profile | `PRIMARY KEY (id)`, `UNIQUE KEY (vendor_id)` |
| **3** | `tax_regime_rules` | Finance / Tax Configuration | Versioned Statutory Tax Rules | `PRIMARY KEY (id)`, `UNIQUE KEY (id, tax_category)`, `UNIQUE KEY (regime_code, version)` |
| **4** | `invoice_tax_details` | Finance (Tax Accounting) | Invoice Tax Summary Snapshot | `PRIMARY KEY (id)`, `UNIQUE KEY (invoice_id)` |
| **5** | `invoice_item_tax_details` | Finance (Tax Accounting) | Line Deliverable Tax Detail | `PRIMARY KEY (id)`, `UNIQUE KEY (invoice_item_id)`, `UNIQUE KEY (invoice_item_id, pph_tax_regime_rule_id, pph_tax_category)` |
| **6** | `ppn_masukan_records` | Finance (Tax Accounting) | Input VAT e-Faktur Registry | `PRIMARY KEY (id)`, `UNIQUE KEY (faktur_pajak_number, replacement_code)` |
| **7** | `pph_withholding_records` | Finance (Tax Accounting) | Detailed Withholding Ledger | `PRIMARY KEY (id)`, `UNIQUE KEY (id, company_code, year, month, regime, statutory_tax_liability_id)` |
| **8** | `statutory_tax_liabilities` | Finance (Tax Accounting) | Sovereign Debt Ledger | `PRIMARY KEY (id)`, `UNIQUE KEY (id, company_code, year, month, regime)` |
| **9** | `tax_remittance_records` | Payments / Kas & Bank | Bank Remittance Voucher (NTPN) | `PRIMARY KEY (id)`, `UNIQUE KEY (remittance_number)`, `UNIQUE KEY (ntpn)`, `UNIQUE KEY (id, dimensions)` |
| **10** | `tax_remittance_allocations` | Payments / Tax Accounting | Remittance-Withholding Ledger | `PRIMARY KEY (id)`, `UNIQUE KEY (remittance_id, withholding_id, active_allocation_token)` |
| **11** | `tax_supporting_documents` | Document Management / Tax | Tax Document Storage Repository | `PRIMARY KEY (id)`, `UNIQUE KEY (document_hash)` |

---

## 4. Authoritative Pre-Step 4 Governance Sign-Off Register (DEC-TAX-01 through DEC-TAX-08)

In accordance with strict enterprise governance rules, **every decision remains `OPEN`** until formally approved with signed documentary evidence by its designated corporate authority. No technical assumption or statutory decree citation is accepted as a substitute for internal corporate approval.

| Decision ID | Canonical Decision Title | Core Governance Question & Required Confirmation | Designated Sign-Off Authority | Required Evidentiary Instrument / Documentation | Current Governance Status | Granular Functionality-Blocking Scope |
|:---:|:---|:---|:---:|:---|:---:|:---|
| **DEC-TAX-01** | **Entity Taxpayer Identity & PKP Registration Status** | Formal verification of active PKP (Pengusaha Kena Pajak) status for PT UBD and PT TVM under respective KPP Pratama. Neither entity can be assumed PKP nor NON_PKP without documentary proof. | **Corporate Tax & Accounting / Legal Counsel** | Official Surat Pengukuhan Pengusaha Kena Pajak (SPPKP) and KPP Pratama Tax Registration Certificates. | `OPEN — LEGAL & TAX DECISION` | Blocks automated entity-level PPN Masukan crediting and official buyer tax invoice generation. Schema default: `pkp_status = 'UNVERIFIED'`. |
| **DEC-TAX-02** | **WAPU Appointment Verification** | Determination of whether PT UBD or PT TVM has been legally appointed as a Tax Withholder (WAPU - Wajib Pungut) under Ministry of Finance decree (KMK/PMK). | **Corporate Legal / Finance Director** | Official Ministry of Finance Decree (KMK/PMK appointment letter) or written legal confirmation of non-WAPU status. | `OPEN — UNVERIFIED`<br/>*(Technical default: `is_wapu = FALSE`)* | Blocks WAPU PPN withholding functionality ($W_{\text{wapu\_ppn}}$ deduction from vendors); standard non-WAPU procurement is unblocked. |
| **DEC-TAX-03** | **Retention Withholding Timing** | Statutory withholding tax trigger timing for commercial retention: whether PPh withholding occurs upon initial progress billing or upon final warranty release (BAPST). | **Corporate Tax Counsel** | Formal Written Tax Legal Opinion on Art. 23 / PP 9/2022 withholding trigger event. | `OPEN — LEGAL VERIFICATION REQUIRED` | Blocks automated tax withholding on retention milestones; does not block progress invoices without retention. |
| **DEC-TAX-04** | **DP Amortization Tax Treatment** | Tax invoice billing baseline for progress claims when advance Down Payment exists: gross progress billing vs net progress billing and VAT/withholding base reconciliation. | **Corporate Tax Counsel / Finance Lead** | Approved Corporate Accounting Policy & DJP Administrative Ruling on DP amortization tax invoice baseline. | `OPEN — BUSINESS & LEGAL DECISION` | Blocks automated tax base calculation for progress invoices with DP amortization. |
| **DEC-TAX-05** | **Buyer Input VAT Creditability Policy** | Internal rules and criteria for classifying vendor PPN Masukan as creditable (*Dapat Dikreditkan*) vs non-creditable (*Tidak Dapat Dikreditkan*) under Art. 9(8) UU PPN. | **Head of Tax & Accounting** | Approved Corporate Tax Accounting Policy on Art. 9(8) UU PPN crediting criteria and fail-closed handling. | `OPEN — BUSINESS DECISION` | Blocks automated classification of Input VAT crediting; does not block invoice registration or vendor payable disbursement. |
| **DEC-TAX-06** | **Construction SBU Verification** | Standard operating procedure for validating vendor LPJK Construction Business Entity Certificates (SBU) for PP 9/2022 tier rates (1.75%, 2.65%, 4.00%). | **Head of Procurement & Legal** | Approved SOP & Verification Protocol for LPJK SBU certificates and vendor tax profile tier assignment. | `OPEN — BUSINESS DECISION` | Blocks automated tier-rate selection for construction services; general procurement is unblocked. |
| **DEC-TAX-07** | **Multi-Company `company_code` Partitioning** | Formal approval of entity ownership segregation between PT UBD (`UBD`) and PT TVM (`TVM`) using an immutable `company_code` attribute across core transaction and tax records under one shared tax calculation architecture. | **Solution Architect, PMO Lead, and Finance Director** | Joint Architectural & Financial Sign-Off Charter on UBD vs TVM entity partitioning via immutable `company_code` under a single shared calculation engine. | `OPEN — ARCHITECTURAL DECISION (DESIGN CLARIFIED, PENDING FORMAL SIGN-OFF)` | **Foundational Pre-Migration Blocker:** Blocks Phase 2B Step 4 Migration and multi-entity database partitioning. |
| **DEC-TAX-08** | **Payment Settlement Invariant Remediation** | Formal approval of the Decoupled Dual-Entry Settlement Engine ($L_{\text{comm}} == D_{\text{cash}} + W_{\text{tax}} + W_{\text{wapu\_ppn}} + P_{\text{ded}}$) and remediation of legacy payment Invariant 2/4 (`finance.service.ts#L968`) to allow net cash disbursement ($D_{\text{cash}}$) alongside recognized tax withholding ($W_{\text{tax}}$). | **Lead Financial Systems Architect & Finance Lead** | Technical & Financial Sign-Off on Decoupled Dual-Entry Settlement Engine and remediation specification for `finance.service.ts#L968`. | `OPEN — ARCHITECTURAL & TECHNICAL DECISION` | Blocks automated clearing of net vendor cash disbursements where tax is withheld. |

---

## 5. Phase 2B Step 4 Status & Pre-Migration Gate Block

### **PHASE 2B STEP 4 STATUS: BLOCKED — GOVERNANCE APPROVAL REQUIRED**

Step 4 encompasses the creation and execution of TypeORM database migrations (`backend/src/migrations/*.ts`), TypeORM entity classes (`backend/src/entities/*.ts`), and domain service implementations.

### Strict Pre-Migration Gate Rules:
1. **No Migration Authoring:** No developer or agent is authorized to author, generate, or stage TypeORM migration scripts for tax domain tables while this gate remains active.
2. **No DDL Execution:** No SQL DDL commands (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`) may be executed against development, staging, or production databases.
3. **Mandatory Sign-Off Threshold:** Prior to opening the Step 4 gate:
   - `DEC-TAX-01` and `DEC-TAX-02` must be resolved with official tax certificates.
   - `DEC-TAX-07` must receive formal tripartite sign-off (Solution Architect, PMO Lead, Finance Director).
   - `DEC-TAX-08` must receive formal engineering sign-off (Lead Architect, Finance Lead).
   - An explicit, written Executive Directive authorizing Phase 2B Step 4 implementation must be issued.

---

## 6. Verification and Non-Implementation Certification

### 6.1 Repository Cleanliness & Worktree Integrity
- **Application Code Modified:** Exactly **0** files (`backend/src/**` untouched).
- **TypeORM Entities Modified:** Exactly **0** files (`backend/src/entities/**` untouched).
- **Migrations Created / Executed:** Exactly **0** files (`backend/src/migrations/**` untouched).
- **Pre-Existing Worktree Changes:** All 7 tracked files from CP1.2 checkpoints and 10 deleted evidence PNGs remain completely preserved and uncommitted.

### 6.2 Documentation Verification Commands
- `git diff --check`: **Clean** (Exit code 0; zero whitespace errors, zero patch conflicts).
- `git status --short`: Verified that only authorized audit documentation was updated/created.

---

## 7. Sign-Off Register Signatures (Pending Execution)

The signature blocks below document the required corporate signatories whose formal written sign-offs will unblock Phase 2B Step 4:

```
+---------------------------------------------------------------------------------------+
| PRE-STEP 4 FORMAL GOVERNANCE SIGN-OFF BLOCKS (PENDING SIGNATURE)                      |
+---------------------------------------------------------------------------------------+

1. Corporate Tax & Accounting (DEC-TAX-01, DEC-TAX-05):
   Name: __________________________   Signature: ___________________   Date: ___________
   Status: PENDING REVIEW

2. Corporate Legal Counsel (DEC-TAX-01, DEC-TAX-02, DEC-TAX-03, DEC-TAX-06):
   Name: __________________________   Signature: ___________________   Date: ___________
   Status: PENDING REVIEW

3. Head of Procurement (DEC-TAX-06):
   Name: __________________________   Signature: ___________________   Date: ___________
   Status: PENDING REVIEW

4. Lead Financial Systems Architect (DEC-TAX-07, DEC-TAX-08):
   Name: __________________________   Signature: ___________________   Date: ___________
   Status: PENDING REVIEW

5. Project Management Office (PMO) Lead (DEC-TAX-07):
   Name: __________________________   Signature: ___________________   Date: ___________
   Status: PENDING REVIEW

6. Finance Director / Chief Financial Officer (DEC-TAX-02, DEC-TAX-04, DEC-TAX-07, Gate):
   Name: __________________________   Signature: ___________________   Date: ___________
   Status: PENDING REVIEW

+---------------------------------------------------------------------------------------+
| EXECUTIVE DIRECTIVE TO OPEN STEP 4: [ ] APPROVED    [X] BLOCKED (PENDING SIGN-OFFS)   |
+---------------------------------------------------------------------------------------+
```

---
*(End of Document: EPMS Phase 2B Step 3 Closure & Pre-Step 4 Governance Gate Report)*

