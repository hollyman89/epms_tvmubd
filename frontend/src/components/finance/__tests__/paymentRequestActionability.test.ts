/**
 * EPMS — PAYMENT REQUEST FRONTEND ACTION STATE REGRESSION
 * Tests canonical actionability, state gating, and instant transition behavior.
 */

import {
  isEligibleForPaymentRequest,
  getPaymentRequestActionState,
  PaymentRequestUiActionType,
} from '../paymentRequestActionability';

describe('Payment Request Actionability & State Gating', () => {
  describe('isEligibleForPaymentRequest', () => {
    it('MUST BLOCK when invoice is UNPAID but matchStatus is PENDING', () => {
      expect(
        isEligibleForPaymentRequest({ paymentStatus: 'UNPAID', matchStatus: 'PENDING' })
      ).toBe(false);
    });

    it('MUST BLOCK when invoice is UNPAID but matchStatus is MISMATCHED', () => {
      expect(
        isEligibleForPaymentRequest({ paymentStatus: 'UNPAID', matchStatus: 'MISMATCHED' })
      ).toBe(false);
    });

    it('MUST BLOCK when invoice is UNPAID but matchStatus is REJECTED', () => {
      expect(
        isEligibleForPaymentRequest({ paymentStatus: 'UNPAID', matchStatus: 'REJECTED' })
      ).toBe(false);
    });

    it('MUST BLOCK when invoice is already PAID', () => {
      expect(
        isEligibleForPaymentRequest({ paymentStatus: 'PAID', matchStatus: 'VERIFIED' })
      ).toBe(false);
    });

    it('MUST ALLOW when invoice is UNPAID and matchStatus is VERIFIED with no active request', () => {
      expect(
        isEligibleForPaymentRequest({ paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' })
      ).toBe(true);
    });

    it('MUST ALLOW when invoice is UNPAID and matchStatus is MATCHED with no active request', () => {
      expect(
        isEligibleForPaymentRequest({ paymentStatus: 'UNPAID', matchStatus: 'MATCHED' })
      ).toBe(true);
    });

    it('MUST BLOCK when active request is PENDING_DIRECTOR_APPROVAL', () => {
      expect(
        isEligibleForPaymentRequest(
          { paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
          { status: 'PENDING_DIRECTOR_APPROVAL' }
        )
      ).toBe(false);
    });

    it('MUST BLOCK when active request is NEEDS_REVISION', () => {
      expect(
        isEligibleForPaymentRequest(
          { paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
          { status: 'NEEDS_REVISION' }
        )
      ).toBe(false);
    });

    it('MUST BLOCK when active request is APPROVED_FOR_PAYMENT', () => {
      expect(
        isEligibleForPaymentRequest(
          { paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
          { status: 'APPROVED_FOR_PAYMENT' }
        )
      ).toBe(false);
    });

    it('MUST ALLOW when active request is REJECTED (canonical retry rule)', () => {
      expect(
        isEligibleForPaymentRequest(
          { paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
          { status: 'REJECTED' }
        )
      ).toBe(true);
    });
  });

  describe('getPaymentRequestActionState', () => {
    it('MUST return SUBMIT_NEW enabled when no request exists and invoice is verified', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
        null
      );
      expect(state.actionType).toBe('SUBMIT_NEW');
      expect(state.canSubmitNew).toBe(true);
      expect(state.canResubmit).toBe(false);
      expect(state.canPay).toBe(false);
    });

    it('MUST return CANNOT_SUBMIT when no request exists but invoice is not verified', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'UNPAID', matchStatus: 'PENDING' },
        null
      );
      expect(state.actionType).toBe('CANNOT_SUBMIT');
      expect(state.canSubmitNew).toBe(false);
      expect(state.tooltipMessage).toContain('belum lolos verifikasi 3-way match');
    });

    it('MUST return PENDING_DIRECTOR_APPROVAL and disable new submission when request is pending approval', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
        { id: 1, status: 'PENDING_DIRECTOR_APPROVAL', requestNumber: 'PRQ-20261016-001' }
      );
      expect(state.actionType).toBe('PENDING_DIRECTOR_APPROVAL');
      expect(state.canSubmitNew).toBe(false);
      expect(state.canResubmit).toBe(false);
      expect(state.canPay).toBe(false);
      expect(state.statusLabel).toBe('Menunggu Persetujuan Direktur');
    });

    it('MUST return NEEDS_REVISION and enable resubmit action (not new submit) when revision requested', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
        { id: 1, status: 'NEEDS_REVISION', requestNumber: 'PRQ-20261016-001', revisionNotes: 'Check tax' }
      );
      expect(state.actionType).toBe('NEEDS_REVISION');
      expect(state.canSubmitNew).toBe(false);
      expect(state.canResubmit).toBe(true);
      expect(state.canPay).toBe(false);
      expect(state.statusLabel).toBe('Perlu Revisi');
    });

    it('MUST return APPROVED_FOR_PAYMENT and enable pay action (no new submit) when approved', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
        { id: 1, status: 'APPROVED_FOR_PAYMENT', requestNumber: 'PRQ-20261016-001' }
      );
      expect(state.actionType).toBe('APPROVED_FOR_PAYMENT');
      expect(state.canSubmitNew).toBe(false);
      expect(state.canResubmit).toBe(false);
      expect(state.canPay).toBe(true);
      expect(state.statusLabel).toBe('Disetujui Pembayaran');
    });

    it('MUST return SUBMIT_NEW when previous request was REJECTED following canonical retry rule', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' },
        { id: 1, status: 'REJECTED', requestNumber: 'PRQ-20261016-001' }
      );
      expect(state.actionType).toBe('SUBMIT_NEW');
      expect(state.canSubmitNew).toBe(true);
      expect(state.canResubmit).toBe(false);
      expect(state.canPay).toBe(false);
    });

    it('MUST return PAID when invoice paymentStatus is PAID', () => {
      const state = getPaymentRequestActionState(
        { id: 1, paymentStatus: 'PAID', matchStatus: 'VERIFIED' },
        { id: 1, status: 'PAID', requestNumber: 'PRQ-20261016-001' }
      );
      expect(state.actionType).toBe('PAID');
      expect(state.canSubmitNew).toBe(false);
      expect(state.canResubmit).toBe(false);
      expect(state.canPay).toBe(false);
    });
  });

  describe('Immediate State Transition on Submission', () => {
    it('simulates row state transitioning from SUBMIT_NEW to PENDING_DIRECTOR_APPROVAL immediately upon cache update', () => {
      const invoice = { id: 1, paymentStatus: 'UNPAID', matchStatus: 'VERIFIED' };

      // Initial state before submit:
      let activeRequest: any = null;
      let currentState = getPaymentRequestActionState(invoice, activeRequest);
      expect(currentState.actionType).toBe('SUBMIT_NEW');
      expect(currentState.canSubmitNew).toBe(true);

      // Simulated submit handler response:
      const submittedPrq = {
        id: 1,
        requestNumber: 'PRQ-20261016-001',
        invoiceId: 1,
        status: 'PENDING_DIRECTOR_APPROVAL',
      };

      // Query cache update:
      activeRequest = submittedPrq;
      currentState = getPaymentRequestActionState(invoice, activeRequest);

      // Verified immediate transition without page reload:
      expect(currentState.actionType).toBe('PENDING_DIRECTOR_APPROVAL');
      expect(currentState.canSubmitNew).toBe(false);
      expect(currentState.statusLabel).toBe('Menunggu Persetujuan Direktur');
    });
  });
});
