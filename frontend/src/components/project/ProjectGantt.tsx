import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Input,
  Select,
  Radio,
  Tooltip,
  Spin,
  Alert,
  Badge,
  Typography,
  Space,
} from 'antd';
import {
  SearchOutlined,
  CalendarOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  LineChartOutlined,
  ArrowLeftOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import styles from './ProjectGantt.module.css';
import ProjectService, {
  ProjectGanttResponse,
  ProjectGanttRow,
} from '@/services/project.service';
import {
  GanttZoomLevel,
  ZOOM_CONFIG,
  formatIndonesianDate,
  formatCompactDate,
  generateTimelineHeader,
  getBaselineBarGeometry,
  getActualBarGeometry,
  getMilestoneMarkerPosition,
  getAsOfMarkerPosition,
  filterGanttRows,
} from './gantt.utils';

const { Title, Text } = Typography;
const { Option } = Select;

interface ProjectGanttProps {
  projectId: number;
  onNavigateToBoard?: () => void;
  onNavigateToMonitoring?: () => void;
  onBackToMaster?: () => void;
  embedded?: boolean;
}

export const ProjectGantt: React.FC<ProjectGanttProps> = ({
  projectId,
  onNavigateToBoard,
  onNavigateToMonitoring,
  onBackToMaster,
  embedded = false,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ProjectGanttResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [search, setSearch] = useState<string>('');
  const [wpFilter, setWpFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [zoom, setZoom] = useState<GanttZoomLevel>('day');
  const [collapsedPackageIds, setCollapsedPackageIds] = useState<Set<string>>(new Set());

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ProjectService.getProjectGantt(projectId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load project Gantt data', err);
      setError(err?.response?.data?.message || err?.message || 'Gagal memuat data Gantt Proyek.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  // Unique work packages for filter
  const workPackages = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((r) => r.type === 'WORK_PACKAGE');
  }, [data]);

  // Filtered rows
  const visibleRows = useMemo(() => {
    if (!data?.rows) return [];
    return filterGanttRows(data.rows, search, wpFilter, statusFilter, collapsedPackageIds);
  }, [data, search, wpFilter, statusFilter, collapsedPackageIds]);

  // Timeline Header calculations
  const timelineHeader = useMemo(() => {
    if (!data?.timelineRange) return null;
    return generateTimelineHeader(
      data.timelineRange.startDate,
      data.timelineRange.endDate,
      zoom,
      data.asOf,
    );
  }, [data, zoom]);

  // Today / AsOf marker position
  const asOfX = useMemo(() => {
    if (!data?.timelineRange || !data?.asOf) return null;
    return getAsOfMarkerPosition(
      data.asOf,
      data.timelineRange.startDate,
      ZOOM_CONFIG[zoom].pxPerDay,
    );
  }, [data, zoom]);

  const toggleCollapse = (rowId: string) => {
    setCollapsedPackageIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Spin size="large" />
          <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Jadwal Gantt Baseline vs Aktual...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Gantt Chart"
          description={error || 'Data Gantt Chart tidak tersedia untuk proyek ini.'}
          action={
            <Button size="small" type="primary" onClick={fetchData}>
              Coba Lagi
            </Button>
          }
        />
      </div>
    );
  }

  const { project, summary, planComparisonAvailable, planComparisonUnavailableReason } = data;

  return (
    <div className={styles.container} data-testid="project-gantt-workspace">
      {/* 1. Header Card with Identity & Navigation */}
      {!embedded && (
        <div className={styles.headerCard} data-testid="gantt-header">
          <div className={styles.headerTop}>
            <div className={styles.projectTitleGroup}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {onBackToMaster && (
                  <Button
                    size="small"
                    icon={<ArrowLeftOutlined />}
                    onClick={onBackToMaster}
                    style={{ marginRight: '0.25rem' }}
                  >
                    Kembali
                  </Button>
                )}
                <Title level={4} className={styles.projectTitle} style={{ margin: 0 }}>
                  {project.name}
                </Title>
                <Tag color="blue">{project.code}</Tag>
                <Tag
                  color={
                    project.status === 'COMPLETED'
                      ? 'green'
                      : project.status === 'IN_PROGRESS'
                      ? 'processing'
                      : 'default'
                  }
                >
                  {project.status}
                </Tag>
              </div>
              <div className={styles.projectMetaRow}>
                <span className={styles.metaItem}>
                  <strong>Klien:</strong> {project.customerName || 'N/A'}
                </span>
                <span>•</span>
                <span className={styles.metaItem}>
                  <strong>Project Manager:</strong> {project.managerName || 'Belum ditugaskan'}
                </span>
                <span>•</span>
                <span className={styles.metaItem}>
                  <strong>As Of:</strong> {formatIndonesianDate(data.asOf)}
                </span>
              </div>
            </div>

            <div className={styles.headerActions}>
              {onNavigateToBoard && (
                <Button
                  icon={<AppstoreOutlined />}
                  onClick={onNavigateToBoard}
                  data-testid="gantt-nav-board"
                >
                  Task Board
                </Button>
              )}
              {onNavigateToMonitoring && (
                <Button
                  icon={<LineChartOutlined />}
                  onClick={onNavigateToMonitoring}
                  data-testid="gantt-nav-monitoring"
                >
                  Monitoring & Kurva S
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={fetchData} title="Muat Ulang" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Unavailable Baseline Banner if Plan Comparison is not valid */}
      {!planComparisonAvailable && (
        <div className={styles.invalidBaselineBanner} data-testid="gantt-unavailable-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <WarningOutlined style={{ fontSize: '1.25rem', color: '#d97706' }} />
            <div>
              <strong>Perbandingan Baseline vs Aktual Belum Tersedia</strong>
              <div>
                {planComparisonUnavailableReason === 'NO_ACTIVE_BASELINE'
                  ? 'Proyek ini belum memiliki Baseline WBS aktif yang disetujui. Silakan aktifkan baseline di Operasional Proyek terlebih dahulu.'
                  : planComparisonUnavailableReason === 'INVALID_BASELINE'
                  ? 'Baseline yang aktif memiliki integritas bobot tidak valid (total bobot leaf tidak 100%). Batang rencana tidak dapat diplot.'
                  : planComparisonUnavailableReason === 'TASK_MAPPING_INTEGRITY_ERROR'
                  ? 'Ditemukan ketidaksesuaian pemetaan task eksekusi pada baseline item. Silakan sinkronkan jadwal.'
                  : 'Baseline jadwal tidak dapat dibandingkan dengan data eksekusi.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Authoritative Summary KPI Cards */}
      <div className={styles.summaryGrid} data-testid="gantt-summary-cards">
        {/* Planned Schedule */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardLabel}>Jadwal Rencana (Baseline)</div>
          <div className={styles.summaryCardValue}>
            {summary.plannedStart ? formatCompactDate(summary.plannedStart) : 'N/A'} –{' '}
            {summary.plannedFinish ? formatCompactDate(summary.plannedFinish) : 'N/A'}
          </div>
          <div className={styles.summaryCardSub}>
            Mulai: {formatIndonesianDate(summary.plannedStart)} • Selesai:{' '}
            {formatIndonesianDate(summary.plannedFinish)}
          </div>
        </div>

        {/* Actual Schedule */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardLabel}>Jadwal Aktual (Eksekusi)</div>
          <div className={styles.summaryCardValue}>
            {summary.actualStart ? formatCompactDate(summary.actualStart) : 'Belum Mulai'}
            {summary.actualFinish ? ` – ${formatCompactDate(summary.actualFinish)}` : ''}
          </div>
          <div className={styles.summaryCardSub}>
            Mulai Aktual: {formatIndonesianDate(summary.actualStart)} • Target:{' '}
            {formatIndonesianDate(summary.plannedFinish)}
          </div>
        </div>

        {/* Progress & Variance */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardLabel}>Kemajuan Proyek</div>
          <div className={styles.summaryCardValue}>
            <span>{summary.actualProgress ?? 0}%</span>
            <span className={styles.summaryCardPlanProgress}>
              / {summary.plannedProgress ?? 0}% Plan
            </span>
          </div>
          <div className={styles.summaryCardSub}>
            {summary.progressVariancePp !== null && (
              <span
                style={{
                  color:
                    summary.progressVariancePp >= 0
                      ? '#059669'
                      : '#dc2626',
                  fontWeight: 600,
                }}
              >
                Deviasi: {summary.progressVariancePp > 0 ? '+' : ''}
                {summary.progressVariancePp} pp (
                {summary.progressHealth === 'AHEAD'
                  ? 'Di Atas Target'
                  : summary.progressHealth === 'BEHIND'
                  ? 'Terlambat'
                  : 'Sesuai Target'}
                )
              </span>
            )}
          </div>
        </div>

        {/* Overdue Items */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardLabel}>Peringatan Jadwal</div>
          <div className={styles.summaryCardValue}>
            <span style={{ color: summary.overdueTasksCount > 0 ? '#dc2626' : '#059669' }}>
              {summary.overdueTasksCount} Tugas Overdue
            </span>
          </div>
          <div className={styles.summaryCardSub}>
            {summary.lateMilestonesCount} Milestone Terlambat • {summary.totalTasksCount} Total Tugas ({summary.completedTasksCount} Selesai)
          </div>
        </div>
      </div>

      {/* 4. Toolbar: Search, Filters, Zoom */}
      <div className={styles.toolbarCard} data-testid="gantt-toolbar">
        <div className={styles.filterGroup}>
          <Input
            placeholder="Cari tugas / WBS..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            allowClear
            data-testid="gantt-search"
          />

          <Select
            value={wpFilter}
            onChange={setWpFilter}
            style={{ width: 200 }}
            data-testid="gantt-filter-wp"
          >
            <Option value="ALL">Semua Work Package</Option>
            {workPackages.map((wp) => (
              <Option key={wp.id} value={String(wp.wbsId)}>
                {wp.code} {wp.name}
              </Option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 170 }}
            data-testid="gantt-filter-status"
          >
            <Option value="ALL">Semua Status</Option>
            <Option value="NOT_STARTED">Belum Dimulai</Option>
            <Option value="IN_PROGRESS">Dalam Proses</Option>
            <Option value="COMPLETED">Selesai</Option>
            <Option value="OVERDUE">Terlambat / Overdue</Option>
            <Option value="MILESTONE">Milestone Saja</Option>
          </Select>
        </div>

        <div className={styles.zoomGroup}>
          <span className={styles.zoomLabel}>Skala:</span>
          <Radio.Group
            value={zoom}
            onChange={(e) => setZoom(e.target.value)}
            buttonStyle="solid"
            size="small"
            data-testid="gantt-zoom"
          >
            <Radio.Button value="day">Hari</Radio.Button>
            <Radio.Button value="week">Minggu</Radio.Button>
            <Radio.Button value="month">Bulan</Radio.Button>
          </Radio.Group>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchData}
            size="small"
            title="Muat Ulang"
            style={{ marginLeft: 6 }}
          />
        </div>
      </div>

      {/* 5. Split Workspace Grid: Left Hierarchy Table + Right Timeline Track */}
      {planComparisonAvailable && timelineHeader && (
        <div className={styles.ganttWorkspace} data-testid="gantt-grid">
          <div className={styles.ganttScrollWrapper} ref={timelineContainerRef}>
            {/* Left Hierarchy Pane (Sticky Left Column) */}
            <div className={styles.leftHierarchyPane}>
              {/* Header */}
              <div className={styles.leftHeaderRow}>
                <div>WBS / Tugas</div>
                <div>Bobot</div>
                <div>Kemajuan</div>
                <div>Status</div>
              </div>

              {/* Rows */}
              {visibleRows.map((row) => {
                const isPackage = row.type === 'WORK_PACKAGE';
                const isMilestone = row.type === 'MILESTONE';
                const isCollapsed = collapsedPackageIds.has(row.id);

                return (
                  <div
                    key={row.id}
                    className={`${styles.leftBodyRow} ${isPackage ? styles.packageRow : ''}`}
                    data-testid={`gantt-row-${row.code}`}
                  >
                    {/* Title with indent */}
                    <div
                      className={styles.taskNameCell}
                      style={{ paddingLeft: `${row.depth * 1.1}rem` }}
                    >
                      {isPackage ? (
                        <span
                          onClick={() => toggleCollapse(row.id)}
                          style={{ cursor: 'pointer', marginRight: '0.25rem', color: '#475569' }}
                        >
                          {isCollapsed ? <FolderOutlined /> : <FolderOpenOutlined />}
                        </span>
                      ) : isMilestone ? (
                        <FlagOutlined style={{ color: '#2563eb', marginRight: '0.25rem' }} />
                      ) : (
                        <FileTextOutlined style={{ color: '#94a3b8', marginRight: '0.25rem' }} />
                      )}
                      <span className={styles.taskCode}>{row.code}</span>
                      <Tooltip title={`${row.code} ${row.name}`}>
                        <span className={styles.taskTitle}>{row.name}</span>
                      </Tooltip>
                    </div>

                    {/* Weight */}
                    <div>{row.weight}%</div>

                    {/* Progress */}
                    <div>
                      <span style={{ fontWeight: 600 }}>{row.progress}%</span>
                      {row.progressVariancePp !== null && row.progressVariancePp !== 0 && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            marginLeft: '0.25rem',
                            color: row.progressVariancePp > 0 ? '#059669' : '#dc2626',
                          }}
                        >
                          ({row.progressVariancePp > 0 ? '+' : ''}
                          {row.progressVariancePp})
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {row.overdueDays > 0 || (row.milestoneOverdueDays && row.milestoneOverdueDays > 0) ? (
                        <Tag color="error">Terlambat</Tag>
                      ) : row.status === 'COMPLETED' ? (
                        <Tag color="success">Selesai</Tag>
                      ) : row.status === 'IN_PROGRESS' ? (
                        <Tag color="processing">Proses</Tag>
                      ) : (
                        <Tag color="default">Rencana</Tag>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Timeline Pane (Horizontally Scrollable) */}
            <div
              className={styles.rightTimelinePane}
              style={{ width: `${timelineHeader.totalWidth}px` }}
            >
              {/* Header Months */}
              <div className={styles.timelineHeaderGroupRow}>
                {timelineHeader.groups.map((grp, idx) => (
                  <div
                    key={`grp-${idx}`}
                    className={styles.monthHeaderCell}
                    style={{ width: `${grp.width}px` }}
                  >
                    {grp.label}
                  </div>
                ))}
              </div>

              {/* Header Ticks (Days / Weeks) */}
              <div className={styles.timelineHeaderTicksRow}>
                {timelineHeader.columns.map((col) => (
                  <div
                    key={col.key}
                    className={`${styles.tickHeaderCell} ${
                      col.isToday ? styles.tickToday : ''
                    } ${col.isWeekend ? styles.tickWeekend : ''}`}
                    style={{ width: `${col.width}px` }}
                  >
                    <span>{col.label}</span>
                    {col.subLabel && (
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                        {col.subLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Background vertical grid columns */}
              <div className={styles.gridBackground}>
                {timelineHeader.columns.map((col) => (
                  <div
                    key={`grid-${col.key}`}
                    className={`${styles.gridCol} ${
                      col.isWeekend ? styles.gridColWeekend : ''
                    }`}
                    style={{ width: `${col.width}px` }}
                  />
                ))}
              </div>

              {/* As Of / Today Vertical Line Marker */}
              {asOfX !== null && (
                <div
                  className={styles.asOfLine}
                  style={{ left: `${asOfX}px` }}
                  data-testid="gantt-asof-line"
                >
                  <div className={styles.asOfBadge}>
                    Hari Ini / As Of: {formatCompactDate(data.asOf)}
                  </div>
                </div>
              )}

              {/* Row Bars */}
              {visibleRows.map((row) => {
                const pxPerDay = ZOOM_CONFIG[zoom].pxPerDay;
                const timelineStart = data.timelineRange.startDate;

                // 1. Baseline Planned Geometry
                const baselineGeo = getBaselineBarGeometry(
                  row.plannedStart,
                  row.plannedFinish,
                  timelineStart,
                  pxPerDay,
                );

                // 2. Actual Geometry
                const actualGeo = getActualBarGeometry(
                  row.actualStart,
                  row.actualFinish,
                  data.asOf,
                  timelineStart,
                  pxPerDay,
                );

                // 3. Milestone markers
                const milestonePlanX = row.isMilestone
                  ? getMilestoneMarkerPosition(row.plannedDate || null, timelineStart, pxPerDay)
                  : null;
                const milestoneActualX =
                  row.isMilestone && row.actualDate
                    ? getMilestoneMarkerPosition(row.actualDate, timelineStart, pxPerDay)
                    : null;

                // Detailed Tooltip content answering the 10 schedule control questions
                const tooltipContent = (
                  <div style={{ fontSize: '0.78rem', lineHeight: 1.4, maxWidth: 300 }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                      {row.code} - {row.name}
                    </div>
                    <div>
                      <strong>Tipe:</strong> {row.type} | <strong>Bobot:</strong> {row.weight}%
                    </div>
                    <div style={{ borderTop: '1px solid #475569', margin: '0.25rem 0' }} />
                    <div>
                      <strong>Rencana:</strong>{' '}
                      {row.plannedStart ? formatIndonesianDate(row.plannedStart) : 'N/A'} s/d{' '}
                      {row.plannedFinish ? formatIndonesianDate(row.plannedFinish) : 'N/A'} (
                      {row.plannedDurationDays ?? 0} hari)
                    </div>
                    <div>
                      <strong>Aktual:</strong>{' '}
                      {row.actualStart ? formatIndonesianDate(row.actualStart) : 'Belum Mulai'} s/d{' '}
                      {row.actualFinish
                        ? formatIndonesianDate(row.actualFinish)
                        : row.actualStart
                        ? 'Dalam Proses'
                        : 'Belum Mulai'}{' '}
                      {row.actualDurationDays !== null ? `(${row.actualDurationDays} hari)` : ''}
                    </div>
                    <div style={{ borderTop: '1px solid #475569', margin: '0.25rem 0' }} />
                    <div>
                      <strong>Kemajuan:</strong> Aktual {row.progress}% vs Rencana{' '}
                      {row.plannedProgress ?? 0}% (Deviasi:{' '}
                      {row.progressVariancePp !== null
                        ? `${row.progressVariancePp > 0 ? '+' : ''}${row.progressVariancePp} pp`
                        : 'N/A'}
                      )
                    </div>
                    {row.startVarianceDays !== null && (
                      <div>
                        <strong>Deviasi Mulai:</strong>{' '}
                        {row.startVarianceDays > 0 ? `+${row.startVarianceDays}` : row.startVarianceDays}{' '}
                        hari ({row.startVarianceDays > 0 ? 'Mulai Terlambat' : 'Mulai Lebih Awal'})
                      </div>
                    )}
                    {row.startDelayDays > 0 && (
                      <div style={{ color: '#f87171' }}>
                        <strong>Keterlambatan Mulai:</strong> {row.startDelayDays} hari belum mulai
                      </div>
                    )}
                    {row.finishVarianceDays !== null && (
                      <div>
                        <strong>Deviasi Selesai:</strong>{' '}
                        {row.finishVarianceDays > 0 ? `+${row.finishVarianceDays}` : row.finishVarianceDays}{' '}
                        hari ({row.finishVarianceDays > 0 ? 'Selesai Terlambat' : 'Selesai Lebih Cepat'})
                      </div>
                    )}
                    {row.overdueDays > 0 && (
                      <div style={{ color: '#f87171', fontWeight: 700 }}>
                        <strong>Overdue:</strong> {row.overdueDays} hari melewati batas rencana!
                      </div>
                    )}
                    {row.isMilestone && row.milestoneVarianceDays !== undefined && row.milestoneVarianceDays !== null && (
                      <div>
                        <strong>Deviasi Milestone:</strong>{' '}
                        {row.milestoneVarianceDays > 0
                          ? `+${row.milestoneVarianceDays}`
                          : row.milestoneVarianceDays}{' '}
                        hari
                      </div>
                    )}
                    {row.isMilestone && (row.milestoneOverdueDays ?? 0) > 0 && (
                      <div style={{ color: '#f87171', fontWeight: 700 }}>
                        <strong>Milestone Terlambat:</strong> {row.milestoneOverdueDays} hari!
                      </div>
                    )}
                  </div>
                );

                return (
                  <div
                    key={`timeline-row-${row.id}`}
                    className={styles.timelineGridRow}
                    data-testid={`gantt-bar-row-${row.code}`}
                  >
                    <div className={styles.barContainer}>
                      {/* Top Bar: Baseline Planned Bar */}
                      {baselineGeo && !row.isMilestone && (
                        <Tooltip title={tooltipContent} placement="top">
                          <div
                            className={styles.baselineBar}
                            style={{
                              left: `${baselineGeo.left}px`,
                              width: `${baselineGeo.width}px`,
                            }}
                            data-testid={`gantt-plan-bar-${row.code}`}
                          />
                        </Tooltip>
                      )}

                      {/* Bottom Bar: Actual Execution Bar */}
                      {actualGeo && !row.isMilestone && (
                        <Tooltip title={tooltipContent} placement="bottom">
                          <div
                            className={`${styles.actualBar} ${
                              row.overdueDays > 0
                                ? styles.actualBarOverdue
                                : row.status === 'IN_PROGRESS'
                                ? styles.actualBarInProgress
                                : ''
                            }`}
                            style={{
                              left: `${actualGeo.left}px`,
                              width: `${actualGeo.width}px`,
                            }}
                            data-testid={`gantt-actual-bar-${row.code}`}
                          />
                        </Tooltip>
                      )}

                      {/* Milestone Diamond Markers */}
                      {row.isMilestone && milestonePlanX !== null && (
                        <Tooltip title={tooltipContent} placement="top">
                          <div
                            className={styles.milestoneDiamondPlan}
                            style={{ left: `${milestonePlanX}px` }}
                            data-testid={`gantt-plan-milestone-${row.code}`}
                          />
                        </Tooltip>
                      )}

                      {row.isMilestone && milestoneActualX !== null && (
                        <Tooltip title={tooltipContent} placement="bottom">
                          <div
                            className={styles.milestoneDiamondActual}
                            style={{ left: `${milestoneActualX}px` }}
                            data-testid={`gantt-actual-milestone-${row.code}`}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. Authoritative Legend */}
      <div className={styles.legendCard} data-testid="gantt-legend">
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <div className={styles.legendColorBox} style={{ background: '#93c5fd', border: '1px solid #60a5fa' }} />
            <span>Rencana (Baseline)</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColorBox} style={{ background: '#10b981', border: '1px solid #059669' }} />
            <span>Aktual (Selesai)</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColorBox} style={{ background: '#0ea5e9', border: '1px solid #0284c7' }} />
            <span>Aktual (Sedang Berjalan)</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColorBox} style={{ background: '#f87171', border: '1px solid #dc2626' }} />
            <span>Terlambat (Overdue)</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDiamond} style={{ background: '#2563eb', border: '1px solid #1d4ed8' }} />
            <span>Milestone Rencana</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDiamond} style={{ background: '#10b981', border: '1px solid #059669' }} />
            <span>Milestone Selesai</span>
          </div>
          <div className={styles.legendItem}>
            <div style={{ width: '16px', height: '2px', background: '#ef4444' }} />
            <span>Hari Ini / As Of</span>
          </div>
        </div>
        <div className={styles.legendNote}>
          * Model jadwal read-only otoritatif berpedoman pada baseline aktif & riwayat eksekusi terverifikasi.
        </div>
      </div>
    </div>
  );
};

export default ProjectGantt;
