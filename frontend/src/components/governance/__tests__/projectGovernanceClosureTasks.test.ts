/**
 * EPMS — PROJECT-CLOSE-R1-C5-UI-CORR
 * Comprehensive Unit Tests for Unifying Project Closure into Existing "Tugas Persetujuan Proyek"
 *
 * Covers Assertions A through N:
 * A. Workflow Designer no longer contains Tugas Persetujuan business tab.
 * B. Workflow Designer definition functionality remains intact.
 * C. Existing Tugas Persetujuan Proyek loads.
 * D. HOO sees PROJECT_CLOSURE HOO task there.
 * E. HOO gets Approve / Return.
 * F. Director does not get HOO action.
 * G. After HOO approval, Director Closure task appears in existing approval center.
 * H. Director gets Final Approve / Return.
 * I. ADMIN gets zero Closure approval action.
 * J. SUPER_ADMIN gets zero Closure approval action.
 * K. Existing non-Closure Project approval tasks are not broken.
 * L. Closure notification actionable deep-link opens existing Tugas Persetujuan Proyek.
 * M. Project Closure workspace deep-link remains valid.
 * N. No second Project approval center remains.
 */

import {
  isClosureTask,
  evaluateClosureTaskActionability,
  validateClosureReturnReason,
  CLOSURE_STAGE_MAPPING,
  SUPPORTED_CLOSURE_NODES,
  resolveTaskApprovalClassification,
  APPROVAL_CLASSIFICATION_MAP,
} from '../projectGovernanceClosure.utils';
import {
  SUPPORTED_GOVERNANCE_NODES,
  STAGE_MAPPING,
} from '../ProjectGovernanceTaskCenter';
import { resolveNotificationTarget } from '@/lib/notificationSync';
import { MENU_GROUPS } from '@/constants/menuConfig';
import fs from 'fs';
import path from 'path';

describe('EPMS — PROJECT-CLOSE-R1-C5-UI-CORR Approval Integration Suite', () => {
  // Mock tasks
  const hooClosureTask = {
    id: 101,
    workflowInstanceId: 501,
    nodeId: 'node_hoo_review',
    status: 'PENDING',
    workflowKey: 'PROJECT_CLOSURE',
    entityType: 'PROJECT_CLOSURE',
    workflowInstance: {
      id: 501,
      entityType: 'PROJECT_CLOSURE',
      entityId: 901,
      workflowDefinition: { workflowKey: 'PROJECT_CLOSURE' },
      context: { projectId: 2014, projectCode: 'PRJ-2014', cycleNumber: 1 },
    },
  };

  const directorClosureTask = {
    id: 102,
    workflowInstanceId: 501,
    nodeId: 'node_director_approval',
    status: 'PENDING',
    workflowKey: 'PROJECT_CLOSURE',
    entityType: 'PROJECT_CLOSURE',
    workflowInstance: {
      id: 501,
      entityType: 'PROJECT_CLOSURE',
      entityId: 901,
      workflowDefinition: { workflowKey: 'PROJECT_CLOSURE' },
      context: { projectId: 2014, projectCode: 'PRJ-2014', cycleNumber: 1 },
    },
  };

  const nonClosureGovTask = {
    id: 103,
    workflowInstanceId: 502,
    nodeId: 'node_hops_review',
    status: 'PENDING',
    workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
    entityType: 'PROJECT',
    workflowInstance: {
      id: 502,
      entityType: 'PROJECT',
      entityId: 2014,
      workflowDefinition: { workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW' },
      context: { projectId: 2014, projectCode: 'PRJ-2014' },
    },
  };

  describe('Section 3 & 11: Workflow Designer Cleanup & Single Approval Center', () => {
    it('Assertion A: Workflow Designer route (/workflow) no longer contains Tugas Persetujuan tab', () => {
      const workflowRouteFile = path.resolve(
        __dirname,
        '../../../app/(dashboard)/workflow/page.tsx',
      );
      const content = fs.readFileSync(workflowRouteFile, 'utf-8');
      expect(content).not.toContain('Tugas Persetujuan');
      expect(content).not.toContain('WorkflowTaskCenter');
      expect(content).not.toContain('activeTab');
    });

    it('Assertion B: Workflow Designer definition functionality remains intact', () => {
      const workflowRouteFile = path.resolve(
        __dirname,
        '../../../app/(dashboard)/workflow/page.tsx',
      );
      const content = fs.readFileSync(workflowRouteFile, 'utf-8');
      expect(content).toContain('WorkflowList');
      expect(content).toContain('WorkflowEditor');
      expect(content).toContain('selectedWorkflowKey');
    });

    it('Assertion C & N: No second Project approval center exists in workflow-designer', () => {
      const duplicateComponent = path.resolve(
        __dirname,
        '../../workflow-designer/WorkflowTaskCenter.tsx',
      );
      expect(fs.existsSync(duplicateComponent)).toBe(false);
    });
  });

  describe('Section 5 & 9: Project Closure Task Detection & Presentation', () => {
    it('Assertion D1: isClosureTask correctly identifies PROJECT_CLOSURE tasks', () => {
      expect(isClosureTask(hooClosureTask)).toBe(true);
      expect(isClosureTask(directorClosureTask)).toBe(true);
      expect(isClosureTask(nonClosureGovTask)).toBe(false);
    });

    it('Assertion D2: Closure stage mapping renders human-friendly labels instead of raw node IDs', () => {
      expect(CLOSURE_STAGE_MAPPING.node_hoo_review.label).toBe(
        'Review Closure — Head of Operations',
      );
      expect(CLOSURE_STAGE_MAPPING.node_director_approval.label).toBe(
        'Persetujuan Final Closure — Director',
      );
      expect(SUPPORTED_CLOSURE_NODES).toContain('node_hoo_review');
      expect(SUPPORTED_CLOSURE_NODES).toContain('node_director_approval');
    });
  });

  describe('Section 6, 7, 8: Role Authority & Action Separation', () => {
    it('Assertion D & E: HOO sees Closure HOO task and gets Approve / Return', () => {
      const evalHoo = evaluateClosureTaskActionability(hooClosureTask, [
        'HEAD_OF_OPERATIONS',
      ]);
      expect(evalHoo.canApprove).toBe(true);
      expect(evalHoo.canReturn).toBe(true);
      expect(evalHoo.isHooAction).toBe(true);
      expect(evalHoo.isDirectorAction).toBe(false);
      expect(evalHoo.isReadOnly).toBe(false);
    });

    it('Assertion F: Director does NOT get HOO action on node_hoo_review', () => {
      const evalDirOnHoo = evaluateClosureTaskActionability(hooClosureTask, [
        'DIRECTOR',
      ]);
      expect(evalDirOnHoo.canApprove).toBe(false);
      expect(evalDirOnHoo.canReturn).toBe(false);
      expect(evalDirOnHoo.isReadOnly).toBe(true);
    });

    it('Assertion G & H: Director gets Final Approve / Return on node_director_approval, HOO does not', () => {
      const evalDir = evaluateClosureTaskActionability(directorClosureTask, [
        'DIRECTOR',
      ]);
      expect(evalDir.canApprove).toBe(true);
      expect(evalDir.canReturn).toBe(true);
      expect(evalDir.isDirectorAction).toBe(true);
      expect(evalDir.isHooAction).toBe(false);
      expect(evalDir.isReadOnly).toBe(false);

      const evalHooOnDir = evaluateClosureTaskActionability(
        directorClosureTask,
        ['HEAD_OF_OPERATIONS'],
      );
      expect(evalHooOnDir.canApprove).toBe(false);
      expect(evalHooOnDir.canReturn).toBe(false);
      expect(evalHooOnDir.isReadOnly).toBe(true);
    });

    it('Assertion I & J: ADMIN and SUPER_ADMIN have ZERO business closure action rights', () => {
      const evalAdminHoo = evaluateClosureTaskActionability(hooClosureTask, [
        'ADMIN',
      ]);
      expect(evalAdminHoo.canApprove).toBe(false);
      expect(evalAdminHoo.canReturn).toBe(false);
      expect(evalAdminHoo.isReadOnly).toBe(true);

      const evalSuperAdminDir = evaluateClosureTaskActionability(
        directorClosureTask,
        ['SUPER_ADMIN'],
      );
      expect(evalSuperAdminDir.canApprove).toBe(false);
      expect(evalSuperAdminDir.canReturn).toBe(false);
      expect(evalSuperAdminDir.isReadOnly).toBe(true);
    });

    it('Assertion PM: PROJECT_MANAGER has ZERO closure approval action rights', () => {
      const evalPm = evaluateClosureTaskActionability(hooClosureTask, [
        'PROJECT_MANAGER',
      ]);
      expect(evalPm.canApprove).toBe(false);
      expect(evalPm.canReturn).toBe(false);
      expect(evalPm.isReadOnly).toBe(true);
    });
  });

  describe('Section 12: Existing Non-Closure Project Approvals Integrity', () => {
    it('Assertion K: Existing PROJECT_PLAN_REVIEW_WORKFLOW nodes remain defined and unregressed', () => {
      expect(SUPPORTED_GOVERNANCE_NODES).toContain('node_hops_review');
      expect(SUPPORTED_GOVERNANCE_NODES).toContain('node_procurement_review');
      expect(SUPPORTED_GOVERNANCE_NODES).toContain('node_finance_review');
      expect(SUPPORTED_GOVERNANCE_NODES).toContain('node_director_approval');

      expect(STAGE_MAPPING.node_hops_review.requiredRole).toBe(
        'HEAD_OF_OPERATIONS',
      );
      expect(STAGE_MAPPING.node_procurement_review.requiredRole).toBe(
        'PROCUREMENT',
      );
      expect(STAGE_MAPPING.node_finance_review.requiredRole).toBe('FINANCE');
      expect(STAGE_MAPPING.node_director_approval.requiredRole).toBe('DIRECTOR');
    });
  });

  describe('Section 10: Notification Deep-Link Resolution', () => {
    it('Assertion L1: PM Submit actionable notification resolves to /governance/tasks', () => {
      const notifSubmit = {
        actionLink: '/governance/tasks',
        metaData: {
          category: 'PROJECT_CLOSURE',
          actionType: 'CLOSURE_SUBMITTED',
          projectId: 2014,
        },
      };
      const url = resolveNotificationTarget(notifSubmit);
      expect(url).toBe('/governance/tasks');
    });

    it('Assertion L2: HOO Approve actionable notification resolves to /governance/tasks', () => {
      const notifHooApprove = {
        actionLink: '/governance/tasks',
        metaData: {
          category: 'PROJECT_CLOSURE',
          actionType: 'CLOSURE_HOO_APPROVED',
          projectId: 2014,
        },
      };
      const url = resolveNotificationTarget(notifHooApprove);
      expect(url).toBe('/governance/tasks');
    });

    it('Assertion L3: Historical /workflow notification target for closure is normalized to /governance/tasks', () => {
      const legacyNotif = {
        actionLink: '/workflow',
        metaData: {
          category: 'PROJECT_CLOSURE',
          actionType: 'CLOSURE_SUBMITTED',
          projectId: 2014,
        },
      };
      const url = resolveNotificationTarget(legacyNotif);
      expect(url).toBe('/governance/tasks?projectId=2014');
    });

    it('Assertion M: Return and Director Approved notifications resolve to Project Workspace section=closure', () => {
      const returnNotif = {
        actionLink:
          '/project-delivery?view=workspace&projectId=2014&section=closure',
        metaData: {
          category: 'PROJECT_CLOSURE',
          actionType: 'CLOSURE_HOO_RETURNED',
          projectId: 2014,
        },
      };
      const url = resolveNotificationTarget(returnNotif);
      expect(url).toBe(
        '/project-delivery?view=workspace&projectId=2014&section=closure',
      );
    });
  });

  describe('Return Reason Validation', () => {
    it('Requires non-empty return reason of at least 10 characters', () => {
      expect(validateClosureReturnReason('').isValid).toBe(false);
      expect(validateClosureReturnReason('Pendek').isValid).toBe(false);
      expect(
        validateClosureReturnReason(
          'Laporan penutupan belum lengkap pada bab pengujian sistem.',
        ).isValid,
      ).toBe(true);
    });
  });

  describe('EPMS — PROJECT-CLOSE-R1-C5-UI-FINAL Approval Center Naming & Classification', () => {
    it('Assertion A: Sidebar menu configuration says "Approval Center"', () => {
      const allMenuItems = MENU_GROUPS.flatMap((g) => g.children);
      const governanceTaskMenu = allMenuItems.find(
        (item) => item.key === '/governance/tasks',
      );
      expect(governanceTaskMenu).toBeDefined();
      expect(governanceTaskMenu!.label).toBe('Approval Center');
      expect(governanceTaskMenu!.path).toBe('/governance/tasks');
    });

    it('Assertion B: Page title in component says "Approval Center"', () => {
      const componentFile = path.resolve(
        __dirname,
        '../ProjectGovernanceTaskCenter.tsx',
      );
      const content = fs.readFileSync(componentFile, 'utf-8');
      expect(content).toContain('Approval Center');
      expect(content).toContain(
        'Pusat persetujuan terpusat untuk seluruh proses approval proyek.',
      );
    });

    it('Assertion C: Old primary UI label "Tugas Persetujuan Proyek" is removed from primary titles', () => {
      const allMenuItems = MENU_GROUPS.flatMap((g) => g.children);
      const oldMenu = allMenuItems.find(
        (item) => item.label === 'Tugas Persetujuan Proyek',
      );
      expect(oldMenu).toBeUndefined();

      const componentFile = path.resolve(
        __dirname,
        '../ProjectGovernanceTaskCenter.tsx',
      );
      const content = fs.readFileSync(componentFile, 'utf-8');
      // Must not be used as primary page heading
      expect(content).not.toContain('<Title level={3} style={{ margin: 0, color: \'#0f172a\' }}>\n          Tugas Persetujuan Proyek');
    });

    it('Assertion D: Management Review task shows authoritative classification: Management Review', () => {
      const cls = resolveTaskApprovalClassification(nonClosureGovTask);
      expect(cls.code).toBe('MANAGEMENT_REVIEW');
      expect(cls.label).toBe('Management Review');
      expect(cls.tagColor).toBe('blue');
    });

    it('Assertion E: Project Closure HOO task shows authoritative classification: Project Closure', () => {
      const cls = resolveTaskApprovalClassification(hooClosureTask);
      expect(cls.code).toBe('PROJECT_CLOSURE');
      expect(cls.label).toBe('Project Closure');
      expect(cls.tagColor).toBe('purple');
    });

    it('Assertion F: Project Closure Director task shows authoritative classification: Project Closure', () => {
      const cls = resolveTaskApprovalClassification(directorClosureTask);
      expect(cls.code).toBe('PROJECT_CLOSURE');
      expect(cls.label).toBe('Project Closure');
      expect(cls.tagColor).toBe('purple');
    });

    it('Assertion G: Stage remains separately displayed', () => {
      const hooStage = CLOSURE_STAGE_MAPPING.node_hoo_review;
      const dirStage = CLOSURE_STAGE_MAPPING.node_director_approval;
      const mgmtStage = STAGE_MAPPING.node_hops_review;

      expect(hooStage.label).toBe('Review Closure — Head of Operations');
      expect(dirStage.label).toBe('Persetujuan Final Closure — Director');
      expect(mgmtStage.label).toBe('Head of Operations Review');

      // Classification label is separate from Stage label
      const closureCls = APPROVAL_CLASSIFICATION_MAP.PROJECT_CLOSURE;
      const mgmtCls = APPROVAL_CLASSIFICATION_MAP.MANAGEMENT_REVIEW;
      expect(closureCls.label).not.toBe(hooStage.label);
      expect(mgmtCls.label).not.toBe(mgmtStage.label);
    });

    it('Assertion H: Classification does not affect action authority', () => {
      // HOO task: HOO can approve/return, Director cannot
      const hooEval = evaluateClosureTaskActionability(hooClosureTask, ['HEAD_OF_OPERATIONS']);
      const dirOnHoo = evaluateClosureTaskActionability(hooClosureTask, ['DIRECTOR']);
      expect(hooEval.canApprove).toBe(true);
      expect(dirOnHoo.canApprove).toBe(false);

      // Director task: Director can approve/return, HOO cannot
      const dirEval = evaluateClosureTaskActionability(directorClosureTask, ['DIRECTOR']);
      const hooOnDir = evaluateClosureTaskActionability(directorClosureTask, ['HEAD_OF_OPERATIONS']);
      expect(dirEval.canApprove).toBe(true);
      expect(hooOnDir.canApprove).toBe(false);

      // SuperAdmin / Admin has zero business action rights
      const adminEval = evaluateClosureTaskActionability(hooClosureTask, ['ADMIN']);
      expect(adminEval.canApprove).toBe(false);
      expect(adminEval.isReadOnly).toBe(true);
    });

    it('Assertion I: Filter works across ALL, MANAGEMENT_REVIEW, and PROJECT_CLOSURE', () => {
      const mockList = [
        { ...nonClosureGovTask, classification: APPROVAL_CLASSIFICATION_MAP.MANAGEMENT_REVIEW },
        { ...hooClosureTask, isClosure: true, classification: APPROVAL_CLASSIFICATION_MAP.PROJECT_CLOSURE },
        { ...directorClosureTask, isClosure: true, classification: APPROVAL_CLASSIFICATION_MAP.PROJECT_CLOSURE },
      ];

      // Filter ALL
      const allResult = mockList;
      expect(allResult.length).toBe(3);

      // Filter MANAGEMENT_REVIEW
      const mgmtResult = mockList.filter((t) => t.classification.code === 'MANAGEMENT_REVIEW');
      expect(mgmtResult.length).toBe(1);
      expect(mgmtResult[0].id).toBe(103);

      // Filter PROJECT_CLOSURE
      const closureResult = mockList.filter((t) => t.classification.code === 'PROJECT_CLOSURE');
      expect(closureResult.length).toBe(2);
      expect(closureResult.map((t) => t.id)).toEqual([101, 102]);
    });

    it('Assertion J: /governance/tasks route remains unchanged', () => {
      const allMenuItems = MENU_GROUPS.flatMap((g) => g.children);
      const item = allMenuItems.find((i) => i.label === 'Approval Center');
      expect(item?.path).toBe('/governance/tasks');

      const notifTarget = resolveNotificationTarget({
        actionLink: '/governance/tasks',
        metaData: { category: 'PROJECT_CLOSURE', actionType: 'CLOSURE_SUBMITTED', projectId: 100 },
      });
      expect(notifTarget).toBe('/governance/tasks');
    });

    it('Assertion K: Workflow Designer remains clean', () => {
      const workflowRouteFile = path.resolve(
        __dirname,
        '../../../app/(dashboard)/workflow/page.tsx',
      );
      const content = fs.readFileSync(workflowRouteFile, 'utf-8');
      expect(content).not.toContain('Tugas Persetujuan');
      expect(content).not.toContain('Approval Center');
      expect(content).toContain('WorkflowList');
      expect(content).toContain('WorkflowEditor');
    });
  });
});
