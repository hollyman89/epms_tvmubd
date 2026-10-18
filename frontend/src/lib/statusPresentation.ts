/**
 * Canonical Status & Enum Presentation Resolver (UIUX-ROOT-04)
 *
 * Domain-aware status presentation mapping raw backend enums to
 * canonical Indonesian business labels and semantic color tags.
 * Preserves exact raw values in data layer while providing consistent UI presentation.
 */

export type StatusDomain =
  | 'tender'
  | 'legal'
  | 'contract'
  | 'project'
  | 'management_review'
  | 'pr'
  | 'rfq'
  | 'quotation'
  | 'po'
  | 'gr'
  | 'invoice'
  | 'payment'
  | 'package'
  | 'workflow'
  | 'inbox'
  | 'reconciliation'
  | 'service_claim'
  | 'project_closure';

export type SemanticColor =
  | 'success'
  | 'processing'
  | 'warning'
  | 'error'
  | 'default'
  | 'purple'
  | 'gold'
  | 'cyan'
  | 'blue'
  | 'volcano'
  | 'green'
  | 'orange';

export interface StatusPresentation {
  label: string;
  color: SemanticColor;
  rawStatus: string;
  domain: StatusDomain;
}

interface DomainStatusDefinition {
  label: string;
  color: SemanticColor;
}

const DOMAIN_STATUS_MAP: Record<StatusDomain, Record<string, DomainStatusDefinition>> = {
  // 1. TENDER (Sales / Marketing)
  tender: {
    DRAFT: { label: 'Draf', color: 'default' },
    SUBMITTED: { label: 'Diajukan', color: 'processing' },
    UNDER_REVIEW: { label: 'Sedang Ditinjau', color: 'processing' },
    PENDING_APPROVAL: { label: 'Menunggu Persetujuan', color: 'warning' },
    WAITING_GO_NO_GO: { label: 'Menunggu Go/No-Go', color: 'warning' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    WON: { label: 'Menang (Won)', color: 'success' },
    LOST: { label: 'Kalah (Lost)', color: 'error' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
    OVERDUE: { label: 'Lewat Jatuh Tempo', color: 'error' },
    UPCOMING_DEADLINE: { label: 'Mendekati Deadline', color: 'warning' },
    STUCK: { label: 'Tertunda (Stuck)', color: 'default' },
  },

  // 2. LEGAL / CONTRACT
  legal: {
    DRAFT: { label: 'Draf', color: 'default' },
    WAITING: { label: 'Menunggu', color: 'processing' },
    MENUNGGU_REVIEW: { label: 'Menunggu Review', color: 'warning' },
    PENDING_REVIEW: { label: 'Menunggu Review', color: 'warning' },
    UNDER_REVIEW: { label: 'Sedang Direview', color: 'processing' },
    ON_REVIEW: { label: 'Sedang Ditelaah', color: 'processing' },
    REVISION: { label: 'Revisi', color: 'warning' },
    REVISION_NEEDED: { label: 'Perlu Revisi', color: 'error' },
    REVISION_REQUESTED: { label: 'Diminta Revisi', color: 'error' },
    VERIFIED: { label: 'Terverifikasi', color: 'success' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    ACTIVE: { label: 'Aktif', color: 'success' },
    EXPIRED: { label: 'Kedaluwarsa', color: 'default' },
    TERMINATED: { label: 'Dihentikan', color: 'error' },
    PM_RETURNED: { label: 'Dikembalikan ke PM', color: 'error' },
  },

  contract: {
    DRAFT: { label: 'Draf', color: 'default' },
    UNDER_REVIEW: { label: 'Sedang Direview', color: 'processing' },
    ON_REVIEW: { label: 'Sedang Ditinjau', color: 'processing' },
    VERIFIED: { label: 'Terverifikasi', color: 'success' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    ACTIVE: { label: 'Aktif', color: 'success' },
    EXPIRED: { label: 'Kedaluwarsa', color: 'default' },
    TERMINATED: { label: 'Dihentikan', color: 'error' },
    PM_RETURNED: { label: 'Dikembalikan ke PM', color: 'error' },
  },

  // 3. PROJECT (Charter / Handover / Operational Plan)
  project: {
    DRAFT: { label: 'Draf', color: 'default' },
    PLANNING: { label: 'Perencanaan', color: 'processing' },
    READY_FOR_KICKOFF: { label: 'Siap Kickoff', color: 'purple' },
    APPROVED_READY_FOR_KICKOFF: { label: 'Disetujui (Siap Kickoff)', color: 'purple' },
    IN_PROGRESS: { label: 'Sedang Berjalan', color: 'processing' },
    ACTIVE: { label: 'Aktif', color: 'success' },
    ON_HOLD: { label: 'Ditunda', color: 'warning' },
    COMPLETED: { label: 'Selesai', color: 'success' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
    BLOCKED: { label: 'Terkendala', color: 'error' },
    NEEDS_REVISION: { label: 'Perlu Revisi', color: 'error' },
    REVIEW_HOPS: { label: 'Review Head of Ops', color: 'processing' },
    REVIEW_PMO: { label: 'Review PMO', color: 'processing' },
    REVIEW_DIRECTOR: { label: 'Review Direktur', color: 'processing' },
  },

  // 4. MANAGEMENT REVIEW
  management_review: {
    PENDING: { label: 'Menunggu Review', color: 'warning' },
    UNDER_REVIEW: { label: 'Sedang Ditinjau', color: 'processing' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REVISION_REQUESTED: { label: 'Perlu Revisi', color: 'error' },
    REJECTED: { label: 'Ditolak', color: 'error' },
  },

  // 5. PURCHASE REQUEST (PR)
  pr: {
    DRAFT: { label: 'Draf', color: 'default' },
    SUBMITTED: { label: 'Diajukan', color: 'processing' },
    PENDING_APPROVAL: { label: 'Menunggu Persetujuan', color: 'warning' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
    PO_CREATED: { label: 'PO Diterbitkan', color: 'success' },
  },

  // 6. REQUEST FOR QUOTATION (RFQ)
  rfq: {
    DRAFT: { label: 'Draf', color: 'default' },
    ISSUED: { label: 'Diterbitkan', color: 'processing' },
    CLOSED: { label: 'Ditutup', color: 'success' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
  },

  // 7. VENDOR QUOTATION
  quotation: {
    SUBMITTED: { label: 'Diajukan', color: 'processing' },
    UNDER_REVIEW: { label: 'Sedang Ditinjau', color: 'warning' },
    ACCEPTED: { label: 'Diterima', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
  },

  // 8. PURCHASE ORDER (PO)
  po: {
    DRAFT: { label: 'Draf', color: 'default' },
    ISSUED: { label: 'Diterbitkan', color: 'blue' },
    PARTIALLY_FULFILLED: { label: 'Diterima Sebagian', color: 'gold' },
    COMPLETED: { label: 'Selesai Penuh', color: 'success' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
  },

  // 9. GOODS RECEIPT (GR)
  gr: {
    DRAFT: { label: 'Draf', color: 'default' },
    PARTIAL: { label: 'Diterima Sebagian', color: 'gold' },
    PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'gold' },
    COMPLETED: { label: 'Diterima Penuh', color: 'success' },
    FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'success' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
  },

  // 10. INVOICE
  invoice: {
    DRAFT: { label: 'Draf', color: 'default' },
    SUBMITTED: { label: 'Diajukan', color: 'processing' },
    INVOICE_SUBMITTED: { label: 'Diajukan', color: 'processing' },
    UNPAID: { label: 'Belum Dibayar', color: 'orange' },
    MATCHED: { label: 'Cocok (3-Way Match)', color: 'success' },
    MISMATCHED: { label: 'Tidak Cocok', color: 'error' },
    VERIFIED: { label: 'Terverifikasi', color: 'cyan' },
    PARTIALLY_PAID: { label: 'Dibayar Sebagian', color: 'processing' },
    PAID: { label: 'Lunas', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
  },

  // 11. PAYMENT
  payment: {
    UNPAID: { label: 'Belum Dibayar', color: 'orange' },
    PENDING: { label: 'Menunggu Pembayaran', color: 'warning' },
    PROCESSING: { label: 'Sedang Diproses', color: 'processing' },
    PARTIAL: { label: 'Dibayar Sebagian', color: 'processing' },
    PARTIALLY_PAID: { label: 'Dibayar Sebagian', color: 'processing' },
    PAID: { label: 'Lunas', color: 'success' },
    SUCCESS: { label: 'Berhasil', color: 'success' },
    FAILED: { label: 'Gagal', color: 'error' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
  },

  // 12. PROCUREMENT PACKAGE
  package: {
    DRAFT: { label: 'Draf', color: 'blue' },
    SUBMITTED: { label: 'Diajukan ke Pengadaan', color: 'gold' },
    PR_CREATED: { label: 'PR Dibuat', color: 'green' },
    RETURNED: { label: 'Dikembalikan ke PM', color: 'volcano' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
    CLOSED: { label: 'Ditutup', color: 'purple' },
  },

  // 13. WORKFLOW
  workflow: {
    PENDING: { label: 'Menunggu', color: 'warning' },
    IN_PROGRESS: { label: 'Sedang Berjalan', color: 'processing' },
    COMPLETED: { label: 'Selesai', color: 'success' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    RETURNED: { label: 'Dikembalikan', color: 'warning' },
    CANCELLED: { label: 'Dibatalkan', color: 'default' },
    CANCELED: { label: 'Dibatalkan', color: 'default' },
    OVERDUE: { label: 'Lewat Jatuh Tempo', color: 'error' },
    UPCOMING_DEADLINE: { label: 'Mendekati Deadline', color: 'warning' },
    STUCK: { label: 'Tertunda (Stuck)', color: 'default' },
    PENDING_DIRECTOR_APPROVAL: { label: 'Menunggu Persetujuan Direktur', color: 'warning' },
    PENDING_HOO_REVIEW: { label: 'Menunggu Review HOO', color: 'warning' },
    PENDING_APPROVAL: { label: 'Menunggu Persetujuan', color: 'warning' },
    APPROVED_FOR_PAYMENT: { label: 'Disetujui untuk Pembayaran', color: 'success' },
    PM_VERIFIED: { label: 'Terverifikasi PM', color: 'processing' },
    HOO_APPROVED: { label: 'Disetujui HOO', color: 'processing' },
    DIRECTOR_APPROVED: { label: 'Disetujui Direktur', color: 'success' },
    APPROVED_FOR_INVOICE: { label: 'Disetujui untuk Invoice', color: 'success' },
    NEEDS_REVISION: { label: 'Perlu Revisi', color: 'error' },
    WAITING_GO_NO_GO: { label: 'Menunggu Go/No-Go', color: 'warning' },
    SUBMITTED: { label: 'Diajukan', color: 'processing' },
  },

  // 14. INBOX
  inbox: {
    PENDING: { label: 'Menunggu Tindakan', color: 'warning' },
    ACTIONED: { label: 'Telah Ditindak', color: 'success' },
    COMPLETED: { label: 'Selesai', color: 'success' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    RETURNED: { label: 'Dikembalikan', color: 'warning' },
    DISMISSED: { label: 'Dilewati', color: 'default' },
    PENDING_DIRECTOR_APPROVAL: { label: 'Menunggu Persetujuan Direktur', color: 'warning' },
    PENDING_HOO_REVIEW: { label: 'Menunggu Review HOO', color: 'warning' },
    APPROVED_FOR_PAYMENT: { label: 'Disetujui untuk Pembayaran', color: 'success' },
    PM_VERIFIED: { label: 'Terverifikasi PM', color: 'processing' },
    HOO_APPROVED: { label: 'Disetujui HOO', color: 'processing' },
    DIRECTOR_APPROVED: { label: 'Disetujui Direktur', color: 'success' },
    APPROVED_FOR_INVOICE: { label: 'Disetujui untuk Invoice', color: 'success' },
    NEEDS_REVISION: { label: 'Perlu Revisi', color: 'error' },
    WAITING_GO_NO_GO: { label: 'Menunggu Go/No-Go', color: 'warning' },
    SUBMITTED: { label: 'Diajukan', color: 'processing' },
  },

  // 15. RECONCILIATION / 3-WAY MATCH
  reconciliation: {
    PENDING: { label: 'Menunggu Rekonsiliasi', color: 'warning' },
    MATCHED: { label: 'Cocok (3-Way Match)', color: 'processing' },
    VERIFIED: { label: 'Terverifikasi', color: 'success' },
    MISMATCH: { label: 'Tidak Cocok', color: 'error' },
    MISMATCHED: { label: 'Tidak Cocok', color: 'error' },
    REJECTED: { label: 'Verifikasi Ditolak', color: 'error' },
  },

  // 16. SERVICE CLAIM
  service_claim: {
    DRAFT: { label: 'Draf', color: 'default' },
    SUBMITTED: { label: 'Diajukan (Verifikasi PM)', color: 'warning' },
    PM_VERIFIED: { label: 'Terverifikasi PM (Review Pengadaan)', color: 'processing' },
    APPROVED_FOR_INVOICE: { label: 'Disetujui untuk Invoice', color: 'success' },
    APPROVED: { label: 'Disetujui', color: 'success' },
    NEEDS_REVISION: { label: 'Perlu Revisi', color: 'error' },
    REJECTED: { label: 'Ditolak', color: 'error' },
  },

  // 17. PROJECT CLOSURE
  project_closure: {
    DRAFT: { label: 'Draf', color: 'default' },
    PENDING_HOO_REVIEW: { label: 'Menunggu Review HOO', color: 'warning' },
    PENDING_DIRECTOR_APPROVAL: { label: 'Menunggu Persetujuan Direktur', color: 'warning' },
    HOO_APPROVED: { label: 'Disetujui HOO', color: 'processing' },
    DIRECTOR_APPROVED: { label: 'Disetujui Direktur', color: 'success' },
    APPROVED: { label: 'Disetujui (Selesai)', color: 'success' },
    RETURNED: { label: 'Dikembalikan ke PM', color: 'error' },
    REJECTED: { label: 'Ditolak', color: 'error' },
    COMPLETED: { label: 'Proyek Ditutup', color: 'success' },
  },
};

/**
 * Resolves canonical presentation for a domain status.
 * Safe fallback for unknown or missing statuses.
 */
export function resolveStatusPresentation(
  domain: StatusDomain,
  status: string | null | undefined
): StatusPresentation {
  const normalizedRaw = (status || '').trim().toUpperCase();

  if (!normalizedRaw) {
    return {
      label: 'Belum Ada Status',
      color: 'default',
      rawStatus: '',
      domain,
    };
  }

  const domainMap = DOMAIN_STATUS_MAP[domain];
  if (domainMap && domainMap[normalizedRaw]) {
    const entry = domainMap[normalizedRaw];
    return {
      label: entry.label,
      color: entry.color,
      rawStatus: normalizedRaw,
      domain,
    };
  }

  // Cross-domain known definitions lookup before title-casing
  for (const otherDomain of Object.keys(DOMAIN_STATUS_MAP) as StatusDomain[]) {
    const candidate = DOMAIN_STATUS_MAP[otherDomain]?.[normalizedRaw];
    if (candidate) {
      return {
        label: candidate.label,
        color: candidate.color,
        rawStatus: normalizedRaw,
        domain,
      };
    }
  }

  // Fallback: title-case the raw status and return with 'default' semantic color
  const humanized = normalizedRaw
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');

  return {
    label: humanized,
    color: 'default',
    rawStatus: normalizedRaw,
    domain,
  };
}
