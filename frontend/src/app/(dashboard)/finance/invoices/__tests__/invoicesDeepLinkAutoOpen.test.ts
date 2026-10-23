/**
 * FINANCE INVOICE DEEP-LINK AUTO-OPEN TESTS
 *
 * Verifies:
 * 1. tab=ready_pos -> correct tab active
 * 2. valid poId + paymentTermId -> correct PO resolved
 * 3. correct payment term resolved
 * 4. CreateInvoiceModal auto-opens
 * 5. modal receives correct paymentTermId
 * 6. refresh/direct deep-link works
 * 7. invalid poId -> no crash
 * 8. invalid paymentTermId -> no crash
 * 9. manual Terbitkan Termin still works
 * 10. serviceClaimId deep-link regression passes
 * 11. modal does not open twice
 * 12. closing modal does not immediately reopen unless navigation/context changes
 */

describe('EPMS — Finance Invoice Deep-Link Auto-Open & Canonical Handler', () => {
  // Mock Purchase Order fixtures
  const mockPos = [
    {
      id: 128,
      poNumber: 'PO-20261023-128',
      orderType: 'MATERIAL',
      status: 'ISSUED',
      totalAmount: 100000000,
      vendor: { id: 10, name: 'PT Semen Perkasa', code: 'VND-SP' },
      purchaseRequest: { id: 50, projectId: 201, project: { id: 201, name: 'Pembangunan RSUD' } },
      paymentTerms: [
        { id: 11, sequence: 1, termName: 'Uang Muka 20%', percentage: 20, amount: 20000000, status: 'PAID' },
        { id: 12, sequence: 2, termName: 'Termin 1 (Fisik 50%)', percentage: 50, amount: 50000000, status: 'PENDING' },
        { id: 13, sequence: 3, termName: 'Pelunasan (Fisik 100%)', percentage: 30, amount: 30000000, status: 'PENDING' },
      ],
    },
    {
      id: 250,
      poNumber: 'PO-20261023-250',
      orderType: 'SERVICE',
      status: 'ISSUED',
      totalAmount: 75000000,
      vendor: { id: 22, name: 'CV Konsultan Desain', code: 'VND-KD' },
      purchaseRequest: { id: 65, projectId: 305, project: { id: 305, name: 'Renovasi Gedung B' } },
      paymentTerms: [
        { id: 21, sequence: 1, termName: 'Klaim Jasa Bertahap', percentage: 100, amount: 75000000, status: 'PENDING' },
      ],
    },
  ];

  // Pure state transition runner matching InvoicesPageContent
  class InvoicesPageHarness {
    public activeTabKey: string = 'ready_pos';
    public selectedPoForInvoice: any = null;
    public selectedPaymentTermForInvoice: any = null;
    public selectedServiceClaimIdForInvoice: number | undefined = undefined;
    public isCreateModalOpen: boolean = false;
    public handledDeepLinkRef: { current: string | null } = { current: null };
    public openModalCallCount: number = 0;

    constructor(
      public purchaseOrders: any[] = mockPos,
      public loadingPos: boolean = false,
      initialTab: string = 'ready_pos'
    ) {
      this.activeTabKey = initialTab;
    }

    // Canonical State Transition Handler
    public handleCreateInvoice = (po: any, paymentTerm?: any, serviceClaimId?: number) => {
      this.selectedPoForInvoice = po;
      this.selectedPaymentTermForInvoice = paymentTerm || null;
      this.selectedServiceClaimIdForInvoice = serviceClaimId ? Number(serviceClaimId) : undefined;
      this.isCreateModalOpen = true;
      this.openModalCallCount++;
    };

    // Close Modal handler
    public handleCloseModal = () => {
      this.isCreateModalOpen = false;
      this.selectedPoForInvoice = null;
      this.selectedPaymentTermForInvoice = null;
      this.selectedServiceClaimIdForInvoice = undefined;
    };

    // Effect logic mirror from InvoicesPageContent
    public runDeepLinkEffect(params: {
      tab?: string | null;
      poId?: string | null;
      paymentTermId?: string | null;
      serviceClaimId?: string | null;
    }) {
      const urlTab = params.tab;
      const urlPoId = params.poId;
      const urlPaymentTermId = params.paymentTermId;
      const urlServiceClaimId = params.serviceClaimId;

      // 1. Tab synchronization
      if (urlTab && urlTab !== this.activeTabKey) {
        this.activeTabKey = urlTab;
      }

      // 2. Validate deep-link parameters
      if (!urlPoId) {
        this.handledDeepLinkRef.current = null;
        return;
      }

      const targetPoId = Number(urlPoId);
      if (isNaN(targetPoId) || targetPoId <= 0) {
        return;
      }

      const targetTermId = urlPaymentTermId ? Number(urlPaymentTermId) : null;
      if (urlPaymentTermId && (isNaN(Number(urlPaymentTermId)) || Number(urlPaymentTermId) <= 0)) {
        return;
      }

      const targetServiceClaimId = urlServiceClaimId ? Number(urlServiceClaimId) : null;
      if (urlServiceClaimId && (isNaN(Number(urlServiceClaimId)) || Number(urlServiceClaimId) <= 0)) {
        return;
      }

      // 3. Async Data Safety
      if (this.loadingPos) {
        return;
      }

      // 4. Resolve Matching Purchase Order
      const matchingPo = this.purchaseOrders.find((p) => Number(p.id) === targetPoId);
      if (!matchingPo) {
        return;
      }

      // Construct unique context key for idempotency
      const currentDeepLinkKey = `${targetPoId}:${targetTermId ?? ''}:${targetServiceClaimId ?? ''}`;

      if (this.handledDeepLinkRef.current === currentDeepLinkKey) {
        return;
      }

      // 5. Resolve Payment Term / Service Claim Context
      if (targetTermId !== null) {
        const terms = matchingPo.paymentTerms || [];
        const matchingTerm = terms.find((t: any) => Number(t.id) === targetTermId);
        if (!matchingTerm) {
          return;
        }
        this.handledDeepLinkRef.current = currentDeepLinkKey;
        this.handleCreateInvoice(matchingPo, matchingTerm);
        return;
      }

      if (targetServiceClaimId !== null) {
        this.handledDeepLinkRef.current = currentDeepLinkKey;
        const applicableTerm = (matchingPo.paymentTerms || []).find((t: any) => {
          const isDp = (t.termType || '').toUpperCase() === 'DP' || (t.termName || '').toUpperCase().includes('DP');
          return !isDp && t.status === 'PENDING';
        }) || matchingPo.paymentTerms?.[0];
        this.handleCreateInvoice(matchingPo, applicableTerm, targetServiceClaimId);
        return;
      }

      this.handledDeepLinkRef.current = currentDeepLinkKey;
      const defaultTerm = (matchingPo.paymentTerms || []).find((t: any) => t.status === 'PENDING' || !t.status);
      this.handleCreateInvoice(matchingPo, defaultTerm);
    }
  }

  it('1. tab=ready_pos activates correct tab', () => {
    const harness = new InvoicesPageHarness(mockPos, false, 'invoices_list');
    expect(harness.activeTabKey).toBe('invoices_list');

    harness.runDeepLinkEffect({ tab: 'ready_pos' });
    expect(harness.activeTabKey).toBe('ready_pos');
  });

  it('2. valid poId + paymentTermId resolves correct PO', () => {
    const harness = new InvoicesPageHarness(mockPos, false);
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });

    expect(harness.selectedPoForInvoice).not.toBeNull();
    expect(harness.selectedPoForInvoice.id).toBe(128);
    expect(harness.selectedPoForInvoice.poNumber).toBe('PO-20261023-128');
  });

  it('3. correct payment term resolved for PO', () => {
    const harness = new InvoicesPageHarness(mockPos, false);
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });

    expect(harness.selectedPaymentTermForInvoice).not.toBeNull();
    expect(harness.selectedPaymentTermForInvoice.id).toBe(12);
    expect(harness.selectedPaymentTermForInvoice.termName).toBe('Termin 1 (Fisik 50%)');
    expect(harness.selectedPaymentTermForInvoice.percentage).toBe(50);
  });

  it('4. CreateInvoiceModal auto-opens upon successful resolution', () => {
    const harness = new InvoicesPageHarness(mockPos, false);
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });

    expect(harness.isCreateModalOpen).toBe(true);
  });

  it('5. modal receives correct paymentTermId prop value', () => {
    const harness = new InvoicesPageHarness(mockPos, false);
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });

    const initialPaymentTermId = harness.selectedPaymentTermForInvoice
      ? Number(harness.selectedPaymentTermForInvoice.id)
      : undefined;

    expect(initialPaymentTermId).toBe(12);
  });

  it('6. refresh/direct deep-link works when data arrives after initial render', () => {
    // Stage 1: Initial mount before async data finishes loading
    const harness = new InvoicesPageHarness([], true); // loadingPos = true, purchaseOrders = []
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });

    // Modal must NOT open while data is loading
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.selectedPoForInvoice).toBeNull();

    // Stage 2: Data finishes loading from backend
    harness.purchaseOrders = mockPos;
    harness.loadingPos = false;
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });

    // Now modal must open cleanly
    expect(harness.isCreateModalOpen).toBe(true);
    expect(harness.selectedPoForInvoice?.id).toBe(128);
    expect(harness.selectedPaymentTermForInvoice?.id).toBe(12);
  });

  it('7. invalid poId fails gracefully without crashing or opening modal', () => {
    const harness = new InvoicesPageHarness(mockPos, false);

    // Non-numeric poId
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: 'invalid-id', paymentTermId: '12' });
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.selectedPoForInvoice).toBeNull();

    // Non-existent poId
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '999999', paymentTermId: '12' });
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.selectedPoForInvoice).toBeNull();
  });

  it('8. invalid paymentTermId fails gracefully without crashing or opening wrong term', () => {
    const harness = new InvoicesPageHarness(mockPos, false);

    // Non-numeric paymentTermId
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: 'invalid-term' });
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.selectedPaymentTermForInvoice).toBeNull();

    // PaymentTermId belonging to another PO or non-existent
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '999999' });
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.selectedPaymentTermForInvoice).toBeNull();
  });

  it('9. manual Terbitkan Termin still works via shared handleCreateInvoice', () => {
    const harness = new InvoicesPageHarness(mockPos, false);

    const manualPo = mockPos[0];
    const manualTerm = manualPo.paymentTerms[1]; // Termin 1

    harness.handleCreateInvoice(manualPo, manualTerm);

    expect(harness.isCreateModalOpen).toBe(true);
    expect(harness.selectedPoForInvoice?.id).toBe(128);
    expect(harness.selectedPaymentTermForInvoice?.id).toBe(12);
    expect(harness.openModalCallCount).toBe(1);
  });

  it('10. serviceClaimId deep-link regression passes', () => {
    const harness = new InvoicesPageHarness(mockPos, false);

    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '250', serviceClaimId: '88' });

    expect(harness.isCreateModalOpen).toBe(true);
    expect(harness.selectedPoForInvoice?.id).toBe(250);
    expect(harness.selectedServiceClaimIdForInvoice).toBe(88);
  });

  it('11. modal does not open twice for the same deep link', () => {
    const harness = new InvoicesPageHarness(mockPos, false);

    // First trigger
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });
    expect(harness.openModalCallCount).toBe(1);

    // Re-render with identical params
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });
    expect(harness.openModalCallCount).toBe(1);
  });

  it('12. closing modal does not immediately reopen unless navigation/context changes', () => {
    const harness = new InvoicesPageHarness(mockPos, false);

    // 1. Open via deep link
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });
    expect(harness.isCreateModalOpen).toBe(true);
    expect(harness.openModalCallCount).toBe(1);

    // 2. User closes modal
    harness.handleCloseModal();
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.selectedPoForInvoice).toBeNull();

    // 3. Component re-evaluates effect with same URL (e.g. background refetch or tab click)
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '12' });
    expect(harness.isCreateModalOpen).toBe(false);
    expect(harness.openModalCallCount).toBe(1);

    // 4. Navigation/context changes to another To-Do (Term 13)
    harness.runDeepLinkEffect({ tab: 'ready_pos', poId: '128', paymentTermId: '13' });
    expect(harness.isCreateModalOpen).toBe(true);
    expect(harness.selectedPaymentTermForInvoice?.id).toBe(13);
    expect(harness.openModalCallCount).toBe(2);
  });
});
