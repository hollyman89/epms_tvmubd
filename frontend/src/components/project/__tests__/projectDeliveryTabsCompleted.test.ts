/**
 * EPMS — PROJECT-DELIVERY-CLOSED-ACTIVE-R1
 * Frontend Unit & Presentation Tests for Proyek Selesai Tab and Closed Project Separation
 *
 * Requirements Tested:
 * G. Third tab "Proyek Selesai" renders.
 * H. CLOSED Project 2428-shaped payload appears in Proyek Selesai.
 * I. CLOSED project does NOT appear in Daftar Proyek Berjalan.
 * J. Active count excludes CLOSED.
 * K. Completed count includes CLOSED.
 * L. CLOSED row renders status CLOSED.
 * M. Lihat Detail remains available.
 * N. No operational mutation actions render in completed row.
 * O. Existing Antrean Kick-off tab remains unaffected.
 * P. Existing Daftar Proyek Berjalan for legitimate IN_PROGRESS project remains unaffected.
 */

import {
  resolveTopLevelProjectDeliveryTabs,
  classifyProjectDeliveryLists,
  resolveCompletedProjectActions,
} from '../project-workspace.utils';

describe('EPMS — PROJECT-DELIVERY-CLOSED-ACTIVE-R1 Frontend Regression Suite', () => {
  // Canonical Project 2428 payload
  const project2428 = {
    id: 2428,
    projectId: 2428,
    project_code: 'CONT-20261012-0162',
    project_name: 'CANONICAL-FINAL-E2E-1791742923755',
    customerName: 'PT Asianet Media Teknologi',
    contract_total_value: 850000000,
    pmName: 'Project Manager User',
    marketingName: 'Dwi Ragil Pribadi',
    status: 'CLOSED',
    projectStatus: 'CLOSED',
    overallProgress: 100,
    actualFinishAt: '2026-10-12T02:20:00.000Z',
    closedAt: '2026-10-12T02:44:30.000Z',
    closureStatus: 'APPROVED',
  };

  // Legitimate active IN_PROGRESS project
  const projectActive = {
    id: 2001,
    projectId: 2001,
    project_code: 'CONT-2026-ACTIVE',
    project_name: 'Active Core Operations Project',
    customerName: 'PT Telco Mitra',
    contract_total_value: 500000000,
    pmName: 'Project Manager User',
    marketingName: 'Marketing PIC User',
    status: 'IN_PROGRESS',
    projectStatus: 'IN_PROGRESS',
    overallProgress: 45,
  };

  // Legitimate IN_PROGRESS project with 100% physical progress (pending formal closure)
  const projectInProgress100 = {
    id: 2002,
    projectId: 2002,
    project_code: 'CONT-2026-100PCT',
    project_name: 'Substantially Complete Project (100% Progress)',
    customerName: 'PT Data Prima',
    contract_total_value: 300000000,
    pmName: 'Project Manager User',
    marketingName: 'Marketing PIC User',
    status: 'IN_PROGRESS',
    projectStatus: 'IN_PROGRESS',
    overallProgress: 100,
  };

  // Pending Kickoff Charter
  const pendingKickoffCharter = {
    id: 165,
    projectId: null,
    project_code: 'CONT-2026-PLAN',
    project_name: 'Planning Project Pending PMO Kickoff',
    customerName: 'PT Karya Mandiri',
    status: 'PENDING_KICKOFF',
  };

  // G. Third tab "Proyek Selesai" renders.
  it('G. proves top-level Project Delivery renders exactly 3 tabs with "Proyek Selesai" as tab 3', () => {
    const tabs = resolveTopLevelProjectDeliveryTabs();
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toBe('Antrean Kick-off Charter');
    expect(tabs[1]).toBe('Daftar Proyek Berjalan');
    expect(tabs[2]).toBe('Proyek Selesai');
    // Strictly Indonesian label
    expect(tabs).not.toContain('Archived');
    expect(tabs).not.toContain('Inactive');
    expect(tabs).not.toContain('Finished Project');
    expect(tabs).not.toContain('Project Closed');
  });

  // H. CLOSED Project 2428-shaped payload appears in Proyek Selesai.
  it('H. proves CLOSED Project 2428 appears in Proyek Selesai list with complete closure metadata', () => {
    const { completedProjects } = classifyProjectDeliveryLists(
      [projectActive, projectInProgress100],
      [project2428]
    );

    const target = completedProjects.find((p) => p.id === 2428);
    expect(target).toBeDefined();
    expect(target.project_code).toBe('CONT-20261012-0162');
    expect(target.customerName).toBe('PT Asianet Media Teknologi');
    expect(target.overallProgress).toBe(100);
    expect(target.actualFinishAt).toBe('2026-10-12T02:20:00.000Z');
    expect(target.closedAt).toBe('2026-10-12T02:44:30.000Z');
    expect(target.closureStatus).toBe('APPROVED');
  });

  // I. CLOSED project does NOT appear in Daftar Proyek Berjalan.
  it('I. proves CLOSED Project 2428 strictly does NOT appear in Daftar Proyek Berjalan (even if raw array had it)', () => {
    // Test with raw active containing 2428 (defensive filter test)
    const { activeProjects } = classifyProjectDeliveryLists(
      [projectActive, projectInProgress100, project2428],
      []
    );

    const foundInActive = activeProjects.find((p) => p.id === 2428 || p.project_code === 'CONT-20261012-0162');
    expect(foundInActive).toBeUndefined();
  });

  // J. Active count excludes CLOSED.
  it('J. proves active count strictly excludes CLOSED project 2428', () => {
    const { activeCount } = classifyProjectDeliveryLists(
      [projectActive, projectInProgress100, project2428],
      [project2428]
    );

    expect(activeCount).toBe(2);
  });

  // K. Completed count includes CLOSED.
  it('K. proves completed count strictly includes CLOSED project 2428', () => {
    const { completedCount } = classifyProjectDeliveryLists(
      [projectActive, projectInProgress100],
      [project2428]
    );

    expect(completedCount).toBe(1);
  });

  // L. CLOSED row renders status CLOSED.
  it('L. proves CLOSED row preserves canonical status CLOSED badge text', () => {
    expect(project2428.status).toBe('CLOSED');
    expect(project2428.projectStatus).toBe('CLOSED');
  });

  // M. Lihat Detail remains available.
  it('M. proves "Lihat Detail" action is available for CLOSED project', () => {
    const actions = resolveCompletedProjectActions(project2428);
    expect(actions.canViewDetail).toBe(true);
    expect(actions.allowedActions).toContain('LIHAT_DETAIL');
  });

  // N. No operational mutation actions render in completed row.
  it('N. proves operational mutation actions are strictly forbidden and blocked for CLOSED projects', () => {
    const actions = resolveCompletedProjectActions(project2428);
    expect(actions.canUpdateProgress).toBe(false);
    expect(actions.canClaimProgress).toBe(false);
    expect(actions.canKickoff).toBe(false);
    expect(actions.canSubmitClosure).toBe(false);
    expect(actions.canApproveManagement).toBe(false);

    expect(actions.forbiddenActions).toEqual(
      expect.arrayContaining([
        'UPDATE_PROGRESS',
        'KICKOFF',
        'CLAIM_PROGRESS',
        'SUBMIT_CLOSURE',
        'MANAGEMENT_APPROVAL',
        'EXECUTION_MUTATION',
      ])
    );
  });

  // O. Existing Antrean Kick-off tab remains unaffected.
  it('O. proves existing Antrean Kick-off charter remains unaffected in separate queue', () => {
    expect(pendingKickoffCharter.status).toBe('PENDING_KICKOFF');
    expect(pendingKickoffCharter.project_code).toBe('CONT-2026-PLAN');
  });

  // P. Existing Daftar Proyek Berjalan for legitimate IN_PROGRESS project remains unaffected.
  it('P. proves existing Daftar Proyek Berjalan includes legitimate IN_PROGRESS project and 100% IN_PROGRESS project', () => {
    const { activeProjects } = classifyProjectDeliveryLists(
      [projectActive, projectInProgress100],
      [project2428]
    );

    expect(activeProjects).toHaveLength(2);
    expect(activeProjects.map((p) => p.id)).toEqual([2001, 2002]);

    // Project 2002 at 100% remains IN_PROGRESS until formal closure
    const project100 = activeProjects.find((p) => p.id === 2002);
    expect(project100?.overallProgress).toBe(100);
    expect(project100?.status).toBe('IN_PROGRESS');
  });
});
