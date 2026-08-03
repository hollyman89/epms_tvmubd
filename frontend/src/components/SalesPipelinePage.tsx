"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, Table, Typography, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Tag, message, Row, Col, Card, Spin, Skeleton, Space, Tooltip, Dropdown, Radio, Steps, Avatar, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { RocketOutlined, AuditOutlined, RightOutlined, CheckCircleOutlined, CloseCircleOutlined, MoreOutlined, ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, UserOutlined, CalendarOutlined, BankOutlined, FolderOpenOutlined, RightCircleFilled, PieChartOutlined, ClockCircleOutlined, ArrowRightOutlined, InfoCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Line, Pie, Area, Funnel } from '@ant-design/charts';
import CountUp from 'react-countup';
import { io } from 'socket.io-client';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './SalesPipelinePage.module.css';
import { KanbanBoard } from './KanbanBoard';
import type { DashboardAnalyticsResponse } from '../types/analytics';
import { useTendersQuery } from '../hooks/useTendersQuery';
import { apiClient } from '@/lib/axios';
import { AuthService } from '@/services/auth.service';
import { queryClient, updateAllTenderCaches } from '../lib/queryClient';

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
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const canReview = userRoles.includes('SUPER_ADMIN') || userRoles.includes('LEGAL');

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || '1');

  useEffect(() => {
    if (tabParam === '3') {
      router.replace('/project-delivery');
    } else if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam, router]);

  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState('kanban');
  const [periodFilter, setPeriodFilter] = useState('all');
  
  // Priority 1: React Query as Single Source of Truth
  const { data: reactQueryTenders = [], isLoading: isLoadingQuery } = useTendersQuery({ period: periodFilter });
  const activeTendersData = reactQueryTenders;

  // DETEKTIF: Cek siapa yang dipakai UI
  if (typeof window !== 'undefined') {
    console.log("🔍 SUMBER DATA UI:", {
      pakaiReactQuery: true,
      panjangDataReactQuery: reactQueryTenders?.length || 0,
      isiPertama: reactQueryTenders?.[0]?.title || "KOSONG"
    });
  }

  // 1. EKSPOS QueryClient ke window untuk debugging
  if (typeof window !== 'undefined') {
    (window as any).__queryClient = queryClient;
  }



  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingContracts, setPendingContracts] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalyticsResponse | null>(null);
  const [analyticsPeriodFilter, setAnalyticsPeriodFilter] = useState('YEAR_TO_DATE');
  
  // Loading States
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modals state
  const [isTenderModalVisible, setIsTenderModalVisible] = useState(false);
  const [isLegalModalVisible, setIsLegalModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [isCustomSector, setIsCustomSector] = useState(false);
  const [isCustomSource, setIsCustomSource] = useState(false);
  
  const [form] = Form.useForm();
  const [legalForm] = Form.useForm();

  useEffect(() => {
    fetchCustomers();
    fetchUsers();
    if (activeTab === '1') {
      fetchDashboardSummary();
    } else if (activeTab === '2') {
      fetchPendingContracts();
    } else if (activeTab === '4') {
      fetchAnalyticsData(analyticsPeriodFilter);
    }


  }, [activeTab, periodFilter, analyticsPeriodFilter]);

  const handleNext = async () => {
    try {
      const values = await form.validateFields(['projectName', 'estimatedBudget', 'customerId', 'expectedClosingDate', 'bidSubmissionDeadline']);
      
      const errors: string[] = [];

      if (values.estimatedBudget <= 0) {
        errors.push('Estimated Budget harus lebih besar dari 0.');
      }

      const today = dayjs().startOf('day');
      const closingDate = dayjs(values.expectedClosingDate).startOf('day');
      const bidDeadline = dayjs(values.bidSubmissionDeadline).startOf('day');

      if (closingDate.isBefore(today) || bidDeadline.isBefore(today)) {
        errors.push('Tanggal tidak boleh kurang dari hari ini.');
      }

      if (bidDeadline.isAfter(closingDate)) {
        errors.push('Batas Kirim Penawaran harus sebelum atau sama dengan Tanggal Closing.');
      }

      if (errors.length > 0) {
        errors.forEach(err => message.error(err));
        return;
      }

      setCurrentStep(currentStep + 1);
    } catch (error) {
      message.error('Harap lengkapi semua field wajib bertanda bintang merah (*).');
    }
  };

  /**
   * Fetch dashboard analytics data from API
   * @param period - Time period filter (e.g., 'YEAR_TO_DATE', 'LAST_MONTH')
   * @returns Promise<void>
   */
  const fetchAnalyticsData = async (period: string) => {
    setLoadingAnalytics(true);
    try {
      const res = await apiClient.get(`/analytics/dashboard?period=${period}`);
      // Response structure: { meta: {...}, data: { status, data: { kpi, trendLine, ... } } }
      setAnalyticsData(res.data?.data?.data || res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      // Fallback or empty state will handle null data gracefully
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchDashboardSummary = async () => {
    setLoadingDashboard(true);
    try {
      const url = periodFilter === 'all' 
        ? '/marketing/dashboard/summary'
        : `/marketing/dashboard/summary?period=${periodFilter}`;
        
      const res = await apiClient.get(url);
      setDashboardSummary(res.data.data || res.data); // Adjust based on your API wrapper
    } catch (err) {
      console.error('Failed to fetch dashboard summary', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

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
  const computeLineChartData = () => {
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
  };

  const computePieChartData = () => {
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
  };

  const computeActionItems = () => {
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
  };

  const actionItemsColumns = [
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
                  ⚠️ LEWAT JATUH TEMPO ({daysOverdue}d)
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
  ];

  const fetchCustomers = async () => {
    try {
      const res = await apiClient.get('/marketing/customers');
      setCustomers(res.data.data || res.data);
    } catch (err) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/marketing/pics');
      setUsers(res.data.data || res.data);
    } catch (err) {}
  };

  const fetchPendingContracts = async () => {
    try {
      const res = await apiClient.get('/legal/contracts/pending');
      setPendingContracts(res.data.data || res.data);
    } catch (err) {}
  };

  const handleCustomerChange = (customerId: number) => {
    const selectedCustomer: any = customers.find((c: any) => c.id === customerId);
    if (selectedCustomer) {
      const isCustomSector = selectedCustomer.business_sector && !BUSINESS_SECTORS.includes(selectedCustomer.business_sector);
      setIsCustomSector(!!isCustomSector);

      form.setFieldsValue({
        picCustomerName: selectedCustomer.contact_person,
        picCustomerPhone: selectedCustomer.phone,
        picCustomerEmail: selectedCustomer.email,
        businessSectorSelect: isCustomSector ? 'Lainnya' : selectedCustomer.business_sector,
        businessSectorCustom: isCustomSector ? selectedCustomer.business_sector : undefined,
      });
    }
  };

  const handleCreateTender = async (values: any) => {
    setIsSubmitting(true);
    const hide = message.loading('Saving opportunity...', 0);
    try {
      const payload = {
        customerId: Number(values.customerId),
        projectName: values.projectName,
        marketingPicId: values.marketingPicId ? Number(values.marketingPicId) : undefined,
        picCustomerName: values.picCustomerName,
        picCustomerPhone: values.picCustomerPhone,
        picCustomerEmail: values.picCustomerEmail,
        businessSector: values.businessSectorSelect === 'Lainnya' 
          ? values.businessSectorCustom 
          : values.businessSectorSelect,
        stage: values.stage || 'LEAD',
        probabilityPercentage: values.probabilityPercentage || 0,
        priority: values.priority || 'MEDIUM',
        source: values.sourceSelect === 'Lainnya' ? values.sourceCustom : values.sourceSelect,
        notes: values.notes,
        estimatedBudget: values.estimatedBudget,
        expectedClosingDate: values.expectedClosingDate ? values.expectedClosingDate.toISOString() : undefined,
        procurementType: values.procurementType || 'TENDER',
        projectLocation: values.projectLocation,
        bidSubmissionDeadline: values.bidSubmissionDeadline ? values.bidSubmissionDeadline.toISOString() : undefined
      };

      console.log("Payload yang dikirim ke Backend:", payload);

      await apiClient.post('/marketing/tenders', payload);
      hide();
      message.success('Tender berhasil dibuat!');
      setIsTenderModalVisible(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['tenders'] });
      fetchDashboardSummary(); // Refresh KPI cards
    } catch (err: any) {
      hide();
      const errMsg = err.response?.data?.message || 'Error creating opportunity';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTenderStatus = async (id: number, status: string) => {
    try {
      const stage = status === 'WON' ? 'Won' : status === 'LOST' ? 'Lost' : status;
      await apiClient.patch(`/marketing/tenders/${id}/status`, { stage });
      message.success(`Tender stage updated`);
      queryClient.invalidateQueries({ queryKey: ['tenders'] });
      fetchDashboardSummary();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error updating tender');
    }
  };

  const handleLegalReview = async (values: any) => {
    try {
      await apiClient.post('/legal/contracts/review', {
        proposalId: selectedContract.proposal_id,
        legalStatus: values.legalStatus,
        legalNotes: values.legalNotes
      });
      message.success('Legal review submitted successfully');
      setIsLegalModalVisible(false);
      legalForm.resetFields();
      fetchPendingContracts();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error submitting review');
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
      title: 'Project', 
      key: 'project', 
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '4px 0' }}>
          <Avatar size={36} icon={<FolderOpenOutlined />} style={{ background: '#e0e7ff', color: '#4f46e5', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{record.title}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>ID: {record.id}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar size={24} icon={<BankOutlined />} style={{ background: '#f1f5f9', color: '#64748b' }} />
            <Text style={{ color: '#334155', fontWeight: 500 }}>{customerName}</Text>
          </div>
        );
      }
    },
    { 
      title: 'Value', 
      key: 'value', 
      render: (_: any, record: any) => {
        const val = Number(record.estimated_budget);
        let formattedVal = '';
        if (val >= 1000000000) {
          formattedVal = `Rp ${(val / 1000000000).toFixed(1)} M`;
        } else {
          formattedVal = `Rp ${val.toLocaleString('id-ID')}`;
        }
        return (
          <Text style={{ fontWeight: 700, color: '#10b981', fontSize: '14px' }}>{formattedVal}</Text>
        );
      }
    },
    { 
      title: 'Tahap (Stage)', 
      dataIndex: 'stage', 
      key: 'stage', 
      render: (stage: string, record: any) => {
        let bgColor = '#e0e7ff';
        let textColor = '#4338ca';
        
        switch (stage) {
          case 'WON':
            bgColor = '#dcfce7';
            textColor = '#166534';
            break;
          case 'LOST':
            bgColor = '#fee2e2';
            textColor = '#991b1b';
            break;
          case 'NEGOTIATION':
            bgColor = '#fef3c7';
            textColor = '#92400e';
            break;
          case 'PROPOSAL':
            bgColor = '#f3e8ff';
            textColor = '#6b21a8';
            break;
          case 'QUALIFICATION':
            bgColor = '#ccfbf1';
            textColor = '#115e59';
            break;
          case 'LEAD':
          default:
            bgColor = '#e0f2fe';
            textColor = '#075985';
            break;
        }

        return (
          <div style={{ 
            background: bgColor, 
            color: textColor, 
            padding: '4px 12px', 
            borderRadius: '9999px', 
            display: 'inline-flex',
            fontWeight: 600,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {stage || 'LEAD'}
          </div>
        );
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
            <Avatar size={28} style={{ background: '#3b82f6', fontSize: '13px', fontWeight: 600 }}>{initial}</Avatar>
            <Text style={{ color: '#475569', fontWeight: 500 }}>{picName}</Text>
          </div>
        );
      }
    },
    { 
      title: 'Expected Close', 
      dataIndex: 'expected_closing_date', 
      key: 'closeDate', 
      render: (date: string) => {
        if (!date) return <Text type="secondary">-</Text>;
        const dateObj = new Date(date);
        const isOverdue = dateObj < new Date();
        const formattedDate = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOverdue ? '#ef4444' : '#64748b' }}>
            <CalendarOutlined />
            <Text style={{ color: isOverdue ? '#ef4444' : '#475569', fontWeight: isOverdue ? 600 : 400 }}>{formattedDate}</Text>
          </div>
        );
      }
    },
    { 
      title: '', 
      key: 'action', 
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Tooltip title="Lihat Detail Proyek">
          <Button 
            shape="circle" 
            type="text" 
            icon={<RightCircleFilled style={{ color: '#94a3b8', fontSize: '24px' }} />} 
            onClick={() => router.push(`/sales/tenders/${record.id}`)}
            className="action-btn"
          />
        </Tooltip>
      )
    }
  ];

  const contractColumns = [
    { title: 'Project Name', dataIndex: 'title', key: 'title', render: (text: string, record: any) => <Text strong style={{ fontSize: 13, color: '#1f2329' }}>{text || record.project_name || record.name}</Text> },
    { title: 'Customer', key: 'customer', render: (text: any, record: any) => record.customer?.name || record.customerName || `ID: ${record.customer_id}` },
    { title: 'Harga Negosiasi', key: 'price', render: (text: any, record: any) => <Text style={{ fontWeight: 700, color: '#10b981', fontSize: 13 }}>Rp {Number(record.negotiated_price || record.estimated_budget || 0).toLocaleString('id-ID')}</Text> },
    { 
      title: 'Legal Status', 
      key: 'legal_status', 
      render: (_: any, record: any) => {
        const val = record.legal_status || record.spk_verification_status || 'UNVERIFIED';
        if (val === 'VERIFIED') return <Tag color="success" style={{ fontWeight: 700, borderRadius: 10 }}>VERIFIED ✅</Tag>;
        if (val === 'PENDING_REVIEW' || val === 'MENUNGGU_REVIEW') return <Tag color="warning" style={{ fontWeight: 600, borderRadius: 10 }}>MENUNGGU REVIEW ⏳</Tag>;
        if (val === 'REVISION_NEEDED') return <Tag color="error" style={{ fontWeight: 700, borderRadius: 10 }}>REVISI KONTRAK ❌</Tag>;
        if (val === 'REJECTED') return <Tag color="error" style={{ fontWeight: 700, borderRadius: 10 }}>DITOLAK ❌</Tag>;
        if (val === 'PROJECT_STARTED') return <Tag color="processing" style={{ fontWeight: 700, borderRadius: 10 }}>PROYEK AKTIF 🚀</Tag>;
        return <Tag color="default" style={{ fontWeight: 500, borderRadius: 10 }}>{val}</Tag>;
      }
    },
    {
      title: 'Legal Reviewer',
      key: 'reviewer',
      render: (_: any, record: any) => {
        const name = record.legal_reviewer_name || record.reviewerName;
        return name ? <Text style={{ fontSize: 12, color: '#3b82f6' }}>👤 {name}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>Belum Di-assign</Text>;
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
        const isLegalRole = userRoles.includes('LEGAL') || userRoles.includes('LEGAL_REVIEWER') || userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

        if (status === 'UNVERIFIED' || status === 'DRAFT') {
          if (isMarketingRole) {
            return (
              <Button
                size="small"
                type="primary"
                style={{ backgroundColor: '#3b82f6', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
                onClick={async () => {
                  try {
                    await apiClient.patch(`/marketing/tenders/${record.id}/send-to-legal`, {});
                    message.success('Tender dikirim ke Legal & SPK siap dibuat!');
                    queryClient.invalidateQueries({ queryKey: ['tenders'] });
                  } catch (err: any) {
                    message.error(err.response?.data?.message || 'Gagal mengirim ke Legal');
                  }
                }}
              >
                Kirim ke Legal
              </Button>
            );
          }
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Belum Dikirim</Button>;
        }

        if (status === 'MENUNGGU_REVIEW' || status === 'PENDING_REVIEW') {
          if (isLegalRole) {
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
                        queryClient.invalidateQueries({ queryKey: ['tenders'] });
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
          return <Tag color="success" style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Siap Dikelola PMO ✅</Tag>;
        }

        if (status === 'REVISION_NEEDED') {
          if (isMarketingRole) {
            return <Button size="small" type="primary" danger style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }} onClick={() => router.push(`/marketing/tenders/${record.id}/edit-contract`)}>Revisi Kontrak</Button>;
          }
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Menunggu Revisi</Button>;
        }

        if (status === 'REJECTED') {
          return <Button size="small" danger style={{ borderRadius: 6, fontSize: 11 }} onClick={() => message.error(`Catatan Legal: ${record.legal_notes || record.spk_verification_notes || 'Silakan cek dengan tim Legal.'}`)}>Lihat Catatan</Button>;
        }

        if (status === 'PROJECT_STARTED') {
          return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Proyek Berjalan 🚀</Button>;
        }

        return <Button size="small" disabled style={{ borderRadius: 6, fontSize: 11 }}>Status Unknown</Button>;
    }}
  ];

  return (
    <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={3} style={{ margin: 0 }} className={styles.titleGradient}>
          {userRoles.includes('MARKETING') ? 'Sales Command Center' : 'Sales & Legal Pipeline'}
        </Title>
        {activeTab === '1' && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Radio.Group value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} optionType="button" buttonStyle="solid">
              <Radio.Button value="all">Semua Waktu</Radio.Button>
              <Radio.Button value="month">Bulan Ini</Radio.Button>
              <Radio.Button value="quarter">Kuartal Ini</Radio.Button>
              <Radio.Button value="year">Tahun Ini</Radio.Button>
            </Radio.Group>
            <Button type="primary" onClick={() => {
              form.resetFields();
              setIsCustomSector(false);
              setCurrentStep(0);
              setIsTenderModalVisible(true);
            }}>
              + Input Tender
            </Button>
          </div>
        )}
      </div>

      {activeTab === '1' && (
        <div style={{ marginBottom: '24px' }}>
          {loadingDashboard ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (() => {
            const kpis = computePremiumKpis();
            return (
            <Row gutter={[16, 16]} className={styles.kpiRibbon}>
              <Col xs={12} sm={6}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text className={styles.kpiTitle}>Total Tenders</Text>
                    {renderTrendBadge(kpis.count.growth)}
                  </div>
                  <div className={styles.kpiValue} style={{ color: '#1677ff' }}>
                    <CountUp preserveValue end={kpis.count.value} separator="." />
                  </div>
              </Col>
              
              <Col xs={12} sm={6}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text className={styles.kpiTitle}>Revenue Secured</Text>
                    {renderTrendBadge(kpis.won.growth)}
                  </div>
                  <div className={styles.kpiValue} style={{ color: '#52c41a' }}>
                    Rp <CountUp preserveValue end={kpis.won.value} separator="." />
                  </div>
              </Col>

              <Col xs={12} sm={6}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text className={styles.kpiTitle}>Active Pipeline</Text>
                    {renderTrendBadge(kpis.active.growth)}
                  </div>
                  <div className={styles.kpiValue} style={{ color: '#faad14' }}>
                    Rp <CountUp preserveValue end={kpis.active.value} separator="." />
                  </div>
              </Col>

              <Col xs={12} sm={6}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <Text className={styles.kpiTitle}>Win Rate</Text>
                      <Tooltip title="Weighted Revenue Win Rate">
                        <InfoCircleOutlined style={{ fontSize: 11, color: '#8f959e' }} />
                      </Tooltip>
                    </Space>
                    {renderTrendBadge(kpis.winRate.growth, true)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <div className={styles.kpiValue} style={{ color: '#eb2f96' }}>
                      <CountUp preserveValue end={kpis.winRate.value} decimals={1} />%
                    </div>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      (by count: {kpis.winRate.countValue}%)
                    </Text>
                  </div>
              </Col>
            </Row>
            );
          })()}

          {!loadingDashboard && computeActionItems().length > 0 && (
            <Card
              title={
                <Space size={8}>
                  <ClockCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
                  <Text strong style={{ fontSize: 13, color: '#1f2329' }}>
                    Tender yang Perlu Perhatian (Action Items)
                  </Text>
                  <Tooltip title="Diprioritaskan berdasarkan tender yang paling lama menunggu (FIFO Overdue)">
                    <InfoCircleOutlined style={{ color: '#8f959e', fontSize: 12, cursor: 'pointer' }} />
                  </Tooltip>
                </Space>
              }
              style={{
                borderRadius: 10,
                border: '1px solid #ffe7ba',
                boxShadow: '0 2px 8px rgba(250, 173, 20, 0.08)',
                marginTop: 24,
                marginBottom: 24,
                overflow: 'hidden',
              }}
              headStyle={{
                backgroundColor: '#fffbe6',
                borderBottom: '1px solid #ffe7ba',
                padding: '10px 16px',
              }}
              bodyStyle={{ padding: 0 }}
            >
              <Table 
                dataSource={computeActionItems()} 
                columns={actionItemsColumns} 
                rowKey="id" 
                pagination={false} 
                size="small"
              />
            </Card>
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
                    pagination={{ pageSize: 10, position: ['bottomRight'] }} 
                    loading={isLoadingQuery} 
                    rowClassName={() => 'modern-table-row'}
                    style={{ overflowX: 'auto' }}
                  />
                  <style>{`
                    .modern-table-row:hover > td {
                      background-color: #f8fafc !important;
                      cursor: pointer;
                    }
                    .modern-table-row > td {
                      border-bottom: 1px solid #f1f5f9;
                      padding: 16px 16px !important;
                    }
                    .ant-table-thead > tr > th {
                      background-color: #ffffff !important;
                      border-bottom: 2px solid #f1f5f9 !important;
                      color: #64748b !important;
                      font-weight: 600 !important;
                      text-transform: uppercase;
                      font-size: 12px;
                      letter-spacing: 0.5px;
                    }
                    .action-btn {
                      opacity: 0.4;
                      transition: all 0.3s ease;
                    }
                    .modern-table-row:hover .action-btn {
                      opacity: 1;
                      color: #3b82f6 !important;
                      transform: translateX(4px);
                    }
                  `}</style>
                </div>
              )}
            </div>
          )
        },
        {
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
        },
        {
          key: '4',
          label: <span><PieChartOutlined /> Analytics</span>,
          children: (
            <div style={{ marginTop: 16 }}>
              {/* Filter Area */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Radio.Group value={analyticsPeriodFilter} onChange={e => setAnalyticsPeriodFilter(e.target.value)} buttonStyle="solid">
                  <Radio.Button value="LAST_MONTH">Bulan Lalu</Radio.Button>
                  <Radio.Button value="THIS_MONTH">Bulan Ini</Radio.Button>
                  <Radio.Button value="THIS_QUARTER">Kuartal Ini</Radio.Button>
                  <Radio.Button value="YEAR_TO_DATE">Tahun Ini</Radio.Button>
                </Radio.Group>
              </div>

              {loadingAnalytics ? (
                <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                  <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                    <Col span={16}><Skeleton.Button active style={{ width: '100%', height: 300 }} /></Col>
                    <Col span={8}><Skeleton.Button active style={{ width: '100%', height: 300 }} /></Col>
                  </Row>
                </div>
              ) : analyticsData ? (
                <>
                  {/* KPI Cards */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Text type="secondary">Total Pipeline</Text>
                        <Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
                          Rp {(analyticsData.kpi?.totalPipeline || 0).toLocaleString('id-ID')}
                        </Title>
                        <Text type={analyticsData.kpi?.momGrowth >= 0 ? "success" : "danger"}>
                          {analyticsData.kpi?.momGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} 
                          {Math.abs(analyticsData.kpi?.momGrowth * 100).toFixed(1)}% dari bulan lalu
                        </Text>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Text type="secondary">Win Rate</Text>
                        <Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
                          {((analyticsData.kpi?.winRate || 0) * 100).toFixed(1)}%
                        </Title>
                        <Text type="secondary">
                          Dari total {analyticsData.kpi?.totalDeals || 0} Deals
                        </Text>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Text type="secondary">Avg Deal Size</Text>
                        <Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
                          Rp {(analyticsData.kpi?.avgDealSize || 0).toLocaleString('id-ID')}
                        </Title>
                        <Text type="secondary">Rata-rata per tender</Text>
                      </Card>
                    </Col>
                  </Row>

                  {/* Charts Grid */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={16}>
                      <Card title="Tren Pipeline 12 Bulan Terakhir" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <ChartErrorBoundary>
                          {analyticsData.trendLine?.length > 0 ? (
                            <Line 
                              data={analyticsData.trendLine || []} 
                              xField="month" 
                              yField="value"
                              smooth={true}
                              style={{ stroke: '#1677ff', lineWidth: 2 }}
                              axis={{
                                y: {
                                  labelFormatter: (v: any) => `Rp ${(Number(v) / 1000000000).toFixed(1)}M`
                                }
                              }}
                              tooltip={{
                                items: [
                                  {
                                    name: 'Total Pipeline',
                                    field: 'value',
                                    valueFormatter: (v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`
                                  }
                                ]
                              }}
                            />
                          ) : <EmptyChart />}
                        </ChartErrorBoundary>
                      </Card>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Card title="Distribusi Pipeline per Sektor" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
                        <ChartErrorBoundary>
                          {analyticsData.sectorDistribution?.filter((item: any) => Number(item.value) > 0)?.length > 0 ? (
                            <Pie 
                              data={analyticsData.sectorDistribution.filter((item: any) => Number(item.value) > 0)} 
                              angleField="value" 
                              colorField="sector" 
                              radius={0.8}
                              innerRadius={0.6}
                              label={{
                                text: (datum: any) => datum.value > 0 ? `${datum.sector}\n${datum.percentage}%` : '',
                                style: { fontSize: 11, textAlign: 'center' }
                              }}
                              tooltip={{
                                items: [
                                  {
                                    name: 'Nilai',
                                    field: 'value',
                                    valueFormatter: (v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`
                                  }
                                ]
                              }}
                              legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                            />
                          ) : <EmptyChart />}
                        </ChartErrorBoundary>
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="Sales Funnel Conversion" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <ChartErrorBoundary>
                          {analyticsData.funnel?.length > 0 ? (
                            (() => {
                              const stageLabelMap: Record<string, string> = {
                                LEAD: 'Prospek', QUALIFICATION: 'Kualifikasi',
                                PROPOSAL: 'Proposal', NEGOTIATION: 'Negosiasi', WON: 'Menang'
                              };
                              const funnelData = analyticsData.funnel.map((item: any) => ({
                                ...item,
                                stage: stageLabelMap[item.stage] || item.stage
                              }));
                              return (
                                <Funnel
                                  data={funnelData}
                                  xField="stage"
                                  yField="count"
                                  dynamicHeight={true}
                                />
                              );
                            })()
                          ) : <EmptyChart />}
                        </ChartErrorBoundary>
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="AI Executive Summary" bordered={false} style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', background: '#f8faff', height: '100%' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <RocketOutlined style={{ fontSize: 24, color: '#1677ff' }} />
                          <div>
                            <Paragraph style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>
                              {analyticsData.insights?.topInsight || "Memuat insight..."}
                            </Paragraph>
                            <Paragraph type="warning" style={{ margin: 0 }}>
                              <ExclamationCircleOutlined /> {analyticsData.insights?.warningInsight || "-"}
                            </Paragraph>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </>
              ) : (
                <EmptyChart />
              )}
            </div>
          )
        }
      ]} />

      {/* CREATE TENDER MODAL */}
      <Modal 
        title="Create Marketing Opportunity" 
        open={isTenderModalVisible} 
        onCancel={() => {
          setIsTenderModalVisible(false);
          setCurrentStep(0);
        }} 
        width={800}
        footer={[
          <Button key="back" onClick={() => setIsTenderModalVisible(false)}>
            Cancel
          </Button>,
          currentStep > 0 && (
            <Button key="prev" onClick={() => setCurrentStep(currentStep - 1)}>
              Previous
            </Button>
          ),
          currentStep < 1 && (
            <Button key="next" type="primary" onClick={handleNext}>
              Next
            </Button>
          ),
          currentStep === 1 && (
            <Button key="submit" type="primary" onClick={() => form.submit()} loading={isSubmitting} disabled={isSubmitting}>
              Create Opportunity
            </Button>
          ),
        ].filter(Boolean)}
      >
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          <Steps.Step title="Project Basic Info" />
          <Steps.Step title="Technical Details" />
        </Steps>

        <Form form={form} layout="vertical" onFinish={handleCreateTender}>
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="projectName" label="Project Name" rules={[{ required: true, message: 'Please enter project name' }]}>
                  <Input placeholder="e.g. IT Infrastructure Project 2026" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="estimatedBudget" label="Estimated Budget (Rp)" rules={[{ required: true }]}>
                  <InputNumber 
                    style={{ width: '100%' }} 
                    addonBefore="Rp"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={value => value!.replace(/\./g, '') as any}
                    onKeyPress={(event) => {
                      if (!/[0-9]/.test(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    placeholder="150.000.000"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="customerId" label="Customer" rules={[{ required: true }]}>
                  <Select placeholder="Select Customer" showSearch optionFilterProp="children" onChange={handleCustomerChange}>
                    {customers.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="marketingPicId" label="Marketing PIC">
                  <Select placeholder="Select PIC (Optional, defaults to you)" showSearch optionFilterProp="children" allowClear>
                    {users.map((u: any) => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="expectedClosingDate" label="Expected Closing Date" rules={[{ required: true, message: 'Harap isi tanggal' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="bidSubmissionDeadline" label="Bid Submission Deadline" rules={[{ required: true, message: 'Harap isi deadline' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                  <Select>
                    <Option value="LOW">Low</Option>
                    <Option value="MEDIUM">Medium</Option>
                    <Option value="HIGH">High</Option>
                    <Option value="CRITICAL">Critical</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="procurementType" label="Procurement Type" initialValue="TENDER">
                  <Select>
                    <Option value="TENDER">Tender</Option>
                    <Option value="DIRECT_APPOINTMENT">Direct Appointment</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="picCustomerName" label="PIC Customer Name">
                  <Input placeholder="e.g. Budi Santoso" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="picCustomerPhone" label="PIC Customer Phone">
                  <Input placeholder="e.g. 08123456789" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Business Sector" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', width: '100%' }}>
                    <Form.Item name="businessSectorSelect" style={{ width: isCustomSector ? '40%' : '100%', margin: 0 }}>
                      <Select 
                        showSearch 
                        placeholder="Select Sector" 
                        dropdownMatchSelectWidth={false}
                        popupMatchSelectWidth={false}
                        onChange={(val) => setIsCustomSector(val === 'Lainnya')}
                      >
                        {BUSINESS_SECTORS.map(sector => (
                          <Option key={sector} value={sector}>{sector}</Option>
                        ))}
                        <Option value="Lainnya">Lainnya</Option>
                      </Select>
                    </Form.Item>
                    {isCustomSector && (
                      <Form.Item name="businessSectorCustom" style={{ width: '60%', margin: 0, paddingLeft: '8px' }} rules={[{ required: true, message: 'Harap diisi' }]}>
                        <Input placeholder="Ketik sektor lain" />
                      </Form.Item>
                    )}
                  </div>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Source (Asal Prospek)" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', width: '100%' }}>
                    <Form.Item name="sourceSelect" initialValue="LPSE" style={{ width: isCustomSource ? '40%' : '100%', margin: 0 }}>
                      <Select onChange={(val) => setIsCustomSource(val === 'Lainnya')}>
                        <Option value="LPSE">LPSE / e-Procurement</Option>
                        <Option value="Referensi Internal">Referensi Internal</Option>
                        <Option value="Referensi Eksternal">Referensi Eksternal</Option>
                        <Option value="Direct Call / Email">Direct Call / Email</Option>
                        <Option value="Website / Social Media">Website / Social Media</Option>
                        <Option value="Lainnya">Lainnya</Option>
                      </Select>
                    </Form.Item>
                    {isCustomSource && (
                      <Form.Item name="sourceCustom" style={{ width: '60%', margin: 0, paddingLeft: '8px' }} rules={[{ required: true, message: 'Harap diisi' }]}>
                        <Input placeholder="Ketik sumber lain" />
                      </Form.Item>
                    )}
                  </div>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="projectLocation" label="Project Location">
                  <Input placeholder="e.g. Jakarta Selatan" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="notes" label="Notes">
                  <TextArea rows={3} placeholder="Additional details about this opportunity..." />
                </Form.Item>
              </Col>
            </Row>
          </div>
        </Form>
      </Modal>

      {/* LEGAL REVIEW MODAL */}
      <Modal title="Legal Contract Review" open={isLegalModalVisible} onCancel={() => setIsLegalModalVisible(false)} onOk={() => legalForm.submit()}>
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
          <p><strong>Contract No:</strong> {selectedContract?.contract_number}</p>
          <p><strong>Customer:</strong> {selectedContract?.customer?.name}</p>
          <p><strong>Proposal Amount:</strong> Rp {selectedContract?.proposal?.proposed_amount || 0}</p>
        </div>
        <Form form={legalForm} layout="vertical" onFinish={handleLegalReview}>
          <Form.Item name="legalStatus" label="Legal Decision" rules={[{ required: true }]}>
            <Select>
              <Option value="APPROVED">APPROVE Contract</Option>
              <Option value="REJECTED">REJECT Contract</Option>
              <Option value="ON_REVIEW">KEEP on Review</Option>
            </Select>
          </Form.Item>
          <Form.Item name="legalNotes" label="Legal Notes (Optional)">
            <TextArea rows={4} placeholder="Type any feedback or clauses to revise..." />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};
