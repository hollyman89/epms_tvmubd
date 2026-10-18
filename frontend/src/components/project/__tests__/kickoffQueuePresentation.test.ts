import {
  resolvePmIdentity,
  resolveMarketingIdentity,
  getKickoffQueueStatusTags,
  resolveNextAction,
  ProjectCharterLike,
} from '../kickoff-queue.utils';

describe('EPMS — PROJECT-DELIVERY-KICKOFF-UI-R1 Presentation & Role Matrix Tests', () => {
  // Test 1: Actual PM name rendered
  it('1. should render actual PM person name when assigned', () => {
    const record: ProjectCharterLike = {
      managerId: 879,
      manager: { id: 879, fullName: 'Faza Afina', email: 'faza@epms.com' },
    };
    const pm = resolvePmIdentity(record);
    expect(pm.name).toBe('Faza Afina');
    expect(pm.initials).toBe('FA');
    expect(pm.isAssigned).toBe(true);
  });

  // Test 2: User ID 2 authoritative PM name rendered (Project Manager) and User ID 879 (Faza Afina)
  it('2. should render authoritative PM name for User ID 2 (Project Manager) without alias collision', () => {
    const recordUser2: ProjectCharterLike = {
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      pmName: 'Project Manager',
    };
    const pmUser2 = resolvePmIdentity(recordUser2);
    expect(pmUser2.name).toBe('Project Manager');
    expect(pmUser2.initials).toBe('PM');
    expect(pmUser2.isAssigned).toBe(true);

    const recordUser879: ProjectCharterLike = {
      managerId: 879,
      manager: { id: 879, fullName: 'Faza Afina', email: 'faza@epms.com' },
    };
    const pmUser879 = resolvePmIdentity(recordUser879);
    expect(pmUser879.name).toBe('Faza Afina');
    expect(pmUser879.initials).toBe('FA');
    expect(pmUser879.isAssigned).toBe(true);
  });

  // Test 3: Unassigned project -> Belum Ditugaskan
  it('3. should render "Belum Ditugaskan" for unassigned project with empty initials', () => {
    const record: ProjectCharterLike = {
      managerId: null,
      manager: null,
      pmName: null,
    };
    const pm = resolvePmIdentity(record);
    expect(pm.name).toBe('Belum Ditugaskan');
    expect(pm.isAssigned).toBe(false);
    expect(pm.initials).toBe('');
  });

  // Test Marketing PIC
  it('3b. should render Marketing PIC person name and initials correctly', () => {
    const record: ProjectCharterLike = {
      marketingName: 'Dwi Ragil Pribadi',
    };
    const mkt = resolveMarketingIdentity(record);
    expect(mkt.name).toBe('Dwi Ragil Pribadi');
    expect(mkt.initials).toBe('DR');
    expect(mkt.isAssigned).toBe(true);

    const emptyRecord: ProjectCharterLike = { marketingName: null };
    const emptyMkt = resolveMarketingIdentity(emptyRecord);
    expect(emptyMkt.name).toBe('-');
    expect(emptyMkt.isAssigned).toBe(false);
  });

  // Test 4: Operational Plan and Handover displayed separately
  it('4. should separate Operational Plan and Handover into independent status tags', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const { opTag, hoTag } = getKickoffQueueStatusTags(record);

    expect(opTag.text).toBe('APPROVED');
    expect(opTag.tone).toBe('green');
    expect(hoTag.text).toBe('SIAP KICKOFF');
    expect(hoTag.tone).toBe('purple');
  });

  // Test 5: No duplicate APPROVED (SIAP KICKOFF) or MENUNGGU KICKOFF PM
  it('5. should NOT render duplicate "APPROVED (SIAP KICKOFF)" or "MENUNGGU KICKOFF PM"', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const { opTag, hoTag } = getKickoffQueueStatusTags(record);

    expect(opTag.text).not.toContain('SIAP KICKOFF');
    expect(hoTag.text).not.toContain('MENUNGGU');
    expect(opTag.text).toBe('APPROVED');
    expect(hoTag.text).toBe('SIAP KICKOFF');
  });

  // Test 6: Assigned PM -> Kick Off Proyek visible
  it('6. should show Kick Off Proyek button for exact assigned PM on READY_FOR_KICKOFF project', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 2, ['PROJECT_MANAGER']);
    expect(nextAction.mode).toBe('KICKOFF_BUTTON');
    expect(nextAction.buttonLabel).toBe('Kick Off Proyek');
  });

  // Test 7: Other PM -> hidden
  it('7. should HIDE Kick Off Proyek for a different PM and show waiting text', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2, // Assigned to User 2
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 879, ['PROJECT_MANAGER']); // Current user is User 879
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
    expect(nextAction.waitingText).toBe('Menunggu Project Manager melakukan kickoff');
  });

  // Test 8: PMO -> hidden
  it('8. should HIDE Kick Off Proyek for PMO and show waiting text', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 769, ['PMO']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
    expect(nextAction.waitingText).toBe('Menunggu Project Manager melakukan kickoff');
  });

  // Test 9: HOO -> hidden
  it('9. should HIDE Kick Off Proyek for Head of Operations', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 58, ['HEAD_OF_OPERATIONS']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
  });

  // Test 10: Procurement -> hidden
  it('10. should HIDE Kick Off Proyek for Procurement', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 41, ['PROCUREMENT']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
  });

  // Test 11: Finance -> hidden
  it('11. should HIDE Kick Off Proyek for Finance', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 3, ['FINANCE']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
  });

  // Test 12: Director -> hidden
  it('12. should HIDE Kick Off Proyek for Director', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 4, ['DIRECTOR']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
  });

  // Test 13: Admin -> hidden
  it('13. should HIDE Kick Off Proyek for Admin', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 1, ['ADMIN']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
  });

  // Test 14: SuperAdmin -> hidden
  it('14. should HIDE Kick Off Proyek for SuperAdmin', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 39, ['SUPER_ADMIN']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
  });

  // Test 15: Non-ready project -> hidden
  it('15. should NOT show Kick Off Proyek when project is in PLANNING / NOT_STARTED', () => {
    const record: ProjectCharterLike = {
      projectId: 1411,
      managerId: 879,
      manager: { id: 879, fullName: 'Faza Afina', email: 'faza@epms.com' },
      operationalPlanStatus: 'NOT_STARTED',
      handoverStatus: 'PENYUSUNAN_PLAN',
    };
    const nextAction = resolveNextAction(record, {}, 879, ['PROJECT_MANAGER']);
    expect(nextAction.mode).not.toBe('KICKOFF_BUTTON');
    expect(nextAction.mode).toBe('OPERATIONAL_PLAN_BUTTON');
    expect(nextAction.buttonLabel).toBe('Operational Plan');
  });

  // Test 16: Non-assigned viewer sees waiting text with actual PM name
  it('16. should show waiting text containing PM name for non-assigned viewer', () => {
    const record: ProjectCharterLike = {
      projectId: 1408,
      managerId: 879,
      manager: { id: 879, fullName: 'Faza Afina', email: 'faza@epms.com' },
      operationalPlanStatus: 'READY_FOR_KICKOFF',
      handoverStatus: 'READY_FOR_KICKOFF',
    };
    const nextAction = resolveNextAction(record, {}, 1, ['ADMIN']);
    expect(nextAction.mode).toBe('WAITING_PM_KICKOFF');
    expect(nextAction.waitingText).toBe('Menunggu Faza Afina melakukan kickoff');
  });

  // Test Unassigned Project -> PMO sees Tugaskan PM
  it('should show "Tugaskan PM" for PMO on unassigned project', () => {
    const record: ProjectCharterLike = {
      managerId: null,
      manager: null,
      pmName: null,
      operationalPlanStatus: 'BELUM_DITUGASKAN',
      handoverStatus: 'ANTREAN_KICKOFF',
    };
    const pmoAction = resolveNextAction(record, {}, 769, ['PMO']);
    expect(pmoAction.mode).toBe('ASSIGN_PM_BUTTON');
    expect(pmoAction.buttonLabel).toBe('Tugaskan PM');

    const regularAction = resolveNextAction(record, {}, 2, ['PROJECT_MANAGER']);
    expect(regularAction.mode).toBe('WAITING_PMO_ASSIGN');
    expect(regularAction.waitingText).toBe('Menunggu penugasan PMO');
  });

  // Test Governance Review -> Waiting persetujuan Head of Operations
  it('should show "Menunggu persetujuan Head of Operations" when in REVIEW_HOPS', () => {
    const record: ProjectCharterLike = {
      projectId: 1690,
      managerId: 2,
      manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      operationalPlanStatus: 'REVIEW_HOPS',
      handoverStatus: 'REVIEW_HOPS',
    };
    const action = resolveNextAction(record, {}, 2, ['PROJECT_MANAGER']);
    expect(action.mode).toBe('WAITING_GOVERNANCE');
    expect(action.actorName).toBe('Head of Operations');
  });
});
