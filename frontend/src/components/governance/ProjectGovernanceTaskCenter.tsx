'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ApartmentOutlined,
  ScheduleOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  WorkflowEngineService,
  WorkflowTask,
  WorkflowTransition,
} from '@/services/workflowEngine.service';
import { ProjectService } from '@/services/project.service';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
  tagColor: string;
  nextNodeLabel: string;
  returnNodeLabel: string;
}

export const STAGE_MAPPING: Record<SupportedGovernanceNode, StageInfo> = {
  node_hops_review: {
    label: 'HOPS Review',
    tagColor: 'blue',
    nextNodeLabel: 'Procurement Review',
    returnNodeLabel: 'PM Revision (HOPS)',
  },
  node_procurement_review: {
    label: 'Procurement Review',
    tagColor: 'orange',
    nextNodeLabel: 'Finance Review',
    returnNodeLabel: 'PM Revision (Procurement)',
  },
  node_finance_review: {
    label: 'Finance Review',
    tagColor: 'geekblue',
    nextNodeLabel: 'Director Approval',
    returnNodeLabel: 'PM Revision (Finance)',
  },
  node_director_approval: {
    label: 'Director Approval',
    tagColor: 'purple',
    nextNodeLabel: 'Ready for Kickoff',
    returnNodeLabel: 'PM Revision (Director)',
  },
};

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
  submittedByName?: string;
  submittedAt?: string;
  readiness?: any;
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

  // Review Workspace Modal State
  const [selectedTask, setSelectedTask] = useState<EnrichedGovernanceTask | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Detailed Data States
  const [costData, setCostData] = useState<any>(null);
  const [wbsData, setWbsData] = useState<any[]>([]);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [initialConditionData, setInitialConditionData] = useState<any>(null);
  const [managementReviewData, setManagementReviewData] = useState<any>(null);
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowTransition[]>([]);

  // Action Dialog States
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // ── 1. Fetch & Filter Tasks strictly matching canonical predicate via React Query ──
  const {
    data: tasks = [],
    isLoading: loading,
    refetch: fetchTasks,
  } = useQuery<EnrichedGovernanceTask[]>({
    queryKey: ['governance-tasks'],
    queryFn: async () => {
      const allTasks = await WorkflowEngineService.getMyTasks();

      // Canonical task predicate:
      // status === 'PENDING'
      // workflowKey === 'PROJECT_PLAN_REVIEW_WORKFLOW'
      // entityType === 'PROJECT'
      // nodeId IN ['node_hops_review', 'node_procurement_review', 'node_finance_review', 'node_director_approval']
      const filtered = (allTasks || []).filter((t) => {
        const wKey =
          t.workflowInstance?.workflowDefinition?.workflowKey ||
          (t as any).workflowKey;
        const eType =
          t.workflowInstance?.entityType ||
          (t as any).entityType;
        const isSupportedNode = SUPPORTED_GOVERNANCE_NODES.includes(
          t.nodeId as SupportedGovernanceNode,
        );

        return (
          t.status === 'PENDING' &&
          wKey === 'PROJECT_PLAN_REVIEW_WORKFLOW' &&
          eType === 'PROJECT' &&
          isSupportedNode
        );
      });

      // Enrich task items with Project Metadata and Canonical Contract SSOT
      const enriched: EnrichedGovernanceTask[] = await Promise.all(
        filtered.map(async (t) => {
          const pid = Number(
            t.workflowInstance?.entityId ||
              t.workflowInstance?.context?.projectId ||
              0,
          );

          let pName = t.workflowInstance?.context?.projectName || '';
          let pCode = t.workflowInstance?.context?.projectCode || '';
          let cNumber = '';
          let contractObj: CanonicalContractSummary | null = null;
          let subByName = '';
          let subAt = t.createdAt;
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
              'Project Manager',
            submittedAt: subAt,
            readiness: readinessData,
          };
        }),
      );

      return enriched;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // ── 2. Open Review Workspace Modal ─────────────────────────────────────────
  const handleOpenReview = async (task: EnrichedGovernanceTask) => {
    setSelectedTask(task);
    setIsReviewModalOpen(true);
    setModalLoading(true);

    try {
      const pid = task.projectId;
      const wfInstanceId = task.workflowInstanceId;
      if (pid > 0) {
        const [costRes, wbsRes, schedRes, initRes, mrRes, transRes] =
          await Promise.allSettled([
            ProjectService.getCostEstimate(pid),
            ProjectService.getWbsByProject(pid),
            ProjectService.getProjectSchedule(pid),
            ProjectService.getInitialCondition(pid),
            ProjectService.getManagementReview(pid),
            wfInstanceId
              ? WorkflowEngineService.getTransitions(wfInstanceId)
              : Promise.resolve([]),
          ]);

        if (costRes.status === 'fulfilled') setCostData(costRes.value);
        if (wbsRes.status === 'fulfilled')
          setWbsData(Array.isArray(wbsRes.value) ? wbsRes.value : []);
        if (schedRes.status === 'fulfilled') setScheduleData(schedRes.value);
        if (initRes.status === 'fulfilled') setInitialConditionData(initRes.value);
        if (mrRes.status === 'fulfilled') setManagementReviewData(mrRes.value);
        if (transRes.status === 'fulfilled')
          setWorkflowTransitions(Array.isArray(transRes.value) ? transRes.value : []);
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
    setManagementReviewData(null);
    setWorkflowTransitions([]);
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

  // ── 3. APPROVE Action ──────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!selectedTask) return;
    setSubmittingAction(true);
    const stageInfo = STAGE_MAPPING[selectedTask.nodeId as SupportedGovernanceNode];
    const stageLabel = stageInfo?.label || selectedTask.nodeId;

    try {
      await WorkflowEngineService.completeTask(
        selectedTask.workflowInstanceId,
        selectedTask.id,
        {
          action: 'APPROVE',
          reason: `Disetujui pada tahap ${stageLabel}`,
        },
      );

      message.success(
        `Rencana operasional berhasil disetujui pada tahap ${stageLabel}! Alur kerja dialihkan ke tahap berikutnya.`,
      );
      setIsApproveConfirmOpen(false);
      handleCloseReview();
      queryClient.invalidateQueries({ queryKey: ['governance-tasks'] });
      // Ghost keys removed per Phase A: 'operational-board', 'operational-readiness'
      await fetchTasks();
    } catch (err: any) {
      console.error('[ProjectGovernanceTaskCenter] APPROVE failed:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Gagal menyetujui rencana operasional.';
      message.error(errMsg);
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── 4. RETURN Action ───────────────────────────────────────────────────────
  const handleReturn = async () => {
    if (!selectedTask) return;
    if (!returnReason || returnReason.trim().length < 10) {
      message.error('Alasan perbaikan wajib diisi minimal 10 karakter!');
      return;
    }

    setSubmittingAction(true);
    const stageInfo = STAGE_MAPPING[selectedTask.nodeId as SupportedGovernanceNode];
    const stageLabel = stageInfo?.label || selectedTask.nodeId;

    try {
      await WorkflowEngineService.completeTask(
        selectedTask.workflowInstanceId,
        selectedTask.id,
        {
          action: 'RETURN',
          reason: returnReason.trim(),
        },
      );

      message.warning(
        `Rencana operasional dikembalikan ke Project Manager untuk perbaikan (${stageLabel}).`,
      );
      setIsReturnModalOpen(false);
      handleCloseReview();
      setReturnReason('');
      queryClient.invalidateQueries({ queryKey: ['governance-tasks'] });
      // Ghost keys removed per Phase A: 'operational-board', 'operational-readiness'
      await fetchTasks();
    } catch (err: any) {
      console.error('[ProjectGovernanceTaskCenter] RETURN failed:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Gagal mengembalikan rencana operasional.';
      message.error(errMsg);
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── Derived Data for Review Modal ─────────────────────────────────────────
  const currentStageInfo = useMemo<StageInfo | null>(() => {
    if (!selectedTask) return null;
    return (
      STAGE_MAPPING[selectedTask.nodeId as SupportedGovernanceNode] || {
        label: selectedTask.nodeId,
        tagColor: 'default',
        nextNodeLabel: 'Next Stage',
        returnNodeLabel: 'PM Revision',
      }
    );
  }, [selectedTask]);

  const wbsTreeData = useMemo(() => buildWbsTree(wbsData), [wbsData]);

  // ── Queue Table Columns (| Project | Tahap | Diajukan | Status | Aksi |) ──
  const columns = useMemo(
    () => [
      {
        title: 'Project',
        key: 'project',
        render: (_: any, record: EnrichedGovernanceTask) => (
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
                {record.projectCode}
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
                  <FileTextOutlined /> {record.contractNumber}
                </Tag>
              )}
            </Space>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginTop: 3 }}>
              {record.projectName}
            </div>
          </div>
        ),
      },
      {
        title: 'Tahap',
        key: 'tahap',
        width: 190,
        render: (_: any, record: EnrichedGovernanceTask) => {
          const info = STAGE_MAPPING[record.nodeId as SupportedGovernanceNode];
          return (
            <Tag
              color={info?.tagColor || 'default'}
              style={{ fontWeight: 700, fontSize: 11.5, padding: '2px 8px' }}
            >
              {info?.label || record.nodeId}
            </Tag>
          );
        },
      },
      {
        title: 'Diajukan',
        key: 'diajukan',
        width: 220,
        render: (_: any, record: EnrichedGovernanceTask) => (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
              <ClockCircleOutlined style={{ marginRight: 4, color: '#64748b' }} />
              {record.submittedAt
                ? dayjs(record.submittedAt).format('DD MMM YYYY HH:mm')
                : '—'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {record.submittedByName || 'Project Manager'}
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
        width: 110,
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
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Tugas Persetujuan Proyek
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Pusat antrean persetujuan rencana operasional proyek terpadu (HOPS, Procurement, Finance, Director).
        </Text>
      </div>

      {/* Main Canonical Queue Card */}
      <Card
        size="small"
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '4px 0',
            }}
          >
            <Space size={8}>
              <AuditOutlined style={{ color: '#0284c7', fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                Antrean Tugas Persetujuan
              </span>
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
                {tasks.length} Menunggu Persetujuan
              </Tag>
            </Space>

            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => { fetchTasks(); }}
              loading={loading}
              style={{ fontSize: 11.5, color: '#0284c7', fontWeight: 600 }}
            >
              Segarkan Antrean
            </Button>
          </div>
        }
        style={{
          borderRadius: 8,
          border: '1px solid #bae6fd',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                      Tidak ada tugas persetujuan proyek yang menunggu Anda
                    </div>
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      Semua rencana operasional proyek telah disetujui atau belum dialihkan ke peran Anda.
                    </Text>
                  </div>
                }
              />
            ),
          }}
        />
      </Card>

      {/* ── GOVERNANCE REVIEW WORKSPACE MODAL ───────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SafetyCertificateOutlined style={{ color: '#0284c7', fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Tugas Persetujuan Proyek — {currentStageInfo?.label || 'Review'}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 400, color: '#64748b' }}>
                {selectedTask?.projectName} ({selectedTask?.projectCode})
                {selectedTask?.contractNumber && (
                  <span> • Kontrak: {selectedTask.contractNumber}</span>
                )}
              </div>
            </div>
          </div>
        }
        open={isReviewModalOpen}
        onCancel={handleCloseReview}
        footer={[
          <Button key="cancel" onClick={handleCloseReview}>
            Tutup
          </Button>,
          <Button
            key="return"
            danger
            icon={<EditOutlined />}
            onClick={() => setIsReturnModalOpen(true)}
            style={{ fontWeight: 600 }}
          >
            Minta Perbaikan
          </Button>,
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => setIsApproveConfirmOpen(true)}
            style={{
              backgroundColor: '#059669',
              borderColor: '#059669',
              fontWeight: 600,
            }}
          >
            Setujui
          </Button>,
        ]}
        width={1040}
        destroyOnClose
        styles={{
          body: {
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: 8,
          },
        }}
      >
        {modalLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Memuat rincian paket data rencana operasional..." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
            {/* Status Alert Banner */}
            <Alert
              type="info"
              showIcon
              message={`Tahap Saat Ini: ${currentStageInfo?.label || selectedTask?.nodeId}`}
              description={`Evaluasi rincian Biaya (RAB), Deliverables (WBS), Jadwal Kerja, dan Kondisi Awal Lapangan. Setelah disetujui, alur kerja akan berlanjut ke: ${currentStageInfo?.nextNodeLabel || 'Tahap Berikutnya'}.`}
              style={{ borderRadius: 6 }}
            />

            {/* SECTION 1: Project & Governance Context */}
            <Card
              size="small"
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                  Konteks Proyek & Alur Kerja
                </span>
              }
              style={{
                borderRadius: 6,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <Row gutter={[16, 10]}>
                <Col span={8}>
                  <Text type="secondary">Kode Proyek:</Text>{' '}
                  <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11, margin: 0 }}>
                    {selectedTask?.projectCode}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Ref ID Proyek:</Text>{' '}
                  <strong>#{selectedTask?.projectId}</strong>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Tahap Aktif:</Text>{' '}
                  <Tag color={currentStageInfo?.tagColor || 'default'} style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                    {currentStageInfo?.label || selectedTask?.nodeId}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Diajukan Oleh:</Text>{' '}
                  <strong>{selectedTask?.submittedByName || 'Project Manager'}</strong>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Waktu Pengajuan:</Text>{' '}
                  <strong>
                    {selectedTask?.submittedAt
                      ? dayjs(selectedTask.submittedAt).format('DD MMM YYYY HH:mm')
                      : '—'}
                  </strong>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Tahap Selanjutnya:</Text>{' '}
                  <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>
                    {currentStageInfo?.nextNodeLabel}
                  </Tag>
                </Col>
              </Row>
            </Card>

            {/* SECTION 2: Canonical Contract Summary SSOT */}
            <Card
              size="small"
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>
                  <FileTextOutlined /> Ringkasan Kontrak (Canonical Contract SSOT)
                </span>
              }
              style={{
                borderRadius: 6,
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
              }}
            >
              {selectedTask?.contract ? (
                <Row gutter={[16, 10]}>
                  <Col span={8}>
                    <Text type="secondary">Nomor Kontrak:</Text>{' '}
                    <Tag
                      color="cyan"
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: 11,
                        margin: 0,
                      }}
                    >
                      {selectedTask.contract.contractNumber}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Nilai Kontrak:</Text>{' '}
                    <strong style={{ color: '#0f172a', fontSize: 12 }}>
                      Rp {Number(selectedTask.contract.contractValue || 0).toLocaleString('id-ID')}
                    </strong>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Status Kontrak:</Text>{' '}
                    <Tag color="geekblue" style={{ fontSize: 10.5, margin: 0 }}>
                      {selectedTask.contract.status || 'ACTIVE'}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Status Legalitas:</Text>{' '}
                    <Tag
                      color={selectedTask.contract.legalStatus === 'APPROVED' ? 'success' : 'warning'}
                      style={{ fontWeight: 600, fontSize: 10.5, margin: 0 }}
                    >
                      {selectedTask.contract.legalStatus || 'DRAFT'}
                    </Tag>
                  </Col>
                  <Col span={16}>
                    <Text type="secondary">Periode Kontrak:</Text>{' '}
                    <span style={{ fontSize: 11.5, fontWeight: 500 }}>
                      {selectedTask.contract.startDate
                        ? dayjs(selectedTask.contract.startDate).format('DD/MM/YYYY')
                        : '—'}{' '}
                      s/d{' '}
                      {selectedTask.contract.endDate
                        ? dayjs(selectedTask.contract.endDate).format('DD/MM/YYYY')
                        : '—'}
                    </span>
                  </Col>
                </Row>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="Data kontrak belum tersedia"
                  description="Proyek ini belum terhubung dengan kontrak kanonikal aktif di database."
                  style={{ borderRadius: 4, padding: '6px 12px' }}
                />
              )}
            </Card>

            {/* SECTION 3: Workflow History / Transitions */}
            {workflowTransitions.length > 0 && (
              <Card
                size="small"
                title={
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    <HistoryOutlined /> Riwayat Transisi Alur Kerja (Workflow Transitions)
                  </span>
                }
                style={{
                  borderRadius: 6,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Timeline
                  style={{ marginTop: 8 }}
                  items={workflowTransitions.map((t) => ({
                    color: t.action === 'RETURN' ? 'red' : t.action === 'APPROVE' ? 'green' : 'blue',
                    children: (
                      <div style={{ fontSize: 11.5 }}>
                        <Space size={6}>
                          <Tag
                            color={
                              t.action === 'RETURN'
                                ? 'error'
                                : t.action === 'APPROVE'
                                  ? 'success'
                                  : 'default'
                            }
                            style={{ fontWeight: 700, fontSize: 10 }}
                          >
                            {t.action}
                          </Tag>
                          <span style={{ color: '#475569' }}>
                            <code>{t.fromNodeId}</code> → <code>{t.toNodeId}</code>
                          </span>
                          <span style={{ color: '#94a3b8' }}>·</span>
                          <span style={{ fontWeight: 600 }}>
                            {t.actor?.fullName || (t.actorId ? `User #${t.actorId}` : 'Sistem')}
                          </span>
                          <span style={{ color: '#94a3b8' }}>·</span>
                          <span style={{ color: '#64748b' }}>
                            {dayjs(t.createdAt).format('DD/MM/YYYY HH:mm')}
                          </span>
                        </Space>
                        {t.reason && (
                          <div
                            style={{
                              marginTop: 4,
                              background: '#f8fafc',
                              padding: '4px 8px',
                              borderRadius: 4,
                              borderLeft: '3px solid #0284c7',
                              color: '#334155',
                              fontStyle: 'italic',
                            }}
                          >
                            &quot;{t.reason}&quot;
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              </Card>
            )}

            {/* SECTION 4: 4-Pillar Summary Cards */}
            <Row gutter={12}>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <Statistic
                    title={
                      <Space size={4} style={{ fontSize: 11, color: '#475569' }}>
                        <DollarOutlined /> Total RAB (Pilar 1)
                      </Space>
                    }
                    value={costData?.totalPmEstimate ?? selectedTask?.readiness?.costPillar?.totalEstimate ?? 0}
                    precision={0}
                    prefix="Rp"
                    valueStyle={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <Statistic
                    title={
                      <Space size={4} style={{ fontSize: 11, color: '#475569' }}>
                        <ApartmentOutlined /> WBS Nodes (Pilar 2)
                      </Space>
                    }
                    value={wbsData.length || selectedTask?.readiness?.wbsPillar?.leafDeliverablesCount || 0}
                    suffix="Nodes"
                    valueStyle={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}
                  />
                  <div
                    style={{
                      fontSize: 10.5,
                      color: Math.abs(wbsTreeData.totalWeight - 100) <= 0.01 ? '#16a34a' : '#dc2626',
                      marginTop: 2,
                      fontWeight: 600,
                    }}
                  >
                    Bobot: {wbsTreeData.totalWeight.toFixed(1)}%
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <Statistic
                    title={
                      <Space size={4} style={{ fontSize: 11, color: '#475569' }}>
                        <ScheduleOutlined /> Jadwal (Pilar 3)
                      </Space>
                    }
                    value={scheduleData?.tasks?.length || selectedTask?.readiness?.schedulePillar?.scheduledLeafCount || 0}
                    suffix="Item"
                    valueStyle={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <Statistic
                    title={
                      <Space size={4} style={{ fontSize: 11, color: '#475569' }}>
                        <SafetyCertificateOutlined /> Kondisi Awal (Pilar 4)
                      </Space>
                    }
                    value={initialConditionData?.conditionStatus || 'NORMAL'}
                    valueStyle={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: initialConditionData?.conditionStatus === 'CRITICAL' ? '#dc2626' : '#16a34a',
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {/* SECTION 5: 4-Pillar Detailed Tabs */}
            <Tabs
              defaultActiveKey="cost"
              size="small"
              type="card"
              items={[
                {
                  key: 'cost',
                  label: (
                    <span>
                      <DollarOutlined /> Estimasi Biaya (RAB)
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Table
                        size="small"
                        dataSource={costData?.categories || []}
                        rowKey="categoryKey"
                        pagination={false}
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
                            title: 'Jumlah Item',
                            key: 'itemsCount',
                            width: 120,
                            render: (_: any, r: any) => `${r.items?.length || 0} item`,
                          },
                          {
                            title: 'Subtotal Kategori',
                            dataIndex: 'categoryTotal',
                            key: 'categoryTotal',
                            width: 180,
                            align: 'right',
                            render: (val: number) => (
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
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
                      size="small"
                      dataSource={wbsTreeData.tree}
                      pagination={false}
                      columns={[
                        {
                          title: 'Kode WBS',
                          dataIndex: 'code',
                          key: 'code',
                          width: 140,
                          render: (code: string) => (
                            <Tag color="geekblue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {code}
                            </Tag>
                          ),
                        },
                        {
                          title: 'Nama Deliverable / Task',
                          dataIndex: 'name',
                          key: 'name',
                          render: (name: string, record: WbsTreeNode) => (
                            <span style={{ fontWeight: record.isLeaf ? 400 : 700 }}>
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
                          render: (lvl: number) => <Tag style={{ fontSize: 10 }}>L{lvl}</Tag>,
                        },
                        {
                          title: 'Bobot',
                          dataIndex: 'weightPercentage',
                          key: 'weightPercentage',
                          width: 100,
                          align: 'right',
                          render: (w: number) => (
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>
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
                      size="small"
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
                              {record.isMilestone && <Tag color="purple">Milestone</Tag>}
                              <span>{text}</span>
                            </Space>
                          ),
                        },
                        {
                          title: 'Mulai',
                          dataIndex: 'startDate',
                          key: 'startDate',
                          width: 130,
                          render: (d: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '—'),
                        },
                        {
                          title: 'Selesai',
                          dataIndex: 'endDate',
                          key: 'endDate',
                          width: 130,
                          render: (d: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '—'),
                        },
                        {
                          title: 'Durasi',
                          dataIndex: 'durationDays',
                          key: 'durationDays',
                          width: 100,
                          render: (days: number) => (days ? `${days} hari` : '—'),
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
                    <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2 }}>
                      <Descriptions.Item label="Status Kondisi">
                        <Tag
                          color={
                            initialConditionData?.conditionStatus === 'NORMAL'
                              ? 'success'
                              : initialConditionData?.conditionStatus === 'CHALLENGING'
                                ? 'warning'
                                : 'error'
                          }
                          style={{ fontWeight: 700 }}
                        >
                          {initialConditionData?.conditionStatus || 'NORMAL'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Status Kesiapan">
                        <Tag color={initialConditionData?.status === 'READY' ? 'success' : 'warning'}>
                          {initialConditionData?.status || 'NOT_STARTED'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Kondisi Lokasi / Site" span={2}>
                        {initialConditionData?.locationCondition || 'Belum diisi oleh PM.'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Infrastruktur Existing" span={2}>
                        {initialConditionData?.existingInfrastructure || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Akses & Logistik Lapangan" span={2}>
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
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Setujui Rencana Operasional?
            </span>
          </Space>
        }
        open={isApproveConfirmOpen}
        onCancel={() => setIsApproveConfirmOpen(false)}
        onOk={handleApprove}
        confirmLoading={submittingAction}
        okText="Konfirmasi Persetujuan"
        cancelText="Batal"
        okButtonProps={{
          style: {
            backgroundColor: '#059669',
            borderColor: '#059669',
            fontWeight: 600,
          },
        }}
        width={500}
      >
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
            Anda akan menyetujui rencana operasional untuk proyek:
            <br />
            <strong>{selectedTask?.projectName}</strong> ({selectedTask?.projectCode})
            <br />
            Tahap: <Tag color={currentStageInfo?.tagColor}>{currentStageInfo?.label}</Tag>
          </p>
          <Alert
            type="info"
            message="Alur Kerja BPMN"
            description={`Tugas ${currentStageInfo?.label} akan diselesaikan (COMPLETED), dan alur kerja akan berpindah ke: ${currentStageInfo?.nextNodeLabel}.`}
            style={{ fontSize: 12, borderRadius: 6 }}
          />
        </div>
      </Modal>

      {/* ── RETURN CONFIRMATION MODAL ──────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Minta Perbaikan Rencana Operasional?
            </span>
          </Space>
        }
        open={isReturnModalOpen}
        onCancel={() => {
          setIsReturnModalOpen(false);
          setReturnReason('');
        }}
        onOk={handleReturn}
        confirmLoading={submittingAction}
        okText="Kirim Catatan Perbaikan"
        cancelText="Batal"
        okButtonProps={{
          danger: true,
          style: { fontWeight: 600 },
        }}
        width={520}
      >
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, color: '#334155' }}>
            Tuliskan catatan perbaikan yang jelas untuk Project Manager (PM):
          </p>
          <TextArea
            rows={4}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Contoh: Estimasi anggaran pada kategori X melebihi acuan pasar, mohon periksa kembali kesesuaian spesifikasi item..."
            maxLength={1000}
            showCount
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
            Alur kerja akan kembali ke Project Manager ({currentStageInfo?.returnNodeLabel}) untuk direvisi dan diajukan ulang.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectGovernanceTaskCenter;
