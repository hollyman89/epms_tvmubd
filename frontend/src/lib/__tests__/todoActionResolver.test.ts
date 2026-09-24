import { resolveTodoActionTarget } from '../todoActionResolver';

describe('todoActionResolver (N2 Backend SSOT Consumer)', () => {
  it('1. validates and consumes backend authoritative actionTarget for Purchase Request', () => {
    const target = resolveTodoActionTarget({
      actionTarget: '/procurement?tab=pr&prId=10',
      actionType: 'PURCHASE_REQUEST_APPROVAL',
      entityType: 'PURCHASE_REQUEST',
      entityId: 10,
    });
    expect(target).toBe('/procurement?tab=pr&prId=10');
  });

  it('2. validates and consumes backend authoritative actionTarget for Governance Management Review', () => {
    const target = resolveTodoActionTarget({
      actionTarget: '/governance/tasks?taskId=45&projectId=20',
      actionType: 'MANAGEMENT_REVIEW',
      entityType: 'PROJECT',
      entityId: 20,
      projectId: 20,
      taskId: 45,
    });
    expect(target).toBe('/governance/tasks?taskId=45&projectId=20');
  });

  it('3. validates and consumes backend authoritative actionTarget for PM Revision', () => {
    const target = resolveTodoActionTarget({
      actionTarget: '/project-delivery?projectId=20&action=operational-plan',
      actionType: 'PM_REVISION',
      entityType: 'PROJECT',
      entityId: 20,
      projectId: 20,
    });
    expect(target).toBe('/project-delivery?projectId=20&action=operational-plan');
  });

  it('4. validates and consumes backend authoritative actionTarget for Legal Review', () => {
    const target = resolveTodoActionTarget({
      actionTarget: '/legal/review?contractId=45',
      actionType: 'LEGAL_REVIEW',
      entityType: 'CONTRACT',
      entityId: 45,
    });
    expect(target).toBe('/legal/review?contractId=45');
  });

  it('5. returns null when actionTarget is explicitly null (e.g. unknown task or Go/No-Go pending UI)', () => {
    const target = resolveTodoActionTarget({
      actionTarget: null,
      actionType: 'GO_NOGO_APPROVAL',
      entityType: 'TENDER',
      entityId: 88,
    });
    expect(target).toBeNull();
  });

  it('6. rejects artificial /inbox fallback and returns null', () => {
    const target = resolveTodoActionTarget({
      actionTarget: '/inbox',
      actionType: 'WORKFLOW_TASK',
    });
    expect(target).toBeNull();
  });

  it('7. safely handles missing, undefined, empty, or non-relative targets', () => {
    expect(resolveTodoActionTarget(null)).toBeNull();
    expect(resolveTodoActionTarget(undefined)).toBeNull();
    expect(resolveTodoActionTarget({})).toBeNull();
    expect(resolveTodoActionTarget({ actionTarget: '' })).toBeNull();
    expect(resolveTodoActionTarget({ actionTarget: 'https://evil.com' })).toBeNull();
  });
});
