"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, Table, Typography, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Tag, message, Row, Col, Card, Spin, Skeleton, Space, Tooltip, Radio, Steps, Avatar, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EyeOutlined, RocketOutlined, AuditOutlined, ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, CalendarOutlined, FolderOpenOutlined, PieChartOutlined, ClockCircleOutlined, ArrowRightOutlined, InfoCircleOutlined, PlayCircleOutlined, AppstoreOutlined, BarsOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
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
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercentage,
  formatQuantity,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PipelineAnalyticsView } from './marketing/PipelineAnalyticsView';
import { CreateTenderModal } from './marketing/CreateTenderModal';
import { LegalReviewModal } from './marketing/LegalReviewModal';
import { TenderDetailDrawer } from './TenderDetailDrawer';
import {
  useDashboardSummaryQuery,
  useAnalyticsDashboardQuery,
  usePendingContractsQuery,
} from '../hooks/useDashboardQuery';
import { apiClient } from '@/lib/axios';
import { queryClient, updateAllTenderCaches, appendTenderToCache } from '../lib/queryClient';
import { peekPendingSalesDrawerRequest } from '@/lib/salesNavigation';
import { evaluateMarketingActionItem, MarketingActionConditionType } from '@/lib/marketingActionItemPredicate';

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
  const tenderIdParam = searchParams.get('tenderId');
  const actionParam = searchParams.get('action');
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

  useEffect(() => {
    if (tenderIdParam || peekPendingSalesDrawerRequest()) {
      setActiveTab('1');
      setViewMode('kanban');
    }

    if (typeof window === 'undefined') return;
    const handleDrawerEvent = () => {
      setActiveTab('1');
      setViewMode('kanban');
    };
    window.addEventListener('epms:open_sales_drawer', handleDrawerEvent);
    return () => {
      window.removeEventListener('epms:open_sales_drawer', handleDrawerEvent);
    };
  }, [tenderIdParam]);

  // Modals state
  const [isTenderModalVisible, setIsTenderModalVisible] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedTenderForDetail, setSelectedTenderForDetail] = useState<any>(null);
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
        <span
          style={{
            fontSize: 11,
            color: '#94A3B8',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            padding: '2px 8px',
            borderRadius: 6,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          N/A
        </span>
      );
    }

    const isPositive = growth >= 0;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          padding: '2px 8px',
          backgroundColor: isPositive ? '#F0FDF4' : '#FEF2F2',
          color: isPositive ? '#16A34A' : '#DC2626',
          border: `1px solid ${isPositive ? '#BBF7D0' : '#FECACA'}`,
          whiteSpace: 'nowrap',
        }}
      >
        {isPositive ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />}
        {Math.abs(growth).toFixed(1)}%{isDelta ? ' pts' : ''}
      </span>
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
    const items = activeTendersData
      .map((t: any) => {
        const evaluation = evaluateMarketingActionItem(t);
        return {
          ...t,
          actionItemEvaluation: evaluation,
        };
      })
      .filter((t: any) => t.actionItemEvaluation?.isActionItem);

    const conditionRank: Record<string, number> = {
      [MarketingActionConditionType.OVERDUE]: 1,
      [MarketingActionConditionType.UPCOMING_DEADLINE]: 2,
      [MarketingActionConditionType.STUCK]: 3,
    };

    return items.sort((a: any, b: any) => {
      const condA = a.actionItemEvaluation?.conditionType || '';
      const condB = b.actionItemEvaluation?.conditionType || '';
      const rankA = conditionRank[condA] || 99;
      const rankB = conditionRank[condB] || 99;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // 1. OVERDUE: longest overdue first (higher daysOverdue first)
      if (condA === MarketingActionConditionType.OVERDUE) {
        const diff = (b.actionItemEvaluation?.daysOverdue || 0) - (a.actionItemEvaluation?.daysOverdue || 0);
        if (diff !== 0) return diff;
      }

      // 2. UPCOMING_DEADLINE: nearest deadline first (lower daysRemaining first)
      if (condA === MarketingActionConditionType.UPCOMING_DEADLINE) {
        const diff = (a.actionItemEvaluation?.daysRemaining || 0) - (b.actionItemEvaluation?.daysRemaining || 0);
        if (diff !== 0) return diff;
      }

      // 3. STUCK: longest stuck first (higher stuckDays first)
      if (condA === MarketingActionConditionType.STUCK) {
        const diff = (b.actionItemEvaluation?.stuckDays || 0) - (a.actionItemEvaluation?.stuckDays || 0);
        if (diff !== 0) return diff;
      }

      const dateA = a.bid_submission_deadline ? new Date(a.bid_submission_deadline).getTime() : 8640000000000000;
      const dateB = b.bid_submission_deadline ? new Date(b.bid_submission_deadline).getTime() : 8640000000000000;
      if (dateA !== dateB) return dateA - dateB;

      return (b.id || 0) - (a.id || 0);
    });
  }, [activeTendersData]);

  const actionItemsColumns = useMemo(() => [
    {
      title: 'Project Name',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.35 }}>{text}</Text>
          <Text style={{ fontSize: 11, color: '#94A3B8' }}>TND-{String(record.id).padStart(4, '0')}</Text>
        </div>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (text: any, record: any) => (
        <Text style={{ fontSize: 12.5, color: '#475569', fontWeight: 500 }}>
          {record.customer?.name || `ID: ${record.customer_id}`}
        </Text>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (val: string) => renderStageBadge(val),
    },
    {
      title: 'Condition & Urgency',
      key: 'condition',
      width: 190,
      render: (_: any, record: any) => {
        const evalData = record.actionItemEvaluation || evaluateMarketingActionItem(record);
        if (!evalData || !evalData.conditionType) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;

        const isOverdue = evalData.conditionType === MarketingActionConditionType.OVERDUE;
        const isUpcoming = evalData.conditionType === MarketingActionConditionType.UPCOMING_DEADLINE;

        const tagConfig = isOverdue
          ? { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', text: 'OVERDUE' }
          : isUpcoming
          ? { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', text: 'UPCOMING' }
          : { color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE', text: 'STUCK' };

        const urgencyLabel = isOverdue
          ? `Lewat jatuh tempo ${evalData.daysOverdue} hari`
          : isUpcoming
          ? (evalData.daysRemaining === 0 ? 'Jatuh tempo hari ini' : `Deadline ${evalData.daysRemaining} hari lagi`)
          : `Tidak ada progress ${evalData.stuckDays} hari`;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 10.5,
                fontWeight: 700,
                color: tagConfig.color,
                backgroundColor: tagConfig.bg,
                border: `1px solid ${tagConfig.border}`,
                borderRadius: 4,
                padding: '1px 6px',
                width: 'fit-content',
                letterSpacing: 0.5,
              }}
            >
              {tagConfig.text}
            </span>
            <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 500 }}>
              {urgencyLabel}
            </span>
          </div>
        );
      },
    },
    { 
      title: 'Bid Submission Deadline', 
      key: 'deadline', 
      render: (_: any, record: any) => {
        if (!record.bid_submission_deadline) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        const deadlineDate = new Date(record.bid_submission_deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const formattedDate = deadlineDate.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        return (
          <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {formattedDate}
          </span>
        );
      } 
    },
    { 
      title: 'Action', 
      key: 'action', 
      width: 120,
      render: (_: any, record: any) => (
        <Button 
          size="small" 
          onClick={() => {
            setSelectedTenderForDetail(record);
            setDetailDrawerOpen(true);
          }}
          icon={<EyeOutlined style={{ color: '#2563EB', fontSize: 12 }} />}
          style={{
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            color: '#1E293B',
            borderColor: '#CBD5E1',
            backgroundColor: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Lihat Detail
        </Button>
      ) 
    }
  ], []);

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
  };  // Standardized semantic pastel badge for tender stages
  const renderStageBadge = (stage: string) => {
    const s = (stage || '').toUpperCase();
    let bg = '#F1F5F9';
    let color = '#475569';
    let border = '#E2E8F0';
    let label = stage || 'LEAD';

    if (s === 'LEAD') {
      bg = '#EFF6FF'; color = '#1D4ED8'; border = '#BFDBFE'; label = 'LEAD';
    } else if (s === 'WAITING_GO_NO_GO') {
      bg = '#FFFBEB'; color = '#B45309'; border = '#FDE68A'; label = 'WAITING GO/NO-GO';
    } else if (s === 'QUALIFICATION') {
      bg = '#ECFEFF'; color = '#0E7490'; border = '#A5F3FC'; label = 'QUALIFICATION';
    } else if (s === 'PROPOSAL' || s === 'PROPOSAL_SUBMITTED' || s === 'PROPOSAL SUBMITTED') {
      bg = '#F5F3FF'; color = '#6D28D9'; border = '#DDD6FE'; label = 'PROPOSAL';
    } else if (s === 'NEGOTIATION') {
      bg = '#FFF7ED'; color = '#C2410C'; border = '#FFEDD5'; label = 'NEGOTIATION';
    } else if (s === 'WON') {
      bg = '#F0FDF4'; color = '#15803D'; border = '#BBF7D0'; label = 'WON';
    } else if (s === 'LOST') {
      bg = '#FEF2F2'; color = '#B91C1C'; border = '#FECACA'; label = 'LOST';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    );
  };

  // Table View Local Filters & Search State
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableSelectedStage, setTableSelectedStage] = useState('ALL');
  const [tableSelectedCustomer, setTableSelectedCustomer] = useState('ALL');
  const [tableSelectedPic, setTableSelectedPic] = useState('ALL');

  const handleResetTableFilters = () => {
    setTableSearchQuery('');
    setTableSelectedStage('ALL');
    setTableSelectedCustomer('ALL');
    setTableSelectedPic('ALL');
  };

  // Helper to extract canonical PIC display name from opportunity record
  const getTenderPicDisplayName = useCallback((record: any) => {
    return record.marketing_pic_name || record.marketing_pic?.name || record.marketing_pic?.email || (record.marketing_pic_id ? `User ${record.marketing_pic_id}` : 'Unassigned');
  }, []);

  // Extract unique customer options from current authorized activeTendersData
  const tableCustomerOptions = useMemo(() => {
    const set = new Set<string>();
    activeTendersData.forEach((t: any) => {
      const name = t.customer?.name || (t.customer_id ? `Customer ID: ${t.customer_id}` : null);
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeTendersData]);

  // Extract unique PIC options from current authorized activeTendersData
  const tablePicOptions = useMemo(() => {
    const set = new Set<string>();
    activeTendersData.forEach((t: any) => {
      const pic = getTenderPicDisplayName(t);
      if (pic && pic !== 'Unassigned' && pic.trim()) set.add(pic.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeTendersData, getTenderPicDisplayName]);

  // Derived filtered dataset for Table View
  const filteredTableTenders = useMemo(() => {
    return activeTendersData.filter((tender: any) => {
      // 1. Search Query
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.trim().toLowerCase();
        const rawId = String(tender.id || '').toLowerCase();
        const paddedId = `tnd-${String(tender.id || '').padStart(4, '0')}`.toLowerCase();
        const code = String(tender.tender_code || tender.code || '').toLowerCase();
        const title = String(tender.title || tender.project_name || tender.name || '').toLowerCase();
        const custName = String(tender.customer?.name || (tender.customer_id ? `customer id: ${tender.customer_id}` : '')).toLowerCase();
        const picName = String(tender.marketing_pic_name || tender.marketing_pic?.name || '').toLowerCase();
        const picEmail = String(tender.marketing_pic?.email || '').toLowerCase();

        const matches =
          rawId.includes(q) ||
          paddedId.includes(q) ||
          code.includes(q) ||
          title.includes(q) ||
          custName.includes(q) ||
          picName.includes(q) ||
          picEmail.includes(q);

        if (!matches) return false;
      }

      // 2. Stage Filter
      if (tableSelectedStage !== 'ALL') {
        const s = (tender.stage || '').toUpperCase();
        if (tableSelectedStage === 'PROPOSAL') {
          if (s !== 'PROPOSAL' && s !== 'PROPOSAL_SUBMITTED' && s !== 'PROPOSAL SUBMITTED') return false;
        } else if (tableSelectedStage === 'WAITING_GO_NO_GO') {
          if (s !== 'WAITING_GO_NO_GO' && s !== 'WAITING GO/NO-GO' && s !== 'WAITING GO NO GO') return false;
        } else {
          if (s !== tableSelectedStage) return false;
        }
      }

      // 3. Customer Filter
      if (tableSelectedCustomer !== 'ALL') {
        const custName = tender.customer?.name || (tender.customer_id ? `Customer ID: ${tender.customer_id}` : '');
        if (custName.trim() !== tableSelectedCustomer) return false;
      }

      // 4. PIC Filter
      if (tableSelectedPic !== 'ALL') {
        const pic = getTenderPicDisplayName(tender);
        if (pic.trim() !== tableSelectedPic) return false;
      }

      return true;
    });
  }, [activeTendersData, tableSearchQuery, tableSelectedStage, tableSelectedCustomer, tableSelectedPic, getTenderPicDisplayName]);

  const tenderColumns = [
    { 
      title: 'Tender ID', 
      key: 'code', 
      width: 110,
      sorter: (a: any, b: any) => (Number(a.id) || 0) - (Number(b.id) || 0),
      render: (_: any, record: any) => (
        <Text code style={{ fontWeight: 600, color: '#1e40af', backgroundColor: '#eff6ff', borderRadius: 6, fontSize: 11, padding: '2px 8px', border: '1px solid #dbeafe', whiteSpace: 'nowrap' }}>
          TND-{String(record.id).padStart(4, '0')}
        </Text>
      )
    },
    { 
      title: 'Project Name', 
      key: 'project', 
      width: 360,
      sorter: (a: any, b: any) => (a.title || '').localeCompare(b.title || ''),
      render: (_: any, record: any) => {
        const title = record.title || record.project_name || '—';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Avatar size={30} icon={<FolderOpenOutlined style={{ fontSize: 14 }} />} style={{ background: '#EFF6FF', color: '#2563EB', flexShrink: 0, borderRadius: 8 }} />
            <Tooltip title={title} placement="topLeft">
              <Text strong style={{ color: '#0F172A', fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300, cursor: 'pointer' }}>
                {title}
              </Text>
            </Tooltip>
          </div>
        );
      }
    },
    { 
      title: 'Customer', 
      key: 'customer', 
      width: 200,
      sorter: (a: any, b: any) => {
        const aCust = a.customer?.name || '';
        const bCust = b.customer?.name || '';
        return aCust.localeCompare(bCust);
      },
      render: (_: any, record: any) => {
        const customerName = record.customer?.name || (record.customer_id ? `Customer ID: ${record.customer_id}` : '—');
        return (
          <Tooltip title={customerName} placement="topLeft">
            <Text style={{ color: '#475569', fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 185 }}>
              {customerName}
            </Text>
          </Tooltip>
        );
      }
    },
    { 
      title: 'Budget Awal', 
      key: 'estimated_budget', 
      width: 140,
      align: 'right' as const,
      sorter: (a: any, b: any) => (Number(a.estimated_budget) || 0) - (Number(b.estimated_budget) || 0),
      render: (_: any, record: any) => {
        const val = record.estimated_budget != null && !isNaN(Number(record.estimated_budget)) ? Number(record.estimated_budget) : null;
        return (
          <Text style={{ fontWeight: 600, color: '#334155', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(val)}
          </Text>
        );
      }
    },
    { 
      title: 'Harga Negosiasi', 
      key: 'negotiated_price', 
      width: 140,
      align: 'right' as const,
      sorter: (a: any, b: any) => (Number(a.negotiated_price) || 0) - (Number(b.negotiated_price) || 0),
      render: (_: any, record: any) => {
        if (record.negotiated_price != null && !isNaN(Number(record.negotiated_price))) {
          return (
            <Text style={{ fontWeight: 600, color: '#059669', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(record.negotiated_price)}
            </Text>
          );
        }
        return <Text type="secondary" style={{ fontSize: 13 }}>—</Text>;
      }
    },
    { 
      title: 'Stage', 
      dataIndex: 'stage', 
      key: 'stage', 
      width: 130,
      sorter: (a: any, b: any) => (a.stage || '').localeCompare(b.stage || ''),
      render: (stage: string) => renderStageBadge(stage)
    },
    { 
      title: 'PIC', 
      key: 'pic', 
      width: 155,
      sorter: (a: any, b: any) => {
        const aPic = getTenderPicDisplayName(a);
        const bPic = getTenderPicDisplayName(b);
        return aPic.localeCompare(bPic);
      },
      render: (_: any, record: any) => {
        const picName = getTenderPicDisplayName(record);
        const initial = picName !== 'Unassigned' ? picName.charAt(0).toUpperCase() : '?';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <Avatar size={24} style={{ background: '#2563EB', color: '#FFFFFF', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
              {initial}
            </Avatar>
            <span 
              style={{ 
                color: '#334155', 
                fontSize: 13, 
                fontWeight: 500, 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                maxWidth: 115,
                display: 'inline-block' 
              }}
              title={picName}
            >
              {picName}
            </span>
          </div>
        );
      }
    },
    { 
      title: 'Expected Close', 
      dataIndex: 'expected_closing_date', 
      key: 'closeDate', 
      width: 135,
      sorter: (a: any, b: any) => new Date(a.expected_closing_date || 0).getTime() - new Date(b.expected_closing_date || 0).getTime(),
      render: (date: string) => {
        if (!date) return <Text type="secondary" style={{ fontSize: 13 }}>—</Text>;
        const dateObj = new Date(date);
        const isOverdue = dateObj < new Date();
        const formattedDate = formatDate(date);
        
        return (
          <Space size={4} style={{ color: isOverdue ? '#ef4444' : '#64748b', whiteSpace: 'nowrap' }}>
            <CalendarOutlined style={{ fontSize: 12 }} />
            <Text style={{ fontSize: 13, color: isOverdue ? '#ef4444' : '#475569', fontWeight: isOverdue ? 600 : 400 }}>{formattedDate}</Text>
          </Space>
        );
      }
    },
    { 
      title: 'Action', 
      key: 'action', 
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Tooltip title="Lihat Detail Proyek" placement="top">
          <Button 
            type="default" 
            size="small"
            icon={<EyeOutlined style={{ color: '#2563EB', fontSize: 12 }} />} 
            onClick={() => {
              setSelectedTenderForDetail(record);
              setDetailDrawerOpen(true);
            }}
            style={{ borderRadius: 6, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }}
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
              {formatCurrency(record.negotiated_price)}
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
          return <StatusBadge domain="legal" status="PM_RETURNED" />;
        }
        const val = record.legal_status || record.spk_verification_status || 'UNVERIFIED';
        return <StatusBadge domain="legal" status={val} />;
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
        const formattedDate = formatDate(deadline);

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
                onClick={() => router.push('/projects')}
              >
                Buka Board PMO
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
    <div className={styles.salesContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleGroup}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                border: '1px solid #BFDBFE',
                flexShrink: 0,
              }}
            >
              <RocketOutlined />
            </div>
            <div>
              <h1 style={{ margin: 0, color: '#0F172A', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
                {canAccessLegalTracking ? 'Sales & Legal Pipeline' : 'Sales Pipeline'}
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748B' }}>
                {canAccessLegalTracking
                  ? 'Kelola direktori pipeline tender, status kualifikasi, analitik prospek, dan integrasi legal'
                  : 'Kelola direktori pipeline tender, status kualifikasi, dan analitik prospek'}
              </p>
            </div>
          </div>
        </div>

        {activeTab === '1' && (
          <div className={styles.headerControls}>
            <Radio.Group 
              value={periodFilter} 
              onChange={(e) => setPeriodFilter(e.target.value)} 
              optionType="button" 
              buttonStyle="solid"
              className={styles.periodSegmented}
            >
              <Radio.Button value="all">Semua Waktu</Radio.Button>
              <Radio.Button value="month">Bulan Ini</Radio.Button>
              <Radio.Button value="quarter">Kuartal Ini</Radio.Button>
              <Radio.Button value="year">Tahun Ini</Radio.Button>
            </Radio.Group>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setIsTenderModalVisible(true)}
              className={styles.inputTenderBtn}
            >
              Input Tender
            </Button>
          </div>
        )}
      </div>

      {activeTab === '1' && (
        <div style={{ marginBottom: 20 }}>
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
              <div className={styles.opportunitiesControlBar}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0F172A' }}>
                    Daftar Peluang Aktif ({activeTendersData.length})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {viewMode === 'kanban' 
                      ? 'Visualisasi alur kartu berdasarkan tahapan pipeline tender' 
                      : 'Tabel ringkasan data tender, anggaran, dan tanggal target'}
                  </div>
                </div>

                <Radio.Group 
                  value={viewMode} 
                  onChange={e => setViewMode(e.target.value)} 
                  optionType="button" 
                  buttonStyle="solid"
                  className={styles.viewModeGroup}
                >
                  <Radio.Button value="kanban">
                    <Space size={4}>
                      <AppstoreOutlined />
                      <span>Kanban View</span>
                    </Space>
                  </Radio.Button>
                  <Radio.Button value="table">
                    <Space size={4}>
                      <BarsOutlined />
                      <span>Table View</span>
                    </Space>
                  </Radio.Button>
                </Radio.Group>
              </div>

              {viewMode === 'kanban' ? (
                <KanbanBoard 
                  tenders={activeTendersData} 
                  targetTenderId={tenderIdParam ? Number(tenderIdParam) : null}
                  targetAction={actionParam}
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
                  borderRadius: '12px', 
                  padding: '16px 20px', 
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  border: '1px solid #E2E8F0' 
                }}>
                  {/* Table View Toolbar: Search & Local Filters */}
                  {/* Table View Toolbar: Search & Local Filters */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-end', 
                    gap: '12px', 
                    marginBottom: '14px', 
                    flexWrap: 'wrap',
                    width: '100%',
                  }}>
                    {/* Search Input (Dominant: ~35%) */}
                    <div style={{ flex: '3.5 1 260px', minWidth: '220px' }}>
                      <Input
                        prefix={<SearchOutlined style={{ color: '#94A3B8', fontSize: 14 }} />}
                        placeholder="Cari Tender ID, Project, Customer, atau PIC..."
                        value={tableSearchQuery}
                        onChange={(e) => setTableSearchQuery(e.target.value)}
                        allowClear
                        style={{
                          borderRadius: 8,
                          height: 38,
                          borderColor: '#CBD5E1',
                          fontSize: 13,
                          width: '100%',
                        }}
                      />
                    </div>

                    {/* Filter Stage (~15%) */}
                    <div style={{ flex: '1.4 1 130px', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Filter Stage</span>
                      <Select
                        value={tableSelectedStage}
                        onChange={setTableSelectedStage}
                        style={{ width: '100%', height: 38 }}
                        options={[
                          { value: 'ALL', label: 'Semua Stage' },
                          { value: 'LEAD', label: 'LEAD' },
                          { value: 'WAITING_GO_NO_GO', label: 'WAITING GO/NO-GO' },
                          { value: 'QUALIFICATION', label: 'QUALIFICATION' },
                          { value: 'PROPOSAL', label: 'PROPOSAL' },
                          { value: 'NEGOTIATION', label: 'NEGOTIATION' },
                          { value: 'WON', label: 'WON' },
                          { value: 'LOST', label: 'LOST' },
                        ]}
                      />
                    </div>

                    {/* Filter Customer (~17%) */}
                    <div style={{ flex: '1.7 1 150px', minWidth: '135px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Filter Customer</span>
                      <Select
                        value={tableSelectedCustomer}
                        onChange={setTableSelectedCustomer}
                        style={{ width: '100%', height: 38 }}
                        options={[
                          { value: 'ALL', label: 'Semua Customer' },
                          ...tableCustomerOptions.map((cust) => ({ value: cust, label: cust })),
                        ]}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </div>

                    {/* Filter PIC (~15%) */}
                    <div style={{ flex: '1.4 1 130px', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Filter PIC</span>
                      <Select
                        value={tableSelectedPic}
                        onChange={setTableSelectedPic}
                        style={{ width: '100%', height: 38 }}
                        options={[
                          { value: 'ALL', label: 'Semua PIC' },
                          ...tablePicOptions.map((pic) => ({ value: pic, label: pic })),
                        ]}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </div>

                    {/* Reset Filter Button (~11%) */}
                    <div style={{ flex: '1.1 1 105px', minWidth: '100px' }}>
                      <Button
                        icon={<ReloadOutlined style={{ fontSize: 13 }} />}
                        onClick={handleResetTableFilters}
                        style={{
                          width: '100%',
                          borderRadius: 8,
                          height: 38,
                          borderColor: '#CBD5E1',
                          color: '#334155',
                          fontWeight: 500,
                          fontSize: 13,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Reset Filter
                      </Button>
                    </div>
                  </div>

                  <Table 
                    dataSource={filteredTableTenders} 
                    columns={tenderColumns} 
                    rowKey="id" 
                    scroll={{ x: 1420 }}
                    pagination={{ 
                      pageSize: 10, 
                      position: ['bottomRight'],
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '25', '50', '100'],
                      showTotal: (total, range) => `Menampilkan ${range[0]}-${range[1]} dari ${total} tender`
                    }} 
                    loading={isLoadingQuery} 
                    rowClassName={() => 'modern-table-row'}
                    locale={{
                      emptyText: (
                        <Empty 
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <Space direction="vertical" size={4}>
                              <Text strong style={{ color: '#475569' }}>
                                {tableSearchQuery || tableSelectedStage !== 'ALL' || tableSelectedCustomer !== 'ALL' || tableSelectedPic !== 'ALL'
                                  ? 'Tidak Ada Hasil yang Cocok'
                                  : 'Belum Ada Data Tender'}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {tableSearchQuery || tableSelectedStage !== 'ALL' || tableSelectedCustomer !== 'ALL' || tableSelectedPic !== 'ALL'
                                  ? 'Tidak ditemukan tender yang cocok dengan kriteria pencarian dan filter Anda.'
                                  : 'Gunakan tombol "+ Input Tender" untuk menambahkan tender baru.'}
                              </Text>
                              {(tableSearchQuery || tableSelectedStage !== 'ALL' || tableSelectedCustomer !== 'ALL' || tableSelectedPic !== 'ALL') && (
                                <Button size="small" onClick={handleResetTableFilters} style={{ marginTop: 8 }}>
                                  Reset Filter
                                </Button>
                              )}
                            </Space>
                          }
                          style={{ margin: '32px 0' }}
                        />
                      )
                    }}
                  />
                  <style>{`
                    .modern-table-row:hover > td {
                      background-color: #F8FAFC !important;
                      cursor: pointer;
                    }
                    .modern-table-row > td {
                      border-bottom: 1px solid #F1F5F9;
                      padding: 13px 16px !important;
                      font-size: 13px;
                      vertical-align: middle !important;
                    }
                    .ant-table-thead > tr > th {
                      background-color: #F8FAFC !important;
                      color: #475569 !important;
                      font-weight: 600 !important;
                      font-size: 12px;
                      letter-spacing: 0.3px;
                      border-bottom: 1px solid #E2E8F0 !important;
                      padding: 13px 16px !important;
                      white-space: nowrap;
                    }
                    .ant-table-thead > tr > th::before {
                      display: none !important;
                    }
                    .ant-table {
                      border-radius: 10px;
                      overflow: hidden;
                      border: 1px solid #E2E8F0;
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
                scroll={{ x: 950 }}
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

      {/* TENDER DETAIL DRAWER (Shared Canonical Implementation) */}
      <TenderDetailDrawer
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedTenderForDetail(null);
        }}
        tender={selectedTenderForDetail}
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
