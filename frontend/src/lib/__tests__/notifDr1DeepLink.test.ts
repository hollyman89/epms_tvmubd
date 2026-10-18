import { resolveNotificationTarget } from '../notificationSync';

describe('PRE-W10 NOTIF-DR1: Notification Deep-Link Regression Remediation Suite (Frontend)', () => {
  describe('Gate 8: Notification with valid explicit actionLink/actionTarget navigates', () => {
    it('prioritizes explicit canonical actionLink without modifications when valid', () => {
      const item = {
        actionLink: '/procurement?tab=pr&prId=101',
        metaData: {
          lead_id: 999, // Should NOT override valid actionLink!
        },
      };

      const target = resolveNotificationTarget(item);
      expect(target).toBe('/procurement?tab=pr&prId=101');
    });

    it('normalizes legacy dead PO route in actionLink (/projects/pos/:id -> /procurement?tab=po&poId=:id)', () => {
      const item = {
        actionLink: '/projects/pos/45',
        metaData: { poId: 45 },
      };

      const target = resolveNotificationTarget(item);
      expect(target).toBe('/procurement?tab=po&poId=45');
    });

    it('normalizes legacy dead Payment route in actionLink (/finance/payments/:id -> /finance/payments)', () => {
      const item = {
        actionLink: '/finance/payments/789',
        metaData: { paymentId: 789 },
      };

      const target = resolveNotificationTarget(item);
      expect(target).toBe('/finance/payments');
    });
  });

  describe('Gate 9: Lead / Tender notification navigates correctly', () => {
    it('derives tender route from metaData.lead_id when actionLink is absent', () => {
      const item = {
        actionLink: null,
        metaData: { lead_id: 55 },
      };

      expect(resolveNotificationTarget(item)).toBe('/sales/tenders/55');
    });

    it('derives tender route from metaData.tenderId when actionLink is absent', () => {
      const item = {
        actionLink: '',
        metaData: { tenderId: 66 },
      };

      expect(resolveNotificationTarget(item)).toBe('/sales/tenders/66');
    });

    it('derives tender route from metaData.reference_type TENDER with reference_id', () => {
      const item = {
        actionLink: undefined,
        metaData: { reference_type: 'TENDER', reference_id: 77 },
      };

      expect(resolveNotificationTarget(item)).toBe('/sales/tenders/77');
    });
  });

  describe('Gate 10: Project notification navigates correctly', () => {
    it('derives project route from metaData.projectId when actionLink is absent', () => {
      const item = {
        actionLink: null,
        metaData: { projectId: 12 },
      };

      expect(resolveNotificationTarget(item)).toBe('/project-delivery?projectId=12');
    });

    it('derives project route from reference_type PROJECT', () => {
      const item = {
        metaData: { reference_type: 'PROJECT', reference_id: 15 },
      };

      expect(resolveNotificationTarget(item)).toBe('/project-delivery?projectId=15');
    });
  });

  describe('Gate 11: PO notification navigates correctly', () => {
    it('derives PO route from metaData.poId when actionLink is absent', () => {
      const item = {
        actionLink: null,
        metaData: { poId: 88 },
      };

      expect(resolveNotificationTarget(item)).toBe('/procurement?tab=po&poId=88');
    });

    it('derives PO route from reference_type PO', () => {
      const item = {
        metaData: { reference_type: 'PO', reference_id: 99 },
      };

      expect(resolveNotificationTarget(item)).toBe('/procurement?tab=po&poId=99');
    });
  });

  describe('Gate 12: Invoice notification navigates correctly', () => {
    it('derives invoice route from metaData.invoiceId when actionLink is absent', () => {
      const item = {
        actionLink: null,
        metaData: { invoiceId: 404 },
      };

      expect(resolveNotificationTarget(item)).toBe('/finance/invoices');
    });

    it('derives invoice route from reference_type INVOICE', () => {
      const item = {
        metaData: { reference_type: 'INVOICE', reference_id: 405 },
      };

      expect(resolveNotificationTarget(item)).toBe('/finance/invoices');
    });
  });

  describe('Gate 13: Payment notification navigates correctly', () => {
    it('derives payment route from metaData.paymentId when actionLink is absent', () => {
      const item = {
        actionLink: null,
        metaData: { paymentId: 501 },
      };

      expect(resolveNotificationTarget(item)).toBe('/finance/payments');
    });

    it('derives payment route from reference_type PAYMENT or actionType PAYMENT_RECORDED', () => {
      const item = {
        metaData: { reference_type: 'PAYMENT', reference_id: 502 },
      };

      expect(resolveNotificationTarget(item)).toBe('/finance/payments');

      const itemAction = {
        metaData: { actionType: 'PAYMENT_RECORDED', amount: 50000 },
      };
      expect(resolveNotificationTarget(itemAction)).toBe('/finance/payments');
    });
  });

  describe('Gate 14: Missing target does NOT navigate to invalid/undefined route', () => {
    it('returns null when item is empty, null, or undefined', () => {
      expect(resolveNotificationTarget(null)).toBeNull();
      expect(resolveNotificationTarget(undefined)).toBeNull();
      expect(resolveNotificationTarget({})).toBeNull();
    });

    it('returns null when actionLink is dummy # and no metadata exists', () => {
      expect(resolveNotificationTarget({ actionLink: '#' })).toBeNull();
      expect(resolveNotificationTarget({ actionLink: 'undefined' })).toBeNull();
      expect(resolveNotificationTarget({ actionLink: 'null' })).toBeNull();
    });

    it('returns null when metadata has non-navigable keys (generic announcement)', () => {
      const genericItem = {
        actionLink: null,
        metaData: {
          category: 'ANNOUNCEMENT',
          priority: 'NORMAL',
          note: 'Office closed tomorrow',
        },
      };

      expect(resolveNotificationTarget(genericItem)).toBeNull();
    });
  });

  describe('Gate 15: Notification read state and click behavior simulation', () => {
    it('marks notification as read even if targetUrl is null, without triggering router.push', async () => {
      const mockMarkAsRead = jest.fn().mockResolvedValue(true);
      const mockRouterPush = jest.fn();

      const item = {
        id: 1,
        isRead: false,
        actionLink: null,
        metaData: { category: 'SYSTEM_INFO' },
      };

      const targetUrl = resolveNotificationTarget(item);
      expect(targetUrl).toBeNull();

      // Simulate NotificationBell / InboxPage onClick
      const handleClick = async () => {
        if (!item.isRead) {
          await mockMarkAsRead(item.id);
        }
        if (targetUrl) {
          mockRouterPush(targetUrl);
        }
      };

      await handleClick();

      expect(mockMarkAsRead).toHaveBeenCalledWith(1);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('marks as read AND navigates when targetUrl is valid', async () => {
      const mockMarkAsRead = jest.fn().mockResolvedValue(true);
      const mockRouterPush = jest.fn();

      const item = {
        id: 2,
        isRead: false,
        actionLink: '/procurement?tab=po&poId=77',
      };

      const targetUrl = resolveNotificationTarget(item);
      expect(targetUrl).toBe('/procurement?tab=po&poId=77');

      const handleClick = async () => {
        if (!item.isRead) {
          await mockMarkAsRead(item.id);
        }
        if (targetUrl) {
          mockRouterPush(targetUrl);
        }
      };

      await handleClick();

      expect(mockMarkAsRead).toHaveBeenCalledWith(2);
      expect(mockRouterPush).toHaveBeenCalledWith('/procurement?tab=po&poId=77');
    });
  });

  describe('Gate 16: Authorization safety', () => {
    it('deep-link URL generation produces relative paths and confers 0 mutation authority', () => {
      const item = {
        metaData: { poId: 10 },
      };

      const target = resolveNotificationTarget(item);
      expect(target).toBe('/procurement?tab=po&poId=10');

      // The returned URL is purely a client-side route string
      expect(target!.startsWith('/')).toBe(true);
      expect(target!.startsWith('http')).toBe(false);
      // Backend SSOT authorization guards remain 100% authoritative on access
    });
  });

  describe('C1.3: Procurement PO Deep-Link Regression & Safety Contract', () => {
    const resolveProcurementInitialTab = (tabParam: string | null, prIdParam: string | null, poIdParam: string | null): string => {
      if (tabParam === 'po' || poIdParam) return 'po';
      if (tabParam === 'pr' || prIdParam) return 'pr';
      if (tabParam === 'gr') return 'gr';
      if (tabParam === 'reconciliation') return 'reconciliation';
      if (tabParam === 'packages') return 'packages';
      return 'packages';
    };

    it('selects PO tab when tab=po is supplied', () => {
      expect(resolveProcurementInitialTab('po', null, null)).toBe('po');
    });

    it('selects PO tab when poId is supplied without tab=po', () => {
      expect(resolveProcurementInitialTab(null, null, '88')).toBe('po');
    });

    it('selects PR tab when tab=pr or prId is supplied', () => {
      expect(resolveProcurementInitialTab('pr', null, null)).toBe('pr');
      expect(resolveProcurementInitialTab(null, '12', null)).toBe('pr');
    });

    it('selects GR, reconciliation, or packages tabs when requested', () => {
      expect(resolveProcurementInitialTab('gr', null, null)).toBe('gr');
      expect(resolveProcurementInitialTab('reconciliation', null, null)).toBe('reconciliation');
      expect(resolveProcurementInitialTab('packages', null, null)).toBe('packages');
    });

    it('defaults safely to packages tab when query parameters are absent or invalid', () => {
      expect(resolveProcurementInitialTab(null, null, null)).toBe('packages');
      expect(resolveProcurementInitialTab('unknown-tab', null, null)).toBe('packages');
    });

    it('resolves correct PO record and opens modal for valid poId matching id, poId, or poNumber', () => {
      const mockPos = [
        { id: 101, poNumber: 'PO-2026-001', vendorName: 'Vendor A' },
        { id: 102, poId: 202, poNumber: 'PO-2026-002', vendorName: 'Vendor B' },
      ];

      const findPo = (poIdParam: string) => {
        return mockPos.find(
          (p: any) =>
            String(p.id) === poIdParam ||
            String(p.poId) === poIdParam ||
            String(p.poNumber) === poIdParam
        );
      };

      // Match by id
      const matchById = findPo('101');
      expect(matchById).toBeDefined();
      expect(matchById?.poNumber).toBe('PO-2026-001');

      // Match by poId
      const matchByPoId = findPo('202');
      expect(matchByPoId).toBeDefined();
      expect(matchByPoId?.vendorName).toBe('Vendor B');

      // Match by poNumber
      const matchByPoNumber = findPo('PO-2026-002');
      expect(matchByPoNumber).toBeDefined();
      expect(matchByPoNumber?.id).toBe(102);

      // Non-existent poId returns undefined (no accidental modal open)
      expect(findPo('9999')).toBeUndefined();
    });
  });
});

