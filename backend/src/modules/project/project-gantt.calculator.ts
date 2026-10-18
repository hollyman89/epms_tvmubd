import {
  BaselineWbsInput,
  TaskExecutionInput,
  computeProjectControl,
  diffCalendarDays,
  parseDateToUtcMidnight,
  formatIsoDateString,
  round2,
  computeMinPlannedStart,
  computeMaxPlannedFinish,
  computeMinActualStart,
  computeMaxActualFinish,
  findDescendantLeaves,
  checkAllTasksCompleted,
} from "./project-control.calculator";

export interface ComputeProjectGanttOptions {
  projectId: number;
  projectMeta: {
    code: string;
    name: string;
    status: string;
    customerName: string | null;
    managerName: string | null;
    managerId: number | null;
  };
  baselineItems: BaselineWbsInput[] | null;
  tasks: TaskExecutionInput[];
  asOf?: Date | string;
}

export interface ProjectGanttRowDto {
  id: string; // e.g. "pkg-1176" or "task-2114"
  type: "WORK_PACKAGE" | "TASK" | "MILESTONE";
  wbsId: number;
  taskId: number | null;
  baselineItemId: number;
  parentId: number | null;
  depth: number;
  code: string;
  name: string;
  weight: number;
  isLeaf: boolean;
  isMilestone: boolean;

  // Baseline schedule
  plannedStart: string | null;
  plannedFinish: string | null;
  plannedDurationDays: number | null;

  // Actual execution
  actualStart: string | null;
  actualFinish: string | null;
  actualDurationDays: number | null;

  // Progress
  progress: number;
  plannedProgress: number | null;
  progressVariancePp: number | null;
  status: string;

  // Variances & delays
  startVarianceDays: number | null;
  startDelayDays: number;
  finishVarianceDays: number | null;
  overdueDays: number;

  // Milestone specifics
  plannedDate?: string | null;
  actualDate?: string | null;
  milestoneVarianceDays?: number | null;
  milestoneOverdueDays?: number;

  childrenCount: number;
}

export interface ProjectGanttResponseDto {
  projectId: number;
  project: {
    id: number;
    code: string;
    name: string;
    status: string;
    customerName: string | null;
    managerName: string | null;
    managerId: number | null;
  };
  asOf: string;
  planComparisonAvailable: boolean;
  planComparisonUnavailableReason?: string | null;
  summary: {
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: null; // Strictly NOT MODELED in F3D
    formalClosureModeled: false;
    plannedProgress: number | null;
    actualProgress: number | null;
    progressVariancePp: number | null;
    progressHealth: "AHEAD" | "ON_PLAN" | "BEHIND" | null;
    overdueTasksCount: number;
    lateMilestonesCount: number;
    totalTasksCount: number;
    completedTasksCount: number;
    inProgressTasksCount: number;
    notStartedTasksCount: number;
  };
  timelineRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  rows: ProjectGanttRowDto[];
}

/**
 * Pure calculation engine for Project Gantt Baseline vs Actual (F3D).
 * Leverages canonical ProjectControlCalculator variance rules (SSOT).
 */
export function computeProjectGantt(
  options: ComputeProjectGanttOptions,
): ProjectGanttResponseDto {
  const { projectId, projectMeta, baselineItems, tasks, asOf } = options;

  // 1. Compute authoritative Project Control model first (SSOT for all variances & baseline validity)
  const control = computeProjectControl({
    projectId,
    baselineItems,
    tasks,
    asOf,
  });

  const asOfDate = new Date(control.asOf);
  const asOfIsoStr = asOfDate.toISOString().split("T")[0];

  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(
    (t) => t.status === "COMPLETED" || Number(t.progress || 0) === 100,
  ).length;
  const inProgressTasksCount = tasks.filter(
    (t) =>
      (t.status === "IN_PROGRESS" || Number(t.progress || 0) > 0) &&
      t.status !== "COMPLETED" &&
      Number(t.progress || 0) < 100,
  ).length;
  const notStartedTasksCount = tasks.filter(
    (t) =>
      (t.status === "PLANNED" || !t.status) &&
      Number(t.progress || 0) === 0 &&
      !t.actualStartAt,
  ).length;

  // 2. Handle invalid or unavailable baseline
  if (!control.planComparisonAvailable) {
    const minActual = control.project.actualStart
      ? control.project.actualStart.split("T")[0]
      : asOfIsoStr;
    return {
      projectId: Number(projectId),
      project: {
        id: Number(projectId),
        code: projectMeta.code,
        name: projectMeta.name,
        status: projectMeta.status,
        customerName: projectMeta.customerName,
        managerName: projectMeta.managerName,
        managerId: projectMeta.managerId,
      },
      asOf: control.asOf,
      planComparisonAvailable: false,
      planComparisonUnavailableReason: control.planComparisonUnavailableReason,
      summary: {
        plannedStart: control.project.plannedStart
          ? control.project.plannedStart.split("T")[0]
          : null,
        plannedFinish: control.project.plannedFinish
          ? control.project.plannedFinish.split("T")[0]
          : null,
        actualStart: control.project.actualStart
          ? control.project.actualStart.split("T")[0]
          : null,
        actualFinish: null,
        formalClosureModeled: false,
        plannedProgress: null,
        actualProgress: null,
        progressVariancePp: null,
        progressHealth: null,
        overdueTasksCount: 0,
        lateMilestonesCount: 0,
        totalTasksCount,
        completedTasksCount,
        inProgressTasksCount,
        notStartedTasksCount,
      },
      timelineRange: {
        startDate: minActual,
        endDate: asOfIsoStr,
        totalDays: 1,
      },
      rows: [],
    };
  }

  // 3. Build lookup maps
  const taskMap = new Map<number, TaskExecutionInput>();
  for (const t of tasks) {
    taskMap.set(Number(t.id), t);
  }

  const controlTaskMap = new Map<number, (typeof control.tasks)[0]>();
  for (const ct of control.tasks) {
    controlTaskMap.set(Number(ct.taskId), ct);
  }

  const packageMap = new Map<number, (typeof control.wbsPackages)[0]>();
  for (const pkg of control.wbsPackages) {
    packageMap.set(Number(pkg.wbsId), pkg);
  }

  const baselineNodeMap = new Map<number, BaselineWbsInput>();
  const childrenMap = new Map<number | null, BaselineWbsInput[]>();

  for (const bi of baselineItems!) {
    baselineNodeMap.set(Number(bi.wbs_id), bi);
    const parentKey =
      bi.parent_wbs_id !== null && bi.parent_wbs_id !== undefined
        ? Number(bi.parent_wbs_id)
        : null;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(bi);
  }

  // Sort children by code ascending
  for (const list of childrenMap.values()) {
    list.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }

  // 4. Preorder traversal to generate hierarchical rows
  const rows: ProjectGanttRowDto[] = [];
  const allDateStrings: string[] = [asOfIsoStr];

  function traverse(node: BaselineWbsInput, depth: number) {
    const isLeaf = Boolean(node.is_leaf);
    const isMilestone = Boolean(node.is_milestone);
    const directChildren = childrenMap.get(Number(node.wbs_id)) || [];

    if (isLeaf) {
      // EXECUTABLE TASK OR MILESTONE
      const tId = Number(node.task_id);
      const task = taskMap.get(tId);
      const ct = controlTaskMap.get(tId);

      const plannedStart = ct?.plannedStart
        ? ct.plannedStart.split("T")[0]
        : null;
      const plannedFinish = ct?.plannedFinish
        ? ct.plannedFinish.split("T")[0]
        : null;
      const actualStart = ct?.actualStart ? ct.actualStart.split("T")[0] : null;
      const actualFinish = ct?.actualFinish
        ? ct.actualFinish.split("T")[0]
        : null;

      if (plannedStart) allDateStrings.push(plannedStart);
      if (plannedFinish) allDateStrings.push(plannedFinish);
      if (actualStart) allDateStrings.push(actualStart);
      if (actualFinish) allDateStrings.push(actualFinish);

      rows.push({
        id: `task-${tId}`,
        type: isMilestone ? "MILESTONE" : "TASK",
        wbsId: Number(node.wbs_id),
        taskId: tId,
        baselineItemId: Number(node.id),
        parentId:
          node.parent_wbs_id !== null ? Number(node.parent_wbs_id) : null,
        depth,
        code: node.code,
        name: node.name,
        weight: Number(node.weight_percentage || 0),
        isLeaf: true,
        isMilestone,

        plannedStart,
        plannedFinish,
        plannedDurationDays:
          ct?.plannedDurationDays ??
          (isMilestone ? 0 : Number(node.planned_duration || 0)),

        actualStart,
        actualFinish,
        actualDurationDays: ct?.actualDurationDays ?? null,

        progress: Number(task?.progress || 0),
        plannedProgress: ct?.plannedProgress ?? 0,
        progressVariancePp: ct?.progressVariancePp ?? 0,
        status: task?.status || "PLANNED",

        startVarianceDays: ct?.startVarianceDays ?? null,
        startDelayDays: ct?.startDelayDays ?? 0,
        finishVarianceDays: ct?.finishVarianceDays ?? null,
        overdueDays: ct?.overdueDays ?? 0,

        plannedDate: isMilestone ? plannedStart || plannedFinish : undefined,
        actualDate: isMilestone ? actualFinish : undefined,
        milestoneVarianceDays: ct?.milestoneVarianceDays,
        milestoneOverdueDays: ct?.milestoneOverdueDays,

        childrenCount: 0,
      });
    } else {
      // WORK PACKAGE (PARENT)
      const pkgControl = packageMap.get(Number(node.wbs_id));
      const descendantLeaves = findDescendantLeaves(node, baselineItems!);
      const descendantTasks = descendantLeaves
        .map((l) => taskMap.get(Number(l.task_id))!)
        .filter(Boolean);

      const pStart = computeMinPlannedStart(descendantLeaves);
      const pFinish = computeMaxPlannedFinish(descendantLeaves);
      const pStartStr = pStart ? pStart.split("T")[0] : null;
      const pFinishStr = pFinish ? pFinish.split("T")[0] : null;
      const pDuration =
        pStartStr && pFinishStr
          ? diffCalendarDays(pFinishStr, pStartStr)
          : null;

      const aStart = computeMinActualStart(descendantTasks);
      const aStartStr = aStart ? aStart.split("T")[0] : null;
      const allDone = checkAllTasksCompleted(descendantTasks);
      const aFinish = allDone ? computeMaxActualFinish(descendantTasks) : null;
      const aFinishStr = aFinish ? aFinish.split("T")[0] : null;
      const aDuration =
        aStartStr && aFinishStr
          ? diffCalendarDays(aFinishStr, aStartStr)
          : null;

      if (pStartStr) allDateStrings.push(pStartStr);
      if (pFinishStr) allDateStrings.push(pFinishStr);
      if (aStartStr) allDateStrings.push(aStartStr);
      if (aFinishStr) allDateStrings.push(aFinishStr);

      const pkgWeight = descendantLeaves.reduce(
        (acc, l) => acc + Number(l.weight_percentage || 0),
        0,
      );

      rows.push({
        id: `pkg-${node.id}`,
        type: "WORK_PACKAGE",
        wbsId: Number(node.wbs_id),
        taskId: null,
        baselineItemId: Number(node.id),
        parentId:
          node.parent_wbs_id !== null ? Number(node.parent_wbs_id) : null,
        depth,
        code: node.code,
        name: node.name,
        weight: round2(pkgWeight)!,
        isLeaf: false,
        isMilestone: false,

        plannedStart: pStartStr,
        plannedFinish: pFinishStr,
        plannedDurationDays: pDuration,

        actualStart: aStartStr,
        actualFinish: aFinishStr,
        actualDurationDays: aDuration,

        progress: pkgControl?.actualProgress ?? 0,
        plannedProgress: pkgControl?.plannedProgress ?? 0,
        progressVariancePp: pkgControl?.progressVariancePp ?? 0,
        status: allDone ? "COMPLETED" : aStartStr ? "IN_PROGRESS" : "PLANNED",

        startVarianceDays: null,
        startDelayDays: 0,
        finishVarianceDays: null,
        overdueDays: 0,

        childrenCount: directChildren.length,
      });

      // Recurse for child nodes
      for (const child of directChildren) {
        traverse(child, depth + 1);
      }
    }
  }

  // Start traversal from root level items (parent_wbs_id is null or not found in baselineNodeMap)
  const rootItems = baselineItems!.filter(
    (bi) =>
      bi.parent_wbs_id === null ||
      bi.parent_wbs_id === undefined ||
      !baselineNodeMap.has(Number(bi.parent_wbs_id)),
  );
  rootItems.sort((a, b) =>
    a.code.localeCompare(b.code, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  for (const root of rootItems) {
    traverse(root, 0);
  }

  // 5. Timeline range calculation with padding
  const validDates = allDateStrings
    .map((s) => parseDateToUtcMidnight(s))
    .filter((d): d is Date => d !== null);

  let timelineMinDate = new Date();
  let timelineMaxDate = new Date();

  if (validDates.length > 0) {
    let minTime = validDates[0].getTime();
    let maxTime = validDates[0].getTime();
    for (const d of validDates) {
      if (d.getTime() < minTime) minTime = d.getTime();
      if (d.getTime() > maxTime) maxTime = d.getTime();
    }
    // Pad 3 days before min and 5 days after max
    timelineMinDate = new Date(minTime - 3 * 24 * 60 * 60 * 1000);
    timelineMaxDate = new Date(maxTime + 5 * 24 * 60 * 60 * 1000);
  }

  const rangeStartStr = formatIsoDateString(timelineMinDate)!;
  const rangeEndStr = formatIsoDateString(timelineMaxDate)!;
  const totalDays = Math.max(
    1,
    (diffCalendarDays(rangeEndStr, rangeStartStr) ?? 0) + 1,
  );

  // 6. Project summary
  const overdueTasksCount = rows.filter(
    (r) => r.isLeaf && !r.isMilestone && r.overdueDays > 0,
  ).length;
  const lateMilestonesCount = rows.filter(
    (r) => r.isMilestone && (r.milestoneOverdueDays ?? 0) > 0,
  ).length;

  return {
    projectId: Number(projectId),
    project: {
      id: Number(projectId),
      code: projectMeta.code,
      name: projectMeta.name,
      status: projectMeta.status,
      customerName: projectMeta.customerName,
      managerName: projectMeta.managerName,
      managerId: projectMeta.managerId,
    },
    asOf: control.asOf,
    planComparisonAvailable: true,
    summary: {
      plannedStart: control.project.plannedStart
        ? control.project.plannedStart.split("T")[0]
        : null,
      plannedFinish: control.project.plannedFinish
        ? control.project.plannedFinish.split("T")[0]
        : null,
      actualStart: control.project.actualStart
        ? control.project.actualStart.split("T")[0]
        : null,
      actualFinish: null, // Strictly NOT MODELED in F3D
      formalClosureModeled: false,
      plannedProgress: control.project.plannedProgress,
      actualProgress: control.project.actualProgress,
      progressVariancePp: control.project.progressVariancePp,
      progressHealth: control.project.progressHealth,
      overdueTasksCount,
      lateMilestonesCount,
      totalTasksCount,
      completedTasksCount,
      inProgressTasksCount,
      notStartedTasksCount,
    },
    timelineRange: {
      startDate: rangeStartStr,
      endDate: rangeEndStr,
      totalDays,
    },
    rows,
  };
}
