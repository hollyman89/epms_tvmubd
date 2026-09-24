import {
  validateCostEstimateItems,
  buildSaveCostEstimatePayload,
  CostCategoryEstimation,
} from '../PmCostEstimationModal';

describe('PM Cost Estimation Integrity & Pre-Save Guard', () => {
  const activeLeafIds = new Set<string | number>(['455', '457', '458', '459', 459, '460']);

  describe('validateCostEstimateItems', () => {
    it('should block save when an itemized item has scope WBS but missing wbsNodeId', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 1000000,
          items: [
            {
              id: 'item-1',
              itemName: 'CABEL 24C',
              quantity: 10,
              uom: 'Roll',
              unitPrice: 100000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: undefined,
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('CABEL 24C: pilih WBS Deliverable terlebih dahulu.');
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].reason).toBe('MISSING_WBS');
    });

    it('should block save when an itemized item has scope WBS but wbsNodeId is not in active leaves (orphaned/stale)', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 1000000,
          items: [
            {
              id: 'item-1',
              itemName: 'CABEL 24C',
              quantity: 10,
              uom: 'Roll',
              unitPrice: 100000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: '999', // Not in activeLeafIds
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('WBS Deliverable yang dipilih sudah tidak ada atau bukan leaf WBS');
      expect(res.errors[0].reason).toBe('INVALID_OR_DELETED_WBS');
    });

    it('should pass when an itemized item has scope WBS and valid active leaf wbsNodeId', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 1000000,
          items: [
            {
              id: 'item-1',
              itemName: 'CABEL 24C',
              quantity: 10,
              uom: 'Roll',
              unitPrice: 100000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: '459', // Active leaf
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.errors).toHaveLength(0);
    });

    it('should pass when items have PROJECT or UNASSIGNED scope regardless of WBS mapping', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_overheads',
          categoryLabel: 'Project Overheads',
          groupKey: 'INDIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 500000,
          items: [
            {
              id: 'item-proj',
              itemName: 'Mobilisasi Tim Proyek',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 300000,
              subtotal: 300000,
              assignmentScope: 'PROJECT',
            },
            {
              id: 'item-unassigned',
              itemName: 'Biaya Tak Terduga',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 200000,
              subtotal: 200000,
              assignmentScope: 'UNASSIGNED',
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);
      expect(res.valid).toBe(true);
    });

    it('should pass for categories in DIRECT mode even without items', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_direct',
          categoryLabel: 'Nominal Langsung',
          groupKey: 'DIRECT',
          mode: 'DIRECT',
          directSubtotal: 5000000,
          categoryTotal: 5000000,
          items: [],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);
      expect(res.valid).toBe(true);
    });
  });

  describe('buildSaveCostEstimatePayload', () => {
    it('should derive consistent assignmentScope and numeric wbsId from canonical effectiveScope', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 2500000,
          items: [
            {
              id: '101', // Numeric DB id formatted as string
              itemName: 'CABEL 24C',
              quantity: 10,
              uom: 'Roll',
              unitPrice: 100000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: '459',
            },
            {
              id: 'item_new_123', // Client temp id
              itemName: 'Sewa Crane Proyek',
              quantity: 1,
              uom: 'Hari',
              unitPrice: 1500000,
              subtotal: 1500000,
              assignmentScope: 'PROJECT',
              wbsNodeId: undefined,
            },
          ],
        },
      ];

      const payload = buildSaveCostEstimatePayload(categories, 'PM Asumsi Lapangan');

      expect(payload.pmNotes).toBe('PM Asumsi Lapangan');
      expect(payload.categories).toHaveLength(1);
      const cat = payload.categories[0];
      expect(cat.items).toHaveLength(2);

      // Item 1: WBS
      expect(cat.items[0]).toMatchObject({
        id: 101,
        itemName: 'CABEL 24C',
        assignmentScope: 'WBS',
        wbsId: 459,
      });

      // Item 2: PROJECT
      expect(cat.items[1]).toMatchObject({
        id: undefined, // client temp ID converted to undefined
        itemName: 'Sewa Crane Proyek',
        assignmentScope: 'PROJECT',
        wbsId: null,
      });
    });

    it('should never send wbsId as non-null if effectiveScope is not WBS', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_gen',
          categoryLabel: 'General',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 100000,
          items: [
            {
              id: '1',
              itemName: 'Item Scope Project',
              quantity: 1,
              uom: 'Unit',
              unitPrice: 100000,
              subtotal: 100000,
              assignmentScope: 'PROJECT',
              wbsNodeId: '459', // Even if stale wbsNodeId was present in state, scope PROJECT forces wbsId = null
            },
          ],
        },
      ];

      const payload = buildSaveCostEstimatePayload(categories, '');
      expect(payload.categories[0].items[0].assignmentScope).toBe('PROJECT');
      expect(payload.categories[0].items[0].wbsId).toBeNull();
    });
  });
});
