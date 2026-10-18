import {
  resolveStatusPresentation,
} from '../statusPresentation';

describe('Canonical Status Presentation (UIUX-ROOT-04)', () => {
  // 1. GR FULLY_RECEIVED
  it('1. maps Goods Receipt FULLY_RECEIVED to Diterima Penuh', () => {
    const res = resolveStatusPresentation('gr', 'FULLY_RECEIVED');
    expect(res.label).toBe('Diterima Penuh');
    expect(res.color).toBe('success');
  });

  // 2. GR PARTIAL/PARTIALLY_RECEIVED
  it('2. maps Goods Receipt PARTIAL and PARTIALLY_RECEIVED to Diterima Sebagian', () => {
    const partialRes = resolveStatusPresentation('gr', 'PARTIAL');
    expect(partialRes.label).toBe('Diterima Sebagian');
    expect(partialRes.color).toBe('gold');

    const partiallyReceivedRes = resolveStatusPresentation('gr', 'PARTIALLY_RECEIVED');
    expect(partiallyReceivedRes.label).toBe('Diterima Sebagian');
    expect(partiallyReceivedRes.color).toBe('gold');
  });

  // 3. PO ISSUED
  it('3. maps Purchase Order ISSUED to Diterbitkan', () => {
    const res = resolveStatusPresentation('po', 'ISSUED');
    expect(res.label).toBe('Diterbitkan');
    expect(res.color).toBe('blue');
  });

  // 4. Invoice UNPAID
  it('4. maps Invoice UNPAID to Belum Dibayar', () => {
    const res = resolveStatusPresentation('invoice', 'UNPAID');
    expect(res.label).toBe('Belum Dibayar');
  });

  // 5. Invoice PAID
  it('5. maps Invoice PAID to Lunas', () => {
    const res = resolveStatusPresentation('invoice', 'PAID');
    expect(res.label).toBe('Lunas');
    expect(res.color).toBe('success');
  });

  // 6. Payment PAID
  it('6. maps Payment PAID to Lunas', () => {
    const res = resolveStatusPresentation('payment', 'PAID');
    expect(res.label).toBe('Lunas');
    expect(res.color).toBe('success');
  });

  // 7. Project PLANNING
  it('7. maps Project PLANNING to Perencanaan', () => {
    const res = resolveStatusPresentation('project', 'PLANNING');
    expect(res.label).toBe('Perencanaan');
    expect(res.color).toBe('processing');
  });

  // 8. Project READY_FOR_KICKOFF
  it('8. maps Project READY_FOR_KICKOFF to Siap Kickoff', () => {
    const res = resolveStatusPresentation('project', 'READY_FOR_KICKOFF');
    expect(res.label).toBe('Siap Kickoff');
    expect(res.color).toBe('purple');
  });

  // 9. Unknown status safe fallback
  it('9. provides safe title-cased fallback and default color for unknown statuses', () => {
    const res = resolveStatusPresentation('project', 'SOME_UNUSUAL_CUSTOM_STATUS');
    expect(res.label).toBe('Some Unusual Custom Status');
    expect(res.color).toBe('default');

    const nullRes = resolveStatusPresentation('project', null);
    expect(nullRes.label).toBe('Belum Ada Status');
    expect(nullRes.color).toBe('default');
  });

  // 10. same raw status can be domain-specific
  it('10. demonstrates domain-specific mapping for identical raw strings (e.g. COMPLETED)', () => {
    const poCompleted = resolveStatusPresentation('po', 'COMPLETED');
    expect(poCompleted.label).toBe('Selesai Penuh');

    const grCompleted = resolveStatusPresentation('gr', 'COMPLETED');
    expect(grCompleted.label).toBe('Diterima Penuh');

    const projectCompleted = resolveStatusPresentation('project', 'COMPLETED');
    expect(projectCompleted.label).toBe('Selesai');
  });

  // 11. Finance Invoice List: Reconciliation Domain
  it('11. maps Finance reconciliation statuses (VERIFIED, MATCHED, MISMATCH, REJECTED)', () => {
    const verified = resolveStatusPresentation('reconciliation', 'VERIFIED');
    expect(verified.label).toBe('Terverifikasi');
    expect(verified.color).toBe('success');

    const matched = resolveStatusPresentation('reconciliation', 'MATCHED');
    expect(matched.label).toBe('Cocok (3-Way Match)');
    expect(matched.color).toBe('processing');

    const mismatch = resolveStatusPresentation('reconciliation', 'MISMATCH');
    expect(mismatch.label).toBe('Tidak Cocok');
    expect(mismatch.color).toBe('error');

    const rejected = resolveStatusPresentation('reconciliation', 'REJECTED');
    expect(rejected.label).toBe('Verifikasi Ditolak');
    expect(rejected.color).toBe('error');
  });

  // 12. Finance Invoice List: Payment Domain
  it('12. maps Finance payment statuses (UNPAID, PAID, PARTIAL)', () => {
    const unpaid = resolveStatusPresentation('payment', 'UNPAID');
    expect(unpaid.label).toBe('Belum Dibayar');
    expect(unpaid.color).toBe('orange');

    const paid = resolveStatusPresentation('payment', 'PAID');
    expect(paid.label).toBe('Lunas');
    expect(paid.color).toBe('success');

    const partial = resolveStatusPresentation('payment', 'PARTIALLY_PAID');
    expect(partial.label).toBe('Dibayar Sebagian');
    expect(partial.color).toBe('processing');
  });

  // 13. Governance Contracts: Legal and Contract Domain (APPROVED, REJECTED, ON_REVIEW)
  it('13. maps Governance Contracts legal and contract statuses', () => {
    const legalApproved = resolveStatusPresentation('legal', 'APPROVED');
    expect(legalApproved.label).toBe('Disetujui');
    expect(legalApproved.color).toBe('success');

    const legalRejected = resolveStatusPresentation('legal', 'REJECTED');
    expect(legalRejected.label).toBe('Ditolak');
    expect(legalRejected.color).toBe('error');

    const legalOnReview = resolveStatusPresentation('legal', 'ON_REVIEW');
    expect(legalOnReview.label).toBe('Sedang Ditelaah');
    expect(legalOnReview.color).toBe('processing');

    const contractApproved = resolveStatusPresentation('contract', 'APPROVED');
    expect(contractApproved.label).toBe('Disetujui');
    expect(contractApproved.color).toBe('success');

    const contractRejected = resolveStatusPresentation('contract', 'REJECTED');
    expect(contractRejected.label).toBe('Ditolak');
    expect(contractRejected.color).toBe('error');
  });
});
