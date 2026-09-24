'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  RollbackOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProjectService, ProcurementService, EligiblePmItem } from '@/services';
import { useAuth } from '../context/AuthContext';
import { ProjectDetailDrawer } from './project/ProjectDetailDrawer';
import { PmCostEstimationModal } from './project/PmCostEstimationModal';
import { WbsTreeTableModal, countLeafNodes } from './project/WbsTreeTableModal';
import { PmOperationalPlanModal } from './project/PmOperationalPlanModal';
import { PmProcurementPackageModal } from './project/PmProcurementPackageModal';
import { detectCircularDependencies, ScheduleTaskItem } from './project/ScheduleGanttTab';
import { getInitialCondition, isInitialConditionComplete } from './project/ProjectInitialConditionModal';

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
  projectManagerId?: number | null;
  project_manager_id?: number | null;
  status: 'PENDING_KICKOFF' | 'IN_PROGRESS' | 'COMPLETED' | string;
  projectStatus?: string;
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

  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('projectId');
  const actionParam = searchParams.get('action');
  const autoOpenedPlanRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingKickoff, setPendingKickoff] = useState<ProjectCharter[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProjectCharter[]>([]);
  const [localRefreshKey, setLocalRefreshKey] = useState<number>(0);
  const [readinessMap, setReadinessMap] = useState<Record<number, ProjectReadinessEntry>>({});
  const [readinessLoading, setReadinessLoading] = useState<boolean>(false);
  const [projectPrMap, setProjectPrMap] = useState<Record<number, any>>({});

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

  // PM Procurement Package Modal State (Phase 4 Canonical)
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [selectedCharterForPackage, setSelectedCharterForPackage] = useState<ProjectCharter | null>(null);

  const handleOpenPackageModal = (charter: ProjectCharter) => {
    setSelectedCharterForPackage(charter);
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
    const entry = readinessMap[pid];

    // 1. Loading: Show only while request is in-flight and no entry exists yet
    if (readinessLoading && !entry) {
      return (
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          ○ MEMUAT STATUS...
        </Tag>
      );
    }

    // 2. Error / Unavailable: Request failed (404, 500, network error) or invalid payload
    if (!entry) {
      return (
        <Tooltip title="Status Operational Plan belum tersedia.">
          <Tag color="error" style={{ fontWeight: 600, borderRadius: 6 }}>
            STATUS TIDAK TERSEDIA
          </Tag>
        </Tooltip>
      );
    }

    if (entry.status === 'ERROR') {
      const errorMsg = entry.message || 'Gagal memuat status Operational Plan.';
      return (
        <Tooltip title={`${errorMsg} Silakan coba muat ulang atau hubungi administrator.`}>
          <Tag color="error" style={{ fontWeight: 600, borderRadius: 6 }}>
            STATUS TIDAK TERSEDIA
          </Tag>
        </Tooltip>
      );
    }

    // 3. Success: Authoritative Business State from Database SSOT API
    const readiness = entry.data;
    const gate = readiness?.gate;
    const gateStatus = gate?.status;
    const currentStage = gate?.currentStage || readiness?.workflow?.currentStage;
    const currentNodeId = gate?.currentNodeId || readiness?.workflow?.currentNodeId;
    const count = readiness?.completenessCount ?? 0;
    const downstreamPr = projectPrMap[pid];
    const isProjectActive =
      charter.status === 'IN_PROGRESS' ||
      charter.projectStatus === 'IN_PROGRESS' ||
      currentStage === 'ACTIVE';

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

    if (currentStage === 'UNKNOWN_WORKFLOW_STATE' || gateStatus === 'UNKNOWN_WORKFLOW_STATE') {
      return (
        <Tooltip title="Status workflow tidak dikenali. Periksa alur kerja di Workflow Engine.">
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>
            Status Tidak Dikenali
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'READY_FOR_KICKOFF' || gateStatus === 'READY_FOR_KICKOFF' || currentNodeId === 'node_end') {
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

    if (currentStage === 'NEEDS_REVISION' || gateStatus === 'NEEDS_REVISION' || currentNodeId?.startsWith('node_pm_revision')) {
      return (
        <Tooltip title={gate?.revisionNotes ? `Permintaan Revisi Manajemen: ${gate.revisionNotes}` : "Permintaan Revisi Manajemen (Database SSOT)"}>
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>
            NEEDS REVISION
          </Tag>
        </Tooltip>
      );
    }

    // Canonical Review Stages
    if (currentStage === 'REVIEW_HOPS' || currentNodeId === 'node_hops_review') {
      return (
        <Tooltip title="Operational Plan diajukan oleh PM dan sedang menunggu review Head of Operations (Tahap 1 Governance)">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW HEAD OF OPS
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_PROCUREMENT' || currentNodeId === 'node_procurement_review') {
      return (
        <Tooltip title="Operational Plan telah disetujui HOPS dan sedang direview oleh Procurement (Tahap 2 Governance)">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW PROCUREMENT
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_FINANCE' || currentNodeId === 'node_finance_review') {
      return (
        <Tooltip title="Operational Plan telah disetujui Procurement dan sedang dievaluasi oleh Finance (Tahap 3 Governance)">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW FINANCE
          </Tag>
        </Tooltip>
      );
    }

    if (currentStage === 'REVIEW_DIRECTOR' || currentNodeId === 'node_director_approval') {
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
    if (gateStatus === 'REVIEW_PENDING') {
      return (
        <Tooltip title="Operational Plan diajukan oleh PM dan sedang dalam peninjauan tata kelola manajemen">
          <Tag color="processing" style={{ fontWeight: 700, borderRadius: 6 }}>
            REVIEW PENDING
          </Tag>
        </Tooltip>
      );
    }

    // Legacy READY_FOR_PROCUREMENT fallback
    if (gateStatus === 'READY_FOR_PROCUREMENT') {
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
    if (count === 4 || currentStage === 'READY_TO_SUBMIT') {
      return (
        <Tooltip title="Cost Estimate, WBS (100% Bobot), Schedule Terjadwal Penuh, Kondisi Awal Proyek — Operational Plan Lengkap (4/4 Siap Review)">
          <Tag color="success" style={{ fontWeight: 700, borderRadius: 6 }}>
            Complete Readiness
          </Tag>
        </Tooltip>
      );
    } else if (count > 0 || currentStage === 'INCOMPLETE') {
      return (
        <Tooltip title={`Operational Plan Belum Lengkap (${count}/4 Pilar). Dihitung dari Database SSOT.`}>
          <Tag color="warning" style={{ fontWeight: 700, borderRadius: 6 }}>
            {count}/4 INCOMPLETE
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
    if (!charter.projectId || Number(charter.projectId) <= 0) {
      return (
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          ANTREAN KICKOFF
        </Tag>
      );
    }

    const pid = Number(charter.projectId);
    const entry = readinessMap[pid];
    const downstreamPr = projectPrMap[pid];

    if (readinessLoading && !entry) {
      return (
        <Tag color="default" style={{ fontWeight: 500, borderRadius: 6 }}>
          ○ MEMUAT...
        </Tag>
      );
    }

    const readiness = entry?.status === 'SUCCESS' ? entry.data : null;
    const gate = readiness?.gate;
    const gateStatus = gate?.status;
    const currentStage = gate?.currentStage || readiness?.workflow?.currentStage;
    const currentNodeId = gate?.currentNodeId || readiness?.workflow?.currentNodeId;
    const count = readiness?.completenessCount ?? 0;
    const isProjectActive =
      charter.status === 'IN_PROGRESS' ||
      charter.projectStatus === 'IN_PROGRESS' ||
      currentStage === 'ACTIVE';

    // 1. ACTIVE: Proyek Berjalan
    if (isProjectActive) {
      return (
        <Tag color="success" style={{ fontWeight: 600, borderRadius: 6 }}>
          PROYEK BERJALAN
        </Tag>
      );
    }

    if (currentStage === 'UNKNOWN_WORKFLOW_STATE' || gateStatus === 'UNKNOWN_WORKFLOW_STATE') {
      return (
        <Tooltip title="Status workflow tidak dikenali. Periksa alur kerja di Workflow Engine.">
          <Tag color="error" style={{ fontWeight: 700, borderRadius: 6 }}>
            Status Tidak Dikenali
          </Tag>
        </Tooltip>
      );
    }

    // 2. READY_FOR_KICKOFF: Menunggu Kickoff PM
    if (currentStage === 'READY_FOR_KICKOFF' || gateStatus === 'READY_FOR_KICKOFF' || currentNodeId === 'node_end') {
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
    if (currentStage === 'NEEDS_REVISION' || gateStatus === 'NEEDS_REVISION' || currentNodeId?.startsWith('node_pm_revision')) {
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

    // General REVIEW_PENDING fallback
    if (gateStatus === 'REVIEW_PENDING') {
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
    if (count === 4 || currentStage === 'READY_TO_SUBMIT') {
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

  const handleOpenDetailDrawer = (project: ProjectCharter) => {
    setSelectedProjectForDetail(project);
    setIsDetailDrawerOpen(true);
  };

  useEffect(() => {
    fetchBoardData();
  }, [refreshTrigger, localRefreshKey]);

  // Canonical Phase G Cross-User Synchronization & Reconnect Resync
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (
        detail.aggregateType === 'Project' &&
        (detail.eventName === 'project.pm.assigned' || detail.eventName === 'project.kickoff.executed')
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
  }, []);

  const fetchBoardData = async () => {
    setLoading(true);
    setReadinessLoading(true);
    try {
      const boardData = await ProjectService.getOperationalBoard();
      let pending: ProjectCharter[] = boardData.pendingKickoff || [];
      const isManagement = isPmoUser || isSuperAdmin || isDirectorUser;
      if (!isManagement) {
        // Project Manager workspace should never display unassigned contracts
        pending = pending.filter((item: ProjectCharter) => {
          const pmId = item.managerId ?? item.projectManagerId ?? (item as any).project_manager_id;
          return pmId && Number(pmId) === Number(user?.sub);
        });
      }
      const active: ProjectCharter[] = boardData.activeProjects || [];
      setPendingKickoff(pending);
      setActiveProjects(active);

      // Async fetch live operational readiness for all canonical projects (Project.id SSOT).
      const allPids = Array.from(
        new Set(
          [...active, ...pending]
            .map((p) => (p.projectId ? Number(p.projectId) : 0))
            .filter((pid) => pid > 0)
        )
      );

      const readinessPromises = allPids.map(async (pid) => {
        try {
          const r = await ProjectService.getOperationalReadiness(pid);
          if (r && typeof r === 'object' && 'totalPillars' in r) {
            return { id: pid, entry: { status: 'SUCCESS' as const, data: r } };
          }
          return {
            id: pid,
            entry: { status: 'ERROR' as const, message: 'Format data kesiapan operasional tidak valid.' },
          };
        } catch (e: any) {
          const msg = e?.response?.data?.message || e?.message || 'Gagal memuat status Operational Plan.';
          return { id: pid, entry: { status: 'ERROR' as const, error: e, message: msg } };
        }
      });
      const results = await Promise.all(readinessPromises);
      const newMap: Record<number, ProjectReadinessEntry> = {};
      for (const res of results) {
        newMap[res.id] = res.entry;
      }
      setReadinessMap(newMap);

      // Async fetch downstream Purchase Requests to project PR & workflow status alongside readiness
      try {
        const allPrs = await ProcurementService.getPurchaseRequests();
        const prMap: Record<number, any> = {};
        if (Array.isArray(allPrs)) {
          for (const pr of allPrs) {
            const prPid = Number(pr.projectId || pr.project_id || (pr as any).project?.id);
            if (prPid > 0) {
              prMap[prPid] = pr;
            }
          }
        }
        setProjectPrMap(prMap);
      } catch (prErr) {
        console.error('Failed to load downstream PRs for Operational Board:', prErr);
      }
    } catch (err) {
      setPendingKickoff([]);
      setActiveProjects([]);
    } finally {
      setLoading(false);
      setReadinessLoading(false);
    }
  };

  // Deep-link support: auto open PM Operational Plan modal if action=operational-plan
  useEffect(() => {
    if (actionParam !== 'operational-plan' || !projectIdParam || loading) return;
    if (autoOpenedPlanRef.current === projectIdParam) return;

    const pidNum = Number(projectIdParam);
    if (!Number.isFinite(pidNum) || pidNum <= 0) return;

    const allCharters = [...pendingKickoff, ...activeProjects];
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

    return () => {
      isCancelled = true;
    };
  }, [actionParam, projectIdParam, pendingKickoff, activeProjects, loading]);

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
        // CASE 1: Dedicated PMO PM Assignment (PMO Queue -> PLANNING)
        const canonicalId = selectedCharter.project_code || selectedCharter.projectId || selectedCharter.id;
        await ProjectService.assignProjectManager(canonicalId, {
          projectManagerId: Number(values.projectManagerId),
        });
        message.success(`Project Manager berhasil ditugaskan ke Proyek #${selectedCharter.project_code}!`);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || (isFormalKickoffMode ? 'Gagal melakukan Formal Kickoff' : 'Gagal menugaskan Project Manager');
      message.error(errMsg);
    } finally {
      await fetchBoardData();
      setSubmittingClaim(false);
      setIsClaimModalVisible(false);
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
      setPendingKickoff((prev) => prev.filter((p) => p.id !== selectedCharter.id));
      setSubmittingReject(false);
      setIsRejectModalVisible(false);
    }
  };



  const activeColumns = [
    {
      title: 'Kode & Proyek',
      key: 'project',
      render: (_: any, record: ProjectCharter) => (
        <Space
          direction="vertical"
          size={2}
          style={{ cursor: 'pointer' }}
          onClick={() => handleOpenDetailDrawer(record)}
        >
          <Text strong style={{ color: '#1d4ed8', fontSize: 13, textDecoration: 'none' }}>
            {record.project_name}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Kode: <Tag color="blue" style={{ fontSize: 10 }}>{record.project_code}</Tag>
          </Text>
        </Space>
      ),
    },
    {
      title: 'Klien (Customer)',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (val: string | null) => <Text style={{ fontSize: 12, fontWeight: 500 }}>{val ?? '-'}</Text>,
    },
    {
      title: 'Nilai Kontrak',
      dataIndex: 'contract_total_value',
      key: 'contract_total_value',
      render: (val: number | null) => (
        <Text strong style={{ color: val !== null && val !== undefined ? '#059669' : '#64748b', fontSize: 13 }}>
          {val !== null && val !== undefined ? `Rp ${Number(val).toLocaleString('id-ID')}` : '-'}
        </Text>
      ),
    },
    {
      title: 'Project Manager (PM)',
      dataIndex: 'pmName',
      key: 'pmName',
      render: (val: string | null) => (
        <Space size={4}>
          <UserOutlined style={{ color: val ? '#3b82f6' : '#9ca3af' }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: val ? '#1f2937' : '#6b7280' }}>
            {val ?? 'Belum Ditugaskan'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Progress Operasional WBS',
      key: 'progress',
      render: (_: any, record: ProjectCharter) => (
        <div style={{ width: 140 }}>
          <Progress percent={record.overallProgress || 0} size="small" status="active" strokeColor="#10b981" />
        </div>
      ),
    },
    {
      title: 'Status Operational Plan',
      key: 'plan_status',
      width: 215,
      render: (_: any, record: ProjectCharter) => getOperationalPlanStatusTag(record),
    },
    {
      title: 'Health Status',
      key: 'health',
      render: () => <Tag color="default" style={{ borderRadius: 10 }}>Belum Tersedia</Tag>,
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 195,
      render: (_: any, record: ProjectCharter) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetailDrawer(record);
            }}
            style={{ borderRadius: 6, fontWeight: 500 }}
          >
            Detail
          </Button>
          <Button
            size="small"
            icon={<ShoppingCartOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPackageModal(record);
            }}
            style={{
              borderRadius: 6,
              fontWeight: 500,
              borderColor: '#93c5fd',
              color: '#1d4ed8',
              background: '#eff6ff',
            }}
          >
            Paket Pengadaan
          </Button>
        </Space>
      ),
    },
  ];

  const pendingColumns = [
    {
      title: 'Kode & Nama SPK',
      key: 'spk',
      render: (_: any, record: ProjectCharter) => (
        <Space
          direction="vertical"
          size={2}
          style={{ cursor: 'pointer' }}
          onClick={() => handleOpenDetailDrawer(record)}
        >
          <Text strong style={{ color: '#1d4ed8', fontSize: 13 }}>{record.project_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Ref ID: <Tag color="cyan" style={{ fontSize: 10 }}>{record.project_code}</Tag></Text>
        </Space>
      ),
    },
    {
      title: 'Klien',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (val: string | null) => <Text style={{ fontSize: 12 }}>{val ?? '-'}</Text>,
    },
    {
      title: 'Nilai SPK Legal',
      dataIndex: 'contract_total_value',
      key: 'contract_total_value',
      render: (val: number | null) => (
        <Text strong style={{ color: val !== null && val !== undefined ? '#1d4ed8' : '#64748b', fontSize: 13 }}>
          {val !== null && val !== undefined ? `Rp ${Number(val).toLocaleString('id-ID')}` : '-'}
        </Text>
      ),
    },
    {
      title: 'Estimasi Budget Proyek',
      dataIndex: 'project_budget',
      key: 'project_budget',
      render: (val: number | null, record: ProjectCharter) => {
        const budget =
          val !== null && val !== undefined
            ? Number(val)
            : record.contract_total_value !== null && record.contract_total_value !== undefined
            ? Number(record.contract_total_value)
            : null;
        const hasBoth =
          budget !== null &&
          record.contract_total_value !== null &&
          record.contract_total_value !== undefined;
        const isAdjusted = hasBoth && budget !== Number(record.contract_total_value);
        return (
          <Space direction="vertical" size={2}>
            <Text strong style={{ color: budget !== null ? '#059669' : '#64748b', fontSize: 13 }}>
              {budget !== null ? `Rp ${budget.toLocaleString('id-ID')}` : '-'}
            </Text>
            {isAdjusted && (
              <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px', borderRadius: 4 }}>
                Penyesuaian RAB
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Inisiator Marketing',
      dataIndex: 'marketingName',
      key: 'marketingName',
      render: (val: string | null) => <Text style={{ fontSize: 12, color: '#4b5563' }}>{val ?? '-'}</Text>,
    },
    {
      title: 'Project Manager (PM)',
      dataIndex: 'pmName',
      key: 'pmName',
      width: 170,
      render: (val: string | null, record: ProjectCharter) => {
        const isSelf = user?.sub && record.managerId && Number(record.managerId) === Number(user.sub);
        if (!val && !record.managerId) {
          return (
            <Tag color="default" style={{ margin: 0, padding: '1px 6px', fontSize: 11, borderRadius: 4 }}>
              Belum Ditugaskan
            </Tag>
          );
        }
        return (
          <Space direction="vertical" size={1}>
            <Space size={4}>
              <UserOutlined style={{ color: '#3b82f6', fontSize: 12 }} />
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
                {val || 'Project Manager'}
              </Text>
            </Space>
            {isSelf && (
              <Tag color="green" style={{ margin: 0, padding: '0 4px', fontSize: 10, lineHeight: '16px', borderRadius: 4 }}>
                Project ditugaskan kepada Anda
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Status Operational Plan',
      key: 'plan_status',
      width: 215,
      render: (_: any, record: ProjectCharter) => getOperationalPlanStatusTag(record),
    },
    {
      title: 'Status Handover',
      key: 'status',
      width: 210,
      render: (_: any, record: ProjectCharter) => getHandoverStatusTag(record),
    },
    {
      title: 'Aksi PMO / PM',
      key: 'action',
      width: 190,
      render: (_: any, record: ProjectCharter) => {
        const pid = record.projectId ? Number(record.projectId) : 0;
        const readinessEntry = pid > 0 ? readinessMap[pid] : null;
        const gateStatus = readinessEntry?.status === 'SUCCESS' ? readinessEntry.data?.gate?.status : null;
        const currentStage = readinessEntry?.status === 'SUCCESS' ? (readinessEntry.data?.gate?.currentStage || readinessEntry.data?.workflow?.currentStage) : null;
        const isReadyForKickoff = gateStatus === 'READY_FOR_KICKOFF' || currentStage === 'READY_FOR_KICKOFF';
        const recordPmId = record.managerId ?? record.projectManagerId ?? (record as any).project_manager_id ?? null;
        const hasAssignedPm = Boolean(recordPmId || record.pmName);
        const isAssignedPm = Boolean(user?.sub && recordPmId && Number(recordPmId) === Number(user.sub));
        const canFormalKickoff = isAssignedPm || isSuperAdmin;
        const canReject = hasAssignedPm && (isPmoUser || isSuperAdmin || isAssignedPm);

        const moreMenuItems: any[] = [
          {
            key: 'detail',
            icon: <EyeOutlined />,
            label: 'Lihat Detail',
            onClick: () => handleOpenDetailDrawer(record),
          },
        ];

        // Jika sudah READY FOR KICKOFF, Operational Plan berpindah ke dalam menu More (⋮)
        if (isReadyForKickoff && (isAssignedPm || isPmoUser || isSuperAdmin || isDirectorUser)) {
          moreMenuItems.push({
            key: 'operational-plan',
            icon: <ApartmentOutlined />,
            label: 'Operational Plan',
            onClick: () => handleOpenOperationalPlan(record),
          });
        }

        // Sembunyikan "Kembalikan ke Marketing" jika record belum memiliki PM
        if (canReject) {
          moreMenuItems.push(
            {
              type: 'divider',
            },
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            {/* 1. PRIMARY ACTION CONTEXTUAL (Fixed width 136px for perfect row-to-row alignment) */}
            {isReadyForKickoff ? (
              // Tahap READY FOR KICKOFF: Formal Kickoff adalah primary CTA
              <Tooltip
                placement="top"
                title={canFormalKickoff ? "Proyek siap untuk Formal Kickoff oleh PM." : "Hanya Project Manager yang ditugaskan yang berwenang."}
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleOpenFormalKickoffModal(record)}
                  disabled={!canFormalKickoff}
                  style={{
                    width: 136,
                    height: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: canFormalKickoff ? '#7c3aed' : undefined,
                    borderColor: canFormalKickoff ? '#7c3aed' : undefined,
                    borderRadius: 6,
                    fontWeight: 600,
                    boxShadow: canFormalKickoff ? '0 1px 2px 0 rgba(124, 58, 237, 0.2)' : undefined,
                  }}
                >
                  Formal Kickoff
                </Button>
              </Tooltip>
            ) : (!hasAssignedPm) ? (
              // Tahap UNASSIGNED: Penugasan PM oleh PMO
              isPmoUser ? (
                <Tooltip title="Tugaskan Project Manager ke proyek ini (Status: PLANNING)">
                  <Button
                    type="primary"
                    size="small"
                    icon={<UserOutlined />}
                    onClick={() => handleOpenClaimModal(record)}
                    style={{
                      width: 136,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#10b981',
                      borderColor: '#10b981',
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    Tugaskan PM
                  </Button>
                </Tooltip>
              ) : (
                <Tag color="orange" style={{ margin: 0, padding: '3px 8px', fontSize: 11.5, fontWeight: 500, borderRadius: 6 }}>
                  Menunggu penugasan PMO
                </Tag>
              )
            ) : (
              // Tahap BELUM READY: Operational Plan adalah direct primary action
              <Tooltip title={isAssignedPm ? "Project ditugaskan kepada Anda (Buka Operational Plan)" : "Buka PM Operational Plan Workspace"}>
                <Button
                  type="primary"
                  size="small"
                  icon={<ApartmentOutlined />}
                  onClick={() => handleOpenOperationalPlan(record)}
                  disabled={!isAssignedPm && !isPmoUser && !isSuperAdmin && !isDirectorUser}
                  style={{
                    width: 136,
                    height: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1d4ed8',
                    borderColor: '#1d4ed8',
                    color: '#ffffff',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  Operational Plan
                </Button>
              </Tooltip>
            )}

            {/* 2. MORE ACTIONS MENU (Fixed 28x28px compact square button) */}
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <Tooltip title="Aksi lainnya">
                <Button
                  size="small"
                  style={{
                    width: 28,
                    height: 28,
                    minWidth: 28,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    borderColor: '#cbd5e1',
                    color: '#475569',
                  }}
                >
                  <MoreOutlined style={{ fontSize: 14 }} />
                </Button>
              </Tooltip>
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
      {/* Header Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Space size={12}>
              <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8 }}>
                <ClockCircleOutlined style={{ fontSize: 22, color: '#3b82f6' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>SPK Menunggu Kick-off</Text>
                <Title level={3} style={{ margin: 0, color: '#1d4ed8' }}>
                  {pendingKickoff.length} <Text type="secondary" style={{ fontSize: 13 }}>SPK</Text>
                </Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Space size={12}>
              <div style={{ padding: 10, background: '#ecfdf5', borderRadius: 8 }}>
                <ProjectOutlined style={{ fontSize: 22, color: '#10b981' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Proyek Berjalan (Active)</Text>
                <Title level={3} style={{ margin: 0, color: '#047857' }}>
                  {activeProjects.length} <Text type="secondary" style={{ fontSize: 13 }}>Proyek</Text>
                </Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Space size={12}>
              <div style={{ padding: 10, background: '#f1f5f9', borderRadius: 8 }}>
                <RiseOutlined style={{ fontSize: 22, color: '#64748b' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Kinerja SPI / CPI Average</Text>
                <Title level={3} style={{ margin: 0, color: '#475569' }}>
                  N/A <Tag color="default" style={{ fontSize: 11, marginLeft: 6 }}>Belum Tersedia</Tag>
                </Title>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs Workspace */}
      <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '1',
              label: (
                <Space>
                  <ClockCircleOutlined />
                  <span>Antrean Kick-off Charter</span>
                  <Badge count={pendingKickoff.length} overflowCount={99} style={{ backgroundColor: '#f59e0b' }} />
                </Space>
              ),
              children: (
                <div style={{ paddingTop: 12 }}>
                  <Table
                    dataSource={pendingKickoff}
                    columns={pendingColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: '2',
              label: (
                <Space>
                  <ProjectOutlined />
                  <span>Daftar Proyek Berjalan</span>
                  <Badge count={activeProjects.length} overflowCount={99} style={{ backgroundColor: '#10b981' }} />
                </Space>
              ),
              children: (
                <div style={{ paddingTop: 12 }}>
                  <Table
                    dataSource={activeProjects}
                    columns={activeColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: '3',
              label: (
                <Space>
                  <LineChartOutlined />
                  <span>Grafik S-Curve EVM Performance</span>
                </Space>
              ),
              children: (
                <div style={{ paddingTop: 16 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Card
                        title="Earned Value Management (EVM) S-Curve Project Monitoring"
                        size="small"
                        style={{ borderRadius: 8 }}
                      >
                        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                              <Space direction="vertical" size={4}>
                                <Text strong style={{ color: '#334155', fontSize: 14 }}>
                                  Data S-Curve & EVM Belum Tersedia
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Kalkulasi Planned Value (PV), Earned Value (EV), serta Actual Cost (AC) dan kurva S performa proyek akan tersedia secara otomatis setelah sumber pencatatan progres eksekusi aktif.
                                </Text>
                              </Space>
                            }
                          />
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Penugasan PM (PMO) / Formal Kick-off */}
      <Modal
        title={
          <Space>
            <ProjectOutlined style={{ color: isFormalKickoffMode ? '#7c3aed' : '#10b981' }} />
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
        okButtonProps={{ style: { backgroundColor: isFormalKickoffMode ? '#7c3aed' : '#10b981', borderColor: isFormalKickoffMode ? '#7c3aed' : '#10b981' } }}
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
                      value={
                        selectedCharter?.contract_total_value !== null && selectedCharter?.contract_total_value !== undefined
                          ? `Rp ${Number(selectedCharter.contract_total_value).toLocaleString('id-ID')}`
                          : '-'
                      }
                      disabled
                      style={{ color: '#1d4ed8', fontWeight: 600 }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Estimasi Budget Proyek">
                    <Input
                      value={
                        selectedCharter?.project_budget !== null && selectedCharter?.project_budget !== undefined
                          ? `Rp ${Number(selectedCharter.project_budget).toLocaleString('id-ID')}`
                          : selectedCharter?.contract_total_value !== null && selectedCharter?.contract_total_value !== undefined
                          ? `Rp ${Number(selectedCharter.contract_total_value).toLocaleString('id-ID')}`
                          : '-'
                      }
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
                  value={
                    selectedCharter?.contract_total_value !== null && selectedCharter?.contract_total_value !== undefined
                      ? `Rp ${Number(selectedCharter.contract_total_value).toLocaleString('id-ID')}`
                      : '-'
                  }
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
      <ProjectDetailDrawer
        open={isDetailDrawerOpen}
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
      />

      {/* PM Cost Estimation & Budget Review Modal */}
      <PmCostEstimationModal
        open={isEstimateModalVisible}
        onClose={() => {
          setIsEstimateModalVisible(false);
          setSelectedCharterForEstimate(null);
        }}
        charter={selectedCharterForEstimate}
      />

      {/* PM Pre-Kickoff Work Breakdown Structure (WBS) Modal */}
      <WbsTreeTableModal
        open={isWbsModalVisible}
        onClose={() => {
          setIsWbsModalVisible(false);
          setSelectedCharterForWbs(null);
        }}
        charter={selectedCharterForWbs}
      />

      {/* PM Unified Operational Plan Workspace Modal */}
      <PmOperationalPlanModal
        open={isOperationalPlanOpen}
        onClose={() => {
          setIsOperationalPlanOpen(false);
          setSelectedCharterForPlan(null);
          setLocalRefreshKey((k) => k + 1);
        }}
        charter={selectedCharterForPlan}
        onRefreshParent={() => {
          setLocalRefreshKey((k) => k + 1);
          fetchBoardData();
        }}
      />

      {/* PM Procurement Package Authoring Modal (Phase 4 Canonical) */}
      <PmProcurementPackageModal
        open={isPackageModalOpen}
        onClose={() => {
          setIsPackageModalOpen(false);
          setSelectedCharterForPackage(null);
        }}
        project={selectedCharterForPackage}
        onRefreshParent={() => fetchBoardData()}
      />
    </div>
  );
};
