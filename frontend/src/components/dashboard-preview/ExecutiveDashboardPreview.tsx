'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  RiseOutlined,
  CheckCircleFilled,
  ShoppingFilled,
  DollarCircleFilled,
  FileTextFilled,
  SafetyCertificateFilled,
  CalendarOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  RightOutlined,
  DownOutlined,
  FolderFilled,
  CheckOutlined,
} from '@ant-design/icons';
import CountUp from 'react-countup';
import { useQuery } from '@tanstack/react-query';
import styles from './ExecutiveDashboardPreview.module.css';
import {
  DashboardService,
  ExecutiveSummaryResponse,
  DashboardPeriodType,
} from '@/services/dashboard.service';
import { InboxService, TodoItem, HistoryItem } from '@/services/inbox.service';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatNumber, formatDate } from '@/lib/formatters';

interface OperationalProject {
  id: number;
  name: string;
  contractNumber?: string;
  status: string;
  progress: number;
}

interface OperationalTender {
  id: number;
  title: string;
  customerName?: string;
  val: number;
  stage: string;
}

interface OperationalPO {
  id: number;
  poNumber: string;
  vendorName?: string;
  totalAmount: number;
  status: string;
}

interface OperationalInvoice {
  id: number;
  invoiceNumber: string;
  vendorName?: string;
  totalAmount: number;
  paymentStatus: string;
}

interface MonthlyDataPoint {
  month: string;
  monthNum: number;
  value: number;
  count: number;
}

const getDynamicPeriodOptions = (): Array<{ value: DashboardPeriodType; label: string; shortLabel: string }> => {
  const now = new Date();
  const year = now.getFullYear();
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const currentMonthName = monthNames[now.getMonth()];

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthName = monthNames[prevMonthDate.getMonth()];
  const prevMonthYear = prevMonthDate.getFullYear();
  const prevMonthLabel = prevMonthYear === year ? prevMonthName : `${prevMonthName} ${prevMonthYear}`;

  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const prevQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const prevQuarterYear = currentQuarter === 1 ? year - 1 : year;
  const prevQuarterLabel = prevQuarterYear === year ? `Kuartal ${prevQuarter}` : `Kuartal ${prevQuarter} ${prevQuarterYear}`;

  return [
    { value: 'YEAR_TO_DATE', label: 'Tahun Berjalan (YTD)', shortLabel: `YTD ${year}` },
    { value: 'THIS_MONTH', label: 'Bulan Ini', shortLabel: `${currentMonthName} ${year}` },
    { value: 'LAST_MONTH', label: 'Bulan Lalu', shortLabel: prevMonthLabel },
    { value: 'THIS_QUARTER', label: 'Kuartal Ini', shortLabel: `Kuartal ${currentQuarter} ${year}` },
    { value: 'LAST_QUARTER', label: 'Kuartal Lalu', shortLabel: prevQuarterLabel },
    { value: 'ALL_TIME', label: 'Semua Waktu', shortLabel: 'Semua Waktu' },
  ];
};

const PERIOD_OPTIONS: Array<{ value: DashboardPeriodType; label: string; shortLabel: string }> = getDynamicPeriodOptions();

const MONTH_NAMES_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const MONTH_TRANSLATE: Record<string, string> = {
  Jan: 'Jan', Feb: 'Feb', Mar: 'Mar', Apr: 'Apr', May: 'Mei', Jun: 'Jun',
  Jul: 'Jul', Aug: 'Agu', Sep: 'Sep', Oct: 'Okt', Nov: 'Nov', Dec: 'Des',
};

export const ExecutiveDashboardPreview: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriodType>('YEAR_TO_DATE');
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [divisionOptions, setDivisionOptions] = useState<Array<{ id: string; name: string }>>([
    { id: 'ALL', name: 'Semua Entitas' },
  ]);
  const [divisionError, setDivisionError] = useState<string | null>(null);
  const [divisionLoading, setDivisionLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<ExecutiveSummaryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'priority' | 'approvals' | 'activity'>('priority');

  // Operational Detail Data
  const [projectsList, setProjectsList] = useState<OperationalProject[]>([]);
  const [tendersList, setTendersList] = useState<OperationalTender[]>([]);
  const [posList, setPosList] = useState<OperationalPO[]>([]);
  const [invoicesList, setInvoicesList] = useState<OperationalInvoice[]>([]);

  // Time-series Monthly Datasets
  const [contractsMonthly, setContractsMonthly] = useState<MonthlyDataPoint[]>([]);
  const [paymentsMonthly, setPaymentsMonthly] = useState<MonthlyDataPoint[]>([]);
  const [posMonthly, setPosMonthly] = useState<MonthlyDataPoint[]>([]);

  // Decoupled TanStack Query for To-Dos (Independent query & cache, shared with NotificationBell)
  const {
    data: todos = [],
    isLoading: todosLoading,
    refetch: refetchTodos,
  } = useQuery<TodoItem[]>({
    queryKey: ['inbox', 'todos'],
    queryFn: () => InboxService.getTodos(),
    staleTime: 60000,
  });

  // Decoupled TanStack Query for History/Activities (Independent query, does not block summary)
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useQuery<HistoryItem[]>({
    queryKey: ['inbox', 'history'],
    queryFn: () => InboxService.getHistory(),
    staleTime: 60000,
  });

  // Respect system prefers-reduced-motion for smooth KPI number animation
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);
  const animDuration = prefersReducedMotion ? 0 : 0.8;

  const requestIdRef = useRef<number>(0);
  const selectedPeriodRef = useRef<DashboardPeriodType>(selectedPeriod);
  selectedPeriodRef.current = selectedPeriod;
  const selectedDivisionRef = useRef<string>(selectedDivision);
  selectedDivisionRef.current = selectedDivision;
  const inFlightRef = useRef<boolean>(false);

  // Progressive Independent Executive Summary Fetcher (Never blocked by inbox history)
  const fetchSummary = useCallback(
    async (
      isRefresh = false,
      periodToFetch: DashboardPeriodType = selectedPeriod,
      divisionToFetch: string = selectedDivision,
    ) => {
      const currentRequestId = ++requestIdRef.current;
      inFlightRef.current = true;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        setDivisionError(null);

        // Authoritative Executive Summary with selected period and division
        const summaryRes = await DashboardService.getExecutiveSummary({
          period: periodToFetch,
          divisionId: divisionToFetch !== 'ALL' ? divisionToFetch : undefined,
        }).catch((err) => {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Divisi tidak valid atau gagal memuat data divisi.';
          setDivisionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
          return null;
        });

        if (currentRequestId !== requestIdRef.current) return;

        setSummaryData(summaryRes);

        // CP3: If analyticalCharts and operationalTables are provided by executive-summary, bind them directly
        if (summaryRes?.analyticalCharts && summaryRes?.operationalTables) {
          setContractsMonthly(summaryRes.analyticalCharts.contractsWonTrend || []);
          setPaymentsMonthly(summaryRes.analyticalCharts.vendorPaymentsTrend || []);
          setPosMonthly(summaryRes.analyticalCharts.procurementCommitmentsTrend || []);

          setProjectsList(summaryRes.operationalTables.activeProjects || []);
          setTendersList(summaryRes.operationalTables.recentTenders || []);
          setPosList(summaryRes.operationalTables.recentPurchaseOrders || []);
          setInvoicesList(summaryRes.operationalTables.recentInvoices || []);
        } else {
          // Failure path / unsupported data: clean scoped state immediately.
          // NEVER fallback to installation-wide or un-scoped queries (prevents cross-company data leakage).
          setContractsMonthly([]);
          setPaymentsMonthly([]);
          setPosMonthly([]);
          setProjectsList([]);
          setTendersList([]);
          setPosList([]);
          setInvoicesList([]);
        }
      } catch {
        // Retain graceful operational boundary on catastrophic network error
      } finally {
        inFlightRef.current = false;
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedPeriod, selectedDivision],
  );

  const fetchData = fetchSummary;

  useEffect(() => {
    setDivisionLoading(true);
    DashboardService.getAuthorizedDivisions()
      .then((res) => {
        if (Array.isArray(res.availableDivisions) && res.availableDivisions.length > 0) {
          setDivisionOptions(
            res.availableDivisions.map((d) => ({
              id: d.id,
              name: d.id === 'ALL' || d.name === 'Semua Divisi' ? 'Semua Entitas' : d.name,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        setDivisionLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSummary(false, 'YEAR_TO_DATE', 'ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CP4-R1-F3: Automatic periodic refresh (60s) + visibility and online listeners
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Do not poll if tab is in the background or fetch is already running
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (inFlightRef.current) {
        return;
      }
      fetchSummary(true, selectedPeriodRef.current, selectedDivisionRef.current);
    }, 60000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !inFlightRef.current) {
        fetchSummary(true, selectedPeriodRef.current, selectedDivisionRef.current);
      }
    };

    const handleOnline = () => {
      if (!inFlightRef.current) {
        fetchSummary(true, selectedPeriodRef.current, selectedDivisionRef.current);
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [fetchSummary]);

  // Unified Parallel Refresh Handler
  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([
      fetchSummary(true, selectedPeriod, selectedDivision),
      refetchTodos(),
      refetchActivities(),
    ]);
  }, [fetchSummary, refetchTodos, refetchActivities, selectedPeriod, selectedDivision]);

  const handlePeriodChange = (newPeriod: DashboardPeriodType) => {
    setSelectedPeriod(newPeriod);
    fetchData(false, newPeriod);
  };

  const handleDivisionChange = (newDivision: string) => {
    setSelectedDivision(newDivision);
    fetchSummary(false, selectedPeriod, newDivision);
  };

  const handleClearDivision = () => {
    setSelectedDivision('ALL');
    setDivisionError(null);
    fetchSummary(false, selectedPeriod, 'ALL');
  };

  const pMetrics = summaryData?.periodMetrics;
  const cSnapshot = summaryData?.currentSnapshot;

  // KPI Calculations (Authoritative verified backend fields)
  const totalPipeline = pMetrics?.marketing?.totalPipeline ?? 0;
  const totalTenders = pMetrics?.marketing?.totalDeals ?? 0;
  const wonTenders = pMetrics?.marketing?.wonDeals ?? 0;

  const activeProjects = cSnapshot?.projects?.activeProjects ?? 0;
  const planningProjects = cSnapshot?.projects?.planningProjects ?? 0;
  const inProgressProjects = cSnapshot?.projects?.inProgressProjects ?? 0;
  const totalProjectsCount = cSnapshot?.projects?.totalProjects ?? 0;
  const completedProjects = cSnapshot?.projects?.completedProjects ?? 0;
  const closedProjectsCount = cSnapshot?.projects?.closedProjectsCount ?? 0;
  const closedProjectsContractValue = cSnapshot?.projects?.closedProjectsContractValue ?? 0;
  const onHoldProjects = cSnapshot?.projects?.onHoldProjects ?? 0;
  const cancelledProjects = cSnapshot?.projects?.cancelledProjects ?? 0;

  const poCommitted = pMetrics?.procurement?.poCommittedValue ?? 0;
  const poCount = pMetrics?.procurement?.poCount ?? 0;
  const completedPoCount = pMetrics?.procurement?.completedPoCount ?? 0;

  const vendorPayments = pMetrics?.vendorPayments?.paymentValue ?? 0;
  const paymentCount = pMetrics?.vendorPayments?.paymentCount ?? 0;

  const outstandingInvoiceValue = cSnapshot?.accountsPayable?.outstandingInvoiceValue ?? 0;
  const outstandingInvoiceCount = cSnapshot?.accountsPayable?.outstandingInvoiceCount ?? 0;

  const totalPendingTasks = cSnapshot?.approvals?.totalPendingTasks ?? 0;

  // Formatter for short Billions / Millions with Rp prefix
  const formatShortValue = (val: number) => {
    if (val >= 1000000000) {
      const bn = val / 1000000000;
      return `Rp ${bn.toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
    }
    if (val >= 1000000) {
      const jt = val / 1000000;
      return `Rp ${jt.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  // Formatter for Closed Projects Contract Value (Rp 910,82 jt / Rp 0 / Rp X,XX M)
  const formatClosedProjectValue = (val: number) => {
    if (!val || val === 0) return 'Rp 0';
    if (val >= 1000000000) {
      const bn = val / 1000000000;
      return `Rp ${bn.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
    }
    if (val >= 1000000) {
      const jt = val / 1000000;
      return `Rp ${jt.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} jt`;
    }
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  // Reconciled Project Distribution (Ensures categories sum precisely to totalProjects)
  const projectDistribution = useMemo(() => {
    const denom = totalProjectsCount > 0 ? totalProjectsCount : 1;
    return [
      {
        key: 'PLANNING',
        label: 'Perencanaan',
        count: planningProjects,
        color: '#94A3B8',
        pct: totalProjectsCount > 0 ? Math.round((planningProjects / denom) * 100) : 0,
      },
      {
        key: 'IN_PROGRESS',
        label: 'Sedang Eksekusi',
        count: inProgressProjects,
        color: '#10B981',
        pct: totalProjectsCount > 0 ? Math.round((inProgressProjects / denom) * 100) : 0,
      },
      {
        key: 'COMPLETED',
        label: 'Selesai',
        count: completedProjects,
        color: '#06B6D4',
        pct: totalProjectsCount > 0 ? Math.round((completedProjects / denom) * 100) : 0,
      },
      {
        key: 'ON_HOLD',
        label: 'Ditunda',
        count: onHoldProjects,
        color: '#F59E0B',
        pct: totalProjectsCount > 0 ? Math.round((onHoldProjects / denom) * 100) : 0,
      },
      {
        key: 'CANCELLED',
        label: 'Dibatalkan',
        count: cancelledProjects,
        color: '#EF4444',
        pct: totalProjectsCount > 0 ? Math.round((cancelledProjects / denom) * 100) : 0,
      },
    ];
  }, [totalProjectsCount, planningProjects, inProgressProjects, completedProjects, onHoldProjects, cancelledProjects]);

  // Donut Arc Calculations (Circumference ~ 289 for r=46)
  const donutCircumference = 289.026;
  const inProgressStroke = totalProjectsCount > 0 ? (inProgressProjects / totalProjectsCount) * donutCircumference : 0;
  const completedStroke = totalProjectsCount > 0 ? (completedProjects / totalProjectsCount) * donutCircumference : 0;
  const planningStroke = totalProjectsCount > 0 ? (planningProjects / totalProjectsCount) * donutCircumference : 0;

  // Real Marketing Trend Array from backend
  const marketingTrend = useMemo(() => {
    const rawTrend = pMetrics?.marketing?.marketingTrend || [];
    if (!Array.isArray(rawTrend) || rawTrend.length === 0) return [];
    return rawTrend.map((item) => ({
      month: MONTH_TRANSLATE[item.month] || item.month,
      value: Number(item.value || 0),
    }));
  }, [pMetrics?.marketing?.marketingTrend]);

  const maxMarketingVal = useMemo(() => {
    const vals = marketingTrend.map((t) => t.value);
    const max = Math.max(...vals, 0);
    return max > 0 ? max * 1.25 : 120000000000;
  }, [marketingTrend]);

  const hasMarketingData = useMemo(() => {
    return marketingTrend.some((m) => m.value > 0);
  }, [marketingTrend]);

  // Secondary Chart Maxima and Data Presence
  const maxContractVal = useMemo(() => {
    const vals = contractsMonthly.map((c) => c.value);
    const max = Math.max(...vals, 0);
    return max > 0 ? max * 1.25 : 100000000000;
  }, [contractsMonthly]);

  const hasContractsData = useMemo(() => {
    return contractsMonthly.some((c) => c.value > 0);
  }, [contractsMonthly]);

  const maxPaymentVal = useMemo(() => {
    const vals = paymentsMonthly.map((p) => p.value);
    const max = Math.max(...vals, 0);
    return max > 0 ? max * 1.25 : 1000000000;
  }, [paymentsMonthly]);

  const hasPaymentsData = useMemo(() => {
    return paymentsMonthly.some((p) => p.value > 0);
  }, [paymentsMonthly]);

  const maxPoVal = useMemo(() => {
    const vals = posMonthly.map((po) => po.value);
    const max = Math.max(...vals, 0);
    return max > 0 ? max * 1.25 : 1000000000;
  }, [posMonthly]);

  const hasPosData = useMemo(() => {
    return posMonthly.some((po) => po.value > 0);
  }, [posMonthly]);

  // Formatted Last Updated Date from Authoritative Meta
  const formattedLastUpdated = useMemo(() => {
    const isoString = summaryData?.meta?.generatedAt;
    const d = isoString ? new Date(isoString) : new Date();
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return d.toLocaleDateString('id-ID');
    }
  }, [summaryData?.meta?.generatedAt]);

  const displayYear = useMemo(() => {
    const periodEnd = summaryData?.meta?.period?.endDate;
    if (periodEnd) {
      const d = new Date(periodEnd);
      if (!isNaN(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
  }, [summaryData?.meta?.period?.endDate]);

  const activePeriodOption = useMemo(() => {
    return PERIOD_OPTIONS.find((p) => p.value === selectedPeriod) || PERIOD_OPTIONS[0];
  }, [selectedPeriod]);

  return (
    <div className={styles.container}>
      {/* --- Executive Header --- */}
      <header className={styles.headerCard}>
        {/* Subtle Architectural Wireframe Watermark SVG */}
        <svg className={styles.architecturalWatermark} viewBox="0 0 520 120" fill="none">
          <g stroke="#94A3B8" strokeWidth="0.85" opacity="0.4">
            <path d="M 120,120 L 220,10 L 360,10 L 460,120" />
            <path d="M 220,10 L 220,120" />
            <path d="M 290,10 L 290,120" />
            <path d="M 360,10 L 360,120" />
            <path d="M 150,85 L 430,85" />
            <path d="M 175,55 L 405,55" />
            <path d="M 200,30 L 380,30" />
            <path d="M 250,120 L 350,0 L 480,120" />
            <path d="M 300,120 L 400,20 L 510,120" />
            <line x1="220" y1="30" x2="290" y2="55" />
            <line x1="290" y1="30" x2="360" y2="55" />
            <line x1="220" y1="55" x2="290" y2="85" />
            <line x1="290" y1="55" x2="360" y2="85" />
            <line x1="220" y1="85" x2="290" y2="120" />
            <line x1="290" y1="85" x2="360" y2="120" />
          </g>
        </svg>

        <div className={styles.headerLeft}>
          <span className={styles.headerEyebrow}>EPMS / EXECUTIVE DASHBOARD</span>
          <h1 className={styles.headerTitle}>Ringkasan Kinerja</h1>
          <p className={styles.headerSubtitle}>
            Pantau peluang bisnis, proyek, pengadaan, dan keuangan secara terintegrasi.
          </p>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            {/* Interactive Period Selector */}
            <label className={styles.controlPill} htmlFor="executive-period-select" title="Pilih Periode Laporan">
              <div className={styles.controlPillLeft}>
                <CalendarOutlined className={styles.controlPillIcon} />
                <span className={styles.controlPillLabel}>Periode:</span>
              </div>
              <div className={styles.controlPillRight}>
                <select
                  id="executive-period-select"
                  className={styles.periodSelect}
                  value={selectedPeriod}
                  onChange={(e) => handlePeriodChange(e.target.value as DashboardPeriodType)}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <DownOutlined className={styles.controlPillChevron} />
              </div>
            </label>

            {/* Interactive Entity Selector */}
            <label className={styles.controlPill} htmlFor="executive-division-select" title="Pilih Entitas">
              <div className={styles.controlPillLeft}>
                <ApartmentOutlined className={styles.controlPillIcon} />
                <span className={styles.controlPillLabel}>Entitas:</span>
              </div>
              <div className={styles.controlPillRight}>
                <select
                  id="executive-division-select"
                  className={styles.periodSelect}
                  value={selectedDivision}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  disabled={divisionLoading}
                >
                  {divisionOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name === 'Semua Divisi' ? 'Semua Entitas' : opt.name}
                    </option>
                  ))}
                </select>
                <DownOutlined className={styles.controlPillChevron} />
              </div>
            </label>

            <div className={styles.headerMetaRow}>
              <div className={styles.updateStatus}>
                <ClockCircleOutlined style={{ fontSize: 12, color: '#64748B' }} />
                <span>Update Terakhir: {formattedLastUpdated}</span>
              </div>

              <button
                type="button"
                className={styles.refreshButton}
                onClick={handleRefresh}
                title="Refresh Data"
                disabled={refreshing}
              >
                <SyncOutlined spin={refreshing} style={{ fontSize: 13 }} />
              </button>
            </div>
          </div>

          <div className={styles.sloganBlock}>
            <span className={styles.sloganTextTop}>From Opportunity</span>
            <span className={styles.sloganTextBottom}>to Impact</span>
            <div className={styles.sloganLine} />
          </div>
        </div>
      </header>

      {/* Division/Entity Scope Alert Banner if an unconfigured/invalid division was selected */}
      {divisionError && (
        <div className={styles.divisionErrorBanner} role="alert">
          <span className={styles.divisionErrorText}>
            <strong>Peringatan Filter Entitas:</strong> {divisionError}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className={styles.divisionClearBtn}
              onClick={() => fetchSummary(true, selectedPeriod, selectedDivision)}
              style={{ backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8' }}
            >
              Coba Lagi
            </button>
            <button
              type="button"
              className={styles.divisionClearBtn}
              onClick={handleClearDivision}
            >
              Kembali ke Semua Entitas {/* Kembali ke Semua Divisi */}
            </button>
          </div>
        </div>
      )}


      {/* --- Row 1: Six Executive KPI Cards --- */}
      <section className={styles.kpiGrid}>
        {/* Card 1: Total Pipeline Value */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                <RiseOutlined />
              </div>
              <span className={styles.kpiLabel}>Total Pipeline Value</span>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 52 20">
              <path
                d="M 2,16 C 14,14 24,10 34,7 C 40,5 46,3 50,2"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.kpiValue}>
            <CountUp
              end={Number(totalPipeline || 0)}
              separator="."
              decimal=","
              prefix="Rp "
              duration={animDuration}
              preserveValue
            />
          </div>
          <div className={styles.kpiBottom}>
            <span className={styles.kpiSubtext}>
              <CountUp end={Number(totalTenders || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Tender •{' '}
              <CountUp end={Number(wonTenders || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Menang
            </span>
            <span className={styles.badgePill} style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
              {activePeriodOption.shortLabel}
            </span>
          </div>
        </div>

        {/* Card 2: Proyek Aktif */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
                <CheckCircleFilled />
              </div>
              <span className={styles.kpiLabel}>Proyek Aktif</span>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 52 20">
              <path
                d="M 2,17 C 16,17 24,14 34,9 C 40,6 46,3 50,2"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.kpiValueLarge}>
            <CountUp
              end={Number(activeProjects || 0)}
              separator="."
              decimal=","
              duration={animDuration}
              preserveValue
            />
          </div>
          <div className={styles.kpiBottom}>
            <span className={styles.kpiSubtext}>
              <CountUp end={Number(planningProjects || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Perencanaan •{' '}
              <CountUp end={Number(inProgressProjects || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Eksekusi
            </span>
            <span className={styles.badgePill} style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
              Status Saat Ini
            </span>
          </div>
        </div>

        {/* Card 3: Komitmen Pengadaan */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                <ShoppingFilled />
              </div>
              <span className={styles.kpiLabel}>Komitmen Pengadaan</span>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 52 20">
              <path
                d="M 2,18 C 14,16 24,13 36,8 C 42,5 48,3 50,2"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.kpiValue}>
            <CountUp
              end={Number(poCommitted || 0)}
              separator="."
              decimal=","
              prefix="Rp "
              duration={animDuration}
              preserveValue
            />
          </div>
          <div className={styles.kpiBottom}>
            <span className={styles.kpiSubtext}>
              <CountUp end={Number(poCount || 0)} separator="." decimal="," duration={animDuration} preserveValue /> PO Diterbitkan •{' '}
              <CountUp end={Number(completedPoCount || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Selesai
            </span>
            <span className={styles.badgePill} style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
              {activePeriodOption.shortLabel}
            </span>
          </div>
        </div>

        {/* Card 4: Pembayaran Vendor */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#F5F3FF', color: '#8B5CF6' }}>
                <DollarCircleFilled />
              </div>
              <span className={styles.kpiLabel}>Pembayaran Vendor</span>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 52 20">
              <path
                d="M 2,16 C 12,16 22,14 32,9 C 40,5 46,3 50,2"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.kpiValue}>
            <CountUp
              end={Number(vendorPayments || 0)}
              separator="."
              decimal=","
              prefix="Rp "
              duration={animDuration}
              preserveValue
            />
          </div>
          <div className={styles.kpiBottom}>
            <span className={styles.kpiSubtext}>
              <CountUp end={Number(paymentCount || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Transaksi Lunas
            </span>
            <span className={styles.badgePill} style={{ backgroundColor: '#EDE9FE', color: '#5B21B6' }}>
              {activePeriodOption.shortLabel}
            </span>
          </div>
        </div>

        {/* Card 5: Invoice Outstanding */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}>
                <FileTextFilled />
              </div>
              <span className={styles.kpiLabel}>Invoice Outstanding</span>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 52 20">
              <path
                d="M 2,10 C 14,11 26,13 38,15 C 44,16 48,17 50,18"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.kpiValueLarge}>
            <CountUp
              end={Number(outstandingInvoiceValue || 0)}
              separator="."
              decimal=","
              prefix="Rp "
              duration={animDuration}
              preserveValue
            />
          </div>
          <div className={styles.kpiBottom}>
            <span className={styles.kpiSubtext}>
              <CountUp end={Number(outstandingInvoiceCount || 0)} separator="." decimal="," duration={animDuration} preserveValue /> Tagihan Belum Lunas
            </span>
            <span className={styles.badgePill} style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              Status Saat Ini
            </span>
          </div>
        </div>

        {/* Card 6: Antrean Persetujuan */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#FEFCE8', color: '#EAB308' }}>
                <SafetyCertificateFilled />
              </div>
              <span className={styles.kpiLabel}>Antrean Persetujuan</span>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 52 20">
              <path
                d="M 2,17 C 12,17 24,15 34,10 C 42,6 46,3 50,2"
                fill="none"
                stroke="#EAB308"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.kpiValueLarge}>
            <CountUp
              end={Number(totalPendingTasks || 0)}
              separator="."
              decimal=","
              duration={animDuration}
              preserveValue
            />
          </div>
          <div className={styles.kpiBottom}>
            <span className={styles.kpiSubtext}>
              {cSnapshot?.approvals?.scope === 'GLOBAL' ? 'Tugas Manajemen (Global)' : 'Tugas Manajemen'}
            </span>
            <span className={styles.badgePill} style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
              {cSnapshot?.approvals?.isSharedWorkflow ? 'Lintas Perusahaan' : 'Status Saat Ini'}
            </span>
          </div>
        </div>
      </section>

      {/* --- Row 2: Primary Analytics Row --- */}
      <section className={styles.primaryRow}>
        {/* Panel 1: Tren Pipeline Marketing */}
        <div className={styles.analyticsCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <RiseOutlined className={styles.panelIcon} />
              <div>
                <h3 className={styles.panelTitle}>Tren Pipeline Marketing</h3>
                <p className={styles.panelSubtitle}>Distribusi nilai peluang bisnis per bulan (data aktual)</p>
              </div>
            </div>
            <div className={styles.chartLegend}>
              <span>
                <span className={styles.legendDot} style={{ backgroundColor: '#2563EB' }} />
                Nilai Pipeline
              </span>
            </div>
          </div>

          <div className={styles.chartContainer}>
            {!hasMarketingData ? (
              <div className={styles.emptyChartState}>Belum ada data</div>
            ) : (
              <svg viewBox="0 0 470 210" style={{ width: '100%', height: '100%' }}>
                {/* Y Axis Grid Lines */}
                {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => {
                  const y = 20 + idx * 38;
                  const labelVal = maxMarketingVal * ratio;
                  return (
                    <g key={idx}>
                      <line x1="42" y1={y} x2="455" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <text x="36" y={y + 4} textAnchor="end" fontSize="10.5" fill="#94A3B8" fontWeight="500">
                        {labelVal > 0 ? `${(labelVal / 1e9).toFixed(0)} M` : '0'}
                      </text>
                    </g>
                  );
                })}

                {/* Bars for 12 months from actual backend trend */}
                {marketingTrend.map((m, idx) => {
                  const x = 50 + idx * 34;
                  const height = m.value > 0 ? (m.value / maxMarketingVal) * 152 : 3;
                  const y = 172 - height;
                  const isPeak = m.value === Math.max(...marketingTrend.map((t) => t.value)) && m.value > 0;

                  return (
                    <g key={idx}>
                      <rect
                        x={x}
                        y={y}
                        width="18"
                        height={height}
                        rx="3"
                        fill={isPeak ? '#2563EB' : m.value > 0 ? '#93C5FD' : '#E2E8F0'}
                      />
                      <text x={x + 9} y="194" textAnchor="middle" fontSize="10" fill="#64748B">
                        {m.month}
                      </text>

                      {/* Tooltip on Peak Value */}
                      {isPeak && (
                        <g transform={`translate(${Math.min(x - 30, 360)}, ${Math.max(y - 40, 10)})`}>
                          <rect x="0" y="0" width="86" height="32" rx="6" fill="#1E293B" />
                          <path d="M 43,32 L 46,36 L 49,32 Z" fill="#1E293B" />
                          <text x="43" y="14" textAnchor="middle" fontSize="10" fill="#FFFFFF" fontWeight="700">
                            {formatShortValue(m.value)}
                          </text>
                          <text x="43" y="25" textAnchor="middle" fontSize="8.5" fill="#94A3B8">
                            {formatNumber(totalTenders)} Tender
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Panel 2: Project Status Overview (Reconciled with 100% data consistency) */}
        <div className={styles.analyticsCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <FolderFilled className={styles.panelIcon} />
              <div>
                <h3 className={styles.panelTitle}>Project Status Overview</h3>
                <p className={styles.panelSubtitle}>Distribusi status proyek (berdasarkan data aktual)</p>
              </div>
            </div>
          </div>

          <div className={styles.donutWrapper}>
            <div className={styles.donutSvgArea}>
              <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
                {/* Background Ring */}
                <circle cx="60" cy="60" r="46" fill="none" stroke="#F1F5F9" strokeWidth="15" />

                {/* Proportional In-Progress Arc (Green) */}
                {inProgressStroke > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="15"
                    strokeDasharray={`${inProgressStroke} ${donutCircumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                )}

                {/* Proportional Completed Arc (Cyan) */}
                {completedStroke > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="15"
                    strokeDasharray={`${completedStroke} ${donutCircumference}`}
                    strokeDashoffset={`-${inProgressStroke}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                )}

                {/* Proportional Planning Arc (Blue) if any */}
                {planningStroke > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="15"
                    strokeDasharray={`${planningStroke} ${donutCircumference}`}
                    strokeDashoffset={`-${inProgressStroke + completedStroke}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                )}
              </svg>
              <div className={styles.donutCenterText}>
                <div className={styles.donutCenterNumber}>
                  {/* {totalProjectsCount} */}
                  <CountUp end={Number(totalProjectsCount || 0)} separator="." decimal="," duration={animDuration} preserveValue />
                </div>
                <div className={styles.donutCenterLabel}>Total Proyek</div>
              </div>
            </div>

            <div className={styles.statusTable}>
              {projectDistribution.map((item) => (
                <div className={styles.statusRow} key={item.key}>
                  <span className={styles.statusLeft}>
                    <span className={styles.legendDot} style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <div>
                    <span className={styles.statusCount}>
                      <CountUp end={Number(item.count || 0)} separator="." decimal="," duration={animDuration} preserveValue />
                    </span>
                    <span className={styles.statusPct}>
                      <CountUp end={Number(item.pct || 0)} suffix="%" duration={animDuration} preserveValue />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Business Indicators: Proyek Closed & Nilai Proyek Selesai (CLOSED) */}
          <div className={styles.closedProjectsStrip} id="closed-projects-summary-strip">
            <div className={styles.closedColLeft}>
              <div className={styles.closedColHeader}>
                <CheckCircleFilled style={{ color: '#10B981', fontSize: 13 }} />
                <span>Proyek Closed</span>
              </div>
              <div className={styles.closedColValue} id="closed-projects-count">
                <CountUp end={Number(closedProjectsCount || 0)} separator="." decimal="," duration={animDuration} preserveValue />
              </div>
              <div className={styles.closedSubtitle} style={{ marginTop: 2, fontSize: 10, color: '#64748B' }}>
                Status Saat Ini
              </div>
            </div>
            <div className={styles.closedColRight}>
              <div className={styles.closedColHeader}>
                <span>Nilai Proyek Selesai (CLOSED)</span>
                <span style={{ fontSize: 9.5, backgroundColor: '#F1F5F9', color: '#475569', padding: '1px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 600 }}>
                  Status Saat Ini
                </span>
              </div>
              <div className={styles.closedColValue} id="closed-projects-value">
                <CountUp
                  end={Number(closedProjectsContractValue || 0)}
                  formattingFn={formatClosedProjectValue}
                  duration={animDuration}
                  preserveValue
                />
              </div>
              <div className={styles.closedSubtitle}>
                Akumulasi proyek berstatus CLOSED — tidak mengikuti filter periode.
              </div>
            </div>
          </div>

          <Link href="/project-delivery" className={styles.panelFooterLink}>
            Lihat Portfolio <RightOutlined style={{ fontSize: 10 }} />
          </Link>
        </div>

        {/* Panel 3: Priority Actions / Approval Queue */}
        <div className={styles.analyticsCard}>
          <div className={styles.tabHeader}>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'priority' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('priority')}
            >
              <span>Priority Actions</span>
              <span className={styles.tabBadge} style={{ backgroundColor: '#EF4444' }}>
                {todos.length}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'approvals' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('approvals')}
            >
              <span>Approval Queue</span>
              <span className={styles.tabBadge} style={{ backgroundColor: '#F59E0B' }}>
                {totalPendingTasks}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'activity' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              <span>Recent Activity</span>
            </button>
          </div>

          <div className={styles.actionList}>
            {/* View 1: Priority Actions (Direct Actionable Tasks) */}
            {activeTab === 'priority' && (
              todosLoading && todos.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>
                  Memuat tugas prioritas...
                </div>
              ) : todos.length > 0 ? (
                todos.slice(0, 5).map((todo, idx) => (
                  <Link
                    key={todo.todoId || idx}
                    href={todo.actionTarget || '/inbox'}
                    className={styles.actionItem}
                  >
                    <div className={styles.actionItemLeft}>
                      <div className={styles.numberCircle}>0{idx + 1}</div>
                      <div className={styles.actionTextGroup}>
                        <span className={styles.actionItemTitle}>{todo.title}</span>
                        <span className={styles.actionItemDesc}>
                          {todo.description || `${todo.entityType || 'TUGAS'} • Menunggu tindakan Direktur`}
                        </span>
                      </div>
                    </div>
                    <RightOutlined className={styles.actionChevron} />
                  </Link>
                ))
              ) : (
                <div className={styles.emptyActionState}>
                  Tidak ada tugas prioritas yang membutuhkan aksi langsung Anda saat ini.
                </div>
              )
            )}

            {/* View 2: Approval Queue (Organization Workflow Queue) */}
            {activeTab === 'approvals' && (
              totalPendingTasks > 0 ? (
                <div className={styles.approvalsWrapper}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                      Distribusi Peran Penyetuju:
                    </span>
                    {cSnapshot?.approvals?.isSharedWorkflow && (
                      <span className={styles.badgePill} style={{ backgroundColor: '#FEF9C3', color: '#854D0E', fontSize: 10 }}>
                        Lintas Perusahaan
                      </span>
                    )}
                  </div>
                  <div className={styles.rolePillsRow}>
                    {cSnapshot?.approvals?.pendingByRole &&
                      Object.entries(cSnapshot.approvals.pendingByRole).map(([role, cnt]) => (
                        <span key={role} className={styles.rolePill}>
                          {role}: <strong>{cnt}</strong>
                        </span>
                      ))}
                  </div>

                  {cSnapshot?.approvals?.pendingByTaskKey && cSnapshot.approvals.pendingByTaskKey.length > 0 && (
                    <>
                      <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600, marginTop: 4 }}>
                        Tugas Tertahan:
                      </div>
                      <div className={styles.taskKeyList}>
                        {cSnapshot.approvals.pendingByTaskKey.slice(0, 3).map((tk) => (
                          <div key={tk.taskKey} className={styles.taskKeyItem}>
                            <span style={{ color: '#475569' }}>{tk.taskKey}</span>
                            <strong style={{ color: '#0F172A' }}>{tk.count}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.emptyActionState}>
                  Tidak ada antrean persetujuan organisasi yang tertunda saat ini.
                </div>
              )
            )}

            {/* View 3: Recent Activity (Historical Tasks) */}
            {activeTab === 'activity' && (
              activitiesLoading && activities.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>
                  Memuat riwayat aktivitas...
                </div>
              ) : activities.length > 0 ? (
                activities.slice(0, 5).map((act, idx) => (
                  <div key={act.historyId || idx} className={styles.actionItem}>
                    <div className={styles.actionItemLeft}>
                      <div className={styles.checkCircle}>
                        <CheckOutlined style={{ fontSize: 11 }} />
                      </div>
                      <div className={styles.actionTextGroup}>
                        <span className={styles.actionItemTitle}>{act.title}</span>
                        <span className={styles.actionItemDesc}>
                          {act.decidedByName || 'Sistem'} • {act.completedAt ? formatDate(act.completedAt) : 'Selesai'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyActionState}>
                  Belum ada riwayat aktivitas terbaru yang tersimpan.
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* --- Row 3: Secondary Analytics Row (Actual Real Time-Series) --- */}
      <section className={styles.secondaryRow}>
        {/* Panel 1: Nilai Kontrak (Won) */}
        <div className={styles.analyticsCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
                <CheckCircleFilled />
              </div>
              <div>
                <h3 className={styles.panelTitle}>Nilai Kontrak (Won)</h3>
                <p className={styles.panelSubtitle}>Tren kontrak dimenangkan</p>
              </div>
            </div>
            <div className={styles.miniDropdown}>
              <span>Tahun {displayYear}</span>
              <DownOutlined style={{ fontSize: 9, color: '#94A3B8' }} />
            </div>
          </div>

          <div className={styles.chartContainer}>
            {!hasContractsData ? (
              <div className={styles.emptyChartState}>Belum ada data</div>
            ) : (
              <svg viewBox="0 0 320 160" style={{ width: '100%', height: '100%' }}>
                {[1, 0.5, 0].map((ratio, i) => {
                  const y = 20 + i * 50;
                  const labelVal = maxContractVal * ratio;
                  const formattedY =
                    labelVal >= 1000000000
                      ? `${(labelVal / 1000000000).toFixed(labelVal % 1000000000 === 0 ? 0 : 1)} M`
                      : labelVal >= 1000000
                      ? `${(labelVal / 1000000).toFixed(0)} jt`
                      : labelVal > 0
                      ? `${labelVal}`
                      : '0';
                  return (
                    <g key={i}>
                      <line x1="36" y1={y} x2="310" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <text x="30" y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                        {formattedY}
                      </text>
                    </g>
                  );
                })}
                {contractsMonthly.map((item, idx) => {
                  const x = 44 + idx * 26;
                  const h = item.value > 0 ? Math.max((item.value / maxContractVal) * 95, 8) : 2;
                  const y = 120 - h;
                  return (
                    <g key={item.month}>
                      <rect
                        x={x}
                        y={y}
                        width="14"
                        height={h}
                        rx="3"
                        fill={item.value > 0 ? '#10B981' : '#E2E8F0'}
                        data-month={item.month}
                        data-value={item.value}
                        data-count={item.count}
                      >
                        <title>{`${item.month}: Rp ${item.value.toLocaleString('id-ID')} (${item.count} Kontrak)`}</title>
                      </rect>
                      <text x={x + 7} y="138" textAnchor="middle" fontSize="9" fill="#64748B">
                        {item.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Panel 2: Pembayaran Vendor */}
        <div className={styles.analyticsCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#F5F3FF', color: '#8B5CF6' }}>
                <DollarCircleFilled />
              </div>
              <div>
                <h3 className={styles.panelTitle}>Pembayaran Vendor</h3>
                <p className={styles.panelSubtitle}>Realisasi pembayaran per bulan</p>
              </div>
            </div>
            <div className={styles.miniDropdown}>
              <span>Tahun {displayYear}</span>
              <DownOutlined style={{ fontSize: 9, color: '#94A3B8' }} />
            </div>
          </div>

          <div className={styles.chartContainer}>
            {!hasPaymentsData ? (
              <div className={styles.emptyChartState}>Belum ada data</div>
            ) : (
              <svg viewBox="0 0 320 160" style={{ width: '100%', height: '100%' }}>
                {[1, 0.5, 0].map((ratio, i) => {
                  const y = 20 + i * 50;
                  const labelVal = maxPaymentVal * ratio;
                  return (
                    <g key={i}>
                      <line x1="36" y1={y} x2="310" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <text x="30" y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                        {labelVal > 0 ? `${(labelVal / 1e6).toFixed(0)} jt` : '0'}
                      </text>
                    </g>
                  );
                })}
                {paymentsMonthly.map((item, idx) => {
                  const x = 44 + idx * 26;
                  const h = item.value > 0 ? Math.max((item.value / maxPaymentVal) * 95, 8) : 2;
                  const y = 120 - h;
                  return (
                    <g key={item.month}>
                      <rect
                        x={x}
                        y={y}
                        width="14"
                        height={h}
                        rx="3"
                        fill={item.value > 0 ? '#8B5CF6' : '#E2E8F0'}
                      />
                      <text x={x + 7} y="138" textAnchor="middle" fontSize="9" fill="#64748B">
                        {item.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Panel 3: Komitmen Pengadaan */}
        <div className={styles.analyticsCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <div className={styles.iconBox} style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                <ShoppingFilled />
              </div>
              <div>
                <h3 className={styles.panelTitle}>Komitmen Pengadaan</h3>
                <p className={styles.panelSubtitle}>Nilai PO diterbitkan per bulan</p>
              </div>
            </div>
            <div className={styles.miniDropdown}>
              <span>Tahun {displayYear}</span>
              <DownOutlined style={{ fontSize: 9, color: '#94A3B8' }} />
            </div>
          </div>

          <div className={styles.chartContainer}>
            {!hasPosData ? (
              <div className={styles.emptyChartState}>Belum ada data</div>
            ) : (
              <svg viewBox="0 0 320 160" style={{ width: '100%', height: '100%' }}>
                {[1, 0.5, 0].map((ratio, i) => {
                  const y = 20 + i * 50;
                  const labelVal = maxPoVal * ratio;
                  return (
                    <g key={i}>
                      <line x1="36" y1={y} x2="310" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <text x="30" y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                        {labelVal > 0 ? `${(labelVal / 1e6).toFixed(0)} jt` : '0'}
                      </text>
                    </g>
                  );
                })}
                {posMonthly.map((item, idx) => {
                  const x = 44 + idx * 26;
                  const h = item.value > 0 ? Math.max((item.value / maxPoVal) * 95, 8) : 2;
                  const y = 120 - h;
                  return (
                    <g key={item.month}>
                      <rect
                        x={x}
                        y={y}
                        width="14"
                        height={h}
                        rx="3"
                        fill={item.value > 0 ? '#F59E0B' : '#E2E8F0'}
                      />
                      <text x={x + 7} y="138" textAnchor="middle" fontSize="9" fill="#64748B">
                        {item.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </section>

      {/* --- Row 4: Operational Detail Row --- */}
      <section className={styles.operationalRow}>
        {/* Table 1: Proyek Aktif */}
        <div className={styles.tableCard}>
          <div className={styles.tableCardHeader}>
            <div className={styles.tableCardTitleGroup}>
              <FolderFilled style={{ color: '#10B981', fontSize: 14 }} />
              <span className={styles.tableCardTitle}>Proyek Aktif</span>
            </div>
            <Link href="/project-delivery" className={styles.tableSeeAll}>
              Lihat Semua <RightOutlined style={{ fontSize: 9 }} />
            </Link>
          </div>

          <div className={styles.tableResponsiveWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nama Proyek</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {projectsList.length > 0 ? (
                  projectsList.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.cellPrimaryText} title={p.name}>{p.name}</div>
                        <div className={styles.cellSecondaryText}>{p.contractNumber}</div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#334155' }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor:
                              p.status === 'Sedang Eksekusi' || p.status === 'IN_PROGRESS'
                                ? '#10B981'
                                : p.status === 'Perencanaan' || p.status === 'PLANNING'
                                ? '#2563EB'
                                : p.status === 'Selesai' || p.status === 'CLOSED' || p.status === 'COMPLETED'
                                ? '#06B6D4'
                                : p.status === 'Ditunda' || p.status === 'ON_HOLD'
                                ? '#F59E0B'
                                : '#64748B',
                          }} />
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.progressWrapper}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{p.progress}%</span>
                          <div className={styles.progressBarBg}>
                            <div className={styles.progressBarFill} style={{ width: `${p.progress}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className={styles.emptyDataState}>Belum ada data proyek aktif</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Tender & Peluang Bisnis */}
        <div className={styles.tableCard}>
          <div className={styles.tableCardHeader}>
            <div className={styles.tableCardTitleGroup}>
              <FileTextFilled style={{ color: '#2563EB', fontSize: 14 }} />
              <span className={styles.tableCardTitle}>Tender &amp; Peluang Bisnis</span>
            </div>
            <Link href="/sales" className={styles.tableSeeAll}>
              Lihat Semua <RightOutlined style={{ fontSize: 9 }} />
            </Link>
          </div>

          <div className={styles.tableResponsiveWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nama Tender</th>
                  <th>Nilai Potensi</th>
                  <th>Tahap</th>
                </tr>
              </thead>
              <tbody>
                {tendersList.length > 0 ? (
                  tendersList.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className={styles.cellPrimaryText} title={t.title}>{t.title}</div>
                        <div className={styles.cellSecondaryText}>{t.customerName}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {formatShortValue(t.val)}
                      </td>
                      <td>
                        <span
                          className={styles.tablePill}
                          style={{
                            backgroundColor:
                              t.stage === 'Menang'
                                ? '#D1FAE5'
                                : t.stage === 'Evaluasi'
                                ? '#DBEAFE'
                                : t.stage === 'Negosiasi'
                                ? '#FEF3C7'
                                : t.stage === 'Proposal'
                                ? '#E0F2FE'
                                : '#F5F3FF',
                            color:
                              t.stage === 'Menang'
                                ? '#065F46'
                                : t.stage === 'Evaluasi'
                                ? '#1E40AF'
                                : t.stage === 'Negosiasi'
                                ? '#92400E'
                                : t.stage === 'Proposal'
                                ? '#0369A1'
                                : '#6D28D9',
                          }}
                        >
                          {t.stage}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className={styles.emptyDataState}>Belum ada data tender</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 3: Pengadaan (PO) */}
        <div className={styles.tableCard}>
          <div className={styles.tableCardHeader}>
            <div className={styles.tableCardTitleGroup}>
              <ShoppingFilled style={{ color: '#F59E0B', fontSize: 14 }} />
              <span className={styles.tableCardTitle}>Pengadaan (PO)</span>
            </div>
            <Link href="/procurement" className={styles.tableSeeAll}>
              Lihat Semua <RightOutlined style={{ fontSize: 9 }} />
            </Link>
          </div>

          <div className={styles.tableResponsiveWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nomor PO</th>
                  <th>Vendor</th>
                  <th>Nilai</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {posList.length > 0 ? (
                  posList.map((po) => (
                    <tr key={po.id}>
                      <td>
                        <div className={styles.cellPrimaryText}>{po.poNumber}</div>
                      </td>
                      <td>
                        <div className={styles.cellSecondaryText} title={po.vendorName}>{po.vendorName}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {formatShortValue(po.totalAmount)}
                      </td>
                      <td>
                        <span
                          className={styles.tablePill}
                          style={{
                            backgroundColor:
                              po.status === 'Selesai'
                                ? '#D1FAE5'
                                : po.status === 'Diterbitkan'
                                ? '#DBEAFE'
                                : '#FEF3C7',
                            color:
                              po.status === 'Selesai'
                                ? '#065F46'
                                : po.status === 'Diterbitkan'
                                ? '#1E40AF'
                                : '#92400E',
                          }}
                        >
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className={styles.emptyDataState}>Belum ada data pengadaan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 4: Pembayaran & Tagihan */}
        <div className={styles.tableCard}>
          <div className={styles.tableCardHeader}>
            <div className={styles.tableCardTitleGroup}>
              <DollarCircleFilled style={{ color: '#2563EB', fontSize: 14 }} />
              <span className={styles.tableCardTitle}>Pembayaran &amp; Tagihan</span>
            </div>
            <Link href="/finance/invoices" className={styles.tableSeeAll}>
              Lihat Semua <RightOutlined style={{ fontSize: 9 }} />
            </Link>
          </div>

          <div className={styles.tableResponsiveWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>No. Invoice</th>
                  <th>Vendor</th>
                  <th>Nilai</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoicesList.length > 0 ? (
                  invoicesList.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <div className={styles.cellPrimaryText}>{inv.invoiceNumber}</div>
                      </td>
                      <td>
                        <div className={styles.cellSecondaryText} title={inv.vendorName}>{inv.vendorName}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {formatShortValue(inv.totalAmount)}
                      </td>
                      <td>
                        <span
                          className={styles.tablePill}
                          style={{
                            backgroundColor:
                              inv.paymentStatus === 'Lunas' ? '#D1FAE5' : '#FEF3C7',
                            color:
                              inv.paymentStatus === 'Lunas' ? '#065F46' : '#92400E',
                          }}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className={styles.emptyDataState}>Belum ada data invoice</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
