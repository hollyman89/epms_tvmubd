/**
 * EPMS — PR APPROVAL WORKFLOW UTILITIES & SSOT PRESENTATION
 *
 * Strict Data Integrity Rules:
 * - NO MOCK DATA
 * - NO SYNTHETIC NOTES
 * - NO HARDCODED ACTOR FALLBACKS ('Procurement Team', 'Finance Team', 'Director')
 * - NO ESTIMATED / FAKE BUDGETS OR GATES
 * - Missing fields output canonical 'N/A' or 'Belum ada data'
 */

import dayjs from 'dayjs';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { WorkflowInstance, WorkflowTask, WorkflowTransition } from '@/services/workflowEngine.service';

export type PrApprovalStatus =
  | 'SUBMITTED'
  | 'FINANCE_REVIEW'
  | 'DIRECTOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED_TO_PROCUREMENT'
  | 'PO_ISSUED';

export type StepState = 'COMPLETED' | 'ACTIVE' | 'PENDING' | 'REJECTED';

export interface WorkflowStepPresentation {
  key: string;
  role: string;
  label: string;
  state: StepState;
  statusLabel: string;
  tagColor: 'success' | 'processing' | 'error' | 'default';
  stepNumber: number;
}

export interface BusinessWorkflowEvent {
  id: string | number;
  title: string;
  actor: string;
  roleTag: { label: string; color: string };
  statusTag: { label: string; color: 'success' | 'processing' | 'error' | 'default' | 'warning' };
  timestamp?: string;
  formattedTime: string;
  note?: string | null;
  prRef?: string;
  isPending?: boolean;
}

export interface PrItemPresentation {
  id?: number | string;
  itemName: string;
  quantity: number;
  uom?: string;
  estimatedUnitPrice?: number;
  totalPrice?: number;
}

export interface PrInfoCardPresentation {
  prNumber: string;
  projectName: string;
  totalAmountText: string;
  budgetAllocationText: string;
  wbsReferenceText: string;
  hasWbsReference: boolean;
  gateText: string;
  hasGate: boolean;
  submittedByText: string;
  financeReviewText: string;
  directorApprovalText: string;
}

export interface RfqCtaResolution {
  label: string;
  buttonType: 'default' | 'primary';
  mode: 'MANAGE' | 'RECREATE' | 'CREATE';
}

/**
 * Canonical Status Badge Presentation Config
 */
export function resolvePrStatusConfig(status: PrApprovalStatus): {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
} {
  switch (status) {
    case 'APPROVED':
      return {
        color: '#059669',
        bgColor: '#f0fdf4',
        borderColor: '#86efac',
        label: 'PR Disetujui',
      };
    case 'PO_ISSUED':
      return {
        color: '#059669',
        bgColor: '#f0fdf4',
        borderColor: '#86efac',
        label: 'PO Diterbitkan (Disetujui)',
      };
    case 'SUBMITTED':
      return {
        color: '#1d4ed8',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
        label: 'Menunggu Review Finance',
      };
    case 'FINANCE_REVIEW':
      return {
        color: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        label: 'Financial Review',
      };
    case 'DIRECTOR_APPROVAL':
      return {
        color: '#7c3aed',
        bgColor: '#faf5ff',
        borderColor: '#ddd6fe',
        label: 'Menunggu Final Approval Director',
      };
    case 'REJECTED_TO_PROCUREMENT':
      return {
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fca5a5',
        label: 'Ditolak & Dikembalikan ke Procurement',
      };
    default:
      return {
        color: '#64748b',
        bgColor: '#f8fafc',
        borderColor: '#e2e8f0',
        label: (status as string) || 'N/A',
      };
  }
}

/**
 * Derive 4-Step Tracker Presentation strictly from real backend workflow state.
 */
export function deriveWorkflowSteps(params: {
  status: PrApprovalStatus;
  instance?: WorkflowInstance | null;
  transitions?: WorkflowTransition[];
  activeRfq?: any;
}): WorkflowStepPresentation[] {
  const { status, instance, transitions = [], activeRfq } = params;
  const isRej = status === 'REJECTED_TO_PROCUREMENT';

  // Finance is completed if task was completed or transition approved or subsequent stage reached
  const isFinanceCompleted =
    transitions.some((t) => t.fromNodeId === 'node_finance_review' && t.action === 'APPROVE') ||
    instance?.tasks?.some((t) => t.nodeId === 'node_finance_review' && t.status === 'COMPLETED') ||
    status === 'DIRECTOR_APPROVAL' ||
    status === 'APPROVED' ||
    status === 'PO_ISSUED';

  // Director is completed if transition approved or subsequent stage reached
  const isDirectorCompleted =
    transitions.some((t) => t.fromNodeId === 'node_director_approval' && t.action === 'APPROVE') ||
    instance?.tasks?.some((t) => t.nodeId === 'node_director_approval' && t.status === 'COMPLETED') ||
    status === 'APPROVED' ||
    status === 'PO_ISSUED';

  const financeState: StepState = isFinanceCompleted
    ? 'COMPLETED'
    : status === 'SUBMITTED' || status === 'FINANCE_REVIEW'
    ? 'ACTIVE'
    : 'PENDING';

  const directorState: StepState = isDirectorCompleted
    ? 'COMPLETED'
    : status === 'DIRECTOR_APPROVAL'
    ? 'ACTIVE'
    : 'PENDING';

  const procurementNextState: StepState =
    status === 'PO_ISSUED'
      ? 'COMPLETED'
      : status === 'APPROVED'
      ? 'ACTIVE'
      : 'PENDING';

  const stepsConfig: Array<{
    key: string;
    role: string;
    label: string;
    state: StepState;
    stepNumber: number;
    activeLabel?: string;
  }> = [
    {
      key: 'procurement',
      role: 'Procurement',
      label: isRej ? 'Perlu Perbaikan' : 'Pengajuan PR',
      state: isRej ? 'REJECTED' : 'COMPLETED',
      stepNumber: 1,
    },
    {
      key: 'finance',
      role: 'Finance',
      label: 'Financial Review',
      state: financeState,
      stepNumber: 2,
    },
    {
      key: 'director',
      role: 'Director',
      label: 'Final Approval',
      state: directorState,
      stepNumber: 3,
    },
    {
      key: 'procurement_next',
      role: 'Procurement Next',
      label: status === 'PO_ISSUED' ? 'PO Diterbitkan' : 'RFQ → PO → GR',
      state: procurementNextState,
      stepNumber: 4,
      activeLabel: activeRfq ? 'Sedang Berjalan' : 'Siap Diproses',
    },
  ];

  return stepsConfig.map((s) => {
    let statusLabel = 'Menunggu';
    let tagColor: 'success' | 'processing' | 'error' | 'default' = 'default';

    if (s.state === 'COMPLETED') {
      statusLabel = 'Selesai';
      tagColor = 'success';
    } else if (s.state === 'ACTIVE') {
      statusLabel = s.activeLabel || 'Sedang Berjalan';
      tagColor = 'processing';
    } else if (s.state === 'REJECTED') {
      statusLabel = 'Perlu Revisi';
      tagColor = 'error';
    }

    return {
      key: s.key,
      role: s.role,
      label: s.label,
      state: s.state,
      statusLabel,
      tagColor,
      stepNumber: s.stepNumber,
    };
  });
}

/**
 * Format Information Card fields strictly with NO mock fallback.
 */
export function formatPrInfoPresentation(params: {
  prNumber?: string;
  prId?: string | number;
  projectName?: string;
  totalAmount?: number | null;
  budgetAllocation?: number | null;
  wbsTaskName?: string | null;
  opPlanRef?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  financeReviewedBy?: string | null;
  financeReviewedAt?: string | null;
  directorDecisionBy?: string | null;
  directorDecisionAt?: string | null;
}): PrInfoCardPresentation {
  const {
    prNumber,
    prId,
    projectName,
    totalAmount,
    budgetAllocation,
    wbsTaskName,
    opPlanRef,
    submittedBy,
    submittedAt,
    financeReviewedBy,
    financeReviewedAt,
    directorDecisionBy,
    directorDecisionAt,
  } = params;

  // PR Number — STRICT: Never synthesize PR-${id}
  const formattedPrNumber = prNumber && prNumber.trim() ? prNumber.trim() : 'Belum ada data';

  // Project Name
  const formattedProjectName = projectName?.trim() ? projectName.trim() : 'Belum ada data';

  // Total PR Amount
  const totalAmountText =
    totalAmount != null && !isNaN(Number(totalAmount))
      ? formatCurrency(totalAmount, { fallback: 'N/A' })
      : 'N/A';

  // WBS Allocation — NEVER fall back to totalAmount
  const budgetAllocationText =
    budgetAllocation != null && !isNaN(Number(budgetAllocation)) && Number(budgetAllocation) >= 0
      ? formatCurrency(budgetAllocation, { fallback: 'N/A' })
      : 'N/A';

  // WBS Reference
  const hasWbsReference = Boolean(wbsTaskName && wbsTaskName.trim());
  const wbsReferenceText = hasWbsReference ? wbsTaskName!.trim() : 'Belum ada data';

  // Gate / Op. Plan Ref — NEVER append synthetic '(Approved by HOA)'
  const hasGate = Boolean(opPlanRef && opPlanRef.trim());
  const gateText = hasGate ? opPlanRef!.trim() : 'Belum ada data';

  // Submitter
  let submittedByText = 'N/A';
  if (submittedBy && submittedBy.trim()) {
    const timeFormatted = submittedAt ? dayjs(submittedAt).format('DD/MM HH:mm') : null;
    submittedByText = timeFormatted ? `${submittedBy.trim()} (${timeFormatted})` : submittedBy.trim();
  }

  // Finance Review
  let financeReviewText = 'Belum ada data';
  if (financeReviewedBy && financeReviewedBy.trim()) {
    const timeFormatted = financeReviewedAt ? dayjs(financeReviewedAt).format('DD/MM HH:mm') : null;
    financeReviewText = timeFormatted
      ? `${financeReviewedBy.trim()} (${timeFormatted})`
      : financeReviewedBy.trim();
  }

  // Director Approval
  let directorApprovalText = 'Belum ada data';
  if (directorDecisionBy && directorDecisionBy.trim()) {
    const timeFormatted = directorDecisionAt ? dayjs(directorDecisionAt).format('DD/MM HH:mm') : null;
    directorApprovalText = timeFormatted
      ? `${directorDecisionBy.trim()} (${timeFormatted})`
      : directorDecisionBy.trim();
  }

  return {
    prNumber: formattedPrNumber,
    projectName: formattedProjectName,
    totalAmountText,
    budgetAllocationText,
    wbsReferenceText,
    hasWbsReference,
    gateText,
    hasGate,
    submittedByText,
    financeReviewText,
    directorApprovalText,
  };
}

/**
 * Resolve RFQ CTA strictly based on canonical business rules:
 * - Active RFQ -> 'Kelola RFQ'
 * - Cancelled RFQ only -> 'Buat RFQ Baru'
 * - No RFQ -> 'Buat RFQ'
 */
export function resolveRfqCta(activeRfq: any, latestRfq: any): RfqCtaResolution {
  if (activeRfq) {
    return {
      label: 'Kelola RFQ',
      buttonType: 'default',
      mode: 'MANAGE',
    };
  }

  if (latestRfq && latestRfq.status === 'CANCELLED') {
    return {
      label: 'Buat RFQ Baru',
      buttonType: 'primary',
      mode: 'RECREATE',
    };
  }

  return {
    label: 'Buat RFQ',
    buttonType: 'primary',
    mode: 'CREATE',
  };
}

/**
 * Derive Workflow History Events strictly from real backend workflow transitions.
 * Strict rules:
 * - Real actor names from transitions.actor
 * - Real timestamps from transitions.createdAt
 * - Real notes from transitions.reason (OMITTED if not present in DB)
 * - Chronological sorting by actual timestamps
 */
export function deriveWorkflowHistoryEvents(params: {
  instance?: WorkflowInstance | null;
  transitions?: WorkflowTransition[];
  prNumber?: string;
  prId?: string | number;
  submittedBy?: string;
  submittedAt?: string;
  effectiveStatus?: PrApprovalStatus;
  revisionHistory?: Array<{
    round: number;
    rejectedBy: string;
    rejectedByRole: string;
    rejectedAt: string;
    reason: string;
  }>;
}): BusinessWorkflowEvent[] {
  const {
    instance,
    transitions = [],
    prNumber,
    prId,
    submittedBy,
    submittedAt,
    effectiveStatus,
    revisionHistory = [],
  } = params;

  const list: BusinessWorkflowEvent[] = [];

  // 1. Initial Submission Event
  const startTrans = transitions.find(
    (t) => t.action === 'START' || t.fromNodeId === 'node_start',
  );

  const initialActor =
    startTrans?.actor?.fullName || startTrans?.actor?.email || submittedBy || 'N/A';
  const creationTime = startTrans?.createdAt || instance?.createdAt || submittedAt;

  list.push({
    id: 'event_initial_pr_submit',
    title: 'Pengajuan Purchase Request (PR)',
    actor: initialActor,
    roleTag: { label: 'Procurement', color: 'blue' },
    statusTag: { label: 'Diajukan', color: 'success' },
    timestamp: creationTime,
    formattedTime: creationTime ? dayjs(creationTime).format('DD MMM YYYY HH:mm') : '-',
    prRef: prNumber && prNumber.trim() ? prNumber.trim() : undefined,
    note: startTrans?.reason || null,
  });

  // 2. Completed transitions
  transitions.forEach((t) => {
    if (t.action === 'START' || t.fromNodeId === 'node_start') {
      return;
    }

    const actorName = t.actor?.fullName || t.actor?.email || 'N/A';
    const note = t.reason && t.reason.trim() ? t.reason.trim() : null;

    if (t.fromNodeId === 'node_finance_review') {
      const isApproved = t.action === 'APPROVE';
      list.push({
        id: `trans_${t.id}`,
        title: isApproved ? 'Review Finance Diselesaikan' : 'Revisi Diminta oleh Finance',
        actor: actorName,
        roleTag: { label: 'Finance Team', color: 'cyan' },
        statusTag: isApproved ? { label: 'Disetujui', color: 'success' } : { label: 'Perlu Revisi', color: 'error' },
        timestamp: t.createdAt,
        formattedTime: dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
        note,
      });
    } else if (t.fromNodeId === 'node_director_approval') {
      const isApproved = t.action === 'APPROVE';
      list.push({
        id: `trans_${t.id}`,
        title: isApproved ? 'Persetujuan Akhir Director Diselesaikan' : 'Revisi Diminta oleh Director',
        actor: actorName,
        roleTag: { label: 'Director', color: 'purple' },
        statusTag: isApproved ? { label: 'Disetujui', color: 'success' } : { label: 'Perlu Revisi', color: 'error' },
        timestamp: t.createdAt,
        formattedTime: dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
        note,
      });
    } else {
      const isApproved = t.action === 'APPROVE';
      const isReturn = t.action === 'RETURN' || t.action === 'REJECT';
      const actionLabel = isApproved ? 'Disetujui' : isReturn ? 'Perlu Revisi' : 'Diproses';

      list.push({
        id: `trans_${t.id}`,
        title: `Tahap ${t.fromNodeId.replace(/^node_/, '').replace(/_/g, ' ').toUpperCase()}`,
        actor: actorName,
        roleTag: { label: 'Workflow', color: 'default' },
        statusTag: {
          label: actionLabel,
          color: isApproved ? 'success' : isReturn ? 'error' : 'processing',
        },
        timestamp: t.createdAt,
        formattedTime: dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
        note,
      });
    }
  });

  // 3. Pending In-Progress Tasks
  const statusCheck = instance?.status || effectiveStatus;
  if (statusCheck === 'IN_PROGRESS' || effectiveStatus === 'SUBMITTED' || effectiveStatus === 'DIRECTOR_APPROVAL') {
    const activePendingTask = instance?.tasks?.find((t) => t.status === 'PENDING');
    const currentNode = instance?.currentNodeId;

    if (currentNode === 'node_director_approval' || effectiveStatus === 'DIRECTOR_APPROVAL' || activePendingTask?.assigneeRole?.name === 'DIRECTOR') {
      list.push({
        id: 'pending_director_task',
        title: 'Menunggu Persetujuan Director',
        actor: 'Director',
        roleTag: { label: 'Director', color: 'purple' },
        statusTag: { label: 'Sedang Berjalan', color: 'warning' },
        formattedTime: 'Menunggu Keputusan',
        isPending: true,
        note: null,
      });
    } else if (currentNode === 'node_finance_review' || effectiveStatus === 'SUBMITTED' || activePendingTask?.assigneeRole?.name === 'FINANCE') {
      list.push({
        id: 'pending_finance_task',
        title: 'Menunggu Review Finance',
        actor: 'Finance Team',
        roleTag: { label: 'Finance Team', color: 'cyan' },
        statusTag: { label: 'Sedang Berjalan', color: 'processing' },
        formattedTime: 'Menunggu Pemeriksaan',
        isPending: true,
        note: null,
      });
    }
  }

  // 4. Fallback for legacy revision history if no transitions are recorded
  if (transitions.length === 0 && revisionHistory.length > 0) {
    revisionHistory.forEach((h) => {
      list.push({
        id: `rev_${h.round}`,
        title: `Revisi Diminta oleh ${h.rejectedByRole === 'FINANCE' ? 'Finance Team' : 'Director'} (Putaran ${h.round})`,
        actor: h.rejectedBy || 'N/A',
        roleTag: { label: h.rejectedByRole === 'FINANCE' ? 'Finance' : 'Director', color: h.rejectedByRole === 'FINANCE' ? 'cyan' : 'purple' },
        statusTag: { label: 'Perlu Revisi', color: 'error' },
        timestamp: h.rejectedAt,
        formattedTime: dayjs(h.rejectedAt).format('DD MMM YYYY HH:mm'),
        note: h.reason && h.reason.trim() ? h.reason.trim() : null,
      });
    });
  }

  // 5. Strict Chronological Sorting (Rule 9)
  return list.sort((a, b) => {
    if (a.isPending && !b.isPending) return 1;
    if (!a.isPending && b.isPending) return -1;
    const timeA = a.timestamp ? dayjs(a.timestamp).valueOf() : 0;
    const timeB = b.timestamp ? dayjs(b.timestamp).valueOf() : 0;
    return timeA - timeB;
  });
}

/**
 * PR Items presentation helper
 */
export function derivePrItemsMetrics(items: PrItemPresentation[] = []) {
  const hasUom = items.some((it) => Boolean(it.uom && it.uom.trim()));
  const hasUnitPrice = items.some(
    (it) => it.estimatedUnitPrice != null && Number(it.estimatedUnitPrice) > 0,
  );
  const hasSubtotal = items.some(
    (it) => it.totalPrice != null || (it.quantity != null && it.estimatedUnitPrice != null),
  );

  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

  const totalCalculatedSubtotal = items.reduce((acc, it) => {
    if (it.totalPrice != null && !isNaN(Number(it.totalPrice))) {
      return acc + Number(it.totalPrice);
    }
    if (it.quantity != null && it.estimatedUnitPrice != null) {
      return acc + Number(it.quantity) * Number(it.estimatedUnitPrice);
    }
    return acc;
  }, 0);

  return {
    itemCount: items.length,
    hasUom,
    hasUnitPrice,
    hasSubtotal,
    totalQuantity,
    totalCalculatedSubtotal,
  };
}
