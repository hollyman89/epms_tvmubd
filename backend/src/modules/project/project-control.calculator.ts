/**
 * EPMS — PROJECT-CONTROL-R1 Authoritative Variance Engine & Read Model Calculator
 *
 * Core Principles:
 * 1. PROJECT CONTROL IS A DERIVED READ MODEL (Never mutates underlying tables).
 * 2. PLAN = Immutable ACTIVE baseline (project_baselines, project_baseline_wbs_items).
 * 3. ACTUAL = Authoritative task execution state (tasks: progress, status, actualStartAt, actualFinishAt).
 * 4. HISTORY = Immutable progress ledger (project_progress_logs).
 * 5. Operates on EXECUTABLE LEAF baseline items only (Parent weights never double count).
 * 6. Calendar duration convention matches schedule SSOT: diff in calendar days (End - Start).
 */

export interface BaselineWbsInput {
  id: number;
  baseline_id: number;
  wbs_id: number;
  parent_wbs_id: number | null;
  code: string;
  name: string;
  level: number;
  weight_percentage: number | string;
  is_leaf: boolean;
  task_id: number | null;
  task_name_snapshot?: string | null;
  planned_start_date: string | Date | null;
  planned_end_date: string | Date | null;
  planned_duration: number | null;
  is_milestone: boolean | number;
}

export interface TaskExecutionInput {
  id: number;
  projectId: number;
  wbsId?: number;
  name: string;
  isMilestone?: boolean | number;
  progress: number | string;
  status: string;
  actualStartAt?: Date | string | null;
  actualFinishAt?: Date | string | null;
}

export interface ProjectControlTaskDto {
  taskId: number;
  baselineItemId: number;
  code: string;
  name: string;
  weight: number;
  isMilestone: boolean;

  plannedStart: string | null;
  plannedFinish: string | null;
  plannedDurationDays: number | null;

  actualStart: string | null;
  actualFinish: string | null;
  actualDurationDays: number | null;

  plannedProgress: number | null;
  actualProgress: number;
  progressVariancePp: number | null;

  startVarianceDays: number | null;
  startDelayDays: number;

  finishVarianceDays: number | null;
  overdueDays: number;

  // Milestone specific properties (R1-19)
  plannedDate?: string | null;
  actualDate?: string | null;
  milestoneVarianceDays?: number | null;
  milestoneOverdueDays?: number;
}

export interface ProjectControlPackageDto {
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
}

export interface ProjectControlProjectSummaryDto {
  plannedStart: string | null;
  plannedFinish: string | null;

  actualStart: string | null;
  actualFinish: null; // R1-22: strictly NOT MODELED

  formalClosureModeled: false;

  plannedProgress: number | null;
  actualProgress: number | null;
  progressVariancePp: number | null;
  progressHealth: "AHEAD" | "ON_PLAN" | "BEHIND" | null;

  allExecutionTasksCompleted: boolean;
}

export interface ProjectControlResponseDto {
  projectId: number;
  asOf: string;

  planComparisonAvailable: boolean;
  planComparisonUnavailableReason: string | null;

  project: ProjectControlProjectSummaryDto;

  tasks: ProjectControlTaskDto[];
  wbsPackages: ProjectControlPackageDto[];
}

/**
 * Normalizes any Date or ISO date string into UTC midnight (00:00:00.000Z).
 * Ensures deterministic calendar day arithmetic irrespective of server timezone.
 */
export function parseDateToUtcMidnight(
  d: Date | string | null | undefined,
): Date | null {
  if (!d) return null;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  const isoDate = dateObj.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats date into 'YYYY-MM-DD' string for consistent presentation.
 */
export function formatIsoDateString(
  d: Date | string | null | undefined,
): string | null {
  if (!d) return null;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Computes calendar difference in days: (dateB - dateA).
 * Matches repository schedule SSOT (end.diff(start, 'day')).
 */
export function diffCalendarDays(
  dateB: Date | string | null | undefined,
  dateA: Date | string | null | undefined,
): number | null {
  const b = parseDateToUtcMidnight(dateB);
  const a = parseDateToUtcMidnight(dateA);
  if (!b || !a) return null;
  const msDiff = b.getTime() - a.getTime();
  return Math.round(msDiff / (1000 * 60 * 60 * 24));
}

/**
 * Rounds to 2 decimal places using technical epsilon to prevent float quirks.
 */
export function round2(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

/**
 * Pure calculation engine for Project Control R1.
 */
export function computeProjectControl(options: {
  projectId: number;
  baselineItems: BaselineWbsInput[] | null;
  tasks: TaskExecutionInput[];
  asOf?: Date | string;
}): ProjectControlResponseDto {
  const { projectId, baselineItems, tasks } = options;

  // R1-23: Evaluated against one authoritative asOf captured once
  const asOfDate = options.asOf ? new Date(options.asOf) : new Date();
  const asOfIso = asOfDate.toISOString();
  const asOfMidnight = parseDateToUtcMidnight(asOfDate) || new Date();

  const taskMap = new Map<number, TaskExecutionInput>();
  for (const t of tasks) {
    taskMap.set(Number(t.id), t);
  }

  // 1. Check if ACTIVE baseline exists
  if (!baselineItems || baselineItems.length === 0) {
    const minActualStart = computeMinActualStart(tasks);
    const allDone = checkAllTasksCompleted(tasks);

    return {
      projectId: Number(projectId),
      asOf: asOfIso,
      planComparisonAvailable: false,
      planComparisonUnavailableReason: "NO_ACTIVE_BASELINE",
      project: {
        plannedStart: null,
        plannedFinish: null,
        actualStart: minActualStart,
        actualFinish: null,
        formalClosureModeled: false,
        plannedProgress: null,
        actualProgress: null,
        progressVariancePp: null,
        progressHealth: null,
        allExecutionTasksCompleted: allDone,
      },
      tasks: [],
      wbsPackages: [],
    };
  }

  const leafItems = baselineItems.filter((i) => Boolean(i.is_leaf));
  const packageItems = baselineItems.filter((i) => !Boolean(i.is_leaf));

  // 2. Baseline Weight Integrity Check (R1-6: leaf sum must be 100.00%)
  const leafWeightSum = leafItems.reduce(
    (acc, i) => acc + Number(i.weight_percentage || 0),
    0,
  );
  const isBaselineValid = Math.abs(leafWeightSum - 100.0) <= 0.05;

  if (!isBaselineValid) {
    const minActualStart = computeMinActualStart(tasks);
    const allDone = checkAllTasksCompleted(tasks);

    return {
      projectId: Number(projectId),
      asOf: asOfIso,
      planComparisonAvailable: false,
      planComparisonUnavailableReason: "INVALID_BASELINE",
      project: {
        plannedStart: computeMinPlannedStart(leafItems),
        plannedFinish: computeMaxPlannedFinish(leafItems),
        actualStart: minActualStart,
        actualFinish: null,
        formalClosureModeled: false,
        plannedProgress: null,
        actualProgress: null,
        progressVariancePp: null,
        progressHealth: null,
        allExecutionTasksCompleted: allDone,
      },
      tasks: [],
      wbsPackages: [],
    };
  }

  // 3. Mapping Integrity Check (R1-29: every executable leaf must have mapped task)
  for (const leaf of leafItems) {
    if (!leaf.task_id || !taskMap.has(Number(leaf.task_id))) {
      const minActualStart = computeMinActualStart(tasks);
      const allDone = checkAllTasksCompleted(tasks);

      return {
        projectId: Number(projectId),
        asOf: asOfIso,
        planComparisonAvailable: false,
        planComparisonUnavailableReason: "TASK_MAPPING_INTEGRITY_ERROR",
        project: {
          plannedStart: computeMinPlannedStart(leafItems),
          plannedFinish: computeMaxPlannedFinish(leafItems),
          actualStart: minActualStart,
          actualFinish: null,
          formalClosureModeled: false,
          plannedProgress: null,
          actualProgress: null,
          progressVariancePp: null,
          progressHealth: null,
          allExecutionTasksCompleted: allDone,
        },
        tasks: [],
        wbsPackages: [],
      };
    }
  }

  // 4. Calculate Task Plan vs Actual
  const taskDtos: ProjectControlTaskDto[] = [];
  let sumWeightedPlannedProgress = 0;
  let sumWeightedActualProgress = 0;

  for (const leaf of leafItems) {
    const task = taskMap.get(Number(leaf.task_id))!;
    const weight = Number(leaf.weight_percentage || 0);
    const isMilestone = Boolean(leaf.is_milestone);

    const plannedStartStr = formatIsoDateString(leaf.planned_start_date);
    const plannedFinishStr = formatIsoDateString(leaf.planned_end_date);
    const plannedDurationDays = isMilestone
      ? 0
      : Number(leaf.planned_duration || 0);

    const actualStartStr = task.actualStartAt
      ? new Date(task.actualStartAt).toISOString()
      : null;
    const actualFinishStr = task.actualFinishAt
      ? new Date(task.actualFinishAt).toISOString()
      : null;

    // Actual duration (R1-18)
    let actualDurationDays: number | null = null;
    if (isMilestone) {
      if (actualFinishStr) actualDurationDays = 0;
    } else if (task.actualStartAt && task.actualFinishAt) {
      const dur = diffCalendarDays(task.actualFinishAt, task.actualStartAt);
      actualDurationDays = dur !== null ? Math.max(0, dur) : null;
    }

    // Task Planned Progress (R1-7, R1-8, R1-9)
    let taskPlannedProgress = 0;
    if (isMilestone) {
      const targetDate = plannedStartStr || plannedFinishStr;
      const targetMidnight = parseDateToUtcMidnight(targetDate);
      if (
        targetMidnight &&
        asOfMidnight.getTime() >= targetMidnight.getTime()
      ) {
        taskPlannedProgress = 100;
      } else {
        taskPlannedProgress = 0;
      }
    } else if (plannedDurationDays > 0 && plannedStartStr) {
      const plannedStartMidnight = parseDateToUtcMidnight(plannedStartStr);
      if (plannedStartMidnight) {
        const elapsed = diffCalendarDays(asOfMidnight, plannedStartMidnight);
        if (elapsed !== null) {
          if (elapsed <= 0) {
            taskPlannedProgress = 0;
          } else if (elapsed >= plannedDurationDays) {
            taskPlannedProgress = 100;
          } else {
            taskPlannedProgress = Math.max(
              0,
              Math.min(100, (elapsed / plannedDurationDays) * 100),
            );
          }
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
        asOfMidnight.getTime() >= finishMidnight.getTime()
      ) {
        taskPlannedProgress = 100;
      } else {
        taskPlannedProgress = 0;
      }
    } else {
      taskPlannedProgress = 0;
    }

    // Official task actual progress (R1-11)
    const taskActualProgress = Number(task.progress || 0);

    // Progress variance (R1-12)
    const taskProgressVariancePp = taskActualProgress - taskPlannedProgress;

    // Start variance & delay (R1-14, R1-15)
    let startVarianceDays: number | null = null;
    let startDelayDays = 0;
    if (task.actualStartAt && plannedStartStr) {
      startVarianceDays = diffCalendarDays(task.actualStartAt, plannedStartStr);
    } else if (!task.actualStartAt && plannedStartStr) {
      const pStartMidnight = parseDateToUtcMidnight(plannedStartStr);
      if (pStartMidnight && asOfMidnight.getTime() > pStartMidnight.getTime()) {
        const diff = diffCalendarDays(asOfMidnight, plannedStartStr);
        startDelayDays = diff !== null && diff > 0 ? diff : 0;
      }
    }

    // Finish variance & overdue (R1-16, R1-17)
    let finishVarianceDays: number | null = null;
    let overdueDays = 0;
    if (task.actualFinishAt && plannedFinishStr) {
      finishVarianceDays = diffCalendarDays(
        task.actualFinishAt,
        plannedFinishStr,
      );
    } else if (!task.actualFinishAt && plannedFinishStr) {
      const pFinishMidnight = parseDateToUtcMidnight(plannedFinishStr);
      if (
        pFinishMidnight &&
        asOfMidnight.getTime() > pFinishMidnight.getTime()
      ) {
        const diff = diffCalendarDays(asOfMidnight, plannedFinishStr);
        overdueDays = diff !== null && diff > 0 ? diff : 0;
      }
    }

    // Milestone specifics (R1-19)
    let milestoneVarianceDays: number | null = null;
    let milestoneOverdueDays = 0;
    if (isMilestone) {
      if (actualFinishStr) {
        milestoneVarianceDays = finishVarianceDays;
      } else {
        milestoneOverdueDays = overdueDays;
      }
    }

    // Accumulate unrounded project contributions (R1-10, R1-11, R1-25)
    sumWeightedPlannedProgress += (weight * taskPlannedProgress) / 100;
    sumWeightedActualProgress += (weight * taskActualProgress) / 100;

    taskDtos.push({
      taskId: Number(task.id),
      baselineItemId: Number(leaf.id),
      code: leaf.code,
      name: leaf.name,
      weight: round2(weight)!,
      isMilestone,
      plannedStart: plannedStartStr,
      plannedFinish: plannedFinishStr,
      plannedDurationDays,
      actualStart: actualStartStr,
      actualFinish: actualFinishStr,
      actualDurationDays,
      plannedProgress: round2(taskPlannedProgress)!,
      actualProgress: round2(taskActualProgress)!,
      progressVariancePp: round2(taskProgressVariancePp)!,
      startVarianceDays,
      startDelayDays,
      finishVarianceDays,
      overdueDays,
      plannedDate: isMilestone
        ? plannedStartStr || plannedFinishStr
        : undefined,
      actualDate: isMilestone ? actualFinishStr : undefined,
      milestoneVarianceDays: isMilestone ? milestoneVarianceDays : undefined,
      milestoneOverdueDays: isMilestone ? milestoneOverdueDays : undefined,
    });
  }

  // 5. Project Level Summary
  const projectPlannedProgress = Math.max(
    0,
    Math.min(100, sumWeightedPlannedProgress),
  );
  const projectActualProgress = Math.max(
    0,
    Math.min(100, sumWeightedActualProgress),
  );
  const projectProgressVariancePp =
    projectActualProgress - projectPlannedProgress;

  // Progress Health Label (R1-13)
  const epsilon = 0.01;
  let progressHealth: "AHEAD" | "ON_PLAN" | "BEHIND" = "ON_PLAN";
  if (projectProgressVariancePp > epsilon) {
    progressHealth = "AHEAD";
  } else if (projectProgressVariancePp < -epsilon) {
    progressHealth = "BEHIND";
  } else {
    progressHealth = "ON_PLAN";
  }

  const projectPlannedStart = computeMinPlannedStart(leafItems);
  const projectPlannedFinish = computeMaxPlannedFinish(leafItems);
  const mappedTasks = leafItems.map((l) => taskMap.get(Number(l.task_id))!);
  const projectActualStart = computeMinActualStart(mappedTasks);
  const allExecutionTasksCompleted = checkAllTasksCompleted(mappedTasks);

  // 6. Package / Parent Aggregates (R1-28)
  const packageDtos: ProjectControlPackageDto[] = [];
  for (const pkg of packageItems) {
    const descendantLeaves = findDescendantLeaves(pkg, baselineItems);
    const descendantWeight = descendantLeaves.reduce(
      (acc, l) => acc + Number(l.weight_percentage || 0),
      0,
    );

    let pkgPlannedProgress: number | null = null;
    let pkgActualProgress: number | null = null;
    let pkgVariance: number | null = null;

    if (descendantWeight > 0) {
      let sumLeafPlanned = 0;
      let sumLeafActual = 0;
      for (const l of descendantLeaves) {
        const leafDto = taskDtos.find((t) => t.baselineItemId === Number(l.id));
        if (leafDto) {
          sumLeafPlanned +=
            Number(l.weight_percentage || 0) * (leafDto.plannedProgress || 0);
          sumLeafActual +=
            Number(l.weight_percentage || 0) * leafDto.actualProgress;
        }
      }
      pkgPlannedProgress = round2(sumLeafPlanned / descendantWeight);
      pkgActualProgress = round2(sumLeafActual / descendantWeight);
      pkgVariance = round2(
        (pkgActualProgress || 0) - (pkgPlannedProgress || 0),
      );
    }

    packageDtos.push({
      wbsId: Number(pkg.wbs_id),
      baselineItemId: Number(pkg.id),
      code: pkg.code,
      name: pkg.name,
      level: Number(pkg.level || 1),
      weight: round2(Number(pkg.weight_percentage || 0))!,
      descendantLeafWeight: round2(descendantWeight)!,
      plannedProgress: pkgPlannedProgress,
      actualProgress: pkgActualProgress,
      progressVariancePp: pkgVariance,
    });
  }

  return {
    projectId: Number(projectId),
    asOf: asOfIso,
    planComparisonAvailable: true,
    planComparisonUnavailableReason: null,
    project: {
      plannedStart: projectPlannedStart,
      plannedFinish: projectPlannedFinish,
      actualStart: projectActualStart,
      actualFinish: null, // R1-22: strictly NOT MODELED
      formalClosureModeled: false,
      plannedProgress: round2(projectPlannedProgress),
      actualProgress: round2(projectActualProgress),
      progressVariancePp: round2(projectProgressVariancePp),
      progressHealth,
      allExecutionTasksCompleted,
    },
    tasks: taskDtos,
    wbsPackages: packageDtos,
  };
}

export function computeMinActualStart(
  tasks: TaskExecutionInput[],
): string | null {
  let minStart: string | null = null;
  for (const t of tasks) {
    if (t.actualStartAt) {
      const dStr = new Date(t.actualStartAt).toISOString();
      if (!minStart || dStr < minStart) {
        minStart = dStr;
      }
    }
  }
  return minStart;
}

export function computeMaxActualFinish(
  tasks: TaskExecutionInput[],
): string | null {
  let maxFinish: string | null = null;
  for (const t of tasks) {
    if (t.actualFinishAt) {
      const dStr = new Date(t.actualFinishAt).toISOString();
      if (!maxFinish || dStr > maxFinish) {
        maxFinish = dStr;
      }
    }
  }
  return maxFinish;
}

export function computeMinPlannedStart(
  leaves: BaselineWbsInput[],
): string | null {
  let minStart: string | null = null;
  for (const l of leaves) {
    if (l.planned_start_date) {
      const s = formatIsoDateString(l.planned_start_date);
      if (s && (!minStart || s < minStart)) {
        minStart = s;
      }
    }
  }
  return minStart;
}

export function computeMaxPlannedFinish(
  leaves: BaselineWbsInput[],
): string | null {
  let maxEnd: string | null = null;
  for (const l of leaves) {
    if (l.planned_end_date) {
      const s = formatIsoDateString(l.planned_end_date);
      if (s && (!maxEnd || s > maxEnd)) {
        maxEnd = s;
      }
    }
  }
  return maxEnd;
}

export function checkAllTasksCompleted(tasks: TaskExecutionInput[]): boolean {
  return (
    tasks.length > 0 &&
    tasks.every(
      (t) => t.status === "COMPLETED" || Number(t.progress || 0) === 100,
    )
  );
}

export function findDescendantLeaves(
  parentPkg: BaselineWbsInput,
  allItems: BaselineWbsInput[],
): BaselineWbsInput[] {
  const childrenMap = new Map<number, BaselineWbsInput[]>();
  for (const item of allItems) {
    if (item.parent_wbs_id !== null && item.parent_wbs_id !== undefined) {
      const pid = Number(item.parent_wbs_id);
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(item);
    }
  }

  const leaves: BaselineWbsInput[] = [];
  const stack = [Number(parentPkg.wbs_id)];

  while (stack.length > 0) {
    const currentWbsId = stack.pop()!;
    const children = childrenMap.get(currentWbsId) || [];
    for (const child of children) {
      if (Boolean(child.is_leaf)) {
        leaves.push(child);
      } else {
        stack.push(Number(child.wbs_id));
      }
    }
  }

  return leaves;
}
