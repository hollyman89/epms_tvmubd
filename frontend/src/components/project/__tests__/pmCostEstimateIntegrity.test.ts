import {
  validateCostEstimateItems,
  buildSaveCostEstimatePayload,
  CostCategoryEstimation,
} from '../PmCostEstimationModal';

describe('PM Cost Estimation Integrity & Readiness Alignment (R9.1B-OP-FIX Phase 2: OP-02)', () => {
  const activeLeafIds = new Set<string | number>(['455', '457', '458', '459', 459, '460']);

  /**
   * TEST 1 — UNASSIGNED ITEM
   * Given: ITEMIZED CostItem with assignmentScope = UNASSIGNED
   * ASSERT: frontend validation = invalid/incomplete
   * ASSERT: Cost pillar != READY
   */
  describe('TEST 1 — UNASSIGNED ITEM', () => {
    it('should mark frontend validation invalid and Cost pillar NOT READY when an item is UNASSIGNED', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 5000000,
          items: [
            {
              id: 'item-unassigned-1',
              itemName: 'Material Cable Batch A',
              quantity: 5,
              uom: 'Roll',
              unitPrice: 1000000,
              subtotal: 5000000,
              assignmentScope: 'UNASSIGNED',
              wbsNodeId: undefined,
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);

      // ASSERT: frontend validation = invalid/incomplete
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error).toContain('belum memiliki alokasi scope/WBS yang valid');
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].reason).toBe('UNASSIGNED_SCOPE');
      expect(res.unassignedCount).toBe(1);

      // ASSERT: Cost pillar != READY (simulated PmOperationalPlanModal readiness formula)
      const hasCostInput = true;
      const totalPmEstimate = 5000000;
      const isCostServerSynced = true; // Even if draft was synced to server
      const isCostComplete = hasCostInput && totalPmEstimate > 0 && res.valid;
      const isCostReady = isCostComplete && isCostServerSynced;

      expect(isCostComplete).toBe(false);
      expect(isCostReady).toBe(false);
    });
  });

  /**
   * TEST 2 — VALID PROJECT-LEVEL ITEM
   * Given: valid backend-supported project-level assignment
   * ASSERT: assignment validation passes subject to all normal Cost completeness conditions.
   */
  describe('TEST 2 — VALID PROJECT-LEVEL ITEM', () => {
    it('should pass validation and allow Cost pillar to be READY for valid PROJECT-level assignment', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_overheads',
          categoryLabel: 'Project Overheads',
          groupKey: 'INDIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 7500000,
          items: [
            {
              id: 'item-proj-1',
              itemName: 'Mobilisasi & Demobilisasi Tim',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 7500000,
              subtotal: 7500000,
              assignmentScope: 'PROJECT',
              wbsNodeId: undefined,
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);

      // ASSERT: assignment validation passes
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.errors).toHaveLength(0);
      expect(res.unassignedCount).toBe(0);

      // ASSERT: Cost pillar becomes READY when server synced
      const hasCostInput = true;
      const totalPmEstimate = 7500000;
      const isCostServerSynced = true;
      const isCostComplete = hasCostInput && totalPmEstimate > 0 && res.valid;
      const isCostReady = isCostComplete && isCostServerSynced;

      expect(isCostComplete).toBe(true);
      expect(isCostReady).toBe(true);
    });
  });

  /**
   * TEST 3 — VALID WBS ITEM
   * Given: valid eligible persisted WBS allocation
   * ASSERT: assignment validation passes.
   */
  describe('TEST 3 — VALID WBS ITEM', () => {
    it('should pass validation when an itemized item is assigned to an active leaf WBS node', () => {
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
              wbsNodeId: '459', // Active leaf in activeLeafIds
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);

      // ASSERT: validation passes
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.errors).toHaveLength(0);

      // ASSERT: Cost pillar is READY once synced
      const isCostComplete = true && 1000000 > 0 && res.valid;
      const isCostReady = isCostComplete && true;
      expect(isCostReady).toBe(true);
    });
  });

  /**
   * TEST 4 — INVALID WBS REFERENCE
   * Given: WBS assignment but invalid/ineligible/missing WBS reference
   * ASSERT: validation fails.
   */
  describe('TEST 4 — INVALID WBS REFERENCE', () => {
    it('should fail validation when scope is WBS but wbsNodeId is missing', () => {
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
      expect(res.errors[0].reason).toBe('MISSING_WBS');
    });

    it('should fail validation when scope is WBS but wbsNodeId is not in active leaf nodes', () => {
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
  });

  /**
   * TEST 5 — MULTIPLE ITEMS
   * Given: N valid items + 1 UNASSIGNED item
   * ASSERT: entire Cost pillar remains incomplete. One invalid item must not be hidden by valid items.
   */
  describe('TEST 5 — MULTIPLE ITEMS', () => {
    it('should fail readiness if even 1 item remains UNASSIGNED among multiple valid items', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 3000000,
          items: [
            {
              id: 'item-1',
              itemName: 'Valid WBS Item 1',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 1000000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: '455', // Active
            },
            {
              id: 'item-2',
              itemName: 'Valid WBS Item 2',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 1000000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: '457', // Active
            },
            {
              id: 'item-3',
              itemName: 'Unassigned Sneaky Item',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 1000000,
              subtotal: 1000000,
              assignmentScope: 'UNASSIGNED',
            },
          ],
        },
        {
          categoryKey: 'cat_overheads',
          categoryLabel: 'Overheads',
          groupKey: 'INDIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 500000,
          items: [
            {
              id: 'item-4',
              itemName: 'Valid Project Level Overhead',
              quantity: 1,
              uom: 'Lot',
              unitPrice: 500000,
              subtotal: 500000,
              assignmentScope: 'PROJECT',
            },
          ],
        },
      ];

      const res = validateCostEstimateItems(categories, activeLeafIds);

      // ASSERT: entire validation fails
      expect(res.valid).toBe(false);
      expect(res.unassignedCount).toBe(1);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].itemName).toBe('Unassigned Sneaky Item');

      // ASSERT: Cost pillar remains incomplete
      const isCostComplete = true && 3500000 > 0 && res.valid;
      expect(isCostComplete).toBe(false);
    });
  });

  /**
   * TEST 6 — DRAFT VS READY
   * If current contract permits incomplete drafts:
   * ASSERT: UNASSIGNED item may persist as draft
   * BUT: readiness remains false. Do not conflate persistence with readiness.
   */
  describe('TEST 6 — DRAFT VS READY', () => {
    it('should allow UNASSIGNED items to be saved as draft while keeping readiness false', () => {
      const categories: CostCategoryEstimation[] = [
        {
          categoryKey: 'cat_materials',
          categoryLabel: 'Material & Peralatan',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 2000000,
          items: [
            {
              id: 'item-draft-1',
              itemName: 'Draft Item In Progress',
              quantity: 2,
              uom: 'Unit',
              unitPrice: 1000000,
              subtotal: 2000000,
              assignmentScope: 'UNASSIGNED',
            },
          ],
        },
      ];

      // 1. Pre-Save Guard check with allowUnassigned=true
      const saveGuard = validateCostEstimateItems(categories, activeLeafIds, { allowUnassigned: true });
      expect(saveGuard.valid).toBe(true);

      // 2. Draft Payload Construction
      const payload = buildSaveCostEstimatePayload(categories, 'Draft Notes');
      expect(payload.categories[0].items[0]).toMatchObject({
        itemName: 'Draft Item In Progress',
        assignmentScope: 'UNASSIGNED',
        wbsId: null,
      });

      // 3. Readiness check (default, allowUnassigned=false)
      const readinessCheck = validateCostEstimateItems(categories, activeLeafIds);
      expect(readinessCheck.valid).toBe(false);
      expect(readinessCheck.errors[0].reason).toBe('UNASSIGNED_SCOPE');

      // 4. Cost pillar readiness status after server sync
      const isCostServerSynced = true; // Draft successfully saved to database
      const isCostComplete = readinessCheck.valid; // NOT complete because of unassigned item
      const isCostReady = isCostComplete && isCostServerSynced;

      expect(isCostReady).toBe(false);
    });
  });

  describe('DIRECT mode categories', () => {
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
              id: '101',
              itemName: 'CABEL 24C',
              quantity: 10,
              uom: 'Roll',
              unitPrice: 100000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsNodeId: '459',
            },
            {
              id: 'item_new_123',
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

      expect(cat.items[0]).toMatchObject({
        id: 101,
        itemName: 'CABEL 24C',
        assignmentScope: 'WBS',
        wbsId: 459,
      });

      expect(cat.items[1]).toMatchObject({
        id: undefined,
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
              wbsNodeId: '459',
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
