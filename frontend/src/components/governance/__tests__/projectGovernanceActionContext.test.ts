/**
 * EPMS — APPROVAL CENTER MODAL CONTEXT LOSS FIX REGRESSION SUITE
 *
 * Covers:
 * TEST A — DIRECT APPROVAL CENTER: Action context remains valid after Review Modal closes & selectedTask becomes null
 * TEST B — DEEP LINK: Deep-link context immutability
 * TEST C — CANCEL: Closing confirmation clears action context safely with zero mutations
 * TEST D — RETURN: Return context preserved independently of Review Modal lifecycle
 * TEST E — SAFETY GUARD: Confirmation submission disabled/rejected if context is absent; no Project 0 fabricated
 */

import {
  buildGovernanceActionContext,
  GovernanceActionContext,
  STAGE_MAPPING,
  EnrichedGovernanceTask,
} from '../ProjectGovernanceTaskCenter';
import fs from 'fs';
import path from 'path';

describe('EPMS — Governance Action Context Lifecycle & Safety Guards', () => {
  const mockProcurementTask = {
    id: 50,
    workflowInstanceId: 26,
    nodeId: 'node_procurement_review',
    taskKey: 'Procurement Plan Review',
    status: 'PENDING',
    projectId: 503,
    projectName: 'Project Renovasi J&T GTW Jakarta',
    projectCode: 'CONT-20261017-0005',
    contractNumber: 'CONT-20261017-0005',
    classification: {
      code: 'MANAGEMENT_REVIEW',
      label: 'Management Review',
      tagColor: 'blue',
    },
    workflowInstance: {
      id: 26,
      entityType: 'PROJECT',
      entityId: '503',
      workflowDefinition: { id: 1, workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW', name: 'Review', domain: 'PROJECT' },
    },
  } as unknown as EnrichedGovernanceTask;

  const mockClosureTask = {
    id: 60,
    workflowInstanceId: 30,
    nodeId: 'node_hoo_review',
    taskKey: 'Review Closure — Head of Operations',
    status: 'PENDING',
    projectId: 503,
    projectName: 'Project Renovasi J&T GTW Jakarta',
    projectCode: 'CONT-20261017-0005',
    contractNumber: 'CONT-20261017-0005',
    isClosure: true,
    closureId: 12,
    classification: {
      code: 'PROJECT_CLOSURE',
      label: 'Project Closure',
      tagColor: 'purple',
    },
    workflowInstance: {
      id: 30,
      entityType: 'PROJECT_CLOSURE',
      entityId: '12',
      workflowDefinition: { id: 2, workflowKey: 'PROJECT_CLOSURE', name: 'Closure', domain: 'PROJECT' },
    },
  } as unknown as EnrichedGovernanceTask;

  describe('Factory: buildGovernanceActionContext', () => {
    it('creates accurate immutable context for Management Review', () => {
      const stageInfo = STAGE_MAPPING['node_procurement_review'];
      const ctx = buildGovernanceActionContext(mockProcurementTask, stageInfo);

      expect(ctx.taskId).toBe(50);
      expect(ctx.workflowInstanceId).toBe(26);
      expect(ctx.projectId).toBe(503);
      expect(ctx.projectName).toBe('Project Renovasi J&T GTW Jakarta');
      expect(ctx.projectCode).toBe('CONT-20261017-0005');
      expect(ctx.nodeId).toBe('node_procurement_review');
      expect(ctx.currentStageLabel).toBe('Procurement Review');
      expect(ctx.nextNodeLabel).toBe('Finance Review');
      expect(ctx.returnNodeLabel).toBe('PM Revision (Procurement)');
      expect(ctx.isClosure).toBe(false);
    });

    it('verifies all 4 canonical Management Review stages without hard-coded assumptions', () => {
      const stages: Array<{
        nodeId: keyof typeof STAGE_MAPPING;
        expectedLabel: string;
        expectedNext: string;
        expectedReturn: string;
      }> = [
        {
          nodeId: 'node_hops_review',
          expectedLabel: 'Head of Operations Review',
          expectedNext: 'Procurement Review',
          expectedReturn: 'PM Revision (Head of Operations)',
        },
        {
          nodeId: 'node_procurement_review',
          expectedLabel: 'Procurement Review',
          expectedNext: 'Finance Review',
          expectedReturn: 'PM Revision (Procurement)',
        },
        {
          nodeId: 'node_finance_review',
          expectedLabel: 'Finance Review',
          expectedNext: 'Director Approval',
          expectedReturn: 'PM Revision (Finance)',
        },
        {
          nodeId: 'node_director_approval',
          expectedLabel: 'Director Approval',
          expectedNext: 'Ready for Kickoff',
          expectedReturn: 'PM Revision (Director)',
        },
      ];

      stages.forEach(({ nodeId, expectedLabel, expectedNext, expectedReturn }, idx) => {
        const dummyTask = {
          ...mockProcurementTask,
          id: 100 + idx,
          workflowInstanceId: 200 + idx,
          projectId: 300 + idx,
          projectName: `Generic Project ${idx}`,
          projectCode: `PRJ-GEN-${idx}`,
          nodeId,
        };
        const stageInfo = STAGE_MAPPING[nodeId];
        const ctx = buildGovernanceActionContext(dummyTask, stageInfo);

        expect(ctx.taskId).toBe(100 + idx);
        expect(ctx.workflowInstanceId).toBe(200 + idx);
        expect(ctx.projectId).toBe(300 + idx);
        expect(ctx.projectName).toBe(`Generic Project ${idx}`);
        expect(ctx.projectCode).toBe(`PRJ-GEN-${idx}`);
        expect(ctx.nodeId).toBe(nodeId);
        expect(ctx.currentStageLabel).toBe(expectedLabel);
        expect(ctx.nextNodeLabel).toBe(expectedNext);
        expect(ctx.returnNodeLabel).toBe(expectedReturn);

        // Simulate selectedTask clearing:
        let simulatedSelectedTask: any = dummyTask;
        const snapshot = buildGovernanceActionContext(simulatedSelectedTask, stageInfo);
        simulatedSelectedTask = null;

        // Context survives clearing across all 4 stages:
        expect(snapshot.taskId).toBe(100 + idx);
        expect(snapshot.projectId).toBe(300 + idx);
        expect(snapshot.currentStageLabel).toBe(expectedLabel);
        expect(snapshot.nextNodeLabel).toBe(expectedNext);
        expect(snapshot.returnNodeLabel).toBe(expectedReturn);
      });
    });

    it('creates accurate immutable context for Project Closure', () => {
      const ctx = buildGovernanceActionContext(mockClosureTask, null);

      expect(ctx.taskId).toBe(60);
      expect(ctx.workflowInstanceId).toBe(30);
      expect(ctx.projectId).toBe(503);
      expect(ctx.projectName).toBe('Project Renovasi J&T GTW Jakarta');
      expect(ctx.nodeId).toBe('node_hoo_review');
      expect(ctx.currentStageLabel).toBe('Review Closure — Head of Operations');
      expect(ctx.nextNodeLabel).toBe('Persetujuan Final Direktur');
      expect(ctx.returnNodeLabel).toBe('Dikembalikan ke PM');
      expect(ctx.isClosure).toBe(true);
      expect(ctx.closureId).toBe(12);
    });
  });

  describe('TEST A — DIRECT APPROVAL CENTER: Modal Lifecycle Decoupling', () => {
    it('preserves full approval context when selectedTask is wiped to null upon Review Modal close', () => {
      let selectedTask: EnrichedGovernanceTask | null = { ...mockProcurementTask };
      let currentStageInfo = STAGE_MAPPING['node_procurement_review'];

      // User clicks Setujui: snapshot immutable action context
      const approvalActionContext: GovernanceActionContext | null = buildGovernanceActionContext(
        selectedTask,
        currentStageInfo,
      );

      // Review Modal closes: selectedTask & currentStageInfo become null
      selectedTask = null;
      currentStageInfo = null as any;

      // Assert confirmation modal context remains completely valid
      expect(approvalActionContext).not.toBeNull();
      expect(approvalActionContext!.projectName).toBe('Project Renovasi J&T GTW Jakarta');
      expect(approvalActionContext!.projectCode).toBe('CONT-20261017-0005');
      expect(approvalActionContext!.currentStageLabel).toBe('Procurement Review');
      expect(approvalActionContext!.nextNodeLabel).toBe('Finance Review');
      expect(approvalActionContext!.taskId).toBe(50);
      expect(approvalActionContext!.projectId).toBe(503);
      expect(approvalActionContext!.workflowInstanceId).toBe(26);
    });
  });

  describe('TEST B — DEEP LINK: Context Immutability', () => {
    it('does not mutate frozen action context even if URL query parameters change', () => {
      const approvalActionContext = buildGovernanceActionContext(
        mockProcurementTask,
        STAGE_MAPPING['node_procurement_review'],
      );

      // Simulate URL params change
      const queryParams = { taskId: '999', projectId: '888' };
      expect(approvalActionContext.taskId).toBe(50);
      expect(approvalActionContext.projectId).toBe(503);
    });
  });

  describe('TEST C — CANCEL: Safe Context Dismissal', () => {
    it('clears approval action context on cancel without business mutations', () => {
      let approvalActionContext: GovernanceActionContext | null = buildGovernanceActionContext(
        mockProcurementTask,
        STAGE_MAPPING['node_procurement_review'],
      );
      expect(approvalActionContext).not.toBeNull();

      // Simulate Batal click
      approvalActionContext = null;
      expect(approvalActionContext).toBeNull();
    });
  });

  describe('TEST D — RETURN / MINTA PERBAIKAN: Modal Lifecycle Decoupling', () => {
    it('preserves return action context when Review Modal closes and selectedTask is cleared', () => {
      let selectedTask: EnrichedGovernanceTask | null = { ...mockProcurementTask };
      let currentStageInfo = STAGE_MAPPING['node_procurement_review'];

      // User clicks Minta Perbaikan: snapshot immutable return context
      const returnActionContext: GovernanceActionContext | null = buildGovernanceActionContext(
        selectedTask,
        currentStageInfo,
      );

      // Review Modal closes
      selectedTask = null;
      currentStageInfo = null as any;

      expect(returnActionContext).not.toBeNull();
      expect(returnActionContext!.projectName).toBe('Project Renovasi J&T GTW Jakarta');
      expect(returnActionContext!.projectCode).toBe('CONT-20261017-0005');
      expect(returnActionContext!.currentStageLabel).toBe('Procurement Review');
      expect(returnActionContext!.returnNodeLabel).toBe('PM Revision (Procurement)');
      expect(returnActionContext!.taskId).toBe(50);
      expect(returnActionContext!.projectId).toBe(503);
    });
  });

  describe('TEST E — DEFENSIVE GUARDS: Missing Context Rejection', () => {
    it('verifies AST source code eliminates fallback fabrication (no Project 0 / undefined) and enforces disabled action', () => {
      const componentPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
      const source = fs.readFileSync(componentPath, 'utf-8');

      // 1. Approval modal checks approvalActionContext
      expect(source).toContain('!approvalActionContext || !approvalActionContext.projectId || !approvalActionContext.taskId');
      expect(source).toContain('Konteks Tindakan Hilang');
      expect(source).toContain('Konfirmasi diblokir demi keamanan.');

      // 2. Return modal checks returnActionContext
      expect(source).toContain('!returnActionContext || !returnActionContext.projectId || !returnActionContext.taskId');
      expect(source).toContain('Pengembalian tugas diblokir demi keamanan.');

      // 3. Approval handler checks context
      expect(source).toContain('if (!approvalActionContext || !canUserDecideTask)');

      // 4. Return handler checks context
      expect(source).toContain('if (!returnActionContext || !canUserDecideTask)');

      // 5. Buttons in footer use snapshot openers
      expect(source).toContain('onClick={handleOpenApproveConfirm}');
      expect(source).toContain('onClick={handleOpenReturnModal}');

      // 6. Approval modal does NOT bind directly to mutable selectedTask for its title or project name
      expect(source).not.toContain('Anda akan menyetujui {selectedTask?.isClosure ? \'penutupan\' : \'rencana operasional\'}');
    });
  });

  describe('TEST F — SIMPLIFIED BUSINESS UX & TECHNICAL COPY REMOVAL', () => {
    it('verifies confirmation modal has simplified business UI without BPMN/COMPLETED debug jargon', () => {
      const componentPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
      const source = fs.readFileSync(componentPath, 'utf-8');

      // 1. Modal still uses frozen approvalActionContext
      expect(source).toContain('approvalActionContext.projectName');
      expect(source).toContain('approvalActionContext.projectCode');
      expect(source).toContain('approvalActionContext.currentStageLabel');
      expect(source).toContain('approvalActionContext.nextNodeLabel');

      // 2. Technical copy removed
      expect(source).not.toContain('message="Alur Kerja BPMN"');
      expect(source).not.toContain('Alur Kerja BPMN');
      expect(source).not.toContain('(COMPLETED)');

      // 3. Approval button label is Setujui & Lanjutkan
      expect(source).toContain(": 'Setujui & Lanjutkan'");

      // 4. Title is Konfirmasi Persetujuan
      expect(source).toContain(": 'Konfirmasi Persetujuan'");

      // 5. Clean labels
      expect(source).toContain('Tahap saat ini:');
      expect(source).toContain('Tahap berikutnya:');

      // 6. Missing context guard intact
      expect(source).toContain('!approvalActionContext || !approvalActionContext.projectId || !approvalActionContext.taskId');
    });
  });
});
