'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Spin,
  Empty,
  Input,
  Select,
  Button,
  Tag,
  Tooltip,
  Dropdown,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  CalendarOutlined,
  PaperClipOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  ApartmentOutlined,
  FolderOpenOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import { ProjectService } from '@/services';
import {
  TaskBoardData,
  TaskBoardTask,
  TaskBoardFilterState,
  KANBAN_LANES,
  sortTasksInLane,
  filterTaskBoard,
  getHealthDisplay,
  formatTaskProgress,
} from './task-board.utils';
import { RoutineProgressModal } from './RoutineProgressModal';
import { ProgressClaimModal } from './ProgressClaimModal';
import { ProgressVerificationDrawer } from './ProgressVerificationDrawer';
import styles from './ProjectTaskBoard.module.css';

interface ProjectTaskBoardProps {
  projectId: number;
  onBack: () => void;
  onOpenMonitoring?: (projectId: number) => void;
  onOpenGantt?: (projectId: number) => void;
  embedded?: boolean;
}

export const ProjectTaskBoard: React.FC<ProjectTaskBoardProps> = ({
  projectId,
  onBack,
  onOpenMonitoring,
  onOpenGantt,
  embedded = false,
}) => {
  const { user, isPmo, isHeadOfOperations, isSuperAdmin } = useAuth();
  const [boardData, setBoardData] = useState<TaskBoardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters state
  const [filters, setFilters] = useState<TaskBoardFilterState>({
    search: '',
    overdueOnly: false,
    criticalOnly: false,
    assigneeId: null,
    wbsId: null,
  });

  // Action Modals state
  const [routineModalTask, setRoutineModalTask] = useState<TaskBoardTask | null>(null);
  const [claimModalTask, setClaimModalTask] = useState<TaskBoardTask | null>(null);
  const [isVerificationDrawerOpen, setIsVerificationDrawerOpen] = useState<boolean>(false);
  const [verificationPendingLogs, setVerificationPendingLogs] = useState<any[]>([]);

  // Fetch Authoritative Task Board Data
  const fetchBoardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const data = await ProjectService.getProjectTaskBoard(projectId);
      setBoardData(data);
    } catch (err: any) {
      console.error('Failed to load project task board:', err);
      message.error(err?.response?.data?.message || 'Gagal memuat Task Board proyek');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // Handle open verification drawer
  const handleOpenVerification = useCallback(
    async (task?: TaskBoardTask) => {
      try {
        const logs = await ProjectService.getProgressLogs(projectId);
        const pending = logs.filter((l) => l.status === 'PENDING_VERIFICATION');
        if (task && task.pendingClaim) {
          const match = pending.find((l) => Number(l.id) === Number(task.pendingClaim!.id));
          if (match) {
            setVerificationPendingLogs([match]);
          } else {
            setVerificationPendingLogs([
              {
                id: task.pendingClaim.id,
                taskId: task.id,
                taskName: task.name,
                reportedProgress: task.pendingClaim.reportedProgress,
                previousProgress: task.pendingClaim.previousProgress,
                eventType: task.pendingClaim.eventType,
                reason: task.pendingClaim.reason,
                submittedBy: task.pendingClaim.submittedBy,
                createdAt: task.pendingClaim.createdAt,
                evidenceCount: task.pendingClaim.evidenceCount,
                isCritical: task.isCritical,
              },
            ]);
          }
        } else {
          setVerificationPendingLogs(pending);
        }
        setIsVerificationDrawerOpen(true);
      } catch (err: any) {
        console.error('Failed to load progress logs for verification drawer:', err);
        if (!boardData) return;
        if (task && task.pendingClaim) {
          setVerificationPendingLogs([
            {
              id: task.pendingClaim.id,
              taskId: task.id,
              taskName: task.name,
              reportedProgress: task.pendingClaim.reportedProgress,
              previousProgress: task.pendingClaim.previousProgress,
              eventType: task.pendingClaim.eventType,
              reason: task.pendingClaim.reason,
              submittedBy: task.pendingClaim.submittedBy,
              createdAt: task.pendingClaim.createdAt,
              evidenceCount: task.pendingClaim.evidenceCount,
              isCritical: task.isCritical,
            },
          ]);
        } else {
          const allPending = boardData.tasks
            .filter((t) => t.pendingClaim)
            .map((t) => ({
              id: t.pendingClaim!.id,
              taskId: t.id,
              taskName: t.name,
              reportedProgress: t.pendingClaim!.reportedProgress,
              previousProgress: t.pendingClaim!.previousProgress,
              eventType: t.pendingClaim!.eventType,
              reason: t.pendingClaim!.reason,
              submittedBy: t.pendingClaim!.submittedBy,
              createdAt: t.pendingClaim!.createdAt,
              evidenceCount: t.pendingClaim!.evidenceCount,
              isCritical: t.isCritical,
            }));
          setVerificationPendingLogs(allPending);
        }
        setIsVerificationDrawerOpen(true);
      }
    },
    [projectId, boardData],
  );

  // Deep-link support: auto-open verification drawer if progressClaimId or taskId param is present
  const searchParams = useSearchParams();
  const autoProgressClaimId =
    searchParams?.get('progressClaimId') ||
    (searchParams?.get('section') === 'tasks' ? searchParams?.get('claimId') : null);
  const autoTaskId = searchParams?.get('taskId');
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    if (hasAutoOpened.current || !projectId) return;

    if (autoProgressClaimId) {
      const claimIdNum = Number(autoProgressClaimId);
      if (!Number.isFinite(claimIdNum) || claimIdNum <= 0) return;

      hasAutoOpened.current = true;
      (async () => {
        try {
          const logs = await ProjectService.getProgressLogs(projectId);
          const match = logs.find((l) => Number(l.id) === claimIdNum);
          if (!match) {
            message.error(`Klaim progress #${claimIdNum} tidak ditemukan.`);
            return;
          }
          if (match.status !== 'PENDING_VERIFICATION') {
            message.info(`Klaim progress #${claimIdNum} sudah berstatus ${match.status}.`);
            return;
          }
          setVerificationPendingLogs([match]);
          setIsVerificationDrawerOpen(true);
        } catch (err: any) {
          console.error('Failed to load progress log for deep-link:', err);
          message.error(`Gagal memuat klaim progress #${claimIdNum}.`);
        }
      })();
    } else if (autoTaskId && boardData) {
      const match = boardData.tasks.find((t) => String(t.id) === String(autoTaskId));
      if (match && match.availableActions?.includes('REVIEW_CLAIM')) {
        hasAutoOpened.current = true;
        handleOpenVerification(match);
      }
    }
  }, [projectId, boardData, autoProgressClaimId, autoTaskId, handleOpenVerification]);

  // Unique Assignees and WBS for Filter dropdowns
  const { assigneesList, wbsList, overdueTotalCount, criticalTotalCount } = useMemo(() => {
    if (!boardData) {
      return { assigneesList: [], wbsList: [], overdueTotalCount: 0, criticalTotalCount: 0 };
    }

    const assigneesMap = new Map<number, { id: number; name: string }>();
    const wbsMap = new Map<number, { id: number; code: string; name: string }>();
    let overdueCount = 0;
    let criticalCount = 0;

    for (const t of boardData.tasks) {
      if (t.assignee) {
        assigneesMap.set(t.assignee.id, t.assignee);
      }
      if (t.workPackage) {
        wbsMap.set(t.workPackage.id, t.workPackage);
      }
      if (t.isOverdue || t.overdueDays > 0) {
        overdueCount++;
      }
      if (t.isCritical) {
        criticalCount++;
      }
    }

    return {
      assigneesList: Array.from(assigneesMap.values()),
      wbsList: Array.from(wbsMap.values()),
      overdueTotalCount: overdueCount,
      criticalTotalCount: criticalCount,
    };
  }, [boardData]);

  // Filtered & Grouped Tasks
  const { laneTasksMap, laneCounts } = useMemo(() => {
    if (!boardData) {
      return {
        laneTasksMap: { TO_DO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] },
        laneCounts: { TO_DO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 },
      };
    }

    const filtered = filterTaskBoard(boardData.tasks, filters);
    const map: Record<string, TaskBoardTask[]> = {
      TO_DO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    const counts: Record<string, number> = {
      TO_DO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
    };

    for (const t of filtered) {
      const lane = t.boardLane || 'TO_DO';
      if (!map[lane]) map[lane] = [];
      map[lane].push(t);
      counts[lane] = (counts[lane] || 0) + 1;
    }

    // Deterministic sorting inside each lane
    map.TO_DO = sortTasksInLane(map.TO_DO);
    map.IN_PROGRESS = sortTasksInLane(map.IN_PROGRESS);
    map.REVIEW = sortTasksInLane(map.REVIEW);
    map.DONE = sortTasksInLane(map.DONE);

    return { laneTasksMap: map, laneCounts: counts };
  }, [boardData, filters]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', minHeight: '400px' }}>
        <Spin size="large" />
        <span style={{ marginTop: '16px', fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
          Memuat Task Board Authoritative EPMS...
        </span>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <Empty description="Data Task Board tidak ditemukan" />
        <Button
          onClick={onBack}
          style={{ marginTop: '16px' }}
          icon={<ArrowLeftOutlined />}
          data-testid="btn-back-to-active-projects-empty"
        >
          Kembali ke Daftar Proyek Berjalan
        </Button>
      </div>
    );
  }

  const { project, controlSummary } = boardData;
  const healthStyle = getHealthDisplay(controlSummary.progressHealth);
  const canVerify = Boolean(isPmo || isHeadOfOperations || isSuperAdmin);

  // Format baseline project period
  const baselinePeriodText = (() => {
    if (controlSummary.actualStart && controlSummary.plannedFinish) {
      return `${dayjs(controlSummary.actualStart).format('DD MMM YYYY')} – ${dayjs(controlSummary.plannedFinish).format('DD MMM YYYY')}`;
    }
    if (controlSummary.plannedFinish) {
      return `Target Selesai: ${dayjs(controlSummary.plannedFinish).format('DD MMM YYYY')}`;
    }
    return 'Belum Ditetapkan';
  })();

  return (
    <div className={styles.boardWorkspace} data-testid="project-task-board">
      {/* 0. Top Breadcrumb & Visible Navigation */}
      {!embedded && (
        <div className={styles.topNavRow}>
          <div className={styles.breadcrumbGroup}>
            <FolderOpenOutlined className={styles.breadcrumbIcon} />
            <span className={styles.breadcrumbParent}>Project Delivery</span>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbActive}>Task Board</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenMonitoring && (
              <button
                type="button"
                onClick={() => onOpenMonitoring(projectId)}
                className={styles.backButton}
                style={{ color: '#2563EB', borderColor: '#BFDBFE', background: '#EFF6FF' }}
                data-testid="btn-nav-to-progress-monitoring"
              >
                <LineChartOutlined style={{ fontSize: 11 }} />
                <span>Progress & Monitoring</span>
              </button>
            )}
            {onOpenGantt && (
              <button
                type="button"
                onClick={() => onOpenGantt(projectId)}
                className={styles.backButton}
                style={{ color: '#2563EB', borderColor: '#BFDBFE', background: '#EFF6FF' }}
                data-testid="btn-nav-to-gantt"
              >
                <CalendarOutlined style={{ fontSize: 11 }} />
                <span>Gantt Chart</span>
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className={styles.backButton}
              data-testid="btn-back-to-active-projects"
            >
              <ArrowLeftOutlined style={{ fontSize: 11 }} />
              <span>Kembali ke Daftar Proyek Berjalan</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. COMPACT AUTHORITATIVE PROJECT HEADER & KPI CARDS */}
      {!embedded && (
        <div className={styles.headerCard}>
        <div className={styles.headerMainRow}>
          {/* Left: Project identity & Metadata */}
          <div className={styles.identityCol}>
            <div className={styles.tagsRow}>
              <h1 className={styles.projectTitle}>
                {project.name}
              </h1>
              <span className={styles.contractCodeTag}>
                {project.code}
              </span>
              <span
                className={
                  project.status === 'IN_PROGRESS'
                    ? styles.statusTagInProgress
                    : project.status === 'COMPLETED'
                    ? styles.statusTagCompleted
                    : styles.statusTagDefault
                }
              >
                {project.status ? project.status.replace('_', ' ') : 'ACTIVE'}
              </span>
            </div>

            {/* Sub-row: Klien, PM, Baseline Period */}
            <div className={styles.metadataRow}>
              <div className={styles.metadataItem}>
                <div className={styles.metaIconSurface}>
                  <UserOutlined />
                </div>
                <div className={styles.metadataContent}>
                  <span className={styles.metadataLabel}>Klien</span>
                  <span className={styles.metadataValue}>{project.customer || '—'}</span>
                </div>
              </div>

              <div className={styles.metadataItem}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  {project.manager?.name ? project.manager.name.slice(0, 2).toUpperCase() : 'PM'}
                </div>
                <div className={styles.metadataContent}>
                  <span className={styles.metadataLabel}>Project Manager</span>
                  <span className={styles.metadataValue}>
                    {project.manager?.name || 'Belum Ditugaskan'}
                  </span>
                </div>
              </div>

              <div className={styles.metadataItem}>
                <div className={styles.metaIconSurface}>
                  <CalendarOutlined />
                </div>
                <div className={styles.metadataContent}>
                  <span className={styles.metadataLabel}>Periode Proyek (Baseline)</span>
                  <span className={styles.metadataValue}>{baselinePeriodText}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: PROJECT CONTROL R1 KPI SUMMARY CARDS */}
          <div className={styles.kpiRow}>
            {/* Rencana Card */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Rencana</span>
              <span className={styles.kpiValue}>
                {Number(controlSummary.plannedProgress || 0).toFixed(1)}%
              </span>
            </div>

            {/* Aktual Card */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Aktual</span>
              <span className={styles.kpiValue}>
                {Number(controlSummary.actualProgress || 0).toFixed(1)}%
              </span>
              <div className={styles.kpiMiniBarTrack}>
                <div
                  className={styles.kpiMiniBarFill}
                  style={{ width: `${Math.min(100, Math.max(0, controlSummary.actualProgress || 0))}%` }}
                />
              </div>
            </div>

            {/* Deviasi Card */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Deviasi</span>
              <span
                className={styles.kpiValue}
                style={{
                  color:
                    controlSummary.progressVariancePp < 0
                      ? '#DC2626'
                      : controlSummary.progressVariancePp > 0
                      ? '#16A34A'
                      : '#334155',
                }}
              >
                {controlSummary.progressVariancePp > 0 ? '+' : ''}
                {Number(controlSummary.progressVariancePp || 0).toFixed(1)} pp
              </span>
            </div>

            {/* Health Card */}
            <div className={styles.kpiCard} style={{ minWidth: 120 }}>
              <span className={styles.kpiLabel}>Health</span>
              <div
                className={styles.kpiHealthBadge}
                style={{ color: healthStyle.color }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: healthStyle.color,
                    display: 'inline-block',
                  }}
                />
                <span>{healthStyle.label}</span>
              </div>
            </div>

            {/* Refresh Button */}
            <Button
              size="middle"
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => fetchBoardData(true)}
              style={{
                width: 36,
                height: 36,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                color: '#64748B',
                borderColor: '#E2E8F0',
              }}
              title="Refresh Task Board"
            />
          </div>
        </div>
      </div>
      )}

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <div className={styles.toolbarRow}>
        <div className={styles.toolbarLeft}>
          <Input
            placeholder="Cari task, kode, work package, PIC..."
            prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
            allowClear
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            style={{ borderRadius: 8, height: 36, fontSize: 12 }}
            id="task-board-search-input"
            data-testid="task-board-search-input"
          />
        </div>

        <div className={styles.toolbarRight}>
          {/* Quick Overdue Filter Chip */}
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, overdueOnly: !prev.overdueOnly }))}
            className={`${styles.filterChip} ${filters.overdueOnly ? styles.filterChipActiveOverdue : ''}`}
          >
            <WarningOutlined style={{ color: filters.overdueOnly ? '#DC2626' : '#EF4444' }} />
            <span>Terlambat</span>
            {overdueTotalCount > 0 && (
              <span className={`${styles.filterCountBadge} ${styles.filterCountBadgeRed}`}>
                {overdueTotalCount}
              </span>
            )}
          </button>

          {/* Quick Critical Filter Chip */}
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, criticalOnly: !prev.criticalOnly }))}
            className={`${styles.filterChip} ${filters.criticalOnly ? styles.filterChipActiveCritical : ''}`}
          >
            <ClockCircleOutlined style={{ color: filters.criticalOnly ? '#D97706' : '#F59E0B' }} />
            <span>Critical</span>
            {criticalTotalCount > 0 && (
              <span className={`${styles.filterCountBadge} ${styles.filterCountBadgeAmber}`}>
                {criticalTotalCount}
              </span>
            )}
          </button>

          {/* Work Package Filter Dropdown */}
          {wbsList.length > 0 && (
            <Select
              placeholder="Semua Work Package"
              allowClear
              style={{ width: 175, height: 34 }}
              value={filters.wbsId}
              onChange={(val) => setFilters((prev) => ({ ...prev, wbsId: val ?? null }))}
              options={wbsList.map((w) => ({
                label: `${w.code} ${w.name}`,
                value: w.id,
              }))}
            />
          )}

          {/* Assignee Filter Dropdown */}
          {assigneesList.length > 0 && (
            <Select
              placeholder="Semua PIC"
              allowClear
              style={{ width: 140, height: 34 }}
              value={filters.assigneeId}
              onChange={(val) => setFilters((prev) => ({ ...prev, assigneeId: val ?? null }))}
              options={[
                { label: 'Belum Ditugaskan', value: -1 },
                ...assigneesList.map((a) => ({ label: a.name, value: a.id })),
              ]}
            />
          )}

          {/* Reset Filter Button */}
          {(filters.search ||
            filters.overdueOnly ||
            filters.criticalOnly ||
            filters.assigneeId !== null ||
            filters.wbsId !== null) && (
            <Button
              type="link"
              size="small"
              onClick={() =>
                setFilters({
                  search: '',
                  overdueOnly: false,
                  criticalOnly: false,
                  assigneeId: null,
                  wbsId: null,
                })
              }
              style={{ fontSize: 12, color: '#64748B', padding: 0 }}
            >
              Reset Filter
            </Button>
          )}
          {embedded && (
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => fetchBoardData(true)}
              style={{ borderRadius: 8, height: 34, color: '#64748B', borderColor: '#E2E8F0' }}
              title="Refresh Task Board"
            />
          )}
        </div>
      </div>

      {/* 3. FOUR KANBAN LANES SIDE-BY-SIDE IN DESKTOP GRID */}
      <div className={styles.kanbanWrapper}>
        <div className={styles.kanbanGrid}>
          {KANBAN_LANES.map((laneMeta) => {
            const laneTasks = laneTasksMap[laneMeta.key] || [];
            const count = laneCounts[laneMeta.key] || 0;

            const isToDo = laneMeta.key === 'TO_DO';
            const isInProgress = laneMeta.key === 'IN_PROGRESS';
            const isReview = laneMeta.key === 'REVIEW';
            const isDone = laneMeta.key === 'DONE';

            const laneSurfaceClass = isToDo
              ? styles.laneBelumDimulai
              : isInProgress
              ? styles.laneDikerjakan
              : isReview
              ? styles.laneReview
              : styles.laneSelesai;

            const laneTitleClass = isToDo
              ? styles.laneTitleBelumDimulai
              : isInProgress
              ? styles.laneTitleDikerjakan
              : isReview
              ? styles.laneTitleReview
              : styles.laneTitleSelesai;

            const laneCountClass = isToDo
              ? styles.laneCountBelumDimulai
              : isInProgress
              ? styles.laneCountDikerjakan
              : isReview
              ? styles.laneCountReview
              : styles.laneCountSelesai;

            const laneIcon = isToDo ? (
              <ClockCircleOutlined className={styles.laneIconBelumDimulai} />
            ) : isInProgress ? (
              <PlayCircleOutlined className={styles.laneIconDikerjakan} />
            ) : isReview ? (
              <EyeOutlined className={styles.laneIconReview} />
            ) : (
              <CheckCircleOutlined className={styles.laneIconSelesai} />
            );

            return (
              <div
                key={laneMeta.key}
                data-testid={`lane-${laneMeta.key.toLowerCase()}`}
                className={`${styles.laneSurface} ${laneSurfaceClass}`}
              >
                {/* Lane Header */}
                <div className={styles.laneHeader}>
                  <div className={styles.laneHeaderLeft}>
                    {laneIcon}
                    <h2 className={`${styles.laneTitle} ${laneTitleClass}`}>
                      {laneMeta.title}
                    </h2>
                  </div>
                  <span className={`${styles.laneCountPill} ${laneCountClass}`}>
                    {count}
                  </span>
                </div>

                {/* Cards Container */}
                <div className={styles.cardsStack}>
                  {laneTasks.length === 0 ? (
                    <div className={styles.emptyLaneBox}>
                      <span>Tidak ada task</span>
                    </div>
                  ) : (
                    laneTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        projectId={projectId}
                        currentUserId={user?.sub}
                        canVerify={canVerify}
                        onUpdateProgress={() => setRoutineModalTask(task)}
                        onClaimProgress={() => setClaimModalTask(task)}
                        onReviewClaim={() => handleOpenVerification(task)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MODALS & DRAWERS FOR CANONICAL EXECUTION ACTIONS */}
      {routineModalTask && (
        <RoutineProgressModal
          isOpen={Boolean(routineModalTask)}
          onClose={() => setRoutineModalTask(null)}
          onSuccess={() => {
            setRoutineModalTask(null);
            fetchBoardData(true);
          }}
          projectId={projectId}
          taskId={routineModalTask.id}
          taskName={routineModalTask.name}
          currentProgress={routineModalTask.progress}
        />
      )}

      {claimModalTask && (
        <ProgressClaimModal
          isOpen={Boolean(claimModalTask)}
          onClose={() => setClaimModalTask(null)}
          onSuccess={() => {
            setClaimModalTask(null);
            fetchBoardData(true);
          }}
          projectId={projectId}
          taskId={claimModalTask.id}
          taskName={claimModalTask.name}
          currentProgress={claimModalTask.progress}
        />
      )}

      {isVerificationDrawerOpen && (
        <ProgressVerificationDrawer
          isOpen={isVerificationDrawerOpen}
          onClose={() => {
            setIsVerificationDrawerOpen(false);
            setVerificationPendingLogs([]);
          }}
          onSuccess={() => {
            setIsVerificationDrawerOpen(false);
            setVerificationPendingLogs([]);
            fetchBoardData(true);
          }}
          projectId={projectId}
          pendingLogs={verificationPendingLogs}
          currentUserId={Number(user?.sub || 0)}
          canVerify={canVerify}
        />
      )}
    </div>
  );
};

/**
 * TaskCard Component
 * Implements authoritative EPMS task execution presentation hierarchy matching visual benchmark.
 */
interface TaskCardProps {
  task: TaskBoardTask;
  projectId: number;
  currentUserId?: number;
  canVerify: boolean;
  onUpdateProgress: () => void;
  onClaimProgress: () => void;
  onReviewClaim: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  projectId,
  currentUserId,
  canVerify,
  onUpdateProgress,
  onClaimProgress,
  onReviewClaim,
}) => {
  const isOverdue = task.isOverdue || task.overdueDays > 0;
  const canUpdate = task.availableActions?.includes('UPDATE_PROGRESS');
  const canClaim = task.availableActions?.includes('CLAIM_PROGRESS');
  const canReview = task.availableActions?.includes('REVIEW_CLAIM');
  const isDoneLane = task.boardLane === 'DONE' || task.progress === 100;

  const formattedPlannedFinish = useMemo(() => {
    if (!task.plannedFinish) return 'N/A';
    try {
      return dayjs(task.plannedFinish).format('DD MMM YYYY');
    } catch {
      return task.plannedFinish;
    }
  }, [task.plannedFinish]);

  // WBS / Task Code display
  const wbsLabel = task.code || `TSK-${task.id}`;

  // Assignee initial
  const assigneeInitial = task.assignee?.name
    ? task.assignee.name.charAt(0).toUpperCase()
    : null;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      className={styles.taskCard}
    >
      {/* 1. Header: Task Code & Badges */}
      <div className={styles.cardTopRow}>
        <span className={styles.wbsCode}>
          {wbsLabel}
        </span>
        <div className={styles.cardBadgesGroup}>
          {task.isCritical && (
            <span className={styles.criticalBadge}>
              CRITICAL
            </span>
          )}
          {isOverdue && (
            <span
              className={styles.overdueBadge}
              title={`Terlambat ${task.overdueDays} hari dibanding baseline`}
            >
              <WarningOutlined style={{ fontSize: 9 }} />
              TERLAMBAT {task.overdueDays}h
            </span>
          )}
          <button
            type="button"
            className={styles.cardOverflowBtn}
            title="Aksi task"
          >
            <MoreOutlined style={{ fontSize: 13 }} />
          </button>
        </div>
      </div>

      {/* 2. Task Name (Max 2 lines with Tooltip) */}
      <Tooltip title={task.name} placement="topLeft">
        <h3 className={styles.taskName}>
          {task.name}
        </h3>
      </Tooltip>

      {/* 3. Work Package / WBS parent association */}
      {task.workPackage && (
        <div className={styles.workPackageName}>
          {task.workPackage.name || task.workPackage.code}
        </div>
      )}

      {/* 4. Special Review Badges (for REVIEW tasks) */}
      {task.reviewState === 'PENDING_VERIFICATION' && (
        <div className={styles.reviewBadgesRow}>
          <span className={styles.pendingVerificationPill}>
            Menunggu Verifikasi
          </span>
          {task.evidenceCount > 0 && (
            <span className={styles.evidenceCountPill}>
              <PaperClipOutlined style={{ fontSize: 10 }} />
              {task.evidenceCount} Evidence
            </span>
          )}
        </div>
      )}

      {/* 5. Assignee / PIC and Planned Date */}
      <div className={styles.picAndDateRow}>
        <div className={styles.picGroup}>
          {task.assignee ? (
            <>
              <div className={styles.picAvatar}>
                {assigneeInitial}
              </div>
              <span className={styles.picNameText}>
                {task.assignee.name}
              </span>
              <span className={styles.picRoleSub}>PIC</span>
            </>
          ) : (
            <span className={styles.picUnassigned}>Belum Ditugaskan</span>
          )}
        </div>

        <div className={styles.targetDateGroup}>
          <CalendarOutlined style={{ fontSize: 11, color: '#94A3B8' }} />
          <span>{formattedPlannedFinish}</span>
        </div>
      </div>

      {/* 6. Authoritative Progress Bar & Truthful Percentage */}
      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div
            className={
              task.progress === 100
                ? styles.progressBarFillGreen
                : isOverdue
                ? styles.progressBarFillRed
                : styles.progressBarFillBlue
            }
            style={{ width: `${Math.min(100, Math.max(0, task.progress || 0))}%` }}
          />
        </div>
        <div className={styles.progressText}>
          {formatTaskProgress(task.progress)}
        </div>
      </div>

      {/* 7. Contextual Actions Footer */}
      <div className={styles.cardActionsRow}>
        {canUpdate && (
          <button
            type="button"
            onClick={onUpdateProgress}
            className={styles.btnActionPrimaryOutline}
          >
            Update Progress
          </button>
        )}

        {canClaim && (
          <button
            type="button"
            onClick={onClaimProgress}
            className={styles.btnActionNeutralOutline}
          >
            Claim Progress
          </button>
        )}

        {canReview && (
          <button
            type="button"
            onClick={onReviewClaim}
            className={styles.btnActionSolidBlue}
          >
            Review Claim
          </button>
        )}

        {isDoneLane && (
          <button
            type="button"
            className={styles.btnActionDetail}
          >
            Lihat Detail
          </button>
        )}

        <button
          type="button"
          className={styles.cardOverflowBtn}
          style={{ marginLeft: 'auto' }}
          title="Aksi lainnya"
        >
          <MoreOutlined style={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
};

export default ProjectTaskBoard;
