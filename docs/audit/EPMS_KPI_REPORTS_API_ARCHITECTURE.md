# EPMS UBD & TVM — KPI & REPORTS API ARCHITECTURE SPECIFICATION
## Modular Analytics Endpoints, DTO Schemas, Performance SLAs & RBAC Architecture

**Document Reference:** `EPMS-API-ARCH-20261116-001`
**Classification:** Enterprise Software Architecture & Technical Integration Specification
**System Target:** NestJS Backend (`backend/src/modules/analytics/`) & Next.js Frontend (`frontend/src/`)
**Reference Date:** 16 November 2026
**Execution Mode:** PLANNING & DOCUMENTATION ONLY (Implementation Authorization: PENDING)
**Author:** Principal Enterprise Solution Architect & Backend Systems Specialist

---

## 1. ARCHITECTURAL OVERVIEW & DESIGN PRINCIPLES

The transformed EPMS Management Intelligence & Decision Support System (MIDSS) requires a clean, modular backend architecture replacing monolithic SQL aggregation in `DashboardService`.

```mermaid
flowchart TD
    subgraph Frontend [Next.js Presentation Layer (/reports)]
        Tab1[Tab 1: Executive Overview]
        Tab2[Tab 2: Sales & Marketing]
        Tab3[Tab 3: Project Delivery / PMO]
        Tab4[Tab 4: Procurement & Cost Control]
        Tab5[Tab 5: Finance & Cost]
        Tab6[Tab 6: Legal & Governance]
    end

    subgraph Gateway [NestJS API Layer (@Controller('analytics'))]
        Guard[JwtAuthGuard + RolesGuard + CompanyContextGuard]
        Cache[Redis / Memory Cache Layer (TTL 300s)]
    end

    subgraph ServiceLayer [Specialized Domain Analytics Services]
        ExecSvc[ExecutiveAnalyticsService]
        MktgSvc[MarketingAnalyticsService]
        PmoSvc[PmoAnalyticsService]
        ProcSvc[ProcurementAnalyticsService]
        FinSvc[FinanceAnalyticsService]
        LegalSvc[LegalAnalyticsService]
    end

    subgraph Storage [Persistence & Database Layer]
        MySQL[(epms_tvmubd_db)]
        AuditLog[(audit_logs)]
    end

    Tab1 --> Guard --> Cache --> ExecSvc --> MySQL
    Tab2 --> Guard --> Cache --> MktgSvc --> MySQL
    Tab3 --> Guard --> Cache --> PmoSvc --> MySQL
    Tab4 --> Guard --> Cache --> ProcSvc --> MySQL
    Tab5 --> Guard --> Cache --> FinSvc --> MySQL
    Tab6 --> Guard --> Cache --> LegalSvc --> MySQL
```

### Core Architecture Tenets
1. **Domain Isolation:** Each of the six operational management tabs is served by a dedicated, encapsulated endpoint and service method. No single tab query failure breaks the other tabs.
2. **Zero AP-as-Revenue Fallback:** Strict elimination of vendor accounts payable amounts masquerading as company revenue. Missing data must be explicitly reported as `UNAVAILABLE` or `null`.
3. **Optimized Single-Pass Queries:** Elimination of `N+1` database loops through vectorized SQL aggregation and TypeORM QueryBuilder window functions.
4. **Cache-Aside Architecture:** Redis-backed caching with a 5-minute TTL (`300s`) and event-driven cache invalidation hooks on entity mutations.
5. **Strict RBAC & Tenant Isolation:** Every analytics query enforces `@Roles()` authorization and multi-tenant scoping (`company_id` filter for `UBD` and `TVM`).

---

## 2. MODULAR ENDPOINT CATALOG & ROUTING MATRIX

| Route | HTTP Method | Target Domain / Tab | Responsible Service | Required Roles | Target SLA (p95) |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `/analytics/executive-intelligence` | `GET` | Tab 1: Executive Overview | `ExecutiveAnalyticsService` | `DIRECTOR`, `ADMIN` | `< 300ms` (cached)<br>`< 1200ms` (cold) |
| `/analytics/marketing-performance` | `GET` | Tab 2: Sales & Marketing | `MarketingAnalyticsService` | `DIRECTOR`, `HEAD_MARKETING`, `MARKETING_PIC` | `< 250ms` (cached)<br>`< 800ms` (cold) |
| `/analytics/project-portfolio` | `GET` | Tab 3: Project Delivery / PMO | `PmoAnalyticsService` | `DIRECTOR`, `PM_LEAD`, `SITE_ENGINEER` | `< 300ms` (cached)<br>`< 1000ms` (cold) |
| `/analytics/procurement-waterfall` | `GET` | Tab 4: Procurement & Cost Control | `ProcurementAnalyticsService` | `DIRECTOR`, `HEAD_PROCUREMENT`, `PROC_OFFICER` | `< 300ms` (cached)<br>`< 1200ms` (cold) |
| `/analytics/finance-governance` | `GET` | Tab 5: Finance & Cost | `FinanceAnalyticsService` | `DIRECTOR`, `FINANCE_CONTROLLER`, `CASHIER` | `< 250ms` (cached)<br>`< 800ms` (cold) |
| `/analytics/legal-governance` | `GET` | Tab 6: Legal & Governance | `LegalAnalyticsService` | `DIRECTOR`, `LEGAL_SPECIALIST` | `< 200ms` (cached)<br>`< 600ms` (cold) |
| `/analytics/dashboard` *(Legacy)* | `GET` | Backward Compatibility | `DashboardService` | All Authenticated Roles | `< 200ms` |

---

## 3. DEPRECATION & REMEDIATION OF AP-AS-REVENUE FALLBACK

### 3.1 Legacy Code Defect Inspection

In `backend/src/modules/dashboard/dashboard.service.ts` (lines 48–62), the existing implementation contains the following logic:

```typescript
// DEFECTIVE LEGACY IMPLEMENTATION:
const paidInvoicesSum = await this.invoiceRepo
  .createQueryBuilder('invoice')
  .where('invoice.status = :status', { status: InvoiceStatus.PAID })
  .select('SUM(invoice.total_amount)', 'sum')
  .getRawOne();

// Erroneous business fallback: Vendor expense assigned as Company Revenue!
const totalRevenue = paidInvoicesSum?.sum ? Number(paidInvoicesSum.sum) : 0;
```

**Financial Impact:**
- `invoice.total_amount` represents vendor bills payable (Accounts Payable disbursements).
- Treating vendor payments as "Total Revenue" inverted the financial logic of the enterprise, presenting costs as earnings.

### 3.2 Standardized Remediation Contract

The updated analytics DTO replaces primitive scalar values with an auditable value wrapper:

```typescript
export interface AuditableMetric<T = number> {
  value: T | null;
  status: 'VERIFIED' | 'ESTIMATED' | 'UNAVAILABLE' | 'PROHIBITED';
  currency?: string;
  basis: string;
  disclosureNote?: string;
}

// In Executive Intelligence DTO:
export interface ExecutiveRevenueMetricsDto {
  customerRevenue: AuditableMetric<number>; // Status: 'UNAVAILABLE'
  tenderContractWonSum: AuditableMetric<number>; // Status: 'VERIFIED', Rp 26.697.587.000,00
  totalVendorExpenditure: AuditableMetric<number>; // Status: 'VERIFIED', Rp 16.486.082.364,37
  netMargin: AuditableMetric<number>; // Status: 'UNAVAILABLE'
}
```

When `customerRevenue.status === 'UNAVAILABLE'`, the frontend renders an informative management badge:
```tsx
<MetricCard
  title="Total Pendapatan Pelanggan (Customer Revenue)"
  value={null}
  statusBadge="MODUL AR BELUM TERPASANG"
  tooltip="Modul penagihan invoice pelanggan (AR) belum dikembangkan. Angka pengeluaran vendor tidak lagi digunakan sebagai fallback pendapatan."
/>
```

---

## 4. COMPREHENSIVE DATA TRANSFER OBJECT (DTO) SCHEMAS

### 4.1 Common Query Parameters DTO

```typescript
import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';

export enum AnalyticsPeriod {
  THIS_MONTH = 'THIS_MONTH',
  THIS_QUARTER = 'THIS_QUARTER',
  YEAR_TO_DATE = 'YTD',
  ALL_TIME = 'ALL_TIME',
  CUSTOM = 'CUSTOM',
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.YEAR_TO_DATE;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  companyCode?: 'UBD' | 'TVM' | 'ALL';
}
```

---

### 4.2 Tab 1: Executive Intelligence DTO (`/analytics/executive-intelligence`)

```typescript
export interface ExecutiveIntelligenceDto {
  managementPillars: {
    // 1. Pencapaian Utama (Wins)
    keyAchievements: Array<{
      id: string;
      title: string;
      category: 'MARKETING' | 'PMO' | 'PROCUREMENT' | 'FINANCE';
      metricValue: string;
      context: string;
      achievedAt: string;
    }>;
    // 2. Hambatan Utama (Obstacles & Bottlenecks)
    keyObstacles: Array<{
      id: string;
      title: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      category: 'LEGAL' | 'PROCUREMENT' | 'PMO' | 'FINANCE';
      affectedValueIdr: number;
      durationDays: number;
      entityId: number;
      entityType: 'CONTRACT' | 'PURCHASE_ORDER' | 'PROJECT';
      drillDownPath: string;
    }>;
    // 3. Action & Decision Needed (Executive Approval Queue)
    pendingDirectorDecisions: Array<{
      taskId: number;
      taskTitle: string;
      module: 'TENDER' | 'RAB' | 'PURCHASE_REQUEST' | 'CONTRACT' | 'PAYMENT';
      entityId: number;
      referenceNumber: string;
      amountIdr: number;
      requesterName: string;
      waitingSince: string;
      daysPending: number;
      drillDownPath: string;
    }>;
  };
  executiveKpis: {
    tenderContractWonTotal: number;
    activeProjectCount: number;
    closedProjectCount: number;
    totalPoCommitted: number;
    totalCashDisbursed: number;
    outstandingAp: number;
    unbilledPoExposure: number;
    pendingLegalReviewAmount: number;
  };
}
```

---

### 4.3 Tab 2: Sales & Marketing DTO (`/analytics/marketing-performance`)

```typescript
export interface MarketingPerformanceDto {
  funnelStages: {
    prospect: { count: number; totalValue: number };
    rfqReview: { count: number; totalValue: number };
    bidding: { count: number; totalValue: number };
    negotiation: { count: number; totalValue: number };
    won: { count: number; totalValue: number };
    lost: { count: number; totalValue: number };
  };
  conversionMetrics: {
    grossWinRate: number; // Won / Total Tenders (15 / 33 = 45.45%)
    concludedWinRate: number; // Won / (Won + Lost) (15 / 20 = 75.00%)
    activePipelineRate: number; // In Progress / Total (13 / 33 = 39.39%)
    totalContractWonValue: number; // Rp 26.697.587.000,00
  };
  picLeaderboard: Array<{
    picId: number;
    picName: string;
    totalAssigned: number;
    activeTenders: number;
    wonTenders: number;
    lostTenders: number;
    wonValueIdr: number;
    personalWinRate: number;
  }>;
  historicalWonLossTrends: Array<{
    periodLabel: string;
    tendersWon: number;
    tendersLost: number;
    wonAmount: number;
  }>;
}
```

---

### 4.4 Tab 3: Project Delivery / PMO DTO (`/analytics/project-portfolio`)

```typescript
export interface ProjectPortfolioDto {
  portfolioSummary: {
    totalProjects: number; // 27
    closedProjects: number; // 8
    inProgressProjects: number; // 7
    planningProjects: number; // 12
    planningWithoutDatesCount: number; // 12 (100% missing start/end)
    activeBaselineCount: number; // 15
    missingBaselineCount: number; // 12
  };
  projectDeficitAlerts: Array<{
    projectId: number;
    projectCode: string;
    projectName: string;
    contractAmount: number;
    draftRabCost: number;
    varianceAmount: number; // Negative variance
    variancePercentage: number;
    status: 'PLANNING_DEFICIT' | 'RAZOR_THIN_MARGIN';
    drillDownPath: string;
  }>;
  activeProjectsProgress: Array<{
    projectId: number;
    projectCode: string;
    projectName: string;
    companyCode: 'UBD' | 'TVM';
    contractValue: number;
    startDate: string | null;
    endDate: string | null;
    targetProgressPct: number;
    actualProgressPct: number;
    variancePct: number;
    scheduleHealth: 'ON_TRACK' | 'BEHIND' | 'CRITICAL' | 'UNSCHEDULED';
  }>;
}
```

---

### 4.5 Tab 5: Finance & Cost Governance DTO (`/analytics/finance-governance`)

```typescript
export interface FinanceGovernanceDto {
  accountsPayableSummary: {
    totalInvoiced: number; // Rp 16.650.732.364,37
    totalPaid: number; // Rp 16.486.082.364,37
    totalOutstandingAp: number; // Rp 164.650.000,00
    pendingInvoicesCount: number; // 3 (Invoices #22, #23, #24)
    paymentExecutionComplianceRate: number; // 100% (No payment exceeded approved amount)
  };
  taxLiabilityLedger: {
    pph21Withheld: number;
    pph23Withheld: number;
    pphFinalWithheld: number;
    totalWithheldLiability: number;
    totalRemittedNtpn: number; // Rp 0,00
    remittanceComplianceStatus: 'REMITTANCE_RECORD_MISSING';
  };
  companyCashFlowComparison: {
    ubd: { invoiced: number; paid: number; outstanding: number };
    tvm: { invoiced: number; paid: number; outstanding: number };
  };
}
```

---

### 4.6 Tab 6: Legal & Governance DTO (`/analytics/legal-governance`)

```typescript
export interface LegalGovernanceDto {
  contractPortfolio: {
    totalContracts: number; // 33
    activeSignedContracts: number; // 29
    pendingLegalReviewCount: number; // 4
    pendingLegalReviewAmount: number; // Rp 36.850.000,00
    draftContractsCount: number;
  };
  governanceAgingAlerts: Array<{
    contractId: number;
    contractNumber: string;
    title: string;
    vendorOrClientName: string;
    contractValue: number;
    status: 'PENDING_LEGAL_REVIEW';
    daysInReview: number; // 16.8 to 18.1 days
    thresholdExceededDays: number; // Days beyond 3 calendar days (72h)
    slaStatus: 'BREACHED';
    drillDownPath: string;
  }>;
  workflowSlaMetrics: {
    totalWorkflowTasks: number; // 412
    pendingTasksCount: number; // 11
    tasksWithoutDueAtCount: number; // 412 (100% due_at = NULL)
    averageCycleDays: number;
  };
}
```

---

## 5. SAFE EXECUTIVE DRILL-DOWN WHITELIST ROUTING

To prevent broken navigation, white screens, and 404 errors, all clickable rows and action badges in the reports module must strictly resolve through the `safeExecutiveTarget` utility.

### 5.1 Route Whitelist Mapping

```typescript
export type WhitelistedEntityType =
  | 'TENDER'
  | 'PROJECT'
  | 'PURCHASE_ORDER'
  | 'INVOICE'
  | 'PAYMENT_REQUEST'
  | 'CONTRACT'
  | 'WORKFLOW_TASK';

export interface DrillDownRoute {
  path: string;
  requiredRole: string[];
}

export const EXECUTIVE_DRILLDOWN_WHITELIST: Record<WhitelistedEntityType, (id: number | string) => string> = {
  TENDER: (id) => `/marketing/tenders/${id}`,
  PROJECT: (id) => `/projects/${id}`,
  PURCHASE_ORDER: (id) => `/procurement/purchase-orders/${id}`,
  INVOICE: (id) => `/finance/invoices/${id}`,
  PAYMENT_REQUEST: (id) => `/finance/payment-requests/${id}`,
  CONTRACT: (id) => `/legal/contracts/${id}`,
  WORKFLOW_TASK: (id) => `/activity-center?tab=tasks&taskId=${id}`,
};

export function resolveSafeExecutiveTarget(
  entityType: WhitelistedEntityType,
  entityId: number | string | null | undefined,
  userRoles: string[]
): string | null {
  if (!entityId || !EXECUTIVE_DRILLDOWN_WHITELIST[entityType]) {
    console.warn(`[SafeRouting] Blocked navigation: Invalid entityType '${entityType}' or null ID.`);
    return null;
  }
  return EXECUTIVE_DRILLDOWN_WHITELIST[entityType](entityId);
}
```

---

## 6. PERFORMANCE SLAs & CACHING ARCHITECTURE

### 6.1 Query Optimization Rules
1. **No Loops / N+1:** Prohibit executing database queries inside JavaScript `.map()` or `.forEach()` loops.
2. **Aggregated Grouping:** Perform all sums, counts, and averages directly in MySQL 8.0 using `SUM()`, `COUNT()`, and `CASE WHEN` conditional aggregation.
3. **Index Coverage:** Ensure all query filters utilize the following existing database indexes:
   - `purchase_orders(status, deleted_at, company_id)`
   - `invoices(status, deleted_at, po_id)`
   - `service_claims(po_id, status, deleted_at)`
   - `tenders(stage, marketing_pic_id, deleted_at)`
   - `projects(status, contract_id, deleted_at)`
   - `workflow_tasks(status, assignee_role_id)`

### 6.2 Redis Caching & Invalidation Strategy

```typescript
// Cache Key Namespaces:
const CACHE_KEYS = {
  EXECUTIVE: (company: string, period: string) => `analytics:executive:${company}:${period}`,
  MARKETING: (company: string, period: string) => `analytics:marketing:${company}:${period}`,
  PMO: (company: string, period: string) => `analytics:pmo:${company}:${period}`,
  PROCUREMENT: (company: string, period: string) => `analytics:procurement:${company}:${period}`,
  FINANCE: (company: string, period: string) => `analytics:finance:${company}:${period}`,
  LEGAL: (company: string, period: string) => `analytics:legal:${company}:${period}`,
};

// Default TTL: 300 seconds (5 minutes)
const ANALYTICS_CACHE_TTL = 300;
```

**Mutation Invalidation Events:**
- When a Tender stage updates $\rightarrow$ Invalidate `analytics:marketing:*` and `analytics:executive:*`.
- When a PO or GR is created $\rightarrow$ Invalidate `analytics:procurement:*` and `analytics:executive:*`.
- When an Invoice or Payment executes $\rightarrow$ Invalidate `analytics:finance:*`, `analytics:procurement:*`, and `analytics:executive:*`.
- When a Contract updates $\rightarrow$ Invalidate `analytics:legal:*` and `analytics:executive:*`.

---

## 7. ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION MATRIX

| Tab / Domain Endpoint | Director | Finance Controller | PM Lead | Head of Marketing | Procurement Officer | Legal Specialist | Staff / Read-Only |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tab 1: Executive Overview** | Full Access | Masked Margins | Masked Finance | Masked Finance | Masked Finance | Masked Finance | Blocked (403) |
| **Tab 2: Sales & Marketing** | Full Access | Full Access | Read-Only | Full Access | Read-Only | Read-Only | Read-Only (Assigned Only) |
| **Tab 3: Project Delivery** | Full Access | Read-Only | Full Access | Read-Only | Read-Only | Read-Only | Read-Only (Assigned Only) |
| **Tab 4: Procurement & Cost** | Full Access | Full Access | Read-Only | Read-Only | Full Access | Read-Only | Read-Only |
| **Tab 5: Finance & Cost** | Full Access | Full Access | Blocked (403) | Blocked (403) | Masked Bank Info | Blocked (403) | Blocked (403) |
| **Tab 6: Legal & Governance** | Full Access | Read-Only | Blocked (403) | Blocked (403) | Blocked (403) | Full Access | Blocked (403) |

---

*End of API Architecture Specification.*
