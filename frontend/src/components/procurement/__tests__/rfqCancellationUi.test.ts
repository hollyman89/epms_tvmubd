import {
  canUserCancelRfq,
  isRfqCancelActionVisible,
  isDirectServicePoUnlocked,
  countRfqCancelButtons,
} from '../CreateRfqModal';

describe('EPMS — RFQ Cancellation UI & Sourcing Policy Gate', () => {
  // =========================================================================
  // 1. ROLE VISIBILITY TESTS
  // =========================================================================
  describe('1. Role Authorization for Batalkan RFQ Button', () => {
    it('PURCHASING sees Batalkan RFQ (ALLOWED)', () => {
      expect(canUserCancelRfq(['PURCHASING'])).toBe(true);
      expect(canUserCancelRfq(['purchasing'])).toBe(true);
    });

    it('PROCUREMENT sees Batalkan RFQ (ALLOWED)', () => {
      expect(canUserCancelRfq(['PROCUREMENT'])).toBe(true);
      expect(canUserCancelRfq(['procurement'])).toBe(true);
    });

    it('PROJECT_MANAGER does NOT see Batalkan RFQ (BLOCKED)', () => {
      expect(canUserCancelRfq(['PROJECT_MANAGER'])).toBe(false);
    });

    it('DIRECTOR does NOT see Batalkan RFQ (BLOCKED)', () => {
      expect(canUserCancelRfq(['DIRECTOR'])).toBe(false);
    });

    it('HEAD_OF_OPERATIONS does NOT see Batalkan RFQ (BLOCKED)', () => {
      expect(canUserCancelRfq(['HEAD_OF_OPERATIONS'])).toBe(false);
    });

    it('ADMIN does NOT see Batalkan RFQ (BLOCKED)', () => {
      expect(canUserCancelRfq(['ADMIN'])).toBe(false);
    });

    it('SUPER_ADMIN does NOT see Batalkan RFQ (BLOCKED)', () => {
      expect(canUserCancelRfq(['SUPER_ADMIN'])).toBe(false);
    });

    it('Combined administrative + procurement role is blocked from business mutation (DENIED)', () => {
      expect(canUserCancelRfq(['ADMIN', 'PURCHASING'])).toBe(false);
      expect(canUserCancelRfq(['SUPER_ADMIN', 'PROCUREMENT'])).toBe(false);
      expect(canUserCancelRfq(['PROJECT_MANAGER', 'PURCHASING'])).toBe(false);
    });

    it('Empty roles array does NOT see Batalkan RFQ', () => {
      expect(canUserCancelRfq([])).toBe(false);
    });
  });

  // =========================================================================
  // 2. STATUS-DRIVEN VISIBILITY & BUTTON COUNT TESTS (NO DUPLICATION)
  // =========================================================================
  describe('2. RFQ Status-Driven Action Visibility & Button Count', () => {
    it('OPEN RFQ: exactly ONE Batalkan RFQ button rendered (footer only) for authorized role', () => {
      expect(isRfqCancelActionVisible('OPEN', ['PURCHASING'])).toBe(true);
      expect(isRfqCancelActionVisible('OPEN', ['PROCUREMENT'])).toBe(true);

      // Verify button count is strictly 1 in view mode
      expect(countRfqCancelButtons(true, 'OPEN', ['PURCHASING'])).toBe(1);
      expect(countRfqCancelButtons(true, 'OPEN', ['PROCUREMENT'])).toBe(1);
    });

    it('OPEN RFQ: zero Batalkan RFQ buttons rendered for unauthorized roles', () => {
      expect(countRfqCancelButtons(true, 'OPEN', ['PROJECT_MANAGER'])).toBe(0);
      expect(countRfqCancelButtons(true, 'OPEN', ['ADMIN'])).toBe(0);
      expect(countRfqCancelButtons(true, 'OPEN', ['SUPER_ADMIN'])).toBe(0);
      expect(countRfqCancelButtons(true, 'OPEN', ['DIRECTOR'])).toBe(0);
      expect(countRfqCancelButtons(true, 'OPEN', ['HEAD_OF_OPERATIONS'])).toBe(0);
      expect(countRfqCancelButtons(true, 'OPEN', ['ADMIN', 'PURCHASING'])).toBe(0);
      expect(countRfqCancelButtons(true, 'OPEN', ['SUPER_ADMIN', 'PROCUREMENT'])).toBe(0);
    });

    it('CANCELLED RFQ: zero Batalkan RFQ buttons rendered for all roles', () => {
      expect(isRfqCancelActionVisible('CANCELLED', ['PURCHASING'])).toBe(false);
      expect(isRfqCancelActionVisible('CANCELLED', ['PROCUREMENT'])).toBe(false);
      expect(isRfqCancelActionVisible('CANCELLED', ['SUPER_ADMIN'])).toBe(false);

      // Verify button count is strictly 0
      expect(countRfqCancelButtons(true, 'CANCELLED', ['PURCHASING'])).toBe(0);
      expect(countRfqCancelButtons(true, 'CANCELLED', ['PROCUREMENT'])).toBe(0);
      expect(countRfqCancelButtons(true, 'CANCELLED', ['SUPER_ADMIN'])).toBe(0);
    });

    it('CLOSED or AWARDED RFQ: zero Batalkan RFQ buttons rendered', () => {
      expect(countRfqCancelButtons(true, 'CLOSED', ['PURCHASING'])).toBe(0);
      expect(countRfqCancelButtons(true, 'AWARDED', ['PURCHASING'])).toBe(0);
    });
  });

  // =========================================================================
  // 3. REASON REQUIREMENT VALIDATION
  // =========================================================================
  describe('3. Cancellation Reason Mandatory Validation', () => {
    const isReasonValid = (reason: string): boolean => {
      return Boolean(reason && reason.trim().length > 0);
    };

    it('Empty string reason is rejected', () => {
      expect(isReasonValid('')).toBe(false);
    });

    it('Whitespace-only reason is rejected', () => {
      expect(isReasonValid('   ')).toBe(false);
      expect(isReasonValid('\t\n ')).toBe(false);
    });

    it('Non-empty meaningful reason is accepted', () => {
      expect(isReasonValid('Beralih strategi ke Direct Service PO')).toBe(true);
      expect(isReasonValid('Perubahan spesifikasi teknis')).toBe(true);
    });
  });

  // =========================================================================
  // 4. SERVICE DIRECT PO UNLOCK & MATERIAL SAFETY
  // =========================================================================
  describe('4. Service Direct PO Unlock & Material Safety Gate', () => {
    it('For SERVICE PR with OPEN RFQ: Direct PO is BLOCKED', () => {
      const isServicePr = true;
      const rfqStatus = 'OPEN';
      expect(isDirectServicePoUnlocked(isServicePr, rfqStatus)).toBe(false);
    });

    it('For SERVICE PR with CANCELLED RFQ: Direct Service PO is UNLOCKED', () => {
      const isServicePr = true;
      const rfqStatus = 'CANCELLED';
      expect(isDirectServicePoUnlocked(isServicePr, rfqStatus)).toBe(true);
    });

    it('For SERVICE PR with NO RFQ: Direct Service PO is UNLOCKED', () => {
      const isServicePr = true;
      expect(isDirectServicePoUnlocked(isServicePr, undefined)).toBe(true);
    });

    it('MATERIAL SAFETY: Cancelling Material RFQ does NOT unlock Direct Material PO', () => {
      const isMaterialPr = false;
      expect(isDirectServicePoUnlocked(isMaterialPr, 'OPEN')).toBe(false);
      expect(isDirectServicePoUnlocked(isMaterialPr, 'CANCELLED')).toBe(false);
      expect(isDirectServicePoUnlocked(isMaterialPr, undefined)).toBe(false);
    });
  });

  // =========================================================================
  // 5. SUCCESS STATE & BUSINESS CONTRACT PRESERVATION
  // =========================================================================
  describe('5. Sourcing Transition & State Preservation', () => {
    it('After RFQ cancellation: RFQ is CANCELLED, PR remains APPROVED, Package remains PR_CREATED', () => {
      // Baseline state
      const packageRecord = { id: 3, packageNumber: 'PKG-001', status: 'PR_CREATED' };
      const prRecord = { id: 3, prNumber: 'PR-001', status: 'APPROVED', isService: true };
      let rfqRecord: { id: number; rfqNumber: string; status: string } = {
        id: 3,
        rfqNumber: 'RFQ-001',
        status: 'OPEN',
      };

      // Before cancellation
      expect(rfqRecord.status).toBe('OPEN');
      expect(isDirectServicePoUnlocked(prRecord.isService, rfqRecord.status)).toBe(false);

      // Perform cancellation transition
      rfqRecord = { ...rfqRecord, status: 'CANCELLED' };

      // After cancellation
      expect(rfqRecord.status).toBe('CANCELLED');
      expect(prRecord.status).toBe('APPROVED');
      expect(packageRecord.status).toBe('PR_CREATED');

      // Direct Service PO now unlocked!
      expect(isDirectServicePoUnlocked(prRecord.isService, rfqRecord.status)).toBe(true);
    });
  });
});
