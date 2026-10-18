import { shouldRefreshLegalReview, setupLegalReviewSync } from '../legalSync';
import { shouldRefreshProjectDelivery } from '../workflowSync';
import { shouldRefreshTodos } from '../todoSync';

describe('EPMS — W8-CP3: Frontend Realtime LegalSync & WorkflowSync Gate', () => {
  describe('1. shouldRefreshLegalReview Predicate', () => {
    it('returns true for legal contract lifecycle events', () => {
      expect(shouldRefreshLegalReview({ eventName: 'legal.contract.approved' })).toBe(true);
      expect(shouldRefreshLegalReview({ eventName: 'legal.contract.revision_requested' })).toBe(true);
      expect(shouldRefreshLegalReview({ eventName: 'legal.contract.rejected' })).toBe(true);
    });

    it('returns true for marketing.spk.uploaded', () => {
      expect(shouldRefreshLegalReview({ eventName: 'marketing.spk.uploaded' })).toBe(true);
    });

    it('returns true for system SLA events affecting legal review', () => {
      expect(shouldRefreshLegalReview({ eventName: 'system.sla.grace_extended' })).toBe(true);
      expect(shouldRefreshLegalReview({ eventName: 'system.sla.revision_expired' })).toBe(true);
    });

    it('returns false for unrelated events or missing envelopes', () => {
      expect(shouldRefreshLegalReview(null)).toBe(false);
      expect(shouldRefreshLegalReview(undefined)).toBe(false);
      expect(shouldRefreshLegalReview({ eventName: 'procurement.po.issued' })).toBe(false);
      expect(shouldRefreshLegalReview({ eventName: 'finance.payment.recorded' })).toBe(false);
    });
  });

  describe('2. setupLegalReviewSync Lifecycle & Events', () => {
    let mockWindow: {
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
    };
    let listeners: Record<string, Function>;

    beforeEach(() => {
      listeners = {};
      mockWindow = {
        addEventListener: jest.fn((event: string, fn: Function) => {
          listeners[event] = fn;
        }),
        removeEventListener: jest.fn((event: string, fn: Function) => {
          if (listeners[event] === fn) {
            delete listeners[event];
          }
        }),
      };
    });

    it('triggers onRefresh when relevant business:sync event arrives', () => {
      const onRefresh = jest.fn();
      const cleanup = setupLegalReviewSync({ onRefresh, targetWindow: mockWindow });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));

      // Emit canonical legal event
      listeners['epms:business-sync']({
        detail: {
          eventId: 'evt-legal-01',
          eventName: 'legal.contract.approved',
        },
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);

      cleanup();
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));
    });

    it('triggers onRefresh on reconnect-resync', () => {
      const onRefresh = jest.fn();
      const cleanup = setupLegalReviewSync({ onRefresh, targetWindow: mockWindow });

      listeners['epms:reconnect-resync']();
      expect(onRefresh).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('does NOT trigger onRefresh for unrelated domain events', () => {
      const onRefresh = jest.fn();
      const cleanup = setupLegalReviewSync({ onRefresh, targetWindow: mockWindow });

      listeners['epms:business-sync']({
        detail: {
          eventId: 'evt-proc-01',
          eventName: 'procurement.package.submitted',
        },
      });

      expect(onRefresh).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('3. shouldRefreshProjectDelivery Predicate (Migrated Pre-Kickoff)', () => {
    it('returns true for legal.contract.approved so PMO sees approved contracts immediately', () => {
      expect(shouldRefreshProjectDelivery({ eventName: 'legal.contract.approved' })).toBe(true);
    });

    it('returns true for project lifecycle events', () => {
      expect(shouldRefreshProjectDelivery({ eventName: 'project.pm.assigned' })).toBe(true);
      expect(shouldRefreshProjectDelivery({ eventName: 'project.kickoff.executed' })).toBe(true);
    });

    it('returns true for workflow events', () => {
      expect(shouldRefreshProjectDelivery({ eventName: 'workflow.task.completed' })).toBe(true);
    });

    it('returns false for unrelated procurement or finance events', () => {
      expect(shouldRefreshProjectDelivery({ eventName: 'finance.payment.recorded' })).toBe(false);
      expect(shouldRefreshProjectDelivery({ eventName: 'procurement.rfq.created' })).toBe(false);
    });
  });

  describe('4. shouldRefreshTodos Predicate', () => {
    it('returns true for marketing.spk.uploaded', () => {
      expect(shouldRefreshTodos({ eventName: 'marketing.spk.uploaded' })).toBe(true);
    });

    it('returns true for legal and marketing tender events', () => {
      expect(shouldRefreshTodos({ eventName: 'legal.contract.approved' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'marketing.tender.won' })).toBe(true);
    });
  });
});
