'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Tag,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Descriptions,
  Divider,
  Alert,
  Timeline,
  Radio,
  Tooltip,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  ArrowRightOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  UserSwitchOutlined,
  InfoCircleOutlined,
  SendOutlined,
  EyeOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import WorkflowEngineService, {
  WorkflowInstance,
  WorkflowTask,
  WorkflowTransition,
} from '@/services/workflowEngine.service';

const { Text } = Typography;
const { TextArea } = Input;

// ─────────────────────────────────────────────
// PR Approval State Model (SSOT Workflow Engine)
// ─────────────────────────────────────────────
export type PrApprovalStatus =
  | 'SUBMITTED'
  | 'FINANCE_REVIEW'
  | 'DIRECTOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED_TO_PROCUREMENT'
  | 'PO_ISSUED';

export interface PrApprovalState {
  prId: string | number;
  prNumber: string;
  projectId: string | number;
  projectName: string;
  totalAmount: number;
  status: PrApprovalStatus;
  budgetAllocation?: number;
  wbsTaskName?: string;
  opPlanRef?: string;
  submittedBy?: string;
  submittedAt?: string;
  financeReviewedBy?: string;
  financeReviewedAt?: string;
  financeAction?: 'PASSED_TO_DIRECTOR' | 'REJECTED';
  directorDecisionBy?: string;
  directorDecisionAt?: string;
  directorAction?: 'APPROVED' | 'REJECTED';
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  rejectedByRole?: 'FINANCE' | 'DIRECTOR';
  revisionHistory?: Array<{
    round: number;
    rejectedBy: string;
    rejectedByRole: string;
    rejectedAt: string;
    reason: string;
    resubmittedAt?: string;
  }>;
}

// ─────────────────────────────────────────────
// Status Badge (Authoritative SSOT)
// ─────────────────────────────────────────────
export function PrStatusBadge({ status }: { status: PrApprovalStatus }) {
  const cfg: Record<PrApprovalStatus, { color: string; label: string; icon: React.ReactNode }> = {
    SUBMITTED:               { color: '#1d4ed8', label: 'Menunggu Review Finance', icon: <ClockCircleFilled style={{ color: '#1d4ed8' }} /> },
    FINANCE_REVIEW:          { color: '#d97706', label: 'Financial Review', icon: <ClockCircleFilled style={{ color: '#d97706' }} /> },
    DIRECTOR_APPROVAL:       { color: '#7c3aed', label: 'Menunggu Final Approval Director', icon: <ClockCircleFilled style={{ color: '#7c3aed' }} /> },
    APPROVED:                { color: '#059669', label: 'PR Disetujui', icon: <CheckCircleFilled style={{ color: '#059669' }} /> },
    REJECTED_TO_PROCUREMENT: { color: '#dc2626', label: 'Ditolak & Dikembalikan ke Procurement', icon: <ExclamationCircleFilled style={{ color: '#dc2626' }} /> },
    PO_ISSUED:               { color: '#059669', label: 'PO Diterbitkan (Disetujui)', icon: <CheckCircleFilled style={{ color: '#059669' }} /> },
  };
  const c = cfg[status] || { color: '#64748b', label: status, icon: null };
  return (
    <Tag icon={c.icon} style={{ color: c.color, border: `1.5px solid ${c.color}33`, background: `${c.color}11`, fontWeight: 700, fontSize: 11.5, padding: '3px 10px', borderRadius: 6 }}>
      {c.label}
    </Tag>
  );
}

// ─────────────────────────────────────────────
// 4-Step Tracker
// ─────────────────────────────────────────────
export function PrApprovalTracker({
  status,
  instance,
}: {
  status: PrApprovalStatus;
  instance?: WorkflowInstance | null;
}) {
  type SS = 'COMPLETED' | 'ACTIVE' | 'PENDING' | 'REJECTED';
  const isRej = status === 'REJECTED_TO_PROCUREMENT';

  const isFinanceCompleted =
    instance?.tasks?.some(
      (t) => t.nodeId === 'node_finance_review' && t.status === 'COMPLETED',
    ) ||
    status === 'DIRECTOR_APPROVAL' ||
    status === 'APPROVED' ||
    status === 'PO_ISSUED';

  const isDirectorCompleted =
    instance?.tasks?.some(
      (t) => t.nodeId === 'node_director_approval' && t.status === 'COMPLETED',
    ) ||
    status === 'APPROVED' ||
    status === 'PO_ISSUED';

  const financeState: SS = isFinanceCompleted
    ? 'COMPLETED'
    : status === 'SUBMITTED' || status === 'FINANCE_REVIEW'
    ? 'ACTIVE'
    : 'PENDING';

  const directorState: SS = isDirectorCompleted
    ? 'COMPLETED'
    : status === 'DIRECTOR_APPROVAL'
    ? 'ACTIVE'
    : 'PENDING';

  const procurementNextState: SS =
    status === 'PO_ISSUED'
      ? 'COMPLETED'
      : status === 'APPROVED'
      ? 'ACTIVE'
      : 'PENDING';

  const steps: { key: string; role: string; label: string; state: SS }[] = [
    {
      key: 'submit',
      role: 'Procurement',
      label: isRej ? 'Perlu Perbaikan' : 'Pengajuan PR',
      state: isRej ? 'REJECTED' : 'COMPLETED',
    },
    {
      key: 'finance',
      role: 'Finance',
      label: 'Financial Review',
      state: financeState,
    },
    {
      key: 'director',
      role: 'Director',
      label: 'Final Approval',
      state: directorState,
    },
    {
      key: 'approved',
      role: 'Procurement Next',
      label: status === 'PO_ISSUED' ? 'PO Diterbitkan' : 'RFQ → PO → GR',
      state: procurementNextState,
    },
  ];
  const colors: Record<SS, string> = { COMPLETED: '#059669', ACTIVE: '#1d4ed8', PENDING: '#94a3b8', REJECTED: '#dc2626' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', padding: '4px 0' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ flex: '1 1 0', minWidth: 95, padding: '5px 8px', borderRadius: 6, border: `1.5px solid ${colors[s.state]}44`, background: s.state === 'ACTIVE' ? '#eff6ff' : s.state === 'COMPLETED' ? '#f0fdf4' : s.state === 'REJECTED' ? '#fef2f2' : '#f8fafc', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: colors[s.state], fontWeight: 700 }}>{s.role}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#1e293b' }}>{s.label}</div>
            <Tag color={s.state === 'COMPLETED' ? 'success' : s.state === 'ACTIVE' ? 'processing' : s.state === 'REJECTED' ? 'error' : 'default'} style={{ fontSize: 8.5, margin: '2px 0 0', padding: '0 4px', fontWeight: 700 }}>
              {s.state === 'COMPLETED' ? 'Selesai' : s.state === 'ACTIVE' ? 'Sedang Berjalan' : s.state === 'REJECTED' ? 'Perlu Revisi' : 'Menunggu'}
            </Tag>
          </div>
          {i < steps.length - 1 && <ArrowRightOutlined style={{ color: '#cbd5e1', fontSize: 11, flexShrink: 0 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface PrApprovalWorkflowProps {
  prId: string | number;
  prNumber: string;
  projectId: string | number;
  projectName: string;
  totalAmount: number;
  customerName?: string;
  budgetAllocation?: number;
  wbsTaskName?: string;
  opPlanRef?: string;
  items?: Array<{ itemName: string; quantity: number; estimatedUnitPrice: number }>;
  isProcurement?: boolean;
  isFinance?: boolean;
  isDirector?: boolean;
  isSuperAdmin?: boolean;
  initialStatus?: PrApprovalStatus;
  currentUserName?: string;
  onStatusChange?: (newStatus: PrApprovalStatus) => void;
  onCreateRfqClick?: () => void;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const PrApprovalWorkflow: React.FC<PrApprovalWorkflowProps> = ({
  prId,
  prNumber,
  projectId,
  projectName,
  totalAmount,
  customerName,
  budgetAllocation,
  wbsTaskName,
  opPlanRef,
  items = [],
  initialStatus = 'SUBMITTED',
  isProcurement = false,
  isFinance = false,
  isDirector = false,
  isSuperAdmin = false,
  currentUserName = 'User',
  onStatusChange,
  onCreateRfqClick,
}) => {
  const [state, setState] = useState<PrApprovalState | null>(null);
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [financePassOpen, setFinancePassOpen] = useState(false);
  const [dirApproveOpen, setDirApproveOpen] = useState(false);
  const [rejectRole, setRejectRole] = useState<'FINANCE' | 'DIRECTOR'>('FINANCE');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [form] = Form.useForm();

  const loadWorkflowData = useCallback(async () => {
    if (!prId) return;
    try {
      setLoadingWorkflow(true);
      const rawInst = await WorkflowEngineService.getInstanceByEntity('PURCHASE_REQUEST', prId);
      const inst: WorkflowInstance | null = (rawInst as any)?.data?.id ? (rawInst as any).data : rawInst;
      if (inst && inst.id) {
        setInstance(inst);
        const trans = await WorkflowEngineService.getTransitions(inst.id);
        setTransitions(trans);

        // Extract start transition (initial submission)
        const startTrans = trans.find(
          (t) => t.action === 'START' || t.fromNodeId === 'node_start',
        );

        // Extract reviewer Finance and Director from completed transitions
        const financeTrans = trans.find(
          (t) => t.fromNodeId === 'node_finance_review' && t.action === 'APPROVE',
        );
        const directorTrans = trans.find(
          (t) => t.fromNodeId === 'node_director_approval' && t.action === 'APPROVE',
        );

        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            submittedAt: inst.createdAt || startTrans?.createdAt || prev.submittedAt,
            submittedBy: startTrans?.actor?.fullName || prev.submittedBy || 'Procurement Team',
            ...(financeTrans
              ? {
                  financeReviewedBy: financeTrans.actor?.fullName || 'Finance Team',
                  financeReviewedAt: financeTrans.createdAt,
                  financeAction: 'PASSED_TO_DIRECTOR',
                }
              : {}),
            ...(directorTrans
              ? {
                  directorDecisionBy: directorTrans.actor?.fullName || 'Director',
                  directorDecisionAt: directorTrans.createdAt,
                  directorAction: 'APPROVED',
                }
              : {}),
          };
        });
      }
    } catch (err) {
      console.error('Failed to load workflow instance:', err);
    } finally {
      setLoadingWorkflow(false);
    }
  }, [prId]);

  const load = useCallback(() => {
    const init: PrApprovalState = {
      prId,
      prNumber,
      projectId,
      projectName,
      totalAmount,
      budgetAllocation: budgetAllocation || totalAmount,
      wbsTaskName: wbsTaskName || 'WBS Pengadaan Material & Peralatan',
      opPlanRef: opPlanRef || `OP-${projectId}`,
      status: initialStatus || 'SUBMITTED',
      submittedBy: 'Procurement Team',
      submittedAt: undefined,
      revisionHistory: [],
    };
    setState(init);
    loadWorkflowData();
  }, [prId, prNumber, projectId, projectName, totalAmount, budgetAllocation, wbsTaskName, opPlanRef, initialStatus, loadWorkflowData]);

  // ─────────────────────────────────────────────
  // Business-Friendly Workflow Events Derivation
  // ─────────────────────────────────────────────
  interface BusinessWorkflowEvent {
    id: string | number;
    title: string;
    actor: string;
    roleTag: { label: string; color: string };
    statusTag: { label: string; color: string };
    timestamp?: string;
    formattedTime?: string;
    note?: string | null;
    prRef?: string;
    isPending?: boolean;
  }

  const businessWorkflowEvents: BusinessWorkflowEvent[] = useMemo(() => {
    const list: BusinessWorkflowEvent[] = [];

    // 1. Initial Submission Event (Procurement)
    const creationTime = instance?.createdAt || state?.submittedAt;
    list.push({
      id: 'event_initial_pr_submit',
      title: 'Pengajuan Purchase Request (PR)',
      actor: state?.submittedBy || 'Procurement Team',
      roleTag: { label: 'Procurement', color: 'blue' },
      statusTag: { label: 'Diajukan', color: 'success' },
      timestamp: creationTime,
      formattedTime: creationTime ? dayjs(creationTime).format('DD MMM YYYY HH:mm') : '-',
      prRef: prNumber || (prId ? `PR-${prId}` : undefined),
    });

    // 2. Map Completed Transitions (excluding raw START/AUTO system transitions)
    transitions.forEach((t) => {
      if (t.action === 'START' || t.fromNodeId === 'node_start') {
        return;
      }

      if (t.fromNodeId === 'node_finance_review') {
        const isApproved = t.action === 'APPROVE';
        list.push({
          id: `trans_${t.id}`,
          title: isApproved ? 'Review Finance Diselesaikan' : 'Revisi Diminta oleh Finance',
          actor: t.actor?.fullName || 'Finance Team',
          roleTag: { label: 'Finance Team', color: 'cyan' },
          statusTag: isApproved ? { label: 'Disetujui', color: 'success' } : { label: 'Perlu Revisi', color: 'error' },
          timestamp: t.createdAt,
          formattedTime: dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
          note: t.reason || (isApproved ? 'Anggaran dan kelayakan harga telah disetujui.' : null),
        });
      } else if (t.fromNodeId === 'node_director_approval') {
        const isApproved = t.action === 'APPROVE';
        list.push({
          id: `trans_${t.id}`,
          title: isApproved ? 'Persetujuan Akhir Director Diselesaikan' : 'Revisi Diminta oleh Director',
          actor: t.actor?.fullName || 'Director',
          roleTag: { label: 'Director', color: 'purple' },
          statusTag: isApproved ? { label: 'Disetujui', color: 'success' } : { label: 'Perlu Revisi', color: 'error' },
          timestamp: t.createdAt,
          formattedTime: dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
          note: t.reason || (isApproved ? 'Pengadaan telah disetujui penuh.' : null),
        });
      } else {
        const actionLabel = t.action === 'APPROVE' ? 'Disetujui' : t.action === 'REJECT' || t.action === 'RETURN' ? 'Perlu Revisi' : 'Diproses';
        list.push({
          id: `trans_${t.id}`,
          title: `Tahap ${t.fromNodeId.replace(/^node_/, '').replace(/_/g, ' ').toUpperCase()}`,
          actor: t.actor?.fullName || 'Workflow Actor',
          roleTag: { label: 'Workflow', color: 'default' },
          statusTag: { label: actionLabel, color: t.action === 'APPROVE' ? 'success' : 'processing' },
          timestamp: t.createdAt,
          formattedTime: dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
          note: t.reason,
        });
      }
    });

    // 3. Active / Pending Task
    const effectiveStatus = instance?.status || state?.status;
    if (effectiveStatus === 'IN_PROGRESS' || state?.status === 'SUBMITTED' || state?.status === 'DIRECTOR_APPROVAL') {
      const activePendingTask = instance?.tasks?.find((t) => t.status === 'PENDING');
      const currentNode = instance?.currentNodeId;

      if (currentNode === 'node_director_approval' || state?.status === 'DIRECTOR_APPROVAL' || activePendingTask?.assigneeRole?.name === 'DIRECTOR') {
        list.push({
          id: 'pending_director_task',
          title: 'Menunggu Persetujuan Director',
          actor: 'Director',
          roleTag: { label: 'Director', color: 'purple' },
          statusTag: { label: 'Sedang Berjalan', color: 'purple' },
          formattedTime: 'Menunggu Keputusan',
          isPending: true,
          note: 'Menunggu peninjauan dan persetujuan akhir dari Director.',
        });
      } else if (currentNode === 'node_finance_review' || state?.status === 'SUBMITTED' || activePendingTask?.assigneeRole?.name === 'FINANCE') {
        list.push({
          id: 'pending_finance_task',
          title: 'Menunggu Review Finance',
          actor: 'Finance Team',
          roleTag: { label: 'Finance Team', color: 'cyan' },
          statusTag: { label: 'Sedang Berjalan', color: 'processing' },
          formattedTime: 'Menunggu Pemeriksaan',
          isPending: true,
          note: 'Sedang dalam pemeriksaan pagu anggaran dan kelayakan finansial.',
        });
      }
    }

    // 4. Legacy Revision History Fallback (if no transitions exist)
    if (transitions.length === 0 && (state?.revisionHistory?.length ?? 0) > 0) {
      state!.revisionHistory!.forEach((h) => {
        list.push({
          id: `rev_${h.round}`,
          title: `Revisi Diminta oleh ${h.rejectedByRole === 'FINANCE' ? 'Finance Team' : 'Director'} (Putaran ${h.round})`,
          actor: h.rejectedByRole === 'FINANCE' ? 'Finance Team' : 'Director',
          roleTag: { label: h.rejectedByRole === 'FINANCE' ? 'Finance' : 'Director', color: h.rejectedByRole === 'FINANCE' ? 'cyan' : 'purple' },
          statusTag: { label: 'Perlu Revisi', color: 'error' },
          timestamp: h.rejectedAt,
          formattedTime: dayjs(h.rejectedAt).format('DD MMM YYYY HH:mm'),
          note: h.reason,
        });
      });
    }

    return list;
  }, [instance, transitions, state, prNumber, prId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTask = useMemo<WorkflowTask | null>(() => {
    return instance?.tasks?.find((t) => t.status === 'PENDING') || null;
  }, [instance]);

  const effectiveStatus = useMemo<PrApprovalStatus>(() => {
    if (initialStatus === 'PO_ISSUED') return 'PO_ISSUED';
    if (instance) {
      if (instance.status === 'COMPLETED') return 'APPROVED';
      if (instance.status === 'REJECTED') return 'REJECTED_TO_PROCUREMENT';
      if (activeTask?.nodeId === 'node_director_approval' || instance.currentNodeId === 'node_director_approval') return 'DIRECTOR_APPROVAL';
      if (activeTask?.nodeId === 'node_procurement_revision' || instance.currentNodeId === 'node_procurement_revision') return 'REJECTED_TO_PROCUREMENT';
      if (activeTask?.nodeId === 'node_finance_review' || instance.currentNodeId === 'node_finance_review') return 'SUBMITTED';
    }
    return initialStatus || state?.status || 'SUBMITTED';
  }, [instance, activeTask, initialStatus, state?.status]);

  const update = (patch: Partial<PrApprovalState>) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      onStatusChange?.(next.status);
      return next;
    });
  };

  // Determine active effective role
  const effectiveRole = useMemo(() => {
    if (isDirector) return 'DIRECTOR';
    if (isFinance) return 'FINANCE';
    if (isProcurement) return 'PROCUREMENT';
    if (isSuperAdmin) return 'SUPER_ADMIN';
    return 'GUEST';
  }, [isDirector, isFinance, isProcurement, isSuperAdmin]);

  const canActAsProcurement = effectiveRole === 'PROCUREMENT' || effectiveRole === 'SUPER_ADMIN';
  const canActAsFinance = effectiveRole === 'FINANCE' || effectiveRole === 'SUPER_ADMIN';
  const canActAsDirector = effectiveRole === 'DIRECTOR' || effectiveRole === 'SUPER_ADMIN';

  // ── Authoritative Engine Handlers ──
  const handleFinancePass = async () => {
    if (instance && activeTask) {
      try {
        setSubmitting(true);
        await WorkflowEngineService.completeTask(instance.id, activeTask.id, {
          action: 'APPROVE',
          reason: 'Finance Review Approved & Passed to Director',
        });
        message.success('PR berhasil direview dan diteruskan ke Director');
        setFinancePassOpen(false);
        onStatusChange?.('DIRECTOR_APPROVAL');
        await loadWorkflowData();
        return;
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Gagal memproses review Finance');
        return;
      } finally {
        setSubmitting(false);
      }
    }

    // Local fallback if no instance yet
    update({
      status: 'DIRECTOR_APPROVAL',
      financeReviewedBy: currentUserName || 'Finance Officer',
      financeReviewedAt: new Date().toISOString(),
      financeAction: 'PASSED_TO_DIRECTOR',
    });
    setFinancePassOpen(false);
  };

  const handleRejectSubmit = async (vals: { reason: string }) => {
    if (instance && activeTask) {
      try {
        setSubmitting(true);
        await WorkflowEngineService.completeTask(instance.id, activeTask.id, {
          action: 'RETURN',
          reason: vals.reason,
        });
        message.warning('PR dikembalikan ke Procurement untuk revisi');
        setRejectOpen(false);
        form.resetFields();
        onStatusChange?.('REJECTED_TO_PROCUREMENT');
        await loadWorkflowData();
        return;
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Gagal mengembalikan PR');
        return;
      } finally {
        setSubmitting(false);
      }
    }

    const now = new Date().toISOString();
    const round = (state?.revisionHistory?.length ?? 0) + 1;
    const actor = currentUserName || (rejectRole === 'FINANCE' ? 'Finance Team' : 'Director');
    const entry = {
      round,
      rejectedBy: actor,
      rejectedByRole: rejectRole,
      rejectedAt: now,
      reason: vals.reason,
    };
    update({
      status: 'REJECTED_TO_PROCUREMENT',
      rejectedBy: actor,
      rejectedAt: now,
      rejectionReason: vals.reason,
      rejectedByRole: rejectRole,
      ...(rejectRole === 'FINANCE'
        ? { financeReviewedBy: actor, financeReviewedAt: now, financeAction: 'REJECTED' }
        : { directorDecisionBy: actor, directorDecisionAt: now, directorAction: 'REJECTED' }),
      revisionHistory: [...(state?.revisionHistory ?? []), entry],
    });
    form.resetFields();
    setRejectOpen(false);
  };

  const handleDirectorApprove = async () => {
    if (instance && activeTask) {
      try {
        setSubmitting(true);
        await WorkflowEngineService.completeTask(instance.id, activeTask.id, {
          action: 'APPROVE',
          reason: 'Final Approval by Director',
        });
        message.success('PR disetujui (Final Approval)');
        setDirApproveOpen(false);
        onStatusChange?.('APPROVED');
        await loadWorkflowData();
        return;
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Gagal menyetujui PR');
        return;
      } finally {
        setSubmitting(false);
      }
    }

    update({
      status: 'APPROVED',
      directorDecisionBy: currentUserName || 'Director',
      directorDecisionAt: new Date().toISOString(),
      directorAction: 'APPROVED',
    });
    setDirApproveOpen(false);
  };

  const handleResubmit = async () => {
    if (instance && activeTask) {
      try {
        setSubmitting(true);
        await WorkflowEngineService.completeTask(instance.id, activeTask.id, {
          action: 'RESUBMIT',
          reason: 'PR Revision Resubmitted by Procurement',
        });
        message.success('PR berhasil diajukan ulang ke Finance');
        onStatusChange?.('SUBMITTED');
        await loadWorkflowData();
        return;
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Gagal mengajukan ulang PR');
        return;
      } finally {
        setSubmitting(false);
      }
    }

    const now = new Date().toISOString();
    const hist = [...(state?.revisionHistory ?? [])];
    if (hist.length > 0) hist[hist.length - 1] = { ...hist[hist.length - 1], resubmittedAt: now };
    update({
      status: 'SUBMITTED',
      rejectedBy: undefined,
      rejectedAt: undefined,
      rejectionReason: undefined,
      rejectedByRole: undefined,
      submittedAt: now,
      revisionHistory: hist,
    });
  };

  // Canonical approved PR detection for current project
  const canonicalApprovedPr = useMemo(() => {
    return null;
  }, []);

  if (!state) return null;

  const status = effectiveStatus;
  const isDuplicateActivePr = Boolean(canonicalApprovedPr && status !== 'APPROVED');

  const showFinanceActions =
    canActAsFinance &&
    status === 'SUBMITTED' &&
    (!activeTask || activeTask.nodeId === 'node_finance_review') &&
    !isDuplicateActivePr;

  const showDirectorActions =
    canActAsDirector &&
    status === 'DIRECTOR_APPROVAL' &&
    (!activeTask || activeTask.nodeId === 'node_director_approval') &&
    !isDuplicateActivePr;

  const showProcRevise =
    canActAsProcurement &&
    status === 'REJECTED_TO_PROCUREMENT' &&
    (!activeTask || activeTask.nodeId === 'node_procurement_revision') &&
    !isDuplicateActivePr;

  const borderColor =
    status === 'APPROVED' || status === 'PO_ISSUED'
      ? '#86efac'
      : status === 'REJECTED_TO_PROCUREMENT'
      ? '#fca5a5'
      : status === 'DIRECTOR_APPROVAL'
      ? '#c4b5fd'
      : '#bfdbfe';

  const bgColor =
    status === 'APPROVED' || status === 'PO_ISSUED'
      ? '#f0fdf4'
      : status === 'REJECTED_TO_PROCUREMENT'
      ? '#fef2f2'
      : status === 'DIRECTOR_APPROVAL'
      ? '#faf5ff'
      : '#eff6ff';

  return (
    <div style={{ marginTop: 12 }}>
      {/* ── Main PR Approval Card ── */}
      <Card
        size="small"
        style={{ borderRadius: 10, border: `1.5px solid ${borderColor}`, background: bgColor }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space size={8}>
              <AuditOutlined style={{ color: '#1d4ed8' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                PR Approval Workflow — {prNumber}
              </span>
            </Space>
            <PrStatusBadge status={status} />
          </div>
        }
      >
        {/* ── 4-Step Tracker ── */}
        <PrApprovalTracker status={status} instance={instance} />
        <Divider style={{ margin: '10px 0' }} />

        {/* ── PR Summary & References (Finance / Director Review Info) ── */}
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ fontSize: 11.5 }}>
          <Descriptions.Item label="Nomor PR">
            <Text strong>{prNumber}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Proyek">
            <Text strong>{projectName}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Total Pengajuan PR">
            <Text strong style={{ color: '#1d4ed8', fontSize: 12.5 }}>
              Rp {Number(totalAmount).toLocaleString('id-ID')}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Alokasi Budget WBS">
            <Text style={{ color: '#059669', fontWeight: 600 }}>
              Rp {Number(state.budgetAllocation || budgetAllocation || totalAmount).toLocaleString('id-ID')}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="WBS Reference">
            <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 10.5, margin: 0 }}>
              {state.wbsTaskName || wbsTaskName || 'WBS Pengadaan Material'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Op. Plan Gate">
            <Tag color="gold" style={{ fontSize: 10.5, margin: 0 }}>
              {state.opPlanRef || opPlanRef || `OP-${projectId}`} (Approved by HOA)
            </Tag>
          </Descriptions.Item>
          {(instance?.createdAt || state.submittedAt) && (
            <Descriptions.Item label="Diajukan oleh">
              <Text type="secondary">
                {state.submittedBy || 'Procurement Team'} ({dayjs(instance?.createdAt || state.submittedAt).format('DD/MM HH:mm')})
              </Text>
            </Descriptions.Item>
          )}
          {state.financeReviewedAt && (
            <Descriptions.Item label="Finance Review">
              <Text type="secondary">
                {state.financeReviewedBy} ({dayjs(state.financeReviewedAt).format('DD/MM HH:mm')})
              </Text>
            </Descriptions.Item>
          )}
          {state.directorDecisionAt && (
            <Descriptions.Item label="Director Approval">
              <Text type="secondary">
                {state.directorDecisionBy} ({dayjs(state.directorDecisionAt).format('DD/MM HH:mm')})
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* ── Items preview ── */}
        {items.length > 0 && (
          <>
            <Divider style={{ margin: '8px 0', fontSize: 11 }}>Rincian Item Pengadaan ({items.length} item)</Divider>
            <div style={{ maxHeight: 110, overflowY: 'auto' }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    padding: '2px 6px',
                    background: i % 2 === 0 ? '#f8fafc' : '#fff',
                    borderRadius: 3,
                  }}
                >
                  <span>{item.itemName} × {item.quantity}</span>
                  <span style={{ fontWeight: 600, color: '#1d4ed8' }}>
                    Rp {(item.quantity * item.estimatedUnitPrice).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Rejection Alert ── */}
        {status === 'REJECTED_TO_PROCUREMENT' && state.rejectionReason && (
          <>
            <Divider style={{ margin: '10px 0' }} />
            <Alert
              type="error"
              showIcon
              message={
                <span style={{ fontWeight: 700, fontSize: 12 }}>
                  Ditolak oleh {state.rejectedByRole === 'FINANCE' ? 'Finance Team (Financial Review)' : 'Director (Final Authority)'}
                </span>
              }
              description={
                <div>
                  <div style={{ fontSize: 11.5 }}>
                    <strong>Alasan:</strong> {state.rejectionReason}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                    oleh {state.rejectedBy} — {state.rejectedAt ? dayjs(state.rejectedAt).format('DD MMM YYYY HH:mm') : ''}
                  </div>
                </div>
              }
              style={{ borderRadius: 6 }}
            />
          </>
        )}

        {/* ── Approval Alert ── */}
        {(status === 'APPROVED' || status === 'PO_ISSUED') && (
          <>
            <Divider style={{ margin: '10px 0' }} />
            <Alert
              type="success"
              showIcon
              icon={<SafetyCertificateOutlined />}
              message={
                <span style={{ fontWeight: 700, fontSize: 12 }}>
                  {status === 'PO_ISSUED'
                    ? 'PR Disetujui Penuh & PO Telah Diterbitkan'
                    : 'PR Disetujui — Siap Proses RFQ / Vendor / PO'}
                </span>
              }
              description={
                <div style={{ fontSize: 11.5 }}>
                  <div>
                    Disetujui oleh {state.directorDecisionBy || 'Director'} pada{' '}
                    {state.directorDecisionAt ? dayjs(state.directorDecisionAt).format('DD MMM YYYY HH:mm') : ''}.
                    {status === 'PO_ISSUED'
                      ? ' Seluruh tahapan persetujuan telah selesai dan Purchase Order telah resmi diterbitkan.'
                      : ' Procurement Team dapat melanjutkan ke penerbitan RFQ, perbandingan vendor, dan Purchase Order (PO).'}
                  </div>
                  {status !== 'PO_ISSUED' && canActAsProcurement && onCreateRfqClick && (
                    <div style={{ marginTop: 10 }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<SendOutlined />}
                        onClick={onCreateRfqClick}
                        style={{
                          backgroundColor: '#059669',
                          borderColor: '#059669',
                          fontWeight: 600,
                          borderRadius: 6,
                          fontSize: 11.5,
                        }}
                      >
                        Buat RFQ
                      </Button>
                    </div>
                  )}
                </div>
              }
              style={{ borderRadius: 6 }}
            />
          </>
        )}

        {/* ── Riwayat Proses Pengadaan (Business-Friendly View) ── */}
        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space size={6}>
              <HistoryOutlined style={{ color: '#2563eb', fontSize: 13 }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                Riwayat Proses Pengadaan
              </span>
            </Space>
            {isSuperAdmin && transitions.length > 0 && (
              <Button
                size="small"
                type="link"
                onClick={() => setShowTechnicalDetails((p) => !p)}
                style={{ fontSize: 10.5, padding: 0, height: 'auto', color: '#64748b' }}
              >
                {showTechnicalDetails ? 'Sembunyikan Teknis' : 'Detail Teknis (Admin)'}
              </Button>
            )}
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {businessWorkflowEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: ev.note ? 'flex-start' : 'center',
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: ev.isPending ? '#faf5ff' : ev.statusTag.color === 'error' ? '#fef2f2' : '#ffffff',
                  border: `1px solid ${ev.isPending ? '#e9d5ff' : ev.statusTag.color === 'error' ? '#fecaca' : '#e2e8f0'}`,
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Tag color={ev.statusTag.color} style={{ fontWeight: 700, fontSize: 9.5, margin: 0, padding: '0 6px', lineHeight: '18px', borderRadius: 4 }}>
                      {ev.statusTag.label}
                    </Tag>
                    <span style={{ color: ev.isPending ? '#6b21a8' : '#0f172a', fontWeight: 700, fontSize: 11.5 }}>
                      {ev.title}
                    </span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span style={{ color: '#475569', fontSize: 11 }}>
                      Oleh: <strong>{ev.actor}</strong>
                    </span>
                    {ev.prRef && (
                      <Tag color="blue" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                        PR: {ev.prRef}
                      </Tag>
                    )}
                  </div>
                  {ev.note && (
                    <div style={{ fontSize: 11, color: ev.isPending ? '#7e22ce' : ev.statusTag.color === 'error' ? '#991b1b' : '#334155', fontStyle: 'italic', paddingLeft: 2, marginTop: 2 }}>
                      {ev.note}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: ev.isPending ? '#7e22ce' : '#64748b', whiteSpace: 'nowrap', fontWeight: ev.isPending ? 600 : 400 }}>
                  {ev.formattedTime}
                </div>
              </div>
            ))}
          </div>

          {/* Optional Admin Technical Audit Drawer/Collapse */}
          {isSuperAdmin && showTechnicalDetails && transitions.length > 0 && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#f1f5f9', borderRadius: 6, border: '1px dashed #cbd5e1', fontSize: 10.5 }}>
              <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>Audit Jejak Teknis Workflow Engine:</div>
              {transitions.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
                  <span>Transition #{t.id}: {t.action} ({t.fromNodeId} → {t.toNodeId})</span>
                  <span>{dayjs(t.createdAt).format('HH:mm:ss')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Divider style={{ margin: '10px 0' }} />

        {/* ── Duplicate Active PR Warning Alert ── */}
        {isDuplicateActivePr && canonicalApprovedPr && (
          <Alert
            type="warning"
            showIcon
            message={
              <span style={{ fontWeight: 700, fontSize: 12 }}>
                DUPLICATE PR — PERSETUJUAN DIKUNCI
              </span>
            }
            description={
              <div style={{ fontSize: 11.5 }}>
                Item pada pengajuan ini sudah tercakup pada Purchase Request canonical{' '}
                <strong>{canonicalApprovedPr.prNumber || canonicalApprovedPr.prId}</strong> yang telah{' '}
                <strong>Disetujui (APPROVED)</strong>. Aksi persetujuan (Finance / Director) pada duplicate PR ini
                dinonaktifkan untuk menjaga integritas pagu anggaran proyek.
              </div>
            }
            style={{ borderRadius: 6, marginBottom: 12, border: '1px solid #fde047', background: '#fefce8' }}
          />
        )}

        {/* ── ROLE-SPECIFIC ACTION BAR ── */}

        {/* Info when user cannot take action at this state */}
        {status === 'SUBMITTED' && !canActAsFinance && !isDuplicateActivePr && (
          <Alert
            type="info"
            showIcon
            icon={<ClockCircleFilled />}
            message={
              <span style={{ fontSize: 11.5 }}>
                PR sedang dalam tahap <strong>Financial Review oleh Finance Team</strong>. Menunggu pemeriksaan anggaran dan kelayakan finansial.
              </span>
            }
            style={{ borderRadius: 6 }}
          />
        )}

        {status === 'DIRECTOR_APPROVAL' && !canActAsDirector && (
          <Alert
            type="info"
            showIcon
            icon={<ClockCircleFilled />}
            message={
              <span style={{ fontSize: 11.5 }}>
                PR telah disetujui Finance dan sedang <strong>Menunggu Final Approval Director</strong>.
              </span>
            }
            style={{ borderRadius: 6 }}
          />
        )}

        {/* PROCUREMENT Actions: Resubmit after rejection */}
        {showProcRevise && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
              PR perlu diperbaiki sesuai catatan sebelum diajukan kembali.
            </span>
            <Button
              type="primary"
              icon={<RollbackOutlined />}
              onClick={handleResubmit}
              style={{ backgroundColor: '#1d4ed8', borderRadius: 6, fontWeight: 600, fontSize: 12 }}
            >
              Perbaiki &amp; Submit Ulang
            </Button>
          </div>
        )}

        {/* FINANCE Actions */}
        {showFinanceActions && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#1e40af', fontWeight: 600 }}>
              Aksi Finance: Lakukan evaluasi anggaran WBS sebelum memutuskan.
            </span>
            <Space>
              <Button
                danger
                icon={<RollbackOutlined />}
                onClick={() => {
                  setRejectRole('FINANCE');
                  form.resetFields();
                  setRejectOpen(true);
                }}
                style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
              >
                Tolak &amp; Kembalikan ke Procurement
              </Button>
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={() => setFinancePassOpen(true)}
                style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', borderRadius: 6, fontWeight: 600, fontSize: 12 }}
              >
                Lanjutkan ke Director
              </Button>
            </Space>
          </div>
        )}

        {/* DIRECTOR Actions */}
        {showDirectorActions && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#7c3aed', fontWeight: 600 }}>
              Aksi Director: Keputusan Otorisasi Final Pengadaan.
            </span>
            <Space>
              <Button
                danger
                icon={<RollbackOutlined />}
                onClick={() => {
                  setRejectRole('DIRECTOR');
                  form.resetFields();
                  setRejectOpen(true);
                }}
                style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
              >
                Tolak &amp; Kembalikan ke Procurement
              </Button>
              <Button
                type="primary"
                icon={<SafetyCertificateOutlined />}
                onClick={() => setDirApproveOpen(true)}
                style={{ backgroundColor: '#059669', borderColor: '#059669', borderRadius: 6, fontWeight: 600, fontSize: 12 }}
              >
                Approve PR
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {/* ── Reject Modal (Finance / Director) ── */}
      <Modal
        open={rejectOpen}
        title={
          <Space>
            <ExclamationCircleFilled style={{ color: '#dc2626' }} />
            <span>
              {rejectRole === 'FINANCE'
                ? 'Tolak & Kembalikan ke Procurement (Finance Review)'
                : 'Tolak & Kembalikan ke Procurement (Director Final Authority)'}
            </span>
          </Space>
        }
        onCancel={() => {
          setRejectOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleRejectSubmit}>
          <Alert
            type="warning"
            showIcon
            message="PR akan dikembalikan ke Procurement Team dengan status 'Ditolak & Dikembalikan ke Procurement'."
            style={{ marginBottom: 16, borderRadius: 6 }}
          />
          <Form.Item
            name="reason"
            label="Alasan Pengembalian / Catatan Perbaikan"
            rules={[{ required: true, message: 'Alasan pengembalian wajib diisi.' }]}
          >
            <TextArea
              rows={4}
              placeholder={
                rejectRole === 'FINANCE'
                  ? 'Contoh: Total PR melebihi alokasi sisa budget WBS. Mohon sesuaikan kuantitas atau harga satuan...'
                  : 'Contoh: Diperlukan justifikasi tambahan dari PM untuk item pengadaan peralatan server ini...'
              }
            />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRejectOpen(false)}>Batal</Button>
            <Button type="primary" danger htmlType="submit" icon={<RollbackOutlined />}>
              Kembalikan ke Procurement
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Finance Pass Modal ── */}
      <Modal
        open={financePassOpen}
        title={
          <Space>
            <ArrowRightOutlined style={{ color: '#7c3aed' }} />
            <span>Lanjutkan PR ke Director untuk Final Approval?</span>
          </Space>
        }
        onCancel={() => setFinancePassOpen(false)}
        footer={null}
        width={460}
      >
        <Alert
          type="info"
          showIcon
          message="Dengan melanjutkan, Finance memverifikasi bahwa anggaran WBS mencukupi dan siap diputuskan oleh Director."
          style={{ marginBottom: 16, borderRadius: 6 }}
        />
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="PR">{prNumber}</Descriptions.Item>
          <Descriptions.Item label="Total Pengajuan">Rp {Number(totalAmount).toLocaleString('id-ID')}</Descriptions.Item>
          <Descriptions.Item label="Alokasi Budget WBS">Rp {Number(budgetAllocation || totalAmount).toLocaleString('id-ID')}</Descriptions.Item>
        </Descriptions>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => setFinancePassOpen(false)}>Batal</Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={handleFinancePass}
            style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
          >
            Konfirmasi — Lanjutkan ke Director
          </Button>
        </div>
      </Modal>

      {/* ── Director Approve Modal ── */}
      <Modal
        open={dirApproveOpen}
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#059669' }} />
            <span>Final Approval PR — Konfirmasi</span>
          </Space>
        }
        onCancel={() => setDirApproveOpen(false)}
        footer={null}
        width={460}
      >
        <Alert
          type="success"
          showIcon
          message="PR akan disetujui secara final. Hak penerbitan RFQ, Vendor Comparison, dan PO akan dibuka untuk Procurement."
          style={{ marginBottom: 16, borderRadius: 6 }}
        />
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="PR">{prNumber}</Descriptions.Item>
          <Descriptions.Item label="Total PR">Rp {Number(totalAmount).toLocaleString('id-ID')}</Descriptions.Item>
          <Descriptions.Item label="Diverifikasi Finance">{state.financeReviewedBy || currentUserName}</Descriptions.Item>
        </Descriptions>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => setDirApproveOpen(false)}>Batal</Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={handleDirectorApprove}
            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
          >
            Approve PR
          </Button>
        </div>
      </Modal>
    </div>
  );
};
