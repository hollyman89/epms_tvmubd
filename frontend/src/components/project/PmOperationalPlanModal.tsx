'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Typography,
  Tag,
  Button,
  Space,
  Card,
  Row,
  Col,
  Input,
  InputNumber,
  Table,
  Divider,
  Alert,
  Popconfirm,
  Tooltip,
  message,
  Tabs,
  Progress,
  Badge,
  Radio,
  Select,
  Form,
  Empty,
  Spin,
} from 'antd';
import {
  CalculatorOutlined,
  DollarOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  ApartmentOutlined,
  ScheduleOutlined,
  FolderOpenOutlined,
  NodeExpandOutlined,
  NodeCollapseOutlined,
  FileTextOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  AuditOutlined,
  DownOutlined,
  UpOutlined,
  MinusOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ExclamationCircleOutlined,
  RocketOutlined,
  WarningOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { ProjectCharter } from '../ProjectOperationTab';
import {
  WbsNodeItem,
  convertFlatWbsToTree,
  convertBackendTreeToUiNodes,
  convertUiNodesToSavePayload,
  recomputeWbsHierarchy,
  calculateRootWeightSum,
  calculateLeafWeightSum,
  checkWbsHierarchyIntegrity,
  countLeafNodes,
  countTotalNodes,
  countDescendants,
  getAllNodeIds,
  getWbsStructureMetrics,
} from './WbsTreeTableModal';
import { PmOperationalPlanReviewModal } from './PmOperationalPlanReviewModal';
import {
  ScheduleGanttTab,
  ScheduleTaskItem,
  extractLeafWbsNodes,
  buildSaveProjectSchedulePayload,
  extractPersistedWbsArray,
  assertPersistedWbsNodesHaveDbIds,
} from './ScheduleGanttTab';
import { ReviewTrackingTimeline, PrApprovalStateLike } from './ReviewTrackingTimeline';
import {
  ProjectInitialConditionModal,
  ProjectInitialConditionRecord,
  getInitialCondition,
  isInitialConditionComplete,
} from './ProjectInitialConditionModal';
import { isPmEditableWorkflowState, getCanonicalStatusColor } from './workflowUiHelpers';
import { evaluateOperationalPlanReadiness } from './operational-plan-readiness.utils';
import { ProjectService, ProcurementService } from '@/services';
import WorkflowEngineService from '@/services/workflowEngine.service';
import { useAuth } from '@/context/AuthContext';
import { setupOperationalPlanSync } from '@/lib/workflowSync';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrAfter);

const { Title, Text } = Typography;
const { TextArea } = Input;

export interface PmOperationalPlanModalProps {
  open: boolean;
  onClose: () => void;
  charter: ProjectCharter | null;
  onRefreshParent?: () => void;
}

import {
  CostItemDetail,
  CostCategoryEstimation,
  CostGroupKey,
  CostAssignmentScope,
  COST_GROUP_CONFIGS,
  DEFAULT_CATEGORIES as DEFAULT_COST_CATEGORIES,
  COMMON_UOMS,
  RESOURCE_TYPE_OPTIONS,
  COST_SOURCE_OPTIONS,
  RATE_TYPE_OPTIONS,
  normalizeCostCategories,
  getWbsLeafNodes,
  buildWbsHierarchyOptions,
  computeCostWbsReconciliation,
  CostWbsAllocationSummary,
  mapBackendEstimateToCategories,
  buildSaveCostEstimatePayload,
  validateCostEstimateItems,
} from './PmCostEstimationModal';

export type { CostItemDetail, CostCategoryEstimation, CostGroupKey, CostWbsAllocationSummary, CostAssignmentScope };

export const PmOperationalPlanModal: React.FC<PmOperationalPlanModalProps> = ({
  open,
  onClose,
  charter,
  onRefreshParent,
}) => {
  const { user, isProjectManager, isGeneralManager, isDirector, isSuperAdmin, isPmOnly } = useAuth();
  const showPmSubmitActions = isSuperAdmin || isPmOnly || (isProjectManager && !isGeneralManager);

  // --- SECTION MINIMIZE / MAXIMIZE PRESENTATION STATE ---
  type SectionId = 'cost' | 'wbs' | 'schedule' | 'initialCondition';
  const [maximizedSection, setMaximizedSection] = useState<SectionId | null>(null);
  const [minimizedSections, setMinimizedSections] = useState<Record<SectionId, boolean>>({
    cost: false,
    wbs: false,
    schedule: true, // Start minimized for instant modal opening
    initialCondition: false,
  });

  // Reset presentation state on modal open (presentation-only, not persisted)
  // Section 1 (Cost), Section 2 (WBS) & Section 4 (Initial Condition) are expanded, Section 3 (Schedule) starts minimized for instant shell render
  useEffect(() => {
    if (open) {
      setMaximizedSection(null);
      setMinimizedSections({
        cost: false,
        wbs: false,
        schedule: true,
        initialCondition: false,
      });
    }
  }, [open]);

  // --- 1. COST ESTIMATE STATE ---
  const [costCategories, setCostCategories] = useState<CostCategoryEstimation[]>([]);
  const [pmNotes, setPmNotes] = useState<string>('');
  const [expandedCostItemIds, setExpandedCostItemIds] = useState<Record<string, boolean>>({});
  const [isCostLoading, setIsCostLoading] = useState<boolean>(false);
  const [isCostSaving, setIsCostSaving] = useState<boolean>(false);
  const [isCostServerSynced, setIsCostServerSynced] = useState<boolean>(false);
  const [isLegacyCostDraftDetected, setIsLegacyCostDraftDetected] = useState<boolean>(false);

  const toggleCostItemExpansion = (itemId: string) => {
    setExpandedCostItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // --- 4. INITIAL CONDITION STATE ---
  const [initialCondition, setInitialCondition] = useState<ProjectInitialConditionRecord | null>(null);
  const [isInitialConditionModalOpen, setIsInitialConditionModalOpen] = useState<boolean>(false);

  // --- 2. WBS STATE ---
  const [wbsData, setWbsData] = useState<WbsNodeItem[]>([]);
  const [isWbsLoading, setIsWbsLoading] = useState<boolean>(false);
  const [isWbsSaving, setIsWbsSaving] = useState<boolean>(false);
  const [isWbsServerSynced, setIsWbsServerSynced] = useState<boolean>(false);
  const [isLegacyWbsDraftDetected, setIsLegacyWbsDraftDetected] = useState<boolean>(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [wbsSearchText, setWbsSearchText] = useState<string>('');

  // Derived WBS Leaf Map & Options for Cost Allocation
  const wbsLeaves = useMemo(() => getWbsLeafNodes(wbsData), [wbsData]);
  const wbsLeafMap = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const leaf of wbsLeaves) {
      map.set(String(leaf.id), leaf);
      if ((leaf as any).dbId) {
        map.set(String((leaf as any).dbId), leaf);
      }
    }
    return map;
  }, [wbsLeaves]);

  const activeLeafWbsIds = useMemo(() => {
    const set = new Set<string | number>();
    for (const leaf of wbsLeaves) {
      set.add(String(leaf.id));
      set.add(Number(leaf.id));
      if ((leaf as any).dbId) {
        set.add(Number((leaf as any).dbId));
        set.add(String((leaf as any).dbId));
      }
    }
    return set;
  }, [wbsLeaves]);

  const costValidationResult = useMemo(() => {
    return validateCostEstimateItems(costCategories, activeLeafWbsIds);
  }, [costCategories, activeLeafWbsIds]);

  const isCostMappingValid = costValidationResult.valid;

  const wbsSelectOptions = useMemo(() => buildWbsHierarchyOptions(wbsData), [wbsData]);

  // Derived Cost <-> WBS Reconciliation
  const costWbsReconciliation = useMemo(() => {
    return computeCostWbsReconciliation(costCategories, wbsData);
  }, [costCategories, wbsData]);

  // WBS Node Modal Form State
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<'ADD_ROOT' | 'ADD_CHILD' | 'EDIT'>('ADD_ROOT');
  const [targetParentNode, setTargetParentNode] = useState<WbsNodeItem | null>(null);
  const [targetEditNode, setTargetEditNode] = useState<WbsNodeItem | null>(null);
  const [nodeForm] = Form.useForm();

  // Last saved timestamps
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Summary preview modal state
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Approval History collapsible presentation state (Default: EXPANDED)
  const [isApprovalHistoryExpanded, setIsApprovalHistoryExpanded] = useState<boolean>(true);

  // PM Submission Confirmation Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);


  // Procurement Gate state (Database SSOT)
  const [gateRecord, setGateRecord] = useState<{
    status?: 'NOT_SUBMITTED' | 'REVIEW_PENDING' | 'READY_FOR_PROCUREMENT' | 'REVIEW_FINANCE' | 'REVIEW_DIRECTOR' | 'READY_FOR_KICKOFF' | 'NEEDS_REVISION' | string;
    decidedAt?: string;
    decidedBy?: string | number;
    decidedByName?: string;
    revisionNotes?: string;
    submittedAt?: string;
    submittedBy?: string | number;
    submittedByName?: string;
    revisionDraftSavedAt?: string;
    resubmittedAt?: string;
    reviewerRole?: string;
    lastApprovedBy?: { id: number; name: string; role: string } | null;
    lastApprovedAt?: string | null;
    approvalHistory?: any[];
    workflow?: any;
  } | null>(null);

  const [operationalReadinessData, setOperationalReadinessData] = useState<any>(null);
  const [isReadinessLoading, setIsReadinessLoading] = useState<boolean>(false);
  const [prApprovalState, setPrApprovalState] = useState<PrApprovalStateLike | null>(null);

  // Fetch authoritative operational readiness SSOT from backend (Phase B / OP-03)
  const fetchOperationalReadiness = useCallback(async (projectId: number) => {
    if (!projectId || projectId <= 0) {
      setOperationalReadinessData(null);
      return null;
    }
    setIsReadinessLoading(true);
    try {
      const readiness = await ProjectService.getOperationalReadiness(projectId);
      setOperationalReadinessData(readiness);
      return readiness;
    } catch (err) {
      console.error('Failed to load operational readiness in PM modal:', err);
      setOperationalReadinessData(null);
      return null;
    } finally {
      setIsReadinessLoading(false);
    }
  }, []);

  // Reset readiness data when modal closes to prevent stale state on reopen
  useEffect(() => {
    if (!open) {
      setOperationalReadinessData(null);
      setIsReadinessLoading(false);
    }
  }, [open]);

  // Canonical Planning Project ID (strictly uses backend projectId, never contract id)
  const canonicalProjectId = useMemo(() => {
    return charter?.projectId ? Number(charter.projectId) : 0;
  }, [charter?.projectId]);

  // Storage Keys
  const costStorageKey = useMemo(() => {
    if (!canonicalProjectId) return '';
    return `epms_cost_estimate_draft_${canonicalProjectId}`;
  }, [canonicalProjectId]);

  const wbsStorageKey = useMemo(() => {
    if (!canonicalProjectId) return '';
    return `epms_wbs_draft_${canonicalProjectId}`;
  }, [canonicalProjectId]);

  const scheduleStorageKey = useMemo(() => {
    if (!canonicalProjectId) return '';
    return `epms_schedule_draft_${canonicalProjectId}`;
  }, [canonicalProjectId]);

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
          console.warn('[PmOperationalPlanModal] Refetch on sync event failed:', err);
        });
    };

    return setupOperationalPlanSync({
      canonicalProjectId,
      onRefresh: refreshManagementReview,
    });
  }, [open, canonicalProjectId]);

  // Load all drafts on open (Single-Pass Hydration)
  useEffect(() => {
    if (open && charter) {
      const loadLocalCostDraft = () => {
        if (costStorageKey && typeof window !== 'undefined') {
          const savedCost = localStorage.getItem(costStorageKey) || localStorage.getItem(`pm_cost_estimate_draft_${canonicalProjectId}`);
          if (savedCost) {
            try {
              const parsed = JSON.parse(savedCost);
              const hasItems = parsed.categories?.some((c: any) => (c.items && c.items.length > 0) || Number(c.directSubtotal) > 0);
              if (hasItems) {
                setCostCategories(normalizeCostCategories(parsed.categories));
                setPmNotes(parsed.pmNotes || '');
                setIsLegacyCostDraftDetected(true);
                setIsCostServerSynced(false);
                return;
              }
            } catch (e) {
              console.error('Error loading cost draft:', e);
            }
          }
        }
        setCostCategories(normalizeCostCategories([]));
        setPmNotes('');
        setIsLegacyCostDraftDetected(false);
        setIsCostServerSynced(false);
      };

      // 1. Load Cost from Server SSOT (with Legacy LocalStorage Recovery fallback)
      if (canonicalProjectId > 0) {
        setIsCostLoading(true);
        ProjectService.getCostEstimate(canonicalProjectId)
          .then((res) => {
            if (res && res.categories && res.categories.length > 0) {
              const mapped = mapBackendEstimateToCategories(res.categories);
              setCostCategories(mapped);
              setPmNotes(res.pmNotes || '');
              setIsCostServerSynced(true);
              setIsLegacyCostDraftDetected(false);
              if (costStorageKey && typeof window !== 'undefined') {
                localStorage.removeItem(costStorageKey);
                localStorage.removeItem(`pm_cost_estimate_draft_${canonicalProjectId}`);
              }
            } else {
              loadLocalCostDraft();
            }
          })
          .catch(() => {
            loadLocalCostDraft();
          })
          .finally(() => {
            setIsCostLoading(false);
          });
      }

      // 2. Load WBS from Server SSOT (with Legacy LocalStorage Recovery fallback)
      if (canonicalProjectId > 0) {
        setIsWbsLoading(true);
        ProjectService.getWbsByProject(canonicalProjectId)
          .then((backendRows) => {
            if (backendRows && Array.isArray(backendRows) && backendRows.length > 0) {
              // Backend Wins: Hydrate directly from server canonical WBS tree
              const serverTree = convertFlatWbsToTree(backendRows);
              setWbsData(serverTree);
              setExpandedRowKeys(getAllNodeIds(serverTree));
              setIsWbsServerSynced(true);
              setIsLegacyWbsDraftDetected(false);
              if (wbsStorageKey && typeof window !== 'undefined') {
                localStorage.removeItem(wbsStorageKey);
              }
            } else {
              // Server has no WBS yet: check if legacy localStorage draft exists
              if (wbsStorageKey && typeof window !== 'undefined') {
                const savedWbs = localStorage.getItem(wbsStorageKey);
                if (savedWbs) {
                  try {
                    const parsed = JSON.parse(savedWbs);
                    if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
                      const normalized = recomputeWbsHierarchy(parsed.nodes);
                      setWbsData(normalized);
                      setExpandedRowKeys(getAllNodeIds(normalized));
                      setIsWbsServerSynced(false);
                      setIsLegacyWbsDraftDetected(true);
                      if (parsed.savedAt) setLastSavedTime(parsed.savedAt);
                    } else {
                      setWbsData([]);
                      setExpandedRowKeys([]);
                      setIsLegacyWbsDraftDetected(false);
                      setIsWbsServerSynced(false);
                    }
                  } catch (e) {
                    setWbsData([]);
                    setExpandedRowKeys([]);
                    setIsLegacyWbsDraftDetected(false);
                    setIsWbsServerSynced(false);
                  }
                } else {
                  setWbsData([]);
                  setExpandedRowKeys([]);
                  setIsLegacyWbsDraftDetected(false);
                  setIsWbsServerSynced(false);
                }
              } else {
                setWbsData([]);
                setExpandedRowKeys([]);
                setIsLegacyWbsDraftDetected(false);
                setIsWbsServerSynced(false);
              }
            }
          })
          .catch((err) => {
            console.error('Failed to load WBS from server in PM modal:', err);
            setWbsData([]);
            setIsLegacyWbsDraftDetected(false);
            setIsWbsServerSynced(false);
          })
          .finally(() => {
            setIsWbsLoading(false);
          });
      }

      // 3. Load Schedule from Server SSOT (with Legacy LocalStorage Recovery fallback)
      if (canonicalProjectId > 0) {
        setIsScheduleLoading(true);
        ProjectService.getProjectSchedule(canonicalProjectId)
          .then((res) => {
            if (res && Array.isArray(res.tasks) && res.tasks.length > 0) {
              // Backend Wins: Hydrate directly from server canonical tasks
              const mapped: ScheduleTaskItem[] = res.tasks.map((t: any) => ({
                id: t.id ? Number(t.id) : undefined,
                wbsNodeId: String(t.wbsId),
                wbsCode: t.wbsCode || '',
                name: t.name,
                type: t.isMilestone ? 'MILESTONE' : 'TASK',
                isMilestone: Boolean(t.isMilestone),
                startDate: t.startDate || undefined,
                endDate: t.endDate || undefined,
                duration: t.duration !== undefined ? Number(t.duration) : 0,
                predecessorTaskId: t.predecessorTaskId ? Number(t.predecessorTaskId) : null,
                dependencyType: 'FS',
                progress: t.progress !== undefined ? Number(t.progress) : 0,
                status: t.status || 'PLANNED',
                assigneeId: t.assigneeId ? Number(t.assigneeId) : null,
              }));
              setScheduleData(mapped);
              setIsScheduleServerSynced(true);
              setIsLegacyScheduleDraftDetected(false);
              if (scheduleStorageKey && typeof window !== 'undefined') {
                localStorage.removeItem(scheduleStorageKey);
              }
            } else {
              // Server has no tasks yet: check if legacy localStorage draft exists
              setIsScheduleServerSynced(false);
              if (scheduleStorageKey && typeof window !== 'undefined') {
                const savedSchedule = localStorage.getItem(scheduleStorageKey);
                if (savedSchedule) {
                  try {
                    const parsed = JSON.parse(savedSchedule);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      setScheduleData(parsed);
                      setIsLegacyScheduleDraftDetected(true);
                    } else {
                      setScheduleData([]);
                      setIsLegacyScheduleDraftDetected(false);
                    }
                  } catch (e) {
                    setScheduleData([]);
                    setIsLegacyScheduleDraftDetected(false);
                  }
                } else {
                  setScheduleData([]);
                  setIsLegacyScheduleDraftDetected(false);
                }
              } else {
                setScheduleData([]);
                setIsLegacyScheduleDraftDetected(false);
              }
            }
          })
          .catch((err) => {
            console.error('Failed to load project schedule from server:', err);
            setScheduleData([]);
            setIsLegacyScheduleDraftDetected(false);
            setIsScheduleServerSynced(false);
          })
          .finally(() => {
            setIsScheduleLoading(false);
          });
      }

      if (canonicalProjectId > 0) {
        // 4. Load Procurement Gate Record from Backend SSOT
        ProjectService.getManagementReview(canonicalProjectId)
          .then((serverGate) => {
            if (serverGate && serverGate.status) {
              setGateRecord(serverGate);
            } else {
              setGateRecord({ status: 'NOT_SUBMITTED' });
            }
          })
          .catch((err) => {
            console.error('Failed to load management review in PM modal:', err);
            setGateRecord({ status: 'NOT_SUBMITTED' });
          });

        // 5. Load Initial Condition Record from Backend SSOT
        ProjectService.getInitialCondition(canonicalProjectId)
          .then((cond) => {
            if (cond && (cond.id || cond.status === 'READY' || (cond.locationCondition && cond.locationCondition.trim().length > 0))) {
              setInitialCondition(cond);
            } else {
              const localCond = getInitialCondition(canonicalProjectId);
              setInitialCondition(localCond);
            }
          })
          .catch((err) => {
            console.error('Failed to load initial condition in PM modal:', err);
            const localCond = getInitialCondition(canonicalProjectId);
            setInitialCondition(localCond);
          });

        // 6. Load 4-Pillar Operational Readiness from Backend SSOT (Phase B / OP-03)
        fetchOperationalReadiness(canonicalProjectId);

        // 7. Load downstream PR & Workflow status if project is in or past READY_FOR_PROCUREMENT
        ProcurementService.getPurchaseRequests()
          .then(async (allPrs) => {
            const pr = Array.isArray(allPrs)
              ? allPrs.find((p: any) => Number(p.projectId || p.project_id || (p as any).project?.id) === Number(canonicalProjectId))
              : null;
            if (pr) {
              let wfInst: any = null;
              try {
                const rawInst = await WorkflowEngineService.getInstanceByEntity('PURCHASE_REQUEST', pr.id);
                wfInst = (rawInst as any)?.data?.id ? (rawInst as any).data : rawInst;
              } catch (e) {
                console.warn('Could not fetch workflow instance for PR:', e);
              }

              const finTask = wfInst?.tasks?.find((t: any) => t.nodeId === 'node_finance_review' && t.status === 'COMPLETED');
              const dirTask = wfInst?.tasks?.find((t: any) => t.nodeId === 'node_director_approval' && t.status === 'COMPLETED');

              setPrApprovalState({
                prId: pr.id,
                prNumber: pr.prNumber,
                projectId: canonicalProjectId,
                projectName: charter?.project_name || '',
                totalAmount: Number(pr.totalEstimatedAmount || 0),
                status: pr.status || 'SUBMITTED',
                submittedBy: 'Procurement Team',
                submittedAt: pr.createdAt,
                financeReviewedBy: finTask?.decidedByUser?.fullName || (finTask ? 'Finance Team' : undefined),
                financeReviewedAt: finTask?.decidedAt || undefined,
                financeComments: finTask?.comments || undefined,
                directorApprovedBy: dirTask?.decidedByUser?.fullName || (dirTask ? 'Director' : undefined),
                directorApprovedAt: dirTask?.decidedAt || undefined,
                directorComments: dirTask?.comments || undefined,
                workflowInstance: wfInst || undefined,
              });
            } else {
              setPrApprovalState(null);
            }
          })
          .catch((err) => {
            console.error('Failed to load PR in PM modal:', err);
            setPrApprovalState(null);
          });
      }
    }
  }, [open, charter, canonicalProjectId, costStorageKey, wbsStorageKey, scheduleStorageKey]);

  // --- COST CALCULATIONS ---
  const contractLegalValue = useMemo(() => Number(charter?.contract_total_value || 0), [charter]);
  const marketingEstimate = useMemo(
    () => Number(charter?.project_budget || charter?.contract_total_value || 0),
    [charter]
  );

  const hasCostInput = useMemo(() => {
    return costCategories.some((cat) => {
      if (cat.mode === 'DIRECT') return (cat.directSubtotal || 0) > 0;
      return (cat.items || []).some((item) => (item.subtotal || 0) > 0);
    });
  }, [costCategories]);

  const totalPmEstimate = useMemo(() => {
    return costCategories.reduce((sum, cat) => sum + (cat.categoryTotal || 0), 0);
  }, [costCategories]);

  const varianceNominal = useMemo(() => {
    return totalPmEstimate - marketingEstimate;
  }, [totalPmEstimate, marketingEstimate]);

  const variancePercentage = useMemo(() => {
    if (marketingEstimate === 0) return 0;
    return (varianceNominal / marketingEstimate) * 100;
  }, [varianceNominal, marketingEstimate]);

  const estimatedMarginNominal = useMemo(() => {
    return contractLegalValue - totalPmEstimate;
  }, [contractLegalValue, totalPmEstimate]);

  const estimatedMarginPercentage = useMemo(() => {
    if (contractLegalValue === 0) return 0;
    return (estimatedMarginNominal / contractLegalValue) * 100;
  }, [estimatedMarginNominal, contractLegalValue]);

  // --- WBS CALCULATIONS (R1-1, R1-3, R1-4, R1-24, R1-C1) ---
  const rootWeightSum = useMemo(() => calculateRootWeightSum(wbsData), [wbsData]);
  const leafWeightSum = useMemo(() => calculateLeafWeightSum(wbsData), [wbsData]);
  const hierarchyIntegrity = useMemo(() => checkWbsHierarchyIntegrity(wbsData), [wbsData]);
  const isRootWeightValid = Math.abs(rootWeightSum - 100) < 0.01;
  const isLeafWeightValid = Math.abs(leafWeightSum - 100) < 0.01;
  const isHierarchyValid = hierarchyIntegrity.valid;
  const isWbsWeightValid = isRootWeightValid && isLeafWeightValid && isHierarchyValid;
  const isWbsComplete = wbsData.length > 0 && isWbsWeightValid;
  const wbsStructureMetrics = useMemo(() => getWbsStructureMetrics(wbsData), [wbsData]);

  // C1-1 to C1-4: Separate Structural Safety & Over-Allocation from Business Completeness
  const isRootOverAllocated = rootWeightSum > 100.01;
  const isLeafOverAllocated = leafWeightSum > 100.01;
  const overAllocatedHierarchyViolation = useMemo(
    () => hierarchyIntegrity.violations.find((v) => v.isOverAllocated),
    [hierarchyIntegrity]
  );
  const hasWbsOverAllocation = isRootOverAllocated || isLeafOverAllocated || Boolean(overAllocatedHierarchyViolation);

  // --- SCHEDULE CALCULATIONS ---
  const leafNodesCount = useMemo(() => countLeafNodes(wbsData), [wbsData]);
  const [scheduleData, setScheduleData] = useState<ScheduleTaskItem[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState<boolean>(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState<boolean>(false);
  const [isScheduleServerSynced, setIsScheduleServerSynced] = useState<boolean>(false);
  const [isLegacyScheduleDraftDetected, setIsLegacyScheduleDraftDetected] = useState<boolean>(false);

  const scheduledTasksCount = useMemo(() => {
    return scheduleData.filter((i) => {
      const isMilestone = i.type ? i.type === 'MILESTONE' : Boolean(i.isMilestone);
      return isMilestone
        ? Boolean(i.startDate && dayjs(i.startDate).isValid())
        : Boolean(i.startDate && i.endDate && dayjs(i.endDate).isSameOrAfter(dayjs(i.startDate), 'day'));
    }).length;
  }, [scheduleData]);

  const isScheduleComplete = leafNodesCount > 0 && scheduledTasksCount === leafNodesCount;

  const scheduleTimelineSummary = useMemo(() => {
    const scheduled = scheduleData.filter((i) => i.startDate && dayjs(i.startDate).isValid());
    if (scheduled.length === 0) {
      return { minStartStr: '—', maxEndStr: '—', duration: 0, milestoneCount: 0, taskCount: 0 };
    }

    let minStart: dayjs.Dayjs | null = null;
    let maxEnd: dayjs.Dayjs | null = null;

    for (const item of scheduled) {
      if (item.startDate) {
        const d = dayjs(item.startDate);
        if (!minStart || d.isBefore(minStart)) minStart = d;
      }
      if (item.endDate) {
        const d = dayjs(item.endDate);
        if (!maxEnd || d.isAfter(maxEnd)) maxEnd = d;
      } else if (item.startDate) {
        const d = dayjs(item.startDate);
        if (!maxEnd || d.isAfter(maxEnd)) maxEnd = d;
      }
    }

    const duration = minStart && maxEnd ? maxEnd.diff(minStart, 'day') : 0;
    const milestoneCount = scheduleData.filter((i) => i.isMilestone).length;
    const taskCount = scheduleData.filter((i) => !i.isMilestone).length;

    return {
      minStartStr: minStart ? minStart.format('DD MMM YYYY') : '—',
      maxEndStr: maxEnd ? maxEnd.format('DD MMM YYYY') : '—',
      duration,
      milestoneCount,
      taskCount,
    };
  }, [scheduleData]);

  // --- COMPLETENESS & SYNCHRONIZED READINESS STATUS (R9.1B-OP-FIX Phase 3: OP-03) ---
  const isCostComplete = hasCostInput && totalPmEstimate > 0 && isCostMappingValid;
  const isConditionComplete = isInitialConditionComplete(initialCondition);

  const isRevisionWorkflow = Boolean(
    (gateRecord?.workflow
      ? gateRecord.workflow.current?.nodeKey === 'PM_REVISION'
      : gateRecord?.status === 'NEEDS_REVISION') ||
    operationalReadinessData?.gate?.status === 'NEEDS_REVISION' ||
    operationalReadinessData?.workflow?.currentNodeId?.startsWith('node_pm_revision') ||
    operationalReadinessData?.gate?.currentNodeId?.startsWith('node_pm_revision')
  );

  const effectiveHasPersistedRevisionAfterReturn = useMemo(() => {
    if (!isRevisionWorkflow) return true;
    if (typeof operationalReadinessData?.hasPersistedRevisionAfterReturn === 'boolean') {
      return operationalReadinessData.hasPersistedRevisionAfterReturn;
    }
    if (typeof operationalReadinessData?.gate?.hasPersistedRevisionAfterReturn === 'boolean') {
      return operationalReadinessData.gate.hasPersistedRevisionAfterReturn;
    }
    if (typeof (gateRecord as any)?.hasPersistedRevisionAfterReturn === 'boolean') {
      return (gateRecord as any).hasPersistedRevisionAfterReturn;
    }
    return false;
  }, [
    isRevisionWorkflow,
    operationalReadinessData?.hasPersistedRevisionAfterReturn,
    operationalReadinessData?.gate?.hasPersistedRevisionAfterReturn,
    (gateRecord as any)?.hasPersistedRevisionAfterReturn,
  ]);

  const readinessEvaluation = useMemo(() => {
    return evaluateOperationalPlanReadiness({
      operationalReadinessData,
      isReadinessLoading,
      hasCostInput,
      totalPmEstimate,
      isCostMappingValid,
      isCostServerSynced,
      isWbsComplete,
      isWbsServerSynced,
      isScheduleComplete,
      isScheduleServerSynced,
      isConditionComplete,
      initialConditionId: initialCondition?.id,
      hasSavedDraftSinceRevision: effectiveHasPersistedRevisionAfterReturn,
      hasPersistedRevisionAfterReturn: effectiveHasPersistedRevisionAfterReturn,
      isRevisionMode: isRevisionWorkflow,
    });
  }, [
    operationalReadinessData,
    isReadinessLoading,
    hasCostInput,
    totalPmEstimate,
    isCostMappingValid,
    isCostServerSynced,
    isWbsComplete,
    isWbsServerSynced,
    isScheduleComplete,
    isScheduleServerSynced,
    isConditionComplete,
    initialCondition?.id,
    effectiveHasPersistedRevisionAfterReturn,
    isRevisionWorkflow,
  ]);

  const {
    isCostReady,
    isWbsReady,
    isScheduleReady,
    isConditionReady,
    isCostLocalDraft,
    isWbsLocalDraft,
    isScheduleLocalDraft,
    isConditionLocalDraft,
    completenessScore,
    isOperationalPlanAuthoritativeReady,
  } = readinessEvaluation;

  // Save All Drafts
  const handleSaveAllDrafts = useCallback(
    async (showToast = true) => {
      if (!charter) return;
      if (isCostSaving || isWbsSaving || isScheduleSaving) return;
      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // --- Coordinated State Commit Buffers ---
      // WBS and Schedule results are buffered here, then committed together
      // after both saves complete. This prevents intermediate-state
      // reconciliation race condition in ScheduleGanttTab's useEffect.
      let pendingWbsTree: WbsNodeItem[] | null = null;
      let pendingExpandedKeys: React.Key[] = [];
      let pendingScheduleData: ScheduleTaskItem[] | null = null;
      let costSaveError = false;
      let wbsSaveError = false;
      let scheduleSaveError = false;

      const costAttempted = canonicalProjectId > 0 && hasCostInput;
      const wbsAttempted = canonicalProjectId > 0 && Boolean(wbsData && wbsData.length > 0);
      const scheduleAttempted = canonicalProjectId > 0 && Boolean(scheduleData && scheduleData.length > 0);

      // 1. Save Cost via Canonical API SSOT
      if (costAttempted) {
        // PRE-SAVE GUARD: Block save if any WBS item lacks active leaf WBS mapping (avoid 400 BadRequest)
        // Draft persistence of UNASSIGNED items is allowed, but readiness remains false.
        const costValidation = validateCostEstimateItems(costCategories, activeLeafWbsIds, { allowUnassigned: true });
        if (!costValidation.valid) {
          costSaveError = true;
          setIsCostServerSynced(false);
          const errText = costValidation.error || 'Terdapat item WBS yang belum dipetakan ke WBS Deliverable aktif.';
          message.error(`Cost / RAB: ${errText}`);
        } else {
          setIsCostSaving(true);
          try {
            const costPayload = buildSaveCostEstimatePayload(costCategories, pmNotes);
            const res = await ProjectService.saveCostEstimate(canonicalProjectId, costPayload);
            if (res && res.categories) {
              const mapped = mapBackendEstimateToCategories(res.categories);
              setCostCategories(mapped);
              setPmNotes(res.pmNotes || '');
            }
            if (costStorageKey && typeof window !== 'undefined') {
              localStorage.removeItem(costStorageKey);
              localStorage.removeItem(`pm_cost_estimate_draft_${canonicalProjectId}`);
            }
            setIsCostServerSynced(true);
            setIsLegacyCostDraftDetected(false);
          } catch (err: any) {
            costSaveError = true;
            setIsCostServerSynced(false);
            console.error('Failed to save Cost estimate to server:', err);
            const errMsg = err.response?.data?.message || err.message || 'Gagal menyimpan Estimasi Biaya ke server';
            const formattedErr = Array.isArray(errMsg) ? errMsg.join('. ') : errMsg;
            message.error(`Cost / RAB: ${formattedErr}`);
          } finally {
            setIsCostSaving(false);
          }
        }
      }

      // 2. Save WBS via Canonical API SSOT (C1-1 to C1-4: Structural Safety vs Completeness)
      if (wbsAttempted) {
        if (hasWbsOverAllocation) {
          wbsSaveError = true;
          setIsWbsServerSynced(false);
          if (isRootOverAllocated) {
            message.error(
              `WBS Over-allocation: Total bobot Root (${rootWeightSum.toFixed(2)}%) melebihi 100.00%. Kurangi bobot sebelum menyimpan.`
            );
          } else if (isLeafOverAllocated) {
            message.error(
              `WBS Over-allocation: Total bobot Leaf (${leafWeightSum.toFixed(2)}%) melebihi 100.00%. Kurangi bobot sebelum menyimpan.`
            );
          } else if (overAllocatedHierarchyViolation) {
            message.error(
              `WBS Over-allocation: Total bobot anak (${overAllocatedHierarchyViolation.childrenWeightSum}%) melebihi induk (${overAllocatedHierarchyViolation.parentWeight}%) pada "${overAllocatedHierarchyViolation.code} ${overAllocatedHierarchyViolation.name}".`
            );
          }
        } else {
          setIsWbsSaving(true);
          try {
            const wbsTreePayload = {
              nodes: convertUiNodesToSavePayload(wbsData),
            };
            const res = await ProjectService.saveWbsTree(canonicalProjectId, wbsTreePayload);

            // Phase C & Phase D: Robust envelope extraction and permanent ID assertion
            const rawNodes = extractPersistedWbsArray(res);
            if (!rawNodes || !Array.isArray(rawNodes) || rawNodes.length === 0) {
              wbsSaveError = true;
              setIsWbsServerSynced(false);
              console.error('[WBS Save] Failed to extract persisted WBS array from response:', res);
              message.error('WBS: Gagal mengekstrak struktur WBS tersimpan dari server. Format respons server tidak valid.');
            } else {
              const serverTree = convertBackendTreeToUiNodes(rawNodes);
              if (!serverTree || serverTree.length === 0 || !assertPersistedWbsNodesHaveDbIds(serverTree)) {
                wbsSaveError = true;
                setIsWbsServerSynced(false);
                console.error('[WBS Save] Persisted WBS nodes lack valid permanent database IDs:', serverTree);
                message.error('WBS: Node WBS tersimpan tidak memiliki ID database permanen yang valid.');
              } else {
                // Buffer — deferred to Coordinated State Commit
                pendingWbsTree = serverTree;
                pendingExpandedKeys = getAllNodeIds(serverTree);
                if (wbsStorageKey && typeof window !== 'undefined') {
                  localStorage.removeItem(wbsStorageKey);
                }
                setIsWbsServerSynced(true);
                setIsLegacyWbsDraftDetected(false);
              }
            }
          } catch (err: any) {
            wbsSaveError = true;
            setIsWbsServerSynced(false);
            console.error('Failed to save WBS tree to server:', err);
            const errMsg = err.response?.data?.message || err.message || 'Gagal menyimpan Struktur WBS ke server';
            message.error(`WBS: ${errMsg}`);
          } finally {
            setIsWbsSaving(false);
          }
        }
      }

      // 3. Save Schedule via Canonical API SSOT
      if (scheduleAttempted) {
        setIsScheduleSaving(true);

        // FAIL-FAST: If WBS save was attempted in this session but failed, abort Schedule save immediately
        if (wbsAttempted && (wbsSaveError || !pendingWbsTree)) {
          scheduleSaveError = true;
          setIsScheduleSaving(false);
          setIsScheduleServerSynced(false);
          message.error('Jadwal: Penyimpanan jadwal dibatalkan karena penyimpanan Struktur WBS gagal.');
        } else {
          // Authoritative WBS Tree for Schedule:
          // If WBS was just saved in this cycle, use pendingWbsTree (permanent DB IDs).
          // Otherwise use wbsData.
          const activeWbsTreeForSchedule = (wbsAttempted && pendingWbsTree) ? pendingWbsTree : wbsData;
          const activeLeaves = extractLeafWbsNodes(activeWbsTreeForSchedule);

          // Flatten pre-save WBS nodes to provide fallback mapping from temporary client IDs to WBS codes
          const preSaveFlattened: { id: string; code: string }[] = [];
          const traversePreSave = (list: WbsNodeItem[]) => {
            for (const item of list) {
              preSaveFlattened.push({ id: String(item.id), code: item.code });
              if (item.children && item.children.length > 0) {
                traversePreSave(item.children);
              }
            }
          };
          traversePreSave(wbsData);

          const schedulePayloadResult = buildSaveProjectSchedulePayload(
            scheduleData,
            activeLeaves,
            pmNotes,
            preSaveFlattened
          );

          if (!schedulePayloadResult.valid || !schedulePayloadResult.payload) {
            scheduleSaveError = true;
            setIsScheduleSaving(false);
            setIsScheduleServerSynced(false);
            const errText = schedulePayloadResult.error || 'Validasi rekonsiliasi WBS -> Jadwal gagal.';
            console.error('[Schedule Save Aborted]', errText);
            message.error(`Jadwal: ${errText}`);
          } else {
            try {
              const res = await ProjectService.saveProjectSchedule(
                canonicalProjectId,
                schedulePayloadResult.payload
              );
              if (res && Array.isArray(res.tasks)) {
                const mappedTasks: ScheduleTaskItem[] = res.tasks.map((t: any) => ({
                  id: Number(t.id),
                  wbsNodeId: String(t.wbsId),
                  wbsCode: t.wbsCode || '',
                  name: t.name,
                  type: t.isMilestone ? 'MILESTONE' : 'TASK',
                  isMilestone: Boolean(t.isMilestone),
                  startDate: t.startDate || undefined,
                  endDate: t.endDate || undefined,
                  duration: Number(t.duration ?? 0),
                  predecessorTaskId: t.predecessorTaskId ? Number(t.predecessorTaskId) : null,
                  dependencyType: 'FS',
                  progress: Number(t.progress || 0),
                  status: t.status || 'PLANNED',
                  assigneeId: t.assigneeId ? Number(t.assigneeId) : null,
                }));
                // Buffer — deferred to Coordinated State Commit
                pendingScheduleData = mappedTasks;
              } else {
                // Fallback: commit reconciled tasks so in-memory state holds permanent DB IDs
                pendingScheduleData = schedulePayloadResult.reconciledTasks;
              }
              if (scheduleStorageKey && typeof window !== 'undefined') {
                localStorage.removeItem(scheduleStorageKey);
              }
            } catch (err: any) {
              scheduleSaveError = true;
              setIsScheduleServerSynced(false);
              console.error('Failed to save project schedule to server:', err);
              const errMsg = err.response?.data?.message || err.message || 'Gagal menyimpan Jadwal Proyek';
              message.error(`Jadwal: ${errMsg}`);
            } finally {
              setIsScheduleSaving(false);
            }
          }
        }
      }

      // --- Coordinated State Commit ---
      // WBS and Schedule states are committed together to prevent
      // ScheduleGanttTab reconciliation from running with stale schedule data
      // when only WBS state has changed.
      if (pendingWbsTree) {
        setWbsData(pendingWbsTree);
        setExpandedRowKeys(pendingExpandedKeys);
      }
      if (pendingScheduleData) {
        setScheduleData(pendingScheduleData);
        setIsScheduleServerSynced(true);
        setIsLegacyScheduleDraftDetected(false);
      }
      // On schedule save failure: preserve current scheduleData unchanged.
      // isScheduleServerSynced remains false — UI reflects unsaved state.

      // 4. Refetch authoritative backend operational readiness SSOT after all pillar saves resolve
      // Refetch authoritative backend operational readiness SSOT after all pillar saves resolve
      if (canonicalProjectId > 0) {
        await fetchOperationalReadiness(canonicalProjectId);
        ProjectService.getManagementReview(canonicalProjectId)
          .then((serverGate) => {
            if (serverGate && serverGate.status) {
              setGateRecord(serverGate);
            }
          })
          .catch((err) => {
            console.warn('Failed to refetch management review after draft save:', err);
          });
      }

      setLastSavedTime(nowStr);
      if (showToast) {
        const failedSections: string[] = [];
        if (costAttempted && costSaveError) failedSections.push('Cost / RAB');
        if (wbsAttempted && wbsSaveError) failedSections.push('WBS');
        if (scheduleAttempted && scheduleSaveError) failedSections.push('Jadwal');

        const succeededSections: string[] = [];
        if (costAttempted && !costSaveError) succeededSections.push('Cost / RAB');
        if (wbsAttempted && !wbsSaveError) succeededSections.push('WBS');
        if (scheduleAttempted && !scheduleSaveError) succeededSections.push('Jadwal');

        if (failedSections.length === 0) {
          message.success('Draft Operational Plan berhasil disimpan.');
        } else if (failedSections.length === 1) {
          if (costSaveError) {
            message.error('Cost / RAB gagal disimpan.');
          } else if (wbsSaveError) {
            message.error('WBS gagal disimpan.');
          } else if (scheduleSaveError) {
            message.warning('Jadwal gagal disimpan.');
          }
        } else {
          // Lebih dari satu gagal: jangan menampilkan kalimat bahwa section lain berhasil kecuali benar-benar sukses.
          if (succeededSections.length > 0) {
            message.error(`Gagal menyimpan: ${failedSections.join(', ')}. Berhasil disimpan: ${succeededSections.join(', ')}.`);
          } else {
            message.error(`Draft Operational Plan gagal disimpan: ${failedSections.join(', ')}.`);
          }
        }
      }
      if (onRefreshParent) {
        onRefreshParent();
      }
    },
    [
      charter,
      canonicalProjectId,
      costStorageKey,
      wbsStorageKey,
      costCategories,
      hasCostInput,
      totalPmEstimate,
      marketingEstimate,
      contractLegalValue,
      varianceNominal,
      variancePercentage,
      estimatedMarginNominal,
      estimatedMarginPercentage,
      pmNotes,
      wbsData,
      scheduleData,
      isCostSaving,
      isWbsSaving,
      isScheduleSaving,
      onRefreshParent,
      fetchOperationalReadiness,
    ]
  );

  // PM Submission Handler to Head of Operations (API SSOT)
  const handleSubmitForManagementReview = async () => {
    if (isSubmittingReview) return;
    if (!canonicalProjectId || canonicalProjectId <= 0) {
      message.error('Project ID tidak valid.');
      return;
    }
    const pid = canonicalProjectId;
    if (!isOperationalPlanAuthoritativeReady || completenessScore < 4) {
      message.error('Semua 4 pilar operasional (Cost, WBS 100%, Schedule, Initial Condition) harus berstatus READY menurut evaluasi backend sebelum mengajukan review!');
      return;
    }
    const isResubmission = gateRecord?.workflow
      ? gateRecord.workflow.current?.nodeKey === 'PM_REVISION'
      : gateRecord?.status === 'NEEDS_REVISION';

    setIsSubmittingReview(true);
    try {
      const serverResult = await ProjectService.submitManagementReview(pid);
      setGateRecord(serverResult);
      setIsSubmitModalOpen(false);

      // Refresh live readiness from server
      await fetchOperationalReadiness(pid);

      if (isResubmission) {
        message.success('Operational Plan hasil revisi berhasil diajukan kembali untuk Management Review!');
      } else {
        message.success('Operational Plan berhasil diajukan untuk Management Review!');
      }
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      console.error('Failed to submit operational plan for review:', err);
      const errMsg = err.response?.data?.message || err.message || 'Gagal mengajukan review ke server.';
      message.error(errMsg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // --- COST ESTIMATE HANDLERS ---
  const handleDirectSubtotalChange = (categoryKey: string, val: number | null) => {
    setIsCostServerSynced(false);
    setIsLegacyCostDraftDetected(true);
    const amount = Number(val || 0);
    setCostCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          return {
            ...cat,
            directSubtotal: amount,
            categoryTotal: amount,
          };
        }
        return cat;
      })
    );
  };

  const handleModeChange = (categoryKey: string, newMode: 'DIRECT' | 'ITEMIZED') => {
    setIsCostServerSynced(false);
    setIsLegacyCostDraftDetected(true);
    setCostCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const catTotal =
            newMode === 'DIRECT'
              ? cat.directSubtotal
              : (cat.items || []).reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            mode: newMode,
            categoryTotal: catTotal,
          };
        }
        return cat;
      })
    );
  };

  const handleAddItem = (categoryKey: string) => {
    setIsCostServerSynced(false);
    setIsLegacyCostDraftDetected(true);
    const newItem: CostItemDetail = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      itemName: '',
      quantity: 1,
      uom: 'Unit',
      rateType: 'UNIT_RATE',
      unitPrice: 0,
      subtotal: 0,
      costSource: 'PM_ESTIMATE',
      assignmentScope: 'UNASSIGNED',
    };

    setCostCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const updatedItems = [...cat.items, newItem];
          const newTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            items: updatedItems,
            categoryTotal: newTotal,
          };
        }
        return cat;
      })
    );
  };

  const handleItemChange = (
    categoryKey: string,
    itemId: string,
    field: keyof CostItemDetail,
    val: any
  ) => {
    setIsCostServerSynced(false);
    setIsLegacyCostDraftDetected(true);
    setCostCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const updatedItems = cat.items.map((item) => {
            if (item.id === itemId) {
              const updated = { ...item, [field]: val };
              if (field === 'quantity' || field === 'unitPrice') {
                const qty = field === 'quantity' ? Number(val || 0) : item.quantity;
                const price = field === 'unitPrice' ? Number(val || 0) : item.unitPrice;
                updated.subtotal = qty * price;
              }
              if (field === 'assignmentScope' && val !== 'WBS') {
                updated.wbsNodeId = undefined;
              }
              return updated;
            }
            return item;
          });

          const newTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            items: updatedItems,
            categoryTotal: newTotal,
          };
        }
        return cat;
      })
    );
  };

  const handleRemoveItem = (categoryKey: string, itemId: string) => {
    setIsCostServerSynced(false);
    setIsLegacyCostDraftDetected(true);
    setCostCategories((prev) =>
      prev.map((cat) => {
        if (cat.categoryKey === categoryKey) {
          const updatedItems = cat.items.filter((i) => i.id !== itemId);
          const newTotal = updatedItems.reduce((sum, i) => sum + i.subtotal, 0);
          return {
            ...cat,
            items: updatedItems,
            categoryTotal: newTotal,
          };
        }
        return cat;
      })
    );
  };

  // --- WBS HANDLERS ---
  const handleOpenAddRoot = () => {
    setNodeModalMode('ADD_ROOT');
    setTargetParentNode(null);
    setTargetEditNode(null);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({
      name: '',
      weightPercentage: 10,
      description: '',
    });
    setIsNodeModalOpen(true);
  };

  const handleOpenAddChild = (parent: WbsNodeItem) => {
    setNodeModalMode('ADD_CHILD');
    setTargetParentNode(parent);
    setTargetEditNode(null);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({
      name: '',
      weightPercentage: 5,
      description: '',
    });
    setIsNodeModalOpen(true);
  };

  const handleOpenEditNode = (node: WbsNodeItem) => {
    setNodeModalMode('EDIT');
    setTargetParentNode(null);
    setTargetEditNode(node);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({
      name: node.name,
      weightPercentage: node.weightPercentage,
      description: node.description || '',
    });
    setIsNodeModalOpen(true);
  };

  const handleNodeFormSubmit = () => {
    nodeForm.validateFields().then((values) => {
      const { name, weightPercentage, description } = values;

      if (nodeModalMode === 'ADD_ROOT') {
        const newNode: WbsNodeItem = {
          id: `wbs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dbId: undefined,
          code: '',
          name: name.trim(),
          level: 1,
          weightPercentage: Number(weightPercentage) || 0,
          description: description?.trim() || '',
          parentId: null,
          children: [],
        };
        const updated = recomputeWbsHierarchy([...wbsData, newNode]);
        setWbsData(updated);
        setExpandedRowKeys((prev) => [...prev, newNode.id]);
      } else if (nodeModalMode === 'ADD_CHILD' && targetParentNode) {
        const newNode: WbsNodeItem = {
          id: `wbs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dbId: undefined,
          code: '',
          name: name.trim(),
          level: targetParentNode.level + 1,
          weightPercentage: Number(weightPercentage) || 0,
          description: description?.trim() || '',
          parentId: targetParentNode.id,
          children: [],
        };

        const addChildRecursive = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
          return nodes.map((node) => {
            const isTargetParent =
              String(node.id) === String(targetParentNode.id) ||
              Boolean(node.dbId && targetParentNode.dbId && Number(node.dbId) === Number(targetParentNode.dbId));
            if (isTargetParent) {
              const currentChildren = node.children || [];
              return {
                ...node,
                children: [...currentChildren, newNode],
              };
            }
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: addChildRecursive(node.children),
              };
            }
            return node;
          });
        };

        const updated = recomputeWbsHierarchy(addChildRecursive(wbsData));
        setWbsData(updated);
        setExpandedRowKeys((prev) => Array.from(new Set([...prev, targetParentNode.id, newNode.id])));
      } else if (nodeModalMode === 'EDIT' && targetEditNode) {
        const updateRecursive = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
          return nodes.map((node) => {
            const isMatch =
              String(node.id) === String(targetEditNode.id) ||
              Boolean(node.dbId && targetEditNode.dbId && Number(node.dbId) === Number(targetEditNode.dbId));
            if (isMatch) {
              return {
                ...node,
                dbId: node.dbId ?? targetEditNode.dbId,
                name: name.trim(),
                weightPercentage: Number(weightPercentage) || 0,
                description: description?.trim() || '',
              };
            }
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: updateRecursive(node.children),
              };
            }
            return node;
          });
        };

        const updated = recomputeWbsHierarchy(updateRecursive(wbsData));
        setWbsData(updated);
      }

      setIsWbsServerSynced(false);
      setIsLegacyWbsDraftDetected(true);
      setIsNodeModalOpen(false);
    });
  };

  const handleDeleteWbsNode = (nodeToDelete: WbsNodeItem) => {
    const deleteRecursive = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
      return nodes
        .filter((node) => {
          const matchId = String(node.id) === String(nodeToDelete.id);
          const matchDbId = Boolean(node.dbId && nodeToDelete.dbId && Number(node.dbId) === Number(nodeToDelete.dbId));
          return !matchId && !matchDbId;
        })
        .map((node) => {
          if (node.children && node.children.length > 0) {
            return {
              ...node,
              children: deleteRecursive(node.children),
            };
          }
          return node;
        });
    };

    const updated = recomputeWbsHierarchy(deleteRecursive(wbsData));
    setWbsData(updated);
    setIsWbsServerSynced(false);
    setIsLegacyWbsDraftDetected(true);
    message.success(`Work Package "${nodeToDelete.code} ${nodeToDelete.name}" dihapus.`);
  };

  // Filtered WBS data
  const filteredWbsData = useMemo(() => {
    if (!wbsSearchText.trim()) return wbsData;
    const lower = wbsSearchText.toLowerCase();

    const filterTree = (nodes: WbsNodeItem[]): WbsNodeItem[] => {
      return nodes
        .map((node) => {
          const matchSelf =
            node.name.toLowerCase().includes(lower) ||
            node.code.toLowerCase().includes(lower) ||
            (node.description && node.description.toLowerCase().includes(lower));

          const filteredChildren = node.children ? filterTree(node.children) : [];

          if (matchSelf || filteredChildren.length > 0) {
            return {
              ...node,
              children: filteredChildren.length > 0 ? filteredChildren : node.children,
            };
          }
          return null;
        })
        .filter(Boolean) as WbsNodeItem[];
    };

    return filterTree(wbsData);
  }, [wbsData, wbsSearchText]);

  // WBS Table Columns
  const wbsColumns = useMemo(() => [
    {
      title: 'Kode WBS',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code: string, record: WbsNodeItem) => {
        const isParent = record.children && record.children.length > 0;
        return (
          <Space size={4}>
            <Tag
              color={record.level === 1 ? '#1d4ed8' : record.level === 2 ? '#0284c7' : '#475569'}
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 4,
                padding: '1px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              {code}
            </Tag>
            {isParent ? (
              <FolderOpenOutlined style={{ color: '#d97706', fontSize: 13 }} />
            ) : (
              <FileTextOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Work Package / Scope Deliverable',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: WbsNodeItem) => (
        <div style={{ padding: '2px 0' }}>
          <Text
            strong={record.level === 1}
            style={{
              fontSize: record.level === 1 ? 13 : 12,
              color: record.level === 1 ? '#0f172a' : '#334155',
            }}
          >
            {name}
          </Text>
          {record.description && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tingkat',
      dataIndex: 'level',
      key: 'level',
      width: 135,
      render: (level: number) => (
        <Tag color={level === 1 ? 'blue' : level === 2 ? 'cyan' : 'geekblue'} style={{ borderRadius: 4, whiteSpace: 'nowrap' }}>
          {level === 1 ? 'Level 1 • Package' : level === 2 ? 'Level 2 • Sub' : `Level ${level} • Detail`}
        </Tag>
      ),
    },
    {
      title: 'Bobot WBS (%)',
      dataIndex: 'weightPercentage',
      key: 'weightPercentage',
      width: 125,
      align: 'right' as const,
      render: (val: number, record: WbsNodeItem) => {
        const isParent = record.children && record.children.length > 0;
        return (
          <div style={{ textAlign: 'right' }}>
            <Text strong style={{ fontSize: 12.5, color: isParent ? '#1d4ed8' : '#059669', whiteSpace: 'nowrap' }}>
              {Number(val || 0).toFixed(1)}%
            </Text>
            <Progress
              percent={Math.min(100, Number(val || 0))}
              size="small"
              showInfo={false}
              strokeColor={isParent ? '#3b82f6' : '#10b981'}
            />
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 140,
      align: 'center' as const,
      render: (_: any, record: WbsNodeItem) => {
        const subCount = countDescendants(record);
        return (
          <Space size={4}>
            <Tooltip title={`Tambah Sub Work Package di bawah ${record.code}`}>
              <Button
                size="small"
                type="link"
                icon={<PlusOutlined />}
                style={{ color: '#0284c7', fontSize: 11.5, padding: '0 4px', fontWeight: 600 }}
                onClick={() => handleOpenAddChild(record)}
              >
                Sub Work Package
              </Button>
            </Tooltip>

            <Tooltip title="Edit Work Package">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                style={{ color: '#475569', fontSize: 12, padding: '0 4px' }}
                onClick={() => handleOpenEditNode(record)}
              />
            </Tooltip>

            {subCount > 0 ? (
              <Popconfirm
                title="Hapus Work Package & Sub-Item?"
                description={`Work Package ${record.code} memiliki ${subCount} sub-item yang juga akan dihapus.`}
                onConfirm={() => handleDeleteWbsNode(record)}
                okText="Hapus Semua"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ fontSize: 12, padding: '0 4px' }} />
              </Popconfirm>
            ) : (
              <Popconfirm
                title="Hapus item WBS ini?"
                onConfirm={() => handleDeleteWbsNode(record)}
                okText="Hapus"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ fontSize: 12, padding: '0 4px' }} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ], [handleOpenAddChild, handleOpenEditNode, handleDeleteWbsNode]);

  // --- UNIFIED COMPLETE CHRONOLOGICAL APPROVAL HISTORY ---
  const unifiedApprovalEvents = useMemo(() => {
    // 1. Primary: Authoritative Chronological Transition History from Workflow Engine
    if (gateRecord?.workflow) {
      const history = gateRecord.workflow.history;
      if (!history || history.length === 0) {
        return [];
      }
      return history.map((h: any, idx: number) => {
        let tag = h.action;
        let color = 'blue';
        let label = h.action;
        let title = `Peralihan Alur: ${h.action}`;
        if (h.action === 'APPROVE') {
          color = 'success';
          label = 'APPROVED';
          title = `Persetujuan oleh ${h.actorRole || 'Reviewer'}`;
        } else if (h.action === 'RETURN' || h.action === 'REJECT') {
          color = 'error';
          label = 'REVISION';
          title = `Permintaan Revisi oleh ${h.actorRole || 'Reviewer'}`;
        } else if (h.action === 'START') {
          color = 'blue';
          label = 'SUBMITTED';
          title = 'Operational Plan Diajukan ke Management Review';
        }
        return {
          id: `wf_hist_${h.id}`,
          category: 'MANAGEMENT_REVIEW' as const,
          stageLabel: h.fromNode || 'Workflow Step',
          title,
          actor: `Oleh ${h.actorName || 'User'}`,
          role: h.actorRole || 'Reviewer',
          statusTag: { label, color },
          time: String(h.createdAt),
          formattedTime: dayjs(h.createdAt).format('DD MMM YYYY, HH:mm'),
          note: h.comments ? `Catatan: "${h.comments}"` : undefined,
          isPending: false,
          isLastAction: idx === history.length - 1,
        };
      });
    }

    // 2. Legacy Fallback (ONLY if workflow history is not available)
    const events: Array<{
      id: string;
      category: 'MANAGEMENT_REVIEW' | 'PROCUREMENT_PR' | 'FINANCE_REVIEW' | 'DIRECTOR_APPROVAL';
      stageLabel: string;
      title: string;
      actor: string;
      role: string;
      statusTag: { label: string; color: string };
      time?: string;
      formattedTime: string;
      note?: string;
      isPending?: boolean;
      isLastAction?: boolean;
    }> = [];

    // 1. PM Planning Submitted
    if (gateRecord?.submittedAt) {
      events.push({
        id: 'pm_submitted',
        category: 'MANAGEMENT_REVIEW',
        stageLabel: 'Management Review',
        title: 'Operational Plan Diajukan ke Management Review',
        actor: `Diajukan oleh ${gateRecord.submittedByName || 'Project Manager'}`,
        role: 'Project Manager',
        statusTag: { label: 'SUBMITTED', color: 'blue' },
        time: gateRecord.submittedAt,
        formattedTime: dayjs(gateRecord.submittedAt).format('DD MMM YYYY, HH:mm'),
      });
    }

    // 2. HOPS Revision Requested (if any)
    if (gateRecord?.decidedAt && gateRecord.status === 'NEEDS_REVISION') {
      const reviewerRoleName = gateRecord.reviewerRole === 'DIRECTOR' ? 'Director' : gateRecord.reviewerRole === 'GENERAL_MANAGER' ? 'General Manager' : gateRecord.reviewerRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Head of Operations';
      events.push({
        id: 'hoa_revision',
        category: 'MANAGEMENT_REVIEW',
        stageLabel: 'Management Review',
        title: 'Permintaan Revisi Operasional',
        actor: `Diminta revisi oleh ${gateRecord.decidedByName || 'Head of Operations'}`,
        role: reviewerRoleName,
        statusTag: { label: 'REVISION REQUESTED', color: 'error' },
        time: gateRecord.decidedAt,
        formattedTime: dayjs(gateRecord.decidedAt).format('DD MMM YYYY, HH:mm'),
        note: gateRecord.revisionNotes ? `Catatan: "${gateRecord.revisionNotes}"` : undefined,
      });
    }

    // 3. PM Resubmitted (if any)
    if (gateRecord?.resubmittedAt) {
      events.push({
        id: 'pm_resubmitted',
        category: 'MANAGEMENT_REVIEW',
        stageLabel: 'Management Review',
        title: 'Operational Plan Hasil Revisi Diajukan Ulang',
        actor: 'Diajukan ulang oleh Project Manager',
        role: 'Project Manager',
        statusTag: { label: 'RESUBMITTED', color: 'cyan' },
        time: gateRecord.resubmittedAt,
        formattedTime: dayjs(gateRecord.resubmittedAt).format('DD MMM YYYY, HH:mm'),
      });
    }

    // 4. HOPS Approved Management Review
    if (gateRecord?.decidedAt && gateRecord.status === 'READY_FOR_PROCUREMENT') {
      const reviewerRoleName = gateRecord.reviewerRole === 'DIRECTOR' ? 'Director' : gateRecord.reviewerRole === 'GENERAL_MANAGER' ? 'General Manager' : gateRecord.reviewerRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Head of Operations';
      events.push({
        id: 'hoa_approved',
        category: 'MANAGEMENT_REVIEW',
        stageLabel: 'Management Review',
        title: 'Operational Plan Disetujui & Dialihkan ke Procurement',
        actor: `Disetujui oleh ${gateRecord.decidedByName || 'Head of Operations'}`,
        role: reviewerRoleName,
        statusTag: { label: 'APPROVED', color: 'success' },
        time: gateRecord.decidedAt,
        formattedTime: dayjs(gateRecord.decidedAt).format('DD MMM YYYY, HH:mm'),
      });
    }

    // 5. Procurement PR Submitted
    if (prApprovalState?.submittedAt || prApprovalState?.prNumber) {
      events.push({
        id: 'proc_pr_submitted',
        category: 'PROCUREMENT_PR',
        stageLabel: 'Purchase Request',
        title: `Purchase Request (${prApprovalState.prNumber || `PR-${prApprovalState.prId}`}) Dibuat & Disubmit`,
        actor: `Diajukan oleh ${prApprovalState.submittedBy || 'Procurement Team'}`,
        role: 'Purchasing / Procurement',
        statusTag: { label: 'PR SUBMITTED', color: 'blue' },
        time: prApprovalState.submittedAt,
        formattedTime: prApprovalState.submittedAt ? dayjs(prApprovalState.submittedAt).format('DD MMM YYYY, HH:mm') : '-',
        note: prApprovalState.totalAmount ? `Total Estimasi: Rp ${Number(prApprovalState.totalAmount).toLocaleString('id-ID')}` : undefined,
      });
    }

    // 6. Finance Approval
    if (prApprovalState?.financeReviewedAt && (prApprovalState.status === 'DIRECTOR_APPROVAL' || prApprovalState.status === 'APPROVED' || prApprovalState.workflowInstance?.tasks?.some((t: any) => t.nodeId === 'node_finance_review' && t.status === 'COMPLETED'))) {
      events.push({
        id: 'fin_approved',
        category: 'FINANCE_REVIEW',
        stageLabel: 'Financial Review',
        title: 'Financial Review Disetujui & Diteruskan ke Director',
        actor: `Disetujui oleh ${prApprovalState.financeReviewedBy || 'Finance User'}`,
        role: 'Finance',
        statusTag: { label: 'FINANCE APPROVED', color: 'success' },
        time: prApprovalState.financeReviewedAt,
        formattedTime: dayjs(prApprovalState.financeReviewedAt).format('DD MMM YYYY, HH:mm'),
        note: prApprovalState.financeComments ? `Evaluasi: "${prApprovalState.financeComments}"` : undefined,
      });
    }

    // 7. Rejection / Returned to Procurement (if any)
    if (prApprovalState?.rejectedAt && prApprovalState.status === 'REJECTED_TO_PROCUREMENT') {
      const rejRole = prApprovalState.rejectedByRole === 'DIRECTOR' ? 'Director' : 'Finance';
      events.push({
        id: 'pr_rejected',
        category: prApprovalState.rejectedByRole === 'DIRECTOR' ? 'DIRECTOR_APPROVAL' : 'FINANCE_REVIEW',
        stageLabel: prApprovalState.rejectedByRole === 'DIRECTOR' ? 'Director Approval' : 'Financial Review',
        title: `Purchase Request Dikembalikan ke Procurement oleh ${rejRole}`,
        actor: `Dikembalikan oleh ${prApprovalState.rejectedBy || rejRole}`,
        role: rejRole,
        statusTag: { label: 'PR REJECTED', color: 'error' },
        time: prApprovalState.rejectedAt,
        formattedTime: dayjs(prApprovalState.rejectedAt).format('DD MMM YYYY, HH:mm'),
        note: prApprovalState.rejectionReason ? `Catatan: "${prApprovalState.rejectionReason}"` : undefined,
      });
    }

    // 8. Director Final Approval (COMPLETED)
    if (prApprovalState?.directorApprovedAt && prApprovalState.status === 'APPROVED') {
      events.push({
        id: 'dir_approved',
        category: 'DIRECTOR_APPROVAL',
        stageLabel: 'Director Approval',
        title: 'Purchase Request Disetujui Final oleh Director',
        actor: `Disetujui oleh ${prApprovalState.directorApprovedBy || 'Director'}`,
        role: 'Director',
        statusTag: { label: 'FINAL APPROVED', color: 'success' },
        time: prApprovalState.directorApprovedAt,
        formattedTime: dayjs(prApprovalState.directorApprovedAt).format('DD MMM YYYY, HH:mm'),
        note: prApprovalState.directorComments ? `Catatan: "${prApprovalState.directorComments}"` : undefined,
      });
    }

    // 9. Director Final Approval Pending (CURRENT / PENDING)
    if (prApprovalState?.status === 'DIRECTOR_APPROVAL') {
      events.push({
        id: 'dir_pending',
        category: 'DIRECTOR_APPROVAL',
        stageLabel: 'Director Approval',
        title: 'Menunggu Final Approval Director',
        actor: 'Director (Final Authority)',
        role: 'Director',
        statusTag: { label: 'FINAL APPROVAL PENDING', color: 'purple' },
        isPending: true,
        formattedTime: 'Sedang Berjalan',
        note: 'Menunggu otorisasi penerbitan pengadaan oleh Director',
      });
    }

    // 10. Finance Review Pending (if PR submitted but not yet finance reviewed)
    if (prApprovalState && (prApprovalState.status === 'SUBMITTED' || prApprovalState.status === 'FINANCE_REVIEW') && !prApprovalState.financeReviewedAt) {
      events.push({
        id: 'fin_pending',
        category: 'FINANCE_REVIEW',
        stageLabel: 'Financial Review',
        title: 'Menunggu Financial Review',
        actor: 'Finance Team',
        role: 'Finance',
        statusTag: { label: 'REVIEW PENDING', color: 'processing' },
        isPending: true,
        formattedTime: 'Sedang Berjalan',
        note: 'Menunggu evaluasi anggaran & kelayakan harga oleh Finance',
      });
    }

    // 11. Sort completed items chronologically by timestamp
    const completed = events.filter((e) => !e.isPending).sort((a, b) => {
      const tA = a.time ? dayjs(a.time).valueOf() : 0;
      const tB = b.time ? dayjs(b.time).valueOf() : 0;
      return tA - tB;
    });
    const pending = events.filter((e) => e.isPending);

    const merged = [...completed, ...pending];
    if (completed.length > 0) {
      completed[completed.length - 1].isLastAction = true;
    }
    return merged;
  }, [gateRecord, prApprovalState]);

  const lastApprovalInfo = useMemo(() => {
    // 1. Primary: Authoritative SSOT from Backend Canonical Workflow Projection
    if (gateRecord?.workflow) {
      const wfLastApproved = gateRecord.workflow.lastApprovedBy;
      const wfLastApprovedAt = gateRecord.workflow.lastApprovedAt;
      const wfLastApprovedRole = gateRecord.workflow.lastApprovedRole || wfLastApproved?.role;
      if (wfLastApproved && wfLastApproved.name && wfLastApprovedAt) {
        return {
          text: `Disetujui oleh ${wfLastApproved.name} (${wfLastApprovedRole || 'Reviewer'} · ${dayjs(wfLastApprovedAt).format('DD MMM YYYY, HH:mm')})`,
        };
      }
      return null;
    }

    // 2. Legacy Fallback (ONLY if workflow instance does not exist)
    if (prApprovalState?.status === 'APPROVED' && prApprovalState?.directorApprovedAt) {
      return {
        text: `Disetujui oleh ${prApprovalState.directorApprovedBy || 'Director'} (Director · ${dayjs(prApprovalState.directorApprovedAt).format('DD MMM YYYY, HH:mm')})`,
      };
    }
    if (prApprovalState?.financeReviewedAt && (prApprovalState.status === 'DIRECTOR_APPROVAL' || prApprovalState.status === 'APPROVED')) {
      return {
        text: `Disetujui oleh ${prApprovalState.financeReviewedBy || 'Finance Team'} (Finance · ${dayjs(prApprovalState.financeReviewedAt).format('DD MMM YYYY, HH:mm')})`,
      };
    }
    if (gateRecord?.status === 'READY_FOR_PROCUREMENT' && gateRecord?.decidedAt) {
      const reviewerRoleName = gateRecord.reviewerRole === 'DIRECTOR' ? 'Director' : gateRecord.reviewerRole === 'GENERAL_MANAGER' ? 'General Manager' : gateRecord.reviewerRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Head of Operations';
      return {
        text: `Disetujui oleh ${gateRecord.decidedByName || 'Head of Operations'} (${reviewerRoleName} · ${dayjs(gateRecord.decidedAt).format('DD MMM YYYY, HH:mm')})`,
      };
    }
    return null;
  }, [gateRecord, prApprovalState]);

  if (!charter) return null;

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width="min(1280px, 92vw)"
        centered
        style={{
          maxWidth: '1280px',
          top: 0,
          paddingBottom: 0,
        }}
        styles={{
          content: {
            height: 'min(820px, 88vh)',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: 12,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          },
          header: {
            flex: '0 0 auto',
            padding: '12px 20px',
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
                <ApartmentOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                    PM Operational Plan Workspace
                  </span>
                  {gateRecord?.workflow?.current ? (
                    (() => {
                      const curr = gateRecord.workflow.current;
                      const isUnknown = curr.status === 'UNKNOWN' || gateRecord.workflow.businessStatus === 'UNKNOWN_WORKFLOW_STATE';
                      if (isUnknown) {
                        return (
                          <Tag color="error" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}>
                            STATUS WORKFLOW TIDAK DIKENALI
                          </Tag>
                        );
                      }
                      return (
                        <Space size={4}>
                          <Tag
                            color={getCanonicalStatusColor(curr.status).tagColor}
                            style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}
                          >
                            {curr.headerBadge || curr.label}
                          </Tag>
                          {curr.nodeKey === 'PM_PLANNING' && (
                            <Tag
                              color={isOperationalPlanAuthoritativeReady ? 'success' : completenessScore >= 2 ? 'processing' : 'warning'}
                              style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}
                            >
                              {isOperationalPlanAuthoritativeReady ? '4/4 READY' : `${completenessScore}/4 INCOMPLETE`}
                            </Tag>
                          )}
                        </Space>
                      );
                    })()
                  ) : (
                    // Legacy Fallback (ONLY if workflow instance does not exist)
                    gateRecord?.status === 'READY_FOR_KICKOFF' ? (
                      <Tag color="purple" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' }}>
                        READY FOR KICKOFF
                      </Tag>
                    ) : gateRecord?.status === 'REVIEW_FINANCE' ? (
                      <Tag color="cyan" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0, background: '#ecfeff', borderColor: '#a5f3fc', color: '#0e7490' }}>
                        Menunggu Review (Finance Team)
                      </Tag>
                    ) : gateRecord?.status === 'REVIEW_DIRECTOR' ? (
                      <Tag color="purple" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0, background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' }}>
                        Menunggu Persetujuan Director
                      </Tag>
                    ) : gateRecord?.status === 'READY_FOR_PROCUREMENT' ? (
                      <Tag color="gold" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}>
                        READY FOR PROCUREMENT — DISETUJUI HOPS
                      </Tag>
                    ) : gateRecord?.status === 'REVIEW_PENDING' ? (
                      <Tag color="processing" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}>
                        Menunggu Review (Head of Operations)
                      </Tag>
                    ) : gateRecord?.status === 'NEEDS_REVISION' ? (
                      <Tag color="error" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}>
                        NEEDS REVISION
                      </Tag>
                    ) : isOperationalPlanAuthoritativeReady ? (
                      <Tag color="success" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}>
                        4/4 READY — SIAP DIAJUKAN
                      </Tag>
                    ) : (
                      <Tag
                        color={completenessScore >= 2 ? 'processing' : 'warning'}
                        style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}
                      >
                        {completenessScore}/4 INCOMPLETE
                      </Tag>
                    )
                  )}
                  {!gateRecord?.workflow && !['READY_FOR_PROCUREMENT', 'READY_FOR_KICKOFF', 'REVIEW_PENDING', 'REVIEW_FINANCE', 'REVIEW_DIRECTOR', 'NEEDS_REVISION'].includes(gateRecord?.status || '') && (
                    <Tag color="default" style={{ fontWeight: 600, fontSize: 11, borderRadius: 4, margin: 0 }}>
                      DRAFT PM
                    </Tag>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                  Penyusunan menyeluruh: Estimasi Biaya (RAB), Struktur WBS, Penjadwalan, dan Kondisi Awal Proyek
                </Text>
              </div>
            </Space>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space size={8}>
              {lastSavedTime ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Draft tersimpan di browser: <strong>{lastSavedTime}</strong>
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Belum ada perubahan tersimpan
                </Text>
              )}
            </Space>
            <Space size={8}>
              <Button onClick={onClose} style={{ borderRadius: 6 }}>
                Tutup
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => {
                  if (canonicalProjectId > 0) {
                    fetchOperationalReadiness(canonicalProjectId);
                  }
                  setIsSummaryModalOpen(true);
                }}
                style={{ borderRadius: 6, fontWeight: 500 }}
              >
                Tinjau Ringkasan
              </Button>
              {/* ACTION: SIMPAN DRAFT (PM / SUPER_ADMIN ONLY) */}
              {showPmSubmitActions && (() => {
                if (gateRecord?.workflow) {
                  const curr = gateRecord.workflow.current;
                  const isUnknown = !curr || curr.status === 'UNKNOWN' || gateRecord.workflow.businessStatus === 'UNKNOWN_WORKFLOW_STATE';
                  if (isUnknown) {
                    return (
                      <Tooltip title="Status workflow tidak dikenali.">
                        <Button
                          type="default"
                          icon={<SaveOutlined />}
                          disabled={true}
                          style={{ borderRadius: 6, fontWeight: 600 }}
                        >
                          Simpan Draft
                        </Button>
                      </Tooltip>
                    );
                  }
                  if (isPmEditableWorkflowState(curr)) {
                    return (
                      <Button
                        type="default"
                        icon={<SaveOutlined />}
                        loading={isCostSaving || isWbsSaving || isScheduleSaving}
                        disabled={isCostSaving || isWbsSaving || isScheduleSaving}
                        onClick={() => handleSaveAllDrafts(true)}
                        style={{ borderRadius: 6, fontWeight: 600 }}
                      >
                        Simpan Draft
                      </Button>
                    );
                  }
                  return null;
                }

                // Legacy Fallback (ONLY if workflow instance does not exist)
                const isLegacyNonEditable = ['READY_FOR_PROCUREMENT', 'REVIEW_PENDING', 'REVIEW_FINANCE', 'REVIEW_DIRECTOR', 'READY_FOR_KICKOFF'].includes(gateRecord?.status || '');
                if (!isLegacyNonEditable) {
                  return (
                    <Button
                      type="default"
                      icon={<SaveOutlined />}
                      loading={isCostSaving || isWbsSaving || isScheduleSaving}
                      disabled={isCostSaving || isWbsSaving || isScheduleSaving}
                      onClick={() => handleSaveAllDrafts(true)}
                      style={{ borderRadius: 6, fontWeight: 600 }}
                    >
                      Simpan Draft
                    </Button>
                  );
                }
                return null;
              })()}

              {/* ACTION: AJUKAN UNTUK MANAGEMENT REVIEW (PM / SUPER_ADMIN ONLY) */}
              {showPmSubmitActions && (() => {
                if (gateRecord?.workflow) {
                  const curr = gateRecord.workflow.current;
                  const isUnknown = !curr || curr.status === 'UNKNOWN' || gateRecord.workflow.businessStatus === 'UNKNOWN_WORKFLOW_STATE';
                  if (isUnknown) {
                    return (
                      <Tooltip title="Status workflow tidak dikenali.">
                        <Button
                          type="primary"
                          icon={<RocketOutlined />}
                          disabled={true}
                          style={{ borderRadius: 6, fontWeight: 600 }}
                        >
                          Ajukan untuk Management Review
                        </Button>
                      </Tooltip>
                    );
                  }
                  if (curr.nodeKey === 'PM_REVISION') {
                    return (
                      <Tooltip title={readinessEvaluation.reviewSubmissionTooltip}>
                        <Button
                          type="primary"
                          icon={<RocketOutlined />}
                          disabled={!readinessEvaluation.canSubmitManagementReview}
                          onClick={() => setIsSubmitModalOpen(true)}
                          style={{
                            backgroundColor: readinessEvaluation.canSubmitManagementReview ? '#d97706' : undefined,
                            borderColor: readinessEvaluation.canSubmitManagementReview ? '#d97706' : undefined,
                            borderRadius: 6,
                            fontWeight: 600,
                          }}
                        >
                          Ajukan Ulang ke Management Review
                        </Button>
                      </Tooltip>
                    );
                  }
                  if (curr.nodeKey === 'PM_PLANNING') {
                    return (
                      <Tooltip title={readinessEvaluation.reviewSubmissionTooltip}>
                        <Button
                          type="primary"
                          icon={<RocketOutlined />}
                          disabled={!readinessEvaluation.canSubmitManagementReview}
                          onClick={() => setIsSubmitModalOpen(true)}
                          style={{
                            backgroundColor: readinessEvaluation.canSubmitManagementReview ? '#059669' : undefined,
                            borderColor: readinessEvaluation.canSubmitManagementReview ? '#059669' : undefined,
                            borderRadius: 6,
                            fontWeight: 600,
                          }}
                        >
                          Ajukan untuk Management Review
                        </Button>
                      </Tooltip>
                    );
                  }
                  // Non-PM-editable downstream or completed: Disabled with current position tooltip
                  return (
                    <Tooltip title={
                      curr.position
                        ? `Operational Plan sedang dalam proses: ${curr.position}`
                        : 'Operational Plan sedang ditinjau dalam alur Management Review.'
                    }>
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        disabled={true}
                        style={{ borderRadius: 6, fontWeight: 600 }}
                      >
                        Ajukan untuk Management Review
                      </Button>
                    </Tooltip>
                  );
                }

                // Legacy Fallback (ONLY if workflow instance does not exist)
                const isLegacyDownstream = ['REVIEW_PENDING', 'READY_FOR_PROCUREMENT', 'REVIEW_FINANCE', 'REVIEW_DIRECTOR', 'READY_FOR_KICKOFF'].includes(gateRecord?.status || '');
                if (isLegacyDownstream) {
                  return (
                    <Tooltip title="Operational Plan sedang ditinjau dalam alur Management Review.">
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        disabled={true}
                        style={{ borderRadius: 6, fontWeight: 600 }}
                      >
                        Ajukan untuk Management Review
                      </Button>
                    </Tooltip>
                  );
                }
                if (gateRecord?.status === 'NEEDS_REVISION') {
                  return (
                    <Tooltip title={readinessEvaluation.reviewSubmissionTooltip}>
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        disabled={!readinessEvaluation.canSubmitManagementReview}
                        onClick={() => setIsSubmitModalOpen(true)}
                        style={{
                          backgroundColor: readinessEvaluation.canSubmitManagementReview ? '#d97706' : undefined,
                          borderColor: readinessEvaluation.canSubmitManagementReview ? '#d97706' : undefined,
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        Ajukan Ulang ke Management Review
                      </Button>
                    </Tooltip>
                  );
                }
                return (
                  <Tooltip title={readinessEvaluation.reviewSubmissionTooltip}>
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      disabled={!readinessEvaluation.canSubmitManagementReview}
                      onClick={() => setIsSubmitModalOpen(true)}
                      style={{
                        backgroundColor: readinessEvaluation.canSubmitManagementReview ? '#059669' : undefined,
                        borderColor: readinessEvaluation.canSubmitManagementReview ? '#059669' : undefined,
                        borderRadius: 6,
                        fontWeight: 600,
                      }}
                    >
                      Ajukan untuk Management Review
                    </Button>
                  </Tooltip>
                );
              })()}
            </Space>
          </div>
        }
      >
        {/* FIXED PROJECT REFERENCE STRIP */}
        <div
          style={{
            flex: '0 0 auto',
            background: '#ffffff',
            padding: '10px 20px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <Row gutter={[16, 8]} align="middle">
            <Col xs={24} sm={6} md={5}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                Nama Proyek
              </Text>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {charter.project_name}
              </div>
            </Col>

            <Col xs={12} sm={6} md={5}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                Customer & Kontrak
              </Text>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {charter.customerName || 'PT Customer'} · <span style={{ color: '#2563eb' }}>{charter.project_code || `PRJ-${charter.id}`}</span>
              </div>
            </Col>

            <Col xs={12} sm={6} md={5}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                Nilai SPK Legal
              </Text>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                Rp {contractLegalValue.toLocaleString('id-ID')}
              </div>
            </Col>

            <Col xs={12} sm={6} md={5}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                Estimasi Budget Proyek
              </Text>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#059669', whiteSpace: 'nowrap' }}>
                Rp {marketingEstimate.toLocaleString('id-ID')}
              </div>
            </Col>
          </Row>
        </div>

        {/* REVIEW TRACKING / WORKFLOW TIMELINE (TOP LEVEL HIERARCHY) */}
        <div style={{ flex: '0 0 auto', padding: '10px 20px 0 20px', background: '#ffffff' }}>
          <ReviewTrackingTimeline
            gateRecord={gateRecord}
            projectId={canonicalProjectId}
            projectStatus={charter?.status || (charter as any)?.projectStatus || 'PLANNING'}
            prApprovalState={prApprovalState}
            completenessScore={completenessScore}
            isPmOnly={true}
            compact={true}
            showActivityHistory={false}
          />
        </div>

        {/* APPROVAL HISTORY — COMPACT ENTERPRISE SSOT-DRIVEN TIMELINE */}
        <div style={{ flex: '0 0 auto', padding: '6px 20px 0 20px', background: '#ffffff' }}>
          <div
            style={{
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 11.5,
              transition: 'all 0.2s ease',
            }}
          >
            {/* Header: Title, Subtitle, Last Approval Indicator & Collapse Icon (Entire Header Clickable) */}
            <div
              onClick={() => setIsApprovalHistoryExpanded((prev) => !prev)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
                cursor: 'pointer',
                userSelect: 'none',
                marginBottom: isApprovalHistoryExpanded ? 6 : 0,
              }}
              title={isApprovalHistoryExpanded ? 'Klik untuk menyembunyikan detail Approval History' : 'Klik untuk menampilkan detail Approval History'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <HistoryOutlined style={{ color: '#2563eb', fontSize: 12 }} />
                <span style={{ fontWeight: 700, fontSize: 11.5, color: '#1e293b' }}>
                  Approval History
                </span>
                <span style={{ fontSize: 10.5, color: '#64748b' }}>
                  — Riwayat keputusan &amp; alur persetujuan lintas divisi (PM → HOPS → Procurement → Finance → Director)
                </span>
              </div>

              {/* Last Approval Indicator & Expand/Collapse Icon */}
              <Space size={6}>
                {lastApprovalInfo ? (
                  <Tag color="success" style={{ fontWeight: 600, fontSize: 9.5, margin: 0, padding: '0 6px', borderRadius: 4 }}>
                    Last Approved: {lastApprovalInfo.text}
                  </Tag>
                ) : (
                  <Tag color="default" style={{ fontWeight: 500, fontSize: 9.5, margin: 0, padding: '0 6px', borderRadius: 4, color: '#64748b' }}>
                    Last Approved: Belum ada
                  </Tag>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: 10,
                  }}
                >
                  {isApprovalHistoryExpanded ? <UpOutlined /> : <DownOutlined />}
                </div>
              </Space>
            </div>

            {/* Content: Empty state vs Unified Events (Rendered only when expanded) */}
            {isApprovalHistoryExpanded && (
              unifiedApprovalEvents.length === 0 ? (
                <div
                  style={{
                    padding: '6px 10px',
                    background: '#ffffff',
                    borderRadius: 6,
                    border: '1px dashed #cbd5e1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 4,
                  }}
                >
                  <span style={{ color: '#475569', fontSize: 11, fontWeight: 500 }}>
                    Belum ada riwayat approval.
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 10.5 }}>
                    Riwayat akan muncul setelah Operational Plan diajukan atau mendapat keputusan.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {unifiedApprovalEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: ev.note ? 'flex-start' : 'center',
                        fontSize: 11,
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: ev.isPending ? '#faf5ff' : ev.statusTag.color === 'error' ? '#fef2f2' : '#ffffff',
                        border: `1px solid ${ev.isPending ? '#e9d5ff' : ev.statusTag.color === 'error' ? '#fecaca' : '#e2e8f0'}`,
                        flexWrap: 'wrap',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Tag color={ev.statusTag.color} style={{ fontWeight: 700, fontSize: 9, margin: 0, padding: '0 5px', lineHeight: '16px' }}>
                            {ev.statusTag.label}
                          </Tag>
                          <span style={{ color: ev.isPending ? '#6b21a8' : '#1e293b', fontWeight: 600 }}>
                            {ev.actor}
                          </span>
                          <span style={{ color: '#94a3b8' }}>•</span>
                          <span style={{ color: '#64748b', fontSize: 10.5 }}>{ev.role}</span>
                          <Tag color="default" style={{ fontSize: 8.5, fontWeight: 600, margin: 0, padding: '0 4px', lineHeight: '14px', background: '#f1f5f9' }}>
                            {ev.stageLabel}
                          </Tag>
                          {ev.isLastAction && (
                            <Tag color="success" style={{ fontSize: 8.5, fontWeight: 700, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                              Last Action
                            </Tag>
                          )}
                          {ev.isPending && (
                            <Tag color="purple" style={{ fontSize: 8.5, fontWeight: 700, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                              Current Task
                            </Tag>
                          )}
                        </div>
                        {ev.note && (
                          <div style={{ fontSize: 10.5, color: ev.isPending ? '#7e22ce' : ev.statusTag.color === 'error' ? '#991b1b' : '#047857', fontStyle: 'italic', paddingLeft: 4 }}>
                            {ev.note}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: ev.isPending ? '#7e22ce' : '#64748b', whiteSpace: 'nowrap', fontWeight: ev.isPending ? 600 : 400 }}>
                        {ev.formattedTime}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* WORKSPACE FLEX CONTAINER: FIXED LEFT PANEL + SCROLLABLE RIGHT VIEWPORT */}
        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT: FIXED COMPLETENESS PANEL */}
          <div
            style={{
              flex: '0 0 230px',
              width: 230,
              minWidth: 230,
              maxWidth: 230,
              borderRight: '1px solid #e2e8f0',
              background: '#ffffff',
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 }}>
              <Space size={6}>
                <AuditOutlined style={{ color: '#1d4ed8', fontSize: 13 }} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>Kelengkapan</span>
              </Space>
              <Tag
                color={
                  isReadinessLoading && !operationalReadinessData
                    ? 'default'
                    : isOperationalPlanAuthoritativeReady
                    ? 'success'
                    : completenessScore > 0
                    ? 'warning'
                    : 'default'
                }
                style={{ fontWeight: 700, margin: 0, fontSize: 10 }}
              >
                {isReadinessLoading && !operationalReadinessData
                  ? 'MEMUAT...'
                  : isOperationalPlanAuthoritativeReady
                  ? '4/4 READY'
                  : completenessScore > 0
                  ? `${completenessScore}/4 INCOMPLETE`
                  : '0/4 NOT READY'}
              </Tag>
            </div>

            {/* Step 1: Cost */}
            <div
              onClick={() => {
                if (maximizedSection && maximizedSection !== 'cost') {
                  setMaximizedSection('cost');
                }
                setMinimizedSections((p) => ({ ...p, cost: false }));
                document.getElementById('section-cost')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: maximizedSection === 'cost' || (!maximizedSection && !minimizedSections.cost) ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${maximizedSection === 'cost' || (!maximizedSection && !minimizedSections.cost) ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11.5, color: '#1e293b' }}>
                  1. Cost / RAB
                </Text>
                {isCostReady ? (
                  <Tag color="success" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    SIAP
                  </Tag>
                ) : isCostLocalDraft ? (
                  <Tag color="warning" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    ○ DRAFT LOKAL
                  </Tag>
                ) : hasCostInput && !isCostMappingValid ? (
                  <Tag color="error" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    ○ INCOMPLETE
                  </Tag>
                ) : (
                  <Tag color="default" style={{ margin: 0, fontSize: 9 }}>
                    ○ DRAFT
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: isCostReady ? '#059669' : isCostLocalDraft ? '#b45309' : hasCostInput && !isCostMappingValid ? '#dc2626' : '#64748b', marginTop: 3 }}>
                {hasCostInput && !isCostMappingValid
                  ? 'Mapping WBS belum lengkap'
                  : isCostComplete
                  ? `Rp ${(totalPmEstimate / 1000000).toFixed(1)}Jt (${estimatedMarginPercentage.toFixed(1)}%)`
                  : 'Belum ada rincian'}
              </div>
            </div>

            {/* Step 2: WBS */}
            <div
              onClick={() => {
                if (maximizedSection && maximizedSection !== 'wbs') {
                  setMaximizedSection('wbs');
                }
                setMinimizedSections((p) => ({ ...p, wbs: false }));
                document.getElementById('section-wbs')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: maximizedSection === 'wbs' || (!maximizedSection && !minimizedSections.wbs) ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${maximizedSection === 'wbs' || (!maximizedSection && !minimizedSections.wbs) ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11.5, color: '#1e293b' }}>
                  2. WBS Structure
                </Text>
                {isWbsReady ? (
                  <Tag color="success" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    SIAP
                  </Tag>
                ) : isWbsLocalDraft ? (
                  <Tag color="warning" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    ○ DRAFT LOKAL
                  </Tag>
                ) : (
                  <Tag color="warning" style={{ margin: 0, fontSize: 9 }}>
                    ○ {wbsData.length === 0 ? 'KOSONG' : `${rootWeightSum.toFixed(0)}%`}
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: isWbsReady ? '#059669' : '#b45309', marginTop: 3 }}>
                {wbsData.length > 0
                  ? `${wbsData.length} Pkg • ${wbsStructureMetrics.leafDeliverableCount} Leaf (${wbsStructureMetrics.isFlat ? 'Flat' : `L${wbsStructureMetrics.maxHierarchyDepth}`})`
                  : 'Belum ada WBS'}
              </div>
            </div>

            {/* Step 3: Schedule */}
            <div
              onClick={() => {
                if (maximizedSection && maximizedSection !== 'schedule') {
                  setMaximizedSection('schedule');
                }
                setMinimizedSections((p) => ({ ...p, schedule: false }));
                document.getElementById('section-schedule')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: maximizedSection === 'schedule' || (!maximizedSection && !minimizedSections.schedule) ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${maximizedSection === 'schedule' || (!maximizedSection && !minimizedSections.schedule) ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11.5, color: '#1e293b' }}>
                  3. Schedule & Gantt
                </Text>
                {isScheduleReady ? (
                  <Tag color="success" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    SIAP
                  </Tag>
                ) : isScheduleLocalDraft ? (
                  <Tag color="warning" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    ○ DRAFT LOKAL
                  </Tag>
                ) : scheduledTasksCount > 0 ? (
                  <Tag color="processing" style={{ margin: 0, fontSize: 9 }}>
                    ○ {scheduledTasksCount}/{leafNodesCount}
                  </Tag>
                ) : (
                  <Tag color="default" style={{ margin: 0, fontSize: 9 }}>
                    ○ DRAFT
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: isScheduleReady ? '#059669' : isScheduleLocalDraft ? '#b45309' : '#64748b', marginTop: 3 }}>
                {leafNodesCount > 0
                  ? `${scheduledTasksCount}/${leafNodesCount} Terjadwal`
                  : 'Menunggu WBS'}
              </div>
            </div>

            {/* Step 4: Initial Condition */}
            <div
              onClick={() => {
                if (maximizedSection && maximizedSection !== 'initialCondition') {
                  setMaximizedSection('initialCondition');
                }
                setMinimizedSections((p) => ({ ...p, initialCondition: false }));
                document.getElementById('section-initial-condition')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: maximizedSection === 'initialCondition' || (!maximizedSection && !minimizedSections.initialCondition) ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${maximizedSection === 'initialCondition' || (!maximizedSection && !minimizedSections.initialCondition) ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11.5, color: '#1e293b' }}>
                  4. Kondisi Awal Proyek
                </Text>
                {isConditionReady ? (
                  <Tag color="success" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    SIAP
                  </Tag>
                ) : isConditionLocalDraft ? (
                  <Tag color="warning" style={{ margin: 0, fontSize: 9, fontWeight: 700 }}>
                    ○ DRAFT LOKAL
                  </Tag>
                ) : initialCondition?.conditionStatus ? (
                  <Tag color="warning" style={{ margin: 0, fontSize: 9 }}>
                    ○ DRAFT
                  </Tag>
                ) : (
                  <Tag color="default" style={{ margin: 0, fontSize: 9 }}>
                    ○ KOSONG
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: isConditionReady ? (initialCondition?.conditionStatus === 'NORMAL' ? '#059669' : initialCondition?.conditionStatus === 'PERLU_PERHATIAN' ? '#b45309' : '#dc2626') : isConditionLocalDraft ? '#b45309' : '#64748b', marginTop: 3 }}>
                {isConditionComplete
                  ? `Status: ${initialCondition?.conditionStatus === 'NORMAL' ? 'Normal' : initialCondition?.conditionStatus === 'PERLU_PERHATIAN' ? 'Perlu Perhatian' : 'Berisiko'}`
                  : 'Belum ada baseline'}
              </div>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            {/* Readiness Progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                <Text type="secondary">Kesiapan:</Text>
                <Text strong style={{ color: isOperationalPlanAuthoritativeReady ? '#15803d' : '#1d4ed8' }}>
                  {((completenessScore / 4) * 100).toFixed(0)}%
                </Text>
              </div>
              <Progress
                percent={Number(((completenessScore / 4) * 100).toFixed(0))}
                size="small"
                status={isOperationalPlanAuthoritativeReady ? 'success' : 'active'}
                strokeColor={isOperationalPlanAuthoritativeReady ? '#10b981' : '#3b82f6'}
              />
            </div>
          </div>

          {/* RIGHT: MAIN VIEWPORT (Stacked Minimize/Maximize Sections) */}
          <div
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: '#f8fafc',
            }}
          >
            {/* WORKSPACE VIEWPORT CONTAINER */}
            <div
              style={{
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: maximizedSection ? 'hidden' : 'auto',
                overflowX: 'hidden',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* ========================================================================= */}
              {/* SECTION 1: COST ESTIMATE / RAB                                            */}
              {/* ========================================================================= */}
              {(() => {
                const isCostMaximized = maximizedSection === 'cost';
                const isCostMinimized = !isCostMaximized && (maximizedSection !== null || minimizedSections.cost);

                if (isCostMinimized) {
                  return (
                    <Card
                      id="section-cost"
                      size="small"
                      style={{
                        flex: '0 0 auto',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      bodyStyle={{ padding: '8px 14px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Space size={8} wrap>
                          <DollarOutlined style={{ color: '#1d4ed8', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>1. Cost Estimate / RAB</span>
                          {isCostReady ? (
                            <Tag color="success" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>Siap</Tag>
                          ) : isCostLocalDraft ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>○ Draft Lokal</Tag>
                          ) : (
                            <Tag color="default" style={{ margin: 0, fontSize: 10.5 }}>○ Draft</Tag>
                          )}
                          <Divider type="vertical" style={{ margin: '0 4px' }} />
                          <Text strong style={{ fontSize: 12.5, color: '#1d4ed8' }}>
                            Rp {totalPmEstimate.toLocaleString('id-ID')}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text strong style={{ fontSize: 12, color: estimatedMarginNominal >= 0 ? '#15803d' : '#dc2626' }}>
                            Margin {estimatedMarginPercentage.toFixed(1)}%
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text type="secondary" style={{ fontSize: 11.5 }}>
                            Deviasi {varianceNominal >= 0 ? '+' : ''}Rp {varianceNominal.toLocaleString('id-ID')} ({variancePercentage.toFixed(1)}%)
                          </Text>
                        </Space>

                        <Space size={4}>
                          <Tooltip title="Expand Cost Estimate">
                            <Button
                              size="small"
                              type="text"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setMaximizedSection(null);
                                setMinimizedSections((p) => ({ ...p, cost: false }));
                              }}
                              aria-label="Minimize Cost Estimate"
                            />
                          </Tooltip>
                          <Tooltip title="Maximize Cost Estimate">
                            <Button
                              size="small"
                              type="text"
                              icon={<FullscreenOutlined />}
                              onClick={() => setMaximizedSection('cost')}
                              aria-label="Maximize Cost Estimate"
                            />
                          </Tooltip>
                        </Space>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    id="section-cost"
                    size="small"
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={8}>
                          <DollarOutlined style={{ color: '#1d4ed8', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>1. Cost Estimate / RAB (Penyusunan Rincian Biaya Proyek)</span>
                          {isCostReady && <CheckCircleOutlined style={{ color: '#10b981', fontSize: 13 }} />}
                          {isCostServerSynced && (
                            <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● SERVER: Database SSOT
                            </Tag>
                          )}
                          {(!isCostServerSynced && hasCostInput) && (
                            <Tag color="warning" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● DRAF LOKAL: Belum Disimpan ke Server
                            </Tag>
                          )}
                          {isCostSaving && (
                            <Tag color="processing" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● Menyimpan ke Server...
                            </Tag>
                          )}
                        </Space>

                        <Space size={6}>
                          {isCostMaximized ? (
                            <Button
                              size="small"
                              icon={<FullscreenExitOutlined />}
                              onClick={() => setMaximizedSection(null)}
                              aria-label="Kembali ke Normal"
                              style={{ fontWeight: 600, color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
                            >
                              ↙ Kembali
                            </Button>
                          ) : (
                            <>
                              <Tooltip title="Minimize Cost Estimate">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<MinusOutlined />}
                                  onClick={() => setMinimizedSections((p) => ({ ...p, cost: true }))}
                                  aria-label="Minimize Cost Estimate"
                                />
                              </Tooltip>
                              <Tooltip title="Maximize Cost Estimate">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<FullscreenOutlined />}
                                  onClick={() => setMaximizedSection('cost')}
                                  aria-label="Maximize Cost Estimate"
                                />
                              </Tooltip>
                            </>
                          )}
                        </Space>
                      </div>
                    }
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      ...(isCostMaximized ? { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } : { flex: '0 0 auto' }),
                    }}
                    bodyStyle={{
                      padding: '12px 14px',
                      ...(isCostMaximized ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } : {}),
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Cost KPI Summary Cards */}
                      <Row gutter={[10, 10]}>
                        <Col xs={24} sm={8}>
                          <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>TOTAL ESTIMASI BIAYA PM</Text>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                              Rp {totalPmEstimate.toLocaleString('id-ID')}
                            </div>
                          </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>DEVIASI VS BUDGET MARKETING</Text>
                            <div style={{ fontSize: 16, fontWeight: 700, color: varianceNominal > 0 ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>
                              {varianceNominal >= 0 ? '+' : ''}Rp {varianceNominal.toLocaleString('id-ID')} ({variancePercentage.toFixed(1)}%)
                            </div>
                          </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: estimatedMarginNominal >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>ESTIMASI MARGIN PROYEK</Text>
                            <div style={{ fontSize: 16, fontWeight: 800, color: estimatedMarginNominal >= 0 ? '#15803d' : '#b91c1c', whiteSpace: 'nowrap' }}>
                              Rp {estimatedMarginNominal.toLocaleString('id-ID')} ({estimatedMarginPercentage.toFixed(1)}%)
                            </div>
                          </Card>
                        </Col>
                      </Row>

                      {/* COST <-> WBS RECONCILIATION SUMMARY STRIP */}
                      <div
                        style={{
                          background: costWbsReconciliation.unassignedItemsCount === 0 && costWbsReconciliation.orphanedItemsCount === 0 && costWbsReconciliation.totalItemizedItems > 0
                            ? '#f0fdf4'
                            : '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: `1px solid ${costWbsReconciliation.unassignedItemsCount === 0 && costWbsReconciliation.orphanedItemsCount === 0 && costWbsReconciliation.totalItemizedItems > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <Space size={8} wrap>
                          <ApartmentOutlined style={{ color: '#0284c7', fontSize: 14 }} />
                          <Tooltip title="Setiap item biaya dapat dipetakan ke pekerjaan WBS tertentu atau dialokasikan sebagai biaya Project-Level (keseluruhan proyek).">
                            <Text strong style={{ fontSize: 11.5, color: '#0f172a', cursor: 'help' }}>
                              Pemetaan Cost:
                            </Text>
                          </Tooltip>
                          {costWbsReconciliation.totalItemizedItems === 0 ? (
                            <Text type="secondary" style={{ fontSize: 11 }}>Belum ada rincian item biaya</Text>
                          ) : costWbsReconciliation.unassignedItemsCount === 0 && costWbsReconciliation.orphanedItemsCount === 0 ? (
                            <Tag color="success" style={{ fontSize: 10.5, margin: 0 }}>
                              Semua item biaya sudah dipetakan ({costWbsReconciliation.mappedItemsCount} WBS • {costWbsReconciliation.projectLevelItemsCount} Project-Level)
                            </Tag>
                          ) : (
                            <Tag color="warning" style={{ fontSize: 10.5, margin: 0 }}>
                              {costWbsReconciliation.unassignedItemsCount} item biaya belum ditentukan
                            </Tag>
                          )}
                          {costWbsReconciliation.orphanedItemsCount > 0 && (
                            <Tag color="error" style={{ fontSize: 10.5, margin: 0 }}>
                              {costWbsReconciliation.orphanedItemsCount} WBS Dihapus
                            </Tag>
                          )}
                        </Space>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 11, color: '#334155' }}>
                            Terpetakan ke WBS: <strong style={{ color: '#0284c7' }}>Rp {costWbsReconciliation.totalAllocatedCost.toLocaleString('id-ID')}</strong>
                          </Text>
                          <Text style={{ fontSize: 11, color: '#475569' }}>
                            Project-Level / Direct: <strong style={{ color: '#7c3aed' }}>Rp {(costWbsReconciliation.totalProjectLevelCost + costWbsReconciliation.directModeCost).toLocaleString('id-ID')}</strong>
                          </Text>
                          {costWbsReconciliation.totalUnallocatedCost > 0 && (
                            <Text style={{ fontSize: 11, color: '#b45309' }}>
                              Belum Ditentukan: <strong style={{ color: '#d97706' }}>Rp {costWbsReconciliation.totalUnallocatedCost.toLocaleString('id-ID')}</strong>
                            </Text>
                          )}
                        </div>
                      </div>

                      {!isCostMappingValid && costValidationResult.error && (
                        <Alert
                          type="error"
                          showIcon
                          style={{ borderRadius: 6 }}
                          message="Pemetaan WBS Belum Lengkap"
                          description={costValidationResult.error}
                        />
                      )}

                      {/* 3 LOGICAL COST GROUPS */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {COST_GROUP_CONFIGS.map((grp) => {
                          const groupCategories = costCategories.filter((c) => grp.categoryKeys.includes(c.categoryKey));
                          const grpTotal = groupCategories.reduce((sum, c) => sum + (c.categoryTotal || 0), 0);

                          return (
                            <div
                              key={grp.key}
                              style={{
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                padding: '8px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              {/* Group Header Strip */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                                <Space size={6}>
                                  <Text strong style={{ fontSize: 12.5, color: grp.key === 'DIRECT' ? '#1d4ed8' : grp.key === 'INDIRECT' ? '#0369a1' : '#b45309' }}>
                                    {grp.label}
                                  </Text>
                                  <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
                                    {groupCategories.length} Kategori
                                  </Tag>
                                </Space>
                                <Text strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                                  Subtotal: Rp {grpTotal.toLocaleString('id-ID')}
                                </Text>
                              </div>

                              {/* Categories inside group */}
                              {groupCategories.map((cat, catIdx) => (
                                <Card
                                  key={cat.categoryKey}
                                  size="small"
                                  style={{
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                  }}
                                  bodyStyle={{ padding: '8px 10px' }}
                                  title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                      <Space size={6}>
                                        <Tag color="blue" style={{ fontSize: 10.5, fontWeight: 700, margin: 0 }}>
                                          {catIdx + 1}
                                        </Tag>
                                        <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                                          {cat.categoryLabel}
                                        </Text>
                                      </Space>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Radio.Group
                                          size="small"
                                          value={cat.mode}
                                          onChange={(e) => handleModeChange(cat.categoryKey, e.target.value)}
                                          optionType="button"
                                          buttonStyle="solid"
                                        >
                                          <Radio.Button value="ITEMIZED" style={{ fontSize: 11 }}>Rincian Item</Radio.Button>
                                          <Radio.Button value="DIRECT" style={{ fontSize: 11 }}>Nominal Langsung</Radio.Button>
                                        </Radio.Group>
                                        <Text strong style={{ fontSize: 12, color: '#1d4ed8', minWidth: 100, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                          Rp {(cat.categoryTotal || 0).toLocaleString('id-ID')}
                                        </Text>
                                      </div>
                                    </div>
                                  }
                                >
                                  {cat.mode === 'DIRECT' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
                                      <Text type="secondary" style={{ fontSize: 11.5 }}>
                                        Estimasi Nominal:
                                      </Text>
                                      <InputNumber
                                        size="small"
                                        style={{ width: 220 }}
                                        prefix="Rp"
                                        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                        parser={(value) => (value ? Number(value.replace(/\./g, '')) : 0)}
                                        value={cat.directSubtotal}
                                        onChange={(val) => handleDirectSubtotalChange(cat.categoryKey, val)}
                                        placeholder="0"
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      {cat.items.length === 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 4, border: '1px dashed #e2e8f0' }}>
                                          <Text type="secondary" style={{ fontSize: 11.5 }}>Belum ada rincian item estimasi.</Text>
                                          <Button
                                            size="small"
                                            type="link"
                                            icon={<PlusOutlined />}
                                            onClick={() => handleAddItem(cat.categoryKey)}
                                            style={{ fontSize: 11.5, padding: 0 }}
                                          >
                                            Tambah Item
                                          </Button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                          {cat.items.map((item, idx) => {
                                            const isExpanded = !!expandedCostItemIds[item.id];
                                            const effectiveScope: CostAssignmentScope =
                                              item.assignmentScope || (item.wbsNodeId ? 'WBS' : 'UNASSIGNED');
                                            const isWbsScope = effectiveScope === 'WBS';
                                            const isMissingWbs = isWbsScope && (!item.wbsNodeId || String(item.wbsNodeId).trim() === '');
                                            const isMapped = isWbsScope && !!item.wbsNodeId && wbsLeafMap.has(String(item.wbsNodeId));
                                            const isOrphaned = isWbsScope && !!item.wbsNodeId && !wbsLeafMap.has(String(item.wbsNodeId));
                                            const hasWbsError = isMissingWbs || isOrphaned;

                                            return (
                                              <div
                                                key={item.id}
                                                style={{
                                                  background: hasWbsError ? '#fff8f8' : '#f8fafc',
                                                  padding: '5px 8px',
                                                  borderRadius: 6,
                                                  border: `1px solid ${hasWbsError ? '#fca5a5' : isMapped ? '#cbd5e1' : '#e2e8f0'}`,
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  gap: 4,
                                                }}
                                              >
                                                {/* Primary Compact Row */}
                                                <Row gutter={6} align="middle">
                                                  <Col span={8}>
                                                    <Input
                                                      size="small"
                                                      placeholder={`Nama Item #${idx + 1}`}
                                                      value={item.itemName}
                                                      onChange={(e) => handleItemChange(cat.categoryKey, item.id, 'itemName', e.target.value)}
                                                      style={{ fontSize: 12 }}
                                                    />
                                                  </Col>
                                                  <Col span={3}>
                                                    <InputNumber
                                                      size="small"
                                                      style={{ width: '100%', fontSize: 12 }}
                                                      min={0}
                                                      value={item.quantity}
                                                      onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'quantity', val)}
                                                      placeholder="Qty"
                                                    />
                                                  </Col>
                                                  <Col span={3}>
                                                    <Select
                                                      size="small"
                                                      style={{ width: '100%', fontSize: 11.5 }}
                                                      value={item.uom}
                                                      onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'uom', val)}
                                                      options={COMMON_UOMS.map((u) => ({ label: u, value: u }))}
                                                    />
                                                  </Col>
                                                  <Col span={4}>
                                                    <InputNumber
                                                      size="small"
                                                      style={{ width: '100%', fontSize: 12 }}
                                                      prefix="Rp"
                                                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                                      parser={(value) => (value ? Number(value.replace(/\./g, '')) : 0)}
                                                      value={item.unitPrice}
                                                      onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'unitPrice', val)}
                                                      placeholder="Harga Satuan"
                                                    />
                                                  </Col>
                                                  <Col span={3} style={{ textAlign: 'right' }}>
                                                    <Text strong style={{ fontSize: 11.5, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                                                      Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                                                    </Text>
                                                  </Col>
                                                  <Col span={2} style={{ textAlign: 'center' }}>
                                                    <Button
                                                      size="small"
                                                      type="link"
                                                      icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                                      onClick={() => toggleCostItemExpansion(item.id)}
                                                      style={{
                                                        fontSize: 11,
                                                        padding: '0 4px',
                                                        color: hasWbsError ? '#dc2626' : isMapped ? '#059669' : '#64748b',
                                                        fontWeight: hasWbsError ? 700 : 400,
                                                      }}
                                                    >
                                                      {isMapped || isOrphaned || isMissingWbs ? 'WBS' : 'Detail'}
                                                    </Button>
                                                  </Col>
                                                  <Col span={1} style={{ textAlign: 'center' }}>
                                                    <Button
                                                      size="small"
                                                      type="text"
                                                      danger
                                                      icon={<DeleteOutlined />}
                                                      onClick={() => handleRemoveItem(cat.categoryKey, item.id)}
                                                      style={{ padding: 0 }}
                                                    />
                                                  </Col>
                                                </Row>

                                                {/* Inline Collapsible Secondary Metadata with WBS Picker */}
                                                {isExpanded && (
                                                  <div
                                                    style={{
                                                      marginTop: 4,
                                                      padding: '8px 10px',
                                                      background: '#ffffff',
                                                      borderRadius: 4,
                                                      border: '1px solid #cbd5e1',
                                                      display: 'flex',
                                                      flexDirection: 'column',
                                                      gap: 6,
                                                    }}
                                                  >
                                                    {/* Row 1: Resource Type, Cost Source, Rate Type */}
                                                    <Row gutter={8} align="middle">
                                                      <Col span={8}>
                                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                          Tipe Sumber Daya:
                                                        </Text>
                                                        <Select
                                                          size="small"
                                                          allowClear
                                                          placeholder="Pilih Sumber Daya"
                                                          value={item.resourceType}
                                                          onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'resourceType', val)}
                                                          options={RESOURCE_TYPE_OPTIONS}
                                                          style={{ width: '100%', fontSize: 11 }}
                                                        />
                                                      </Col>
                                                      <Col span={8}>
                                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                          Sumber Harga:
                                                        </Text>
                                                        <Select
                                                          size="small"
                                                          allowClear
                                                          placeholder="Pilih Sumber Harga"
                                                          value={item.costSource || 'PM_ESTIMATE'}
                                                          onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'costSource', val)}
                                                          options={COST_SOURCE_OPTIONS}
                                                          style={{ width: '100%', fontSize: 11 }}
                                                        />
                                                      </Col>
                                                      <Col span={8}>
                                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                          Tipe Tarif:
                                                        </Text>
                                                        <Select
                                                          size="small"
                                                          allowClear
                                                          placeholder="Pilih Tipe Tarif"
                                                          value={item.rateType || 'UNIT_RATE'}
                                                          onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'rateType', val)}
                                                          options={RATE_TYPE_OPTIONS}
                                                          style={{ width: '100%', fontSize: 11 }}
                                                        />
                                                      </Col>
                                                    </Row>

                                                    {/* Row 2: Cost Assignment Scope & Target */}
                                                    <Row gutter={8} align="middle">
                                                      <Col span={8}>
                                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                          Scope Pemetaan Biaya:
                                                        </Text>
                                                        <Select
                                                          size="small"
                                                          value={effectiveScope}
                                                          onChange={(val: CostAssignmentScope) => handleItemChange(cat.categoryKey, item.id, 'assignmentScope', val)}
                                                          options={[
                                                            { label: 'Pekerjaan WBS', value: 'WBS' },
                                                            { label: 'Project-Level', value: 'PROJECT' },
                                                            { label: 'Belum Ditentukan', value: 'UNASSIGNED' },
                                                          ]}
                                                          style={{ width: '100%', fontSize: 11 }}
                                                        />
                                                      </Col>
                                                      <Col span={10}>
                                                        {isWbsScope ? (
                                                          <div>
                                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>* </span>
                                                              Pilih Pekerjaan WBS <span style={{ color: '#ef4444', fontSize: 9 }}>(Wajib)</span>:
                                                            </Text>
                                                            {wbsData.length === 0 ? (
                                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '3px 8px', borderRadius: 4, border: '1px dashed #cbd5e1' }}>
                                                                <Text type="secondary" style={{ fontSize: 10.5 }}>Belum ada struktur WBS.</Text>
                                                                <Button
                                                                  size="small"
                                                                  type="link"
                                                                  onClick={() => {
                                                                    if (maximizedSection === 'cost') setMaximizedSection('wbs');
                                                                    setMinimizedSections((p) => ({ ...p, wbs: false }));
                                                                    document.getElementById('section-wbs')?.scrollIntoView({ behavior: 'smooth' });
                                                                  }}
                                                                  style={{ fontSize: 10.5, padding: 0 }}
                                                                >
                                                                  + Susun WBS
                                                                </Button>
                                                              </div>
                                                            ) : (
                                                              <Select
                                                                size="small"
                                                                allowClear
                                                                showSearch
                                                                placeholder="Pilih pekerjaan WBS (Wajib)..."
                                                                value={item.wbsNodeId ? String(item.wbsNodeId) : undefined}
                                                                onChange={(val) => handleItemChange(cat.categoryKey, item.id, 'wbsNodeId', val)}
                                                                filterOption={(input, option) =>
                                                                  ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                                                                }
                                                                options={wbsSelectOptions}
                                                                style={{ width: '100%', fontSize: 11 }}
                                                                status={hasWbsError ? 'error' : undefined}
                                                              />
                                                            )}
                                                          </div>
                                                        ) : effectiveScope === 'PROJECT' ? (
                                                          <div>
                                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                              Keterangan Scope:
                                                            </Text>
                                                            <Text style={{ fontSize: 10.5, color: '#6b21a8' }}>
                                                              Biaya berlaku untuk keseluruhan project.
                                                            </Text>
                                                          </div>
                                                        ) : (
                                                          <div>
                                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                              Keterangan Scope:
                                                            </Text>
                                                            <Text type="secondary" style={{ fontSize: 10.5, fontStyle: 'italic' }}>
                                                              Belum ditentukan WBS / Project-Level.
                                                            </Text>
                                                          </div>
                                                        )}
                                                      </Col>
                                                      <Col span={6}>
                                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>
                                                          Status Pemetaan:
                                                        </Text>
                                                        {effectiveScope === 'PROJECT' ? (
                                                          <Tag color="purple" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                                                            ● Project-Level
                                                          </Tag>
                                                        ) : isWbsScope ? (
                                                          !item.wbsNodeId ? (
                                                            <Tag color="error" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                                                              Wajib Pilih WBS
                                                            </Tag>
                                                          ) : isMapped ? (
                                                            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
                                                              {wbsLeafMap.get(String(item.wbsNodeId))?.code} · {wbsLeafMap.get(String(item.wbsNodeId))?.name}
                                                            </Tag>
                                                          ) : (
                                                            <Tag color="error" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                                                              WBS Dihapus / Remap Diperlukan
                                                            </Tag>
                                                          )
                                                        ) : (
                                                          <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>
                                                            Belum Ditentukan
                                                          </Tag>
                                                        )}
                                                      </Col>
                                                    </Row>

                                                    {/* Row 3: Notes / Technical Specs */}
                                                    <Row gutter={8} align="middle">
                                                      <Col span={24}>
                                                        <Input
                                                          size="small"
                                                          placeholder="Catatan / spesifikasi teknis item (opsional)..."
                                                          value={item.notes}
                                                          onChange={(e) => handleItemChange(cat.categoryKey, item.id, 'notes', e.target.value)}
                                                          style={{ fontSize: 11 }}
                                                        />
                                                      </Col>
                                                    </Row>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                          <div style={{ marginTop: 2 }}>
                                            <Button
                                              size="small"
                                              type="dashed"
                                              icon={<PlusOutlined />}
                                              onClick={() => handleAddItem(cat.categoryKey)}
                                              style={{ width: '100%', fontSize: 11 }}
                                            >
                                              Tambah Baris Item
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* WBS COST ALLOCATION BREAKDOWN (DERIVED SUMMARY) */}
                      {(costWbsReconciliation.wbsCostList.length > 0 || costWbsReconciliation.totalProjectLevelCost > 0) && (
                        <Card
                          size="small"
                          title={
                            <Space size={6}>
                              <ApartmentOutlined style={{ color: '#0284c7' }} />
                              <span style={{ fontWeight: 600, fontSize: 12 }}>Ringkasan Pemetaan Biaya per WBS Deliverable & Project-Level</span>
                            </Space>
                          }
                          style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}
                          bodyStyle={{ padding: '8px 12px' }}
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

                      {/* PM Notes */}
                      <div style={{ marginTop: 4 }}>
                        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                          Catatan Operasional & Asumsi Teknis PM:
                        </Text>
                        <TextArea
                          rows={2}
                          placeholder="Tuliskan catatan pertimbangan teknis, asumsi lapangan, mitigasi risiko..."
                          value={pmNotes}
                          onChange={(e) => setPmNotes(e.target.value)}
                          maxLength={500}
                          showCount
                        />
                      </div>
                    </div>
                  </Card>
                );
              })()}

              {/* ========================================================================= */}
              {/* SECTION 2: WORK BREAKDOWN STRUCTURE (WBS)                                 */}
              {/* ========================================================================= */}
              {(() => {
                const isWbsMaximized = maximizedSection === 'wbs';
                const isWbsMinimized = !isWbsMaximized && (maximizedSection !== null || minimizedSections.wbs);

                if (isWbsMinimized) {
                  return (
                    <Card
                      id="section-wbs"
                      size="small"
                      style={{
                        flex: '0 0 auto',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      bodyStyle={{ padding: '8px 14px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Space size={8} wrap>
                          <ApartmentOutlined style={{ color: '#0284c7', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>2. Work Breakdown Structure (WBS)</span>
                          {isWbsReady ? (
                            <Tag color="success" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>Siap (100%)</Tag>
                          ) : isWbsLocalDraft ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>○ Draft Lokal (100%)</Tag>
                          ) : (
                            <Tag color="warning" style={{ margin: 0, fontSize: 10.5 }}>○ {rootWeightSum.toFixed(0)}%</Tag>
                          )}
                          <Divider type="vertical" style={{ margin: '0 4px' }} />
                          <Text strong style={{ fontSize: 12.5, color: '#0284c7' }}>
                            {wbsData.length} Work Package
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                            {wbsStructureMetrics.leafDeliverableCount} Deliverables
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text strong style={{ fontSize: 12, color: isWbsWeightValid ? '#15803d' : '#b45309' }}>
                            Bobot {rootWeightSum.toFixed(1)}%
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text type="secondary" style={{ fontSize: 11.5 }}>
                            {wbsStructureMetrics.isStructured ? `Struktur L${wbsStructureMetrics.maxHierarchyDepth}` : 'Struktur Flat (L1)'}
                          </Text>
                        </Space>

                        <Space size={4}>
                          <Tooltip title="Expand WBS">
                            <Button
                              size="small"
                              type="text"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setMaximizedSection(null);
                                setMinimizedSections((p) => ({ ...p, wbs: false }));
                              }}
                              aria-label="Minimize WBS"
                            />
                          </Tooltip>
                          <Tooltip title="Maximize WBS">
                            <Button
                              size="small"
                              type="text"
                              icon={<FullscreenOutlined />}
                              onClick={() => setMaximizedSection('wbs')}
                              aria-label="Maximize WBS"
                            />
                          </Tooltip>
                        </Space>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    id="section-wbs"
                    size="small"
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={8}>
                          <ApartmentOutlined style={{ color: '#0284c7', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>2. Work Breakdown Structure (Struktur Deliverable & Bobot)</span>
                          {isWbsReady && <CheckCircleOutlined style={{ color: '#10b981', fontSize: 13 }} />}
                          {isWbsServerSynced && (
                            <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● SERVER: Database SSOT
                            </Tag>
                          )}
                          {(!isWbsServerSynced && wbsData.length > 0) && (
                            <Tag color="warning" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● DRAF LOKAL: Belum Disimpan ke Server
                            </Tag>
                          )}
                          {isWbsSaving && (
                            <Tag color="processing" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● Menyimpan ke Server...
                            </Tag>
                          )}
                        </Space>

                        <Space size={6}>
                          {isWbsMaximized ? (
                            <Button
                              size="small"
                              icon={<FullscreenExitOutlined />}
                              onClick={() => setMaximizedSection(null)}
                              aria-label="Kembali ke Normal"
                              style={{ fontWeight: 600, color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
                            >
                              ↙ Kembali
                            </Button>
                          ) : (
                            <>
                              <Tooltip title="Minimize WBS">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<MinusOutlined />}
                                  onClick={() => setMinimizedSections((p) => ({ ...p, wbs: true }))}
                                  aria-label="Minimize WBS"
                                />
                              </Tooltip>
                              <Tooltip title="Maximize WBS">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<FullscreenOutlined />}
                                  onClick={() => setMaximizedSection('wbs')}
                                  aria-label="Maximize WBS"
                                />
                              </Tooltip>
                            </>
                          )}
                        </Space>
                      </div>
                    }
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      ...(isWbsMaximized ? { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } : { flex: '0 0 auto' }),
                    }}
                    bodyStyle={{
                      padding: '12px 14px',
                      ...(isWbsMaximized ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } : {}),
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* WBS Toolbar */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                          padding: '6px 10px',
                          background: '#ffffff',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Space size={6} wrap>
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAddRoot}
                            style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 4, fontWeight: 600 }}
                          >
                            Tambah Work Package Utama
                          </Button>
                          <Button
                            size="small"
                            icon={<NodeExpandOutlined />}
                            onClick={() => setExpandedRowKeys(getAllNodeIds(wbsData))}
                            disabled={wbsData.length === 0}
                          >
                            Expand
                          </Button>
                          <Button
                            size="small"
                            icon={<NodeCollapseOutlined />}
                            onClick={() => setExpandedRowKeys([])}
                            disabled={wbsData.length === 0}
                          >
                            Collapse
                          </Button>
                        </Space>

                        <Space size={6} wrap>
                          <Input
                            size="small"
                            placeholder="Cari WBS Scope..."
                            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                            value={wbsSearchText}
                            onChange={(e) => setWbsSearchText(e.target.value)}
                            style={{ width: 170 }}
                            disabled={wbsData.length === 0}
                            allowClear
                          />
                          {wbsData.length > 0 && (
                            <Tag
                              color={wbsStructureMetrics.isStructured ? 'cyan' : 'blue'}
                              style={{ fontWeight: 600, margin: 0, padding: '2px 8px', whiteSpace: 'nowrap' }}
                            >
                              {wbsStructureMetrics.isStructured
                                ? `Terstruktur (L${wbsStructureMetrics.maxHierarchyDepth})`
                                : 'Struktur Flat (L1)'}
                            </Tag>
                          )}
                          <Tag
                            color={isWbsWeightValid ? 'success' : 'warning'}
                            style={{ fontWeight: 700, margin: 0, padding: '2px 8px', whiteSpace: 'nowrap' }}
                          >
                            Bobot Scope: {rootWeightSum.toFixed(1)}%
                          </Tag>
                        </Space>
                      </div>

                      {/* OVER-ALLOCATION ERROR ALERT (BLOCKS SAVE) */}
                      {hasWbsOverAllocation && (
                        <Alert
                          type="error"
                          showIcon
                          message="Over-Allocation Terdeteksi pada Bobot WBS"
                          description={
                            isRootOverAllocated
                              ? `Total bobot Work Package Utama / Root (${rootWeightSum.toFixed(2)}%) melebihi batas 100.00%. Harap kurangi bobot.`
                              : isLeafOverAllocated
                              ? `Total bobot Deliverables / Leaf (${leafWeightSum.toFixed(2)}%) melebihi batas 100.00%. Harap sesuaikan bobot.`
                              : `Total bobot anak (${overAllocatedHierarchyViolation?.childrenWeightSum}%) melebihi bobot induk (${overAllocatedHierarchyViolation?.parentWeight}%) pada "${overAllocatedHierarchyViolation?.code} ${overAllocatedHierarchyViolation?.name}".`
                          }
                          style={{ borderRadius: 6, fontSize: 12, padding: '6px 12px' }}
                        />
                      )}

                      {/* INCOMPLETE DRAFT WARNING ALERT (SAVE ALLOWED, REVIEW BLOCKED) */}
                      {!isWbsWeightValid && !hasWbsOverAllocation && wbsData.length > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message="Draf WBS Belum Lengkap (Incomplete)"
                          description={`Bobot Root: ${rootWeightSum.toFixed(2)}% (target 100.00%) · Bobot Leaf: ${leafWeightSum.toFixed(2)}% (target 100.00%). Anda dapat menyimpan draf ini, namun Management Review tetap diblokir hingga semua bobot mencapai 100.00% konsisten.`}
                          style={{ borderRadius: 6, fontSize: 12, padding: '6px 12px' }}
                        />
                      )}

                      {/* EDUCATIONAL ALERT IF STRUCTURE IS FLAT (NON-BLOCKING) */}
                      {wbsStructureMetrics.isFlat && wbsData.length > 0 && (
                        <Alert
                          type="info"
                          showIcon
                          message="Struktur WBS saat ini berada pada Level 1 (Flat)"
                          description="Semua pekerjaan saat ini berada pada Level 1. Gunakan '+ Sub Work Package' pada tabel di bawah jika pekerjaan membutuhkan rincian deliverable bertingkat. (Struktur flat tetap valid untuk proyek sederhana)."
                          style={{ borderRadius: 6, fontSize: 12, padding: '6px 12px' }}
                        />
                      )}

                      {/* WBS Table */}
                      {wbsData.length === 0 ? (
                        <Card style={{ borderRadius: 6, border: '1px dashed #cbd5e1', textAlign: 'center', padding: '20px 12px' }}>
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                                  Belum ada struktur pekerjaan WBS
                                </div>
                                <Text type="secondary" style={{ fontSize: 12.5 }}>
                                  Mulai dengan membuat Work Package Utama.
                                </Text>
                              </div>
                            }
                          >
                            <Button
                              type="primary"
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={handleOpenAddRoot}
                              style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 4, fontWeight: 600, marginTop: 8 }}
                            >
                              Tambah Work Package Utama
                            </Button>
                          </Empty>
                        </Card>
                      ) : (
                        <Table
                          columns={wbsColumns}
                          dataSource={filteredWbsData}
                          rowKey="id"
                          pagination={false}
                          size="small"
                          bordered
                          expandable={{
                            expandedRowKeys,
                            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
                            rowExpandable: (record) => Boolean(record.children && record.children.length > 0),
                          }}
                        />
                      )}
                    </div>
                  </Card>
                );
              })()}

              {/* ========================================================================= */}
              {/* SECTION 3: SCHEDULE & GANTT                                               */}
              {/* ========================================================================= */}
              {(() => {
                const isScheduleMaximized = maximizedSection === 'schedule';
                const isScheduleMinimized = !isScheduleMaximized && (maximizedSection !== null || minimizedSections.schedule);

                if (isScheduleMinimized) {
                  return (
                    <Card
                      id="section-schedule"
                      size="small"
                      style={{
                        flex: '0 0 auto',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      bodyStyle={{ padding: '8px 14px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Space size={8} wrap>
                          <ScheduleOutlined style={{ color: '#d97706', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>3. Schedule & Gantt</span>
                          {isScheduleReady ? (
                            <Tag color="success" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>Siap</Tag>
                          ) : isScheduleLocalDraft ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>○ Draft Lokal</Tag>
                          ) : (
                            <Tag color="processing" style={{ margin: 0, fontSize: 10.5 }}>○ {scheduledTasksCount}/{leafNodesCount}</Tag>
                          )}
                          {isScheduleServerSynced && (
                            <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● SERVER: Database SSOT
                            </Tag>
                          )}
                          {(!isScheduleServerSynced && scheduleData.length > 0) && (
                            <Tag color="warning" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● DRAF LOKAL: Belum Disimpan ke Server
                            </Tag>
                          )}
                          {isScheduleSaving && (
                            <Tag color="processing" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● Menyimpan ke Server...
                            </Tag>
                          )}
                          <Divider type="vertical" style={{ margin: '0 4px' }} />
                          <Text strong style={{ fontSize: 12.5, color: '#d97706' }}>
                            {scheduledTasksCount}/{leafNodesCount} Terjadwal
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text strong style={{ fontSize: 12, color: '#1d4ed8' }}>
                            {scheduleTimelineSummary.minStartStr !== '—' ? `${scheduleTimelineSummary.duration} Hari` : 'Belum Terjadwal'}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                          <Text type="secondary" style={{ fontSize: 11.5 }}>
                            {scheduleTimelineSummary.minStartStr} → {scheduleTimelineSummary.maxEndStr} ({scheduleTimelineSummary.milestoneCount} Milestone)
                          </Text>
                        </Space>

                        <Space size={4}>
                          <Tooltip title="Expand Schedule & Gantt">
                            <Button
                              size="small"
                              type="text"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setMaximizedSection(null);
                                setMinimizedSections((p) => ({ ...p, schedule: false }));
                              }}
                              aria-label="Minimize Schedule & Gantt"
                            />
                          </Tooltip>
                          <Tooltip title="Maximize Schedule & Gantt">
                            <Button
                              size="small"
                              type="text"
                              icon={<FullscreenOutlined />}
                              onClick={() => setMaximizedSection('schedule')}
                              aria-label="Maximize Schedule & Gantt"
                            />
                          </Tooltip>
                        </Space>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    id="section-schedule"
                    size="small"
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={8}>
                          <ScheduleOutlined style={{ color: '#d97706', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>3. Schedule & Gantt (Jadwal Kerja & Timeline)</span>
                          {isScheduleReady && <CheckCircleOutlined style={{ color: '#10b981', fontSize: 13 }} />}
                          {isScheduleServerSynced && (
                            <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● SERVER: Database SSOT
                            </Tag>
                          )}
                          {(!isScheduleServerSynced && scheduleData.length > 0) && (
                            <Tag color="warning" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● DRAF LOKAL: Belum Disimpan ke Server
                            </Tag>
                          )}
                          {isScheduleSaving && (
                            <Tag color="processing" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              ● Menyimpan ke Server...
                            </Tag>
                          )}
                        </Space>

                        <Space size={6}>
                          {isScheduleMaximized ? (
                            <Button
                              size="small"
                              icon={<FullscreenExitOutlined />}
                              onClick={() => setMaximizedSection(null)}
                              aria-label="Kembali ke Normal"
                              style={{ fontWeight: 600, color: '#d97706', borderColor: '#fed7aa', background: '#fffbeb' }}
                            >
                              ↙ Kembali
                            </Button>
                          ) : (
                            <>
                              <Tooltip title="Minimize Schedule & Gantt">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<MinusOutlined />}
                                  onClick={() => setMinimizedSections((p) => ({ ...p, schedule: true }))}
                                  aria-label="Minimize Schedule & Gantt"
                                />
                              </Tooltip>
                              <Tooltip title="Maximize Schedule & Gantt">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<FullscreenOutlined />}
                                  onClick={() => setMaximizedSection('schedule')}
                                  aria-label="Maximize Schedule & Gantt"
                                />
                              </Tooltip>
                            </>
                          )}
                        </Space>
                      </div>
                    }
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      ...(isScheduleMaximized ? { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } : { flex: '0 0 auto' }),
                    }}
                    bodyStyle={{
                      padding: '12px 14px',
                      ...(isScheduleMaximized ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } : {}),
                    }}
                  >
                    {!isScheduleMinimized && (
                      <Spin spinning={isScheduleLoading} tip="Memuat Jadwal dari Server...">
                        {isLegacyScheduleDraftDetected && (
                          <Alert
                            message="Draft Jadwal Lokal Terdeteksi"
                            description="Ditemukan draft jadwal lokal dari sesi sebelumnya di browser ini yang belum tersimpan di database server. Klik 'Simpan Draft' untuk menyinkronkan data ini ke server SSOT."
                            type="warning"
                            showIcon
                            style={{ marginBottom: 12 }}
                          />
                        )}
                        <ScheduleGanttTab
                          charter={charter}
                          wbsData={wbsData}
                          initialScheduleData={scheduleData}
                          onScheduleChange={(items, isUserEdit) => {
                            setScheduleData(items);
                            if (isUserEdit) {
                              setIsScheduleServerSynced(false);
                              setIsLegacyScheduleDraftDetected(true);
                            }
                          }}
                          onNavigateToWbs={() => {
                            if (maximizedSection === 'schedule') setMaximizedSection('wbs');
                            setMinimizedSections((p) => ({ ...p, wbs: false }));
                            document.getElementById('section-wbs')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        />
                      </Spin>
                    )}
                  </Card>
                );
              })()}

              {/* ========================================================================= */}
              {/* SECTION 4: KONDISI AWAL PROYEK (BASELINE PERENCANAAN)                     */}
              {/* ========================================================================= */}
              {(() => {
                const isCondMaximized = maximizedSection === 'initialCondition';
                const isCondMinimized = !isCondMaximized && (maximizedSection !== null || minimizedSections.initialCondition);

                if (isCondMinimized) {
                  return (
                    <Card
                      id="section-initial-condition"
                      size="small"
                      style={{
                        flex: '0 0 auto',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      bodyStyle={{ padding: '8px 14px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Space size={8} wrap>
                          <FileTextOutlined style={{ color: '#2563eb', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>4. Kondisi Awal Proyek</span>
                          {isConditionReady ? (
                            <Tag color="success" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>Siap</Tag>
                          ) : isConditionLocalDraft ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 10.5, fontWeight: 700 }}>○ Draft Lokal</Tag>
                          ) : initialCondition?.conditionStatus ? (
                            <Tag color="warning" style={{ margin: 0, fontSize: 10.5 }}>○ Draft</Tag>
                          ) : (
                            <Tag color="default" style={{ margin: 0, fontSize: 10.5 }}>○ Kosong</Tag>
                          )}
                          <Divider type="vertical" style={{ margin: '0 4px' }} />
                          <Text strong style={{ fontSize: 12, color: initialCondition?.conditionStatus === 'NORMAL' ? '#059669' : initialCondition?.conditionStatus === 'PERLU_PERHATIAN' ? '#b45309' : '#dc2626' }}>
                            {initialCondition ? `Status: ${initialCondition.conditionStatus === 'NORMAL' ? 'Normal' : initialCondition.conditionStatus === 'PERLU_PERHATIAN' ? 'Perlu Perhatian' : 'Berisiko'}` : 'Belum Diisi'}
                          </Text>
                          {initialCondition?.locationCondition && (
                            <>
                              <Text style={{ fontSize: 11.5, color: '#64748b' }}>·</Text>
                              <Text type="secondary" style={{ fontSize: 11.5 }}>
                                {initialCondition.locationCondition.length > 50 ? `${initialCondition.locationCondition.slice(0, 50)}...` : initialCondition.locationCondition}
                              </Text>
                            </>
                          )}
                        </Space>

                        <Space size={4}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => setIsInitialConditionModalOpen(true)}
                            style={{ borderRadius: 6, backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', fontWeight: 600, fontSize: 11 }}
                          >
                            {initialCondition ? 'Tinjau / Edit' : 'Isi Baseline'}
                          </Button>
                          <Tooltip title="Expand Kondisi Awal">
                            <Button
                              size="small"
                              type="text"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setMaximizedSection(null);
                                setMinimizedSections((p) => ({ ...p, initialCondition: false }));
                              }}
                              aria-label="Expand Kondisi Awal"
                            />
                          </Tooltip>
                        </Space>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    id="section-initial-condition"
                    size="small"
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={8}>
                          <FileTextOutlined style={{ color: '#2563eb', fontSize: 15 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                            4. Baseline Kondisi Awal Proyek (Perencanaan)
                          </span>
                          {isConditionReady ? (
                            <Tag color="success" style={{ fontWeight: 700, fontSize: 10 }}>
                              SIAP (TERSIMPAN DI SERVER)
                            </Tag>
                          ) : isConditionLocalDraft ? (
                            <Tag color="warning" style={{ fontWeight: 700, fontSize: 10 }}>
                              ○ DRAFT LOKAL (BELUM TERSINKRON)
                            </Tag>
                          ) : (
                            <Tag color="warning" style={{ fontWeight: 700, fontSize: 10 }}>
                              ○ DRAFT / BELUM LENGKAP
                            </Tag>
                          )}
                        </Space>

                        <Space size={6}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => setIsInitialConditionModalOpen(true)}
                            style={{
                              backgroundColor: '#1d4ed8',
                              borderColor: '#1d4ed8',
                              borderRadius: 6,
                              fontWeight: 600,
                            }}
                          >
                            {initialCondition ? 'Tinjau / Edit Baseline' : 'Isi Baseline Kondisi Awal'}
                          </Button>
                          <Tooltip title="Minimize Kondisi Awal">
                            <Button
                              size="small"
                              type="text"
                              icon={<MinusOutlined />}
                              onClick={() => setMinimizedSections((p) => ({ ...p, initialCondition: true }))}
                              aria-label="Minimize Kondisi Awal"
                            />
                          </Tooltip>
                        </Space>
                      </div>
                    }
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    bodyStyle={{ padding: '12px 14px' }}
                  >
                    {initialCondition ? (
                      <Row gutter={[16, 12]}>
                        <Col xs={24} sm={8}>
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', height: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>STATUS KONDISI AWAL PROYEK:</Text>
                            <div style={{ marginTop: 4 }}>
                              {initialCondition.conditionStatus === 'NORMAL' && (
                                <Tag color="green" style={{ fontWeight: 700, fontSize: 11 }}>● NORMAL</Tag>
                              )}
                              {initialCondition.conditionStatus === 'PERLU_PERHATIAN' && (
                                <Tag color="gold" style={{ fontWeight: 700, fontSize: 11 }}>● PERLU PERHATIAN</Tag>
                              )}
                              {initialCondition.conditionStatus === 'BERISIKO' && (
                                <Tag color="red" style={{ fontWeight: 700, fontSize: 11 }}>● BERISIKO</Tag>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                              Pencatat: <strong>{initialCondition.createdBy || 'Project Manager'}</strong>
                            </div>
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                              Diperbarui: {dayjs(initialCondition.updatedAt).format('DD MMM YYYY HH:mm')}
                            </div>
                          </div>
                        </Col>
                        <Col xs={24} sm={16}>
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div>
                              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>KONDISI LOKASI:</Text>
                              <div style={{ fontSize: 11.5, color: '#0f172a', fontWeight: 500 }}>
                                {initialCondition.locationCondition || '-'}
                              </div>
                            </div>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>KENDALA AWAL:</Text>
                                <div style={{ fontSize: 11.5, color: '#b45309' }}>
                                  {initialCondition.initialConstraints || '-'}
                                </div>
                              </Col>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>RISIKO AWAL:</Text>
                                <div style={{ fontSize: 11.5, color: '#dc2626' }}>
                                  {initialCondition.initialRisks || '-'}
                                </div>
                              </Col>
                            </Row>
                            {initialCondition.pmRecommendation && (
                              <div>
                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>REKOMENDASI PM:</Text>
                                <div style={{ fontSize: 11.5, color: '#1d4ed8' }}>
                                  {initialCondition.pmRecommendation}
                                </div>
                              </div>
                            )}
                          </div>
                        </Col>
                      </Row>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0f172a' }}>
                              Belum ada baseline kondisi awal proyek yang dicatat
                            </div>
                            <Text type="secondary" style={{ fontSize: 11.5 }}>
                              Dokumentasikan kondisi lapangan, akses, infrastruktur, kendala, dan risiko sebelum pekerjaan dimulai.
                            </Text>
                          </div>
                        }
                      >
                        <Button
                          type="primary"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => setIsInitialConditionModalOpen(true)}
                          style={{ backgroundColor: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 6, fontWeight: 600 }}
                        >
                          Isi Baseline Kondisi Awal Proyek
                        </Button>
                      </Empty>
                    )}
                  </Card>
                );
              })()}
            </div>
          </div>
        </div>
      </Modal>

      {/* WBS ADD / EDIT NODE MODAL */}
      <Modal
        title={
          <Space>
            <ApartmentOutlined style={{ color: '#1d4ed8', fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {nodeModalMode === 'ADD_ROOT' && 'Tambah Work Package Utama'}
              {nodeModalMode === 'ADD_CHILD' && (
                <Space size={6}>
                  <span>Tambah Sub Work Package</span>
                  {targetParentNode && (
                    <Tag color="blue" style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>
                      Induk: {targetParentNode.code} {targetParentNode.name}
                    </Tag>
                  )}
                </Space>
              )}
              {nodeModalMode === 'EDIT' && `Edit Work Package [${targetEditNode?.code}]`}
            </span>
          </Space>
        }
        open={isNodeModalOpen}
        onCancel={() => {
          setIsNodeModalOpen(false);
          setTargetParentNode(null);
          setTargetEditNode(null);
          setNodeModalMode('ADD_ROOT');
        }}
        onOk={handleNodeFormSubmit}
        okText={nodeModalMode === 'EDIT' ? 'Perbarui Item' : 'Tambahkan'}
        cancelText="Batal"
        okButtonProps={{ style: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' } }}
        width={520}
      >
        <Form form={nodeForm} layout="vertical" style={{ marginTop: 14 }}>
          {/* Parent Node Context for Child */}
          {nodeModalMode === 'ADD_CHILD' && targetParentNode && (
            <Form.Item label={<Text strong style={{ fontSize: 12.5 }}>Parent Work Package</Text>} style={{ marginBottom: 10 }}>
              <Input
                disabled
                value={`${targetParentNode.code} — ${targetParentNode.name}`}
                style={{ background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label={<Text strong style={{ fontSize: 12.5 }}>Nama Pekerjaan / Deliverable</Text>}
            rules={[{ required: true, message: 'Wajib diisi minimal 3 karakter!' }]}
          >
            <Input
              placeholder={nodeModalMode === 'ADD_ROOT' ? 'Contoh: Pekerjaan Sipil & Penarikan Kabel' : 'Contoh: Pengadaan Material Kabel FO 24 Core'}
              maxLength={150}
              showCount
              autoFocus
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="weightPercentage"
                label={<Text strong style={{ fontSize: 12.5 }}>Bobot WBS (%)</Text>}
                rules={[{ required: true, message: 'Bobot wajib diisi!' }]}
              >
                <InputNumber min={0} max={100} step={0.5} precision={1} style={{ width: '100%' }} addonAfter="%" placeholder="10.0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<Text strong style={{ fontSize: 12.5 }}>Tingkat</Text>}>
                <Input
                  disabled
                  value={
                    nodeModalMode === 'ADD_ROOT'
                      ? 'Level 1 · Work Package Utama'
                      : nodeModalMode === 'ADD_CHILD'
                      ? `Level ${(targetParentNode?.level || 1) + 1} · otomatis`
                      : `Level ${targetEditNode?.level || 1} · ${targetEditNode?.level === 1 ? 'Work Package Utama' : 'Sub Work Package'}`
                  }
                  style={{ background: '#f1f5f9', color: '#334155' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Helper / Guidance Text */}
          <div style={{ marginBottom: 12, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              {nodeModalMode === 'ADD_ROOT' && 'Work Package Utama menjadi level pertama dalam struktur WBS.'}
              {nodeModalMode === 'ADD_CHILD' && 'Level dan kode WBS ditentukan otomatis berdasarkan Work Package induk yang dipilih.'}
              {nodeModalMode === 'EDIT' && 'Perubahan nama dan bobot akan memperbarui ringkasan alokasi operasional secara otomatis.'}
            </Text>
          </div>

          <Form.Item name="description" label={<Text strong style={{ fontSize: 12.5 }}>Keterangan Scope (Opsional)</Text>}>
            <Input.TextArea rows={2} placeholder="Catatan teknis ruang lingkup..." maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* CONFIRMATION MODAL: AJUKAN UNTUK MANAGEMENT REVIEW */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: gateRecord?.status === 'NEEDS_REVISION' ? '#d97706' : '#059669', fontSize: 18 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {gateRecord?.status === 'NEEDS_REVISION'
                ? 'Ajukan Ulang Operational Plan untuk Review?'
                : 'Ajukan Operational Plan untuk Review?'}
            </span>
          </Space>
        }
        open={isSubmitModalOpen}
        onCancel={() => !isSubmittingReview && setIsSubmitModalOpen(false)}
        onOk={handleSubmitForManagementReview}
        confirmLoading={isSubmittingReview}
        okText={
          gateRecord?.status === 'NEEDS_REVISION'
            ? 'Konfirmasi & Ajukan Ulang ke Head of Operations'
            : 'Konfirmasi & Ajukan ke Head of Operations'
        }
        cancelText="Batal"
        cancelButtonProps={{ disabled: isSubmittingReview }}
        okButtonProps={{
          loading: isSubmittingReview,
          disabled: isSubmittingReview,
          style: {
            backgroundColor: gateRecord?.status === 'NEEDS_REVISION' ? '#d97706' : '#059669',
            borderColor: gateRecord?.status === 'NEEDS_REVISION' ? '#d97706' : '#059669',
            fontWeight: 600,
          },
        }}
        width={540}
      >
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert
            type={gateRecord?.status === 'NEEDS_REVISION' ? 'warning' : 'info'}
            showIcon
            message={
              gateRecord?.status === 'NEEDS_REVISION'
                ? 'Operational Plan hasil revisi akan diajukan kembali kepada Head of Operations untuk Management Review.'
                : 'Operational Plan akan diajukan kepada Head of Operations untuk Management Review.'
            }
            description="Pastikan Cost Estimate (RAB), Struktur WBS 100%, Penjadwalan, dan Baseline Kondisi Awal telah lengkap dan valid sebelum mengajukan."
            style={{ borderRadius: 6 }}
          />

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8, color: '#334155' }}>
              Ringkasan 4-Pilar Operasional:
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={6}>
                  {isCostReady ? (
                    <CheckCircleOutlined style={{ color: '#059669' }} />
                  ) : (
                    <WarningOutlined style={{ color: '#d97706' }} />
                  )}
                  <span>1. Cost Estimate (RAB):</span>
                </Space>
                <Text strong>Rp {totalPmEstimate.toLocaleString('id-ID')}</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={6}>
                  {isWbsReady ? (
                    <CheckCircleOutlined style={{ color: '#059669' }} />
                  ) : (
                    <WarningOutlined style={{ color: '#d97706' }} />
                  )}
                  <span>2. WBS Deliverables:</span>
                </Space>
                <Text strong>{wbsLeaves.length} Deliverables ({rootWeightSum.toFixed(0)}% Bobot)</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={6}>
                  {isScheduleReady ? (
                    <CheckCircleOutlined style={{ color: '#059669' }} />
                  ) : (
                    <WarningOutlined style={{ color: '#d97706' }} />
                  )}
                  <span>3. Jadwal Kerja:</span>
                </Space>
                <Text strong>
                  {scheduleData.length} Work Items Terjadwal ({scheduledTasksCount}/{leafNodesCount})
                </Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={6}>
                  {isConditionReady ? (
                    <CheckCircleOutlined style={{ color: '#059669' }} />
                  ) : (
                    <WarningOutlined style={{ color: '#d97706' }} />
                  )}
                  <span>4. Kondisi Awal Proyek:</span>
                </Space>
                <Text strong style={{ color: initialCondition?.conditionStatus === 'NORMAL' ? '#059669' : initialCondition?.conditionStatus === 'PERLU_PERHATIAN' ? '#b45309' : '#dc2626' }}>
                  {initialCondition ? `Status: ${initialCondition.conditionStatus === 'NORMAL' ? 'Normal' : initialCondition.conditionStatus === 'PERLU_PERHATIAN' ? 'Perlu Perhatian' : 'Berisiko'}` : 'Belum Diisi'}
                </Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={6}>
                  <CheckCircleOutlined style={{ color: '#059669' }} />
                  <span>Cross-Validation:</span>
                </Space>
                <Text strong>{costWbsReconciliation.unassignedItemsCount === 0 ? '100% Scope Terpetakan' : 'Scope Terpetakan'}</Text>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL PILAR 4: BASELINE KONDISI AWAL PROYEK */}
      {isInitialConditionModalOpen && (
        <ProjectInitialConditionModal
          open={isInitialConditionModalOpen}
          onClose={() => setIsInitialConditionModalOpen(false)}
          charter={charter}
          readOnly={
            gateRecord?.workflow
              ? !isPmEditableWorkflowState(gateRecord.workflow.current)
              : (gateRecord?.status === 'REVIEW_PENDING' || gateRecord?.status === 'READY_FOR_PROCUREMENT')
          }
          onSaveSuccess={(saved) => {
            setInitialCondition(saved);
            if (canonicalProjectId > 0) {
              fetchOperationalReadiness(canonicalProjectId);
              ProjectService.getManagementReview(canonicalProjectId)
                .then((serverGate) => {
                  if (serverGate && serverGate.status) setGateRecord(serverGate);
                })
                .catch(() => {});
            }
            if (onRefreshParent) onRefreshParent();
          }}
        />
      )}

      {/* MANAGEMENT REVIEW & CROSS-VALIDATION MODAL */}
      {isSummaryModalOpen && (
        <PmOperationalPlanReviewModal
          open={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          charter={charter}
          costCategories={costCategories}
          wbsData={wbsData}
          scheduleData={scheduleData}
          initialCondition={initialCondition}
          operationalReadinessData={operationalReadinessData}
          pmNotes={pmNotes}
          onGateDecisionChange={(newRecord) => {
            setGateRecord(newRecord);
            if (canonicalProjectId > 0) {
              fetchOperationalReadiness(canonicalProjectId);
            }
            if (onRefreshParent) onRefreshParent();
          }}
        />
      )}
    </>
  );
};
