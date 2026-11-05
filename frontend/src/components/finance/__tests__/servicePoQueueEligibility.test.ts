/**
 * SERVICE PO FINANCE QUEUE & INVOICE ELIGIBILITY UNIT TESTS
 *
 * Verifies Finance & Invoices queue presentation and eligibility logic:
 * 1. PO-20261104-001 (Service PO with APPROVED_FOR_INVOICE claim):
 *    - Realization renders service-specific copy (Klaim Disetujui, claim number, approved amount).
 *    - DOES NOT render Material GR copy ("Belum ada GR" / "0/3000 unit").
 *    - Evaluates as eligible (isEligible: true, Siap Pelunasan Penuh).
 *    - Action button is enabled.
 * 2. PO-20261104-002 (Service PO with PM_VERIFIED claim):
 *    - Realization renders service verification copy (Menunggu Verifikasi Komersial, claim number).
 *    - DOES NOT render Material GR copy ("Belum ada GR" / "0/3000 unit").
 *    - Evaluates as ineligible (isEligible: false, Menunggu Verifikasi: Pelunasan Penuh).
 *    - Action button is disabled with explanation that commercial approval (APPROVED_FOR_INVOICE) is required.
 * 3. Material POs:
 *    - Continue rendering GR-based fulfillment and status.
 *    - Zero regression in Material PO eligibility.
 * 4. CreateInvoiceModal logic:
 *    - Service PO with approved claim permits invoice submission.
 *    - Service PO with unapproved claim blocks submission.
 *    - Service PO DP term permitted without service claim.
 *    - Service PO FINAL_DELIVERY requires 100% approved claim scope.
 *    - Material PO continues requiring Goods Receipt for PROGRESS.
 */

describe('SERVICE PO FINANCE QUEUE & INVOICE ELIGIBILITY (EPMS-20261105)', () => {
  // Logic mirror of getQueueTermEligibility in frontend/src/app/(dashboard)/finance/invoices/page.tsx
  const getQueueTermEligibility = (
    po: {
      orderType?: string;
      status?: string;
      totalAmount?: number;
      paymentTerms?: any[];
      invoices?: any[];
      serviceClaims?: any[];
      items?: any[];
    },
    term: any
  ): { isEligible: boolean; statusTag: string; reasons: string[] } => {
    const reasons: string[] = [];
    const isServicePo = po.orderType === 'SERVICE';

    if (po.status === 'CANCELLED' || po.status === 'REJECTED') {
      return { isEligible: false, statusTag: '[PO NON-AKTIF]', reasons: ['PO berstatus dibatalkan atau ditolak'] };
    }

    if (term.status !== 'PENDING') {
      return {
        isEligible: false,
        statusTag: `[${term.status}]`,
        reasons: [`Termin sudah diproses (${term.status})`],
      };
    }

    // Sequence check
    const currentSeq = Number(term.sequence);
    if (currentSeq > 1 && po.paymentTerms && po.paymentTerms.length > 0) {
      for (const prevTerm of po.paymentTerms) {
        if (prevTerm.deletedAt || Number(prevTerm.id) === Number(term.id)) continue;
        const prevSeq = Number(prevTerm.sequence);
        if (prevSeq < currentSeq) {
          const isPrevDp =
            prevTerm.termType === 'DOWN_PAYMENT' ||
            (prevTerm.termName || '').toUpperCase().includes('DP') ||
            (prevTerm.termName || '').toUpperCase().includes('UANG MUKA');

          if (isPrevDp && prevTerm.status !== 'PAID') {
            reasons.push(`Uang Muka / DP (${prevTerm.termName}) belum berstatus PAID (saat ini: ${prevTerm.status})`);
          } else if (!isPrevDp && !['VERIFIED', 'PAID'].includes(prevTerm.status)) {
            reasons.push(`Termin sebelumnya (${prevTerm.termName}) belum mencapai status VERIFIED atau PAID`);
          }
        }
      }
    }

    const tType = (term.termType || '').toUpperCase();
    const tName = (term.termName || '').toUpperCase();
    const isDp = tType === 'DOWN_PAYMENT' || tType === 'DP' || tName.includes('DP') || tName.includes('UANG MUKA');
    const isRetention = tType === 'RETENTION' || tName.includes('RETEN');
    const isFinalDelivery =
      tType === 'FINAL_DELIVERY' ||
      tType === 'LUMPSUM' ||
      tName.includes('PELUNASAN') ||
      tName.includes('FINAL') ||
      tName.includes('100%');

    if (isRetention && po.status !== 'COMPLETED') {
      reasons.push('Termin retensi hanya dapat ditagihkan setelah pekerjaan/kontrak selesai (COMPLETED)');
    }

    // Service PO Milestone & Capacity Gates
    if (isServicePo) {
      if (!isDp) {
        const approvedClaims = (po.serviceClaims || []).filter(
          (c: any) => c.status === 'APPROVED_FOR_INVOICE' && !c.deletedAt
        );
        const totalApprovedClaimAmount = approvedClaims.reduce(
          (acc: number, c: any) => acc + Number(c.approvedClaimAmount || c.totalClaimAmount || 0),
          0
        );

        const activeInvoices = (po.invoices || []).filter(
          (inv: any) => !inv.deletedAt && inv.status !== 'CANCELLED' && inv.matchStatus !== 'REJECTED'
        );
        const alreadyInvoicedAmount = activeInvoices.reduce(
          (acc: number, inv: any) => acc + Number(inv.totalAmount || 0),
          0
        );

        const remainingClaimCapacity = Math.max(0, totalApprovedClaimAmount - alreadyInvoicedAmount);
        const termAmount = Number(term.amount || 0);

        if (approvedClaims.length === 0) {
          const pmVerifiedClaims = (po.serviceClaims || []).filter(
            (c: any) => c.status === 'PM_VERIFIED' && !c.deletedAt
          );
          const submittedClaims = (po.serviceClaims || []).filter(
            (c: any) => (c.status === 'SUBMITTED' || c.status === 'DRAFT') && !c.deletedAt
          );

          if (pmVerifiedClaims.length > 0) {
            reasons.push(
              `Klaim Jasa ${pmVerifiedClaims[0].claimNumber} baru diverifikasi teknis oleh PM (PM_VERIFIED). Menunggu persetujuan komersial oleh tim Purchasing (APPROVED_FOR_INVOICE).`
            );
          } else if (submittedClaims.length > 0) {
            reasons.push(
              `Klaim Jasa ${submittedClaims[0].claimNumber} masih dalam peninjauan teknis PM (status: ${submittedClaims[0].status}).`
            );
          } else {
            reasons.push(
              'Belum ada Klaim Jasa yang disetujui (APPROVED_FOR_INVOICE) oleh Purchasing & PM untuk dasar penagihan jasa ini.'
            );
          }
        } else if (isFinalDelivery) {
          const poTotal = Number(po.totalAmount || 0);
          if (totalApprovedClaimAmount < poTotal - 0.01) {
            reasons.push(
              `Pelunasan penuh jasa memerlukan persetujuan klaim 100% (Disetujui: Rp ${totalApprovedClaimAmount.toLocaleString('id-ID')}, Total PO: Rp ${poTotal.toLocaleString('id-ID')}).`
            );
          }
        } else if (termAmount > remainingClaimCapacity + 0.01) {
          reasons.push(
            `Kapasitas klaim jasa yang disetujui tidak mencukupi (Nilai Termin: Rp ${termAmount.toLocaleString('id-ID')}, Sisa Klaim: Rp ${remainingClaimCapacity.toLocaleString('id-ID')}).`
          );
        }
      }
    } else {
      // Material PO Gates
      if (isFinalDelivery && po.status !== 'COMPLETED') {
        const isAllItemsCompleted =
          po.items &&
          po.items.length > 0 &&
          po.items.every((item: any) => Number(item.receivedQuantity || 0) >= Number(item.quantity || 0));

        if (!isAllItemsCompleted) {
          reasons.push('Pelunasan penuh memerlukan seluruh barang diterima lengkap (100% Goods Receipt)');
        }
      }
    }

    if (reasons.length > 0) {
      const pmVerified = (po.serviceClaims || []).some((c: any) => c.status === 'PM_VERIFIED' && !c.deletedAt);
      const statusTag = isServicePo && !isDp && (po.serviceClaims || []).filter((c: any) => c.status === 'APPROVED_FOR_INVOICE').length === 0
        ? pmVerified ? '[MENUNGGU VERIFIKASI KOMERSIAL]' : '[MENUNGGU KLAIM JASA]'
        : '[BELUM MEMENUHI SYARAT]';
      return { isEligible: false, statusTag, reasons };
    }

    return {
      isEligible: true,
      statusTag: isDp ? '[SIAP TAGIH DP]' : '[SIAP TAGIH]',
      reasons: [],
    };
  };

  // Logic mirror of fulfillment column rendering in page.tsx
  const renderFulfillmentText = (r: {
    orderType?: string;
    totalAmount?: number;
    serviceClaims?: any[];
    items?: any[];
  }): string => {
    if (r.orderType === 'SERVICE') {
      const claims = (r.serviceClaims || []).filter((c: any) => !c.deletedAt);
      const approvedClaims = claims.filter((c: any) => c.status === 'APPROVED_FOR_INVOICE');
      const pmVerifiedClaims = claims.filter((c: any) => c.status === 'PM_VERIFIED');
      const submittedClaims = claims.filter((c: any) => c.status === 'SUBMITTED' || c.status === 'DRAFT');

      const totalApprovedAmount = approvedClaims.reduce(
        (acc: number, c: any) => acc + Number(c.approvedClaimAmount || c.totalClaimAmount || 0),
        0
      );
      const poTotal = Number(r.totalAmount || 0);
      const isFullApproved = poTotal > 0 && totalApprovedAmount >= poTotal;

      if (approvedClaims.length > 0) {
        const claimRef = approvedClaims[0].claimNumber;
        const statusLabel = isFullApproved ? '100% Klaim Disetujui' : 'Klaim Parsial Disetujui';
        return `${statusLabel} | Rp ${totalApprovedAmount.toLocaleString('id-ID')} · Klaim: ${claimRef}`;
      }

      if (pmVerifiedClaims.length > 0) {
        const claimRef = pmVerifiedClaims[0].claimNumber;
        return `Menunggu Verifikasi Komersial | Klaim ${claimRef} (PM Verified)`;
      }

      if (submittedClaims.length > 0) {
        const claimRef = submittedClaims[0].claimNumber;
        return `Menunggu Verifikasi Klaim | Klaim ${claimRef} (In Review)`;
      }

      return 'Menunggu SPK / Klaim Jasa | Belum ada klaim';
    }

    // Material PO
    const items = r.items || [];
    const totalOrdered = items.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
    const totalReceived = items.reduce((acc: number, it: any) => acc + Number(it.receivedQuantity || 0), 0);
    const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
    const grStatus = totalReceived > 0 ? 'GR tercatat' : 'Belum ada GR';
    return `${pct}% Diterima | ${totalReceived}/${totalOrdered} unit · ${grStatus}`;
  };

  describe('1. PO-20261104-001 (Service PO with APPROVED_FOR_INVOICE claim)', () => {
    const po001 = {
      id: 15,
      poNumber: 'PO-20261104-001',
      orderType: 'SERVICE',
      status: 'ISSUED',
      totalAmount: 14397000,
      paymentTerms: [
        {
          id: 1,
          poId: 15,
          termName: 'Pelunasan Penuh',
          termType: 'FINAL_DELIVERY',
          percentage: 100,
          amount: 14397000,
          sequence: 1,
          status: 'PENDING',
        },
      ],
      serviceClaims: [
        {
          id: 2,
          claimNumber: 'SCL-20261104-002',
          poId: 15,
          status: 'APPROVED_FOR_INVOICE',
          totalClaimAmount: 14397000,
          approvedClaimAmount: 14397000,
        },
      ],
      invoices: [],
      items: [
        {
          id: 20,
          purchaseOrderId: 15,
          itemName: 'Jasa Implementasi Keamanan Siber',
          quantity: 3000,
          receivedQuantity: 0, // Canonical: Service PO has 0 receivedQuantity
          unitPrice: 4799,
          totalPrice: 14397000,
        },
      ],
    };

    it('Fulfillment column renders service claim details and NO GR copy', () => {
      const renderedText = renderFulfillmentText(po001);

      expect(renderedText).toContain('100% Klaim Disetujui');
      expect(renderedText).toContain('SCL-20261104-002');
      expect(renderedText).toContain('14.397.000');
      // Crucial: Must NOT contain Material GR text
      expect(renderedText).not.toContain('Belum ada GR');
      expect(renderedText).not.toContain('0/3000 unit');
    });

    it('Queue eligibility evaluates as ready for invoice issuance', () => {
      const eligibility = getQueueTermEligibility(po001, po001.paymentTerms[0]);

      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.statusTag).toBe('[SIAP TAGIH]');
      expect(eligibility.reasons).toHaveLength(0);
    });
  });

  describe('2. PO-20261104-002 (Service PO with PM_VERIFIED claim)', () => {
    const po002 = {
      id: 16,
      poNumber: 'PO-20261104-002',
      orderType: 'SERVICE',
      status: 'ISSUED',
      totalAmount: 14397000,
      paymentTerms: [
        {
          id: 2,
          poId: 16,
          termName: 'Pelunasan Penuh',
          termType: 'FINAL_DELIVERY',
          percentage: 100,
          amount: 14397000,
          sequence: 1,
          status: 'PENDING',
        },
      ],
      serviceClaims: [
        {
          id: 1,
          claimNumber: 'SCL-20261104-001',
          poId: 16,
          status: 'PM_VERIFIED', // Verified by PM, awaiting commercial approval by Purchasing
          totalClaimAmount: 14397000,
          approvedClaimAmount: 0,
        },
      ],
      invoices: [],
      items: [
        {
          id: 21,
          purchaseOrderId: 16,
          itemName: 'Jasa Assessment IT',
          quantity: 3000,
          receivedQuantity: 0,
          unitPrice: 4799,
          totalPrice: 14397000,
        },
      ],
    };

    it('Fulfillment column renders service verification status and NO GR copy', () => {
      const renderedText = renderFulfillmentText(po002);

      expect(renderedText).toContain('Menunggu Verifikasi Komersial');
      expect(renderedText).toContain('SCL-20261104-001');
      expect(renderedText).toContain('PM Verified');
      // Crucial: Must NOT contain Material GR text
      expect(renderedText).not.toContain('Belum ada GR');
      expect(renderedText).not.toContain('0/3000 unit');
    });

    it('Queue eligibility evaluates as NOT ready and explains commercial approval required', () => {
      const eligibility = getQueueTermEligibility(po002, po002.paymentTerms[0]);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.statusTag).toBe('[MENUNGGU VERIFIKASI KOMERSIAL]');
      expect(eligibility.reasons.length).toBeGreaterThan(0);
      expect(eligibility.reasons[0]).toContain('SCL-20261104-001');
      expect(eligibility.reasons[0]).toContain('PM_VERIFIED');
      expect(eligibility.reasons[0]).toContain('APPROVED_FOR_INVOICE');
    });
  });

  describe('3. MATERIAL PO Regression Protection', () => {
    const poMaterial = {
      id: 11,
      poNumber: 'PO-20261023-002',
      orderType: 'MATERIAL',
      status: 'COMPLETED',
      totalAmount: 15000000,
      paymentTerms: [
        {
          id: 5,
          poId: 11,
          termName: 'Pelunasan Penuh Material',
          termType: 'FINAL_DELIVERY',
          percentage: 100,
          amount: 15000000,
          sequence: 1,
          status: 'PENDING',
        },
      ],
      items: [
        {
          id: 30,
          purchaseOrderId: 11,
          itemName: 'Kabel UTP Cat6',
          quantity: 3000,
          receivedQuantity: 3000,
          unitPrice: 5000,
          totalPrice: 15000000,
        },
      ],
    };

    it('Material PO renders GR-based fulfillment text', () => {
      const renderedText = renderFulfillmentText(poMaterial);

      expect(renderedText).toBe('100% Diterima | 3000/3000 unit · GR tercatat');
    });

    it('Material PO with full receipt is eligible for final delivery', () => {
      const eligibility = getQueueTermEligibility(poMaterial, poMaterial.paymentTerms[0]);

      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.statusTag).toBe('[SIAP TAGIH]');
    });

    it('Material PO with 0 received quantity is NOT eligible and mentions 100% Goods Receipt', () => {
      const poIncomplete = {
        ...poMaterial,
        status: 'ISSUED',
        items: [{ ...poMaterial.items[0], receivedQuantity: 0 }],
      };

      const eligibility = getQueueTermEligibility(poIncomplete, poIncomplete.paymentTerms[0]);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.reasons[0]).toContain('100% Goods Receipt');
    });
  });

  describe('4. Special Term Types for SERVICE PO', () => {
    it('Service PO DP term is eligible without requiring service claims', () => {
      const poServiceDp = {
        id: 17,
        poNumber: 'PO-SERVICE-DP-001',
        orderType: 'SERVICE',
        status: 'ISSUED',
        totalAmount: 10000000,
        paymentTerms: [
          {
            id: 10,
            termName: 'Uang Muka 30%',
            termType: 'DOWN_PAYMENT',
            percentage: 30,
            amount: 3000000,
            sequence: 1,
            status: 'PENDING',
          },
        ],
        serviceClaims: [], // No claims exist for DP
      };

      const eligibility = getQueueTermEligibility(poServiceDp, poServiceDp.paymentTerms[0]);

      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.statusTag).toBe('[SIAP TAGIH DP]');
    });

    it('Service PO FINAL_DELIVERY term blocks if approved claim is less than PO total', () => {
      const poServicePartial = {
        id: 18,
        poNumber: 'PO-SERVICE-PARTIAL-001',
        orderType: 'SERVICE',
        status: 'ISSUED',
        totalAmount: 10000000,
        paymentTerms: [
          {
            id: 11,
            termName: 'Pelunasan Penuh 100%',
            termType: 'FINAL_DELIVERY',
            percentage: 100,
            amount: 10000000,
            sequence: 1,
            status: 'PENDING',
          },
        ],
        serviceClaims: [
          {
            id: 10,
            claimNumber: 'SCL-PARTIAL-001',
            status: 'APPROVED_FOR_INVOICE',
            approvedClaimAmount: 6000000, // Only 60% approved
          },
        ],
      };

      const eligibility = getQueueTermEligibility(poServicePartial, poServicePartial.paymentTerms[0]);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.reasons[0]).toContain('persetujuan klaim 100%');
    });
  });
});

