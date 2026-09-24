import { BadRequestException } from '@nestjs/common';
import { CostEstimateValidator } from './cost-estimate.validator';
import { SaveCostEstimateDto } from './dto/save-cost-estimate.dto';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';

describe('CostEstimateValidator (Phase R11.1.3-B Server-Side Validation)', () => {
  let validator: CostEstimateValidator;

  const mockActiveWbsNodes: WorkBreakdownStructure[] = [
    {
      id: 1,
      projectId: 1,
      parentWbsId: null as any,
      code: '1.0',
      name: 'Pekerjaan Persiapan & Perizinan',
      level: 1,
      weightPercentage: 30.0,
      description: 'Root level package',
      createdBy: 1,
      updatedBy: 1,
      deletedBy: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as any,
    },
    {
      id: 2,
      projectId: 1,
      parentWbsId: 1,
      code: '1.1',
      name: 'Site Survey & Soil Test',
      level: 2,
      weightPercentage: 15.0,
      description: 'Leaf deliverable under 1.0',
      createdBy: 1,
      updatedBy: 1,
      deletedBy: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as any,
    },
    {
      id: 3,
      projectId: 1,
      parentWbsId: 1,
      code: '1.2',
      name: 'Izin Instansi & ROW',
      level: 2,
      weightPercentage: 15.0,
      description: 'Leaf deliverable under 1.0',
      createdBy: 1,
      updatedBy: 1,
      deletedBy: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as any,
    },
    {
      id: 4,
      projectId: 1,
      parentWbsId: null as any,
      code: '2.0',
      name: 'Pekerjaan Sipil & Instalasi',
      level: 1,
      weightPercentage: 70.0,
      description: 'Root level package',
      createdBy: 1,
      updatedBy: 1,
      deletedBy: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as any,
    },
    {
      id: 5,
      projectId: 1,
      parentWbsId: 4,
      code: '2.1',
      name: 'Galian & Penggelaran Kabel FO',
      level: 2,
      weightPercentage: 70.0,
      description: 'Leaf deliverable under 2.0',
      createdBy: 1,
      updatedBy: 1,
      deletedBy: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as any,
    },
  ];

  beforeEach(() => {
    validator = new CostEstimateValidator();
  });

  // CASE A: Client subtotal wrong -> request valid -> server subtotal = qty * unitPrice
  it('CASE A: should ignore client-provided subtotal and recompute authoritative subtotal = quantity * unitPrice', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Kabel Fiber Optic 48 Core',
              quantity: 10,
              unitPrice: 1000,
              subtotal: 999999, // Client fake/wrong subtotal
              assignmentScope: 'WBS',
              wbsId: 5, // Leaf node 2.1
            },
          ],
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.categories[0].items[0].subtotal).toBe(10000.0);
    expect(result.categories[0].categoryTotal).toBe(10000.0);
    expect(result.totalPmEstimate).toBe(10000.0);
  });

  // CASE B: Client categoryTotal wrong -> ignored -> derived category total correct
  it('CASE B: should ignore client categoryTotal and compute canonical sum from line items', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'LABOR',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Teknisi Splicing',
              quantity: 5,
              unitPrice: 500000,
              assignmentScope: 'WBS',
              wbsId: 5,
            },
            {
              itemName: 'Mandor Sipil',
              quantity: 2,
              unitPrice: 750000,
              assignmentScope: 'WBS',
              wbsId: 2,
            },
          ],
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    // 5 * 500,000 = 2,500,000; 2 * 750,000 = 1,500,000. Total = 4,000,000
    expect(result.categories[0].categoryTotal).toBe(4000000.0);
    expect(result.directTotal).toBe(4000000.0);
    expect(result.totalPmEstimate).toBe(4000000.0);
  });

  // CASE C: Client totalPmEstimate wrong -> ignored -> server total correct
  it('CASE C: should compute totalPmEstimate from all category groups and ignore external total claims', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Material A',
              quantity: 2,
              unitPrice: 1000000,
              assignmentScope: 'PROJECT',
            },
          ],
        },
        {
          categoryKey: 'EQUIPMENT',
          mode: 'DIRECT',
          directSubtotal: 1500000,
        },
        {
          categoryKey: 'CONTINGENCY',
          mode: 'DIRECT',
          directSubtotal: 500000,
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.directTotal).toBe(2000000.0);
    expect(result.indirectTotal).toBe(1500000.0);
    expect(result.riskTotal).toBe(500000.0);
    expect(result.totalPmEstimate).toBe(4000000.0);
  });

  // CASE D: NaN quantity -> BLOCK
  it('CASE D: should reject NaN quantity with BadRequestException', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Invalid Item',
              quantity: NaN,
              unitPrice: 10000,
              assignmentScope: 'PROJECT',
            },
          ],
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/quantity harus berupa angka yang valid/);
  });

  // CASE E: Infinity unitPrice -> BLOCK
  it('CASE E: should reject Infinity unitPrice with BadRequestException', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Invalid Item',
              quantity: 10,
              unitPrice: Infinity,
              assignmentScope: 'PROJECT',
            },
          ],
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/unitPrice harus berupa angka yang valid/);
  });

  // CASE F: WBS parent -> BLOCK
  it('CASE F: should reject assignment to WBS parent node with BadRequestException', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'SUBCONTRACTOR',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Paket Subkon FO',
              quantity: 1,
              unitPrice: 50000000,
              assignmentScope: 'WBS',
              wbsId: 1, // Node #1 has children #2 and #3, so it is a parent!
            },
          ],
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/bukan leaf node/);
  });

  // CASE G: WBS soft-deleted -> BLOCK
  it('CASE G: should reject assignment to a soft-deleted WBS node (not present in active list)', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Tiang Besi 7M',
              quantity: 20,
              unitPrice: 750000,
              assignmentScope: 'WBS',
              wbsId: 999, // WBS #999 was soft-deleted and not in active list
            },
          ],
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/tidak ditemukan, bukan milik project #1, atau sudah tidak aktif/);
  });

  // CASE H: WBS other project -> BLOCK
  it('CASE H: should reject WBS belonging to another project', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Tiang Besi 7M',
              quantity: 20,
              unitPrice: 750000,
              assignmentScope: 'WBS',
              wbsId: 5,
            },
          ],
        },
      ],
    };

    // Validating against Project ID #99 while mockActiveWbsNodes belong to Project #1
    expect(() => validator.validateAndCompute(99, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
  });

  // CASE I: PROJECT + wbsId -> BLOCK
  it('CASE I: should reject PROJECT scope if wbsId is provided', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'OPERATIONAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Sewa Direksi Keet',
              quantity: 1,
              unitPrice: 15000000,
              assignmentScope: 'PROJECT',
              wbsId: 2, // Conflict: PROJECT cannot have wbsId
            },
          ],
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/assignmentScope PROJECT tidak boleh memiliki wbsId/);
  });

  // CASE J: UNASSIGNED + wbsId -> BLOCK
  it('CASE J: should reject UNASSIGNED scope if wbsId is provided', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Aksesoris Sambungan',
              quantity: 50,
              unitPrice: 15000,
              assignmentScope: 'UNASSIGNED',
              wbsId: 2, // Conflict: UNASSIGNED cannot have wbsId
            },
          ],
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/assignmentScope UNASSIGNED tidak boleh memiliki wbsId/);
  });

  // CASE K: PROJECT + NULL wbsId -> PASS
  it('CASE K: should accept PROJECT scope with null/undefined wbsId', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'OPERATIONAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Sewa Direksi Keet Lapangan',
              quantity: 1,
              unitPrice: 15000000,
              assignmentScope: 'PROJECT',
            },
          ],
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.categories[0].items[0].assignmentScope).toBe('PROJECT');
    expect(result.categories[0].items[0].wbsId).toBeNull();
  });

  // CASE L: UNASSIGNED + NULL wbsId -> PASS
  it('CASE L: should accept UNASSIGNED scope with null/undefined wbsId in planning drafts', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Aksesoris Tambahan',
              quantity: 10,
              unitPrice: 50000,
              assignmentScope: 'UNASSIGNED',
            },
          ],
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.categories[0].items[0].assignmentScope).toBe('UNASSIGNED');
    expect(result.categories[0].items[0].wbsId).toBeNull();
  });

  // CASE M: WBS leaf + same project -> PASS
  it('CASE M: should accept WBS assignment to valid leaf node within the same project', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Kabel Drop Core 1 Core',
              quantity: 5000,
              unitPrice: 1200,
              assignmentScope: 'WBS',
              wbsId: 5, // Leaf node 2.1
            },
          ],
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.categories[0].items[0].assignmentScope).toBe('WBS');
    expect(result.categories[0].items[0].wbsId).toBe(5);
    expect(result.categories[0].items[0].subtotal).toBe(6000000.0);
  });

  // CASE N: DIRECT + directSubtotal valid -> PASS
  it('CASE N: should accept DIRECT mode with valid directSubtotal', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'PERMIT',
          mode: 'DIRECT',
          directSubtotal: 7500000,
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.categories[0].mode).toBe('DIRECT');
    expect(result.categories[0].directSubtotal).toBe(7500000.0);
    expect(result.categories[0].categoryTotal).toBe(7500000.0);
    expect(result.indirectTotal).toBe(7500000.0);
  });

  // CASE O: DIRECT + negative directSubtotal -> BLOCK
  it('CASE O: should reject negative directSubtotal in DIRECT mode', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'PERMIT',
          mode: 'DIRECT',
          directSubtotal: -500000,
        },
      ],
    };

    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(BadRequestException);
    expect(() => validator.validateAndCompute(1, dto, mockActiveWbsNodes)).toThrow(/directSubtotal tidak boleh negatif/);
  });

  // CASE P: ITEMIZED + correct server-derived category total -> PASS
  it('CASE P: should accurately calculate multi-item category totals and rollup across all 3 groups', () => {
    const dto: SaveCostEstimateDto = {
      pmNotes: 'Rollout FTTH Q3 2026',
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            { itemName: 'Item M1', quantity: 10, unitPrice: 100000, assignmentScope: 'WBS', wbsId: 2 },
            { itemName: 'Item M2', quantity: 5, unitPrice: 200000, assignmentScope: 'WBS', wbsId: 3 },
          ],
        },
        {
          categoryKey: 'LABOR',
          mode: 'ITEMIZED',
          items: [
            { itemName: 'Item L1', quantity: 20, unitPrice: 150000, assignmentScope: 'WBS', wbsId: 5 },
          ],
        },
        {
          categoryKey: 'PERMIT',
          mode: 'DIRECT',
          directSubtotal: 5000000,
        },
        {
          categoryKey: 'CONTINGENCY',
          mode: 'DIRECT',
          directSubtotal: 2500000,
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    // MATERIAL: 10*100k + 5*200k = 2,000,000
    // LABOR: 20*150k = 3,000,000
    // DIRECT GROUP TOTAL = 5,000,000
    expect(result.directTotal).toBe(5000000.0);

    // INDIRECT GROUP TOTAL (PERMIT: 5,000,000) = 5,000,000
    expect(result.indirectTotal).toBe(5000000.0);

    // RISK GROUP TOTAL (CONTINGENCY: 2,500,000) = 2,500,000
    expect(result.riskTotal).toBe(2500000.0);

    // TOTAL PM ESTIMATE = 12,500,000
    expect(result.totalPmEstimate).toBe(12500000.0);
    expect(result.pmNotes).toBe('Rollout FTTH Q3 2026');
  });

  // CURRENCY PRECISION TEST
  it('CURRENCY PRECISION: should multiply fractional quantity 2.5000 by 1234.56 and return exactly 3086.40 without floating-point artifacts', () => {
    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Besi Beton Ulir 12mm',
              quantity: 2.5,
              unitPrice: 1234.56,
              assignmentScope: 'PROJECT',
            },
          ],
        },
      ],
    };

    const result = validator.validateAndCompute(1, dto, mockActiveWbsNodes);
    expect(result.categories[0].items[0].subtotal).toBe(3086.4);
    expect(result.totalPmEstimate).toBe(3086.4);
  });

  // ZERO DATABASE MUTATION VERIFICATION
  it('ZERO MUTATION: should maintain activeWbsNodes state completely intact and perform purely read/calculation operations', () => {
    const originalSnapshot = JSON.stringify(mockActiveWbsNodes);

    const dto: SaveCostEstimateDto = {
      categories: [
        {
          categoryKey: 'MATERIAL',
          mode: 'ITEMIZED',
          items: [
            {
              itemName: 'Test Item',
              quantity: 1,
              unitPrice: 100,
              assignmentScope: 'WBS',
              wbsId: 2,
            },
          ],
        },
      ],
    };

    validator.validateAndCompute(1, dto, mockActiveWbsNodes);

    expect(JSON.stringify(mockActiveWbsNodes)).toBe(originalSnapshot);
  });
});
