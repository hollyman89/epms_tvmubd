import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SaveProjectScheduleDto,
  TaskItemDto,
  TASK_STATUSES,
} from './dto/save-project-schedule.dto';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';

export interface ValidatedTaskResult {
  id?: number;
  projectId: number;
  wbsId: number;
  name: string;
  isMilestone: boolean;
  startDate?: string | null;
  endDate?: string | null;
  duration: number;
  predecessorTaskId?: number | null;
  predecessorWbsCode?: string;
  dependencyType: string;
  progress: number;
  status: string;
  assigneeId?: number | null;
  // Readonly presentation helpers
  wbsCode?: string;
  wbsName?: string;
}

export interface WbsTaskSummaryItem {
  wbsId: number;
  wbsCode: string;
  wbsName: string;
  taskCount: number;
  earliestStart?: string | null;
  latestEnd?: string | null;
}

export interface ScheduleSummary {
  earliestStart: string | null;
  latestEnd: string | null;
  totalDuration: number;
  totalTaskCount: number;
  scheduledTaskCount: number;
  milestoneCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ValidatedScheduleCalculation {
  projectId: number;
  pmNotes?: string;
  tasks: ValidatedTaskResult[];
  summary: ScheduleSummary;
  wbsTaskSummary: WbsTaskSummaryItem[];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(str: string): boolean {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !isNaN(d.getTime()) && str === d.toISOString().slice(0, 10);
}

function calculateDaysDifference(startStr: string, endStr: string): number {
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class ScheduleValidator {
  /**
   * Validates SaveProjectScheduleDto authoritatively:
   * - Enforces project isolation and WBS ownership
   * - Enforces WBS leaf node restriction
   * - Enforces date ordering (startDate <= endDate)
   * - Server-derives duration (0 for milestone, end - start for task)
   * - Validates Finish-to-Start (FS) dependencies and prevents circular cycles
   * - Validates predecessor date rule (task.startDate >= predecessor.endDate)
   * - Validates task ownership for updates
   */
  public validateAndCompute(
    projectId: number,
    dto: SaveProjectScheduleDto,
    activeWbsNodes: WorkBreakdownStructure[] = [],
    activeProjectTasks: Task[] = [],
    allUsers: User[] = [],
  ): ValidatedScheduleCalculation {
    if (!projectId || projectId <= 0) {
      throw new BadRequestException('Project ID tidak valid');
    }

    if (!dto || !Array.isArray(dto.tasks)) {
      throw new BadRequestException(
        'Daftar tasks tidak boleh kosong atau harus berupa array.',
      );
    }

    // 1. Index WBS nodes and identify parent nodes
    const wbsMap = new Map<number, WorkBreakdownStructure>();
    const wbsByCodeMap = new Map<string, WorkBreakdownStructure>();
    const parentWbsIds = new Set<number>();
    for (const wbs of activeWbsNodes) {
      if (Number(wbs.projectId) === Number(projectId)) {
        wbsMap.set(Number(wbs.id), wbs);
        if (wbs.code) {
          wbsByCodeMap.set(wbs.code.trim(), wbs);
        }
        if (wbs.parentWbsId) {
          parentWbsIds.add(Number(wbs.parentWbsId));
        }
      }
    }

    // 2. Index active project tasks and global tasks for ID ownership checks
    const globalTaskMap = new Map<number, Task>();
    const existingTaskMap = new Map<number, Task>();
    for (const t of activeProjectTasks) {
      globalTaskMap.set(Number(t.id), t);
      if (Number(t.projectId) === Number(projectId) && !t.deletedAt) {
        existingTaskMap.set(Number(t.id), t);
      }
    }

    // 3. Index users for assignee validation
    const userMap = new Set<number>();
    for (const u of allUsers) {
      userMap.add(Number(u.id));
    }

    const validatedTasks: ValidatedTaskResult[] = [];
    const payloadTaskMapByWbsId = new Map<number, TaskItemDto>();
    const payloadTaskMapById = new Map<number, TaskItemDto>();
    const seenTaskIds = new Set<number>();

    // Initial pass: validate basic fields and map payload
    for (let i = 0; i < dto.tasks.length; i++) {
      const item = dto.tasks[i];
      const itemIndex = i + 1;

      // Validate duplicate task ID in payload
      if (item.id !== undefined && item.id !== null) {
        const taskId = Number(item.id);
        if (seenTaskIds.has(taskId)) {
          throw new BadRequestException(
            `Payload mengandung duplikasi Task ID #${taskId}. Setiap task dalam payload harus memiliki ID unik.`,
          );
        }
        seenTaskIds.add(taskId);
      }

      // Validate WBS ID
      if (!item.wbsId || isNaN(Number(item.wbsId))) {
        throw new BadRequestException(
          `Task #${itemIndex} ("${item.name || 'Unnamed'}"): wbsId wajib diisi.`,
        );
      }

      const wbsId = Number(item.wbsId);
      const wbs = wbsMap.get(wbsId);
      if (!wbs) {
        throw new BadRequestException(
          `Task #${itemIndex}: WBS ID #${wbsId} tidak ditemukan atau bukan milik proyek #${projectId}.`,
        );
      }

      if (parentWbsIds.has(wbsId)) {
        throw new BadRequestException(
          `Task #${itemIndex}: WBS [${wbs.code}] "${wbs.name}" bukan leaf node. Penjadwalan hanya diizinkan pada level deliverable terbawah.`,
        );
      }

      // Validate Name
      if (!item.name || item.name.trim().length === 0) {
        throw new BadRequestException(
          `Task #${itemIndex}: Nama aktivitas / deliverable tidak boleh kosong.`,
        );
      }

      // Validate Task ID ownership if updating existing
      if (item.id !== undefined && item.id !== null) {
        const taskId = Number(item.id);
        if (!existingTaskMap.has(taskId)) {
          throw new BadRequestException(
            `Task #${itemIndex}: Task ID #${taskId} tidak ditemukan pada proyek #${projectId} atau sudah dihapus.`,
          );
        }
      }

      // Validate Milestone flag
      let isMilestone = false;
      if (item.type) {
        isMilestone = item.type === 'MILESTONE';
      } else if (item.isMilestone !== undefined) {
        isMilestone = Boolean(item.isMilestone);
      }

      // Validate Dates & Calculate Server-Authoritative Duration
      let startDateStr: string | null = null;
      let endDateStr: string | null = null;
      let calculatedDuration = 0;

      if (item.startDate) {
        if (!isValidIsoDate(item.startDate)) {
          throw new BadRequestException(
            `Task #${itemIndex}: Format startDate "${item.startDate}" tidak valid. Gunakan YYYY-MM-DD.`,
          );
        }
        startDateStr = item.startDate;
      }

      if (isMilestone) {
        // Milestone rules: point in time event, startDate required, no endDate, duration = 0
        if (!startDateStr) {
          throw new BadRequestException(
            `Task #${itemIndex} ("${item.name}"): Milestone wajib memiliki startDate.`,
          );
        }
        endDateStr = null;
        calculatedDuration = 0;
      } else {
        // Regular Task rules
        if (item.endDate) {
          if (!isValidIsoDate(item.endDate)) {
            throw new BadRequestException(
              `Task #${itemIndex}: Format endDate "${item.endDate}" tidak valid. Gunakan YYYY-MM-DD.`,
            );
          }
          endDateStr = item.endDate;
        }

        if (startDateStr && endDateStr) {
          if (endDateStr < startDateStr) {
            throw new BadRequestException(
              `Task #${itemIndex} ("${item.name}"): Tanggal selesai (${endDateStr}) tidak boleh sebelum tanggal mulai (${startDateStr}).`,
            );
          }
          // Server authoritative duration calculation
          calculatedDuration = calculateDaysDifference(startDateStr, endDateStr);
        } else {
          calculatedDuration = 0;
        }
      }

      // Validate Progress
      let progress = 0.0;
      if (item.progress !== undefined && item.progress !== null) {
        const p = Number(item.progress);
        if (isNaN(p) || p < 0 || p > 100) {
          throw new BadRequestException(
            `Task #${itemIndex}: Nilai progress harus antara 0.00 dan 100.00. Diterima: ${item.progress}`,
          );
        }
        progress = Math.round((p + Number.EPSILON) * 100) / 100;
      }

      // Validate Status
      let status = 'PLANNED';
      if (item.status) {
        const s = item.status.trim().toUpperCase();
        if (!(TASK_STATUSES as readonly string[]).includes(s)) {
          throw new BadRequestException(
            `Task #${itemIndex}: Status "${item.status}" tidak valid. Status yang diizinkan: ${TASK_STATUSES.join(', ')}`,
          );
        }
        status = s;
      }

      // Validate Assignee if provided
      let assigneeId: number | null = null;
      if (item.assigneeId !== undefined && item.assigneeId !== null) {
        const aId = Number(item.assigneeId);
        if (userMap.size > 0 && !userMap.has(aId)) {
          throw new BadRequestException(
            `Task #${itemIndex}: Assignee user ID #${aId} tidak ditemukan di database.`,
          );
        }
        assigneeId = aId;
      }

      // Validate Dependency Type
      const depType = item.dependencyType ? item.dependencyType.trim().toUpperCase() : 'FS';
      if (depType !== 'FS') {
        throw new BadRequestException(
          `Task #${itemIndex}: dependencyType "${item.dependencyType}" tidak didukung. Saat ini hanya tipe "FS" yang diizinkan.`,
        );
      }

      // Self-predecessor check
      const predTaskId: number | null = item.predecessorTaskId ? Number(item.predecessorTaskId) : null;
      const predWbsCode: string | undefined = item.predecessorWbsCode ? item.predecessorWbsCode.trim() : undefined;

      if (item.id && predTaskId && Number(item.id) === predTaskId) {
        throw new BadRequestException(
          `Task #${itemIndex} ("${item.name}"): Task tidak boleh menjadi predecessor untuk dirinya sendiri.`,
        );
      }

      validatedTasks.push({
        id: item.id ? Number(item.id) : undefined,
        projectId,
        wbsId,
        name: item.name.trim(),
        isMilestone,
        startDate: startDateStr,
        endDate: endDateStr,
        duration: calculatedDuration,
        predecessorTaskId: predTaskId,
        predecessorWbsCode: predWbsCode,
        dependencyType: 'FS',
        progress,
        status,
        assigneeId,
        wbsCode: wbs.code,
        wbsName: wbs.name,
      });

      payloadTaskMapByWbsId.set(wbsId, item);
      if (item.id) {
        payloadTaskMapById.set(Number(item.id), item);
      }
    }

    // 4. Predecessor Integrity & Circular Dependency Check
    const taskMapById = new Map<number, ValidatedTaskResult>();
    for (const t of validatedTasks) {
      if (t.id) taskMapById.set(t.id, t);
    }

    // First: Verify Predecessor exists and belongs to this project
    for (let i = 0; i < validatedTasks.length; i++) {
      const task = validatedTasks[i];
      if (!task.predecessorTaskId) continue;

      const predId = task.predecessorTaskId;
      const pred = taskMapById.get(predId) || existingTaskMap.get(predId);

      if (!pred) {
        if (globalTaskMap.has(predId)) {
          const globalPred = globalTaskMap.get(predId)!;
          if (Number(globalPred.projectId) !== Number(projectId)) {
            throw new BadRequestException(
              `Task "${task.name}": Predecessor Task #${predId} bukan milik proyek #${projectId}.`,
            );
          }
          if (globalPred.deletedAt) {
            throw new BadRequestException(
              `Task "${task.name}": Predecessor Task #${predId} sudah dihapus (soft-deleted) dan tidak dapat dijadikan acuan dependensi.`,
            );
          }
        }
        throw new BadRequestException(
          `Task "${task.name}": Predecessor Task ID #${predId} tidak ditemukan pada proyek #${projectId}.`,
        );
      }

      if (Number(pred.projectId) !== Number(projectId)) {
        throw new BadRequestException(
          `Task "${task.name}": Predecessor Task #${predId} bukan milik proyek #${projectId}.`,
        );
      }
    }

    // Second: Detect Circular Dependencies in the Graph (Topological cycle check)
    for (const task of validatedTasks) {
      const currentPath = new Set<number>();
      let curr: ValidatedTaskResult | undefined = task;

      while (curr && curr.predecessorTaskId) {
        const currKey = curr.id || curr.wbsId;
        if (currentPath.has(currKey)) {
          throw new BadRequestException(
            `Dependensi task membentuk siklus (circular dependency) yang melibatkan task "${task.name}" (${task.wbsCode}).`,
          );
        }
        currentPath.add(currKey);

        const predId = curr.predecessorTaskId;
        curr = taskMapById.get(predId);
      }
    }

    // Third: Validate Finish-to-Start (FS) Date Rules
    for (let i = 0; i < validatedTasks.length; i++) {
      const task = validatedTasks[i];
      if (!task.predecessorTaskId) continue;

      const predId = task.predecessorTaskId;
      const pred = taskMapById.get(predId) || existingTaskMap.get(predId);
      if (!pred) continue;

      // task.startDate >= predecessor.endDate (or pred.startDate if pred is milestone)
      const predEffectiveEnd = pred.isMilestone ? pred.startDate : (pred.endDate || pred.startDate);
      if (task.startDate && predEffectiveEnd) {
        if (task.startDate < predEffectiveEnd) {
          throw new BadRequestException(
            `Task "${task.name}" (${task.wbsCode}) dimulai (${task.startDate}) sebelum predecessor (${(pred as any).wbsCode || pred.name}) selesai (${predEffectiveEnd}).`,
          );
        }
      }
    }

    // 5. Calculate Derived Project Summary
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    let scheduledCount = 0;
    let milestoneCount = 0;

    for (const t of validatedTasks) {
      if (t.isMilestone) {
        milestoneCount++;
        if (t.startDate) {
          scheduledCount++;
          const d = t.startDate;
          if (!minStart || d < minStart) minStart = d;
          if (!maxEnd || d > maxEnd) maxEnd = d;
        }
      } else {
        if (t.startDate && t.endDate) {
          scheduledCount++;
          if (!minStart || t.startDate < minStart) minStart = t.startDate;
          if (!maxEnd || t.endDate > maxEnd) maxEnd = t.endDate;
        }
      }
    }

    const totalProjectDuration =
      minStart && maxEnd ? calculateDaysDifference(minStart, maxEnd) : 0;

    // 6. Build WBS Task Summary
    const wbsSummaryMap = new Map<number, WbsTaskSummaryItem>();
    for (const t of validatedTasks) {
      let wSummary = wbsSummaryMap.get(t.wbsId);
      if (!wSummary) {
        wSummary = {
          wbsId: t.wbsId,
          wbsCode: t.wbsCode || '',
          wbsName: t.wbsName || '',
          taskCount: 0,
          earliestStart: null,
          latestEnd: null,
        };
        wbsSummaryMap.set(t.wbsId, wSummary);
      }

      wSummary.taskCount++;
      const tStart = t.startDate;
      const tEnd = t.isMilestone ? tStart : t.endDate;

      if (tStart) {
        if (!wSummary.earliestStart || tStart < wSummary.earliestStart) {
          wSummary.earliestStart = tStart;
        }
      }
      if (tEnd) {
        if (!wSummary.latestEnd || tEnd > wSummary.latestEnd) {
          wSummary.latestEnd = tEnd;
        }
      }
    }

    return {
      projectId,
      pmNotes: dto.pmNotes ? dto.pmNotes.trim() : undefined,
      tasks: validatedTasks,
      summary: {
        earliestStart: minStart,
        latestEnd: maxEnd,
        totalDuration: totalProjectDuration,
        totalTaskCount: validatedTasks.length,
        scheduledTaskCount: scheduledCount,
        milestoneCount,
        errorCount: 0,
        warningCount: 0,
      },
      wbsTaskSummary: Array.from(wbsSummaryMap.values()),
    };
  }
}
