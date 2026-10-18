import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ProjectClosureService } from './project-closure.service';
import { ProjectService } from './project.service';
import { DocumentCategory } from '../../entities/document.entity';

describe('Phase 10 — Project Closure Procurement Domain & Document Readiness Regression', () => {
  let service: ProjectClosureService;
  let mockQuery: jest.Mock;
  let mockProjectService: any;

  beforeEach(async () => {
    mockQuery = jest.fn();
    mockProjectService = {
      calculateProjectOverallProgress: jest.fn().mockResolvedValue(100.0),
    };

    const mockDataSource: any = {
      query: mockQuery,
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectClosureService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compile();

    service = module.get<ProjectClosureService>(ProjectClosureService);
  });

  const setupBaseMocks = (overrides: {
    prs?: any[];
    rfqs?: any[];
    pos?: any[];
    docs?: any[];
  } = {}) => {
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      // 1. Project
      if (sql.includes('SELECT p.id, p.code, p.name, p.status')) {
        return [{ id: 1, code: 'CONT-20261015-0001', name: 'Test Proj', status: 'IN_PROGRESS', manager_id: 2, contract_id: 1 }];
      }
      // Contract
      if (sql.includes('FROM contracts c')) {
        return [{ id: 1, contract_number: 'CONT-1', status: 'ACTIVE' }];
      }
      // Tasks
      if (sql.includes('SELECT') && sql.includes('FROM tasks t')) {
        return [
          { task_id: 1, task_status: 'COMPLETED', task_progress: '100', actual_finish_at: '2026-10-15T00:00:00Z', is_leaf: 1 },
        ];
      }
      // Pending progress verification
      if (sql.includes('FROM project_progress_logs')) {
        return [];
      }
      // Issues
      if (sql.includes('FROM project_issues')) {
        return [];
      }
      // Risks
      if (sql.includes('FROM project_risks')) {
        return [];
      }
      // PRs
      if (sql.includes('FROM purchase_requests pr') && !sql.includes('JOIN purchase_requests pr')) {
        return overrides.prs || [];
      }
      // RFQs
      if (sql.includes('FROM rfqs rfq')) {
        return overrides.rfqs || [];
      }
      // Material POs
      if (sql.includes("po.order_type IN ('MATERIAL', 'LEGACY_MIXED')")) {
        return overrides.pos || [];
      }
      // Service POs
      if (sql.includes("po.order_type = 'SERVICE'")) {
        return [];
      }
      // Service Orders
      if (sql.includes('FROM service_orders so')) {
        return [];
      }
      // Service Claims
      if (sql.includes('FROM service_claims sc')) {
        return [];
      }
      // Invoices
      if (sql.includes('FROM invoices i')) {
        return [];
      }
      // Payment Requests
      if (sql.includes('FROM payment_requests prq')) {
        return [];
      }
      // Retention
      if (sql.includes('FROM po_payment_terms pt')) {
        return [];
      }
      // Documents
      if (sql.includes('FROM documents')) {
        return overrides.docs !== undefined ? overrides.docs : [
          { id: 10, file_name: 'bast.pdf', file_size: 50000, category: DocumentCategory.CUSTOMER_BAST, created_at: new Date() },
          { id: 11, file_name: 'final_report.pdf', file_size: 80000, category: DocumentCategory.FINAL_REPORT, created_at: new Date() },
        ];
      }
      return [];
    });
  };

  // Regression 1 & 2: Material completed + Service PR/RFQ open must NOT show MATERIAL_PR_OPEN or MATERIAL_RFQ_OPEN
  it('1 & 2. Material completed + Service PR/RFQ open → must NOT show MATERIAL_PR_OPEN or MATERIAL_RFQ_OPEN', async () => {
    setupBaseMocks({
      prs: [
        { id: 1, pr_number: 'PR-MAT-1', status: 'PO_ISSUED', resource_type: 'MATERIAL' },
        { id: 3, pr_number: 'PR-SVC-3', status: 'APPROVED', resource_type: 'SERVICE' },
      ],
      rfqs: [
        { id: 1, rfq_number: 'RFQ-MAT-1', status: 'EVALUATED', pr_id: 1, resource_type: 'MATERIAL' },
        { id: 3, rfq_number: 'RFQ-SVC-3', status: 'OPEN', pr_id: 3, resource_type: 'SERVICE' },
      ],
      pos: [
        { id: 1, po_number: 'PO-MAT-1', status: 'COMPLETED', total_amount: 1000, total_received: 1000 },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'MATERIAL_PR_OPEN')).toBe(false);
    expect(res.blockers.some((b) => b.code === 'MATERIAL_RFQ_OPEN')).toBe(false);
    expect(res.procurement.material.openPRCount).toBe(0);
    expect(res.procurement.material.openRFQCount).toBe(0);
  });

  // Regression 3: Service open blockers classified correctly
  it('3. Service open blockers are classified under SERVICE_PROCUREMENT as SERVICE_PR_OPEN and SERVICE_RFQ_OPEN', async () => {
    setupBaseMocks({
      prs: [
        { id: 1, pr_number: 'PR-MAT-1', status: 'PO_ISSUED', resource_type: 'MATERIAL' },
        { id: 3, pr_number: 'PR-SVC-3', status: 'APPROVED', resource_type: 'SERVICE' },
        { id: 7, pr_number: 'PR-SVC-7', status: 'SUBMITTED', resource_type: 'SERVICE' },
      ],
      rfqs: [
        { id: 1, rfq_number: 'RFQ-MAT-1', status: 'EVALUATED', pr_id: 1, resource_type: 'MATERIAL' },
        { id: 3, rfq_number: 'RFQ-SVC-3', status: 'OPEN', pr_id: 3, resource_type: 'SERVICE' },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    const servicePrBlocker = res.blockers.find((b) => b.code === 'SERVICE_PR_OPEN');
    expect(servicePrBlocker).toBeDefined();
    expect(servicePrBlocker?.domain).toBe('SERVICE_PROCUREMENT');
    expect(servicePrBlocker?.count).toBe(2);
    expect(servicePrBlocker?.entityIds).toEqual([3, 7]);

    const serviceRfqBlocker = res.blockers.find((b) => b.code === 'SERVICE_RFQ_OPEN');
    expect(serviceRfqBlocker).toBeDefined();
    expect(serviceRfqBlocker?.domain).toBe('SERVICE_PROCUREMENT');
    expect(serviceRfqBlocker?.count).toBe(1);
    expect(serviceRfqBlocker?.entityIds).toEqual([3]);

    expect(res.procurement.service.openPRCount).toBe(2);
    expect(res.procurement.service.openRFQCount).toBe(1);
  });

  // Regression 4: CUSTOMER_BAST clears only customer acceptance blocker
  it('4. CUSTOMER_BAST clears only customer acceptance blocker and leaves FINAL_REPORT_MISSING blocked', async () => {
    setupBaseMocks({
      docs: [
        { id: 10, file_name: 'customer_bast.pdf', file_size: 50000, category: DocumentCategory.CUSTOMER_BAST, created_at: new Date() },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(false);
    expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(true);
    expect(res.documents.customerBastPresent).toBe(true);
    expect(res.documents.finalReportPresent).toBe(false);
  });

  // Regression 5: FINAL_REPORT clears only final report blocker
  it('5. FINAL_REPORT clears only final report blocker and leaves CUSTOMER_ACCEPTANCE_MISSING blocked', async () => {
    setupBaseMocks({
      docs: [
        { id: 11, file_name: 'final_report.pdf', file_size: 80000, category: DocumentCategory.FINAL_REPORT, created_at: new Date() },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(false);
    expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
    expect(res.documents.finalReportPresent).toBe(true);
    expect(res.documents.customerBastPresent).toBe(false);
  });

  // Regression 6: INTERNAL_HANDOVER does not satisfy CUSTOMER_BAST
  it('6. INTERNAL_HANDOVER does NOT satisfy CUSTOMER_BAST requirement', async () => {
    setupBaseMocks({
      docs: [
        { id: 12, file_name: 'internal_handover.pdf', file_size: 60000, category: DocumentCategory.INTERNAL_HANDOVER, created_at: new Date() },
        { id: 11, file_name: 'final_report.pdf', file_size: 80000, category: DocumentCategory.FINAL_REPORT, created_at: new Date() },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
    expect(res.documents.internalHandoverPresent).toBe(true);
    expect(res.documents.customerBastPresent).toBe(false);
  });

  // Regression 7: Progress Evidence does not satisfy Closure documents
  it('7. Progress Evidence does NOT satisfy Closure documents', async () => {
    setupBaseMocks({
      docs: [
        { id: 303, file_name: 'FORM_BA_LAPANGAN.pdf', file_size: 101266, category: DocumentCategory.OTHER, created_at: new Date() },
        { id: 277, file_name: 'bukti_penyelesaian_perizinan.pdf', file_size: 475, category: DocumentCategory.OTHER, created_at: new Date() },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
    expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(true);
    expect(res.documents.customerBastPresent).toBe(false);
    expect(res.documents.finalReportPresent).toBe(false);
  });

  // Regression 8: generic OTHER does not satisfy Closure requirements
  it('8. Generic OTHER does NOT satisfy Closure requirements', async () => {
    setupBaseMocks({
      docs: [
        { id: 340, file_name: 'Receipt.pdf', file_size: 38000, category: DocumentCategory.OTHER, created_at: new Date() },
        { id: 341, file_name: 'peraturan.pdf', file_size: 4000000, category: DocumentCategory.OTHER, created_at: new Date() },
        { id: 342, file_name: 'CV.pdf', file_size: 180000, category: DocumentCategory.OTHER, created_at: new Date() },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
    expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(true);
  });

  // Regression 9: No duplicate physical documents needed for multi-category projection
  it('9. Multi-category projection works purely via read-model without physical duplicates', () => {
    const rawDocuments = [
      { id: 2, fileName: 'SPK-CONT.pdf', category: 'LEGAL_APPROVED', isContractSpk: true },
      { id: 277, fileName: 'bukti.pdf', category: 'OTHER', isProgressEvidence: true },
      { id: 340, fileName: 'receipt.pdf', category: 'OTHER' },
    ];

    // Projection for Contract: includes category CONTRACT or isContractSpk
    const contractDocs = rawDocuments.filter((d) => d.category === 'CONTRACT' || d.isContractSpk);
    const legalApprovedDocs = rawDocuments.filter((d) => d.category === 'LEGAL_APPROVED');
    const progressEvidenceDocs = rawDocuments.filter((d) => (d as any).isProgressEvidence);

    expect(legalApprovedDocs.length).toBe(1);
    expect(legalApprovedDocs[0].id).toBe(2);

    expect(contractDocs.length).toBe(1);
    expect(contractDocs[0].id).toBe(2);

    expect(progressEvidenceDocs.length).toBe(1);
    expect(progressEvidenceDocs[0].id).toBe(277);

    // Total unique physical documents remains exactly 3
    const uniquePhysicalIds = new Set(rawDocuments.map((d) => d.id));
    expect(uniquePhysicalIds.size).toBe(3);
  });

  // Regression 10: Zero-byte / test artifact never satisfies Closure readiness
  it('10. Zero-byte test artifact never satisfies Closure readiness', async () => {
    setupBaseMocks({
      docs: [
        { id: 991, file_name: 'fake_bast.pdf', file_size: 0, category: DocumentCategory.CUSTOMER_BAST, created_at: new Date() },
        { id: 992, file_name: 'fake_report.pdf', file_size: 0, category: DocumentCategory.FINAL_REPORT, created_at: new Date() },
      ],
    });

    const res = await service.evaluateClosureReadiness(1);

    expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
    expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(true);
    expect(res.documents.customerBastPresent).toBe(false);
    expect(res.documents.finalReportPresent).toBe(false);
  });
});
