'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Spin,
  Alert,
  Tooltip,
  Table,
  Tag,
  Button,
} from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  LineChartOutlined,
  ApartmentOutlined,
  FlagOutlined,
  HistoryOutlined,
  ProjectOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { ProjectService } from '@/services/project.service';
import styles from './ProjectProgressMonitoring.module.css';

interface ProjectProgressMonitoringProps {
  projectId: number;
  onBack: () => void;
  onOpenTaskBoard?: (projectId: number) => void;
  onOpenGantt?: (projectId: number) => void;
  embedded?: boolean;
}

export const ProjectProgressMonitoring: React.FC<ProjectProgressMonitoringProps> = ({
  projectId,
  onBack,
  onOpenTaskBoard,
  onOpenGantt,
  embedded = false,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await ProjectService.getProjectProgressMonitoring(projectId);
      setData(res);
    } catch (err: any) {
      console.error('[ProgressMonitoring] Failed to fetch data:', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Gagal memuat data Progress & Monitoring proyek.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (projectId && projectId > 0) {
      fetchData();
    }
  }, [projectId]);

  // Health presentation helper
  const getHealthBadge = (health: string | null) => {
    if (!health) {
      return (
        <span className={styles.kpiHealthBadge} style={{ color: '#94A3B8' }}>
          BELUM TERSEDIA
        </span>
      );
    }
    switch (health) {
      case 'AHEAD':
        return (
          <span className={styles.kpiHealthBadge} style={{ color: '#16A34A' }}>
            <span style={{ fontSize: 10 }}>●</span> LEBIH CEPAT
          </span>
        );
      case 'ON_PLAN':
        return (
          <span className={styles.kpiHealthBadge} style={{ color: '#2563EB' }}>
            <span style={{ fontSize: 10 }}>●</span> SESUAI RENCANA
          </span>
        );
      case 'BEHIND':
        return (
          <span className={styles.kpiHealthBadge} style={{ color: '#DC2626' }}>
            <span style={{ fontSize: 10 }}>●</span> TERLAMBAT
          </span>
        );
      default:
        return (
          <span className={styles.kpiHealthBadge} style={{ color: '#94A3B8' }}>
            {health}
          </span>
        );
    }
  };

  // S-Curve SVG metrics
  const chartConfig = useMemo(() => {
    if (!data?.curve?.points || data.curve.points.length === 0) return null;
    const points: Array<{ date: string; plannedProgress: number | null; actualProgress: number | null }> = data.curve.points;
    const width = 1000;
    const height = 280;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const n = points.length;
    const getX = (idx: number) => padding.left + (idx / Math.max(1, n - 1)) * chartW;
    const getY = (val: number) => padding.top + chartH - (Math.max(0, Math.min(100, val)) / 100) * chartH;

    // Plan path
    const planCoords = points
      .map((p, i) => {
        if (p.plannedProgress === null) return null;
        return `${getX(i).toFixed(1)},${getY(p.plannedProgress).toFixed(1)}`;
      })
      .filter(Boolean);
    const planPath = planCoords.length > 0 ? `M ${planCoords.join(' L ')}` : '';

    // Actual path (only for non-null actual values)
    const actualPointsWithIndex: Array<{ x: number; y: number; p: typeof points[0]; idx: number }> = [];
    points.forEach((p, i) => {
      if (p.actualProgress !== null) {
        actualPointsWithIndex.push({
          x: getX(i),
          y: getY(p.actualProgress),
          p,
          idx: i,
        });
      }
    });

    const actualPath =
      actualPointsWithIndex.length > 1
        ? `M ${actualPointsWithIndex.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L ')}`
        : '';

    // Date ticks (5-7 ticks evenly distributed)
    const tickIndices: number[] = [];
    const maxTicks = Math.min(6, n);
    for (let k = 0; k < maxTicks; k++) {
      const idx = Math.round((k / (maxTicks - 1)) * (n - 1));
      if (!tickIndices.includes(idx)) tickIndices.push(idx);
    }

    return {
      width,
      height,
      padding,
      chartW,
      chartH,
      getX,
      getY,
      planPath,
      actualPath,
      actualPointsWithIndex,
      tickIndices,
      points,
    };
  }, [data?.curve?.points]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 380 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Spin size="large" />
          <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Project Control & S-Curve...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.monitoringWorkspace} data-testid="project-progress-monitoring">
        <div className={styles.topNavRow}>
          <div className={styles.breadcrumbGroup}>
            <LineChartOutlined className={styles.breadcrumbIcon} />
            <span className={styles.breadcrumbParent}>Project Delivery</span>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbActive}>Progress & Monitoring</span>
          </div>
          <button className={styles.backButton} onClick={onBack}>
            <ArrowLeftOutlined /> Kembali ke Daftar Proyek Berjalan
          </button>
        </div>
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Data Monitoring"
          description={error || 'Data proyek tidak ditemukan.'}
          action={
            <Button size="small" type="primary" onClick={() => fetchData()}>
              Coba Lagi
            </Button>
          }
        />
      </div>
    );
  }

  const { project, control, taskSummary, curve, workPackages, milestones, recentActivity } = data;

  const plannedProgressVal = control.planComparisonAvailable && control.plannedProgress !== null
    ? `${Number(control.plannedProgress).toFixed(1)}%`
    : 'N/A';

  const actualProgressVal = control.actualProgress !== null
    ? `${Number(control.actualProgress).toFixed(1)}%`
    : 'N/A';

  const varianceVal = control.planComparisonAvailable && control.progressVariancePp !== null
    ? `${control.progressVariancePp >= 0 ? '+' : ''}${Number(control.progressVariancePp).toFixed(1)} pp`
    : 'N/A';

  const baselinePeriodText = project.plannedStart && project.plannedFinish
    ? `${project.plannedStart} – ${project.plannedFinish}`
    : 'Belum ditentukan';

  // Work package table columns
  const wpColumns = [
    {
      title: 'Work Package',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <div>
          <span style={{ fontWeight: 600, color: '#0F172A' }}>{record.code} {name}</span>
        </div>
      ),
    },
    {
      title: 'Bobot',
      dataIndex: 'descendantLeafWeight',
      key: 'descendantLeafWeight',
      align: 'right' as const,
      render: (w: number) => (w !== null ? `${Number(w).toFixed(1)}%` : 'N/A'),
    },
    {
      title: 'Rencana',
      dataIndex: 'plannedProgress',
      key: 'plannedProgress',
      align: 'right' as const,
      render: (p: number) => (p !== null ? `${Number(p).toFixed(1)}%` : 'N/A'),
    },
    {
      title: 'Aktual',
      dataIndex: 'actualProgress',
      key: 'actualProgress',
      align: 'right' as const,
      render: (p: number) => (p !== null ? `${Number(p).toFixed(1)}%` : 'N/A'),
    },
    {
      title: 'Deviasi',
      dataIndex: 'progressVariancePp',
      key: 'progressVariancePp',
      align: 'right' as const,
      render: (v: number) => {
        if (v === null) return 'N/A';
        const color = v > 0 ? '#16A34A' : v < 0 ? '#DC2626' : '#2563EB';
        return <span style={{ color, fontWeight: 600 }}>{v >= 0 ? '+' : ''}{Number(v).toFixed(1)} pp</span>;
      },
    },
    {
      title: 'Overdue',
      dataIndex: 'overdueTaskCount',
      key: 'overdueTaskCount',
      align: 'center' as const,
      render: (cnt: number) => (cnt > 0 ? <Tag color="error">{cnt} Task</Tag> : <span style={{ color: '#94A3B8' }}>0</span>),
    },
    {
      title: 'Review',
      dataIndex: 'reviewTaskCount',
      key: 'reviewTaskCount',
      align: 'center' as const,
      render: (cnt: number) => (cnt > 0 ? <Tag color="purple">{cnt} Task</Tag> : <span style={{ color: '#94A3B8' }}>0</span>),
    },
    {
      title: 'Target Selesai',
      dataIndex: 'plannedFinish',
      key: 'plannedFinish',
      render: (d: string) => d || '-',
    },
    {
      title: 'Health',
      dataIndex: 'health',
      key: 'health',
      align: 'center' as const,
      render: (h: string) => {
        if (!h) return <span style={{ color: '#94A3B8' }}>N/A</span>;
        if (h === 'AHEAD') return <Tag color="success">LEBIH CEPAT</Tag>;
        if (h === 'BEHIND') return <Tag color="error">TERLAMBAT</Tag>;
        return <Tag color="blue">SESUAI RENCANA</Tag>;
      },
    },
  ];

  // Milestone table columns
  const milestoneColumns = [
    {
      title: 'Milestone',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <div>
          <span style={{ fontWeight: 600, color: '#0F172A' }}>{record.code} {name}</span>
        </div>
      ),
    },
    {
      title: 'Target Baseline',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      render: (d: string) => d || '-',
    },
    {
      title: 'Realisasi Selesai',
      dataIndex: 'actualDate',
      key: 'actualDate',
      render: (d: string) => d || <span style={{ color: '#94A3B8' }}>Belum Selesai</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => {
        switch (st) {
          case 'SELESAI':
            return <Tag color="success">Selesai</Tag>;
          case 'SELESAI_LEBIH_CEPAT':
            return <Tag color="success">Selesai Cepat</Tag>;
          case 'SELESAI_TERLAMBAT':
            return <Tag color="orange">Selesai Terlambat</Tag>;
          case 'TERLAMBAT':
            return <Tag color="error">Terlambat</Tag>;
          default:
            return <Tag color="default">Belum Jatuh Tempo</Tag>;
        }
      },
    },
  ];

  return (
    <div className={styles.monitoringWorkspace} data-testid="project-progress-monitoring">
      {/* 0. Top Navigation & Breadcrumbs */}
      {!embedded && (
        <div className={styles.topNavRow}>
          <div className={styles.breadcrumbGroup}>
            <LineChartOutlined className={styles.breadcrumbIcon} />
            <span className={styles.breadcrumbParent}>Project Delivery</span>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbActive}>Progress & Monitoring</span>
          </div>

          <div className={styles.topActionsGroup}>
            {onOpenTaskBoard && (
              <button
                className={styles.primaryNavButton}
                onClick={() => onOpenTaskBoard(projectId)}
                data-testid="btn-nav-to-task-board"
              >
                <ProjectOutlined /> Buka Task Board
              </button>
            )}
            {onOpenGantt && (
              <button
                className={styles.primaryNavButton}
                onClick={() => onOpenGantt(projectId)}
                data-testid="btn-nav-to-gantt"
              >
                <CalendarOutlined /> Buka Gantt Chart
              </button>
            )}
            <button
              className={styles.backButton}
              onClick={onBack}
              data-testid="btn-back-to-active-projects"
            >
              <ArrowLeftOutlined /> Kembali ke Daftar Proyek Berjalan
            </button>
          </div>
        </div>
      )}

      {/* 1. Project Header Card / Embedded KPI Bar */}
      <div className={styles.headerCard} style={embedded ? { padding: '12px 20px' } : undefined}>
        <div className={styles.headerMainRow} style={embedded ? { justifyContent: 'flex-end' } : undefined}>
          {/* Identity Left (hidden in embedded mode to remove duplicated shell header) */}
          {!embedded && (
            <div className={styles.identityCol}>
              <div className={styles.titleRow}>
                <h1 className={styles.projectTitle}>
                  Progress & Monitoring — {project.name || 'Proyek Tanpa Nama'}
                </h1>
                {project.code && <span className={styles.contractBadge}>{project.code}</span>}
                <span
                  className={styles.statusBadge}
                  style={{
                    color: project.status === 'IN_PROGRESS' ? '#16A34A' : '#475569',
                    background: project.status === 'IN_PROGRESS' ? '#F0FDF4' : '#F1F5F9',
                    border: `1px solid ${project.status === 'IN_PROGRESS' ? '#BBF7D0' : '#E2E8F0'}`,
                  }}
                >
                  {project.status === 'IN_PROGRESS' ? 'IN PROGRESS' : project.status}
                </span>
              </div>

              <div className={styles.metadataRow}>
                <div className={styles.metadataItem}>
                  <div className={styles.metadataIconCircle}>
                    <BankOutlined />
                  </div>
                  <div className={styles.metadataContent}>
                    <span className={styles.metadataLabel}>Klien</span>
                    <span className={styles.metadataValue}>{project.customerName || 'N/A'}</span>
                  </div>
                </div>

                <div className={styles.metadataItem}>
                  <div className={styles.metadataAvatar}>
                    {(project.managerName || 'PM').slice(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.metadataContent}>
                    <span className={styles.metadataLabel}>Project Manager</span>
                    <span className={styles.metadataValue}>{project.managerName || 'Belum Ditugaskan'}</span>
                  </div>
                </div>

                <div className={styles.metadataItem}>
                  <div className={styles.metadataIconCircle}>
                    <CalendarOutlined />
                  </div>
                  <div className={styles.metadataContent}>
                    <span className={styles.metadataLabel}>Periode Proyek (Baseline)</span>
                    <span className={styles.metadataValue}>{baselinePeriodText}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KPI Summary Cards Right */}
          <div className={styles.kpiRow}>
            {/* Rencana */}
            <div className={styles.kpiCard} data-testid="kpi-planned-today">
              <span className={styles.kpiLabel}>Rencana Hari Ini</span>
              <span className={styles.kpiValue}>{plannedProgressVal}</span>
            </div>

            {/* Aktual */}
            <div className={styles.kpiCard} data-testid="kpi-actual-today">
              <span className={styles.kpiLabel}>Aktual Hari Ini</span>
              <span className={styles.kpiValue} style={{ color: '#16A34A' }}>
                {actualProgressVal}
              </span>
              <div className={styles.kpiMiniBarTrack}>
                <div
                  className={styles.kpiMiniBarFill}
                  style={{
                    width: control.actualProgress ? `${Math.min(100, Math.max(0, control.actualProgress))}%` : '0%',
                  }}
                />
              </div>
            </div>

            {/* Deviasi */}
            <div className={styles.kpiCard} data-testid="kpi-variance">
              <span className={styles.kpiLabel}>Deviasi</span>
              <span
                className={styles.kpiValue}
                style={{
                  color: control.progressVariancePp !== null
                    ? control.progressVariancePp > 0
                      ? '#16A34A'
                      : control.progressVariancePp < 0
                      ? '#DC2626'
                      : '#2563EB'
                    : '#0F172A',
                }}
              >
                {varianceVal}
              </span>
            </div>

            {/* Health */}
            <div className={styles.kpiCard} style={{ minWidth: 130 }} data-testid="kpi-health">
              <span className={styles.kpiLabel}>Health</span>
              {getHealthBadge(control.progressHealth)}
            </div>

            {/* Refresh */}
            <Tooltip title="Muat ulang data monitoring">
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={() => fetchData(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  borderColor: '#E2E8F0',
                  color: '#64748B',
                }}
              />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* 2. Execution Summary Chips */}
      <div className={styles.executionSummaryCard} data-testid="execution-summary-chips">
        <div className={styles.summaryGroup}>
          <span className={styles.summarySectionTitle}>Status Eksekusi Task:</span>
          <div className={styles.summaryChip}>
            <ClockCircleFilled style={{ color: '#3B82F6' }} />
            <span>Belum Dimulai:</span>
            <span className={styles.summaryChipCount}>{taskSummary.todo}</span>
          </div>
          <div className={styles.summaryChip}>
            <ClockCircleFilled style={{ color: '#F59E0B' }} />
            <span>Dikerjakan:</span>
            <span className={styles.summaryChipCount}>{taskSummary.inProgress}</span>
          </div>
          <div className={styles.summaryChip}>
            <ExclamationCircleFilled style={{ color: '#8B5CF6' }} />
            <span>Menunggu Review:</span>
            <span className={styles.summaryChipCount} style={{ color: taskSummary.review > 0 ? '#7C3AED' : undefined }}>
              {taskSummary.review}
            </span>
          </div>
          <div className={styles.summaryChip}>
            <CheckCircleFilled style={{ color: '#10B981' }} />
            <span>Selesai:</span>
            <span className={styles.summaryChipCount}>{taskSummary.done}</span>
          </div>
          <div className={styles.summaryChip} style={{ background: taskSummary.overdue > 0 ? '#FEF2F2' : undefined, borderColor: taskSummary.overdue > 0 ? '#FCA5A5' : undefined }}>
            <ExclamationCircleFilled style={{ color: taskSummary.overdue > 0 ? '#DC2626' : '#94A3B8' }} />
            <span>Terlambat:</span>
            <span className={styles.summaryChipCount} style={{ color: taskSummary.overdue > 0 ? '#DC2626' : undefined }}>
              {taskSummary.overdue}
            </span>
          </div>
        </div>

        <div className={styles.summaryGroup}>
          <span className={styles.summarySectionTitle}>Milestone:</span>
          <div className={styles.summaryChip}>
            <FlagOutlined style={{ color: '#2563EB' }} />
            <span>Total Milestone:</span>
            <span className={styles.summaryChipCount}>{milestones.length}</span>
          </div>
        </div>
      </div>

      {/* 3. S-Curve Plan vs Actual */}
      <div className={styles.surfaceCard} data-testid="scurve-chart-card">
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitles}>
            <div className={styles.cardTitle}>
              <LineChartOutlined style={{ color: '#2563EB' }} />
              <span>S-Curve Plan vs Actual</span>
            </div>
            <span className={styles.cardSubtitle}>
              Perbandingan kurva rencana baseline aktif dan progres historis aktual resmi (project_progress_logs)
            </span>
          </div>

          <div>
            {curve.planAvailable ? (
              curve.historyCoverage === 'FULL' && chartConfig && chartConfig.actualPointsWithIndex.length > 0 ? (
                <Tag color="success">Data Historis Lengkap</Tag>
              ) : curve.historyCoverage === 'PARTIAL' && chartConfig && chartConfig.actualPointsWithIndex.length > 0 ? (
                <Tag color="warning">Data Historis Sebagian</Tag>
              ) : (
                <Tag color="default">Belum ada histori aktual</Tag>
              )
            ) : (
              <Tag color="error">Baseline Tidak Tersedia / Tidak Valid</Tag>
            )}
          </div>
        </div>

        {!curve.planAvailable ? (
          <div className={styles.emptyBox}>
            Baseline aktif belum tersedia atau tidak valid (total bobot leaf tidak 100%). Kurva rencana tidak dapat dihitung.
          </div>
        ) : !chartConfig ? (
          <div className={styles.emptyBox}>Data kurva belum tersedia.</div>
        ) : (
          <div className={styles.chartContainer}>
            <svg
              viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
              className={styles.chartSvg}
            >
              {/* Y Grid lines and labels (0%, 25%, 50%, 75%, 100%) */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = chartConfig.getY(val);
                return (
                  <g key={`y-grid-${val}`}>
                    <line
                      x1={chartConfig.padding.left}
                      y1={y}
                      x2={chartConfig.width - chartConfig.padding.right}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={val === 0 ? undefined : '3 3'}
                      strokeWidth={val === 0 ? 1.5 : 1}
                    />
                    <text
                      x={chartConfig.padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={11}
                      fill="#64748B"
                      fontFamily="monospace"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* X Axis labels */}
              {chartConfig.tickIndices.map((idx) => {
                const p = chartConfig.points[idx];
                const x = chartConfig.getX(idx);
                return (
                  <text
                    key={`x-tick-${idx}`}
                    x={x}
                    y={chartConfig.height - 12}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#64748B"
                    fontFamily="monospace"
                  >
                    {p.date.slice(5)}
                  </text>
                );
              })}

              {/* Plan Line */}
              {chartConfig.planPath && (
                <path
                  d={chartConfig.planPath}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Actual Line */}
              {chartConfig.actualPath && (
                <path
                  d={chartConfig.actualPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Actual Data Points */}
              {chartConfig.actualPointsWithIndex.map((pt, i) => (
                <circle
                  key={`actual-pt-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint?.date === pt.p.date ? 6.5 : (chartConfig.actualPointsWithIndex.length === 1 ? 5.5 : 3.5)}
                  fill="#10B981"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  onMouseEnter={() => setHoveredPoint(pt.p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                />
              ))}

              {/* Interactive Hover Guides */}
              {hoveredPoint && (
                <g>
                  {chartConfig.points.findIndex((p) => p.date === hoveredPoint.date) >= 0 && (
                    <line
                      x1={chartConfig.getX(chartConfig.points.findIndex((p) => p.date === hoveredPoint.date))}
                      y1={chartConfig.padding.top}
                      x2={chartConfig.getX(chartConfig.points.findIndex((p) => p.date === hoveredPoint.date))}
                      y2={chartConfig.height - chartConfig.padding.bottom}
                      stroke="#94A3B8"
                      strokeDasharray="3 3"
                    />
                  )}
                </g>
              )}
            </svg>

            {/* Hover Tooltip display */}
            {hoveredPoint && (
              <div
                data-testid="scurve-tooltip"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 20,
                  background: '#0F172A',
                  color: '#FFFFFF',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <span><strong>Tanggal:</strong> {hoveredPoint.date}</span>
                <span style={{ color: '#93C5FD' }}>
                  <strong>Rencana:</strong> {hoveredPoint.plannedProgress !== null ? `${hoveredPoint.plannedProgress}%` : '-'}
                </span>
                <span style={{ color: '#86EFAC' }}>
                  <strong>Aktual:</strong> {hoveredPoint.actualProgress !== null ? `${hoveredPoint.actualProgress}%` : '-'}
                </span>
                {hoveredPoint.plannedProgress !== null && hoveredPoint.actualProgress !== null && (
                  <span style={{ color: hoveredPoint.actualProgress >= hoveredPoint.plannedProgress ? '#86EFAC' : '#FCA5A5' }}>
                    <strong>Deviasi:</strong> {(hoveredPoint.actualProgress - hoveredPoint.plannedProgress).toFixed(1)} pp
                  </span>
                )}
              </div>
            )}

            {/* Legend */}
            <div className={styles.legendRow}>
              <div className={styles.legendItem}>
                <div className={styles.legendColorBox} style={{ background: '#2563EB' }} />
                <span>Rencana (Baseline)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColorBox} style={{ background: '#10B981' }} />
                <span>Aktual (Resmi)</span>
              </div>
              {(curve.historyCoverage === 'UNAVAILABLE' || (chartConfig && chartConfig.actualPointsWithIndex.length === 0)) && (
                <span style={{ color: '#64748B', fontStyle: 'italic' }}>
                  (Belum ada data historis aktual resmi untuk proyek ini)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Work Package Control */}
      <div className={styles.surfaceCard} data-testid="work-package-card">
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitles}>
            <div className={styles.cardTitle}>
              <ApartmentOutlined style={{ color: '#2563EB' }} />
              <span>Work Package Control</span>
            </div>
            <span className={styles.cardSubtitle}>
              Monitoring progres rencana vs aktual dan deviasi per paket kerja (WBS Level 1/2)
            </span>
          </div>
        </div>

        {workPackages.length === 0 ? (
          <div className={styles.emptyBox}>Tidak ada Work Package terdaftar pada baseline aktif.</div>
        ) : (
          <div data-testid="work-package-table" className={styles.tableScrollWrapper}>
            <Table
              dataSource={workPackages}
              columns={wpColumns}
              rowKey="wbsId"
              pagination={false}
              size="middle"
              scroll={{ x: 800 }}
            />
          </div>
        )}
      </div>

      {/* 5. Milestones & Recent Activity Two-Column Grid */}
      <div className={styles.twoColGrid}>
        {/* Milestone Monitoring */}
        <div className={styles.surfaceCard} data-testid="milestone-card">
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderTitles}>
              <div className={styles.cardTitle}>
                <FlagOutlined style={{ color: '#2563EB' }} />
                <span>Milestone Monitoring</span>
              </div>
              <span className={styles.cardSubtitle}>
                Target tanggal penyelesaian milestone proyek vs realisasi aktual
              </span>
            </div>
          </div>

          {milestones.length === 0 ? (
            <div className={styles.emptyBox}>Tidak ada milestone pada baseline aktif proyek.</div>
          ) : (
            <div className={styles.tableScrollWrapper} data-testid="milestone-table-wrapper">
              <Table
                dataSource={milestones}
                columns={milestoneColumns}
                rowKey="taskId"
                pagination={false}
                size="small"
                scroll={{ x: 500 }}
              />
            </div>
          )}
        </div>

        {/* Recent Execution Activity */}
        <div className={styles.surfaceCard} data-testid="recent-activity-card">
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderTitles}>
              <div className={styles.cardTitle}>
                <HistoryOutlined style={{ color: '#2563EB' }} />
                <span>Aktivitas Progres Terbaru (Official Ledger)</span>
              </div>
              <span className={styles.cardSubtitle}>
                Riwayat update progres, claim, dan verifikasi resmi terkini
              </span>
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <div className={styles.emptyBox}>Belum ada riwayat aktivitas progres resmi tercatat.</div>
          ) : (
            <div className={styles.activityList}>
              {recentActivity.map((act: any) => {
                const isPositive = act.progressDelta >= 0;
                return (
                  <div key={act.id} className={styles.activityItem}>
                    <div className={styles.activityHeader}>
                      <span className={styles.activityTaskTitle}>{act.taskName}</span>
                      <Tag color={act.status === 'OFFICIAL' ? 'green' : act.status === 'PENDING_VERIFICATION' ? 'purple' : 'red'}>
                        {act.eventType}
                      </Tag>
                    </div>

                    <div className={styles.activityMetaRow}>
                      <span>
                        Oleh: <strong>{act.actorName}</strong> ({new Date(act.createdAt).toLocaleDateString('id-ID')})
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {act.evidenceCount > 0 && (
                          <span style={{ color: '#2563EB' }}>
                            <PaperClipOutlined /> {act.evidenceCount} Dokumen
                          </span>
                        )}
                        <span
                          className={styles.activityDelta}
                          style={{ color: isPositive ? '#16A34A' : '#DC2626' }}
                        >
                          {act.previousProgress}% → {act.reportedProgress}% ({isPositive ? '+' : ''}{act.progressDelta}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectProgressMonitoring;
