import { isPmEditableWorkflowState, getCanonicalStatusColor } from '../workflowUiHelpers';

describe('workflowUiHelpers', () => {
  describe('isPmEditableWorkflowState', () => {
    it('should return true strictly for PM_PLANNING', () => {
      expect(isPmEditableWorkflowState({ nodeKey: 'PM_PLANNING', status: 'ACTIVE' })).toBe(true);
    });

    it('should return true strictly for PM_REVISION', () => {
      expect(isPmEditableWorkflowState({ nodeKey: 'PM_REVISION', status: 'REVISION_REQUESTED' })).toBe(true);
    });

    it('should return false for downstream governance review stages', () => {
      expect(isPmEditableWorkflowState({ nodeKey: 'HOPS_REVIEW', status: 'ACTIVE' })).toBe(false);
      expect(isPmEditableWorkflowState({ nodeKey: 'PROCUREMENT_REVIEW', status: 'ACTIVE' })).toBe(false);
      expect(isPmEditableWorkflowState({ nodeKey: 'FINANCE_REVIEW', status: 'ACTIVE' })).toBe(false);
      expect(isPmEditableWorkflowState({ nodeKey: 'DIRECTOR_APPROVAL', status: 'ACTIVE' })).toBe(false);
    });

    it('should return false for terminal COMPLETED stage', () => {
      expect(isPmEditableWorkflowState({ nodeKey: 'COMPLETED', status: 'COMPLETED' })).toBe(false);
    });

    it('should fail closed (return false) for unknown, null, or undefined', () => {
      expect(isPmEditableWorkflowState({ nodeKey: 'UNKNOWN_NODE', status: 'UNKNOWN' })).toBe(false);
      expect(isPmEditableWorkflowState(null)).toBe(false);
      expect(isPmEditableWorkflowState(undefined)).toBe(false);
      expect(isPmEditableWorkflowState({})).toBe(false);
    });
  });

  describe('getCanonicalStatusColor', () => {
    it('should map COMPLETED to success', () => {
      const res = getCanonicalStatusColor('COMPLETED');
      expect(res.tagColor).toBe('success');
      expect(res.bg).toBe('#f0fdf4');
    });

    it('should map ACTIVE to processing', () => {
      const res = getCanonicalStatusColor('ACTIVE');
      expect(res.tagColor).toBe('processing');
      expect(res.bg).toBe('#eff6ff');
    });

    it('should map WAITING to default', () => {
      const res = getCanonicalStatusColor('WAITING');
      expect(res.tagColor).toBe('default');
      expect(res.bg).toBe('#f8fafc');
    });

    it('should map REVISION_REQUESTED to warning', () => {
      const res = getCanonicalStatusColor('REVISION_REQUESTED');
      expect(res.tagColor).toBe('warning');
      expect(res.bg).toBe('#fffbeb');
    });

    it('should map UNKNOWN and undefined to error (fail-safe)', () => {
      expect(getCanonicalStatusColor('UNKNOWN').tagColor).toBe('error');
      expect(getCanonicalStatusColor(undefined).tagColor).toBe('error');
      expect(getCanonicalStatusColor('RANDOM_INVALID').tagColor).toBe('error');
    });
  });
});
