import {
  formatIndonesianDate,
  formatCompactDate,
  diffCalendarDays,
  generateTimelineHeader,
  getBaselineBarGeometry,
  getActualBarGeometry,
  getMilestoneMarkerPosition,
  getAsOfMarkerPosition,
  filterGanttRows,
  ZOOM_CONFIG,
} from '../gantt.utils';
import { ProjectGanttRow } from '@/services/project.service';

describe('EPMS — PROJECT-EXEC-F2-F3D Gantt Presentation Unit Tests', () => {
  const mockRows: ProjectGanttRow[] = [
    {
      id: 'pkg-1',
      type: 'WORK_PACKAGE',
      wbsId: 1,
      taskId: null,
      baselineItemId: 101,
      parentId: null,
      depth: 0,
      code: '1.0',
      name: 'SURVEY & PREPARATION',
      weight: 30,
      isLeaf: false,
      isMilestone: false,
      plannedStart: '2026-10-01',
      plannedFinish: '2026-10-10',
      plannedDurationDays: 9,
      actualStart: '2026-10-01',
      actualFinish: null,
      actualDurationDays: null,
      progress: 66.67,
      plannedProgress: 100,
      progressVariancePp: -33.33,
      status: 'IN_PROGRESS',
      startVarianceDays: null,
      startDelayDays: 0,
      finishVarianceDays: null,
      overdueDays: 0,
      childrenCount: 2,
    },
    {
      id: 'task-201',
      type: 'TASK',
      wbsId: 11,
      taskId: 201,
      baselineItemId: 102,
      parentId: 1,
      depth: 1,
      code: '1.1',
      name: 'Site Survey',
      weight: 20,
      isLeaf: true,
      isMilestone: false,
      plannedStart: '2026-10-01',
      plannedFinish: '2026-10-05',
      plannedDurationDays: 4,
      actualStart: '2026-10-01',
      actualFinish: '2026-10-04',
      actualDurationDays: 3,
      progress: 100,
      plannedProgress: 100,
      progressVariancePp: 0,
      status: 'COMPLETED',
      startVarianceDays: 0,
      startDelayDays: 0,
      finishVarianceDays: -1,
      overdueDays: 0,
      childrenCount: 0,
    },
    {
      id: 'task-202',
      type: 'TASK',
      wbsId: 12,
      taskId: 202,
      baselineItemId: 103,
      parentId: 1,
      depth: 1,
      code: '1.2',
      name: 'Preparation',
      weight: 10,
      isLeaf: true,
      isMilestone: false,
      plannedStart: '2026-10-06',
      plannedFinish: '2026-10-10',
      plannedDurationDays: 4,
      actualStart: '2026-10-07',
      actualFinish: null,
      actualDurationDays: null,
      progress: 50,
      plannedProgress: 100,
      progressVariancePp: -50,
      status: 'IN_PROGRESS',
      startVarianceDays: 1,
      startDelayDays: 0,
      finishVarianceDays: null,
      overdueDays: 5,
      childrenCount: 0,
    },
    {
      id: 'pkg-2',
      type: 'WORK_PACKAGE',
      wbsId: 2,
      taskId: null,
      baselineItemId: 104,
      parentId: null,
      depth: 0,
      code: '2.0',
      name: 'CIVIL & INSTALLATION',
      weight: 50,
      isLeaf: false,
      isMilestone: false,
      plannedStart: '2026-10-11',
      plannedFinish: '2026-10-25',
      plannedDurationDays: 14,
      actualStart: null,
      actualFinish: null,
      actualDurationDays: null,
      progress: 0,
      plannedProgress: 30,
      progressVariancePp: -30,
      status: 'PLANNED',
      startVarianceDays: null,
      startDelayDays: 0,
      finishVarianceDays: null,
      overdueDays: 0,
      childrenCount: 1,
    },
    {
      id: 'task-203',
      type: 'TASK',
      wbsId: 21,
      taskId: 203,
      baselineItemId: 105,
      parentId: 2,
      depth: 1,
      code: '2.1',
      name: 'Foundation Work',
      weight: 50,
      isLeaf: true,
      isMilestone: false,
      plannedStart: '2026-10-11',
      plannedFinish: '2026-10-25',
      plannedDurationDays: 14,
      actualStart: null,
      actualFinish: null,
      actualDurationDays: null,
      progress: 0,
      plannedProgress: 30,
      progressVariancePp: -30,
      status: 'PLANNED',
      startVarianceDays: null,
      startDelayDays: 4,
      finishVarianceDays: null,
      overdueDays: 0,
      childrenCount: 0,
    },
    {
      id: 'task-301',
      type: 'MILESTONE',
      wbsId: 31,
      taskId: 301,
      baselineItemId: 106,
      parentId: null,
      depth: 0,
      code: '3.1',
      name: 'ATP / Acceptance Milestone',
      weight: 20,
      isLeaf: true,
      isMilestone: true,
      plannedStart: '2026-10-28',
      plannedFinish: '2026-10-28',
      plannedDurationDays: 0,
      actualStart: '2026-10-26',
      actualFinish: '2026-10-26',
      actualDurationDays: 0,
      progress: 100,
      plannedProgress: 0,
      progressVariancePp: 100,
      status: 'COMPLETED',
      startVarianceDays: -2,
      startDelayDays: 0,
      finishVarianceDays: -2,
      overdueDays: 0,
      plannedDate: '2026-10-28',
      actualDate: '2026-10-26',
      milestoneVarianceDays: -2,
      milestoneOverdueDays: 0,
      childrenCount: 0,
    },
  ];

  describe('1. Date Formatting & Helpers', () => {
    it('formats Indonesian date correctly', () => {
      expect(formatIndonesianDate('2026-10-01')).toBe('01 Okt 2026');
      expect(formatIndonesianDate('2026-10-28')).toBe('28 Okt 2026');
      expect(formatIndonesianDate(null)).toBe('N/A');
    });

    it('formats compact date correctly', () => {
      expect(formatCompactDate('2026-10-01')).toBe('01 Okt');
      expect(formatCompactDate(null)).toBe('');
    });

    it('computes calendar days between dates correctly', () => {
      expect(diffCalendarDays('2026-10-10', '2026-10-01')).toBe(9);
    });
  });

  describe('2. Timeline Header Generation', () => {
    it('generates correct total width and columns for day zoom', () => {
      const header = generateTimelineHeader('2026-10-01', '2026-10-10', 'day', '2026-10-05');
      expect(header.columns).toHaveLength(10);
      expect(header.totalWidth).toBe(10 * ZOOM_CONFIG.day.pxPerDay);
      expect(header.columns[4].isToday).toBe(true); // 2026-10-05 is today
      expect(header.groups[0].label).toContain('Oktober 2026');
    });

    it('generates correct total width for week and month zoom', () => {
      const weekHeader = generateTimelineHeader('2026-10-01', '2026-10-10', 'week', '2026-10-05');
      expect(weekHeader.totalWidth).toBe(10 * ZOOM_CONFIG.week.pxPerDay);

      const monthHeader = generateTimelineHeader('2026-10-01', '2026-10-10', 'month', '2026-10-05');
      expect(monthHeader.totalWidth).toBe(10 * ZOOM_CONFIG.month.pxPerDay);
    });
  });

  describe('3. Bar Geometry Calculations', () => {
    const timelineStart = '2026-10-01';
    const pxPerDay = 36;

    it('computes baseline bar geometry correctly', () => {
      // Planned: 2026-10-01 to 2026-10-05 (5 days inclusive)
      const geo = getBaselineBarGeometry('2026-10-01', '2026-10-05', timelineStart, pxPerDay);
      expect(geo).not.toBeNull();
      expect(geo!.left).toBe(0); // Day 0
      expect(geo!.width).toBe(5 * pxPerDay); // 5 days width
    });

    it('computes offset baseline bar geometry', () => {
      // Planned: 2026-10-06 to 2026-10-10 (offset: 5 days, duration: 5 days)
      const geo = getBaselineBarGeometry('2026-10-06', '2026-10-10', timelineStart, pxPerDay);
      expect(geo!.left).toBe(5 * pxPerDay);
      expect(geo!.width).toBe(5 * pxPerDay);
    });

    it('returns null for baseline bar when dates are missing', () => {
      expect(getBaselineBarGeometry(null, '2026-10-05', timelineStart, pxPerDay)).toBeNull();
    });

    it('unstarted task returns null actual bar geometry', () => {
      const geo = getActualBarGeometry(null, null, '2026-10-15', timelineStart, pxPerDay);
      expect(geo).toBeNull();
    });

    it('completed task returns actual bar geometry with exact duration', () => {
      // Actual: 2026-10-01 to 2026-10-04 (offset 0, duration 4 days)
      const geo = getActualBarGeometry('2026-10-01', '2026-10-04', '2026-10-15', timelineStart, pxPerDay);
      expect(geo).not.toBeNull();
      expect(geo!.left).toBe(0);
      expect(geo!.width).toBe(4 * pxPerDay);
      expect(geo!.isSameDateMarker).toBe(false);
    });

    it('same-date 0->100 execution returns minimum visual marker without altering dates', () => {
      // Actual: 2026-10-26 to 2026-10-26
      const geo = getActualBarGeometry('2026-10-26', '2026-10-26', '2026-10-27', timelineStart, pxPerDay);
      expect(geo).not.toBeNull();
      expect(geo!.left).toBe(25 * pxPerDay);
      expect(geo!.isSameDateMarker).toBe(true);
      expect(geo!.width).toBeGreaterThanOrEqual(10);
    });

    it('in-progress task actual bar ends at asOf (elapsed time to date, not predicted finish)', () => {
      // Actual start: 2026-10-07, asOf: 2026-10-15 (offset 6 days, elapsed: 9 days)
      const geo = getActualBarGeometry('2026-10-07', null, '2026-10-15', timelineStart, pxPerDay);
      expect(geo).not.toBeNull();
      expect(geo!.left).toBe(6 * pxPerDay);
      expect(geo!.width).toBe(9 * pxPerDay);
      expect(geo!.isSameDateMarker).toBe(false);
    });
  });

  describe('4. Milestone & As-Of Markers', () => {
    const timelineStart = '2026-10-01';
    const pxPerDay = 36;

    it('computes milestone marker X position centered on day column', () => {
      const x = getMilestoneMarkerPosition('2026-10-28', timelineStart, pxPerDay);
      expect(x).toBe(27 * pxPerDay + pxPerDay / 2);
    });

    it('returns null for milestone marker when date is missing', () => {
      expect(getMilestoneMarkerPosition(null, timelineStart, pxPerDay)).toBeNull();
    });

    it('computes asOf marker position centered on day column', () => {
      const x = getAsOfMarkerPosition('2026-10-15', timelineStart, pxPerDay);
      expect(x).toBe(14 * pxPerDay + pxPerDay / 2);
    });
  });

  describe('5. Row Filtering & Collapse Behavior', () => {
    it('returns all rows when no filter is applied', () => {
      const res = filterGanttRows(mockRows, '', 'ALL', 'ALL', new Set());
      expect(res).toHaveLength(6);
    });

    it('filters rows by search term matching name or code', () => {
      const res = filterGanttRows(mockRows, 'Survey', 'ALL', 'ALL', new Set());
      expect(res.map((r) => r.code)).toEqual(['1.0', '1.1']);
    });

    it('filters rows by work package', () => {
      const res = filterGanttRows(mockRows, '', '1', 'ALL', new Set());
      expect(res.map((r) => r.code)).toEqual(['1.0', '1.1', '1.2']);
    });

    it('filters rows by status COMPLETED', () => {
      const res = filterGanttRows(mockRows, '', 'ALL', 'COMPLETED', new Set());
      expect(res.map((r) => r.code)).toEqual(['1.1', '3.1']);
    });

    it('filters rows by status OVERDUE', () => {
      const res = filterGanttRows(mockRows, '', 'ALL', 'OVERDUE', new Set());
      expect(res.map((r) => r.code)).toEqual(['1.2']);
    });

    it('filters rows by status MILESTONE', () => {
      const res = filterGanttRows(mockRows, '', 'ALL', 'MILESTONE', new Set());
      expect(res.map((r) => r.code)).toEqual(['3.1']);
    });

    it('collapses child rows when parent work package is collapsed', () => {
      const collapsed = new Set(['pkg-1']);
      const res = filterGanttRows(mockRows, '', 'ALL', 'ALL', collapsed);
      // pkg-1 is kept, but its children (1.1, 1.2) are hidden
      expect(res.map((r) => r.code)).toEqual(['1.0', '2.0', '2.1', '3.1']);
    });
  });
});
