/** Local regression check for SURGE JATENG. Test transactions always roll back.
 * --close-existing also closes PKG-20260922-001 if physically and financially complete.
 */
import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ProcurementPackageService } from '../src/modules/procurement/procurement-package.service';
import { ProcurementPackage } from '../src/entities/procurement-package.entity';
import { ProcurementPackageItem } from '../src/entities/procurement-package-item.entity';
import { PurchaseRequest } from '../src/entities/purchase-request.entity';
import { PurchaseRequestItem } from '../src/entities/purchase-request-item.entity';
import { Project } from '../src/entities/project.entity';
import { CostItem } from '../src/entities/cost-item.entity';
import { ProjectCostEstimate } from '../src/entities/project-cost-estimate.entity';
import { WorkflowDefinition } from '../src/entities/workflow-definition.entity';
import { WorkflowInstance } from '../src/entities/workflow-instance.entity';

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const ds = new DataSource({
  type: 'mysql', host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT || 3306),
  username: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME,
  entities: [path.resolve(__dirname, '../src/entities/*.entity.ts')], synchronize: false, logging: false,
});
function makeService(source: any = ds) {
  return new ProcurementPackageService(ds.getRepository(ProcurementPackage), ds.getRepository(ProcurementPackageItem),
    ds.getRepository(PurchaseRequest), ds.getRepository(PurchaseRequestItem), ds.getRepository(Project),
    ds.getRepository(CostItem), ds.getRepository(ProjectCostEstimate), ds.getRepository(WorkflowDefinition),
    ds.getRepository(WorkflowInstance), {} as any, source);
}
async function main() {
  await ds.initialize();
  try {
    const project = await ds.getRepository(Project).findOneByOrFail({ code: 'CONT-20260922-0012' });
    const service = makeService();
    const roles = ['PROJECT_MANAGER'];
    const userId = Number(project.managerId);
    const rows = await service.getEligibleCostItems(Number(project.id), userId, roles);
    const cable = rows.find(row => row.itemName === 'Kabel ADSS');
    assert.ok(cable);
    assert.equal(cable.availableQty, 0);
    assert.equal(cable.orderedQty, 3000);
    await assert.rejects(service.getEligibleCostItems(Number(project.id), -1, roles), /Akses ditolak/);
    const counts = async () => ds.query(`SELECT
      (SELECT COUNT(*) FROM procurement_packages) packages,
      (SELECT COUNT(*) FROM procurement_package_items) items,
      (SELECT COUNT(*) FROM invoices) invoices,
      (SELECT COUNT(*) FROM payments) payments,
      (SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE deleted_at IS NULL) paid`);
    const before = await counts();
    const dto = { projectId: Number(project.id), title: 'Regression check (rollback)', requiredDate: '2099-10-15',
      items: [{ costItemId: cable.id, requestedQty: 1 }] };
    await assert.rejects(service.createDraft(userId, roles, dto), /Sisa Kuota: 0/);
    await assert.rejects(service.saveAndSubmit(userId, roles, dto), /Sisa Kuota: 0/);

    const available = rows.find(row => row.availableQty >= 1);
    assert.ok(available, 'Need one available item for rollback regression');
    const validDto = { ...dto, items: [{ costItemId: available.id, requestedQty: 1 }] };
    // Fails after the draft and its audit have been inserted: all must roll back.
    await assert.rejects(service.saveAndSubmit(userId, roles, { ...validDto, requiredDate: undefined }), /wajib diisi/);
    assert.deepEqual(await counts(), before);

    const rollback = new Error('EXPECTED_TEST_ROLLBACK');
    const rollbackService = makeService({ manager: ds.manager, transaction: (isolation, work) =>
      ds.transaction(isolation, async manager => {
        const result = await work(manager);
        assert.equal(result.status, 'SUBMITTED');
        throw rollback;
      }) });
    await assert.rejects(rollbackService.saveAndSubmit(userId, roles, validDto), error => error === rollback);
    assert.deepEqual(await counts(), before);
    console.log('PASS: live quota, PM ownership, exhausted-item rejection, successful submission rollback, failed submission rollback.');

    const pkg = await ds.getRepository(ProcurementPackage).findOneByOrFail({ packageNumber: 'PKG-20260922-001' });
    if (process.argv.includes('--close-existing')) {
      const closed = await service.closeCompletedPackage(Number(pkg.id));
      assert.equal((await ds.getRepository(ProcurementPackage).findOneByOrFail({ id: pkg.id })).status, 'CLOSED');
      assert.equal(await service.closeCompletedPackage(Number(pkg.id)), false);
      const [audit] = await ds.query(`SELECT COUNT(*) count FROM audit_logs
        WHERE table_name = 'procurement_packages' AND record_id = ? AND action = 'CLOSE_PACKAGE'`, [pkg.id]);
      assert.equal(Number(audit.count), 1);
      assert.deepEqual(await counts(), before);
      console.log(`PASS: ${pkg.packageNumber} CLOSED; changed=${closed}; exactly one closure audit; financial records unchanged.`);
    }
    console.log(JSON.stringify({ item: cable.itemName, baselineQty: cable.baselineQty, orderedQty: cable.orderedQty, availableQty: cable.availableQty }));
  } finally { await ds.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
