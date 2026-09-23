'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Typography,
  Tag,
  Button,
  Space,
  Card,
  Row,
  Col,
  Table,
  Alert,
  Collapse,
  message,
  Tooltip,
} from 'antd';
import {
  AuditOutlined,
  DollarOutlined,
  ApartmentOutlined,
  ScheduleOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  EditOutlined,
  CheckOutlined,
  FileDoneOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { ProjectCharter } from '../ProjectOperationTab';
import { CostCategoryEstimation, CostItemDetail } from './PmOperationalPlanModal';
import { WbsNodeItem, countLeafNodes, getWbsStructureMetrics, getAllNodeIds } from './WbsTreeTableModal';
import { ScheduleTaskItem, detectCircularDependencies } from './ScheduleGanttTab';
import { getWbsLeafNodes, computeCostWbsReconciliation } from './PmCostEstimationModal';
import {
  getInitialCondition,
  isInitialConditionComplete,
  ProjectInitialConditionRecord,
} from './ProjectInitialConditionModal';
import { useAuth } from '@/context/AuthContext';
import { ProcurementService } from '@/services';
import { CreatePRPayload } from '@/services/procurement.service';
import { ProjectService } from '@/services/project.service';
import WorkflowEngineService from '@/services/workflowEngine.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setupOperationalPlanSync } from '@/lib/workflowSync';
import { getCanonicalStatusColor } from './workflowUiHelpers';

dayjs.extend(isSameOrAfter);

const { Text } = Typography;

export type ProcurementGateDecision = 'NOT_SUBMITTED' | 'REVIEW_PENDING' | 'READY_FOR_PROCUREMENT' | 'NEEDS_REVISION';

export interface ProcurementGateRecord {
  status: ProcurementGateDecision | string;
  decidedAt?: string;
  decidedBy?: string;
  revisionNotes?: string;
  submittedAt?: string;
  submittedBy?: string;
  reviewerRole?: string;
  checklistSnapshot?: any;
  workflow?: any;
  confirmedChecklist?: {
    costComplete: boolean;
    wbsComplete: boolean;
    scheduleComplete: boolean;
    costAssignmentComplete: boolean;
    crossValidationValid: boolean;
  };
}

export interface PmOperationalPlanReviewModalProps {
  open: boolean;
  onClose: () => void;
  charter: ProjectCharter | null;
  costCategories: CostCategoryEstimation[];
  wbsData: WbsNodeItem[];
  scheduleData?: ScheduleTaskItem[];
  initialCondition?: ProjectInitialConditionRecord | null;
  operationalReadinessData?: any;
  pmNotes?: string;
  onGateDecisionChange?: (record: ProcurementGateRecord) => void;
  onPrCreated?: () => void;
}

/**
 * Hardened Schedule <-> WBS Leaf association validator (P2.1-A.1).
 * Verifies that each active leaf deliverable has at least ONE valid schedule item (task or milestone).
 * Handles multiple tasks per leaf safely via `.some()` instead of `.find()`.
 * Standalone milestones not linked to the leaf are excluded.
 */
export const computeScheduledLeafWbsIds = (
  wbsLeaves: { id: string | number; code: string; dbId?: number }[],
  scheduleItems: ScheduleTaskItem[]
): Set<string> => {
  const scheduledSet = new Set<string>();
  for (const leaf of wbsLeaves) {
    const leafIdStr = String(leaf.id);
    const leafDbIdStr = leaf.dbId !== undefined && leaf.dbId !== null ? String(leaf.dbId) : null;
    const hasValidSchedule = scheduleItems.some((item) => {
      const itemWbsNodeIdStr = item.wbsNodeId !== undefined && item.wbsNodeId !== null ? String(item.wbsNodeId) : null;
      const isLinkedToLeaf =
        (itemWbsNodeIdStr !== null && (itemWbsNodeIdStr === leafIdStr || (leafDbIdStr !== null && itemWbsNodeIdStr === leafDbIdStr))) ||
        (item.wbsCode && item.wbsCode === leaf.code);
      if (!isLinkedToLeaf) return false;

      const isMilestone = item.isMilestone || item.type === 'MILESTONE';
      return isMilestone
        ? Boolean(item.startDate)
        : Boolean(
            item.startDate &&
            item.endDate &&
            dayjs(item.endDate).isSameOrAfter(dayjs(item.startDate), 'day')
          );
    });

    if (hasValidSchedule) {
      scheduledSet.add(leafIdStr);
    }
  }
  return scheduledSet;
};

export const PmOperationalPlanReviewModal: React.FC<PmOperationalPlanReviewModalProps> = ({
  open,
  onClose,
  charter,
  costCategories,
  wbsData,
  scheduleData: propScheduleData,
  initialCondition: propInitialCondition,
  operationalReadinessData,
  pmNotes,
  onGateDecisionChange,
  onPrCreated,
}) => {
  const { user, isGeneralManager, isDirector, isSuperAdmin, isProcurement, canMakeManagementDecision, isPmOnly } = useAuth();

  const canonicalProjectId = useMemo(
    () => Number(charter?.projectId || (charter as any)?.project_id || charter?.id || 0),
    [charter]
  );

  // --- 0. PROCUREMENT READINESS GATE STATE & HYDRATION (API DATABASE SSOT) ---
  const gateStorageKey = useMemo(() => {
    if (!canonicalProjectId) return '';
    return `epms_procurement_gate_${canonicalProjectId}`;
  }, [canonicalProjectId]);

  const [gateRecord, setGateRecord] = useState<ProcurementGateRecord>({ status: 'NOT_SUBMITTED' });
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [serverInitialCondition, setServerInitialCondition] = useState<ProjectInitialConditionRecord | null>(null);

  // Real-time synchronization via Canonical Workflow Events & Reconnect Resync
  useEffect(() => {
    if (!open || canonicalProjectId <= 0) return;

    const refreshManagementReview = () => {
      ProjectService.getManagementReview(canonicalProjectId)
        .then((serverGate) => {
          if (serverGate && serverGate.status) {
            setGateRecord(serverGate);
          }
        })
        .catch((err) => {
          console.warn('[PmOperationalPlanReviewModal] Refetch on sync event failed:', err);
        });
    };

    return setupOperationalPlanSync({
      canonicalProjectId,
      onRefresh: refreshManagementReview,
    });
  }, [open, canonicalProjectId]);

  // Authoritative Initial Condition: prop > server state > localStorage fallback
  const initialCondition = useMemo(() => {
    if (propInitialCondition) return propInitialCondition;
    if (serverInitialCondition) return serverInitialCondition;
    if (typeof window !== 'undefined' && canonicalProjectId > 0) {
      return getInitialCondition(canonicalProjectId);
    }
    return null;
  }, [propInitialCondition, serverInitialCondition, canonicalProjectId]);



  // PR Creation From Package Modal States
  const [isCreatePrModalOpen, setIsCreatePrModalOpen] = useState(false);
  const [selectedPrItemKeys, setSelectedPrItemKeys] = useState<React.Key[]>([]);
  const [isSubmittingPr, setIsSubmittingPr] = useState(false);

  // WBS Table Hierarchy Expansion State
  const allWbsNodeKeys = useMemo(() => getAllNodeIds(wbsData), [wbsData]);
  const [expandedWbsKeys, setExpandedWbsKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    setExpandedWbsKeys(allWbsNodeKeys);
  }, [allWbsNodeKeys]);

  const queryClient = useQueryClient();
  const { data: dbPrs = [], refetch: refetchPrs } = useQuery({
    queryKey: ['procurement', 'prs', canonicalProjectId],
    queryFn: async () => {
      if (!canonicalProjectId) return [];
      try {
        const allPrs = await ProcurementService.getPurchaseRequests();
        return Array.isArray(allPrs)
          ? allPrs.filter((p: any) => String(p.projectId || p.project_id) === String(canonicalProjectId))
          : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(open && canonicalProjectId > 0),
  });

  const primaryPr = useMemo(() => {
    if (!dbPrs || dbPrs.length === 0) return null;
    return dbPrs.find((p: any) => !p.deletedAt) || dbPrs[0];
  }, [dbPrs]);

  const { data: workflowInstance } = useQuery({
    queryKey: ['pr-workflow-instance-review-modal', primaryPr?.id],
    queryFn: async () => {
      if (!primaryPr?.id) return null;
      try {
        const inst = await WorkflowEngineService.getInstanceByEntity('PURCHASE_REQUEST', primaryPr.id);
        return inst || null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(open && primaryPr?.id),
  });

  const liveWorkflowInfo = useMemo(() => {
    const workflow = gateRecord?.workflow;
    const current = workflow?.current;
    const steps = workflow?.steps ?? [];
    const prNum = primaryPr?.prNumber || (primaryPr?.id ? `PR-${primaryPr.id}` : null);
    const isProjectActive = charter?.status === 'IN_PROGRESS' || (charter as any)?.projectStatus === 'IN_PROGRESS';

    // 1. Primary: Authoritative Canonical Workflow Projection from SSOT Engine
    if (workflow) {
      if (current && current.status !== 'UNKNOWN' && workflow.businessStatus !== 'UNKNOWN_WORKFLOW_STATE') {
        const colorInfo = getCanonicalStatusColor(current.status);
        const hoaStep = steps.find((s: any) => s.key === 'hoa');

        let managementReviewText = '○ Belum Diajukan';
        if (hoaStep?.status === 'COMPLETED') {
          managementReviewText = 'Disetujui (Head of Operations)';
        } else if (hoaStep?.status === 'ACTIVE') {
          managementReviewText = 'Sedang Ditinjau';
        } else if (hoaStep?.status === 'REVISION_REQUESTED') {
          managementReviewText = 'Perlu Revisi PM';
        } else {
          managementReviewText = '○ Belum Dimulai';
        }

        const activeStep = steps.find((s: any) => s.status === 'ACTIVE');
        let downstreamWorkflowText = '○ Belum Dimulai';
        if (current.nodeKey === 'COMPLETED' || current.status === 'COMPLETED') {
          downstreamWorkflowText = 'Alur Selesai (Director Approved)';
        } else if (activeStep) {
          downstreamWorkflowText = `${activeStep.stageName} (${activeStep.roleTitle})`;
        } else if (current.position) {
          downstreamWorkflowText = current.position;
        }

        let handoverText = current.position || current.headerBadge;
        if (isProjectActive) {
          handoverText = 'Kickoff Selesai (Proyek Berjalan)';
        } else if (current.nodeKey === 'COMPLETED' || current.status === 'COMPLETED') {
          handoverText = 'Menunggu Kickoff PM';
        }

        return {
          stageLabel: current.headerBadge || current.label || 'Current Workflow',
          stageTagColor: colorInfo.tagColor,
          nextGate: current.nextStep || 'Tindak lanjuti alur kerja',
          action: current.nextStep || 'Tindak lanjuti alur kerja',
          currentOwner: current.ownerName || '-',
          position: current.position || '-',
          handoverText,
          managementReviewText,
          downstreamWorkflowText,
          prNumber: prNum,
        };
      }

      // Canonical workflow is present but invalid/unknown -> Fail-safe UNKNOWN UI (Phase 2C.14)
      return {
        stageLabel: 'STATUS WORKFLOW TIDAK DIKENALI',
        stageTagColor: 'error',
        nextGate: 'Tidak tersedia',
        action: 'Periksa alur kerja di Workflow Engine atau hubungi administrator sistem',
        currentOwner: '-',
        position: 'Status Tidak Dikenali',
        handoverText: 'Status alur kerja tidak valid',
        managementReviewText: 'Status tidak dikenali',
        downstreamWorkflowText: 'Status tidak dikenali',
        prNumber: prNum,
      };
    }

    // 2. Legacy Fallback (ONLY if gateRecord.workflow is genuinely absent)
    const gateStatus = gateRecord?.status;
    const prStat = primaryPr?.status;

    if (gateStatus === 'READY_FOR_PROCUREMENT') {
      if (primaryPr) {
        if (prStat === 'DIRECTOR_APPROVAL' || workflowInstance?.currentNodeId === 'node_director_approval') {
          return {
            stageLabel: 'Current Workflow: DIRECTOR APPROVAL',
            stageTagColor: 'purple',
            nextGate: 'DIRECTOR',
            action: 'Final Approval Director',
            currentOwner: 'Director',
            position: 'Director Approval',
            handoverText: 'Waiting for Director Approval',
            managementReviewText: 'Approved — Ready for Procurement',
            downstreamWorkflowText: 'Director Approval',
            prNumber: prNum,
          };
        }
        if (prStat === 'FINANCE_REVIEW' || prStat === 'SUBMITTED' || workflowInstance?.currentNodeId === 'node_finance_review') {
          return {
            stageLabel: 'Current Workflow: FINANCE REVIEW',
            stageTagColor: 'processing',
            nextGate: 'FINANCE TEAM',
            action: 'Review & Evaluasi Anggaran Finance',
            currentOwner: 'Finance Team',
            position: 'Finance Review',
            handoverText: 'Menunggu Review Finance',
            managementReviewText: 'Approved — Ready for Procurement',
            downstreamWorkflowText: 'Finance Review',
            prNumber: prNum,
          };
        }
        if (prStat === 'APPROVED' || workflowInstance?.status === 'COMPLETED') {
          const isProjectActive = charter?.status === 'IN_PROGRESS' || (charter as any)?.projectStatus === 'IN_PROGRESS';
          return {
            stageLabel: isProjectActive ? 'Current Status: PROYEK BERJALAN' : 'Current Workflow: READY FOR KICKOFF',
            stageTagColor: isProjectActive ? 'success' : 'purple',
            nextGate: isProjectActive ? 'PROJECT EXECUTION' : 'PROJECT MANAGER',
            action: isProjectActive ? 'Eksekusi Pekerjaan & Update Progress WBS' : 'Kickoff Resmi Proyek oleh PM',
            currentOwner: 'Project Manager',
            position: 'Ready for Kickoff',
            handoverText: isProjectActive ? 'Kickoff Selesai (Proyek Berjalan)' : 'Menunggu Kickoff PM',
            managementReviewText: 'Approved — Ready for Procurement',
            downstreamWorkflowText: 'PR Approved (Director)',
            prNumber: prNum,
          };
        }
        if (prStat === 'REJECTED_TO_PROCUREMENT') {
          return {
            stageLabel: 'Current Workflow: REVISI PR',
            stageTagColor: 'error',
            nextGate: 'PROCUREMENT TEAM',
            action: 'Revisi & Perbaikan PR oleh Procurement',
            currentOwner: 'Procurement Team',
            position: 'Revisi PR',
            handoverText: 'Tertunda: Perbaikan PR',
            managementReviewText: 'Approved — Ready for Procurement',
            downstreamWorkflowText: 'Perbaikan PR',
            prNumber: prNum,
          };
        }
      }

      return {
        stageLabel: 'Current Workflow: PROCUREMENT INTAKE',
        stageTagColor: 'gold',
        nextGate: 'PROCUREMENT TEAM',
        action: 'Rilis Purchase Request (PR)',
        currentOwner: 'Procurement Team',
        position: 'Procurement Intake',
        handoverText: 'Menunggu Inisiasi PR',
        managementReviewText: 'Approved — Ready for Procurement',
        downstreamWorkflowText: 'Menunggu PR Procurement',
        prNumber: null,
      };
    }

    if (gateStatus === 'REVIEW_PENDING') {
      return {
        stageLabel: 'Current Workflow: MANAGEMENT REVIEW',
        stageTagColor: 'processing',
        nextGate: 'HEAD OF OPERATIONS',
        action: 'Review & Persetujuan Head Ops',
        currentOwner: 'Head of Operations',
        position: 'Management Review',
        handoverText: 'Menunggu Review Manajemen',
        managementReviewText: 'Review Pending',
        downstreamWorkflowText: '○ Belum Dimulai',
        prNumber: null,
      };
    }

    if (gateStatus === 'NEEDS_REVISION') {
      return {
        stageLabel: 'Current Workflow: REVISI PERENCANAAN',
        stageTagColor: 'error',
        nextGate: 'PROJECT MANAGER',
        action: 'Perbaikan Rencana Operasional PM',
        currentOwner: 'Project Manager',
        position: 'Revisi Perencanaan',
        handoverText: 'Perlu Revisi Operasional',
        managementReviewText: 'Perlu Revisi PM',
        downstreamWorkflowText: '○ Belum Dimulai',
        prNumber: null,
      };
    }

    return {
      stageLabel: 'Current Workflow: PLANNING',
      stageTagColor: 'default',
      nextGate: 'HEAD OF OPERATIONS',
      action: 'Ajukan untuk Management Review',
      currentOwner: 'Project Manager',
      position: 'Penyusunan Plan',
      handoverText: '○ Tahap Penyusunan Plan',
      managementReviewText: '○ Belum Diajukan',
      downstreamWorkflowText: '○ Belum Dimulai',
      prNumber: null,
    };
  }, [gateRecord, primaryPr, charter]);

  useEffect(() => {
    if (open && charter && canonicalProjectId > 0) {
      setIsLoadingReview(true);
      ProjectService.getManagementReview(canonicalProjectId)
        .then((serverReview) => {
          if (serverReview && serverReview.status) {
            setGateRecord(serverReview);
          } else {
            setGateRecord({ status: 'NOT_SUBMITTED' });
          }
          // Clean up legacy gate key from storage as Database SSOT is authoritative
          if (typeof window !== 'undefined' && gateStorageKey) {
            localStorage.removeItem(gateStorageKey);
          }
        })
        .catch((err) => {
          console.error('Failed to load management review from server:', err);
          setGateRecord({ status: 'NOT_SUBMITTED' });
        })
        .finally(() => {
          setIsLoadingReview(false);
        });

      // Hydrate Initial Condition from server SSOT if not supplied via prop
      if (!propInitialCondition) {
        ProjectService.getInitialCondition(canonicalProjectId)
          .then((serverCond) => {
            if (
              serverCond &&
              (serverCond.id ||
                serverCond.status === 'READY' ||
                (serverCond.locationCondition && serverCond.locationCondition.trim().length > 0))
            ) {
              setServerInitialCondition(serverCond);
            }
          })
          .catch((err) => {
            console.warn('Failed to load initial condition in Review Modal:', err);
          });
      }
    }
  }, [open, charter, canonicalProjectId, propInitialCondition, gateStorageKey]);

  // --- 1. FINANCIAL DERIVATIONS ---
  const contractLegalValue = Number(charter.contract_total_value || 0);
  const marketingEstimate = Number(charter.project_budget || charter.contract_total_value || 0);

  const totalPmEstimate = useMemo(() => {
    return costCategories.reduce((sum, cat) => sum + (cat.categoryTotal || 0), 0);
  }, [costCategories]);

  const hasCostInput = useMemo(() => {
    return costCategories.some((cat) => {
      if (cat.mode === 'DIRECT') return (cat.directSubtotal || 0) > 0;
      return (cat.items || []).some((item) => (item.subtotal || 0) > 0);
    });
  }, [costCategories]);

  const varianceNominal = totalPmEstimate - marketingEstimate;
  const variancePercentage = marketingEstimate > 0 ? (varianceNominal / marketingEstimate) * 100 : 0;

  const estimatedMarginNominal = contractLegalValue - totalPmEstimate;
  const estimatedMarginPercentage = contractLegalValue > 0 ? (estimatedMarginNominal / contractLegalValue) * 100 : 0;

  // Margin Status
  const marginEvaluation = useMemo(() => {
    if (contractLegalValue === 0) {
      return {
        label: '—',
        color: '#64748b',
        tagColor: 'default',
        statusText: 'Nilai SPK Nol',
      };
    }
    if (estimatedMarginNominal > 0) {
      return {
        label: 'Margin Positif',
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        tagColor: 'success',
        statusText: 'Profit Proyeksian',
      };
    }
    if (estimatedMarginNominal === 0) {
      return {
        label: 'Break Even (0%)',
        color: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        tagColor: 'warning',
        statusText: 'Impas',
      };
    }
    return {
      label: 'Margin Negatif',
      color: '#b91c1c',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
      tagColor: 'error',
      statusText: 'Defisit Estimasi',
    };
  }, [contractLegalValue, estimatedMarginNominal]);

  // Cost calculation consistency verification
  const isCostCalculationValid = useMemo(() => {
    for (const cat of costCategories) {
      if (cat.mode === 'DIRECT') {
        if (cat.categoryTotal !== cat.directSubtotal) return false;
      } else {
        const itemSum = (cat.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
        if (Math.abs(cat.categoryTotal - itemSum) > 0.01) return false;
        for (const item of cat.items || []) {
          const expected = (item.quantity || 0) * (item.unitPrice || 0);
          if (Math.abs(item.subtotal - expected) > 0.01) return false;
        }
      }
    }
    return true;
  }, [costCategories]);

  // --- 2. WBS DERIVATIONS ---
  const majorPackagesCount = wbsData.length;
  const leafDeliverablesCount = useMemo(() => countLeafNodes(wbsData), [wbsData]);
  const wbsStructureMetrics = useMemo(() => getWbsStructureMetrics(wbsData), [wbsData]);
  const wbsLeaves = useMemo(() => getWbsLeafNodes(wbsData), [wbsData]);

  const rootWeightSum = useMemo(() => {
    return wbsData.reduce((sum, n) => sum + (Number(n.weightPercentage) || 0), 0);
  }, [wbsData]);

  const isWbsWeightValid = Math.abs(rootWeightSum - 100) < 0.01;
  const isWbsComplete = majorPackagesCount > 0 && isWbsWeightValid;

  // --- 3. SCHEDULE DERIVATIONS ---
  const scheduleItems = useMemo(() => {
    let raw: ScheduleTaskItem[] = [];
    if (propScheduleData && propScheduleData.length > 0) {
      raw = propScheduleData;
    } else {
      try {
        const stored = localStorage.getItem(`epms_schedule_draft_${charter.id || charter.project_code}`);
        if (stored) {
          raw = JSON.parse(stored) as ScheduleTaskItem[];
        }
      } catch (e) {
        console.warn('Failed to parse schedule draft in review modal:', e);
      }
    }

    return raw.map((item) => {
      let resolvedType: 'TASK' | 'MILESTONE' = 'TASK';
      let resolvedIsMilestone = false;

      if (item.type) {
        resolvedType = item.type === 'MILESTONE' ? 'MILESTONE' : 'TASK';
        resolvedIsMilestone = resolvedType === 'MILESTONE';
      } else if (item.isMilestone !== undefined) {
        resolvedIsMilestone = Boolean(item.isMilestone);
        resolvedType = resolvedIsMilestone ? 'MILESTONE' : 'TASK';
      } else {
        resolvedType = 'TASK';
        resolvedIsMilestone = false;
      }

      return {
        ...item,
        type: resolvedType,
        isMilestone: resolvedIsMilestone,
      };
    });
  }, [propScheduleData, charter]);

  const scheduledTasks = useMemo(() => {
    return scheduleItems.filter(
      (i) => i.isMilestone ? Boolean(i.startDate) : Boolean(i.startDate && i.endDate && dayjs(i.endDate).isSameOrAfter(dayjs(i.startDate), 'day'))
    );
  }, [scheduleItems]);

  // Track which active leaf WBS deliverables have a valid schedule
  const scheduledLeafWbsIds = useMemo(() => {
    return computeScheduledLeafWbsIds(wbsLeaves, scheduleItems);
  }, [wbsLeaves, scheduleItems]);

  const scheduledDeliverablesCount = scheduledLeafWbsIds.size;

  const circularSet = useMemo(() => detectCircularDependencies(scheduleItems), [scheduleItems]);

  const isScheduleComplete =
    leafDeliverablesCount > 0 &&
    scheduledDeliverablesCount === leafDeliverablesCount &&
    circularSet.size === 0;

  const projectTimelineSummary = useMemo(() => {
    let minStart: dayjs.Dayjs | null = null;
    let maxEnd: dayjs.Dayjs | null = null;

    const scheduledTasksOnly = scheduledTasks.filter((i) => !i.isMilestone);

    for (const item of scheduledTasksOnly) {
      if (item.startDate) {
        const d = dayjs(item.startDate);
        if (!minStart || d.isBefore(minStart)) minStart = d;
      }
      if (item.endDate) {
        const d = dayjs(item.endDate);
        if (!maxEnd || d.isAfter(maxEnd)) maxEnd = d;
      }
    }

    if (!minStart || !maxEnd) {
      for (const item of scheduledTasks) {
        if (item.startDate) {
          const d = dayjs(item.startDate);
          if (!minStart || d.isBefore(minStart)) minStart = d;
          if (!maxEnd || d.isAfter(maxEnd)) maxEnd = d;
        }
      }
    }

    const duration = minStart && maxEnd ? maxEnd.diff(minStart, 'day') : 0;
    const milestoneCount = scheduleItems.filter((i) => i.isMilestone).length;
    const taskCount = scheduleItems.filter((i) => !i.isMilestone).length;

    return {
      minStartStr: minStart ? minStart.format('DD MMM YYYY') : '—',
      maxEndStr: maxEnd ? maxEnd.format('DD MMM YYYY') : '—',
      duration,
      milestoneCount,
      taskCount,
    };
  }, [scheduledTasks, scheduleItems]);

  // --- 4. COST <-> WBS RECONCILIATION ---
  const wbsLeafMap = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const leaf of wbsLeaves) {
      map.set(leaf.id, leaf);
    }
    return map;
  }, [wbsLeaves]);

  // --- 4. COST <-> WBS RECONCILIATION & AUTHORITATIVE PROJECT COST MAPPING ---
  const costWbsReconciliation = useMemo(() => {
    return computeCostWbsReconciliation(costCategories, wbsData);
  }, [costCategories, wbsData]);

  // Full Project Cost Allocation Math (SSOT Consistent):
  // totalCost = totalPmEstimate (e.g. Rp 185.000.000)
  // wbsCost = costWbsReconciliation.totalAllocatedCost (e.g. Rp 170.000.000)
  // projectCost = costWbsReconciliation.totalProjectLevelCost + costWbsReconciliation.directModeCost (e.g. Rp 15.000.000)
  // mappedCost = wbsCost + projectCost (e.g. Rp 185.000.000)
  // unmappedCost = costWbsReconciliation.totalUnallocatedCost (e.g. Rp 0)
  // percentage = totalCost > 0 ? (mappedCost / totalCost) * 100 : 100
  const costMappingSummary = useMemo(() => {
    const totalCost = totalPmEstimate;
    const wbsCost = costWbsReconciliation.totalAllocatedCost;
    const projectCost = costWbsReconciliation.totalProjectLevelCost + costWbsReconciliation.directModeCost;
    const mappedCost = wbsCost + projectCost;
    const unmappedCost = costWbsReconciliation.totalUnallocatedCost;
    const percentage = totalCost > 0 ? Math.min(100, Math.max(0, (mappedCost / totalCost) * 100)) : 100;
    const isFullyMapped = unmappedCost === 0 && costWbsReconciliation.orphanedItemsCount === 0;

    return {
      totalCost,
      wbsCost,
      projectCost,
      mappedCost,
      unmappedCost,
      percentage,
      isFullyMapped,
    };
  }, [totalPmEstimate, costWbsReconciliation]);

  const assignmentCoveragePercentage = costMappingSummary.percentage;

  // --- 5. COMPLETENESS & READINESS SCORE ---
  const isConditionComplete = useMemo(() => {
    if (operationalReadinessData?.pillars?.initialCondition?.isComplete !== undefined) {
      return operationalReadinessData.pillars.initialCondition.isComplete;
    }
    return isInitialConditionComplete(initialCondition);
  }, [operationalReadinessData, initialCondition]);

  const isCostComplete = hasCostInput && totalPmEstimate > 0;
  const isScopeMapped = costMappingSummary.isFullyMapped;
  const completenessCount = (isCostComplete ? 1 : 0) + (isWbsComplete ? 1 : 0) + (isScheduleComplete ? 1 : 0) + (isConditionComplete ? 1 : 0);

  // --- 6. BUSINESS WARNINGS ENGINE (SEVERITY GROUPED) ---
  const { criticalWarnings, standardWarnings, infoNotices } = useMemo(() => {
    const critical: { title: string; desc: string }[] = [];
    const standard: { title: string; desc: string }[] = [];
    const info: { title: string; desc: string }[] = [];

    // Critical: Proyek Defisit
    if (hasCostInput && estimatedMarginNominal < 0) {
      critical.push({
        title: 'Estimasi Proyek Defisit',
        desc: `Biaya estimasi PM (Rp ${totalPmEstimate.toLocaleString('id-ID')}) melebihi Nilai SPK Legal (Rp ${contractLegalValue.toLocaleString('id-ID')}) dengan selisih defisit Rp ${Math.abs(estimatedMarginNominal).toLocaleString('id-ID')} (${estimatedMarginPercentage.toFixed(1)}%). Perlu review finansial.`,
      });
    }

    // Critical: Circular Dependency in Schedule
    if (circularSet.size > 0) {
      critical.push({
        title: 'Dependensi Jadwal Membentuk Siklus',
        desc: 'Terdapat ketergantungan melingkar pada predecessor jadwal kerja. Periksa kembali urutan FS.',
      });
    }

    // Standard Warnings
    if (hasCostInput && totalPmEstimate > marketingEstimate) {
      standard.push({
        title: 'Estimasi PM Melebihi Estimasi Budget Proyek',
        desc: `Total estimasi PM (Rp ${totalPmEstimate.toLocaleString('id-ID')}) melebihi estimasi awal Marketing (Rp ${marketingEstimate.toLocaleString('id-ID')}) sebesar Rp ${varianceNominal.toLocaleString('id-ID')} (+${variancePercentage.toFixed(1)}%).`,
      });
    }

    if (wbsData.length === 0) {
      standard.push({
        title: 'Struktur WBS Belum Disusun',
        desc: 'Belum ada paket pekerjaan (Work Package) yang didaftarkan pada modul WBS.',
      });
    } else if (!isWbsWeightValid) {
      standard.push({
        title: 'Struktur WBS Belum Lengkap',
        desc: `Total bobot paket pekerjaan Level 1 saat ini bernilai ${rootWeightSum.toFixed(1)}% (target: tepat 100.0%).`,
      });
    }

    if (leafDeliverablesCount > 0 && scheduledDeliverablesCount < leafDeliverablesCount) {
      standard.push({
        title: 'Jadwal Proyek Belum Lengkap',
        desc: `${leafDeliverablesCount - scheduledDeliverablesCount} dari ${leafDeliverablesCount} pekerjaan belum ditentukan tanggal mulai/selesai.`,
      });
    }

    if (!hasCostInput || totalPmEstimate === 0) {
      standard.push({
        title: 'Estimasi Biaya PM Belum Diisi',
        desc: 'Belum ada rincian biaya atau nominal langsung pada modul Cost Estimate.',
      });
    }

    // Cost <-> WBS Scope Validation Warnings
    if (costWbsReconciliation.totalItemizedItems > 0 || costWbsReconciliation.directModeCost > 0) {
      if (costWbsReconciliation.orphanedItemsCount > 0) {
        standard.push({
          title: 'Item Biaya Memiliki Referensi WBS yang Dihapus',
          desc: `Terdapat ${costWbsReconciliation.orphanedItemsCount} item biaya dengan referensi WBS yang sudah tidak ditemukan pada struktur WBS aktif.`,
        });
      }
      if (costMappingSummary.unmappedCost > 0 || costWbsReconciliation.unassignedItemsCount > 0) {
        standard.push({
          title: 'Pemetaan Scope Biaya Belum Lengkap',
          desc: `${costWbsReconciliation.unassignedItemsCount} dari ${costWbsReconciliation.totalItemizedItems} item biaya belum ditentukan scopanya (Terpetakan ke WBS: Rp ${costMappingSummary.wbsCost.toLocaleString('id-ID')}, Project/Direct: Rp ${costMappingSummary.projectCost.toLocaleString('id-ID')}, Belum Ditentukan: Rp ${costMappingSummary.unmappedCost.toLocaleString('id-ID')}).`,
        });
      } else {
        info.push({
          title: 'Validasi Scope Biaya: 100% Ditentukan',
          desc: `Seluruh alokasi biaya telah dipetakan (WBS: Rp ${costMappingSummary.wbsCost.toLocaleString('id-ID')} • Project/Direct: Rp ${costMappingSummary.projectCost.toLocaleString('id-ID')}) dengan total terpetakan Rp ${costMappingSummary.mappedCost.toLocaleString('id-ID')}.`,
        });
      }
    } else {
      info.push({
        title: 'Validasi Biaya terhadap Scope',
        desc: 'Belum ada data estimasi biaya operasional.',
      });
    }

    return { criticalWarnings: critical, standardWarnings: standard, infoNotices: info };
  }, [
    hasCostInput,
    estimatedMarginNominal,
    totalPmEstimate,
    contractLegalValue,
    estimatedMarginPercentage,
    circularSet.size,
    marketingEstimate,
    varianceNominal,
    variancePercentage,
    wbsData.length,
    isWbsWeightValid,
    rootWeightSum,
    leafDeliverablesCount,
    scheduledDeliverablesCount,
    costWbsReconciliation,
  ]);

  // --- 7. PROJECT HEALTH & OPERATIONAL READINESS DERIVATIONS ---
  const projectHealth = useMemo(() => {
    if (estimatedMarginNominal < 0 || circularSet.size > 0 || !isCostCalculationValid) {
      return {
        status: 'CRITICAL' as const,
        title: 'CRITICAL',
        label: 'CRITICAL',
        tagColor: 'error',
        color: '#b91c1c',
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
        icon: '',
        description: estimatedMarginNominal < 0
          ? `Defisit estimasi PM sebesar Rp ${Math.abs(estimatedMarginNominal).toLocaleString('id-ID')} terhadap SPK Legal.`
          : circularSet.size > 0
          ? 'Terdapat dependensi siklus pada jadwal kerja.'
          : 'Perhitungan kalkulasi biaya tidak konsisten.',
      };
    }

    if (
      (hasCostInput && totalPmEstimate > marketingEstimate) ||
      (costWbsReconciliation.totalItemizedItems > 0 && !isScopeMapped) ||
      !isWbsWeightValid
    ) {
      return {
        status: 'AT_RISK' as const,
        title: 'AT RISK',
        label: 'AT RISK',
        tagColor: 'warning',
        color: '#b45309',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        icon: '',
        description:
          totalPmEstimate > marketingEstimate
            ? `Estimasi biaya PM melebihi budget marketing (+Rp ${varianceNominal.toLocaleString('id-ID')}).`
            : !isWbsWeightValid
            ? `Bobot WBS belum 100% (${rootWeightSum.toFixed(1)}%).`
            : 'Terdapat item biaya yang belum terpetakan ke scope.',
      };
    }

    return {
      status: 'HEALTHY' as const,
      title: 'HEALTHY',
      label: 'HEALTHY',
      tagColor: 'success',
      color: '#15803d',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      icon: '',
      description: 'Finansial positif (margin aman), struktur WBS seimbang, dan dependensi jadwal valid.',
    };
  }, [
    estimatedMarginNominal,
    circularSet.size,
    isCostCalculationValid,
    hasCostInput,
    totalPmEstimate,
    marketingEstimate,
    varianceNominal,
    costWbsReconciliation.totalItemizedItems,
    isScopeMapped,
    isWbsWeightValid,
    rootWeightSum,
  ]);

  // Authoritative Dynamic Financial Health & Risk Presentation
  const financialHealthCard = useMemo(() => {
    if (!hasCostInput || totalPmEstimate === 0) {
      return {
        icon: '',
        borderColor: '#cbd5e1',
        borderLeftColor: '#94a3b8',
        bgColor: '#f8fafc',
        titleColor: '#475569',
        descColor: '#64748b',
        tagColor: 'default',
        tagText: 'BELUM ADA ESTIMASI',
        title: 'ESTIMASI BIAYA BELUM DIISI',
        desc: 'Belum ada rincian estimasi biaya operasional. Lengkapi modul Cost Estimate untuk menganalisis margin finansial.',
      };
    }

    if (estimatedMarginNominal < 0) {
      const deficitNominal = Math.abs(estimatedMarginNominal);
      const deficitPct = Math.abs(estimatedMarginPercentage);
      return {
        icon: '',
        borderColor: '#f87171',
        borderLeftColor: '#dc2626',
        bgColor: '#fef2f2',
        titleColor: '#dc2626',
        descColor: '#7f1d1d',
        tagColor: 'error',
        tagText: `MARGIN -${deficitPct.toFixed(1)}%`,
        title: `CRITICAL — DEFISIT Rp ${deficitNominal.toLocaleString('id-ID')}`,
        desc: `Defisit estimasi PM sebesar Rp ${deficitNominal.toLocaleString('id-ID')} (-${deficitPct.toFixed(1)}%). Total estimasi PM (Rp ${totalPmEstimate.toLocaleString('id-ID')}) melebihi Nilai SPK Legal (Rp ${contractLegalValue.toLocaleString('id-ID')}). Memerlukan evaluasi manajemen.`,
      };
    }

    if (estimatedMarginNominal === 0) {
      return {
        icon: '',
        borderColor: '#fde68a',
        borderLeftColor: '#d97706',
        bgColor: '#fffbeb',
        titleColor: '#b45309',
        descColor: '#78350f',
        tagColor: 'warning',
        tagText: 'BREAK EVEN (0.0%)',
        title: 'BREAK EVEN — MARGIN 0.0%',
        desc: `Total estimasi biaya PM (Rp ${totalPmEstimate.toLocaleString('id-ID')}) tepat seimbang dengan Nilai SPK Legal (Rp ${contractLegalValue.toLocaleString('id-ID')}). Tidak terdapat alokasi margin keuntungan.`,
      };
    }

    return {
      icon: '',
      borderColor: '#bbf7d0',
      borderLeftColor: '#16a34a',
      bgColor: '#f0fdf4',
      titleColor: '#15803d',
      descColor: '#166534',
      tagColor: 'success',
      tagText: `MARGIN +${estimatedMarginPercentage.toFixed(1)}%`,
      title: `SEHAT — MARGIN +Rp ${estimatedMarginNominal.toLocaleString('id-ID')}`,
      desc: `Estimasi margin positif sebesar Rp ${estimatedMarginNominal.toLocaleString('id-ID')} (+${estimatedMarginPercentage.toFixed(1)}%). Total estimasi PM (Rp ${totalPmEstimate.toLocaleString('id-ID')}) berada di dalam batas SPK Legal (Rp ${contractLegalValue.toLocaleString('id-ID')}).`,
    };
  }, [hasCostInput, totalPmEstimate, estimatedMarginNominal, estimatedMarginPercentage, contractLegalValue]);

  const operationalReadiness = useMemo(() => {
    if (completenessCount === 4) {
      const isPending = gateRecord?.status === 'REVIEW_PENDING';
      const isApproved = gateRecord?.status === 'READY_FOR_PROCUREMENT';
      const isRevision = gateRecord?.status === 'NEEDS_REVISION';

      return {
        status: 'READY' as const,
        title: isApproved
          ? '4/4 COMPLETE — APPROVED FOR PROCUREMENT'
          : isPending
          ? 'SUBMITTED — UNDER REVIEW'
          : isRevision
          ? 'REVISION REQUESTED'
          : '4/4 READY — SIAP DIAJUKAN',
        label: isApproved
          ? '4/4 COMPLETE — APPROVED FOR PROCUREMENT'
          : isPending
          ? 'SUBMITTED — UNDER MANAGEMENT REVIEW'
          : isRevision
          ? 'NEEDS REVISION'
          : '4/4 READY — SIAP DIAJUKAN',
        tagColor: 'success',
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        icon: '',
        pillarsText: '4/4 Operational Pillars Complete',
      };
    }

    if (completenessCount > 0) {
      return {
        status: 'INCOMPLETE' as const,
        title: 'INCOMPLETE',
        label: 'INCOMPLETE',
        tagColor: 'warning',
        color: '#b45309',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        icon: '',
        pillarsText: `${completenessCount}/4 Operational Pillars Complete`,
      };
    }

    return {
      status: 'NOT_READY' as const,
      title: 'NOT READY',
      label: 'NOT READY',
      tagColor: 'error',
      color: '#b91c1c',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
      icon: '',
      pillarsText: '0/4 Operational Pillars Complete',
    };
  }, [completenessCount, gateRecord?.status]);

  const reviewerRoleTitle = useMemo(() => {
    if (isSuperAdmin) return 'Super Admin';
    if (isDirector) return 'Director';
    if (isGeneralManager) return 'Head of Operations';
    return 'Head of Operations';
  }, [isSuperAdmin, isDirector, isGeneralManager]);

  const formatReviewerName = (nameOrTitle?: string | null): string => {
    if (!nameOrTitle) return 'Head of Operations';
    if (nameOrTitle.includes('Director')) return 'Director';
    if (nameOrTitle.includes('Super Admin') || nameOrTitle.includes('SUPER_ADMIN')) return 'Super Admin';
    return 'Head of Operations';
  };



  // --- 9. PR GENERATION FROM APPROVED OPERATIONAL PLAN & DUPLICATE PROTECTION ---
  interface FlatRabItem {
    key: string;
    categoryName: string;
    itemName: string;
    quantity: number;
    uom: string;
    unitPrice: number;
    subtotal: number;
    wbsNodeId?: string;
  }

  const allRgbItems: FlatRabItem[] = useMemo(() => {
    const list: FlatRabItem[] = [];
    costCategories.forEach((cat, catIdx) => {
      if (cat.mode === 'DIRECT' && Number(cat.directSubtotal || 0) > 0) {
        list.push({
          key: `direct_${cat.categoryKey || catIdx}`,
          categoryName: cat.categoryLabel || cat.categoryKey || 'Kategori Biaya',
          itemName: `${cat.categoryLabel || cat.categoryKey} (Alokasi Biaya Langsung)`,
          quantity: 1,
          uom: 'Lump Sum',
          unitPrice: Number(cat.directSubtotal || 0),
          subtotal: Number(cat.directSubtotal || 0),
        });
      } else if (Array.isArray(cat.items)) {
        cat.items.forEach((item, itemIdx) => {
          const qty = Number(item.quantity || 0);
          const price = Number(item.unitPrice || 0);
          const sub = Number(item.subtotal || qty * price || 0);
          if (sub > 0 || (qty > 0 && price > 0)) {
            list.push({
              key: item.id || `item_${catIdx}_${itemIdx}`,
              categoryName: cat.categoryLabel || cat.categoryKey || 'Kategori Biaya',
              itemName: item.itemName || 'Item Tanpa Nama',
              quantity: qty > 0 ? qty : 1,
              uom: item.uom || 'Unit',
              unitPrice: price,
              subtotal: sub > 0 ? sub : qty * price,
              wbsNodeId: item.wbsNodeId,
            });
          }
        });
      }
    });
    return list;
  }, [costCategories]);

  // Read all existing PRs for current project from backend SSOT
  const projectPrs = useMemo(() => {
    return dbPrs;
  }, [dbPrs]);

  // Locked PRs: active, approved, or rejected revision cycle
  const lockedPrs = useMemo(() => {
    return projectPrs.filter((p) =>
      ['SUBMITTED', 'FINANCE_REVIEW', 'DIRECTOR_APPROVAL', 'APPROVED', 'REJECTED_TO_PROCUREMENT'].includes(p.status)
    );
  }, [projectPrs]);

  // Approved Canonical PR for current project
  const approvedCanonicalPr = useMemo(() => {
    return projectPrs.find((p) => p.status === 'APPROVED');
  }, [projectPrs]);

  // Rejected PR awaiting revision
  const rejectedPr = useMemo(() => {
    return projectPrs.find((p) => p.status === 'REJECTED_TO_PROCUREMENT');
  }, [projectPrs]);

  // In-flight PRs
  const inFlightPrs = useMemo(() => {
    return projectPrs.filter((p) => ['SUBMITTED', 'FINANCE_REVIEW', 'DIRECTOR_APPROVAL'].includes(p.status));
  }, [projectPrs]);

  // Set of covered item keys and normalized item names
  const coveredItemSignatures = useMemo(() => {
    const set = new Set<string>();
    lockedPrs.forEach((pr) => {
      if (Array.isArray(pr.items)) {
        pr.items.forEach((it: any) => {
          if (it.rabItemKey) {
            set.add(String(it.rabItemKey));
          }
          if (it.itemName) {
            set.add(String(it.itemName).trim().toLowerCase());
          }
        });
      }
    });
    return set;
  }, [lockedPrs]);

  // Uncovered items: RAB items not yet in any locked PR
  const uncoveredRabItems = useMemo(() => {
    return allRgbItems.filter((item) => {
      const byKey = item.key && coveredItemSignatures.has(String(item.key));
      const byName = item.itemName && coveredItemSignatures.has(String(item.itemName).trim().toLowerCase());
      return !byKey && !byName;
    });
  }, [allRgbItems, coveredItemSignatures]);

  const selectedPrItems = useMemo(() => {
    return uncoveredRabItems.filter((item) => selectedPrItemKeys.includes(item.key));
  }, [uncoveredRabItems, selectedPrItemKeys]);

  const totalPrAmount = useMemo(() => {
    return selectedPrItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [selectedPrItems]);

  const handleOpenCreatePrModal = () => {
    // Select all uncovered items by default
    setSelectedPrItemKeys(uncoveredRabItems.map((it) => it.key));
    setIsCreatePrModalOpen(true);
  };

  const handleCreateAndSubmitPr = async () => {
    if (selectedPrItems.length === 0) {
      message.warning('Pilih minimal 1 item untuk membuat Purchase Request (PR).');
      return;
    }
    if (!canonicalProjectId) {
      message.error('ID Proyek tidak valid.');
      return;
    }

    // PRE-SUBMIT COLLISION CHECK: Check against existing active PR items in SSOT
    const collisionItem = selectedPrItems.find(
      (item) =>
        (item.key && coveredItemSignatures.has(String(item.key))) ||
        (item.itemName && coveredItemSignatures.has(String(item.itemName).trim().toLowerCase()))
    );

    if (collisionItem) {
      message.error(
        `Item "${collisionItem.itemName}" sudah diproses pada PR lain. Silakan gunakan item yang masih tersedia.`
      );
      return;
    }

    setIsSubmittingPr(true);
    try {
      const payload: CreatePRPayload = {
        projectId: Number(canonicalProjectId),
        totalEstimatedAmount: Number(totalPrAmount),
        items: selectedPrItems.map((item) => ({
          itemName: item.itemName,
          quantity: Number(item.quantity || 1),
          estimatedUnitPrice: Number(item.unitPrice || 0),
        })),
      };

      const createdPr = await ProcurementService.createPurchaseRequest(payload);
      const prNumber = createdPr?.prNumber || (createdPr?.id ? `PR-${createdPr.id}` : 'PR');

      message.success(`Purchase Request (${prNumber}) sebesar Rp ${Number(totalPrAmount).toLocaleString('id-ID')} berhasil dibuat dan disubmit!`);
      setIsCreatePrModalOpen(false);
      setSelectedPrItemKeys([]);

      await refetchPrs();
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'prs'] });

      if (onPrCreated) {
        onPrCreated();
      }
    } catch (err: any) {
      console.error('Failed to create PR:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal membuat Purchase Request';
      message.error(errMsg);
    } finally {
      setIsSubmittingPr(false);
    }
  };

  const isProcurementActor = isProcurement || isSuperAdmin;
  const workflow = gateRecord?.workflow;
  const procurementStep = workflow?.steps?.find((s: any) => s.key === 'proc');
  const isWorkflowProcurementActive = Boolean(
    workflow?.current?.nodeKey === 'PROCUREMENT_REVIEW' &&
    workflow?.current?.status === 'ACTIVE' &&
    procurementStep?.status === 'ACTIVE'
  );

  const showCreatePrAction = isProcurementActor &&
    (workflow ? isWorkflowProcurementActive : gateRecord?.status === 'READY_FOR_PROCUREMENT') &&
    uncoveredRabItems.length > 0;

  const isProcurementGateReached = workflow
    ? Boolean(
        isWorkflowProcurementActive ||
        procurementStep?.status === 'COMPLETED' ||
        workflow.steps?.some((s: any) => ['fin', 'dir'].includes(s.key) && (s.status === 'ACTIVE' || s.status === 'COMPLETED'))
      )
    : ['READY_FOR_PROCUREMENT', 'REVIEW_FINANCE', 'REVIEW_DIRECTOR', 'READY_FOR_KICKOFF'].includes(gateRecord?.status || '');

  const showCoveredPrStatusTag = isProcurementActor &&
    isProcurementGateReached &&
    uncoveredRabItems.length === 0 &&
    Boolean(approvedCanonicalPr || rejectedPr || inFlightPrs.length > 0);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1280px, 94vw)"
      centered
      style={{ top: 0, paddingBottom: 0, maxWidth: 1280 }}
      styles={{
        content: {
          height: 'min(880px, 92vh)',
          maxHeight: '92vh',
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        },
        header: {
          flex: '0 0 auto',
          padding: '14px 20px',
          margin: 0,
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
        },
        body: {
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          background: '#f8fafc',
        },
        footer: {
          flex: '0 0 auto',
          padding: '12px 20px',
          margin: 0,
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
        },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 28 }}>
          <Space size={10}>
            <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 8, color: '#1d4ed8' }}>
              <AuditOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                  Management Review &amp; Executive Summary
                </span>
                <Tag style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, margin: 0 }}>
                  READ-ONLY DERIVED VIEW
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                Ringkasan eksekutif kondisi Financial, Scope, dan Schedule beserta validasi silang &amp; Procurement Gate.
              </Text>
            </div>
          </Space>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
          <Space size={6}>
            <SafetyCertificateOutlined
              style={{
                color: gateRecord?.workflow?.current?.status === 'COMPLETED' || gateRecord?.status === 'READY_FOR_PROCUREMENT' ? '#059669' : '#d97706',
                fontSize: 14,
              }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Sumber data:{' '}
              <strong>
                {gateRecord?.workflow?.current
                  ? `Workflow Engine SSOT (${gateRecord.workflow.current.position})`
                  : gateRecord?.status === 'READY_FOR_PROCUREMENT'
                  ? 'Approved Operational Plan'
                  : gateRecord?.status === 'REVIEW_PENDING'
                  ? 'Operational Plan — Under Management Review'
                  : gateRecord?.status === 'NEEDS_REVISION'
                  ? 'Operational Plan — Needs Revision'
                  : 'Draft Operational Plan (Perencanaan)'}
              </strong>
            </Text>
          </Space>

          <Space size={8} style={{ flexWrap: 'wrap' }}>
            <Button onClick={onClose} style={{ borderRadius: 6 }}>
              Tutup Review
            </Button>
            {showCoveredPrStatusTag && (
              approvedCanonicalPr ? (
                <Tag color="success" style={{ fontWeight: 700, padding: '4px 10px', borderRadius: 6, fontSize: 11.5, margin: 0 }}>
                  PR Telah Disetujui ({approvedCanonicalPr.prNumber || approvedCanonicalPr.prId}) — {allRgbItems.length}/{allRgbItems.length} Item
                </Tag>
              ) : rejectedPr ? (
                <Tag color="error" style={{ fontWeight: 700, padding: '4px 10px', borderRadius: 6, fontSize: 11.5, margin: 0 }}>
                  PR Perlu Perbaikan ({rejectedPr.prNumber || rejectedPr.prId}) — Gunakan Daftar PR
                </Tag>
              ) : (
                <Tag color="processing" style={{ fontWeight: 700, padding: '4px 10px', borderRadius: 6, fontSize: 11.5, margin: 0 }}>
                  PR Sedang Diproses ({allRgbItems.length}/{allRgbItems.length} Item)
                </Tag>
              )
            )}
            {showCreatePrAction && (
              <Button
                type="primary"
                icon={<FileDoneOutlined />}
                onClick={handleOpenCreatePrModal}
                style={{
                  backgroundColor: '#1d4ed8',
                  borderColor: '#1d4ed8',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {uncoveredRabItems.length === allRgbItems.length
                  ? 'Buat Purchase Request (PR) dari Paket'
                  : `Buat PR dari Item Tersisa (${uncoveredRabItems.length} Item)`}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {/* FIXED PROJECT HEADER STRIP */}
      <div
        style={{
          flex: '0 0 auto',
          background: '#ffffff',
          padding: '10px 20px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Row gutter={[16, 8]} align="middle">
          <Col xs={24} sm={12} md={7}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
              Nama Proyek &amp; Ref Code
            </Text>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', lineHeight: 1.3 }}>
              {charter.project_name}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Ref ID: <Tag color="cyan" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>{charter.project_code}</Tag></span>
              <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, fontWeight: 600 }}>PLANNING</Tag>
            </div>
          </Col>

          <Col xs={12} sm={6} md={5}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
              Klien &amp; SPK Legal
            </Text>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#334155', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {charter.customerName || '-'}
            </div>
            <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700, marginTop: 2 }}>
              Rp {contractLegalValue.toLocaleString('id-ID')}
            </div>
          </Col>

          <Col xs={12} sm={6} md={6}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
              Peran &amp; Tahap Saat Ini
            </Text>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', lineHeight: 1.3 }}>
              {isPmOnly ? 'Project Manager' : isGeneralManager ? 'Head of Operations' : isDirector ? 'Director' : isProcurement ? 'Procurement' : isSuperAdmin ? 'Super Admin' : (user?.roles?.[0] || 'Project Manager')}
            </div>
            <div style={{ marginTop: 2 }}>
              <Tag
                color={liveWorkflowInfo.stageTagColor}
                style={{ fontSize: 10, lineHeight: '16px', padding: '0 5px', margin: 0, fontWeight: 700 }}
              >
                {liveWorkflowInfo.stageLabel}
              </Tag>
            </div>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
              Next Gate &amp; Aksi
            </Text>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#0369a1', lineHeight: 1.3 }}>
              Next Gate: {liveWorkflowInfo.nextGate}
            </div>
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
              Aksi: {liveWorkflowInfo.action}
            </div>
          </Col>
        </Row>
      </div>

      {/* SCROLLABLE EXECUTIVE DASHBOARD VIEWPORT (CANONICAL HIERARCHY: SECTION T) */}
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* 1. PROJECT HEALTH & PLANNING READINESS (EXECUTIVE DUAL METRIC) */}
        <Row gutter={[12, 12]} align="stretch">
          {/* Pillar 1: PLANNING READINESS */}
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                height: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '2px solid #16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              ></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#166534' }}>
                    PLANNING READINESS
                  </span>
                  <Tag color="success" style={{ fontWeight: 700, fontSize: 10, margin: 0, padding: '0 6px', borderRadius: 4 }}>
                    {operationalReadiness.pillarsText}
                  </Tag>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#15803d', marginTop: 2 }}>
                  {operationalReadiness.label}
                </div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 3, lineHeight: 1.4 }}>
                  {gateRecord?.workflow?.current
                    ? `Alur kerja saat ini: ${gateRecord.workflow.current.position}. Langkah berikutnya: ${gateRecord.workflow.current.nextStep}.`
                    : gateRecord?.status === 'READY_FOR_PROCUREMENT'
                    ? 'Operational Plan telah lengkap dan disetujui Management untuk diproses Procurement.'
                    : gateRecord?.status === 'REVIEW_PENDING'
                    ? 'Operational Plan sedang ditinjau eksekutif oleh Head of Operations.'
                    : gateRecord?.status === 'NEEDS_REVISION'
                    ? 'Operational Plan memerlukan perbaikan sebelum dapat diajukan kembali.'
                    : '4/4 pilar operasional (RAB, WBS, Schedule, Baseline) lengkap. Siap diajukan PM.'}
                </div>
              </div>
            </div>
          </Col>

          {/* Pillar 2: FINANCIAL HEALTH & RISK (DOMINANT FOCAL POINT) */}
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: financialHealthCard.bgColor,
                border: `1px solid ${financialHealthCard.borderColor}`,
                borderLeft: `4px solid ${financialHealthCard.borderLeftColor}`,
                height: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: `2px solid ${financialHealthCard.borderLeftColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                {financialHealthCard.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: financialHealthCard.titleColor }}>
                    FINANCIAL HEALTH &amp; RISK (FOCAL POINT)
                  </span>
                  <Tag color={financialHealthCard.tagColor} style={{ fontWeight: 800, fontSize: 10, margin: 0, padding: '0 6px', borderRadius: 4 }}>
                    {financialHealthCard.tagText}
                  </Tag>
                </div>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: financialHealthCard.titleColor, marginTop: 2 }}>
                  {financialHealthCard.title}
                </div>
                <div style={{ fontSize: 11, color: financialHealthCard.descColor, marginTop: 3, lineHeight: 1.4 }}>
                  {financialHealthCard.desc}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* 2. EXECUTIVE KPI ROW (FINANCIAL / SCOPE / SCHEDULE) */}
        <Row gutter={[12, 12]} align="stretch">
          {/* 1. Financial Executive KPI */}
          <Col xs={24} md={8}>
            <Card
              size="small"
              title={
                <Space size={6}>
                  <DollarOutlined style={{ color: '#1d4ed8' }} />
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>FINANCIAL</span>
                </Space>
              }
              style={{ borderRadius: 8, border: '1px solid #cbd5e1', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff' }}
              bodyStyle={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Nilai SPK Legal:</Text>
                  <Text strong style={{ fontSize: 12.5, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                    Rp {contractLegalValue.toLocaleString('id-ID')}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Total Estimasi PM:</Text>
                  <Text strong style={{ fontSize: 12.5, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    Rp {totalPmEstimate.toLocaleString('id-ID')}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                  <Text strong style={{ fontSize: 11.5, color: '#334155' }}>Estimasi Margin:</Text>
                  <Space size={4}>
                    {!hasCostInput || totalPmEstimate === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                    ) : estimatedMarginNominal >= 0 ? (
                      <>
                        <Tag color="success" style={{ fontSize: 9.5, lineHeight: '18px', padding: '0 4px', margin: 0, fontWeight: 700 }}>
                          Margin Positif
                        </Tag>
                        <Text strong style={{ fontSize: 12.5, color: '#15803d', whiteSpace: 'nowrap' }}>
                          +Rp {estimatedMarginNominal.toLocaleString('id-ID')} (+{estimatedMarginPercentage.toFixed(1)}%)
                        </Text>
                      </>
                    ) : (
                      <>
                        <Tag color="error" style={{ fontSize: 9.5, lineHeight: '18px', padding: '0 4px', margin: 0, fontWeight: 700 }}>
                          Defisit
                        </Tag>
                        <Text strong style={{ fontSize: 12.5, color: '#dc2626', whiteSpace: 'nowrap' }}>
                          -Rp {Math.abs(estimatedMarginNominal).toLocaleString('id-ID')} ({estimatedMarginPercentage.toFixed(1)}%)
                        </Text>
                      </>
                    )}
                  </Space>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                  <Text type="secondary">Deviasi vs Budget:</Text>
                  <Text strong style={{ color: varianceNominal > 0 ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>
                    {varianceNominal >= 0 ? '+' : ''}Rp {varianceNominal.toLocaleString('id-ID')} ({variancePercentage.toFixed(1)}%)
                  </Text>
                </div>
              </div>
            </Card>
          </Col>

          {/* 2. Scope Executive KPI */}
          <Col xs={24} md={8}>
            <Card
              size="small"
              title={
                <Space size={6}>
                  <ApartmentOutlined style={{ color: '#15803d' }} />
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>SCOPE</span>
                </Space>
              }
              style={{ borderRadius: 8, border: '1px solid #cbd5e1', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff' }}
              bodyStyle={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Package Utama:</Text>
                  <Text strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                    {majorPackagesCount} Paket Utama
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Leaf Deliverables:</Text>
                  <Text strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                    {leafDeliverablesCount} Deliverables
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Bobot Scope:</Text>
                  <Tag color={isWbsWeightValid ? 'success' : 'warning'} style={{ fontWeight: 700, margin: 0, padding: '0 6px', fontSize: 10.5 }}>
                    {rootWeightSum.toFixed(1)}%
                  </Tag>
                </div>

                <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Cost Coverage:</span>
                    <Tag color={costMappingSummary.isFullyMapped ? "success" : "warning"} style={{ fontWeight: 700, margin: 0, padding: '0 4px', fontSize: 10 }}>
                      {costMappingSummary.percentage.toFixed(1)}% Terpetakan
                    </Tag>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2 }}>
                    WBS: Rp {costMappingSummary.wbsCost.toLocaleString('id-ID')} · Project/Direct: Rp {costMappingSummary.projectCost.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* 3. Schedule Executive KPI */}
          <Col xs={24} md={8}>
            <Card
              size="small"
              title={
                <Space size={6}>
                  <ScheduleOutlined style={{ color: '#0369a1' }} />
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>SCHEDULE</span>
                </Space>
              }
              style={{ borderRadius: 8, border: '1px solid #cbd5e1', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff' }}
              bodyStyle={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Scheduled Items:</Text>
                  <Tag color="success" style={{ fontWeight: 700, margin: 0, padding: '0 6px', fontSize: 10.5 }}>
                    {scheduledDeliverablesCount} / {leafDeliverablesCount} Scheduled
                  </Tag>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Durasi Proyek:</Text>
                  <Text strong style={{ fontSize: 12.5, color: '#1d4ed8' }}>
                    {projectTimelineSummary.duration} Hari Kalender
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Rentang Proyek:</span>
                  <span style={{ fontSize: 11.5, color: '#0f172a', fontWeight: 600 }}>
                    {projectTimelineSummary.minStartStr} – {projectTimelineSummary.maxEndStr}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                  <Text type="secondary">Milestone & Dependensi:</Text>
                  <Text strong style={{ color: '#15803d' }}>
                    {projectTimelineSummary.milestoneCount} Milestone · 0 Error
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 4. BASELINE KONDISI AWAL PROYEK (PILAR 4) */}
        <Card
          size="small"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={6}>
                <FileTextOutlined style={{ color: '#2563eb' }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Kondisi Awal Proyek (Baseline Perencanaan)</span>
              </Space>
              {initialCondition ? (
                initialCondition.conditionStatus === 'NORMAL' ? (
                  <Tag color="green" style={{ fontWeight: 700 }}>● NORMAL</Tag>
                ) : initialCondition.conditionStatus === 'PERLU_PERHATIAN' ? (
                  <Tag color="gold" style={{ fontWeight: 700 }}>● PERLU PERHATIAN</Tag>
                ) : (
                  <Tag color="red" style={{ fontWeight: 700 }}>● BERISIKO</Tag>
                )
              ) : (
                <Tag color="default">○ BELUM DIISI</Tag>
              )}
            </div>
          }
          style={{ borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff' }}
          bodyStyle={{ padding: '10px 14px' }}
        >
          {initialCondition ? (
            <Row gutter={[10, 10]}>
              <Col xs={24} md={8}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>KONDISI LOKASI PROYEK</Text>
                    <div style={{ fontSize: 11.5, color: '#0f172a', fontWeight: 500, marginTop: 2, lineHeight: 1.4 }}>
                      {initialCondition.locationCondition || '-'}
                    </div>
                  </div>
                  {initialCondition.existingInfrastructure && (
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>INFRASTRUKTUR EXISTING</Text>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 1, lineHeight: 1.35 }}>{initialCondition.existingInfrastructure}</div>
                    </div>
                  )}
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#b45309' }}>KENDALA &amp; RISIKO AWAL</Text>
                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 2, lineHeight: 1.35 }}>
                      <strong>Kendala:</strong> {initialCondition.initialConstraints || '-'}
                    </div>
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3, lineHeight: 1.35 }}>
                      <strong>Risiko:</strong> {initialCondition.initialRisks || '-'}
                    </div>
                  </div>
                  {initialCondition.accessLogistics && (
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>AKSES &amp; LOGISTIK</Text>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 1, lineHeight: 1.35 }}>{initialCondition.accessLogistics}</div>
                    </div>
                  )}
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1d4ed8' }}>REKOMENDASI / CATATAN PM</Text>
                    <div style={{ fontSize: 11.5, color: '#1e40af', marginTop: 2, lineHeight: 1.4, fontWeight: 500 }}>
                      {initialCondition.pmRecommendation || 'Tidak ada catatan tambahan.'}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, borderTop: '1px dashed #e2e8f0', paddingTop: 4 }}>
                    Dicatat oleh {initialCondition.createdBy || 'PM'} · {dayjs(initialCondition.updatedAt).format('DD MMM YYYY HH:mm')}
                  </div>
                </div>
              </Col>
            </Row>
          ) : (
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1', color: '#64748b', fontSize: 12 }}>
              Belum ada data kondisi awal proyek yang dicatat oleh Project Manager pada fase perencanaan ini.
            </div>
          )}
        </Card>

        {/* 3. MANAGEMENT ATTENTION */}
        <Card
          size="small"
          title={
            <Space size={6}>
              <WarningOutlined style={{ color: '#dc2626' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Management Attention &amp; Action Required</span>
            </Space>
          }
          style={{ borderRadius: 8, border: '1px solid #fecaca', background: '#ffffff' }}
          bodyStyle={{ padding: '14px 16px' }}
        >
          {criticalWarnings.length === 0 && standardWarnings.length === 0 ? (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
              <div>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#15803d' }}>
                  Tidak Ada Isu Kritis
                </span>
                <span style={{ fontSize: 12, color: '#166534', marginLeft: 6 }}>
                  Semua parameter operasional berada dalam ambang batas normal.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 1. Primary Financial Exception */}
              {estimatedMarginNominal < 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>FINANCIAL EXCEPTION: Estimasi Biaya Melebihi Nilai SPK Legal</span>
                    </div>
                    <Tag color="error" style={{ fontWeight: 700, fontSize: 11, margin: 0, padding: '2px 8px' }}>
                      DEFISIT Rp {Math.abs(estimatedMarginNominal).toLocaleString('id-ID')} (MARGIN {estimatedMarginPercentage.toFixed(1)}%)
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5, marginTop: 4 }}>
                    <strong>ISSUE:</strong> Total estimasi PM (Rp {totalPmEstimate.toLocaleString('id-ID')}) melebihi Nilai SPK Legal (Rp {contractLegalValue.toLocaleString('id-ID')}) dengan defisit <strong>-Rp {Math.abs(estimatedMarginNominal).toLocaleString('id-ID')}</strong> (Margin <strong>{estimatedMarginPercentage.toFixed(1)}%</strong>).
                  </div>
                  <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5, marginTop: 3 }}>
                    <strong>IMPACT:</strong> Baseline cost plan belum feasible terhadap nilai kontrak yang disepakati (potensi defisit finansial proyek).
                  </div>
                  <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600, lineHeight: 1.5, marginTop: 3 }}>
                    <strong>REQUIRED ACTION:</strong>{' '}
                    {gateRecord?.status === 'READY_FOR_PROCUREMENT'
                      ? 'Paket telah disetujui HOPS untuk Procurement. Mitigasi defisit finansial akan dikontrol downstream melalui Finance Review dan Director Approval saat Purchase Request (PR) diajukan.'
                      : 'Review financial feasibility dan/atau revisi operational cost plan sebelum procurement release.'}
                  </div>
                </div>
              )}

              {/* 2. Secondary Budget Deviation */}
              {totalPmEstimate > marketingEstimate && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>DEVIASI BUDGET: Estimasi PM Melebihi Budget Awal Marketing</span>
                    </div>
                    <Tag color="warning" style={{ fontWeight: 700, fontSize: 11, margin: 0, padding: '2px 8px' }}>
                      DEVIASI +Rp {varianceNominal.toLocaleString('id-ID')} (+{variancePercentage.toFixed(1)}%)
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5, marginTop: 4 }}>
                    <strong>ISSUE:</strong> Total estimasi PM melebihi alokasi budget awal Marketing (Rp {marketingEstimate.toLocaleString('id-ID')}) sebesar <strong>+Rp {varianceNominal.toLocaleString('id-ID')}</strong> (+{variancePercentage.toFixed(1)}%).
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5, marginTop: 3 }}>
                    <strong>IMPACT:</strong> Terdapat kenaikan estimasi biaya operasional dibandingkan asumsi awal penawaran tender.
                  </div>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, lineHeight: 1.5, marginTop: 3 }}>
                    <strong>REQUIRED ACTION:</strong> Verifikasi rincian alokasi biaya pengadaan material dan jasa bersama tim delivery sebelum eksekusi.
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 4. CROSS-VALIDATION */}
        <Card
          size="small"
          title={
            <div>
              <Space size={6}>
                <SafetyCertificateOutlined style={{ color: '#1d4ed8' }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Cross-Validation</span>
              </Space>
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 400, marginTop: 1 }}>
                Validasi konsistensi Financial, Scope, dan Schedule
              </div>
            </div>
          }
          style={{ borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff' }}
          bodyStyle={{ padding: '12px 14px' }}
        >
          <Table
            size="small"
            pagination={false}
            bordered
            rowKey="id"
            dataSource={[
              {
                id: 'cv_cost_wbs',
                aspect: 'Validasi Pemetaan Scope Biaya',
                statusTag: (
                  <Tag
                    color={costMappingSummary.isFullyMapped ? 'success' : 'warning'}
                    style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}
                  >
                    {costMappingSummary.isFullyMapped ? 'Complete' : 'Attention'}
                  </Tag>
                ),
                result: `${costMappingSummary.percentage.toFixed(1)}% Terpetakan`,
                notes: `WBS: Rp ${costMappingSummary.wbsCost.toLocaleString('id-ID')} • Project/Direct: Rp ${costMappingSummary.projectCost.toLocaleString('id-ID')}${costMappingSummary.unmappedCost > 0 ? ` • Belum: Rp ${costMappingSummary.unmappedCost.toLocaleString('id-ID')}` : ''}`,
              },
              {
                id: 'cv_wbs_sch',
                aspect: 'Validasi Scope terhadap Jadwal',
                statusTag: (
                  <Tag color={isScheduleComplete ? 'success' : 'warning'} style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    {isScheduleComplete ? 'Complete' : 'Attention'}
                  </Tag>
                ),
                result: `${scheduledDeliverablesCount} / ${leafDeliverablesCount}`,
                notes: isScheduleComplete
                  ? 'Seluruh deliverables telah memiliki jadwal kerja'
                  : `${leafDeliverablesCount - scheduledDeliverablesCount} deliverables belum memiliki jadwal`,
              },
              {
                id: 'cv_cost_calc',
                aspect: 'Validasi Perhitungan Biaya',
                statusTag: (
                  <Tag color={isCostCalculationValid ? 'success' : 'error'} style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    {isCostCalculationValid ? 'Valid' : 'Failed'}
                  </Tag>
                ),
                result: isCostCalculationValid ? '100% Sesuai' : 'Perlu Koreksi',
                notes: isCostCalculationValid ? 'Subtotal dan akumulasi kategori konsisten' : 'Terdapat perbedaan subtotal dengan harga satuan',
              },
              {
                id: 'cv_wbs_weight',
                aspect: 'Validasi Bobot Scope',
                statusTag: (
                  <Tag color={isWbsWeightValid ? 'success' : 'warning'} style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    {isWbsWeightValid ? 'Valid' : 'Attention'}
                  </Tag>
                ),
                result: `${rootWeightSum.toFixed(1)}%`,
                notes: isWbsWeightValid ? 'Bobot scope level 1 seimbang (100.0%)' : 'Bobot level 1 belum 100.0%',
              },
              {
                id: 'cv_wbs_structure',
                aspect: 'Kualitas Struktur & Hierarki',
                statusTag: (
                  <Tag color={wbsStructureMetrics.isStructured ? 'cyan' : 'blue'} style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    {wbsData.length === 0
                      ? 'Kosong'
                      : wbsStructureMetrics.isStructured
                      ? `Valid (L${wbsStructureMetrics.maxHierarchyDepth})`
                      : 'ℹ Valid (Flat)'}
                  </Tag>
                ),
                result: `${majorPackagesCount} Pkg / ${leafDeliverablesCount} Leaf`,
                notes: wbsStructureMetrics.isFlat
                  ? 'Semua paket berada pada level 1 (valid untuk scope sederhana)'
                  : `Hierarki bertingkat hingga level ${wbsStructureMetrics.maxHierarchyDepth} (${wbsStructureMetrics.nestedNodeCount} sub-item)`,
              },
              {
                id: 'cv_margin_guard',
                aspect: 'Evaluasi Margin Proyek (Finansial)',
                statusTag: (
                  <Tag color={estimatedMarginNominal >= 0 ? 'success' : 'error'} style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    {estimatedMarginNominal >= 0 ? 'Valid' : 'Defisit'}
                  </Tag>
                ),
                result: !hasCostInput || totalPmEstimate === 0
                  ? 'Belum diisi'
                  : estimatedMarginNominal >= 0
                  ? `+${estimatedMarginPercentage.toFixed(1)}% (+Rp ${estimatedMarginNominal.toLocaleString('id-ID')})`
                  : `-${Math.abs(estimatedMarginPercentage).toFixed(1)}% (Defisit -Rp ${Math.abs(estimatedMarginNominal).toLocaleString('id-ID')})`,
                notes: !hasCostInput || totalPmEstimate === 0
                  ? 'Estimasi biaya belum diisi'
                  : estimatedMarginNominal >= 0
                  ? 'Estimasi margin positif (Finansial aman)'
                  : 'Biaya estimasi PM melebihi SPK Legal (Peringatan Finansial — Dokumen perencanaan tetap lengkap)',
              },
            ]}
            columns={[
              {
                title: 'ASPEK',
                dataIndex: 'aspect',
                key: 'aspect',
                width: 230,
                render: (val: string) => <Text strong style={{ fontSize: 12 }}>{val}</Text>,
              },
              {
                title: 'STATUS',
                dataIndex: 'statusTag',
                key: 'statusTag',
                width: 110,
                align: 'center' as const,
              },
              {
                title: 'HASIL',
                dataIndex: 'result',
                key: 'result',
                width: 170,
                render: (val: string) => <Text strong style={{ fontSize: 11.5 }}>{val}</Text>,
              },
              {
                title: 'CATATAN',
                dataIndex: 'notes',
                key: 'notes',
                render: (val: string) => <Text style={{ fontSize: 11, color: '#475569' }}>{val}</Text>,
              },
            ]}
          />
        </Card>

        {/* 5. OPERATIONAL DETAIL (COLLAPSED BY DEFAULT) */}
        <Card
          size="small"
          title={
            <div>
              <Space size={6}>
                <EyeOutlined style={{ color: '#1d4ed8' }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Operational Detail</span>
              </Space>
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 400, marginTop: 1 }}>
                Rincian detail untuk pemeriksaan lanjutan
              </div>
            </div>
          }
          style={{ borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff' }}
          bodyStyle={{ padding: '12px 14px' }}
        >
          <Collapse
            size="small"
            defaultActiveKey={[]}
            items={[
              {
                key: 'drill_cost',
                label: (
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    1. Detail Rincian Biaya (RAB) · {costCategories.length} Kategori · Total Rp {totalPmEstimate.toLocaleString('id-ID')} ({costMappingSummary.percentage.toFixed(0)}% Terpetakan)
                  </span>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {costCategories.map((cat, cIdx) => (
                      <Card
                        key={cat.categoryKey}
                        size="small"
                        style={{ background: '#f8fafc', borderRadius: 6 }}
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 12 }}>{cIdx + 1}. {cat.categoryLabel}</Text>
                            <Text strong style={{ fontSize: 12, color: '#1d4ed8' }}>
                              Rp {(cat.categoryTotal || 0).toLocaleString('id-ID')}
                            </Text>
                          </div>
                        }
                      >
                        {cat.mode === 'DIRECT' ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Metode: Nominal Langsung (Rp {cat.directSubtotal.toLocaleString('id-ID')})
                          </Text>
                        ) : (
                          <div>
                            {cat.items.length === 0 ? (
                              <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>Belum ada rincian item.</Text>
                            ) : (
                              <Table
                                size="small"
                                pagination={false}
                                bordered
                                dataSource={cat.items}
                                rowKey="id"
                                columns={[
                                  { title: 'Nama Item', dataIndex: 'itemName', key: 'itemName', render: (v: string) => v || '-' },
                                  { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right' as const },
                                  { title: 'Satuan', dataIndex: 'uom', key: 'uom', width: 90 },
                                  {
                                    title: 'Harga Satuan',
                                    dataIndex: 'unitPrice',
                                    key: 'unitPrice',
                                    width: 140,
                                    align: 'right' as const,
                                    render: (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`,
                                  },
                                  {
                                    title: 'Scope Pemetaan',
                                    key: 'assignmentScope',
                                    width: 180,
                                    render: (_: any, item: CostItemDetail) => {
                                      const scope = item.assignmentScope || (item.wbsNodeId ? 'WBS' : 'UNASSIGNED');
                                      if (scope === 'PROJECT') {
                                        return <Tag color="purple" style={{ fontSize: 10, fontWeight: 600 }}>● Project-Level</Tag>;
                                      }
                                      if (scope === 'WBS') {
                                        if (!item.wbsNodeId) {
                                          return <Tag color="warning" style={{ fontSize: 10 }}>Pilih WBS</Tag>;
                                        }
                                        const node = wbsLeafMap.get(item.wbsNodeId);
                                        if (!node) {
                                          return <Tag color="error" style={{ fontSize: 10 }}>WBS Dihapus</Tag>;
                                        }
                                        return (
                                          <Tag color="blue" style={{ fontSize: 10 }}>
                                            {node.code} · {node.name}
                                          </Tag>
                                        );
                                      }
                                      return <Tag color="warning" style={{ fontSize: 10 }}>Belum Ditentukan</Tag>;
                                    },
                                  },
                                  {
                                    title: 'Subtotal',
                                    dataIndex: 'subtotal',
                                    key: 'subtotal',
                                    width: 140,
                                    align: 'right' as const,
                                    render: (v: number) => (
                                      <Text strong style={{ color: '#1d4ed8' }}>
                                        Rp {(v || 0).toLocaleString('id-ID')}
                                      </Text>
                                    ),
                                  },
                                ]}
                              />
                            )}
                          </div>
                        )}
                      </Card>
                    ))}

                    {/* WBS Cost Summary in Review */}
                    {(costWbsReconciliation.wbsCostList.length > 0 || costWbsReconciliation.totalProjectLevelCost > 0) && (
                      <Card
                        size="small"
                        title={
                          <Space size={6}>
                            <ApartmentOutlined style={{ color: '#0284c7' }} />
                            <span style={{ fontWeight: 600, fontSize: 12 }}>Ringkasan Pemetaan Biaya per WBS Deliverable & Project-Level</span>
                          </Space>
                        }
                        style={{ marginTop: 4, borderRadius: 6, border: '1px solid #e2e8f0' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {costWbsReconciliation.wbsCostList.map((w) => (
                            <div
                              key={w.wbsId}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '3px 6px',
                                borderRadius: 4,
                                background: '#f8fafc',
                              }}
                            >
                              <Space size={6}>
                                <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{w.wbsCode}</Tag>
                                <Text style={{ fontSize: 11.5, color: '#0f172a' }}>{w.wbsName}</Text>
                                <Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>{w.itemCount} item</Tag>
                              </Space>
                              <Text strong style={{ fontSize: 11.5, color: '#0284c7' }}>
                                Rp {w.totalCost.toLocaleString('id-ID')}
                              </Text>
                            </div>
                          ))}
                          {costWbsReconciliation.totalProjectLevelCost > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '3px 6px',
                                borderRadius: 4,
                                background: '#faf5ff',
                                border: '1px solid #f3e8ff',
                              }}
                            >
                              <Space size={6}>
                                <Tag color="purple" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>PROJECT</Tag>
                                <Text style={{ fontSize: 11.5, color: '#581c87', fontWeight: 600 }}>Biaya Tingkat Proyek (Project-Level / Overhead / Mobilisasi)</Text>
                                <Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>{costWbsReconciliation.projectLevelItemsCount} item</Tag>
                              </Space>
                              <Text strong style={{ fontSize: 11.5, color: '#7c3aed' }}>
                                Rp {costWbsReconciliation.totalProjectLevelCost.toLocaleString('id-ID')}
                              </Text>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                  </div>
                ),
              },
              {
                key: 'drill_wbs',
                label: (
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    2. Detail Struktur WBS · {majorPackagesCount} Paket Utama · {leafDeliverablesCount} Deliverables (Bobot {rootWeightSum.toFixed(1)}%)
                  </span>
                ),
                children: (
                  <div>
                    {wbsData.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>Belum ada struktur WBS.</Text>
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        bordered
                        rowKey="id"
                        dataSource={wbsData}
                        expandable={{
                          expandedRowKeys: expandedWbsKeys,
                          onExpandedRowsChange: (keys) => setExpandedWbsKeys(keys as React.Key[]),
                          rowExpandable: (record: WbsNodeItem) => Boolean(record.children && record.children.length > 0),
                        }}
                        columns={[
                          {
                            title: 'Kode',
                            dataIndex: 'code',
                            key: 'code',
                            width: 100,
                            render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
                          },
                          {
                            title: 'Work Package / Scope Deliverable',
                            dataIndex: 'name',
                            key: 'name',
                            render: (v: string, r: WbsNodeItem) => (
                              <span>
                                <Text strong={r.level === 1}>{v}</Text>
                                {r.description && <div style={{ fontSize: 11, color: '#64748b' }}>{r.description}</div>}
                              </span>
                            ),
                          },
                          {
                            title: 'Tingkat',
                            dataIndex: 'level',
                            key: 'level',
                            width: 120,
                            render: (lvl: number) => <Tag>{lvl === 1 ? 'Level 1 (Pkg)' : `Level ${lvl}`}</Tag>,
                          },
                          {
                            title: 'Bobot %',
                            dataIndex: 'weightPercentage',
                            key: 'weightPercentage',
                            width: 100,
                            align: 'right' as const,
                            render: (v: number) => <strong>{Number(v || 0).toFixed(1)}%</strong>,
                          },
                        ]}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'drill_schedule',
                label: (
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    3. Detail Jadwal Kerja · {scheduledDeliverablesCount}/{leafDeliverablesCount} Scheduled · Durasi {projectTimelineSummary.duration} Hari ({projectTimelineSummary.minStartStr} – {projectTimelineSummary.maxEndStr})
                  </span>
                ),
                children: (
                  <div>
                    {scheduleItems.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 11.5, fontStyle: 'italic' }}>
                        Belum ada data jadwal kerja.
                      </Text>
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        bordered
                        rowKey="wbsNodeId"
                        dataSource={scheduleItems}
                        columns={[
                          {
                            title: 'Kode',
                            dataIndex: 'wbsCode',
                            key: 'wbsCode',
                            width: 80,
                            render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
                          },
                          {
                            title: 'Nama Work Item',
                            dataIndex: 'name',
                            key: 'name',
                            render: (v: string, r: ScheduleTaskItem) => (
                              <Space size={4}>
                                {r.isMilestone && <span style={{ color: '#d97706', fontWeight: 800 }}>◆</span>}
                                <Text strong style={{ fontSize: 12 }}>{v}</Text>
                              </Space>
                            ),
                          },
                          {
                            title: 'Jenis',
                            key: 'isMilestone',
                            width: 105,
                            render: (_: any, r: ScheduleTaskItem) => (
                              r.isMilestone ? (
                                <Tag color="gold" style={{ fontWeight: 700, margin: 0 }}>Milestone</Tag>
                              ) : (
                                <Tag color="blue" style={{ margin: 0 }}>Pekerjaan</Tag>
                              )
                            ),
                          },
                          {
                            title: 'Tgl Mulai',
                            dataIndex: 'startDate',
                            key: 'startDate',
                            width: 130,
                            render: (v?: string) => (v ? dayjs(v).format('DD MMM YYYY') : <Text type="secondary">TBA</Text>),
                          },
                          {
                            title: 'Tgl Selesai',
                            dataIndex: 'endDate',
                            key: 'endDate',
                            width: 130,
                            render: (v?: string, r?: ScheduleTaskItem) => {
                              if (r?.isMilestone) return <Tag color="gold">— (Point Event)</Tag>;
                              return v ? dayjs(v).format('DD MMM YYYY') : <Text type="secondary">TBA</Text>;
                            },
                          },
                          {
                            title: 'Durasi',
                            dataIndex: 'duration',
                            key: 'duration',
                            width: 110,
                            align: 'center' as const,
                            render: (v?: number, r?: ScheduleTaskItem) => {
                              if (r?.isMilestone) return <Tag color="gold">Milestone · 0 Hari</Tag>;
                              if (!r?.startDate || !r?.endDate || dayjs(r.endDate).isBefore(dayjs(r.startDate), 'day')) {
                                return <Text type="secondary">—</Text>;
                              }
                              const dur = v !== undefined ? v : dayjs(r.endDate).diff(dayjs(r.startDate), 'day');
                              return <strong>{dur} Hari</strong>;
                            },
                          },
                          {
                            title: 'Predecessor (FS)',
                            dataIndex: 'predecessorWbsCode',
                            key: 'predecessorWbsCode',
                            width: 130,
                            render: (v?: string) => (v ? <Tag color="cyan">{v} (FS)</Tag> : '—'),
                          },
                        ]}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>

        {/* PM NOTES */}
        {pmNotes && (
          <Card size="small" title="Catatan Operasional PM" style={{ borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff' }}>
            <Text style={{ fontSize: 12, color: '#334155' }}>{pmNotes}</Text>
          </Card>
        )}

        {/* 6. MANAGEMENT DECISION & PROCUREMENT GATE */}
        <Card
          size="small"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={8}>
                <ApartmentOutlined style={{ color: '#0369a1', fontSize: 16 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Management Decision &amp; Procurement Gate</span>
              </Space>
              {gateRecord?.workflow?.current ? (
                <Space size={4}>
                  <Tag color={liveWorkflowInfo.stageTagColor} style={{ fontWeight: 700, fontSize: 11, margin: 0, borderRadius: 4 }}>
                    {liveWorkflowInfo.stageLabel}
                  </Tag>
                  {liveWorkflowInfo.prNumber && (
                    <Tag color="blue" style={{ fontWeight: 700, fontSize: 11, margin: 0, borderRadius: 4 }}>
                      {liveWorkflowInfo.prNumber}
                    </Tag>
                  )}
                </Space>
              ) : (
                // Legacy Fallback ONLY
                <>
                  {gateRecord.status === 'READY_FOR_PROCUREMENT' && (
                    <Space size={4}>
                      <Tag color="success" style={{ fontWeight: 700, fontSize: 11, margin: 0, borderRadius: 4, color: '#15803d', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        MANAGEMENT APPROVED
                      </Tag>
                      {liveWorkflowInfo.prNumber && (
                        <Tag color={liveWorkflowInfo.stageTagColor} style={{ fontWeight: 700, fontSize: 11, margin: 0, borderRadius: 4 }}>
                          {liveWorkflowInfo.stageLabel}
                        </Tag>
                      )}
                    </Space>
                  )}
                  {gateRecord.status === 'NEEDS_REVISION' && (
                    <Tag color="error" style={{ fontWeight: 700, fontSize: 11, margin: 0, borderRadius: 4 }}>
                      NEEDS REVISION
                    </Tag>
                  )}
                  {gateRecord.status === 'REVIEW_PENDING' && (
                    <Tag color="processing" style={{ fontWeight: 700, fontSize: 11, margin: 0, borderRadius: 4 }}>
                      REVIEW PENDING
                    </Tag>
                  )}
                </>
              )}
            </div>
          }
          style={{
            borderRadius: 8,
            border: `1px solid ${
              gateRecord?.workflow
                ? getCanonicalStatusColor(gateRecord.workflow.current?.status).border
                : gateRecord.status === 'NEEDS_REVISION'
                ? '#f87171'
                : gateRecord.status === 'READY_FOR_PROCUREMENT'
                ? '#fde68a'
                : '#cbd5e1'
            }`,
            background:
              gateRecord?.workflow
                ? (gateRecord.workflow.current?.status === 'REVISION_REQUESTED' ? '#fff5f5' : '#ffffff')
                : gateRecord.status === 'NEEDS_REVISION'
                ? '#fff5f5'
                : gateRecord.status === 'READY_FOR_PROCUREMENT'
                ? '#fffbeb'
                : '#ffffff',
          }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: '1 1 340px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  {gateRecord?.workflow?.current
                    ? `${liveWorkflowInfo.stageLabel} — ${gateRecord.workflow.current.position}`
                    : gateRecord.status === 'READY_FOR_PROCUREMENT'
                    ? 'Status: Approved — Ready for Procurement'
                    : gateRecord.status === 'NEEDS_REVISION'
                    ? 'Status: Revision Requested — Perlu Revisi PM'
                    : gateRecord.status === 'REVIEW_PENDING'
                    ? 'Status: Under Management Review — Menunggu Keputusan Head of Operations'
                    : 'Status: PM Planning Workspace (Tahap 1 dari 5) — Siap Diajukan ke Head of Operations'}
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.45 }}>
                  {gateRecord?.workflow?.current
                    ? `Alur kerja saat ini: ${gateRecord.workflow.current.position}. Langkah berikutnya: ${gateRecord.workflow.current.nextStep}. Ditangani oleh: ${gateRecord.workflow.current.ownerName}.`
                    : gateRecord.status === 'READY_FOR_PROCUREMENT'
                    ? `Operational Plan telah disetujui Manajemen pada ${dayjs(gateRecord.decidedAt).format('DD MMM YYYY HH:mm')}. Tim Procurement berwenang membuat Purchase Request (PR).`
                    : gateRecord.status === 'NEEDS_REVISION'
                    ? `Catatan perbaikan: "${gateRecord.revisionNotes}". PM perlu merevisi paket perencanaan sebelum mengajukan kembali.`
                    : gateRecord.status === 'REVIEW_PENDING'
                    ? `Paket perencanaan sedang ditinjau oleh Head of Operations. Menunggu keputusan evaluasi/persetujuan rilis pengadaan.`
                    : 'Dokumen perencanaan telah lengkap 4/4 pilar dan siap diajukan oleh Project Manager ke Head of Operations. Tahap Procurement, Finance Review, dan Director Approval belum dimulai.'}
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 260 }}>
                <Space size={6}>
                  <SafetyCertificateOutlined
                    style={{
                      color: gateRecord?.workflow?.current?.status === 'COMPLETED' || gateRecord?.status === 'READY_FOR_PROCUREMENT' ? '#059669' : '#d97706',
                    }}
                  />
                  <Text
                    strong
                    style={{
                      fontSize: 11.5,
                      color: gateRecord?.workflow?.current ? '#065f46' : gateRecord?.status === 'READY_FOR_PROCUREMENT' ? '#065f46' : '#334155',
                    }}
                  >
                    Sumber:{' '}
                    {gateRecord?.workflow?.current
                      ? `Workflow SSOT Engine (${gateRecord.workflow.current.ownerName})`
                      : gateRecord?.status === 'READY_FOR_PROCUREMENT'
                      ? 'Approved Operational Plan'
                      : gateRecord?.status === 'REVIEW_PENDING'
                      ? 'Operational Plan — Under Review'
                      : gateRecord?.status === 'NEEDS_REVISION'
                      ? 'Operational Plan — Perlu Revisi PM'
                      : 'Draft Operational Plan (Perencanaan)'}
                  </Text>
                </Space>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                  {gateRecord?.workflow?.current
                    ? `Alur saat ini diatur oleh Workflow Engine: ${gateRecord.workflow.current.label}.`
                    : gateRecord?.status === 'READY_FOR_PROCUREMENT'
                    ? 'Operational Plan telah disetujui Manajemen. Alur kerja aktif dialihkan ke proses pengadaan & persetujuan downstream.'
                    : gateRecord?.status === 'REVIEW_PENDING'
                    ? 'Menunggu keputusan review dari Head of Operations di Tugas Persetujuan Proyek (/governance/tasks).'
                    : gateRecord?.status === 'NEEDS_REVISION'
                    ? 'Menunggu revisi dan pengajuan ulang dari Project Manager.'
                    : 'Menunggu pengajuan resmi dari Project Manager untuk memulai peninjauan eksekutif.'}
                </div>
              </div>
            </div>

            {/* Structured Executive Metadata Grid (Lifecycle SSOT Dynamic Derivation) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 8,
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                fontSize: 11,
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 600 }}>
                  Management Review
                </span>
                <span style={{ color: '#15803d', fontWeight: 700 }}>
                  {liveWorkflowInfo.managementReviewText}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 600 }}>
                  Downstream Workflow
                </span>
                <span style={{ color: liveWorkflowInfo.stageTagColor === 'purple' ? '#6d28d9' : liveWorkflowInfo.stageTagColor === 'processing' ? '#0369a1' : liveWorkflowInfo.stageTagColor === 'success' ? '#15803d' : '#475569', fontWeight: 700 }}>
                  {liveWorkflowInfo.downstreamWorkflowText}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 600 }}>
                  Current Owner
                </span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {liveWorkflowInfo.currentOwner}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 600 }}>
                  PR Reference
                </span>
                <span style={{ color: liveWorkflowInfo.prNumber ? '#1d4ed8' : '#64748b', fontWeight: 600 }}>
                  {liveWorkflowInfo.prNumber || '-'}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 600 }}>
                  Status Handover
                </span>
                <span style={{ color: '#b45309', fontWeight: 600 }}>
                  {liveWorkflowInfo.handoverText}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>



      {/* CREATE PURCHASE REQUEST MODAL FROM APPROVED PACKAGE */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 8, color: '#1d4ed8' }}>
              <FileDoneOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                Buat Purchase Request (PR) dari Paket Operasional
              </div>
              <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                {gateRecord?.status === 'READY_FOR_PROCUREMENT'
                  ? 'Pilih item pekerjaan / material dari Approved Operational Plan untuk diajukan sebagai PR'
                  : 'Pilih item pekerjaan / material dari Paket Operasional untuk diajukan sebagai PR'}
              </Text>
            </div>
          </div>
        }
        open={isCreatePrModalOpen}
        onCancel={() => setIsCreatePrModalOpen(false)}
        width="min(960px, 94vw)"
        centered
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <Text style={{ fontSize: 12, color: '#475569' }}>
                Item Dipilih: <strong>{selectedPrItems.length}</strong> dari {uncoveredRabItems.length} item tersedia | Total PR:{' '}
                <strong style={{ color: '#1d4ed8', fontSize: 13, fontFamily: 'monospace' }}>
                  Rp {totalPrAmount.toLocaleString('id-ID')}
                </strong>
              </Text>
            </div>
            <Space size={8}>
              <Button onClick={() => setIsCreatePrModalOpen(false)} style={{ borderRadius: 6 }}>
                Batal
              </Button>
              <Button
                type="primary"
                loading={isSubmittingPr}
                disabled={selectedPrItems.length === 0 || totalPrAmount <= 0}
                onClick={handleCreateAndSubmitPr}
                icon={<CheckCircleOutlined />}
                style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 6, fontWeight: 600 }}
              >
                Buat & Submit PR
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Project Context Reference Bar */}
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Row gutter={[12, 6]} align="middle">
              <Col xs={24} sm={8}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{charter.project_name}</div>
                <Tag color="blue" style={{ fontSize: 10, margin: 0, marginTop: 2 }}>{charter.project_code || `ID: ${charter.id}`}</Tag>
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>CUSTOMER & SPK:</Text>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>{charter.customerName || '—'}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Rp {Number(charter.contract_total_value || 0).toLocaleString('id-ID')}</div>
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>STATUS WORKFLOW:</Text>
                <div>
                  <Tag color="gold" style={{ fontWeight: 700, fontSize: 10.5, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}>
                    READY FOR PROCUREMENT
                  </Tag>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Approved by Head of Operations</div>
              </Col>
            </Row>
          </div>

          {/* Table of Selectable RAB Items */}
          <Table
            size="small"
            rowKey="key"
            dataSource={uncoveredRabItems}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedPrItemKeys,
              onChange: (keys) => setSelectedPrItemKeys(keys),
            }}
            pagination={false}
            scroll={{ y: 320 }}
            columns={[
              {
                title: 'Kategori',
                dataIndex: 'categoryName',
                key: 'categoryName',
                width: 170,
                render: (cat: string) => <Tag color="cyan" style={{ fontSize: 10.5, borderRadius: 4, margin: 0 }}>{cat}</Tag>,
              },
              {
                title: 'Nama Item (RAB)',
                dataIndex: 'itemName',
                key: 'itemName',
                render: (name: string, it: any) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{name}</div>
                    {it.wbsNodeId && (
                      <Tag color="geekblue" style={{ fontSize: 10, margin: 0, marginTop: 2 }}>
                        WBS Ref #{it.wbsNodeId}
                      </Tag>
                    )}
                  </div>
                ),
              },
              {
                title: 'Qty',
                dataIndex: 'quantity',
                key: 'quantity',
                width: 70,
                align: 'center' as const,
                render: (qty: number) => <span style={{ fontWeight: 600 }}>{qty}</span>,
              },
              {
                title: 'Satuan',
                dataIndex: 'uom',
                key: 'uom',
                width: 80,
                align: 'center' as const,
                render: (uom: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{uom}</span>,
              },
              {
                title: 'Estimasi Harga Satuan',
                dataIndex: 'unitPrice',
                key: 'unitPrice',
                width: 150,
                align: 'right' as const,
                render: (price: number) => <span style={{ fontFamily: 'monospace', fontSize: 11.5 }}>Rp {price.toLocaleString('id-ID')}</span>,
              },
              {
                title: 'Subtotal',
                dataIndex: 'subtotal',
                key: 'subtotal',
                width: 150,
                align: 'right' as const,
                render: (subtotal: number) => (
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#1d4ed8' }}>
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </Modal>
    </Modal>
  );
};
