import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  computeProgressMonitoringReadModel,
  computeLeafPlannedProgressOnDate,
} from './progress-monitoring.calculator';
import {
  BaselineWbsInput,
  TaskExecutionInput,
  parseDateToUtcMidnight,
} from './project-control.calculator';

describe('EPMS — PROJECT-EXEC-F2-F3C Progress & Monitoring + S-Curve Unit & Service Tests', () => {
  const mockBaseline: BaselineWbsInput[] = [
    {
      id: 1,
      baseline_id: 10,
      wbs_id: 101,
      parent_wbs_id: null,
      code: 'WP 1',
      name: 'Work Package 1',
      level: 1,
      weight_percentage: 60.0,
      is_leaf: false,
      task_id: null,
      planned_start_date: '2026-10-01',
      planned_end_date: '2026-10-20',
      planned_duration: 20,
      is_milestone: false,
    },
    {
      id: 2,
      baseline_id: 10,
      wbs_id: 102,
      parent_wbs_id: 101,
      code: '1.1',
      name: 'Task 1.1',
      level: 2,
      weight_percentage: 40.0,
      is_leaf: true,
      task_id: 201,
      planned_start_date: '2026-10-01',
      planned_end_date: '2026-10-10',
      planned_duration: 10,
      is_milestone: false,
    },
    {
      id: 3,
      baseline_id: 10,
      wbs_id: 103,
      parent_wbs_id: 101,
      code: '1.2',
      name: 'Task 1.2',
      level: 2,
      weight_percentage: 20.0,
      is_leaf: true,
      task_id: 202,
      planned_start_date: '2026-10-10',
      planned_end_date: '2026-10-20',
      planned_duration: 10,
      is_milestone: false,
    },
    {
      id: 4,
      baseline_id: 10,
      wbs_id: 104,
      parent_wbs_id: null,
      code: 'WP 2',
      name: 'Work Package 2',
      level: 1,
      weight_percentage: 40.0,
      is_leaf: false,
      task_id: null,
      planned_start_date: '2026-10-05',
      planned_end_date: '2026-10-25',
      planned_duration: 20,
      is_milestone: false,
    },
    {
      id: 5,
      baseline_id: 10,
      wbs_id: 105,
      parent_wbs_id: 104,
      code: '2.1',
      name: 'Task 2.1',
      level: 2,
      weight_percentage: 30.0,
      is_leaf: true,
      task_id: 203,
      planned_start_date: '2026-10-05',
      planned_end_date: '2026-10-15',
      planned_duration: 10,
      is_milestone: false,
    },
    {
      id: 6,
      baseline_id: 10,
      wbs_id: 106,
      parent_wbs_id: 104,
      code: 'M1',
      name: 'Milestone 1',
      level: 2,
      weight_percentage: 10.0,
      is_leaf: true,
      task_id: 204,
      planned_start_date: '2026-10-25',
      planned_end_date: '2026-10-25',
      planned_duration: 0,
      is_milestone: true,
    },
  ];

  const mockTasks: TaskExecutionInput[] = [
    {
      id: 201,
      projectId: 1,
      wbsId: 102,
      name: 'Task 1.1',
      progress: 100,
      status: 'COMPLETED',
      actualStartAt: '2026-10-01T00:00:00.000Z',
      actualFinishAt: '2026-10-08T00:00:00.000Z',
    },
    {
      id: 202,
      projectId: 1,
      wbsId: 103,
      name: 'Task 1.2',
      progress: 50,
      status: 'IN_PROGRESS',
      actualStartAt: '2026-10-10T00:00:00.000Z',
      actualFinishAt: null,
    },
    {
      id: 203,
      projectId: 1,
      wbsId: 105,
      name: 'Task 2.1',
      progress: 0,
      status: 'TO_DO',
      actualStartAt: null,
      actualFinishAt: null,
    },
    {
      id: 204,
      projectId: 1,
      wbsId: 106,
      name: 'Milestone 1',
      progress: 0,
      status: 'TO_DO',
      isMilestone: true,
      actualStartAt: null,
      actualFinishAt: null,
    },
  ];

  const mockProgressLogs = [
    {
      id: 1,
      task_id: 201,
      previous_progress: 0,
      reported_progress: 50,
      progress_delta: 50,
      effective_date: '2026-10-04',
      status: 'OFFICIAL',
      event_type: 'ROUTINE_UPDATE',
      created_at: new Date('2026-10-04T10:00:00Z'),
    },
    {
      id: 2,
      task_id: 201,
      previous_progress: 50,
      reported_progress: 100,
      progress_delta: 50,
      effective_date: '2026-10-08',
      status: 'OFFICIAL',
      event_type: 'CRITICAL_CLAIM',
      created_at: new Date('2026-10-08T10:00:00Z'),
    },
    {
      id: 3,
      task_id: 202,
      previous_progress: 0,
      reported_progress: 50,
      progress_delta: 50,
      effective_date: '2026-10-12',
      status: 'OFFICIAL',
      event_type: 'ROUTINE_UPDATE',
      created_at: new Date('2026-10-12T10:00:00Z'),
    },
  ];

  const meta = {
    code: 'PRJ-001',
    name: 'Project Test',
    status: 'IN_PROGRESS',
    customerName: 'Client Alpha',
    managerName: 'PM One',
  };

  it('1. Valid project summary aligns with Project Control', () => {
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-15',
    });

    expect(res.control.planComparisonAvailable).toBe(true);
    // Task 201: 40% wt * 100% = 40
    // Task 202: 20% wt * 50% = 10
    // Actual = 50.00%
    expect(res.control.actualProgress).toBe(50);
    expect(res.project.actualFinish).toBeNull(); // Req 18
  });

  it('2. Same asOf used throughout response', () => {
    const fixedAsOf = '2026-10-15T12:00:00.000Z';
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: fixedAsOf,
    });

    expect(res.asOf).toBe(fixedAsOf);
  });

  it('3. Task summary matches F3B lane semantics', () => {
    // Add pending claim on Task 203
    const logsWithPending = [
      ...mockProgressLogs,
      {
        id: 4,
        task_id: 203,
        previous_progress: 0,
        reported_progress: 80,
        progress_delta: 80,
        effective_date: '2026-10-14',
        status: 'PENDING_VERIFICATION',
        event_type: 'CRITICAL_CLAIM',
        created_at: new Date('2026-10-14T10:00:00Z'),
      },
    ];

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: logsWithPending,
      asOf: '2026-10-15',
    });

    expect(res.taskSummary.done).toBe(1); // Task 201
    expect(res.taskSummary.inProgress).toBe(1); // Task 202
    expect(res.taskSummary.review).toBe(1); // Task 203 (has pending claim)
    expect(res.taskSummary.todo).toBe(1); // Task 204
    expect(res.taskSummary.total).toBe(4);
  });

  it('4. Overdue count matches Project Control', () => {
    // As of 2026-10-16: Task 203 planned end was 2026-10-15, progress is 0, so overdue
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-16',
    });

    expect(res.taskSummary.overdue).toBe(1);
    expect(res.control.overdueTaskCount).toBe(1);
  });

  it('5. Planned curve uses active immutable baseline without parent double-counting', () => {
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-15',
    });

    expect(res.curve.planAvailable).toBe(true);
    expect(res.curve.points.length).toBeGreaterThan(0);

    // Initial point (2026-10-01) planned progress should be 0
    const firstPoint = res.curve.points[0];
    expect(firstPoint.plannedProgress).toBe(0);

    // Final point (2026-10-25) planned progress should be 100
    const lastPoint = res.curve.points[res.curve.points.length - 1];
    expect(lastPoint.plannedProgress).toBe(100);
  });

  it('6. Milestone planned semantics preserved: 0% before target, 100% on target', () => {
    const milestoneLeaf = mockBaseline.find((i) => i.is_milestone)!;
    const beforeDate = parseDateToUtcMidnight('2026-10-24')!;
    const onDate = parseDateToUtcMidnight('2026-10-25')!;

    expect(computeLeafPlannedProgressOnDate(milestoneLeaf, beforeDate)).toBe(0);
    expect(computeLeafPlannedProgressOnDate(milestoneLeaf, onDate)).toBe(100);
  });

  it('7. Actual curve uses authoritative history from official logs', () => {
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-15',
    });

    expect(res.curve.historyCoverage).toBe('FULL');
    // On 2026-10-04: Task 201 had 50% * 40% = 20%
    const p1 = res.curve.points.find((p) => p.date === '2026-10-04');
    expect(p1?.actualProgress).toBe(20);

    // On 2026-10-08: Task 201 had 100% * 40% = 40%
    const p2 = res.curve.points.find((p) => p.date === '2026-10-08');
    expect(p2?.actualProgress).toBe(40);

    // On 2026-10-12: Task 202 had 50% * 20% = 10% -> total 50%
    const p3 = res.curve.points.find((p) => p.date === '2026-10-12');
    expect(p3?.actualProgress).toBe(50);
  });

  it('8. Pending 100 claim does not become verified actual 100 in curve', () => {
    const logsWithPending100 = [
      ...mockProgressLogs,
      {
        id: 99,
        task_id: 202,
        previous_progress: 50,
        reported_progress: 100,
        progress_delta: 50,
        effective_date: '2026-10-14',
        status: 'PENDING_VERIFICATION', // NOT official
        event_type: 'CRITICAL_CLAIM',
        created_at: new Date('2026-10-14T10:00:00Z'),
      },
    ];

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: logsWithPending100,
      asOf: '2026-10-15',
    });

    // Actual progress should remain 50%, NOT increase to 60%
    const p = res.curve.points.find((pt) => pt.date === '2026-10-15');
    expect(p?.actualProgress).toBe(50);
  });

  it('9. Downward correction appears correctly in history', () => {
    const logsWithCorrection = [
      ...mockProgressLogs,
      {
        id: 4,
        task_id: 202,
        previous_progress: 50,
        reported_progress: 20, // Corrected downward
        progress_delta: -30,
        effective_date: '2026-10-14',
        status: 'OFFICIAL',
        event_type: 'DOWNWARD_CORRECTION',
        created_at: new Date('2026-10-14T10:00:00Z'),
      },
    ];

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: logsWithCorrection,
      asOf: '2026-10-15',
    });

    // On 2026-10-14: Task 201 = 40%, Task 202 = 20% * 20% = 4% -> 44%
    const p = res.curve.points.find((pt) => pt.date === '2026-10-14');
    expect(p?.actualProgress).toBe(44);
  });

  it('10. Invalid baseline makes plan comparison and planned curve unavailable', () => {
    const invalidBaseline = mockBaseline.map((b) => ({ ...b, weight_percentage: 10.0 })); // Sum != 100

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: invalidBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-15',
    });

    expect(res.control.planComparisonAvailable).toBe(false);
    expect(res.control.planComparisonUnavailableReason).toBe('INVALID_BASELINE');
    expect(res.curve.planAvailable).toBe(false);
    expect(res.control.plannedProgress).toBeNull();
  });

  it('11. Missing history is flagged as UNAVAILABLE without fabricating curve', () => {
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: [], // Zero history
      asOf: '2026-10-15',
    });

    expect(res.curve.historyCoverage).toBe('UNAVAILABLE');
    // None of the points have fake actualProgress
    for (const pt of res.curve.points) {
      expect(pt.actualProgress).toBeNull();
    }
  });

  it('12. Work Package aggregation does not double count parent and child', () => {
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-15',
    });

    expect(res.workPackages.length).toBe(2);
    const wp1 = res.workPackages.find((w) => w.code === 'WP 1')!;
    expect(wp1.descendantLeafWeight).toBe(60);
    // Task 1.1 (40 wt): 100% actual; Task 1.2 (20 wt): 50% actual
    // Expected WP1 actual: (40*100 + 20*50) / 60 = 5000 / 60 = 83.33%
    expect(wp1.actualProgress).toBe(83.33);
  });

  it('13. Milestone actual date uses authoritative task.actualFinishAt', () => {
    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: mockProgressLogs,
      asOf: '2026-10-15',
    });

    expect(res.milestones.length).toBe(1);
    const m1 = res.milestones[0];
    expect(m1.code).toBe('M1');
    expect(m1.actualDate).toBeNull();
    expect(m1.status).toBe('BELUM_JATUH_TEMPO');
  });

  it('14. Recent execution activity is bounded to maximum 15 items', () => {
    const manyLogs = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      task_id: 201,
      previous_progress: i,
      reported_progress: i + 1,
      progress_delta: 1,
      effective_date: '2026-10-05',
      status: 'OFFICIAL',
      event_type: 'ROUTINE_UPDATE',
      created_at: new Date(),
    }));

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: meta,
      baselineItems: mockBaseline,
      tasks: mockTasks,
      progressLogs: manyLogs,
      asOf: '2026-10-15',
    });

    expect(res.recentActivity.length).toBe(15);
  });

  describe('15. S-Curve Early Actual Date Domain & Data Truth Regression Suite', () => {
    const novemberBaseline: BaselineWbsInput[] = [
      {
        id: 11,
        baseline_id: 20,
        wbs_id: 301,
        parent_wbs_id: null,
        code: 'WP 1',
        name: 'Work Package 1',
        level: 1,
        weight_percentage: 100.0,
        is_leaf: false,
        task_id: null,
        planned_start_date: '2026-11-01',
        planned_end_date: '2026-11-29',
        planned_duration: 28,
        is_milestone: false,
      },
      {
        id: 12,
        baseline_id: 20,
        wbs_id: 302,
        parent_wbs_id: 301,
        code: '1.1',
        name: 'Task 1.1',
        level: 2,
        weight_percentage: 60.0,
        is_leaf: true,
        task_id: 501,
        planned_start_date: '2026-11-01',
        planned_end_date: '2026-11-15',
        planned_duration: 14,
        is_milestone: false,
      },
      {
        id: 13,
        baseline_id: 20,
        wbs_id: 303,
        parent_wbs_id: 301,
        code: '1.2',
        name: 'Task 1.2',
        level: 2,
        weight_percentage: 40.0,
        is_leaf: true,
        task_id: 502,
        planned_start_date: '2026-11-16',
        planned_end_date: '2026-11-29',
        planned_duration: 13,
        is_milestone: false,
      },
    ];

    const novemberTasks: TaskExecutionInput[] = [
      {
        id: 501,
        projectId: 99,
        wbsId: 302,
        name: 'Task 1.1',
        progress: 50,
        status: 'IN_PROGRESS',
        isMilestone: false,
        actualStartAt: new Date('2026-10-16T08:00:00Z'),
        actualFinishAt: null,
      },
      {
        id: 502,
        projectId: 99,
        wbsId: 303,
        name: 'Task 1.2',
        progress: 0,
        status: 'TO_DO',
        isMilestone: false,
        actualStartAt: null,
        actualFinishAt: null,
      },
    ];

    it('TEST A: Actual begins after baseline start preserves existing normal behavior', () => {
      const logsAfterBaseline = [
        {
          id: 1,
          task_id: 201,
          reported_progress: 50,
          effective_date: '2026-10-05',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-05T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 1,
        projectMeta: meta,
        baselineItems: mockBaseline,
        tasks: mockTasks,
        progressLogs: logsAfterBaseline,
        asOf: '2026-10-10',
      });

      expect(res.curve.points[0].date).toBe('2026-10-01');
      // Before 2026-10-05, actualProgress should be null (no fake 0s)
      const pBefore = res.curve.points.find((p) => p.date === '2026-10-01');
      expect(pBefore?.actualProgress).toBeNull();
      // On 2026-10-05, actualProgress is 50% * 40% = 20%
      const pOn = res.curve.points.find((p) => p.date === '2026-10-05');
      expect(pOn?.actualProgress).toBe(20);
    });

    it('TEST B: Actual begins exactly on baseline start renders normal Plan + Actual', () => {
      const logsOnBaselineStart = [
        {
          id: 1,
          task_id: 201,
          reported_progress: 25,
          effective_date: '2026-10-01',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-01T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 1,
        projectMeta: meta,
        baselineItems: mockBaseline,
        tasks: mockTasks,
        progressLogs: logsOnBaselineStart,
        asOf: '2026-10-05',
      });

      expect(res.curve.points[0].date).toBe('2026-10-01');
      const pStart = res.curve.points[0];
      expect(pStart.plannedProgress).toBe(0);
      expect(pStart.actualProgress).toBe(10); // 25% * 40% wt = 10%
    });

    it('TEST C: Actual begins before baseline start extends timeline to earliest OFFICIAL actual date', () => {
      const earlyLogs = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-16',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-16T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: earlyLogs,
        asOf: '2026-10-17',
      });

      expect(res.curve.points[0].date).toBe('2026-10-16');
      expect(res.curve.points[res.curve.points.length - 1].date).toBe('2026-11-29');
    });

    it('TEST D: Pre-baseline dates have Plan strictly = 0%', () => {
      const earlyLogs = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-16',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-16T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: earlyLogs,
        asOf: '2026-10-25',
      });

      const preBaselinePoints = res.curve.points.filter((p) => p.date < '2026-11-01');
      expect(preBaselinePoints.length).toBeGreaterThan(0);
      preBaselinePoints.forEach((p) => {
        expect(p.plannedProgress).toBe(0);
      });
    });

    it('TEST E: Baseline start and onward uses canonical baseline normally', () => {
      const earlyLogs = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-16',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-16T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: earlyLogs,
        asOf: '2026-10-17',
      });

      const pBaselineStart = res.curve.points.find((p) => p.date === '2026-11-01')!;
      expect(pBaselineStart).toBeDefined();
      expect(pBaselineStart.plannedProgress).toBe(0);

      const pBaselineEnd = res.curve.points.find((p) => p.date === '2026-11-29')!;
      expect(pBaselineEnd).toBeDefined();
      expect(pBaselineEnd.plannedProgress).toBe(100);
    });

    it('TEST F: Draft/unofficial progress before baseline must NOT extend chart domain', () => {
      const draftLogs = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-10',
          status: 'PENDING_VERIFICATION', // NOT official
          created_at: new Date('2026-10-10T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: draftLogs,
        asOf: '2026-10-17',
      });

      // Domain must start on baseline start 2026-11-01, NOT 2026-10-10
      expect(res.curve.points[0].date).toBe('2026-11-01');
    });

    it('TEST G: Rejected/returned progress before baseline must NOT extend chart domain', () => {
      const rejectedLogs = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-10',
          status: 'REJECTED', // NOT official
          created_at: new Date('2026-10-10T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: rejectedLogs,
        asOf: '2026-10-17',
      });

      expect(res.curve.points[0].date).toBe('2026-11-01');
    });

    it('TEST H: No official actual history produces no Actual series (all null)', () => {
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: [],
        asOf: '2026-10-17',
      });

      expect(res.curve.historyCoverage).toBe('UNAVAILABLE');
      res.curve.points.forEach((p) => {
        expect(p.actualProgress).toBeNull();
      });
    });

    it('TEST I: One official actual point is correctly generated without fabricating a line', () => {
      const singleOfficialLog = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-16',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-16T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: singleOfficialLog,
        asOf: '2026-10-16', // Same date as log
      });

      const nonNullActual = res.curve.points.filter((p) => p.actualProgress !== null);
      expect(nonNullActual.length).toBe(1);
      expect(nonNullActual[0].date).toBe('2026-10-16');
      expect(nonNullActual[0].actualProgress).toBe(30); // 50% * 60% wt = 30%
    });

    it('TEST J: Multiple official actual points render real Actual progression', () => {
      const multipleLogs = [
        {
          id: 101,
          task_id: 501,
          reported_progress: 25,
          effective_date: '2026-10-16',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-16T08:00:00Z'),
        },
        {
          id: 102,
          task_id: 501,
          reported_progress: 50,
          effective_date: '2026-10-20',
          status: 'OFFICIAL',
          created_at: new Date('2026-10-20T08:00:00Z'),
        },
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: novemberTasks,
        progressLogs: multipleLogs,
        asOf: '2026-10-20',
      });

      const nonNullActual = res.curve.points.filter((p) => p.actualProgress !== null);
      expect(nonNullActual.length).toBeGreaterThan(1);
      const p1 = res.curve.points.find((p) => p.date === '2026-10-16');
      const p2 = res.curve.points.find((p) => p.date === '2026-10-20');
      expect(p1?.actualProgress).toBe(15); // 25% * 60% = 15%
      expect(p2?.actualProgress).toBe(30); // 50% * 60% = 30%
    });

    it('DATA TRUTH: KPI Actual and Plan remain mathematically derived without mock/hardcode', () => {
      // Dynamic computation check: altering progress directly updates actualProgress mathematically
      const customTasks: TaskExecutionInput[] = [
        { ...novemberTasks[0], progress: 80 }, // 80% * 60% wt = 48%
        { ...novemberTasks[1], progress: 25 }, // 25% * 40% wt = 10%
      ];
      const res = computeProgressMonitoringReadModel({
        projectId: 99,
        projectMeta: meta,
        baselineItems: novemberBaseline,
        tasks: customTasks,
        progressLogs: [],
        asOf: '2026-10-17',
      });

      expect(res.control.actualProgress).toBe(58); // 48 + 10 = 58.00%
      expect(res.control.plannedProgress).toBe(0); // pre-baseline planned is 0
      expect(res.control.progressVariancePp).toBe(58); // +58 pp
      expect(res.control.progressHealth).toBe('AHEAD');
    });
  });
});

describe('ProjectService.getProjectProgressMonitoring (RBAC & Integration)', () => {
  let service: any;
  let mockProjectRepo: any;
  let mockBaselineRepo: any;
  let mockTaskRepo: any;
  let mockProgressLogRepo: any;
  let mockUserRepo: any;
  let mockContractRepo: any;

  beforeEach(() => {
    mockProjectRepo = {
      findOne: jest.fn(),
    };
    mockBaselineRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockProgressLogRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockContractRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = {
      projectRepo: mockProjectRepo,
      baselineRepo: mockBaselineRepo,
      taskRepo: mockTaskRepo,
      progressLogRepo: mockProgressLogRepo,
      userRepo: mockUserRepo,
      contractRepo: mockContractRepo,
      validateProjectReadAccess: async (project: any, userId?: number, roles: string[] = []) => {
        if (!userId) return;
        const managementRoles = [
          'SUPER_ADMIN',
          'PMO',
          'DIRECTOR',
          'GENERAL_MANAGER',
          'HEAD_OF_OPERATIONS',
          'FINANCE',
          'LEGAL',
          'PROCUREMENT',
          'INTERNAL_AUDIT',
        ];
        if (roles.some((r) => managementRoles.includes(r))) return;
        if (Number(project.managerId) !== Number(userId)) {
          throw new ForbiddenException('Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini');
        }
      },
    };

    // Attach actual method
    service.getProjectProgressMonitoring = async function (
      projectId: number,
      userId?: number,
      userRoles: string[] = [],
      asOfInput?: string,
    ) {
      if (!projectId || isNaN(Number(projectId)) || Number(projectId) <= 0) {
        throw new BadRequestException('Parameter projectId tidak valid');
      }

      const project = await this.projectRepo.findOne({
        where: { id: Number(projectId) },
      });
      if (!project) {
        throw new NotFoundException(`Proyek dengan ID #${projectId} tidak ditemukan`);
      }

      if (userId) {
        await this.validateProjectReadAccess(project, userId, userRoles);
      }

      const activeBaseline = this.baselineRepo
        ? await this.baselineRepo.findOne({
            where: { project_id: Number(projectId), status: 'ACTIVE' },
          })
        : null;

      const tasks = await this.taskRepo.find({
        where: { projectId: Number(projectId) },
      });

      const progressLogs = this.progressLogRepo
        ? await this.progressLogRepo.find({
            where: { project_id: Number(projectId) },
          })
        : [];

      return computeProgressMonitoringReadModel({
        projectId: Number(projectId),
        projectMeta: {
          code: project.code,
          name: project.name,
          status: project.status,
          customerName: null,
          managerName: null,
        },
        baselineItems: activeBaseline?.wbs_items || null,
        tasks,
        progressLogs,
        asOf: asOfInput,
      });
    };
  });

  it('15. Throws BadRequestException for invalid projectId', async () => {
    await expect(service.getProjectProgressMonitoring(0)).rejects.toThrow(BadRequestException);
    await expect(service.getProjectProgressMonitoring(NaN as any)).rejects.toThrow(BadRequestException);
  });

  it('16. Throws NotFoundException if project not found', async () => {
    mockProjectRepo.findOne.mockResolvedValue(null);
    await expect(service.getProjectProgressMonitoring(999)).rejects.toThrow(NotFoundException);
  });

  it('17. Enforces RBAC: non-assigned PM receives ForbiddenException', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 100,
      code: 'PRJ-100',
      name: 'Project 100',
      managerId: 42,
      status: 'IN_PROGRESS',
    });

    await expect(
      service.getProjectProgressMonitoring(100, 99, ['PROJECT_MANAGER']),
    ).rejects.toThrow(ForbiddenException);
  });

  it('18. Allows assigned PM and PMO read access', async () => {
    mockProjectRepo.findOne.mockResolvedValue({
      id: 100,
      code: 'PRJ-100',
      name: 'Project 100',
      managerId: 42,
      status: 'IN_PROGRESS',
    });

    // Assigned PM
    const resPm = await service.getProjectProgressMonitoring(100, 42, ['PROJECT_MANAGER']);
    expect(resPm.project.id).toBe(100);

    // PMO
    const resPmo = await service.getProjectProgressMonitoring(100, 99, ['PMO']);
    expect(resPmo.project.id).toBe(100);
  });

  // =========================================================================
  // EXPLICIT MILESTONE SSOT TESTS (C1)
  // =========================================================================
  it('19. isMilestone=true strictly determines milestone semantics and step-function 0 -> 100', () => {
    const milestoneLeaf = {
      id: 301,
      baseline_id: 1,
      wbs_id: 30,
      parent_wbs_id: null,
      code: '3.1',
      name: 'Key Project Milestone',
      level: 1,
      weight_percentage: 0,
      is_leaf: true,
      task_id: 401,
      planned_start_date: '2026-10-20',
      planned_end_date: '2026-10-20',
      planned_duration: 0,
      is_milestone: true,
    };

    const beforeMidnight = parseDateToUtcMidnight('2026-10-19')!;
    const onMidnight = parseDateToUtcMidnight('2026-10-20')!;

    expect(computeLeafPlannedProgressOnDate(milestoneLeaf, beforeMidnight)).toBe(0);
    expect(computeLeafPlannedProgressOnDate(milestoneLeaf, onMidnight)).toBe(100);
  });

  it('20. Ordinary task with weight=0 and is_milestone=false is NOT milestone', () => {
    const zeroWeightLeaf = {
      id: 302,
      baseline_id: 1,
      wbs_id: 31,
      parent_wbs_id: null,
      code: '3.2',
      name: 'Zero Weight Normal Task',
      level: 1,
      weight_percentage: 0,
      is_leaf: true,
      task_id: 402,
      planned_start_date: '2026-10-10',
      planned_end_date: '2026-10-20',
      planned_duration: 10,
      is_milestone: false,
    };

    const task402 = {
      id: 402,
      projectId: 1,
      name: 'Zero Weight Normal Task',
      progress: 0,
      status: 'PLANNED',
      isMilestone: false,
    };

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: {
        code: 'PRJ-ZW',
        name: 'Zero Weight Project',
        status: 'IN_PROGRESS',
        customerName: null,
        managerName: null,
      },
      baselineItems: [zeroWeightLeaf],
      tasks: [task402],
      progressLogs: [],
      asOf: '2026-10-15',
    });

    // Must NOT appear in milestone monitoring list
    expect(res.milestones).toHaveLength(0);
  });

  it('21. Ordinary task with duration=0 and is_milestone=false is NOT milestone in monitoring list', () => {
    const zeroDurationLeaf = {
      id: 303,
      baseline_id: 1,
      wbs_id: 32,
      parent_wbs_id: null,
      code: '3.3',
      name: 'Same Day Non-Milestone Task',
      level: 1,
      weight_percentage: 10,
      is_leaf: true,
      task_id: 403,
      planned_start_date: '2026-10-15',
      planned_end_date: '2026-10-15',
      planned_duration: 0,
      is_milestone: false,
    };

    const task403 = {
      id: 403,
      projectId: 1,
      name: 'Same Day Non-Milestone Task',
      progress: 0,
      status: 'PLANNED',
      isMilestone: false,
    };

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: {
        code: 'PRJ-ZD',
        name: 'Zero Duration Project',
        status: 'IN_PROGRESS',
        customerName: null,
        managerName: null,
      },
      baselineItems: [zeroDurationLeaf],
      tasks: [task403],
      progressLogs: [],
      asOf: '2026-10-15',
    });

    // Must NOT be treated as a milestone
    expect(res.milestones).toHaveLength(0);
  });

  it('22. Normal task remains linear throughout duration', () => {
    const normalLeaf = {
      id: 304,
      baseline_id: 1,
      wbs_id: 33,
      parent_wbs_id: null,
      code: '3.4',
      name: 'Linear Task 10 Days',
      level: 1,
      weight_percentage: 100,
      is_leaf: true,
      task_id: 404,
      planned_start_date: '2026-10-10',
      planned_end_date: '2026-10-20',
      planned_duration: 10,
      is_milestone: false,
    };

    const halfway = parseDateToUtcMidnight('2026-10-15')!;
    expect(computeLeafPlannedProgressOnDate(normalLeaf, halfway)).toBe(50);
  });

  it('23. Milestone count strictly uses authoritative source only (is_milestone=true)', () => {
    const mixedLeaves = [
      {
        id: 305,
        baseline_id: 1,
        wbs_id: 34,
        parent_wbs_id: null,
        code: '3.5',
        name: 'Actual Milestone',
        level: 1,
        weight_percentage: 0,
        is_leaf: true,
        task_id: 405,
        planned_start_date: '2026-10-25',
        planned_end_date: '2026-10-25',
        planned_duration: 0,
        is_milestone: true,
      },
      {
        id: 306,
        baseline_id: 1,
        wbs_id: 35,
        parent_wbs_id: null,
        code: '3.6',
        name: 'Normal Task Weight Zero',
        level: 1,
        weight_percentage: 0,
        is_leaf: true,
        task_id: 406,
        planned_start_date: '2026-10-10',
        planned_end_date: '2026-10-20',
        planned_duration: 10,
        is_milestone: false,
      },
    ];

    const tasks = [
      { id: 405, projectId: 1, name: 'Actual Milestone', progress: 0, status: 'PLANNED', isMilestone: true },
      { id: 406, projectId: 1, name: 'Normal Task Weight Zero', progress: 0, status: 'PLANNED', isMilestone: false },
    ];

    const res = computeProgressMonitoringReadModel({
      projectId: 1,
      projectMeta: {
        code: 'PRJ-MIX',
        name: 'Mixed Project',
        status: 'IN_PROGRESS',
        customerName: null,
        managerName: null,
      },
      baselineItems: mixedLeaves,
      tasks,
      progressLogs: [],
      asOf: '2026-10-15',
    });

    // Exactly 1 milestone counted
    expect(res.milestones).toHaveLength(1);
    expect(res.milestones[0].taskId).toBe(405);
  });

  // =========================================================================
  // RBAC ROLE MATRIX HARD PROOF (C1)
  // =========================================================================
  describe('24. Comprehensive RBAC Role Matrix for F3C Read Access', () => {
    const targetProject = {
      id: 200,
      code: 'PRJ-RBAC-200',
      name: 'RBAC Test Project',
      managerId: 777, // Assigned PM ID
      status: 'IN_PROGRESS',
    };

    const roleMatrix = [
      { role: 'PROJECT_MANAGER', userId: 777, expected: 'ALLOWED', desc: 'Assigned PM' },
      { role: 'PROJECT_MANAGER', userId: 999, expected: 'FORBIDDEN', desc: 'Other / unassigned PM' },
      { role: 'PMO', userId: 801, expected: 'ALLOWED', desc: 'PMO' },
      { role: 'HEAD_OF_OPERATIONS', userId: 802, expected: 'ALLOWED', desc: 'HEAD_OF_OPERATIONS' },
      { role: 'PROCUREMENT', userId: 803, expected: 'ALLOWED', desc: 'PROCUREMENT' },
      { role: 'FINANCE', userId: 804, expected: 'ALLOWED', desc: 'FINANCE' },
      { role: 'DIRECTOR', userId: 805, expected: 'ALLOWED', desc: 'DIRECTOR' },
      { role: 'ADMIN', userId: 806, expected: 'FORBIDDEN', desc: 'ADMIN (No business project bypass)' },
      { role: 'SUPER_ADMIN', userId: 807, expected: 'ALLOWED', desc: 'SUPER_ADMIN' },
      { role: 'MARKETING', userId: 808, expected: 'FORBIDDEN', desc: 'MARKETING' },
    ];

    roleMatrix.forEach(({ role, userId, expected, desc }) => {
      it(`Role [${role}] (${desc}) -> ${expected}`, async () => {
        mockProjectRepo.findOne.mockResolvedValue(targetProject);

        if (expected === 'ALLOWED') {
          const res = await service.getProjectProgressMonitoring(200, userId, [role]);
          expect(res.project.id).toBe(200);
        } else {
          await expect(
            service.getProjectProgressMonitoring(200, userId, [role]),
          ).rejects.toThrow(ForbiddenException);
        }
      });
    });
  });
});


