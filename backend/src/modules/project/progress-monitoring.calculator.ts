/**
 * EPMS — PROJECT-EXEC-F2-F3C Progress & Monitoring + S-Curve Calculator
 *
 * Core Principles:
 * 1. PROJECT CONTROL & S-CURVE IS A DERIVED READ MODEL (Never mutates underlying tables).
 * 2. PLAN = Immutable ACTIVE baseline (project_baselines, project_baseline_wbs_items).
 * 3. ACTUAL = Authoritative task execution state & immutable progress history (project_progress_logs).
 * 4. Operates on EXECUTABLE LEAF baseline items only (Parent weights never double count).
 * 5. Reuses canonical computeProjectControl and shared date helpers.
 * 6. Capture one authoritative server-side asOf timestamp for the entire response.
 */

import {
  BaselineWbsInput,
  TaskExecutionInput,
  computeProjectControl,
  parseDateToUtcMidnight,
  formatIsoDateString,
  diffCalendarDays,
  round2,
  findDescendantLeaves,
} from "./project-control.calculator";

export interface ProgressMonitoringCurvePointDto {
  date: string; // 'YYYY-MM-DD'
  plannedProgress: number | null;
  actualProgress: number | null;
}

export interface ProgressMonitoringCurveDto {
  planAvailable: boolean;
  historyCoverage: "FULL" | "PARTIAL" | "UNAVAILABLE";
  points: ProgressMonitoringCurvePointDto[];
}

export interface ProgressMonitoringTaskSummaryDto {
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
  total: number;
}

export interface ProgressMonitoringPackageDto {
  wbsId: number;
  baselineItemId: number;
  code: string;
  name: string;
  level: number;
  weight: number;
  descendantLeafWeight: number;
  plannedProgress: number | null;
  actualProgress: number | null;
  progressVariancePp: number | null;
  overdueTaskCount: number;
  reviewTaskCount: number;
  plannedFinish: string | null;
  health: "AHEAD" | "ON_PLAN" | "BEHIND" | null;
}

export interface ProgressMonitoringMilestoneDto {
  taskId: number;
  code: string;
  name: string;
  plannedDate: string | null;
  actualDate: string | null;
  status:
    | "BELUM_JATUH_TEMPO"
    | "TERLAMBAT"
    | "SELESAI"
    | "SELESAI_LEBIH_CEPAT"
    | "SELESAI_TERLAMBAT";
  varianceDays: number | null;
}

export interface ProgressMonitoringRecentActivityDto {
  id: number;
  taskId: number;
  taskName: string;
  taskCode?: string | null;
  eventType: string;
  status: "PENDING_VERIFICATION" | "OFFICIAL" | "REJECTED";
  previousProgress: number;
  reportedProgress: number;
  progressDelta: number;
  effectiveDate: string;
  actorName: string;
  verifiedAt: Date | string | null;
  evidenceCount: number;
  createdAt: Date | string;
}

export interface ProgressMonitoringResponseDto {
  project: {
    id: number;
    code: string;
    name: string;
    status: string;
    customerName: string | null;
    managerName: string | null;
    managerId?: number | null;
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: null; // R1-22: strictly NOT MODELED
  };
  asOf: string;
  control: {
    planComparisonAvailable: boolean;
    planComparisonUnavailableReason: string | null;
    plannedProgress: number | null;
    actualProgress: number | null;
    progressVariancePp: number | null;
    progressHealth: "AHEAD" | "ON_PLAN" | "BEHIND" | null;
    actualStart: string | null;
    plannedFinish: string | null;
    overdueTaskCount: number;
  };
  taskSummary: ProgressMonitoringTaskSummaryDto;
  curve: ProgressMonitoringCurveDto;
  workPackages: ProgressMonitoringPackageDto[];
  milestones: ProgressMonitoringMilestoneDto[];
  recentActivity: ProgressMonitoringRecentActivityDto[];
}

export function computeLeafPlannedProgressOnDate(
  leaf: BaselineWbsInput,
  targetMidnight: Date,
): number {
  const isMilestone = Boolean(leaf.is_milestone);
  const plannedStartStr = formatIsoDateString(leaf.planned_start_date);
  const plannedFinishStr = formatIsoDateString(leaf.planned_end_date);
  const plannedDurationDays = isMilestone
    ? 0
    : Number(leaf.planned_duration || 0);

  if (isMilestone) {
    const targetDate = plannedStartStr || plannedFinishStr;
    const milestoneMidnight = parseDateToUtcMidnight(targetDate);
    if (
      milestoneMidnight &&
      targetMidnight.getTime() >= milestoneMidnight.getTime()
    ) {
      return 100;
    }
    return 0;
  }

  if (plannedDurationDays > 0 && plannedStartStr) {
    const plannedStartMidnight = parseDateToUtcMidnight(plannedStartStr);
    if (plannedStartMidnight) {
      const elapsed = diffCalendarDays(targetMidnight, plannedStartMidnight);
      if (elapsed !== null) {
        if (elapsed <= 0) return 0;
        if (elapsed >= plannedDurationDays) return 100;
        return Math.max(
          0,
          Math.min(100, (elapsed / plannedDurationDays) * 100),
        );
      }
    }
  } else if (
    plannedDurationDays === 0 &&
    (plannedFinishStr || plannedStartStr)
  ) {
    const finishMidnight = parseDateToUtcMidnight(
      plannedFinishStr || plannedStartStr,
    );
    if (
      finishMidnight &&
      targetMidnight.getTime() >= finishMidnight.getTime()
    ) {
      return 100;
    }
    return 0;
  }

  return 0;
}

export function computeProgressMonitoringReadModel(options: {
  projectId: number;
  projectMeta: {
    code: string;
    name: string;
    status: string;
    customerName: string | null;
    managerName: string | null;
    managerId?: number | null;
  };
  baselineItems: BaselineWbsInput[] | null;
  tasks: TaskExecutionInput[];
  progressLogs: any[];
  asOf?: Date | string;
}): ProgressMonitoringResponseDto {
  const { projectId, projectMeta, baselineItems, tasks, progressLogs } =
    options;

  // Single authoritative server-side asOf captured once
  const asOfDate = options.asOf ? new Date(options.asOf) : new Date();
  const asOfIso = asOfDate.toISOString();
  const asOfMidnight = parseDateToUtcMidnight(asOfDate) || new Date();

  // 1. Compute canonical Project Control
  const control = computeProjectControl({
    projectId: Number(projectId),
    baselineItems,
    tasks,
    asOf: asOfIso,
  });

  const taskMap = new Map<number, TaskExecutionInput>();
  for (const t of tasks) {
    taskMap.set(Number(t.id), t);
  }

  const leafItems = (baselineItems || []).filter((i) => Boolean(i.is_leaf));
  const packageItems = (baselineItems || []).filter((i) => !Boolean(i.is_leaf));

  // 2. Pending Claims mapping for Review lane truth
  const pendingClaimByTaskId = new Map<number, any>();
  for (const log of progressLogs) {
    if (log.status === "PENDING_VERIFICATION") {
      const tid = Number(log.task_id);
      if (!pendingClaimByTaskId.has(tid)) {
        pendingClaimByTaskId.set(tid, log);
      }
    }
  }

  // 3. Task Summary (exact match to F3B Kanban lanes)
  let todo = 0;
  let inProgress = 0;
  let review = 0;
  let done = 0;

  for (const t of tasks) {
    const tid = Number(t.id);
    const progressNum = Number(t.progress || 0);
    const isCompleted =
      t.status === "COMPLETED" ||
      (progressNum === 100 && t.actualFinishAt !== null);

    if (pendingClaimByTaskId.has(tid)) {
      review++;
    } else if (isCompleted) {
      done++;
    } else if (
      progressNum > 0 ||
      t.status === "IN_PROGRESS" ||
      t.actualStartAt !== null
    ) {
      inProgress++;
    } else {
      todo++;
    }
  }

  const overdueTaskCount = control.tasks.filter(
    (t) => (t.overdueDays || 0) > 0,
  ).length;

  const taskSummary: ProgressMonitoringTaskSummaryDto = {
    todo,
    inProgress,
    review,
    done,
    overdue: overdueTaskCount,
    total: tasks.length,
  };

  // 4. S-Curve Calculation (Plan vs Actual over time)
  let curve: ProgressMonitoringCurveDto;

  if (
    !control.planComparisonAvailable ||
    !control.project.plannedStart ||
    !control.project.plannedFinish ||
    leafItems.length === 0
  ) {
    curve = {
      planAvailable: false,
      historyCoverage: "UNAVAILABLE",
      points: [],
    };
  } else {
    const baselineStartMidnight = parseDateToUtcMidnight(control.project.plannedStart)!;
    let endMidnight = parseDateToUtcMidnight(control.project.plannedFinish)!;

    // Requirement 27: range through max(asOf, baseline planned finish)
    if (asOfMidnight.getTime() > endMidnight.getTime()) {
      endMidnight = asOfMidnight;
    }

    // Official logs for actual history (canonical official records only)
    const officialLogs = progressLogs.filter((l) => l.status === "OFFICIAL");
    let historyCoverage: "FULL" | "PARTIAL" | "UNAVAILABLE" = "UNAVAILABLE";

    if (officialLogs.length === 0) {
      historyCoverage = "UNAVAILABLE";
    } else {
      const tasksWithProgress = tasks.filter(
        (t) => Number(t.progress || 0) > 0,
      );
      const taskIdsWithOfficialLogs = new Set(
        officialLogs.map((l) => Number(l.task_id)),
      );
      const allHaveLogs =
        tasksWithProgress.length > 0 &&
        tasksWithProgress.every((t) =>
          taskIdsWithOfficialLogs.has(Number(t.id)),
        );
      historyCoverage = allHaveLogs ? "FULL" : "PARTIAL";
    }

    // Canonical Domain Rule:
    // Determine earliest valid OFFICIAL actual progress date
    let earliestOfficialActualMidnight: Date | null = null;
    for (const log of officialLogs) {
      const logDate =
        parseDateToUtcMidnight(log.effective_date) ||
        parseDateToUtcMidnight(log.created_at);
      if (logDate) {
        if (
          !earliestOfficialActualMidnight ||
          logDate.getTime() < earliestOfficialActualMidnight.getTime()
        ) {
          earliestOfficialActualMidnight = logDate;
        }
      }
    }

    // timelineStart = min(plannedStart, earliestOfficialActualDate)
    let startMidnight = baselineStartMidnight;
    if (
      earliestOfficialActualMidnight &&
      earliestOfficialActualMidnight.getTime() < startMidnight.getTime()
    ) {
      startMidnight = earliestOfficialActualMidnight;
    }

    const totalDays = diffCalendarDays(endMidnight, startMidnight) || 0;
    // Step: daily for normal projects, weekly if duration > 180 days for performance (Req 28)
    const stepDays = totalDays > 180 ? 7 : 1;

    const timelineDates: Date[] = [];
    let currentMs = startMidnight.getTime();
    const endMs = endMidnight.getTime();
    const asOfMs = asOfMidnight.getTime();

    while (currentMs <= endMs) {
      timelineDates.push(new Date(currentMs));
      currentMs += stepDays * 24 * 60 * 60 * 1000;
    }

    if (asOfMs >= startMidnight.getTime() && asOfMs <= endMs) {
      if (!timelineDates.some((d) => d.getTime() === asOfMs)) {
        timelineDates.push(new Date(asOfMs));
      }
    }

    if (!timelineDates.some((d) => d.getTime() === baselineStartMidnight.getTime())) {
      timelineDates.push(baselineStartMidnight);
    }

    for (const log of officialLogs) {
      const logDate =
        parseDateToUtcMidnight(log.effective_date) ||
        parseDateToUtcMidnight(log.created_at);
      if (logDate && logDate.getTime() >= startMidnight.getTime() && logDate.getTime() <= endMs) {
        if (!timelineDates.some((d) => d.getTime() === logDate.getTime())) {
          timelineDates.push(logDate);
        }
      }
    }

    if (!timelineDates.some((d) => d.getTime() === endMs)) {
      timelineDates.push(new Date(endMs));
    }

    timelineDates.sort((a, b) => a.getTime() - b.getTime());

    const points: ProgressMonitoringCurvePointDto[] = [];

    for (const currDate of timelineDates) {
      const dateStr = formatIsoDateString(currDate)!;

      // Planned curve at currDate:
      // Critical: Before baseline plannedStart, planned cumulative progress is strictly 0%
      let plannedVal = 0;
      if (currDate.getTime() >= baselineStartMidnight.getTime()) {
        let sumPlanned = 0;
        for (const leaf of leafItems) {
          const leafPlanned = computeLeafPlannedProgressOnDate(leaf, currDate);
          sumPlanned += (Number(leaf.weight_percentage || 0) * leafPlanned) / 100;
        }
        plannedVal = round2(Math.max(0, Math.min(100, sumPlanned)));
      }

      // Actual curve at currDate:
      // Only computed on or after earliest official actual date, up through asOf
      let actualVal: number | null = null;
      if (
        currDate.getTime() <= asOfMidnight.getTime() &&
        historyCoverage !== "UNAVAILABLE" &&
        earliestOfficialActualMidnight &&
        currDate.getTime() >= earliestOfficialActualMidnight.getTime()
      ) {
        let sumActual = 0;
        for (const leaf of leafItems) {
          const tid = Number(leaf.task_id);
          // Find latest official log for this task on or before currDate
          let latestLog: any = null;
          for (const log of officialLogs) {
            if (Number(log.task_id) === tid) {
              const logDate =
                parseDateToUtcMidnight(log.effective_date) ||
                parseDateToUtcMidnight(log.created_at);
              if (logDate && logDate.getTime() <= currDate.getTime()) {
                if (!latestLog || Number(log.id) > Number(latestLog.id)) {
                  latestLog = log;
                }
              }
            }
          }
          const taskActualProgress = latestLog
            ? Number(latestLog.reported_progress || 0)
            : 0;
          sumActual +=
            (Number(leaf.weight_percentage || 0) * taskActualProgress) / 100;
        }
        actualVal = round2(Math.max(0, Math.min(100, sumActual)));
      }

      points.push({
        date: dateStr,
        plannedProgress: plannedVal,
        actualProgress: actualVal,
      });
    }

    curve = {
      planAvailable: true,
      historyCoverage,
      points,
    };
  }

  // 5. Work Package Control
  const controlTaskMap = new Map<number, any>();
  for (const ct of control.tasks) {
    controlTaskMap.set(Number(ct.taskId), ct);
  }

  const workPackages: ProgressMonitoringPackageDto[] = [];
  if (baselineItems && baselineItems.length > 0) {
    for (const pkg of control.wbsPackages) {
      const origPkg = packageItems.find((p) => Number(p.wbs_id) === pkg.wbsId);
      const descendantLeaves = origPkg
        ? findDescendantLeaves(origPkg, baselineItems)
        : [];
      const descendantTaskIds = descendantLeaves
        .filter((l) => l.task_id)
        .map((l) => Number(l.task_id));

      let overdueCount = 0;
      let reviewCount = 0;
      let maxPlannedFinish: string | null = null;

      for (const tid of descendantTaskIds) {
        const ct = controlTaskMap.get(tid);
        if (ct && (ct.overdueDays || 0) > 0) overdueCount++;
        if (pendingClaimByTaskId.has(tid)) reviewCount++;
        if (ct && ct.plannedFinish) {
          if (!maxPlannedFinish || ct.plannedFinish > maxPlannedFinish) {
            maxPlannedFinish = ct.plannedFinish;
          }
        }
      }

      let health: "AHEAD" | "ON_PLAN" | "BEHIND" | null = null;
      if (pkg.progressVariancePp !== null) {
        if (pkg.progressVariancePp > 0.01) {
          health = "AHEAD";
        } else if (pkg.progressVariancePp < -0.01) {
          health = "BEHIND";
        } else {
          health = "ON_PLAN";
        }
      }

      workPackages.push({
        wbsId: pkg.wbsId,
        baselineItemId: pkg.baselineItemId,
        code: pkg.code,
        name: pkg.name,
        level: pkg.level,
        weight: pkg.weight,
        descendantLeafWeight: pkg.descendantLeafWeight,
        plannedProgress: pkg.plannedProgress,
        actualProgress: pkg.actualProgress,
        progressVariancePp: pkg.progressVariancePp,
        overdueTaskCount: overdueCount,
        reviewTaskCount: reviewCount,
        plannedFinish: maxPlannedFinish,
        health,
      });
    }
  }

  // 6. Milestone Monitoring (Strict SSOT: leaf.is_milestone === true only)
  const milestones: ProgressMonitoringMilestoneDto[] = [];
  for (const leaf of leafItems) {
    const isMilestone = Boolean(leaf.is_milestone);
    if (!isMilestone) continue;

    const task = taskMap.get(Number(leaf.task_id));
    const plannedDate = formatIsoDateString(
      leaf.planned_start_date || leaf.planned_end_date,
    );
    const actualFinishStr = task?.actualFinishAt
      ? formatIsoDateString(task.actualFinishAt)
      : null;

    let status: ProgressMonitoringMilestoneDto["status"] = "BELUM_JATUH_TEMPO";
    let varianceDays: number | null = null;

    if (actualFinishStr) {
      const dur = diffCalendarDays(actualFinishStr, plannedDate);
      varianceDays = dur;
      if (dur !== null && dur < 0) {
        status = "SELESAI_LEBIH_CEPAT";
      } else if (dur !== null && dur > 0) {
        status = "SELESAI_TERLAMBAT";
      } else {
        status = "SELESAI";
      }
    } else {
      const dur = diffCalendarDays(asOfMidnight, plannedDate);
      if (dur !== null && dur > 0) {
        status = "TERLAMBAT";
        varianceDays = dur;
      } else {
        status = "BELUM_JATUH_TEMPO";
        varianceDays = dur !== null ? dur : null;
      }
    }

    milestones.push({
      taskId: Number(task?.id || leaf.task_id),
      code: leaf.code,
      name: leaf.name,
      plannedDate,
      actualDate: actualFinishStr,
      status,
      varianceDays,
    });
  }

  // 7. Recent Execution Activity (bounded to 15 latest logs per Req 40, 41)
  const recentActivity: ProgressMonitoringRecentActivityDto[] = progressLogs
    .slice(0, 15)
    .map((log) => {
      const task = taskMap.get(Number(log.task_id));
      const actor =
        log.verifier?.fullName ||
        log.verifierName ||
        log.submitter?.fullName ||
        log.submitterName ||
        "Sistem";

      return {
        id: Number(log.id),
        taskId: Number(log.task_id),
        taskName: log.task?.name || task?.name || `Task #${log.task_id}`,
        taskCode: (log.task as any)?.wbsCode || null,
        eventType: log.event_type,
        status: log.status,
        previousProgress: Number(log.previous_progress || 0),
        reportedProgress: Number(log.reported_progress || 0),
        progressDelta: Number(log.progress_delta || 0),
        effectiveDate: log.effective_date,
        actorName: actor,
        verifiedAt: log.verified_at,
        evidenceCount: Array.isArray(log.evidence) ? log.evidence.length : 0,
        createdAt: log.created_at,
      };
    });

  return {
    project: {
      id: Number(projectId),
      code: projectMeta.code,
      name: projectMeta.name,
      status: projectMeta.status,
      customerName: projectMeta.customerName,
      managerName: projectMeta.managerName,
      managerId: projectMeta.managerId !== undefined && projectMeta.managerId !== null
        ? Number(projectMeta.managerId)
        : null,
      plannedStart: control.project.plannedStart,
      plannedFinish: control.project.plannedFinish,
      actualStart: control.project.actualStart,
      actualFinish: null, // Strictly NOT MODELED
    },
    asOf: asOfIso,
    control: {
      planComparisonAvailable: control.planComparisonAvailable,
      planComparisonUnavailableReason: control.planComparisonUnavailableReason,
      plannedProgress: control.project.plannedProgress,
      actualProgress: control.project.actualProgress,
      progressVariancePp: control.project.progressVariancePp,
      progressHealth: control.project.progressHealth,
      actualStart: control.project.actualStart,
      plannedFinish: control.project.plannedFinish,
      overdueTaskCount,
    },
    taskSummary,
    curve,
    workPackages,
    milestones,
    recentActivity,
  };
}
