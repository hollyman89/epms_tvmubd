import React, { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Tooltip,
  Popconfirm,
  Badge,
  Typography,
  Select,
  Empty,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  FundProjectionScreenOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  LockOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProjectRiskItem,
  ProjectRiskStatus,
  ProjectRiskLevel,
  ProjectIssueRiskCategory,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';
import { CreateRiskModal, UpdateMitigationModal } from './RiskModals';
import { AssessRiskModal } from './AssessRiskModal';
import { MaterializeRiskModal } from './MaterializeRiskModal';
import { CancelRecordModal } from './IssueModals';

const { Text } = Typography;

interface RiskRegisterTableProps {
  projectId: number;
  risks: ProjectRiskItem[];
  loading: boolean;
  total: number;
  page: number;
  limit: number;
  filters: any;
  onFilterChange: (filters: any) => void;
  onPaginationChange: (page: number, limit: number) => void;
  onRefresh: () => void;
  currentUserId: number;
  currentUserRoles: string[];
  isAssignedPm: boolean;
  eligibleOwners: { id: number; name: string; email: string; roles: string[] }[];
  highlightedId?: number | null;
  onViewDetail?: (record: ProjectRiskItem) => void;
}

export const RiskRegisterTable: React.FC<RiskRegisterTableProps> = ({
  projectId,
  risks,
  loading,
  total,
  page,
  limit,
  filters,
  onFilterChange,
  onPaginationChange,
  onRefresh,
  currentUserId,
  currentUserRoles,
  isAssignedPm,
  eligibleOwners,
  highlightedId,
  onViewDetail,
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assessTarget, setAssessTarget] = useState<ProjectRiskItem | null>(null);
  const [mitigationTarget, setMitigationTarget] = useState<ProjectRiskItem | null>(null);
  const [materializeTarget, setMaterializeTarget] = useState<ProjectRiskItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ProjectRiskItem | null>(null);

  const isPmo = currentUserRoles.includes('PMO');
  const isHoo = currentUserRoles.includes('HEAD_OF_OPERATIONS');
  const canCreate = isAssignedPm || isPmo;

  // Status & Level Helpers
  const getRiskLevelTag = (level: string | null) => {
    if (!level) {
      return <Tag color="default" data-testid="risk-level-unassessed">Belum dinilai</Tag>;
    }
    switch (level) {
      case ProjectRiskLevel.CRITICAL:
        return <Tag color="red" style={{ fontWeight: 700 }} data-testid="risk-level-critical">CRITICAL</Tag>;
      case ProjectRiskLevel.HIGH:
        return <Tag color="orange" style={{ fontWeight: 600 }}>HIGH</Tag>;
      case ProjectRiskLevel.MEDIUM:
        return <Tag color="gold">MEDIUM</Tag>;
      case ProjectRiskLevel.LOW:
        return <Tag color="green">LOW</Tag>;
      default:
        return <Tag>{level || 'Belum dinilai'}</Tag>;
    }
  };

  const getStatusTag = (status: ProjectRiskStatus) => {
    switch (status) {
      case ProjectRiskStatus.IDENTIFIED:
        return <Tag color="geekblue">IDENTIFIED</Tag>;
      case ProjectRiskStatus.ASSESSED:
        return <Tag color="purple">ASSESSED</Tag>;
      case ProjectRiskStatus.MITIGATING:
        return <Tag color="gold">MITIGATING</Tag>;
      case ProjectRiskStatus.MONITORING:
        return <Tag color="cyan">MONITORING</Tag>;
      case ProjectRiskStatus.MATERIALIZED:
        return <Tag color="volcano" style={{ fontWeight: 700 }}>MATERIALIZED</Tag>;
      case ProjectRiskStatus.CLOSED:
        return <Tag color="green">CLOSED</Tag>;
      case ProjectRiskStatus.CANCELLED:
        return <Tag color="default">CANCELLED</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const handleCloseRisk = async (risk: ProjectRiskItem) => {
    try {
      await ProjectIssueRiskService.closeRisk(projectId, risk.id, risk.version);
      message.success(`Risiko ${risk.riskNumber} ditutup (CLOSED).`);
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Gagal menutup Risiko');
    }
  };

  const handleTransitionMitigating = async (risk: ProjectRiskItem) => {
    try {
      if (!risk.mitigationPlan) {
        message.warning('Harap isi rencana mitigasi terlebih dahulu sebelum beralih ke status MITIGATING.');
        setMitigationTarget(risk);
        return;
      }
      await ProjectIssueRiskService.mitigateRisk(projectId, risk.id, risk.version);
      message.success(`Risiko ${risk.riskNumber} beralih ke status MITIGATING.`);
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Gagal mengubah status');
    }
  };

  const columns: ColumnsType<ProjectRiskItem> = [
    {
      title: 'Nomor Risiko',
      dataIndex: 'riskNumber',
      key: 'riskNumber',
      width: 150,
      render: (num: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#0f172a' }} data-testid={`risk-number-${record.id}`}>{num}</Text>
          {record.status === ProjectRiskStatus.MATERIALIZED && (
            <Tag color="volcano" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              Materialized
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Judul & Analisis Ancaman',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#64748b', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {record.description}
          </div>
        </div>
      ),
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat: string) => <Tag style={{ borderRadius: 4 }}>{cat}</Tag>,
    },
    {
      title: 'Probabilitas',
      dataIndex: 'probability',
      key: 'probability',
      width: 110,
      render: (prob: number | null) => (
        <span style={{ fontSize: 12.5 }} data-testid="risk-probability-cell">
          {prob ? `${prob} / 5` : 'Belum dinilai'}
        </span>
      ),
    },
    {
      title: 'Dampak',
      dataIndex: 'impact',
      key: 'impact',
      width: 110,
      render: (imp: number | null) => (
        <span style={{ fontSize: 12.5 }} data-testid="risk-impact-cell">
          {imp ? `${imp} / 5` : 'Belum dinilai'}
        </span>
      ),
    },
    {
      title: 'Skor',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 80,
      render: (score: number | null) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: score ? '#0f172a' : '#94a3b8' }} data-testid="risk-score-cell">
          {score !== null && score !== undefined ? score : 'N/A'}
        </span>
      ),
    },
    {
      title: 'Level Risiko',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 120,
      render: (level: string | null) => getRiskLevelTag(level),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (st: ProjectRiskStatus) => getStatusTag(st),
    },
    {
      title: 'Penanggung Jawab',
      dataIndex: 'owner',
      key: 'owner',
      width: 150,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, color: '#0f172a' }}>
            {record.owner?.fullName || record.owner?.name || `User #${record.ownerId}`}
          </div>
        </div>
      ),
    },
    {
      title: 'Tgl Review',
      dataIndex: 'reviewDate',
      key: 'reviewDate',
      width: 130,
      render: (rDate: string | null, record) => (
        <div>
          <div style={{ fontSize: 12.5, color: '#334155' }}>
            {rDate ? dayjs(rDate).format('DD MMM YYYY') : '-'}
          </div>
          {record.isReviewOverdue && (
            <Tag color="volcano" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', fontWeight: 700 }}>
              REVIEW OVERDUE
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_, record) => {
        const isOwner = Number(record.ownerId) === Number(currentUserId);
        const isTerminal = [
          ProjectRiskStatus.MATERIALIZED,
          ProjectRiskStatus.CLOSED,
          ProjectRiskStatus.CANCELLED,
        ].includes(record.status);

        const canAssess = (isAssignedPm || isPmo) && !isTerminal;
        const canEditMitigation = (isAssignedPm || isPmo || isOwner) && !isTerminal;
        const canMitigate = (isAssignedPm || isPmo) && record.status === ProjectRiskStatus.ASSESSED;
        const canMaterialize =
          (isAssignedPm || isPmo || isHoo) &&
          [ProjectRiskStatus.ASSESSED, ProjectRiskStatus.MITIGATING, ProjectRiskStatus.MONITORING].includes(record.status);
        const canClose = (isAssignedPm || isPmo || isHoo) && !isTerminal && record.status !== ProjectRiskStatus.IDENTIFIED;
        const canCancel = (isAssignedPm || isPmo || isHoo) && !isTerminal;

        return (
          <Space size={4}>
            {onViewDetail && (
              <Tooltip title="Lihat Detail">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onViewDetail(record)}
                  data-testid={`view-risk-btn-${record.id}`}
                />
              </Tooltip>
            )}

            {canAssess && (
              <Tooltip title="Asesmen Skor 5x5">
                <Button
                  size="small"
                  icon={<FundProjectionScreenOutlined />}
                  onClick={() => setAssessTarget(record)}
                  data-testid={`assess-risk-btn-${record.id}`}
                >
                  Asesmen
                </Button>
              </Tooltip>
            )}

            {canEditMitigation && (
              <Tooltip title="Rencana Mitigasi">
                <Button
                  size="small"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => setMitigationTarget(record)}
                  data-testid={`mitigation-risk-btn-${record.id}`}
                />
              </Tooltip>
            )}

            {canMaterialize && (
              <Tooltip title="Materialisasi ke Issue">
                <Button
                  size="small"
                  type="primary"
                  danger
                  icon={<ThunderboltOutlined />}
                  onClick={() => setMaterializeTarget(record)}
                  data-testid={`materialize-risk-btn-${record.id}`}
                >
                  Materialisasi
                </Button>
              </Tooltip>
            )}

            {canClose && (
              <Popconfirm
                title="Tutup Risiko?"
                description="Status akan menjadi CLOSED (risiko tidak lagi mengancam)."
                onConfirm={() => handleCloseRisk(record)}
                okText="Tutup"
                cancelText="Batal"
              >
                <Button
                  size="small"
                  icon={<LockOutlined />}
                  data-testid={`close-risk-btn-${record.id}`}
                />
              </Popconfirm>
            )}

            {canCancel && (
              <Tooltip title="Batalkan Risiko">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setCancelTarget(record)}
                  data-testid={`cancel-risk-btn-${record.id}`}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* Filters & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space wrap size={10}>
          <Select
            placeholder="Filter Status"
            allowClear
            style={{ width: 140 }}
            value={filters.status}
            onChange={(val) => onFilterChange({ ...filters, status: val })}
            options={Object.values(ProjectRiskStatus).map((s) => ({ value: s, label: s }))}
          />
          <Select
            placeholder="Filter Level"
            allowClear
            style={{ width: 140 }}
            value={filters.riskLevel}
            onChange={(val) => onFilterChange({ ...filters, riskLevel: val })}
            options={Object.values(ProjectRiskLevel).map((l) => ({ value: l, label: l }))}
          />
          <Select
            placeholder="Filter Review Overdue"
            allowClear
            style={{ width: 160 }}
            value={filters.reviewOverdueOnly}
            onChange={(val) => onFilterChange({ ...filters, reviewOverdueOnly: val })}
            options={[
              { value: 'true', label: 'Hanya Review Overdue' },
            ]}
          />
        </Space>

        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            data-testid="create-risk-btn"
          >
            Daftarkan Risiko
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={risks}
        loading={loading}
        scroll={{ x: 1100 }}
        rowClassName={(record) =>
          Number(record.id) === Number(highlightedId) ? 'ant-table-row-selected highlight-target-row' : ''
        }
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          onChange: onPaginationChange,
        }}
        locale={{
          emptyText: <Empty description="Belum ada data Risiko terdaftar pada proyek ini" />,
        }}
      />

      {/* Modals */}
      {createModalOpen && (
        <CreateRiskModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            onRefresh();
          }}
          projectId={projectId}
          eligibleOwners={eligibleOwners}
        />
      )}

      {assessTarget && (
        <AssessRiskModal
          open={Boolean(assessTarget)}
          onClose={() => setAssessTarget(null)}
          onSuccess={() => {
            setAssessTarget(null);
            onRefresh();
          }}
          projectId={projectId}
          risk={assessTarget}
        />
      )}

      {mitigationTarget && (
        <UpdateMitigationModal
          open={Boolean(mitigationTarget)}
          onClose={() => setMitigationTarget(null)}
          onSuccess={() => {
            setMitigationTarget(null);
            onRefresh();
          }}
          projectId={projectId}
          risk={mitigationTarget}
        />
      )}

      {materializeTarget && (
        <MaterializeRiskModal
          open={Boolean(materializeTarget)}
          onClose={() => setMaterializeTarget(null)}
          onSuccess={() => {
            setMaterializeTarget(null);
            onRefresh();
          }}
          projectId={projectId}
          risk={materializeTarget}
          eligibleOwners={eligibleOwners}
        />
      )}

      {cancelTarget && (
        <CancelRecordModal
          open={Boolean(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onSuccess={() => {
            setCancelTarget(null);
            onRefresh();
          }}
          title="Batalkan Risiko"
          recordIdentifier={cancelTarget.riskNumber}
          onConfirm={(reason) =>
            ProjectIssueRiskService.cancelRisk(projectId, cancelTarget.id, cancelTarget.version, reason)
          }
        />
      )}
    </div>
  );
};
