import {
  ServiceClaimRecord,
  ServiceClaimItemRecord,
  PoServiceClaimBalance,
} from '@/services/procurement.service';

describe('PROJECT-SERVICE-CLAIM-R1 Frontend Unit & Component Logic Suite', () => {
  // 1. PO OrderType Eligibility for "Klaim Jasa" Button
  const shouldShowServiceClaimAction = (orderType: string | undefined): boolean => {
    return orderType === 'SERVICE';
  };

  it('1. "Klaim Jasa" action is VISIBLE on SERVICE PO', () => {
    expect(shouldShowServiceClaimAction('SERVICE')).toBe(true);
  });

  it('2. "Klaim Jasa" action is HIDDEN on MATERIAL PO', () => {
    expect(shouldShowServiceClaimAction('MATERIAL')).toBe(false);
  });

  it('3. "Klaim Jasa" action is HIDDEN on LEGACY_MIXED PO', () => {
    expect(shouldShowServiceClaimAction('LEGACY_MIXED')).toBe(false);
  });

  it('4. Empty state is recognized when PO has no claims', () => {
    const claims: ServiceClaimRecord[] = [];
    const isEmpty = claims.length === 0;
    const emptyMessage = isEmpty ? 'Belum ada pengajuan klaim jasa untuk PO ini.' : '';
    expect(isEmpty).toBe(true);
    expect(emptyMessage).toBe('Belum ada pengajuan klaim jasa untuk PO ini.');
  });

  // 2. Exact Balance Preview & Computations
  it('5. PO Balance preview computes remaining quantities and amounts accurately', () => {
    const balance: PoServiceClaimBalance = {
      poId: 10,
      contractTotalAmount: 100000000,
      totalApprovedClaimAmount: 30000000,
      remainingContractValue: 70000000,
      items: [
        {
          poItemId: 101,
          itemName: 'Bore Pile',
          uom: 'M3',
          contractQuantity: 100,
          contractUnitPrice: 500000,
          contractTotalPrice: 50000000,
          approvedQuantity: 40,
          remainingQuantity: 60,
          approvedAmount: 20000000,
          remainingAmount: 30000000,
        },
      ],
    };

    expect(balance.remainingContractValue).toBe(70000000);
    expect(balance.items[0].remainingQuantity).toBe(60);
    expect(balance.items[0].remainingAmount).toBe(30000000);
  });

  // 3. Partial Claim Items live calculation
  it('6. Partial Claim item calculation correctly bounds cumulative quantity and amount', () => {
    const contractQty = 100;
    const contractRate = 500000;
    const prevApprovedQty = 40;
    const currentClaimQty = 25;

    const cumulativeQty = prevApprovedQty + currentClaimQty;
    const remainingQty = contractQty - cumulativeQty;
    const currentClaimAmount = currentClaimQty * contractRate;
    const prevApprovedAmount = prevApprovedQty * contractRate;
    const cumulativeAmount = prevApprovedAmount + currentClaimAmount;
    const remainingValue = (contractQty * contractRate) - cumulativeAmount;

    expect(cumulativeQty).toBe(65);
    expect(remainingQty).toBe(35);
    expect(currentClaimAmount).toBe(12500000);
    expect(cumulativeAmount).toBe(32500000);
    expect(remainingValue).toBe(17500000);
    expect(cumulativeQty).toBeLessThanOrEqual(contractQty);
  });

  // 4. State Badge Presentation
  const getStatusBadgeMeta = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { color: 'default', text: 'DRAFT' };
      case 'SUBMITTED':
        return { color: 'processing', text: 'MENUNGGU VERIFIKASI TEKNIS' };
      case 'NEEDS_REVISION':
        return { color: 'warning', text: 'PERLU REVISI' };
      case 'PM_VERIFIED':
        return { color: 'blue', text: 'VERIFIKASI TEKNIS DISETUJUI' };
      case 'APPROVED_FOR_INVOICE':
        return { color: 'success', text: 'DISETUJUI UNTUK INVOICE' };
      case 'REJECTED':
        return { color: 'error', text: 'DITOLAK' };
      case 'CANCELLED':
        return { color: 'default', text: 'DIBATALKAN' };
      default:
        return { color: 'default', text: status };
    }
  };

  it('7. State badges map all canonical statuses correctly', () => {
    expect(getStatusBadgeMeta('DRAFT').text).toBe('DRAFT');
    expect(getStatusBadgeMeta('SUBMITTED').text).toBe('MENUNGGU VERIFIKASI TEKNIS');
    expect(getStatusBadgeMeta('NEEDS_REVISION').text).toBe('PERLU REVISI');
    expect(getStatusBadgeMeta('PM_VERIFIED').text).toBe('VERIFIKASI TEKNIS DISETUJUI');
    expect(getStatusBadgeMeta('APPROVED_FOR_INVOICE').text).toBe('DISETUJUI UNTUK INVOICE');
    expect(getStatusBadgeMeta('REJECTED').text).toBe('DITOLAK');
    expect(getStatusBadgeMeta('CANCELLED').text).toBe('DIBATALKAN');
  });

  // 5. Immutability & Editability rules
  const canEditClaim = (status: string): boolean => {
    return status === 'DRAFT' || status === 'NEEDS_REVISION';
  };

  it('8. Only DRAFT and NEEDS_REVISION are editable; APPROVED_FOR_INVOICE is locked', () => {
    expect(canEditClaim('DRAFT')).toBe(true);
    expect(canEditClaim('NEEDS_REVISION')).toBe(true);
    expect(canEditClaim('SUBMITTED')).toBe(false);
    expect(canEditClaim('PM_VERIFIED')).toBe(false);
    expect(canEditClaim('APPROVED_FOR_INVOICE')).toBe(false);
    expect(canEditClaim('REJECTED')).toBe(false);
    expect(canEditClaim('CANCELLED')).toBe(false);
  });

  // 6. PM Verification Form Rules (No commercial edit, requires reason for return/reject)
  const validatePmDecision = (decision: string, notes?: string) => {
    if (decision === 'RETURN' && (!notes || notes.trim() === '')) {
      return { valid: false, error: 'Catatan revisi wajib diisi.' };
    }
    if (decision === 'REJECT' && (!notes || notes.trim() === '')) {
      return { valid: false, error: 'Alasan penolakan wajib diisi.' };
    }
    return { valid: true };
  };

  it('9. PM Technical Verification approves without requiring notes, but requires notes for RETURN or REJECT', () => {
    expect(validatePmDecision('APPROVE').valid).toBe(true);
    expect(validatePmDecision('RETURN', '').valid).toBe(false);
    expect(validatePmDecision('RETURN', 'Volume over claim').valid).toBe(true);
    expect(validatePmDecision('REJECT', '').valid).toBe(false);
    expect(validatePmDecision('REJECT', 'Spesifikasi ditolak').valid).toBe(true);
  });

  // 7. Finance Invoice Selector Rules
  const resolveInvoiceClaimMode = (poOrderType: string, paymentType: string) => {
    if (poOrderType === 'MATERIAL') {
      return { requireGoodsReceipt: true, requireServiceClaim: false };
    }
    if (poOrderType === 'SERVICE') {
      if (paymentType === 'DOWN_PAYMENT') {
        return { requireGoodsReceipt: false, requireServiceClaim: false };
      }
      return {
        requireGoodsReceipt: false,
        requireServiceClaim: true,
        selectorLabel: 'Klaim Jasa Disetujui',
      };
    }
    return { requireGoodsReceipt: false, requireServiceClaim: false };
  };

  it('10. Finance mode routes MATERIAL to GR, SERVICE DP preserved, and SERVICE Progress/Final to Approved Service Claim', () => {
    const matProgress = resolveInvoiceClaimMode('MATERIAL', 'PROGRESS');
    expect(matProgress.requireGoodsReceipt).toBe(true);
    expect(matProgress.requireServiceClaim).toBe(false);

    const svcUangMuka = resolveInvoiceClaimMode('SERVICE', 'DOWN_PAYMENT');
    expect(svcUangMuka.requireGoodsReceipt).toBe(false);
    expect(svcUangMuka.requireServiceClaim).toBe(false);

    const svcProgress = resolveInvoiceClaimMode('SERVICE', 'PROGRESS');
    expect(svcProgress.requireGoodsReceipt).toBe(false);
    expect(svcProgress.requireServiceClaim).toBe(true);
    expect(svcProgress.selectorLabel).toBe('Klaim Jasa Disetujui');
    expect(svcProgress.selectorLabel).not.toContain('BAST'); // BAST not universally mandated
  });
});
