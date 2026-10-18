/**
 * Canonical Action State & Gating for Finance Payment Requests
 */

export type PaymentRequestUiActionType =
  | 'SUBMIT_NEW'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'NEEDS_REVISION'
  | 'APPROVED_FOR_PAYMENT'
  | 'PAID'
  | 'CANNOT_SUBMIT';

export interface PaymentRequestUiState {
  actionType: PaymentRequestUiActionType;
  canSubmitNew: boolean;
  canResubmit: boolean;
  canPay: boolean;
  statusLabel?: string;
  tooltipMessage?: string;
  activeRequest?: any;
}

export function isEligibleForPaymentRequest(
  invoice: {
    paymentStatus?: string;
    matchStatus?: string;
  },
  activeRequest?: { status?: string } | null
): boolean {
  const isPaid = invoice.paymentStatus === 'PAID';
  const isMatchVerified =
    invoice.matchStatus === 'VERIFIED' || invoice.matchStatus === 'MATCHED';

  if (isPaid || !isMatchVerified) {
    return false;
  }

  // Active requests block new submission
  if (
    activeRequest &&
    ['PENDING_DIRECTOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED_FOR_PAYMENT'].includes(
      activeRequest.status || ''
    )
  ) {
    return false;
  }

  return true;
}

export function getPaymentRequestActionState(
  invoice: {
    id?: number | string;
    paymentStatus?: string;
    matchStatus?: string;
    orderType?: string;
    purchaseOrder?: any;
    serviceClaimId?: any;
  },
  activeRequest?: {
    id?: number | string;
    status?: string;
    requestNumber?: string;
    revisionNotes?: string;
  } | null
): PaymentRequestUiState {
  const isPaid = invoice.paymentStatus === 'PAID';
  if (isPaid) {
    return {
      actionType: 'PAID',
      canSubmitNew: false,
      canResubmit: false,
      canPay: false,
      statusLabel: 'Lunas (PAID)',
    };
  }

  // Active requests check
  if (activeRequest) {
    if (activeRequest.status === 'PENDING_DIRECTOR_APPROVAL') {
      return {
        actionType: 'PENDING_DIRECTOR_APPROVAL',
        canSubmitNew: false,
        canResubmit: false,
        canPay: false,
        statusLabel: 'Menunggu Persetujuan Direktur',
        activeRequest,
      };
    }

    if (activeRequest.status === 'NEEDS_REVISION') {
      return {
        actionType: 'NEEDS_REVISION',
        canSubmitNew: false,
        canResubmit: true,
        canPay: false,
        statusLabel: 'Perlu Revisi',
        activeRequest,
      };
    }

    if (activeRequest.status === 'APPROVED_FOR_PAYMENT') {
      return {
        actionType: 'APPROVED_FOR_PAYMENT',
        canSubmitNew: false,
        canResubmit: false,
        canPay: true,
        statusLabel: 'Disetujui Pembayaran',
        activeRequest,
      };
    }

    // Canonical retry rule: If REJECTED, Finance is allowed to create a new submission
    if (activeRequest.status === 'REJECTED') {
      const isMatchVerified =
        invoice.matchStatus === 'VERIFIED' || invoice.matchStatus === 'MATCHED';
      return {
        actionType: isMatchVerified ? 'SUBMIT_NEW' : 'CANNOT_SUBMIT',
        canSubmitNew: isMatchVerified,
        canResubmit: false,
        canPay: false,
        statusLabel: 'Ditolak (Dapat Diajukan Ulang)',
        tooltipMessage: !isMatchVerified
          ? `Invoice belum lolos verifikasi 3-way match (${invoice.matchStatus || 'PENDING'}).`
          : undefined,
        activeRequest,
      };
    }
  }

  // No active request: check match verification
  const isMatchVerified =
    invoice.matchStatus === 'VERIFIED' || invoice.matchStatus === 'MATCHED';
  if (!isMatchVerified) {
    const isService =
      (invoice.purchaseOrder as any)?.orderType === 'SERVICE' ||
      invoice.orderType === 'SERVICE' ||
      Boolean(invoice.serviceClaimId);
    const tooltipMessage = isService
      ? 'Invoice belum lolos Rekonsiliasi Jasa. Lakukan verifikasi invoice terhadap Service Claim yang telah disetujui sebelum mengajukan persetujuan.'
      : `Invoice belum lolos verifikasi 3-way match (${invoice.matchStatus || 'PENDING'}). Lakukan verifikasi faktur terlebih dahulu sebelum mengajukan persetujuan.`;

    return {
      actionType: 'CANNOT_SUBMIT',
      canSubmitNew: false,
      canResubmit: false,
      canPay: false,
      tooltipMessage,
    };
  }

  return {
    actionType: 'SUBMIT_NEW',
    canSubmitNew: true,
    canResubmit: false,
    canPay: false,
  };
}
