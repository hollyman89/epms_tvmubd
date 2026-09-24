"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, Table, Typography, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Tag, message, Row, Col, Card, Spin, Skeleton, Space, Tooltip, Radio, Steps, Avatar, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EyeOutlined, RocketOutlined, AuditOutlined, ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, CalendarOutlined, FolderOpenOutlined, PieChartOutlined, ClockCircleOutlined, ArrowRightOutlined, InfoCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import CountUp from 'react-countup';
import { io } from 'socket.io-client';
import dayjs from 'dayjs';

const Line = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Line),
  { ssr: false }
);

const Pie = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Pie),
  { ssr: false }
);

const Area = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Area),
  { ssr: false }
);

const Funnel = dynamic(
  () => import('@ant-design/charts').then((mod) => mod.Funnel),
  { ssr: false }
);
import { useAuth } from '../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './SalesPipelinePage.module.css';
const KanbanBoard = dynamic(
  () => import('./KanbanBoard').then((mod) => mod.KanbanBoard),
  {
    ssr: false,
    loading: () => (
      <Spin
        size="large"
        style={{ display: 'block', margin: '40px auto' }}
      />
    ),
  }
);
import type { DashboardAnalyticsResponse } from '../types/analytics';
import { useTendersQuery } from '../hooks/useTendersQuery';
import { useCustomersQuery, useUsersQuery } from '../hooks/useMasterDataQuery';
import { SalesKpiSummaryCards } from './marketing/SalesKpiSummaryCards';
import { MarketingActionItemsCard } from './marketing/MarketingActionItemsCard';
import { PipelineAnalyticsView } from './marketing/PipelineAnalyticsView';
import { CreateTenderModal } from './marketing/CreateTenderModal';
import { LegalReviewModal } from './marketing/LegalReviewModal';
import {
  useDashboardSummaryQuery,
  useAnalyticsDashboardQuery,
  usePendingContractsQuery,
} from '../hooks/useDashboardQuery';
import { apiClient } from '@/lib/axios';
import { queryClient, updateAllTenderCaches, appendTenderToCache } from '../lib/queryClient';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * ChartErrorBoundary Component
 * Prevents a single chart failure from crashing the entire page.
 */
class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 8 }}>
          <Text type="danger">Gagal memuat grafik. Silakan refresh.</Text>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Graceful Empty Chart Component
 */
const EmptyChart = () => (
  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data tender yang tersedia untuk periode ini." />
);

const { TextArea } = Input;

const BUSINESS_SECTORS = [
  'Telekomunikasi & Internet',
  'Teknologi Informasi & Software',
  'Perbankan & Jasa Keuangan',
  'Energi & Sumber Daya Mineral',
  'Konstruksi & Infrastruktur',
  'Manufaktur & Industri',
  'Transportasi & Logistik',
  'Pemerintahan & BUMN',
  'Kesehatan & Farmasi',
  'Pendidikan',
  'Properti & Real Estate',
  'Retail & Distribusi'
];

export const SalesPipelinePage = () => {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const userRoles = useMemo(() => user?.roles || [], [user]);

  // Canonical Legal and Admin authorization check (no phantom LEGAL_REVIEWER)
  const canAccessLegalTracking = useMemo(() => {
    return userRoles.some((role: string) =>
      ['LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(role)
    );
  }, [userRoles]);

  // Decoupled Review permission (approving/rejecting/requesting revision)
  const canReviewContract = useMemo(() => {
    return userRoles.some((role: string) =>
      ['LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(role)
    );
  }, [userRoles]);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState('1');

  useEffect(() => {
    if (authLoading) return; // Wait for authentication and roles to resolve!

    if (tabParam === '3') {
      router.replace('/project-delivery');
      return;
    }

    if (tabParam === '2' || activeTab === '2') {
      if (!canAccessLegalTracking) {
        // Marketing or unauthorized role attempting to access Legal Tracking
        setActiveTab('1');
        if (tabParam === '2') {
          // Preserve other URL parameters while sanitizing tab
          const params = new URLSearchParams(searchParams.toString());
          params.set('tab', '1');
          const newQuery = params.toString();
          router.replace(`/sales${newQuery ? `?${newQuery}` : ''}`);
        }
        return;
      }
    }

    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [authLoading, tabParam, canAccessLegalTracking, searchParams, router]);

  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState('kanban');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [analyticsPeriodFilter, setAnalyticsPeriodFilter] = useState('YEAR_TO_DATE');

  // Modals state
  const [isTenderModalVisible, setIsTenderModalVisible] = useState(false);
  const [isLegalModalVisible, setIsLegalModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  
  // 1. Mandatory Data for Initial Active Tab (Tab 1 Kanban)
  const { data: reactQueryTenders = [], isLoading: isLoadingQuery } = useTendersQuery({ period: periodFilter });
  const activeTendersData = reactQueryTenders;

  // 2. Lazy Data: Master Customers (Only fetched when "+ Input Tender" modal is open)
  const { data: rawCustomers = [] } = useCustomersQuery('/marketing/customers', undefined, { enabled: isTenderModalVisible });
  const customers = Array.isArray(rawCustomers) ? rawCustomers : [];

  // 3. Lazy Data: Master Users / PICs (Only fetched when "+ Input Tender" modal is open)
  const { data: rawUsers = [] } = useUsersQuery({ enabled: isTenderModalVisible });
  const users = Array.isArray(rawUsers) ? rawUsers : [];

  // 4. Tab 1 Dashboard Summary Query (Cached / Enabled on Tab 1)
  const { data: dashboardSummary = null, isLoading: loadingDashboard, refetch: refetchDashboardSummary } = useDashboardSummaryQuery(
    periodFilter,
    '/marketing/dashboard/summary',
    { enabled: activeTab === '1' }
  );

  // 5. Lazy Data: Tab 2 Legal Tracking (Only fetched when authorized, auth is loaded, and on Tab 2 or Legal modal)
  const { data: rawPendingContracts = [], refetch: refetchPendingContracts } = usePendingContractsQuery({
    enabled: !authLoading && canAccessLegalTracking && (activeTab === '2' || isLegalModalVisible),
  });
  const pendingContracts = Array.isArray(rawPendingContracts) ? rawPendingContracts : [];

  // 6. Lazy Data: Tab 4 Analytics (Only fetched when user switches to Tab 4)
  const { data: analyticsData = null, isLoading: loadingAnalytics } = useAnalyticsDashboardQuery(
    analyticsPeriodFilter,
    { enabled: activeTab === '4' }
  );

  const computePremiumKpis = () => {
    const now = new Date();
    
    // Define period boundaries based on periodFilter
    let currentStart = new Date(0);
    let previousStart = new Date(0);
    let previousEnd = new Date(0);
    
    if (periodFilter === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (periodFilter === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      previousStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      previousEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
    } else if (periodFilter === 'year') {
      currentStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31);
    }
    // 'all' means compare all time with all time (no real previous period)
    
    let currentWon = 0;
    let previousWon = 0;
    
    let currentActive = 0;
    let previousActive = 0;
    
    let currentTotalCount = 0;
    let previousTotalCount = 0;
    
    let currentWonCount = 0;
    let previousWonCount = 0;

    // Sparkline data (last 7 data points - e.g. 7 days or 7 weeks depending on data, but let's just group by last 7 periods, or simply create dummy beautiful array from actual data)
    // For simplicity and beautiful rendering, we'll map recent 7 days
    const recent7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const wonSparkline = recent7Days.map(() => 0);
    const activeSparkline = recent7Days.map(() => 0);
    const countSparkline = recent7Days.map(() => 0);

    activeTendersData.forEach((t: any) => {
      const tDateStr = t.created_at || t.createdAt;
      const tDate = tDateStr ? new Date(tDateStr) : new Date();
      const val = Number(t.estimated_budget) || 0;
      const isWon = t.status === 'WON' || t.stage?.toUpperCase() === 'WON';
      const isActive = t.status !== 'WON' && t.status !== 'LOST';

      // Current vs Previous
      if (periodFilter === 'all' || tDate >= currentStart) {
        currentTotalCount++;
        if (isWon) {
          currentWon += val;
          currentWonCount++;
        }
        if (isActive) currentActive += val;
      } else if (tDate >= previousStart && tDate <= previousEnd) {
        previousTotalCount++;
        if (isWon) {
          previousWon += val;
          previousWonCount++;
        }
        if (isActive) previousActive += val;
      }

      // Sparkline population
      recent7Days.forEach((day, idx) => {
        if (tDate.getDate() === day.getDate() && tDate.getMonth() === day.getMonth()) {
          countSparkline[idx]++;
          if (isWon) wonSparkline[idx] += val;
          if (isActive) activeSparkline[idx] += val;
        }
      });
    });

    const calcGrowth = (curr: number, prev: number): number | null => {
      if (periodFilter === 'all' || prev === 0) return null;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const denomRevenue = currentWon + currentActive;
    const currentWinRate = denomRevenue > 0 ? Number(((currentWon / denomRevenue) * 100).toFixed(1)) : 0;
    const currentCountWinRate = currentTotalCount > 0 ? Number(((currentWonCount / currentTotalCount) * 100).toFixed(1)) : 0;

    const prevDenomRevenue = previousWon + previousActive;
    const previousWinRate = prevDenomRevenue > 0 ? (previousWon / prevDenomRevenue) * 100 : 0;
    const winRateGrowth = periodFilter === 'all' || prevDenomRevenue === 0 ? null : Number((currentWinRate - previousWinRate).toFixed(1));

    const formatSparkline = (arr: number[]) => {
      const data = arr.every(v => v === 0) ? [10, 15, 12, 20, 18, 25, 30] : arr;
      return data.map((v, i) => ({ index: i.toString(), value: v }));
    };

    return {
      won: {
        value: currentWon,
        growth: calcGrowth(currentWon, previousWon),
        sparkline: formatSparkline(wonSparkline)
      },
      active: {
        value: currentActive,
        growth: calcGrowth(currentActive, previousActive),
        sparkline: formatSparkline(activeSparkline)
      },
      count: {
        value: currentTotalCount,
        growth: calcGrowth(currentTotalCount, previousTotalCount),
        sparkline: formatSparkline(countSparkline)
      },
      winRate: {
        value: currentWinRate,
        countValue: currentCountWinRate,
        growth: winRateGrowth,
        sparkline: formatSparkline(wonSparkline.map(v => v > 0 ? v % 100 : v)) 
      }
    };
  };

  const renderTrendBadge = (growth: number | null, isDelta = false) => {
    if (growth === null || growth === undefined || periodFilter === 'all') {
      return (
        <span style={{ fontSize: 11, color: '#8f959e', backgroundColor: '#f2f3f5', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
          — N/A
        </span>
      );
    }

    const isPositive = growth >= 0;
    return (
      <Tag color={isPositive ? 'success' : 'error'} style={{ margin: 0, borderRadius: '4px', fontSize: 10, fontWeight: 700 }}>
        {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(growth).toFixed(1)}%{isDelta ? ' pts' : ''}
      </Tag>
    );
  };

  // --- CHART HELPERS ---
  const lineChartData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ 
        label: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }), 
        month: d.getMonth(), 
        year: d.getFullYear() 
      });
    }

    const data: any[] = [];
    months.forEach(m => {
      let totalValue = 0;
      let wonCount = 0;
      let totalCount = 0;

      activeTendersData.forEach((t: any) => {
        const tDateStr = t.created_at || t.createdAt;
        const tDate = tDateStr ? new Date(tDateStr) : new Date();
        if (tDate.getMonth() === m.month && tDate.getFullYear() === m.year) {
          totalCount++;
          totalValue += Number(t.estimated_budget) || 0;
          if (t.status === 'WON' || t.stage?.toUpperCase() === 'WON') wonCount++;
        }
      });

      const winRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0;

      data.push({ date: m.label, type: 'Total Pipeline', value: totalValue });
      data.push({ date: m.label, type: 'Win Rate (%)', value: winRate });
    });

    return data;
  }, [activeTendersData]);

  const pieChartData = useMemo(() => {
    const sectors: Record<string, number> = {};
    let total = 0;
    activeTendersData.forEach((t: any) => {
      if (t.status !== 'LOST' && t.status !== 'WON') {
        const s = t.business_sector || 'Lainnya';
        if (!sectors[s]) sectors[s] = 0;
        const val = Number(t.estimated_budget) || 0;
        sectors[s] += val;
        total += val;
      }
    });

    return Object.keys(sectors).map(key => {
      const percentage = total > 0 ? ((sectors[key] / total) * 100).toFixed(1) + '%' : '0%';
      return {
        type: key,
        value: sectors[key],
        percentage: percentage
      };
    }).filter(item => item.value > 0);
  }, [activeTendersData]);

  const actionItemsData = useMemo(() => {
    const items = activeTendersData.filter((t: any) => {
      const stage = t.stage?.toUpperCase();
      if (t.status === 'WON' || t.status === 'LOST' || stage === 'WON' || stage === 'LOST') return false;

      let isOverdue = false;
      if (t.bid_submission_deadline) {
        const deadline = new Date(t.bid_submission_deadline);
        deadline.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (deadline < today) isOverdue = true;
      }

      const isQualOrNeg = stage === 'QUALIFICATION' || stage === 'NEGOTIATION' || stage === 'PROPOSAL';
      
      let needsAttentionDeadline = false;
      if (t.bid_submission_deadline) {
        const deadline = new Date(t.bid_submission_deadline);
        const diffTime = deadline.getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 14) needsAttentionDeadline = true;
      }

      let needsAttentionStuck = false;
      if (t.probability_percentage === 0) {
        const tDateStr = t.created_at || t.createdAt;
        const created = tDateStr ? new Date(tDateStr) : new Date();
        const diffTime = new Date().getTime() - created.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) needsAttentionStuck = true;
      }

      return isOverdue || (isQualOrNeg && needsAttentionDeadline) || needsAttentionStuck;
    });

    return items.sort((a: any, b: any) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateA = a.bid_submission_deadline ? new Date(a.bid_submission_deadline) : new Date(8640000000000000);
      const dateB = b.bid_submission_deadline ? new Date(b.bid_submission_deadline) : new Date(8640000000000000);
      const isOverdueA = dateA < today;
      const isOverdueB = dateB < today;

      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;
      return dateA.getTime() - dateB.getTime();
    }).slice(0, 10);
  }, [activeTendersData]);

  const actionItemsColumns = useMemo(() => [
    { title: 'Project Name', dataIndex: 'title', key: 'title', render: (text: string) => <Text strong style={{ fontSize: 12, color: '#1f2329' }}>{text}</Text> },
    { title: 'Customer', key: 'customer', render: (text: any, record: any) => <Text style={{ fontSize: 12, color: '#4b5563' }}>{record.customer?.name || `ID: ${record.customer_id}`}</Text> },
    { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (val: string) => <Tag color={getStageColor(val)} style={{ borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{val}</Tag> },
    { 
      title: 'Bid Submission Deadline', 
      key: 'deadline', 
      render: (_: any, record: any) => {
        if (!record.bid_submission_deadline) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        const deadlineDate = new Date(record.bid_submission_deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const stage = record.stage?.toUpperCase();
        const isOverdue = deadlineDate < today && !['WON', 'LOST'].includes(stage);
        const daysOverdue = isOverdue ? Math.floor((today.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const formattedDate = deadlineDate.toLocaleDateString('id-ID');

        return (
          <Space size={6}>
            <Text style={{ fontSize: 12, color: isOverdue ? '#f53f3f' : '#4b5563', fontWeight: isOverdue ? 700 : 400 }}>
              {formattedDate}
            </Text>
            {isOverdue && (
              <Tooltip title={`Tender ini telah melewati deadline selama ${daysOverdue} hari!`}>
                <Tag style={{ borderRadius: 10, fontSize: 9, color: '#f53f3f', backgroundColor: '#ffece6', border: 'none', fontWeight: 700 }}>
                  LEWAT JATUH TEMPO ({daysOverdue}d)
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      } 
    },
    { 
      title: 'Action', 
      key: 'action', 
      render: (_: any, record: any) => (
        <Button 
          size="small" 
          type="primary" 
          style={{ backgroundColor: '#3370ff', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
          icon={<ArrowRightOutlined />}
          onClick={() => router.push(`/sales/tenders/${record.id}`)}
        >
          Buka Detail
        </Button>
      ) 
    }
  ], [router]);

  const updateTenderStatus = async (id: number, status: string) => {
    try {
      const stage = status === 'WON' ? 'Won' : status === 'LOST' ? 'Lost' : status;
      await apiClient.patch(`/marketing/tenders/${id}/status`, { stage });
      message.success(`Tender stage updated`);

      // Immediate UI update for current actor (optimistic cache update)
      updateAllTenderCaches(queryClient, id, { stage });

      if (refetchDashboardSummary) refetchDashboardSummary();

      // Background synchronization with server. Not primary UI update mechanism.
      queryClient.invalidateQueries({ queryKey: ['tenders'] });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error updating tender');
    }
  };

  // Helper for stage color
  const getStageColor = (stage: string) => {
    if (!stage) return 'default';
    const s = stage.toUpperCase();
    if (s === 'QUALIFICATION') return 'blue';
    if (s === 'NEGOTIATION') return 'magenta';
    if (s === 'PROPOSAL_SUBMITTED' || s === 'PROPOSAL SUBMITTED') return 'purple';
    if (s === 'WON') return 'green';
    if (s === 'LOST') return 'red';
    return 'default'; // LEAD
  };

  const tenderColumns = [
    { 
      title: 'Code / Tender ID', 
      key: 'code', 
      width: 130,
      render: (_: any, record: any) => (
        <Text code style={{ fontWeight: 600, color: '#1e40af', backgroundColor: '#eff6ff', borderRadius: 6, fontSize: 11, padding: '2px 8px' }}>
          TND-{String(record.id).padStart(4, '0')}
        </Text>
      )
    },
    { 
      title: 'Project Name', 
      key: 'project', 
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar size={32} icon={<FolderOpenOutlined />} style={{ background: '#e0e7ff', color: '#4f46e5', flexShrink: 0 }} />
          <div>
            <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{record.title}</Text>
          </div>
        </div>
      )
    },
    { 
      title: 'Customer', 
      key: 'customer', 
      render: (_: any, record: any) => {
        const customerName = record.customer?.name || `Customer ID: ${record.customer_id}`;
        return (
          <Text style={{ color: '#64748b', fontSize: 12 }}>{customerName}</Text>
        );
      }
    },
    { 
      title: 'Budget Awal', 
      key: 'estimated_budget', 
      render: (_: any, record: any) => {
        const val = Number(record.estimated_budget != null && !isNaN(Number(record.estimated_budget)) ? record.estimated_budget : 0);
        return (
          <Text style={{ fontWeight: 600, color: '#475569', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            Rp {val.toLocaleString('id-ID')}
          </Text>
        );
      }
    },
    { 
      title: 'Harga Negosiasi', 
      key: 'negotiated_price', 
      render: (_: any, record: any) => {
        if (record.negotiated_price != null && !isNaN(Number(record.negotiated_price))) {
          return (
            <Text style={{ fontWeight: 700, color: '#10b981', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              Rp {Number(record.negotiated_price).toLocaleString('id-ID')}
            </Text>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
      }
    },
    { 
      title: 'Tahap (Stage)', 
      dataIndex: 'stage', 
      key: 'stage', 
      render: (stage: string) => {
        const s = (stage || 'LEAD').toUpperCase();
        if (s === 'WON') return <Tag color="success" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>WON</Tag>;
        if (s === 'LOST') return <Tag color="error" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>LOST</Tag>;
        if (s === 'NEGOTIATION') return <Tag color="warning" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>NEGOTIATION</Tag>;
        if (s === 'PROPOSAL') return <Tag color="purple" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>PROPOSAL</Tag>;
        if (s === 'QUALIFICATION') return <Tag color="processing" style={{ fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>QUALIFICATION</Tag>;
        return <Tag color="default" style={{ fontWeight: 500, borderRadius: 10, padding: '2px 8px' }}>{s}</Tag>;
      }
    },
    { 
      title: 'PIC', 
      key: 'pic', 
      render: (_: any, record: any) => {
        const picName = record.marketing_pic_name || 'Unassigned';
        const initial = picName !== 'Unassigned' ? picName.charAt(0).toUpperCase() : '?';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar size={26} style={{ background: '#3b82f6', fontSize: '12px', fontWeight: 600 }}>{initial}</Avatar>
            <Text style={{ color: '#475569', fontSize: 12, fontWeight: 500 }}>{picName}</Text>
          </div>
        );
      }
    },
    { 
      title: 'Expected Close', 
      dataIndex: 'expected_closing_date', 
      key: 'closeDate', 
      render: (date: string) => {
        if (!date) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        const dateObj = new Date(date);
        const isOverdue = dateObj < new Date();
        const formattedDate = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        
        return (
          <Space size={4} style={{ color: isOverdue ? '#ef4444' : '#64748b' }}>
            <CalendarOutlined style={{ fontSize: 12 }} />
            <Text style={{ fontSize: 12, color: isOverdue ? '#ef4444' : '#475569', fontWeight: isOverdue ? 600 : 400 }}>{formattedDate}</Text>
          </Space>
        );
      }
    },
    { 
      title: 'Action', 
      key: 'action', 
      width: 90,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Tooltip title="Lihat Detail Proyek">
          <Button 
            type="text" 
            size="small"
            icon={<EyeOutlined style={{ color: '#2563eb' }} />} 
            onClick={() => router.push(`/sales/tenders/${record.id}`)}
            style={{ backgroundColor: '#eff6ff', borderRadius: 6 }}
          />
        </Tooltip>
      )
    }
  ];

  const contractColumns = [
    { title: 'Project Name', dataIndex: 'title', key: 'title', render: (text: string, record: any) => <Text strong style={{ fontSize: 13, color: '#1f2329' }}>{text || record.project_name || record.name}</Text> },
    { title: 'Customer', key: 'customer', render: (text: any, record: any) => record.customer?.name || record.customerName || `ID: ${record.customer_id}` },
    { 
      title: 'Harga Negosiasi', 
      key: 'price', 
      render: (text: any, record: any) => {
        if (record.negotiated_price != null && !isNaN(Number(record.negotiated_price))) {
          return (
            <Text style={{ fontWeight: 700, color: '#10b981', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              Rp {Number(record.negotiated_price).toLocaleString('id-ID')}
            </Text>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
      }
    },
    { 
      title: 'Legal Status', 
      key: 'legal_status', 
      render: (_: any, record: any) => {
        if (record.contract_status === 'PM_RETURNED' || record.contractStatus === 'PM_RETURNED') {
          return <Tag color="warning" style={{ fontWeight: 700, borderRadius: 10, backgroundColor: '#fffbe6', color: '#d97706', borderColor: '#ffe58f' }}>DIKEMBALIKAN PM</Tag>;
        }
        const val = record.legal_status || record.spk_verification_status || 'UNVERIFIED';
        if (val === 'VERIFIED') return <Tag color="success" style={{ fontWeight: 700, borderRadius: 10 }}>VERIFIED</Tag>;
        if (val === 'PENDING_REVIEW' || val === 'MENUNGGU_REVIEW') return <Tag color="warning" style={{ fontWeight: 600, borderRadius: 10 }}>MENUNGGU REVIEW</Tag>;
        if (val === 'REVISION_NEEDED') return <Tag color="error" style={{ fontWeight: 700, borderRadius: 10 }}>REVISI KONTRAK</Tag>;
        if (val === 'REJECTED') return <Tag color="error" style={{ fontWeight: 700, borderRadius: 10 }}>SPK Ditolak</Tag>;
        if (val === 'SPK_REQUIRED') return <Tag color="warning" style={{ fontWeight: 700, borderRadius: 10, backgroundColor: '#fff7ed', color: '#c2410c', borderColor: '#ffbb96' }}>Upload SPK Diperlukan</Tag>;
        if (val === 'PROJECT_STARTED') return <Tag color="processing" style={{ fontWeight: 700, borderRadius: 10 }}>PROYEK AKTIF</Tag>;
        return <Tag color="default" style={{ fontWeight: 500, borderRadius: 10 }}>{val}</Tag>;
      }
    },
    {
      title: 'Legal Reviewer',
      key: 'reviewer',
      render: (_: any, record: any) => {
        const name = record.legal_reviewer_name || record.reviewerName;
        return name ? <Text style={{ fontSize: 12, color: '#3b82f6' }}>{name}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>Belum Di-assign</Text>;
      }
    },
    {
      title: 'SLA Deadline',
      key: 'sla',
      render: (_: any, record: any) => {
        const deadline = record.legal_sla_deadline || record.slaDeadline;
        if (!deadline) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
        const dObj = new Date(deadline);
        const isBreached = dObj < new Date() && (record.legal_status === 'MENUNGGU_REVIEW' || record.spk_verification_status === 'PENDING_REVIEW');
        const formattedDate = dObj.toLocaleDateString('id-ID');

        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: isBreached ? '#f53f3f' : '#8f959e' }} />
            <Text style={{ fontSize: 12, color: isBreached ? '#f53f3f' : '#4b5563', fontWeight: isBreached ? 700 : 400 }}>{formattedDate}</Text>
            {isBreached && <Tag style={{ color: '#f53f3f', backgroundColor: '#ffece6', border: 'none', fontSize: 9, fontWeight: 700, borderRadius: 8 }}>SLA BREACH</Tag>}
          </Space>
        );
      }
    },
    { title: 'Action', key: 'action', render: (text: any, record: any) => {
        const status = record.legal_status || record.spk_verification_status || 'UNVERIFIED';
        const isPmoRole = userRoles.includes('PMO') || userRoles.includes('PROJECT_MANAGER') || userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
        const isMarketingRole = userRoles.includes('MARKETING') || userRoles.includes('SALES');

        if (record.contract_status === 'PM_RETURNED' || record.contractStatus === 'PM_RETURNED') {
          if (isMarketingRole) {
            return (
              <Button 
                size="small" 
                type="primary" 
                style={{ backgroundColor: '#d97706', borderColor: '#d97706', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
                onClick={() => router.push(`/sales/tenders/${record.id}`)}
              >
                Revisi Charter (PM)
              </Button>
            );
          }
          return <Tag color="warning" style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Dikembalikan PM</Tag>;
        }

        if (status === 'UNVERIFIED' || status === 'DRAFT') {
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Menunggu Upload SPK</Button>;
        }

        if (status === 'MENUNGGU_REVIEW' || status === 'PENDING_REVIEW') {
          if (canReviewContract) {
            return (
              <Button
                size="small"
                type="primary"
                style={{ backgroundColor: '#faad14', borderColor: '#faad14', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
                onClick={() => {
                  setSelectedContract(record);
                  setIsLegalModalVisible(true);
                }}
              >
                Review Kontrak
              </Button>
            );
          }
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Menunggu Legal...</Button>;
        }

        if (status === 'VERIFIED') {
          if (isPmoRole) {
            return (
              <Button 
                size="small" 
                type="primary" 
                style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 6, fontWeight: 600, fontSize: 11 }}
                icon={<PlayCircleOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: 'Inisiasi Proyek (PMO Governance)',
                    content: `Apakah Anda yakin ingin mengonversi SPK "${record.title || record.project_name}" menjadi Proyek Operasional?`,
                    okText: 'Inisiasi Proyek',
                    onOk: async () => {
                      try {
                        await apiClient.post('/legal/start-project', { tenderId: record.id });
                        message.success('Proyek operasional berhasil diinisiasi!');
                      } catch (err: any) {
                        message.error(err.response?.data?.message || 'Gagal menginisiasi proyek');
                      }
                    }
                  });
                }}
              >
                Inisiasi Proyek (PMO)
              </Button>
            );
          }
          return <Tag color="success" style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Siap Dikelola PMO</Tag>;
        }

        if (status === 'REVISION_NEEDED') {
          if (isMarketingRole) {
            return <Button size="small" type="primary" danger style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }} onClick={() => router.push(`/sales/tenders/${record.id}`)}>Revisi Kontrak</Button>;
          }
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Menunggu Revisi</Button>;
        }

        if (status === 'REJECTED') {
          return <Button size="small" danger style={{ borderRadius: 6, fontSize: 11 }} onClick={() => message.error(`Catatan Legal: ${record.legal_notes || record.spk_verification_notes || 'Silakan cek dengan tim Legal.'}`)}>Lihat Catatan</Button>;
        }

        if (status === 'PROJECT_STARTED') {
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Proyek Berjalan</Button>;
        }

        return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Status Unknown</Button>;
    }}
  ];

  if (authLoading) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #f1f5f9'
        }}
      >
        <Spin size="large" tip="Memverifikasi hak akses..." />
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#ffffff', 
      borderRadius: '16px', 
      padding: '24px', 
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
      border: '1px solid #f1f5f9',
      minHeight: '80vh' 
    }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space direction="vertical" size={2}>
            <Space align="center" size={8}>
              <RocketOutlined style={{ fontSize: 22, color: '#0f172a' }} />
              <Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                {canAccessLegalTracking ? 'Sales & Legal Pipeline' : 'Sales Pipeline'}
              </Title>
            </Space>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>
              {canAccessLegalTracking
                ? 'Kelola direktori pipeline tender, status kualifikasi, analitik prospek, dan integrasi legal'
                : 'Kelola direktori pipeline tender, status kualifikasi, dan analitik prospek'}
            </Text>
          </Space>
        </Col>
        <Col>
          {activeTab === '1' && (
            <Space size={12} wrap align="center">
              <Radio.Group value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio.Button value="all">Semua Waktu</Radio.Button>
                <Radio.Button value="month">Bulan Ini</Radio.Button>
                <Radio.Button value="quarter">Kuartal Ini</Radio.Button>
                <Radio.Button value="year">Tahun Ini</Radio.Button>
              </Radio.Group>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setIsTenderModalVisible(true)}
                style={{
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                  borderRadius: 8,
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(22, 119, 255, 0.2)'
                }}
              >
                Input Tender
              </Button>
            </Space>
          )}
        </Col>
      </Row>

      {activeTab === '1' && (
        <div style={{ marginBottom: '24px' }}>
          {isLoadingQuery ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <SalesKpiSummaryCards kpis={computePremiumKpis()} renderTrendBadge={renderTrendBadge} />
          )}

          {!isLoadingQuery && (
            <MarketingActionItemsCard
              actionItemsData={actionItemsData}
              actionItemsColumns={actionItemsColumns}
            />
          )}
        </div>
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab} className={styles.customTabs} items={[
        {
          key: '1',
          label: <span><RocketOutlined /> Active Opportunities</span>,
          children: (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} optionType="button" buttonStyle="solid">
                  <Radio.Button value="table">Table View</Radio.Button>
                  <Radio.Button value="kanban">Kanban View</Radio.Button>
                </Radio.Group>
              </div>
              {viewMode === 'kanban' ? (
                <KanbanBoard 
                  tenders={activeTendersData} 
                  onStageChange={async (id, newStage) => {
                    try {
                      await apiClient.patch(`/marketing/tenders/${id}/status`, { stage: newStage });
                      message.success('Status tender berhasil diperbarui');
                      updateAllTenderCaches(queryClient, id, { stage: newStage });
                    } catch (err: any) {
                      const errMsg = err.response?.data?.message || err.message || 'Gagal mengubah status tender di server.';
                      message.error(`Gagal Update Status: ${errMsg}`);
                      throw err; // Rethrow to trigger Rollback in KanbanBoard
                    }
                  }} 
                />
              ) : (
                <div style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  padding: '16px 24px', 
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)',
                  border: '1px solid #f1f5f9' 
                }}>
                  <Table 
                    dataSource={activeTendersData} 
                    columns={tenderColumns} 
                    rowKey="id" 
                    pagination={{ 
                      pageSize: 10, 
                      position: ['bottomRight'],
                      showSizeChanger: true,
                      showTotal: (total, range) => `Menampilkan ${range[0]}-${range[1]} dari ${total} tender`
                    }} 
                    loading={isLoadingQuery} 
                    rowClassName={() => 'modern-table-row'}
                    style={{ overflowX: 'auto' }}
                    locale={{
                      emptyText: (
                        <Empty 
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <Space direction="vertical" size={4}>
                              <Text strong style={{ color: '#475569' }}>Belum Ada Data Tender</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>Gunakan tombol "+ Input Tender" untuk menambahkan tender baru.</Text>
                            </Space>
                          }
                          style={{ margin: '32px 0' }}
                        />
                      )
                    }}
                  />
                  <style>{`
                    .modern-table-row:hover > td {
                      background-color: #f8fafc !important;
                      cursor: pointer;
                    }
                    .modern-table-row > td {
                      border-bottom: 1px solid #f1f5f9;
                      padding: 14px 16px !important;
                    }
                    .ant-table-thead > tr > th {
                      background-color: #102A43 !important;
                      color: #ffffff !important;
                      font-weight: 600 !important;
                      text-transform: uppercase;
                      font-size: 11px;
                      letter-spacing: 0.5px;
                      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                      padding: 14px 16px !important;
                    }
                    .ant-table-thead > tr > th::before {
                      display: none !important;
                    }
                    .ant-table {
                      border-radius: 12px;
                      overflow: hidden;
                      border: 1px solid #e2e8f0;
                    }
                  `}</style>
                </div>
              )}
            </div>
          )
        },
        ...(canAccessLegalTracking ? [{
          key: '2',
          label: <span><AuditOutlined /> Legal Tracking</span>,
          children: (
            <div className={styles.tableContainer}>
              <Table 
                className={styles.trackingTable}
                dataSource={activeTendersData.filter((t: any) => t.status === 'WON' || t.spk_verification_status)} 
                columns={contractColumns} 
                rowKey="id" 
                pagination={{ pageSize: 10 }} 
              />
            </div>
          )
        }] : []),
        {
          key: '4',
          label: <span><PieChartOutlined /> Analytics</span>,
          children: activeTab === '4' ? (
            <PipelineAnalyticsView
              analyticsPeriodFilter={analyticsPeriodFilter}
              setAnalyticsPeriodFilter={setAnalyticsPeriodFilter}
              loadingAnalytics={loadingAnalytics}
              analyticsData={analyticsData}
              LineChart={Line}
              PieChart={Pie}
              FunnelChart={Funnel}
              ChartErrorBoundary={ChartErrorBoundary}
              EmptyChart={EmptyChart}
            />
          ) : null
        }
      ]} />

      {/* CREATE TENDER MODAL */}
      <CreateTenderModal
        open={isTenderModalVisible}
        onClose={() => setIsTenderModalVisible(false)}
        onSuccess={(resData) => {
          if (resData) {
            appendTenderToCache(queryClient, resData, { customers, users, currentUser: user });
          }
          if (refetchDashboardSummary) refetchDashboardSummary();
          queryClient.invalidateQueries({ queryKey: ['tenders'] });
        }}
        customers={customers}
        users={users}
        currentUser={user}
      />

      {/* LEGAL REVIEW MODAL */}
      {canReviewContract && (
        <LegalReviewModal
          open={isLegalModalVisible}
          contract={selectedContract}
          onClose={() => setIsLegalModalVisible(false)}
          onSuccess={() => {
            if (canAccessLegalTracking && refetchPendingContracts) {
              refetchPendingContracts();
            }
          }}
        />
      )}

    </div>
  );
};
