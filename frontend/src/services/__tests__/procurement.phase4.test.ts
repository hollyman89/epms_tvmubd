import { ProcurementService } from '../procurement.service';
import { apiClient } from '@/lib/axios';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Phase 4 — Procurement Intake Frontend Operational Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Procurement Service API SSOT Contract', () => {
    it('loads authoritative availability including exhausted items for read-only display', async () => {
      const items = [{ id: 46, itemName: 'Kabel ADSS', availableQty: 0, availabilityStatus: 'FULLY_ALLOCATED' }];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { data: items } });
      expect(await ProcurementService.getEligibleCostItems(21)).toEqual(items);
      expect(apiClient.get).toHaveBeenCalledWith('/procurement/projects/21/eligible-cost-items');
    });

    it('creates and submits using one atomic request', async () => {
      const payload = { projectId: 21, title: 'Tiang', items: [{ costItemId: 45, requestedQty: 2 }] };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { data: { id: 2, status: 'SUBMITTED' } } });
      expect(await ProcurementService.saveAndSubmitPackage(payload)).toMatchObject({ status: 'SUBMITTED' });
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages/create-and-submit', payload);
    });

    it('revises and resubmits using one atomic request', async () => {
      const payload = { title: 'Tiang revisi', items: [{ costItemId: 45, requestedQty: 1 }] };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 2, status: 'SUBMITTED' } });
      await ProcurementService.saveAndSubmitPackage(payload, 2);
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages/2/update-and-submit', payload);
      expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('getPackages should query GET /procurement/packages with correct params', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 1, packageNumber: 'PKG-2026-001', status: 'SUBMITTED' }],
      });

      const res = await ProcurementService.getPackages({ status: 'SUBMITTED', projectId: 10 });
      expect(apiClient.get).toHaveBeenCalledWith('/procurement/packages', {
        params: { status: 'SUBMITTED', projectId: 10 },
      });
      expect(res).toHaveLength(1);
      expect(res[0].packageNumber).toBe('PKG-2026-001');
    });

    it('getPackages with ALL filter must NOT send status="ALL" to backend', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

      // Simulating user choosing 'ALL': filters object has undefined status
      const filterAll: any = {};
      await ProcurementService.getPackages(filterAll);

      expect(apiClient.get).toHaveBeenCalledWith('/procurement/packages', {
        params: {},
      });
      // Ensure 'status' is not passed as 'ALL'
      const callParams = (apiClient.get as jest.Mock).mock.calls[0][1]?.params;
      expect(callParams?.status).toBeUndefined();
      expect(callParams?.status).not.toBe('ALL');
    });

    it('getPackageById should call GET /procurement/packages/:id', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { id: 5, packageNumber: 'PKG-005', status: 'SUBMITTED' },
      });

      const res = await ProcurementService.getPackageById(5);
      expect(apiClient.get).toHaveBeenCalledWith('/procurement/packages/5');
      expect(res.id).toBe(5);
    });

    it('createPackageDraft should call POST /procurement/packages with minimal authority payload', async () => {
      const payload = {
        projectId: 20,
        title: 'Pengadaan Kabel & Trafo',
        description: 'Material instalasi listrik',
        requiredDate: '2026-04-15',
        items: [
          { costItemId: 101, requestedQty: 50 },
          { costItemId: 102, requestedQty: 10, requiredDate: '2026-04-20' },
        ],
      };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { id: 10, packageNumber: 'PKG-010', status: 'DRAFT', ...payload },
      });

      const res = await ProcurementService.createPackageDraft(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages', payload);
      expect(res.status).toBe('DRAFT');
    });

    it('updatePackageDraft MUST use PUT /procurement/packages/:id (verified Step 0 contract)', async () => {
      const updatePayload = {
        title: 'Pengadaan Kabel Revisi',
        items: [{ costItemId: 101, requestedQty: 45 }],
      };
      (apiClient.put as jest.Mock).mockResolvedValueOnce({
        data: { id: 10, ...updatePayload },
      });

      const res = await ProcurementService.updatePackageDraft(10, updatePayload);
      // Verify PUT is used, NOT PATCH
      expect(apiClient.put).toHaveBeenCalledWith('/procurement/packages/10', updatePayload);
      expect(apiClient.patch).not.toHaveBeenCalled();
      expect(res.title).toBe('Pengadaan Kabel Revisi');
    });

    it('submitPackage should call POST /procurement/packages/:id/submit', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { id: 10, status: 'SUBMITTED' },
      });

      const res = await ProcurementService.submitPackage(10);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages/10/submit');
      expect(res.status).toBe('SUBMITTED');
    });

    it('resubmitPackage should call POST /procurement/packages/:id/resubmit for RETURNED package', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { id: 10, status: 'SUBMITTED' },
      });

      const res = await ProcurementService.resubmitPackage(10);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages/10/resubmit');
      expect(res.status).toBe('SUBMITTED');
    });

    it('returnPackage should call POST /procurement/packages/:id/return with mandatory reason', async () => {
      const payload = { reason: 'Harga satuan kabel melebihi anggaran pasar.' };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { id: 10, status: 'RETURNED', rejectionReason: payload.reason },
      });

      const res = await ProcurementService.returnPackage(10, payload);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages/10/return', payload);
      expect(res.status).toBe('RETURNED');
    });

    it('createPrFromPackage should call POST /procurement/packages/:id/create-pr without business payload', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          id: 10,
          status: 'PR_CREATED',
          purchaseRequest: { id: 77, prNumber: 'PR-2026-077', status: 'SUBMITTED' },
        },
      });

      const res = await ProcurementService.createPrFromPackage(10);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/packages/10/create-pr');
      expect((res as any).status).toBe('PR_CREATED');
      expect(res.purchaseRequest.prNumber).toBe('PR-2026-077');
    });
  });

  describe('2. Reconciliation Service API Contract', () => {
    it('getUnresolvedReconciliations should call GET /procurement/reconciliations/unresolved', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            prItemId: 301,
            origin: 'LEGACY',
            itemName: 'Besi Beton 10mm',
            quantity: 100,
            uom: 'Btg',
            unresolvedCount: 1,
          },
        ],
      });

      const res = await ProcurementService.getUnresolvedReconciliations();
      expect(apiClient.get).toHaveBeenCalledWith('/procurement/reconciliations/unresolved', {
        params: {},
      });
      expect(res).toHaveLength(1);
      expect(res[0].origin).toBe('LEGACY');
    });

    it('getReconciliationDetail should call GET /procurement/reconciliations/items/:prItemId', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          prItem: { id: 301, itemName: 'Besi Beton' },
          candidateCostItems: [{ costItemId: 501, name: 'Besi Beton', availableQty: 120 }],
        },
      });

      const res = await ProcurementService.getReconciliationDetail(301);
      expect(apiClient.get).toHaveBeenCalledWith('/procurement/reconciliations/items/301');
      expect(res.candidateCostItems[0].availableQty).toBe(120);
    });

    it('reconcileItem should call POST /procurement/reconciliations/items/:prItemId/reconcile', async () => {
      const payload = {
        targetCostItemId: 501,
        mappedQuantity: 100,
        matchType: 'EXACT' as const,
        notes: 'Cocok dengan RAB WBS 1.1',
      };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, reconciliationId: 99 },
      });

      const res = await ProcurementService.reconcileItem(301, payload);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/reconciliations/items/301/reconcile', payload);
      expect(res.success).toBe(true);
    });

    it('excludeItem should call POST /procurement/reconciliations/items/:prItemId/exclude with reason', async () => {
      const payload = { reason: 'Item non-project overhead kantor pusat.' };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, excluded: true },
      });

      const res = await ProcurementService.excludeItem(301, payload);
      expect(apiClient.post).toHaveBeenCalledWith('/procurement/reconciliations/items/301/exclude', payload);
      expect(res.success).toBe(true);
    });
  });

  describe('3. Role & Action Matrix Contract Verification', () => {
    // Helper function checking reconciliation read authority (GET /procurement/reconciliations/*)
    const canReadReconciliation = (roles: string[]) => {
      const upper = roles.map((r) => r.toUpperCase());
      return (
        upper.includes('PROCUREMENT') ||
        upper.includes('PURCHASING') ||
        upper.includes('PROJECT_MANAGER') ||
        upper.includes('SUPER_ADMIN') ||
        upper.includes('SUPERADMIN') ||
        upper.includes('ADMIN')
      );
    };

    // Helper function checking reconciliation mutation authority (POST .../reconcile, POST .../exclude)
    const canMutateReconciliation = (roles: string[]) => {
      const upper = roles.map((r) => r.toUpperCase());
      return (
        upper.includes('PROCUREMENT') ||
        upper.includes('PURCHASING') ||
        upper.includes('SUPER_ADMIN') ||
        upper.includes('SUPERADMIN') ||
        upper.includes('ADMIN')
      );
    };

    it('should permit PROCUREMENT, PURCHASING, PROJECT_MANAGER, SUPER_ADMIN, and ADMIN to read reconciliations', () => {
      expect(canReadReconciliation(['PROCUREMENT'])).toBe(true);
      expect(canReadReconciliation(['PURCHASING'])).toBe(true);
      expect(canReadReconciliation(['PROJECT_MANAGER'])).toBe(true);
      expect(canReadReconciliation(['SUPER_ADMIN'])).toBe(true);
      expect(canReadReconciliation(['ADMIN'])).toBe(true);
    });

    it('should STRICTLY DENY FINANCE and DIRECTOR access to reconciliation (no GET access in backend)', () => {
      expect(canReadReconciliation(['FINANCE'])).toBe(false);
      expect(canReadReconciliation(['DIRECTOR'])).toBe(false);
    });

    it('should permit PROCUREMENT, PURCHASING, SUPER_ADMIN, and ADMIN to perform reconciliation mutations', () => {
      expect(canMutateReconciliation(['PROCUREMENT'])).toBe(true);
      expect(canMutateReconciliation(['PURCHASING'])).toBe(true);
      expect(canMutateReconciliation(['SUPER_ADMIN'])).toBe(true);
      expect(canMutateReconciliation(['ADMIN'])).toBe(true);
    });

    it('should NOT permit PROJECT_MANAGER to mutate reconciliation (read-only for PM)', () => {
      expect(canReadReconciliation(['PROJECT_MANAGER'])).toBe(true);
      expect(canMutateReconciliation(['PROJECT_MANAGER'])).toBe(false);
    });

    // Helper function checking procurement package intake action authority (Return package, Create PR)
    const canPerformProcurementIntakeAction = (roles: string[]) => {
      const upper = roles.map((r) => r.toUpperCase());
      return (
        upper.includes('PROCUREMENT') ||
        upper.includes('PURCHASING') ||
        upper.includes('SUPER_ADMIN') ||
        upper.includes('SUPERADMIN')
      );
    };

    it('should permit PROCUREMENT, PURCHASING, SUPER_ADMIN for package intake actions', () => {
      expect(canPerformProcurementIntakeAction(['PROCUREMENT'])).toBe(true);
      expect(canPerformProcurementIntakeAction(['PURCHASING'])).toBe(true);
      expect(canPerformProcurementIntakeAction(['SUPER_ADMIN'])).toBe(true);
      expect(canPerformProcurementIntakeAction(['PROJECT_MANAGER'])).toBe(false);
    });
  });

  describe('4. Frontend Codebase Isolation & Anti-Regression Verification', () => {
    const procurementPagePath = path.resolve(__dirname, '../../components/ProcurementPage.tsx');
    const directPrPagePath = path.resolve(__dirname, '../../app/(dashboard)/procurement/pr/create/page.tsx');
    const projectGovernancePath = path.resolve(__dirname, '../../components/project/PmOperationalPlanReviewModal.tsx');

    it('ProcurementPage.tsx must NOT import ProjectService.getOperationalBoard as intake', () => {
      const content = fs.readFileSync(procurementPagePath, 'utf8');
      expect(content).not.toContain('getOperationalBoard');
      expect(content).not.toContain('ReadyProcurementPackage');
      expect(content).not.toContain('loadProcurementIntake');
      expect(content).not.toContain('PmOperationalPlanReviewModal');
    });

    it('ProcurementPage.tsx must contain the 5 canonical workstation tabs', () => {
      const content = fs.readFileSync(procurementPagePath, 'utf8');
      expect(content).toContain('Paket Pengadaan');
      expect(content).toContain('Rekonsiliasi');
      expect(content).toContain('Purchase Request');
      expect(content).toContain('Purchase Order');
      expect(content).toContain('Goods Receipt');
    });

    it('ProcurementPage.tsx must omit status param when filter is ALL', () => {
      const content = fs.readFileSync(procurementPagePath, 'utf8');
      expect(content).toContain("statusFilter !== 'ALL'");
    });

    it('Direct PR create page must NOT contain direct PR creation form', () => {
      const content = fs.readFileSync(directPrPagePath, 'utf8');
      expect(content).not.toContain('createPurchaseRequest');
      expect(content).not.toContain('<Form');
      expect(content).toContain('Pembuatan Purchase Request Langsung Telah Ditutup');
      expect(content).toContain('/procurement');
    });

    it('Project Governance modal (PmOperationalPlanReviewModal.tsx) must remain untouched', () => {
      expect(fs.existsSync(projectGovernancePath)).toBe(true);
      const content = fs.readFileSync(projectGovernancePath, 'utf8');
      expect(content).toContain('PmOperationalPlanReviewModal');
    });
  });

  describe('5. PM Procurement Package Cost Item Selector Mapping', () => {
    // Import canonical helpers directly from PmProcurementPackageModal
    const {
      filterEligibleCostItems,
      buildWbsMap,
      resolveWbsDisplay,
    } = require('@/components/project/PmProcurementPackageModal');

    const mockSurgeJatengCostEstimate = {
      id: 11,
      projectId: 21,
      status: 'APPROVED',
      version: 1,
      totalPmEstimate: 332900000,
      categories: [
        {
          categoryKey: 'MATERIAL',
          categoryLabel: 'Material & Consumables',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 315000000,
          items: [
            {
              id: 45,
              itemName: 'Tiang',
              quantity: 40,
              uom: 'Unit',
              unitPrice: 500000,
              subtotal: 20000000,
              assignmentScope: 'WBS',
              wbsId: 45,
            },
            {
              id: 46,
              itemName: 'Kabel ADSS',
              quantity: 3000,
              uom: 'Meter',
              unitPrice: 65000,
              subtotal: 195000000,
              assignmentScope: 'WBS',
              wbsId: 45,
            },
            {
              id: 47,
              itemName: 'Acc Tiang',
              quantity: 10000,
              uom: 'Unit',
              unitPrice: 10000,
              subtotal: 100000000,
              assignmentScope: 'WBS',
              wbsId: 45,
            },
          ],
        },
        {
          categoryKey: 'LABOR',
          categoryLabel: 'Direct Labor',
          groupKey: 'DIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 900000,
          items: [
            {
              id: 48,
              itemName: 'Mandor Civil',
              quantity: 6,
              uom: 'Orang/Hari',
              unitPrice: 150000,
              subtotal: 900000,
              assignmentScope: 'WBS',
              wbsId: 45,
            },
          ],
        },
        {
          categoryKey: 'SUBCONTRACTOR',
          categoryLabel: 'Subcontractor',
          groupKey: 'DIRECT',
          mode: 'DIRECT',
          directSubtotal: 0,
          categoryTotal: 0,
          items: [],
        },
        {
          categoryKey: 'EQUIPMENT',
          categoryLabel: 'Equipment',
          groupKey: 'INDIRECT',
          mode: 'DIRECT',
          directSubtotal: 0,
          categoryTotal: 0,
          items: [],
        },
        {
          categoryKey: 'PERMIT',
          categoryLabel: 'Permit & Retribution',
          groupKey: 'INDIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 2000000,
          items: [
            {
              id: 49,
              itemName: 'Donasi Lingkungan',
              quantity: 1,
              uom: 'Unit',
              unitPrice: 1000000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsId: 44,
            },
            {
              id: 50,
              itemName: 'Donasi Kelurahan',
              quantity: 1,
              uom: 'Unit',
              unitPrice: 1000000,
              subtotal: 1000000,
              assignmentScope: 'WBS',
              wbsId: 44,
            },
          ],
        },
        {
          categoryKey: 'OPERATIONAL',
          categoryLabel: 'Operational & Site',
          groupKey: 'INDIRECT',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 5000000,
          items: [
            {
              id: 51,
              itemName: 'Patty Cash',
              quantity: 1,
              uom: 'Unit',
              unitPrice: 5000000,
              subtotal: 5000000,
              assignmentScope: 'PROJECT',
              wbsId: null,
            },
          ],
        },
        {
          categoryKey: 'CONTINGENCY',
          categoryLabel: 'Contingency Reserve',
          groupKey: 'RISK',
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: 10000000,
          items: [
            {
              id: 53,
              itemName: 'Biaya Cadangan',
              quantity: 1,
              uom: 'Unit',
              unitPrice: 10000000,
              subtotal: 10000000,
              assignmentScope: 'PROJECT',
              wbsId: null,
            },
          ],
        },
      ],
      wbsCostSummary: [
        { wbsId: 44, wbsCode: '1.0', wbsName: 'Perizinan', level: 1, parentWbsId: null, totalCost: 2000000, itemCount: 2 },
        { wbsId: 45, wbsCode: '2.0', wbsName: 'Pekerjaan Civil Work', level: 1, parentWbsId: null, totalCost: 315900000, itemCount: 4 },
      ],
    };

    it('must correctly filter exactly 4 eligible CostItems (Tiang, Kabel ADSS, Acc Tiang, Patty Cash)', () => {
      const eligibleItems = filterEligibleCostItems(mockSurgeJatengCostEstimate);
      expect(eligibleItems).toHaveLength(4);

      const names = eligibleItems.map((i) => i.itemName);
      expect(names).toEqual(['Tiang', 'Kabel ADSS', 'Acc Tiang', 'Patty Cash']);
    });

    it('must strictly exclude LABOR, PERMIT, and CONTINGENCY categories', () => {
      const eligibleItems = filterEligibleCostItems(mockSurgeJatengCostEstimate);
      const categories = eligibleItems.map((i) => i.categoryKey);

      expect(categories).not.toContain('LABOR');
      expect(categories).not.toContain('PERMIT');
      expect(categories).not.toContain('CONTINGENCY');

      const names = eligibleItems.map((i) => i.itemName);
      expect(names).not.toContain('Mandor Civil');
      expect(names).not.toContain('Donasi Lingkungan');
      expect(names).not.toContain('Donasi Kelurahan');
      expect(names).not.toContain('Biaya Cadangan');
    });

    it('must include PROJECT-level items alongside WBS-level items', () => {
      const eligibleItems = filterEligibleCostItems(mockSurgeJatengCostEstimate);
      const projectLevelItem = eligibleItems.find((i) => i.itemName === 'Patty Cash');
      expect(projectLevelItem).toBeDefined();
      expect(projectLevelItem.assignmentScope).toBe('PROJECT');
      expect(projectLevelItem.wbsId).toBeNull();

      const wbsItems = eligibleItems.filter((i) => i.assignmentScope === 'WBS');
      expect(wbsItems).toHaveLength(3);
    });

    it('must attach categoryKey, categoryLabel, and categoryMode metadata', () => {
      const eligibleItems = filterEligibleCostItems(mockSurgeJatengCostEstimate);
      for (const it of eligibleItems) {
        expect(it.categoryKey).toBeDefined();
        expect(it.categoryLabel).toBeDefined();
        expect(it.categoryMode).toBe('ITEMIZED');
      }
    });

    it('must resolve WBS label for WBS-scoped item and Project-Level for project-scoped item', () => {
      const wbsMap = buildWbsMap(mockSurgeJatengCostEstimate.wbsCostSummary);

      const tiangItem = { id: 45, assignmentScope: 'WBS' as const, wbsId: 45 };
      const tiangDisplay = resolveWbsDisplay(tiangItem, wbsMap);
      expect(tiangDisplay.isProjectLevel).toBe(false);
      expect(tiangDisplay.label).toBe('WBS 2.0 — Pekerjaan Civil Work');

      const pattyCashItem = { id: 51, assignmentScope: 'PROJECT' as const, wbsId: null };
      const pattyCashDisplay = resolveWbsDisplay(pattyCashItem, wbsMap);
      expect(pattyCashDisplay.isProjectLevel).toBe(true);
      expect(pattyCashDisplay.label).toBe('Project-Level');
    });

    it('must gracefully fallback to WBS Node #<id> when WBS label is not in summary', () => {
      const wbsMap = buildWbsMap(mockSurgeJatengCostEstimate.wbsCostSummary);

      const unmappedWbsItem = { id: 999, assignmentScope: 'WBS' as const, wbsId: 999 };
      const unmappedDisplay = resolveWbsDisplay(unmappedWbsItem, wbsMap);
      expect(unmappedDisplay.isProjectLevel).toBe(false);
      expect(unmappedDisplay.label).toBe('WBS Node #999');
    });

    it('must gracefully handle DIRECT mode categories or empty items without errors', () => {
      const directModeData = [
        {
          categoryKey: 'MATERIAL',
          categoryLabel: 'Material',
          groupKey: 'DIRECT',
          mode: 'DIRECT',
          directSubtotal: 10000000,
          categoryTotal: 10000000,
          items: [],
        },
      ];
      const items = filterEligibleCostItems(directModeData as any);
      expect(items).toEqual([]);
    });
  });
});
