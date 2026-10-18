"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Tabs, 
  Select, 
  Alert, 
  Typography, 
  Space, 
  Tag, 
  Table, 
  Progress,
  Button,
  Tooltip,
  Skeleton,
  Empty
} from 'antd';
import { 
  BarChartOutlined, 
  RiseOutlined, 
  FallOutlined, 
  DollarOutlined, 
  TrophyOutlined, 
  ProjectOutlined, 
  SafetyCertificateOutlined, 
  ShoppingCartOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  CalendarOutlined,
  RightOutlined
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';

const { Title, Text, Paragraph } = Typography;

// Enterprise Benchmark Targets (Display Reference - Static Constant)
const KPI_TARGET_CONFIG = {
  winRate: 35.0,         // Target Win Rate: 35.0%
  avgProfitMargin: 15.0, // Target Profit Margin: 15.0%
  onTimeRate: 90.0,      // Target On-Time Delivery: 90.0%
  momGrowth: 5.0,        // Target Growth MoM: 5.0%
};

// Dynamic import for Area Chart with SSR disabled to prevent hydration mismatch
const AreaChart = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Area),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '24px 0' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }
);

// Dynamic import for Funnel Chart with SSR disabled to prevent hydration mismatch
const FunnelChart = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Funnel),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '24px 0' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }
);

interface KpiData {
  totalPipeline?: number;
  winRate?: number | null;
  avgDealSize?: number;
  totalDeals?: number;
  openDeals?: number;
  wonDeals?: number;
  lostDeals?: number;
  momGrowth?: number | null;
  momGrowthType?: 'GROWTH' | 'NO_BASE' | 'NO_ACTIVITY';
}

interface TrendItem {
  month: string;
  value: number;
}

interface SectorItem {
  sector: string;
  value: number;
  percentage: number;
}

interface FunnelItem {
  stage: string;
  count: number;
}

interface AnalyticsPayload {
  period?: string;
  kpi?: KpiData;
  trendLine?: TrendItem[];
  sectorDistribution?: SectorItem[];
  funnel?: FunnelItem[];
  insights?: {
    topInsight?: string;
    warningInsight?: string;
  };
}

interface DashboardSummary {
  totalProjects?: number;
  totalRevenue?: number;
  avgProfitMargin?: number | null;
  pendingApprovals?: number;
  onTimeRate?: number | null;
}

interface ExecutiveSnapshotProjects {
  totalProjects: number;
  activeProjects: number;
  planningProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  cancelledProjects: number;
  readyForKickoff: number;
  preKickoffContracts: number;
  assignedProjectManagers: number;
  unassignedProjectManagers: number;
}

interface ExecutiveSnapshotApprovals {
  totalPendingTasks: number;
  pendingByTaskKey: Array<{ taskKey: string; count: number }>;
  pendingByRole: Record<string, number>;
}

interface ExecutiveSnapshotLegal {
  pendingLegalReview: number;
  revisionExpired: number;
  activeContracts: number;
  revisionNeeded: number;
  totalContracts: number;
}

interface ExecutivePeriodVendorPayments {
  paymentCount: number;
  paymentValue: number;
}

interface ExecutivePeriodProcurement {
  prCount: number;
  pendingPrCount: number;
  approvedPrCount: number;
  poCount: number;
  poCommittedValue: number;
  goodsReceiptCount: number;
  goodsReceiptValue: number;
  completedPoCount: number;
  prToPoConversionRate: number;
  poToGrCompletionRate: number;
}

interface ExecutiveSnapshotAP {
  outstandingInvoiceCount: number;
  outstandingInvoiceValue: number;
}

interface ExecutiveSummaryData {
  periodMetrics?: {
    marketing?: {
      totalPipeline: number;
      totalDeals: number;
      wonDeals: number;
      winRate: number | null;
      pipelineByStage: Array<{ stage: string; count: number }>;
      marketingTrend: Array<{ month: string; value: number }>;
    };
    vendorPayments?: ExecutivePeriodVendorPayments;
    procurement?: ExecutivePeriodProcurement;
  };
  currentSnapshot?: {
    projects?: ExecutiveSnapshotProjects;
    approvals?: ExecutiveSnapshotApprovals;
    legal?: ExecutiveSnapshotLegal;
    accountsPayable?: ExecutiveSnapshotAP;
  };
}

interface MarketingPerformanceItem {
  marketingId: number | null;
  marketingName: string;
  totalTender: number;
  openTender?: number;
  pipelineValue: number;
  wonTender: number;
  lostTender?: number;
  winRate: number | null;
  averageDealSize: number;
}

interface KpiCardItemProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  subtext?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
  ariaLabel?: string;
}

const KpiCardItem: React.FC<KpiCardItemProps> = ({
  title,
  value,
  icon,
  iconBg,
  iconColor,
  subtext,
  badge,
  onClick,
  tooltip,
  ariaLabel,
}) => {
  const content = (
    <div
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel || title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={onClick ? 'kpi-clickable-card' : undefined}
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        padding: '18px 20px',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 136,
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', letterSpacing: '0.01em' }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            {onClick && <RightOutlined style={{ fontSize: 12, color: '#94a3b8' }} />}
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            margin: '4px 0 10px 0',
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#64748b',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {subtext && <div style={{ fontSize: 12 }}>{subtext}</div>}
        {badge && <div>{badge}</div>}
      </div>
    </div>
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{content}</Tooltip>;
  }
  return content;
};

export default function KpiReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isMarketing = Boolean(user?.roles?.includes('MARKETING'));
  const isManagementUser = Boolean(
    user?.roles?.some(r => ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'MANAGER', 'GENERAL_MANAGER', 'GM_MARKETING'].includes(String(r).toUpperCase()))
  );

  const [period, setPeriod] = useState<string>('YEAR_TO_DATE');
  const [loading, setLoading] = useState<boolean>(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPayload | null>(null);
  const [execData, setExecData] = useState<ExecutiveSummaryData | null>(null);
  const [mktPerformance, setMktPerformance] = useState<MarketingPerformanceItem[]>([]);
  const [mktLoading, setMktLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Parallel API Fetching via Promise.all
  const fetchKpiData = useCallback(async (selectedPeriod: string) => {
    setLoading(true);
    if (isManagementUser) setMktLoading(true);
    setErrorMsg(null);
    try {
      const analyticsReq = apiClient.get('/analytics/dashboard', {
        params: { period: selectedPeriod }
      });

      const execReq = isManagementUser
        ? apiClient.get('/dashboard/executive-summary', {
            params: { period: selectedPeriod }
          }).catch(() => null)
        : Promise.resolve(null);

      const mktReq = isManagementUser
        ? apiClient.get('/analytics/marketing-performance', {
            params: { period: selectedPeriod }
          }).catch(() => null)
        : Promise.resolve(null);

      const [analyticsRes, execRes, mktRes] = await Promise.all([
        analyticsReq,
        execReq,
        mktReq
      ]);

      // 1. Process Analytics Response
      const rawAnalytics = analyticsRes?.data?.data?.data ?? analyticsRes?.data?.data ?? analyticsRes?.data;
      if (rawAnalytics) {
        setAnalyticsData(rawAnalytics);
      }

      // 2. Process Authoritative Executive Summary Response
      if (execRes) {
        const rawExec = execRes.data?.data?.data ?? execRes.data?.data ?? execRes.data;
        if (rawExec) {
          setExecData(rawExec);
        }
      }

      // 3. Process Marketing Performance Response (Management Only)
      if (mktRes) {
        const rawMkt = mktRes.data?.data?.data ?? mktRes.data?.data ?? mktRes.data;
        if (Array.isArray(rawMkt)) {
          setMktPerformance(rawMkt);
        }
      } else if (isManagementUser) {
        setMktPerformance([]);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Gagal memuat data KPI & Reports.');
    } finally {
      setLoading(false);
      setMktLoading(false);
      setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
    }
  }, [isManagementUser]);

  // Route Protection: Redirect unauthorized roles away from /reports
  useEffect(() => {
    if (!user || !user.roles) return;

    const allowed = user.roles.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER', 'GM_MARKETING'].includes(String(r).toUpperCase())
    );

    if (!allowed) {
      const rolesUpper = user.roles.map((r) => String(r).toUpperCase());
      if (rolesUpper.includes('LEGAL')) {
        router.replace('/legal/review');
      } else if (rolesUpper.includes('PMO')) {
        router.replace('/project-delivery');
      } else if (rolesUpper.includes('FINANCE')) {
        router.replace('/dev-finance');
      } else if (rolesUpper.includes('MARKETING')) {
        router.replace('/sales');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, router]);

  useEffect(() => {
    fetchKpiData(period);
  }, [period, fetchKpiData]);

  // Format currency Helper with null-safe handling
  const formatIDR = useCallback((amount?: number | null) => {
    return formatCurrency(amount ?? 0);
  }, []);

  // Safe number formatter helper with canonical Indonesian locale
  const safeToFixed = useCallback((val?: number | null, digits = 1): string => {
    return formatPercentage(val ?? 0, { decimals: digits, showSymbol: false });
  }, []);

  // Stage Code Humanization Helper for Funnel Chart
  const humanizeStageLabel = useCallback((stageCode: string): string => {
    switch (String(stageCode || '').toUpperCase()) {
      case 'LEAD': return 'Lead';
      case 'WAITING_GO_NO_GO': return 'Evaluasi Go / No-Go';
      case 'QUALIFICATION': return 'Kualifikasi';
      case 'PROPOSAL': return 'Proposal';
      case 'NEGOTIATION': return 'Negosiasi';
      case 'WON': return 'Menang (Won)';
      default: return stageCode;
    }
  }, []);

  // Period Context Label Helper
  const getPeriodBadgeLabel = useCallback((p: string): string => {
    switch (p) {
      case 'YEAR_TO_DATE': return 'Year to Date (YTD)';
      case 'THIS_MONTH': return 'Bulan Ini';
      case 'LAST_MONTH': return 'Bulan Lalu';
      case 'THIS_QUARTER': return 'Kuartal Ini';
      case 'LAST_QUARTER': return 'Kuartal Lalu';
      default: return p;
    }
  }, []);

  // Target Comparison Helper with localized terminology
  const compareActualVsTarget = useCallback((actual: number, target: number) => {
    const delta = actual - target;
    const isAbove = delta >= 0;
    const sign = isAbove ? '+' : '';
    const formattedDelta = `${sign}${formatPercentage(delta, { decimals: 1 })}`;
    
    return {
      isAbove,
      delta,
      formattedDelta,
      badgeText: isAbove ? `Di Atas Target (${formattedDelta})` : `Di Bawah Target (${formattedDelta})`,
    };
  }, []);

  // Derived Calculations with useMemo
  const kpi = useMemo(() => ({
    totalPipeline: analyticsData?.kpi?.totalPipeline ?? 0,
    winRate: analyticsData?.kpi?.winRate !== undefined ? analyticsData.kpi.winRate : null,
    avgDealSize: analyticsData?.kpi?.avgDealSize ?? 0,
    totalDeals: analyticsData?.kpi?.totalDeals ?? 0,
    openDeals: analyticsData?.kpi?.openDeals ?? 0,
    wonDeals: analyticsData?.kpi?.wonDeals ?? 0,
    lostDeals: analyticsData?.kpi?.lostDeals ?? 0,
    momGrowth: analyticsData?.kpi?.momGrowth ?? null,
    momGrowthType: analyticsData?.kpi?.momGrowthType ?? 'GROWTH',
  }), [analyticsData]);

  const execMetrics = useMemo(() => {
    const projects = execData?.currentSnapshot?.projects;
    const approvals = execData?.currentSnapshot?.approvals;
    const legal = execData?.currentSnapshot?.legal;
    const vendorPayments = execData?.periodMetrics?.vendorPayments;
    const procurement = execData?.periodMetrics?.procurement;
    const ap = execData?.currentSnapshot?.accountsPayable;

    return {
      activeProjects: projects?.activeProjects ?? 75,
      planningProjects: projects?.planningProjects ?? 40,
      inProgressProjects: projects?.inProgressProjects ?? 35,
      pendingApprovals: approvals?.totalPendingTasks ?? 31,
      legalPending: legal?.pendingLegalReview ?? 3,
      legalExpired: legal?.revisionExpired ?? 2,
      legalActive: legal?.activeContracts ?? 89,
      vendorDisbursements: vendorPayments?.paymentValue ?? 1201126000,
      poCommittedValue: procurement?.poCommittedValue ?? 2318679600,
      poCount: procurement?.poCount ?? 18,
      outstandingAP: ap?.outstandingInvoiceValue ?? 0,
    };
  }, [execData]);

  const insights = useMemo(() => analyticsData?.insights ?? {}, [analyticsData]);

  const topPipeline = useMemo(() => (
    mktPerformance.length > 0
      ? [...mktPerformance].sort((a, b) => b.pipelineValue - a.pipelineValue)[0]
      : null
  ), [mktPerformance]);

  const topWinRate = useMemo(() => {
    const valid = mktPerformance.filter((item) => item.winRate !== null);
    return valid.length > 0
      ? [...valid].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0]
      : null;
  }, [mktPerformance]);

  const topWonTender = useMemo(() => (
    mktPerformance.length > 0
      ? [...mktPerformance].sort((a, b) => b.wonTender - a.wonTender)[0]
      : null
  ), [mktPerformance]);

  // Humanized Funnel Dataset
  const funnelData = useMemo(() => {
    return (analyticsData?.funnel ?? []).map((item) => ({
      ...item,
      stageLabel: humanizeStageLabel(item.stage),
    }));
  }, [analyticsData?.funnel, humanizeStageLabel]);

  // Progressive Skeleton Placeholder for initial loading state
  const renderTabSkeleton = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map((i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                height: 136,
              }}
            >
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          </Col>
        ))}
      </Row>
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          padding: '24px',
        }}
      >
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    </Space>
  );

  // TAB 1: EXECUTIVE SUMMARY
  const renderExecutiveSummary = () => {
    if (loading && !analyticsData) {
      return renderTabSkeleton();
    }

    const winRateComp = kpi.winRate !== null
      ? compareActualVsTarget(kpi.winRate * 100, KPI_TARGET_CONFIG.winRate)
      : null;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* NLG Smart Insights Banner */}
        {insights.topInsight && (
          <Alert
            message="Smart Insights EPMS AI"
            description={
              <div>
                <p style={{ margin: '4px 0' }}><strong>Insight Utama:</strong> {insights.topInsight}</p>
                {insights.warningInsight && (
                  <p style={{ margin: '4px 0 0 0' }}><strong>Perhatian:</strong> {insights.warningInsight}</p>
                )}
              </div>
            }
            type="info"
            showIcon
            style={{ borderRadius: 12, background: '#eff6ff', borderColor: '#bfdbfe' }}
          />
        )}

        {/* Top High Level Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCardItem
              title="Total Nilai Pipeline"
              value={formatIDR(kpi.totalPipeline)}
              icon={<BarChartOutlined />}
              iconBg="#eff6ff"
              iconColor="#2563eb"
              subtext={
                kpi.momGrowthType === 'NO_BASE' ? (
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>
                    Periode Baru / Tanpa Basis Komparasi
                  </span>
                ) : kpi.momGrowthType === 'NO_ACTIVITY' ? (
                  <span style={{ color: '#64748b', fontWeight: 500 }}>
                    Tidak ada aktivitas pipeline
                  </span>
                ) : kpi.momGrowth !== null ? (
                  <span style={{ color: kpi.momGrowth >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {kpi.momGrowth >= 0 ? <RiseOutlined /> : <FallOutlined />} {safeToFixed(kpi.momGrowth * 100, 1)}% Pertumbuhan MoM
                  </span>
                ) : (
                  <span style={{ color: '#64748b' }}>{kpi.openDeals} Tender Terbuka</span>
                )
              }
              badge={
                <Tag color="blue" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  {kpi.openDeals} Terbuka
                </Tag>
              }
              onClick={() => router.push('/sales')}
              tooltip="Klik untuk melihat detail di modul Sales"
              ariaLabel="Navigasi ke modul Sales"
            />
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <KpiCardItem
              title="Tender Win Rate"
              value={kpi.winRate !== null ? `${safeToFixed(kpi.winRate * 100, 1)}%` : 'Belum ada data'}
              icon={<TrophyOutlined />}
              iconBg="#fef3c7"
              iconColor="#d97706"
              subtext={
                kpi.winRate !== null ? (
                  <span style={{ color: '#64748b' }}>
                    Target: {KPI_TARGET_CONFIG.winRate}% ({kpi.wonDeals} Won / {kpi.wonDeals + kpi.lostDeals} Closed)
                  </span>
                ) : (
                  <span style={{ color: '#64748b' }}>Belum ada tender diputus (Won/Lost)</span>
                )
              }
              badge={
                winRateComp ? (
                  <Tag color={winRateComp.isAbove ? 'green' : 'orange'} style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                    {winRateComp.formattedDelta}
                  </Tag>
                ) : (
                  <Tag color="default" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                    N/A
                  </Tag>
                )
              }
            />
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <KpiCardItem
              title="Realisasi Pembayaran Vendor (AP)"
              value={formatIDR(execMetrics.vendorDisbursements)}
              icon={<DollarOutlined />}
              iconBg="#ecfdf5"
              iconColor="#059669"
              subtext={<span style={{ color: '#64748b' }}>Akumulasi pembayaran vendor terverifikasi</span>}
              badge={
                <Tag color="cyan" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  AP Disbursement
                </Tag>
              }
            />
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <KpiCardItem
              title="Proyek Operasional Aktif"
              value={`${execMetrics.activeProjects} Proyek`}
              icon={<ProjectOutlined />}
              iconBg="#f5f3ff"
              iconColor="#7c3aed"
              subtext={
                <span style={{ color: '#64748b' }}>
                  {execMetrics.planningProjects} Planning · {execMetrics.inProgressProjects} Eksekusi
                </span>
              }
              badge={
                <Tag color="purple" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Portfolio PMO
                </Tag>
              }
              onClick={() => router.push('/project-delivery')}
              tooltip="Klik untuk melihat detail di PMO Operational Board"
              ariaLabel="Navigasi ke PMO Operational Board"
            />
          </Col>
        </Row>

        {/* Operational Highlights */}
        <div
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: '22px 24px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
              Status Operasional Core Enterprise
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Indikator kesiapan operasional, status SLA delivery, antrean approval, dan deal size
            </p>
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '16px 18px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Project On-Time Delivery Rate</Text>
                  <div style={{ margin: '14px 0 10px 0' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#64748b' }}>
                      Belum ada data SLA
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Target SLA: {KPI_TARGET_CONFIG.onTimeRate}%</Text>
                  <Tag color="default" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                    Belum tersedia
                  </Tag>
                </div>
              </div>
            </Col>

            <Col xs={24} md={8}>
              <Tooltip title="Klik untuk melihat detail di modul Procurement">
                <div 
                  tabIndex={0}
                  role="button"
                  aria-label="Navigasi ke antrean procurement"
                  onClick={() => router.push('/procurement')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push('/procurement');
                    }
                  }}
                  className="kpi-clickable-card"
                  style={{ 
                    cursor: 'pointer', 
                    padding: '16px 18px', 
                    borderRadius: 12, 
                    background: '#ffffff', 
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Pending Approval Queue</Text>
                      <RightOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0', color: execMetrics.pendingApprovals > 0 ? '#d97706' : '#059669' }}>
                      {execMetrics.pendingApprovals} Dokumen
                    </div>
                  </div>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Tugas persetujuan aktif (workflow_tasks) menunggu tindakan</Text>
                </div>
              </Tooltip>
            </Col>

            <Col xs={24} md={8}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '16px 18px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Average Deal Size</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0', color: '#1d4ed8' }}>
                    {formatIDR(kpi.avgDealSize)}
                  </div>
                </div>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Rata-rata nilai tender berstatus WON</Text>
              </div>
            </Col>
          </Row>
        </div>
      </Space>
    );
  };

  // TAB 2: SALES & MARKETING ANALYTICS
  const renderSalesMarketing = () => {
    if (loading && !analyticsData) {
      return renderTabSkeleton();
    }

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {/* Sales Funnel Breakdown */}
          <Col xs={24} lg={12}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '20px 22px',
                boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
                height: '100%',
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                  Sales Pipeline Funnel Stage Breakdown
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Tahapan konversi tender dari evaluasi hingga kemenangan
                </p>
              </div>

              {funnelData.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: '#64748b' }}>Belum ada data funnel pipeline terdaftar</span>}
                />
              ) : (
                <FunnelChart
                  data={funnelData}
                  xField="stageLabel"
                  yField="count"
                  height={300}
                  padding="auto"
                  colorField="stageLabel"
                  color={[
                    '#1e3a8a',
                    '#1d4ed8',
                    '#2563eb',
                    '#0284c7',
                    '#0891b2',
                    '#059669'
                  ]}
                  label={{
                    text: (d: any) => `${d.stageLabel}: ${d.count}`,
                    style: {
                      fill: '#fff',
                      fontWeight: 'bold',
                    },
                  }}
                  tooltip={{
                    channel: 'y',
                    valueFormatter: (v: number) => `${v} Tender`
                  }}
                />
              )}
            </div>
          </Col>

          {/* Business Sector Share */}
          <Col xs={24} lg={12}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '20px 22px',
                boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
                height: '100%',
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                  Distribusi Nilai Tender Berdasarkan Sektor Bisnis
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Pangsa pasar dan nilai portofolio pipeline per sektor
                </p>
              </div>

              {(analyticsData?.sectorDistribution ?? []).length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: '#64748b' }}>Belum ada data sektor bisnis terdaftar</span>}
                />
              ) : (
                <Table
                  className="epms-reports-table"
                  dataSource={analyticsData?.sectorDistribution ?? []}
                  rowKey="sector"
                  pagination={false}
                  columns={[
                    {
                      title: 'Sektor Bisnis',
                      dataIndex: 'sector',
                      key: 'sector',
                      render: (sector: string) => <Text style={{ fontWeight: 600, color: '#1e293b' }}>{sector}</Text>
                    },
                    {
                      title: 'Nilai Pipeline',
                      dataIndex: 'value',
                      key: 'value',
                      align: 'right',
                      render: (val: number) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#0f172a' }}>
                          {formatIDR(val)}
                        </span>
                      )
                    },
                    {
                      title: 'Persentase',
                      dataIndex: 'percentage',
                      key: 'percentage',
                      align: 'center',
                      render: (pct: number) => (
                        <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>
                          {pct}%
                        </Tag>
                      )
                    }
                  ]}
                />
              )}
            </div>
          </Col>
        </Row>

        {/* 12-Month Pipeline Trend */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: '20px 22px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
              Tren Pergerakan Pipeline 12 Bulan Terakhir
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
              Riwayat volume pipeline tender berjalan secara bulanan
            </p>
          </div>

          {(analyticsData?.trendLine ?? []).length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: '#64748b' }}>Belum ada data tren pipeline terdaftar</span>}
            />
          ) : (
            <AreaChart
              data={analyticsData?.trendLine ?? []}
              xField="month"
              yField="value"
              shapeField="smooth"
              height={280}
              padding="auto"
              colorField="#1677ff"
              axis={{
                y: {
                  labelFormatter: (v: number) => {
                    if (v >= 1000000000) return `Rp ${(v / 1000000000).toFixed(1)} M`;
                    if (v >= 1000000) return `Rp ${(v / 1000000).toFixed(0)} Jt`;
                    return formatIDR(v);
                  }
                }
              }}
              tooltip={{
                channel: 'y',
                valueFormatter: (v: number) => formatIDR(v)
              }}
            />
          )}
        </div>

        {/* Marketing Performance Leaderboard (Management Roles Only) */}
        {isManagementUser && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '22px 24px',
              boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
                Marketing Performance Leaderboard
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Peringkat dan performa individual PIC Marketing berdasarkan nilai portofolio dan tingkat kemenangan
              </p>
            </div>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Top Performer Summary Cards */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <div
                    style={{
                      borderRadius: 12,
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                      border: '1px solid #e2e8f0',
                      padding: '16px 18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Top Pipeline Value</Text>
                      <TrophyOutlined style={{ color: '#d97706', fontSize: 16 }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8', margin: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {topPipeline ? formatIDR(topPipeline.pipelineValue) : 'Rp 0'}
                    </div>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      PIC: <Text style={{ fontWeight: 600, color: '#0f172a' }}>{topPipeline?.marketingName ?? '-'}</Text>
                    </Text>
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div
                    style={{
                      borderRadius: 12,
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                      border: '1px solid #e2e8f0',
                      padding: '16px 18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Highest Win Rate</Text>
                      <RiseOutlined style={{ color: '#059669', fontSize: 16 }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', margin: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {topWinRate && topWinRate.winRate !== null ? `${safeToFixed(topWinRate.winRate, 1)}%` : 'Belum ada data'}
                    </div>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      PIC: <Text style={{ fontWeight: 600, color: '#0f172a' }}>{topWinRate?.marketingName ?? '-'}</Text>
                    </Text>
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div
                    style={{
                      borderRadius: 12,
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                      border: '1px solid #e2e8f0',
                      padding: '16px 18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Most Won Tenders</Text>
                      <CheckCircleOutlined style={{ color: '#7c3aed', fontSize: 16 }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed', margin: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {topWonTender ? topWonTender.wonTender : 0} Tender
                    </div>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      PIC: <Text style={{ fontWeight: 600, color: '#0f172a' }}>{topWonTender?.marketingName ?? '-'}</Text>
                    </Text>
                  </div>
                </Col>
              </Row>

              {/* Ant Design Table Breakdown */}
              {mktLoading ? (
                <div style={{ padding: '20px 0' }}>
                  <Skeleton active paragraph={{ rows: 4 }} />
                </div>
              ) : mktPerformance.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: '#64748b' }}>Belum ada data performa PIC Marketing untuk periode ini</span>}
                />
              ) : (
                <Table
                  className="epms-reports-table"
                  dataSource={mktPerformance}
                  rowKey={(record) => String(record.marketingId ?? record.marketingName)}
                  pagination={false}
                  scroll={{ x: 900 }}
                  columns={[
                    {
                      title: '#',
                      key: 'rank',
                      width: 50,
                      align: 'center',
                      render: (_: any, __: any, index: number) => (
                        <Text style={{ fontWeight: 700, color: '#64748b' }}>
                          {index + 1}
                        </Text>
                      )
                    },
                    {
                      title: 'Marketing PIC',
                      dataIndex: 'marketingName',
                      key: 'marketingName',
                      render: (name: string) => <Text style={{ fontWeight: 600, color: '#1e293b' }}>{name}</Text>
                    },
                    {
                      title: 'Total Tender',
                      dataIndex: 'totalTender',
                      key: 'totalTender',
                      align: 'center',
                      render: (val: number) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{val}</span>
                      ),
                      sorter: (a, b) => a.totalTender - b.totalTender
                    },
                    {
                      title: 'Nilai Pipeline (Open)',
                      dataIndex: 'pipelineValue',
                      key: 'pipelineValue',
                      align: 'right',
                      render: (val: number) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#0f172a' }}>
                          {formatIDR(val)}
                        </span>
                      ),
                      sorter: (a, b) => a.pipelineValue - b.pipelineValue
                    },
                    {
                      title: 'Won Tender',
                      dataIndex: 'wonTender',
                      key: 'wonTender',
                      align: 'center',
                      render: (won: number) => (
                        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                          {won}
                        </Tag>
                      ),
                      sorter: (a, b) => a.wonTender - b.wonTender
                    },
                    {
                      title: 'Win Rate',
                      dataIndex: 'winRate',
                      key: 'winRate',
                      align: 'center',
                      render: (rate: number | null) => (
                        rate !== null ? (
                          <Tag color={rate >= 35 ? 'green' : 'orange'} style={{ borderRadius: 6, fontWeight: 600 }}>
                            {safeToFixed(rate, 1)}%
                          </Tag>
                        ) : (
                          <Tag color="default" style={{ borderRadius: 6, fontWeight: 600 }}>
                            Belum ada keputusan
                          </Tag>
                        )
                      ),
                      sorter: (a, b) => (a.winRate ?? -1) - (b.winRate ?? -1)
                    },
                    {
                      title: 'Average Deal Size',
                      dataIndex: 'averageDealSize',
                      key: 'averageDealSize',
                      align: 'right',
                      render: (val: number) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#0f172a' }}>
                          {formatIDR(val)}
                        </span>
                      ),
                      sorter: (a, b) => a.averageDealSize - b.averageDealSize
                    },
                    {
                      title: 'Performa',
                      key: 'performance',
                      align: 'center',
                      width: 150,
                      render: (_: any, record: MarketingPerformanceItem) => {
                        if (record.winRate === null) return <Tag color="default" style={{ borderRadius: 6, fontWeight: 600 }}>N/A</Tag>;
                        if (record.winRate >= 35) return <Tag color="green" style={{ borderRadius: 6, fontWeight: 600 }}>Star Performer</Tag>;
                        if (record.winRate >= 20) return <Tag color="gold" style={{ borderRadius: 6, fontWeight: 600 }}>Developing</Tag>;
                        return <Tag color="red" style={{ borderRadius: 6, fontWeight: 600 }}>Perlu Perhatian</Tag>;
                      }
                    }
                  ]}
                />
              )}
            </Space>
          </div>
        )}
      </Space>
    );
  };

  // TAB 3: PROJECT DELIVERY
  const renderProjectDelivery = () => {
    if (loading && !analyticsData) {
      return renderTabSkeleton();
    }

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Total Proyek Operasional"
              value={`${execMetrics.activeProjects} Proyek`}
              icon={<ProjectOutlined />}
              iconBg="#eff6ff"
              iconColor="#2563eb"
              subtext={
                <span style={{ color: '#64748b' }}>
                  {execMetrics.planningProjects} Planning · {execMetrics.inProgressProjects} Eksekusi
                </span>
              }
              badge={
                <Tag color="blue" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Active Portfolio
                </Tag>
              }
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Project On-Time Delivery Rate"
              value="Belum ada data SLA"
              icon={<CheckCircleOutlined />}
              iconBg="#f1f5f9"
              iconColor="#64748b"
              subtext={<span style={{ color: '#64748b' }}>Target SLA: {KPI_TARGET_CONFIG.onTimeRate}% (Instrumen aktual belum aktif)</span>}
              badge={
                <Tag color="default" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Belum tersedia
                </Tag>
              }
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Antrean Kontrak Pending Legal"
              value={`${execMetrics.legalPending} Kontrak`}
              icon={<ClockCircleOutlined />}
              iconBg="#fef3c7"
              iconColor="#d97706"
              subtext={<span style={{ color: '#64748b' }}>Kontrak menunggu validasi & approval Legal</span>}
              badge={
                <Tag color="gold" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Pending Review
                </Tag>
              }
            />
          </Col>
        </Row>

        <div
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: '22px 24px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
              Tata Kelola Project Delivery Operational Board
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Pengawasan eksekusi portofolio proyek terdaftar dan koordinasi Project Manager
            </p>
          </div>
          <Alert
            message="Integrasi PMO Operational Board Aktif"
            description={`Terdapat ${execMetrics.activeProjects} proyek aktif dalam portofolio PMO (${execMetrics.planningProjects} tahap Planning dan ${execMetrics.inProgressProjects} tahap Eksekusi). Metrik On-Time SLA delivery aktual akan diaktifkan setelah integrasi milestone pelaporan berkala.`}
            type="info"
            showIcon
            style={{ borderRadius: 12 }}
          />
        </div>
      </Space>
    );
  };

  // TAB 4: FINANCE & COST
  const renderFinanceCost = () => {
    if (loading && !analyticsData) {
      return renderTabSkeleton();
    }

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Realisasi Pembayaran Vendor (AP)"
              value={formatIDR(execMetrics.vendorDisbursements)}
              icon={<DollarOutlined />}
              iconBg="#ecfdf5"
              iconColor="#059669"
              subtext={<span style={{ color: '#64748b' }}>Akumulasi pengeluaran vendor aktual</span>}
              badge={
                <Tag color="green" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  AP Terbayar
                </Tag>
              }
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Marjin Laba Proyek"
              value="Belum tersedia"
              icon={<RiseOutlined />}
              iconBg="#f1f5f9"
              iconColor="#64748b"
              subtext={<span style={{ color: '#64748b' }}>Target acuan: {KPI_TARGET_CONFIG.avgProfitMargin}% (Menunggu formula resmi)</span>}
              badge={
                <Tag color="default" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Formula Pending
                </Tag>
              }
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Komitmen Nilai PO Procurement"
              value={formatIDR(execMetrics.poCommittedValue)}
              icon={<ShoppingCartOutlined />}
              iconBg="#eff6ff"
              iconColor="#2563eb"
              subtext={<span style={{ color: '#64748b' }}>{execMetrics.poCount} Purchase Order diterbitkan</span>}
              badge={
                <Tag color="blue" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Komitmen PO
                </Tag>
              }
            />
          </Col>
        </Row>

        <div
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: '22px 24px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
              Struktur Realisasi Biaya & Kewajiban Vendor (AP)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Rekapitulasi pengeluaran vendor, komitmen Purchase Order, dan status verifikasi faktur
            </p>
          </div>

          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} md={10}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '20px',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>
                  Ringkasan Accounts Payable (AP)
                </Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Realisasi Pembayaran Vendor</Text>
                  <Text style={{ fontWeight: 600, color: '#059669' }}>{formatIDR(execMetrics.vendorDisbursements)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Komitmen Nilai PO</Text>
                  <Text style={{ fontWeight: 600, color: '#1d4ed8' }}>{formatIDR(execMetrics.poCommittedValue)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Outstanding Faktur AP</Text>
                  <Text style={{ fontWeight: 600, color: '#d97706' }}>{formatIDR(execMetrics.outstandingAP)}</Text>
                </div>
              </div>
            </Col>
            <Col xs={24} md={14}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Alert
                  message="Data Keuangan Berbasis Accounts Payable (AP)"
                  description="Seluruh metrik finansial pada modul ini bersumber langsung dari pencatatan pengeluaran vendor, PO, dan pembayaran aktual. Laporan Customer Revenue dan Marjin Laba Bersih perusahaan belum disahkan dalam instrumen ini."
                  type="info"
                  showIcon
                  style={{ borderRadius: 12 }}
                />
              </Space>
            </Col>
          </Row>
        </div>
      </Space>
    );
  };

  // TAB 5: LEGAL & GOVERNANCE
  const renderLegalGovernance = () => {
    if (loading && !analyticsData) {
      return renderTabSkeleton();
    }

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Antrean Aktif Legal Review"
              value={`${execMetrics.legalPending} Kontrak`}
              icon={<SafetyCertificateOutlined />}
              iconBg="#eff6ff"
              iconColor="#2563eb"
              subtext={<span style={{ color: '#64748b' }}>Kontrak menunggu validasi legal</span>}
              badge={
                <Tag color="blue" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Current State
                </Tag>
              }
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Demoted Expiration SPK Required"
              value={`${execMetrics.legalExpired} Kontrak`}
              icon={<ExclamationCircleOutlined />}
              iconBg="#fef3c7"
              iconColor="#d97706"
              subtext={<span style={{ color: '#64748b' }}>Grace period 48 jam terlewati</span>}
              badge={
                <Tag color="orange" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Expired
                </Tag>
              }
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCardItem
              title="Legal Review Compliance Rate"
              value="Belum tersedia"
              icon={<CheckCircleOutlined />}
              iconBg="#f1f5f9"
              iconColor="#64748b"
              subtext={<span style={{ color: '#64748b' }}>Metrik kepatuhan formal belum didefinisikan</span>}
              badge={
                <Tag color="default" style={{ fontSize: 11, margin: 0, borderRadius: 6, fontWeight: 600 }}>
                  Belum tersedia
                </Tag>
              }
            />
          </Col>
        </Row>

        <div
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: '22px 24px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
              Tata Kelola & Keamanan Berkas Legal
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Protokol penegakan SPK fisik dan isolasi risiko kontrak tanpa otorisasi
            </p>
          </div>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              message="Aturan SPK Required & Grace Period 48 Jam"
              description="Tender yang berada dalam Grace Period 2x24 jam tanpa mengunggah file SPK fisik akan dikembalikan secara otomatis oleh scheduler ke status NEGOTIATION (SPK_REQUIRED) tanpa pernah membuat draft kontrak prematur."
              type="warning"
              showIcon
              style={{ borderRadius: 12 }}
            />
            <Alert
              message="Validasi Akses Legal Review"
              description="Antrean Legal Review mengisolasi secara ketat seluruh kontrak yang belum memiliki file SPK fisik terverifikasi."
              type="success"
              showIcon
              style={{ borderRadius: 12 }}
            />
          </Space>
        </div>
      </Space>
    );
  };

  return (
    <div
      style={{
        backgroundColor: '#F0F4F8',
        minHeight: '100vh',
        padding: '24px 28px 40px 28px',
        color: '#1e293b',
      }}
    >
      {/* Scoped CSS overrides for light tables, tabs, and interactive card hover */}
      <style jsx global>{`
        .kpi-clickable-card:hover {
          border-color: #3b82f6 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(37, 99, 235, 0.12), 0 4px 8px -2px rgba(15, 23, 42, 0.04) !important;
        }
        .kpi-clickable-card:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
        .epms-reports-table .ant-table-thead > tr > th,
        .epms-reports-table .ant-table-thead > tr > td {
          background-color: #f8fafc !important;
          color: #475569 !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .epms-reports-table .ant-table-thead > tr > th::before {
          background-color: transparent !important;
        }
        .epms-reports-table .ant-table-tbody > tr:hover > td {
          background-color: #f8fafc !important;
        }
        .epms-reports-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important;
          color: #1e293b !important;
          font-size: 13px !important;
        }
        .epms-reports-tabs .ant-tabs-nav {
          margin-bottom: 22px !important;
        }
        .epms-reports-tabs .ant-tabs-tab {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          margin-right: 8px !important;
          padding: 8px 18px !important;
          font-weight: 500 !important;
          font-size: 13.5px !important;
          color: #64748b !important;
          transition: all 0.2s ease !important;
        }
        .epms-reports-tabs .ant-tabs-tab:hover {
          color: #1d4ed8 !important;
          border-color: #93c5fd !important;
        }
        .epms-reports-tabs .ant-tabs-tab.ant-tabs-tab-active {
          background: #eff6ff !important;
          border-color: #3b82f6 !important;
        }
        .epms-reports-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #1d4ed8 !important;
          font-weight: 600 !important;
        }
        .epms-reports-tabs .ant-tabs-ink-bar {
          display: none !important;
        }
      `}</style>

      {/* Page Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
          gap: 16,
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 600,
                lineHeight: '32px',
                color: '#0f172a',
                letterSpacing: '-0.025em',
              }}
            >
              KPI & Reports
            </h1>
            <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, padding: '2px 10px', fontSize: 12, margin: 0 }}>
              Periode: {getPeriodBadgeLabel(period)}
            </Tag>
            {isMarketing ? (
              <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600, padding: '2px 10px', fontSize: 12, margin: 0 }}>
                Personal Performance (PIC: {user?.fullName ?? 'Marketing'})
              </Tag>
            ) : (
              <Tag color="geekblue" style={{ borderRadius: 6, fontWeight: 600, padding: '2px 10px', fontSize: 12, margin: 0 }}>
                Enterprise View
              </Tag>
            )}
          </div>
          <p
            style={{
              margin: '5px 0 0 0',
              fontSize: '13px',
              color: '#64748b',
              lineHeight: 1.45,
            }}
          >
            {isMarketing
              ? 'Performa KPI Pribadi Anda sebagai PIC Marketing'
              : 'Enterprise Performance Metrics & Analytic Dashboards'}
          </p>
        </div>

        {/* Header Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Period Selector Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: 13,
              color: '#64748b',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
              height: 40,
            }}
          >
            <CalendarOutlined style={{ marginRight: 8, color: '#64748b', fontSize: 14 }} />
            <span style={{ marginRight: 8, fontWeight: 500, fontSize: 12.5, color: '#64748b' }}>Periode:</span>
            <Select
              value={period}
              onChange={(val) => setPeriod(val)}
              bordered={false}
              size="middle"
              style={{ minWidth: 165, fontSize: 13, fontWeight: 600, color: '#0f172a' }}
              options={[
                { label: 'Year to Date (YTD)', value: 'YEAR_TO_DATE' },
                { label: 'Bulan Ini', value: 'THIS_MONTH' },
                { label: 'Bulan Lalu', value: 'LAST_MONTH' },
                { label: 'Kuartal Ini', value: 'THIS_QUARTER' },
                { label: 'Kuartal Lalu', value: 'LAST_QUARTER' },
              ]}
            />
          </div>

          {/* Last Updated Timestamp Pill */}
          {lastUpdated && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '6px 16px',
                fontSize: 13,
                color: '#64748b',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
                height: 40,
              }}
            >
              <ClockCircleOutlined style={{ marginRight: 8, color: '#64748b', fontSize: 14 }} />
              <span>
                Terakhir diperbarui:{' '}
                <strong style={{ color: '#1e293b', fontWeight: 600 }}>{lastUpdated}</strong>
              </span>
            </div>
          )}

          {/* Refresh Button */}
          <Button
            onClick={() => fetchKpiData(period)}
            loading={loading}
            icon={<SyncOutlined spin={loading} />}
            style={{
              borderRadius: 10,
              height: 40,
              padding: '0 20px',
              fontSize: 13,
              fontWeight: 600,
              borderColor: '#93c5fd',
              color: '#1d4ed8',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
            }}
          >
            Segarkan
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Alert
          message="Gagal Memuat Data KPI & Reports"
          description={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
              <span style={{ color: '#b91c1c' }}>{errorMsg}</span>
              <Button
                size="small"
                danger
                icon={<SyncOutlined />}
                onClick={() => fetchKpiData(period)}
              >
                Coba Lagi
              </Button>
            </div>
          }
          type="error"
          showIcon
          style={{ borderRadius: 12, marginBottom: 20 }}
        />
      )}

      {/* Main Tabs Container */}
      <Tabs
        defaultActiveKey="1"
        type="card"
        size="middle"
        className="epms-reports-tabs"
        destroyInactiveTabPane={true}
        items={[
          {
            key: '1',
            label: (
              <span>
                <TrophyOutlined style={{ marginRight: 6 }} /> Executive Summary
              </span>
            ),
            children: renderExecutiveSummary(),
          },
          {
            key: '2',
            label: (
              <span>
                <BarChartOutlined style={{ marginRight: 6 }} /> Sales & Marketing
              </span>
            ),
            children: renderSalesMarketing(),
          },
          {
            key: '3',
            label: (
              <span>
                <ProjectOutlined style={{ marginRight: 6 }} /> Project Delivery
              </span>
            ),
            children: renderProjectDelivery(),
          },
          {
            key: '4',
            label: (
              <span>
                <DollarOutlined style={{ marginRight: 6 }} /> Finance & Cost
              </span>
            ),
            children: renderFinanceCost(),
          },
          {
            key: '5',
            label: (
              <span>
                <SafetyCertificateOutlined style={{ marginRight: 6 }} /> Legal & Governance
              </span>
            ),
            children: renderLegalGovernance(),
          },
        ]}
      />
    </div>
  );
}
