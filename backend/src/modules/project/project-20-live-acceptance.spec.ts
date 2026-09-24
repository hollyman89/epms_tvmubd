import { ProjectWorkflowProjectionService } from './project-workflow-projection.service';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../entities/workflow-instance.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { User } from '../../entities/user.entity';

describe('Project #20 Live Acceptance Test', () => {
  const service = new ProjectWorkflowProjectionService();

  it('correctly projects Project #20 at node_finance_review into Stage 4/5 Finance Review', () => {
    // Exact DB replica from Project #20
    const instance = {
      id: 8,
      entityType: 'PROJECT',
      entityId: 20,
      status: WorkflowInstanceStatus.IN_PROGRESS,
      currentNodeId: 'node_finance_review',
      createdAt: new Date('2026-09-21T11:58:22.000Z'),
      transitions: [
        {
          id: 24,
          fromNodeId: 'INIT',
          toNodeId: 'node_start',
          action: 'START',
          actorId: 879,
          actor: { id: 879, fullName: 'Faza Afina ' } as User,
          createdAt: new Date('2026-09-21T11:58:22.000Z'),
        } as WorkflowTransition,
        {
          id: 25,
          fromNodeId: 'node_hops_review',
          toNodeId: 'node_procurement_review',
          action: 'APPROVE',
          actorId: 58,
          actor: { id: 58, fullName: 'Hoa' } as User,
          reason: 'Disetujui pada tahap HOPS Review',
          createdAt: new Date('2026-09-21T11:58:54.000Z'),
        } as WorkflowTransition,
        {
          id: 26,
          fromNodeId: 'node_procurement_review',
          toNodeId: 'node_finance_review',
          action: 'APPROVE',
          actorId: 41,
          actor: { id: 41, fullName: 'purchasing' } as User,
          reason: 'Disetujui pada tahap Procurement Review',
          createdAt: new Date('2026-09-21T11:59:21.000Z'),
        } as WorkflowTransition,
      ],
    } as unknown as WorkflowInstance;

    const review = {
      id: 8,
      projectId: 20,
      status: 'REVIEW_PENDING', // Stale legacy value in DB!
      submittedBy: 879,
      decidedBy: 58,
      decidedAt: new Date('2026-09-21T11:58:55.000Z'),
      reviewerRole: 'HEAD_OF_OPERATIONS',
      submitter: { id: 879, fullName: 'Faza Afina' } as User,
    } as unknown as ProjectManagementReview;

    const projection = service.buildProjection(instance, review);

    console.log('\n=============================================');
    console.log('PROJECT #20 CANONICAL PROJECTION RESULT:');
    console.log('=============================================');
    console.log('businessStatus:', projection.businessStatus);
    console.log('current:', JSON.stringify(projection.current, null, 2));
    console.log('lastApprovedBy:', JSON.stringify(projection.lastApprovedBy, null, 2));
    console.log('lastApprovedRole:', projection.lastApprovedRole);
    console.log('lastApprovedAt:', projection.lastApprovedAt);
    console.log('steps:');
    projection.steps.forEach((s) => console.log(`  [${s.stage}/5] ${s.roleTitle}: ${s.status} (${s.stateLabel}) - Actor: ${s.actor || '-'}`));
    console.log('history count:', projection.history.length);
    console.log('=============================================\n');

    // Assertions according to Phase 21 & Phase 22 requirements
    expect(projection.businessStatus).toBe('REVIEW_FINANCE');
    expect(projection.current.nodeKey).toBe('FINANCE_REVIEW');
    expect(projection.current.stage).toBe(4);
    expect(projection.current.totalStages).toBe(5);
    expect(projection.current.ownerRole).toBe('FINANCE');
    expect(projection.current.ownerName).toBe('Finance Team');
    expect(projection.current.position).toBe('Management Review (Tahap 4 dari 5)');
    expect(projection.current.nextStep).toBe('Keputusan Review dari Finance Team');

    // 5 Stage Cards
    expect(projection.steps[0]).toMatchObject({ stage: 1, key: 'pm', status: 'COMPLETED' });
    expect(projection.steps[1]).toMatchObject({ stage: 2, key: 'hoa', status: 'COMPLETED', actor: 'Hoa' });
    expect(projection.steps[2]).toMatchObject({ stage: 3, key: 'proc', status: 'COMPLETED', actor: 'purchasing' });
    expect(projection.steps[3]).toMatchObject({ stage: 4, key: 'fin', status: 'ACTIVE' });
    expect(projection.steps[4]).toMatchObject({ stage: 5, key: 'dir', status: 'WAITING' });

    // Last Approved
    expect(projection.lastApprovedBy).toEqual({ id: 41, name: 'purchasing', role: 'PROCUREMENT' });
    expect(projection.lastApprovedRole).toBe('PROCUREMENT');
    expect(new Date(projection.lastApprovedAt!).toISOString()).toBe('2026-09-21T11:59:21.000Z');
  });
});
