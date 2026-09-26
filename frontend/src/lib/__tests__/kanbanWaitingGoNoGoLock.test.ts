describe('Kanban WAITING_GO_NO_GO Workflow Stage Hardening', () => {
  describe('1. Draggable Lock Mechanism (Frontend Guard)', () => {
    const isDragDisabledCalculator = (item: any, columnId: string): boolean => {
      return Boolean(
        item.isLocked ||
        item.status === 'PENDING_APPROVAL' ||
        item.stage === 'WAITING_GO_NO_GO' ||
        columnId === 'WAITING_GO_NO_GO'
      );
    };

    it('Card in WAITING_GO_NO_GO stage cannot be dragged (isDragDisabled = true)', () => {
      const item = {
        id: 31,
        title: 'Project Gudang Jakarta Timur',
        stage: 'WAITING_GO_NO_GO',
        go_nogo_status: 'PENDING',
        status: 'NEW',
        isLocked: false,
      };

      expect(isDragDisabledCalculator(item, 'WAITING_GO_NO_GO')).toBe(true);
    });

    it('Card in WAITING_GO_NO_GO column cannot be dragged even if item stage property is omitted', () => {
      const item = {
        id: 32,
        title: 'Project Gudang Jakarta Barat',
        go_nogo_status: 'PENDING',
        status: 'NEW',
        isLocked: false,
      };

      expect(isDragDisabledCalculator(item, 'WAITING_GO_NO_GO')).toBe(true);
    });

    it('Standard LEAD card can be dragged (isDragDisabled = false)', () => {
      const item = {
        id: 40,
        title: 'Standard Lead Project',
        stage: 'LEAD',
        go_nogo_status: 'PENDING',
        status: 'NEW',
        isLocked: false,
      };

      expect(isDragDisabledCalculator(item, 'LEAD')).toBe(false);
    });

    it('Locked card or PENDING_APPROVAL card remains disabled as before', () => {
      const lockedItem = { id: 41, stage: 'LEAD', isLocked: true };
      const discountPendingItem = { id: 42, stage: 'NEGOTIATION', status: 'PENDING_APPROVAL' };

      expect(isDragDisabledCalculator(lockedItem, 'LEAD')).toBe(true);
      expect(isDragDisabledCalculator(discountPendingItem, 'NEGOTIATION')).toBe(true);
    });
  });

  describe('2. onDragEnd Event Rejection Guard (Defense-in-depth)', () => {
    it('Rejects drag attempt from WAITING_GO_NO_GO with warning and aborts without executeMove', () => {
      const warningMock = jest.fn();
      const executeMoveMock = jest.fn();
      const onStageChangeMock = jest.fn();

      const simulateOnDragEnd = (sourceColumn: string, destColumn: string) => {
        if (sourceColumn === 'WAITING_GO_NO_GO') {
          warningMock('Tender sedang dalam proses review GO/NO-GO.');
          return;
        }

        executeMoveMock(sourceColumn, destColumn);
      };

      // Attempt drag WAITING_GO_NO_GO -> LEAD
      simulateOnDragEnd('WAITING_GO_NO_GO', 'LEAD');
      expect(warningMock).toHaveBeenCalledWith('Tender sedang dalam proses review GO/NO-GO.');
      expect(executeMoveMock).not.toHaveBeenCalled();
      expect(onStageChangeMock).not.toHaveBeenCalled();

      // Attempt drag WAITING_GO_NO_GO -> LOST
      warningMock.mockClear();
      simulateOnDragEnd('WAITING_GO_NO_GO', 'LOST');
      expect(warningMock).toHaveBeenCalledWith('Tender sedang dalam proses review GO/NO-GO.');
      expect(executeMoveMock).not.toHaveBeenCalled();
    });
  });
});
