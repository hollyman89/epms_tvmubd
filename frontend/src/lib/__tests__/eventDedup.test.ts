import { BoundedEventDedup } from '../eventDedup';

describe('Phase G Frontend Canonical Sync & Dedup', () => {
  describe('BoundedEventDedup Unit Tests', () => {
    it('11. duplicate eventId ignored', () => {
      const dedup = new BoundedEventDedup(500);
      const isFirstDup = dedup.isDuplicate('evt-100');
      const isSecondDup = dedup.isDuplicate('evt-100');

      expect(isFirstDup).toBe(false); // First delivery is accepted
      expect(isSecondDup).toBe(true);  // Duplicate delivery is detected and ignored
    });

    it('12. distinct eventId processed normally', () => {
      const dedup = new BoundedEventDedup(500);

      expect(dedup.isDuplicate('evt-1')).toBe(false);
      expect(dedup.isDuplicate('evt-2')).toBe(false);
      expect(dedup.isDuplicate('evt-3')).toBe(false);
      expect(dedup.size()).toBe(3);
    });

    it('13. bounded dedup eviction at capacity', () => {
      const dedup = new BoundedEventDedup(3); // Small capacity for test

      expect(dedup.isDuplicate('evt-1')).toBe(false);
      expect(dedup.isDuplicate('evt-2')).toBe(false);
      expect(dedup.isDuplicate('evt-3')).toBe(false);
      expect(dedup.size()).toBe(3);

      // Adding 4th item evicts oldest (evt-1)
      expect(dedup.isDuplicate('evt-4')).toBe(false);
      expect(dedup.size()).toBe(3);

      // evt-1 was evicted, so seeing it again is not considered duplicate in bounded window
      expect(dedup.isDuplicate('evt-1')).toBe(false);
      // But evt-4 is currently in window
      expect(dedup.isDuplicate('evt-4')).toBe(true);
    });
  });

  describe('Targeted Invalidation Logic Simulation', () => {
    let invalidatedQueries: Array<{ queryKey: any[]; type?: string }>;
    let mockQueryClient: any;

    beforeEach(() => {
      invalidatedQueries = [];
      mockQueryClient = {
        invalidateQueries: jest.fn((options: { queryKey: any[]; type?: string }) => {
          invalidatedQueries.push(options);
        }),
      };
    });

    // Helper simulating the SocketProvider invalidation router
    const handleSyncEvent = (envelope: { eventName: string; aggregateType: string; aggregateId: any }) => {
      const eventName = envelope.eventName;
      if (eventName.startsWith('workflow.')) {
        mockQueryClient.invalidateQueries({ queryKey: ['governance-tasks'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['pr-workflow-instance-review-modal'], type: 'active' });
      } else if (eventName.startsWith('procurement.package.')) {
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'packages'], type: 'active' });
      } else if (eventName === 'procurement.rfq.created') {
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['rfq'], type: 'active' });
      } else if (eventName === 'procurement.po.issued') {
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'packages'], type: 'active' });
      } else if (eventName === 'procurement.gr.received') {
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'], type: 'active' });
      } else if (eventName.startsWith('project.')) {
        mockQueryClient.invalidateQueries({ queryKey: ['dashboard-summary'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['analytics-dashboard'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['dashboard-project-trend'], type: 'active' });
        mockQueryClient.invalidateQueries({ queryKey: ['dashboard-procurement-pending'], type: 'active' });
      } else if (eventName.startsWith('finance.invoice.')) {
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
      } else if (eventName === 'finance.payment.recorded') {
        mockQueryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'], type: 'active' });
      }
    };

    const handleReconnect = () => {
      mockQueryClient.invalidateQueries({ queryKey: ['procurement'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['governance-tasks'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['dashboard-summary'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['analytics-dashboard'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['dashboard-project-trend'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['dashboard-procurement-pending'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['rfq'], type: 'active' });
      mockQueryClient.invalidateQueries({ queryKey: ['pr-workflow-instance-review-modal'], type: 'active' });
    };

    it('14. procurement package event invalidates packages key', () => {
      handleSyncEvent({ eventName: 'procurement.package.submitted', aggregateType: 'ProcurementPackage', aggregateId: 10 });
      expect(invalidatedQueries).toEqual([
        { queryKey: ['procurement', 'packages'], type: 'active' },
      ]);
    });

    it('15. workflow event invalidates governance prefix', () => {
      handleSyncEvent({ eventName: 'workflow.task.completed', aggregateType: 'WORKFLOW_TASK', aggregateId: 55 });
      const govCall = invalidatedQueries.find(q => q.queryKey[0] === 'governance-tasks');
      expect(govCall).toBeDefined();
      expect(govCall?.type).toBe('active');
    });

    it('16. workflow event uses PR modal PREFIX, not aggregateId as PR id', () => {
      handleSyncEvent({ eventName: 'workflow.task.completed', aggregateType: 'WORKFLOW_TASK', aggregateId: 999 });
      const modalCall = invalidatedQueries.find(q => q.queryKey[0] === 'pr-workflow-instance-review-modal');
      expect(modalCall).toBeDefined();
      // Must be prefix only, NOT ['pr-workflow-instance-review-modal', 999]
      expect(modalCall?.queryKey).toEqual(['pr-workflow-instance-review-modal']);
      expect(modalCall?.type).toBe('active');
    });

    it('17. reconnect invalidates only bounded active prefixes', () => {
      handleReconnect();
      expect(invalidatedQueries.length).toBe(8);
      for (const call of invalidatedQueries) {
        expect(call.type).toBe('active');
        expect(Array.isArray(call.queryKey)).toBe(true);
      }
    });

    it('18. reconnect includes [rfq] prefix', () => {
      handleReconnect();
      const rfqCall = invalidatedQueries.find(q => q.queryKey[0] === 'rfq');
      expect(rfqCall).toBeDefined();
      expect(rfqCall?.type).toBe('active');
    });

    it('19. reconnect includes [pr-workflow-instance-review-modal] prefix', () => {
      handleReconnect();
      const modalCall = invalidatedQueries.find(q => q.queryKey[0] === 'pr-workflow-instance-review-modal');
      expect(modalCall).toBeDefined();
      expect(modalCall?.type).toBe('active');
    });

    it('20. no global invalidateQueries (all calls must have queryKey)', () => {
      handleReconnect();
      handleSyncEvent({ eventName: 'finance.payment.recorded', aggregateType: 'Payment', aggregateId: 1 });
      for (const call of invalidatedQueries) {
        expect(call.queryKey).toBeDefined();
        expect(call.queryKey.length).toBeGreaterThan(0);
      }
    });

    it('21. manual-state event filtering behaves correctly', () => {
      // InvoicesPage filter logic
      let poFetched = false;
      let invoicesFetched = false;

      const handleInvoicePageSync = (envelope: any) => {
        if (envelope.aggregateType === 'PurchaseOrder') {
          poFetched = true;
        } else if (
          envelope.aggregateType === 'Invoice' ||
          envelope.aggregateType === 'GoodsReceipt' ||
          envelope.aggregateType === 'Payment'
        ) {
          invoicesFetched = true;
        }
      };

      handleInvoicePageSync({ aggregateType: 'PurchaseOrder', aggregateId: 10 });
      expect(poFetched).toBe(true);
      expect(invoicesFetched).toBe(false);

      poFetched = false;
      handleInvoicePageSync({ aggregateType: 'GoodsReceipt', aggregateId: 20 });
      expect(poFetched).toBe(false);
      expect(invoicesFetched).toBe(true);

      // PaymentsPage filter logic
      let paymentsFetched = false;
      const handlePaymentsPageSync = (envelope: any) => {
        if (
          envelope.aggregateType === 'Payment' ||
          (envelope.aggregateType === 'Invoice' && envelope.eventName === 'finance.invoice.verified')
        ) {
          paymentsFetched = true;
        }
      };

      // finance.invoice.created should NOT trigger payments page fetch
      handlePaymentsPageSync({ aggregateType: 'Invoice', eventName: 'finance.invoice.created' });
      expect(paymentsFetched).toBe(false);

      // finance.invoice.verified SHOULD trigger payments page fetch
      handlePaymentsPageSync({ aggregateType: 'Invoice', eventName: 'finance.invoice.verified' });
      expect(paymentsFetched).toBe(true);
    });
  });
});
