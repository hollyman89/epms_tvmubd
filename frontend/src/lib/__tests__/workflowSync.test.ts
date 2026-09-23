import {
  shouldRefreshOperationalPlan,
  shouldRefreshProjectDelivery,
  setupOperationalPlanSync,
  setupProjectDeliverySync,
  CanonicalEventEnvelope,
} from '../workflowSync';

describe('Phase I-B: Workflow Realtime Synchronization Helpers', () => {
  const targetProjectId = 101;

  describe('shouldRefreshOperationalPlan', () => {
    it('1. relevant canonical workflow event with matching projectId refreshes', () => {
      const envelope: CanonicalEventEnvelope = {
        eventName: 'workflow.task.completed',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 50,
        projectId: targetProjectId,
      };
      expect(shouldRefreshOperationalPlan(envelope, targetProjectId)).toBe(true);
    });

    it('1b. canonical workflow.task.returned and workflow.instance.completed refresh', () => {
      expect(
        shouldRefreshOperationalPlan(
          { eventName: 'workflow.task.returned', projectId: targetProjectId },
          targetProjectId
        )
      ).toBe(true);

      expect(
        shouldRefreshOperationalPlan(
          { eventName: 'workflow.instance.completed', projectId: targetProjectId },
          targetProjectId
        )
      ).toBe(true);

      expect(
        shouldRefreshOperationalPlan(
          { eventName: 'workflow.task.assigned', projectId: targetProjectId },
          targetProjectId
        )
      ).toBe(true);
    });

    it('1c. bounded fallback refreshes when projectId is not present in envelope', () => {
      const envelope: CanonicalEventEnvelope = {
        eventName: 'workflow.task.completed',
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: 51,
      };
      expect(shouldRefreshOperationalPlan(envelope, targetProjectId)).toBe(true);
    });

    it('4. unrelated canonical event does NOT refresh', () => {
      expect(
        shouldRefreshOperationalPlan(
          { eventName: 'procurement.po.issued', projectId: targetProjectId },
          targetProjectId
        )
      ).toBe(false);

      expect(
        shouldRefreshOperationalPlan(
          { eventName: 'finance.invoice.verified', projectId: targetProjectId },
          targetProjectId
        )
      ).toBe(false);

      expect(
        shouldRefreshOperationalPlan(
          { eventName: 'finance.payment.recorded', projectId: targetProjectId },
          targetProjectId
        )
      ).toBe(false);
    });

    it('4b. workflow event for a DIFFERENT project does NOT refresh', () => {
      const envelope: CanonicalEventEnvelope = {
        eventName: 'workflow.task.completed',
        projectId: 999, // different project
      };
      expect(shouldRefreshOperationalPlan(envelope, targetProjectId)).toBe(false);
    });

    it('handles null or malformed envelope safely', () => {
      expect(shouldRefreshOperationalPlan(null, targetProjectId)).toBe(false);
      expect(shouldRefreshOperationalPlan(undefined, targetProjectId)).toBe(false);
      expect(shouldRefreshOperationalPlan({} as any, targetProjectId)).toBe(false);
    });
  });

  describe('shouldRefreshProjectDelivery', () => {
    it('3. relevant canonical workflow event refreshes project-delivery page', () => {
      expect(shouldRefreshProjectDelivery({ eventName: 'workflow.task.completed' })).toBe(true);
      expect(shouldRefreshProjectDelivery({ eventName: 'workflow.task.assigned' })).toBe(true);
      expect(shouldRefreshProjectDelivery({ eventName: 'workflow.task.returned' })).toBe(true);
      expect(shouldRefreshProjectDelivery({ eventName: 'workflow.instance.completed' })).toBe(true);
    });

    it('4. unrelated canonical event does NOT refresh project delivery', () => {
      expect(shouldRefreshProjectDelivery({ eventName: 'finance.invoice.verified' })).toBe(false);
      expect(shouldRefreshProjectDelivery({ eventName: 'procurement.po.issued' })).toBe(false);
    });
  });

  describe('setupOperationalPlanSync (used by PmOperationalPlanModal & PmOperationalPlanReviewModal)', () => {
    let mockWindow: {
      listeners: Record<string, Function[]>;
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
    };

    beforeEach(() => {
      mockWindow = {
        listeners: {},
        addEventListener: jest.fn((event: string, fn: Function) => {
          if (!mockWindow.listeners[event]) mockWindow.listeners[event] = [];
          mockWindow.listeners[event].push(fn);
        }),
        removeEventListener: jest.fn((event: string, fn: Function) => {
          if (mockWindow.listeners[event]) {
            mockWindow.listeners[event] = mockWindow.listeners[event].filter((cb) => cb !== fn);
          }
        }),
      };
    });

    it('1 & 2. refreshes modal on relevant canonical workflow event', () => {
      const onRefresh = jest.fn();
      const cleanup = setupOperationalPlanSync({
        canonicalProjectId: targetProjectId,
        onRefresh,
        targetWindow: mockWindow,
      });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));

      // Dispatch relevant workflow sync event
      const handler = mockWindow.listeners['epms:business-sync'][0];
      handler({
        detail: {
          eventName: 'workflow.task.completed',
          projectId: targetProjectId,
        },
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('4. does NOT refresh on unrelated canonical event', () => {
      const onRefresh = jest.fn();
      const cleanup = setupOperationalPlanSync({
        canonicalProjectId: targetProjectId,
        onRefresh,
        targetWindow: mockWindow,
      });

      const handler = mockWindow.listeners['epms:business-sync'][0];
      handler({
        detail: {
          eventName: 'procurement.po.issued',
          projectId: targetProjectId,
        },
      });

      expect(onRefresh).not.toHaveBeenCalled();

      cleanup();
    });

    it('5. reconnect triggers authoritative refresh', () => {
      const onRefresh = jest.fn();
      const cleanup = setupOperationalPlanSync({
        canonicalProjectId: targetProjectId,
        onRefresh,
        targetWindow: mockWindow,
      });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));

      // Trigger reconnect
      const reconnectHandler = mockWindow.listeners['epms:reconnect-resync'][0];
      reconnectHandler();

      expect(onRefresh).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('6. listener cleanup removes both listeners to prevent duplicate handlers', () => {
      const onRefresh = jest.fn();
      const cleanup = setupOperationalPlanSync({
        canonicalProjectId: targetProjectId,
        onRefresh,
        targetWindow: mockWindow,
      });

      cleanup();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));
      expect(mockWindow.listeners['epms:business-sync'].length).toBe(0);
      expect(mockWindow.listeners['epms:reconnect-resync'].length).toBe(0);
    });
  });

  describe('setupProjectDeliverySync', () => {
    let mockWindow: {
      listeners: Record<string, Function[]>;
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
    };

    beforeEach(() => {
      mockWindow = {
        listeners: {},
        addEventListener: jest.fn((event: string, fn: Function) => {
          if (!mockWindow.listeners[event]) mockWindow.listeners[event] = [];
          mockWindow.listeners[event].push(fn);
        }),
        removeEventListener: jest.fn((event: string, fn: Function) => {
          if (mockWindow.listeners[event]) {
            mockWindow.listeners[event] = mockWindow.listeners[event].filter((cb) => cb !== fn);
          }
        }),
      };
    });

    it('3. refreshes project-delivery on relevant canonical workflow event', () => {
      const onRefresh = jest.fn();
      const cleanup = setupProjectDeliverySync({
        onRefresh,
        targetWindow: mockWindow,
      });

      const handler = mockWindow.listeners['epms:business-sync'][0];
      handler({
        detail: {
          eventName: 'workflow.instance.completed',
          projectId: 202,
        },
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('4. does NOT refresh on unrelated event', () => {
      const onRefresh = jest.fn();
      const cleanup = setupProjectDeliverySync({
        onRefresh,
        targetWindow: mockWindow,
      });

      const handler = mockWindow.listeners['epms:business-sync'][0];
      handler({
        detail: {
          eventName: 'finance.invoice.verified',
        },
      });

      expect(onRefresh).not.toHaveBeenCalled();

      cleanup();
    });

    it('5. reconnect triggers authoritative refresh', () => {
      const onRefresh = jest.fn();
      const cleanup = setupProjectDeliverySync({
        onRefresh,
        targetWindow: mockWindow,
      });

      const reconnectHandler = mockWindow.listeners['epms:reconnect-resync'][0];
      reconnectHandler();

      expect(onRefresh).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('6. listener cleanup removes handlers properly', () => {
      const onRefresh = jest.fn();
      const cleanup = setupProjectDeliverySync({
        onRefresh,
        targetWindow: mockWindow,
      });

      cleanup();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));
    });
  });
});
