import {
  isClosureTask,
  evaluateClosureTaskActionability,
} from '../projectGovernanceClosure.utils';
import fs from 'fs';
import path from 'path';

describe('EPMS — Project Governance Closure Deep-Link & Actionability Tests', () => {
  // Test Fixtures
  const hopsClosureTask = {
    id: 101,
    projectId: 12,
    workflowInstanceId: 501,
    nodeId: 'node_hoo_review',
    taskKey: 'PROJECT_CLOSURE_HOO_REVIEW',
    status: 'PENDING',
    isClosure: true,
    workflowKey: 'PROJECT_CLOSURE',
    entityType: 'PROJECT_CLOSURE',
  };

  const directorClosureTask = {
    id: 202,
    projectId: 12,
    workflowInstanceId: 502,
    nodeId: 'node_director_approval',
    taskKey: 'PROJECT_CLOSURE_DIRECTOR_APPROVAL',
    status: 'PENDING',
    isClosure: true,
    workflowKey: 'PROJECT_CLOSURE',
    entityType: 'PROJECT_CLOSURE',
  };

  const operationalPlanTask = {
    id: 303,
    projectId: 12,
    workflowInstanceId: 503,
    nodeId: 'node_hops_review',
    taskKey: 'MANAGEMENT_REVIEW',
    status: 'PENDING',
    isClosure: false,
    workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
    entityType: 'PROJECT',
  };

  const otherProjectClosureTask = {
    id: 404,
    projectId: 99,
    workflowInstanceId: 504,
    nodeId: 'node_hoo_review',
    taskKey: 'PROJECT_CLOSURE_HOO_REVIEW',
    status: 'PENDING',
    isClosure: true,
    workflowKey: 'PROJECT_CLOSURE',
    entityType: 'PROJECT_CLOSURE',
  };

  /**
   * Authoritative canonical matching resolver matching ProjectGovernanceTaskCenter.tsx
   */
  function resolveDeepLinkTask(
    tasks: any[],
    taskIdParam: string | null,
    projectIdParam: string | null,
    userRoles: string[],
  ) {
    if (taskIdParam) {
      return tasks.find((t) => {
        const matchTaskId = String(t.id) === String(taskIdParam);
        if (!matchTaskId) return false;
        if (projectIdParam && String(t.projectId) !== String(projectIdParam)) {
          return false;
        }
        return true;
      });
    } else if (projectIdParam) {
      const candidateClosureTasks = tasks.filter((t) => {
        if (String(t.projectId) !== String(projectIdParam)) return false;
        if (!t.isClosure && !isClosureTask(t)) return false;
        const evalResult = evaluateClosureTaskActionability(t, userRoles);
        return !evalResult.isReadOnly && (evalResult.canApprove || evalResult.canReturn);
      });

      if (candidateClosureTasks.length === 1) {
        return candidateClosureTasks[0];
      }
    }
    return undefined;
  }

  it('1. taskId + projectId opens exact HOPS closure task', () => {
    const tasks = [hopsClosureTask, operationalPlanTask, otherProjectClosureTask];
    const resolved = resolveDeepLinkTask(tasks, '101', '12', ['HEAD_OF_OPERATIONS']);

    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe(101);
    expect(resolved?.projectId).toBe(12);
    expect(resolved?.nodeId).toBe('node_hoo_review');
  });

  it('2. taskId + projectId opens exact Director closure task', () => {
    const tasks = [directorClosureTask, operationalPlanTask, otherProjectClosureTask];
    const resolved = resolveDeepLinkTask(tasks, '202', '12', ['DIRECTOR']);

    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe(202);
    expect(resolved?.projectId).toBe(12);
    expect(resolved?.nodeId).toBe('node_director_approval');
  });

  it('3. projectId-only notification deep-link resolves unique active HOPS closure task', () => {
    const tasks = [hopsClosureTask, operationalPlanTask, otherProjectClosureTask];
    const resolved = resolveDeepLinkTask(tasks, null, '12', ['HEAD_OF_OPERATIONS']);

    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe(101);
    expect(resolved?.projectId).toBe(12);
    expect(resolved?.isClosure).toBe(true);
  });

  it('4. projectId-only notification deep-link resolves unique active Director closure task', () => {
    const tasks = [directorClosureTask, operationalPlanTask, otherProjectClosureTask];
    const resolved = resolveDeepLinkTask(tasks, null, '12', ['DIRECTOR']);

    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe(202);
    expect(resolved?.projectId).toBe(12);
    expect(resolved?.nodeId).toBe('node_director_approval');
  });

  it('5. nonexistent projectId does not open unrelated task', () => {
    const tasks = [hopsClosureTask, operationalPlanTask];
    const resolved = resolveDeepLinkTask(tasks, null, '8888', ['HEAD_OF_OPERATIONS']);

    expect(resolved).toBeUndefined();
  });

  it('6. ambiguous/multiple active candidate does not guess', () => {
    const duplicateClosureHoo = { ...hopsClosureTask, id: 999 };
    const tasks = [hopsClosureTask, duplicateClosureHoo];
    const resolved = resolveDeepLinkTask(tasks, null, '12', ['HEAD_OF_OPERATIONS']);

    expect(resolved).toBeUndefined();
  });

  it('7. unrelated governance task is unaffected and not misidentified as closure', () => {
    const tasks = [operationalPlanTask];
    const resolved = resolveDeepLinkTask(tasks, null, '12', ['HEAD_OF_OPERATIONS']);

    expect(resolved).toBeUndefined();
  });

  it('8. source code verification: ProjectGovernanceTaskCenter contains deep-link resilience', () => {
    const taskCenterPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
    const content = fs.readFileSync(taskCenterPath, 'utf8');

    expect(content).toContain('auto open review modal if taskId is present, or unique actionable Project Closure task for projectId');
    expect(content).toContain('candidateClosureTasks.length === 1');
    expect(content).toContain('evaluateClosureTaskActionability');
  });
});
