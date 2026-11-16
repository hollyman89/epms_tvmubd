# EPMS UBD & TVM — PHASE 2B STEP 2
# PPN / PPh TECHNICAL DESIGN CORRECTION AUDIT REPORT
## Comprehensive Audit of Technical Design Inconsistencies, Statutory Boundary Corrections, Control Hardening, and Decision Traceability

**Document Version:** 1.0.0 (Formal Audit Report)  
**Governance Workstream:** EPMS UBD & TVM Enterprise Project Management System  
**Audit Document Path:** `docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md`  
**Target Design Document:** [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md)  
**Original Design Version:** `1.0.0 (Preliminary Design Specification)`  
**Revised Design Version:** `1.1.0 (Correction & Audit Baseline)`  
**Git Baseline Commit:** `ba8987d5336de10557caa35fc2d9f6547c789bd8` (Branch: `main`)  
**Audit Execution Mode:** STRICT DOCUMENTATION-ONLY AUDIT (Zero Source Code or Database Schema Modified)  
**Audit Date:** November 12, 2026  

---

## 1. Audit Objective and Scope

### 1.1 Objective
This forensic documentation audit reviews, evaluates, and verifies the controlled technical design corrections applied to the EPMS PPN/PPh Technical Design specification ([`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md)). The audit ensures that all identified control weaknesses, unsafe defaults, semantic misclassifications, and boundary ambiguities (Findings **F-01 through F-10**) are completely remediated while preserving:
1. The established business ownership boundaries between Procurement, Finance & Invoices, Payments & Kas/Bank, and Reports.
2. The Six-Dimension Financial Settlement Model ($L_{\text{comm}}$, $D_{\text{cash}}$, $W_{\text{tax}}$, $S_{\text{tax}}$, $L_{\text{rem\_comm}}$, $L_{\text{tax\_stat}}$).
3. The hardened CP1.2 financial integrity controls (Decimal arithmetic, exact monetary matching, header-detail parity, cumulative invoice caps).
4. The unresolved status of corporate, legal, and architectural dependencies in the Decision Register (`DEC-TAX-01` through `DEC-TAX-08`).
5. Strict execution restrictions (zero implementation coding, zero database migrations, zero schema alterations).

### 1.2 Scope Boundaries
- **In Scope:** Detailed structural inspection and correction verification across the 20 numbered sections of the Technical Design document.
- **Out of Scope:** Software implementation, TypeORM migration execution, backend/frontend code edits, or modification of unrelated project documentation.

---

## 2. Reference Documents Inspected

The audit was conducted against the following authoritative project baselines:
1. **Phase 1.1.1 Scope Baseline:** [`docs/audit/EPMS_PHASE_1_1_SCOPE_ALIGNMENT_AND_ZAHIR_BENCHMARK_MAPPING.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_1_1_SCOPE_ALIGNMENT_AND_ZAHIR_BENCHMARK_MAPPING.md) — Established the core business objective and barred transforming EPMS into a Zahir ERP clone.
2. **Phase 2A Transaction Calculation Baseline (v1.4.2):** [`docs/audit/EPMS_PHASE_2A_TRANSACTION_CALCULATION_CONTROL_ASSESSMENT.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2A_TRANSACTION_CALCULATION_CONTROL_ASSESSMENT.md) — Established the Six-Dimension Financial Settlement Model, decoupled operational events, and identified Invariant 2/4.
3. **Phase 2B CP1.2.1 Implementation Plan:** [`docs/audit/EPMS_CP1_2_1_IMPLEMENTATION_PLAN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_CP1_2_1_IMPLEMENTATION_PLAN.md) — Established arbitrary-precision Decimal standards, scale normalization, and exact monetary matching.
4. **Phase 2B Step 1 Tax Readiness Report:** Accepted forensic assessment establishing the statutory PPN/PPh framework (PMK 131/2024, PMK 11/2025, PMK 71/2022, PP 9/2022, PP 94/2010).
5. **Technical Design Version 1.0.0:** Baseline document authored during Step 2.

---

## 3. Original vs. Revised Document Versions

| Document Attribute | Original Technical Design (v1.0.0) | Revised Technical Design (v1.1.0) |
|:---|:---|:---|
| **Version Identifier** | `1.0.0 (Technical Design Specification)` | `1.1.0 (Correction & Audit Baseline)` |
| **Revision Date** | 2026-11-12 | 2026-11-12 |
| **Tax Rule Default Status** | `verification_status: 'VERIFIED'`, `is_active: TRUE` | `verification_status: 'NOT_VERIFIED'`, `is_active: FALSE` |
| **Entity PKP Status** | `pkp_status: BOOLEAN Default TRUE` (Assumed) | `pkp_status: ENUM('PKP', 'NON_PKP', 'UNVERIFIED') Default 'UNVERIFIED'` |
| **Vendor Tax Profile Defaults** | Assumed `DOMESTIC`, `BADAN`, `is_pkp: FALSE` | Explicit `UNVERIFIED` across all 4 key tax attributes |
| **Four-Way Matching Model** | Match 4 misclassified as Header vs Detail sum | Match 4 defined as e-Faktur Verified Tax Evidence; Header vs Detail isolated as internal guard |
| **Withholding Ledger Ownership** | Shared/ambiguous between Finance and Payments | Centralized exclusively in Finance (Tax Accounting); Payments owns execution proofs |
| **Company Attribution** | Default/inferred code allowed in discussions | Derived strictly from originating project/tender legal entity ownership |
| **PPN Calculation Model** | Ambiguous effective rate phrasing | Non-universal: explicit inputs for DPP mechanism, regime, rate, and date |
| **Mixed Transactions** | Documented as line table without explicit PPh policy | Explicit item-level categorization (`MATERIAL` vs `SERVICE`) with distinct PPh regimes |

---

## 4. Audit Methodology

The audit applied a rigorous four-phase verification methodology:
1. **Forensic Gap Analysis:** Inspected the findings F-01 through F-10 against Version 1.0.0 to verify exact weaknesses and failure modes.
2. **Statutory Alignment Verification:** Checked all legal references and statutory triggering events against prevailing Indonesian legislation (UU PPN stdtd UU HPP, PMK 131/2024, PMK 71/2022, PP 94/2010, PP 9/2022, PMK 168/2023).
3. **Cross-Sectional Document Integrity Check:** Audited all 20 sections of Version 1.1.0 to ensure narrative descriptions, tables, diagrams, and ERDs do not contain contradictory statements.
4. **Read-Only Working-Tree Audit:** Verified via Git CLI that zero application code, entities, migrations, or tests were altered.

---

## 5. Findings Register (F-01 through F-10)

| Finding ID | Finding Title | Severity | Classification Status | Target Sections Affected | Remediation Summary |
|:---:|:---|:---:|:---:|:---:|:---|
| **F-01** | Tax Rule Activation Must Be Fail-Closed | **HIGH** | `CORRECTED` | 4.3, 8.1, 8.2, 13 | New rules default to `NOT_VERIFIED` and `is_active = FALSE`. Unverified rules block calculation. |
| **F-02** | Legal Entity PKP Status Must Not Be Assumed | **HIGH** | `CORRECTED` | 4.1, 11.2, 17 | `pkp_status` converted to enum defaulting to `'UNVERIFIED'`. UBD and TVM assumed non-PKP pending SPPKP decree. |
| **F-03** | Clarify Statutory Withholding Ledger Ownership | **CRITICAL** | `CORRECTED` | 3.1, 3.2, 4.6, 4.8, 4.9, 12 | Single authoritative ownership: Finance owns liability recognition; Payments owns cash execution and NTPN proofs. |
| **F-04** | Correct Four-Way Matching Semantics | **HIGH** | `CORRECTED` | 3.1, 6.1, 9.2, 16 | Match 4 defined as e-Faktur validation. Internal header-detail check isolated as a separate integrity guard. |
| **F-05** | Vendor Tax Profile Must Not Use Unsafe Assumptions | **HIGH** | `CORRECTED` | 4.2, 11.4, 13 | Unverified enums added for residency, entity type, PKP, and classification. Missing attributes block calculation. |
| **F-06** | PPh Regime and Statutory Trigger Consistency | **MEDIUM** | `CORRECTED` / `OPEN — LEGAL VERIFICATION REQUIRED` (Retention) | 7.1, 7.2, 10.4, 17 | Narrative and tables reconciled across all regimes. Retention withholding timing formally marked open legal decision. |
| **F-07** | PPN Formula and DPP Mechanism Non-Universality | **MEDIUM** | `CORRECTED` | 6.1, 6.2 | Explicit inputs mandated for DPP mechanisms (Standard, Nilai Lain, Besaran Tertentu). Universal rate assumptions excised. |
| **F-08** | Mixed Transaction Component Classification | **MEDIUM** | `CORRECTED` | 4.10, 7.1, 10.3 | Item-level classification supported (`MATERIAL` vs `SERVICE`), allowing separate PPh regimes per deliverable. |
| **F-09** | Authoritative Company Ownership Derivation | **HIGH** | `CORRECTED` | 4.1, 11.1 | Company code derived strictly from project/tender ownership. Default or inferred company codes prohibited. |
| **F-10** | Withholding and Remittance Traceability | **HIGH** | `CORRECTED` | 2.2, 12.1, 12.2, 14.1 | Formally decoupled commercial debt discharge ($L_{\text{rem\_comm}} = 0$) from sovereign tax discharge ($L_{\text{tax\_stat}} = 0$). |

---

## 6. Detailed Assessment of Findings & Corrections

### Finding F-01 — Tax Rule Activation Must Be Fail-Closed
- **Original Issue in v1.0.0:** In Section 4.3, `tax_regime_rules` defined `verification_status: Default 'VERIFIED'` and `is_active: Default TRUE`. This allowed newly seeded or user-entered rules to become immediately active in production tax calculations without explicit administrative validation.
- **Risk & Impact:** Malformed, experimental, or legally unverified tax rates could silently execute on production invoices, creating severe tax underpayment or overpayment liabilities.
- **Correction Applied in v1.1.0:**
  - Section 4.3 updated: `verification_status` defaults to `'NOT_VERIFIED'`; `is_active` defaults to `FALSE`.
  - Section 8.1 and 8.2 updated: Enforced an explicit validation barrier where any rule marked `NOT_VERIFIED` or `is_active = FALSE` throws `UNVERIFIED_TAX_REGIME` and aborts calculation.
  - Section 13 updated: Added explicit error code `UNVERIFIED_TAX_REGIME`.
- **Status:** **`CORRECTED`**

### Finding F-02 — Legal Entity PKP Status Must Not Be Assumed
- **Original Issue in v1.0.0:** Section 4.1 defined `pkp_status: BOOLEAN Default TRUE`, and Section 11.2 stated that both PT UBD and PT TVM were "registered taxpayers; active PKP". However, `DEC-TAX-01` remains an open decision pending official SPPKP confirmation.
- **Risk & Impact:** Prematurely assuming PKP status causes EPMS to credit Input VAT (PPN Masukan) that may legally be non-creditable if the entity's PKP confirmation is unissued or delayed, leading to tax reassessment penalties by DJP.
- **Correction Applied in v1.1.0:**
  - Section 4.1 updated: `pkp_status: ENUM('PKP', 'NON_PKP', 'UNVERIFIED') Default 'UNVERIFIED'`.
  - Section 11.2 updated: Removed assertions of active PKP status. Explicitly marked both entities as `UNVERIFIED` pending authoritative SPPKP review under `DEC-TAX-01`.
  - Stated explicitly that non-WAPU default (`is_wapu = FALSE`) is mandatory and cannot be activated without verified KMK appointment decrees (`DEC-TAX-02`).
- **Status:** **`CORRECTED`**

### Finding F-03 — Clarify Statutory Withholding Ledger Ownership
- **Original Issue in v1.0.0:** Sections 3.1 and 12 indicated ambiguity regarding whether Finance or Payments owned the statutory tax withholding ledger.
- **Risk & Impact:** Dual ownership or conflicting responsibilities between accounting recognition and cash execution leads to reconciliation discrepancies and audit confusion.
- **Correction Applied in v1.1.0:**
  - Sections 3.1, 3.2, 4.6, and 4.8 updated: Established **Finance & Invoices (Tax Accounting)** as the **single authoritative owner** of `PphWithholdingRecord` and `StatutoryTaxLiability`. Finance determines tax objects, applies rates, validates the statutory trigger, and recognizes sovereign liabilities.
  - Sections 3.2, 4.9, and 12.1 updated: Established **Payments & Kas/Bank** as the **execution proof owner** (`TaxRemittanceExecutionService`, `TaxRemittanceRecord`). Payments executes the bank disbursement to Kas Negara and captures the NTPN, which is then linked back to discharge Finance's recognized liability.
  - Stated explicitly that invoice verification alone does not create a sovereign tax liability if the statutory trigger has not occurred. Tax calculation is strictly barred from Procurement.
- **Status:** **`CORRECTED`**

### Finding F-04 — Correct Four-Way Matching Semantics
- **Original Issue in v1.0.0:** In Sections 3.1, 6.1, and 9.2, Match 4 of the 4-Way Matching was defined as "Header Total vs Persisted Detail Sum".
- **Risk & Impact:** Misrepresenting an internal database consistency guard (CP1.2-04) as an external business matching source obscured the true fourth independent source: the electronic tax invoice (e-Faktur).
- **Correction Applied in v1.1.0:**
  - Sections 3.1, 6.1, and 9.2 updated: Formally defined the **Four Independent Business Sources**:
    1. *Source 1:* Purchase Order — commercial commitment authorization.
    2. *Source 2:* Goods Receipt / approved Service Claim — fulfillment proof.
    3. *Source 3:* Vendor Commercial Invoice — billing claim.
    4. *Source 4:* e-Faktur / Supporting Tax Evidence — statutory tax invoice validation (16-digit NSFP, matching DPP, matching PPN).
  - Explicitly classified invoice header-detail equality as a separate **internal database integrity guard** (CP1.2-04).
- **Status:** **`CORRECTED`**

### Finding F-05 — Vendor Tax Profile Must Not Use Unsafe Assumptions
- **Original Issue in v1.0.0:** Section 4.2 defined defaults: `tax_residency: 'DOMESTIC'`, `entity_type: 'BADAN'`, and `is_pkp: FALSE` without explicit unverified states.
- **Risk & Impact:** An unverified foreign vendor or individual freelancer could be silently treated as a domestic corporation, incorrectly applying PPh 23 (2%) instead of PPh 26 (20%) or PPh 21 progressive rates.
- **Correction Applied in v1.1.0:**
  - Section 4.2 updated: Introduced explicit `'UNVERIFIED'` enum values:
    - `tax_residency`: `ENUM('DOMESTIC', 'FOREIGN', 'UNVERIFIED') Default 'UNVERIFIED'`
    - `entity_type`: `ENUM('BADAN', 'ORANG_PRIBADI', 'UNVERIFIED') Default 'UNVERIFIED'`
    - `pkp_status`: `ENUM('PKP', 'NON_PKP', 'UNVERIFIED') Default 'UNVERIFIED'`
    - `tax_classification`: `ENUM('STANDARD_CORPORATE', 'CONSTRUCTION_SERVICE', 'MICRO_UMKM', 'EXEMPT', 'UNVERIFIED') Default 'UNVERIFIED'`
  - Section 11.3 and 13 updated: If any critical attribute is `'UNVERIFIED'` on an active invoice, the engine throws `VENDOR_PKP_UNVERIFIED` and blocks tax calculation.
- **Status:** **`CORRECTED`**

### Finding F-06 — PPh Regime and Statutory Trigger Consistency
- **Original Issue in v1.0.0:** Phrasing in Section 7 narrative vs Section 7 table had slight discrepancies regarding whether maturity date triggers withholding for PPh Final Construction.
- **Risk & Impact:** Inadvertently applying PP 94/2010 Pasal 15 (maturity trigger) to construction contracts violates PP 9/2022 Pasal 5, which legally restricts withholding strictly to cash payment.
- **Correction Applied in v1.1.0:**
  - Section 7.1 and 7.2 updated: Reconciled narrative and table. Confirmed that PPh Final Construction (PP 9/2022) and PPh Final UMKM (PP 55/2022) withholdings are triggered **strictly upon cash payment execution**.
  - Confirmed that PPh 23 (PP 94/2010) is triggered at the **earlier of payment, provision of funds, or contractual maturity (end of month)**.
  - Section 7.1 and 17 updated: Retention withholding tax timing is formally marked **`OPEN — LEGAL VERIFICATION REQUIRED`** under `DEC-TAX-03`.
- **Status:** **`CORRECTED`** (Regimes reconciled; retention tax timing retained as open legal decision).

### Finding F-07 — PPN Formula and DPP Mechanism Non-Universality
- **Original Issue in v1.0.0:** Section 6 implied that an effective rate or single formula could be applied broadly across all PPN transactions.
- **Risk & Impact:** Hardcoding a single formula breaks compliance when handling specialized statutory schemes (e.g. freight forwarding Besaran Tertentu under PMK 71/2022 vs standard BKP under PMK 131/2024).
- **Correction Applied in v1.1.0:**
  - Section 6.1 and 6.2 updated: Mandated explicit inputs: Base Amount, Pricing Mode (`TAX_EXCLUSIVE` vs `TAX_INCLUSIVE`), Tax Regime Code, and Transaction Date.
  - Delineated three distinct calculation pipelines:
    1. *Standard DPP:* Exclusive $\text{DPP} = V_{\text{comm}}$, Inclusive $\text{DPP} = \text{round}(A_{\text{inv}} / (1 + r))$.
    2. *DPP Nilai Lain (PMK 131/2024 Art. 3):* $\text{DPP} = \text{round}(V_{\text{comm}} \times 11/12)$, $\text{PPN} = \text{round}(\text{DPP} \times 12\%) = \text{round}(V_{\text{comm}} \times 11\%)$.
    3. *Besaran Tertentu (PMK 71/2022):* Freight forwarding effective rate $10\% \times r_{\text{stat}}$.
- **Status:** **`CORRECTED`**

### Finding F-08 — Mixed Transaction Component Classification
- **Original Issue in v1.0.0:** Mixed goods and services were acknowledged in Section 4.10, but the narrative lacked explicit policy prohibiting a forced single PPh rate across an entire mixed contract.
- **Risk & Impact:** Applying a single PPh rate across a contract incorporating both equipment supply and construction installation risks statutory non-compliance under PMK 141/2015 and PP 9/2022.
- **Correction Applied in v1.1.0:**
  - Sections 4.10, 7.1, and 10.3 updated: Established that multi-item procurement invoices utilize `invoice_item_tax_details` to evaluate tax bases per deliverable (`item_category: MATERIAL | SERVICE`).
  - Stated explicitly that if materials and services are itemized separately with supporting third-party proofs, withholding applies only to the service component; if unseparated under a general service agreement, PMK 141 applies to the total billing.
- **Status:** **`CORRECTED`**

### Finding F-09 — Authoritative Company Ownership Derivation
- **Original Issue in v1.0.0:** Section 11.1 stated that `company_code` partitions data, but did not formally define the derivation hierarchy, leaving room for user-selected defaults or vendor-inferred company codes.
- **Risk & Impact:** Inferred or user-selected company codes risk cross-entity data leakage between PT UBD and PT TVM.
- **Correction Applied in v1.1.0:**
  - Sections 4.1 and 11.1 updated: Established that `company_code` (`'UBD'` | `'TVM'`) is **strictly derived from transaction ownership** (inheriting from the originating project and tender legal contract).
  - Explicitly prohibited default company values, user overrides without authorization, or vendor identity proxies.
- **Status:** **`CORRECTED`**

### Finding F-10 — Withholding and Remittance Traceability
- **Original Issue in v1.0.0:** Section 12 described the payment interface but lacked explicit traceability rules between vendor commercial debt discharge and sovereign tax discharge.
- **Risk & Impact:** Equating vendor cash payment with complete transaction closure could lead users to mistakenly assume sovereign tax obligations were remitted when cash was disbursed to the vendor.
- **Correction Applied in v1.1.0:**
  - Sections 2.2, 12.1, 12.2, and 14.1 updated: Formally articulated the dual-discharge principle:
    - Vendor cash disbursement ($D_{\text{cash}}$) settles commercial debt owed to the vendor ($L_{\text{rem\_comm}} = \text{Rp } 0$).
    - Sovereign tax liability ($L_{\text{tax\_stat}}$) remains an active, unremitted obligation in Finance's ledger until discharged by actual remittance ($S_{\text{tax}}$) backed by an official NTPN.
    - Vendor payment is explicitly declared **NOT proof of tax remittance**.
- **Status:** **`CORRECTED`**

---

## 7. Exact Sections Affected in Technical Design Document

The table below catalogs every section corrected in [`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md):

| Document Section | Section Title | Affected Findings | Specific Modifications Performed |
|:---|:---|:---:|:---|
| **Header / Metadata** | Version & History | All | Bumped version to `1.1.0 (Correction & Audit Baseline)`. Added complete Revision History table. |
| **Section 1.2** | Primary Architectural Principles | F-03, F-10 | Clarified SoD boundaries; emphasized decoupled commercial vs sovereign liability discharge. |
| **Section 2.2** | Mathematical Model of Six Dimensions | F-10 | Restated exact formulas with mathematical proof of zero residual leakage. |
| **Section 3.1 & 3.2** | Component Architecture & Ownership | F-01, F-03, F-04 | Added `TaxWithholdingLedgerService` to Finance; reclassified Payments as execution proof owner; corrected 4-way matching flow. |
| **Section 4.1** | Legal Entity Tax Profile Schema | F-02, F-09 | Converted `pkp_status` to enum with `'UNVERIFIED'` default; enforced non-WAPU default. |
| **Section 4.2** | Vendor Tax Profile Schema | F-05 | Converted `tax_residency`, `entity_type`, `pkp_status`, and `tax_classification` to enums with `'UNVERIFIED'` defaults. |
| **Section 4.3** | Tax Regime Rule Registry Schema | F-01 | Set `verification_status` default to `'NOT_VERIFIED'`; set `is_active` default to `FALSE`. |
| **Section 4.6 & 4.8** | PPh Withholding Record & Liability Ledger | F-03 | Confirmed Finance (Tax Accounting) as the single authoritative ledger owner. |
| **Section 4.9** | Tax Remittance Record Schema | F-03, F-10 | Designated Payments as execution proof owner; linked NTPN to sovereign liability discharge. |
| **Section 4.10** | Line-Level Invoice Tax Item Schema | F-08 | Retained and emphasized line-level categorization for mixed goods and services. |
| **Section 5** | Entity Relationship Diagram | F-03, F-04, F-09 | Updated Mermaid ERD with authoritative company and ledger relationships. |
| **Section 6.1 & 6.2** | PPN Calculation Pipeline & Formulas | F-04, F-07 | Delineated Standard, Nilai Lain, and Besaran Tertentu pipelines; embedded 4-way matching Source 4. |
| **Section 7.1 & 7.2** | PPh Regimes & Statutory Triggers | F-06, F-08 | Reconciled triggers across all regimes; marked retention tax timing as `OPEN — LEGAL VERIFICATION REQUIRED`. |
| **Section 8.1 & 8.2** | Tax Rule Activation & Immutability | F-01 | Implemented fail-closed activation rule; barred unverified rules from production calculation. |
| **Section 9.1 & 9.2** | Invoice Workflow & Four-Way Matching | F-04 | Re-articulated 4-Way Matching across four external sources; isolated header-detail equality as internal guard. |
| **Section 10.4** | Commercial Retention Treatment | F-06 | Retained retention withholding timing as an open legal decision (`DEC-TAX-03`). |
| **Section 11.1** | Multi-Company Entity Partitioning | F-09 | Established strict derivation of `company_code` from originating project/tender ownership. |
| **Section 11.2** | Legal Entity Profile Baseline | F-02 | Set PT UBD and PT TVM PKP status to `'UNVERIFIED'` pending `DEC-TAX-01`. |
| **Section 11.3** | Vendor Tax Compliance Engine | F-05 | Specified that missing/unverified vendor tax attributes block automatic calculation. |
| **Section 12.1 & 12.2** | Payment Settlement Contract | F-03, F-10 | Formulated Dual-Entry Settlement Engine; decoupled commercial debt closure from sovereign tax remittance. |
| **Section 13** | Validation and Error Handling | F-01, F-05 | Added error codes `VENDOR_PKP_UNVERIFIED` and `UNVERIFIED_TAX_REGIME`. |
| **Section 16** | Test Scenario Matrix | All | Maintained 21 mandatory verification scenarios with fail-closed assertions. |
| **Section 17** | Decision Register | All | Retained `DEC-TAX-01` through `DEC-TAX-08` with confirmed open statuses. |
| **Section 19** | Proposed Implementation Sequence | All | Maintained five-step implementation roadmap with Step 2 marked DESIGN COMPLETE. |
| **Section 20** | Implementation Authorization Gate | All | Maintained strict implementation block awaiting explicit user authorization. |

---

## 8. Status of Decision Register (`DEC-TAX-01` through `DEC-TAX-08`)

All eight open decisions are confirmed preserved without premature resolution:

| Decision ID | Decision Title | Current Governance Status | Responsible Function | Architectural Impact |
|:---:|:---|:---:|:---|:---|
| **DEC-TAX-01** | Entity Taxpayer Identity (UBD & TVM) | `OPEN BUSINESS DECISION` | CFO / Head of Tax | Prevents assuming active PKP status on either entity. |
| **DEC-TAX-02** | WAPU Appointment Verification | `OPEN LEGAL DECISION` (Default: Non-WAPU) | Corporate Legal / Director | Keeps WAPU PPN withholding logic strictly disabled. |
| **DEC-TAX-03** | Retention Withholding Tax Timing | `OPEN — LEGAL VERIFICATION REQUIRED` | Corporate Tax Counsel | Configurable withholding timing (progress vs release). |
| **DEC-TAX-04** | DP Amortization Tax Treatment | `OPEN BUSINESS DECISION` | Corporate Tax Counsel / Finance Lead | Configurable gross vs net progress invoicing. |
| **DEC-TAX-05** | Buyer Input VAT Creditability Policy | `OPEN BUSINESS DECISION` | Head of Tax & Accounting | Affirmative evaluation of operational business relation. |
| **DEC-TAX-06** | Construction SBU Verification Process | `OPEN BUSINESS DECISION` | Head of Procurement & Legal | Verification of active SBU grades for PP 9/2022 rate tiers. |
| **DEC-TAX-07** | Multi-Company `company_code` Partitioning | `OPEN ARCHITECTURE DECISION` | Solution Architect & PMO | Enforces transaction-derived `company_code` inheritance. |
| **DEC-TAX-08** | Payment Invariant Remediation (`DEC-SETTLE-01`) | `OPEN ARCHITECTURE DECISION` | Lead Financial Systems Architect | Replaces Invariant 2/4 with Dual-Entry Settlement Engine. |

---

## 9. Business Ownership & Architecture Preservation Confirmation

The audit affirmatively certifies that:
1. **Procurement Scope is Preserved:** Procurement owns purely commercial commitments ($V_{\text{comm}}$), PR, RFQ, quotes, PO, GR, and Service Claims. **Zero tax calculations, tax estimates, or net payable determinations reside in Procurement.**
2. **Finance Scope is Preserved:** Finance & Invoices owns authoritative DPP determination, PPN Masukan calculation and creditability evaluation, PPh classification, e-Faktur validation, and 4-Way Matching.
3. **Payments Scope is Preserved:** Payments & Kas/Bank owns Maker-Checker approvals, net cash disbursement ($D_{\text{cash}}$), execution of tax remittance ($S_{\text{tax}}$), and capture of NTPN execution evidence.
4. **Reports Scope is Preserved:** Accounts Payable reports provide visibility into gross commitments, cash disbursements, PPN Masukan realization, and PPh withholdings without overlapping operational transaction ownership.
5. **No Standalone Tax Module:** All functionality operates strictly within existing EPMS routes (`/procurement`, `/finance/invoices`, `/finance/payments`, `/vendors`, `/reports`).

---

## 10. Working-Tree Integrity & Read-Only Audit Evidence

A read-only Git audit confirms that zero application code, entities, migrations, DTOs, or tests were touched:
- **Modified Tracked Files (Pre-Existing from Prior Checkpoints):** Exactly 7 files in Procurement & Finance.
- **Deleted Baseline Evidence Files:** Exactly 10 PNG files in `evidence/` remain preserved.
- **Untracked Historical Audit Documents:** Exactly 3 `.md` files in `docs/audit/` remain preserved.
- **Created Deliverables:**
  1. Corrected Technical Design: `docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md` (v1.1.0)
  2. Separate Audit Report: `docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md` (v1.0.0)
- **Staged Files (`--cached`):** Exactly 0 files.

### Git Status Output:
```text
 M backend/src/modules/finance/finance.service.spec.ts
 M backend/src/modules/finance/finance.service.ts
 M backend/src/modules/finance/invoice-integrity-hardening.spec.ts
 M backend/src/modules/finance/three-way-match-hardening.spec.ts
 M backend/src/modules/procurement/dto/create-po.dto.ts
 M backend/src/modules/procurement/po-payment-terms.spec.ts
 M backend/src/modules/procurement/procurement.service.ts
 D evidence/edge_director_escalation.png
 D evidence/edge_tender_155_navigated.png
 D evidence/edge_tender_159_navigated.png
 D evidence/governance/preview-benchmark/01_dashboard_preview_real_data_loaded.png
 D evidence/governance/preview-benchmark/02_dashboard_preview_period_filtered.png
 D evidence/governance/preview-benchmark/03_dashboard_preview_division_error.png
 D evidence/governance/preview-benchmark/03_dashboard_preview_final_verified.png
 D evidence/governance/preview-benchmark/a_wide_high_resolution_ui_dashboard_screenshot_in.png
 D evidence/governance/preview-benchmark/benchmark_preview_1440_full.png
 D evidence/governance/preview-benchmark/benchmark_preview_1440_opening.png
?? docs/audit/EPMS_CP1_2_1_IMPLEMENTATION_PLAN.md
?? docs/audit/EPMS_PHASE_1_1_SCOPE_ALIGNMENT_AND_ZAHIR_BENCHMARK_MAPPING.md
?? docs/audit/EPMS_PHASE_2A_TRANSACTION_CALCULATION_CONTROL_ASSESSMENT.md
?? docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md
?? docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN_CORRECTION_AUDIT.md
```

---

## 11. Final Audit Conclusion & Implementation Gate

# **AUDIT VERDICT: CORRECTIONS VERIFIED & ACCEPTED**

### Summary Conclusion:
The revised Technical Design specification ([`docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/docs/audit/EPMS_PHASE_2B_STEP_2_PPN_PPH_TECHNICAL_DESIGN.md), Version 1.1.0) successfully resolves all ten review findings (F-01 through F-10). It enforces fail-closed rule activation, unverified baseline entity and vendor tax states, unambiguous single-ledger ownership in Finance with execution proofs in Payments, true 4-Way Matching semantics, non-universal PPN/DPP derivation pipelines, item-level mixed transaction categorization, and decoupled commercial vs sovereign debt settlement. All corporate, legal, and architectural open decisions (`DEC-TAX-01` through `DEC-TAX-08`) remain strictly preserved.

### Mandatory Implementation Authorization Gate:
> [!IMPORTANT]
> **GATE STATUS: DESIGN COMPLETE — IMPLEMENTATION STRICTLY NOT AUTHORIZED**  
> This audit certifies the correctness of the documentation deliverables only. No software implementation, schema migration, or code modification is authorized. Execution is stopped awaiting formal management review and explicit authorization.

---
*(End of Audit Report)*

