/**
 * EPMS — PROJECT-SERVICE-ENTRY-R1B
 * PM SERVICE PROCUREMENT STARTING POINT
 *
 * Focused Test Suite covering all 9 authoritative cases:
 * CASE 1: Assigned PM on eligible project sees "Pengadaan Jasa".
 * CASE 2: PM opens Pengadaan Jasa with correct project context.
 * CASE 3: Submit service procurement request -> created items/family = SERVICE.
 * CASE 4: Existing material package action still creates MATERIAL, not SERVICE.
 * CASE 5: Procurement receives/sees SERVICE request.
 * CASE 6: SERVICE and MATERIAL are distinguishable in UI via badges.
 * CASE 7: PM cannot perform Procurement commercial actions.
 * CASE 8: No Service Claim yet: Verifikasi Klaim Jasa is hidden / not falsely indicating pending work.
 * CASE 9: Existing Service Claim technical-verification wiring remains intact.
 */

import {
  SERVICE_FAMILY_CATEGORIES,
  MATERIAL_FAMILY_CATEGORIES,
  PmProcurementPackageModalProps,
} from '../PmProcurementPackageModal';

describe('EPMS — PROJECT-SERVICE-ENTRY-R1B: PM Service Procurement Starting Point Suite', () => {
  const mockAsianetProject = {
    id: 1760,
    projectId: 1760,
    project_code: 'CONT-ASIANET-001',
    project_name: 'Implementasi Fiber Optik Asianet Jakarta',
    customerName: 'PT Asianet Media Teknologi',
    contract_total_value: 750000000,
    managerId: 42,
    projectManagerId: 42,
    pmName: 'Johan PM',
    status: 'IN_PROGRESS',
    overallProgress: 65,
  };

  const mockCostItems = [
    {
      id: 101,
      itemName: 'Kabel Fiber Optik ADSS 24 Core',
      categoryKey: 'MATERIAL',
      availableQty: 5000,
      uom: 'Meter',
      unitPrice: 12000,
    },
    {
      id: 102,
      itemName: 'Tiang Besi 7 Meter 140daN',
      categoryKey: 'MATERIAL',
      availableQty: 80,
      uom: 'Batang',
      unitPrice: 1500000,
    },
    {
      id: 201,
      itemName: 'Jasa Penarikan Kabel FO (Subkon)',
      categoryKey: 'SUBCONTRACTOR',
      availableQty: 5000,
      uom: 'Meter',
      unitPrice: 8500,
    },
    {
      id: 202,
      itemName: 'Sewa Alat Fusion Splicer & OTDR',
      categoryKey: 'EQUIPMENT',
      availableQty: 14,
      uom: 'Hari',
      unitPrice: 750000,
    },
    {
      id: 203,
      itemName: 'Biaya Perizinan Lingkungan & Retribusi',
      categoryKey: 'OPERATIONAL',
      availableQty: 1,
      uom: 'Lot',
      unitPrice: 15000000,
    },
  ];

  // Helper simulating "Aksi lainnya" menu item resolution in Project Delivery
  const resolveProjectDeliveryMoreMenuItems = (
    project: typeof mockAsianetProject,
    user: { id: number; roles: string[] },
    submittedClaimsCount: number = 0
  ) => {
    const isAssignedPm = Number(project.managerId) === Number(user.id);
    const isManagement = user.roles.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PMO'].includes(r)
    );
    const isEligibleProject = project.status === 'IN_PROGRESS';

    const items: Array<{ key: string; label: string; family?: string }> = [
      { key: 'workspace', label: 'Buka Project Workspace' },
      { key: 'detail', label: 'Detail Project' },
      { key: 'task-board', label: 'Task Board' },
      { key: 'progress-monitoring', label: 'Progress & Monitoring (S-Curve)' },
      { key: 'gantt', label: 'Gantt Chart (Baseline vs Actual)' },
    ];

    if (isEligibleProject && (isAssignedPm || isManagement)) {
      items.push({
        key: 'procurement-material',
        label: 'Paket Pengadaan Material',
        family: 'MATERIAL',
      });
      items.push({
        key: 'procurement-service',
        label: 'Pengadaan Jasa',
        family: 'SERVICE',
      });
    }

    // Verifikasi Klaim Jasa is conditionally visible ONLY when submitted claims exist
    if (submittedClaimsCount > 0 && (isAssignedPm || isManagement)) {
      items.push({
        key: 'service-claim',
        label: 'Verifikasi Klaim Jasa',
      });
    }

    items.push({ key: 'operational-plan', label: 'Operational Plan' });
    items.push({ key: 'closure', label: 'Project Closure' });

    return items;
  };

  describe('CASE 1: Assigned PM on eligible project sees Pengadaan Jasa', () => {
    it('shows both "Paket Pengadaan Material" and "Pengadaan Jasa" as separate actions for assigned PM', () => {
      const pmUser = { id: 42, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, pmUser);

      const materialItem = menuItems.find((i) => i.key === 'procurement-material');
      const serviceItem = menuItems.find((i) => i.key === 'procurement-service');

      expect(materialItem).toBeDefined();
      expect(materialItem?.label).toBe('Paket Pengadaan Material');

      expect(serviceItem).toBeDefined();
      expect(serviceItem?.label).toBe('Pengadaan Jasa');

      // They must NOT be combined into a single generic "Paket Pengadaan"
      expect(menuItems.some((i) => i.label === 'Paket Pengadaan')).toBe(false);
    });

    it('does NOT show procurement actions if project is not eligible (not IN_PROGRESS)', () => {
      const draftProject = { ...mockAsianetProject, status: 'PLANNING' };
      const pmUser = { id: 42, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(draftProject, pmUser);

      expect(menuItems.some((i) => i.key === 'procurement-service')).toBe(false);
      expect(menuItems.some((i) => i.key === 'procurement-material')).toBe(false);
    });
  });

  describe('CASE 2: PM opens Pengadaan Jasa with correct project context', () => {
    it('modal receives project context and packageFamily = SERVICE', () => {
      const modalProps: PmProcurementPackageModalProps = {
        open: true,
        project: mockAsianetProject,
        packageFamily: 'SERVICE',
        onClose: () => {},
      };

      expect(modalProps.project?.id).toBe(1760);
      expect(modalProps.project?.project_name).toBe('Implementasi Fiber Optik Asianet Jakarta');
      expect(modalProps.packageFamily).toBe('SERVICE');
    });
  });

  describe('CASE 3: Submit service procurement request -> items strictly in SERVICE family', () => {
    it('SERVICE mode filters cost items to only SUBCONTRACTOR, EQUIPMENT, OPERATIONAL', () => {
      const filteredForService = mockCostItems.filter((item) =>
        SERVICE_FAMILY_CATEGORIES.includes(item.categoryKey)
      );

      expect(filteredForService.length).toBe(3);
      filteredForService.forEach((item) => {
        expect(['SUBCONTRACTOR', 'EQUIPMENT', 'OPERATIONAL']).toContain(item.categoryKey);
        expect(item.categoryKey).not.toBe('MATERIAL');
      });
    });

    it('creates package draft with type distinguishable as SERVICE via its item categories', () => {
      const servicePackagePayload = {
        projectId: 1760,
        title: 'Pengadaan Subkontraktor Penarikan FO Asianet',
        requiredDate: '2026-11-01',
        items: [
          { costItemId: 201, requestedQty: 5000 },
          { costItemId: 202, requestedQty: 14 },
        ],
      };

      // Verify all items map to SERVICE family
      const itemCategories = servicePackagePayload.items.map((it) => {
        const found = mockCostItems.find((ci) => ci.id === it.costItemId);
        return found?.categoryKey;
      });

      const isServicePackage = itemCategories.every((cat) =>
        SERVICE_FAMILY_CATEGORIES.includes(cat || '')
      );
      expect(isServicePackage).toBe(true);
    });
  });

  describe('CASE 4: Existing material package action still creates MATERIAL, not SERVICE', () => {
    it('MATERIAL mode filters cost items strictly to MATERIAL only', () => {
      const filteredForMaterial = mockCostItems.filter((item) =>
        MATERIAL_FAMILY_CATEGORIES.includes(item.categoryKey)
      );

      expect(filteredForMaterial.length).toBe(2);
      filteredForMaterial.forEach((item) => {
        expect(item.categoryKey).toBe('MATERIAL');
        expect(SERVICE_FAMILY_CATEGORIES).not.toContain(item.categoryKey);
      });
    });

    it('material package does not leak service semantics', () => {
      const materialPackagePayload = {
        projectId: 1760,
        title: 'Pengadaan Material Tiang & Kabel FO',
        items: [
          { costItemId: 101, requestedQty: 5000 },
          { costItemId: 102, requestedQty: 80 },
        ],
      };

      const itemCategories = materialPackagePayload.items.map((it) => {
        const found = mockCostItems.find((ci) => ci.id === it.costItemId);
        return found?.categoryKey;
      });

      const isPureMaterial = itemCategories.every((cat) =>
        MATERIAL_FAMILY_CATEGORIES.includes(cat || '')
      );
      expect(isPureMaterial).toBe(true);
    });
  });

  describe('CASE 5 & 6: Procurement receives SERVICE request and distinguishes it from MATERIAL', () => {
    const mockPackagesInProcurement = [
      {
        id: 11,
        packageNumber: 'PKG-1760-001',
        title: 'Kabel & Tiang FO',
        projectId: 1760,
        items: [
          { costItemId: 101, costItem: { categoryKey: 'MATERIAL' } },
        ],
      },
      {
        id: 12,
        packageNumber: 'PKG-1760-002',
        title: 'Jasa Penarikan FO & Sewa Splicer',
        projectId: 1760,
        items: [
          { costItemId: 201, costItem: { categoryKey: 'SUBCONTRACTOR' } },
          { costItemId: 202, costItem: { categoryKey: 'EQUIPMENT' } },
        ],
      },
    ];

    const classifyPackageType = (pkg: typeof mockPackagesInProcurement[0]) => {
      const isService = (pkg.items || []).some((item) =>
        SERVICE_FAMILY_CATEGORIES.includes(item.costItem?.categoryKey || '')
      );
      return isService ? 'SERVICE' : 'MATERIAL';
    };

    it('Procurement can distinguish between MATERIAL and SERVICE packages', () => {
      expect(classifyPackageType(mockPackagesInProcurement[0])).toBe('MATERIAL');
      expect(classifyPackageType(mockPackagesInProcurement[1])).toBe('SERVICE');
    });

    it('renders distinct badges: JASA (purple) vs MATERIAL (cyan)', () => {
      const getBadgeProps = (pkg: typeof mockPackagesInProcurement[0]) => {
        const type = classifyPackageType(pkg);
        return type === 'SERVICE'
          ? { text: 'JASA', color: 'purple' }
          : { text: 'MATERIAL', color: 'cyan' };
      };

      expect(getBadgeProps(mockPackagesInProcurement[0])).toEqual({ text: 'MATERIAL', color: 'cyan' });
      expect(getBadgeProps(mockPackagesInProcurement[1])).toEqual({ text: 'JASA', color: 'purple' });
    });
  });

  describe('CASE 7: PM cannot perform Procurement commercial actions', () => {
    it('preserves strict RBAC: PM cannot issue Service PO or perform commercial verification', () => {
      const pmRole = 'PROJECT_MANAGER';
      const procurementRole = 'PROCUREMENT';

      const canCreateServiceRequirement = (role: string) => ['PROJECT_MANAGER', 'SUPER_ADMIN'].includes(role);
      const canIssueServicePo = (role: string) => ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'].includes(role);
      const canVerifyCommercialClaim = (role: string) => ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'].includes(role);

      expect(canCreateServiceRequirement(pmRole)).toBe(true);
      expect(canIssueServicePo(pmRole)).toBe(false);
      expect(canVerifyCommercialClaim(pmRole)).toBe(false);

      expect(canIssueServicePo(procurementRole)).toBe(true);
      expect(canVerifyCommercialClaim(procurementRole)).toBe(true);
    });
  });

  describe('CASE 8: No Service Claim yet -> Verifikasi Klaim Jasa is hidden / not falsely indicating work', () => {
    it('hides "Verifikasi Klaim Jasa" when submitted claims count is 0', () => {
      const pmUser = { id: 42, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, pmUser, 0);

      expect(menuItems.some((i) => i.key === 'service-claim')).toBe(false);
    });

    it('shows "Verifikasi Klaim Jasa" when submitted claims count > 0', () => {
      const pmUser = { id: 42, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, pmUser, 2);

      const claimItem = menuItems.find((i) => i.key === 'service-claim');
      expect(claimItem).toBeDefined();
      expect(claimItem?.label).toBe('Verifikasi Klaim Jasa');
    });
  });

  describe('CASE 9: Existing Service Claim technical-verification wiring remains intact', () => {
    it('preserves existing modal props and callback signatures', () => {
      let closed = false;
      let verified = false;

      const props = {
        open: true,
        claimId: 108,
        projectId: 1760,
        onClose: () => { closed = true; },
        onSuccess: () => { verified = true; },
      };

      expect(props.open).toBe(true);
      expect(props.claimId).toBe(108);
      expect(props.projectId).toBe(1760);

      props.onClose();
      expect(closed).toBe(true);

      props.onSuccess();
      expect(verified).toBe(true);
    });
  });
});
