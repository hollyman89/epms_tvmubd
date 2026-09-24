import { normalizeNodes, normalizeEdges } from '../workflow-normalizer';

describe('Workflow Designer Marketing Capability & TaskKey Normalization', () => {
  describe('Workflow Normalizer with taskKey and Marketing workflow node data', () => {
    it('1. should preserve explicit taskKey, label, and assignedRole when normalizing nodes', () => {
      const rawNodes = [
        {
          id: 'node_start',
          type: 'START',
          position: { x: 100, y: 200 },
          data: { label: 'Start', type: 'START' },
        },
        {
          id: 'node_go_nogo',
          type: 'APPROVAL',
          position: { x: 350, y: 200 },
          data: {
            label: 'Go/No-Go Approval',
            taskKey: 'GO_NOGO_APPROVAL',
            assignedRole: 'DIRECTOR',
            slaDays: 3,
            type: 'APPROVAL',
          },
        },
        {
          id: 'node_end',
          type: 'END',
          position: { x: 600, y: 200 },
          data: { label: 'End', type: 'END' },
        },
      ];

      const normalized = normalizeNodes(rawNodes);
      expect(normalized).toHaveLength(3);

      const approvalNode = normalized.find((n) => n.id === 'node_go_nogo');
      expect(approvalNode).toBeDefined();
      expect(approvalNode?.data.taskKey).toBe('GO_NOGO_APPROVAL');
      expect(approvalNode?.data.label).toBe('Go/No-Go Approval');
      expect(approvalNode?.data.assignedRole).toBe('DIRECTOR');
      expect(approvalNode?.data.slaDays).toBe(3);
    });

    it('2. should preserve existing canonical workflow definitions without taskKey', () => {
      const canonicalNodes = [
        {
          id: 'node_start',
          type: 'customNode',
          position: { x: 100, y: 200 },
          data: { role: 'PROJECT_MANAGER', type: 'START', label: 'PM Submit Plan' },
        },
        {
          id: 'node_hops_review',
          type: 'customNode',
          position: { x: 300, y: 200 },
          data: { role: 'HEAD_OF_OPERATIONS', type: 'TASK', label: 'Head of Operations Review' },
        },
        {
          id: 'node_end',
          type: 'customNode',
          position: { x: 1300, y: 200 },
          data: { type: 'END', label: 'Ready for Kickoff' },
        },
      ];

      const normalized = normalizeNodes(canonicalNodes);
      expect(normalized).toHaveLength(3);

      const hopsNode = normalized.find((n) => n.id === 'node_hops_review');
      expect(hopsNode?.data.role).toBe('HEAD_OF_OPERATIONS');
      expect(hopsNode?.data.label).toBe('Head of Operations Review');
      expect(hopsNode?.data.taskKey).toBeUndefined();
    });

    it('3. should correctly normalize edges between nodes', () => {
      const rawEdges = [
        { id: 'e1', source: 'node_start', target: 'node_go_nogo' },
        { id: 'e2', source: 'node_go_nogo', target: 'node_end', label: 'APPROVED' },
      ];

      const normalized = normalizeEdges(rawEdges);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].source).toBe('node_start');
      expect(normalized[0].target).toBe('node_go_nogo');
      expect(normalized[1].label).toBe('APPROVED');
    });
  });

  describe('Task Key Machine Identifier Validation Regex Contract', () => {
    const taskKeyPattern = /^[A-Z0-9_]*$/;

    it('should accept valid uppercase machine keys', () => {
      expect(taskKeyPattern.test('GO_NOGO_APPROVAL')).toBe(true);
      expect(taskKeyPattern.test('APPROVAL_1')).toBe(true);
      expect(taskKeyPattern.test('PR_REVIEW')).toBe(true);
      expect(taskKeyPattern.test('')).toBe(true); // Optional
    });

    it('should reject invalid keys with lowercase, spaces, or special symbols', () => {
      expect(taskKeyPattern.test('go_nogo_approval')).toBe(false);
      expect(taskKeyPattern.test('Go/No-Go Approval')).toBe(false);
      expect(taskKeyPattern.test('GO-NOGO-APPROVAL')).toBe(false);
      expect(taskKeyPattern.test('APPROVAL 1')).toBe(false);
    });
  });
});
