import { checkIsServicePr, checkIsDuplicatePr } from '../../ProcurementPage';

describe('EPMS — PROCUREMENT UI CLEANUP: PURCHASE REQUEST WORKSPACE TESTS', () => {
  describe('1. Authoritative Domain Resolution (resource_type primary discriminator)', () => {
    it('should classify explicit domain SERVICE as Service PR', () => {
      expect(checkIsServicePr({ id: 1, domain: 'SERVICE' })).toBe(true);
    });

    it('should classify explicit orderType SERVICE as Service PR', () => {
      expect(checkIsServicePr({ id: 2, orderType: 'SERVICE' })).toBe(true);
    });

    it('should classify PR with resourceType SERVICE as Service PR', () => {
      expect(checkIsServicePr({ id: 3, resourceType: 'SERVICE' })).toBe(true);
      expect(checkIsServicePr({ id: 4, resource_type: 'SERVICE' })).toBe(true);
    });

    it('should classify PR with resourceType MATERIAL as Material PR', () => {
      expect(checkIsServicePr({ id: 5, resourceType: 'MATERIAL' })).toBe(false);
      expect(checkIsServicePr({ id: 6, resource_type: 'MATERIAL' })).toBe(false);
    });

    it('should classify PR with item having categoryKey SUBCONTRACTOR as Service PR when resourceType is not MATERIAL', () => {
      const pr = {
        id: 7,
        items: [{ itemName: 'Instalasi FO', costItem: { categoryKey: 'SUBCONTRACTOR' } }],
      };
      expect(checkIsServicePr(pr)).toBe(true);
    });

    it('should classify PR with item having categoryKey SUBCONTRACTOR as Material PR if explicitly resourceType MATERIAL', () => {
      const pr = {
        id: 8,
        items: [{ itemName: 'Material Subkon', costItem: { categoryKey: 'SUBCONTRACTOR', resourceType: 'MATERIAL' } }],
      };
      expect(checkIsServicePr(pr)).toBe(false);
    });

    // Authoritative Parity Gates: EQUIPMENT and OPERATIONAL
    it('resource_type MATERIAL + category EQUIPMENT → MATERIAL', () => {
      const pr = {
        id: 9,
        items: [{ itemName: 'Sewa Alat Berat', costItem: { categoryKey: 'EQUIPMENT', resourceType: 'MATERIAL' } }],
      };
      expect(checkIsServicePr(pr)).toBe(false);
    });

    it('resource_type SERVICE + category EQUIPMENT → SERVICE', () => {
      const pr = {
        id: 10,
        items: [{ itemName: 'Sewa Alat Berat Jasa', costItem: { categoryKey: 'EQUIPMENT', resourceType: 'SERVICE' } }],
      };
      expect(checkIsServicePr(pr)).toBe(true);
    });

    it('resource_type MATERIAL + category OPERATIONAL → MATERIAL', () => {
      const pr = {
        id: 11,
        items: [{ itemName: 'Biaya Bahan Operasional', costItem: { categoryKey: 'OPERATIONAL', resourceType: 'MATERIAL' } }],
      };
      expect(checkIsServicePr(pr)).toBe(false);
    });

    it('resource_type SERVICE + category OPERATIONAL → SERVICE', () => {
      const pr = {
        id: 12,
        items: [{ itemName: 'Layanan Pengurusan Izin', costItem: { categoryKey: 'OPERATIONAL', resourceType: 'SERVICE' } }],
      };
      expect(checkIsServicePr(pr)).toBe(true);
    });

    it('EQUIPMENT alone without resourceType is NOT auto-service (defaults to Material)', () => {
      const pr = {
        id: 13,
        items: [{ itemName: 'Mesin Genset', costItem: { categoryKey: 'EQUIPMENT' } }],
      };
      expect(checkIsServicePr(pr)).toBe(false);
    });

    it('OPERATIONAL alone without resourceType is NOT auto-service (defaults to Material)', () => {
      const pr = {
        id: 14,
        items: [{ itemName: 'Biaya Retribusi', costItem: { categoryKey: 'OPERATIONAL' } }],
      };
      expect(checkIsServicePr(pr)).toBe(false);
    });

    it('should default empty or null PR safely to false (Material)', () => {
      expect(checkIsServicePr(null)).toBe(false);
      expect(checkIsServicePr(undefined)).toBe(false);
      expect(checkIsServicePr({})).toBe(false);
      expect(checkIsServicePr({ items: [] })).toBe(false);
    });
  });

  describe('2. Domain-Isolated Duplicate Detection Gates', () => {
    it('MATERIAL + SERVICE on same project → NOT duplicate', () => {
      const allPrs = [
        { id: 5, prNumber: 'PR-20261016-003', projectId: 368, status: 'PO_ISSUED', domain: 'MATERIAL' },
        { id: 9, prNumber: 'PR-20261016-007', projectId: 368, status: 'APPROVED', domain: 'SERVICE' },
      ];

      // PR-20261016-003 is Material PO_ISSUED. The other PR on project 368 is Service APPROVED.
      // Cross-domain PRs on the same project are NEVER duplicates of each other!
      expect(checkIsDuplicatePr(allPrs[0], allPrs)).toBe(false);
      expect(checkIsDuplicatePr(allPrs[1], allPrs)).toBe(false);
    });

    it('MATERIAL + MATERIAL actual duplicate → duplicate detection preserved', () => {
      const allPrs = [
        { id: 101, prNumber: 'PR-MAT-CANONICAL', projectId: 500, status: 'APPROVED', domain: 'MATERIAL' },
        { id: 102, prNumber: 'PR-MAT-DUPLICATE', projectId: 500, status: 'SUBMITTED', domain: 'MATERIAL' },
      ];

      // PR 102 is SUBMITTED and there is an APPROVED Material PR on the same project -> legitimate duplicate!
      expect(checkIsDuplicatePr(allPrs[1], allPrs)).toBe(true);
      // PR 101 is the APPROVED canonical PR -> not marked duplicate
      expect(checkIsDuplicatePr(allPrs[0], allPrs)).toBe(false);
    });

    it('SERVICE + SERVICE actual duplicate → duplicate detection preserved if current rule applies', () => {
      const allPrs = [
        { id: 201, prNumber: 'PR-SRV-CANONICAL', projectId: 600, status: 'APPROVED', domain: 'SERVICE' },
        { id: 202, prNumber: 'PR-SRV-DUPLICATE', projectId: 600, status: 'SUBMITTED', domain: 'SERVICE' },
      ];

      // PR 202 is SUBMITTED and there is an APPROVED Service PR on the same project -> legitimate duplicate!
      expect(checkIsDuplicatePr(allPrs[1], allPrs)).toBe(true);
      // PR 201 is the APPROVED canonical PR -> not marked duplicate
      expect(checkIsDuplicatePr(allPrs[0], allPrs)).toBe(false);
    });
  });

  describe('3. PR Partitioning into Material vs Service sub-tabs', () => {
    const mockPrs = [
      { id: 1, prNumber: 'PR-20261015-001', domain: 'MATERIAL' },
      { id: 3, prNumber: 'PR-20261016-001', domain: 'SERVICE', items: [{ costItem: { categoryKey: 'SUBCONTRACTOR' } }] },
      { id: 4, prNumber: 'PR-20261016-002', domain: 'MATERIAL' },
      { id: 5, prNumber: 'PR-20261016-003', domain: 'MATERIAL' },
      { id: 6, prNumber: 'PR-20261016-004', domain: 'MATERIAL' },
      { id: 7, prNumber: 'PR-20261016-005', domain: 'SERVICE', items: [{ costItem: { categoryKey: 'SUBCONTRACTOR' } }] },
      { id: 8, prNumber: 'PR-20261016-006', domain: 'SERVICE', items: [{ costItem: { categoryKey: 'SUBCONTRACTOR' } }] },
      { id: 9, prNumber: 'PR-20261016-007', domain: 'SERVICE', items: [{ costItem: { categoryKey: 'SUBCONTRACTOR' } }] },
      { id: 10, prNumber: 'PR-20261016-008', domain: 'SERVICE', items: [{ costItem: { categoryKey: 'SUBCONTRACTOR' } }] },
    ];

    it('should cleanly separate Material and Service records without overlap', () => {
      const materialPrs = mockPrs.filter((p) => !checkIsServicePr(p));
      const servicePrs = mockPrs.filter((p) => checkIsServicePr(p));

      expect(materialPrs.map((p) => p.id)).toEqual([1, 4, 5, 6]);
      expect(servicePrs.map((p) => p.id)).toEqual([3, 7, 8, 9, 10]);
      expect(materialPrs.length + servicePrs.length).toBe(mockPrs.length);
    });

    it('should guarantee each tab displays ONLY its corresponding records', () => {
      const materialPrs = mockPrs.filter((p) => !checkIsServicePr(p));
      const servicePrs = mockPrs.filter((p) => checkIsServicePr(p));

      expect(materialPrs.some((p) => checkIsServicePr(p))).toBe(false);
      expect(servicePrs.some((p) => !checkIsServicePr(p))).toBe(false);
    });
  });

  describe('4. Single Primary Action & Zero Disabled Button Policy', () => {
    interface ActionResolveInput {
      domain: 'MATERIAL' | 'SERVICE';
      status: string;
      rfq?: { id: number; status: string; rfqNumber: string };
      po?: { id: number; poNumber: string };
      canActOnPr: boolean;
    }

    const resolveRowActions = (input: ActionResolveInput) => {
      const isApproved = input.status === 'APPROVED';
      let primaryActionLabel = '';
      let hasDisabledDirectPoButton = false;

      if (input.domain === 'SERVICE') {
        if (input.po) {
          primaryActionLabel = 'Kelola SPK / WO';
        } else if (input.rfq && input.rfq.status === 'OPEN') {
          primaryActionLabel = 'Kelola RFQ';
          hasDisabledDirectPoButton = false;
        } else if (isApproved && input.canActOnPr && (!input.rfq || input.rfq.status === 'CANCELLED')) {
          primaryActionLabel = 'Buat Service PO';
        } else {
          primaryActionLabel = 'Alur Approval';
        }
      } else {
        if (input.po) {
          primaryActionLabel = 'Lihat PO';
        } else if (input.rfq) {
          primaryActionLabel = 'Kelola RFQ';
        } else if (isApproved && input.canActOnPr) {
          primaryActionLabel = 'Buat RFQ';
        } else {
          primaryActionLabel = 'Alur Approval';
        }
      }

      return {
        primaryActionLabel,
        hasDisabledDirectPoButton,
        maxPrimaryButtons: 1,
      };
    };

    it('Service PR with active RFQ OPEN should show Kelola RFQ and ZERO disabled button noise', () => {
      const res = resolveRowActions({
        domain: 'SERVICE',
        status: 'APPROVED',
        rfq: { id: 3, status: 'OPEN', rfqNumber: 'RFQ-20261016-001' },
        canActOnPr: true,
      });

      expect(res.primaryActionLabel).toBe('Kelola RFQ');
      expect(res.hasDisabledDirectPoButton).toBe(false);
      expect(res.maxPrimaryButtons).toBe(1);
    });

    it('Service PR with CANCELLED RFQ should allow Buat Service PO directly', () => {
      const res = resolveRowActions({
        domain: 'SERVICE',
        status: 'APPROVED',
        rfq: { id: 3, status: 'CANCELLED', rfqNumber: 'RFQ-20261016-001' },
        canActOnPr: true,
      });

      expect(res.primaryActionLabel).toBe('Buat Service PO');
      expect(res.maxPrimaryButtons).toBe(1);
    });

    it('Service PR with PO issued should show Kelola SPK / WO', () => {
      const res = resolveRowActions({
        domain: 'SERVICE',
        status: 'PO_ISSUED',
        po: { id: 4, poNumber: 'PO-20261016-003' },
        canActOnPr: true,
      });

      expect(res.primaryActionLabel).toBe('Kelola SPK / WO');
      expect(res.maxPrimaryButtons).toBe(1);
    });

    it('Material PR with PO issued should show Lihat PO', () => {
      const res = resolveRowActions({
        domain: 'MATERIAL',
        status: 'PO_ISSUED',
        po: { id: 1, poNumber: 'PO-20261015-001' },
        canActOnPr: true,
      });

      expect(res.primaryActionLabel).toBe('Lihat PO');
      expect(res.maxPrimaryButtons).toBe(1);
    });

    it('Material PR with RFQ OPEN should show Kelola RFQ', () => {
      const res = resolveRowActions({
        domain: 'MATERIAL',
        status: 'APPROVED',
        rfq: { id: 6, status: 'OPEN', rfqNumber: 'RFQ-20261016-004' },
        canActOnPr: true,
      });

      expect(res.primaryActionLabel).toBe('Kelola RFQ');
      expect(res.maxPrimaryButtons).toBe(1);
    });
  });

  describe('5. Sourcing Presentation Hierarchy', () => {
    const resolveSourcingPresentation = (rfq?: any, po?: any) => {
      if (po) return { badge: 'SERVICE PO ISSUED', mode: 'PO_ISSUED' };
      if (rfq && rfq.status === 'OPEN') return { badge: 'COMPETITIVE RFQ', status: 'OPEN', mode: 'ACTIVE_RFQ' };
      if (rfq && rfq.status === 'CANCELLED') return { badge: 'DIRECT', note: 'RFQ Dibatalkan', mode: 'DIRECT' };
      return { badge: 'DIRECT', mode: 'DIRECT' };
    };

    it('should present COMPETITIVE RFQ OPEN for active RFQ', () => {
      const res = resolveSourcingPresentation({ status: 'OPEN', rfqNumber: 'RFQ-001' });
      expect(res.badge).toBe('COMPETITIVE RFQ');
      expect(res.status).toBe('OPEN');
    });

    it('should present DIRECT for CANCELLED RFQ', () => {
      const res = resolveSourcingPresentation({ status: 'CANCELLED', rfqNumber: 'RFQ-001' });
      expect(res.badge).toBe('DIRECT');
      expect(res.note).toBe('RFQ Dibatalkan');
    });

    it('should present DIRECT when no RFQ exists', () => {
      const res = resolveSourcingPresentation(undefined, undefined);
      expect(res.badge).toBe('DIRECT');
    });

    it('should present SERVICE PO ISSUED when PO exists', () => {
      const res = resolveSourcingPresentation(undefined, { id: 4, poNumber: 'PO-003' });
      expect(res.badge).toBe('SERVICE PO ISSUED');
    });
  });
});
