'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Progress,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  notification,
  Badge,
  Dropdown,
  Tooltip,
  Alert,
  Spin,
  Empty,
} from 'antd';
import {
  ProjectOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RiseOutlined,
  LineChartOutlined,
  EyeOutlined,
  CalculatorOutlined,
  ApartmentOutlined,
  MoreOutlined,
  AppstoreOutlined,
  RollbackOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  BankOutlined,
  RocketOutlined,
  CheckCircleFilled,
  SearchOutlined,
  FilterOutlined,
  FileTextOutlined,
  EditOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  CheckSquareOutlined,
  ExclamationCircleFilled,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserIdentityDisplay from '@/components/common/UserIdentityDisplay';
import {
  resolvePmIdentity,
  resolveMarketingIdentity,
  getKickoffQueueStatusTags,
  resolveNextAction,
  ChipTone,
} from './project/kickoff-queue.utils';
import {
  resolvePlanVsActual,
  resolveSchedule,
  resolveOperationalHealth,
  resolveActiveNextAction,
} from './project/operational-control.utils';
import { ProjectService, ProcurementService, EligiblePmItem, OperationalBoardData } from '@/services';
import { WorkflowEngineService } from '@/services/workflowEngine.service';
import dynamic from 'next/dynamic';
import { useAuth } from '../context/AuthContext';

const ProjectDetailDrawer = dynamic(
  () => import('./project/ProjectDetailDrawer').then((m) => m.ProjectDetailDrawer),
  { ssr: false }
);
const PmCostEstimationModal = dynamic(
  () => import('./project/PmCostEstimationModal').then((m) => m.PmCostEstimationModal),
  { ssr: false }
);
const WbsTreeTableModal = dynamic(
  () => import('./project/WbsTreeTableModal').then((m) => m.WbsTreeTableModal),
  { ssr: false }
);
const PmOperationalPlanModal = dynamic(
  () => import('./project/PmOperationalPlanModal').then((m) => m.PmOperationalPlanModal),
  { ssr: false }
);
const PmProcurementPackageModal = dynamic(
  () => import('./project/PmProcurementPackageModal').then((m) => m.PmProcurementPackageModal),
  { ssr: false }
);
const PmServiceClaimVerificationModal = dynamic(
  () => import('./project/PmServiceClaimVerificationModal').then((m) => m.PmServiceClaimVerificationModal),
  { ssr: false }
);

const ProjectWorkspace = dynamic(
  () => import('./project/ProjectWorkspace').then((m) => m.ProjectWorkspace),
  { ssr: false }
);
import { detectCircularDependencies, ScheduleTaskItem } from './project/ScheduleGanttTab';
import { getInitialCondition, isInitialConditionComplete } from './project/ProjectInitialConditionModal';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercentage,
  formatQuantity,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import styles from './ProjectOperationTab.module.css';

const { Title, Text } = Typography;

export interface ProjectCharter {
  id: number;
  contractId?: number;
  projectId?: number;
  tender_id: number;
  project_code: string;
  project_name: string;
  customerName: string | null;
  contract_total_value: number | null;
  project_budget?: number | null;
  marketingName?: string | null;
  pmName?: string | null;
  managerId?: number | null;
  manager?: { id: number; fullName: string; email: string } | null;
  projectManagerId?: number | null;
  project_manager_id?: number | null;
  status: 'PENDING_KICKOFF' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | string;
  projectStatus?: string;
  startDate?: string | null;
  endDate?: string | null;
  actualKickoffDate?: string | null;
  actualFinishAt?: string | null;
  closedAt?: string | null;
  closureStatus?: string | null;
  created_at?: string;
  overallProgress?: number;
  healthStatus?: 'ON_TRACK' | 'AT_RISK' | 'CRITICAL';
  siteName?: string;
  city?: string;
  province?: string;
  address?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  operationalPlanStatus?: string;
  handoverStatus?: string;
  readiness?: any;
  plannedStart?: string | null;
  control?: any;
}

export interface ProjectOperationTabProps {
  refreshTrigger?: number;
}

export type ProjectReadinessEntry =
  | { status: 'SUCCESS'; data: any }
  | { status: 'ERROR'; error?: any; message?: string };

export const ProjectOperationTab: React.FC<ProjectOperationTabProps> = ({ refreshTrigger = 0 }) => {
  const { user, isProjectManager, isSuperAdmin } = useAuth();
  const isPmoUser = React.useMemo(() => {
    const roles = (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
    return roles.includes('PMO');
  }, [user]);
  const isDirectorUser = React.useMemo(() => {
    const roles = (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
    return roles.includes('DIRECTOR') || roles.includes('GENERAL_MANAGER') || roles.includes('HEAD_OF_OPERATIONS');
  }, [user]);
  const userRoles = React.useMemo(() => {
    return (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  }, [user]);

  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('projectId');
  const contractIdParam = searchParams.get('contractId');
  const actionParam = searchParams.get('action');
  const viewParam = searchParams.get('view');
  const serviceClaimIdParam =
    searchParams.get('serviceClaimId') ||
    (!searchParams.has('progressClaimId') && searchParams.get('section') !== 'tasks'
      ? searchParams.get('claimId')
      : null);
  const autoOpenedPlanRef = useRef<string | null>(null);
  const autoOpenedAssignRef = useRef<string | null>(null);
  const autoOpenedClaimRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('1');
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState<number | null>(null);
  const [selectedWorkspaceSection, setSelectedWorkspaceSection] = useState<'overview' | 'tasks' | 'monitoring' | 'gantt' | 'issue-risk' | 'closure'>('overview');

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('tab') !== key) {
        currentUrl.searchParams.set('tab', key);
        currentUrl.searchParams.delete('subtab');
        window.history.pushState({}, '', currentUrl.toString());
      }
    }
  }, []);

  useEffect(() => {
    const syncTabFromUrl = () => {
      let rawVal: string | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        rawVal = urlParams.get('tab') || urlParams.get('subtab');
      }
      if (!rawVal) {
        rawVal = searchParams.get('tab') || searchParams.get('subtab');
      }
      if (!rawVal) {
        setActiveTab('1');
        return;
      }
      const tabVal = rawVal.toLowerCase().trim();
      if (tabVal === '1' || tabVal === 'waiting' || tabVal === 'kickoff' || tabVal === 'antrean') {
        setActiveTab('1');
      } else if (tabVal === '2' || tabVal === 'active' || tabVal === 'berjalan') {
        setActiveTab('2');
      } else if (tabVal === '3' || tabVal === 'completed' || tabVal === 'selesai' || tabVal === 'closed') {
        setActiveTab('3');
      }
    };

    syncTabFromUrl();

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', syncTabFromUrl);
      return () => {
        window.removeEventListener('popstate', syncTabFromUrl);
      };
    }
  }, [searchParams]);

  useEffect(() => {
    const sectionParam = searchParams.get('section') as any;
    if (viewParam === 'workspace' && projectIdParam) {
      const pid = parseInt(projectIdParam, 10);
      if (!isNaN(pid) && pid > 0) {
        setSelectedWorkspaceProjectId(pid);
        const validSections = ['overview', 'tasks', 'monitoring', 'gantt', 'issue-risk', 'closure'];
        setSelectedWorkspaceSection(validSections.includes(sectionParam) ? sectionParam : 'overview');
      }
    } else if ((viewParam === 'tasks' || viewParam === 'task-board') && projectIdParam) {
      const pid = parseInt(projectIdParam, 10);
      if (!isNaN(pid) && pid > 0) {
        setSelectedWorkspaceProjectId(pid);
        setSelectedWorkspaceSection('tasks');
        if (typeof window !== 'undefined') {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('view', 'workspace');
          currentUrl.searchParams.set('projectId', String(pid));
          currentUrl.searchParams.set('section', 'tasks');
          window.history.replaceState({}, '', currentUrl.toString());
        }
      }
    } else if ((viewParam === 'monitoring' || viewParam === 'progress-monitoring') && projectIdParam) {
      const pid = parseInt(projectIdParam, 10);
      if (!isNaN(pid) && pid > 0) {
        setSelectedWorkspaceProjectId(pid);
        setSelectedWorkspaceSection('monitoring');
        if (typeof window !== 'undefined') {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('view', 'workspace');
          currentUrl.searchParams.set('projectId', String(pid));
          currentUrl.searchParams.set('section', 'monitoring');
          window.history.replaceState({}, '', currentUrl.toString());
        }
      }
    } else if ((viewParam === 'gantt' || viewParam === 'project-gantt') && projectIdParam) {
      const pid = parseInt(projectIdParam, 10);
      if (!isNaN(pid) && pid > 0) {
        setSelectedWorkspaceProjectId(pid);
        setSelectedWorkspaceSection('gantt');
        if (typeof window !== 'undefined') {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('view', 'workspace');
          currentUrl.searchParams.set('projectId', String(pid));
          currentUrl.searchParams.set('section', 'gantt');
          window.history.replaceState({}, '', currentUrl.toString());
        }
      }
    } else if ((viewParam === 'issue-risk' || viewParam === 'issues') && projectIdParam) {
      const pid = parseInt(projectIdParam, 10);
      if (!isNaN(pid) && pid > 0) {
        setSelectedWorkspaceProjectId(pid);
        setSelectedWorkspaceSection('issue-risk');
        if (typeof window !== 'undefined') {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('view', 'workspace');
          currentUrl.searchParams.set('projectId', String(pid));
          currentUrl.searchParams.set('section', 'issue-risk');
          window.history.replaceState({}, '', currentUrl.toString());
        }
      }
    } else if (!viewParam && !projectIdParam) {
      setSelectedWorkspaceProjectId(null);
      setSelectedWorkspaceSection('overview');
    }
  }, [viewParam, projectIdParam, searchParams]);

  const queryClient = useQueryClient();

  // 1. Fetch Operational Board via TanStack Query
  const {
    data: boardData,
    isLoading: loading,
    isFetching: boardFetching,
  } = useQuery<OperationalBoardData>({
    queryKey: ['project', 'operational-board'],
    queryFn: () => ProjectService.getOperationalBoard(),
    staleTime: 60000,
  });

  // 2. Fetch Downstream PRs via TanStack Query
  const {
    data: allPrs = [],
  } = useQuery<any[]>({
    queryKey: ['procurement', 'prs'],
    queryFn: () => ProcurementService.getPurchaseRequests(),
    staleTime: 60000,
  });

  // Derive pending kickoff charters with role-scoping preserved
  const pendingKickoff = React.useMemo(() => {
    let pending: ProjectCharter[] = boardData?.pendingKickoff || [];
    const isManagement = isPmoUser || isSuperAdmin || isDirectorUser;
    if (!isManagement) {
      // Project Manager workspace should never display unassigned contracts
      pending = pending.filter((item: ProjectCharter) => {
        const pmId = item.managerId ?? item.projectManagerId ?? (item as any).project_manager_id;
        return pmId && Number(pmId) === Number(user?.sub);
      });
    }
    return pending;
  }, [boardData?.pendingKickoff, isPmoUser, isSuperAdmin, isDirectorUser, user?.sub]);

  const [searchText, setSearchText] = useState<string>('');

  // Filtered pending kickoff by search query (project, code, client, PM, marketing)
  const filteredPendingKickoff = React.useMemo(() => {
    if (!searchText.trim()) return pendingKickoff;
    const q = searchText.toLowerCase().trim();
    return pendingKickoff.filter((item: ProjectCharter) => {
      const pName = (item.project_name || '').toLowerCase();
      const pCode = (item.project_code || '').toLowerCase();
      const cName = (item.customerName || '').toLowerCase();
      const pm = resolvePmIdentity(item).name.toLowerCase();
      const mkt = resolveMarketingIdentity(item).name.toLowerCase();
      return (
        pName.includes(q) ||
        pCode.includes(q) ||
        cName.includes(q) ||
        pm.includes(q) ||
        mkt.includes(q)
      );
    });
  }, [pendingKickoff, searchText]);

  // Derive active projects
  // Derive active projects (Excludes CLOSED projects by canonical operational lifecycle rule)
  const activeProjects = React.useMemo(() => {
    const list = boardData?.activeProjects || [];
    return list.filter(
      (item: ProjectCharter) =>
        item.status !== 'CLOSED' &&
        (item as any).projectStatus !== 'CLOSED'
    );
  }, [boardData?.activeProjects]);

  // Derive completed projects (Proyek Selesai: status = CLOSED)
  const completedProjects = React.useMemo(() => {
    if (boardData?.completedProjects && boardData.completedProjects.length > 0) {
      return boardData.completedProjects;
    }
    // Fallback: extract closed projects if present in boardData.activeProjects
    const activeList = boardData?.activeProjects || [];
    return activeList.filter(
      (item: ProjectCharter) =>
        item.status === 'CLOSED' ||
        (item as any).projectStatus === 'CLOSED'
    );
  }, [boardData?.completedProjects, boardData?.activeProjects]);

  // Filtered active projects by search query (project, code, client, PM, marketing)
  const filteredActiveProjects = React.useMemo(() => {
    if (!searchText.trim()) return activeProjects;
    const q = searchText.toLowerCase().trim();
    return activeProjects.filter((item: ProjectCharter) => {
      const pName = (item.project_name || '').toLowerCase();
      const pCode = (item.project_code || '').toLowerCase();
      const cName = (item.customerName || '').toLowerCase();
      const pm = resolvePmIdentity(item).name.toLowerCase();
      const mkt = resolveMarketingIdentity(item).name.toLowerCase();
      return (
        pName.includes(q) ||
        pCode.includes(q) ||
        cName.includes(q) ||
        pm.includes(q) ||
        mkt.includes(q)
      );
    });
  }, [activeProjects, searchText]);

  // Filtered completed projects by search query (project, code, client, PM, marketing)
  const filteredCompletedProjects = React.useMemo(() => {
    if (!searchText.trim()) return completedProjects;
    const q = searchText.toLowerCase().trim();
    return completedProjects.filter((item: ProjectCharter) => {
      const pName = (item.project_name || '').toLowerCase();
      const pCode = (item.project_code || '').toLowerCase();
      const cName = (item.customerName || '').toLowerCase();
      const pm = resolvePmIdentity(item).name.toLowerCase();
      const mkt = resolveMarketingIdentity(item).name.toLowerCase();
      return (
        pName.includes(q) ||
        pCode.includes(q) ||
        cName.includes(q) ||
        pm.includes(q) ||
        mkt.includes(q)
      );
    });
  }, [completedProjects, searchText]);

  // Derive selected workspace project
  const currentWorkspaceProject = React.useMemo(() => {
    if (!selectedWorkspaceProjectId) return null;
    return (
      activeProjects.find(
        (p: any) =>
          Number(p.id) === selectedWorkspaceProjectId ||
          Number(p.projectId) === selectedWorkspaceProjectId
      ) ||
      completedProjects.find(
        (p: any) =>
          Number(p.id) === selectedWorkspaceProjectId ||
          Number(p.projectId) === selectedWorkspaceProjectId
      ) ||
      pendingKickoff.find(
        (p: any) =>
          Number(p.id) === selectedWorkspaceProjectId ||
          Number(p.projectId) === selectedWorkspaceProjectId
      ) ||
      null
    );
  }, [selectedWorkspaceProjectId, activeProjects, completedProjects, pendingKickoff]);

  const handleOpenProjectWorkspace = useCallback((
    record: ProjectCharter,
    section: 'overview' | 'tasks' | 'monitoring' | 'gantt' | 'issue-risk' | 'closure' = 'overview'
  ) => {
    const pid = Number(record.id || record.projectId);
    setSelectedWorkspaceProjectId(pid);
    setSelectedWorkspaceSection(section);
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('view', 'workspace');
      currentUrl.searchParams.set('projectId', String(pid));
      currentUrl.searchParams.set('section', section);
      window.history.pushState({}, '', currentUrl.toString());
    }
  }, []);

  // Populate readinessMap directly from board projection
  const readinessMap = React.useMemo(() => {
    const initialMap: Record<number, ProjectReadinessEntry> = {};
    for (const p of [...pendingKickoff, ...activeProjects, ...completedProjects]) {
      const pid = p.projectId ? Number(p.projectId) : 0;
      if (pid > 0 && p.readiness) {
        initialMap[pid] = { status: 'SUCCESS', data: p.readiness };
      }
    }
    return initialMap;
  }, [pendingKickoff, activeProjects, completedProjects]);

  // Populate projectPrMap directly from PR list
  const projectPrMap = React.useMemo(() => {
    const prMap: Record<number, any> = {};
    if (Array.isArray(allPrs)) {
      for (const pr of allPrs) {
        const prPid = Number(pr.projectId || pr.project_id || (pr as any).project?.id);
        if (prPid > 0) {
          prMap[prPid] = pr;
        }
      }
    }
    return prMap;
  }, [allPrs]);

  const readinessLoading = loading || boardFetching;

  // Modal / Drawer States
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<ProjectCharter | null>(null);

  // Claim & Kickoff Modal State
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
  const [isFormalKickoffMode, setIsFormalKickoffMode] = useState(false);
  const [selectedCharter, setSelectedCharter] = useState<ProjectCharter | null>(null);
  const [claimForm] = Form.useForm();
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [eligiblePms, setEligiblePms] = useState<EligiblePmItem[]>([]);
  const [loadingPms, setLoadingPms] = useState<boolean>(false);
  const [charterSchedule, setCharterSchedule] = useState<{
    earliestStart: string | null;
    latestEnd: string | null;
    totalDuration: number;
    totalTaskCount?: number;
    milestoneCount?: number;
  } | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false);

  // Reject Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // PM Cost Estimation Modal State
  const [isEstimateModalVisible, setIsEstimateModalVisible] = useState(false);
  const [selectedCharterForEstimate, setSelectedCharterForEstimate] = useState<ProjectCharter | null>(null);

  // PM WBS Modal State
  const [isWbsModalVisible, setIsWbsModalVisible] = useState(false);
  const [selectedCharterForWbs, setSelectedCharterForWbs] = useState<ProjectCharter | null>(null);

  // PM Unified Operational Plan Modal State
  const [isOperationalPlanOpen, setIsOperationalPlanOpen] = useState(false);
  const [selectedCharterForPlan, setSelectedCharterForPlan] = useState<ProjectCharter | null>(null);

  // Service claims for actionable PM verification check
  const { data: submittedServiceClaims = [] } = useQuery({
    queryKey: ['procurement', 'service-claims', 'submitted'],
    queryFn: () => ProcurementService.getServiceClaims({ status: 'SUBMITTED' }),
    staleTime: 30 * 1000,
  });

  const submittedClaimsCountByProject = React.useMemo(() => {
    const map: Record<number, number> = {};
    if (Array.isArray(submittedServiceClaims)) {
      submittedServiceClaims.forEach((c) => {
        const pid = Number(c.projectId);
        if (pid) {
          map[pid] = (map[pid] || 0) + 1;
        }
      });
    }
    return map;
  }, [submittedServiceClaims]);

  // PM Procurement Package Modal State (Phase 4 Canonical)
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [packageModalFamily, setPackageModalFamily] = useState<'MATERIAL' | 'SERVICE'>('MATERIAL');
  const [selectedCharterForPackage, setSelectedCharterForPackage] = useState<ProjectCharter | null>(null);

  // PM Service Claim Technical Verification Modal State (R1 Canonical)
  const [isServiceClaimModalOpen, setIsServiceClaimModalOpen] = useState(false);
  const [selectedClaimIdForModal, setSelectedClaimIdForModal] = useState<number | null>(null);
  const [selectedProjectForServiceClaim, setSelectedProjectForServiceClaim] = useState<ProjectCharter | null>(null);

  const handleOpenServiceClaimModal = (charter: ProjectCharter) => {
    setSelectedProjectForServiceClaim(charter);
    setSelectedClaimIdForModal(null);
    setIsServiceClaimModalOpen(true);
  };

  const handleOpenPackageModal = (charter: ProjectCharter, family: 'MATERIAL' | 'SERVICE' = 'MATERIAL') => {
    setSelectedCharterForPackage(charter);
    setPackageModalFamily(family);
    setIsPackageModalOpen(true);
  };

  const handleOpenOperationalPlan = (charter: ProjectCharter) => {
    setSelectedCharterForPlan(charter);
    setIsOperationalPlanOpen(true);
  };

  const handleOpenEstimateModal = (charter: ProjectCharter) => {
    setSelectedCharterForEstimate(charter);
    setIsEstimateModalVisible(true);
  };

  const handleOpenWbsModal = (charter: ProjectCharter) => {
    setSelectedCharterForWbs(charter);
    setIsWbsModalVisible(true);
  };

  // Helper to read 4-pillar readiness for projects/charters from Backend Database SSOT
  const getOperationalPlanStatusTag = (charter: ProjectCharter) => {
    if (!charter.projectId || Number(charter.projectId) <= 0) {
      return (
        <Tooltip title="Project belum tersedia karena Project Manager belum ditugaskan oleh PMO. Operational Plan dapat disusun setelah PM ditugaskan (Status: PLANNING).">
          <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
            ○ BELUM DITUGASKAN
          </Tag>
        </Tooltip>
      );
    }

    const pid = Number(charter.projectId);
    const downstreamPr = projectPrMap[pid];
    const isProjectActive =
      charter.status === 'IN_PROGRESS' ||
      charter.projectStatus === 'IN_PROGRESS';

    if (isProjectActive) {
      const prNum = downstreamPr?.prNumber || (downstreamPr?.id ? `PR-${downstreamPr.id}` : null);
      const prStat = downstreamPr?.status;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '2px 0' }}>
          {/* Domain 1: Operational Plan & Baseline Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Tooltip title="Operational Plan telah disetujui Manajemen (Management Review Approved)">
              <Tag
                color="success"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 4,
                  margin: 0,
                  padding: '1px 6px',
                  lineHeight: '18px',
                  background: '#f0fdf4',
                  borderColor: '#bbf7d0',
                  color: '#15803d',
                  whiteSpace: 'nowrap',
                }}
              >
                Approved
              </Tag>
            </Tooltip>
            <Tooltip title="Baseline WBS & Jadwal Proyek Terkunci saat Kickoff">
              <Tag
                color="processing"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 4,
                  margin: 0,
                  padding: '1px 6px',
                  lineHeight: '18px',
                  background: '#eff6ff',
                  borderColor: '#bfdbfe',
                  color: '#1d4ed8',
                  whiteSpace: 'nowrap',
                }}
              >
                Baseline Locked
              </Tag>
            </Tooltip>
          </div>

          {/* Domain 2: Procurement Info (Hanya jika ada PR terelasi untuk proyek ini) */}
          {prNum && (
            <div style={{ marginTop: 1 }}>
              <Text style={{ fontSize: 10.5, color: '#059669', fontWeight: 600 }}>
                {prNum} · {prStat === 'APPROVED' ? 'Approved' : prStat || 'Active'}
              </Text>
            </div>
          )}
        </div>
      );
    }

    const entry = readinessMap[pid];
    const readiness = entry?.status === 'SUCCESS' ? entry.data : (charter.readiness || null);
    const opStatus = charter.operationalPlanStatus;

    // 1. Loading: Show only while request is in-flight and no entry or projection exists yet
    if (readinessLoading && !entry && !charter.readiness && !opStatus) {
      return (
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          ○ MEMUAT STATUS...
        </Tag>
      );
    }

    // 2. Error: only if explicitly marked as error with no fallback
    if (entry?.status === 'ERROR' && !charter.readiness && !opStatus) {
      const errorMsg = entry.message || 'Gagal memuat status Operational Plan.';
      return (
        <Tooltip title={`${errorMsg} Silakan coba muat ulang atau hubungi administrator.`}>
          <Tag color="error" style={{ fontWeight: 600, borderRadius: 6 }}>
            STATUS TIDAK TERSEDIA
          </Tag>
        </Tooltip>
      );
    }

    // 3. Authoritative Business State from Database SSOT Projection or Map
    const gate = readiness?.gate;
    const gateStatus = gate?.status;
    const currentStage = gate?.currentStage || readiness?.workflow?.currentStage;
    const currentNodeId = gate?.currentNodeId || readiness?.workflow?.currentNodeId;
    const count = readiness?.completenessCount ?? 0;

    if (currentStage === 'UNKNOWN_WORKFLOW_STATE' || gateStatus === 'UNKNOWN_WORKFLOW_STATE' || opStatus === 'UNKNOWN') {
      return (
        <Tooltip title="Status workflow tidak dikenali. Periksa alur kerja di Workflow Engine.">
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>
            Status Tidak Dikenali
          </Tag>
        </Tooltip>
      );
    }

    if (
      currentStage === 'READY_FOR_KICKOFF' ||
      gateStatus === 'READY_FOR_KICKOFF' ||
      currentNodeId === 'node_end' ||
      opStatus === 'APPROVED_READY_FOR_KICKOFF'
    ) {
      return (
        <Tooltip title="Project Plan Review Workflow telah disetujui penuh oleh Director. Siap untuk Formal Kickoff oleh PM.">
          <Tag
            color="purple"
            style={{
              fontWeight: 700,
              borderRadius: 4,
              fontSize: 10.5,
              margin: 0,
              padding: '1px 6px',
              lineHeight: '18px',
              background: '#f5f3ff',
              borderColor: '#ddd6fe',
              color: '#6d28d9',
              whiteSpace: 'nowrap',
            }}
          >
            APPROVED (SIAP KICKOFF)
          </Tag>
        </Tooltip>
      );
    }

    if (
      currentStage === 'NEEDS_REVISION' ||
      gateStatus === 'NEEDS_REVISION' ||
      currentNodeId?.startsWith('node_pm_revision') ||
      opStatus === 'NEEDS_REVISION'
    ) {
      return (
        <Tooltip title={gate?.revisionNotes ? `Permintaan Revisi Manajemen: ${gate.revisionNotes}` : "Permintaan Revisi Manajemen (Database SSOT)"}>
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>
            NEEDS REVISION
          </Tag>
        </Tooltip>
      );
    }

    // Canonical Review Stages
    if (currentStage === 'REVIEW_HOPS' || currentNodeId === 'node_hops_review' || opStatus === 'REVIEW_HOPS') {
      return (
        <Tooltip title="Operational Plan diajukan oleh PM dan sedang menunggu review Head of Operations (Tahap 1 Governance)">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW HEAD OF OPS
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_PROCUREMENT' || currentNodeId === 'node_procurement_review' || opStatus === 'REVIEW_PROCUREMENT') {
      return (
        <Tooltip title="Operational Plan telah disetujui HOPS dan sedang direview oleh Procurement (Tahap 2 Governance)">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW PROCUREMENT
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_FINANCE' || currentNodeId === 'node_finance_review' || opStatus === 'REVIEW_FINANCE') {
      return (
        <Tooltip title="Operational Plan telah disetujui Procurement dan sedang dievaluasi oleh Finance (Tahap 3 Governance)">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW FINANCE
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_DIRECTOR' || currentNodeId === 'node_director_approval' || opStatus === 'REVIEW_DIRECTOR') {
      return (
        <Tooltip title="Operational Plan telah disetujui Finance dan sedang menunggu persetujuan final Director (Tahap 4 Governance)">
          <Tag
            color="purple"
            style={{
              fontWeight: 700,
              borderRadius: 6,
              background: '#f5f3ff',
              borderColor: '#ddd6fe',
              color: '#6d28d9',
            }}
          >
            REVIEW DIRECTOR
          </Tag>
        </Tooltip>
      );
    }

    // General REVIEW_PENDING fallback
    if (gateStatus === 'REVIEW_PENDING' || opStatus === 'REVIEW_PENDING') {
      return (
        <Tooltip title="Operational Plan diajukan oleh PM dan sedang dalam peninjauan tata kelola manajemen">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW PENDING
          </Tag>
        </Tooltip>
      );
    }

    // Legacy READY_FOR_PROCUREMENT fallback
    if (gateStatus === 'READY_FOR_PROCUREMENT' || opStatus === 'MANAGEMENT_REVIEW_APPROVED') {
      return (
        <Tooltip title="Milestone Management Review Operational Plan telah disetujui">
          <Tag
            color="success"
            style={{
              fontWeight: 700,
              borderRadius: 4,
              background: '#f0fdf4',
              borderColor: '#bbf7d0',
              color: '#15803d',
            }}
          >
            Management Review Approved
          </Tag>
        </Tooltip>
      );
    }

    // Drafting Stages (Before Submit)
    if (count === 4 || currentStage === 'READY_TO_SUBMIT' || opStatus === 'COMPLETE_READINESS') {
      return (
        <Tooltip title="Cost Estimate, WBS (100% Bobot), Schedule Terjadwal Penuh, Kondisi Awal Proyek — Operational Plan Lengkap (4/4 Siap Review)">
          <Tag color="success" style={{ fontWeight: 700, borderRadius: 6 }}>
            Complete Readiness
          </Tag>
        </Tooltip>
      );
    } else if (count > 0 || currentStage === 'INCOMPLETE' || opStatus === 'INCOMPLETE') {
      return (
        <Tooltip title={`Operational Plan Belum Lengkap (${count}/4 Pilar). Dihitung dari Database SSOT.`}>
          <Tag color="warning" style={{ fontWeight: 700, borderRadius: 6 }}>
            {count > 0 ? `${count}/4 INCOMPLETE` : 'INCOMPLETE'}
          </Tag>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="Operational Plan belum disusun oleh PM.">
          <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
            ○ BELUM DIINISIASI
          </Tag>
        </Tooltip>
      );
    }
  };

  // Helper to derive Handover & Kickoff Readiness from Database SSOT
  const getHandoverStatusTag = (charter: ProjectCharter) => {
    if (!charter.projectId || Number(charter.projectId) <= 0 || charter.handoverStatus === 'ANTREAN_KICKOFF') {
      return (
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          ANTREAN KICKOFF
        </Tag>
      );
    }

    const isProjectActive =
      charter.status === 'IN_PROGRESS' ||
      charter.projectStatus === 'IN_PROGRESS' ||
      charter.handoverStatus === 'PROYEK_BERJALAN';

    // 1. ACTIVE: Proyek Berjalan
    if (isProjectActive) {
      return (
        <Tag color="success" style={{ fontWeight: 600, borderRadius: 6 }}>
          PROYEK BERJALAN
        </Tag>
      );
    }

    const pid = Number(charter.projectId);
    const entry = readinessMap[pid];
    const downstreamPr = projectPrMap[pid];

    const readiness = entry?.status === 'SUCCESS' ? entry.data : (charter.readiness || null);
    const hoStatus = charter.handoverStatus;

    if (readinessLoading && !entry && !charter.readiness && !hoStatus) {
      return (
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          ○ MEMUAT...
        </Tag>
      );
    }

    const gate = readiness?.gate;
    const gateStatus = gate?.status;
    const currentStage = gate?.currentStage || readiness?.workflow?.currentStage;
    const currentNodeId = gate?.currentNodeId || readiness?.workflow?.currentNodeId;
    const count = readiness?.completenessCount ?? 0;

    if (currentStage === 'UNKNOWN_WORKFLOW_STATE' || gateStatus === 'UNKNOWN_WORKFLOW_STATE' || hoStatus === 'UNKNOWN') {
      return (
        <Tooltip title="Status workflow tidak dikenali. Periksa alur kerja di Workflow Engine.">
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>
            Status Tidak Dikenali
          </Tag>
        </Tooltip>
      );
    }

    // 2. READY_FOR_KICKOFF: Menunggu Kickoff PM
    if (
      currentStage === 'READY_FOR_KICKOFF' ||
      gateStatus === 'READY_FOR_KICKOFF' ||
      currentNodeId === 'node_end' ||
      hoStatus === 'MENUNGGU_KICKOFF_PM'
    ) {
      return (
        <Tooltip title="Seluruh persetujuan governance (PM → HOPS → Procurement → Finance → Director) telah selesai disetujui. Proyek siap untuk Kickoff Resmi oleh Project Manager.">
          <Tag
            color="purple"
            style={{
              fontWeight: 700,
              borderRadius: 6,
              color: '#6d28d9',
              background: '#f5f3ff',
              borderColor: '#ddd6fe',
            }}
          >
            MENUNGGU KICKOFF PM
          </Tag>
        </Tooltip>
      );
    }

    // 3. NEEDS_REVISION: Perlu Revisi PM
    if (
      currentStage === 'NEEDS_REVISION' ||
      gateStatus === 'NEEDS_REVISION' ||
      currentNodeId?.startsWith('node_pm_revision') ||
      hoStatus === 'PERLU_REVISI_PM'
    ) {
      return (
        <Tooltip title={gate?.revisionNotes ? `Manajemen meminta revisi operasional: ${gate.revisionNotes}` : "Manajemen meminta revisi operasional kepada PM."}>
          <Tag color="error" style={{ fontWeight: 600, borderRadius: 6 }}>
            PERLU REVISI PM
          </Tag>
        </Tooltip>
      );
    }

    // 4. Governance Review Stages (Dynamic from Workflow SSOT)
    if (currentStage === 'REVIEW_HOPS' || currentNodeId === 'node_hops_review') {
      return (
        <Tooltip title="Handover tertunda: Menunggu keputusan Management Review oleh Head of Operations.">
          <Tag color="processing" style={{ fontWeight: 600, borderRadius: 6 }}>
            REVIEW HEAD OF OPS
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_PROCUREMENT' || currentNodeId === 'node_procurement_review') {
      return (
        <Tooltip title="Handover tertunda: Menunggu peninjauan perencanaan oleh Procurement.">
          <Tag color="processing" style={{ fontWeight: 600, borderRadius: 6 }}>
            REVIEW PROCUREMENT
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_FINANCE' || currentNodeId === 'node_finance_review') {
      return (
        <Tooltip title="Handover tertunda: Menunggu peninjauan anggaran oleh Finance.">
          <Tag color="processing" style={{ fontWeight: 600, borderRadius: 6 }}>
            REVIEW FINANCE
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_DIRECTOR' || currentNodeId === 'node_director_approval') {
      return (
        <Tooltip title="Handover tertunda: Menunggu persetujuan akhir oleh Director.">
          <Tag
            color="purple"
            style={{
              fontWeight: 600,
              borderRadius: 6,
              color: '#6d28d9',
              background: '#f5f3ff',
              borderColor: '#ddd6fe',
            }}
          >
            REVIEW DIRECTOR
          </Tag>
        </Tooltip>
      );
    }

    // General REVIEW_PENDING or PENINJAUAN_MANAJEMEN
    if (gateStatus === 'REVIEW_PENDING' || hoStatus === 'PENINJAUAN_MANAJEMEN') {
      return (
        <Tooltip title="Handover tertunda: Menunggu keputusan review tata kelola manajemen.">
          <Tag color="processing" style={{ fontWeight: 600, borderRadius: 6 }}>
            REVIEW MANAJEMEN
          </Tag>
        </Tooltip>
      );
    }

    // Legacy READY_FOR_PROCUREMENT fallback
    if (gateStatus === 'READY_FOR_PROCUREMENT') {
      return (
        <Tooltip title="Handover proyek belum dimulai: Menunggu inisiasi Purchase Request oleh Procurement.">
          <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
            MENUNGGU PR PROCUREMENT
          </Tag>
        </Tooltip>
      );
    }

    // 5. Drafting Stage (Before Submit)
    if (count === 4 || currentStage === 'READY_TO_SUBMIT' || hoStatus === 'SIAP_PENGAJUAN') {
      return (
        <Tooltip title="Operational Plan sudah lengkap (4/4 Pilar Siap), menunggu pengajuan PM ke manajemen.">
          <Tag color="blue" style={{ fontWeight: 600, borderRadius: 6 }}>
            MENUNGGU SUBMIT PM
          </Tag>
        </Tooltip>
      );
    }

    return (
      <Tooltip title={`Operational Plan masih dalam tahap penyusunan oleh PM (${count}/4 Pilar). Belum siap untuk review atau kick-off.`}>
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          PENYUSUNAN PLAN
        </Tag>
      </Tooltip>
    );
  };

  const [detailDrawerInitialTab, setDetailDrawerInitialTab] = useState<string>('documents');
  const handleOpenDetailDrawer = (project: ProjectCharter, tabKey: string = 'documents') => {
    setSelectedProjectForDetail(project);
    setDetailDrawerInitialTab(tabKey);
    setIsDetailDrawerOpen(true);
  };

  // Invalidation helper to refresh operational board and related server state
  const fetchBoardData = React.useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['project', 'operational-board'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] }),
    ]);
  }, [queryClient]);

  // Refresh trigger from parent
  useEffect(() => {
    if (refreshTrigger > 0) {
      void fetchBoardData();
    }
  }, [refreshTrigger, fetchBoardData]);

  // Canonical Phase G Cross-User Synchronization & Reconnect Resync
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (
        detail.aggregateType === 'Project' ||
        detail.aggregateType === 'Contract' ||
        (detail.eventName && (
          detail.eventName.startsWith('workflow.') ||
          detail.eventName.startsWith('project.') ||
          detail.eventName === 'legal.contract.approved'
        ))
      ) {
        fetchBoardData();
      }
    };

    const handleReconnect = () => {
      fetchBoardData();
    };

    window.addEventListener('epms:business-sync', handleSync);
    window.addEventListener('epms:reconnect-resync', handleReconnect);
    return () => {
      window.removeEventListener('epms:business-sync', handleSync);
      window.removeEventListener('epms:reconnect-resync', handleReconnect);
    };
  }, [fetchBoardData]);

  // Deep-link support: auto open PM Operational Plan modal if action=operational-plan
  useEffect(() => {
    if (actionParam !== 'operational-plan' || !projectIdParam || loading) return;
    if (autoOpenedPlanRef.current === projectIdParam) return;

    const pidNum = Number(projectIdParam);
    if (!Number.isFinite(pidNum) || pidNum <= 0) return;

    const allCharters = [...pendingKickoff, ...activeProjects, ...completedProjects];
    const matchingCharter = allCharters.find(
      (c) => Number(c.projectId) === pidNum || Number(c.id) === pidNum
    );

    if (matchingCharter) {
      autoOpenedPlanRef.current = projectIdParam;
      handleOpenOperationalPlan(matchingCharter);
      return;
    }

    // If not found in current board lists, fetch readiness to construct charter
    let isCancelled = false;
    ProjectService.getOperationalReadiness(pidNum)
      .then((readinessData) => {
        if (isCancelled || !readinessData) return;
        const fallbackCharter: ProjectCharter = {
          id: readinessData.contract?.id || pidNum,
          projectId: pidNum,
          tender_id: 0,
          project_code: readinessData.projectCode || `PRJ-${pidNum}`,
          project_name: readinessData.projectName || `Project #${pidNum}`,
          customerName: readinessData.contract?.customerName || null,
          contract_total_value: readinessData.contract?.contractValue || null,
          status: 'PENDING_KICKOFF',
        };
        autoOpenedPlanRef.current = projectIdParam;
        handleOpenOperationalPlan(fallbackCharter);
      })
      .catch((err) => {
        console.warn(`Failed to resolve project #${pidNum} for deep link:`, err);
      });

  }, [actionParam, projectIdParam, pendingKickoff, activeProjects, loading]);

  // Deep-link support: auto open PMO PM Assignment modal if action=assign-pm & contractId is provided
  useEffect(() => {
    if (actionParam !== 'assign-pm' || !contractIdParam || loading) return;
    if (autoOpenedAssignRef.current === contractIdParam) return;

    // RBAC: Actionable UI visible only when user actually has PMO authorization required by backend
    if (!isPmoUser) return;

    const cidNum = Number(contractIdParam);
    if (!Number.isFinite(cidNum) || cidNum <= 0) return;

    // Find exact approved ACTIVE unassigned contract in pendingKickoff
    const matchingCharter = pendingKickoff.find((c) => {
      const isMatch = Number(c.contractId) === cidNum || Number(c.id) === cidNum;
      const recordPmId = c.managerId ?? c.projectManagerId ?? (c as any).project_manager_id ?? null;
      const isUnassigned = !recordPmId && !c.pmName;
      return isMatch && isUnassigned;
    });

    if (matchingCharter) {
      autoOpenedAssignRef.current = contractIdParam;
      setActiveTab('1');
      handleOpenClaimModal(matchingCharter);
    } else {
      const alreadyAssigned = pendingKickoff.some((c) => {
        const isMatch = Number(c.contractId) === cidNum || Number(c.id) === cidNum;
        const recordPmId = c.managerId ?? c.projectManagerId ?? (c as any).project_manager_id ?? null;
        return isMatch && Boolean(recordPmId || c.pmName);
      });
      if (alreadyAssigned && autoOpenedAssignRef.current !== contractIdParam) {
        autoOpenedAssignRef.current = contractIdParam;
        setActiveTab('1');
        message.info(`Penugasan PM untuk kontrak #${cidNum} sudah selesai.`);
      }
    }
  }, [actionParam, contractIdParam, pendingKickoff, loading, isPmoUser]);

  // Deep-link support: auto open PM Service Claim Verification modal if serviceClaimId is provided
  useEffect(() => {
    if (!serviceClaimIdParam || loading) return;
    if (autoOpenedClaimRef.current === serviceClaimIdParam) return;

    const cidNum = Number(serviceClaimIdParam);
    if (!Number.isFinite(cidNum) || cidNum <= 0) return;

    autoOpenedClaimRef.current = serviceClaimIdParam;
    setSelectedClaimIdForModal(cidNum);

    if (projectIdParam) {
      const pidNum = Number(projectIdParam);
      const allCharters = [...pendingKickoff, ...activeProjects, ...completedProjects];
      const match = allCharters.find((c) => Number(c.projectId) === pidNum || Number(c.id) === pidNum);
      if (match) {
        setSelectedProjectForServiceClaim(match);
      }
    }

    setIsServiceClaimModalOpen(true);
  }, [serviceClaimIdParam, projectIdParam, pendingKickoff, activeProjects, completedProjects, loading]);

  // Deep-link support: auto open PM Service Claim modal if action=service-claim or action=verify-claim
  useEffect(() => {
    if ((actionParam !== 'service-claim' && actionParam !== 'verify-claim') || !projectIdParam || loading) return;
    const pidKey = `${projectIdParam}-${actionParam}`;
    if (autoOpenedClaimRef.current === pidKey) return;

    const pidNum = Number(projectIdParam);
    if (!Number.isFinite(pidNum) || pidNum <= 0) return;

    const allCharters = [...pendingKickoff, ...activeProjects, ...completedProjects];
    const match = allCharters.find((c) => Number(c.projectId) === pidNum || Number(c.id) === pidNum);

    autoOpenedClaimRef.current = pidKey;
    setSelectedClaimIdForModal(null);
    if (match) {
      setSelectedProjectForServiceClaim(match);
    } else {
      setSelectedProjectForServiceClaim({
        id: pidNum,
        projectId: pidNum,
        project_name: `Project #${pidNum}`,
      } as any);
    }
    setIsServiceClaimModalOpen(true);
  }, [actionParam, projectIdParam, pendingKickoff, activeProjects, completedProjects, loading]);

  const setupKickoffOrClaimModal = async (charter: ProjectCharter, isFormal: boolean = false) => {
    setSelectedCharter(charter);
    claimForm.resetFields();
    if (isFormal) {
      claimForm.setFieldsValue({
        kickoffDate: dayjs(),
      });
    }
    setCharterSchedule(null);
    setIsClaimModalVisible(true);

    const projectId = charter.projectId ? Number(charter.projectId) : 0;
    if (isFormal && projectId > 0) {
      setLoadingSchedule(true);
      try {
        const scheduleRes = await ProjectService.getProjectSchedule(projectId);
        if (scheduleRes?.summary) {
          setCharterSchedule(scheduleRes.summary);
        }
      } catch (err) {
        console.error('Failed to load project schedule for kickoff modal:', err);
      } finally {
        setLoadingSchedule(false);
      }
    } else if (!isFormal) {
      setLoadingPms(true);
      try {
        const pms = await ProjectService.getEligibleProjectManagers();
        setEligiblePms(pms || []);
      } catch (err) {
        console.error('Failed to load eligible PMs for PMO assignment:', err);
      } finally {
        setLoadingPms(false);
      }
    }
  };

  const handleOpenClaimModal = async (charter: ProjectCharter) => {
    setIsFormalKickoffMode(false);
    await setupKickoffOrClaimModal(charter, false);
  };

  const handleOpenFormalKickoffModal = async (charter: ProjectCharter) => {
    setIsFormalKickoffMode(true);
    await setupKickoffOrClaimModal(charter, true);
  };

  const handleClaimSubmit = async (values: any) => {
    if (!selectedCharter) return;
    setSubmittingClaim(true);

    try {
      if (isFormalKickoffMode) {
        // CASE 2: Formal Kick-off (PLANNING -> IN_PROGRESS)
        const canonicalProjectId = selectedCharter.projectId ? Number(selectedCharter.projectId) : null;
        if (!canonicalProjectId || isNaN(canonicalProjectId) || canonicalProjectId <= 0) {
          message.error('ID Proyek (projectId) tidak tersedia untuk Formal Kickoff');
          setSubmittingClaim(false);
          return;
        }
        const actualKickoffDate = values.kickoffDate ? values.kickoffDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
        const formalPayload = {
          actualKickoffDate,
          estimatedStartDate: charterSchedule?.earliestStart || undefined,
          estimatedEndDate: charterSchedule?.latestEnd || undefined,
        };
        await ProjectService.formalKickoff(canonicalProjectId, formalPayload);
        message.success(`Proyek #${selectedCharter.project_code} berhasil di-kickoff ke status IN_PROGRESS!`);
      } else {
        // CASE 1: Dedicated PMO PM Assignment (PMO Queue -> PLANNING) via Canonical Workflow
        const contractId = selectedCharter.contractId || selectedCharter.id;
        let assignedViaWorkflow = false;

        if (contractId) {
          try {
            const wfInstance = await WorkflowEngineService.getInstanceByEntity(
              'CONTRACT',
              contractId,
              'PROJECT_INITIATION_WORKFLOW',
            );
            const pmoTask = wfInstance?.tasks?.find(
              (t: any) => t.taskKey === 'PMO_ASSIGN_PM' && t.status === 'PENDING',
            );
            if (wfInstance && pmoTask) {
              await WorkflowEngineService.completeTask(wfInstance.id, pmoTask.id, {
                action: 'ASSIGN_PM',
                contextUpdate: { project_manager_id: Number(values.projectManagerId) },
              });
              assignedViaWorkflow = true;
            }
          } catch (wfErr) {
            console.warn('[PMO] Workflow task completion fallback:', wfErr);
          }
        }

        if (!assignedViaWorkflow) {
          const canonicalId = selectedCharter.project_code || selectedCharter.projectId || selectedCharter.id;
          await ProjectService.assignProjectManager(canonicalId, {
            projectManagerId: Number(values.projectManagerId),
          });
        }
        message.success(`Project Manager berhasil ditugaskan ke Proyek #${selectedCharter.project_code}!`);
      }
      setIsClaimModalVisible(false);
      setSubmittingClaim(false);
      void fetchBoardData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || (isFormalKickoffMode ? 'Gagal melakukan Formal Kickoff' : 'Gagal menugaskan Project Manager');
      message.error(errMsg);
      setSubmittingClaim(false);
    }
  };

  const handleOpenRejectModal = (charter: ProjectCharter) => {
    setSelectedCharter(charter);
    setRejectReason('');
    setIsRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedCharter) return;
    if (!rejectReason || rejectReason.trim().length < 15) {
      message.error('Alasan pengembalian komersial wajib diisi minimal 15 karakter!');
      return;
    }

    setSubmittingReject(true);
    try {
      await ProjectService.rejectCharter(selectedCharter.id, { reason: rejectReason });
      
      notification.success({
        key: `pm-return-success-${selectedCharter.id}`,
        message: <span style={{ fontWeight: 600 }}>Project Charter Dikembalikan ke Marketing</span>,
        description: (
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.4 }}>
            <div>{selectedCharter.project_name || 'Project'} berhasil dikembalikan ke Marketing untuk penyesuaian komersial/kontrak.</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
              {selectedCharter.project_code} • Marketing: {selectedCharter.marketingName || 'Marketing Staff'}
            </div>
          </div>
        ),
        placement: 'topRight',
        duration: 4,
        style: { width: 380 },
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengembalikan Project Charter ke Marketing';
      message.error(errMsg);
    } finally {
      void fetchBoardData();
      setSubmittingReject(false);
      setIsRejectModalVisible(false);
    }
  };



  const activeColumns = [
    // COLUMN 1: PROJECT / CLIENT
    {
      title: (
        <Space size={4}>
          <span>Project / Client</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'project_client',
      minWidth: 260,
      sorter: (a: ProjectCharter, b: ProjectCharter) => (a.project_name || '').localeCompare(b.project_name || ''),
      render: (_: any, record: ProjectCharter) => {
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => handleOpenDetailDrawer(record)}
          >
            {/* Visual accent bar */}
            <div
              style={{
                width: 3.5,
                borderRadius: 2,
                backgroundColor: '#2563EB',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              {/* Project Name (strongest typography, max 2 lines with tooltip) */}
              <Tooltip title={record.project_name} placement="topLeft">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenProjectWorkspace(record, 'overview');
                  }}
                  role="button"
                  tabIndex={0}
                  className={styles.clickableProjectName}
                  data-testid={`project-name-link-${record.id || record.projectId}`}
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: '#1D4ED8',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {record.project_name}
                </span>
              </Tooltip>

              {/* Contract / SPK Reference Chip */}
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#0891B2',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #A5F3FC',
                    borderRadius: 4,
                    padding: '1px 6px',
                    lineHeight: '16px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {record.project_code}
                </span>
              </div>

              {/* Client Name with building icon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <BankOutlined style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {record.customerName || '-'}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },

    // COLUMN 2: PM / MARKETING
    {
      title: (
        <Space size={4}>
          <span>PM / Marketing</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'pm_marketing',
      minWidth: 210,
      sorter: (a: ProjectCharter, b: ProjectCharter) => {
        const pmA = resolvePmIdentity(a).name;
        const pmB = resolvePmIdentity(b).name;
        return pmA.localeCompare(pmB);
      },
      render: (_: any, record: ProjectCharter) => {
        const pm = resolvePmIdentity(record);
        const mkt = resolveMarketingIdentity(record);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* PM Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: pm.isAssigned ? '#2563EB' : '#94A3B8',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 12 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: pm.isAssigned ? '#0F172A' : '#64748B',
                  }}
                >
                  {pm.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>Project Manager</span>
              </div>
            </div>

            {/* Marketing Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: '#0EA5E9',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {mkt.initials || <UserOutlined style={{ fontSize: 12 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>
                  {mkt.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>Marketing PIC</span>
              </div>
            </div>
          </div>
        );
      },
    },

    // COLUMN 3: PROGRESS (PLAN VS ACTUAL)
    {
      title: (
        <Space size={4}>
          <span>Progress (Plan vs Actual)</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'progress_plan_vs_actual',
      minWidth: 220,
      render: (_: any, record: ProjectCharter) => {
        const {
          plannedText,
          plannedPercent,
          actualText,
          actualPercent,
          varianceText,
          varianceTone,
        } = resolvePlanVsActual((record as any).control, record.overallProgress);

        const varColor =
          varianceTone === 'red'
            ? '#DC2626'
            : varianceTone === 'green'
            ? '#16A34A'
            : '#64748B';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 200 }}>
            {/* Rencana Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500, width: 50 }}>Rencana</span>
              <div style={{ flex: 1, maxWidth: 85 }}>
                <Progress
                  percent={plannedPercent ?? 0}
                  size="small"
                  showInfo={false}
                  strokeColor="#3B82F6"
                  trailColor="#E2E8F0"
                  style={{ margin: 0 }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', fontVariantNumeric: 'tabular-nums', width: 36, textAlign: 'right' }}>
                {plannedText}
              </span>
            </div>

            {/* Aktual Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500, width: 50 }}>Aktual</span>
              <div style={{ flex: 1, maxWidth: 85 }}>
                <Progress
                  percent={actualPercent ?? 0}
                  size="small"
                  showInfo={false}
                  strokeColor="#0D9488"
                  trailColor="#E2E8F0"
                  style={{ margin: 0 }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', fontVariantNumeric: 'tabular-nums', width: 36, textAlign: 'right' }}>
                {actualText}
              </span>
            </div>

            {/* Deviasi Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500, width: 50 }}>Deviasi</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: varColor, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                {varianceText}
              </span>
            </div>
          </div>
        );
      },
    },

    // COLUMN 4: SCHEDULE
    {
      title: (
        <Space size={4}>
          <span>Schedule</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'operational_schedule',
      minWidth: 180,
      render: (_: any, record: ProjectCharter) => {
        const {
          actualStartText,
          plannedFinishText,
          overdueCount,
          overdueText,
          overdueTone,
        } = resolveSchedule((record as any).control);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Mulai Aktual */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <CalendarOutlined style={{ color: '#64748B', fontSize: 12, marginTop: 2 }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontSize: 10.5, color: '#64748B' }}>Mulai Aktual</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                  {actualStartText}
                </span>
              </div>
            </div>

            {/* Target Selesai */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <ScheduleOutlined style={{ color: '#64748B', fontSize: 12, marginTop: 2 }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontSize: 10.5, color: '#64748B' }}>Target Selesai</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                  {plannedFinishText}
                </span>
              </div>
            </div>

            {/* Overdue Task Count Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              {overdueTone === 'red' ? (
                <>
                  <ExclamationCircleFilled style={{ color: '#EF4444', fontSize: 11 }} />
                  <span style={{ color: '#DC2626', fontSize: 11.5, fontWeight: 600 }}>{overdueText}</span>
                </>
              ) : overdueTone === 'green' ? (
                <>
                  <CheckCircleFilled style={{ color: '#16A34A', fontSize: 11 }} />
                  <span style={{ color: '#16A34A', fontSize: 11.5, fontWeight: 500 }}>0 Task Terlambat</span>
                </>
              ) : (
                <span style={{ color: '#94A3B8', fontSize: 11.5 }}>-</span>
              )}
            </div>
          </div>
        );
      },
    },

    // COLUMN 5: HEALTH
    {
      title: (
        <Space size={4}>
          <span>Health</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'operational_health',
      minWidth: 155,
      render: (_: any, record: ProjectCharter) => {
        const { label, subtext, tone, iconType } = resolveOperationalHealth((record as any).control);

        const toneStyles: Record<string, { bg: string; border: string; color: string }> = {
          blue: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
          green: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
          red: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
          slate: { bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B' },
        };
        const s = toneStyles[tone] || toneStyles.slate;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                padding: '3px 8px',
                lineHeight: '16px',
                backgroundColor: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
              }}
            >
              {iconType === 'ahead' ? (
                <RiseOutlined style={{ fontSize: 11, color: s.color }} />
              ) : iconType === 'on_plan' ? (
                <CheckCircleFilled style={{ fontSize: 11, color: s.color }} />
              ) : iconType === 'behind' ? (
                <ExclamationCircleFilled style={{ fontSize: 11, color: s.color }} />
              ) : (
                <ClockCircleOutlined style={{ fontSize: 11, color: s.color }} />
              )}
              <span>{label}</span>
            </span>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, paddingLeft: 2 }}>
              {subtext}
            </span>
          </div>
        );
      },
    },

    // COLUMN 6: NEXT ACTION
    {
      title: (
        <Space size={4}>
          <span>Next Action</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'next_action',
      minWidth: 165,
      render: (_: any, record: ProjectCharter) => {
        const action = resolveActiveNextAction({
          project: record,
          user,
          userRoles,
        });

        if (action.mode === 'UPDATE_PROGRESS_BUTTON') {
          return (
            <Button
              type="default"
              icon={<EditOutlined style={{ fontSize: 13, color: '#1D4ED8' }} />}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetailDrawer(record, 'progress');
              }}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                borderColor: '#93C5FD',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: 'fit-content',
              }}
            >
              {action.buttonLabel || 'Update Progress'}
            </Button>
          );
        }

        if (action.mode === 'REVIEW_PROGRESS_BUTTON') {
          return (
            <Button
              type="default"
              icon={<CheckSquareOutlined style={{ fontSize: 13, color: '#2563EB' }} />}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetailDrawer(record, 'progress');
              }}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                borderColor: '#93C5FD',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: 'fit-content',
              }}
            >
              {action.buttonLabel || 'Review Progress'}
            </Button>
          );
        }

        if (action.mode === 'ASSIGN_PM_BUTTON') {
          return (
            <Button
              type="default"
              icon={<UserOutlined style={{ fontSize: 13, color: '#2563EB' }} />}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenClaimModal(record);
              }}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                borderColor: '#93C5FD',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: 'fit-content',
              }}
            >
              {action.buttonLabel || 'Tugaskan PM'}
            </Button>
          );
        }

        if (action.mode === 'WAITING_VERIFICATION') {
          return (
            <span
              style={{
                color: '#64748B',
                fontSize: 12,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ClockCircleOutlined /> Menunggu verifikasi
            </span>
          );
        }

        // Monitoring / Detail Proyek for non-PM viewers
        return (
          <Button
            size="small"
            icon={<EyeOutlined style={{ fontSize: 13, color: '#475569' }} />}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetailDrawer(record);
            }}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 13,
              borderColor: '#CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              width: 'fit-content',
            }}
          >
            Detail Proyek
          </Button>
        );
      },
    },

    // COLUMN 7: AKSI
    {
      title: (
        <Space size={4}>
          <span>Aksi</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'overflow_action',
      width: 65,
      align: 'center' as const,
      render: (_: any, record: ProjectCharter) => {
        const moreMenuItems: any[] = [
          {
            key: 'workspace',
            icon: <AppstoreOutlined />,
            label: 'Buka Project Workspace',
            onClick: () => handleOpenProjectWorkspace(record, 'overview'),
          },
          {
            key: 'detail',
            icon: <EyeOutlined />,
            label: 'Detail Project',
            onClick: () => handleOpenDetailDrawer(record),
          },
          {
            key: 'task-board',
            icon: <ProjectOutlined />,
            label: 'Task Board',
            onClick: () => handleOpenProjectWorkspace(record, 'tasks'),
          },
          {
            key: 'progress-monitoring',
            icon: <LineChartOutlined />,
            label: 'Progress & Monitoring (S-Curve)',
            onClick: () => handleOpenProjectWorkspace(record, 'monitoring'),
          },
          {
            key: 'gantt',
            icon: <CalendarOutlined />,
            label: 'Gantt Chart (Baseline vs Actual)',
            onClick: () => handleOpenProjectWorkspace(record, 'gantt'),
          },
          {
            key: 'procurement-material',
            icon: <ShoppingCartOutlined />,
            label: 'Paket Pengadaan Material',
            onClick: () => handleOpenPackageModal(record, 'MATERIAL'),
          },
          {
            key: 'procurement-service',
            icon: <ToolOutlined />,
            label: 'Pengadaan Jasa',
            onClick: () => handleOpenPackageModal(record, 'SERVICE'),
          },
        ];

        // Verifikasi Klaim Jasa - visible for assigned PM or management
        const recordPmId = record.managerId ?? record.projectManagerId ?? (record as any).project_manager_id ?? null;
        const currentUserId = Number(user?.sub || (user as any)?.id);
        const isAssignedPm = Boolean(recordPmId && Number(recordPmId) === currentUserId);
        const isManagement = isSuperAdmin || isPmoUser || isDirectorUser;
        const projectClaimCount = submittedClaimsCountByProject[Number(record.projectId || record.id)] || 0;
        if (isAssignedPm || isManagement) {
          moreMenuItems.push({
            key: 'service-claim',
            icon: <SafetyCertificateOutlined />,
            label: (
              <Space size={6}>
                <span>Verifikasi Klaim Jasa</span>
                {projectClaimCount > 0 && (
                  <Badge count={projectClaimCount} size="small" style={{ backgroundColor: '#2563EB' }} />
                )}
              </Space>
            ),
            onClick: () => handleOpenServiceClaimModal(record),
          });
        }


        moreMenuItems.push(
          {
            key: 'operational-plan',
            icon: <ApartmentOutlined />,
            label: 'Operational Plan',
            onClick: () => handleOpenOperationalPlan(record),
          },
          {
            key: 'closure',
            icon: <CheckCircleOutlined />,
            label: 'Project Closure',
            onClick: () => handleOpenProjectWorkspace(record, 'closure'),
          },
        );

        return (
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Tooltip title="Aksi lainnya">
              <Button
                size="small"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  borderColor: '#E2E8F0',
                  color: '#64748B',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreOutlined style={{ fontSize: 16 }} />
              </Button>
            </Tooltip>
          </Dropdown>
        );
      },
    },
  ];

  // Helper to render restrained status chips matching visual benchmark
  const renderStatusChip = (descriptor: { text: string; tone: ChipTone; hasCheck?: boolean; hasDot?: boolean }) => {
    const toneStyles: Record<ChipTone, { bg: string; border: string; color: string }> = {
      green: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
      purple: { bg: '#F5F3FF', border: '#DDD6FE', color: '#6D28D9' },
      blue: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
      amber: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' },
      slate: { bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B' },
      red: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
    };
    const s = toneStyles[descriptor.tone] || toneStyles.slate;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 4,
          padding: '2px 8px',
          lineHeight: '16px',
          backgroundColor: s.bg,
          border: `1px solid ${s.border}`,
          color: s.color,
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        }}
      >
        {descriptor.hasCheck ? (
          <CheckCircleFilled style={{ fontSize: 11, color: s.color }} />
        ) : descriptor.hasDot ? (
          <span style={{ fontSize: 9, lineHeight: 1 }}>●</span>
        ) : (
          <span style={{ fontSize: 9, lineHeight: 1 }}>○</span>
        )}
        <span>{descriptor.text}</span>
      </span>
    );
  };

  const pendingColumns = [
    {
      title: (
        <Space size={4}>
          <span>Project / Client</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'project_client',
      minWidth: 260,
      sorter: (a: ProjectCharter, b: ProjectCharter) => (a.project_name || '').localeCompare(b.project_name || ''),
      render: (_: any, record: ProjectCharter) => {
        const isRevision =
          record.operationalPlanStatus === 'NEEDS_REVISION' ||
          record.handoverStatus === 'PERLU_REVISI_PM';
        const accentColor = isRevision ? '#EF4444' : '#2563EB';

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => handleOpenDetailDrawer(record)}
          >
            {/* Visual accent bar */}
            <div
              style={{
                width: 3.5,
                borderRadius: 2,
                backgroundColor: accentColor,
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              {/* Project Name (strongest typography, max 2 lines with tooltip) */}
              <Tooltip title={record.project_name} placement="topLeft">
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: '#1D4ED8',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {record.project_name}
                </span>
              </Tooltip>

              {/* Contract / SPK Reference Chip */}
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#0891B2',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #A5F3FC',
                    borderRadius: 4,
                    padding: '1px 6px',
                    lineHeight: '16px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {record.project_code}
                </span>
              </div>

              {/* Client Name with building icon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <BankOutlined style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {record.customerName || '-'}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <span>PM / Marketing</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'pm_marketing',
      minWidth: 210,
      sorter: (a: ProjectCharter, b: ProjectCharter) => {
        const pmA = resolvePmIdentity(a).name;
        const pmB = resolvePmIdentity(b).name;
        return pmA.localeCompare(pmB);
      },
      render: (_: any, record: ProjectCharter) => {
        const pm = resolvePmIdentity(record);
        const mkt = resolveMarketingIdentity(record);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* PM Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: pm.isAssigned ? '#2563EB' : '#94A3B8',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 12 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: pm.isAssigned ? '#0F172A' : '#64748B',
                  }}
                >
                  {pm.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Project Manager
                </span>
              </div>
            </div>

            {/* Marketing Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: mkt.isAssigned ? '#475569' : '#94A3B8',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {mkt.isAssigned ? mkt.initials : <UserOutlined style={{ fontSize: 12 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>
                  {mkt.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Marketing PIC
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <span>Nilai Kontrak</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'commercial',
      minWidth: 175,
      sorter: (a: ProjectCharter, b: ProjectCharter) => {
        const valA = Number(a.contract_total_value || 0);
        const valB = Number(b.contract_total_value || 0);
        return valA - valB;
      },
      render: (_: any, record: ProjectCharter) => {
        const budget =
          record.project_budget !== null && record.project_budget !== undefined
            ? Number(record.project_budget)
            : record.contract_total_value !== null && record.contract_total_value !== undefined
            ? Number(record.contract_total_value)
            : null;
        const hasBoth =
          budget !== null &&
          record.contract_total_value !== null &&
          record.contract_total_value !== undefined;
        const isAdjusted = hasBoth && budget !== Number(record.contract_total_value);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 155 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, width: 44 }}>SPK</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatCurrency(record.contract_total_value)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, width: 44 }}>Budget</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatCurrency(budget)}
                </span>
                {isAdjusted && (
                  <Tooltip title="Budget disesuaikan terhadap nilai SPK">
                    <Tag color="gold" style={{ fontSize: 9.5, lineHeight: '14px', margin: 0, padding: '0 3px', borderRadius: 3 }}>
                      Adj
                    </Tag>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <span>Status</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'status',
      minWidth: 235,
      render: (_: any, record: ProjectCharter) => {
        const { opTag, hoTag } = getKickoffQueueStatusTags(record, readinessMap);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Row 1: Operational Plan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: '#475569',
                  fontWeight: 500,
                  width: 96,
                  flexShrink: 0,
                }}
              >
                Operational Plan
              </span>
              <Tooltip title={opTag.tooltip}>{renderStatusChip(opTag)}</Tooltip>
            </div>

            {/* Row 2: Handover */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: '#475569',
                  fontWeight: 500,
                  width: 96,
                  flexShrink: 0,
                }}
              >
                Handover
              </span>
              <Tooltip title={hoTag.tooltip}>{renderStatusChip(hoTag)}</Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <span>Next Action</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'next_action',
      minWidth: 220,
      render: (_: any, record: ProjectCharter) => {
        const action = resolveNextAction(record, readinessMap, user?.sub, userRoles);

        if (action.mode === 'KICKOFF_BUTTON') {
          return (
            <Tooltip title="Proyek siap untuk Kick Off oleh Project Manager">
              <Button
                type="primary"
                icon={<RocketOutlined style={{ fontSize: 13 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenFormalKickoffModal(record);
                }}
                style={{
                  height: 34,
                  padding: '0 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  backgroundColor: '#1677FF',
                  borderColor: '#1677FF',
                  boxShadow: '0 1px 2px 0 rgba(22, 119, 255, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  width: 'fit-content',
                }}
              >
                {action.buttonLabel || 'Kick Off Proyek'}
              </Button>
            </Tooltip>
          );
        }

        if (action.mode === 'WAITING_PM_KICKOFF') {
          return (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#475569',
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              <ClockCircleOutlined style={{ color: '#2563EB', fontSize: 13 }} />
              <span>{action.waitingText}</span>
            </div>
          );
        }

        if (action.mode === 'ASSIGN_PM_BUTTON') {
          return (
            <Tooltip title="Tugaskan Project Manager ke proyek ini (Status: PLANNING)">
              <Button
                type="primary"
                icon={<UserOutlined style={{ fontSize: 13 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenClaimModal(record);
                }}
                style={{
                  height: 34,
                  padding: '0 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  backgroundColor: '#10B981',
                  borderColor: '#10B981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  width: 'fit-content',
                }}
              >
                {action.buttonLabel || 'Tugaskan PM'}
              </Button>
            </Tooltip>
          );
        }

        if (action.mode === 'WAITING_PMO_ASSIGN') {
          return (
            <span
              style={{
                color: '#B45309',
                fontSize: 12,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ClockCircleOutlined /> {action.waitingText}
            </span>
          );
        }

        if (action.mode === 'WAITING_GOVERNANCE') {
          return (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'flex-start',
                gap: 6,
                color: '#1D4ED8',
                fontSize: 12,
                lineHeight: 1.35,
              }}
            >
              <ClockCircleOutlined style={{ marginTop: 2, fontSize: 13, color: '#2563EB' }} />
              <div>
                <div style={{ color: '#64748B', fontSize: 11.5 }}>{action.waitingText}</div>
                <div style={{ fontWeight: 600, color: '#1D4ED8' }}>{action.actorName}</div>
              </div>
            </div>
          );
        }

        if (action.mode === 'OPERATIONAL_PLAN_BUTTON') {
          return (
            <Tooltip title="Buka PM Operational Plan Workspace">
              <Button
                icon={<FileTextOutlined style={{ fontSize: 13 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenOperationalPlan(record);
                }}
                style={{
                  height: 34,
                  padding: '0 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  borderColor: '#93C5FD',
                  color: '#1D4ED8',
                  backgroundColor: '#EFF6FF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  width: 'fit-content',
                }}
              >
                {action.buttonLabel || 'Operational Plan'}
              </Button>
            </Tooltip>
          );
        }

        if (action.mode === 'REVISION_PLAN_BUTTON') {
          return (
            <Tooltip title="Operational Plan perlu revisi. Klik untuk membuka workspace.">
              <Button
                danger
                icon={<EditOutlined style={{ fontSize: 13 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenOperationalPlan(record);
                }}
                style={{
                  height: 34,
                  padding: '0 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  width: 'fit-content',
                }}
              >
                {action.buttonLabel || 'Revisi Plan'}
              </Button>
            </Tooltip>
          );
        }

        return (
          <span
            style={{
              color: '#64748B',
              fontSize: 12,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ClockCircleOutlined /> {action.waitingText || 'Penyusunan Plan'}
          </span>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <span>Aksi</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'overflow_action',
      width: 65,
      align: 'center' as const,
      render: (_: any, record: ProjectCharter) => {
        const pm = resolvePmIdentity(record);
        const { isReadyForKickoff } = getKickoffQueueStatusTags(record, readinessMap);
        const isAssignedPm = Boolean(user?.sub && pm.id && Number(pm.id) === Number(user.sub));
        const canReject = pm.isAssigned && (isPmoUser || isSuperAdmin || isAssignedPm);

        const moreMenuItems: any[] = [
          {
            key: 'detail',
            icon: <EyeOutlined />,
            label: 'Lihat Detail',
            onClick: () => handleOpenDetailDrawer(record),
          },
        ];

        // Jika sudah READY FOR KICKOFF, Operational Plan tetap dapat diakses di menu More (⋮)
        if (isReadyForKickoff && (isAssignedPm || isPmoUser || isSuperAdmin || isDirectorUser)) {
          moreMenuItems.push({
            key: 'operational-plan',
            icon: <ApartmentOutlined />,
            label: 'Operational Plan',
            onClick: () => handleOpenOperationalPlan(record),
          });
        }

        if (canReject) {
          moreMenuItems.push(
            { type: 'divider' },
            {
              key: 'reject',
              icon: <RollbackOutlined />,
              danger: true,
              label: 'Kembalikan ke Marketing',
              onClick: () => handleOpenRejectModal(record),
            },
          );
        }

        return (
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Tooltip title="Aksi lainnya">
              <Button
                size="small"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  borderColor: '#E2E8F0',
                  color: '#64748B',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreOutlined style={{ fontSize: 16 }} />
              </Button>
            </Tooltip>
          </Dropdown>
        );
      },
    },
  ];

  const completedColumns = [
    // COLUMN 1: PROJECT / CLIENT
    {
      title: (
        <Space size={4}>
          <span>Project / Client</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'project_client',
      minWidth: 260,
      sorter: (a: ProjectCharter, b: ProjectCharter) => (a.project_name || '').localeCompare(b.project_name || ''),
      render: (_: any, record: ProjectCharter) => {
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => handleOpenDetailDrawer(record)}
          >
            {/* Visual accent bar for completed: emerald green */}
            <div
              style={{
                width: 3.5,
                borderRadius: 2,
                backgroundColor: '#10B981',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              {/* Project Name */}
              <Tooltip title={record.project_name} placement="topLeft">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenProjectWorkspace(record, 'overview');
                  }}
                  role="button"
                  tabIndex={0}
                  className={styles.clickableProjectName}
                  data-testid={`project-name-link-${record.id || record.projectId}`}
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: '#047857',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {record.project_name}
                </span>
              </Tooltip>

              {/* Contract / SPK Reference Chip */}
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#065F46',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: 4,
                    padding: '1px 6px',
                    lineHeight: '16px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {record.project_code}
                </span>
              </div>

              {/* Client Name with building icon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <BankOutlined style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {record.customerName || '-'}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },

    // COLUMN 2: PM / MARKETING
    {
      title: (
        <Space size={4}>
          <span>PM / Marketing</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'pm_marketing',
      minWidth: 210,
      sorter: (a: ProjectCharter, b: ProjectCharter) => {
        const pmA = resolvePmIdentity(a).name;
        const pmB = resolvePmIdentity(b).name;
        return pmA.localeCompare(pmB);
      },
      render: (_: any, record: ProjectCharter) => {
        const pm = resolvePmIdentity(record);
        const mkt = resolveMarketingIdentity(record);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* PM Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: pm.isAssigned ? '#2563EB' : '#94A3B8',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 12 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: pm.isAssigned ? '#0F172A' : '#64748B',
                  }}
                >
                  {pm.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>Project Manager</span>
              </div>
            </div>

            {/* Marketing Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: '#0EA5E9',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {mkt.initials || <UserOutlined style={{ fontSize: 12 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>
                  {mkt.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>Marketing PIC</span>
              </div>
            </div>
          </div>
        );
      },
    },

    // COLUMN 3: FINAL PROGRESS
    {
      title: (
        <Space size={4}>
          <span>Final Progress</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'final_progress',
      minWidth: 160,
      render: (_: any, record: ProjectCharter) => {
        const prog = record.overallProgress ?? 100;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                {prog}%
              </span>
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, background: '#ECFDF5', padding: '1px 6px', borderRadius: 4, border: '1px solid #A7F3D0' }}>
                Selesai 100%
              </span>
            </div>
            <Progress
              percent={prog}
              size="small"
              showInfo={false}
              strokeColor="#10B981"
              trailColor="#E2E8F0"
            />
          </div>
        );
      },
    },

    // COLUMN 4: OPERATIONAL FINISH
    {
      title: (
        <Space size={4}>
          <span>Operational Finish</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'operational_finish',
      minWidth: 150,
      render: (_: any, record: ProjectCharter) => {
        const rawDate = (record as any).actualFinishAt || record.endDate || record.actualKickoffDate;
        const formatted = rawDate ? dayjs(rawDate).format('DD MMM YYYY') : '-';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0F172A', fontSize: 12.5, fontWeight: 600 }}>
              <CalendarOutlined style={{ color: '#10B981', fontSize: 13 }} />
              <span>{formatted}</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748B' }}>Fisik 100% Tercapai</span>
          </div>
        );
      },
    },

    // COLUMN 5: FORMAL CLOSED DATE
    {
      title: (
        <Space size={4}>
          <span>Formal Closed Date</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'formal_closed_date',
      minWidth: 150,
      render: (_: any, record: ProjectCharter) => {
        const rawDate = (record as any).closedAt || (record as any).actualFinishAt;
        const formatted = rawDate ? dayjs(rawDate).format('DD MMM YYYY') : '-';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0F172A', fontSize: 12.5, fontWeight: 600 }}>
              <CheckCircleOutlined style={{ color: '#2563EB', fontSize: 13 }} />
              <span>{formatted}</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748B' }}>Persetujuan Direktur</span>
          </div>
        );
      },
    },

    // COLUMN 6: CLOSURE STATUS
    {
      title: (
        <Space size={4}>
          <span>Closure Status</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'closure_status',
      minWidth: 170,
      render: (_: any, record: ProjectCharter) => {
        const cStatus = (record as any).closureStatus || 'APPROVED';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Tag
              color="success"
              style={{
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 11,
                padding: '1px 8px',
                margin: 0,
                background: '#ECFDF5',
                borderColor: '#A7F3D0',
                color: '#065F46',
              }}
            >
              CLOSED
            </Tag>
            <Tag
              color="blue"
              style={{
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 11,
                padding: '1px 8px',
                margin: 0,
                background: '#EFF6FF',
                borderColor: '#BFDBFE',
                color: '#1D4ED8',
              }}
            >
              {cStatus}
            </Tag>
          </div>
        );
      },
    },

    // COLUMN 7: AKSI (Terminal action: Lihat Detail only, no operational mutations)
    {
      title: (
        <Space size={4}>
          <span>Aksi</span>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>↕</span>
        </Space>
      ),
      key: 'aksi',
      minWidth: 130,
      render: (_: any, record: ProjectCharter) => {
        return (
          <Button
            size="small"
            icon={<EyeOutlined style={{ fontSize: 13, color: '#475569' }} />}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetailDrawer(record);
            }}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 13,
              borderColor: '#CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              width: 'fit-content',
            }}
          >
            Lihat Detail
          </Button>
        );
      },
    },
  ];

  // Mobile Card Renderer: Waiting Kick-off Queue
  const renderPendingMobileCard = (record: ProjectCharter) => {
    const isRevision =
      record.operationalPlanStatus === 'NEEDS_REVISION' ||
      record.handoverStatus === 'PERLU_REVISI_PM';
    const accentColor = isRevision ? '#EF4444' : '#2563EB';
    const pm = resolvePmIdentity(record);
    const mkt = resolveMarketingIdentity(record);
    const { opTag, hoTag } = getKickoffQueueStatusTags(record, readinessMap);
    const action = resolveNextAction(record, readinessMap, user?.sub, userRoles);

    return (
      <div key={`pending-${record.id || record.contractId}`} className={styles.mobileCard} data-testid={`mobile-pending-card-${record.id || record.contractId}`}>
        <div className={styles.mobileCardAccentBar} style={{ backgroundColor: accentColor }} />
        <div className={styles.mobileCardHeader}>
          <div className={styles.mobileCardTitleRow}>
            <span
              className={styles.mobileCardTitle}
              onClick={() => handleOpenDetailDrawer(record)}
              role="button"
              tabIndex={0}
            >
              {record.project_name}
            </span>
          </div>
          <div>
            <span
              className={styles.mobileCardCodeBadge}
              style={{
                color: '#0891B2',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
              }}
            >
              {record.project_code}
            </span>
          </div>
          <div className={styles.mobileCardClientRow}>
            <BankOutlined style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }} />
            <span>{record.customerName || '-'}</span>
          </div>
        </div>

        {/* People Section */}
        <div className={styles.mobileCardPeopleSection}>
          <div className={styles.mobileCardPersonRow}>
            <div
              className={styles.mobileCardPersonAvatar}
              style={{ backgroundColor: pm.isAssigned ? '#2563EB' : '#94A3B8' }}
            >
              {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 11 }} />}
            </div>
            <div className={styles.mobileCardPersonInfo}>
              <span className={styles.mobileCardPersonName}>{pm.name}</span>
              <span className={styles.mobileCardPersonRole}>Project Manager</span>
            </div>
          </div>
          <div className={styles.mobileCardPersonRow}>
            <div
              className={styles.mobileCardPersonAvatar}
              style={{ backgroundColor: mkt.isAssigned ? '#475569' : '#94A3B8' }}
            >
              {mkt.isAssigned ? mkt.initials : <UserOutlined style={{ fontSize: 11 }} />}
            </div>
            <div className={styles.mobileCardPersonInfo}>
              <span className={styles.mobileCardPersonName}>{mkt.name}</span>
              <span className={styles.mobileCardPersonRole}>Marketing PIC</span>
            </div>
          </div>
        </div>

        {/* Status / Readiness Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>Operational Plan</span>
            <Tooltip title={opTag.tooltip}>{renderStatusChip(opTag)}</Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>Handover</span>
            <Tooltip title={hoTag.tooltip}>{renderStatusChip(hoTag)}</Tooltip>
          </div>
        </div>

        {/* Actions Row */}
        <div className={styles.mobileCardActionsRow}>
          {action.mode === 'KICKOFF_BUTTON' && (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => handleOpenFormalKickoffModal(record)}
              className={styles.mobileCardPrimaryBtn}
              style={{ backgroundColor: '#1677FF', borderColor: '#1677FF' }}
            >
              {action.buttonLabel || 'Kick Off Proyek'}
            </Button>
          )}
          {action.mode === 'ASSIGN_PM_BUTTON' && (
            <Button
              type="primary"
              icon={<UserOutlined />}
              onClick={() => handleOpenClaimModal(record)}
              className={styles.mobileCardPrimaryBtn}
              style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
            >
              {action.buttonLabel || 'Tugaskan PM'}
            </Button>
          )}
          {action.mode === 'OPERATIONAL_PLAN_BUTTON' && (
            <Button
              icon={<FileTextOutlined />}
              onClick={() => handleOpenOperationalPlan(record)}
              className={styles.mobileCardPrimaryBtn}
              style={{ borderColor: '#93C5FD', color: '#1D4ED8', backgroundColor: '#EFF6FF' }}
            >
              {action.buttonLabel || 'Operational Plan'}
            </Button>
          )}
          {action.mode === 'REVISION_PLAN_BUTTON' && (
            <Button
              danger
              icon={<EditOutlined />}
              onClick={() => handleOpenOperationalPlan(record)}
              className={styles.mobileCardPrimaryBtn}
            >
              {action.buttonLabel || 'Revisi Plan'}
            </Button>
          )}
          {action.mode === 'WAITING_PM_KICKOFF' && (
            <div style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12.5, fontWeight: 500 }}>
              <ClockCircleOutlined style={{ color: '#2563EB', fontSize: 13 }} />
              <span>{action.waitingText}</span>
            </div>
          )}
          {action.mode === 'WAITING_PMO_ASSIGN' && (
            <div style={{ flex: 1, color: '#B45309', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined /> {action.waitingText}
            </div>
          )}
          {action.mode === 'WAITING_GOVERNANCE' && (
            <div style={{ flex: 1, color: '#1D4ED8', fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4, color: '#2563EB' }} />
              <span>{action.waitingText}: <strong>{action.actorName}</strong></span>
            </div>
          )}
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetailDrawer(record)}
            className={styles.mobileCardSecondaryBtn}
          >
            Detail
          </Button>
        </div>
      </div>
    );
  };

  // Mobile Card Renderer: Active Projects
  const renderActiveMobileCard = (record: ProjectCharter) => {
    const pm = resolvePmIdentity(record);
    const mkt = resolveMarketingIdentity(record);
    const {
      plannedText,
      plannedPercent,
      actualText,
      actualPercent,
      varianceText,
      varianceTone,
    } = resolvePlanVsActual((record as any).control, record.overallProgress);
    const health = resolveOperationalHealth((record as any).control);
    const schedule = resolveSchedule((record as any).control);
    const action = resolveActiveNextAction({
      project: record,
      user,
      userRoles,
    });

    const toneStyles: Record<string, { bg: string; border: string; color: string }> = {
      blue: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
      green: { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
      red: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
      slate: { bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B' },
    };
    const healthStyle = toneStyles[health.tone] || toneStyles.slate;
    const varColor =
      varianceTone === 'red'
        ? '#DC2626'
        : varianceTone === 'green'
        ? '#16A34A'
        : '#64748B';

    return (
      <div key={`active-${record.id || record.projectId}`} className={styles.mobileCard} data-testid={`mobile-active-card-${record.id || record.projectId}`}>
        <div className={styles.mobileCardAccentBar} style={{ backgroundColor: '#2563EB' }} />
        <div className={styles.mobileCardHeader}>
          <div className={styles.mobileCardTitleRow}>
            <span
              className={styles.mobileCardTitle}
              onClick={() => handleOpenProjectWorkspace(record, 'overview')}
              role="button"
              tabIndex={0}
            >
              {record.project_name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              className={styles.mobileCardCodeBadge}
              style={{
                color: '#0891B2',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
              }}
            >
              {record.project_code}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10.5,
                fontWeight: 700,
                borderRadius: 4,
                padding: '1px 6px',
                backgroundColor: healthStyle.bg,
                border: `1px solid ${healthStyle.border}`,
                color: healthStyle.color,
              }}
            >
              {health.iconType === 'ahead' && <RiseOutlined style={{ fontSize: 10 }} />}
              {health.iconType === 'on_plan' && <CheckCircleFilled style={{ fontSize: 10 }} />}
              {health.iconType === 'behind' && <ExclamationCircleFilled style={{ fontSize: 10 }} />}
              {health.iconType === 'unavailable' && <ClockCircleOutlined style={{ fontSize: 10 }} />}
              {health.label}
            </span>
          </div>
          <div className={styles.mobileCardClientRow}>
            <BankOutlined style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }} />
            <span>{record.customerName || '-'}</span>
          </div>
        </div>

        {/* People Section */}
        <div className={styles.mobileCardPeopleSection}>
          <div className={styles.mobileCardPersonRow}>
            <div
              className={styles.mobileCardPersonAvatar}
              style={{ backgroundColor: pm.isAssigned ? '#2563EB' : '#94A3B8' }}
            >
              {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 11 }} />}
            </div>
            <div className={styles.mobileCardPersonInfo}>
              <span className={styles.mobileCardPersonName}>{pm.name}</span>
              <span className={styles.mobileCardPersonRole}>Project Manager</span>
            </div>
          </div>
          <div className={styles.mobileCardPersonRow}>
            <div
              className={styles.mobileCardPersonAvatar}
              style={{ backgroundColor: '#0EA5E9' }}
            >
              {mkt.initials || <UserOutlined style={{ fontSize: 11 }} />}
            </div>
            <div className={styles.mobileCardPersonInfo}>
              <span className={styles.mobileCardPersonName}>{mkt.name}</span>
              <span className={styles.mobileCardPersonRole}>Marketing PIC</span>
            </div>
          </div>
        </div>

        {/* Progress Plan vs Actual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500, width: 50 }}>Rencana</span>
            <div style={{ flex: 1, maxWidth: 120 }}>
              <Progress percent={plannedPercent ?? 0} size="small" showInfo={false} strokeColor="#3B82F6" trailColor="#E2E8F0" style={{ margin: 0 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', width: 40, textAlign: 'right' }}>{plannedText}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500, width: 50 }}>Aktual</span>
            <div style={{ flex: 1, maxWidth: 120 }}>
              <Progress percent={actualPercent ?? 0} size="small" showInfo={false} strokeColor="#0D9488" trailColor="#E2E8F0" style={{ margin: 0 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', width: 40, textAlign: 'right' }}>{actualText}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2, borderTop: '1px dashed #E2E8F0' }}>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>Deviasi Progres</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: varColor }}>{varianceText}</span>
          </div>
        </div>

        {/* Schedule Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', fontSize: 11.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B' }}>
            <CalendarOutlined style={{ fontSize: 11 }} />
            <span>Target: <strong>{schedule.plannedFinishText}</strong></span>
          </div>
          <div>
            {schedule.overdueTone === 'red' ? (
              <span style={{ color: '#DC2626', fontWeight: 600 }}>{schedule.overdueText}</span>
            ) : schedule.overdueTone === 'green' ? (
              <span style={{ color: '#16A34A', fontWeight: 500 }}>0 Terlambat</span>
            ) : null}
          </div>
        </div>

        {/* Actions Row */}
        <div className={styles.mobileCardActionsRow}>
          {action.mode === 'UPDATE_PROGRESS_BUTTON' && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => handleOpenDetailDrawer(record, 'progress')}
              className={styles.mobileCardPrimaryBtn}
              style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
            >
              Update Progress
            </Button>
          )}
          {action.mode === 'REVIEW_PROGRESS_BUTTON' && (
            <Button
              type="primary"
              icon={<CheckSquareOutlined />}
              onClick={() => handleOpenDetailDrawer(record, 'progress')}
              className={styles.mobileCardPrimaryBtn}
              style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
            >
              Review Progress
            </Button>
          )}
          {action.mode === 'ASSIGN_PM_BUTTON' && (
            <Button
              type="primary"
              icon={<UserOutlined />}
              onClick={() => handleOpenClaimModal(record)}
              className={styles.mobileCardPrimaryBtn}
            >
              Tugaskan PM
            </Button>
          )}
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => handleOpenProjectWorkspace(record, 'overview')}
            className={action.mode ? styles.mobileCardSecondaryBtn : styles.mobileCardPrimaryBtn}
            style={!action.mode ? { backgroundColor: '#2563EB', borderColor: '#2563EB', color: '#FFFFFF' } : undefined}
          >
            Workspace
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetailDrawer(record)}
            className={styles.mobileCardSecondaryBtn}
          >
            Detail
          </Button>
        </div>
      </div>
    );
  };

  // Mobile Card Renderer: Completed Projects
  const renderCompletedMobileCard = (record: ProjectCharter) => {
    const pm = resolvePmIdentity(record);
    const mkt = resolveMarketingIdentity(record);
    const cStatus = (record as any).closureStatus || 'APPROVED';
    const rawDate = (record as any).closedAt || (record as any).actualFinishAt || record.endDate;
    const formattedDate = rawDate ? dayjs(rawDate).format('DD MMM YYYY') : '-';

    return (
      <div key={`completed-${record.id || record.projectId}`} className={styles.mobileCard} data-testid={`mobile-completed-card-${record.id || record.projectId}`}>
        <div className={styles.mobileCardAccentBar} style={{ backgroundColor: '#10B981' }} />
        <div className={styles.mobileCardHeader}>
          <div className={styles.mobileCardTitleRow}>
            <span
              className={styles.mobileCardTitle}
              style={{ color: '#047857' }}
              onClick={() => handleOpenDetailDrawer(record)}
              role="button"
              tabIndex={0}
            >
              {record.project_name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              className={styles.mobileCardCodeBadge}
              style={{
                color: '#065F46',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
              }}
            >
              {record.project_code}
            </span>
            <Tag color="success" style={{ borderRadius: 4, margin: 0, fontWeight: 700, fontSize: 10.5 }}>
              CLOSED
            </Tag>
            <Tag color="blue" style={{ borderRadius: 4, margin: 0, fontWeight: 700, fontSize: 10.5 }}>
              {cStatus}
            </Tag>
          </div>
          <div className={styles.mobileCardClientRow}>
            <BankOutlined style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }} />
            <span>{record.customerName || '-'}</span>
          </div>
        </div>

        {/* People Section */}
        <div className={styles.mobileCardPeopleSection}>
          <div className={styles.mobileCardPersonRow}>
            <div
              className={styles.mobileCardPersonAvatar}
              style={{ backgroundColor: pm.isAssigned ? '#2563EB' : '#94A3B8' }}
            >
              {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 11 }} />}
            </div>
            <div className={styles.mobileCardPersonInfo}>
              <span className={styles.mobileCardPersonName}>{pm.name}</span>
              <span className={styles.mobileCardPersonRole}>Project Manager</span>
            </div>
          </div>
          <div className={styles.mobileCardPersonRow}>
            <div
              className={styles.mobileCardPersonAvatar}
              style={{ backgroundColor: '#0EA5E9' }}
            >
              {mkt.initials || <UserOutlined style={{ fontSize: 11 }} />}
            </div>
            <div className={styles.mobileCardPersonInfo}>
              <span className={styles.mobileCardPersonName}>{mkt.name}</span>
              <span className={styles.mobileCardPersonRole}>Marketing PIC</span>
            </div>
          </div>
        </div>

        {/* Closure Metadata */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', fontSize: 11.5, background: '#F0FDF4', borderRadius: 6, border: '1px solid #BBF7D0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#065F46', fontWeight: 600 }}>
            <CheckCircleOutlined style={{ color: '#059669' }} />
            <span>Selesai: {formattedDate}</span>
          </div>
          <span style={{ color: '#059669', fontWeight: 700 }}>100% Selesai</span>
        </div>

        {/* Actions Row */}
        <div className={styles.mobileCardActionsRow}>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetailDrawer(record)}
            className={styles.mobileCardPrimaryBtn}
            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
          >
            Lihat Detail
          </Button>
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => handleOpenProjectWorkspace(record, 'overview')}
            className={styles.mobileCardSecondaryBtn}
          >
            Workspace
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.workspaceContainer}>
      {selectedWorkspaceProjectId ? (
        <ProjectWorkspace
          projectId={selectedWorkspaceProjectId}
          project={currentWorkspaceProject || undefined}
          loading={loading}
          initialSection={selectedWorkspaceSection}
          onBack={() => {
            setSelectedWorkspaceProjectId(null);
            setSelectedWorkspaceSection('overview');
            if (typeof window !== 'undefined') {
              const currentUrl = new URL(window.location.href);
              currentUrl.searchParams.delete('view');
              currentUrl.searchParams.delete('projectId');
              currentUrl.searchParams.delete('section');
              window.history.pushState({}, '', currentUrl.toString());
            }
          }}
          onOpenDetailDrawer={(record, tab) => handleOpenDetailDrawer(record, tab)}
          onOpenProcurementPackage={(record, family) => handleOpenPackageModal(record, family)}
          onOpenServiceClaimVerification={(record) => handleOpenServiceClaimModal(record)}
          onOpenOperationalPlan={(record) => handleOpenOperationalPlan(record)}
          onUpdateProgress={(record) => handleOpenDetailDrawer(record, 'progress')}
        />
      ) : (
        <>
          {/* Header Metrics */}
      <Row gutter={[16, 16]} className={styles.metricsRow}>
        <Col xs={24} sm={12} lg={8}>
          <div
            className={styles.summaryCard}
            data-testid="summary-card-kickoff"
          >
            <div className={styles.cardHeader}>
              <div className={styles.iconSurface} style={{ background: '#EFF6FF', color: '#2563EB' }}>
                <ClockCircleOutlined />
              </div>
              <span className={styles.cardLabel}>SPK Menunggu Kick-off</span>
            </div>
            <div className={styles.cardValueRow}>
              <div className={styles.cardValue}>
                {loading ? <Spin size="small" /> : pendingKickoff.length}
                <span className={styles.cardUnit}>SPK</span>
              </div>
              <div className={styles.cardSubtext}>
                Antrean penugasan PM & perencanaan operasional
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <div
            className={styles.summaryCard}
            data-testid="summary-card-active"
          >
            <div className={styles.cardHeader}>
              <div className={styles.iconSurface} style={{ background: '#F0FDF4', color: '#16A34A' }}>
                <ProjectOutlined />
              </div>
              <span className={styles.cardLabel}>Proyek Berjalan (Active)</span>
            </div>
            <div className={styles.cardValueRow}>
              <div className={styles.cardValue}>
                {loading ? <Spin size="small" /> : activeProjects.length}
                <span className={styles.cardUnit}>Proyek</span>
              </div>
              <div className={styles.cardSubtext}>
                Proyek aktif dalam fase pelaksanaan lapangan
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={24} lg={8}>
          <div
            className={styles.summaryCard}
            data-testid="summary-card-completed"
          >
            <div className={styles.cardHeader}>
              <div className={styles.iconSurface} style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                <CheckCircleOutlined />
              </div>
              <span className={styles.cardLabel}>Proyek Selesai</span>
            </div>
            <div className={styles.cardValueRow}>
              <div className={styles.cardValue}>
                {loading ? <Spin size="small" /> : completedProjects.length}
                <span className={styles.cardUnit}>Proyek</span>
              </div>
              <div className={styles.cardSubtext}>
                Proyek resmi ditutup &amp; serah terima selesai
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Main Tabs Workspace */}
      <div className={styles.tabsCard}>
        {/* Dedicated Mobile Toolbar (search only, inert filter removed) */}
        <div className={styles.mobileToolbar}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
            placeholder="Cari proyek, klien, atau PM..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: '100%', borderRadius: 8, height: 36, fontSize: 13 }}
            data-testid="mobile-project-search"
          />
        </div>

        <Tabs
          data-testid="project-delivery-tabs"
          className={styles.deliveryTabs}
          activeKey={activeTab}
          onChange={handleTabChange}
          tabBarExtraContent={{
            right: (
              <div className={styles.desktopExtraContent}>
                <Input
                  prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                  placeholder="Cari proyek, klien, atau PM..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  style={{ width: 230, borderRadius: 6, height: 32, fontSize: 13 }}
                  data-testid="desktop-project-search"
                />
              </div>
            ),
          }}
          items={[
            {
              key: '1',
              label: (
                <Space size={6} className={styles.tabHeaderContent}>
                  <ClockCircleOutlined />
                  <span className={styles.tabTextFull}>Antrean Kick-off Charter</span>
                  <span className={styles.tabTextShort}>Kick-off</span>
                  <span className={`${styles.tabBadge} ${activeTab === '1' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                    {pendingKickoff.length}
                  </span>
                </Space>
              ),
              children: (
                <div className={styles.tableContainer}>
                  {/* Desktop Table View */}
                  <div className={styles.desktopTableWrapper}>
                    <Table
                      className={styles.deliveryTable}
                      dataSource={filteredPendingKickoff}
                      columns={pendingColumns}
                      rowKey="id"
                      loading={loading}
                      pagination={false}
                      size="middle"
                      scroll={{ x: 1100 }}
                      rowClassName={(record: ProjectCharter) => {
                        const cidNum = contractIdParam ? Number(contractIdParam) : null;
                        const isFocused = cidNum && (Number(record.contractId) === cidNum || Number(record.id) === cidNum);
                        return isFocused ? 'ant-table-row-selected' : '';
                      }}
                    />
                  </div>
                  {/* Mobile Card List View */}
                  <div className={styles.mobileCardsWrapper} data-testid="mobile-pending-cards">
                    {filteredPendingKickoff.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}>
                        <Empty
                          description="Tidak ada SPK dalam antrean kick-off"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    ) : (
                      filteredPendingKickoff.map((record) => renderPendingMobileCard(record))
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: '2',
              label: (
                <Space size={6} className={styles.tabHeaderContent}>
                  <ProjectOutlined />
                  <span className={styles.tabTextFull}>Daftar Proyek Berjalan</span>
                  <span className={styles.tabTextShort}>Berjalan</span>
                  <span className={`${styles.tabBadge} ${activeTab === '2' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                    {activeProjects.length}
                  </span>
                </Space>
              ),
              children: (
                <div className={styles.tableContainer} data-testid="active-projects-table">
                  {/* Desktop Table View */}
                  <div className={styles.desktopTableWrapper}>
                    <Table
                      className={styles.deliveryTable}
                      dataSource={filteredActiveProjects}
                      columns={activeColumns}
                      rowKey="id"
                      loading={loading}
                      pagination={false}
                      size="middle"
                      scroll={{ x: 1150 }}
                    />
                  </div>
                  {/* Mobile Card List View */}
                  <div className={styles.mobileCardsWrapper} data-testid="mobile-active-cards">
                    {filteredActiveProjects.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}>
                        <Empty
                          description="Tidak ada proyek berjalan"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    ) : (
                      filteredActiveProjects.map((record) => renderActiveMobileCard(record))
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: '3',
              label: (
                <Space size={6} className={styles.tabHeaderContent}>
                  <CheckCircleOutlined />
                  <span className={styles.tabTextFull}>Proyek Selesai</span>
                  <span className={styles.tabTextShort}>Selesai</span>
                  <span className={`${styles.tabBadge} ${activeTab === '3' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                    {completedProjects.length}
                  </span>
                </Space>
              ),
              children: (
                <div className={styles.tableContainer} data-testid="completed-projects-table">
                  {/* Desktop Table View */}
                  <div className={styles.desktopTableWrapper}>
                    <Table
                      className={styles.deliveryTable}
                      dataSource={filteredCompletedProjects}
                      columns={completedColumns}
                      rowKey="id"
                      loading={loading}
                      pagination={false}
                      size="middle"
                      scroll={{ x: 1150 }}
                    />
                  </div>
                  {/* Mobile Card List View */}
                  <div className={styles.mobileCardsWrapper} data-testid="mobile-completed-cards">
                    {filteredCompletedProjects.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}>
                        <Empty
                          description="Tidak ada proyek selesai"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    ) : (
                      filteredCompletedProjects.map((record) => renderCompletedMobileCard(record))
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  )}

      {/* Modal Penugasan PM (PMO) / Formal Kick-off */}
      <Modal
        title={
          <Space>
            <ProjectOutlined style={{ color: '#1677ff' }} />
            <Text strong style={{ fontSize: 15, color: '#1f2937' }}>
              {isFormalKickoffMode ? 'Formal Kick-off Proyek (Aktivasi ke IN_PROGRESS)' : 'Penugasan Project Manager (PMO)'}
            </Text>
          </Space>
        }
        open={isClaimModalVisible}
        onCancel={() => setIsClaimModalVisible(false)}
        onOk={() => claimForm.submit()}
        okText={isFormalKickoffMode ? "Formal Kickoff" : "Tugaskan PM"}
        cancelText="Batal"
        confirmLoading={submittingClaim}
        okButtonProps={{ style: { backgroundColor: '#1677ff', borderColor: '#1677ff' } }}
      >
        <Form form={claimForm} layout="vertical" onFinish={handleClaimSubmit} style={{ marginTop: 12 }}>
          {isFormalKickoffMode ? (
            <>
              <Form.Item label="Nama Proyek (SPK Verified)">
                <Input value={selectedCharter?.project_name} disabled style={{ color: '#1f2937', fontWeight: 600 }} />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Nilai SPK Legal">
                    <Input
                      value={formatCurrency(selectedCharter?.contract_total_value)}
                      disabled
                      style={{ color: '#1d4ed8', fontWeight: 600 }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Estimasi Budget Proyek">
                    <Input
                      value={formatCurrency(selectedCharter?.project_budget ?? selectedCharter?.contract_total_value)}
                      disabled
                      style={{ color: '#059669', fontWeight: 600 }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Baseline Jadwal Proyek (Approved Schedule / Gantt SSOT) - READ-ONLY */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 13, color: '#334155' }}>
                    Baseline Jadwal Proyek
                  </Text>
                  <Tag color="blue" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                    Approved Schedule / Gantt (Read-Only)
                  </Tag>
                </div>
                
                {loadingSchedule ? (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <Spin size="small" />
                  </div>
                ) : (
                  <div>
                    <Row gutter={12}>
                      <Col span={12}>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2 }}>Baseline Mulai:</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                          {charterSchedule?.earliestStart ? dayjs(charterSchedule.earliestStart).format('DD MMM YYYY') : '-'}
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2 }}>Baseline Selesai:</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                          {charterSchedule?.latestEnd ? dayjs(charterSchedule.latestEnd).format('DD MMM YYYY') : '-'}
                        </div>
                      </Col>
                    </Row>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                      Sumber: Rencana Kerja & Schedule yang telah disetujui pada Management Review ({charterSchedule?.totalDuration || 0} hari kalender).
                    </div>
                  </div>
                )}
              </div>

              {/* Tanggal Formal Kickoff (Actual Start Date) */}
              <Form.Item
                name="kickoffDate"
                label="Tanggal Formal Kickoff (Actual Kickoff Date)"
                rules={[{ required: true, message: 'Harap tentukan tanggal formal kickoff proyek!' }]}
                extra="Tanggal pencatatan resmi dimulainya fase eksekusi proyek oleh Project Manager."
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item
                label="Project Manager"
                extra="Penugasan resmi Project Manager yang bertanggung jawab atas perencanaan dan eksekusi proyek (Read-Only)."
              >
                <Input
                  value={selectedCharter?.pmName ?? (user as any)?.fullName ?? 'Belum Ditugaskan'}
                  disabled
                  style={{ color: '#1e293b', fontWeight: 600, backgroundColor: '#f8fafc' }}
                />
              </Form.Item>
            </>
          ) : (
            <>
              {/* 1. Nama Proyek (Read-only) */}
              <Form.Item label="Nama Proyek (SPK Verified)">
                <Input value={selectedCharter?.project_name} disabled style={{ color: '#1f2937', fontWeight: 600 }} />
              </Form.Item>

              {/* 2 & 3. Nomor Contract / SPK & Client / Customer (Read-only) */}
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Nomor Kontrak / SPK">
                    <Input
                      value={selectedCharter?.project_code || '-'}
                      disabled
                      style={{ color: '#334155', fontWeight: 600 }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Client / Customer">
                    <Input
                      value={selectedCharter?.customerName || '-'}
                      disabled
                      style={{ color: '#334155', fontWeight: 600 }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* 4. Nilai SPK Legal (Read-only) */}
              <Form.Item label="Nilai SPK Legal">
                <Input
                  value={formatCurrency(selectedCharter?.contract_total_value)}
                  disabled
                  style={{ color: '#1d4ed8', fontWeight: 600 }}
                />
              </Form.Item>

              {/* 5. Project Manager (Select Dropdown for PMO) */}
              <Form.Item
                name="projectManagerId"
                label="Project Manager"
                rules={[{ required: true, message: 'Harap pilih Project Manager yang akan ditugaskan!' }]}
                extra="Pilih Project Manager aktif yang akan ditugaskan memimpin perencanaan dan eksekusi proyek."
              >
                <Select
                  placeholder="Pilih Project Manager..."
                  loading={loadingPms}
                  showSearch
                  optionFilterProp="label"
                  options={eligiblePms.map((pm) => ({
                    value: pm.id,
                    label: `${pm.fullName} (${pm.email})`,
                  }))}
                />
              </Form.Item>

              {/* 6. Info message */}
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 8, marginBottom: 8 }}
                message={
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1e40af' }}>
                    Project akan tetap berada pada status <strong>PLANNING</strong>. Setelah penugasan berhasil, Project Manager yang ditugaskan akan menjadi penanggung jawab penyusunan Cost/RAB, WBS, Schedule/Gantt, dan Initial Condition di Project Workspace.
                  </div>
                }
              />
            </>
          )}
        </Form>
      </Modal>

      {/* Modal Reject Charter (Kembalikan ke Marketing) */}
      {/* Return to Marketing Confirmation Modal */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#d97706', fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Kembalikan ke Marketing?</span>
          </Space>
        }
        open={isRejectModalVisible}
        onCancel={() => setIsRejectModalVisible(false)}
        onOk={handleRejectSubmit}
        okText="Kembalikan ke Marketing"
        cancelText="Batal"
        confirmLoading={submittingReject}
        okButtonProps={{ style: { backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 600 } }}
        width={540}
      >
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Guidance Card: Kapan digunakan? */}
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '14px 16px',
            }}
          >
            <Space align="center" size={8} style={{ marginBottom: 6 }}>
              <WarningOutlined style={{ color: '#d97706', fontSize: 15 }} />
              <Text style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>
                Kapan digunakan?
              </Text>
            </Space>
            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 6px 0' }}>
                Gunakan pengembalian ini untuk <strong>masalah komersial</strong>, <strong>perubahan scope customer</strong>, atau <strong>kebutuhan revisi kontrak</strong>.
              </p>
              <p style={{ margin: 0, color: '#92400e' }}>
                Untuk koreksi <strong>estimasi biaya</strong>, <strong>WBS</strong>, atau <strong>jadwal internal</strong>, lakukan revisi langsung pada PM Operational Plan.
              </p>
            </div>
          </div>

          <div>
            <Text strong style={{ fontSize: 12.5, display: 'block', marginBottom: 6, color: '#334155' }}>
              Alasan Pengembalian (Wajib Diisi):
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="Jelaskan masalah commercial/contract yang perlu ditindaklanjuti Marketing..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={400}
              showCount
            />
            {rejectReason && rejectReason.trim().length < 15 && (
              <Text type="danger" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                Alasan pengembalian minimal 15 karakter ({rejectReason.trim().length}/15).
              </Text>
            )}
          </div>
        </div>
      </Modal>

      {/* Project Detail Drawer */}
      {isDetailDrawerOpen && (
        <ProjectDetailDrawer
          open={isDetailDrawerOpen}
          initialTabKey={detailDrawerInitialTab}
          onClose={() => {
            setIsDetailDrawerOpen(false);
            setSelectedProjectForDetail(null);
          }}
          project={
            selectedProjectForDetail
              ? {
                  ...selectedProjectForDetail,
                  created_at: selectedProjectForDetail.created_at || new Date().toISOString(),
                }
              : null
          }
          onOpenOperationalPlan={(p) => {
            handleOpenOperationalPlan(p);
          }}
          onOpenWorkspaceSection={(p, section) => {
            setIsDetailDrawerOpen(false);
            setSelectedProjectForDetail(null);
            handleOpenProjectWorkspace(p, section as any);
          }}
        />
      )}

      {/* PM Cost Estimation & Budget Review Modal */}
      {isEstimateModalVisible && selectedCharterForEstimate && (
        <PmCostEstimationModal
          open={isEstimateModalVisible}
          onClose={() => {
            setIsEstimateModalVisible(false);
            setSelectedCharterForEstimate(null);
          }}
          charter={selectedCharterForEstimate}
        />
      )}

      {/* PM Pre-Kickoff Work Breakdown Structure (WBS) Modal */}
      {isWbsModalVisible && selectedCharterForWbs && (
        <WbsTreeTableModal
          open={isWbsModalVisible}
          onClose={() => {
            setIsWbsModalVisible(false);
            setSelectedCharterForWbs(null);
          }}
          charter={selectedCharterForWbs}
        />
      )}

      {/* PM Unified Operational Plan Workspace Modal */}
      {isOperationalPlanOpen && selectedCharterForPlan && (
        <PmOperationalPlanModal
          open={isOperationalPlanOpen}
          onClose={() => {
            setIsOperationalPlanOpen(false);
            setSelectedCharterForPlan(null);
            void fetchBoardData();
          }}
          charter={selectedCharterForPlan}
          onRefreshParent={() => {
            void fetchBoardData();
          }}
        />
      )}

      {/* PM Procurement Package Authoring Modal (Phase 4 Canonical) */}
      {isPackageModalOpen && selectedCharterForPackage && (
        <PmProcurementPackageModal
          open={isPackageModalOpen}
          packageFamily={packageModalFamily}
          onClose={() => {
            setIsPackageModalOpen(false);
            setSelectedCharterForPackage(null);
          }}
          project={selectedCharterForPackage}
          onRefreshParent={() => fetchBoardData()}
        />
      )}

      {/* PM Service Claim Technical Verification Modal (R1 Canonical) */}
      {isServiceClaimModalOpen && (
        <PmServiceClaimVerificationModal
          open={isServiceClaimModalOpen}
          claimId={selectedClaimIdForModal}
          projectId={
            selectedProjectForServiceClaim
              ? Number(selectedProjectForServiceClaim.projectId || selectedProjectForServiceClaim.id)
              : projectIdParam
              ? Number(projectIdParam)
              : undefined
          }
          onClose={() => {
            setIsServiceClaimModalOpen(false);
            setSelectedClaimIdForModal(null);
            setSelectedProjectForServiceClaim(null);
          }}
          onSuccess={() => {
            void fetchBoardData();
          }}
        />
      )}
    </div>
  );
};
