import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import AppDataSource from '../../src/data-source';
import { Task } from '../../src/entities/task.entity';
import { ProjectProgressLog } from '../../src/entities/project-progress-log.entity';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export async function runBackfill(ds?: DataSource) {
  let ownsDataSource = false;
  let dataSource = ds;

  if (!dataSource) {
    ownsDataSource = true;
    dataSource = AppDataSource;
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  }

  const taskRepo = dataSource.getRepository(Task);
  const logRepo = dataSource.getRepository(ProjectProgressLog);

  const tasks = await taskRepo.find({ order: { id: 'ASC' } });
  const officialLogs = await logRepo.find({
    where: { status: 'OFFICIAL' },
    order: { task_id: 'ASC', id: 'ASC' },
  });

  const logsByTaskId = new Map<number, ProjectProgressLog[]>();
  for (const log of officialLogs) {
    const tId = Number(log.task_id);
    let list = logsByTaskId.get(tId);
    if (!list) {
      list = [];
      logsByTaskId.set(tId, list);
    }
    list.push(log);
  }

  let backfilledStartCount = 0;
  let backfilledFinishCount = 0;
  let leftNullCount = 0;
  const auditDetails: Array<{
    taskId: number;
    projectId: number;
    name: string;
    progress: number;
    status: string;
    actualStartAt: Date | null;
    actualFinishAt: Date | null;
    reason: string;
  }> = [];

  for (const task of tasks) {
    const logs = logsByTaskId.get(Number(task.id)) || [];
    let targetStart: Date | null = null;
    let targetFinish: Date | null = null;
    let reason = 'NO_OFFICIAL_LEDGER_EVIDENCE';

    // R2-22: Replay official progress history chronologically to find first point where OFFICIAL progress became > 0
    for (const log of logs) {
      const p = Number(log.reported_progress ?? 0);
      if (p > 0) {
        targetStart = log.created_at;
        reason = `PROVEN_START_FROM_LOG_${log.id}`;
        break;
      }
    }

    // R2-23: Only populate actual_finish_at if current state is progress = 100 AND status = COMPLETED
    const isCompleted = Number(task.progress) === 100 && task.status === 'COMPLETED';
    if (isCompleted) {
      let latestCompletionDate: Date | null = null;
      let lastProgress = 0;
      for (const log of logs) {
        const p = Number(log.reported_progress ?? 0);
        if (p === 100) {
          latestCompletionDate = log.created_at;
        } else if (p < 100) {
          latestCompletionDate = null;
        }
        lastProgress = p;
      }
      if (lastProgress === 100 && latestCompletionDate) {
        targetFinish = latestCompletionDate;
        reason += `_AND_PROVEN_COMPLETION`;
      }
    }

    let modified = false;
    if (targetStart && !task.actualStartAt) {
      task.actualStartAt = targetStart;
      backfilledStartCount++;
      modified = true;
    }
    if (targetFinish && !task.actualFinishAt) {
      task.actualFinishAt = targetFinish;
      backfilledFinishCount++;
      modified = true;
    }

    if (modified) {
      await taskRepo.update(task.id, {
        actualStartAt: task.actualStartAt,
        actualFinishAt: task.actualFinishAt,
      });
    }

    if (!task.actualStartAt && !task.actualFinishAt) {
      leftNullCount++;
    }

    auditDetails.push({
      taskId: task.id,
      projectId: task.projectId,
      name: task.name,
      progress: Number(task.progress),
      status: task.status,
      actualStartAt: task.actualStartAt,
      actualFinishAt: task.actualFinishAt,
      reason,
    });
  }

  if (ownsDataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }

  return {
    totalTasks: tasks.length,
    backfilledStartCount,
    backfilledFinishCount,
    leftNullCount,
    auditDetails,
  };
}

if (require.main === module) {
  runBackfill()
    .then((res) => {
      console.log('--- BACKFILL RESULTS ---');
      console.log(`Total tasks evaluated: ${res.totalTasks}`);
      console.log(`Backfilled actual_start_at: ${res.backfilledStartCount}`);
      console.log(`Backfilled actual_finish_at: ${res.backfilledFinishCount}`);
      console.log(`Left NULL (unprovable): ${res.leftNullCount}`);
      console.log('------------------------');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backfill error:', err);
      process.exit(1);
    });
}
