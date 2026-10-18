/**
 * EPMS — PROJECT-CLOSE-R1-C5
 * Project Closure Presentation & Business Alignment Utilities
 *
 * Core Principles:
 * 1. Backend remains authoritative SSOT for readiness (NEVER calculate ready in frontend).
 * 2. Customer AR is strictly NOT MODELED ("Belum dimodelkan / N/A").
 * 3. Warnings (e.g. RETENTION_CLEARANCE_NOT_AUTHORITATIVE) do not block submission by themselves.
 * 4. Distinct labels: "Penyelesaian Operasional" (actual_finish_at) vs "Persetujuan Penutupan Formal" (closed_at).
 * 5. Role & Assignment Authority:
 *    - Only assigned PM of an IN_PROGRESS project can submit/resubmit.
 *    - HOO can only act at HOO step.
 *    - Director can only act at Director step.
 *    - ADMIN & SUPER_ADMIN have ZERO business closure action rights.
 */

import {
  ClosureReadinessResult,
  ProjectClosure,
  ProjectClosureStatus,
  ClosureBlocker,
  ClosureWarning,
} from '@/services/project.service';

export interface ClosureActionability {
  canSubmit: boolean;
  canResubmit: boolean;
  isActionable: boolean;
  disabledReason?: string;
  isAssignedPm: boolean;
  isProjectInProgress: boolean;
  hasActivePendingCycle: boolean;
}

export interface ClosureStageInfo {
  stageKey: ProjectClosureStatus | 'NONE';
  label: string;
  description: string;
  statusBadgeTone: 'default' | 'processing' | 'warning' | 'success' | 'error';
}

/**
 * Formats ISO date safely into Indonesian locale (DD MMMM YYYY, HH:mm).
 */
export function formatClosureDate(dateStr?: string | Date | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Resolves user-friendly domain labels for blockers and warnings.
 */
export function resolveDomainLabel(domain: string): string {
  switch (domain?.toUpperCase()) {
    case 'PHYSICAL':
    case 'PHYSICAL_EXECUTION':
      return 'Progress Fisik';
    case 'TASKS':
      return 'Tugas & WBS';
    case 'ISSUES':
      return 'Kendala (Issues)';
    case 'RISKS':
      return 'Risiko (Risks)';
    case 'PROCUREMENT':
    case 'MATERIAL_PROCUREMENT':
      return 'Pengadaan Material';
    case 'SERVICE_PROCUREMENT':
      return 'Pengadaan Jasa (Subkon)';
    case 'SERVICE_CLAIM':
    case 'SERVICE_CLAIMS':
      return 'Klaim Jasa Vendor';
    case 'VENDOR_AP':
      return 'Hutang Vendor (AP)';
    case 'DOCUMENTS':
      return 'Dokumen Persyaratan';
    case 'FINANCE':
      return 'Keuangan Proyek';
    default:
      return domain || 'Umum';
  }
}

/**
 * Resolves stage presentation for active / historical closure cycle.
 */
export function resolveClosureStageInfo(
  closure: ProjectClosure | null | undefined,
  projectStatus?: string,
): ClosureStageInfo {
  if (projectStatus === 'CLOSED') {
    return {
      stageKey: 'APPROVED',
      label: 'Proyek Resmi Ditutup (Project Closed)',
      description: 'Persetujuan penutupan akhir telah disetujui penuh oleh Direktur.',
      statusBadgeTone: 'success',
    };
  }

  if (!closure || !closure.status || !closure.id) {
    return {
      stageKey: 'NONE',
      label: 'Belum Diajukan',
      description: 'Project belum diajukan untuk Closure.',
      statusBadgeTone: 'default',
    };
  }

  const status = closure.status as string;

  if (status === 'APPROVED') {
    return {
      stageKey: 'APPROVED',
      label: 'Disetujui (Approved)',
      description: 'Penutupan disetujui penuh oleh Direktur.',
      statusBadgeTone: 'success',
    };
  }

  if (status === 'PENDING_HOO_REVIEW') {
    return {
      stageKey: 'PENDING_HOO_REVIEW',
      label: 'Menunggu Tinjauan HOO',
      description: 'Waiting for Head of Operations review',
      statusBadgeTone: 'processing',
    };
  }

  if (status === 'PENDING_DIRECTOR_APPROVAL') {
    return {
      stageKey: 'PENDING_DIRECTOR_APPROVAL',
      label: 'Menunggu Persetujuan Direktur',
      description: 'Waiting for Director final approval',
      statusBadgeTone: 'processing',
    };
  }

  if (status === 'RETURNED') {
    return {
      stageKey: 'RETURNED',
      label: 'Dikembalikan (Returned)',
      description: `Pengajuan dikembalikan oleh ${closure.returnRole || 'Manajemen'}. Alasan: ${closure.returnReason || '-'}`,
      statusBadgeTone: 'warning',
    };
  }

  return {
    stageKey: 'NONE',
    label: String(status),
    description: 'Status siklus penutupan.',
    statusBadgeTone: 'default',
  };
}

/**
 * Determines PM Closure Submission / Resubmission Actionability.
 * Strictly respects backend SSOT and RBAC principles.
 */
export function resolveClosureActionability(params: {
  userId?: number | string | null;
  userRoles?: string[];
  projectManagerId?: number | string | null;
  pmName?: string | null;
  userFullName?: string | null;
  projectStatus?: string;
  currentClosure?: ProjectClosure | null;
  readinessReady?: boolean;
}): ClosureActionability {
  const {
    userId,
    userRoles = [],
    projectManagerId,
    pmName,
    userFullName,
    projectStatus = '',
    currentClosure,
    readinessReady = false,
  } = params;

  // 1. Role must include PROJECT_MANAGER
  const isPmRole = userRoles.includes('PROJECT_MANAGER');

  // 2. Assigned PM match check
  const idMatch =
    userId && projectManagerId && String(userId) === String(projectManagerId);
  const nameMatch =
    userFullName && pmName && userFullName.trim().toLowerCase() === pmName.trim().toLowerCase();
  const isAssignedPm = Boolean(isPmRole && (idMatch || nameMatch));

  // 3. Project status must be IN_PROGRESS
  const isProjectInProgress = projectStatus === 'IN_PROGRESS';

  // 4. Active pending cycle check
  const hasActivePendingCycle =
    currentClosure?.status === 'PENDING_HOO_REVIEW' ||
    currentClosure?.status === 'PENDING_DIRECTOR_APPROVAL';

  // 5. Returned cycle check
  const isReturnedCycle = currentClosure?.status === 'RETURNED';

  // 6. Action determination
  let canSubmit = false;
  let canResubmit = false;
  let disabledReason: string | undefined = undefined;

  if (!isPmRole) {
    disabledReason = 'Hanya pengguna dengan peran Project Manager yang dapat mengajukan penutupan.';
  } else if (!isAssignedPm) {
    disabledReason = 'Anda bukan Project Manager yang ditugaskan untuk proyek ini.';
  } else if (!isProjectInProgress) {
    disabledReason = `Pengajuan penutupan hanya diizinkan untuk proyek berstatus IN_PROGRESS (Status saat ini: ${projectStatus}).`;
  } else if (hasActivePendingCycle) {
    disabledReason = 'Terdapat siklus penutupan yang sedang aktif dalam proses peninjauan persetujuan.';
  } else if (!readinessReady) {
    disabledReason = 'Proyek belum memenuhi kriteria kesiapan penutupan (masih terdapat blocker).';
  } else {
    // Both isAssignedPm && isProjectInProgress && !hasActivePendingCycle && readinessReady
    if (isReturnedCycle) {
      canResubmit = true;
    } else if (!currentClosure || currentClosure.status !== 'APPROVED') {
      canSubmit = true;
    }
  }

  return {
    canSubmit,
    canResubmit,
    isActionable: canSubmit || canResubmit,
    disabledReason,
    isAssignedPm,
    isProjectInProgress,
    hasActivePendingCycle,
  };
}

/**
 * Formats currency safely for UI display.
 */
export function formatCurrencyValue(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
