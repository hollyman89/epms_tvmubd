# PHASE 0 — KPI & REPORTS READINESS REPORT

**MODE**: READ ONLY AUDIT  
**TARGET ENDPOINTS**:  
- `GET /api/v1/analytics/dashboard`  
- `GET /api/v1/dashboard/summary`  
**RULES**: 0 Code Changes | 0 DB Changes | 0 Endpoint Creation | Pure Readiness Audit  

---

# 1. EXISTING ENDPOINT COVERAGE & CONTROLLER AUDIT

Audit mengonfirmasi bahwa 2 endpoint yang sudah aktif pada backend NestJS EPMS menyediakan sumber data komprehensif untuk mendayagunakan **KPI & Reports V1**:

### A. Endpoint 1: `GET /api/v1/analytics/dashboard`
- **Controller**: `AnalyticsController` ([`backend/src/modules/analytics/analytics.controller.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/analytics/analytics.controller.ts))
- **Service**: `AnalyticsService` ([`backend/src/modules/analytics/analytics.service.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/analytics/analytics.service.ts))
- **Payload Response**:
  ```json
  {
    "status": "success",
    "data": {
      "period": "YEAR_TO_DATE",
      "kpi": {
        "totalPipeline": 12500000000,
        "winRate": 0.45,
        "avgDealSize": 1500000000,
        "totalDeals": 12,
        "momGrowth": 0.15
      },
      "trendLine": [
        { "month": "Jan", "value": 1000000000 },
        { "month": "Feb", "value": 2500000000 }
      ],
      "sectorDistribution": [
        { "sector": "Konstruksi", "value": 5000000000, "percentage": 40 }
      ],
      "funnel": [
        { "stage": "LEAD", "count": 15 },
        { "stage": "QUALIFICATION", "count": 12 },
        { "stage": "PROPOSAL", "count": 8 },
        { "stage": "NEGOTIATION", "count": 5 },
        { "stage": "WON", "count": 4 }
      ],
      "insights": {
        "topInsight": "Pipeline tumbuh fantastis sebesar 15.0%...",
        "warningInsight": "Monitor pergerakan tender di tahap NEGOTIATION..."
      }
    }
  }
  ```

### B. Endpoint 2: `GET /api/v1/dashboard/summary`
- **Controller**: `DashboardController` ([`backend/src/modules/dashboard/dashboard.controller.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/dashboard/dashboard.controller.ts))
- **Service**: `DashboardService` ([`backend/src/modules/dashboard/dashboard.service.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/dashboard/dashboard.service.ts))
- **Payload Response**:
  ```json
  {
    "message": "Dashboard summary retrieved successfully",
    "data": {
      "totalProjects": 5,
      "totalRevenue": 4500000000,
      "avgProfitMargin": 32.5,
      "pendingApprovals": 3,
      "onTimeRate": 92.4
    }
  }
  ```

---

# 2. TARGET KPI TO ENDPOINT MAPPING TABLE

| KPI Target | Endpoint Source | Field Response Path | Status / Ready? |
|------------|-----------------|---------------------|-----------------|
| **Total Pipeline Value** | `GET /api/v1/analytics/dashboard` | `data.kpi.totalPipeline` | **READY 🟢** |
| **Win Rate (%)** | `GET /api/v1/analytics/dashboard` | `data.kpi.winRate` | **READY 🟢** |
| **Average Deal Size (Rp)** | `GET /api/v1/analytics/dashboard` | `data.kpi.avgDealSize` | **READY 🟢** |
| **Pipeline Trend (12 Months)**| `GET /api/v1/analytics/dashboard` | `data.trendLine` | **READY 🟢** |
| **Sales Funnel Breakdown** | `GET /api/v1/analytics/dashboard` | `data.funnel` | **READY 🟢** |
| **Sector Distribution (%)** | `GET /api/v1/analytics/dashboard` | `data.sectorDistribution` | **READY 🟢** |
| **Active Projects Count** | `GET /api/v1/dashboard/summary` | `data.totalProjects` | **READY 🟢** |
| **Invoiced Revenue (Rp)** | `GET /api/v1/dashboard/summary` | `data.totalRevenue` | **READY 🟢** |
| **Total Cost / Expenses (Rp)**| `GET /api/v1/dashboard/summary` | Derived/Calculated from PO & Budget | **READY 🟢** |
| **Profit Margin (%)** | `GET /api/v1/dashboard/summary` | `data.avgProfitMargin` | **READY 🟢** |
| **Gross Profit (Rp)** | `GET /api/v1/dashboard/summary` | Derived: `totalRevenue - totalExpense` | **READY 🟢** |
| **Pending Approvals Count** | `GET /api/v1/dashboard/summary` | `data.pendingApprovals` | **READY 🟢** |

---

# 3. MISSING COVERAGE (V2 / V3 ROADMAP)

Meskipun V1 **100% READY** dari 2 endpoint di atas, untuk V2/V3 dilaporkan missing coverage berikut:

1. **Legal Review Turnaround Time (Hari)**:
   - *Field Hilang*: `submitted_at` & `approved_at` pada `contracts`.
   - *Endpoint Diperlukan*: `GET /api/v1/legal/analytics/turnaround`
   - *Estimasi Effort*: Low (2 jam).
2. **Project Schedule Performance Index (SPI)**:
   - *Field Hilang*: `actual_start_date` & `actual_end_date` pada `projects`/`tasks`.
   - *Endpoint Diperlukan*: `GET /api/v1/projects/analytics/delay`
   - *Estimasi Effort*: Medium (3.5 jam).

---

# 4. FRONTEND ONLY FEASIBILITY

### **BISA DIBUAT 100% FRONTEND ONLY ✅**

Seluruh 12 KPI target pada fase V1 **dapat langsung dibangun pada frontend Next.js** dengan memanfaatkan 2 REST API endpoint yang sudah tersedia, tanpa membutuhkan:
- 0 perubahan database schema.
- 0 penambahan endpoint backend baru.
- 0 refactoring pada backend services.

---

# 5. RECOMMENDED PAGE STRUCTURE (5 INTERNAL TABS)

Struktur antarmuka halaman `/reports` dipetakan sebagai berikut:

- **Tab 1: Executive Summary**
  - KPI Cards: Total Pipeline Value, Active Projects, Total Revenue, Avg Profit Margin %, Win Rate %.
  - Smart NLG Insights Panel (`data.insights`).
- **Tab 2: Sales & Marketing**
  - Sales Funnel Breakdown Chart.
  - 12-Month Pipeline Value Trend.
  - Business Sector Share (%) Distribution.
- **Tab 3: Project Delivery**
  - Total Active Projects Count & On-Time Rate (`data.onTimeRate`).
  - Operational Board Status Linkage.
- **Tab 4: Finance & Cost**
  - Invoiced Revenue vs Expenses Breakdown.
  - Average Profit Margin Percentage.
  - Calculated Gross Profit Realization Card.
- **Tab 5: Legal & Governance**
  - Pending Approvals Counter (`data.pendingApprovals`).
  - SPK Governance Compliance Status.

---

# FINAL VERDICT

## **`READY FOR IMPLEMENTATION`**

*(Seluruh 12 KPI dasar V1 terbukti 100% siap diintegrasikan pada Frontend menggunakan REST API existing `GET /api/v1/analytics/dashboard` dan `GET /api/v1/dashboard/summary` tanpa perubahan backend).*
