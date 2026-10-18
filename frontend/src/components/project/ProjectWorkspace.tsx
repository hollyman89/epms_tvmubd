'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button,
  Tag,
  Tooltip,
  Dropdown,
  Space,
  Progress,
  Spin,
  Skeleton,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  ProjectOutlined,
  LineChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DownOutlined,
  ShoppingCartOutlined,
  PaperClipOutlined,
  ApartmentOutlined,
  EyeOutlined,
  BankOutlined,
  UserOutlined,
  EditOutlined,
  ClockCircleOutlined,
  ClockCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
  MoreOutlined,
  HistoryOutlined,
  WarningOutlined,
  FlagOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { ProjectCharter } from '../ProjectOperationTab';
import {
  resolvePlanVsActual,
  resolveSchedule,
  resolveOperationalHealth,
  resolveActiveNextAction,
  formatCurrency,
  formatOperationalDate,
} from './operational-control.utils';
import {
  resolvePmIdentity,
  resolveMarketingIdentity,
} from './kickoff-queue.utils';
import { ProjectService } from '@/services/project.service';
import { ProjectTaskBoard } from './ProjectTaskBoard';
import { ProjectProgressMonitoring } from './ProjectProgressMonitoring';
import { ProjectGantt } from './ProjectGantt';
import { ProjectIssueRiskWorkspace } from './issue-risk/ProjectIssueRiskWorkspace';
import { ProjectClosureWorkspace } from './closure/ProjectClosureWorkspace';
import styles from './ProjectWorkspace.module.css';

export type WorkspaceSection = 'overview' | 'tasks' | 'monitoring' | 'gantt' | 'issue-risk' | 'closure';

export interface ProjectWorkspaceProps {
  projectId: number;
  project?: ProjectCharter | null;
  loading?: boolean;
  initialSection?: WorkspaceSection;
  onBack: () => void;
  onOpenDetailDrawer?: (record: ProjectCharter, initialTabKey?: string) => void;
  onOpenProcurementPackage?: (record: ProjectCharter, family?: 'MATERIAL' | 'SERVICE') => void;
  onOpenServiceClaimVerification?: (record: ProjectCharter) => void;
  onOpenOperationalPlan?: (record: ProjectCharter) => void;
  onUpdateProgress?: (record: ProjectCharter) => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  projectId,
  project,
  loading: parentLoading = false,
  initialSection = 'overview',
  onBack,
  onOpenDetailDrawer,
  onOpenProcurementPackage,
  onOpenServiceClaimVerification,
  onOpenOperationalPlan,
  onUpdateProgress,
}) => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(initialSection);

  // Authoritative remote data for direct deep link / refresh
  const [remoteData, setRemoteData] = useState<{
    monitoring?: any;
    gantt?: any;
  } | null>(null);
  const [fetchLoading, setFetchLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<{ status: number; message: string } | null>(null);

  // Sync with URL section parameter on mount or initialSection prop changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const sectionParam = url.searchParams.get('section') as WorkspaceSection;
      const validSections: WorkspaceSection[] = [
        'overview',
        'tasks',
        'monitoring',
        'gantt',
        'issue-risk',
        'closure',
      ];
      if (sectionParam && validSections.includes(sectionParam)) {
        setActiveSection(sectionParam);
        return;
      }
    }
    if (initialSection && initialSection !== activeSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Safe authoritative project context fetch on mount or projectId change
  useEffect(() => {
    if (!projectId || isNaN(Number(projectId)) || Number(projectId) <= 0) {
      setFetchError({ status: 400, message: 'ID Proyek tidak valid' });
      return;
    }

    let isCancelled = false;
    setFetchLoading(true);
    setFetchError(null);

    Promise.allSettled([
      ProjectService.getProjectProgressMonitoring(projectId),
      ProjectService.getProjectGantt(projectId),
    ]).then(([monitoringRes, ganttRes]) => {
      if (isCancelled) return;

      if (monitoringRes.status === 'rejected' && ganttRes.status === 'rejected') {
        const err: any = monitoringRes.reason;
        const status = err?.response?.status || err?.status || 500;
        if (status === 403) {
          setFetchError({
            status: 403,
            message: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat proyek ini.',
          });
        } else if (status === 404) {
          setFetchError({
            status: 404,
            message: 'Proyek Tidak Ditemukan: Proyek dengan ID ini tidak ada di sistem.',
          });
        } else {
          setFetchError({
            status,
            message: err?.message || 'Gagal memuat context proyek.',
          });
        }
      } else {
        const monitoring = monitoringRes.status === 'fulfilled' ? monitoringRes.value : null;
        const gantt = ganttRes.status === 'fulfilled' ? ganttRes.value : null;
        setRemoteData({ monitoring, gantt });
      }
      setFetchLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  // URL routing helper
  const handleSectionChange = useCallback(
    (newSection: WorkspaceSection) => {
      setActiveSection(newSection);
      if (typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('view', 'workspace');
        currentUrl.searchParams.set('projectId', String(projectId));
        currentUrl.searchParams.set('section', newSection);
        window.history.pushState({}, '', currentUrl.toString());
      }
    },
    [projectId]
  );

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const sectionParam = url.searchParams.get('section') as WorkspaceSection;
        const viewParam = url.searchParams.get('view');
        if (viewParam === 'workspace' && sectionParam) {
          setActiveSection(sectionParam);
        } else if (viewParam === 'task-board' || viewParam === 'tasks') {
          setActiveSection('tasks');
        } else if (viewParam === 'progress-monitoring' || viewParam === 'monitoring') {
          setActiveSection('monitoring');
        } else if (viewParam === 'gantt') {
          setActiveSection('gantt');
        } else if (viewParam === 'issue-risk' || sectionParam === 'issue-risk') {
          setActiveSection('issue-risk');
        } else if (viewParam === 'closure' || sectionParam === 'closure') {
          setActiveSection('closure');
        } else if (viewParam === 'workspace') {
          setActiveSection('overview');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Authoritative Effective Project Entity
  const effectiveProject: ProjectCharter | null = useMemo(() => {
    const ganttPlannedStart = remoteData?.gantt?.summary?.plannedStart;
    const monitoringPlannedStart = remoteData?.monitoring?.control?.plannedStart;
    const resolvedPlannedStart = ganttPlannedStart || monitoringPlannedStart || null;

    if (project) {
      return {
        ...project,
        managerId: (project as any).managerId !== undefined ? (project as any).managerId : (project as any).manager_id,
        plannedStart: (project as any).plannedStart || resolvedPlannedStart,
        control: (project as any).control || remoteData?.monitoring?.control || null,
      };
    }

    if (remoteData?.monitoring?.project || remoteData?.gantt?.project) {
      const p = remoteData.monitoring?.project || remoteData.gantt?.project;
      const managerId = (p as any)?.managerId !== undefined && (p as any)?.managerId !== null
        ? Number((p as any).managerId)
        : ((remoteData?.gantt?.project as any)?.managerId !== undefined && (remoteData?.gantt?.project as any)?.managerId !== null
            ? Number((remoteData?.gantt?.project as any).managerId)
            : null);
      return {
        id: projectId,
        tender_id: 0,
        project_code: p.code || '',
        project_name: p.name || '',
        customerName: p.customerName || null,
        contract_total_value: null,
        status: p.status || '',
        created_at: '',
        pmName: p.managerName || null,
        managerId,
        plannedStart: resolvedPlannedStart,
        control: remoteData.monitoring?.control || null,
      } as ProjectCharter;
    }

    return null;
  }, [project, remoteData, projectId]);

  // Resolve control payload with strict authoritative plannedStart
  const control = useMemo(() => {
    const c = (effectiveProject as any)?.control || remoteData?.monitoring?.control;
    const ganttPlannedStart = remoteData?.gantt?.summary?.plannedStart;
    if (c) {
      return {
        ...c,
        plannedStart: c.plannedStart || ganttPlannedStart || (effectiveProject as any)?.plannedStart || null,
      };
    }
    if (remoteData?.gantt?.summary) {
      const s = remoteData.gantt.summary;
      return {
        planComparisonAvailable: remoteData.gantt.planComparisonAvailable,
        planComparisonUnavailableReason: remoteData.gantt.planComparisonUnavailableReason,
        plannedProgress: s.plannedProgress,
        actualProgress: s.actualProgress,
        progressVariancePp: s.progressVariancePp,
        progressHealth: s.progressHealth,
        plannedStart: s.plannedStart,
        actualStart: s.actualStart,
        plannedFinish: s.plannedFinish,
        overdueTaskCount: s.overdueTasksCount,
      };
    }
    return null;
  }, [effectiveProject, remoteData]);

  // Resolve project identity & control
  const pm = useMemo(
    () =>
      effectiveProject
        ? resolvePmIdentity(effectiveProject)
        : { name: 'Belum Ditugaskan', initials: 'PM', isAssigned: false },
    [effectiveProject]
  );
  const marketing = useMemo(
    () =>
      effectiveProject
        ? resolveMarketingIdentity(effectiveProject)
        : { name: 'Marketing PIC', initials: 'MKT' },
    [effectiveProject]
  );

  const {
    plannedText,
    plannedPercent,
    actualText,
    actualPercent,
    varianceText,
    varianceTone,
  } = useMemo(
    () => resolvePlanVsActual(control, effectiveProject?.overallProgress),
    [control, effectiveProject]
  );

  const health = useMemo(() => resolveOperationalHealth(control), [control]);
  const schedule = useMemo(
    () => resolveSchedule(control, (effectiveProject as any)?.plannedStart),
    [control, effectiveProject]
  );

  // Authoritative Period Text (strictly NO 'Baseline Aktif' fake fallback, NO actualStart as plannedStart)
  const periodText = useMemo(() => {
    if (schedule.plannedStartText !== 'N/A' && schedule.plannedFinishText !== 'N/A') {
      return `${schedule.plannedStartText} – ${schedule.plannedFinishText}`;
    }
    if (schedule.plannedFinishText !== 'N/A') {
      return `Target Selesai: ${schedule.plannedFinishText}`;
    }
    return 'Belum tersedia';
  }, [schedule]);

  // Execution Summary from authoritative task summary (F3B/F3C SSOT)
  const executionSummary = useMemo(() => {
    if (remoteData?.monitoring?.taskSummary) {
      return remoteData.monitoring.taskSummary;
    }
    if (remoteData?.gantt?.summary) {
      const s = remoteData.gantt.summary;
      return {
        total: s.totalTasksCount ?? 0,
        todo: s.notStartedTasksCount ?? 0,
        inProgress: s.inProgressTasksCount ?? 0,
        review: 0,
        done: s.completedTasksCount ?? 0,
        overdue: s.overdueTasksCount ?? 0,
      };
    }
    return null;
  }, [remoteData]);

  // Milestone Summary from authoritative milestones (F3C/F3D SSOT: is_milestone = true only)
  const milestoneSummary = useMemo(() => {
    const list: any[] = remoteData?.monitoring?.milestones || [];
    if (list.length > 0) {
      const completed = list.filter((m) => m.status === 'COMPLETED').length;
      const late = list.filter((m) => Boolean(m.isLate)).length;
      const remaining = list.length - completed;
      return {
        total: list.length,
        completed,
        late,
        remaining,
        items: list,
      };
    }
    return null;
  }, [remoteData]);

  // User roles for action gating
  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  }, [user]);

  // Authoritative Next Action resolution
  const nextAction = useMemo(() => {
    if (!effectiveProject) return null;
    return resolveActiveNextAction({
      project: effectiveProject,
      user,
      userRoles,
    });
  }, [effectiveProject, user, userRoles]);

  const isProjectClosed = effectiveProject?.status === 'CLOSED';
  const canUpdateProgress = !isProjectClosed && nextAction?.mode === 'UPDATE_PROGRESS_BUTTON';

  // Single "More" Menu items in primary navigation tabs
  const moreMenuItems = useMemo(() => {
    const items: any[] = [];
    if (onOpenProcurementPackage && effectiveProject) {
      items.push({
        key: 'procurement-material',
        icon: <ShoppingCartOutlined />,
        label: 'Paket Pengadaan Material',
        onClick: () => onOpenProcurementPackage(effectiveProject, 'MATERIAL'),
      });
      items.push({
        key: 'procurement-service',
        icon: <ToolOutlined />,
        label: 'Pengadaan Jasa',
        onClick: () => onOpenProcurementPackage(effectiveProject, 'SERVICE'),
      });
    }
    if (onOpenServiceClaimVerification && effectiveProject) {
      items.push({
        key: 'service-claim',
        icon: <SafetyCertificateOutlined />,
        label: 'Verifikasi Klaim Jasa',
        onClick: () => onOpenServiceClaimVerification(effectiveProject),
      });
    }
    if (onOpenOperationalPlan && effectiveProject) {
      items.push({
        key: 'operational-plan',
        icon: <ApartmentOutlined />,
        label: 'Operational Plan',
        onClick: () => onOpenOperationalPlan(effectiveProject),
      });
    }
    if (onOpenDetailDrawer && effectiveProject) {
      items.push({
        key: 'documents',
        icon: <PaperClipOutlined />,
        label: 'Documents',
        onClick: () => onOpenDetailDrawer(effectiveProject, 'documents'),
      });
      items.push({
        key: 'activity',
        icon: <HistoryOutlined />,
        label: 'Activity / History',
        onClick: () => onOpenDetailDrawer(effectiveProject, 'activity'),
      });
      items.push({
        key: 'detail',
        icon: <EyeOutlined />,
        label: 'Detail Project',
        onClick: () => onOpenDetailDrawer(effectiveProject),
      });
    }
    items.push({
      key: 'issue-risk',
      icon: <WarningOutlined />,
      label: 'Issue & Risk',
      onClick: () => handleSectionChange('issue-risk'),
    });
    items.push({
      key: 'closure',
      icon: <CheckCircleOutlined />,
      label: 'Project Closure',
      onClick: () => handleSectionChange('closure'),
    });
    return items;
  }, [onOpenProcurementPackage, onOpenDetailDrawer, onOpenOperationalPlan, effectiveProject]);

  // Safe Error State Render
  if (fetchError) {
    return (
      <div className={styles.workspaceShell} data-testid="project-workspace-shell">
        <div className={styles.topNav}>
          <div className={styles.breadcrumbRow}>
            <span
              className={styles.breadcrumbLink}
              onClick={onBack}
              role="button"
              tabIndex={0}
              data-testid="workspace-back-btn"
            >
              <ArrowLeftOutlined style={{ fontSize: 12 }} />
              Kembali ke Daftar Proyek
            </span>
          </div>
        </div>
        <div className={styles.errorStateCard} data-testid="workspace-error-state">
          <WarningOutlined style={{ fontSize: 40, color: '#EF4444' }} />
          <h2 style={{ fontSize: 18, color: '#0F172A', margin: 0 }}>
            {fetchError.status === 403
              ? 'Akses Ditolak'
              : fetchError.status === 404
              ? 'Proyek Tidak Ditemukan'
              : 'Terjadi Kesalahan'}
          </h2>
          <p style={{ color: '#64748B', maxWidth: 480, margin: 0 }}>
            {fetchError.message}
          </p>
          <Button type="primary" onClick={onBack} style={{ marginTop: 8 }}>
            Kembali ke Daftar Proyek Berjalan
          </Button>
        </div>
      </div>
    );
  }

  // Safe Loading / Skeleton State (DO NOT display fake 0% or N/A during loading)
  const isInitialLoading = (parentLoading || fetchLoading) && !effectiveProject;
  if (isInitialLoading) {
    return (
      <div className={styles.workspaceShell} data-testid="project-workspace-shell">
        <div className={styles.topNav}>
          <div className={styles.breadcrumbRow}>
            <span className={styles.breadcrumbLink} onClick={onBack} role="button" tabIndex={0}>
              <ArrowLeftOutlined style={{ fontSize: 12 }} />
              Project Delivery
            </span>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>Memuat data proyek...</span>
          </div>
        </div>
        <div className={styles.projectHeaderCard} data-testid="workspace-loading-state">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      </div>
    );
  }

  const projectCode = effectiveProject?.project_code || 'N/A';
  const statusText = effectiveProject?.status || 'N/A';

  return (
    <div className={styles.workspaceShell} data-testid="project-workspace-shell">
      {/* Top Breadcrumb & Back */}
      <div className={styles.topNav}>
        <div className={styles.breadcrumbRow}>
          <span
            className={styles.breadcrumbLink}
            onClick={onBack}
            role="button"
            tabIndex={0}
            data-testid="workspace-back-btn"
          >
            <ArrowLeftOutlined style={{ fontSize: 12 }} />
            Project Delivery
          </span>
          <span className={styles.breadcrumbSeparator}>›</span>
          <span
            className={styles.breadcrumbLink}
            onClick={onBack}
            role="button"
            tabIndex={0}
          >
            Daftar Proyek Berjalan
          </span>
          <span className={styles.breadcrumbSeparator}>›</span>
          <span className={styles.breadcrumbCurrent}>
            {effectiveProject?.project_name || `Proyek #${projectId}`}
          </span>
        </div>
      </div>

      {/* Authoritative Premium Project Header */}
      <div className={styles.projectHeaderCard} data-testid="project-workspace-header">
        <div className={styles.headerTop}>
          {/* Left Column: Identity & Metadata */}
          <div className={styles.identityCol}>
            <div className={styles.projectIconBox}>
              <ProjectOutlined />
            </div>
            <div className={styles.identityDetails}>
              {/* Title & Status Row */}
              <div className={styles.titleRow}>
                <h1 className={styles.projectName} style={{ margin: 0 }}>
                  {effectiveProject?.project_name || `Proyek #${projectId}`}
                </h1>
                <span className={styles.projectCodeBadge}>
                  {projectCode}
                </span>
                <Tag
                  color={statusText === 'IN_PROGRESS' ? 'success' : 'processing'}
                  style={{ borderRadius: 4, margin: 0, fontWeight: 600, fontSize: 11 }}
                >
                  {statusText}
                </Tag>
              </div>

              {/* Client Name */}
              <div className={styles.clientSubtitle}>
                <BankOutlined style={{ color: '#64748B' }} />
                <span>{effectiveProject?.customerName || '-'}</span>
              </div>

              {/* Metadata Chips: PM, Marketing, Nilai Kontrak, Periode */}
              <div className={styles.metaChipsRow}>
                {/* PM Chip */}
                <div className={styles.metaChip}>
                  <div className={styles.avatarSmall}>
                    {pm.isAssigned ? pm.initials : <UserOutlined style={{ fontSize: 10 }} />}
                  </div>
                  <span>
                    <span className={styles.metaLabel}>PM: </span>
                    <span className={styles.metaValue}>{pm.name}</span>
                  </span>
                </div>

                {/* Marketing PIC Chip */}
                <div className={styles.metaChip}>
                  <div className={`${styles.avatarSmall} ${styles.avatarMarketing}`}>
                    {marketing.initials || <UserOutlined style={{ fontSize: 10 }} />}
                  </div>
                  <span>
                    <span className={styles.metaLabel}>Marketing: </span>
                    <span className={styles.metaValue}>{marketing.name}</span>
                  </span>
                </div>

                {/* Nilai Kontrak (only if available) */}
                {effectiveProject?.contract_total_value && Number(effectiveProject.contract_total_value) > 0 && (
                  <div className={styles.metaChip}>
                    <span className={styles.metaLabel}>Nilai Kontrak: </span>
                    <span className={styles.metaValue}>
                      {formatCurrency(effectiveProject.contract_total_value)}
                    </span>
                  </div>
                )}

                {/* Periode Proyek (Authoritative SSOT) */}
                <div className={styles.metaChip}>
                  <CalendarOutlined style={{ color: '#94A3B8' }} />
                  <span className={styles.metaLabel}>Periode: </span>
                  <span className={styles.metaValue}>
                    {periodText}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions & Integrated KPIs */}
          <div className={styles.headerRight}>
            <div className={styles.headerActions}>
              {canUpdateProgress && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    if (onUpdateProgress && effectiveProject) {
                      onUpdateProgress(effectiveProject);
                    } else if (onOpenDetailDrawer && effectiveProject) {
                      onOpenDetailDrawer(effectiveProject, 'progress');
                    }
                  }}
                  style={{
                    backgroundColor: '#2563EB',
                    borderRadius: 6,
                    fontWeight: 600,
                    height: 36,
                    padding: '0 16px',
                  }}
                  data-testid="workspace-header-update-progress-btn"
                >
                  Update Progress
                </Button>
              )}
            </div>

            {/* KPI Summary Block */}
            <div className={styles.kpiBar} data-testid="workspace-header-kpi-bar">
              {/* Progress Aktual */}
              <div className={styles.kpiBlock}>
                <span className={styles.kpiLabel}>Progress Aktual</span>
                <span className={styles.kpiValue} style={{ color: '#0F172A' }}>
                  {actualText}
                </span>
              </div>

              {/* Progress Rencana */}
              <div className={styles.kpiBlock}>
                <span className={styles.kpiLabel}>Progress Rencana</span>
                <span className={styles.kpiValue} style={{ color: '#475569' }}>
                  {plannedText}
                </span>
              </div>

              {/* Deviasi */}
              <div className={styles.kpiBlock}>
                <span className={styles.kpiLabel}>Deviasi</span>
                <span
                  className={`${styles.kpiVariance} ${
                    varianceTone === 'green'
                      ? styles.kpiVarianceGreen
                      : varianceTone === 'red'
                      ? styles.kpiVarianceRed
                      : styles.kpiVarianceSlate
                  }`}
                >
                  {varianceText}
                </span>
              </div>

              {/* Health */}
              <div className={styles.kpiBlock}>
                <span className={styles.kpiLabel}>Health</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      health.tone === 'blue'
                        ? '#1D4ED8'
                        : health.tone === 'green'
                        ? '#16A34A'
                        : health.tone === 'red'
                        ? '#DC2626'
                        : '#64748B',
                  }}
                >
                  {health.iconType === 'ahead' && <CheckCircleFilled />}
                  {health.iconType === 'on_plan' && <CheckCircleFilled />}
                  {health.iconType === 'behind' && <ExclamationCircleFilled />}
                  {health.iconType === 'unavailable' && <ClockCircleOutlined />}
                  {health.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single Thin Horizontal Modern Project Navigation */}
      <div className={styles.navBarWrapper} data-testid="workspace-primary-nav">
        <div className={styles.navTabsList}>
          <button
            type="button"
            className={`${styles.navTabItem} ${activeSection === 'overview' ? styles.navTabItemActive : ''}`}
            onClick={() => handleSectionChange('overview')}
            data-testid="nav-tab-overview"
          >
            <DashboardOutlined />
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`${styles.navTabItem} ${activeSection === 'tasks' ? styles.navTabItemActive : ''}`}
            onClick={() => handleSectionChange('tasks')}
            data-testid="nav-tab-tasks"
          >
            <ProjectOutlined />
            <span>Task Board</span>
          </button>

          <button
            type="button"
            className={`${styles.navTabItem} ${activeSection === 'monitoring' ? styles.navTabItemActive : ''}`}
            onClick={() => handleSectionChange('monitoring')}
            data-testid="nav-tab-monitoring"
          >
            <LineChartOutlined />
            <span>Monitoring</span>
          </button>

          <button
            type="button"
            className={`${styles.navTabItem} ${activeSection === 'gantt' ? styles.navTabItemActive : ''}`}
            onClick={() => handleSectionChange('gantt')}
            data-testid="nav-tab-gantt"
          >
            <CalendarOutlined />
            <span>Gantt</span>
          </button>

          {activeSection === 'issue-risk' && (
            <button
              type="button"
              className={`${styles.navTabItem} ${styles.navTabItemActive}`}
              onClick={() => handleSectionChange('issue-risk')}
              data-testid="nav-tab-issue-risk"
            >
              <WarningOutlined />
              <span>Issue & Risk</span>
            </button>
          )}

          {activeSection === 'closure' && (
            <button
              type="button"
              className={`${styles.navTabItem} ${styles.navTabItemActive}`}
              onClick={() => handleSectionChange('closure')}
              data-testid="nav-tab-closure"
            >
              <CheckCircleOutlined />
              <span>Project Closure</span>
            </button>
          )}

          {/* Single More Control in Primary Nav */}
          {moreMenuItems.length > 0 && (
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <button type="button" className={styles.navTabItem} data-testid="nav-tab-more">
                <MoreOutlined />
                <span>More</span>
                <DownOutlined style={{ fontSize: 10 }} />
              </button>
            </Dropdown>
          )}
        </div>
      </div>

      {/* Main Section Content Area */}
      <div className={styles.sectionContent}>
        {/* 1. OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <div className={styles.overviewContainer} data-testid="workspace-section-overview">
            {/* A. Progress Summary Card */}
            <div className={styles.overviewCard} data-testid="overview-progress-summary">
              <div className={styles.overviewCardTitle}>
                <DashboardOutlined style={{ color: '#2563EB' }} />
                <span>Ringkasan Kinerja Proyek</span>
              </div>
              <div className={styles.overviewGrid}>
                {/* Progress Aktual Box */}
                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Progress Aktual</span>
                  <span className={styles.metricBoxValue} style={{ color: '#16A34A' }}>
                    {actualText}
                  </span>
                  <Progress
                    percent={actualPercent ?? 0}
                    size="small"
                    showInfo={false}
                    strokeColor="#16A34A"
                    trailColor="#E2E8F0"
                  />
                  <span className={styles.metricBoxSub}>Realisasi resmi dari eksekusi task</span>
                </div>

                {/* Progress Rencana Box */}
                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Progress Rencana (Baseline)</span>
                  <span className={styles.metricBoxValue} style={{ color: '#2563EB' }}>
                    {plannedText}
                  </span>
                  <Progress
                    percent={plannedPercent ?? 0}
                    size="small"
                    showInfo={false}
                    strokeColor="#2563EB"
                    trailColor="#E2E8F0"
                  />
                  <span className={styles.metricBoxSub}>Target kumulatif baseline aktif</span>
                </div>

                {/* Deviasi Box */}
                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Deviasi Progres</span>
                  <span
                    className={styles.metricBoxValue}
                    style={{
                      color:
                        varianceTone === 'green'
                          ? '#16A34A'
                          : varianceTone === 'red'
                          ? '#DC2626'
                          : '#64748B',
                    }}
                  >
                    {varianceText}
                  </span>
                  <span className={styles.metricBoxSub}>
                    {varianceTone === 'green'
                      ? 'Progres berjalan lebih cepat dari rencana'
                      : varianceTone === 'red'
                      ? 'Progres tertinggal dari jadwal rencana'
                      : 'Progres sesuai target jadwal'}
                  </span>
                </div>

                {/* Status Kesehatan */}
                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Status Kesehatan</span>
                  <span
                    className={styles.metricBoxValue}
                    style={{
                      fontSize: 16,
                      color:
                        health.tone === 'blue'
                          ? '#1D4ED8'
                          : health.tone === 'green'
                          ? '#16A34A'
                          : health.tone === 'red'
                          ? '#DC2626'
                          : '#64748B',
                    }}
                  >
                    {health.label}
                  </span>
                  <span className={styles.metricBoxSub}>{health.subtext}</span>
                </div>
              </div>
            </div>

            {/* B. Schedule Summary Card */}
            <div className={styles.overviewCard} data-testid="overview-schedule-summary">
              <div className={styles.overviewCardTitle}>
                <CalendarOutlined style={{ color: '#2563EB' }} />
                <span>Jadwal & Periode Eksekusi</span>
              </div>
              <div className={styles.overviewGrid}>
                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Mulai Rencana (Baseline)</span>
                  <span className={styles.metricBoxValue} style={{ fontSize: 16 }}>
                    {schedule.plannedStartText}
                  </span>
                  <span className={styles.metricBoxSub}>Jadwal awal baseline</span>
                </div>

                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Target Selesai (Baseline)</span>
                  <span className={styles.metricBoxValue} style={{ fontSize: 16 }}>
                    {schedule.plannedFinishText}
                  </span>
                  <span className={styles.metricBoxSub}>Target akhir baseline</span>
                </div>

                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Realisasi Mulai</span>
                  <span className={styles.metricBoxValue} style={{ fontSize: 16 }}>
                    {schedule.actualStartText}
                  </span>
                  <span className={styles.metricBoxSub}>Timestamp eksekusi pertama</span>
                </div>

                <div className={styles.metricBox}>
                  <span className={styles.metricBoxLabel}>Realisasi Selesai</span>
                  <span className={styles.metricBoxValue} style={{ fontSize: 15, color: '#64748B' }}>
                    Belum selesai
                  </span>
                  <span className={styles.metricBoxSub}>Ditetapkan saat penutupan proyek</span>
                </div>
              </div>
            </div>

            {/* C. Execution Summary Card */}
            {executionSummary && (
              <div className={styles.overviewCard} data-testid="overview-execution-summary">
                <div className={styles.overviewCardTitle}>
                  <ProjectOutlined style={{ color: '#2563EB' }} />
                  <span>Ringkasan Eksekusi Task</span>
                </div>
                <div className={styles.chipGrid}>
                  <div className={styles.summaryChip}>
                    <ClockCircleFilled style={{ color: '#3B82F6' }} />
                    <span>Belum Dimulai:</span>
                    <span className={styles.summaryChipCount}>{executionSummary.todo}</span>
                  </div>
                  <div className={styles.summaryChip}>
                    <ClockCircleFilled style={{ color: '#F59E0B' }} />
                    <span>Dikerjakan:</span>
                    <span className={styles.summaryChipCount}>{executionSummary.inProgress}</span>
                  </div>
                  <div className={styles.summaryChip}>
                    <ExclamationCircleFilled style={{ color: '#8B5CF6' }} />
                    <span>Menunggu Review:</span>
                    <span className={styles.summaryChipCount}>{executionSummary.review}</span>
                  </div>
                  <div className={styles.summaryChip}>
                    <CheckCircleFilled style={{ color: '#10B981' }} />
                    <span>Selesai:</span>
                    <span className={styles.summaryChipCount}>{executionSummary.done}</span>
                  </div>
                  <div
                    className={styles.summaryChip}
                    style={{
                      background: executionSummary.overdue > 0 ? '#FEF2F2' : undefined,
                      borderColor: executionSummary.overdue > 0 ? '#FCA5A5' : undefined,
                    }}
                  >
                    <ExclamationCircleFilled
                      style={{ color: executionSummary.overdue > 0 ? '#DC2626' : '#94A3B8' }}
                    />
                    <span>Terlambat:</span>
                    <span
                      className={styles.summaryChipCount}
                      style={{ color: executionSummary.overdue > 0 ? '#DC2626' : undefined }}
                    >
                      {executionSummary.overdue}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* D. Milestone Summary Card */}
            {milestoneSummary && (
              <div className={styles.overviewCard} data-testid="overview-milestone-summary">
                <div className={styles.overviewCardTitle}>
                  <FlagOutlined style={{ color: '#2563EB' }} />
                  <span>Ringkasan Milestone Proyek</span>
                </div>
                <div className={styles.chipGrid}>
                  <div className={styles.summaryChip}>
                    <FlagOutlined style={{ color: '#2563EB' }} />
                    <span>Total Milestone:</span>
                    <span className={styles.summaryChipCount}>{milestoneSummary.total}</span>
                  </div>
                  <div className={styles.summaryChip}>
                    <CheckCircleFilled style={{ color: '#10B981' }} />
                    <span>Selesai:</span>
                    <span className={styles.summaryChipCount}>{milestoneSummary.completed}</span>
                  </div>
                  <div
                    className={styles.summaryChip}
                    style={{
                      background: milestoneSummary.late > 0 ? '#FEF2F2' : undefined,
                      borderColor: milestoneSummary.late > 0 ? '#FCA5A5' : undefined,
                    }}
                  >
                    <ExclamationCircleFilled
                      style={{ color: milestoneSummary.late > 0 ? '#DC2626' : '#94A3B8' }}
                    />
                    <span>Terlambat:</span>
                    <span
                      className={styles.summaryChipCount}
                      style={{ color: milestoneSummary.late > 0 ? '#DC2626' : undefined }}
                    >
                      {milestoneSummary.late}
                    </span>
                  </div>
                  <div className={styles.summaryChip}>
                    <ClockCircleFilled style={{ color: '#64748B' }} />
                    <span>Sisa:</span>
                    <span className={styles.summaryChipCount}>{milestoneSummary.remaining}</span>
                  </div>
                </div>

                {milestoneSummary.items && milestoneSummary.items.length > 0 && (
                  <div className={styles.milestonesList}>
                    {milestoneSummary.items.slice(0, 5).map((m: any) => (
                      <div key={m.id || m.code} className={styles.milestoneItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FlagOutlined
                            style={{
                              color:
                                m.status === 'COMPLETED'
                                  ? '#10B981'
                                  : m.isLate
                                  ? '#DC2626'
                                  : '#2563EB',
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>
                            {m.code ? `[${m.code}] ` : ''}
                            {m.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ color: '#64748B', fontSize: 12 }}>
                            Target: {formatOperationalDate(m.plannedDate)}
                          </span>
                          <Tag
                            color={
                              m.status === 'COMPLETED'
                                ? 'success'
                                : m.isLate
                                ? 'error'
                                : 'processing'
                            }
                          >
                            {m.status === 'COMPLETED'
                              ? 'SELESAI'
                              : m.isLate
                              ? 'TERLAMBAT'
                              : 'DALAM PROSES'}
                          </Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* E. Next Action (strictly omitted if no authoritative action text) */}
            {nextAction?.text && (
              <div className={styles.overviewCard} data-testid="overview-next-action">
                <div className={styles.overviewCardTitle}>
                  <CheckCircleOutlined style={{ color: '#2563EB' }} />
                  <span>Tindakan Selanjutnya</span>
                </div>
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
                    {nextAction.text}
                  </span>
                  {nextAction.buttonLabel && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        if (canUpdateProgress && onUpdateProgress && effectiveProject) {
                          onUpdateProgress(effectiveProject);
                        } else if (onOpenDetailDrawer && effectiveProject) {
                          onOpenDetailDrawer(effectiveProject);
                        }
                      }}
                    >
                      {nextAction.buttonLabel}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Navigation Jump Cards */}
            <div className={styles.overviewCard}>
              <div className={styles.overviewCardTitle}>
                <ProjectOutlined style={{ color: '#2563EB' }} />
                <span>Navigasi Cepat Modul Proyek</span>
              </div>
              <div className={styles.quickJumpGrid}>
                <div
                  className={styles.quickJumpCard}
                  onClick={() => handleSectionChange('tasks')}
                  role="button"
                  tabIndex={0}
                  data-testid="jump-to-tasks-btn"
                >
                  <div className={styles.quickJumpLeft}>
                    <div className={styles.quickJumpIcon}>
                      <ProjectOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
                        Task Board (Kanban)
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Kelola task, status pengerjaan, dan verifikasi
                      </div>
                    </div>
                  </div>
                  <ArrowLeftOutlined style={{ transform: 'rotate(180deg)', color: '#94A3B8' }} />
                </div>

                <div
                  className={styles.quickJumpCard}
                  onClick={() => handleSectionChange('monitoring')}
                  role="button"
                  tabIndex={0}
                  data-testid="jump-to-monitoring-btn"
                >
                  <div className={styles.quickJumpLeft}>
                    <div className={styles.quickJumpIcon}>
                      <LineChartOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
                        Monitoring & S-Curve
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Kurva S Plan vs Actual, Work Packages, dan Milestone
                      </div>
                    </div>
                  </div>
                  <ArrowLeftOutlined style={{ transform: 'rotate(180deg)', color: '#94A3B8' }} />
                </div>

                <div
                  className={styles.quickJumpCard}
                  onClick={() => handleSectionChange('gantt')}
                  role="button"
                  tabIndex={0}
                  data-testid="jump-to-gantt-btn"
                >
                  <div className={styles.quickJumpLeft}>
                    <div className={styles.quickJumpIcon}>
                      <CalendarOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
                        Gantt Baseline vs Actual
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Visualisasi timeline bar jadwal rencana vs realisasi
                      </div>
                    </div>
                  </div>
                  <ArrowLeftOutlined style={{ transform: 'rotate(180deg)', color: '#94A3B8' }} />
                </div>

                <div
                  className={styles.quickJumpCard}
                  onClick={() => handleSectionChange('issue-risk')}
                  role="button"
                  tabIndex={0}
                  data-testid="jump-to-issue-risk-btn"
                >
                  <div className={styles.quickJumpLeft}>
                    <div className={styles.quickJumpIcon}>
                      <WarningOutlined />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>
                        Issue &amp; Risk Register
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Kelola kendala teknis/operasional, matriks risiko, dan mitigasi
                      </div>
                    </div>
                  </div>
                  <ArrowLeftOutlined style={{ transform: 'rotate(180deg)', color: '#94A3B8' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TASK BOARD SECTION (Embedded Mode) */}
        {activeSection === 'tasks' && (
          <div data-testid="workspace-section-tasks">
            <ProjectTaskBoard
              projectId={projectId}
              onBack={onBack}
              onOpenMonitoring={() => handleSectionChange('monitoring')}
              onOpenGantt={() => handleSectionChange('gantt')}
              embedded={true}
            />
          </div>
        )}

        {/* 3. MONITORING SECTION (includes S-Curve, Embedded Mode) */}
        {activeSection === 'monitoring' && (
          <div data-testid="workspace-section-monitoring">
            <ProjectProgressMonitoring
              projectId={projectId}
              onBack={onBack}
              onOpenTaskBoard={() => handleSectionChange('tasks')}
              onOpenGantt={() => handleSectionChange('gantt')}
              embedded={true}
            />
          </div>
        )}

        {/* 4. GANTT SECTION (Embedded Mode) */}
        {activeSection === 'gantt' && (
          <div data-testid="workspace-section-gantt">
            <ProjectGantt
              projectId={projectId}
              onBackToMaster={onBack}
              onNavigateToBoard={() => handleSectionChange('tasks')}
              onNavigateToMonitoring={() => handleSectionChange('monitoring')}
              embedded={true}
            />
          </div>
        )}

        {/* 5. ISSUE & RISK SECTION (Unified Register) */}
        {activeSection === 'issue-risk' && (
          <div data-testid="workspace-section-issue-risk">
            <ProjectIssueRiskWorkspace
              projectId={projectId}
              project={effectiveProject}
              onBack={() => handleSectionChange('overview')}
            />
          </div>
        )}

        {/* 6. PROJECT CLOSURE SECTION */}
        {activeSection === 'closure' && (
          <div data-testid="workspace-section-closure">
            <ProjectClosureWorkspace
              projectId={projectId}
              project={effectiveProject}
              onNavigateToDocuments={() => {
                if (onOpenDetailDrawer && effectiveProject) {
                  onOpenDetailDrawer(effectiveProject, 'documents');
                }
              }}
              onRefetchProject={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('epms:refetch_all'));
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectWorkspace;
