'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Descriptions,
  Alert,
  Table,
  Skeleton,
  Empty,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  ArrowRightOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  SendOutlined,
  EyeOutlined,
  HistoryOutlined,
  FileTextOutlined,
  CloseOutlined,
  ShoppingOutlined,
  UserOutlined,
  CalendarOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import WorkflowEngineService, {
  WorkflowInstance,
  WorkflowTask,
  WorkflowTransition,
} from '@/services/workflowEngine.service';
import { ProcurementService, PurchaseRequest } from '@/services/procurement.service';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import {
  PrApprovalStatus,
  StepState,
  WorkflowStepPresentation,
  BusinessWorkflowEvent,
  PrItemPresentation,
  resolvePrStatusConfig,
  deriveWorkflowSteps,
  formatPrInfoPresentation,
  resolveRfqCta,
  deriveWorkflowHistoryEvents,
  derivePrItemsMetrics,
} from './prApprovalWorkflow.utils';
import styles from './PrApprovalWorkflow.module.css';

const { Text } = Typography;
const { TextArea } = Input;

export type { PrApprovalStatus };

export interface PrApprovalState {
  prId: string | number;
  prNumber: string;
  projectId: string | number;
  projectName: string;
  totalAmount?: number | null;
  status: PrApprovalStatus;
  budgetAllocation?: number | null;
  wbsTaskName?: string | null;
  opPlanRef?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  financeReviewedBy?: string | null;
  financeReviewedAt?: string | null;
  financeAction?: 'PASSED_TO_DIRECTOR' | 'REJECTED';
  directorDecisionBy?: string | null;
  directorDecisionAt?: string | null;
  directorAction?: 'APPROVED' | 'REJECTED';
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
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
  const cfg = resolvePrStatusConfig(status);
  const isApproved = status === 'APPROVED' || status === 'PO_ISSUED';
  const isRejected = status === 'REJECTED_TO_PROCUREMENT';

  return (
    <Tag
      icon={
        isApproved ? (
          <CheckCircleFilled style={{ color: cfg.color }} />
        ) : isRejected ? (
          <ExclamationCircleFilled style={{ color: cfg.color }} />
        ) : (
          <ClockCircleFilled style={{ color: cfg.color }} />
        )
      }
      style={{
        color: cfg.color,
        border: `1px solid ${cfg.borderColor}`,
        background: cfg.bgColor,
        fontWeight: 600,
        fontSize: 12,
        padding: '3px 10px',
        borderRadius: 20,
        margin: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {cfg.label}
    </Tag>
  );
}

// ─────────────────────────────────────────────
// 4-Step Connected Stepper
// ─────────────────────────────────────────────
export function PrApprovalTracker({
  status,
  instance,
  transitions = [],
  activeRfq,
}: {
  status: PrApprovalStatus;
  instance?: WorkflowInstance | null;
  transitions?: WorkflowTransition[];
  activeRfq?: any;
}) {
  const steps = useMemo(
    () =>
      deriveWorkflowSteps({
        status,
        instance,
        transitions,
        activeRfq,
      }),
    [status, instance, transitions, activeRfq],
  );

  return (
    <div className={styles.stepperRow}>
      {steps.map((step, idx) => {
        let circleClass = styles.stepCirclePending;
        let iconContent: React.ReactNode = step.stepNumber;

        if (step.state === 'COMPLETED') {
          circleClass = styles.stepCircleCompleted;
          iconContent = <CheckCircleFilled style={{ fontSize: 14 }} />;
        } else if (step.state === 'ACTIVE') {
          circleClass = styles.stepCircleActive;
          iconContent = step.stepNumber;
        } else if (step.state === 'REJECTED') {
          circleClass = styles.stepCircleRejected;
          iconContent = <RollbackOutlined style={{ fontSize: 13 }} />;
        }

        const isLineActive = step.state === 'COMPLETED';

        return (
          <React.Fragment key={step.key}>
            <div className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${circleClass}`}>{iconContent}</div>
              <div className={styles.stepContent}>
                <span
                  className={`${styles.stepRole} ${
                    step.state === 'ACTIVE' ? styles.stepRoleActive : ''
                  }`}
                >
                  {step.role}
                </span>
                <span className={styles.stepTitle} title={step.label}>
                  {step.label}
                </span>
                <Tag
                  color={step.tagColor}
                  style={{
                    fontSize: 10,
                    margin: '2px 0 0',
                    padding: '0 6px',
                    fontWeight: 600,
                    borderRadius: 4,
                    lineHeight: '16px',
                    width: 'fit-content',
                  }}
                >
                  {step.statusLabel}
                </Tag>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`${styles.stepConnector} ${
                  isLineActive ? styles.stepConnectorCompleted : ''
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface PrApprovalWorkflowProps {
  prId: string | number;
  prNumber?: string;
  projectId?: string | number;
  projectName?: string;
  totalAmount?: number | null;
  customerName?: string;
  budgetAllocation?: number | null;
  wbsTaskName?: string | null;
  opPlanRef?: string | null;
  items?: PrItemPresentation[];
  isProcurement?: boolean;
  isFinance?: boolean;
  isDirector?: boolean;
  isSuperAdmin?: boolean;
  initialStatus?: PrApprovalStatus;
  currentUserName?: string;
  onClose?: () => void;
  onStatusChange?: (newStatus: PrApprovalStatus) => void;
  onCreateRfqClick?: () => void;
  activeRfq?: any;
  latestRfq?: any;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const PrApprovalWorkflow: React.FC<PrApprovalWorkflowProps> = ({
  prId,
  prNumber: initialPrNumber,
  projectId: initialProjectId,
  projectName: initialProjectName,
  totalAmount: initialTotalAmount,
  customerName,
  budgetAllocation: initialBudgetAllocation,
  wbsTaskName: initialWbsTaskName,
  opPlanRef: initialOpPlanRef,
  items: initialItems,
  initialStatus = 'SUBMITTED',
  isProcurement = false,
  isFinance = false,
  isDirector = false,
  isSuperAdmin = false,
  currentUserName,
  onClose,
  onStatusChange,
  onCreateRfqClick,
  activeRfq,
  latestRfq,
}) => {
  const [state, setState] = useState<PrApprovalState | null>(null);
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [fetchedPr, setFetchedPr] = useState<PurchaseRequest | null>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [financePassOpen, setFinancePassOpen] = useState(false);
  const [dirApproveOpen, setDirApproveOpen] = useState(false);
  const [rejectRole, setRejectRole] = useState<'FINANCE' | 'DIRECTOR'>('FINANCE');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [form] = Form.useForm();

  // Load authoritative workflow and PR data
  const loadWorkflowData = useCallback(async () => {
    if (!prId) return;
    setLoadingWorkflow(true);
    setWorkflowError(null);

    try {
      // 1. Fetch workflow instance and transitions concurrently with authoritative PR record if needed
      const [rawInst, prResult] = await Promise.allSettled([
        WorkflowEngineService.getInstanceByEntity('PURCHASE_REQUEST', prId),
        !initialItems || initialItems.length === 0 || !initialProjectName
          ? ProcurementService.getPurchaseRequestById(Number(prId))
          : Promise.resolve(null),
      ]);

      let currentInst: WorkflowInstance | null = null;
      if (rawInst.status === 'fulfilled') {
        const payload = rawInst.value;
        currentInst = (payload as any)?.data?.id ? (payload as any).data : payload;
        if (currentInst && currentInst.id) {
          setInstance(currentInst);
          const trans = await WorkflowEngineService.getTransitions(currentInst.id);
          setTransitions(trans || []);

          // Extract start transition (initial submission)
          const startTrans = trans.find(
            (t) => t.action === 'START' || t.fromNodeId === 'node_start',
          );

          // Extract completed reviewer decisions
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
              submittedAt: startTrans?.createdAt || currentInst?.createdAt || prev.submittedAt,
              submittedBy: startTrans?.actor?.fullName || startTrans?.actor?.email || prev.submittedBy || null,
              ...(financeTrans
                ? {
                    financeReviewedBy: financeTrans.actor?.fullName || financeTrans.actor?.email || null,
                    financeReviewedAt: financeTrans.createdAt,
                    financeAction: 'PASSED_TO_DIRECTOR',
                  }
                : {}),
              ...(directorTrans
                ? {
                    directorDecisionBy: directorTrans.actor?.fullName || directorTrans.actor?.email || null,
                    directorDecisionAt: directorTrans.createdAt,
                    directorAction: 'APPROVED',
                  }
                : {}),
            };
          });
        }
      }

      if (prResult.status === 'fulfilled' && prResult.value) {
        setFetchedPr(prResult.value);
      }
    } catch (err: any) {
      console.warn('Failed to load workflow instance:', err);
      setWorkflowError(err?.message || 'Gagal memuat status workflow pengadaan');
    } finally {
      setLoadingWorkflow(false);
    }
  }, [prId, initialItems, initialProjectName]);

  const load = useCallback(() => {
    const init: PrApprovalState = {
      prId,
      prNumber: initialPrNumber || '',
      projectId: initialProjectId || prId,
      projectName: initialProjectName || '',
      totalAmount: initialTotalAmount != null ? Number(initialTotalAmount) : null,
      budgetAllocation: initialBudgetAllocation != null ? Number(initialBudgetAllocation) : null,
      wbsTaskName: initialWbsTaskName || null,
      opPlanRef: initialOpPlanRef || null,
      status: initialStatus || 'SUBMITTED',
      submittedBy: null,
      submittedAt: null,
      revisionHistory: [],
    };
    setState(init);
    loadWorkflowData();
  }, [
    prId,
    initialPrNumber,
    initialProjectId,
    initialProjectName,
    initialTotalAmount,
    initialBudgetAllocation,
    initialWbsTaskName,
    initialOpPlanRef,
    initialStatus,
    loadWorkflowData,
  ]);

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
      if (
        activeTask?.nodeId === 'node_director_approval' ||
        instance.currentNodeId === 'node_director_approval'
      )
        return 'DIRECTOR_APPROVAL';
      if (
        activeTask?.nodeId === 'node_procurement_revision' ||
        instance.currentNodeId === 'node_procurement_revision'
      )
        return 'REJECTED_TO_PROCUREMENT';
      if (
        activeTask?.nodeId === 'node_finance_review' ||
        instance.currentNodeId === 'node_finance_review'
      )
        return 'SUBMITTED';
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

  const canActAsProcurement = effectiveRole === 'PROCUREMENT';
  const canActAsFinance = effectiveRole === 'FINANCE';
  const canActAsDirector = effectiveRole === 'DIRECTOR';

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
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rejectedByRole: undefined,
      submittedAt: now,
      revisionHistory: hist,
    });
  };

  // ── Effective Items, Amounts, Project Name Hydration ──
  const effectiveItems: PrItemPresentation[] = useMemo(() => {
    if (initialItems && initialItems.length > 0) return initialItems;
    if (fetchedPr?.items && fetchedPr.items.length > 0) {
      return fetchedPr.items.map((it) => ({
        id: it.id,
        itemName: it.itemName,
        quantity: Number(it.quantity) || 0,
        uom: it.uom,
        estimatedUnitPrice: it.estimatedUnitPrice ? Number(it.estimatedUnitPrice) : undefined,
        totalPrice:
          (it as any).totalPrice != null
            ? Number((it as any).totalPrice)
            : it.estimatedUnitPrice != null && it.quantity != null
            ? Number(it.quantity) * Number(it.estimatedUnitPrice)
            : undefined,
      }));
    }
    return [];
  }, [initialItems, fetchedPr]);

  const effectiveTotalAmount = useMemo(() => {
    if (initialTotalAmount != null && !isNaN(Number(initialTotalAmount))) {
      return Number(initialTotalAmount);
    }
    if (fetchedPr?.totalEstimatedAmount != null) {
      return Number(fetchedPr.totalEstimatedAmount);
    }
    if (effectiveItems.length > 0) {
      return effectiveItems.reduce((acc, it) => {
        const val =
          it.totalPrice != null
            ? Number(it.totalPrice)
            : it.estimatedUnitPrice != null
            ? Number(it.quantity) * Number(it.estimatedUnitPrice)
            : 0;
        return acc + val;
      }, 0);
    }
    return null;
  }, [initialTotalAmount, fetchedPr, effectiveItems]);

  const effectiveProjectName = useMemo(() => {
    if (initialProjectName && initialProjectName.trim()) return initialProjectName.trim();
    if (fetchedPr?.project?.name) return fetchedPr.project.name.trim();
    if (fetchedPr?.projectName) return fetchedPr.projectName.trim();
    return '';
  }, [initialProjectName, fetchedPr]);

  const effectivePrNumber = useMemo(() => {
    if (initialPrNumber && initialPrNumber.trim()) return initialPrNumber.trim();
    if (fetchedPr?.prNumber) return fetchedPr.prNumber.trim();
    return 'Belum ada data';
  }, [initialPrNumber, fetchedPr]);

  // Derive Info Presentation
  const infoPresentation = useMemo(() => {
    return formatPrInfoPresentation({
      prNumber: effectivePrNumber,
      prId,
      projectName: effectiveProjectName,
      totalAmount: effectiveTotalAmount,
      budgetAllocation: state?.budgetAllocation ?? initialBudgetAllocation,
      wbsTaskName: state?.wbsTaskName ?? initialWbsTaskName,
      opPlanRef: state?.opPlanRef ?? initialOpPlanRef,
      submittedBy: state?.submittedBy,
      submittedAt: state?.submittedAt,
      financeReviewedBy: state?.financeReviewedBy,
      financeReviewedAt: state?.financeReviewedAt,
      directorDecisionBy: state?.directorDecisionBy,
      directorDecisionAt: state?.directorDecisionAt,
    });
  }, [
    effectivePrNumber,
    prId,
    effectiveProjectName,
    effectiveTotalAmount,
    state,
    initialBudgetAllocation,
    initialWbsTaskName,
    initialOpPlanRef,
  ]);

  // Derive PR Items Metrics
  const itemsMetrics = useMemo(
    () => derivePrItemsMetrics(effectiveItems),
    [effectiveItems],
  );

  // Derive History Events
  const historyEvents = useMemo(() => {
    return deriveWorkflowHistoryEvents({
      instance,
      transitions,
      prNumber: effectivePrNumber,
      prId,
      submittedBy: state?.submittedBy || undefined,
      submittedAt: state?.submittedAt || undefined,
      effectiveStatus,
      revisionHistory: state?.revisionHistory,
    });
  }, [instance, transitions, effectivePrNumber, prId, state, effectiveStatus]);

  // RFQ CTA Resolution
  const rfqCta = useMemo(() => resolveRfqCta(activeRfq, latestRfq), [activeRfq, latestRfq]);

  if (!state) return null;

  const status = effectiveStatus;

  const showFinanceActions =
    canActAsFinance &&
    status === 'SUBMITTED' &&
    (!activeTask || activeTask.nodeId === 'node_finance_review');

  const showDirectorActions =
    canActAsDirector &&
    status === 'DIRECTOR_APPROVAL' &&
    (!activeTask || activeTask.nodeId === 'node_director_approval');

  const showProcRevise =
    canActAsProcurement &&
    status === 'REJECTED_TO_PROCUREMENT' &&
    (!activeTask || activeTask.nodeId === 'node_procurement_revision');

  // Columns for PR items table
  const itemTableColumns = [
    {
      title: 'No.',
      key: 'no',
      width: 50,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Deskripsi Item',
      dataIndex: 'itemName',
      key: 'itemName',
      width: '46%',
      render: (text: string) => (
        <span
          style={{
            fontWeight: 500,
            color: '#1e293b',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            lineHeight: 1.45,
            display: 'inline-block',
          }}
        >
          {text || 'Belum ada data'}
        </span>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: '8%',
      align: 'right' as const,
      render: (q: number) => formatNumber(q, { fallback: '0' }),
    },
    ...(itemsMetrics.hasUom
      ? [
          {
            title: 'Satuan',
            dataIndex: 'uom',
            key: 'uom',
            width: '10%',
            align: 'center' as const,
            render: (u: string) => (
              <Tag style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>{u || '-'}</Tag>
            ),
          },
        ]
      : []),
    ...(itemsMetrics.hasUnitPrice
      ? [
          {
            title: 'Harga Satuan',
            dataIndex: 'estimatedUnitPrice',
            key: 'estimatedUnitPrice',
            width: '16%',
            align: 'right' as const,
            render: (p: number) =>
              p != null && p > 0 ? formatCurrency(p, { fallback: '-' }) : '-',
          },
        ]
      : []),
    ...(itemsMetrics.hasSubtotal
      ? [
          {
            title: 'Subtotal',
            key: 'subtotal',
            width: '18%',
            align: 'right' as const,
            render: (_: any, record: PrItemPresentation) => {
              const sub =
                record.totalPrice != null
                  ? record.totalPrice
                  : record.quantity != null && record.estimatedUnitPrice != null
                  ? Number(record.quantity) * Number(record.estimatedUnitPrice)
                  : null;
              return (
                <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
                  {formatCurrency(sub, { fallback: '-' })}
                </span>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className={styles.workflowModalContainer}>
      {/* ── MODAL HEADER ── */}
      <div className={styles.modalHeader}>
        <div className={styles.modalHeaderLeft}>
          <FileTextOutlined className={styles.modalHeaderIcon} />
          <span className={styles.modalHeaderTitle}>
            PR Approval Workflow — {infoPresentation.prNumber}
          </span>
        </div>
        <div className={styles.modalHeaderRight}>
          <PrStatusBadge status={status} />
          {onClose && (
            <button
              type="button"
              className={`${styles.modalCloseBtn} ant-modal-close`}
              onClick={onClose}
              aria-label="Close"
              title="Tutup Modal"
            >
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── WORKFLOW STEPPER ── */}
      <div className={styles.stepperContainer}>
        <PrApprovalTracker
          status={status}
          instance={instance}
          transitions={transitions}
          activeRfq={activeRfq}
        />
      </div>

      {/* ── MODAL BODY ── */}
      <div className={styles.modalBody}>
        {loadingWorkflow && (
          <div style={{ padding: '12px 4px' }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        )}

        {workflowError && (
          <Alert
            type="error"
            showIcon
            message={workflowError}
            style={{ borderRadius: 8 }}
          />
        )}

        {/* ── INFORMASI PENGAJUAN PR CARD (3-Column Layout) ── */}
        <div className={styles.cardSurface}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <FolderOpenOutlined style={{ color: '#2563eb' }} />
              <span>Informasi Pengajuan PR</span>
            </div>
          </div>

          <div className={styles.infoGrid}>
            {/* Column 1 */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nomor PR</span>
              <span
                className={
                  infoPresentation.prNumber === 'Belum ada data'
                    ? styles.infoValueMuted
                    : styles.infoValue
                }
              >
                {infoPresentation.prNumber}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Proyek</span>
              <span
                className={
                  infoPresentation.projectName === 'Belum ada data'
                    ? styles.infoValueMuted
                    : styles.infoValue
                }
              >
                {infoPresentation.projectName}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Total Pengajuan PR</span>
              <span
                className={
                  infoPresentation.totalAmountText === 'N/A'
                    ? styles.infoValueMuted
                    : `${styles.infoValue} ${styles.infoValueAmount}`
                }
              >
                {infoPresentation.totalAmountText}
              </span>
            </div>

            {/* Column 2 */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Alokasi Budget WBS</span>
              <span
                className={
                  infoPresentation.budgetAllocationText === 'N/A'
                    ? styles.infoValueMuted
                    : `${styles.infoValue} ${styles.infoValueBudget}`
                }
              >
                {infoPresentation.budgetAllocationText}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>WBS Reference</span>
              {infoPresentation.hasWbsReference ? (
                <Tag
                  color="cyan"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    margin: 0,
                    width: 'fit-content',
                    borderRadius: 4,
                  }}
                >
                  {infoPresentation.wbsReferenceText}
                </Tag>
              ) : (
                <span className={styles.infoValueMuted}>
                  {infoPresentation.wbsReferenceText}
                </span>
              )}
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Gate</span>
              {infoPresentation.hasGate ? (
                <Tag
                  color="gold"
                  style={{
                    fontSize: 11,
                    margin: 0,
                    width: 'fit-content',
                    borderRadius: 4,
                  }}
                >
                  {infoPresentation.gateText}
                </Tag>
              ) : (
                <span className={styles.infoValueMuted}>
                  {infoPresentation.gateText}
                </span>
              )}
            </div>

            {/* Column 3 */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Diajukan oleh</span>
              <span
                className={
                  infoPresentation.submittedByText === 'N/A'
                    ? styles.infoValueMuted
                    : styles.infoValue
                }
              >
                {infoPresentation.submittedByText}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Finance Review</span>
              <span
                className={
                  infoPresentation.financeReviewText === 'Belum ada data'
                    ? styles.infoValueMuted
                    : styles.infoValue
                }
              >
                {infoPresentation.financeReviewText}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Director Approval</span>
              <span
                className={
                  infoPresentation.directorApprovalText === 'Belum ada data'
                    ? styles.infoValueMuted
                    : styles.infoValue
                }
              >
                {infoPresentation.directorApprovalText}
              </span>
            </div>
          </div>
        </div>

        {/* ── CURRENT ACTION / STATUS CARD ── */}
        {(status === 'APPROVED' || status === 'PO_ISSUED') && (
          <div className={`${styles.actionBanner} ${styles.actionBannerApproved}`}>
            <div className={styles.actionBannerContent}>
              <CheckCircleFilled
                className={styles.actionBannerIcon}
                style={{ color: '#059669' }}
              />
              <div className={styles.actionBannerText}>
                <span className={styles.actionBannerTitle}>
                  {status === 'PO_ISSUED'
                    ? 'PR Disetujui Penuh & PO Telah Diterbitkan'
                    : 'PR Disetujui — Siap Proses RFQ / Vendor / PO'}
                </span>
                <span className={styles.actionBannerDesc}>
                  Disetujui oleh {state.directorDecisionBy || 'Director'} pada{' '}
                  {state.directorDecisionAt
                    ? dayjs(state.directorDecisionAt).format('DD MMM YYYY HH:mm')
                    : '-'}.
                  {status === 'PO_ISSUED'
                    ? ' Seluruh tahapan persetujuan telah selesai dan Purchase Order telah resmi diterbitkan.'
                    : ' Procurement Team dapat melanjutkan ke penerbitan RFQ, perbandingan vendor, dan Purchase Order (PO).'}
                </span>
              </div>
            </div>

            {status !== 'PO_ISSUED' && canActAsProcurement && onCreateRfqClick && (
              <div className={styles.actionBannerCta}>
                <Button
                  type={rfqCta.buttonType}
                  size="middle"
                  icon={activeRfq ? <EyeOutlined /> : <SendOutlined />}
                  onClick={onCreateRfqClick}
                  style={{
                    backgroundColor: activeRfq ? undefined : '#059669',
                    borderColor: activeRfq ? undefined : '#059669',
                    color: activeRfq ? undefined : '#ffffff',
                    fontWeight: 600,
                    borderRadius: 6,
                    fontSize: 12.5,
                  }}
                >
                  {rfqCta.label}
                </Button>
              </div>
            )}
          </div>
        )}

        {status === 'REJECTED_TO_PROCUREMENT' && (
          <div className={`${styles.actionBanner} ${styles.actionBannerRejected}`}>
            <div className={styles.actionBannerContent}>
              <ExclamationCircleFilled
                className={styles.actionBannerIcon}
                style={{ color: '#dc2626' }}
              />
              <div className={styles.actionBannerText}>
                <span className={styles.actionBannerTitle} style={{ color: '#991b1b' }}>
                  Ditolak oleh{' '}
                  {state.rejectedByRole === 'FINANCE'
                    ? 'Finance Team (Financial Review)'
                    : 'Director (Final Authority)'}
                </span>
                <span className={styles.actionBannerDesc}>
                  <strong>Catatan:</strong> {state.rejectionReason || 'N/A'}
                  {state.rejectedBy && (
                    <span style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 2 }}>
                      oleh {state.rejectedBy} —{' '}
                      {state.rejectedAt ? dayjs(state.rejectedAt).format('DD MMM YYYY HH:mm') : ''}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {showProcRevise && (
              <div className={styles.actionBannerCta}>
                <Button
                  type="primary"
                  icon={<RollbackOutlined />}
                  onClick={handleResubmit}
                  loading={submitting}
                  style={{ backgroundColor: '#1d4ed8', borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                >
                  Perbaiki &amp; Submit Ulang
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Finance Actions Card */}
        {showFinanceActions && (
          <div
            className={styles.cardSurface}
            style={{
              borderColor: '#c7d2fe',
              background: '#f5f3ff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#4f46e5', fontSize: 16 }} />
              <span style={{ fontSize: 12, color: '#312e81', fontWeight: 600 }}>
                Aksi Finance: Lakukan evaluasi anggaran WBS sebelum memutuskan.
              </span>
            </div>
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
                style={{
                  backgroundColor: '#7c3aed',
                  borderColor: '#7c3aed',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Lanjutkan ke Director
              </Button>
            </Space>
          </div>
        )}

        {/* Director Actions Card */}
        {showDirectorActions && (
          <div
            className={styles.cardSurface}
            style={{
              borderColor: '#bbf7d0',
              background: '#f0fdf4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 16 }} />
              <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                Aksi Director: Keputusan Otorisasi Final Pengadaan.
              </span>
            </div>
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
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Approve PR
              </Button>
            </Space>
          </div>
        )}

        {/* Informational Alerts when user cannot act */}
        {status === 'SUBMITTED' && !canActAsFinance && (
          <Alert
            type="info"
            showIcon
            icon={<ClockCircleFilled />}
            message={
              <span style={{ fontSize: 12 }}>
                PR sedang dalam tahap <strong>Financial Review oleh Finance Team</strong>. Menunggu pemeriksaan anggaran dan kelayakan finansial.
              </span>
            }
            style={{ borderRadius: 8 }}
          />
        )}

        {status === 'DIRECTOR_APPROVAL' && !canActAsDirector && (
          <Alert
            type="info"
            showIcon
            icon={<ClockCircleFilled />}
            message={
              <span style={{ fontSize: 12 }}>
                PR telah disetujui Finance dan sedang <strong>Menunggu Final Approval Director</strong>.
              </span>
            }
            style={{ borderRadius: 8 }}
          />
        )}

        {/* ── RINCIAN ITEM PENGADAAN TABLE ── */}
        <div className={styles.cardSurface}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ShoppingOutlined style={{ color: '#2563eb' }} />
              <span>Rincian Item Pengadaan ({itemsMetrics.itemCount} item)</span>
            </div>
          </div>

          {effectiveItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum ada data rincian item pengadaan"
            />
          ) : (
            <div className={styles.tableContainer}>
              <Table
                dataSource={effectiveItems.map((it, idx) => ({ ...it, key: it.id || idx }))}
                columns={itemTableColumns}
                pagination={
                  effectiveItems.length > 5
                    ? { pageSize: 5, size: 'small', showTotal: (t) => `Total ${t} item` }
                    : false
                }
                size="small"
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        Total
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        {formatNumber(itemsMetrics.totalQuantity, { fallback: '0' })}
                      </Table.Summary.Cell>
                      {itemsMetrics.hasUom && <Table.Summary.Cell index={2} />}
                      {itemsMetrics.hasUnitPrice && <Table.Summary.Cell index={3} />}
                      {itemsMetrics.hasSubtotal && (
                        <Table.Summary.Cell index={4} align="right">
                          <span style={{ color: '#1d4ed8', fontSize: 12.5, fontWeight: 700 }}>
                            {formatCurrency(
                              itemsMetrics.totalCalculatedSubtotal || effectiveTotalAmount,
                              { fallback: '-' },
                            )}
                          </span>
                        </Table.Summary.Cell>
                      )}
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </div>
          )}
        </div>

        {/* ── RIWAYAT PROSES PENGADAAN (TIMELINE) ── */}
        <div className={styles.cardSurface}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <HistoryOutlined style={{ color: '#2563eb' }} />
              <span>Riwayat Proses Pengadaan</span>
            </div>
            {isSuperAdmin && transitions.length > 0 && (
              <Button
                size="small"
                type="link"
                onClick={() => setShowTechnicalDetails((p) => !p)}
                style={{ fontSize: 11, padding: 0, height: 'auto', color: '#64748b' }}
              >
                {showTechnicalDetails ? 'Sembunyikan Teknis' : 'Detail Teknis (Admin)'}
              </Button>
            )}
          </div>

          <div className={styles.historyTimeline}>
            {historyEvents.map((ev) => {
              let dotClass = styles.historyRowDot;
              if (ev.statusTag.color === 'success') dotClass = `${styles.historyRowDot} ${styles.historyRowDotSuccess}`;
              else if (ev.statusTag.color === 'error') dotClass = `${styles.historyRowDot} ${styles.historyRowDotError}`;
              else if (ev.statusTag.color === 'processing') dotClass = `${styles.historyRowDot} ${styles.historyRowDotActive}`;

              return (
                <div key={ev.id} className={styles.historyRow}>
                  <div className={dotClass} />
                  <div className={styles.historyMain}>
                    <div className={styles.historyHeader}>
                      <Tag
                        color={ev.statusTag.color}
                        style={{
                          fontWeight: 700,
                          fontSize: 10,
                          margin: 0,
                          padding: '0 6px',
                          lineHeight: '18px',
                          borderRadius: 4,
                        }}
                      >
                        {ev.statusTag.label}
                      </Tag>
                      <span className={styles.historyTitle}>{ev.title}</span>
                    </div>

                    <div className={styles.historyMeta}>
                      <UserOutlined style={{ fontSize: 11 }} />
                      <span>
                        Oleh: <strong>{ev.actor}</strong>
                      </span>
                      {ev.prRef && (
                        <Tag
                          color="blue"
                          style={{
                            fontSize: 9.5,
                            margin: 0,
                            padding: '0 4px',
                            lineHeight: '14px',
                            borderRadius: 3,
                          }}
                        >
                          PR: {ev.prRef}
                        </Tag>
                      )}
                    </div>

                    {/* Strict: Only display note if actually present in backend data */}
                    {ev.note && <div className={styles.historyNote}>{ev.note}</div>}
                  </div>

                  <div className={styles.historyTime}>
                    <CalendarOutlined style={{ fontSize: 11 }} />
                    <span>{ev.formattedTime}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional Admin Technical Transitions Audit Drawer */}
          {isSuperAdmin && showTechnicalDetails && transitions.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#f1f5f9',
                borderRadius: 6,
                border: '1px dashed #cbd5e1',
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Audit Jejak Teknis Workflow Engine:
              </div>
              {transitions.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    fontSize: 10.5,
                  }}
                >
                  <span>
                    Transition #{t.id}: {t.action} ({t.fromNodeId} → {t.toNodeId})
                  </span>
                  <span>{dayjs(t.createdAt).format('HH:mm:ss')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
            <Button
              type="primary"
              danger
              htmlType="submit"
              icon={<RollbackOutlined />}
              loading={submitting}
            >
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
          <Descriptions.Item label="PR">{infoPresentation.prNumber}</Descriptions.Item>
          <Descriptions.Item label="Total Pengajuan">
            {infoPresentation.totalAmountText}
          </Descriptions.Item>
          <Descriptions.Item label="Alokasi Budget WBS">
            {infoPresentation.budgetAllocationText}
          </Descriptions.Item>
        </Descriptions>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => setFinancePassOpen(false)}>Batal</Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={handleFinancePass}
            loading={submitting}
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
          <Descriptions.Item label="PR">{infoPresentation.prNumber}</Descriptions.Item>
          <Descriptions.Item label="Total PR">
            {infoPresentation.totalAmountText}
          </Descriptions.Item>
          <Descriptions.Item label="Diverifikasi Finance">
            {state.financeReviewedBy || currentUserName || 'N/A'}
          </Descriptions.Item>
        </Descriptions>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => setDirApproveOpen(false)}>Batal</Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={handleDirectorApprove}
            loading={submitting}
            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
          >
            Approve PR
          </Button>
        </div>
      </Modal>
    </div>
  );
};
