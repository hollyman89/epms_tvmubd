import { Injectable } from '@nestjs/common';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { Task } from '../../entities/task.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import {
  WbsReadinessResult,
  CostReadinessResult,
  ScheduleReadinessResult,
  InitialConditionReadinessResult,
  ProcurementGateReadinessResult,
  OperationalReadinessData,
} from './dto/operational-readiness.dto';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(str: any): boolean {
  if (!str || typeof str !== 'string' || !DATE_REGEX.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !isNaN(d.getTime()) && str === d.toISOString().slice(0, 10);
}

@Injectable()
export class OperationalReadinessValidator {
  /**
   * Deterministically evaluates WBS readiness from active database WBS nodes.
   */
  public evaluateWbsReadiness(nodes: WorkBreakdownStructure[]): WbsReadinessResult {
    const activeNodes = (nodes || []).filter((n) => !n.deletedAt);

    if (activeNodes.length === 0) {
      return {
        status: 'NOT_STARTED',
        majorPackagesCount: 0,
        leafDeliverablesCount: 0,
        rootWeightSum: 0.0,
        message: 'Belum ada paket pekerjaan WBS terdaftar',
      };
    }

    const nodeMap = new Map<number, WorkBreakdownStructure>();
    for (const n of activeNodes) {
      nodeMap.set(Number(n.id), n);
    }

    // 1. Detect circular parent references
    for (const n of activeNodes) {
      const visited = new Set<number>();
      let curr = n;
      while (curr.parentWbsId) {
        const parentId = Number(curr.parentWbsId);
        if (visited.has(parentId) || parentId === Number(curr.id)) {
          return {
            status: 'BLOCKED',
            majorPackagesCount: 0,
            leafDeliverablesCount: 0,
            rootWeightSum: 0.0,
            message: 'Terdeteksi siklus/circular dependency pada hierarki WBS',
          };
        }
        visited.add(parentId);
        const parent = nodeMap.get(parentId);
        if (!parent) break;
        curr = parent;
      }
    }

    // 2. Identify major packages (Root / Level 1)
    const level1Nodes = activeNodes.filter(
      (n) => !n.parentWbsId || Number(n.level) === 1,
    );
    const majorPackagesCount = level1Nodes.length;

    // 3. Compute Root Weight Sum
    const rawRootSum = level1Nodes.reduce(
      (sum, n) => sum + Number(n.weightPercentage || 0),
      0,
    );
    const rootWeightSum = Math.round(rawRootSum * 100) / 100;
    const isWeightValid = Math.abs(rootWeightSum - 100) < 0.01;

    // 4. Identify Leaf Nodes (Nodes with no active children)
    const parentIdSet = new Set<number>();
    for (const n of activeNodes) {
      if (n.parentWbsId) {
        parentIdSet.add(Number(n.parentWbsId));
      }
    }
    const leafNodes = activeNodes.filter((n) => !parentIdSet.has(Number(n.id)));
    const leafDeliverablesCount = leafNodes.length;

    // 5. Evaluate final WBS status
    if (majorPackagesCount >= 1 && leafDeliverablesCount >= 1 && isWeightValid) {
      return {
        status: 'READY',
        majorPackagesCount,
        leafDeliverablesCount,
        rootWeightSum,
        message: `Struktur WBS seimbang (${majorPackagesCount} paket utama, ${leafDeliverablesCount} deliverable, bobot ${rootWeightSum.toFixed(2)}%)`,
      };
    }

    let reason = 'Struktur WBS belum lengkap';
    if (!isWeightValid) {
      reason = `Bobot Root WBS belum seimbang (${rootWeightSum.toFixed(2)}% dari target 100.00%)`;
    } else if (leafDeliverablesCount === 0) {
      reason = 'Belum ada leaf deliverable pada WBS';
    }

    return {
      status: 'IN_PROGRESS',
      majorPackagesCount,
      leafDeliverablesCount,
      rootWeightSum,
      message: reason,
    };
  }

  /**
   * Deterministically evaluates Cost / RAB readiness from active estimate and items.
   */
  public evaluateCostReadiness(
    estimate: ProjectCostEstimate | null,
    items: CostItem[] = [],
    activeWbsNodes: WorkBreakdownStructure[] = [],
  ): CostReadinessResult {
    if (!estimate || estimate.deletedAt) {
      return {
        status: 'NOT_STARTED',
        totalEstimate: 0.0,
        itemizedItemsCount: 0,
        unassignedItemsCount: 0,
        orphanedItemsCount: 0,
        message: 'Belum ada estimasi biaya (RAB) dibuat untuk proyek',
      };
    }

    const activeItems = (items || []).filter((i) => !i.deletedAt);
    const itemizedItemsCount = activeItems.length;

    if (activeItems.length === 0) {
      return {
        status: 'IN_PROGRESS',
        totalEstimate: 0.0,
        itemizedItemsCount: 0,
        unassignedItemsCount: 0,
        orphanedItemsCount: 0,
        message: 'Estimasi biaya belum memiliki rincian item biaya',
      };
    }

    // Build active WBS leaf and all IDs
    const activeWbs = (activeWbsNodes || []).filter((n) => !n.deletedAt);
    const parentIdSet = new Set<number>();
    const allWbsIdSet = new Set<number>();
    for (const n of activeWbs) {
      allWbsIdSet.add(Number(n.id));
      if (n.parentWbsId) {
        parentIdSet.add(Number(n.parentWbsId));
      }
    }
    const leafWbsIdSet = new Set<number>();
    for (const n of activeWbs) {
      if (!parentIdSet.has(Number(n.id))) {
        leafWbsIdSet.add(Number(n.id));
      }
    }

    let totalEstimate = 0.0;
    let unassignedItemsCount = 0;
    let orphanedItemsCount = 0;

    for (const item of activeItems) {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      const subtotal = Number(item.subtotal || 0);

      // Check math integrity
      if (qty < 0 || price < 0 || subtotal < 0) {
        return {
          status: 'BLOCKED',
          totalEstimate: 0.0,
          itemizedItemsCount,
          unassignedItemsCount: 0,
          orphanedItemsCount: 0,
          message: 'Terdapat nilai kuantitas atau harga satuan negatif pada item biaya',
        };
      }

      const expectedSubtotal = Math.round(qty * price * 100) / 100;
      if (Math.abs(subtotal - expectedSubtotal) > 0.05) {
        return {
          status: 'BLOCKED',
          totalEstimate: 0.0,
          itemizedItemsCount,
          unassignedItemsCount: 0,
          orphanedItemsCount: 0,
          message: 'Inkonsistensi kalkulasi matematis subtotal pada item biaya',
        };
      }

      totalEstimate += subtotal;

      // Scope verification
      if (item.wbsId) {
        const wbsIdNum = Number(item.wbsId);
        if (!allWbsIdSet.has(wbsIdNum) || !leafWbsIdSet.has(wbsIdNum)) {
          orphanedItemsCount++;
        }
      } else if (item.assignmentScope !== 'PROJECT_LEVEL' && item.assignmentScope !== 'PROJECT' && item.entryMode !== 'DIRECT') {
        unassignedItemsCount++;
      }
    }

    totalEstimate = Math.round(totalEstimate * 100) / 100;

    if (totalEstimate <= 0) {
      return {
        status: 'IN_PROGRESS',
        totalEstimate,
        itemizedItemsCount,
        unassignedItemsCount,
        orphanedItemsCount,
        message: 'Total estimasi biaya masih Rp 0',
      };
    }

    if (orphanedItemsCount > 0) {
      return {
        status: 'IN_PROGRESS',
        totalEstimate,
        itemizedItemsCount,
        unassignedItemsCount,
        orphanedItemsCount,
        message: `${orphanedItemsCount} item biaya merujuk ke WBS yang tidak valid atau bukan leaf node`,
      };
    }

    if (unassignedItemsCount > 0) {
      return {
        status: 'IN_PROGRESS',
        totalEstimate,
        itemizedItemsCount,
        unassignedItemsCount,
        orphanedItemsCount,
        message: `${unassignedItemsCount} item biaya belum ditentukan alokasi scope/WBS`,
      };
    }

    return {
      status: 'READY',
      totalEstimate,
      itemizedItemsCount,
      unassignedItemsCount,
      orphanedItemsCount,
      message: `Estimasi biaya siap (Rp ${totalEstimate.toLocaleString('id-ID')}, ${itemizedItemsCount} item terpetakan)`,
    };
  }

  /**
   * Deterministically evaluates Schedule / Gantt readiness from active tasks and WBS nodes.
   */
  public evaluateScheduleReadiness(
    tasks: Task[] = [],
    activeWbsNodes: WorkBreakdownStructure[] = [],
  ): ScheduleReadinessResult {
    const activeTasks = (tasks || []).filter((t) => !t.deletedAt);
    const activeWbs = (activeWbsNodes || []).filter((n) => !n.deletedAt);

    // Compute leaf WBS nodes
    const parentIdSet = new Set<number>();
    for (const n of activeWbs) {
      if (n.parentWbsId) {
        parentIdSet.add(Number(n.parentWbsId));
      }
    }
    const leafNodes = activeWbs.filter((n) => !parentIdSet.has(Number(n.id)));
    const leafDeliverablesCount = leafNodes.length;
    const leafWbsIdSet = new Set<number>(leafNodes.map((n) => Number(n.id)));

    if (activeTasks.length === 0) {
      return {
        status: 'NOT_STARTED',
        totalTasks: 0,
        leafDeliverablesCount,
        scheduledDeliverablesCount: 0,
        hasCircularDependencies: false,
        message: 'Belum ada jadwal pekerjaan terdaftar untuk proyek',
      };
    }

    const totalTasks = activeTasks.length;
    const taskMap = new Map<number, Task>();
    for (const t of activeTasks) {
      taskMap.set(Number(t.id), t);
    }

    // 1. Detect circular predecessor dependencies
    for (const t of activeTasks) {
      const visited = new Set<number>();
      let curr = t;
      while (curr.predecessorTaskId) {
        const predId = Number(curr.predecessorTaskId);
        if (visited.has(predId) || predId === Number(curr.id)) {
          return {
            status: 'BLOCKED',
            totalTasks,
            leafDeliverablesCount,
            scheduledDeliverablesCount: 0,
            hasCircularDependencies: true,
            message: 'Terdeteksi siklus/circular dependency pada ketergantungan tugas (predecessor)',
          };
        }
        visited.add(predId);
        const pred = taskMap.get(predId);
        if (!pred) break;
        curr = pred;
      }
    }

    // 2. Validate predecessor existence & Finish-to-Start chronology
    let hasIncompleteDates = false;
    for (const t of activeTasks) {
      const isMilestone = Boolean(t.isMilestone);

      if (isMilestone) {
        if (!isValidIsoDate(t.startDate)) {
          hasIncompleteDates = true;
        }
      } else {
        if (!isValidIsoDate(t.startDate) || !isValidIsoDate(t.endDate)) {
          hasIncompleteDates = true;
        } else if (String(t.endDate) < String(t.startDate)) {
          return {
            status: 'BLOCKED',
            totalTasks,
            leafDeliverablesCount,
            scheduledDeliverablesCount: 0,
            hasCircularDependencies: false,
            message: `Task "${t.name}" memiliki tanggal selesai sebelum tanggal mulai`,
          };
        }
      }

      if (t.predecessorTaskId) {
        const pred = taskMap.get(Number(t.predecessorTaskId));
        if (!pred) {
          return {
            status: 'BLOCKED',
            totalTasks,
            leafDeliverablesCount,
            scheduledDeliverablesCount: 0,
            hasCircularDependencies: false,
            message: `Task "${t.name}" merujuk ke predecessor ID #${t.predecessorTaskId} yang tidak valid`,
          };
        }

        const predFinish = pred.isMilestone ? pred.startDate : pred.endDate;
        if (t.startDate && predFinish && String(t.startDate) < String(predFinish)) {
          return {
            status: 'BLOCKED',
            totalTasks,
            leafDeliverablesCount,
            scheduledDeliverablesCount: 0,
            hasCircularDependencies: false,
            message: `Pelanggaran dependensi Finish-to-Start: Task "${t.name}" (${t.startDate}) mulai sebelum predecessor selesai (${predFinish})`,
          };
        }
      }
    }

    // 3. Compute covered leaf deliverables
    const coveredLeafSet = new Set<number>();
    for (const t of activeTasks) {
      if (t.wbsId && leafWbsIdSet.has(Number(t.wbsId))) {
        // Must have valid dates to count as scheduled
        const hasValidDate = t.isMilestone
          ? isValidIsoDate(t.startDate)
          : isValidIsoDate(t.startDate) && isValidIsoDate(t.endDate);
        if (hasValidDate) {
          coveredLeafSet.add(Number(t.wbsId));
        }
      }
    }
    const scheduledDeliverablesCount = coveredLeafSet.size;

    if (
      leafDeliverablesCount > 0 &&
      scheduledDeliverablesCount >= leafDeliverablesCount &&
      !hasIncompleteDates
    ) {
      return {
        status: 'READY',
        totalTasks,
        leafDeliverablesCount,
        scheduledDeliverablesCount,
        hasCircularDependencies: false,
        message: `Seluruh ${leafDeliverablesCount} deliverable terjadwal valid (${totalTasks} tasks)`,
      };
    }

    let reason = 'Jadwal proyek belum lengkap';
    if (leafDeliverablesCount === 0) {
      reason = 'WBS belum memiliki leaf deliverable untuk dijadwalkan';
    } else if (scheduledDeliverablesCount < leafDeliverablesCount) {
      reason = `${leafDeliverablesCount - scheduledDeliverablesCount} dari ${leafDeliverablesCount} leaf deliverable belum memiliki jadwal lengkap`;
    } else if (hasIncompleteDates) {
      reason = 'Sebagian task belum memiliki tanggal mulai/selesai yang valid';
    }

    return {
      status: 'IN_PROGRESS',
      totalTasks,
      leafDeliverablesCount,
      scheduledDeliverablesCount,
      hasCircularDependencies: false,
      message: reason,
    };
  }

  /**
   * Deterministically evaluates Initial Condition readiness from active database record.
   */
  public evaluateInitialConditionReadiness(
    record: ProjectInitialCondition | null,
  ): InitialConditionReadinessResult {
    if (!record || record.deletedAt) {
      return {
        status: 'NOT_STARTED',
        conditionStatus: null,
        isComplete: false,
        message: 'Belum ada data baseline kondisi awal di database',
      };
    }

    const isComplete = Boolean(
      record.conditionStatus &&
      record.locationCondition &&
      record.locationCondition.trim().length > 0 &&
      record.initialConstraints &&
      record.initialConstraints.trim().length > 0 &&
      record.initialRisks &&
      record.initialRisks.trim().length > 0,
    );

    if (isComplete) {
      return {
        status: 'READY',
        conditionStatus: record.conditionStatus,
        isComplete: true,
        message: `Baseline kondisi awal siap (${record.conditionStatus})`,
      };
    }

    return {
      status: 'IN_PROGRESS',
      conditionStatus: record.conditionStatus || null,
      isComplete: false,
      message: 'Data baseline kondisi awal belum lengkap (sebagian field wajib masih kosong)',
    };
  }

  /**
   * Deterministically evaluates Procurement Gate / Management Review from active database record.
   */
  public evaluateManagementReview(
    review: ProjectManagementReview | null,
  ): ProcurementGateReadinessResult {
    if (!review || review.deletedAt) {
      return {
        status: 'NOT_SUBMITTED',
        submittedAt: null,
        submittedBy: null,
        submittedByName: null,
        decidedAt: null,
        decidedBy: null,
        decidedByName: null,
        revisionNotes: null,
      };
    }

    return {
      status: (review.status as any) || 'NOT_SUBMITTED',
      submittedAt: review.submittedAt
        ? new Date(review.submittedAt).toISOString()
        : null,
      submittedBy: review.submittedBy ? String(review.submittedBy) : null,
      submittedByName: review.submitter?.fullName || null,
      decidedAt: review.decidedAt ? new Date(review.decidedAt).toISOString() : null,
      decidedBy:
        review.reviewerRole || (review.decidedBy ? String(review.decidedBy) : null),
      decidedByName: review.decider?.fullName || null,
      revisionNotes: review.revisionNotes || null,
    };
  }

  /**
   * Evaluates canonical post-revision persistence:
   * Proves that at least one legitimate plan artifact (Cost, WBS, Schedule, Initial Condition)
   * was modified and saved strictly AFTER the current revision request timestamp.
   *
   * - Non-revision workflow -> true (not in revision mode)
   * - Revision workflow with post-return save -> true
   * - Revision workflow with NO post-return save -> false
   */
  public evaluateRevisionPersistence(
    managementReview: ProjectManagementReview | null,
    activeInstance: any | null,
    wbsNodes: WorkBreakdownStructure[] = [],
    estimate: ProjectCostEstimate | null = null,
    costItems: CostItem[] = [],
    tasks: Task[] = [],
    initialCondition: ProjectInitialCondition | null = null,
  ): boolean {
    const isRevisionWorkflow = Boolean(
      (activeInstance &&
        typeof activeInstance.currentNodeId === 'string' &&
        activeInstance.currentNodeId.startsWith('node_pm_revision')) ||
      managementReview?.status === 'NEEDS_REVISION',
    );

    if (!isRevisionWorkflow) {
      return true;
    }

    const toEpochMs = (val: any): number | null => {
      if (!val) return null;
      if (val instanceof Date) {
        const t = val.getTime();
        return isNaN(t) ? null : t;
      }
      if (typeof val === 'number') {
        return isNaN(val) ? null : val;
      }
      if (typeof val === 'string') {
        const d = new Date(val);
        const t = d.getTime();
        return isNaN(t) ? null : t;
      }
      return null;
    };

    let revisionRequestedAtMs: number | null = null;

    if (managementReview?.status === 'NEEDS_REVISION' && managementReview.decidedAt) {
      const decMs = toEpochMs(managementReview.decidedAt);
      if (decMs !== null) {
        revisionRequestedAtMs = decMs;
      }
    }

    if (activeInstance) {
      // 1. Check return transitions
      const transitions = Array.isArray(activeInstance.transitions) ? activeInstance.transitions : [];
      for (const tr of transitions) {
        if (
          tr.action === 'RETURN' ||
          (typeof tr.toNodeId === 'string' && tr.toNodeId.startsWith('node_pm_revision'))
        ) {
          const trMs = toEpochMs(tr.createdAt);
          if (trMs !== null && (revisionRequestedAtMs === null || trMs > revisionRequestedAtMs)) {
            revisionRequestedAtMs = trMs;
          }
        }
      }

      // 2. Check pending revision task creation or returned task decision
      const tasksArr = Array.isArray(activeInstance.tasks) ? activeInstance.tasks : [];
      for (const t of tasksArr) {
        if (
          typeof t.nodeId === 'string' &&
          t.nodeId.startsWith('node_pm_revision') &&
          t.status === 'PENDING'
        ) {
          const taskCreateMs = toEpochMs(t.createdAt);
          if (taskCreateMs !== null && (revisionRequestedAtMs === null || taskCreateMs > revisionRequestedAtMs)) {
            revisionRequestedAtMs = taskCreateMs;
          }
        }
        if (
          (t.action === 'RETURN' || t.status === 'RETURNED') &&
          t.decidedAt
        ) {
          const taskDecMs = toEpochMs(t.decidedAt);
          if (taskDecMs !== null && (revisionRequestedAtMs === null || taskDecMs > revisionRequestedAtMs)) {
            revisionRequestedAtMs = taskDecMs;
          }
        }
      }
    }

    // Fallback: If managementReview is NEEDS_REVISION but has no decidedAt, check updatedAt
    if (revisionRequestedAtMs === null && managementReview?.status === 'NEEDS_REVISION') {
      const revUpdatedMs = toEpochMs(managementReview.updatedAt);
      if (revUpdatedMs !== null) {
        revisionRequestedAtMs = revUpdatedMs;
      }
    }

    // If in revision workflow but no return timestamp can be established: fail closed (false)
    if (revisionRequestedAtMs === null) {
      return false;
    }

    let latestPlanChangeMs: number | null = null;

    const considerTimestamp = (val: any) => {
      const ms = toEpochMs(val);
      if (ms !== null) {
        if (latestPlanChangeMs === null || ms > latestPlanChangeMs) {
          latestPlanChangeMs = ms;
        }
      }
    };

    // 1. Cost Estimate header & items
    if (estimate) {
      considerTimestamp(estimate.updatedAt);
      considerTimestamp(estimate.createdAt);
    }
    for (const item of costItems || []) {
      considerTimestamp(item.updatedAt);
      considerTimestamp(item.createdAt);
    }

    // 2. WBS nodes
    for (const w of wbsNodes || []) {
      considerTimestamp(w.updatedAt);
      considerTimestamp(w.createdAt);
    }

    // 3. Schedule tasks
    for (const t of tasks || []) {
      considerTimestamp(t.updatedAt);
      considerTimestamp(t.createdAt);
    }

    // 4. Initial Condition
    if (initialCondition) {
      considerTimestamp(initialCondition.updatedAt);
      considerTimestamp(initialCondition.createdAt);
    }

    if (latestPlanChangeMs === null) {
      return false;
    }

    return latestPlanChangeMs > revisionRequestedAtMs;
  }

  /**
   * Deterministically aggregates 4 technical pillars and derives overall readiness.
   */
  public aggregateReadiness(
    projectId: number,
    projectCode: string,
    projectName: string,
    wbsRes: WbsReadinessResult,
    costRes: CostReadinessResult,
    scheduleRes: ScheduleReadinessResult,
    initialConditionRes?: InitialConditionReadinessResult,
    gateRes?: ProcurementGateReadinessResult,
    hasPersistedRevisionAfterReturn?: boolean,
  ): OperationalReadinessData {
    const finalInitialConditionRes: InitialConditionReadinessResult =
      initialConditionRes || {
        status: 'NOT_STARTED',
        conditionStatus: null,
        isComplete: false,
        message: 'Belum ada data baseline di database (menunggu persistensi R11.1.5-C)',
      };

    const finalGateRes: ProcurementGateReadinessResult = gateRes || {
      status: 'NOT_SUBMITTED',
      submittedAt: null,
      submittedBy: null,
      submittedByName: null,
      decidedAt: null,
      decidedBy: null,
      decidedByName: null,
      revisionNotes: null,
    };

    const pillarStatuses = [
      wbsRes.status,
      costRes.status,
      scheduleRes.status,
      finalInitialConditionRes.status,
    ];

    const hasBlocked = pillarStatuses.some((s) => s === 'BLOCKED');
    const completenessCount = pillarStatuses.filter((s) => s === 'READY').length;
    const totalPillars = 4;

    let overallStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'BLOCKED' =
      'NOT_STARTED';
    if (hasBlocked) {
      overallStatus = 'BLOCKED';
    } else if (completenessCount === 4) {
      overallStatus = 'READY';
    } else if (completenessCount > 0) {
      overallStatus = 'IN_PROGRESS';
    } else {
      overallStatus = 'NOT_STARTED';
    }

    // canSubmitForReview: True only if 4 technical pillars READY AND gate status allows submission
    const isGateSubmittable =
      finalGateRes.status === 'NOT_SUBMITTED' ||
      finalGateRes.status === 'NEEDS_REVISION';
    const canSubmitForReview = overallStatus === 'READY' && isGateSubmittable;

    // canCreatePr: True ONLY when Management Review Gate status is READY_FOR_PROCUREMENT
    const canCreatePr = finalGateRes.status === 'READY_FOR_PROCUREMENT';

    const resolvedHasPersistedRevision =
      hasPersistedRevisionAfterReturn !== undefined
        ? hasPersistedRevisionAfterReturn
        : finalGateRes.hasPersistedRevisionAfterReturn !== undefined
          ? finalGateRes.hasPersistedRevisionAfterReturn
          : true;

    finalGateRes.hasPersistedRevisionAfterReturn = resolvedHasPersistedRevision;

    return {
      projectId,
      projectCode,
      projectName,
      overallStatus,
      completenessCount,
      totalPillars,
      canSubmitForReview,
      canCreatePr,
      pillars: {
        wbs: wbsRes,
        cost: costRes,
        schedule: scheduleRes,
        initialCondition: finalInitialConditionRes,
      },
      gate: finalGateRes,
      hasPersistedRevisionAfterReturn: resolvedHasPersistedRevision,
    };
  }
}
