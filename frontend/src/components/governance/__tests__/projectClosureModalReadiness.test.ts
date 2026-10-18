/**
 * EPMS — PROJECT-CLOSE-R1-V1-POSTMORTEM-R1
 * Approval Center Readiness Consistency Unit Tests
 *
 * Verifies that ProjectClosureReviewModalContent and resolveClosureModalReadiness:
 * 1. Correctly map authoritative runtime-shaped ClosureReadinessResult:
 *    - READY -> READY (isReady: true, 'SIAP DITUTUP')
 *    - 100% -> 100% (overallProgress: 100, isPhysicalComplete: true)
 *    - CUSTOMER_BAST present -> present (bastPresent: true)
 *    - FINAL_REPORT present -> present (finalReportPresent: true)
 * 2. Safely fall back to closureData.readinessSnapshot or task.readinessSnapshot
 * 3. Handle null / undefined / empty payloads without crashing or throwing
 * 4. Guarantee strict contract parity between HOO review modal and Director approval modal
 */

import {
  resolveClosureModalReadiness,
  ResolveClosureModalOptions,
  CLOSURE_STAGE_MAPPING,
} from '../projectGovernanceClosure.utils';

describe('EPMS — PROJECT-CLOSE-R1-V1-POSTMORTEM-R1 Approval Center Readiness Consistency Suite', () => {
  // Authoritative runtime-shaped payload returned by backend getClosureReadiness(1364)
  const canonicalRuntimeReadiness = {
    ready: true,
    project: {
      id: 1364,
      code: 'CONT-20260928-0042',
      name: 'CANONICAL-E2E-1790563053595',
      status: 'IN_PROGRESS',
      eligible: true,
      contract: {
        contractId: 42,
        contractNumber: 'CONT-20260928-0042',
        status: 'ACTIVE',
        customer: {
          id: 8,
          name: 'PT Asianet Media Teknologi',
        },
      },
    },
    summary: {
      blockerCount: 0,
      warningCount: 0,
    },
    physical: {
      overallProgress: 100,
      requiredProgress: 100,
      isComplete: true,
    },
    tasks: {
      totalLeafTasks: 1,
      completedLeafTasks: 1,
      incompleteLeafTasks: 0,
      missingActualFinishCount: 0,
      pendingVerificationCount: 0,
    },
    issues: {
      totalIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      resolvedIssues: 0,
      closedIssues: 0,
      cancelledIssues: 0,
      blockingIssueCount: 0,
    },
    risks: {
      totalRisks: 0,
      activeRiskCount: 0,
      materializedRiskCount: 0,
      unresolvedMaterializedRiskCount: 0,
      clearedRiskCount: 0,
    },
    procurement: {
      material: {
        openPRCount: 0,
        openRFQCount: 0,
        unfulfilledMaterialPOCount: 0,
        pendingGRCount: 0,
      },
      service: {
        servicePOCount: 0,
        openServiceOrderCount: 0,
        totalServiceCommitted: 0,
        approvedClaimedValue: 0,
        remainingServiceScope: 0,
        serviceScopeClearanceSupported: true,
      },
    },
    serviceClaims: {
      totalClaims: 0,
      pendingClaimCount: 0,
      approvedUninvoicedCount: 0,
      approvedUninvoicedValue: 0,
    },
    finance: {
      vendorAP: {
        totalVendorInvoices: 0,
        unpaidVendorInvoiceCount: 0,
        pendingPaymentRequestCount: 0,
        unverifiedVendorInvoiceCount: 0,
        outstandingVendorPayable: 0,
      },
      customerAR: {
        modeled: false,
        blocking: false,
      },
    },
    documents: {
      customerBastPresent: true,
      customerBastDocumentId: 2144,
      finalReportPresent: true,
      finalReportDocumentId: 2145,
      internalHandoverPresent: false,
      internalHandoverDocumentId: null,
      activeDocumentsCount: 8,
      authoritativeLimitationNotes: 'Dokumen SSOT aktif.',
    },
    physicalActualFinishCandidate: '2026-10-06T00:22:15.000Z',
    blockers: [],
    warnings: [],
  };

  const canonicalClosureData = {
    id: 217,
    projectId: 1364,
    cycleNumber: 1,
    status: 'PENDING_HOO_REVIEW',
    submittedById: 2,
    submittedBy: {
      id: 2,
      fullName: 'Project Manager',
      email: 'pm@epms.com',
    },
    submittedAt: '2026-10-11T16:45:51.000Z',
    submissionNotes: 'Pengajuan penutupan proyek 1364 telah lengkap 100%.',
    acceptanceDocumentId: 2144,
    finalReportDocumentId: 2145,
    acceptanceDocument: {
      id: 2144,
      fileName: 'BAST-Pelanggan-Project-1364-UAT.pdf',
    },
    finalReportDocument: {
      id: 2145,
      fileName: 'Laporan-Akhir-Project-1364-UAT.pdf',
    },
    readinessSnapshot: canonicalRuntimeReadiness,
  };

  const hooTask = {
    id: 101,
    nodeId: 'node_hoo_review',
    projectId: 1364,
    isClosure: true,
    workflowKey: 'PROJECT_CLOSURE',
    status: 'PENDING',
    customerName: 'PT Asianet Media Teknologi',
  };

  const directorTask = {
    id: 102,
    nodeId: 'node_director_approval',
    projectId: 1364,
    isClosure: true,
    workflowKey: 'PROJECT_CLOSURE',
    status: 'PENDING',
    customerName: 'PT Asianet Media Teknologi',
  };

  // ── 1. Authoritative Runtime Payload Mapping ──────────────────────────────
  describe('1. Authoritative Runtime Payload Resolution', () => {
    it('resolves READY state correctly from live ClosureReadinessResult', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(result.isReady).toBe(true);
      expect(result.verdictLabel).toBe('SIAP DITUTUP');
    });

    it('resolves 100% physical execution progress and completion correctly', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(result.overallProgress).toBe(100);
      expect(result.isPhysicalComplete).toBe(true);
    });

    it('resolves CUSTOMER_BAST presence and document reference correctly', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(result.bastPresent).toBe(true);
      expect(result.effectiveBastDoc).toBeDefined();
      expect(result.bastDocName).toBe('BAST-Pelanggan-Project-1364-UAT.pdf');
    });

    it('resolves FINAL_REPORT presence and document reference correctly', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(result.finalReportPresent).toBe(true);
      expect(result.effectiveFinalReportDoc).toBeDefined();
      expect(result.finalReportDocName).toBe('Laporan-Akhir-Project-1364-UAT.pdf');
    });

    it('resolves all governance domain readiness states correctly', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(result.isProcurementClear).toBe(true);
      expect(result.openMaterialPRCount).toBe(0);
      expect(result.unfulfilledMaterialPOCount).toBe(0);
      expect(result.isClaimsClear).toBe(true);
      expect(result.pendingServiceClaimCount).toBe(0);
      expect(result.isInvoicesClear).toBe(true);
      expect(result.unpaidVendorInvoiceCount).toBe(0);
      expect(result.isPaymentsClear).toBe(true);
      expect(result.pendingPaymentRequestCount).toBe(0);
      expect(result.isIssuesRisksClear).toBe(true);
      expect(result.openIssuesCount).toBe(0);
      expect(result.activeRisksCount).toBe(0);
      expect(result.blockers).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  // ── 2. Fallback to readinessSnapshot ──────────────────────────────────────
  describe('2. Fallback to Snapshot Persistence', () => {
    it('correctly resolves readiness from closureData.readinessSnapshot when live readiness is omitted', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: null,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(result.isReady).toBe(true);
      expect(result.verdictLabel).toBe('SIAP DITUTUP');
      expect(result.overallProgress).toBe(100);
      expect(result.isPhysicalComplete).toBe(true);
      expect(result.bastPresent).toBe(true);
      expect(result.finalReportPresent).toBe(true);
    });

    it('correctly resolves readiness from task.readinessSnapshot when both live and closureData are omitted', () => {
      const taskWithSnapshot = {
        ...hooTask,
        readinessSnapshot: canonicalRuntimeReadiness,
        closureData: {
          acceptanceDocumentId: 2144,
          finalReportDocumentId: 2145,
        },
      };

      const result = resolveClosureModalReadiness({
        closureReadiness: null,
        closureData: null,
        task: taskWithSnapshot,
      });

      expect(result.isReady).toBe(true);
      expect(result.overallProgress).toBe(100);
      expect(result.bastPresent).toBe(true);
      expect(result.finalReportPresent).toBe(true);
    });
  });

  // ── 3. Unready & Degraded Payload Handling ────────────────────────────────
  describe('3. Unready & Degraded Readiness Resolution', () => {
    it('correctly resolves NOT READY when overallProgress < 100% and documents are missing', () => {
      const unreadyReadiness = {
        ready: false,
        physical: {
          overallProgress: 60,
          requiredProgress: 100,
          isComplete: false,
        },
        documents: {
          customerBastPresent: false,
          finalReportPresent: false,
        },
        procurement: {
          material: { openPRCount: 2, unfulfilledMaterialPOCount: 1 },
        },
        serviceClaims: { pendingClaimCount: 1 },
        finance: { vendorAP: { unpaidVendorInvoiceCount: 3, pendingPaymentRequestCount: 1 } },
        blockers: [
          { domain: 'PHYSICAL_EXECUTION', code: 'PHYSICAL_PROGRESS_INCOMPLETE', message: 'Progress 60%' },
          { domain: 'DELIVERABLES_CUSTOMER_BAST', code: 'CUSTOMER_BAST_MISSING', message: 'BAST missing' },
        ],
      };

      const result = resolveClosureModalReadiness({
        closureReadiness: unreadyReadiness,
        closureData: null,
        task: hooTask,
      });

      expect(result.isReady).toBe(false);
      expect(result.verdictLabel).toBe('BELUM SIAP UNTUK DITUTUP');
      expect(result.overallProgress).toBe(60);
      expect(result.isPhysicalComplete).toBe(false);
      expect(result.bastPresent).toBe(false);
      expect(result.finalReportPresent).toBe(false);
      expect(result.isProcurementClear).toBe(false);
      expect(result.isClaimsClear).toBe(false);
      expect(result.isInvoicesClear).toBe(false);
      expect(result.isPaymentsClear).toBe(false);
      expect(result.blockers.length).toBe(2);
    });
  });

  // ── 4. Null / Missing / Undefined Payload Safety ──────────────────────────
  describe('4. Null / Missing Payload Resilience', () => {
    it('safely handles empty options without throwing', () => {
      expect(() => resolveClosureModalReadiness({})).not.toThrow();
      const result = resolveClosureModalReadiness({});

      expect(result.isReady).toBe(false);
      expect(result.verdictLabel).toBe('BELUM SIAP UNTUK DITUTUP');
      expect(result.overallProgress).toBe(0);
      expect(result.isPhysicalComplete).toBe(false);
      expect(result.bastPresent).toBe(false);
      expect(result.finalReportPresent).toBe(false);
      expect(result.bastDocName).toBe('Dokumen belum diunggah');
      expect(result.finalReportDocName).toBe('Dokumen belum diunggah');
      expect(result.blockers).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('safely handles null values for all fields without crashing', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: null,
        closureData: null,
        task: null,
      });

      expect(result.isReady).toBe(false);
      expect(result.overallProgress).toBe(0);
      expect(result.customerName).toBe('N/A');
      expect(result.cycleNumber).toBe(1);
      expect(result.pmSubmitter).toBe('Project Manager');
    });
  });

  // ── 5. Contract Parity: HOO vs Director Modal Contract ────────────────────
  describe('5. Contract Parity Across HOO and Director Modals', () => {
    it('guarantees identical readiness contract resolution between HOO modal and Director modal', () => {
      const hooModalReadiness = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      const directorModalReadiness = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: directorTask,
      });

      // Both modals must see strictly identical readiness values
      expect(hooModalReadiness.isReady).toBe(directorModalReadiness.isReady);
      expect(hooModalReadiness.verdictLabel).toBe(directorModalReadiness.verdictLabel);
      expect(hooModalReadiness.overallProgress).toBe(directorModalReadiness.overallProgress);
      expect(hooModalReadiness.isPhysicalComplete).toBe(directorModalReadiness.isPhysicalComplete);
      expect(hooModalReadiness.bastPresent).toBe(directorModalReadiness.bastPresent);
      expect(hooModalReadiness.finalReportPresent).toBe(directorModalReadiness.finalReportPresent);
      expect(hooModalReadiness.isProcurementClear).toBe(directorModalReadiness.isProcurementClear);
      expect(hooModalReadiness.isInvoicesClear).toBe(directorModalReadiness.isInvoicesClear);
      expect(hooModalReadiness.isPaymentsClear).toBe(directorModalReadiness.isPaymentsClear);
      expect(hooModalReadiness.isIssuesRisksClear).toBe(directorModalReadiness.isIssuesRisksClear);
      expect(hooModalReadiness.blockers).toEqual(directorModalReadiness.blockers);
      expect(hooModalReadiness.warnings).toEqual(directorModalReadiness.warnings);
    });

    it('verifies stage mappings exist and are distinct for HOO and Director', () => {
      const hooStage = CLOSURE_STAGE_MAPPING.node_hoo_review;
      const directorStage = CLOSURE_STAGE_MAPPING.node_director_approval;

      expect(hooStage.requiredRole).toBe('HEAD_OF_OPERATIONS');
      expect(directorStage.requiredRole).toBe('DIRECTOR');
      expect(hooStage.nextNodeLabel).toBe('Persetujuan Final Direktur');
      expect(directorStage.nextNodeLabel).toBe('Proyek Resmi Ditutup (CLOSED)');
    });
  });

  // ── 6. UI Contract Rules (E13, E16, E17, I3) ──────────────────────────────
  describe('6. UI Contract Rules (E13, E16, E17, I3)', () => {
    it('E13. proves Customer AR is non-blocking and modeled=false in modal readiness payload', () => {
      const result = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: canonicalClosureData,
        task: hooTask,
      });

      expect(canonicalRuntimeReadiness.finance.customerAR.modeled).toBe(false);
      expect(canonicalRuntimeReadiness.finance.customerAR.blocking).toBe(false);
      expect(result.blockers.some((b: any) => b.domain === 'CUSTOMER_AR')).toBe(false);
    });

    it('E16 & E17. proves cycle number and labels are never undefined', () => {
      const resultWithNoCycle = resolveClosureModalReadiness({
        closureReadiness: canonicalRuntimeReadiness,
        closureData: {},
        task: { ...hooTask, cycleNumber: undefined },
      });

      expect(resultWithNoCycle.cycleNumber).toBe(1);
      expect(String(resultWithNoCycle.cycleNumber)).not.toContain('undefined');
      expect(resultWithNoCycle.verdictLabel).not.toContain('undefined');
    });
  });
});

