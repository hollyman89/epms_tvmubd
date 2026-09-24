import { resolveTodoActionTarget } from '../todoActionResolver';

describe('todoActionResolver (N1 Action Target Foundation)', () => {
  it('1. uses backend authoritative actionTarget if provided', () => {
    const target = resolveTodoActionTarget({
      actionTarget: '/procurement',
      entityType: 'PURCHASE_REQUEST',
      entityId: 10,
    });
    expect(target).toBe('/procurement');
  });

  it('2. resolves CONTRACT / LEGAL_REVIEW to legal review page with contractId query', () => {
    const target = resolveTodoActionTarget({
      entityType: 'CONTRACT',
      entityId: 45,
      actionType: 'LEGAL_REVIEW',
    });
    expect(target).toBe('/legal/review?contractId=45');
  });

  it('3. resolves TENDER / GO_NOGO_APPROVAL to tender sales page', () => {
    const target = resolveTodoActionTarget({
      entityType: 'TENDER',
      entityId: 77,
      actionType: 'GO_NOGO_APPROVAL',
    });
    expect(target).toBe('/sales/tenders/77');
  });

  it('4. resolves PROJECT / MANAGEMENT_REVIEW to project-delivery workspace', () => {
    const target = resolveTodoActionTarget({
      entityType: 'PROJECT',
      entityId: 20,
      actionType: 'MANAGEMENT_REVIEW',
    });
    expect(target).toBe('/project-delivery');
  });

  it('5. resolves PURCHASE_REQUEST to procurement workspace', () => {
    const target = resolveTodoActionTarget({
      entityType: 'PURCHASE_REQUEST',
      entityId: 99,
      actionType: 'PURCHASE_REQUEST_APPROVAL',
    });
    expect(target).toBe('/procurement');
  });

  it('6. falls back to /inbox for unknown task types', () => {
    const target = resolveTodoActionTarget({
      entityType: 'UNKNOWN',
      entityId: 1,
    });
    expect(target).toBe('/inbox');
  });
});
