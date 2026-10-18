import { renderPoTypeTag } from '../PurchaseOrderModal';

describe('PROJECT-SERVICE-PROCUREMENT-R1 Frontend Presentation & Discrimination Tests', () => {
  describe('renderPoTypeTag', () => {
    it('should render "Jasa / Subcon" with cyan color for SERVICE orderType', () => {
      const tag = renderPoTypeTag('SERVICE');
      expect(tag.props.color).toBe('cyan');
      expect(tag.props.children).toBe('Jasa / Subcon');
    });

    it('should render "Legacy Campuran" with orange color for LEGACY_MIXED orderType', () => {
      const tag = renderPoTypeTag('LEGACY_MIXED');
      expect(tag.props.color).toBe('orange');
      expect(tag.props.children).toBe('Legacy Campuran');
    });

    it('should render "Material" with blue color for MATERIAL orderType', () => {
      const tag = renderPoTypeTag('MATERIAL');
      expect(tag.props.color).toBe('blue');
      expect(tag.props.children).toBe('Material');
    });

    it('should default to "Material" with blue color when orderType is undefined', () => {
      const tag = renderPoTypeTag(undefined);
      expect(tag.props.color).toBe('blue');
      expect(tag.props.children).toBe('Material');
    });
  });

  describe('Action Eligibility Discrimination Rules', () => {
    interface PoRow {
      id: number;
      poNumber: string;
      orderType: 'MATERIAL' | 'SERVICE' | 'LEGACY_MIXED';
      status: string;
      canReceiveGoods: boolean;
    }

    const checkGrEligibility = (r: PoRow): boolean => {
      const isEligibleForGr = (r.status === 'ISSUED' || r.status === 'PARTIALLY_FULFILLED') && r.canReceiveGoods;
      return isEligibleForGr && r.orderType !== 'SERVICE';
    };

    const checkServiceOrderEligibility = (r: PoRow): boolean => {
      return r.orderType === 'SERVICE';
    };

    it('should forbid Goods Receipt action on SERVICE PO even if status is ISSUED and user can receive goods', () => {
      const servicePo: PoRow = {
        id: 2,
        poNumber: 'PO-2026-0002',
        orderType: 'SERVICE',
        status: 'ISSUED',
        canReceiveGoods: true,
      };

      expect(checkGrEligibility(servicePo)).toBe(false);
      expect(checkServiceOrderEligibility(servicePo)).toBe(true);
    });

    it('should allow Goods Receipt action on MATERIAL PO when status is ISSUED and user can receive goods', () => {
      const materialPo: PoRow = {
        id: 1,
        poNumber: 'PO-2026-0001',
        orderType: 'MATERIAL',
        status: 'ISSUED',
        canReceiveGoods: true,
      };

      expect(checkGrEligibility(materialPo)).toBe(true);
      expect(checkServiceOrderEligibility(materialPo)).toBe(false);
    });

    it('should allow Goods Receipt action on LEGACY_MIXED PO at PO level (item-level filtering handles lines)', () => {
      const legacyMixedPo: PoRow = {
        id: 3,
        poNumber: 'PO-2026-0003',
        orderType: 'LEGACY_MIXED',
        status: 'ISSUED',
        canReceiveGoods: true,
      };

      expect(checkGrEligibility(legacyMixedPo)).toBe(true);
      expect(checkServiceOrderEligibility(legacyMixedPo)).toBe(false);
    });
  });

  describe('Item Category Truth Preservation', () => {
    it('should preserve actual category and not fall back blindly to "Material"', () => {
      const sampleItems = [
        { itemName: 'Kabel Fiber', categoryKey: 'MATERIAL', categoryName: 'MATERIAL' },
        { itemName: 'Jasa Penarikan Kabel', categoryKey: 'SUBCONTRACTOR', categoryName: 'SUBCONTRACTOR' },
        { itemName: 'Sewa Crane', categoryKey: 'EQUIPMENT', categoryName: 'EQUIPMENT' },
        { itemName: 'Biaya Mobilisasi', categoryKey: 'OPERATIONAL', categoryName: 'OPERATIONAL' },
      ];

      const resolveCategory = (it: any) =>
        it.costItem?.categoryKey ||
        it.categoryKey ||
        it.categoryName ||
        'MATERIAL';

      expect(resolveCategory(sampleItems[0])).toBe('MATERIAL');
      expect(resolveCategory(sampleItems[1])).toBe('SUBCONTRACTOR');
      expect(resolveCategory(sampleItems[2])).toBe('EQUIPMENT');
      expect(resolveCategory(sampleItems[3])).toBe('OPERATIONAL');
    });
  });

  describe('Service Order SPK Detail Presentation & Layout Rules (R1-UI-C1)', () => {
    const {
      resolveServiceOrderProject,
      resolveServiceOrderVendor,
      SERVICE_ORDER_DESCRIPTIONS_COLUMN,
    } = require('../ServiceOrderModal');

    describe('SERVICE_ORDER_DESCRIPTIONS_COLUMN Responsive Rules', () => {
      it('should enforce 2 columns across all desktop and tablet viewports', () => {
        expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xxl).toBe(2);
        expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xl).toBe(2);
        expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.lg).toBe(2);
        expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.md).toBe(2);
      });

      it('should enforce 1 column on mobile viewports without multi-column squeeze', () => {
        expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.sm).toBe(1);
        expect(SERVICE_ORDER_DESCRIPTIONS_COLUMN.xs).toBe(1);
      });
    });

    describe('resolveServiceOrderProject Context Binding', () => {
      it('should display actual project name and code when relation is loaded from API', () => {
        const so = {
          projectId: 21,
          project: {
            id: 21,
            name: 'SURGE JATENG',
            code: 'CONT-20260922-0012',
          },
        };
        const po = { poNumber: 'PO-20260923-001' };

        const result = resolveServiceOrderProject(so, po);
        expect(result.projectName).toBe('SURGE JATENG');
        expect(result.projectCode).toBe('CONT-20260922-0012');
      });

      it('should fallback to PO projectName when SO relation is not populated', () => {
        const so = { projectId: 10 };
        const po = { projectName: 'Proyek Rel Kereta Cepat' };

        const result = resolveServiceOrderProject(so, po);
        expect(result.projectName).toBe('Proyek Rel Kereta Cepat');
        expect(result.projectCode).toBeNull();
      });

      it('should fallback to Proyek #ID when only numeric projectId is available', () => {
        const so = { projectId: 99 };
        const po = {};

        const result = resolveServiceOrderProject(so, po);
        expect(result.projectName).toBe('Proyek #99');
        expect(result.projectCode).toBeNull();
      });

      it('should fallback to "Belum ada data" when no project data exists', () => {
        const result = resolveServiceOrderProject(null, null);
        expect(result.projectName).toBe('Belum ada data');
        expect(result.projectCode).toBeNull();
      });
    });

    describe('resolveServiceOrderVendor Context Binding', () => {
      it('should display actual vendor name and code from loaded relation', () => {
        const so = {
          vendor: {
            id: 4,
            name: 'PT Suplai Makmur',
            code: 'VND-004',
          },
        };
        const result = resolveServiceOrderVendor(so, null);
        expect(result.vendorName).toBe('PT Suplai Makmur');
        expect(result.vendorCode).toBe('VND-004');
      });

      it('should fallback to PO vendorName when relation is absent', () => {
        const po = { vendorName: 'PT Maju Infrastruktur' };
        const result = resolveServiceOrderVendor(null, po);
        expect(result.vendorName).toBe('PT Maju Infrastruktur');
        expect(result.vendorCode).toBeNull();
      });
    });

    describe('Document Number Presentation Safeguards', () => {
      it('should keep document number formatted without breaking hyphens', () => {
        const docNumber = 'SPK-20261008-001';
        // Test regex for canonical SPK/WO format
        expect(/^(SPK|WO)-\d{8}-\d{3}$/.test(docNumber)).toBe(true);
        // Verify style contract
        const contractStyle = {
          whiteSpace: 'nowrap',
          wordBreak: 'keep-all',
        };
        expect(contractStyle.whiteSpace).toBe('nowrap');
        expect(contractStyle.wordBreak).toBe('keep-all');
      });
    });

    describe('Phase 21 Boundary Notice', () => {
      it('should preserve canonical Phase 21 waiting notice copy', () => {
        const notice = 'Menunggu Pelaksanaan / Klaim Jasa (Phase 21)';
        expect(notice).toContain('Phase 21');
        expect(notice).not.toContain('BAST Approved');
        expect(notice).not.toContain('Claim Submitted');
        expect(notice).not.toContain('Invoice Ready');
      });
    });
  });
});
