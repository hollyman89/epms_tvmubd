import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { ProjectGanttRow } from '@/services/project.service';

dayjs.locale('id');

export type GanttZoomLevel = 'day' | 'week' | 'month';

export const ZOOM_CONFIG: Record<GanttZoomLevel, { pxPerDay: number; label: string }> = {
  day: { pxPerDay: 40, label: 'Hari' },
  week: { pxPerDay: 20, label: 'Minggu' },
  month: { pxPerDay: 16, label: 'Bulan' },
};

/**
 * Format ISO date string into Indonesian display format: e.g. "07 Okt 2026"
 */
export function formatIndonesianDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const d = dayjs(dateStr);
  if (!d.isValid()) return 'N/A';
  return d.format('DD MMM YYYY');
}

/**
 * Format compact date string: e.g. "07 Okt"
 */
export function formatCompactDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = dayjs(dateStr);
  if (!d.isValid()) return '';
  return d.format('DD MMM');
}

/**
 * Computes calendar days between two ISO date strings (inclusive/exclusive diff).
 */
export function diffCalendarDays(endStr: string, startStr: string): number {
  const start = dayjs(startStr.split('T')[0]);
  const end = dayjs(endStr.split('T')[0]);
  return end.diff(start, 'day');
}

export interface TimelineHeaderColumn {
  key: string;
  label: string;
  subLabel?: string;
  width: number;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface TimelineHeaderGroup {
  label: string;
  width: number;
}

/**
 * Generates header ticks for timeline grid based on timeline range and zoom.
 */
export function generateTimelineHeader(
  startDateStr: string,
  endDateStr: string,
  zoom: GanttZoomLevel,
  asOfStr: string,
): { groups: TimelineHeaderGroup[]; columns: TimelineHeaderColumn[]; totalWidth: number } {
  const start = dayjs(startDateStr.split('T')[0]);
  const end = dayjs(endDateStr.split('T')[0]);
  const asOf = dayjs(asOfStr.split('T')[0]);
  const pxPerDay = ZOOM_CONFIG[zoom].pxPerDay;

  const totalDays = Math.max(1, end.diff(start, 'day') + 1);
  const totalWidth = totalDays * pxPerDay;

  const columns: TimelineHeaderColumn[] = [];
  const groups: TimelineHeaderGroup[] = [];

  let currentGroupLabel = '';
  let currentGroupWidth = 0;

  for (let i = 0; i < totalDays; i++) {
    const current = start.add(i, 'day');
    const dateStr = current.format('YYYY-MM-DD');
    const isToday = current.isSame(asOf, 'day');
    const dayOfWeek = current.day(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Month group
    const monthLabel = current.format('MMMM YYYY');
    if (monthLabel !== currentGroupLabel) {
      if (currentGroupLabel) {
        groups.push({ label: currentGroupLabel, width: currentGroupWidth });
      }
      currentGroupLabel = monthLabel;
      currentGroupWidth = pxPerDay;
    } else {
      currentGroupWidth += pxPerDay;
    }

    if (zoom === 'day') {
      columns.push({
        key: dateStr,
        label: current.format('DD'),
        subLabel: current.format('dd'),
        width: pxPerDay,
        dateStr,
        isToday,
        isWeekend,
      });
    } else if (zoom === 'week') {
      // Weekly grouping: show labels on Monday, 1st of month, or today to prevent text collision
      const isWeekStart = dayOfWeek === 1 || current.date() === 1;
      const showLabel = isWeekStart || isToday;
      columns.push({
        key: dateStr,
        label: showLabel ? current.format('DD') : '',
        subLabel: isToday ? 'Hari Ini' : (isWeekStart ? (dayOfWeek === 1 ? 'Sen' : current.format('MMM')) : undefined),
        width: pxPerDay,
        dateStr,
        isToday,
        isWeekend,
      });
    } else {
      // Month zoom: subtle weekly subdivisions (1st, 8th, 15th, 22nd, 29th) or today
      const isLandmark = current.date() === 1 || current.date() === 8 || current.date() === 15 || current.date() === 22 || current.date() === 29;
      const showLabel = isLandmark || isToday;
      columns.push({
        key: dateStr,
        label: showLabel ? current.format('DD') : '',
        subLabel: isToday ? 'Hari Ini' : (current.date() === 1 ? current.format('MMM') : undefined),
        width: pxPerDay,
        dateStr,
        isToday,
        isWeekend,
      });
    }
  }

  if (currentGroupLabel) {
    groups.push({ label: currentGroupLabel, width: currentGroupWidth });
  }

  return { groups, columns, totalWidth };
}

export interface BarGeometry {
  left: number;
  width: number;
  isSameDateMarker?: boolean;
}

/**
 * Computes pixel coordinate (left, width) for a baseline bar.
 */
export function getBaselineBarGeometry(
  startStr: string | null,
  finishStr: string | null,
  timelineStartStr: string,
  pxPerDay: number,
): BarGeometry | null {
  if (!startStr || !finishStr) return null;
  const tStart = dayjs(timelineStartStr.split('T')[0]);
  const bStart = dayjs(startStr.split('T')[0]);
  const bFinish = dayjs(finishStr.split('T')[0]);

  const offsetDays = bStart.diff(tStart, 'day');
  const durationDays = Math.max(1, bFinish.diff(bStart, 'day') + 1);

  const left = offsetDays * pxPerDay;
  const width = durationDays * pxPerDay;

  return { left, width };
}

/**
 * Computes pixel coordinate (left, width) for an actual execution bar.
 * Follows strict rules:
 * - Unstarted (actualStart == null): returns null (Belum dimulai, no bar).
 * - Completed (actualStart != null, actualFinish != null):
 *     If actualStart == actualFinish (0->100 same-date), returns minimum visual marker without changing dates.
 * - In progress (actualStart != null, actualFinish == null):
 *     Starts at actualStart and ends at asOf (representing elapsed execution time to date, NOT predicted finish).
 */
export function getActualBarGeometry(
  actualStartStr: string | null,
  actualFinishStr: string | null,
  asOfStr: string,
  timelineStartStr: string,
  pxPerDay: number,
): BarGeometry | null {
  if (!actualStartStr) return null;

  const tStart = dayjs(timelineStartStr.split('T')[0]);
  const aStart = dayjs(actualStartStr.split('T')[0]);
  const offsetDays = aStart.diff(tStart, 'day');
  const left = offsetDays * pxPerDay;

  if (actualFinishStr) {
    // Completed
    const aFinish = dayjs(actualFinishStr.split('T')[0]);
    if (aStart.isSame(aFinish, 'day')) {
      // Same-date 0->100 execution: compact marker with minimum visual width
      return { left, width: Math.max(10, pxPerDay * 0.8), isSameDateMarker: true };
    }
    const durationDays = Math.max(1, aFinish.diff(aStart, 'day') + 1);
    const width = durationDays * pxPerDay;
    return { left, width, isSameDateMarker: false };
  }

  // In Progress: elapsed execution time up to asOf
  const asOf = dayjs(asOfStr.split('T')[0]);
  // If asOf is before or same as actualStart, at least show 1 day width
  const elapsedDays = Math.max(1, asOf.diff(aStart, 'day') + 1);
  const width = elapsedDays * pxPerDay;

  return { left, width, isSameDateMarker: false };
}

/**
 * Computes milestone marker X position.
 */
export function getMilestoneMarkerPosition(
  dateStr: string | null,
  timelineStartStr: string,
  pxPerDay: number,
): number | null {
  if (!dateStr) return null;
  const tStart = dayjs(timelineStartStr.split('T')[0]);
  const mDate = dayjs(dateStr.split('T')[0]);
  const offsetDays = mDate.diff(tStart, 'day');
  // Center marker within the day column
  return offsetDays * pxPerDay + pxPerDay / 2;
}

/**
 * Computes Today / As Of vertical marker position.
 */
export function getAsOfMarkerPosition(
  asOfStr: string,
  timelineStartStr: string,
  pxPerDay: number,
): number {
  const tStart = dayjs(timelineStartStr.split('T')[0]);
  const asOf = dayjs(asOfStr.split('T')[0]);
  const offsetDays = asOf.diff(tStart, 'day');
  return offsetDays * pxPerDay + pxPerDay / 2;
}

/**
 * Filter rows by search term, work package, and status.
 */
export function filterGanttRows(
  rows: ProjectGanttRow[],
  search: string,
  workPackageFilter: string,
  statusFilter: string,
  collapsedPackageIds: Set<string>,
): ProjectGanttRow[] {
  // First, identify rows hidden by collapsed parents
  const visibleRows: ProjectGanttRow[] = [];
  const hiddenParentWbsIds = new Set<number>();

  for (const row of rows) {
    if (row.parentId && hiddenParentWbsIds.has(row.parentId)) {
      // If this row is a package itself, its children must also be hidden
      if (!row.isLeaf) {
        hiddenParentWbsIds.add(row.wbsId);
      }
      continue;
    }

    if (!row.isLeaf && collapsedPackageIds.has(row.id)) {
      hiddenParentWbsIds.add(row.wbsId);
    }

    visibleRows.push(row);
  }

  // Next, apply search and filters
  return visibleRows.filter((r) => {
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchCode = r.code.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }

    // Work Package filter
    if (workPackageFilter && workPackageFilter !== 'ALL') {
      const wpWbsId = Number(workPackageFilter);
      if (r.wbsId !== wpWbsId && r.parentId !== wpWbsId) {
        return false;
      }
    }

    // Status filter
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'NOT_STARTED') {
        if (r.progress > 0 || r.actualStart !== null) return false;
      } else if (statusFilter === 'IN_PROGRESS') {
        if (r.status !== 'IN_PROGRESS' && (r.progress === 0 || r.progress >= 100)) return false;
      } else if (statusFilter === 'COMPLETED') {
        if (r.status !== 'COMPLETED' && r.progress < 100) return false;
      } else if (statusFilter === 'OVERDUE') {
        if (r.overdueDays <= 0 && (!r.milestoneOverdueDays || r.milestoneOverdueDays <= 0)) return false;
      } else if (statusFilter === 'MILESTONE') {
        if (!r.isMilestone) return false;
      }
    }

    return true;
  });
}
