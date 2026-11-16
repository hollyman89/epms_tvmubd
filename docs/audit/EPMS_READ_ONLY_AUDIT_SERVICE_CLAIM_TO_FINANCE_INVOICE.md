# EPMS READ-ONLY AUDIT REPORT
## SERVICE CLAIM TO FINANCE INVOICE ISSUANCE INVESTIGATION

- **Target Transaction:** Purchase Order `PO-20261109-002`
- **Project:** `PERCOBAAN PROGRES` (Project ID #88)
- **Vendor:** `PT IT Solusi Bersama` (Vendor ID #1)
- **Payment Term:** `Termin #1 – Pelunasan Penuh (100%)` (Term ID #21, Rp 33.652.500,00)
- **Investigation Type:** Strict Read-Only Static and Database Audit
- **Execution Date:** 2026-11-12

---

## 1. Executive Summary

A comprehensive, read-only audit was conducted to investigate why Finance cannot properly process or issue an Invoice for Purchase Order `PO-20261109-002` in the Finance Invoice issuance modal (`CreateInvoiceModal.tsx`).

### Reported Anomaly
When the Finance user opens the Invoice issuance modal for `PO-20261109-002`:
1. Three approved Service Claims are displayed in the dropdown:
   - `SCL-20261109-003` — Rp 12.000,00 — Evidence: `TRX-8657647822`
   - `SCL-20261109-002` — Rp 285.000,00 — Evidence: `TRX-8657647822`
   - `SCL-20261109-001` — Rp 33.355.500,00 — Evidence: `bandung juara`
   *(Total approved claims across all 3: Rp 33.652.500,00 — exactly equal to the 100% payment term amount).*
2. The modal top status card displays:
   - **Matching Status:** `PENDING VERIFIKASI`
   - **Status Message:** `Menunggu pemilihan Klaim Jasa`
3. The submit button displays:
   - **Button Text:** `Terbitkan Invoice Termin #1 (100.0%)`
   - **Button State:** Active / Clickable (Enabled) even before a Service Claim is selected.
4. **Issue:** Finance cannot issue the invoice. Clicking the button with no selection triggers a client-side toast error. Selecting any of the three claims results in immediate server rejection (`BadRequestException: Nilai invoice melebihi sisa kapasitas klaim jasa yang disetujui`).

### Core Audit Findings
1. **Frontend Cardinality & Eligibility Mismatch (Root Cause):**
   The frontend milestone and capacity evaluator (`CreateInvoiceModal.tsx`, lines 503–519 and 641–658) aggregates **all** approved Service Claims on the PO using `.reduce()`. Because the sum of all three claims equals the PO total ($33.652.500,00$), the frontend incorrectly reports the payment term as eligible (`isEligible = true`). However, the UI dropdown only permits selecting a **single** claim (`selectedServiceClaimId: number`), and the backend API strictly enforces a **1:1 relationship** where the single selected claim's remaining capacity must cover the entire payment term amount ($33.652.500,00$). Because each individual claim is strictly less than the payment term amount, selecting any option is guaranteed to fail backend validation.
2. **Frontend UI State Guard Defect:**
   In `CreateInvoiceModal.tsx` line 840, `isProgressBlocked` only guards `isProgressTerm`. For `FINAL_DELIVERY` terms (100% full settlement), `isProgressTerm` evaluates to `false`. Consequently, `isProgressBlocked` is `false`, leaving the submit button active/enabled even when `selectedServiceClaimId` is `undefined` and the UI explicitly reads `Menunggu pemilihan Klaim Jasa`.
3. **Backend Validation Integrity:**
   The backend service (`FinanceService.createInvoice`, lines 346–366) and matching engine (`evaluateMatching`, lines 1526–1534) operate strictly in accordance with their design, entity schema (`invoices.service_claim_id`), and unit test specifications (`service-invoice-matching.spec.ts`, line 475). The backend faithfully enforces that an invoice cannot exceed the approved remaining capacity of the single linked Service Claim.
4. **Operational & Contract Setup Disconnect:**
   PO `PO-20261109-002` was configured with a single 100% `FINAL_DELIVERY` payment term, yet field execution submitted three progressive service claims (99.12%, 0.85%, and 0.04%). Under the system's 1:1 invoice-to-service-claim architecture, progressive claims cannot be billed against a single 100% term without either consolidating the claims into a single 100% claim or configuring matching progressive payment terms.

---

## 2. Confirmed Root Cause

The root cause of the inability to issue an invoice is a **frontend defect in eligibility evaluation and UI guard logic**, compounded by an **architectural contract mismatch between frontend multi-claim aggregation and backend single-claim capacity enforcement**:

### Mechanism of Failure:
1. **Pre-Selection Failure (Premature Enablement):**
   - The user opens the modal. `selectedServiceClaimId` is `undefined`.
   - The UI evaluates line 840:
     ```typescript
     const isProgressBlocked = po?.orderType === 'SERVICE'
       ? (isProgressTerm && !selectedServiceClaimId)
       : (isProgressTerm && (!selectedGrId || progressInvoiceItems.length === 0));
     ```
   - For `Termin #1 – Pelunasan Penuh (100%)`, `termType` is `FINAL_DELIVERY`.
   - Therefore, `isProgressTerm` is `false`.
   - `isProgressBlocked` evaluates to `false`.
   - `activeTermEligibility.isEligible` evaluates to `true` because lines 641–644 summed all 3 claims together.
   - `isSubmitDisabled` evaluates to `false`. The primary action button `Terbitkan Invoice Termin #1 (100.0%)` is enabled and styled green (`#059669`).
   - If the user clicks this button, `handleSubmit` line 754 catches `if (!selectedServiceClaimId)` and blocks submission with `message.error('Wajib memilih Klaim Jasa yang telah disetujui (APPROVED_FOR_INVOICE) sebagai dasar penagihan jasa.')`. No request reaches the backend.

2. **Post-Selection Failure (Backend Capacity Rejection):**
   - The user opens the dropdown to select a claim. Three claims are available:
     - `SCL-20261109-001` (Rp 33.355.500,00) $\rightarrow$ Deficit: Rp 297.000,00
     - `SCL-20261109-002` (Rp 285.000,00) $\rightarrow$ Deficit: Rp 33.367.500,00
     - `SCL-20261109-003` (Rp 12.000,00) $\rightarrow$ Deficit: Rp 33.640.500,00
   - The user selects any claim (e.g., `SCL-20261109-001`).
   - The frontend sets `selectedServiceClaimId = 9`.
   - The displayed total invoice amount remains locked to `activeTerm.amount` ($33.652.500,00$).
   - The user clicks `Terbitkan Invoice Termin #1 (100.0%)`.
   - The frontend sends payload:
     `{ purchaseOrderId: 21, paymentTermId: 21, serviceClaimId: 9, invoiceDate: ..., items: [...] }`
   - The backend `FinanceService.createInvoice` receives the payload:
     - Authoritative invoice amount from term: `totalInvoiceDec = 33652500.00`.
     - Looks up single claim with ID 9: `approvedClaimDec = 33355500.00`.
     - Computes remaining capacity: `remainingClaimCapacityDec = 33355500.00`.
     - Executes line 362:
       ```typescript
       if (totalInvoiceDec.greaterThan(remainingClaimCapacityDec)) {
         throw new BadRequestException(
           `Nilai invoice (Rp${totalInvoiceDec.toNumber().toLocaleString('id-ID')}) melebihi sisa kapasitas klaim jasa yang disetujui (Tersedia: Rp${remainingClaimCapacityDec.toNumber().toLocaleString('id-ID')}, Disetujui: Rp${approvedClaimDec.toNumber().toLocaleString('id-ID')}, Sudah ditagihkan: Rp${alreadyInvoicedDec.toNumber().toLocaleString('id-ID')}).`
         );
       }
       ```
     - Transaction rolls back. Server returns HTTP 400.
     - Modal displays error banner: `Validasi Server Backend Menolak Penerbitan Invoice: Nilai invoice (Rp33.652.500) melebihi sisa kapasitas klaim jasa yang disetujui...`.

---

## 3. Frontend Execution Trace

- **Component:** `frontend/src/components/finance/CreateInvoiceModal.tsx`
- **Option Retrieval API:**
  - On mount / modal open with `po?.orderType === 'SERVICE'`, lines 189–207 execute:
    `ProcurementService.getServiceClaims({ poId: Number(poId), status: 'APPROVED_FOR_INVOICE' })`
  - Calls `GET /api/v1/procurement/service-claims?poId=21&status=APPROVED_FOR_INVOICE`.
  - Populates state `approvedServiceClaims` with the three records.
- **Dropdown Control:**
  - Lines 1154–1163 render Ant Design `<Select>`:
    ```tsx
    <Select
      placeholder="Pilih Klaim Jasa yang memvalidasi penagihan termin ini..."
      style={{ width: '100%', borderRadius: 6 }}
      value={selectedServiceClaimId}
      onChange={(val) => setSelectedServiceClaimId(val)}
      options={approvedServiceClaims.map((claim) => ({
        value: claim.id,
        label: `${claim.claimNumber} | Nilai Disetujui: Rp ${Number(claim.approvedClaimAmount || claim.totalClaimAmount || 0).toLocaleString('id-ID')} | Vendor: ${vendorName}${claim.acceptanceReference ? ` | Bukti: ${claim.acceptanceReference}` : ''}`,
      }))}
    />
    ```
  - Mode: **Single-select only** (no `mode="multiple"`).
  - Bound state: `selectedServiceClaimId: number | undefined` (line 90).
- **Invoice Amount Behavior:**
  - Lines 142–146 define `invoiceTotalAmount`:
    ```tsx
    const invoiceTotalAmount = useMemo(() => {
      if (activeTerm) {
        return Number(activeTerm.amount || 0);
      }
      return Number(po?.totalAmount || 0);
    }, [activeTerm, po]);
    ```
  - The invoice amount is **never** recalculated or adjusted based on the selected Service Claim. It remains locked to the payment term amount (Rp 33.652.500,00).
- **Capacity & Milestone Evaluation:**
  - Lines 503–519 (`evaluateMilestone`) and lines 641–658 (`getTermEligibility`) aggregate all claims:
    `totalApprovedClaimAmount = approvedServiceClaims.reduce((sum, c) => sum + Number(c.approvedClaimAmount || 0), 0)`.
  - Sum = Rp 33.652.500,00. Capacity check passes, marking the term ready.
- **Submit Button State & Guard:**
  - Lines 840–844:
    ```tsx
    const isProgressBlocked = po?.orderType === 'SERVICE'
      ? (isProgressTerm && !selectedServiceClaimId)
      : (isProgressTerm && (!selectedGrId || progressInvoiceItems.length === 0));
    const isTermIneligible = Boolean(activeTerm && !activeTermEligibility.isEligible);
    const isSubmitDisabled = !canCreateInvoice || isSubmitting || isProgressBlocked || isTermIneligible;
    ```
  - Because `activeTerm.termType === 'FINAL_DELIVERY'`, `isProgressTerm` is `false`.
  - Therefore, `isProgressBlocked` is `false`, and `isSubmitDisabled` is `false`.
  - The submit button is enabled even with zero claims selected.
- **Generated Payload:**
  - Lines 801–815 generate:
    ```json
    {
      "purchaseOrderId": 21,
      "paymentTermId": 21,
      "invoiceDate": "2026-11-12T16:06:27.000Z",
      "items": [
        { "poItemId": 66, "quantity": 78, "unitPrice": 170000, "totalPrice": 13260000 },
        { "poItemId": 67, "quantity": 2115, "unitPrice": 9500, "totalPrice": 20092500 },
        { "poItemId": 68, "quantity": 2, "unitPrice": 150000, "totalPrice": 300000 }
      ],
      "serviceClaimId": 9
    }
    ```

---

## 4. Backend Validation and Matching Engine

- **Target Files:**
  - `backend/src/modules/finance/finance.controller.ts`
  - `backend/src/modules/finance/finance.service.ts`
  - `backend/src/entities/invoice.entity.ts`
  - `backend/src/modules/finance/dto/create-invoice.dto.ts`

### Answers to Mandatory Backend Questions:

1. **Does one Invoice support exactly one Service Claim or multiple Service Claims?**
   - **EXACTLY ONE.**
   - In `backend/src/entities/invoice.entity.ts` lines 19–20 & 69–71:
     Column `service_claim_id` is a scalar `bigint unsigned nullable`, mapped to a `@ManyToOne(() => ServiceClaim)`.
   - In `backend/src/modules/finance/dto/create-invoice.dto.ts` lines 51–54:
     `serviceClaimId?: number` is a single number.
   - There is no junction table, no array field, and no multi-claim relational mapping in the backend.

2. **If only one claim is supported, must its approved value equal the payment term amount?**
   - **Yes, it must be $\ge$ the payment term amount.**
   - In `FinanceService.createInvoice` lines 358–366:
     `remainingClaimCapacityDec = max(0, approvedClaimDec - alreadyInvoicedDec)`
     `if (totalInvoiceDec.greaterThan(remainingClaimCapacityDec)) throw new BadRequestException(...)`
   - For a 100% full payment term, the invoice amount equals the PO total ($33.652.500,00$). Therefore, the selected claim's remaining approved amount must be at least $33.652.500,00$.

3. **If multiple claims are supported, how does the backend aggregate and validate their values?**
   - Multiple claims are **NOT supported** by the backend. The backend accepts only a single `serviceClaimId` and performs zero multi-claim aggregation during invoice creation.

4. **Can a claim be selected more than once or reused by another Invoice?**
   - During creation, lines 346–356 subtract prior active invoice totals from the claim's capacity (`alreadyInvoicedDec`).
   - However, during three-way matching (`evaluateMatching`, lines 1537–1555), the engine actively checks if another active invoice references the same `serviceClaimId` and flags `MismatchCode.OTHER` ("Service Claim sudah ditagihkan pada invoice aktif lain"). Consequently, claims are treated as strictly 1:1 with active invoices.

5. **What happens when the selected claim amount is lower than the payment term amount?**
   - The backend immediately aborts and throws `BadRequestException` (HTTP 400) at line 363:
     `"Nilai invoice (Rp33.652.500) melebihi sisa kapasitas klaim jasa yang disetujui..."`.

6. **Does the backend reject the request, or does it create an Invoice with `PENDING VERIFIKASI`?**
   - **It REJECTS the request.** The database transaction is rolled back. No invoice record is created.

7. **Is the matching result consistent between frontend and backend?**
   - **NO. Completely inconsistent.**
   - The frontend marks the milestone and capacity as valid (`[SIAP DITAGIHKAN]`) by summing all claims together.
   - The backend evaluates only the single claim passed in `serviceClaimId` and rejects it.

---

## 5. Amount Reconciliation

### Concrete Transaction Records from Database:

| Parameter | Database Value | Percentage of PO |
| :--- | :--- | :--- |
| **PO Total Amount** (`PO-20261109-002`) | **Rp 33.652.500,00** | 100,00% |
| **Payment Term #1** (`Pelunasan Penuh`) | **Rp 33.652.500,00** | 100,00% |
| **Service Claim 1** (`SCL-20261109-001`) | **Rp 33.355.500,00** | 99,117% |
| **Service Claim 2** (`SCL-20261109-002`) | **Rp 285.000,00** | 0,847% |
| **Service Claim 3** (`SCL-20261109-003`) | **Rp 12.000,00** | 0,036% |
| **Total Approved Service Claims** | **Rp 33.652.500,00** | **100,00%** |
| **Previously Invoiced Amount** | **Rp 0,00** | 0,00% |
| **Remaining Claimable Capacity (PO Sum)** | **Rp 33.652.500,00** | 100,00% |
| **Invoice Amount Generated by Frontend** | **Rp 33.652.500,00** | 100,00% |

### Explicit Calculation:
$$\begin{aligned}
\text{PO Item 66 (78 unit @ 170.000)} &= \text{Rp } 13.260.000,00 \\
\text{PO Item 67 (2115 m @ 9.500)} &= \text{Rp } 20.092.500,00 \\
\text{PO Item 68 (2 unit @ 150.000)} &= \text{Rp } 300.000,00 \\
\hline
\mathbf{\text{PO Total Amount}} &= \mathbf{\text{Rp } 33.652.500,00}
\end{aligned}$$

$$\begin{aligned}
\text{SCL-001 (Item 66 100\% + Item 67 100\% + Item 68 1\% [3.000])} &= \text{Rp } 33.355.500,00 \\
\text{SCL-002 (Item 68 95\% [285.000])} &= \text{Rp } 285.000,00 \\
\text{SCL-003 (Item 68 4\% [12.000])} &= \text{Rp } 12.000,00 \\
\hline
\mathbf{\text{Combined Claims Sum}} &= \mathbf{\text{Rp } 33.652.500,00}
\end{aligned}$$

### Capacity Deficit per Selectable Claim vs Invoice Amount:
- **Claim SCL-001 Deficit:** $\text{Rp } 33.652.500 - \text{Rp } 33.355.500 = \mathbf{\text{Rp } 297.000,00 \text{ (Deficit)}}$
- **Claim SCL-002 Deficit:** $\text{Rp } 33.652.500 - \text{Rp } 285.000 = \mathbf{\text{Rp } 33.367.500,00 \text{ (Deficit)}}$
- **Claim SCL-003 Deficit:** $\text{Rp } 33.652.500 - \text{Rp } 12.000 = \mathbf{\text{Rp } 33.640.500,00 \text{ (Deficit)}}$

### Transaction Characterization:
The current transaction is an **incomplete single-claim invoice** caused by an **architectural contract mismatch**:
- None of the three claims possesses sufficient capacity individually to satisfy the 100% payment term.
- The transaction cannot be processed as a multi-claim invoice because the backend API and database schema do not support multi-claim aggregation.

---

## 6. Material vs Service Validation Assessment

A strict inspection was performed to verify that the Service Invoice flow does not incorrectly require Goods Receipt (GR):
1. **Backend Isolation:**
   - In `backend/src/modules/finance/finance.service.ts`:
     - Line 162: `if (po.orderType !== 'SERVICE' && paymentTerm.termType === PaymentTermType.PROGRESS)` strictly isolates GR retrieval and validation to material orders.
     - Line 307: `if (po.orderType === 'SERVICE' || dto.serviceClaimId)` branches into Service Claim validation.
     - Line 374: `if (po.orderType !== 'SERVICE' && paymentTerm.termType === PaymentTermType.PROGRESS)` isolates GR line item mapping.
     - Lines 1486–1525 & lines 2062–2100: In `evaluateMatching`, service orders are matched exclusively against `ServiceClaim`, bypassing GR physical receipt checks.
2. **Frontend Isolation:**
   - In `frontend/src/components/finance/CreateInvoiceModal.tsx`:
     - Line 1215: The Goods Receipt selector card is rendered only when `po?.orderType !== 'SERVICE' && isProgressTerm`.
     - Lines 1470–1475: Table headers dynamically shift to "RUANG LINGKUP JASA / SUBKON (READ-ONLY)" and hide GR received quantities.
3. **Assessment Verdict:**
   The material vs service validation boundary is **fully preserved and correct**. The failure to issue this invoice is completely unrelated to Goods Receipt.

---

## 7. Root Cause Classification

| Finding Description | Classification | File & Line References | Impact on Invoicing |
| :--- | :--- | :--- | :--- |
| **Single-claim vs multi-claim cardinality mismatch in eligibility check** | **CONFIRMED ROOT CAUSE / FRONTEND DEFECT** | `frontend/src/components/finance/CreateInvoiceModal.tsx` L503-519, L641-658 | Frontend falsely declares 100% term ready by summing all claims, but allows only 1 claim to be selected and submitted. |
| **Premature submit button enablement on `FINAL_DELIVERY` terms** | **CONFIRMED FRONTEND DEFECT** | `frontend/src/components/finance/CreateInvoiceModal.tsx` L840-844 | Submit button is enabled and green before user selects a Service Claim, leading to unexpected client toast failure on click. |
| **Missing client-side claim capacity validation** | **CONFIRMED FRONTEND DEFECT** | `frontend/src/components/finance/CreateInvoiceModal.tsx` L1154-1163 | UI allows submitting a claim with insufficient capacity ($33.355.500 < 33.652.500$), guaranteeing HTTP 400 server rejection. |
| **Backend 1:1 invoice-to-service-claim enforcement** | **INTENDED BACKEND DESIGN (NOT A DEFECT)** | `backend/src/modules/finance/finance.service.ts` L362-366; `entities/invoice.entity.ts` L20 | Backend correctly prevents invoicing an amount that exceeds the approved capacity of the single linked Service Claim. |
| **Progressive claims created for a single 100% full payment term** | **CONFIRMED DATA ISSUE / OPERATIONAL MISALIGNMENT** | Database: `purchase_orders` ID 21, `po_payment_terms` ID 21, `service_claims` IDs 9, 10, 11 | Operations fragmented the claim into 3 stages while the PO was set up with a single 100% term, violating 1:1 architectural constraints. |
| **Placeholder / Test notes and duplicate evidence in claims** | **CONFIRMED DATA ISSUE** | Database: `service_claims` ID 9 (notes mention unrelated vendor), IDs 10 & 11 (duplicate ref `TRX-8657647822`) | Suggests staging / test transaction; duplicate evidence numbers are not blocked by constraints but represent sloppy test data. |
| **Unresolved system capability for multi-claim invoices** | **BUSINESS RULE AMBIGUITY** | System architecture baseline | Business has not formalized whether EPMS should support N claims per invoice or strictly require 1 claim per payment term. |

---

## 8. Exact Source File and Line References

### Frontend References:
- `frontend/src/components/finance/CreateInvoiceModal.tsx`:
  - [L88-90](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L88-L90): `approvedServiceClaims` array state and scalar `selectedServiceClaimId` state.
  - [L142-146](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L142-L146): `invoiceTotalAmount` derivation locked to `activeTerm.amount`.
  - [L189-207](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L189-L207): Service claims retrieval on modal open.
  - [L501-529](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L501-L529): `evaluateMilestone` aggregating all claims via `.reduce()`.
  - [L634-660](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L634-L660): `getTermEligibility` aggregating all claims via `.reduce()`.
  - [L753-757](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L753-L757): `handleSubmit` intercepting missing claim with `message.error`.
  - [L808-810](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L808-L810): Scalar `serviceClaimId` payload dispatch.
  - [L840-844](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L840-L844): `isProgressBlocked` and `isSubmitDisabled` logic failing to guard `FINAL_DELIVERY`.
  - [L1154-1163](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L1154-L1163): Single-select `<Select>` component without capacity verification.
  - [L1431-1449](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/CreateInvoiceModal.tsx#L1431-L1449): Summary banner rendering `PENDING VERIFIKASI` and `Menunggu pemilihan Klaim Jasa`.

### Backend References:
- `backend/src/modules/finance/finance.service.ts`:
  - [L56-61](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts#L56-L61): `createInvoice` method definition and transaction start.
  - [L307-368](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts#L307-L368): Single service claim resolution, capacity check, and `BadRequestException` rejection.
  - [L577-586](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts#L577-L586): Invoice entity population with scalar `serviceClaimId`.
  - [L1491-1556](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts#L1491-L1556): `evaluateMatching` Service Claim validation and duplicate invoice detection.
- `backend/src/entities/invoice.entity.ts`:
  - [L19-20](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/invoice.entity.ts#L19-L20): Column `service_claim_id: bigint unsigned nullable`.
- `backend/src/modules/finance/dto/create-invoice.dto.ts`:
  - [L51-54](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/dto/create-invoice.dto.ts#L51-L54): DTO property `serviceClaimId?: number`.
- `backend/src/modules/finance/service-invoice-matching.spec.ts`:
  - [L475-501](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/service-invoice-matching.spec.ts#L475-L501): Unit test 3 enforcing rejection when invoice amount exceeds single claim capacity.

---

## 9. Recommended Minimal Fix (Design Only — No Implementation)

Depending on the business governance decision, two architectural paths exist:

### Path A: Maintain Strict 1:1 Architecture (Minimal Frontend Hardening)
If the business rule dictates that **each Invoice maps to exactly one Service Claim and one Payment Term**:
1. **Fix Frontend Button Guard (`CreateInvoiceModal.tsx` L840):**
   Update `isProgressBlocked` to require a selected Service Claim for **all** non-DP service terms:
   ```typescript
   const isServiceBlocked = po?.orderType === 'SERVICE' && !isDpTerm && !selectedServiceClaimId;
   const isProgressBlocked = po?.orderType === 'SERVICE'
     ? isServiceBlocked
     : (isProgressTerm && (!selectedGrId || progressInvoiceItems.length === 0));
   ```
2. **Align Frontend Eligibility with 1:1 Invoicing (`CreateInvoiceModal.tsx` L641):**
   Instead of summing all approved claims with `.reduce()`, evaluate whether there exists at least one approved claim whose remaining capacity $\ge$ term amount:
   ```typescript
   const hasSufficientClaim = approvedServiceClaims.some(c => Number(c.approvedClaimAmount || 0) >= termAmount - 0.01);
   if (!hasSufficientClaim) {
     capPassed = false;
     capReason = `Tidak ada Klaim Jasa tunggal yang mencukupi nominal termin (Dibutuhkan: Rp ${termAmount.toLocaleString('id-ID')}).`;
   }
   ```
3. **Operational Remediation for `PO-20261109-002`:**
   In operations, cancel the fragmented claims and issue a single consolidated claim `SCL-20261109-004` for Rp 33.652.500,00 (100%), OR revise the PO payment term configuration into 3 progressive terms matching the 3 claims.

### Path B: Enable Multi-Claim Invoicing (Architectural Enhancement)
If the business rule dictates that **a Final Delivery invoice may combine multiple progressive Service Claims**:
1. **Database Schema:** Create junction table `invoice_service_claims (invoice_id, service_claim_id, allocated_amount)`.
2. **Backend DTO & Service:** Update `CreateInvoiceDto` to accept `serviceClaimIds: number[]`. In `FinanceService.createInvoice`, query all referenced claims, verify ownership, sum their remaining capacities, and ensure $\sum \text{remainingCapacity} \ge \text{totalInvoiceAmount}$.
3. **Frontend UI:** Set `<Select mode="multiple">` in `CreateInvoiceModal.tsx`, display cumulative selected claim capacity, and disable submission until $\sum \text{selectedClaims} \ge \text{invoiceTotalAmount}$.

---

## 10. Regression Test Scenarios Required

1. **Service PO with Single 100% Claim (Happy Path):**
   - PO with 1 term (100% Final Delivery, Rp 10.000.000).
   - 1 claim approved for Rp 10.000.000.
   - Verify modal enables submit button only after claim is selected; invoice created with `matchStatus: 'MATCHED'`.
2. **Service PO with Claim Smaller than Term (Negative Test):**
   - PO with term Rp 10.000.000.
   - Claim approved for Rp 6.000.000.
   - Verify frontend explicitly marks term/claim ineligible and disables submit button with descriptive capacity deficit reason.
3. **Service PO Final Delivery without Selection (UI Guard Test):**
   - PO with Final Delivery term.
   - Multiple claims exist.
   - Verify submit button is strictly **disabled** while dropdown is unselected; banner shows `Menunggu pemilihan Klaim Jasa`.
4. **Service PO Down Payment (DP) Term (Regression Protection):**
   - PO with DP term (e.g., 30%).
   - Zero claims exist.
   - Verify DP term remains immediately eligible and can be invoiced without selecting any Service Claim.
5. **Material PO Goods Receipt Enforcement (Regression Protection):**
   - Material PO with progress term.
   - Verify Service Claim controls do not appear and Goods Receipt selection remains strictly required.

---

## 11. Risks and Unresolved Business Decisions

1. **Business Ownership Decision:**
   Management must determine whether EPMS supports multi-claim aggregation on a single invoice or strictly enforces 1:1 milestone matching.
2. **User Confusion Risk:**
   Until the frontend UI guard is corrected, Finance users will continue to encounter active submit buttons that result in toast errors or backend rejections.
3. **Staging Data Integrity:**
   Test claims `SCL-20261109-001` through `003` contain inconsistent notes ("CV Logistik Terpadu") and duplicate transaction evidence (`TRX-8657647822`), highlighting the need for validation rules on operational data entry.

---

## 12. Git Safety Confirmation

- **Repository Branch:** `main`
- **Head Commit:** `ba8987d` (`fix(workflow): enforce atomic project submission and fail-closed concurrency locking`)
- **Modified Tracked Files:** 0 files modified during this audit.
- **Pre-existing Working Tree State:** Completely preserved (7 pre-existing modified files in finance/procurement modules and 10 deleted evidence PNGs untouched).
- **Application Code / Tests / Migrations:** Zero modifications executed.
- **Database State:** Strictly read-only; zero INSERT, UPDATE, DELETE, or DDL commands executed.

---

## 13. Final Decision

**`FAIL — Confirmed frontend defect.`**

