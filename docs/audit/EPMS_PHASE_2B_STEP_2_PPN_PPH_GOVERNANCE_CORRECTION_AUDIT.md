# EPMS UBD & TVM — PHASE 2B STEP 2
# PPN / PPh GOVERNANCE CORRECTION AUDIT REPORT
## Forensic Audit of Decision Register Traceability, PKP/WAPU Status Semantics, Statutory Boundary Categorization, and Technical Control Preservation

**Document Version:** 1.0.0 (Governance Correction Audit Baseline)  
**Governance Workstream:** EPMS UBD & TVM Enterprise Project Management System  
**Audit Document Path:** `docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_GOVERNANCE_CORRECTION_AUDIT.md`  
**Target Design Document:** [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md)  
**Previous Baseline Design Version:** `1.1.0 (Correction & Audit Baseline)`  
**Corrected Design Version:** `1.1.1 (Governance Consistency Baseline)`  
**Previous Audit Report:** [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md) (Preserved Untouched)  
**Git Baseline Commit:** `ba8987d5336de10557caa35fc2d9f6547c789bd8` (Branch: `main`)  
**Audit Execution Mode:** STRICT DOCUMENTATION-ONLY AUDIT (Zero Source Code or Database Schema Modified)  
**Audit Date:** November 12, 2026  

---

## 1. Objective and Scope

### 1.1 Objective
This governance correction audit establishes an authoritative verification record for the transition of the EPMS PPN/PPh Technical Design specification from **Version 1.1.0** to **Version 1.1.1** ([`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md)). 

The primary objectives of this governance correction are:
1. **Restore Canonical Decision Register Traceability:** Correct an identified governance discrepancy where the canonical meanings of decisions `DEC-TAX-04` through `DEC-TAX-08` were altered in conversational audit reporting, ensuring historical continuity with established project decision baselines.
2. **Harden PKP and WAPU Status Semantics:** Eliminate unsupported legal conclusions regarding the tax status of PT UBD and PT TVM by enforcing rigorous definitions of `UNVERIFIED` vs verified `PKP` / `NON_PKP`, and clarifying that the technical default `is_wapu = FALSE` is a safety mechanism rather than a legal exemption finding.
3. **Formalize the Statutory Legal Verification Boundary:** Delineate established project design rules, proposed technical treatments, and unresolved legal interpretations (`OPEN — LEGAL VERIFICATION REQUIRED`), ensuring that citing statutory regulations (e.g. PMK or PP decrees) is not misconstrued as completed corporate legal verification.
4. **Simplify the Decision Register Presentation:** Structure the Decision Register into an executive, actionable matrix specifying confirmation requirements, required evidentiary documents, responsible corporate functions, current statuses, and granular functionality-blocking scopes.
5. **Confirm Total Preservation of Technical Controls F-01 through F-10:** Guarantee that no previously validated technical, mathematical, or architectural corrections from Version 1.1.0 are undone or degraded.

### 1.2 Scope Boundaries & Operating Constraints
- **Strict Documentation-Only Execution:** In full adherence to the governing instructions, this task authorizes zero application source code modification, zero database schema alterations, zero TypeORM migration creation or execution, and zero service or controller editing.
- **Repository Worktree Preservation:** All pre-existing modified files (7 tracked files from CP1.2 checkpoints), deleted baseline assets (10 PNGs in `evidence/`), and baseline documentation in `docs/audit/` are preserved untouched.
- **Implementation Gate Hard Block:** Phase 2B Step 3 (Entity & Schema Migration Specification) remains strictly unauthorized until formal executive review and CFO/Tax Legal sign-off on the canonical Decision Register are completed.

---

## 2. Documents Inspected

The following authoritative repository artifacts, architectural baselines, and legal governance records were inspected:

1. **Current Technical Design Baseline:**
   - [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md) (Inspected at Version 1.1.0 and updated to Version 1.1.1).
2. **Prior Technical Design Correction Audit:**
   - [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md) (Version 1.0.0, dated November 12, 2026; confirmed preserved untouched).
3. **Business Scope and Financial Settlement Baselines:**
   - [`docs/audit/EPMS_PHASE_1_1_SCOPE_ALIGNMENT_AND_ZAHIR_BENCHMARK_MAPPING.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_1_1_SCOPE_ALIGNMENT_AND_ZAHIR_BENCHMARK_MAPPING.md) (Phase 1.1.1 Business Objective and Zahir settlement mapping).
   - [`docs/audit/EPMS_PHASE_2A_TRANSACTION_CALCULATION_CONTROL_ASSESSMENT.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2A_TRANSACTION_CALCULATION_CONTROL_ASSESSMENT.md) (Version 1.4.2, Transaction Calculation Control Assessment).
   - [`docs/audit/EPMS_CP1_2_1_IMPLEMENTATION_PLAN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_CP1_2_1_IMPLEMENTATION_PLAN.md) (Version 1.4.0, Financial Integrity Hardening Baseline).
4. **Core Application Entities and Service Contracts:**
   - `backend/src/entities/invoice.entity.ts` (Invoice header and detail structure).
   - `backend/src/entities/purchase-order.entity.ts` (PO commercial commitments).
   - `backend/src/entities/payment.entity.ts` and `payment-request.entity.ts` (Cash disbursement and payment requests).
   - `backend/src/entities/vendor.entity.ts` (Vendor master profile).
   - `backend/src/modules/finance/finance.service.ts` (Three-Way Matching and payment processing).
5. **Inspection Scope Note:**
   - Only TypeORM entity source files (`backend/src/entities/*.ts`) and migration directories (`backend/src/migrations/*.ts`) were inspected in read-only mode.
   - The live MySQL database schema was not independently verified.

---

## 3. Original DEC-TAX Mapping (Canonical Baseline)

The canonical Decision Register originates from the foundational governance architecture established across Phase 1.1.1, Phase 2A, and Phase 2B Step 1. The canonical eight decisions and their governing identities are defined as follows:

| Decision ID | Canonical Decision Title | Core Governance Question | Historical Origin & Authority |
|:---:|:---|:---|:---|
| **DEC-TAX-01** | **Entity Taxpayer Identity** | Official 16-digit NPWP, NITKU, KPP Pratama registration, and confirmed PKP vs NON_PKP status for PT UBD and PT TVM. | Phase 1.1.1 / Phase 2B Step 1 Tax Assessment |
| **DEC-TAX-02** | **WAPU Appointment Verification** | Determination of whether PT UBD or PT TVM has been legally appointed as a Tax Withholder (WAPU) under Ministry of Finance decree. | Phase 2B Step 1 Governance Gate |
| **DEC-TAX-03** | **Retention Withholding Timing** | Clarification of whether statutory PPh withholding on commercial retention occurs upon initial progress billing or upon final warranty release. | Phase 2B Step 1 Legal Audit |
| **DEC-TAX-04** | **DP Amortization Tax Treatment** | Alignment of commercial progress billing against Down Payment amortization (gross progress billing vs net progress billing and VAT/withholding base reconciliation). | Phase 2B Step 1 / Technical Design v1.0.0 Section 10.3 |
| **DEC-TAX-05** | **Buyer Input VAT Creditability Policy** | Corporate policy and affirmative statutory evaluation criteria for classifying vendor Input VAT as creditable vs non-creditable under Art. 9(8) UU PPN. | Phase 2B Step 1 / Technical Design v1.0.0 Section 6.2 |
| **DEC-TAX-06** | **Construction SBU Verification** | Procedure and workflow for validating vendor LPJK Construction Business Entity Certificates (SBU) to establish PP 9/2022 tier rates (1.75%, 2.65%, 4.00%). | Phase 2B Step 1 / Technical Design v1.0.0 Section 7.1 |
| **DEC-TAX-07** | **Multi-Company `company_code` Partitioning** | Architectural decision establishing entity transaction ownership segregation between PT UBD (`UBD`) and PT TVM (`TVM`) via a simple, immutable `company_code` derived strictly from project/tender ownership, powered by one shared tax calculation architecture, with strict attribute orthogonality from `tax_type` and multi-entity consolidated reporting support. | Phase 2B Step 1 Multi-Company Assessment |
| **DEC-TAX-08** | **Payment Settlement Invariant Remediation** | Architectural approval to remediate legacy Invariant 2/4 in `finance.service.ts` to allow net cash disbursement alongside recognized statutory tax withholding ($D_{\text{cash}} + W_{\text{tax}} == \text{term.amount}$). | Phase 2A / CP1.2-03 Corrective Pass / `DEC-SETTLE-01` |

---

## 4. Governance Inconsistency Identified in Previous Report

During the review of the previous audit cycle, a significant governance discrepancy was identified:

### 4.1 Decision Register Identity Drift
In the executive summary presentation of the previous audit pass, the labels for decisions `DEC-TAX-04` through `DEC-TAX-08` were mistakenly substituted with secondary operational topics:
- *Erroneous Label 04:* Down Payment Tax Invoice Requirement (instead of canonical **DP Amortization Tax Treatment**).
- *Erroneous Label 05:* Vendor Certificate Exemption Policy (instead of canonical **Buyer Input VAT Creditability Policy**).
- *Erroneous Label 06:* Rounding Convention (instead of canonical **Construction SBU Verification**).
- *Erroneous Label 07:* Statutory Tax Calendar Deadlines (instead of canonical **Multi-Company `company_code` Partitioning**).
- *Erroneous Label 08:* Legacy Transaction Migration Policy (instead of canonical **Payment Settlement Invariant Remediation**).

**Governance Impact:** While the markdown specification in `EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md` Section 17 retained the correct titles, the discrepancy in the audit summary compromised cross-document traceability, created ambiguity for executive reviewers, and risked decoupling technical design artifacts from the historical decision log.

### 4.2 Ambiguity in Legal Entity Tax Semantics
Narrative descriptions in Version 1.1.0 occasionally used imprecise phrasing regarding entity tax status:
- Statements describing PT UBD or PT TVM as "non-PKP" merely because their SPPKP status was unverified conflated an unverified evidentiary state with a confirmed statutory status.
- References to the technical default `is_wapu = FALSE` risked being interpreted as a formal corporate legal conclusion that the entities are legally exempt from WAPU obligations, rather than a fail-safe software toggle that disables withholding until verified.

### 4.3 Conflation of Statutory Decrees with Enterprise Verification
In Section 7.1 of Version 1.1.0, the tabular overview of PPh regimes assigned a blanket `Verification Status: VERIFIED` to regimes such as PPh 21, PPh 22, PPh 23, and PPh Final Construction simply because published statutory decrees (PMK 168/2023, PMK 34/2017, PP 94/2010, PP 9/2022) were referenced. Citing a statutory decree does not constitute legal verification for PT UBD or PT TVM's specific operating models.

---

## 5. Corrections Applied in Technical Design v1.1.1

To resolve the identified governance inconsistencies, the following controlled corrections were implemented in [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md):

```
+========================================================================================================================+
|                                    SUMMARY OF GOVERNANCE CORRECTIONS APPLIED                                           |
+========================================================================================================================+
```

1. **Restoration of Canonical DEC-TAX Identities:**
   - Section 17 was completely restructured around the canonical definitions of `DEC-TAX-01` through `DEC-TAX-08`.
   - Secondary operational topics (e.g. certificate exemption procedures, calendar deadlines) were properly subordinated under their parent canonical decisions (`DEC-TAX-05`, `DEC-TAX-06`) rather than hijacking canonical IDs.
2. **Hardening of PKP Status Semantics (Section 4.1 & 11.2):**
   - Explicitly articulated that `UNVERIFIED` indicates status has not yet been established from authoritative evidence.
   - Prohibited describing PT UBD or PT TVM as NON_PKP without official evidence. Prohibited assuming either entity is PKP.
   - Enforced that automated entity-specific Input VAT crediting remains blocked while status is `UNVERIFIED`.
3. **Hardening of WAPU Status Semantics (Section 1.2, 4.1 & 11.2):**
   - Clarified that `is_wapu = FALSE` is a technical safety default that disables withholding functionality.
   - Explicitly documented that this technical default does not constitute a legal conclusion that the entity is non-WAPU.
   - Mandated that activation requires authoritative appointment decrees and formal executive authorization (`DEC-TAX-02`).
4. **Establishment of the Three-Tier Statutory Taxonomy (Section 7.1):**
   - Introduced an explicit governance note categorizing all statutory claims into Established Project Rules, Proposed Technical Treatments, and Unresolved Legal Interpretations (`OPEN — LEGAL VERIFICATION REQUIRED`).
   - Replaced misleading `VERIFIED` status tags in the PPh regime table with `PROPOSED REGULATION BASELINE (Subject to Tax Counsel confirmation)`.
5. **Practical Decision Register Presentation (Section 17):**
   - Redesigned the table to display: Decision ID, Title, What Must Be Confirmed, Evidence Required, Responsible Function, Current Status, and Blocking Scope.
   - Clearly separated **Specific Functionality Only** blocking from **Foundational Dependency** blocking.
6. **Version and Metadata Alignment:**
   - Upgraded document version to `1.1.1 (Governance Consistency Baseline)`.
   - Updated revision history table and roadmap diagrams to reflect Version 1.1.1.
7. **Correction of Existing Entity Company Ownership Classification (Section 11.1.1):**
   - Corrected an architectural classification inconsistency where existing entities with verified parent relationships (e.g. `PurchaseRequest`, `GoodsReceipt`, `Invoice`, etc.) were labeled as `INHERITED` under current repository status.
   - Enforced the governing rule: **A verified parent relationship does NOT prove that UBD/TVM company ownership is currently inherited.** Because no inspected TypeORM entity in `backend/src/entities/` currently possesses a `company_code` column, parent entities have no verified company ownership from which a child can inherit.
   - Updated the current company ownership status for all 10 existing application entities to strictly **`NOT VERIFIED IN SOURCE`** while independently documenting their verified parent foreign key relationships in code.
   - Clearly categorized the target architectural models as **`PROPOSED DIRECT — NOT IMPLEMENTED`** and **`PROPOSED INHERITED — NOT IMPLEMENTED`**, ensuring full distinction between verified existing code reality and planned Step 3 implementation.

---

## 6. PKP and WAPU Status Clarification

A fundamental principle of the EPMS governance architecture is that software configuration states must never be conflated with statutory legal facts. The following definitions are now strictly enforced across the technical design:

### 6.1 PKP Status Semantics
| State | System Meaning | Statutory Evidentiary Requirement | Operational Impact in EPMS |
|:---|:---|:---|:---|
| **`UNVERIFIED`** | Status has not been established from authoritative official evidence. | None (Default initial state). Status is **neither assumed PKP nor assumed NON_PKP**. | Automated entity-specific Input VAT crediting is blocked. Entity-level e-Faktur buyer tax profile generation is blocked. General commercial procurement and invoice registration remain unblocked. |
| **`PKP`** | Entity is an officially confirmed Taxable Entrepreneur (*Pengusaha Kena Pajak*). | Validated Surat Pengukuhan Pengusaha Kena Pajak (SPPKP) decree issued by DJP and non-null `pkp_confirmation_number`. | Input VAT crediting is enabled subject to Art. 9(8) UU PPN and verified e-Faktur validation. |
| **`NON_PKP`** | Entity is officially confirmed as a non-taxable entity. | Verified official documentation confirming non-PKP status (e.g. SKT establishing non-PKP turnover exemption). | System must enforce zero PPN issuance and flag vendor PPN billing for review (PROPOSED CONSTRAINT / IMPLEMENTATION REQUIRED). |

### 6.2 WAPU Appointment Semantics
- **Technical Default (`is_wapu = FALSE`):** Represents a fail-safe software constraint ensuring that WAPU VAT withholding functionality ($W_{\text{wapu\_ppn}}$) remains completely dormant.
- **Legal Distinction:** This technical default **does NOT constitute a legal conclusion** that PT UBD or PT TVM is exempt from WAPU obligations under Indonesian tax law. It simply ensures that EPMS does not withhold funds from vendors without documented statutory authority.
- **Activation Requirement:** Setting `is_wapu = TRUE` requires:
  1. An official Ministry of Finance Appointment Decree (KMK/PMK).
  2. Input of a verified decree number (`wapu_appointment_decree`).
  3. Formal written authorization from the Corporate Legal Director and CFO.

---

## 7. Legal Verification Boundaries

To maintain rigorous governance, all architectural rules, technical models, and statutory claims are classified into three distinct categories:

```
+========================================================================================================================+
|                                    THREE-TIER STATUTORY GOVERNANCE TAXONOMY                                            |
+========================================================================================================================+
```

### 7.1 Category 1: Established Project Design Rules
These rules are fully established, validated, and frozen by previously accepted project baselines (Phase 1.1.1, Phase 2A, CP1.2):
- **Strict Segregation of Duties:** Procurement owns commercial PO commitments; Finance owns invoice verification and tax determination; Payments owns cash disbursement and remittance execution.
- **Six-Dimension Financial Settlement Model:** Decoupling commercial vendor debt ($L_{\text{comm}}$, $D_{\text{cash}}$, $L_{\text{rem\_comm}}$) from sovereign tax liabilities ($W_{\text{tax}}$, $S_{\text{tax}}$, $L_{\text{tax\_stat}}$).
- **Decimal Precision & Exact Monetary Reconciliation:** Standardized `decimal.js` arbitrary precision; zero floating-point arithmetic; zero Rp0.01 tolerance (CP1.2-03).
- **Invoice Header-to-Detail Equality:** Strict validation that $\sum \text{Item Amounts} == \text{Header Total}$ (CP1.2-04).
- **Four-Way Matching Architecture:** Reconciliation across PO commercial authorization, fulfillment evidence, vendor invoice, and tax invoice documentation (F-04).
- **Fail-Closed Rule Engine:** Tax rules default to `is_active = FALSE` and `verification_status = 'NOT_VERIFIED'` (F-01).

### 7.2 Category 2: Proposed Technical Treatments
These structures represent technical design recommendations formulated to support Indonesian tax workflows. They are structurally complete but remain pending formal implementation authorization:
- Table schemas: `legal_entity_tax_profiles`, `vendor_tax_profiles`, `tax_regime_rules`, `invoice_item_tax_details`, `statutory_tax_liabilities`, `tax_remittance_records`.
- Component-level transaction classification (`item_category: MATERIAL | SERVICE`) to support mixed contracts without forcing single rates (F-08).
- Explicit DPP calculation algorithms: Standard DPP, DPP Nilai Lain ($11/12 \times \text{Gross}$), and Besaran Tertentu ($1.2\%$ effective) (F-07).
- Transaction-derived `company_code` inheritance from project/tender ownership (F-09).
- Dual-Entry Payment Settlement interface contract ($D_{\text{cash}} + W_{\text{tax}} == \text{term.amount}$) (F-03, F-10).

### 7.3 Category 3: Unresolved Legal Interpretations (`OPEN — LEGAL VERIFICATION REQUIRED`)
These items cite statutory decrees or describe legal mechanisms that require formal written confirmation by Corporate Tax Counsel or an appointed Tax Advisory firm. Citing a decree number does not establish legal verification:
- **`DEC-TAX-01`:** Confirmation of legal taxpayer identity and PKP status for PT UBD and PT TVM.
- **`DEC-TAX-02`:** Determination of WAPU appointment status under applicable KMK/PMK decrees.
- **`DEC-TAX-03`:** Legal trigger timing for commercial retention withholding tax (progress billing vs BAPST release).
- **`DEC-TAX-04`:** Down Payment tax invoice amortization and matching methodology.
- **`DEC-TAX-05`:** Buyer Input VAT creditability criteria under UU PPN Pasal 9 ayat (8).
- **`DEC-TAX-06`:** LPJK SBU certificate grading and applicability of PP 9/2022 tier rates (1.75%, 2.65%, 4.00%).

---

## 8. Updated Decision Register (Canonical DEC-TAX-01 to DEC-TAX-08)

The canonical Decision Register is presented below in its simplified, practical form. Each decision defines its exact confirmation requirement, required evidence, responsible function, current status, and specific functionality-blocking scope:

| Decision ID | Canonical Decision Title | What Must Be Confirmed | Evidence Required | Responsible Function | Current Status | Blocking Scope |
|:---:|:---|:---|:---|:---:|:---:|:---|
| **DEC-TAX-01** | **Entity Taxpayer Identity** | Official 16-digit NPWP, NITKU, KPP Pratama registration, and confirmed PKP vs NON_PKP status for PT UBD and PT TVM. Neither entity is assumed PKP nor NON_PKP. | Official SPPKP (Surat Pengukuhan Pengusaha Kena Pajak) or official SKT from DJP for each legal entity. | CFO / Corporate Tax Lead | `OPEN — UNVERIFIED` | **Specific Functionality Only:** Blocks automated entity-level PPN Masukan crediting and official buyer tax identity generation for the unverified entity; does **not** block general procurement or standard invoice processing. |
| **DEC-TAX-02** | **WAPU Appointment Verification** | Whether PT UBD or PT TVM has been legally appointed as a Tax Withholder (WAPU - Wajib Pungut) under Ministry of Finance decree (KMK/PMK). | Official KMK/PMK Appointment Decree and Corporate Legal confirmation. | Corporate Legal / Finance Director | `OPEN — UNVERIFIED`<br/>*(Technical default: `is_wapu = FALSE`)* | **Specific Functionality Only:** Blocks WAPU PPN withholding functionality ($W_{\text{wapu\_ppn}}$ deduction from vendors); does **not** block standard procurement or invoicing where the vendor collects PPN. |
| **DEC-TAX-03** | **Retention Withholding Timing** | Statutory withholding tax trigger timing for commercial retention: whether PPh withholding occurs at the time of initial progress milestone billing (on gross progress value) or upon formal release and payment of the retention amount post-warranty (BAPST). | Formal written tax opinion from Corporate Tax Counsel / Tax Advisor. | Corporate Tax Counsel | `OPEN — LEGAL VERIFICATION REQUIRED` | **Specific Functionality Only:** Blocks automated tax withholding on retention milestones; does **not** block standard material purchases or progress invoices without retention. |
| **DEC-TAX-04** | **DP Amortization Tax Treatment** | Tax invoice billing baseline for progress claims when an advance Down Payment exists: whether progress invoices bill gross progress value with proportionate DP deduction, or net progress, and how PPN/PPh tax bases reconcile with initial DP tax invoice. | Approved SOP and Tax Advisory confirmation on DP tax invoice matching. | Corporate Tax Counsel / Finance Lead | `OPEN — BUSINESS & LEGAL DECISION` | **Specific Functionality Only:** Blocks automated tax base calculation for progress invoices with DP amortization; does **not** block standalone DP invoices or regular non-DP invoices. |
| **DEC-TAX-05** | **Buyer Input VAT Creditability Policy** | Internal rules and criteria for classifying vendor PPN Masukan as creditable (*Dapat Dikreditkan*) vs non-creditable (*Tidak Dapat Dikreditkan*) under Art. 9(8) UU PPN (e.g. direct production/project expenditure vs non-operational/administrative costs). | Corporate Tax Accounting Policy signed by Head of Tax & Accounting. | Head of Tax & Accounting | `OPEN — BUSINESS DECISION` | **Specific Functionality Only:** Blocks automated classification of Input VAT crediting; does **not** block invoice registration, vendor payable calculation, or payment disbursement. |
| **DEC-TAX-06** | **Construction SBU Verification** | Standard operating procedure and verification workflow for validating vendor LPJK Construction Business Entity Certificates (SBU) to establish applicable PPh Final rate tiers (e.g. 1.75%, 2.65%, 4.00% under PP 9/2022). | Procurement & Vendor Management SOP with LPJK certificate verification workflow and authorized reviewer role. | Head of Procurement & Legal | `OPEN — BUSINESS DECISION` | **Specific Functionality Only:** Blocks automated tier-rate selection for construction services; does **not** block general vendor procurement, material purchases, or standard non-construction services. |
| **DEC-TAX-07** | **Multi-Company `company_code` Partitioning** | Clarification of entity transaction ownership segregation between PT UBD (`UBD`) and PT TVM (`TVM`) using an immutable `company_code` attribute across core transaction and tax records. Confirmation that: (1) `company_code` strictly uses `'UBD'` and `'TVM'`, derived from authoritative project/tender ownership with zero user override; (2) a single shared tax calculation engine executes calculations for both entities (no duplicate engines); (3) `company_code` and `tax_type` (`PPN` / `PPh`) remain separate orthogonal attributes; (4) existing domain entities lack `company_code` in current source and are classified as `NOT VERIFIED IN SOURCE` for current company ownership (parent FK relationships are verified in source, but parent company ownership is unverified), while future models follow explicit `PROPOSED DIRECT — NOT IMPLEMENTED` or `PROPOSED INHERITED — NOT IMPLEMENTED` patterns (Tables 11.1.1-A and 11.1.1-B); (5) cross-company relationship mismatches must be strictly blocked (`PROPOSED CONSTRAINT`); (6) reporting must support UBD-only, TVM-only, and consolidated multi-entity reporting without merging underlying identity.<br/>*(Governance Note: The architectural design clarification is documented, but the formal decision remains **OPEN** pending explicit approval evidence. Actual database migrations, TypeORM implementation, and tax coding remain strictly **UNAUTHORIZED**).* | Architecture specification and PMO / Finance Lead approval for immutable project-derived `company_code` inheritance and reporting contracts. | Solution Architect & PMO | `OPEN — ARCHITECTURAL DECISION (DESIGN CLARIFIED, PENDING FORMAL SIGN-OFF)` | **Foundational Dependency:** Blocks Phase 2B Step 3 Schema Migration and multi-entity database partitioning; does **not** block current single-tenant baseline operations. |
| **DEC-TAX-08** | **Payment Settlement Invariant Remediation** | Remediation of legacy payment Invariant 2/4 (`finance.service.ts#L968`) to allow net cash disbursement ($D_{\text{cash}}$) when statutory tax withholding ($W_{\text{tax}}$) is recognized, satisfying the Dual-Entry Settlement contract: $D_{\text{cash}} + W_{\text{tax}} == \text{term.amount}$. | Technical Design approval and finance architecture sign-off for the Dual-Entry Settlement Engine. | Lead Financial Systems Architect & Finance Lead | `OPEN — ARCHITECTURAL & TECHNICAL DECISION` | **Specific Functionality Only:** Blocks automated clearing of net vendor cash disbursements where tax is withheld; does **not** block standard gross payments where no tax is withheld ($W_{\text{tax}} = 0$). |

---

## 9. Confirmation of Preservation of F-01 through F-10 Technical Controls

This audit performed a line-by-line inspection of [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md) to confirm that the governance corrections did not alter or degrade any of the ten hardened technical controls established in Version 1.1.0:

| ID | Hardened Technical Control | Technical Design Section | Preservation Audit Evidence | Status |
|:---:|:---|:---|:---|:---:|
| **F-01** | Fail-Closed Tax Rule Activation | Section 4.3 & 8.1 | `tax_regime_rules` retains `verification_status: 'NOT_VERIFIED'` and `is_active: FALSE` defaults. Calculation engine throws fail-closed `UNVERIFIED_TAX_REGIME`. | **PRESERVED** |
| **F-02** | Legal Entity PKP Status Unassumed | Section 4.1 & 11.2 | `pkp_status` retains `ENUM('PKP', 'NON_PKP', 'UNVERIFIED')` with default `'UNVERIFIED'`. Neither entity assumed PKP. | **PRESERVED** |
| **F-03** | Single Withholding Ledger Ownership | Section 1.2, 5.1 & 12.1 | Finance is sole owner of `PphWithholdingRecord` and `StatutoryTaxLiability`. Payments owns cash disbursement and remittance execution proofs. | **PRESERVED** |
| **F-04** | Authentic 4-Way Matching Semantics | Section 9.2 & 10.1 | 4-Way Matching reconciles PO, fulfillment proof, vendor invoice, and e-Faktur. Internal header-detail equality audited separately under CP1.2-04. | **PRESERVED** |
| **F-05** | Vendor Tax Profile Unverified States | Section 4.2 & 11.3 | Vendor tax residency, entity type, PKP status, and tax classification retain explicit `'UNVERIFIED'` defaults. Calculation blocks if critical attributes are unverified. | **PRESERVED** |
| **F-06** | Regime & Statutory Trigger Consistency | Section 7.1, 7.2 & 10.4 | PPh 21, 22, 23, Final Construction, Final UMKM, and Rental triggers decoupled from internal invoice verification. Retention marked `OPEN — LEGAL VERIFICATION REQUIRED`. | **PRESERVED** |
| **F-07** | Non-Universal PPN/DPP Formulas | Section 6.1 & 6.2 | Standard DPP, DPP Nilai Lain ($11/12$), and Besaran Tertentu ($1.2\%$) explicitly parameterized with regime codes and transaction dates. Blanket formulas eliminated. | **PRESERVED** |
| **F-08** | Mixed Contract Component Classification | Section 4.4, 7.1 & 9.1 | Item-level classification (`item_category: MATERIAL \| SERVICE`) preserved in `invoice_item_tax_details`. Single contract can hold multiple tax regimes. | **PRESERVED** |
| **F-09** | Authoritative Company Ownership Derivation | Section 11.1 & 12.1 | `company_code` derived strictly from project/tender ownership. Default, inferred, or client-overridden company codes strictly prohibited. | **PRESERVED** |
| **F-10** | Withholding vs Remittance Traceability | Section 1.2, 5.2 & 12.2 | Commercial debt closure ($L_{\text{rem\_comm}} = \text{Rp } 0$) decoupled from sovereign tax liability closure ($L_{\text{tax\_stat}} = \text{Rp } 0$). Vendor payment is explicitly not sovereign remittance. | **PRESERVED** |

---

## 10. Remaining Open Decisions and Governance Trajectory

### 10.1 Status Summary
All eight canonical decisions remain **OPEN** and correctly assigned to their respective corporate authorities:
- **Business / Legal Decisions (5):** `DEC-TAX-01`, `DEC-TAX-02`, `DEC-TAX-03`, `DEC-TAX-04`, `DEC-TAX-05`.
- **Business / Procurement Decision (1):** `DEC-TAX-06`.
- **Architectural / Technical Decisions (2):** `DEC-TAX-07`, `DEC-TAX-08`.

### 10.2 Granular Functionality-Blocking Policy
By enforcing granular blocking scopes, EPMS guarantees that:
1. Commercial procurement operations (PR, PO, GR, SPK, BAST) continue unimpeded.
2. Standard invoice registration and commercial three-way matching remain fully operational.
3. Only the specific automated tax behavior dependent on an open decision is withheld:
   - Without `DEC-TAX-01`, Input VAT crediting is blocked; standard invoice logging continues.
   - Without `DEC-TAX-02`, WAPU VAT withholding is blocked; full invoice amount (commercial + PPN) is paid to vendor.
   - Without `DEC-TAX-03`, automated retention withholding is held; standard non-retention invoicing continues.
   - Without `DEC-TAX-04`, DP amortized tax calculation is held; regular invoices continue.
   - Without `DEC-TAX-05`, automated crediting is held; vendor AP balance is unaffected.
   - Without `DEC-TAX-06`, construction tier rate defaults to fail-closed unverified; general vendor purchases continue.
   - `DEC-TAX-07` is the **only foundational dependency** (multi-company schema partitioning into `'UBD'` and `'TVM'` under a single shared tax calculation engine), blocking the execution of multi-company database migrations in Phase 2B Step 3.
   - Without `DEC-TAX-08`, automated clearing of net payments with tax withholding is blocked; gross payments continue.

---

## 11. Implementation Authorization Status

```
+========================================================================================================================+
|                                        IMPLEMENTATION AUTHORIZATION STATUS                                             |
+========================================================================================================================+
```

> [!CAUTION]
> **GATE STATUS: HARD-BLOCKED — ZERO IMPLEMENTATION AUTHORIZED**  
> In strict accordance with EPMS Phase 2B governance protocols:
> 1. **Zero Software Implementation:** No backend or frontend application code has been written, modified, or staged.
> 2. **Zero Database Modifications:** No database migrations, schema DDL scripts, or TypeORM entities have been created, modified, or executed.
> 3. **Step 3 Gate Enforced:** Phase 2B Step 3 (Entity & Schema Migration Specification) remains strictly **UNAUTHORIZED**.
> 4. **Pre-Implementation Requirement:** Advancing beyond this design checkpoint requires formal executive review, CFO and Legal sign-off on the canonical Decision Register, and an explicit, separate implementation directive.

---

## 12. Final Conclusion and Audit Verdict

### 12.1 Audit Verdict
**VERDICT: PASS / GOVERNANCE CONSISTENCY VERIFIED**

The governance correction pass for Phase 2B Step 2 has been executed in complete alignment with all governing instructions:
1. Canonical identities for `DEC-TAX-01` through `DEC-TAX-08` are fully restored and cross-referenced.
2. PKP status semantics are rigorously defined, preventing premature assumptions of PKP or NON_PKP status.
3. WAPU status is confirmed as a technical safety default (`is_wapu = FALSE`) rather than a legal conclusion.
4. The Three-Tier Statutory Taxonomy clearly separates established project design rules, proposed technical treatments, and unresolved legal interpretations.
5. All ten hardened technical calculation controls (F-01 through F-10) remain 100% intact.
6. The repository worktree remains completely clean of unauthorized changes.

---
*(End of Governance Correction Audit Report v1.0.0)*

