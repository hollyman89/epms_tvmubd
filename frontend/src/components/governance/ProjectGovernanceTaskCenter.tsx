'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Typography,
  Alert,
  Spin,
  message,
  Empty,
  Input,
  Row,
  Col,
  Statistic,
  Tabs,
  Descriptions,
  Timeline,
  Radio,
  Tooltip,
} from 'antd';
import {
  AuditOutlined,
  EyeOutlined,
  CheckOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
  DollarCircleOutlined,
  ApartmentOutlined,
  ScheduleOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PercentageOutlined,
  RiseOutlined,
  FallOutlined,
  WalletOutlined,
  PieChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import {
  WorkflowEngineService,
  WorkflowTask,
  WorkflowTransition,
} from '@/services/workflowEngine.service';
import { ProjectService } from '@/services/project.service';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './ProjectGovernanceTaskCenter.module.css';
import {
  SUPPORTED_CLOSURE_NODES,
  SupportedClosureNode,
  CLOSURE_STAGE_MAPPING,
  ClosureStageInfo,
  isClosureTask,
  evaluateClosureTaskActionability,
  validateClosureReturnReason,
  ClosureActionEvaluation,
  resolveTaskApprovalClassification,
  ApprovalClassificationInfo,
  ApprovalClassification,
  APPROVAL_CLASSIFICATION_MAP,
} from './projectGovernanceClosure.utils';
import { ProjectClosureReviewModalContent } from './ProjectClosureReviewModalContent';

dayjs.locale('id');

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── Canonical Governance Review Nodes ──────────────────────────────────────────
export const SUPPORTED_GOVERNANCE_NODES = [
  'node_hops_review',
  'node_procurement_review',
  'node_finance_review',
  'node_director_approval',
] as const;

export type SupportedGovernanceNode = typeof SUPPORTED_GOVERNANCE_NODES[number];

export interface StageInfo {
  label: string;
  shortLabel: string;
  tagColor: string;
  nextNodeLabel: string;
  returnNodeLabel: string;
  requiredRole: string;
  requiredRoleLabel: string;
}

export const STAGE_MAPPING: Record<SupportedGovernanceNode, StageInfo> = {
  node_hops_review: {
    label: 'Head of Operations Review',
    shortLabel: 'Head of Operations',
    tagColor: 'blue',
    nextNodeLabel: 'Procurement Review',
    returnNodeLabel: 'PM Revision (Head of Operations)',
    requiredRole: 'HEAD_OF_OPERATIONS',
    requiredRoleLabel: 'Head of Operations',
  },
  node_procurement_review: {
    label: 'Procurement Review',
    shortLabel: 'Procurement',
    tagColor: 'orange',
    nextNodeLabel: 'Finance Review',
    returnNodeLabel: 'PM Revision (Procurement)',
    requiredRole: 'PROCUREMENT',
    requiredRoleLabel: 'Procurement',
  },
  node_finance_review: {
    label: 'Finance Review',
    shortLabel: 'Finance',
    tagColor: 'geekblue',
    nextNodeLabel: 'Director Approval',
    returnNodeLabel: 'PM Revision (Finance)',
    requiredRole: 'FINANCE',
    requiredRoleLabel: 'Finance',
  },
  node_director_approval: {
    label: 'Director Approval',
    shortLabel: 'Director',
    tagColor: 'purple',
    nextNodeLabel: 'Ready for Kickoff',
    returnNodeLabel: 'PM Revision (Director)',
    requiredRole: 'DIRECTOR',
    requiredRoleLabel: 'Director',
  },
};

export const WORKFLOW_HISTORY_COMPACT_LIMIT = 3;

/**
 * Determines whether the "Lihat Semua" button should be rendered based on total timeline entries.
 */
export function shouldShowWorkflowExpandButton(
  transitionsCount: number,
  isPendingStage: boolean,
  limit: number = WORKFLOW_HISTORY_COMPACT_LIMIT
): boolean {
  const totalEntries = transitionsCount + (isPendingStage ? 1 : 0);
  return totalEntries > limit;
}

/**
 * Slices workflow transitions for compact display while accounting for the pending stage.
 */
export function getDisplayedWorkflowTransitions<T>(
  transitions: T[],
  isExpanded: boolean,
  isPendingStage: boolean,
  limit: number = WORKFLOW_HISTORY_COMPACT_LIMIT
): T[] {
  if (isExpanded) {
    return transitions;
  }
  const effectiveLimit = isPendingStage ? Math.max(1, limit - 1) : limit;
  return transitions.slice(-effectiveLimit);
}

/**
 * Canonical helper to calculate and format schedule task duration.
 * Priority 1: If explicit canonical durationDays is provided, format and use it.
 * Priority 2: Derive inclusive calendar day duration: differenceInCalendarDays(endDate, startDate) + 1.
 * If either date is missing, invalid, or endDate < startDate, returns '—'.
 */
export function calculateScheduleDuration(record?: {
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  isMilestone?: boolean;
} | null): string {
  if (!record) return '—';
  if (record.isMilestone && !record.endDate) {
    return '—';
  }
  if (typeof record.durationDays === 'number' && record.durationDays > 0) {
    return `${record.durationDays} Hari`;
  }
  if (!record.startDate || !record.endDate) {
    return '—';
  }

  // Calendar-safe date parsing: normalize ISO strings to YYYY-MM-DD calendar date
  const parseCalendarDate = (val: string) => {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return dayjs(`${match[1]}-${match[2]}-${match[3]}`, 'YYYY-MM-DD');
    }
    return dayjs(val).startOf('day');
  };

  const start = parseCalendarDate(record.startDate);
  const end = parseCalendarDate(record.endDate);

  if (!start.isValid() || !end.isValid()) {
    return '—';
  }
  if (end.isBefore(start)) {
    return '—';
  }
  const diffDays = end.diff(start, 'day') + 1;
  return `${diffDays} Hari`;
}

/**
 * Maps BPMN node IDs to clean, human-readable stage names for executive display.
 */
export function formatWorkflowNodeLabel(nodeId?: string | null): string {
  if (!nodeId || nodeId === 'INIT' || nodeId === 'node_start') {
    return 'Workflow dimulai';
  }
  if (nodeId === 'node_hops_review') return 'Head of Operations Review';
  if (nodeId === 'node_procurement_review') return 'Procurement Review';
  if (nodeId === 'node_finance_review') return 'Finance Review';
  if (nodeId === 'node_director_approval') return 'Director Approval';
  if (nodeId === 'node_ready_for_kickoff' || nodeId === 'node_kickoff') return 'Ready for Kickoff';
  if (nodeId === 'node_hoo_review') return 'Review Closure HOO';
  if (nodeId === 'node_closed') return 'Proyek Selesai';
  if (nodeId.includes('revision')) return 'PM Revision';

  const gov = STAGE_MAPPING[nodeId as SupportedGovernanceNode];
  if (gov) return gov.shortLabel || gov.label;

  const closure = CLOSURE_STAGE_MAPPING[nodeId as SupportedClosureNode];
  if (closure) return closure.shortLabel || closure.label;

  return nodeId.replace(/^node_/, '').replace(/_/g, ' ');
}

export interface CanonicalContractSummary {
  id: number;
  contractNumber: string;
  contractValue: number;
  legalStatus: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface EnrichedGovernanceTask extends WorkflowTask {
  projectId: number;
  projectName: string;
  projectCode: string;
  contractNumber?: string;
  contract?: CanonicalContractSummary | null;
  submittedByName?: string | null;
  submittedAt?: string | null;
  readiness?: any;
  // Closure integration
  isClosure?: boolean;
  closureId?: number;
  cycleNumber?: number;
  customerName?: string;
  submissionNotes?: string;
  closureReadiness?: any;
  closureData?: any;
  // Approval Classification
  classification: ApprovalClassificationInfo;
}

export interface GovernanceActionContext {
  taskId: string | number;
  workflowInstanceId: string | number;
  projectId: number;
  projectName: string;
  projectCode: string;
  contractNumber?: string;
  nodeId: string;
  currentStageLabel: string;
  shortLabel?: string;
  tagColor?: string;
  nextNodeId?: string;
  nextNodeLabel?: string;
  returnNodeLabel?: string;
  isClosure: boolean;
  closureId?: number;
  closureData?: any;
}

export const buildGovernanceActionContext = (
  task: EnrichedGovernanceTask,
  stageInfo: StageInfo | ClosureStageInfo | null,
  fallbackClosureData?: any,
): GovernanceActionContext => {
  const isClosure = Boolean(task.isClosure);
  const stageLabel =
    stageInfo?.label ||
    (isClosure
      ? task.nodeId === 'node_hoo_review'
        ? 'Review Closure — Head of Operations'
        : 'Persetujuan Final Closure — Director'
      : STAGE_MAPPING[task.nodeId as SupportedGovernanceNode]?.label || task.nodeId);

  const nextNodeLabel =
    stageInfo?.nextNodeLabel ||
    (isClosure
      ? task.nodeId === 'node_hoo_review'
        ? 'Persetujuan Final Direktur'
        : 'Proyek Selesai (CLOSED)'
      : STAGE_MAPPING[task.nodeId as SupportedGovernanceNode]?.nextNodeLabel || 'Tahap Berikutnya');

  const returnNodeLabel =
    stageInfo?.returnNodeLabel ||
    (isClosure
      ? 'Dikembalikan ke PM'
      : STAGE_MAPPING[task.nodeId as SupportedGovernanceNode]?.returnNodeLabel || 'Dikembalikan ke PM');

  const tagColor = stageInfo?.tagColor || (isClosure ? 'cyan' : 'default');

  const effectiveClosureId = Number(
    task.closureId ||
      task.closureData?.id ||
      fallbackClosureData?.id ||
      0,
  );

  return {
    taskId: task.id,
    workflowInstanceId: task.workflowInstanceId,
    projectId: task.projectId,
    projectName: task.projectName || '',
    projectCode: task.projectCode || task.contractNumber || '',
    contractNumber: task.contractNumber || '',
    nodeId: task.nodeId,
    currentStageLabel: stageLabel,
    shortLabel: stageInfo?.shortLabel,
    tagColor,
    nextNodeLabel,
    returnNodeLabel,
    isClosure,
    closureId: effectiveClosureId || undefined,
    closureData: task.closureData || fallbackClosureData,
  };
};

// ── Financial Summary Calculation SSOT & Formatting ──────────────────────────
export interface ProjectFinancialMetricsInput {
  contractValue?: number | string | null;
  modalProject?: number | string | null;
  rabStatus?: string | null;
}

export interface ProjectFinancialSummaryResult {
  contractValue: number | null;
  modalProject: number | null;
  keuntungan: number | null;
  marginPercentage: number | null;
  roiPercentage: number | null;
  rabStatus: string | null;
  formattedRabStatus: string;
  formattedContractValue: string;
  formattedModalProject: string;
  formattedKeuntungan: string;
  formattedMargin: string;
  formattedRoi: string;
  isProfitNegative: boolean;
  isMarginNegative: boolean;
  isRoiNegative: boolean;
}

export function formatRupiahDisplay(
  val: number | null | undefined,
  fallback = 'Belum ada data',
): string {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  if (val < 0) {
    return `-Rp ${Math.abs(val).toLocaleString('id-ID')}`;
  }
  return `Rp ${val.toLocaleString('id-ID')}`;
}

export function formatPercentageDisplay(
  val: number | null | undefined,
  fallback = 'N/A',
): string {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return `${val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatRabStatusDisplay(
  val: string | null | undefined,
  fallback = 'Belum ada data',
): string {
  if (!val || typeof val !== 'string' || !val.trim()) {
    return fallback;
  }
  return val.trim();
}

/**
 * Resolves strictly canonical financial inputs from the authoritative SSOT sources:
 * - Contract Value: ONLY task.contract?.contractValue (authoritative contracts table)
 * - Modal Project: ONLY costData?.totalPmEstimate (authoritative project_cost_estimates & cost_items)
 * - RAB Status: Dynamic status from costData?.status
 *
 * Stale snapshots (readiness pillars, task context projections, legacy totalCost) are strictly rejected.
 */
export function resolveCanonicalFinancialInputs(
  task: EnrichedGovernanceTask | null,
  costData: any,
): ProjectFinancialMetricsInput {
  if (!task || task.isClosure) {
    return {
      contractValue: null,
      modalProject: null,
      rabStatus: null,
    };
  }

  // Canonical Contract SSOT: ONLY task.contract?.contractValue
  // NO fallback to task.contractValue or task.contractSummary?.contractValue
  const contractValue = task.contract?.contractValue ?? null;

  // Canonical RAB SSOT: ONLY costData?.totalPmEstimate
  // NO fallback to task.readiness?.costPillar?.totalEstimate or costData?.totalCost
  const modalProject = costData?.totalPmEstimate ?? null;

  // Dynamic canonical RAB status from Cost Estimate API
  const rawStatus = costData?.status;
  const rabStatus =
    rawStatus && typeof rawStatus === 'string' && rawStatus.trim()
      ? rawStatus.trim()
      : null;

  return {
    contractValue,
    modalProject,
    rabStatus,
  };
}

export function calculateProjectFinancialSummary(
  input: ProjectFinancialMetricsInput,
): ProjectFinancialSummaryResult {
  const parseNum = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const contractValue = parseNum(input.contractValue);
  const modalProject = parseNum(input.modalProject);
  const rabStatus =
    input.rabStatus && typeof input.rabStatus === 'string' && input.rabStatus.trim()
      ? input.rabStatus.trim()
      : null;

  const keuntungan =
    contractValue !== null && modalProject !== null
      ? contractValue - modalProject
      : null;

  const marginPercentage =
    keuntungan !== null && contractValue !== null && contractValue !== 0
      ? (keuntungan / contractValue) * 100
      : null;

  const roiPercentage =
    keuntungan !== null && modalProject !== null && modalProject !== 0
      ? (keuntungan / modalProject) * 100
      : null;

  const isProfitNegative = keuntungan !== null && keuntungan < 0;
  const isMarginNegative = marginPercentage !== null && marginPercentage < 0;
  const isRoiNegative = roiPercentage !== null && roiPercentage < 0;

  return {
    contractValue,
    modalProject,
    keuntungan,
    marginPercentage,
    roiPercentage,
    rabStatus,
    formattedRabStatus: formatRabStatusDisplay(rabStatus, 'Belum ada data'),
    formattedContractValue: formatRupiahDisplay(contractValue, 'Belum ada data'),
    formattedModalProject: formatRupiahDisplay(modalProject, 'Belum ada data'),
    formattedKeuntungan: keuntungan !== null ? formatRupiahDisplay(keuntungan) : 'N/A',
    formattedMargin: formatPercentageDisplay(marginPercentage, 'N/A'),
    formattedRoi: formatPercentageDisplay(roiPercentage, 'N/A'),
    isProfitNegative,
    isMarginNegative,
    isRoiNegative,
  };
}

interface WbsTreeNode {
  key: string | number;
  id: number;
  parentWbsId: number | null;
  code: string;
  name: string;
  level: number;
  weightPercentage: number;
  description?: string;
  isLeaf: boolean;
  children?: WbsTreeNode[];
}

/**
 * Pure helper to build hierarchical WBS tree from flat DB rows.
 */
const buildWbsTree = (
  flatList: any[],
): { tree: WbsTreeNode[]; totalWeight: number; leafCount: number } => {
  if (!Array.isArray(flatList) || flatList.length === 0) {
    return { tree: [], totalWeight: 0, leafCount: 0 };
  }

  const parentIdSet = new Set<number>();
  for (const item of flatList) {
    const pId = item.parentWbsId ?? item.parent_wbs_id ?? null;
    if (pId !== null && pId !== undefined) {
      parentIdSet.add(Number(pId));
    }
  }

  const nodeMap = new Map<number, WbsTreeNode>();
  for (const item of flatList) {
    const id = Number(item.id);
    const pId = item.parentWbsId ?? item.parent_wbs_id ?? null;
    const weight = Number(item.weightPercentage ?? item.weight_percentage ?? 0);
    const isLeaf = !parentIdSet.has(id);

    nodeMap.set(id, {
      key: id,
      id,
      parentWbsId: pId !== null ? Number(pId) : null,
      code: String(item.code || ''),
      name: String(item.name || ''),
      level: Number(item.level || 1),
      weightPercentage: weight,
      description: item.description || '',
      isLeaf,
      children: [],
    });
  }

  const roots: WbsTreeNode[] = [];
  let rootWeightSum = 0;
  let leafCount = 0;

  for (const item of flatList) {
    const id = Number(item.id);
    const node = nodeMap.get(id);
    if (!node) continue;

    if (node.isLeaf) {
      leafCount++;
    }

    if (node.parentWbsId && nodeMap.has(node.parentWbsId)) {
      nodeMap.get(node.parentWbsId)!.children!.push(node);
    } else {
      roots.push(node);
      rootWeightSum += node.weightPercentage;
    }
  }

  const cleanEmptyChildren = (nodes: WbsTreeNode[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length === 0) {
        delete (n as any).children;
      } else if (n.children && n.children.length > 0) {
        cleanEmptyChildren(n.children);
      }
    }
  };
  cleanEmptyChildren(roots);

  return { tree: roots, totalWeight: rootWeightSum, leafCount };
};

export const ProjectGovernanceTaskCenter: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get('taskId');
  const projectIdParam = searchParams.get('projectId');
  const autoOpenedTaskRef = useRef<string | null>(null);

  // Normalize current user roles
  const userRoles = useMemo<string[]>(() => {
    if (!user) return [];
    const rawRoles = user.roles || (user as any).role ? [user.roles || (user as any).role] : [];
    const flattened = Array.isArray(rawRoles) ? rawRoles.flat() : [rawRoles];
    return flattened.map((r: any) =>
      typeof r === 'string' ? r.toUpperCase() : String(r?.name || r).toUpperCase(),
    );
  }, [user]);

  // Review Workspace Modal State
  const [selectedTask, setSelectedTask] = useState<EnrichedGovernanceTask | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Detailed Data States
  const [costData, setCostData] = useState<any>(null);
  const [wbsData, setWbsData] = useState<any[]>([]);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [initialConditionData, setInitialConditionData] = useState<any>(null);
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowTransition[]>([]);
  const [workflowHistoryExpanded, setWorkflowHistoryExpanded] = useState<boolean>(false);

  // Project Closure Data States
  const [closureData, setClosureData] = useState<any>(null);
  const [closureReadinessData, setClosureReadinessData] = useState<any>(null);
  const [approveNotes, setApproveNotes] = useState<string>('');

  // Action Dialog States
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Stable Action Context States (Independent of Review Modal Lifecycle)
  const [approvalActionContext, setApprovalActionContext] = useState<GovernanceActionContext | null>(null);
  const [returnActionContext, setReturnActionContext] = useState<GovernanceActionContext | null>(null);

  // Approval Classification Filter State
  const [filterType, setFilterType] = useState<'ALL' | 'MANAGEMENT_REVIEW' | 'PROJECT_CLOSURE'>('ALL');

  // ── 1. Fetch & Filter Tasks strictly matching canonical predicate via React Query ──
  const {
    data: tasks = [],
    isLoading: loading,
    isError,
    error,
    refetch: fetchTasks,
  } = useQuery<EnrichedGovernanceTask[]>({
    queryKey: ['governance-tasks'],
    queryFn: async () => {
      const allTasks = await WorkflowEngineService.getMyTasks();

      // Canonical task predicate:
      // status === 'PENDING'
      // 1. PROJECT_PLAN_REVIEW_WORKFLOW at supported governance review nodes
      // 2. PROJECT_CLOSURE at supported closure review nodes (node_hoo_review, node_director_approval)
      const filtered = (allTasks || []).filter((t) => {
        const wKey =
          t.workflowInstance?.workflowDefinition?.workflowKey ||
          (t as any).workflowKey;
        const eType =
          t.workflowInstance?.entityType ||
          (t as any).entityType;

        if (t.status !== 'PENDING') return false;

        // 1. Existing Project Operational Plan Review
        if (
          wKey === 'PROJECT_PLAN_REVIEW_WORKFLOW' &&
          eType === 'PROJECT' &&
          SUPPORTED_GOVERNANCE_NODES.includes(t.nodeId as SupportedGovernanceNode)
        ) {
          return true;
        }

        // 2. Canonical Project Closure Review
        if (
          (wKey === 'PROJECT_CLOSURE' || isClosureTask(t)) &&
          (eType === 'PROJECT_CLOSURE' || (t as any).entityType === 'PROJECT_CLOSURE') &&
          SUPPORTED_CLOSURE_NODES.includes(t.nodeId as SupportedClosureNode)
        ) {
          return true;
        }

        return false;
      });

      // Enrich task items with Project Metadata, Canonical Contract SSOT, or Closure SSOT
      const enriched: EnrichedGovernanceTask[] = await Promise.all(
        filtered.map(async (t) => {
          const wKey =
            t.workflowInstance?.workflowDefinition?.workflowKey ||
            (t as any).workflowKey;
          const isClosure = wKey === 'PROJECT_CLOSURE' || isClosureTask(t);

          if (isClosure) {
            const pid = Number(
              t.workflowInstance?.context?.projectId ||
                (t as any).projectId ||
                0,
            );
            let pName = t.workflowInstance?.context?.projectName || '';
            let pCode = t.workflowInstance?.context?.projectCode || '';
            const cycleNum = Number(t.workflowInstance?.context?.cycleNumber || 1);
            let subByName: string | null = null;
            let subAt: string | null = t.createdAt || null;
            let subNotes: string | null = null;
            let custName = '';
            let cData: any = null;
            let rData: any = null;

            if (pid > 0) {
              try {
                const [closureRes, readinessRes] = await Promise.allSettled([
                  ProjectService.getCurrentClosure(pid),
                  ProjectService.getClosureReadiness(pid),
                ]);
                if (closureRes.status === 'fulfilled' && closureRes.value) {
                  cData = closureRes.value;
                  subByName = cData.submittedBy?.name || cData.submittedByName || subByName;
                  subAt = cData.submittedAt || subAt;
                  subNotes = cData.submissionNotes || null;
                }
                if (readinessRes.status === 'fulfilled' && readinessRes.value) {
                  rData = readinessRes.value;
                  pName = rData.projectName || pName;
                  pCode = rData.projectCode || pCode;
                  custName = rData.customerName || '';
                }
              } catch (err) {
                console.warn(`Failed to enrich closure task for project #${pid}:`, err);
              }
            }

            const closureId = Number(
              t.workflowInstance?.context?.closureId ||
                (t as any).closureId ||
                cData?.id ||
                0,
            );

            return {
              ...t,
              projectId: pid,
              projectName: pName || `Proyek #${pid}`,
              projectCode: pCode || `PRJ-${pid}`,
              isClosure: true,
              closureId: closureId > 0 ? closureId : undefined,
              cycleNumber: cycleNum,
              customerName: custName,
              submittedByName:
                subByName ||
                t.workflowInstance?.context?.submittedByName ||
                null,
              submittedAt: subAt,
              submissionNotes: subNotes,
              closureData: cData,
              closureReadiness: rData,
              classification: APPROVAL_CLASSIFICATION_MAP.PROJECT_CLOSURE,
            };
          }

          const pid = Number(
            t.workflowInstance?.entityId ||
              t.workflowInstance?.context?.projectId ||
              0,
          );

          let pName = t.workflowInstance?.context?.projectName || '';
          let pCode = t.workflowInstance?.context?.projectCode || '';
          let cNumber = '';
          let contractObj: CanonicalContractSummary | null = null;
          let subByName: string | null = null;
          let subAt: string | null = t.createdAt || null;
          let readinessData: any = null;

          if (pid > 0) {
            try {
              readinessData = await ProjectService.getOperationalReadiness(pid);
              if (readinessData) {
                pName = readinessData.projectName || pName;
                pCode = readinessData.projectCode || pCode;
                if (readinessData.contract) {
                  contractObj = readinessData.contract;
                  cNumber = readinessData.contract.contractNumber || '';
                }
                if (readinessData.gate?.submittedByName) {
                  subByName = readinessData.gate.submittedByName;
                }
                if (readinessData.gate?.submittedAt) {
                  subAt = readinessData.gate.submittedAt;
                }
              }
            } catch (err) {
              console.warn(`Failed to enrich project #${pid}:`, err);
            }
          }

          return {
            ...t,
            projectId: pid,
            projectName: pName || `Proyek #${pid}`,
            projectCode: pCode || `PRJ-${pid}`,
            contractNumber: cNumber,
            contract: contractObj,
            submittedByName:
              subByName ||
              t.workflowInstance?.context?.submittedByName ||
              null,
            submittedAt: subAt,
            readiness: readinessData,
            classification: APPROVAL_CLASSIFICATION_MAP.MANAGEMENT_REVIEW,
          };
        }),
      );

      return enriched;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // ── Approval Classification Filter & Counts ──────────────────────────────
  const managementReviewCount = useMemo(
    () => tasks.filter((t) => t.classification?.code === 'MANAGEMENT_REVIEW' || !t.isClosure).length,
    [tasks],
  );

  const projectClosureCount = useMemo(
    () => tasks.filter((t) => t.classification?.code === 'PROJECT_CLOSURE' || t.isClosure).length,
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    if (filterType === 'ALL') return tasks;
    if (filterType === 'MANAGEMENT_REVIEW') {
      return tasks.filter((t) => t.classification?.code === 'MANAGEMENT_REVIEW' || !t.isClosure);
    }
    if (filterType === 'PROJECT_CLOSURE') {
      return tasks.filter((t) => t.classification?.code === 'PROJECT_CLOSURE' || t.isClosure);
    }
    return tasks;
  }, [tasks, filterType]);

  // ── Role Authorization Check for Current Selected Task ──────────────────────
  const currentStageInfo = useMemo<StageInfo | ClosureStageInfo | null>(() => {
    if (!selectedTask) return null;
    if (selectedTask.isClosure) {
      return (
        CLOSURE_STAGE_MAPPING[selectedTask.nodeId as SupportedClosureNode] || {
          label:
            selectedTask.nodeId === 'node_hoo_review'
              ? 'Review Closure — Head of Operations'
              : 'Persetujuan Final Closure — Director',
          shortLabel: selectedTask.nodeId,
          tagColor: 'cyan',
          nextNodeLabel: 'Tahap Selanjutnya',
          returnNodeLabel: 'Dikembalikan ke PM',
          requiredRole:
            selectedTask.nodeId === 'node_hoo_review'
              ? 'HEAD_OF_OPERATIONS'
              : 'DIRECTOR',
          requiredRoleLabel:
            selectedTask.nodeId === 'node_hoo_review'
              ? 'Head of Operations'
              : 'Director',
        }
      );
    }
    return (
      STAGE_MAPPING[selectedTask.nodeId as SupportedGovernanceNode] || {
        label: selectedTask.nodeId,
        shortLabel: selectedTask.nodeId,
        tagColor: 'default',
        nextNodeLabel: 'Next Stage',
        returnNodeLabel: 'PM Revision',
        requiredRole: 'UNKNOWN',
        requiredRoleLabel: 'Reviewer',
      }
    );
  }, [selectedTask]);

  // Closure Action Evaluation
  const closureActionEval = useMemo<ClosureActionEvaluation | null>(() => {
    if (!selectedTask || !selectedTask.isClosure) return null;
    return evaluateClosureTaskActionability(selectedTask, userRoles);
  }, [selectedTask, userRoles]);

  // ── Financial Summary Calculation (SSOT Hardened) ─────────────────────────
  const financialSummary = useMemo<ProjectFinancialSummaryResult | null>(() => {
    if (!selectedTask || selectedTask.isClosure) return null;
    const inputs = resolveCanonicalFinancialInputs(selectedTask, costData);
    return calculateProjectFinancialSummary(inputs);
  }, [selectedTask, costData]);

  // Strict SoD: Only matching operational role may execute decision actions
  const canUserDecideTask = useMemo<boolean>(() => {
    if (!selectedTask || !user) return false;

    // Strict role authority for Project Closure
    if (selectedTask.isClosure) {
      return closureActionEval?.canApprove === true;
    }

    // Role authority for Project Operational Plan Review
    const stageInfo = STAGE_MAPPING[selectedTask.nodeId as SupportedGovernanceNode];
    if (!stageInfo) return false;

    const reqRole = stageInfo.requiredRole;
    if (reqRole === 'HEAD_OF_OPERATIONS') {
      return (
        userRoles.includes('HEAD_OF_OPERATIONS') ||
        userRoles.includes('GENERAL_MANAGER')
      );
    }
    if (reqRole === 'PROCUREMENT') {
      return (
        userRoles.includes('PROCUREMENT') ||
        userRoles.includes('PURCHASING')
      );
    }
    if (reqRole === 'FINANCE') {
      return userRoles.includes('FINANCE');
    }
    if (reqRole === 'DIRECTOR') {
      return userRoles.includes('DIRECTOR');
    }
    return false;
  }, [selectedTask, user, userRoles, closureActionEval]);

  // ── 2. Open Review Workspace Modal ─────────────────────────────────────────
  const handleOpenReview = async (task: EnrichedGovernanceTask) => {
    setSelectedTask(task);
    setIsReviewModalOpen(true);
    setWorkflowHistoryExpanded(false);
    setModalLoading(true);

    try {
      const pid = task.projectId;
      const wfInstanceId = task.workflowInstanceId;

      if (task.isClosure) {
        if (pid > 0) {
          const [closureRes, readinessRes] = await Promise.allSettled([
            ProjectService.getCurrentClosure(pid),
            ProjectService.getClosureReadiness(pid),
          ]);
          if (closureRes.status === 'fulfilled') setClosureData(closureRes.value);
          if (readinessRes.status === 'fulfilled')
            setClosureReadinessData(readinessRes.value);
        }
      } else {
        if (pid > 0) {
          const [costRes, wbsRes, schedRes, initRes, transRes] =
            await Promise.allSettled([
              ProjectService.getCostEstimate(pid),
              ProjectService.getWbsByProject(pid),
              ProjectService.getProjectSchedule(pid),
              ProjectService.getInitialCondition(pid),
              wfInstanceId
                ? WorkflowEngineService.getTransitions(wfInstanceId)
                : Promise.resolve([]),
            ]);

          if (costRes.status === 'fulfilled') setCostData(costRes.value);
          if (wbsRes.status === 'fulfilled')
            setWbsData(Array.isArray(wbsRes.value) ? wbsRes.value : []);
          if (schedRes.status === 'fulfilled') setScheduleData(schedRes.value);
          if (initRes.status === 'fulfilled') setInitialConditionData(initRes.value);
          if (transRes.status === 'fulfilled')
            setWorkflowTransitions(Array.isArray(transRes.value) ? transRes.value : []);
        }
      }
    } catch (err) {
      console.warn('Failed to load review workspace details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseReview = () => {
    setIsReviewModalOpen(false);
    setSelectedTask(null);
    setCostData(null);
    setWbsData([]);
    setScheduleData(null);
    setInitialConditionData(null);
    setWorkflowTransitions([]);
    setWorkflowHistoryExpanded(false);
    setClosureData(null);
    setClosureReadinessData(null);
    setApproveNotes('');
  };

  // Deep-link support: auto open review modal if taskId is present
  useEffect(() => {
    if (!taskIdParam || loading) return;
    if (autoOpenedTaskRef.current === taskIdParam) return;

    const matchingTask = tasks.find((t) => {
      const matchTaskId = String(t.id) === String(taskIdParam);
      if (!matchTaskId) return false;
      if (projectIdParam && String(t.projectId) !== String(projectIdParam)) {
        return false;
      }
      return true;
    });

    if (matchingTask) {
      autoOpenedTaskRef.current = taskIdParam;
      handleOpenReview(matchingTask);
    }
  }, [taskIdParam, projectIdParam, tasks, loading]);

  // ── Action Modal Open/Close Helpers (Snapshotting Immutable Action Context) ──
  const handleOpenApproveConfirm = () => {
    if (!selectedTask || !canUserDecideTask) {
      message.error('Konteks tugas persetujuan tidak valid atau Anda tidak memiliki akses.');
      return;
    }
    const ctx = buildGovernanceActionContext(selectedTask, currentStageInfo, closureData);
    setApprovalActionContext(ctx);
    setIsApproveConfirmOpen(true);
  };

  const handleCloseApproveConfirm = () => {
    setIsApproveConfirmOpen(false);
    setApprovalActionContext(null);
  };

  const handleOpenReturnModal = () => {
    if (!selectedTask || !canUserDecideTask) {
      message.error('Konteks tugas persetujuan tidak valid atau Anda tidak memiliki akses.');
      return;
    }
    const ctx = buildGovernanceActionContext(selectedTask, currentStageInfo, closureData);
    setReturnActionContext(ctx);
    setIsReturnModalOpen(true);
  };

  const handleCloseReturnModal = () => {
    setIsReturnModalOpen(false);
    setReturnActionContext(null);
    setReturnReason('');
  };

  // ── 3. APPROVE Action ──────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!approvalActionContext || !canUserDecideTask) {
      message.error('Konteks tindakan persetujuan hilang atau tidak valid.');
      return;
    }
    setSubmittingAction(true);

    try {
      if (approvalActionContext.isClosure) {
        let effectiveClosureId = Number(
          approvalActionContext.closureId ||
            approvalActionContext.closureData?.id ||
            0,
        );
        if (!effectiveClosureId) {
          effectiveClosureId = Number((await ProjectService.getCurrentClosure(approvalActionContext.projectId))?.id || 0);
        }
        if (!effectiveClosureId) {
          throw new Error('ID Penutupan proyek tidak ditemukan.');
        }

        if (approvalActionContext.nodeId === 'node_hoo_review') {
          await ProjectService.hooApproveClosure(
            approvalActionContext.projectId,
            effectiveClosureId,
            {
              notes: approveNotes.trim() || undefined,
            },
          );
          message.success(
            'Penutupan proyek berhasil disetujui oleh Head of Operations! Alur kerja dialihkan ke Direktur.',
          );
        } else if (approvalActionContext.nodeId === 'node_director_approval') {
          await ProjectService.directorApproveClosure(
            approvalActionContext.projectId,
            effectiveClosureId,
            {
              notes: approveNotes.trim() || undefined,
            },
          );
          message.success(
            'Penutupan proyek berhasil disetujui resmi oleh Direktur! Status proyek kini CLOSED.',
          );
        }
      } else {
        const stageLabel = approvalActionContext.currentStageLabel;

        await WorkflowEngineService.completeTask(
          Number(approvalActionContext.workflowInstanceId),
          Number(approvalActionContext.taskId),
          {
            action: 'APPROVE',
            reason: `Disetujui pada tahap ${stageLabel}`,
          },
        );

        message.success(
          `Rencana operasional berhasil disetujui pada tahap ${stageLabel}! Alur kerja dialihkan ke tahap berikutnya.`,
        );
      }

      handleCloseApproveConfirm();
      handleCloseReview();
      queryClient.invalidateQueries({ queryKey: ['governance-tasks'] });
      await fetchTasks();
    } catch (err: any) {
      console.error('[ProjectGovernanceTaskCenter] APPROVE failed:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Gagal menyetujui tugas persetujuan.';
      message.error(errMsg);
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── 4. RETURN Action ───────────────────────────────────────────────────────
  const handleReturn = async () => {
    if (!returnActionContext || !canUserDecideTask) {
      message.error('Konteks tindakan pengembalian hilang atau tidak valid.');
      return;
    }
    if (!returnReason || returnReason.trim().length < 10) {
      message.error('Alasan perbaikan/pengembalian wajib diisi minimal 10 karakter!');
      return;
    }

    setSubmittingAction(true);

    try {
      if (returnActionContext.isClosure) {
        let effectiveClosureId = Number(
          returnActionContext.closureId ||
            returnActionContext.closureData?.id ||
            0,
        );
        if (!effectiveClosureId) {
          effectiveClosureId = Number((await ProjectService.getCurrentClosure(returnActionContext.projectId))?.id || 0);
        }
        if (!effectiveClosureId) {
          throw new Error('ID Penutupan proyek tidak ditemukan.');
        }

        if (returnActionContext.nodeId === 'node_hoo_review') {
          await ProjectService.hooReturnClosure(
            returnActionContext.projectId,
            effectiveClosureId,
            {
              reason: returnReason.trim(),
            },
          );
          message.warning(
            'Pengajuan penutupan proyek dikembalikan ke Project Manager untuk perbaikan.',
          );
        } else if (returnActionContext.nodeId === 'node_director_approval') {
          await ProjectService.directorReturnClosure(
            returnActionContext.projectId,
            effectiveClosureId,
            {
              reason: returnReason.trim(),
            },
          );
          message.warning(
            'Pengajuan penutupan proyek dikembalikan ke Project Manager untuk perbaikan.',
          );
        }
      } else {
        const stageLabel = returnActionContext.currentStageLabel;

        await WorkflowEngineService.completeTask(
          Number(returnActionContext.workflowInstanceId),
          Number(returnActionContext.taskId),
          {
            action: 'RETURN',
            reason: returnReason.trim(),
          },
        );

        message.warning(
          `Rencana operasional dikembalikan ke Project Manager untuk perbaikan (${stageLabel}).`,
        );
      }

      handleCloseReturnModal();
      handleCloseReview();
      queryClient.invalidateQueries({ queryKey: ['governance-tasks'] });
      await fetchTasks();
    } catch (err: any) {
      console.error('[ProjectGovernanceTaskCenter] RETURN failed:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Gagal mengembalikan tugas persetujuan.';
      message.error(errMsg);
    } finally {
      setSubmittingAction(false);
    }
  };

  const wbsTreeData = useMemo(() => buildWbsTree(wbsData), [wbsData]);

  // Helper to render Project References suppressing duplicate chips
  const renderProjectReferences = (record: EnrichedGovernanceTask) => {
    const isDuplicate = Boolean(
      record.projectCode &&
      record.contractNumber &&
      record.projectCode.trim() === record.contractNumber.trim(),
    );

    if (isDuplicate) {
      return (
        <Tag
          color="blue"
          style={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: 11,
            margin: 0,
          }}
        >
          {record.projectCode}
        </Tag>
      );
    }

    return (
      <Space size={6} wrap>
        <Tag
          color="blue"
          style={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: 11,
            margin: 0,
          }}
        >
          Proyek: {record.projectCode}
        </Tag>
        {record.contractNumber && (
          <Tag
            color="cyan"
            style={{
              fontFamily: 'monospace',
              fontSize: 10.5,
              margin: 0,
            }}
          >
            <FileTextOutlined /> Kontrak: {record.contractNumber}
          </Tag>
        )}
      </Space>
    );
  };

  // ── Queue Table Columns (| Jenis Approval | Project | Tahap | Diajukan | Status | Aksi |) ──
  const columns = useMemo(
    () => [
      {
        title: 'Jenis Approval',
        key: 'jenisApproval',
        width: 170,
        render: (_: any, record: EnrichedGovernanceTask) => {
          const cls = record.classification || resolveTaskApprovalClassification(record);
          return (
            <Tag
              color={cls.tagColor}
              style={{
                fontWeight: 600,
                fontSize: 11.5,
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {cls.label}
            </Tag>
          );
        },
      },
      {
        title: 'Project',
        key: 'project',
        render: (_: any, record: EnrichedGovernanceTask) => {
          if (record.isClosure) {
            return (
              <div>
                <Space size={6} wrap>
                  <Tag
                    color="blue"
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      fontSize: 11,
                      margin: 0,
                    }}
                  >
                    Proyek: {record.projectCode}
                  </Tag>
                  <Tag
                    color="cyan"
                    style={{
                      fontWeight: 600,
                      fontSize: 11,
                      margin: 0,
                    }}
                  >
                    Siklus #{record.cycleNumber || 1}
                  </Tag>
                  {record.customerName && (
                    <Tag
                      color="purple"
                      style={{
                        fontSize: 10.5,
                        margin: 0,
                      }}
                    >
                      {record.customerName}
                    </Tag>
                  )}
                </Space>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#0f172a',
                    marginTop: 4,
                  }}
                >
                  {record.projectName}
                </div>
              </div>
            );
          }

          return (
            <div>
              {renderProjectReferences(record)}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#0f172a',
                  marginTop: 4,
                }}
              >
                {record.projectName}
              </div>
            </div>
          );
        },
      },
      {
        title: 'Tahap',
        key: 'tahap',
        width: 260,
        render: (_: any, record: EnrichedGovernanceTask) => {
          if (record.isClosure) {
            const info = CLOSURE_STAGE_MAPPING[record.nodeId as SupportedClosureNode];
            return (
              <Tag
                color={info?.tagColor || 'cyan'}
                style={{
                  fontWeight: 600,
                  fontSize: 11.5,
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                {info?.label ||
                  (record.nodeId === 'node_hoo_review'
                    ? 'Review Closure — Head of Operations'
                    : 'Persetujuan Final Closure — Director')}
              </Tag>
            );
          }
          const info = STAGE_MAPPING[record.nodeId as SupportedGovernanceNode];
          return (
            <Tag
              color={info?.tagColor || 'default'}
              style={{
                fontWeight: 600,
                fontSize: 11.5,
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {info?.label || record.nodeId}
            </Tag>
          );
        },
      },
      {
        title: 'Diajukan',
        key: 'diajukan',
        width: 200,
        render: (_: any, record: EnrichedGovernanceTask) => (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
              <ClockCircleOutlined style={{ marginRight: 4, color: '#64748b' }} />
              {record.submittedAt
                ? dayjs(record.submittedAt).format('DD MMM YYYY · HH:mm')
                : 'Belum tersedia'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {record.submittedByName || 'Belum tersedia'}
            </div>
          </div>
        ),
      },
      {
        title: 'Status',
        key: 'status',
        width: 170,
        render: () => (
          <Tag
            color="processing"
            style={{ fontWeight: 600, fontSize: 11, borderRadius: 4 }}
          >
            Menunggu Persetujuan
          </Tag>
        ),
      },
      {
        title: 'Aksi',
        key: 'aksi',
        width: 100,
        fixed: 'right' as const,
        render: (_: any, record: EnrichedGovernanceTask) => (
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenReview(record)}
            style={{
              fontWeight: 600,
              borderRadius: 6,
            }}
          >
            Tinjau
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className={styles.pageContainer}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Approval Center
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Pusat persetujuan terpusat untuk seluruh proses approval proyek.
        </Text>
      </div>

      {/* Explicit Error State */}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Antrean Approval Center"
          description={
            <div style={{ marginTop: 4 }}>
              <div>
                {(error as any)?.message ||
                  'Terjadi kesalahan komunikasi saat menghubungi server workflow.'}
              </div>
              <Button
                size="small"
                danger
                icon={<ReloadOutlined />}
                onClick={() => fetchTasks()}
                style={{ marginTop: 8, fontWeight: 600 }}
              >
                Coba Lagi
              </Button>
            </div>
          }
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {/* Main Canonical Queue Card */}
      <Card
        size="small"
        className={styles.tableCard}
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '6px 0',
            }}
          >
            <Space size={8}>
              <AuditOutlined style={{ color: '#0284c7', fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                Antrean Persetujuan
              </span>
              {loading ? (
                <Tag
                  color="default"
                  style={{
                    fontWeight: 600,
                    borderRadius: 4,
                    margin: 0,
                  }}
                >
                  <Spin size="small" style={{ marginRight: 6 }} />
                  Memuat...
                </Tag>
              ) : isError ? (
                <Tag
                  color="error"
                  style={{
                    fontWeight: 600,
                    borderRadius: 4,
                    margin: 0,
                  }}
                >
                  Gagal Memuat Data
                </Tag>
              ) : (
                <Tag
                  color="blue"
                  style={{
                    fontWeight: 700,
                    borderRadius: 4,
                    margin: 0,
                    color: '#0369a1',
                    background: '#f0f9ff',
                    borderColor: '#bae6fd',
                  }}
                >
                  {filteredTasks.length} Menunggu Persetujuan
                </Tag>
              )}
            </Space>

            <Space size={12} wrap>
              <Radio.Group
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                size="small"
                buttonStyle="solid"
                data-testid="approval-center-filter"
              >
                <Radio.Button value="ALL">Semua ({tasks.length})</Radio.Button>
                <Radio.Button value="MANAGEMENT_REVIEW">
                  Management Review ({managementReviewCount})
                </Radio.Button>
                <Radio.Button value="PROJECT_CLOSURE">
                  Project Closure ({projectClosureCount})
                </Radio.Button>
              </Radio.Group>

              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchTasks();
                }}
                loading={loading}
                style={{ fontSize: 12, color: '#0284c7', fontWeight: 600 }}
              >
                Segarkan
              </Button>
            </Space>
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        {/* DESKTOP & TABLET VIEW (TABLE WITH FIXED RIGHT ACTION) */}
        <div className={styles.desktopView}>
          <Table
            columns={columns}
            dataSource={filteredTasks}
            rowKey="id"
            loading={loading}
            pagination={false}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: '#475569',
                        }}
                      >
                        Tidak ada tugas approval yang menunggu tindakan Anda
                      </div>
                      <Text type="secondary" style={{ fontSize: 11.5 }}>
                        Semua tugas approval proyek telah disetujui atau belum dialihkan ke peran Anda.
                      </Text>
                    </div>
                  }
                />
              ),
            }}
          />
        </div>

        {/* MOBILE VIEW (RESPONSIVE CARDS) */}
        <div className={styles.mobileView}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin tip="Memuat daftar tugas..." />
            </div>
          ) : filteredTasks.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#475569',
                    }}
                  >
                    Tidak ada tugas approval yang menunggu tindakan Anda
                  </div>
                </div>
              }
            />
          ) : (
            filteredTasks.map((record) => {
              const stageInfo = record.isClosure
                ? CLOSURE_STAGE_MAPPING[record.nodeId as SupportedClosureNode]
                : STAGE_MAPPING[record.nodeId as SupportedGovernanceNode];
              return (
                <div key={record.id} className={styles.mobileCard}>
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileProjectName}>
                      {record.projectName}
                    </div>
                    <div>
                      {record.isClosure ? (
                        <Space size={4} wrap>
                          <Tag
                            color="blue"
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              fontSize: 10.5,
                              margin: 0,
                            }}
                          >
                            {record.projectCode}
                          </Tag>
                          <Tag
                            color="cyan"
                            style={{
                              fontWeight: 600,
                              fontSize: 10.5,
                              margin: 0,
                            }}
                          >
                            Siklus #{record.cycleNumber || 1}
                          </Tag>
                        </Space>
                      ) : (
                        renderProjectReferences(record)
                      )}
                    </div>
                  </div>

                  <div className={styles.mobileBadgeRow}>
                    <Tag
                      color={record.classification?.tagColor || 'blue'}
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 4,
                        margin: 0,
                      }}
                    >
                      {record.classification?.label || 'Management Review'}
                    </Tag>
                    <Tag
                      color={stageInfo?.tagColor || 'default'}
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 4,
                        margin: 0,
                      }}
                    >
                      {stageInfo?.label || record.nodeId}
                    </Tag>
                    <Tag
                      color="processing"
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        borderRadius: 4,
                        margin: 0,
                      }}
                    >
                      Menunggu Persetujuan
                    </Tag>
                  </div>

                  <div className={styles.mobileMetaRow}>
                    <div>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {record.submittedAt
                        ? dayjs(record.submittedAt).format('DD MMM YYYY · HH:mm')
                        : 'Belum tersedia'}
                    </div>
                    <div>
                      <UserOutlined style={{ marginRight: 4 }} />
                      Pengaju: {record.submittedByName || 'Belum tersedia'}
                    </div>
                  </div>

                  <div className={styles.mobileActionRow}>
                    <Button
                      type="primary"
                      block
                      icon={<EyeOutlined />}
                      onClick={() => handleOpenReview(record)}
                      style={{ fontWeight: 600, borderRadius: 6 }}
                    >
                      {record.isClosure
                        ? 'Tinjau Penutupan Proyek'
                        : 'Tinjau Rencana Operasional'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* ── GOVERNANCE REVIEW WORKSPACE MODAL ───────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SafetyCertificateOutlined style={{ color: '#0284c7', fontSize: 24 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
                Approval Center — {currentStageInfo?.label || 'Review'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: '#64748b', marginTop: 2 }}>
                {selectedTask?.projectName}
                {selectedTask?.projectCode && ` | ${selectedTask.projectCode}`}
                {selectedTask?.isClosure && (
                  <span> • Penutupan Siklus #{selectedTask?.cycleNumber || 1}</span>
                )}
                {selectedTask?.contractNumber &&
                  selectedTask.contractNumber !== selectedTask.projectCode && (
                    <span> • Kontrak: {selectedTask.contractNumber}</span>
                  )}
              </div>
            </div>
          </div>
        }
        open={isReviewModalOpen}
        onCancel={handleCloseReview}
        footer={
          canUserDecideTask
            ? [
                <Button key="cancel" onClick={handleCloseReview}>
                  Tutup
                </Button>,
                <Button
                  key="return"
                  danger
                  icon={<EditOutlined />}
                  onClick={handleOpenReturnModal}
                  style={{ fontWeight: 600 }}
                >
                  {selectedTask?.isClosure ? 'Kembalikan' : 'Minta Perbaikan'}
                </Button>,
                <Button
                  key="approve"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleOpenApproveConfirm}
                  style={{
                    backgroundColor: '#059669',
                    borderColor: '#059669',
                    fontWeight: 600,
                  }}
                >
                  {selectedTask?.isClosure &&
                  selectedTask.nodeId === 'node_director_approval'
                    ? 'Setujui Final'
                    : 'Setujui & Lanjutkan'}
                </Button>,
              ]
            : [
                <div
                  key="monitoring-indicator"
                  style={{
                    float: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Tag
                    color="default"
                    icon={<EyeOutlined />}
                    style={{
                      padding: '3px 8px',
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    Mode Pemantauan (Hanya Peran{' '}
                    <strong>{currentStageInfo?.requiredRoleLabel}</strong> yang
                    Berwenang Memutuskan)
                  </Tag>
                </div>,
                <Button key="cancel" type="primary" onClick={handleCloseReview}>
                  Tutup
                </Button>,
              ]
        }
        width={1220}
        centered
        style={{ maxWidth: '92vw' }}
        className={styles.managementReviewModal}
        destroyOnClose
        styles={{
          body: {
            maxHeight: 'calc(88vh - 120px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '14px 24px 16px 24px',
          },
          header: {
            padding: '14px 24px 10px 24px',
            margin: 0,
            borderBottom: '1px solid #f1f5f9',
          },
          footer: {
            padding: '12px 24px',
            margin: 0,
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
          },
        }}
      >
        {modalLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Memuat rincian paket data rencana operasional..." />
          </div>
        ) : !selectedTask ? null : selectedTask.isClosure ? (
          <ProjectClosureReviewModalContent
            task={selectedTask}
            closureData={closureData}
            closureReadiness={closureReadinessData}
            stageInfo={currentStageInfo as ClosureStageInfo}
            canUserDecideTask={canUserDecideTask}
            userRoles={userRoles}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginTop: 0,
            }}
          >
            {/* Read-Only Notice for Monitoring Roles */}
            {!canUserDecideTask && (
              <Alert
                type="warning"
                showIcon
                message="Akses Pemantauan (Read-Only)"
                description={`Anda login dengan peran [${userRoles.join(', ')}]. Tugas ini berada pada tahap ${currentStageInfo?.label} yang memerlukan wewenang peran ${currentStageInfo?.requiredRoleLabel || currentStageInfo?.requiredRole}. Anda dapat meninjau seluruh data rencana operasional, namun keputusan persetujuan/perbaikan hanya dapat dilakukan oleh peran yang berwenang.`}
                style={{ borderRadius: 6 }}
              />
            )}

            {/* ── TOP SECTION: Management Summary (Workflow History + Financial Summary) ── */}
            <div className={styles.executiveSummaryGrid}>
              {/* LEFT: Riwayat Workflow (~42%) */}
              <div className={styles.workflowSummaryCol}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    background: '#ffffff',
                    width: '100%',
                  }}
                  bodyStyle={{
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: '#0f172a',
                      }}
                    >
                      Riwayat Workflow
                    </span>
                    {shouldShowWorkflowExpandButton(
                      workflowTransitions.length,
                      Boolean(selectedTask && !selectedTask.isClosure && selectedTask.status !== 'COMPLETED'),
                    ) && (
                      <button
                        type="button"
                        onClick={() => setWorkflowHistoryExpanded(!workflowHistoryExpanded)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: 12,
                          color: '#0284c7',
                          fontWeight: 600,
                          cursor: 'pointer',
                          outline: 'none',
                          textDecoration: 'none',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#0369a1')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#0284c7')}
                        onFocus={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onBlur={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        aria-label={workflowHistoryExpanded ? 'Ringkas riwayat alur kerja' : 'Lihat semua riwayat alur kerja'}
                      >
                        {workflowHistoryExpanded ? 'Ringkas' : 'Lihat Semua'}
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      overflowY: workflowHistoryExpanded ? 'auto' : 'visible',
                      maxHeight: workflowHistoryExpanded ? 360 : undefined,
                    }}
                  >
                    {(() => {
                      const isPendingStage = Boolean(
                        selectedTask &&
                        !selectedTask.isClosure &&
                        selectedTask.status !== 'COMPLETED'
                      );

                      const displayedTransitions = getDisplayedWorkflowTransitions(
                        workflowTransitions,
                        workflowHistoryExpanded,
                        isPendingStage,
                      );

                      const historyItems = displayedTransitions.map((t) => {
                        const isApprove = t.action === 'APPROVE';
                        const isReturn = t.action === 'RETURN';
                        const isStart =
                          t.action === 'START' ||
                          (!isApprove && !isReturn && (t.fromNodeId === 'node_start' || t.fromNodeId === 'INIT'));

                        const dotColor = isReturn
                          ? '#dc2626'
                          : isApprove
                            ? '#16a34a'
                            : '#0284c7';
                        const actionLabel =
                          isStart && t.action !== 'APPROVE' && t.action !== 'RETURN'
                            ? 'START'
                            : t.action;

                        const transitionTitle =
                          isStart && t.action !== 'APPROVE' && t.action !== 'RETURN'
                            ? 'Workflow dimulai'
                            : `${formatWorkflowNodeLabel(t.fromNodeId)} → ${formatWorkflowNodeLabel(t.toNodeId)}`;

                        return {
                          color: dotColor,
                          dot: isApprove ? (
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: 8.5,
                                marginTop: 2,
                              }}
                            >
                              <CheckOutlined style={{ fontSize: 8.5 }} />
                            </div>
                          ) : isReturn ? (
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: 8,
                                marginTop: 2,
                                fontWeight: 700,
                              }}
                            >
                              ✕
                            </div>
                          ) : isStart ? (
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                border: '2px solid #94a3b8',
                                background: '#ffffff',
                                marginTop: 3,
                                marginLeft: 1,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                border: `2px solid ${dotColor}`,
                                background: '#ffffff',
                                marginTop: 2,
                              }}
                            />
                          ),
                          children: (
                            <div style={{ fontSize: 11, paddingBottom: 2 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      fontSize: 12,
                                      lineHeight: '18px',
                                    }}
                                  >
                                    {transitionTitle}
                                  </span>
                                  {!isStart && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        fontSize: 9.5,
                                        fontWeight: 600,
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        background: isReturn ? '#fef2f2' : isApprove ? '#f0fdf4' : '#f0f9ff',
                                        color: isReturn ? '#b91c1c' : isApprove ? '#15803d' : '#0369a1',
                                        border: `1px solid ${isReturn ? '#fecaca' : isApprove ? '#bbf7d0' : '#bae6fd'}`,
                                        lineHeight: '14px',
                                        letterSpacing: '0.02em',
                                      }}
                                    >
                                      {actionLabel}
                                    </span>
                                  )}
                                </div>
                                <span
                                  style={{
                                    color: '#64748b',
                                    fontSize: 10.5,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    marginTop: 1,
                                  }}
                                >
                                  {t.createdAt
                                    ? dayjs(t.createdAt).locale('id').format('D MMM · HH:mm')
                                    : '—'}
                                </span>
                              </div>
                              <div
                                style={{
                                  color: '#475569',
                                  fontSize: 10.5,
                                  marginTop: 2,
                                  lineHeight: '16px',
                                }}
                              >
                                {t.actor?.fullName ||
                                  (t.actorId ? `User #${t.actorId}` : (t.actor as any)?.username || t.actor?.email || 'Sistem')}
                              </div>
                              {t.reason && t.reason !== 'Workflow instance initialized' && (
                                <div
                                  style={{
                                    marginTop: 2,
                                    color: '#64748b',
                                    fontStyle: 'italic',
                                    fontSize: 10.5,
                                    lineHeight: '15px',
                                  }}
                                >
                                  &ldquo;{t.reason}&rdquo;
                                </div>
                              )}
                            </div>
                          ),
                        };
                      });

                      const pendingItem = isPendingStage
                        ? [
                            {
                              color: '#0284c7',
                              dot: (
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: '2px solid #0284c7',
                                    background: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 2,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: '#0284c7',
                                    }}
                                  />
                                </div>
                              ),
                              children: (
                                <div
                                  style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 6,
                                    padding: '6px 8px',
                                    fontSize: 11,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: '#0f172a',
                                          fontSize: 12,
                                          lineHeight: '18px',
                                        }}
                                      >
                                        {currentStageInfo?.label || selectedTask?.nodeId} →{' '}
                                        {currentStageInfo?.nextNodeLabel || 'Tahap Berikutnya'}
                                      </span>
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          fontSize: 9.5,
                                          fontWeight: 600,
                                          padding: '1px 5px',
                                          borderRadius: 3,
                                          background: '#eff6ff',
                                          color: '#0284c7',
                                          border: '1px solid #bfdbfe',
                                          lineHeight: '14px',
                                          letterSpacing: '0.02em',
                                        }}
                                      >
                                        MENUNGGU
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      color: '#475569',
                                      fontSize: 10.5,
                                      marginTop: 2,
                                      lineHeight: '16px',
                                    }}
                                  >
                                    {canUserDecideTask
                                      ? 'Menunggu persetujuan Anda'
                                      : `Menunggu persetujuan ${currentStageInfo?.requiredRoleLabel || 'pemeriksa'}`}
                                  </div>
                                </div>
                              ),
                            },
                          ]
                        : [];

                      const timelineItems = [...historyItems, ...pendingItem];

                      if (timelineItems.length === 0) {
                        return (
                          <div
                            style={{
                              textAlign: 'center',
                              color: '#94a3b8',
                              fontSize: 12,
                              padding: '24px 0',
                            }}
                          >
                            Belum ada riwayat transisi alur kerja.
                          </div>
                        );
                      }

                      return (
                        <Timeline
                          style={{ marginTop: 4, paddingLeft: 2, marginBottom: 0 }}
                          items={timelineItems}
                        />
                      );
                    })()}
                  </div>
                </Card>
              </div>

              {/* RIGHT: Ringkasan Finansial Proyek (~58%) */}
              <div className={styles.financialSummaryCol}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    background: '#f0f7ff',
                    border: '1px solid #bae6fd',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  bodyStyle={{
                    flex: 1,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Panel Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AuditOutlined style={{ fontSize: 15, color: '#0284c7' }} />
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        Ringkasan Finansial Proyek
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: '#64748b',
                          lineHeight: 1.1,
                        }}
                      >
                        Status RAB
                      </span>
                      {(() => {
                        const canonicalStatus = costData?.status ?? financialSummary?.rabStatus ?? null;
                        const hasStatus = Boolean(canonicalStatus && String(canonicalStatus).trim());
                        const displayStatus = hasStatus ? String(canonicalStatus).trim() : 'Belum ada data';
                        const isApproved = displayStatus.toUpperCase() === 'APPROVED';

                        return (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: !hasStatus ? '#f1f5f9' : isApproved ? '#dcfce7' : '#fef3c7',
                              border: `1px solid ${!hasStatus ? '#e2e8f0' : isApproved ? '#bbf7d0' : '#fde68a'}`,
                              borderRadius: 4,
                              padding: '0 8px',
                              height: 20,
                              fontSize: 10,
                              fontWeight: hasStatus ? 700 : 500,
                              color: !hasStatus ? '#64748b' : isApproved ? '#15803d' : '#b45309',
                              textTransform: hasStatus ? 'uppercase' : 'none',
                              letterSpacing: hasStatus ? '0.02em' : 'normal',
                            }}
                          >
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 4 Metric Cards in 2x2 Grid */}
                  <Row gutter={[10, 10]}>
                    {/* Card 1: Nilai Kontrak */}
                    <Col xs={24} sm={12}>
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          height: 86,
                          boxSizing: 'border-box',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            background: '#e0f2fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          <FileTextOutlined
                            style={{ fontSize: 16, color: '#0284c7' }}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              fontWeight: 500,
                              lineHeight: '14px',
                            }}
                          >
                            Nilai Kontrak
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#0f172a',
                              lineHeight: '22px',
                              marginTop: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {financialSummary?.formattedContractValue ||
                              'Belum ada data'}
                          </div>
                        </div>
                      </div>
                    </Col>

                    {/* Card 2: Modal Project */}
                    <Col xs={24} sm={12}>
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          height: 86,
                          boxSizing: 'border-box',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            background: '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          <WalletOutlined
                            style={{ fontSize: 16, color: '#d97706' }}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              fontWeight: 500,
                              lineHeight: '14px',
                            }}
                          >
                            Modal Project
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#0f172a',
                              lineHeight: '22px',
                              marginTop: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {financialSummary?.formattedModalProject ||
                              'Belum ada data'}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#64748b',
                              lineHeight: '14px',
                              marginTop: 3,
                            }}
                          >
                            RAB Saat Ini
                          </div>
                        </div>
                      </div>
                    </Col>

                    {/* Card 3: Keuntungan Project */}
                    <Col xs={24} sm={12}>
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          height: 86,
                          boxSizing: 'border-box',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            background: financialSummary?.isProfitNegative
                              ? '#fee2e2'
                              : '#dcfce7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {financialSummary?.isProfitNegative ? (
                            <FallOutlined
                              style={{ fontSize: 16, color: '#dc2626' }}
                            />
                          ) : (
                            <RiseOutlined
                              style={{ fontSize: 16, color: '#16a34a' }}
                            />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              fontWeight: 500,
                              lineHeight: '14px',
                            }}
                          >
                            Keuntungan Project
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: financialSummary?.isProfitNegative
                                ? '#dc2626'
                                : (financialSummary && financialSummary.keuntungan !== null && financialSummary.keuntungan > 0 ? '#16a34a' : '#0f172a'),
                              lineHeight: '22px',
                              marginTop: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {financialSummary?.formattedKeuntungan || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </Col>

                    {/* Card 4: Margin Project */}
                    <Col xs={24} sm={12}>
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          height: 86,
                          boxSizing: 'border-box',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            background: financialSummary?.isMarginNegative
                              ? '#fee2e2'
                              : '#ccfbf1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          <PercentageOutlined
                            style={{
                              fontSize: 16,
                              color: financialSummary?.isMarginNegative
                                ? '#dc2626'
                                : '#0d9488',
                            }}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              fontWeight: 500,
                              lineHeight: '14px',
                            }}
                          >
                            Margin Project
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: financialSummary?.isMarginNegative
                                ? '#dc2626'
                                : (financialSummary && financialSummary.marginPercentage !== null && financialSummary.marginPercentage > 0 ? '#16a34a' : '#0f172a'),
                              lineHeight: '22px',
                              marginTop: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {financialSummary?.formattedMargin || 'N/A'}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: '#64748b',
                              lineHeight: '14px',
                              marginTop: 3,
                            }}
                          >
                            Keuntungan / Nilai Kontrak × 100%
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* Bottom Row: Unified ROI Metric + Formula Explanations Strip */}
                  <div
                    style={{
                      marginTop: 10,
                      background: '#ffffff',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Left ~38%: ROI */}
                    <div
                      style={{
                        flex: '0 0 38%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: financialSummary?.isRoiNegative
                            ? '#fee2e2'
                            : '#f0f9ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ClockCircleOutlined
                          style={{
                            fontSize: 15,
                            color: financialSummary?.isRoiNegative
                              ? '#dc2626'
                              : '#0284c7',
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 10.5,
                            color: '#64748b',
                            fontWeight: 500,
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Return terhadap Modal (ROI)
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: financialSummary?.isRoiNegative
                              ? '#dc2626'
                              : '#0f172a',
                            lineHeight: 1.2,
                            marginTop: 2,
                          }}
                        >
                          {financialSummary?.formattedRoi || 'N/A'}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            color: '#64748b',
                            lineHeight: 1.2,
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Keuntungan / Modal Project × 100%
                        </div>
                      </div>
                    </div>

                    {/* Subtle Divider */}
                    <div
                      style={{
                        width: 1,
                        height: 48,
                        background: '#e2e8f0',
                        margin: '0 14px',
                        flexShrink: 0,
                      }}
                    />

                    {/* Right ~62%: Formula Block */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 10,
                        color: '#64748b',
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: '#475569',
                          marginBottom: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10.5,
                        }}
                      >
                        <span>Rumus Perhitungan</span>
                        <InfoCircleOutlined
                          style={{ fontSize: 10, color: '#94a3b8' }}
                        />
                      </div>
                      <div
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Keuntungan = Nilai Kontrak − Modal Project
                      </div>
                      <div
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Margin = Keuntungan / Nilai Kontrak × 100%
                      </div>
                      <div
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        ROI = Keuntungan / Modal Project × 100%
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* ── SECTION 4: 4-Pillar Readiness Summary Strip ── */}
            <div className={styles.readinessStrip}>
              {/* Segment 1: Total RAB (Pilar 1) */}
              <div className={styles.readinessSegment}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DollarOutlined style={{ fontSize: 16, color: '#0284c7' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                    Total RAB (Pilar 1)
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>
                    {formatRupiahDisplay(costData?.totalPmEstimate ?? null, 'Belum ada data')}
                  </div>
                </div>
              </div>

              <div className={styles.readinessDivider} />

              {/* Segment 2: WBS Nodes (Pilar 2) */}
              <div className={styles.readinessSegment}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: '#f0f9ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ApartmentOutlined style={{ fontSize: 16, color: '#0284c7' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                    WBS Nodes (Pilar 2)
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>
                    {wbsData.length || selectedTask?.readiness?.wbsPillar?.leafDeliverablesCount || 0} Nodes
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: Math.abs(wbsTreeData.totalWeight - 100) <= 0.01 ? '#16a34a' : '#dc2626',
                      fontWeight: 600,
                    }}
                  >
                    Bobot: {wbsTreeData.totalWeight.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className={styles.readinessDivider} />

              {/* Segment 3: Jadwal (Pilar 3) */}
              <div className={styles.readinessSegment}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: '#f0f9ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ScheduleOutlined style={{ fontSize: 16, color: '#0284c7' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                    Jadwal (Pilar 3)
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>
                    {scheduleData?.tasks?.length || scheduleData?.totalTasks || selectedTask?.readiness?.schedulePillar?.scheduledLeafCount || 0} Item
                  </div>
                </div>
              </div>

              <div className={styles.readinessDivider} />

              {/* Segment 4: Kondisi Awal (Pilar 4) */}
              <div className={styles.readinessSegment}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircleOutlined style={{ fontSize: 16, color: '#16a34a' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                    Kondisi Awal (Pilar 4)
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#16a34a' }}>
                    {initialConditionData?.conditionStatus || selectedTask?.readiness?.initialConditionPillar?.conditionStatus || 'NORMAL'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SECTION 5: 4-Pillar Detailed Tabs ── */}
            <Tabs
              defaultActiveKey="cost"
              size="middle"
              items={[
                {
                  key: 'cost',
                  label: (
                    <span>
                      <DollarCircleOutlined /> Estimasi Biaya (RAB)
                    </span>
                  ),
                  children: (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {costData?.categories?.some(
                        (c: any) => c.categoryKey === 'MATERIAL' && c.mode === 'DIRECT',
                      ) && (
                        <Alert
                          type="warning"
                          showIcon
                          message="Kategori Material & Consumables belum dirinci (Lump Sum / Direct). Rincian item per baris diperlukan untuk kesiapan paket pengadaan."
                          style={{
                            borderRadius: 6,
                            fontSize: 11.5,
                            background: '#fffbeb',
                            border: '1px solid #fef3c7',
                            color: '#92400e',
                            padding: '6px 12px',
                          }}
                        />
                      )}
                      <Table
                        className={styles.rabDetailTable}
                        dataSource={costData?.categories || []}
                        rowKey="categoryKey"
                        pagination={false}
                        expandable={{
                          rowExpandable: (r: any) =>
                            r.mode === 'ITEMIZED' &&
                            Array.isArray(r.items) &&
                            r.items.length > 0,
                          expandedRowRender: (r: any) => (
                            <div
                              style={{
                                margin: '4px 0 12px 16px',
                                background: '#f8fafc',
                                padding: 12,
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <div
                                style={{
                                  marginBottom: 8,
                                  fontWeight: 600,
                                  fontSize: 12,
                                  color: '#334155',
                                }}
                              >
                                Rincian Item: {r.categoryLabel} ({r.items.length} item)
                              </div>
                              <Table
                                size="small"
                                dataSource={r.items}
                                rowKey="id"
                                pagination={false}
                                columns={[
                                  {
                                    title: 'Nama Item',
                                    dataIndex: 'itemName',
                                    key: 'itemName',
                                    render: (name: string) => (
                                      <strong style={{ color: '#0f172a' }}>{name}</strong>
                                    ),
                                  },
                                  {
                                    title: 'Deskripsi / Spesifikasi',
                                    dataIndex: 'description',
                                    key: 'description',
                                    render: (desc: string) =>
                                      desc || <Text type="secondary">—</Text>,
                                  },
                                  {
                                    title: 'Qty',
                                    dataIndex: 'quantity',
                                    key: 'quantity',
                                    width: 70,
                                    align: 'right',
                                    render: (qty: number) =>
                                      Number(qty || 0).toLocaleString('id-ID'),
                                  },
                                  {
                                    title: 'UOM',
                                    dataIndex: 'uom',
                                    key: 'uom',
                                    width: 70,
                                  },
                                  {
                                    title: 'Harga Satuan',
                                    dataIndex: 'unitPrice',
                                    key: 'unitPrice',
                                    width: 140,
                                    align: 'right',
                                    render: (p: number) =>
                                      `Rp ${Number(p || 0).toLocaleString('id-ID')}`,
                                  },
                                  {
                                    title: 'Subtotal',
                                    dataIndex: 'subtotal',
                                    key: 'subtotal',
                                    width: 150,
                                    align: 'right',
                                    render: (sub: number) => (
                                      <strong style={{ color: '#0f172a' }}>
                                        Rp {Number(sub || 0).toLocaleString('id-ID')}
                                      </strong>
                                    ),
                                  },
                                  {
                                    title: 'WBS / Scope',
                                    key: 'scope',
                                    width: 140,
                                    render: (_: any, it: any) => {
                                      if (it.assignmentScope === 'WBS' && it.wbsId) {
                                        const matchedWbs = wbsData?.find(
                                          (w: any) => Number(w.id) === Number(it.wbsId),
                                        );
                                        return (
                                          <Tag
                                            color="geekblue"
                                            style={{ fontSize: 10.5, margin: 0 }}
                                          >
                                            {matchedWbs?.code || `WBS #${it.wbsId}`}
                                          </Tag>
                                        );
                                      }
                                      return (
                                        <Tag style={{ fontSize: 10.5, margin: 0 }}>
                                          {it.assignmentScope || 'PROJECT'}
                                        </Tag>
                                      );
                                    },
                                  },
                                ]}
                              />
                            </div>
                          ),
                        }}
                        columns={[
                          {
                            title: 'Kategori Biaya',
                            dataIndex: 'categoryLabel',
                            key: 'categoryLabel',
                            render: (text: string, record: any) => (
                              <strong>
                                {text || record.categoryKey || '—'}
                              </strong>
                            ),
                          },
                          {
                            title: 'Mode / Rincian Item',
                            key: 'itemsCount',
                            width: 220,
                            render: (_: any, r: any) => {
                              if (r.mode === 'DIRECT') {
                                return (
                                  <Tag color="default" style={{ margin: 0 }}>
                                    Lump Sum / Direct
                                  </Tag>
                                );
                              }
                              return (
                                <Space size={6}>
                                  <Tag color="blue" style={{ margin: 0 }}>
                                    Itemized
                                  </Tag>
                                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                                    {r.items?.length || 0} item
                                  </span>
                                </Space>
                              );
                            },
                          },
                          {
                            title: 'Subtotal Kategori',
                            dataIndex: 'categoryTotal',
                            key: 'categoryTotal',
                            width: 180,
                            align: 'right',
                            render: (val: number) => (
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: '#0f172a',
                                }}
                              >
                                Rp {Number(val || 0).toLocaleString('id-ID')}
                              </span>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: 'wbs',
                  label: (
                    <span>
                      <ApartmentOutlined /> Struktur WBS (Bobot 100%)
                    </span>
                  ),
                  children: (
                    <Table
                      className={styles.rabDetailTable}
                      dataSource={wbsTreeData.tree}
                      pagination={false}
                      columns={[
                        {
                          title: 'Kode WBS',
                          dataIndex: 'code',
                          key: 'code',
                          width: 140,
                          render: (code: string) => (
                            <Tag
                              color="geekblue"
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                              }}
                            >
                              {code}
                            </Tag>
                          ),
                        },
                        {
                          title: 'Nama Deliverable / Task',
                          dataIndex: 'name',
                          key: 'name',
                          render: (name: string, record: WbsTreeNode) => (
                            <span
                              style={{
                                fontWeight: record.isLeaf ? 400 : 700,
                              }}
                            >
                              {name}
                            </span>
                          ),
                        },
                        {
                          title: 'Level',
                          dataIndex: 'level',
                          key: 'level',
                          width: 80,
                          align: 'center',
                          render: (lvl: number) => (
                            <Tag style={{ fontSize: 10 }}>L{lvl}</Tag>
                          ),
                        },
                        {
                          title: 'Bobot',
                          dataIndex: 'weightPercentage',
                          key: 'weightPercentage',
                          width: 100,
                          align: 'right',
                          render: (w: number) => (
                            <span
                              style={{
                                fontWeight: 600,
                                color: '#0f172a',
                              }}
                            >
                              {Number(w || 0).toFixed(1)}%
                            </span>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'schedule',
                  label: (
                    <span>
                      <ScheduleOutlined /> Jadwal & Milestones
                    </span>
                  ),
                  children: (
                    <Table
                      className={styles.rabDetailTable}
                      dataSource={scheduleData?.tasks || []}
                      rowKey="id"
                      pagination={false}
                      columns={[
                        {
                          title: 'Tugas / Milestone',
                          dataIndex: 'name',
                          key: 'name',
                          render: (text: string, record: any) => (
                            <Space>
                              {record.isMilestone && (
                                <Tag color="purple">Milestone</Tag>
                              )}
                              <span>{text}</span>
                            </Space>
                          ),
                        },
                        {
                          title: 'Mulai',
                          dataIndex: 'startDate',
                          key: 'startDate',
                          width: 130,
                          render: (d: string) =>
                            d ? dayjs(d).format('DD/MM/YYYY') : '—',
                        },
                        {
                          title: 'Selesai',
                          dataIndex: 'endDate',
                          key: 'endDate',
                          width: 130,
                          render: (d: string) =>
                            d ? dayjs(d).format('DD/MM/YYYY') : '—',
                        },
                        {
                          title: 'Durasi',
                          key: 'duration',
                          width: 100,
                          render: (_: any, record: any) =>
                            calculateScheduleDuration(record),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'initialCondition',
                  label: (
                    <span>
                      <SafetyCertificateOutlined /> Kondisi Awal Lapangan
                    </span>
                  ),
                  children: (
                    <Descriptions
                      bordered
                      size="small"
                      column={{ xs: 1, sm: 2, md: 2 }}
                    >
                      <Descriptions.Item label="Status Kondisi">
                        <Tag
                          color={
                            initialConditionData?.conditionStatus === 'NORMAL'
                              ? 'success'
                              : initialConditionData?.conditionStatus ===
                                'CHALLENGING'
                                ? 'warning'
                                : 'error'
                          }
                          style={{ fontWeight: 700 }}
                        >
                          {initialConditionData?.conditionStatus || 'NORMAL'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Status Kesiapan">
                        <Tag
                          color={
                            initialConditionData?.status === 'READY'
                              ? 'success'
                              : 'warning'
                          }
                        >
                          {initialConditionData?.status || 'NOT_STARTED'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item
                        label="Kondisi Lokasi / Site"
                        span={2}
                      >
                        {initialConditionData?.locationCondition ||
                          'Belum diisi oleh PM.'}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label="Infrastruktur Existing"
                        span={2}
                      >
                        {initialConditionData?.existingInfrastructure || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label="Akses & Logistik Lapangan"
                        span={2}
                      >
                        {initialConditionData?.accessLogistics || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Rekomendasi PM" span={2}>
                        {initialConditionData?.pmRecommendation || '—'}
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ── APPROVE CONFIRMATION MODAL ─────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#059669', fontSize: 18 }} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: '#0f172a',
              }}
            >
              {approvalActionContext?.isClosure
                ? approvalActionContext.nodeId === 'node_director_approval'
                  ? 'Konfirmasi Persetujuan Final Penutupan Proyek'
                  : 'Konfirmasi Persetujuan Penutupan Proyek (HOO)'
                : 'Konfirmasi Persetujuan'}
            </span>
          </Space>
        }
        open={isApproveConfirmOpen}
        onCancel={handleCloseApproveConfirm}
        onOk={handleApprove}
        confirmLoading={submittingAction}
        okText={
          approvalActionContext?.isClosure
            ? approvalActionContext.nodeId === 'node_director_approval'
              ? 'Ya, Setujui Final'
              : 'Ya, Setujui'
            : 'Setujui & Lanjutkan'
        }
        cancelText="Batal"
        okButtonProps={{
          disabled: !approvalActionContext || !approvalActionContext.projectId || !approvalActionContext.taskId,
          style: {
            backgroundColor: '#059669',
            borderColor: '#059669',
            fontWeight: 600,
          },
        }}
        width={520}
      >
        {!approvalActionContext || !approvalActionContext.projectId || !approvalActionContext.taskId ? (
          <Alert
            type="error"
            showIcon
            message="Konteks Tindakan Hilang"
            description="Informasi tugas persetujuan tidak lengkap atau tidak valid. Konfirmasi diblokir demi keamanan."
            style={{ margin: '16px 0', borderRadius: 6 }}
          />
        ) : (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 10 }}>
              Anda akan menyetujui {approvalActionContext.isClosure ? 'penutupan' : 'rencana operasional'} untuk:
              <br />
              <strong style={{ fontSize: 14, color: '#0f172a' }}>{approvalActionContext.projectName}</strong>
              <br />
              <span style={{ color: '#64748b', fontSize: 12 }}>{approvalActionContext.projectCode}</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#334155', marginTop: 10 }}>
              <div>
                <span>Tahap saat ini:</span>{' '}
                <Tag color={approvalActionContext.tagColor} style={{ marginLeft: 4, fontWeight: 600 }}>
                  {approvalActionContext.currentStageLabel}
                </Tag>
              </div>
              <div>
                <span>Tahap berikutnya:</span>{' '}
                <span style={{ fontWeight: 600, color: '#0f172a', marginLeft: 4 }}>
                  {approvalActionContext.nextNodeLabel}
                </span>
              </div>
            </div>
            {approvalActionContext.isClosure && (
              <div style={{ marginTop: 14 }}>
                <Text strong style={{ fontSize: 12 }}>
                  Catatan Persetujuan (Opsional):
                </Text>
                <TextArea
                  rows={3}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Masukkan catatan persetujuan jika diperlukan..."
                  maxLength={500}
                  showCount
                  style={{ marginTop: 6 }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── RETURN CONFIRMATION MODAL ──────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined
              style={{ color: '#d97706', fontSize: 18 }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: '#0f172a',
              }}
            >
              {returnActionContext?.isClosure
                ? 'Kembalikan Pengajuan Penutupan Proyek ke PM?'
                : 'Minta Perbaikan Rencana Operasional?'}
            </span>
          </Space>
        }
        open={isReturnModalOpen}
        onCancel={handleCloseReturnModal}
        onOk={handleReturn}
        confirmLoading={submittingAction}
        okText={returnActionContext?.isClosure ? 'Kembalikan ke PM' : 'Kirim Catatan Perbaikan'}
        cancelText="Batal"
        okButtonProps={{
          danger: true,
          disabled: !returnActionContext || !returnActionContext.projectId || !returnActionContext.taskId,
          style: { fontWeight: 600 },
        }}
        width={520}
      >
        {!returnActionContext || !returnActionContext.projectId || !returnActionContext.taskId ? (
          <Alert
            type="error"
            showIcon
            message="Konteks Tindakan Hilang"
            description="Informasi tugas tidak lengkap atau tidak valid. Pengembalian tugas diblokir demi keamanan."
            style={{ margin: '16px 0', borderRadius: 6 }}
          />
        ) : (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#334155' }}>
              Tuliskan catatan perbaikan yang jelas untuk Project Manager (PM):
            </p>
            <TextArea
              rows={4}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder={
                returnActionContext.isClosure
                  ? 'Contoh: Laporan penutupan belum menyertakan lampiran pengujian performa sistem...'
                  : 'Contoh: Estimasi anggaran pada kategori X melebihi acuan pasar, mohon periksa kembali kesesuaian spesifikasi item...'
              }
              maxLength={1000}
              showCount
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
              Alur kerja akan kembali ke Project Manager (
              {returnActionContext.returnNodeLabel || 'Dikembalikan ke PM'}) untuk direvisi dan diajukan
              ulang.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectGovernanceTaskCenter;
