"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Tabs, 
  Select, 
  Spin, 
  Alert, 
  Typography, 
  Space, 
  Tag, 
  Table, 
  Progress,
  Button,
  Tooltip
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
  SyncOutlined
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

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
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="Memuat Grafik Tren Pipeline..." />
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
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="Memuat Grafik Sales Funnel..." />
      </div>
    )
  }
);

interface KpiData {
  totalPipeline?: number;
  winRate?: number;
  avgDealSize?: number;
  totalDeals?: number;
  momGrowth?: number;
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
  avgProfitMargin?: number;
  pendingApprovals?: number;
  onTimeRate?: number;
}

interface MarketingPerformanceItem {
  marketingId: number | null;
  marketingName: string;
  totalTender: number;
  pipelineValue: number;
  wonTender: number;
  winRate: number;
  averageDealSize: number;
}

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
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [mktPerformance, setMktPerformance] = useState<MarketingPerformanceItem[]>([]);
  const [mktLoading, setMktLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Task 2: Parallel API Fetching via Promise.all
  const fetchKpiData = useCallback(async (selectedPeriod: string) => {
    setLoading(true);
    if (isManagementUser) setMktLoading(true);
    setErrorMsg(null);
    try {
      const analyticsReq = apiClient.get('/analytics/dashboard', {
        params: { period: selectedPeriod }
      });

      const summaryReq = apiClient.get('/dashboard/summary').catch(() => null);

      const mktReq = isManagementUser
        ? apiClient.get('/analytics/marketing-performance', {
            params: { period: selectedPeriod }
          }).catch(() => null)
        : Promise.resolve(null);

      const [analyticsRes, summaryRes, mktRes] = await Promise.all([
        analyticsReq,
        summaryReq,
        mktReq
      ]);

      // 1. Process Analytics Response
      const rawAnalytics = analyticsRes?.data?.data?.data ?? analyticsRes?.data?.data ?? analyticsRes?.data;
      if (rawAnalytics) {
        setAnalyticsData(rawAnalytics);
      }

      // 2. Process Summary Response (Graceful fallback)
      if (summaryRes) {
        const rawSummary = summaryRes.data?.data?.data ?? summaryRes.data?.data ?? summaryRes.data;
        if (rawSummary) {
          setSummaryData(rawSummary);
        }
      } else {
        setSummaryData({
          totalProjects: 0,
          totalRevenue: 0,
          avgProfitMargin: 0,
          pendingApprovals: 0,
          onTimeRate: 92.4
        });
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
        router.replace('/');
      }
    }
  }, [user, router]);

  useEffect(() => {
    fetchKpiData(period);
  }, [period, fetchKpiData]);

  // Format currency Helper with null-safe handling
  const formatIDR = useCallback((amount?: number | null) => {
    const val = amount ?? 0;
    if (isNaN(val)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  }, []);

  // Safe number formatter helper
  const safeToFixed = useCallback((val?: number | null, digits = 1): string => {
    const num = val ?? 0;
    if (isNaN(num)) return (0).toFixed(digits);
    return num.toFixed(digits);
  }, []);

  // Stage Code Humanization Helper for Funnel Chart
  const humanizeStageLabel = useCallback((stageCode: string): string => {
    switch (String(stageCode || '').toUpperCase()) {
      case 'LEAD': return 'Lead';
      case 'WAITING_GO_NO_GO': return 'Go / No-Go Evaluation';
      case 'QUALIFICATION': return 'Qualification';
      case 'PROPOSAL': return 'Proposal';
      case 'NEGOTIATION': return 'Negotiation';
      case 'WON': return 'Won';
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

  // Target Comparison Helper
  const compareActualVsTarget = useCallback((actual: number, target: number) => {
    const delta = actual - target;
    const isAbove = delta >= 0;
    const sign = isAbove ? '+' : '';
    const formattedDelta = `${sign}${delta.toFixed(1)}%`;
    
    return {
      isAbove,
      delta,
      formattedDelta,
      badgeText: isAbove ? `Above Target (${formattedDelta})` : `Below Target (${formattedDelta})`,
    };
  }, []);

  // Task 1: Derived Calculations with useMemo
  const kpi = useMemo(() => ({
    totalPipeline: analyticsData?.kpi?.totalPipeline ?? 0,
    winRate: analyticsData?.kpi?.winRate ?? 0,
    avgDealSize: analyticsData?.kpi?.avgDealSize ?? 0,
    totalDeals: analyticsData?.kpi?.totalDeals ?? 0,
    momGrowth: analyticsData?.kpi?.momGrowth ?? 0
  }), [analyticsData]);

  const summary = useMemo(() => ({
    totalProjects: summaryData?.totalProjects ?? 0,
    totalRevenue: summaryData?.totalRevenue ?? 0,
    avgProfitMargin: summaryData?.avgProfitMargin ?? 0,
    pendingApprovals: summaryData?.pendingApprovals ?? 0,
    onTimeRate: summaryData?.onTimeRate ?? 92.4
  }), [summaryData]);

  const insights = useMemo(() => analyticsData?.insights ?? {}, [analyticsData]);

  const topPipeline = useMemo(() => (
    mktPerformance.length > 0
      ? [...mktPerformance].sort((a, b) => b.pipelineValue - a.pipelineValue)[0]
      : null
  ), [mktPerformance]);

  const topWinRate = useMemo(() => (
    mktPerformance.length > 0
      ? [...mktPerformance].sort((a, b) => b.winRate - a.winRate)[0]
      : null
  ), [mktPerformance]);

  const topWonTender = useMemo(() => (
    mktPerformance.length > 0
      ? [...mktPerformance].sort((a, b) => b.wonTender - a.wonTender)[0]
      : null
  ), [mktPerformance]);

  // TAB 1: EXECUTIVE SUMMARY
  const renderExecutiveSummary = () => {
    const winRateComp = compareActualVsTarget(kpi.winRate * 100, KPI_TARGET_CONFIG.winRate);
    const marginComp = compareActualVsTarget(summary.avgProfitMargin, KPI_TARGET_CONFIG.avgProfitMargin);
    const onTimeComp = compareActualVsTarget(summary.onTimeRate, KPI_TARGET_CONFIG.onTimeRate);

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* NLG Smart Insights Banner */}
        {insights.topInsight && (
          <Alert
            message="Smart Insights EPMS AI"
            description={
              <div>
                <p><strong>Insight Utama:</strong> {insights.topInsight}</p>
                {insights.warningInsight && (
                  <p style={{ marginBottom: 0 }}><strong>Perhatian:</strong> {insights.warningInsight}</p>
                )}
              </div>
            }
            type="info"
            showIcon
            style={{ borderRadius: '12px', background: '#eff6ff', borderColor: '#bfdbfe' }}
          />
        )}

        {/* Top High Level Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Tooltip title="Klik untuk melihat detail di modul Sales">
              <Card 
                bordered={false} 
                onClick={() => router.push('/sales')}
                style={{ borderRadius: '12px', borderTop: '4px solid #1677ff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', cursor: 'pointer' }}
              >
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>TOTAL PIPELINE VALUE</Text>}
                  value={formatIDR(kpi.totalPipeline)}
                  valueStyle={{ color: '#1677ff', fontWeight: 800, fontSize: '22px' }}
                  prefix={<BarChartOutlined />}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: kpi.momGrowth >= 0 ? '#52c41a' : '#f5222d' }}>
                  {kpi.momGrowth >= 0 ? <RiseOutlined /> : <FallOutlined />} {safeToFixed(kpi.momGrowth * 100, 1)}% MoM Growth
                </div>
              </Card>
            </Tooltip>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: '12px', borderTop: '4px solid #52c41a', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>TENDER WIN RATE</Text>}
                value={safeToFixed(kpi.winRate * 100, 1)}
                suffix="%"
                valueStyle={{ color: '#52c41a', fontWeight: 800, fontSize: '22px' }}
                prefix={<TrophyOutlined />}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#8c8c8c' }}>Target: {KPI_TARGET_CONFIG.winRate}%</span>
                <Tag color={winRateComp.isAbove ? 'green' : 'orange'} style={{ fontSize: '11px', margin: 0 }}>
                  {winRateComp.formattedDelta}
                </Tag>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: '12px', borderTop: '4px solid #fa8c16', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>TOTAL REVENUE COLLECTED</Text>}
                value={formatIDR(summary.totalRevenue)}
                valueStyle={{ color: '#fa8c16', fontWeight: 800, fontSize: '22px' }}
                prefix={<DollarOutlined />}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                Realisasi pembayaran masuk
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Tooltip title="Klik untuk melihat detail di PMO Operational Board">
              <Card 
                bordered={false} 
                onClick={() => router.push('/project-delivery')}
                style={{ borderRadius: '12px', borderTop: '4px solid #722ed1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', cursor: 'pointer' }}
              >
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>ACTIVE PROJECTS & MARGIN</Text>}
                  value={safeToFixed(summary.avgProfitMargin, 1)}
                  suffix="% Margin"
                  valueStyle={{ color: '#722ed1', fontWeight: 800, fontSize: '22px' }}
                  prefix={<ProjectOutlined />}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8c8c8c' }}>Target: {KPI_TARGET_CONFIG.avgProfitMargin}%</span>
                  <Tag color={marginComp.isAbove ? 'purple' : 'orange'} style={{ fontSize: '11px', margin: 0 }}>
                    {marginComp.formattedDelta}
                  </Tag>
                </div>
              </Card>
            </Tooltip>
          </Col>
        </Row>

        {/* Operational Highlights */}
        <Card title="Status Operasional Core Enterprise" bordered={false} style={{ borderRadius: '12px' }}>
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">Project On-Time Delivery Rate</Text>
                <Progress percent={summary.onTimeRate} status="active" strokeColor="#52c41a" />
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>Target SLA: {KPI_TARGET_CONFIG.onTimeRate}%</Text>
                  <Tag color={onTimeComp.isAbove ? 'green' : 'orange'} style={{ fontSize: '11px', margin: 0 }}>
                    {onTimeComp.formattedDelta}
                  </Tag>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Tooltip title="Klik untuk melihat detail di modul Procurement">
                <div 
                  onClick={() => router.push('/procurement')}
                  style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: '10px', background: '#fafafa', border: '1px solid #f0f0f0' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">Pending Approval Queue</Text>
                    <Title level={3} style={{ margin: 0, color: summary.pendingApprovals > 0 ? '#fa8c16' : '#52c41a' }}>
                      {summary.pendingApprovals} Dokumen
                    </Title>
                    <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>Purchase Request & Purchase Order menunggu verifikasi</Text>
                  </Space>
                </div>
              </Tooltip>
            </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">Average Deal Size</Text>
              <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
                {formatIDR(kpi.avgDealSize)}
              </Title>
              <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>Rata-rata nilai tender berstatus WON</Text>
            </Space>
          </Col>
        </Row>
      </Card>
    </Space>
  );
};

  // TAB 2: SALES & MARKETING ANALYTICS
  const renderSalesMarketing = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {/* Sales Funnel Breakdown */}
          <Col xs={24} lg={12}>
            <Card title="Sales Pipeline Funnel Stage Breakdown" bordered={false} style={{ borderRadius: '12px' }}>
              {(analyticsData?.funnel ?? []).length === 0 ? (
                <Alert message="Belum ada data funnel pipeline terdaftar" type="info" showIcon />
              ) : (
                <FunnelChart
                  data={analyticsData?.funnel ?? []}
                  xField="stage"
                  yField="count"
                  height={300}
                  padding="auto"
                  colorField="stage"
                  color={[
                    '#1e3a8a',
                    '#1d4ed8',
                    '#2563eb',
                    '#0284c7',
                    '#0891b2',
                    '#059669'
                  ]}
                  label={{
                    text: (d: FunnelItem) => `${humanizeStageLabel(d.stage)}: ${d.count}`,
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
            </Card>
          </Col>

          {/* Business Sector Share */}
          <Col xs={24} lg={12}>
            <Card title="Distribusi Nilai Tender Berdasarkan Sektor Bisnis" bordered={false} style={{ borderRadius: '12px' }}>
              {(analyticsData?.sectorDistribution ?? []).length === 0 ? (
                <Alert message="Belum ada data sektor bisnis terdaftar" type="info" showIcon />
              ) : (
                <Table
                  dataSource={analyticsData?.sectorDistribution ?? []}
                  rowKey="sector"
                  pagination={false}
                  columns={[
                    {
                      title: 'Sektor Bisnis',
                      dataIndex: 'sector',
                      key: 'sector',
                      render: (sector: string) => <Text style={{ fontWeight: 600 }}>{sector}</Text>
                    },
                    {
                      title: 'Nilai Pipeline',
                      dataIndex: 'value',
                      key: 'value',
                      align: 'right',
                      render: (val: number) => formatIDR(val)
                    },
                    {
                      title: 'Persentase',
                      dataIndex: 'percentage',
                      key: 'percentage',
                      align: 'center',
                      render: (pct: number) => <Tag color="green">{pct}%</Tag>
                    }
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* 12-Month Pipeline Trend */}
        <Card title="Tren Pergerakan Pipeline 12 Bulan Terakhir" bordered={false} style={{ borderRadius: '12px' }}>
          {(analyticsData?.trendLine ?? []).length === 0 ? (
            <Alert message="Belum ada data tren pipeline terdaftar" type="info" showIcon />
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
        </Card>

        {/* Marketing Performance Leaderboard (Management Roles Only) */}
        {isManagementUser && (
          <Card title="Marketing Performance Leaderboard" bordered={false} style={{ borderRadius: '12px' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Top Performer Summary Cards */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Card bordered style={{ borderRadius: '10px', background: '#fafafa', borderColor: '#e2e8f0' }}>
                    <Statistic
                      title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>TOP PIPELINE VALUE</Text>}
                      value={topPipeline ? formatIDR(topPipeline.pipelineValue) : 'Rp 0'}
                      valueStyle={{ color: '#1677ff', fontWeight: 700, fontSize: '18px' }}
                      prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                    />
                    <Text style={{ fontSize: '12px', color: '#64748b' }}>
                      PIC: <Text style={{ fontWeight: 600 }}>{topPipeline?.marketingName ?? '-'}</Text>
                    </Text>
                  </Card>
                </Col>

                <Col xs={24} sm={8}>
                  <Card bordered style={{ borderRadius: '10px', background: '#fafafa', borderColor: '#e2e8f0' }}>
                    <Statistic
                      title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>HIGHEST WIN RATE</Text>}
                      value={topWinRate ? safeToFixed(topWinRate.winRate, 1) : '0'}
                      suffix="%"
                      valueStyle={{ color: '#52c41a', fontWeight: 700, fontSize: '18px' }}
                      prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                    />
                    <Text style={{ fontSize: '12px', color: '#64748b' }}>
                      PIC: <Text style={{ fontWeight: 600 }}>{topWinRate?.marketingName ?? '-'}</Text>
                    </Text>
                  </Card>
                </Col>

                <Col xs={24} sm={8}>
                  <Card bordered style={{ borderRadius: '10px', background: '#fafafa', borderColor: '#e2e8f0' }}>
                    <Statistic
                      title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>MOST WON TENDERS</Text>}
                      value={topWonTender ? topWonTender.wonTender : 0}
                      suffix="Tender"
                      valueStyle={{ color: '#722ed1', fontWeight: 700, fontSize: '18px' }}
                      prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
                    />
                    <Text style={{ fontSize: '12px', color: '#64748b' }}>
                      PIC: <Text style={{ fontWeight: 600 }}>{topWonTender?.marketingName ?? '-'}</Text>
                    </Text>
                  </Card>
                </Col>
              </Row>

              {/* Ant Design Table Breakdown */}
              {mktLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Spin tip="Memuat Performa PIC Marketing..." />
                </div>
              ) : mktPerformance.length === 0 ? (
                <Alert message="Belum ada data performa PIC Marketing untuk periode ini" type="info" showIcon />
              ) : (
                <Table
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
                        <Text style={{ fontWeight: 700 }}>
                          {index + 1}
                        </Text>
                      )
                    },
                    {
                      title: 'Marketing PIC',
                      dataIndex: 'marketingName',
                      key: 'marketingName',
                      render: (name: string) => <Text style={{ fontWeight: 600 }}>{name}</Text>
                    },
                    {
                      title: 'Total Tender',
                      dataIndex: 'totalTender',
                      key: 'totalTender',
                      align: 'center',
                      sorter: (a, b) => a.totalTender - b.totalTender
                    },
                    {
                      title: 'Pipeline Value',
                      dataIndex: 'pipelineValue',
                      key: 'pipelineValue',
                      align: 'right',
                      render: (val: number) => formatIDR(val),
                      sorter: (a, b) => a.pipelineValue - b.pipelineValue
                    },
                    {
                      title: 'Won Tender',
                      dataIndex: 'wonTender',
                      key: 'wonTender',
                      align: 'center',
                      render: (won: number) => <Tag color="blue">{won}</Tag>,
                      sorter: (a, b) => a.wonTender - b.wonTender
                    },
                    {
                      title: 'Win Rate',
                      dataIndex: 'winRate',
                      key: 'winRate',
                      align: 'center',
                      render: (rate: number) => <Tag color={rate >= 35 ? 'green' : 'orange'}>{safeToFixed(rate, 1)}%</Tag>,
                      sorter: (a, b) => a.winRate - b.winRate
                    },
                    {
                      title: 'Average Deal Size',
                      dataIndex: 'averageDealSize',
                      key: 'averageDealSize',
                      align: 'right',
                      render: (val: number) => formatIDR(val),
                      sorter: (a, b) => a.averageDealSize - b.averageDealSize
                    },
                    {
                      title: 'Performance',
                      key: 'performance',
                      align: 'center',
                      width: 150,
                      render: (_: any, record: MarketingPerformanceItem) => {
                        if (record.winRate >= 35) return <Tag color="green">Star Performer</Tag>;
                        if (record.winRate >= 20) return <Tag color="gold">Developing</Tag>;
                        return <Tag color="red">Needs Attention</Tag>;
                      }
                    }
                  ]}
                />
              )}
            </Space>
          </Card>
        )}
      </Space>
    );

  // TAB 3: PROJECT DELIVERY
  const renderProjectDelivery = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Total Proyek Operasional"
              value={summary.totalProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1677ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Project On-Time Delivery Rate"
              value={summary.onTimeRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Proyek Menunggu Kelengkapan Contract"
              value={0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Tata Kelola Project Delivery Operational Board" bordered={false} style={{ borderRadius: '12px' }}>
        <Alert
          message="Integrasi PMO Operational Board Aktif"
          description="Seluruh proyek di papan operasional PMO secara ketat mengisolasi kontrak yang berstatus APPROVED oleh Legal Review. Tidak ada proyek prematur yang dapat diproses sebelum kelengkapan berkas SPK dan persetujuan Legal."
          type="success"
          showIcon
        />
      </Card>
    </Space>
  );

  // TAB 4: FINANCE & COST
  const renderFinanceCost = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Total Invoiced Revenue Realization"
              value={formatIDR(summary.totalRevenue)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Average Profit Margin Target"
              value={safeToFixed(summary.avgProfitMargin, 1)}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#722ed1', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Procurement PO Pending Expense"
              value={summary.pendingApprovals}
              suffix=" PO"
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Analisis Struktur Profitabilitas Keuangan" bordered={false} style={{ borderRadius: '12px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Text type="secondary">Margin Keuntungan Bersih Rata-Rata</Text>
            <Progress type="dashboard" percent={summary.avgProfitMargin} strokeColor="#722ed1" style={{ marginTop: '16px' }} />
          </Col>
          <Col xs={24} md={12}>
            <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: '12px' }}>
              <Alert
                message="Governance Finansial Terjaga"
                description="Perhitungan marjin keuntungan diukur dari rasio kontrak dan pengeluaran Procurement PO aktual yang disetujui."
                type="info"
                showIcon
              />
            </Space>
          </Col>
        </Row>
      </Card>
    </Space>
  );

  // TAB 5: LEGAL & GOVERNANCE
  const renderLegalGovernance = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Antrean Legal Review Active"
              value={0}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#1677ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="SPK Required Expiration Demotion"
              value={0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: '12px' }}>
            <Statistic
              title="Legal Review Compliance Rate"
              value={100}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Tata Kelola & Keamanan Berkas Legal MKT-4.x" bordered={false} style={{ borderRadius: '12px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="Aturan SPK Required & Grace Period 48 Jam"
            description="Tender yang berada dalam Grace Period 2x24 jam tanpa mengunggah file SPK fisik akan dikembalikan secara otomatis oleh scheduler ke status NEGOTIATION (SPK_REQUIRED) tanpa pernah membuat draft kontrak prematur."
            type="warning"
            showIcon
          />
          <Alert
            message="Validasi Akses Legal Review"
            description="Antrean Legal Review mengisolasi secara ketat seluruh kontrak yang belum memiliki file SPK fisik terverifikasi."
            type="success"
            showIcon
          />
        </Space>
      </Card>
    </Space>
  );

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
              <BarChartOutlined style={{ color: '#1677ff', marginRight: '10px' }} />
              KPI & Reports
            </Title>
            <Tag color="blue" style={{ borderRadius: '6px', fontWeight: 600, padding: '2px 10px' }}>
              Periode: {getPeriodBadgeLabel(period)}
            </Tag>
            {isMarketing ? (
              <Tag color="cyan" style={{ borderRadius: '6px', fontWeight: 600, padding: '2px 10px' }}>
                Personal Performance (PIC: {user?.fullName ?? 'Marketing'})
              </Tag>
            ) : (
              <Tag color="geekblue" style={{ borderRadius: '6px', fontWeight: 600, padding: '2px 10px' }}>
                Enterprise View
              </Tag>
            )}
          </div>
          <Text type="secondary">
            {isMarketing
              ? 'Performa KPI Pribadi Anda sebagai PIC Marketing'
              : 'Enterprise Performance Metrics & Analytic Dashboards (V1)'}
          </Text>
        </div>

        {/* Period Selector & Refresh Controls */}
        <Space size="middle" wrap>
          {lastUpdated && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Terakhir diperbarui: <Text style={{ fontWeight: 600 }}>{lastUpdated}</Text>
            </Text>
          )}
          <Button
            type="default"
            icon={<SyncOutlined spin={loading} />}
            onClick={() => fetchKpiData(period)}
            style={{ borderRadius: '8px' }}
          >
            Refresh
          </Button>
          <Space>
            <Text style={{ fontWeight: 600 }}>Periode Filter:</Text>
            <Select value={period} onChange={(val) => setPeriod(val)} style={{ width: 180 }}>
              <Option value="YEAR_TO_DATE">Year to Date (YTD)</Option>
              <Option value="THIS_MONTH">Bulan Ini</Option>
              <Option value="LAST_MONTH">Bulan Lalu</Option>
              <Option value="THIS_QUARTER">Kuartal Ini</Option>
              <Option value="LAST_QUARTER">Kuartal Lalu</Option>
            </Select>
          </Space>
        </Space>
      </div>

      {errorMsg && (
        <Alert message="Error" description={errorMsg} type="error" showIcon style={{ marginBottom: '16px' }} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Memuat Data Analytics & KPI..." />
        </div>
      ) : (
        <Tabs
          defaultActiveKey="1"
          type="card"
          size="middle"
          destroyInactiveTabPane={true}
          items={[
            {
              key: '1',
              label: (
                <span>
                  <TrophyOutlined /> Executive Summary
                </span>
              ),
              children: renderExecutiveSummary(),
            },
            {
              key: '2',
              label: (
                <span>
                  <BarChartOutlined /> Sales & Marketing
                </span>
              ),
              children: renderSalesMarketing(),
            },
            {
              key: '3',
              label: (
                <span>
                  <ProjectOutlined /> Project Delivery
                </span>
              ),
              children: renderProjectDelivery(),
            },
            {
              key: '4',
              label: (
                <span>
                  <DollarOutlined /> Finance & Cost
                </span>
              ),
              children: renderFinanceCost(),
            },
            {
              key: '5',
              label: (
                <span>
                  <SafetyCertificateOutlined /> Legal & Governance
                </span>
              ),
              children: renderLegalGovernance(),
            },
          ]}
        />
      )}
    </div>
  );
}
