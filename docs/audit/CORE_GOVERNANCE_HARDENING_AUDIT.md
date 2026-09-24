# EPMS CORE GOVERNANCE HARDENING AUDIT REPORT

## Executive Summary

Audit forensik ini mengevaluasi kematangan fondasi governance pada 3 modul utama EPMS: **Marketing**, **Legal**, dan **PMO**. Audit dilakukan secara empiris berdasarkan codebase aktual (*evidence-based*) untuk menentukan apakah ketiga modul ini sudah cukup matang menjadi fondasi bagi modul Procurement dan Finance.

---

## Overall Governance Scorecard

```text
┌──────────────────────────────────────────────────────────┐
│                 GOVERNANCE SCORECARD                     │
├──────────────────────────┬───────────────────────────────┤
│ Marketing Governance     │  65 / 100  (Need Hardening)   │
│ Legal Governance         │  50 / 100  (High Risk 🔴)     │
│ PMO Governance           │  55 / 100  (Incomplete 🟡)     │
│ Cross Module Integrity   │  60 / 100  (Need Hardening)   │
├──────────────────────────┼───────────────────────────────┤
│ OVERALL GOVERNANCE SCORE │  57.5 / 100 (NO-GO STATUS 🔴) │
└──────────────────────────┴───────────────────────────────┘
```

---

## Phase 1 — Marketing Governance Hardening

### 1. Ownership Enforcement Audit
- **Findings**: `GET /marketing/tenders` memfilter data sesuai PIC/Creator untuk role non-manajemen (`L220`). Namun, seluruh endpoint mutasi (`PATCH`, `POST upload-proposal`, `POST upload-spk`, `PATCH negotiate`) **tidak memvalidasi kepemilikan** (`tender.marketing_pic_id === userId`).

| Endpoint | Ownership Validation | Evidence | Status |
|----------|----------------------|----------|--------|
| `GET /marketing/tenders` | Filtered by `marketing_pic_id` / `created_by` | `marketing.service.ts#L220` | Protected 🟢 |
| `PATCH /marketing/tenders/:id` | Missing Ownership Check | `marketing.service.ts#L433` | Vulnerable 🔴 |
| `DELETE /marketing/tenders/:id` | Restrict to SUPER_ADMIN | `marketing.controller.ts#L63` | Protected 🟢 |
| `POST /marketing/tenders/:id/upload-proposal` | Missing Ownership Check | `marketing.service.ts#L917` | Vulnerable 🔴 |
| `POST /marketing/tenders/:id/upload-spk` | Missing Ownership Check | `marketing.service.ts#L1249` | Vulnerable 🔴 |
| `PATCH /marketing/tenders/:id/negotiate` | Missing Ownership Check | `marketing.service.ts#L979` | Vulnerable 🔴 |

### 2. State Machine Enforcement Audit
- **Findings**: Backend mengizinkan lompatan stage langsung dari `LEAD` atau `QUALIFICATION` ke `WON` selama `go_nogo_status === 'GO'`, tanpa memaksa urutan sekuensial.

| Current State | Target State | Allowed | Evidence |
|---------------|--------------|---------|----------|
| `LEAD` | `WAITING_GO_NO_GO` | YES | `marketing.service.ts#L696` |
| `WAITING_GO_NO_GO` | `QUALIFICATION` | YES | `marketing.service.ts#L828` |
| `QUALIFICATION` | `PROPOSAL` | YES | `marketing.service.ts#L932` |
| `PROPOSAL` | `NEGOTIATION` | YES | `marketing.service.ts#L447` |
| `NEGOTIATION` | `WON` | YES | `marketing.service.ts#L501` |
| `LEAD` / `QUALIFICATION` | `WON` | **YES (ILLEGAL JUMP)** | `marketing.service.ts#L497` (Bypass Check) |

### 3. Business Rule Enforcement Audit

| Transition | Requirement | Enforced | Evidence / Gap |
|------------|-------------|----------|----------------|
| `QUALIFICATION` → `PROPOSAL` | Proposal File Uploaded | **NO (API Bypass)** | `updateTender` mengizinkan pengubahan stage tanpa check file |
| `PROPOSAL` → `NEGOTIATION` | Negotiation Note & Price Change | **NO (API Bypass)** | `updateTender` mengizinkan pengubahan stage tanpa check riwayat harga |
| `NEGOTIATION` → `WON` | SPK File Uploaded / Grace Active | **NO (API Bypass)** | `updateTenderStatusTransactionally` mengizinkan `WON` tanpa check SPK |

### 4. Go/No-Go Governance Audit

| Action | Allowed Roles | Actual Roles in Code | Status |
|--------|---------------|----------------------|--------|
| Submit Go/No-Go | `MARKETING`, `GM`, `ADMIN`, `DIRECTOR` | `MARKETING`, `GM`, `SUPER_ADMIN`, `DIRECTOR` | Compliant 🟢 |
| Approve Go | `DIRECTOR`, `GM`, `ADMIN` | `DIRECTOR`, `GENERAL_MANAGER`, `SUPER_ADMIN` | Compliant 🟢 |
| Reject No-Go | `DIRECTOR`, `GM`, `ADMIN` | `DIRECTOR`, `GENERAL_MANAGER`, `SUPER_ADMIN` | Compliant 🟢 |

---

## Phase 2 — Legal Governance Hardening

### 1. Authorization Audit

| Endpoint | Expected Roles | Actual Roles in Code | Status |
|----------|----------------|----------------------|--------|
| `POST /legal/contracts/review` | `LEGAL`, `ADMIN`, `DIRECTOR` | **`ANY AUTHENTICATED USER`** (`JwtAuthGuard` only) | **CRITICAL BYPASS 🔴** |
| `POST /legal/review` (alias) | `LEGAL`, `ADMIN`, `DIRECTOR` | **`ANY AUTHENTICATED USER`** (`JwtAuthGuard` only) | **CRITICAL BYPASS 🔴** |
| `POST /legal/start-project` | `PMO`, `ADMIN`, `DIRECTOR` | **`ANY AUTHENTICATED USER`** (`JwtAuthGuard` only) | **VULNERABLE 🔴** |

### 2. State Machine Audit

| Current Status | Target Status | Allowed | Evidence |
|----------------|---------------|---------|----------|
| `DRAFT` | `ON_REVIEW` | YES | `legal.service.ts#L95` |
| `ON_REVIEW` | `APPROVED` | YES | `legal.service.ts#L100` |
| `ON_REVIEW` | `REJECTED` | YES | `legal.service.ts#L117` |
| `ON_REVIEW` | `REVISION_REQUESTED` | YES | `legal.service.ts#L138` |
| `DRAFT` | `APPROVED` | **YES (ILLEGAL)** | `legal.service.ts#L95` (No previous status check) |
| `DRAFT` | `REJECTED` | **YES (ILLEGAL)** | `legal.service.ts#L95` (No previous status check) |
| `REJECTED` | `APPROVED` | **YES (ILLEGAL)** | `legal.service.ts#L95` (No previous status check) |
| `APPROVED` | `ON_REVIEW` | **YES (ILLEGAL)** | `legal.service.ts#L95` (No previous status check) |

### 3. Segregation Of Duties Audit

| Scenario | Protected | Evidence |
|----------|-----------|----------|
| Marketing PIC approves own contract | **NO 🔴** | `POST /legal/contracts/review` missing `@Roles('LEGAL')` & creator check |
| Marketing PIC rejects own contract | **NO 🔴** | Missing creator / PIC check in `reviewContract` |
| Contract creator approves own contract | **NO 🔴** | No check verifying `contract.created_by !== userId` |

### 4. Contract Integrity Audit

| Validation | Enforced | Evidence / Note |
|------------|----------|-----------------|
| Tender Valid | **PARTIAL 🟡** | `proposal.tender_id` or `contract.tender_id` mapped |
| Customer Valid | **PARTIAL 🟡** | `contract.customer_id` is nullable |
| SPK Valid | **PARTIAL 🟡** | `spk_file_url` optional during raw update |
| Contract Number Valid | **NO 🔴** | `contract_number` can be `NULL` (No database unique constraint) |

---

## Phase 3 — PMO Governance Hardening

### 1. Project Creation Audit

| Validation | Enforced | Evidence |
|------------|----------|----------|
| Contract Legal Status = APPROVED | **PARTIAL 🟡** | `getOperationalBoard` filters pending contracts by `LegalStatus.APPROVED`, but `claimCharter` (`L121`) creates/activates project without enforcing `contract.legal_status === 'APPROVED'`. |

### 2. Project Ownership Audit

| Endpoint | Ownership Protected | Evidence |
|----------|---------------------|----------|
| `POST /project/wbs` | Restricted to `PROJECT_MANAGER`, `SUPER_ADMIN` | `project.controller.ts#L24` |
| `POST /project/tasks` | Restricted to `PROJECT_MANAGER`, `SUPER_ADMIN` | `project.controller.ts#L37` |
| `PATCH /project/charters/:id/claim` | **NO 🔴** | Missing `@Roles()` and missing Project Manager ID check (`project.controller.ts#L49`) |

### 3. Project Lifecycle Audit

| Current Status | Target Status | Allowed |
|----------------|---------------|---------|
| `PENDING_KICKOFF` | `IN_PROGRESS` | YES (`project.service.ts#L138`) |
| `IN_PROGRESS` | `COMPLETED` | **NOT FOUND IN CODEBASE** |
| `ANY STATUS` | `CANCELLED` | **NOT FOUND IN CODEBASE** |

### 4. Project Closure Audit

| Validation | Enforced | Evidence |
|------------|----------|----------|
| Legal Approved | **NOT FOUND IN CODEBASE** | Project closure endpoint not implemented |
| Milestones Completed | **NOT FOUND IN CODEBASE** | Project closure endpoint not implemented |
| Progress 100% | **NOT FOUND IN CODEBASE** | Project closure endpoint not implemented |

---

## Phase 4 — Cross Module Integrity

| Cross Module Rule | Status | Evidence |
|-------------------|--------|----------|
| **Rule 1**: Tender WON produces Contract Draft | **COMPLIANT 🟢** | `marketing.service.ts#L517 & L1307` auto-creates Proposal & Contract |
| **Rule 2**: Contract Approved produces Project | **COMPLIANT 🟢** | `legal.service.ts#L100` sets status ACTIVE & contract appears in PMO Board pending kickoff |
| **Rule 3**: Tender Deleted keeps Contract & Proposal consistent | **COMPLIANT 🟢** | `marketing.service.ts#L1195` performs cascade soft-delete on Proposal and Contract |
| **Rule 4**: Project cannot exist without Contract | **NON-COMPLIANT 🔴** | `Project` entity is unlinked to `Contract` at DB level; `claimCharter` fallback creates project without valid contract |
| **Rule 5**: Contract cannot be APPROVED without Tender WON | **NON-COMPLIANT 🔴** | `reviewContract` can approve contract directly even if tender is in `LEAD` or `QUALIFICATION` stage |

---

## Phase 5 & 6 — Risk Matrix & Recommended Roadmap

### Risk Classification:
- **P1 (Critical)**: Missing `@Roles('LEGAL')` on Legal Review; State Machine Bypass (`LEAD` → `WON`, `DRAFT` → `APPROVED`); Missing Marketing Ownership Guard.
- **P2 (High)**: Missing Segregation of Duties; Lack of Legal Approval enforcement in PMO `claimCharter`.
- **P3 (Medium)**: Incomplete PMO Project Closure lifecycle.
- **P4 (Low)**: Missing DB unique constraint on `contract_number`.

### Roadmap to Reach Score ≥ 95:
- **Sprint 1**: Hardening Authorization & State Machine (Add `@Roles('LEGAL')`, Marketing Ownership Guard, Sequential State Validators).
- **Sprint 2**: Cross-Module Enforcement & Segregation of Duties (Block self-approval, enforce `contract.legal_status === APPROVED` in PMO kickoff).
- **Sprint 3**: PMO Lifecycle & Project Closure Completion (Implement closure validation & 100% milestone guard).

---

## Final Go / No-Go Recommendation

**Pertanyaan**: *"Apakah Marketing, Legal, dan PMO sudah cukup matang untuk menjadi fondasi Procurement dan Finance?"*

### **JAWABAN RESMI: `NO-GO 🔴` (BELUM MATANG)**

**Rasional**: Score Governance saat ini adalah **57.5 / 100** (di bawah target minimal **95/100**). Mengembangkan modul Procurement dan Finance di atas sistem yang saat ini mengizinkan siapapun menyetujui kontrak legal dan mengizinkan lompatan stage dari LEAD ke WON akan berisiko tinggi menimbulkan kebocoran anggaran dan *fraud* pada proses pengadaan.
