import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { ForbiddenException } from '@nestjs/common';
import { ProjectClosureService } from './project-closure.service';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { DocumentCategory } from '../../entities/document.entity';
import { ProjectRiskStatus } from '../../entities/project-risk.entity';
import { ProjectIssueStatus } from '../../entities/project-issue.entity';

dotenv.config();

describe('EPMS — PROJECT-CLOSE-R1-C2 Closure Readiness Aggregation Spec', () => {
  describe('Unit Evaluation Matrix (Mocked DataSource)', () => {
    let service: ProjectClosureService;
    let mockDataSource: any;
    let mockProjectService: any;

    beforeEach(() => {
      mockDataSource = {
        query: jest.fn(),
      };
      mockProjectService = {
        calculateProjectOverallProgress: jest.fn().mockResolvedValue(100.0),
      };
      service = new ProjectClosureService(mockDataSource, mockProjectService);
    });

    it('A. IN_PROGRESS project is eligible for readiness evaluation', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.project.eligible).toBe(true);
      expect(res.project.status).toBe('IN_PROGRESS');
      expect(res.blockers.some((b) => b.code === 'PROJECT_NOT_IN_PROGRESS')).toBe(false);
    });

    it('A2. PLANNING or CLOSED project is marked ineligible and blocks evaluation', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'PLANNING', manager_id: 2 }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.project.eligible).toBe(false);
      expect(res.ready).toBe(false);
      expect(res.blockers.some((b) => b.code === 'PROJECT_NOT_IN_PROGRESS')).toBe(true);
    });

    it('B. Physical progress < 100 produces PHYSICAL_PROGRESS_INCOMPLETE blocker', async () => {
      mockProjectService.calculateProjectOverallProgress.mockResolvedValue(85.5);
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.physical.overallProgress).toBe(85.5);
      expect(res.physical.isComplete).toBe(false);
      const blocker = res.blockers.find((b) => b.code === 'PHYSICAL_PROGRESS_INCOMPLETE');
      expect(blocker).toBeDefined();
      expect(blocker?.domain).toBe('PHYSICAL_EXECUTION');
      expect(res.ready).toBe(false);
    });

    it('C. Physical = 100 + incomplete leaf task remains blocked (TASK_INCOMPLETE)', async () => {
      mockProjectService.calculateProjectOverallProgress.mockResolvedValue(100.0);
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM project_baselines')) {
          return [
            { task_id: 1, task_status: 'COMPLETED', task_progress: '100', actual_finish_at: '2026-10-01' },
            { task_id: 2, task_status: 'IN_PROGRESS', task_progress: '90', actual_finish_at: null },
          ];
        }
        if (sql.includes('FROM project_progress_logs')) {
          return [{ count: 0 }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.tasks.incompleteLeafTasks).toBe(1);
      expect(res.blockers.some((b) => b.code === 'TASK_INCOMPLETE')).toBe(true);
      expect(res.blockers.some((b) => b.code === 'TASK_ACTUAL_FINISH_MISSING')).toBe(true);
      expect(res.physicalActualFinishCandidate).toBeNull();
    });

    it('D. Resolved-but-not-Closed Issue blocks with OPEN_PROJECT_ISSUES', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM project_issues')) {
          return [
            { id: 101, issue_number: 'ISS-1', title: 'Issue 1', status: 'RESOLVED' },
            { id: 102, issue_number: 'ISS-2', title: 'Issue 2', status: 'CLOSED' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.issues.resolvedIssues).toBe(1);
      expect(res.issues.closedIssues).toBe(1);
      expect(res.issues.blockingIssueCount).toBe(1);
      const blocker = res.blockers.find((b) => b.code === 'OPEN_PROJECT_ISSUES');
      expect(blocker).toBeDefined();
      expect(blocker?.entityIds).toContain(101);
    });

    it('E. Active Risk and unresolved Materialized Risk block with ACTIVE_PROJECT_RISKS', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM project_risks')) {
          return [
            { id: 50, risk_number: 'RSK-1', title: 'Risk 1', status: 'MONITORING', linked_issue_id: null, linked_issue_status: null },
            { id: 51, risk_number: 'RSK-2', title: 'Risk 2', status: 'MATERIALIZED', linked_issue_id: 101, linked_issue_status: 'OPEN' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.risks.activeRiskCount).toBe(1);
      expect(res.risks.unresolvedMaterializedRiskCount).toBe(1);
      const blocker = res.blockers.find((b) => b.code === 'ACTIVE_PROJECT_RISKS');
      expect(blocker).toBeDefined();
    });

    it('E2. Canonical Risk clearance rules: CANCELLED and CLOSED are non-blocking, MATERIALIZED with CLOSED issue is non-blocking, while active statuses block', async () => {
      // 1. Terminal non-blocking risks: CLOSED, CANCELLED, and MATERIALIZED (linked issue CLOSED)
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM project_risks')) {
          return [
            { id: 50, risk_number: 'RSK-1', title: 'Risk 1', status: ProjectRiskStatus.CLOSED, linked_issue_id: null, linked_issue_status: null },
            { id: 51, risk_number: 'RSK-2', title: 'Risk 2', status: ProjectRiskStatus.CANCELLED, linked_issue_id: null, linked_issue_status: null },
            { id: 52, risk_number: 'RSK-3', title: 'Risk 3', status: ProjectRiskStatus.MATERIALIZED, linked_issue_id: 101, linked_issue_status: ProjectIssueStatus.CLOSED },
          ];
        }
        return [];
      });

      let res = await service.evaluateClosureReadiness(10);
      expect(res.risks.activeRiskCount).toBe(0);
      expect(res.risks.unresolvedMaterializedRiskCount).toBe(0);
      expect(res.risks.clearedRiskCount).toBe(3);
      expect(res.blockers.some((b) => b.code === 'ACTIVE_PROJECT_RISKS')).toBe(false);

      // 2. Active statuses: IDENTIFIED, ASSESSED, MITIGATING, MONITORING each produce ACTIVE_PROJECT_RISKS blocker
      const activeStatuses = [
        ProjectRiskStatus.IDENTIFIED,
        ProjectRiskStatus.ASSESSED,
        ProjectRiskStatus.MITIGATING,
        ProjectRiskStatus.MONITORING,
      ];
      for (const activeStatus of activeStatuses) {
        mockDataSource.query.mockImplementation(async (sql: string) => {
          if (sql.includes('FROM projects')) {
            return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
          }
          if (sql.includes('FROM project_risks')) {
            return [
              { id: 60, risk_number: 'RSK-ACT', title: 'Active Risk', status: activeStatus, linked_issue_id: null, linked_issue_status: null },
            ];
          }
          return [];
        });

        res = await service.evaluateClosureReadiness(10);
        expect(res.risks.activeRiskCount).toBe(1);
        expect(res.blockers.some((b) => b.code === 'ACTIVE_PROJECT_RISKS')).toBe(true);
      }
    });

    it('F. Outstanding Material PO and missing GR block with MATERIAL_PO_UNFULFILLED and MATERIAL_GR_OUTSTANDING', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM purchase_orders') && sql.includes("'MATERIAL'")) {
          return [
            { id: 201, po_number: 'PO-MAT-1', status: 'ISSUED', total_amount: '50000000', total_received: '0' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.procurement.material.unfulfilledMaterialPOCount).toBe(1);
      expect(res.procurement.material.pendingGRCount).toBe(1);
      expect(res.blockers.some((b) => b.code === 'MATERIAL_PO_UNFULFILLED')).toBe(true);
      expect(res.blockers.some((b) => b.code === 'MATERIAL_GR_OUTSTANDING')).toBe(true);
    });

    it('G. SERVICE PO does NOT require Goods Receipt and un-reconciled remaining scope blocks with SERVICE_SCOPE_RECONCILIATION_REQUIRED', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM purchase_orders') && sql.includes("'SERVICE'")) {
          return [
            { id: 301, po_number: 'PO-SRV-1', status: 'ISSUED', total_amount: '100000000' },
          ];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            { id: 401, claim_number: 'SCL-1', status: 'APPROVED_FOR_INVOICE', total_claim_amount: '60000000', approved_claim_amount: '60000000' },
          ];
        }
        if (sql.includes('FROM invoices WHERE service_claim_id')) {
          return [{ id: 501, invoice_number: 'INV-1', status: 'PAID' }];
        }
        if (sql.includes('FROM audit_logs')) {
          return []; // No reconciliation recorded!
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.procurement.service.servicePOCount).toBe(1);
      expect(res.procurement.service.totalServiceCommitted).toBe(100000000);
      expect(res.procurement.service.approvedClaimedValue).toBe(60000000);
      expect(res.procurement.service.remainingServiceScope).toBe(40000000);
      // SERVICE PO does NOT produce MATERIAL_GR_OUTSTANDING
      expect(res.blockers.some((b) => b.code === 'MATERIAL_GR_OUTSTANDING')).toBe(false);
      // Produces SERVICE_SCOPE_RECONCILIATION_REQUIRED
      const blocker = res.blockers.find((b) => b.code === 'SERVICE_SCOPE_RECONCILIATION_REQUIRED');
      expect(blocker).toBeDefined();
      expect(blocker?.amount).toBe(40000000);
    });

    it('G2. SERVICE PO with total claimed = PO total (remaining scope = 0) is clear automatically', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM purchase_orders') && sql.includes("'SERVICE'")) {
          return [
            { id: 301, po_number: 'PO-SRV-1', status: 'ISSUED', total_amount: '100000000' },
          ];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            { id: 401, claim_number: 'SCL-1', status: 'APPROVED_FOR_INVOICE', total_claim_amount: '100000000', approved_claim_amount: '100000000' },
          ];
        }
        if (sql.includes('FROM invoices WHERE service_claim_id')) {
          return [{ id: 501, invoice_number: 'INV-1', status: 'PAID' }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.procurement.service.remainingServiceScope).toBe(0);
      expect(res.blockers.some((b) => b.code === 'SERVICE_SCOPE_RECONCILIATION_REQUIRED')).toBe(false);
      expect(res.blockers.some((b) => b.code === 'SERVICE_SCOPE_RECONCILIATION_NOT_MODELED')).toBe(false);
    });

    it('G3. SERVICE PO with remaining scope > 0 and valid authoritative reconciliation covers scope', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM purchase_orders') && sql.includes("'SERVICE'")) {
          return [
            {
              id: 301,
              po_number: 'PO-SRV-1',
              status: 'ISSUED',
              total_amount: '100000000',
              service_scope_reconciled_at: '2026-10-11T00:00:00Z',
              service_scope_reconciled_by: 42,
              service_scope_released_amount: '40000000',
              service_scope_reconciliation_reason: 'Pekerjaan telah rampung, sisa kontrak dibatalkan dan direkonsiliasi',
            },
          ];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            { id: 401, claim_number: 'SCL-1', status: 'APPROVED_FOR_INVOICE', total_claim_amount: '60000000', approved_claim_amount: '60000000', po_id: 301 },
          ];
        }
        if (sql.includes('FROM invoices WHERE service_claim_id')) {
          return [{ id: 501, invoice_number: 'INV-1', status: 'PAID' }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.procurement.service.remainingServiceScope).toBe(40000000);
      // Valid reconciliation covers the 40M remaining scope
      expect(res.blockers.some((b) => b.code === 'SERVICE_SCOPE_RECONCILIATION_REQUIRED')).toBe(false);
    });

    it('G4. Cross-project reconciliation does NOT clear current project PO scope', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM purchase_orders') && sql.includes("'SERVICE'")) {
          // Project 10's PO is NOT reconciled!
          return [
            {
              id: 301,
              po_number: 'PO-SRV-1',
              status: 'ISSUED',
              total_amount: '100000000',
              service_scope_reconciled_at: null,
              service_scope_reconciled_by: null,
              service_scope_released_amount: null,
              service_scope_reconciliation_reason: null,
            },
          ];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            { id: 401, claim_number: 'SCL-1', status: 'APPROVED_FOR_INVOICE', total_claim_amount: '60000000', approved_claim_amount: '60000000', po_id: 301 },
          ];
        }
        if (sql.includes('FROM invoices WHERE service_claim_id')) {
          return [{ id: 501, invoice_number: 'INV-1', status: 'PAID' }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      // Must NOT be cleared because current project's PO is unreconciled
      expect(res.blockers.some((b) => b.code === 'SERVICE_SCOPE_RECONCILIATION_REQUIRED')).toBe(true);
    });

    it('G5. DRAFT Service Order blocks with SERVICE_ORDER_DRAFT_PENDING', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM service_orders')) {
          return [
            { id: 801, service_order_number: 'SPK-DRAFT-1', status: 'DRAFT' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      const blocker = res.blockers.find((b) => b.code === 'SERVICE_ORDER_DRAFT_PENDING');
      expect(blocker).toBeDefined();
      expect(blocker?.entityIds).toContain(801);
    });

    it('H. Pending Service Claim blocks with SERVICE_CLAIM_PENDING', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            { id: 401, claim_number: 'SCL-1', status: 'PM_VERIFIED', total_claim_amount: '50000000', approved_claim_amount: '50000000' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.serviceClaims.pendingClaimCount).toBe(1);
      const blocker = res.blockers.find((b) => b.code === 'SERVICE_CLAIM_PENDING');
      expect(blocker).toBeDefined();
      expect(blocker?.entityIds).toContain(401);
    });

    it('I. Approved-for-invoice but uninvoiced Service Claim blocks with SERVICE_CLAIM_UNINVOICED', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            { id: 401, claim_number: 'SCL-1', status: 'APPROVED_FOR_INVOICE', total_claim_amount: '50000000', approved_claim_amount: '50000000' },
          ];
        }
        if (sql.includes('FROM invoices WHERE service_claim_id')) {
          return []; // No invoice!
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.serviceClaims.approvedUninvoicedCount).toBe(1);
      expect(res.serviceClaims.approvedUninvoicedValue).toBe(50000000);
      const blocker = res.blockers.find((b) => b.code === 'SERVICE_CLAIM_UNINVOICED');
      expect(blocker).toBeDefined();
    });

    it('J & K. Unverified and Unpaid Vendor Invoice blocks with VENDOR_INVOICE_UNVERIFIED and VENDOR_INVOICE_UNPAID', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM invoices i')) {
          return [
            { id: 501, invoice_number: 'INV-1', total_amount: '20000000', match_status: 'PENDING', payment_status: 'UNPAID', status: 'UNPAID' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.finance.vendorAP.unverifiedVendorInvoiceCount).toBe(1);
      expect(res.finance.vendorAP.unpaidVendorInvoiceCount).toBe(1);
      expect(res.finance.vendorAP.outstandingVendorPayable).toBe(20000000);
      expect(res.blockers.some((b) => b.code === 'VENDOR_INVOICE_UNVERIFIED')).toBe(true);
      expect(res.blockers.some((b) => b.code === 'VENDOR_INVOICE_UNPAID')).toBe(true);
    });

    it('L. Pending Payment Request blocks with PAYMENT_REQUEST_PENDING', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM payment_requests prq')) {
          return [
            { id: 601, request_number: 'PRQ-1', status: 'PENDING_DIRECTOR_APPROVAL', requested_amount: '20000000' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.finance.vendorAP.pendingPaymentRequestCount).toBe(1);
      const blocker = res.blockers.find((b) => b.code === 'PAYMENT_REQUEST_PENDING');
      expect(blocker).toBeDefined();
    });

    it('M & N. Missing CUSTOMER_BAST and FINAL_REPORT block acceptance document clearance', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM documents')) {
          return []; // zero documents
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.documents.customerBastPresent).toBe(false);
      expect(res.documents.finalReportPresent).toBe(false);
      expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
      expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(true);
    });

    it('O. Customer AR returns modeled=false, blocking=false, and not fake-settled', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.finance.customerAR.modeled).toBe(false);
      expect(res.finance.customerAR.blocking).toBe(false);
    });

    it('P. Readiness evaluation executes zero write queries', async () => {
      mockDataSource.query.mockImplementation(async (sql: string) => {
        // Assert that every executed query starts with SELECT and does not execute mutations
        const trimmed = sql.trim().toUpperCase();
        expect(trimmed.startsWith('SELECT')).toBe(true);
        expect(trimmed.startsWith('INSERT ')).toBe(false);
        expect(trimmed.startsWith('UPDATE ')).toBe(false);
        expect(trimmed.startsWith('DELETE ')).toBe(false);
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        return [];
      });

      await service.evaluateClosureReadiness(10);
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('Q. Cross-project records do not leak into evaluation', async () => {
      mockDataSource.query.mockImplementation(async (sql: string, params: any[]) => {
        // Ensure every query includes projectId parameter
        if (params && params.length > 0) {
          expect(params).toContain(10);
        }
        if (sql.includes('FROM projects')) {
          return [{ id: 10, code: 'PRJ-01', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(10);
      expect(res.project.id).toBe(10);
    });

    it('T. Fully cleared project produces ready=true on green-path (mocked/isolated)', async () => {
      mockProjectService.calculateProjectOverallProgress.mockResolvedValue(100.0);
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects')) {
          return [{ id: 99, code: 'PRJ-GREEN', name: 'Green Project', status: 'IN_PROGRESS', manager_id: 2 }];
        }
        if (sql.includes('FROM project_baselines')) {
          return [
            {
              task_id: 1,
              task_name: 'Final Leaf Task',
              wbs_id: 10,
              task_status: 'COMPLETED',
              task_progress: '100',
              actual_finish_at: '2026-10-10',
            },
          ];
        }
        if (sql.includes('FROM project_progress_logs')) {
          return [{ count: 0 }];
        }
        if (sql.includes('FROM project_issues')) {
          return [{ id: 1, issue_number: 'ISS-1', title: 'Resolved Issue', status: 'CLOSED' }];
        }
        if (sql.includes('FROM project_risks')) {
          return [
            { id: 1, risk_number: 'RSK-1', title: 'Closed Risk', status: ProjectRiskStatus.CLOSED, linked_issue_id: null, linked_issue_status: null },
            { id: 2, risk_number: 'RSK-2', title: 'Cancelled Risk', status: ProjectRiskStatus.CANCELLED, linked_issue_id: null, linked_issue_status: null },
            { id: 3, risk_number: 'RSK-3', title: 'Materialized Risk Resolved in Issue', status: ProjectRiskStatus.MATERIALIZED, linked_issue_id: 1, linked_issue_status: ProjectIssueStatus.CLOSED },
          ];
        }
        if (sql.includes('FROM purchase_requests')) {
          return [{ id: 1, pr_number: 'PR-1', status: 'PO_ISSUED' }];
        }
        if (sql.includes("po.order_type = 'MATERIAL'")) {
          return [{ id: 10, po_number: 'PO-MAT-1', status: 'COMPLETED', total_amount: '50000000', total_received: '50000000' }];
        }
        if (sql.includes("po.order_type = 'SERVICE'")) {
          return [
            {
              id: 20,
              po_number: 'PO-SVC-1',
              status: 'ISSUED',
              total_amount: '100000000',
              service_scope_reconciled_at: '2026-10-10T12:00:00Z',
              service_scope_reconciled_by: 42,
              service_scope_released_amount: '40000000',
              service_scope_reconciliation_reason: 'Ruang lingkup sisa dilepaskan secara sah',
            },
          ];
        }
        if (sql.includes('FROM service_orders')) {
          return [{ id: 30, service_order_number: 'SO-1', status: 'ISSUED' }];
        }
        if (sql.includes('FROM service_claims')) {
          return [
            {
              id: 40,
              claim_number: 'SCL-1',
              status: 'APPROVED_FOR_INVOICE',
              total_claim_amount: '60000000',
              approved_claim_amount: '60000000',
              po_id: 20,
            },
          ];
        }
        if (sql.includes('service_claim_id = ?')) {
          return [{ id: 50, invoice_number: 'INV-SVC-1', status: 'PAID' }];
        }
        if (sql.includes('FROM invoices')) {
          return [
            {
              id: 50,
              invoice_number: 'INV-SVC-1',
              status: 'PAID',
              match_status: 'VERIFIED',
              payment_status: 'PAID',
              total_amount: '60000000',
            },
          ];
        }
        if (sql.includes('FROM payment_requests')) {
          return [{ id: 60, request_number: 'PRQ-1', status: 'PAID', requested_amount: '60000000' }];
        }
        if (sql.includes('FROM documents')) {
          return [
            { id: 71, file_name: 'BAST Konsumen', category: 'CUSTOMER_BAST', created_at: '2026-10-10' },
            { id: 72, file_name: 'Laporan Akhir Proyek', category: 'FINAL_REPORT', created_at: '2026-10-10' },
          ];
        }
        return [];
      });

      const res = await service.evaluateClosureReadiness(99);

      expect(res.project.id).toBe(99);
      expect(res.project.status).toBe('IN_PROGRESS');
      expect(res.project.eligible).toBe(true);

      // All domains clear
      expect(res.physical.overallProgress).toBe(100);
      expect(res.physical.isComplete).toBe(true);
      expect(res.tasks.incompleteLeafTasks).toBe(0);
      expect(res.tasks.missingActualFinishCount).toBe(0);
      expect(res.physicalActualFinishCandidate).toContain('2026-10-10');
      expect(res.issues.blockingIssueCount).toBe(0);
      expect(res.risks.activeRiskCount).toBe(0);
      expect(res.risks.unresolvedMaterializedRiskCount).toBe(0);
      expect(res.risks.clearedRiskCount).toBe(3);
      expect(res.procurement.material.unfulfilledMaterialPOCount).toBe(0);
      expect(res.procurement.material.pendingGRCount).toBe(0);
      expect(res.procurement.service.remainingServiceScope).toBe(40000000);
      expect(res.serviceClaims.pendingClaimCount).toBe(0);
      expect(res.serviceClaims.approvedUninvoicedCount).toBe(0);
      expect(res.finance.vendorAP.unverifiedVendorInvoiceCount).toBe(0);
      expect(res.finance.vendorAP.unpaidVendorInvoiceCount).toBe(0);
      expect(res.finance.vendorAP.pendingPaymentRequestCount).toBe(0);
      expect(res.documents.customerBastPresent).toBe(true);
      expect(res.documents.finalReportPresent).toBe(true);

      // Blockers list must be completely empty!
      expect(res.blockers).toEqual([]);

      // Authoritative outcome
      expect(res.ready).toBe(true);
    });
  });

  describe('Integration & Live Reference Validation (Project 2015)', () => {
    let liveDataSource: DataSource;
    let liveProjectService: ProjectService;
    let liveClosureService: ProjectClosureService;

    beforeAll(async () => {
      liveDataSource = new DataSource({
        type: 'mysql',
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port: parseInt(process.env.DATABASE_PORT || '3306', 10),
        username: process.env.DATABASE_USER || 'epms_app_user',
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
        entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
        synchronize: false,
        logging: false,
      });

      await liveDataSource.initialize();

      // Create ProjectService instance referencing repository manager
      const mockProjectRepo: any = {
        manager: liveDataSource.manager,
        findOne: jest.fn().mockImplementation((opt) => liveDataSource.getRepository('Project').findOne(opt)),
      };
      liveProjectService = new ProjectService(
        null as any,
        null as any,
        mockProjectRepo,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
      );

      liveClosureService = new ProjectClosureService(liveDataSource, liveProjectService);
    });

    afterAll(async () => {
      if (liveDataSource && liveDataSource.isInitialized) {
        await liveDataSource.destroy();
      }
    });

    it('R. Project returns ready=false with live authoritative blockers and remains unmutated', async () => {
      const p2015 = await liveDataSource.query('SELECT id FROM projects WHERE id = 2015');
      if (p2015.length === 0) {
        // Fallback to active project 1 if 2015 does not exist in current environment
        const res = await liveClosureService.evaluateClosureReadiness(1);
        expect(res.project.id).toBe(1);
        expect(res.project.status).toBe('IN_PROGRESS');
        expect(res.project.eligible).toBe(true);
        expect(res.ready).toBe(false);
        expect(res.blockers.length).toBeGreaterThan(0);
        expect(res.blockers.some((b) => b.code === 'SERVICE_PR_OPEN' || b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
        expect(res.blockers.some((b) => b.code === 'SERVICE_RFQ_OPEN' || b.code === 'FINAL_REPORT_MISSING')).toBe(true);
        const rows = await liveDataSource.query('SELECT status, actual_finish_at, closed_at FROM projects WHERE id = 1');
        expect(rows[0].status).toBe('IN_PROGRESS');
        expect(rows[0].actual_finish_at).toBeNull();
        expect(rows[0].closed_at).toBeNull();
        const closureRows = await liveDataSource.query('SELECT COUNT(*) as cnt FROM project_closures WHERE project_id = 1');
        expect(Number(closureRows[0].cnt)).toBe(0);
        return;
      }

      const res = await liveClosureService.evaluateClosureReadiness(2015);

      expect(res.project.id).toBe(2015);
      expect(res.project.status).toBe('IN_PROGRESS');
      expect(res.project.eligible).toBe(true);
      expect(res.ready).toBe(false);

      // 1. Physical execution blocker
      expect(res.physical.overallProgress).toBe(25.0);
      expect(res.physical.isComplete).toBe(false);
      expect(res.blockers.some((b) => b.code === 'PHYSICAL_PROGRESS_INCOMPLETE')).toBe(true);

      // 2. Task completion blocker
      expect(res.tasks.incompleteLeafTasks).toBeGreaterThan(0);
      expect(res.blockers.some((b) => b.code === 'TASK_INCOMPLETE')).toBe(true);
      expect(res.blockers.some((b) => b.code === 'TASK_ACTUAL_FINISH_MISSING')).toBe(true);
      expect(res.physicalActualFinishCandidate).toBeNull();

      // 3. Issue blocker (Issue 9 is OPEN)
      expect(res.issues.blockingIssueCount).toBeGreaterThan(0);
      expect(res.blockers.some((b) => b.code === 'OPEN_PROJECT_ISSUES')).toBe(true);

      // 4. Risk blocker (Risk 5 is MATERIALIZED with open issue)
      expect(res.risks.unresolvedMaterializedRiskCount).toBeGreaterThan(0);
      expect(res.blockers.some((b) => b.code === 'ACTIVE_PROJECT_RISKS')).toBe(true);

      // 5. Service scope reconciliation required (PO 20 has Rp 84M un-reconciled scope)
      expect(res.procurement.service.servicePOCount).toBeGreaterThan(0);
      expect(res.procurement.service.serviceScopeClearanceSupported).toBe(true);
      expect(res.blockers.some((b) => b.code === 'SERVICE_SCOPE_RECONCILIATION_REQUIRED')).toBe(true);

      // 6. Service claim uninvoiced blocker
      expect(res.serviceClaims.approvedUninvoicedCount).toBeGreaterThan(0);
      expect(res.blockers.some((b) => b.code === 'SERVICE_CLAIM_UNINVOICED')).toBe(true);

      // 7. Documents missing
      expect(res.documents.customerBastPresent).toBe(false);
      expect(res.documents.finalReportPresent).toBe(false);
      expect(res.blockers.some((b) => b.code === 'CUSTOMER_ACCEPTANCE_MISSING')).toBe(true);
      expect(res.blockers.some((b) => b.code === 'FINAL_REPORT_MISSING')).toBe(true);

      // 8. Customer AR
      expect(res.finance.customerAR.modeled).toBe(false);
      expect(res.finance.customerAR.blocking).toBe(false);

      // Verify Project 2015 is UNMUTATED in database
      const rows = await liveDataSource.query(
        'SELECT status, actual_finish_at, closed_at, closed_by FROM projects WHERE id = 2015',
      );
      expect(rows[0].status).toBe('IN_PROGRESS');
      expect(rows[0].actual_finish_at).toBeNull();
      expect(rows[0].closed_at).toBeNull();
      expect(rows[0].closed_by).toBeNull();

      // Verify ZERO records created in project_closures
      const closureRows = await liveDataSource.query(
        'SELECT COUNT(*) as cnt FROM project_closures WHERE project_id = 2015',
      );
      expect(Number(closureRows[0].cnt)).toBe(0);
    });

    it('S. Repeated calls to evaluateClosureReadiness produce 0 INSERT, 0 UPDATE, 0 DELETE across all project tables (pure read-only)', async () => {
      const p2015 = await liveDataSource.query('SELECT id FROM projects WHERE id = 2015');
      const testId = p2015.length > 0 ? 2015 : 1;
      const getCounts = async () => {
        const [prj] = await liveDataSource.query('SELECT status, actual_finish_at, closed_at FROM projects WHERE id = ?', [testId]);
        const [tasks] = await liveDataSource.query('SELECT COUNT(*) as c FROM tasks WHERE project_id = ?', [testId]);
        const [closures] = await liveDataSource.query('SELECT COUNT(*) as c FROM project_closures WHERE project_id = ?', [testId]);
        const [sos] = await liveDataSource.query('SELECT COUNT(*) as c FROM service_orders WHERE project_id = ?', [testId]);
        const [claims] = await liveDataSource.query('SELECT COUNT(*) as c FROM service_claims WHERE project_id = ?', [testId]);
        const [docs] = await liveDataSource.query('SELECT COUNT(*) as c FROM documents WHERE entity_type = "PROJECT" AND entity_id = ?', [testId]);
        const [issues] = await liveDataSource.query('SELECT COUNT(*) as c FROM project_issues WHERE project_id = ?', [testId]);
        const [risks] = await liveDataSource.query('SELECT COUNT(*) as c FROM project_risks WHERE project_id = ?', [testId]);
        const [notifs] = await liveDataSource.query('SELECT COUNT(*) as c FROM notifications');
        const [outbox] = await liveDataSource.query('SELECT COUNT(*) as c FROM outbox_events');
        return { prj, tasks: Number(tasks.c), closures: Number(closures.c), sos: Number(sos.c), claims: Number(claims.c), docs: Number(docs.c), issues: Number(issues.c), risks: Number(risks.c), notifs: Number(notifs.c), outbox: Number(outbox.c) };
      };

      const baseline = await getCounts();

      // Call readiness 3 times consecutively
      await liveClosureService.evaluateClosureReadiness(testId);
      await liveClosureService.evaluateClosureReadiness(testId);
      await liveClosureService.evaluateClosureReadiness(testId);

      const after = await getCounts();

      // Assert zero mutation across all domains
      expect(after).toEqual(baseline);
    });
  });

  describe('ProjectController Delegation & RBAC Scoping', () => {
    let controller: ProjectController;
    let mockClosureService: any;
    let mockProjectService: any;

    beforeEach(() => {
      mockClosureService = {
        evaluateClosureReadiness: jest.fn().mockResolvedValue({
          project: { id: 10, code: 'PRJ-10', status: 'IN_PROGRESS', eligible: true },
          ready: false,
        }),
      };
      mockProjectService = {};
      controller = new ProjectController(mockProjectService as any, mockClosureService as any);
    });

    it('delegates getClosureReadiness with parsed numeric projectId and actor identity', async () => {
      const mockReq = {
        user: {
          userId: 2,
          roles: ['PROJECT_MANAGER'],
        },
      };

      const result = await controller.getClosureReadiness('10', mockReq);
      expect(mockClosureService.evaluateClosureReadiness).toHaveBeenCalledWith(10, 2, ['PROJECT_MANAGER']);
      expect(result.project.id).toBe(10);
    });

    it('extracts role correctly when roles is single string or role field', async () => {
      const mockReq = {
        user: {
          id: 5,
          role: 'HEAD_OF_OPERATIONS',
        },
      };

      await controller.getClosureReadiness('2015', mockReq);
      expect(mockClosureService.evaluateClosureReadiness).toHaveBeenCalledWith(2015, 5, ['HEAD_OF_OPERATIONS']);
    });

    describe('ProjectClosureService Authorization & Scoping Enforcement', () => {
      let rbacService: ProjectClosureService;
      let rbacDs: any;
      let rbacProjectService: any;

      beforeEach(() => {
        rbacDs = {
          query: jest.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FROM projects')) {
              return [{ id: 10, code: 'PRJ-10', name: 'Project 10', status: 'IN_PROGRESS', manager_id: 2, contract_id: null }];
            }
            if (sql.includes('FROM tasks')) return [];
            if (sql.includes('FROM project_issues')) return [];
            if (sql.includes('FROM project_risks')) return [];
            if (sql.includes('FROM purchase_requests')) return [];
            if (sql.includes('FROM purchase_orders')) return [];
            if (sql.includes('FROM service_orders')) return [];
            if (sql.includes('FROM service_claims')) return [];
            if (sql.includes('FROM invoices')) return [];
            if (sql.includes('FROM payment_requests')) return [];
            if (sql.includes('FROM po_payment_terms')) return [];
            if (sql.includes('FROM documents')) return [];
            return [];
          }),
        };
        rbacProjectService = {
          calculateProjectOverallProgress: jest.fn().mockResolvedValue(100.0),
        };
        rbacService = new ProjectClosureService(rbacDs, rbacProjectService);
      });

      it('proves assigned PROJECT_MANAGER can read closure readiness', async () => {
        const res = await rbacService.evaluateClosureReadiness(10, 2, ['PROJECT_MANAGER']);
        expect(res.project.id).toBe(10);
      });

      it('proves unrelated PROJECT_MANAGER cannot read another PM project (403 Forbidden)', async () => {
        await expect(
          rbacService.evaluateClosureReadiness(10, 99, ['PROJECT_MANAGER']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('proves HEAD_OF_OPERATIONS can read closure readiness across projects', async () => {
        const res = await rbacService.evaluateClosureReadiness(10, 99, ['HEAD_OF_OPERATIONS']);
        expect(res.project.id).toBe(10);
      });

      it('proves DIRECTOR can read closure readiness across projects', async () => {
        const res = await rbacService.evaluateClosureReadiness(10, 99, ['DIRECTOR']);
        expect(res.project.id).toBe(10);
      });
    });
  });
});


