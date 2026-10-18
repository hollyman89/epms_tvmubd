import {
  getTaskBoardLane,
  sortTasksInLane,
  filterTaskBoard,
  KANBAN_LANES,
  TaskBoardTask,
  formatTaskProgress,
} from '../task-board.utils';

describe('Task Board Presentation & Mapping (PROJECT-EXEC-F2-F3B)', () => {
  const baseTask: TaskBoardTask = {
    id: 1,
    code: '1.1',
    name: 'Survey Lokasi',
    wbsId: 10,
    workPackage: { id: 10, code: 'WBS-1', name: 'Site Preparation' },
    assignee: { id: 5, name: 'Budi Santoso' },
    progress: 0,
    status: 'PLANNED',
    plannedStart: '2026-10-01',
    plannedFinish: '2026-10-10',
    actualStart: null,
    actualFinish: null,
    isMilestone: false,
    isCritical: false,
    weight: 10,
    evidenceCount: 0,
    reviewState: null,
    pendingClaim: null,
    boardLane: 'TO_DO',
    overdueDays: 0,
    isOverdue: false,
    availableActions: ['UPDATE_PROGRESS'],
  };

  describe('getTaskBoardLane pure mapping', () => {
    it('maps not started task (progress 0, actualStart null) to TO_DO', () => {
      const lane = getTaskBoardLane({ ...baseTask, progress: 0, status: 'PLANNED', actualStart: null });
      expect(lane).toBe('TO_DO');
    });

    it('maps task with progress > 0 to IN_PROGRESS', () => {
      const lane = getTaskBoardLane({ ...baseTask, progress: 45, status: 'IN_PROGRESS', actualStart: '2026-10-02' });
      expect(lane).toBe('IN_PROGRESS');
    });

    it('maps task with actualStart set (even if 0 progress) to IN_PROGRESS', () => {
      const lane = getTaskBoardLane({ ...baseTask, progress: 0, actualStart: '2026-10-02' });
      expect(lane).toBe('IN_PROGRESS');
    });

    it('maps pending claim to REVIEW, even when progress is 100', () => {
      const lane = getTaskBoardLane({
        ...baseTask,
        progress: 100,
        pendingClaim: { id: 99, reportedProgress: 100, previousProgress: 80, eventType: 'COMPLETION_CLAIM', reason: 'ATP ready', submittedBy: 1, createdAt: '2026-10-06', evidenceCount: 1 },
      });
      expect(lane).toBe('REVIEW');
    });

    it('maps reviewState PENDING_VERIFICATION to REVIEW', () => {
      const lane = getTaskBoardLane({
        ...baseTask,
        progress: 99.99,
        reviewState: 'PENDING_VERIFICATION',
      });
      expect(lane).toBe('REVIEW');
    });

    it('requires authoritative completion (status COMPLETED or 100% with actualFinish) for DONE', () => {
      const doneByStatus = getTaskBoardLane({ ...baseTask, progress: 100, status: 'COMPLETED', actualFinish: '2026-10-05' });
      expect(doneByStatus).toBe('DONE');

      const doneByDates = getTaskBoardLane({ ...baseTask, progress: 100, status: 'IN_PROGRESS', actualFinish: '2026-10-05' });
      expect(doneByDates).toBe('DONE');
    });

    it('does NOT put unverified 100% task without actualFinish into DONE', () => {
      const lane = getTaskBoardLane({
        ...baseTask,
        progress: 100,
        status: 'IN_PROGRESS',
        actualFinish: null,
        pendingClaim: { id: 1, reportedProgress: 100, previousProgress: 90, eventType: 'COMPLETION', reason: 'done', submittedBy: 1, createdAt: '2026-10-06', evidenceCount: 0 },
      });
      expect(lane).toBe('REVIEW');
    });

    it('returns task to IN_PROGRESS if completion claim is returned/rejected and progress is < 100', () => {
      const lane = getTaskBoardLane({
        ...baseTask,
        progress: 80,
        status: 'IN_PROGRESS',
        pendingClaim: null,
        actualStart: '2026-10-01',
        actualFinish: null,
      });
      expect(lane).toBe('IN_PROGRESS');
    });
  });

  describe('sortTasksInLane deterministic ordering', () => {
    it('orders overdue tasks first, then critical, then nearest planned finish', () => {
      const t1: TaskBoardTask = { ...baseTask, id: 1, code: '1.1', plannedFinish: '2026-10-20', overdueDays: 0, isOverdue: false, isCritical: false };
      const t2: TaskBoardTask = { ...baseTask, id: 2, code: '1.2', plannedFinish: '2026-10-15', overdueDays: 5, isOverdue: true, isCritical: false };
      const t3: TaskBoardTask = { ...baseTask, id: 3, code: '1.3', plannedFinish: '2026-10-10', overdueDays: 10, isOverdue: true, isCritical: true };
      const t4: TaskBoardTask = { ...baseTask, id: 4, code: '1.4', plannedFinish: '2026-10-05', overdueDays: 0, isOverdue: false, isCritical: true };

      const sorted = sortTasksInLane([t1, t2, t3, t4]);

      // t3 (overdue 10) -> t2 (overdue 5) -> t4 (critical) -> t1 (regular)
      expect(sorted[0].id).toBe(3);
      expect(sorted[1].id).toBe(2);
      expect(sorted[2].id).toBe(4);
      expect(sorted[3].id).toBe(1);
    });
  });

  describe('filterTaskBoard', () => {
    const tasks: TaskBoardTask[] = [
      { ...baseTask, id: 1, code: '1.1', name: 'Galian Tanah Brebek', isOverdue: true, overdueDays: 4, isCritical: false, assignee: { id: 10, name: 'Budi' } },
      { ...baseTask, id: 2, code: '1.2', name: 'Instalasi Tiang', isOverdue: false, overdueDays: 0, isCritical: true, assignee: { id: 20, name: 'Faza' } },
      { ...baseTask, id: 3, code: '2.1', name: 'Penarikan FO', isOverdue: false, overdueDays: 0, isCritical: false, assignee: null },
    ];

    it('filters by search term in name or code', () => {
      const res = filterTaskBoard(tasks, { search: 'Brebek' });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(1);

      const resCode = filterTaskBoard(tasks, { search: '2.1' });
      expect(resCode.length).toBe(1);
      expect(resCode[0].id).toBe(3);
    });

    it('filters by overdue only', () => {
      const res = filterTaskBoard(tasks, { overdueOnly: true });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(1);
    });

    it('filters by critical only', () => {
      const res = filterTaskBoard(tasks, { criticalOnly: true });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(2);
    });

    it('filters unassigned tasks with assigneeId -1', () => {
      const res = filterTaskBoard(tasks, { assigneeId: -1 });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(3);
    });
  });

  describe('canonical lane configuration', () => {
    it('defines 4 canonical lanes in exact order', () => {
      expect(KANBAN_LANES.map((l) => l.key)).toEqual(['TO_DO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
      expect(KANBAN_LANES.map((l) => l.title)).toEqual(['BELUM DIMULAI', 'DIKERJAKAN', 'REVIEW', 'SELESAI']);
    });
  });

  describe('formatTaskProgress business-truth presentation (PROJECT-EXEC-F2-F3B-C1)', () => {
    it('preserves business truth: 99.99 MUST NOT display as 100%', () => {
      const formatted = formatTaskProgress(99.99);
      expect(formatted).not.toBe('100%');
      expect(formatted).toBe('99.99%');
    });

    it('formats 99.9 visibly without rounding up to 100%', () => {
      const formatted = formatTaskProgress(99.9);
      expect(formatted).not.toBe('100%');
      expect(formatted).toBe('99.9%');
    });

    it('formats 100 COMPLETED as 100%', () => {
      expect(formatTaskProgress(100)).toBe('100%');
    });

    it('formats standard integer progress accurately', () => {
      expect(formatTaskProgress(0)).toBe('0%');
      expect(formatTaskProgress(50)).toBe('50%');
      expect(formatTaskProgress(75)).toBe('75%');
    });

    it('handles null / undefined / 0 progress safely as 0%', () => {
      expect(formatTaskProgress(null)).toBe('0%');
      expect(formatTaskProgress(undefined)).toBe('0%');
      expect(formatTaskProgress(0)).toBe('0%');
    });

    it('guards against precision edge case (e.g. 99.999) never displaying 100%', () => {
      const formatted = formatTaskProgress(99.999);
      expect(formatted).not.toBe('100%');
      expect(formatted).toBe('99.99%');
    });
  });
});
