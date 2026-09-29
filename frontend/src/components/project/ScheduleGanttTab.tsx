'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  Table,
  Tag,
  DatePicker,
  Select,
  Checkbox,
  Button,
  Space,
  Row,
  Col,
  Tooltip,
  Typography,
  Radio,
  Empty,
  Alert,
  Modal,
  Descriptions,
  Divider,
} from 'antd';
import {
  ScheduleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ApartmentOutlined,
  AimOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  CompressOutlined,
  InfoCircleOutlined,
  BranchesOutlined,
  FlagOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { ProjectCharter } from '../ProjectOperationTab';
import { WbsNodeItem } from './WbsTreeTableModal';
import {
  isSchedulePopulated,
  normalizeWbsCode,
  createEmptyScheduleItem,
  syncScheduleMetadata,
  reconcileScheduleWithWbs,
  buildSaveProjectSchedulePayload,
  extractPersistedWbsArray,
  assertPersistedWbsNodesHaveDbIds,
} from './schedule-reconciliation.utils';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Text } = Typography;
const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export interface ScheduleTaskItem {
  id?: number; // Persistent Database Task ID
  wbsNodeId: string;
  wbsCode: string;
  name: string;
  type?: 'TASK' | 'MILESTONE'; // Canonical deliverable schedule type
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  duration?: number;  // inclusive calendar days (0 for Milestone)
  predecessorTaskId?: number | null; // Database Predecessor Task ID
  predecessorWbsCode?: string; // WBS code of predecessor (e.g. '1.1')
  dependencyType?: 'FS'; // Finish-to-Start
  isMilestone?: boolean; // Legacy/backward compatibility boolean
  progress?: number; // 0.00 - 100.00
  status?: string; // PLANNED, IN_PROGRESS, COMPLETED, BLOCKED, CANCELLED
  assigneeId?: number | null;
}

export interface ScheduleGanttTabProps {
  charter: ProjectCharter | null;
  wbsData: WbsNodeItem[];
  initialScheduleData?: ScheduleTaskItem[];
  onScheduleChange?: (items: ScheduleTaskItem[], isUserEdit?: boolean) => void;
  onNavigateToWbs?: () => void;
}

// Helper: Extract all leaf nodes from WBS recursively
export function extractLeafWbsNodes(nodes: WbsNodeItem[]): { id: string; code: string; name: string; level: number }[] {
  const leaves: { id: string; code: string; name: string; level: number }[] = [];
  function traverse(list: WbsNodeItem[]) {
    for (const item of list) {
      if (!item.children || item.children.length === 0) {
        leaves.push({ id: item.id, code: item.code, name: item.name, level: item.level });
      } else {
        traverse(item.children);
      }
    }
  }
  traverse(nodes);
  return leaves;
}

// Helper: Calculate elapsed duration in calendar days (End - Start)
export function calculateElapsedDuration(startStr?: string, endStr?: string): number {
  if (!startStr || !endStr) return 0;
  const start = dayjs(startStr);
  const end = dayjs(endStr);
  if (!start.isValid() || !end.isValid()) return 0;
  if (end.isBefore(start, 'day')) return 0;
  return end.diff(start, 'day');
}

// Backward-compatible alias for existing imports
export const calculateInclusiveDuration = calculateElapsedDuration;

// Helper: Detect circular dependencies in FS network
export function detectCircularDependencies(items: ScheduleTaskItem[]): Set<string> {
  const codeToPredMap = new Map<string, string>();
  for (const item of items) {
    if (item.predecessorWbsCode) {
      codeToPredMap.set(item.wbsCode, item.predecessorWbsCode);
    }
  }

  const circularNodes = new Set<string>();

  for (const item of items) {
    const visited = new Set<string>();
    let curr: string | undefined = item.wbsCode;

    while (curr) {
      if (visited.has(curr)) {
        circularNodes.add(item.wbsCode);
        break;
      }
      visited.add(curr);
      curr = codeToPredMap.get(curr);
    }
  }

  return circularNodes;
}

// Re-export reconciliation helpers from schedule-reconciliation.utils
export {
  isSchedulePopulated,
  normalizeWbsCode,
  createEmptyScheduleItem,
  syncScheduleMetadata,
  reconcileScheduleWithWbs,
  buildSaveProjectSchedulePayload,
  extractPersistedWbsArray,
  assertPersistedWbsNodesHaveDbIds,
};
export type { BuildSchedulePayloadResult } from './schedule-reconciliation.utils';

export const ScheduleGanttTab: React.FC<ScheduleGanttTabProps> = ({
  charter,
  wbsData,
  initialScheduleData,
  onScheduleChange,
  onNavigateToWbs,
}) => {
  const [scheduleItems, setScheduleItems] = useState<ScheduleTaskItem[]>(() => initialScheduleData || []);
  // Ref tracks current scheduleItems for reconciliation fallback
  // without adding scheduleItems to useEffect dependency array.
  const scheduleItemsRef = useRef<ScheduleTaskItem[]>([]);
  scheduleItemsRef.current = scheduleItems;
  const [timelineScale, setTimelineScale] = useState<'day' | 'week' | 'month' | 'quarter'>('month');
  const [saveStatus, setSaveStatus] = useState<string>('Draft tersimpan di browser');
  const [selectedDetailTask, setSelectedDetailTask] = useState<ScheduleTaskItem | null>(null);
  const [hoveredTaskWbsCode, setHoveredTaskWbsCode] = useState<string | null>(null);
  const ganttScrollRef = useRef<HTMLDivElement>(null);

  const draftStorageKey = useMemo(() => {
    if (!charter) return null;
    const projectId = Number(charter.projectId || charter.id || 0);
    return projectId ? `epms_schedule_draft_${projectId}` : null;
  }, [charter]);

  // Extract current leaf nodes from WBS
  const currentWbsLeaves = useMemo(() => {
    return extractLeafWbsNodes(wbsData);
  }, [wbsData]);

  // 1. Synchronize WBS leaf deliverables with Local Schedule State
  // Uses 4-level reconciliation priority to prevent populated schedule
  // from being replaced with empty template during intermediate state changes.
  useEffect(() => {
    if (!draftStorageKey) return;

    // Source A: Server/saved schedule data (from props or localStorage)
    let savedDraft: ScheduleTaskItem[] = initialScheduleData && initialScheduleData.length > 0 ? initialScheduleData : [];
    if (savedDraft.length === 0) {
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(draftStorageKey) : null;
        if (stored) {
          savedDraft = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed to parse schedule draft:', e);
      }
    }

    // Reconcile using canonical 4-level priority logic
    const synchronized = reconcileScheduleWithWbs(
      currentWbsLeaves,
      savedDraft,
      scheduleItemsRef.current,
    );

    setScheduleItems(synchronized);
    if (onScheduleChange) {
      const isIdentical = initialScheduleData && initialScheduleData.length === synchronized.length &&
        synchronized.every((s, idx) => {
          const init = initialScheduleData[idx];
          return init && init.wbsNodeId === s.wbsNodeId && init.startDate === s.startDate && init.endDate === s.endDate && init.type === s.type && init.id === s.id;
        });
      if (!isIdentical) {
        onScheduleChange(synchronized, false);
      }
    }
  }, [draftStorageKey, currentWbsLeaves, initialScheduleData]);

  // Helper to update schedule state and localStorage
  const updateScheduleState = (updated: ScheduleTaskItem[]) => {
    setScheduleItems(updated);
    if (draftStorageKey) {
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(updated));
        setSaveStatus('Draft tersimpan di browser');
      } catch (e) {
        console.warn('Failed to save schedule draft:', e);
      }
    }
    if (onScheduleChange) {
      onScheduleChange(updated, true);
    }
  };

  // 2. Field Change Handlers
  const handleStartDateChange = (wbsNodeId: string, date: Dayjs | null) => {
    const dateStr = date ? date.format('YYYY-MM-DD') : undefined;
    const updated = scheduleItems.map((item) => {
      if (item.wbsNodeId !== wbsNodeId) return item;
      
      if (item.isMilestone) {
        return {
          ...item,
          startDate: dateStr,
          endDate: undefined,
          duration: 0,
        };
      }

      let newEnd = item.endDate;
      if (dateStr && item.endDate && dayjs(item.endDate).isBefore(dayjs(dateStr), 'day')) {
        newEnd = dateStr;
      }

      const duration = calculateElapsedDuration(dateStr, newEnd);
      return {
        ...item,
        startDate: dateStr,
        endDate: newEnd,
        duration,
      };
    });
    updateScheduleState(updated);
  };

  const handleEndDateChange = (wbsNodeId: string, date: Dayjs | null) => {
    const dateStr = date ? date.format('YYYY-MM-DD') : undefined;
    const updated = scheduleItems.map((item) => {
      if (item.wbsNodeId !== wbsNodeId) return item;
      if (item.isMilestone) return item;

      const duration = calculateElapsedDuration(item.startDate, dateStr);
      return {
        ...item,
        endDate: dateStr,
        duration,
      };
    });
    updateScheduleState(updated);
  };

  const handlePredecessorChange = (wbsNodeId: string, predCode: string | undefined) => {
    const updated = scheduleItems.map((item) => {
      if (item.wbsNodeId !== wbsNodeId) return item;
      return {
        ...item,
        predecessorWbsCode: predCode || undefined,
      };
    });
    updateScheduleState(updated);
  };

  const handleMilestoneToggle = (wbsNodeId: string, checked: boolean) => {
    const updated = scheduleItems.map((item) => {
      if (item.wbsNodeId !== wbsNodeId) return item;
      if (checked) {
        // Transitioning Task -> Milestone
        return {
          ...item,
          type: 'MILESTONE' as const,
          isMilestone: true,
          endDate: undefined,
          duration: 0,
        };
      } else {
        // Transitioning Milestone -> Task (restore startDate as safe initial end)
        const newEnd = item.endDate || item.startDate;
        const duration = calculateElapsedDuration(item.startDate, newEnd);
        return {
          ...item,
          type: 'TASK' as const,
          isMilestone: false,
          endDate: newEnd,
          duration,
        };
      }
    });
    updateScheduleState(updated);
  };

  // 3. Validation and Metrics
  const circularSet = useMemo(() => detectCircularDependencies(scheduleItems), [scheduleItems]);

  const itemsMap = useMemo(() => {
    const map = new Map<string, ScheduleTaskItem>();
    for (const item of scheduleItems) {
      map.set(item.wbsCode, item);
    }
    return map;
  }, [scheduleItems]);

  const taskValidations = useMemo(() => {
    const results = new Map<string, { status: 'OK' | 'WARN' | 'ERR'; message?: string }>();

    for (const item of scheduleItems) {
      // Missing dates validation
      if (item.isMilestone) {
        if (!item.startDate) {
          results.set(item.wbsNodeId, { status: 'WARN', message: 'Tanggal milestone belum ditentukan' });
          continue;
        }
      } else {
        if (!item.startDate || !item.endDate) {
          results.set(item.wbsNodeId, { status: 'WARN', message: 'Tanggal mulai/selesai belum ditentukan' });
          continue;
        }

        // Invalid date range for task
        if (dayjs(item.endDate).isBefore(dayjs(item.startDate), 'day')) {
          results.set(item.wbsNodeId, { status: 'ERR', message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' });
          continue;
        }
      }

      // Circular dependency
      if (circularSet.has(item.wbsCode)) {
        results.set(item.wbsNodeId, { status: 'ERR', message: 'Dependensi membentuk siklus. Periksa predecessor.' });
        continue;
      }

      // Predecessor FS validation
      if (item.predecessorWbsCode) {
        const pred = itemsMap.get(item.predecessorWbsCode);
        const predEffectiveEnd = pred?.isMilestone ? pred.startDate : pred?.endDate;
        if (predEffectiveEnd && item.startDate && dayjs(item.startDate).isBefore(dayjs(predEffectiveEnd), 'day')) {
          results.set(item.wbsNodeId, {
            status: 'WARN',
            message: `Jadwal dimulai sebelum predecessor (${pred?.wbsCode}) selesai`,
          });
          continue;
        }
      }

      results.set(item.wbsNodeId, { status: 'OK' });
    }

    return results;
  }, [scheduleItems, circularSet, itemsMap]);

  // Project Range Summary Calculations
  const projectSummary = useMemo(() => {
    const scheduled = scheduleItems.filter((i) =>
      i.isMilestone ? Boolean(i.startDate) : Boolean(i.startDate && i.endDate && dayjs(i.endDate).isSameOrAfter(dayjs(i.startDate), 'day'))
    );
    const totalScheduled = scheduled.length;
    const totalLeafCount = scheduleItems.length;

    const scheduledTasksOnly = scheduled.filter((i) => !i.isMilestone);

    let minStart: Dayjs | null = null;
    let maxEnd: Dayjs | null = null;

    for (const item of scheduledTasksOnly) {
      if (item.startDate) {
        const d = dayjs(item.startDate);
        if (!minStart || d.isBefore(minStart)) minStart = d;
      }
      if (item.endDate) {
        const d = dayjs(item.endDate);
        if (!maxEnd || d.isAfter(maxEnd)) maxEnd = d;
      }
    }

    // If only milestones are scheduled, fallback to milestone dates
    if (!minStart || !maxEnd) {
      for (const item of scheduled) {
        if (item.startDate) {
          const d = dayjs(item.startDate);
          if (!minStart || d.isBefore(minStart)) minStart = d;
          if (!maxEnd || d.isAfter(maxEnd)) maxEnd = d;
        }
      }
    }

    const totalDuration = minStart && maxEnd ? maxEnd.diff(minStart, 'day') : 0;
    const milestoneCount = scheduleItems.filter((i) => i.isMilestone).length;
    const taskCount = scheduleItems.filter((i) => !i.isMilestone).length;

    let errorCount = 0;
    let warningCount = 0;
    taskValidations.forEach((val) => {
      if (val.status === 'ERR') errorCount++;
      if (val.status === 'WARN') warningCount++;
    });

    const isAllScheduled = totalScheduled === totalLeafCount && totalLeafCount > 0 && errorCount === 0;

    return {
      minStartStr: minStart ? minStart.format('DD MMM YYYY') : '—',
      maxEndStr: maxEnd ? maxEnd.format('DD MMM YYYY') : '—',
      totalDuration,
      totalScheduled,
      totalLeafCount,
      milestoneCount,
      taskCount,
      errorCount,
      warningCount,
      isAllScheduled,
      minStartObj: minStart,
      maxEndObj: maxEnd,
    };
  }, [scheduleItems, taskValidations]);

  // 4. Gantt Timeline Generation
  const ganttConfig = useMemo(() => {
    // Current date reference
    const today = dayjs().startOf('day');

    // Earliest bound must include BOTH today AND scheduled tasks
    let earliestBound = today;
    if (projectSummary.minStartObj) {
      const taskStart = projectSummary.minStartObj.startOf('day');
      earliestBound = taskStart.isBefore(today) ? taskStart : today;
    }

    // Latest bound must include BOTH today AND scheduled tasks
    let latestBound = today;
    if (projectSummary.maxEndObj) {
      const taskEnd = projectSummary.maxEndObj.startOf('day');
      latestBound = taskEnd.isAfter(today) ? taskEnd : today;
    }

    // Add safe visual margin around bounds (at least 3 days before, 7 days after)
    let startRange = earliestBound.clone().subtract(3, 'day');
    let endRange = latestBound.clone().add(7, 'day');

    if (endRange.diff(startRange, 'day') < 14) {
      endRange = startRange.clone().add(14, 'day');
    }

    const totalDays = endRange.diff(startRange, 'day') + 1;

    // Generate date columns for header
    const days: Dayjs[] = [];
    let curr = startRange.clone();
    while (curr.isSameOrBefore(endRange, 'day')) {
      days.push(curr.clone());
      curr = curr.add(1, 'day');
    }

    // Month spans for grouped header in Day view
    const monthSpans: { label: string; startIndex: number; count: number }[] = [];
    let currentMonthKey = '';
    let currentSpan: { label: string; startIndex: number; count: number } | null = null;

    days.forEach((d, idx) => {
      const monthKey = d.format('YYYY-MM');
      if (monthKey !== currentMonthKey) {
        if (currentSpan) {
          monthSpans.push(currentSpan);
        }
        currentMonthKey = monthKey;
        currentSpan = {
          label: d.format('MMMM YYYY'),
          startIndex: idx,
          count: 1,
        };
      } else if (currentSpan) {
        currentSpan.count++;
      }
    });
    if (currentSpan) {
      monthSpans.push(currentSpan);
    }

    return {
      startRange,
      endRange,
      totalDays,
      days,
      monthSpans,
    };
  }, [projectSummary]);

  const handleScrollToToday = () => {
    if (!ganttScrollRef.current) return;
    const today = dayjs().startOf('day');
    const todayOffset = today.diff(ganttConfig.startRange, 'day');
    const dayColWidth = timelineScale === 'day' ? 38 : timelineScale === 'week' ? 24 : timelineScale === 'month' ? 16 : 8;
    const targetX = 240 + todayOffset * dayColWidth - (ganttScrollRef.current.clientWidth / 2) + (dayColWidth / 2);
    ganttScrollRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
  };

  // 5. Data-Derived Planning Brief and Readiness Calculations
  const planningNarrative = useMemo(() => {
    const totalActivities = scheduleItems.length;
    const deliverablesCount = currentWbsLeaves.length;
    const milestoneCount = scheduleItems.filter((i) => i.isMilestone).length;
    const taskCount = scheduleItems.filter((i) => !i.isMilestone).length;

    // Sort tasks by start date for chronological factual derivation
    const datedTasks = scheduleItems
      .filter((i) => Boolean(i.startDate && dayjs(i.startDate).isValid()))
      .sort((a, b) => dayjs(a.startDate!).valueOf() - dayjs(b.startDate!).valueOf());

    const firstTask = datedTasks[0] || null;
    const milestoneTasks = datedTasks.filter((i) => i.isMilestone);
    const lastMilestone = milestoneTasks[milestoneTasks.length - 1] || null;

    // Upcoming task: first planned task starting today or in future, fallback to earliest non-milestone task
    const today = dayjs();
    const upcomingTask =
      datedTasks.find((t) => !t.isMilestone && dayjs(t.startDate!).isSameOrAfter(today, 'day')) ||
      datedTasks.find((t) => !t.isMilestone) ||
      datedTasks[0] ||
      null;

    // First explicit dependency link for narrative illustration
    const sampleDep = scheduleItems.find((i) => Boolean(i.predecessorWbsCode));
    let dependencySummaryText = 'Belum ada relasi dependensi antar aktivitas.';
    if (sampleDep && sampleDep.predecessorWbsCode) {
      const predItem = itemsMap.get(sampleDep.predecessorWbsCode);
      if (predItem) {
        dependencySummaryText = `${sampleDep.wbsCode} ${sampleDep.name} dimulai setelah ${predItem.wbsCode} ${predItem.name} selesai (Finish-to-Start).`;
      }
    }

    const plannedDatesCount = scheduleItems.filter((i) =>
      i.isMilestone ? Boolean(i.startDate) : Boolean(i.startDate && i.endDate)
    ).length;
    const wbsMappedCount = scheduleItems.filter((i) => Boolean(i.wbsNodeId && i.wbsCode)).length;
    const depCount = scheduleItems.filter((i) => Boolean(i.predecessorWbsCode)).length;

    // Period Context mapping
    const periodContextMap: Record<'day' | 'week' | 'month' | 'quarter', string> = {
      day: 'Skala Harian: Menampilkan detail kalender per hari.',
      week: 'Skala Mingguan: Menampilkan horizon timeline per minggu.',
      month: 'Skala Bulanan: Menampilkan horizon timeline per bulan.',
      quarter: 'Skala Triwulanan: Menampilkan gambaran makro triwulan.',
    };

    return {
      totalActivities,
      deliverablesCount,
      milestoneCount,
      taskCount,
      plannedDatesCount,
      wbsMappedCount,
      depCount,
      firstTask,
      lastMilestone,
      upcomingTask,
      dependencySummaryText,
      periodContextText: periodContextMap[timelineScale],
    };
  }, [scheduleItems, currentWbsLeaves, itemsMap, timelineScale]);

  // Empty state if no WBS leaves
  if (currentWbsLeaves.length === 0) {
    return (
      <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
                Belum ada struktur pekerjaan
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Susun WBS terlebih dahulu sebelum membuat jadwal kerja proyek.
              </Text>
            </div>
          }
        >
          {onNavigateToWbs && (
            <Button
              type="primary"
              icon={<ApartmentOutlined />}
              onClick={onNavigateToWbs}
              style={{ backgroundColor: '#1d4ed8', borderRadius: 6, fontWeight: 600, marginTop: 8 }}
            >
              Buka Modul WBS
            </Button>
          )}
        </Empty>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* 1. PLANNING SUMMARY BAR */}
      <div
        id="section-planning-summary"
        style={{
          flex: '0 0 auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space size={8}>
            <FieldTimeOutlined style={{ color: '#1d4ed8', fontSize: 14 }} />
            <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b' }}>
              PLANNING SUMMARY
            </Text>
            <Tag color="blue" style={{ fontSize: 10.5, margin: 0, fontWeight: 600 }}>
              {timelineScale.toUpperCase()} CONTEXT
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {planningNarrative.periodContextText}
          </Text>
        </div>

        <Row gutter={[12, 8]} align="middle">
          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Total Activities</Text>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
              {planningNarrative.totalActivities} Activities
            </div>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Deliverables</Text>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
              {planningNarrative.deliverablesCount} Deliverables
            </div>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Milestones</Text>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706', whiteSpace: 'nowrap' }}>
              {planningNarrative.milestoneCount} Milestone
            </div>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Planned Duration</Text>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
              {projectSummary.totalDuration > 0 ? `${projectSummary.totalDuration} Planned Days` : '—'}
            </div>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Planned Horizon</Text>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#334155', whiteSpace: 'nowrap' }}>
              {projectSummary.minStartStr} – {projectSummary.maxEndStr}
            </div>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Dependency Health</Text>
            <div>
              {projectSummary.errorCount > 0 ? (
                <Tag color="error" style={{ fontWeight: 700, margin: 0 }}>{projectSummary.errorCount} Error</Tag>
              ) : projectSummary.warningCount > 0 ? (
                <Tag color="warning" style={{ fontWeight: 700, margin: 0 }}>{projectSummary.warningCount} Perhatian</Tag>
              ) : (
                <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>{planningNarrative.depCount} Links (0 Error)</Tag>
              )}
            </div>
          </Col>
        </Row>
      </div>

      {/* 2. EXECUTIVE BRIEF & PLANNING READINESS ROW */}
      <Row gutter={[10, 10]}>
        {/* Left: Schedule Brief & Key Signals */}
        <Col xs={24} md={13}>
          <Card
            size="small"
            title={
              <Space size={6}>
                <InfoCircleOutlined style={{ color: '#1d4ed8' }} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>SCHEDULE BRIEF</span>
              </Space>
            }
            style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
            bodyStyle={{ padding: '10px 14px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.45 }}>
                • {planningNarrative.totalActivities} aktivitas direncanakan dalam baseline schedule.
                {planningNarrative.firstTask && (
                  <span> {planningNarrative.firstTask.name} ({planningNarrative.firstTask.wbsCode}) menjadi aktivitas awal.</span>
                )}
                {planningNarrative.lastMilestone && (
                  <span> {planningNarrative.lastMilestone.name} ({planningNarrative.lastMilestone.wbsCode}) merupakan milestone akhir.</span>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {planningNarrative.upcomingTask && (
                  <Tag color="blue" style={{ fontSize: 11, padding: '2px 8px', margin: 0 }}>
                    <strong>NEXT:</strong> {planningNarrative.upcomingTask.name} ({dayjs(planningNarrative.upcomingTask.startDate).format('DD MMM YYYY')})
                  </Tag>
                )}

                {planningNarrative.lastMilestone && (
                  <Tag color="gold" style={{ fontSize: 11, padding: '2px 8px', margin: 0 }}>
                    <strong>MILESTONE:</strong> {planningNarrative.lastMilestone.name} ({dayjs(planningNarrative.lastMilestone.startDate).format('DD MMM YYYY')})
                  </Tag>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                <strong>DEPENDENCY:</strong> {planningNarrative.dependencySummaryText}
              </div>
            </div>
          </Card>
        </Col>

        {/* Right: Planning Readiness & Schedule Structure */}
        <Col xs={24} md={11}>
          <Card
            size="small"
            title={
              <Space size={6}>
                <SafetyCertificateOutlined style={{ color: '#059669' }} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>PLANNING READINESS & STRUCTURE</span>
              </Space>
            }
            style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
            bodyStyle={{ padding: '10px 14px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: planningNarrative.plannedDatesCount === planningNarrative.totalActivities ? '#059669' : '#b45309' }}>
                  Dates defined
                </span>
                <Text type="secondary" style={{ fontSize: 11 }}>{planningNarrative.plannedDatesCount} / {planningNarrative.totalActivities} terdefinisi</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: planningNarrative.wbsMappedCount === planningNarrative.totalActivities ? '#059669' : '#b45309' }}>
                  WBS mapped
                </span>
                <Text type="secondary" style={{ fontSize: 11 }}>{planningNarrative.wbsMappedCount} / {planningNarrative.totalActivities} mapped</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: planningNarrative.depCount > 0 ? '#059669' : '#64748b' }}>
                  Dependencies defined
                </span>
                <Text type="secondary" style={{ fontSize: 11 }}>{planningNarrative.depCount} links (FS)</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: planningNarrative.milestoneCount > 0 ? '#059669' : '#64748b' }}>
                  Milestone defined
                </span>
                <Text type="secondary" style={{ fontSize: 11 }}>{planningNarrative.milestoneCount} gate milestone</Text>
              </div>

              <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 4, marginTop: 2, fontSize: 10.5, color: '#64748b' }}>
                SCHEDULE STRUCTURE: Semua {planningNarrative.totalActivities} aktivitas memiliki WBS & tanggal terdefinisi.
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. SCHEDULE EDITOR TABLE (WORK ITEMS) */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6}>
              <ScheduleOutlined style={{ color: '#1d4ed8' }} />
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>Editor Jadwal Pekerjaan (WBS Deliverables)</span>
              <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px' }}>
                {scheduleItems.length} Deliverables
              </Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {saveStatus}
            </Text>
          </div>
        }
        style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          size="small"
          pagination={false}
          bordered
          rowKey="wbsNodeId"
          dataSource={scheduleItems}
          scroll={{ y: 145 }}
          columns={[
            {
              title: 'WBS',
              dataIndex: 'wbsCode',
              key: 'wbsCode',
              width: 80,
              render: (val: string) => <Tag color="blue" style={{ fontFamily: 'monospace', margin: 0 }}>{val}</Tag>,
            },
            {
              title: 'Nama Deliverable / Work Item',
              dataIndex: 'name',
              key: 'name',
              width: 210,
              render: (val: string, r: ScheduleTaskItem) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.isMilestone && <span style={{ color: '#d97706', fontWeight: 800 }}>◆</span>}
                  <Text strong style={{ fontSize: 12 }}>{val}</Text>
                </div>
              ),
            },
            {
              title: (
                <Tooltip title="Pekerjaan memiliki rentang durasi (Start & End). Milestone menandai pencapaian penting pada satu tanggal tanpa durasi (0 Hari).">
                  <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Jenis ⓘ</span>
                </Tooltip>
              ),
              key: 'isMilestone',
              width: 130,
              render: (_: any, r: ScheduleTaskItem) => (
                <Tooltip title={r.isMilestone ? "Milestone menandai pencapaian penting pada satu tanggal dan tidak memiliki durasi." : "Pekerjaan standar memiliki tanggal mulai dan selesai."}>
                  <Select
                    size="small"
                    value={r.isMilestone ? 'MILESTONE' : 'TASK'}
                    onChange={(val) => handleMilestoneToggle(r.wbsNodeId, val === 'MILESTONE')}
                    style={{ width: '100%', fontSize: 11.5 }}
                    options={[
                      { value: 'TASK', label: <span style={{ fontWeight: 500, color: '#1e40af' }}>Pekerjaan</span> },
                      { value: 'MILESTONE', label: <span style={{ fontWeight: 600, color: '#b45309' }}>Milestone</span> },
                    ]}
                  />
                </Tooltip>
              ),
            },
            {
              title: 'Tgl Mulai',
              key: 'startDate',
              width: 145,
              render: (_: any, r: ScheduleTaskItem) => (
                <DatePicker
                  size="small"
                  value={r.startDate ? dayjs(r.startDate) : null}
                  onChange={(d) => handleStartDateChange(r.wbsNodeId, d)}
                  format="DD MMM YYYY"
                  placeholder={r.isMilestone ? 'Tgl Milestone' : 'Pilih Mulai'}
                  style={{ width: '100%', fontSize: 12 }}
                />
              ),
            },
            {
              title: 'Tgl Selesai',
              key: 'endDate',
              width: 145,
              render: (_: any, r: ScheduleTaskItem) => (
                <Tooltip title={r.isMilestone ? "Milestone adalah point event pada satu tanggal dan tidak memerlukan tanggal selesai." : undefined}>
                  <DatePicker
                    size="small"
                    value={r.isMilestone ? null : r.endDate ? dayjs(r.endDate) : null}
                    onChange={(d) => handleEndDateChange(r.wbsNodeId, d)}
                    format="DD MMM YYYY"
                    placeholder={r.isMilestone ? '— (Point Event)' : 'Pilih Selesai'}
                    disabled={Boolean(r.isMilestone)}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </Tooltip>
              ),
            },
            {
              title: 'Durasi',
              key: 'duration',
              width: 110,
              align: 'center' as const,
              render: (_: any, r: ScheduleTaskItem) => {
                if (r.isMilestone) {
                  return (
                    <Tooltip title="Milestone adalah titik pencapaian pada tanggal tertentu dan tidak memiliki durasi (0 Hari).">
                      <Tag color="gold" style={{ margin: 0, fontWeight: 700, fontSize: 11 }}>
                        Milestone · 0 Hari
                      </Tag>
                    </Tooltip>
                  );
                }
                if (!r.startDate || !r.endDate || dayjs(r.endDate).isBefore(dayjs(r.startDate), 'day')) {
                  return <Text type="secondary">—</Text>;
                }
                const dur = r.duration !== undefined ? r.duration : calculateElapsedDuration(r.startDate, r.endDate);
                return (
                  <Text strong style={{ fontSize: 12, color: dur > 0 ? '#1d4ed8' : '#0f172a' }}>
                    {dur} Hari
                  </Text>
                );
              },
            },
            {
              title: 'Predecessor (FS)',
              key: 'predecessor',
              width: 130,
              render: (_: any, r: ScheduleTaskItem) => {
                const availablePreds = scheduleItems.filter((i) => i.wbsCode !== r.wbsCode);
                return (
                  <Select
                    size="small"
                    allowClear
                    placeholder="None"
                    value={r.predecessorWbsCode || undefined}
                    onChange={(val) => handlePredecessorChange(r.wbsNodeId, val)}
                    style={{ width: '100%', fontSize: 11.5 }}
                    options={availablePreds.map((i) => ({
                      label: `${i.wbsCode} ${i.name}`,
                      value: i.wbsCode,
                    }))}
                  />
                );
              },
            },
            {
              title: 'Status Validasi',
              key: 'validation',
              width: 180,
              render: (_: any, r: ScheduleTaskItem) => {
                const val = taskValidations.get(r.wbsNodeId);
                if (!val || val.status === 'OK') {
                  return <Tag color="success" style={{ fontWeight: 600, margin: 0 }}>Siap</Tag>;
                }
                if (val.status === 'ERR') {
                  return (
                    <Tooltip title={val.message}>
                      <Tag color="error" style={{ fontWeight: 700, margin: 0, cursor: 'help' }}>
                        {val.message?.slice(0, 20)}...
                      </Tag>
                    </Tooltip>
                  );
                }
                return (
                  <Tooltip title={val.message}>
                    <Tag color="warning" style={{ fontWeight: 600, margin: 0, cursor: 'help' }}>
                      {val.message?.slice(0, 20)}...
                    </Tag>
                  </Tooltip>
                );
              },
            },
          ]}
        />
        <div style={{ padding: '4px 10px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <strong>Cara Menentukan Milestone:</strong> Pilih jenis <strong>Milestone</strong> pada deliverable (misal: Approval, Acceptance, BAST, Handover) untuk menjadikannya Project Gate pada 1 tanggal tanpa durasi (0 Hari).
          </Text>
        </div>
      </Card>

      {/* 3. GANTT CHART VISUALIZATION */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space size={6}>
              <AimOutlined style={{ color: '#1d4ed8' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Gantt Chart Timeline</span>
            </Space>

            <Space size={8} wrap>
              <Radio.Group
                size="small"
                value={timelineScale}
                onChange={(e) => setTimelineScale(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                aria-label="Pilih Skala Timeline Gantt"
              >
                <Radio.Button value="day">Day</Radio.Button>
                <Radio.Button value="week">Week</Radio.Button>
                <Radio.Button value="month">Month</Radio.Button>
                <Radio.Button value="quarter">Quarter</Radio.Button>
              </Radio.Group>

              <Button
                size="small"
                icon={<CalendarOutlined style={{ color: '#ef4444' }} />}
                onClick={handleScrollToToday}
                aria-label="Scroll ke Hari Ini"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                Hari Ini
              </Button>

              <Tag color="blue" style={{ fontSize: 10.5, margin: 0 }}>
                Pekerjaan
              </Tag>
              <Tag color="gold" style={{ fontSize: 10.5, margin: 0 }}>
                Milestone
              </Tag>
              <Tag color="error" style={{ fontSize: 10.5, margin: 0 }}>
                ┆ Hari Ini
              </Tag>
            </Space>
          </div>
        }
        style={{ flex: '1 1 auto', minHeight: 340, height: 'clamp(320px, 42vh, 450px)', borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: '1 1 auto', minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div
          id="gantt-scroll-viewport"
          data-testid="gantt-scroll-viewport"
          ref={ganttScrollRef}
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            padding: '10px 14px',
            scrollBehavior: 'smooth',
          }}
        >
          {/* GANTT TIMELINE RENDERER */}
          {(() => {
            const today = dayjs();
            const dayColWidth = timelineScale === 'day' ? 38 : timelineScale === 'week' ? 24 : timelineScale === 'month' ? 16 : 8;
            const timelineContentWidth = ganttConfig.totalDays * dayColWidth;
            const totalGanttWidth = Math.max(780, 240 + timelineContentWidth);

            return (
              <div style={{ minWidth: totalGanttWidth, display: 'flex', flexDirection: 'column', transition: 'min-width 150ms ease-in-out' }}>
                {/* Timeline Header Strip */}
                <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', paddingBottom: 6, marginBottom: 6 }}>
                  {/* Left Header Title: Sticky */}
                  <div
                    style={{
                      width: 240,
                      flexShrink: 0,
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#334155',
                      position: 'sticky',
                      left: 0,
                      zIndex: 12,
                      background: '#ffffff',
                      borderRight: '1px solid #e2e8f0',
                      paddingRight: 8,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    WBS / Work Item Deliverable
                  </div>

                  {/* Right Header Strip */}
                  <div style={{ flex: '1 1 auto', position: 'relative', height: timelineScale === 'day' ? 44 : 26 }}>
                    {timelineScale === 'day' ? (
                      <>
                        {/* Level 1: Month Group Spans */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, display: 'flex' }}>
                          {ganttConfig.monthSpans.map((mSpan, mIdx) => {
                            const leftPct = (mSpan.startIndex / ganttConfig.totalDays) * 100;
                            const widthPct = (mSpan.count / ganttConfig.totalDays) * 100;
                            return (
                              <div
                                key={mIdx}
                                style={{
                                  position: 'absolute',
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  background: '#f1f5f9',
                                  borderRight: '1px solid #cbd5e1',
                                  borderBottom: '1px solid #e2e8f0',
                                  borderRadius: '3px 3px 0 0',
                                  paddingLeft: 6,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: '#1e293b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {mSpan.label}
                              </div>
                            );
                          })}
                        </div>

                        {/* Level 2: Day Columns */}
                        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, bottom: 0, display: 'flex' }}>
                          {ganttConfig.days.map((d, idx) => {
                            const leftPct = (idx / ganttConfig.totalDays) * 100;
                            const widthPct = (1 / ganttConfig.totalDays) * 100;
                            const isWeekend = d.day() === 0 || d.day() === 6;
                            const isToday = d.isSame(today, 'day');
                            const weekdayLabel = WEEKDAYS_ID[d.day()];

                            return (
                              <div
                                key={idx}
                                style={{
                                  position: 'absolute',
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  fontSize: 9,
                                  color: isToday ? '#dc2626' : isWeekend ? '#64748b' : '#334155',
                                  fontWeight: isToday ? 700 : isWeekend ? 500 : 600,
                                  background: isToday ? '#fee2e2' : isWeekend ? '#f1f5f9' : 'transparent',
                                  borderRight: '1px solid #f1f5f9',
                                  borderLeft: isToday ? '1px solid #ef4444' : 'none',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1.05,
                                }}
                                title={`${weekdayLabel}, ${d.format('DD MMMM YYYY')}${isToday ? ' (Hari Ini)' : ''}`}
                              >
                                <span style={{ fontSize: 8, opacity: 0.85 }}>{weekdayLabel}</span>
                                <span style={{ fontWeight: 700 }}>{d.format('DD')}</span>
                                <span style={{ fontSize: 7.5, opacity: 0.75 }}>{d.format('MMM')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      /* Week, Month, Quarter Header */
                      ganttConfig.days.map((d, idx) => {
                        const isFirstOfMonth = d.date() === 1;
                        const isMonday = d.day() === 1;
                        const shouldShowLabel =
                          timelineScale === 'week' ? isMonday || isFirstOfMonth :
                          timelineScale === 'month' ? isFirstOfMonth || d.date() === 15 :
                          isFirstOfMonth;

                        const leftPct = (idx / ganttConfig.totalDays) * 100;

                        return (
                          <div
                            key={idx}
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              fontSize: 10,
                              color: isFirstOfMonth ? '#1d4ed8' : '#64748b',
                              fontWeight: isFirstOfMonth ? 700 : 400,
                              whiteSpace: 'nowrap',
                              borderLeft: isFirstOfMonth ? '1px solid #94a3b8' : 'none',
                              paddingLeft: 2,
                            }}
                          >
                            {shouldShowLabel && (isFirstOfMonth ? d.format('MMM YYYY') : d.format('DD'))}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Timeline Task Rows */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {scheduleItems.map((task) => {
                    const hasValidDates = task.isMilestone
                      ? Boolean(task.startDate && dayjs(task.startDate).isValid())
                      : Boolean(task.startDate && task.endDate && dayjs(task.endDate).isSameOrAfter(dayjs(task.startDate), 'day'));
                    const startDay = task.startDate && dayjs(task.startDate).isValid() ? dayjs(task.startDate) : null;
                    const endDay = !task.isMilestone && task.endDate && dayjs(task.endDate).isValid() ? dayjs(task.endDate) : startDay;

                    const startOffset = startDay ? startDay.diff(ganttConfig.startRange, 'day') : 0;
                    const endOffset = endDay ? endDay.diff(ganttConfig.startRange, 'day') : startOffset;
                    const spanDays = task.isMilestone ? 0 : Math.max(1, endOffset - startOffset + 1);

                    const leftPct = Math.max(0, Math.min(100, (startOffset / ganttConfig.totalDays) * 100));
                    const widthPct = Math.max(1.2, Math.min(100 - leftPct, (spanDays / ganttConfig.totalDays) * 100));
                    const milestoneLeftPct = ((startOffset + 0.5) / ganttConfig.totalDays) * 100;

                    const elapsedDuration = !task.isMilestone && hasValidDates && startDay && endDay ? endDay.diff(startDay, 'day') : 0;
                    const taskVal = taskValidations.get(task.wbsNodeId);

                    // Predecessor relationship highlight calculations
                    const isHoveredPredecessor =
                      hoveredTaskWbsCode &&
                      itemsMap.get(hoveredTaskWbsCode)?.predecessorWbsCode === task.wbsCode;
                    const predItem = task.predecessorWbsCode ? itemsMap.get(task.predecessorWbsCode) : null;

                    return (
                      <div
                        key={task.wbsNodeId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          height: 32,
                          background: isHoveredPredecessor ? '#fef3c7' : '#f8fafc',
                          borderRadius: 4,
                          border: isHoveredPredecessor ? '1px solid #f59e0b' : '1px solid #f1f5f9',
                          transition: 'background 150ms ease, border-color 150ms ease',
                        }}
                      >
                        {/* Left label: Sticky column */}
                        <div
                          style={{
                            width: 240,
                            flexShrink: 0,
                            padding: '0 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            background: isHoveredPredecessor ? '#fef3c7' : '#f8fafc',
                            borderRight: '1px solid #e2e8f0',
                            boxShadow: '2px 0 4px rgba(0,0,0,0.02)',
                          }}
                        >
                          <Tag color="blue" style={{ fontSize: 10.5, lineHeight: '18px', margin: 0, padding: '0 5px' }}>
                            {task.wbsCode}
                          </Tag>
                          <Text style={{ fontSize: 12, color: '#1e293b' }} ellipsis strong={task.isMilestone}>
                            {task.name}
                          </Text>
                        </div>

                        {/* Right Timeline Bar Viewport */}
                        <div style={{ flex: '1 1 auto', position: 'relative', height: '100%' }}>
                          {/* Daily Background Grid Columns */}
                          {timelineScale === 'day' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                              {ganttConfig.days.map((d, dIdx) => {
                                const isWeekend = d.day() === 0 || d.day() === 6;
                                const isToday = d.isSame(today, 'day');
                                return (
                                  <div
                                    key={dIdx}
                                    style={{
                                      flex: 1,
                                      height: '100%',
                                      borderRight: '1px solid #f1f5f9',
                                      background: isWeekend ? 'rgba(241, 245, 249, 0.65)' : isToday ? 'rgba(254, 226, 226, 0.25)' : 'transparent',
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {hasValidDates ? (
                            task.isMilestone ? (
                              <Tooltip
                                mouseEnterDelay={0.05}
                                title={
                                  <div>
                                    <div><strong>{task.wbsCode} {task.name}</strong> (Milestone · 0 Hari)</div>
                                    <div>Tanggal: {startDay?.format('DD MMM YYYY')}</div>
                                    <div>Status: {task.status || 'PLANNED'}</div>
                                    <div>Progress: {Number(task.progress || 0).toFixed(0)}%</div>
                                    {predItem && (
                                      <div style={{ color: '#fef08a', marginTop: 2 }}>
                                        Depends on: {predItem.wbsCode} {predItem.name} (FS)
                                      </div>
                                    )}
                                    <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 3 }}>Klik untuk detail lengkap</div>
                                  </div>
                                }
                              >
                                <div
                                  onClick={() => setSelectedDetailTask(task)}
                                  onMouseEnter={() => setHoveredTaskWbsCode(task.wbsCode)}
                                  onMouseLeave={() => setHoveredTaskWbsCode(null)}
                                  style={{
                                    position: 'absolute',
                                    left: `${milestoneLeftPct}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%) rotate(45deg)',
                                    width: 16,
                                    height: 16,
                                    background: '#f59e0b',
                                    border: isHoveredPredecessor ? '2px solid #dc2626' : '2px solid #b45309',
                                    cursor: 'pointer',
                                    zIndex: 4,
                                    boxShadow: isHoveredPredecessor ? '0 0 0 3px #fef08a, 0 1px 3px rgba(180,83,9,0.5)' : '0 1px 3px rgba(180,83,9,0.35)',
                                    transition: 'all 150ms ease',
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              <Tooltip
                                mouseEnterDelay={0.05}
                                title={
                                  <div>
                                    <div><strong>{task.wbsCode} {task.name}</strong></div>
                                    <div>Mulai: {startDay?.format('DD MMM YYYY')}</div>
                                    <div>Selesai: {endDay?.format('DD MMM YYYY')}</div>
                                    <div>Durasi: {elapsedDuration} Hari Kalender</div>
                                    <div>Status: {task.status || 'PLANNED'}</div>
                                    <div>Progress: {Number(task.progress || 0).toFixed(0)}%</div>
                                    {predItem && (
                                      <div style={{ color: '#fef08a', marginTop: 2 }}>
                                        Depends on: {predItem.wbsCode} {predItem.name} (FS)
                                      </div>
                                    )}
                                    <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 3 }}>Klik untuk detail lengkap</div>
                                  </div>
                                }
                              >
                                <div
                                  onClick={() => setSelectedDetailTask(task)}
                                  onMouseEnter={() => setHoveredTaskWbsCode(task.wbsCode)}
                                  onMouseLeave={() => setHoveredTaskWbsCode(null)}
                                  style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: 5,
                                    bottom: 5,
                                    background: taskVal?.status === 'ERR' ? '#ef4444' : taskVal?.status === 'WARN' ? '#f59e0b' : '#3b82f6',
                                    borderRadius: 4,
                                    border: isHoveredPredecessor
                                      ? '2px solid #f59e0b'
                                      : `1px solid ${taskVal?.status === 'ERR' ? '#b91c1c' : taskVal?.status === 'WARN' ? '#d97706' : '#1d4ed8'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 8px',
                                    color: '#ffffff',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    zIndex: 3,
                                    boxShadow: isHoveredPredecessor ? '0 0 0 3px #fef08a, 0 1px 3px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.12)',
                                    transition: 'all 150ms ease',
                                  }}
                                >
                                  {task.wbsCode} ({elapsedDuration}d)
                                </div>
                              </Tooltip>
                            )
                          ) : (
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: 6,
                                bottom: 6,
                                border: '1px dashed #cbd5e1',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                color: '#94a3b8',
                              }}
                            >
                              TBA (Belum dijadwalkan)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Vertical TODAY Line */}
                  {(() => {
                    if (today.isSameOrAfter(ganttConfig.startRange, 'day') && today.isSameOrBefore(ganttConfig.endRange, 'day')) {
                      const todayOffset = today.diff(ganttConfig.startRange, 'day');
                      const dayColWidth = timelineScale === 'day' ? 38 : timelineScale === 'week' ? 24 : timelineScale === 'month' ? 16 : 8;
                      const todayLeftPx = 240 + todayOffset * dayColWidth + (dayColWidth / 2);
                      return (
                        <div
                          id="gantt-today-line"
                          data-testid="gantt-today-line"
                          style={{
                            position: 'absolute',
                            left: todayLeftPx,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: '#ef4444',
                            zIndex: 5,
                            pointerEvents: 'none',
                            boxShadow: '0 0 3px rgba(239, 68, 68, 0.4)',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: -18,
                              background: '#ef4444',
                              color: '#ffffff',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 3,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Hari Ini
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            );
          })()}
        </div>
      </Card>

      {/* 4. TASK / MILESTONE COMPACT DETAIL MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={selectedDetailTask?.isMilestone ? 'gold' : 'blue'} style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>
              {selectedDetailTask?.isMilestone ? 'MILESTONE' : 'TASK'}
            </Tag>
            <span>{selectedDetailTask?.wbsCode} {selectedDetailTask?.name}</span>
          </div>
        }
        open={Boolean(selectedDetailTask)}
        onCancel={() => setSelectedDetailTask(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedDetailTask(null)}>
            Tutup
          </Button>,
        ]}
        width={520}
        destroyOnClose
      >
        {selectedDetailTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <Descriptions size="small" bordered column={1} labelStyle={{ width: 140, fontWeight: 600, background: '#f8fafc' }}>
              <Descriptions.Item label="WBS Deliverable">
                <Tag color="blue">{selectedDetailTask.wbsCode}</Tag> {selectedDetailTask.name}
              </Descriptions.Item>
              <Descriptions.Item label="Tipe Deliverable">
                {selectedDetailTask.isMilestone ? 'Milestone (Point Event)' : 'Work Item Deliverable'}
              </Descriptions.Item>
              <Descriptions.Item label="Status Perencanaan">
                <Tag color="processing">{selectedDetailTask.status || 'PLANNED'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Progress">
                {Number(selectedDetailTask.progress || 0).toFixed(0)}% (Planning Baseline)
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Mulai">
                {selectedDetailTask.startDate ? dayjs(selectedDetailTask.startDate).format('DD MMMM YYYY') : 'Belum ditentukan'}
              </Descriptions.Item>
              {!selectedDetailTask.isMilestone && (
                <Descriptions.Item label="Tanggal Selesai">
                  {selectedDetailTask.endDate ? dayjs(selectedDetailTask.endDate).format('DD MMMM YYYY') : 'Belum ditentukan'}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Durasi">
                {selectedDetailTask.isMilestone ? '0 Hari (Milestone)' : `${selectedDetailTask.duration || 0} Hari Kalender`}
              </Descriptions.Item>
              <Descriptions.Item label="Predecessor">
                {selectedDetailTask.predecessorWbsCode ? (
                  <div>
                    <Tag color="purple">{selectedDetailTask.predecessorWbsCode}</Tag>
                    {itemsMap.get(selectedDetailTask.predecessorWbsCode)?.name || 'Predecessor Task'} (Finish-to-Start)
                  </div>
                ) : (
                  <Text type="secondary">Tidak ada predecessor (Aktivitas Awal)</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};
