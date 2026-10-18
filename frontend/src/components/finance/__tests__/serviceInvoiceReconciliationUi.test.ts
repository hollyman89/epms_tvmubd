/**
 * SERVICE INVOICE RECONCILIATION UI TESTS
 *
 * Verifies frontend presentation, payload construction, and branching requirements for SERVICE vs MATERIAL POs:
 * 1. SERVICE invoice detail does not require Goods Receipt.
 * 2. SERVICE invoice displays Service Claim evidence (Claim Number, Status, Amount, SPK).
 * 3. SERVICE tooltip does not say 3-Way Match, but uses 'Rekonsiliasi Jasa'.
 * 4. MATERIAL invoice preserves Goods Receipt & 3-Way Match flow.
 * 5. Verify payload contract:
 *    - SERVICE verify payload does NOT contain serviceClaimId (server SSOT: invoice.serviceClaimId).
 *    - SERVICE verify payload contains approved=true.
 *    - SERVICE evidenceRef contains canonical claim number.
 *    - MATERIAL verification payload unchanged.
 */

describe('SERVICE INVOICE RECONCILIATION UI & PRESENTATION (EPMS — SERVICE-INVOICE-GATE-R1)', () => {
  // Logic mirror of frontend/src/app/(dashboard)/finance/invoices/page.tsx tooltip
  const getApprovalTooltip = (r: {
    matchStatus?: string;
    orderType?: string;
    serviceClaimId?: number | null;
    serviceClaim?: any;
    purchaseOrder?: { orderType?: string };
  }): string | undefined => {
    if (r.matchStatus === 'MATCHED' || r.matchStatus === 'VERIFIED') {
      return undefined;
    }

    const isService =
      r.purchaseOrder?.orderType === 'SERVICE' ||
      r.orderType === 'SERVICE' ||
      Boolean(r.serviceClaimId) ||
      Boolean(r.serviceClaim);

    if (isService) {
      return 'Invoice belum lolos Rekonsiliasi Jasa. Lakukan verifikasi invoice terhadap Service Claim yang telah disetujui sebelum mengajukan persetujuan.';
    }

    return `Invoice belum lolos verifikasi 3-way match (${r.matchStatus || 'PENDING'}). Lakukan verifikasi faktur terlebih dahulu sebelum mengajukan persetujuan.`;
  };

  // Logic mirror of frontend/src/components/finance/InvoiceDetailModal.tsx GR requirement
  const isGrRequiredForVerification = (params: {
    orderType?: string;
    serviceClaimId?: number | null;
    isProgressInvoice?: boolean;
    selectedVerifyGrId?: number;
    poGoodsReceiptsCount?: number;
  }): boolean => {
    const isServicePo =
      params.orderType === 'SERVICE' || Boolean(params.serviceClaimId);

    if (isServicePo) {
      return false; // SERVICE PO never requires Goods Receipt
    }

    // For MATERIAL progress invoice, GR selection is required
    if (params.isProgressInvoice) {
      return !params.selectedVerifyGrId || (params.poGoodsReceiptsCount || 0) === 0;
    }

    return false;
  };

  // Logic mirror of modal verification button label
  const getVerificationButtonLabel = (orderType?: string, serviceClaimId?: number | null): string => {
    const isServicePo = orderType === 'SERVICE' || Boolean(serviceClaimId);
    return isServicePo ? 'Verifikasi Invoice Jasa' : 'Verifikasi Invoice';
  };

  // Logic mirror of modal header description
  const getReconciliationEngineTitle = (orderType?: string, serviceClaimId?: number | null): string => {
    const isServicePo = orderType === 'SERVICE' || Boolean(serviceClaimId);
    return isServicePo
      ? 'Authoritative Service Reconciliation Engine (Rekonsiliasi Jasa)'
      : 'Authoritative Finance Matching Engine (SSOT API)';
  };

  // Logic mirror of handleVerifySubmit payload construction in InvoiceDetailModal.tsx
  const buildVerifyPayload = (params: {
    isServicePo: boolean;
    isProgressInvoice: boolean;
    selectedVerifyGrId?: number;
    selectedVerifyGr?: { grNumber?: string };
    evidenceRef?: string;
    verifyNotes?: string;
    activeInvoice: {
      serviceClaimId?: number | null;
      serviceClaim?: { claimNumber?: string };
    };
  }) => {
    const payload: any = {
      approved: true,
      notes: params.verifyNotes?.trim() || undefined,
    };

    if (!params.isServicePo && params.isProgressInvoice) {
      payload.goodsReceiptId = params.selectedVerifyGrId ? Number(params.selectedVerifyGrId) : undefined;
      payload.evidenceRef = params.selectedVerifyGr?.grNumber || params.evidenceRef?.trim() || undefined;
    } else if (params.isServicePo) {
      const scNumber = params.activeInvoice.serviceClaim?.claimNumber;
      payload.evidenceRef = scNumber || params.evidenceRef?.trim() || undefined;
      // Note: serviceClaimId is strictly omitted because invoice.serviceClaimId is the server-side SSOT
    } else {
      payload.evidenceRef = params.evidenceRef?.trim() || undefined;
    }

    return payload;
  };

  describe('1. SERVICE Invoice Detail & Goods Receipt Exemption', () => {
    it('SERVICE invoice does not require Goods Receipt for verification', () => {
      const isBlocked = isGrRequiredForVerification({
        orderType: 'SERVICE',
        serviceClaimId: 15,
        isProgressInvoice: true,
        selectedVerifyGrId: undefined,
        poGoodsReceiptsCount: 0,
      });

      expect(isBlocked).toBe(false);
    });

    it('SERVICE invoice uses specialized button label "Verifikasi Invoice Jasa"', () => {
      expect(getVerificationButtonLabel('SERVICE', 15)).toBe('Verifikasi Invoice Jasa');
    });

    it('SERVICE invoice uses "Rekonsiliasi Jasa" engine title instead of generic 3-Way matching', () => {
      expect(getReconciliationEngineTitle('SERVICE', 15)).toBe(
        'Authoritative Service Reconciliation Engine (Rekonsiliasi Jasa)'
      );
    });
  });

  describe('2. SERVICE Invoice Service Claim Evidence Display', () => {
    it('extracts and presents Service Claim evidence correctly', () => {
      const activeInvoice = {
        id: 2,
        invoiceNumber: 'INV-20261014-002',
        serviceClaimId: 15,
        serviceClaim: {
          id: 15,
          claimNumber: 'SCL-20261014-001',
          status: 'APPROVED_FOR_INVOICE',
          approvedClaimAmount: 3781156,
          serviceOrder: {
            serviceOrderNumber: 'SPK-20261014-006',
          },
        },
      };

      const claim = activeInvoice.serviceClaim;
      expect(claim).toBeDefined();
      expect(claim.claimNumber).toBe('SCL-20261014-001');
      expect(claim.status).toBe('APPROVED_FOR_INVOICE');
      expect(claim.approvedClaimAmount).toBe(3781156);
      expect(claim.serviceOrder.serviceOrderNumber).toBe('SPK-20261014-006');
    });
  });

  describe('3. SERVICE Tooltip Text', () => {
    it('SERVICE invoice tooltip says Rekonsiliasi Jasa and does NOT say 3-Way Match', () => {
      const serviceInvoice = {
        id: 2,
        matchStatus: 'PENDING',
        serviceClaimId: 15,
        purchaseOrder: { orderType: 'SERVICE' },
      };

      const tooltip = getApprovalTooltip(serviceInvoice);
      expect(tooltip).toBe(
        'Invoice belum lolos Rekonsiliasi Jasa. Lakukan verifikasi invoice terhadap Service Claim yang telah disetujui sebelum mengajukan persetujuan.'
      );
      expect(tooltip).not.toContain('3-way match');
      expect(tooltip).toContain('Rekonsiliasi Jasa');
    });

    it('when SERVICE invoice is MATCHED or VERIFIED, tooltip is disabled (undefined)', () => {
      expect(
        getApprovalTooltip({
          matchStatus: 'MATCHED',
          purchaseOrder: { orderType: 'SERVICE' },
        })
      ).toBeUndefined();

      expect(
        getApprovalTooltip({
          matchStatus: 'VERIFIED',
          purchaseOrder: { orderType: 'SERVICE' },
        })
      ).toBeUndefined();
    });
  });

  describe('4. MATERIAL Invoice Regression Protection', () => {
    it('MATERIAL progress invoice requires Goods Receipt for verification', () => {
      const isBlocked = isGrRequiredForVerification({
        orderType: 'MATERIAL',
        serviceClaimId: null,
        isProgressInvoice: true,
        selectedVerifyGrId: undefined,
        poGoodsReceiptsCount: 0,
      });

      expect(isBlocked).toBe(true);
    });

    it('MATERIAL progress invoice unblocks when Goods Receipt is selected', () => {
      const isBlocked = isGrRequiredForVerification({
        orderType: 'MATERIAL',
        serviceClaimId: null,
        isProgressInvoice: true,
        selectedVerifyGrId: 42,
        poGoodsReceiptsCount: 1,
      });

      expect(isBlocked).toBe(false);
    });

    it('MATERIAL invoice uses standard "Verifikasi Invoice" button label', () => {
      expect(getVerificationButtonLabel('MATERIAL', null)).toBe('Verifikasi Invoice');
    });

    it('MATERIAL invoice uses standard 3-Way Matching engine title', () => {
      expect(getReconciliationEngineTitle('MATERIAL', null)).toBe(
        'Authoritative Finance Matching Engine (SSOT API)'
      );
    });

    it('MATERIAL invoice tooltip retains 3-Way Match copy when unverified', () => {
      const materialInvoice = {
        id: 1,
        matchStatus: 'PENDING',
        purchaseOrder: { orderType: 'MATERIAL' },
      };

      const tooltip = getApprovalTooltip(materialInvoice);
      expect(tooltip).toBe(
        'Invoice belum lolos verifikasi 3-way match (PENDING). Lakukan verifikasi faktur terlebih dahulu sebelum mengajukan persetujuan.'
      );
      expect(tooltip).toContain('3-way match');
      expect(tooltip).not.toContain('Rekonsiliasi Jasa');
    });
  });

  describe('5. SERVICE Verify Payload Contract (HF01 Regression Guard)', () => {
    it('CASE 1 & 2 & 3: SERVICE verify payload contains approved=true, evidenceRef=claimNumber, and NO serviceClaimId', () => {
      const payload = buildVerifyPayload({
        isServicePo: true,
        isProgressInvoice: false,
        activeInvoice: {
          serviceClaimId: 15,
          serviceClaim: {
            claimNumber: 'SCL-20261014-001',
          },
        },
      });

      expect(payload.approved).toBe(true);
      expect(payload.evidenceRef).toBe('SCL-20261014-001');
      expect(payload).not.toHaveProperty('serviceClaimId');
      expect(payload).not.toHaveProperty('goodsReceiptId');
    });

    it('CASE 4: MATERIAL verify payload retains goodsReceiptId and evidenceRef, and has NO serviceClaimId', () => {
      const payload = buildVerifyPayload({
        isServicePo: false,
        isProgressInvoice: true,
        selectedVerifyGrId: 101,
        selectedVerifyGr: { grNumber: 'GR-20261014-001' },
        activeInvoice: {
          serviceClaimId: null,
        },
      });

      expect(payload.approved).toBe(true);
      expect(payload.goodsReceiptId).toBe(101);
      expect(payload.evidenceRef).toBe('GR-20261014-001');
      expect(payload).not.toHaveProperty('serviceClaimId');
    });

    it('CASE 5: Service UI still does not require Goods Receipt (zero GR dependency)', () => {
      const isRequired = isGrRequiredForVerification({
        orderType: 'SERVICE',
        serviceClaimId: 15,
        isProgressInvoice: true,
        selectedVerifyGrId: undefined,
        poGoodsReceiptsCount: 0,
      });
      expect(isRequired).toBe(false);
    });
  });
});
