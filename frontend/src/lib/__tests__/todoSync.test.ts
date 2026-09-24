import { shouldRefreshTodos, setupTodoSync } from '../todoSync';

describe('todoSync (N1 Realtime & Reconnect Resync)', () => {
  describe('shouldRefreshTodos', () => {
    it('1. returns true for workflow task events', () => {
      expect(shouldRefreshTodos({ eventName: 'workflow.task.assigned' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'workflow.task.completed' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'workflow.task.returned' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'workflow.instance.completed' })).toBe(true);
    });

    it('2. returns true for procurement packages and project kickoff', () => {
      expect(shouldRefreshTodos({ eventName: 'procurement.package.submitted' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'procurement.package.returned' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'procurement.po.issued' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'project.pm.assigned' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'project.kickoff.executed' })).toBe(true);
    });

    it('3. returns true for legal queue and marketing tender updates', () => {
      expect(shouldRefreshTodos({ eventName: 'legal.queue.updated' })).toBe(true);
      expect(shouldRefreshTodos({ eventName: 'marketing.tender.management_update' })).toBe(true);
    });

    it('4. returns false for irrelevant or missing events', () => {
      expect(shouldRefreshTodos(null)).toBe(false);
      expect(shouldRefreshTodos(undefined)).toBe(false);
      expect(shouldRefreshTodos({ eventName: 'unrelated.event' })).toBe(false);
    });
  });

  describe('setupTodoSync', () => {
    let mockWindow: {
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
    };
    let windowListeners: Record<string, Function>;

    beforeEach(() => {
      windowListeners = {};
      mockWindow = {
        addEventListener: jest.fn((event: string, listener: Function) => {
          windowListeners[event] = listener;
        }),
        removeEventListener: jest.fn((event: string, listener: Function) => {
          if (windowListeners[event] === listener) {
            delete windowListeners[event];
          }
        }),
      };
    });

    it('registers epms:business-sync and epms:reconnect-resync and triggers onRefresh', () => {
      const onRefresh = jest.fn();

      const unsubscribe = setupTodoSync({
        onRefresh,
        targetWindow: mockWindow,
      });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));

      // Trigger business-sync with relevant event
      windowListeners['epms:business-sync']({ detail: { eventName: 'workflow.task.completed' } });
      expect(onRefresh).toHaveBeenCalledTimes(1);

      // Trigger business-sync with irrelevant event (should not trigger refresh)
      windowListeners['epms:business-sync']({ detail: { eventName: 'random.noise' } });
      expect(onRefresh).toHaveBeenCalledTimes(1);

      // Trigger reconnect-resync
      windowListeners['epms:reconnect-resync']();
      expect(onRefresh).toHaveBeenCalledTimes(2);

      // Unsubscribe cleanup
      unsubscribe();
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:business-sync', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('epms:reconnect-resync', expect.any(Function));
    });
  });
});
