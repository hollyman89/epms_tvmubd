import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementPackage, ProcurementPackageStatus } from '../../entities/procurement-package.entity';
import { Project } from '../../entities/project.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';

describe('Package availability and financial completion', () => {
  let service: ProcurementPackageService;
  let manager: any;
  let dataSource: any;
  let projectRepo: any;
  let estimateRepo: any;
  let itemRepo: any;
  let orderedQty: number;
  let pkg: any;
  const project = { id: 21, managerId: 879, status: 'IN_PROGRESS' };
  const estimate = { id: 1, projectId: 21, status: 'APPROVED' };
  const item = { id: 46, estimateId: 1, estimate, itemName: 'Kabel ADSS', quantity: 3000,
    unitPrice: 65000, subtotal: 195000000, uom: 'Meter', categoryKey: 'MATERIAL', entryMode: 'ITEMIZED' };
  const dto = { projectId: 21, title: 'Kabel', requiredDate: '2099-10-15', items: [{ costItemId: 46, requestedQty: 3000 }] };

  beforeEach(() => {
    orderedQty = 3000;
    pkg = { id: 1, projectId: 21, project, requiredDate: '2099-10-15', status: 'DRAFT', items: dto.items };
    manager = {
      findOne: jest.fn(async entity => entity === Project ? project : entity === ProjectCostEstimate ? estimate : entity === CostItem ? item : pkg),
      find: jest.fn().mockResolvedValue([item]),
      create: jest.fn((_, data) => ({ ...data })),
      save: jest.fn(async (_, data) => ({ id: 1, ...data })),
      delete: jest.fn(),
      query: jest.fn(async sql => sql.includes('AS ordered_qty') ? [{ ordered_qty: orderedQty, ordered_amount: orderedQty * 60000 }] : []),
      createQueryBuilder: jest.fn(() => ({ setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null), getMany: jest.fn().mockResolvedValue([item]) })),
    };
    dataSource = { manager, transaction: jest.fn(async (_, work) => work(manager)) };
    projectRepo = { findOne: jest.fn().mockResolvedValue(project) };
    estimateRepo = { findOne: jest.fn().mockResolvedValue(estimate) };
    itemRepo = { find: jest.fn().mockResolvedValue([item]) };
    service = new ProcurementPackageService({} as any, {} as any, {} as any, {} as any,
      projectRepo, itemRepo, estimateRepo, {} as any, {} as any, {} as any, dataSource);
  });

  it('reports zero availability for the completed 3000-meter ADSS PO', async () => {
    const rows = await service.getEligibleCostItems(21, 879, ['PROJECT_MANAGER']);
    expect(rows[0]).toMatchObject({ id: 46, availableQty: 0, orderedQty: 3000, availabilityStatus: 'FULLY_ALLOCATED' });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('forbids another PM from reading availability', async () => {
    await expect(service.getEligibleCostItems(21, 999, ['PROJECT_MANAGER'])).rejects.toThrow(ForbiddenException);
    expect(itemRepo.find).not.toHaveBeenCalled();
  });

  it('rejects creation and editing for exhausted items before saving', async () => {
    await expect(service.createDraft(879, ['PROJECT_MANAGER'], dto)).rejects.toThrow('Sisa Kuota: 0');
    await expect(service.updateDraft(1, 879, ['PROJECT_MANAGER'], dto)).rejects.toThrow('Sisa Kuota: 0');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('reports and enforces the remaining quantity of a partial PO', async () => {
    orderedQty = 2500;
    expect((await service.getEligibleCostItems(21, 879, ['PROJECT_MANAGER']))[0].availableQty).toBe(500);
    await expect(service.createDraft(879, [], { ...dto, items: [{ costItemId: 46, requestedQty: 501 }] })).rejects.toThrow('Sisa Kuota: 500');
    await expect(service.createDraft(879, [], { ...dto, items: [{ costItemId: 46, requestedQty: 500 }] })).resolves.toMatchObject({ status: 'DRAFT' });
  });

  it('rejects duplicate items and nonfinite quantities', async () => {
    await expect(service.updateDraft(1, 879, [], { items: [dto.items[0], dto.items[0]] })).rejects.toThrow('unik');
    await expect(service.createDraft(879, [], { ...dto, items: [{ costItemId: 46, requestedQty: Infinity }] })).rejects.toThrow(BadRequestException);
  });

  it('uses one transaction for save-and-submit and propagates submission failure', async () => {
    const failure = new BadRequestException('Sisa Kuota: 0');
    const create = jest.spyOn(service, 'createDraft').mockResolvedValue(pkg);
    const submit = jest.spyOn(service, 'submitPackage').mockRejectedValue(failure);
    await expect(service.saveAndSubmit(879, [], dto)).rejects.toBe(failure);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).toHaveBeenCalledWith('READ COMMITTED', expect.any(Function));
    expect(create).toHaveBeenCalledWith(879, [], dto, manager);
    expect(submit).toHaveBeenCalledWith(1, 879, [], manager);
  });

  it('uses one transaction for revision and resubmission', async () => {
    const update = jest.spyOn(service, 'updateDraft').mockResolvedValue(pkg);
    jest.spyOn(service, 'submitPackage').mockResolvedValue({ ...pkg, status: 'SUBMITTED' });
    await expect(service.saveAndSubmit(879, [], dto, 1)).resolves.toMatchObject({ status: 'SUBMITTED' });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(1, 879, [], dto, manager);
  });

  describe('CLOSED lifecycle', () => {
    let physicalStatus: string;
    let unpaidTerms: number;
    let invoiced: number;
    let paid: number;
    beforeEach(() => {
      pkg.status = ProcurementPackageStatus.PR_CREATED;
      physicalStatus = 'COMPLETED'; unpaidTerms = 0; invoiced = paid = 180000000;
      manager.query.mockImplementation(async sql => {
        if (sql.includes('ORDER BY po.id')) return [{ id: 1, status: physicalStatus, total_amount: 180000000 }];
        if (sql.includes('unpaid_terms')) return [{ unpaid_terms: unpaidTerms }];
        return [{ invoice_count: 1, unpaid_count: 0, invoiced_amount: invoiced, paid_amount: paid }];
      });
    });
    it('closes exactly once and records an audit log', async () => {
      expect(await service.closeCompletedPackage(1)).toBe(true);
      expect(pkg.status).toBe('CLOSED');
      expect(await service.closeCompletedPackage(1)).toBe(false);
      expect(manager.save).toHaveBeenCalledTimes(2);
    });
    it('keeps a paid package open before final goods receipt', async () => {
      physicalStatus = 'PARTIALLY_FULFILLED';
      expect(await service.closeCompletedPackage(1)).toBe(false);
    });
    it('keeps a delivered package open with remaining retention', async () => {
      unpaidTerms = 1;
      expect(await service.closeCompletedPackage(1)).toBe(false);
    });
    it('does not close when only the issued invoice is paid but PO billing is incomplete', async () => {
      invoiced = paid = 90000000;
      expect(await service.closeCompletedPackage(1)).toBe(false);
    });
    it('does not trust PAID labels without sufficient actual payments', async () => {
      paid = 90000000;
      expect(await service.closeCompletedPackage(1)).toBe(false);
    });
  });
});
