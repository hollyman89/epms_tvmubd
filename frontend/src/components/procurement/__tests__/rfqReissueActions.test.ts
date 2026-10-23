import {
  resolvePrRfqAction,
  resolveCreateRfqModalMode,
} from '../CreateRfqModal';
import { formatContextualCta } from '@/lib/inboxPresentation';

describe('EPMS — RFQ Reissue Actions & Modal Mode Gate (Audit & Fix)', () => {
  // =========================================================================
  // 1. TABLE & WORKFLOW CTA RESOLUTION TESTS
  // =========================================================================
  describe('1. resolvePrRfqAction - Table & Detail Action Mapping', () => {
    const approvedPr = { id: 13, prNumber: 'PR-20261023-003', status: 'APPROVED' };

    it('PR + no RFQ -> Buat RFQ', () => {
      const action = resolvePrRfqAction(approvedPr, undefined, undefined, null, true);
      expect(action).toBe('Buat RFQ');
    });

    it('PR + OPEN RFQ -> Kelola RFQ', () => {
      const openRfq = { id: 20, rfqNumber: 'RFQ-20261023-001', status: 'OPEN' };
      const action = resolvePrRfqAction(approvedPr, openRfq, openRfq, null, true);
      expect(action).toBe('Kelola RFQ');
    });

    it('PR + EVALUATED RFQ -> Kelola RFQ', () => {
      const evaluatedRfq = { id: 21, rfqNumber: 'RFQ-20261023-002', status: 'EVALUATED' };
      const action = resolvePrRfqAction(approvedPr, evaluatedRfq, evaluatedRfq, null, true);
      expect(action).toBe('Kelola RFQ');
    });

    it('PR + CLOSED RFQ -> Kelola RFQ', () => {
      const closedRfq = { id: 22, rfqNumber: 'RFQ-20261023-003', status: 'CLOSED' };
      const action = resolvePrRfqAction(approvedPr, closedRfq, closedRfq, null, true);
      expect(action).toBe('Kelola RFQ');
    });

    it('PR + CANCELLED RFQ (no active RFQ) -> Buat RFQ Baru', () => {
      const cancelledRfq = { id: 8, rfqNumber: 'RFQ-20261023-003', status: 'CANCELLED' };
      // activeRfq is undefined (because no active exists), latestRfq is the cancelled RFQ
      const action = resolvePrRfqAction(approvedPr, undefined, cancelledRfq, null, true);
      expect(action).toBe('Buat RFQ Baru');
    });

    it('PR + one CANCELLED RFQ + one new OPEN RFQ -> Kelola RFQ', () => {
      const newOpenRfq = { id: 25, rfqNumber: 'RFQ-20261023-004', status: 'OPEN' };
      const action = resolvePrRfqAction(approvedPr, newOpenRfq, newOpenRfq, null, true);
      expect(action).toBe('Kelola RFQ');
    });

    it('PR + Purchase Order issued -> Lihat PO', () => {
      const mockPo = { id: 1, poNumber: 'PO-20261023-001', status: 'ISSUED' };
      const action = resolvePrRfqAction(approvedPr, undefined, undefined, mockPo, true);
      expect(action).toBe('Lihat PO');
    });

    it('Non-approved PR -> Alur Approval', () => {
      const submittedPr = { id: 14, prNumber: 'PR-20261023-004', status: 'SUBMITTED' };
      const action = resolvePrRfqAction(submittedPr, undefined, undefined, null, true);
      expect(action).toBe('Alur Approval');
    });
  });

  // =========================================================================
  // 2. CREATE RFQ MODAL MODE RESOLUTION
  // =========================================================================
  describe('2. resolveCreateRfqModalMode - Reissue vs Manage Mode', () => {
    it('No RFQ: isViewMode = false, isReissueMode = false', () => {
      const mode = resolveCreateRfqModalMode(false, null);
      expect(mode.isViewMode).toBe(false);
      expect(mode.hasActiveNonCancelledRfq).toBe(false);
      expect(mode.hasCancelledRfq).toBe(false);
      expect(mode.isReissueMode).toBe(false);
    });

    it('Active OPEN RFQ: isViewMode = true, isReissueMode = false', () => {
      const openRfq = { id: 20, rfqNumber: 'RFQ-20261023-001', status: 'OPEN' };
      const mode = resolveCreateRfqModalMode(false, openRfq);
      expect(mode.isViewMode).toBe(true);
      expect(mode.hasActiveNonCancelledRfq).toBe(true);
      expect(mode.hasCancelledRfq).toBe(false);
      expect(mode.isReissueMode).toBe(false);
    });

    it('Active EVALUATED RFQ: isViewMode = true, isReissueMode = false', () => {
      const evaluatedRfq = { id: 21, rfqNumber: 'RFQ-20261023-002', status: 'EVALUATED' };
      const mode = resolveCreateRfqModalMode(false, evaluatedRfq);
      expect(mode.isViewMode).toBe(true);
      expect(mode.hasActiveNonCancelledRfq).toBe(true);
      expect(mode.hasCancelledRfq).toBe(false);
      expect(mode.isReissueMode).toBe(false);
    });

    it('CANCELLED RFQ: isViewMode = false, hasCancelledRfq = true, isReissueMode = true (Creation form enabled!)', () => {
      const cancelledRfq = { id: 8, rfqNumber: 'RFQ-20261023-003', status: 'CANCELLED' };
      const mode = resolveCreateRfqModalMode(false, cancelledRfq);
      // Crucial: CANCELLED RFQ must NOT force isViewMode
      expect(mode.isViewMode).toBe(false);
      expect(mode.hasActiveNonCancelledRfq).toBe(false);
      expect(mode.hasCancelledRfq).toBe(true);
      expect(mode.isReissueMode).toBe(true);
    });

    it('Explicit viewOnly = true forces isViewMode even if RFQ is CANCELLED', () => {
      const cancelledRfq = { id: 8, rfqNumber: 'RFQ-20261023-003', status: 'CANCELLED' };
      const mode = resolveCreateRfqModalMode(true, cancelledRfq);
      expect(mode.isViewMode).toBe(true);
      expect(mode.hasCancelledRfq).toBe(true);
      expect(mode.isReissueMode).toBe(false);
    });
  });

  // =========================================================================
  // 3. INBOX CTA PRESENTATION
  // =========================================================================
  describe('3. formatContextualCta - To-Do Action Mapping', () => {
    it('actionType === "CREATE_RFQ" maps to "Buat RFQ"', () => {
      const cta = formatContextualCta({
        actionType: 'CREATE_RFQ',
        entityType: 'PURCHASE_REQUEST',
        title: 'Buat RFQ: PR PR-20261023-003',
      });
      expect(cta).toBe('Buat RFQ');
    });

    it('title containing "BUAT RFQ" maps to "Buat RFQ"', () => {
      const cta = formatContextualCta({
        actionType: 'DOMAIN_TODO',
        entityType: 'PURCHASE_REQUEST',
        title: 'BUAT RFQ UNTUK PR-20261023-001',
      });
      expect(cta).toBe('Buat RFQ');
    });
  });
});
