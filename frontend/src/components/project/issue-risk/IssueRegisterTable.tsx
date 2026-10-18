import React, { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Tooltip,
  Dropdown,
  Popconfirm,
  Badge,
  Typography,
  Card,
  Input,
  Select,
  Row,
  Col,
  Empty,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UndoOutlined,
  LockOutlined,
  MoreOutlined,
  SearchOutlined,
  FilterOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProjectIssueItem,
  ProjectIssueStatus,
  ProjectIssueSeverity,
  ProjectIssuePriority,
  ProjectIssueRiskCategory,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';
import { CreateIssueModal, ResolveIssueModal, ReopenIssueModal, CancelRecordModal } from './IssueModals';

const { Text } = Typography;

interface IssueRegisterTableProps {
  projectId: number;
  issues: ProjectIssueItem[];
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
  onViewDetail?: (record: ProjectIssueItem) => void;
}

export const IssueRegisterTable: React.FC<IssueRegisterTableProps> = ({
  projectId,
  issues,
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
  const [resolveTarget, setResolveTarget] = useState<ProjectIssueItem | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ProjectIssueItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ProjectIssueItem | null>(null);

  const isPmo = currentUserRoles.includes('PMO');
  const isHoo = currentUserRoles.includes('HEAD_OF_OPERATIONS');
  const canCreate = isAssignedPm || isPmo;

  // Status and Severity Helpers
  const getSeverityTag = (sev: string) => {
    switch (sev) {
      case ProjectIssueSeverity.CRITICAL:
        return <Tag color="red" style={{ fontWeight: 700 }}>CRITICAL</Tag>;
      case ProjectIssueSeverity.HIGH:
        return <Tag color="orange" style={{ fontWeight: 600 }}>HIGH</Tag>;
      case ProjectIssueSeverity.MEDIUM:
        return <Tag color="gold">MEDIUM</Tag>;
      default:
        return <Tag color="green">LOW</Tag>;
    }
  };

  const getPriorityTag = (prio: string) => {
    switch (prio) {
      case ProjectIssuePriority.URGENT:
        return <Tag color="magenta" style={{ fontWeight: 700 }}>URGENT</Tag>;
      case ProjectIssuePriority.HIGH:
        return <Tag color="volcano" style={{ fontWeight: 600 }}>HIGH</Tag>;
      case ProjectIssuePriority.MEDIUM:
        return <Tag color="blue">MEDIUM</Tag>;
      default:
        return <Tag color="default">LOW</Tag>;
    }
  };

  const getStatusTag = (status: ProjectIssueStatus) => {
    switch (status) {
      case ProjectIssueStatus.OPEN:
        return <Tag color="blue">OPEN</Tag>;
      case ProjectIssueStatus.IN_PROGRESS:
        return <Tag color="processing">IN_PROGRESS</Tag>;
      case ProjectIssueStatus.RESOLVED:
        return <Tag color="green">RESOLVED</Tag>;
      case ProjectIssueStatus.CLOSED:
        return <Tag color="default">CLOSED</Tag>;
      case ProjectIssueStatus.CANCELLED:
        return <Tag color="error">CANCELLED</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const handleStart = async (issue: ProjectIssueItem) => {
    try {
      await ProjectIssueRiskService.startIssue(projectId, issue.id, issue.version);
      message.success(`Issue ${issue.issueNumber} dimulai.`);
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Gagal memulai Issue');
    }
  };

  const handleClose = async (issue: ProjectIssueItem) => {
    try {
      await ProjectIssueRiskService.closeIssue(projectId, issue.id, issue.version);
      message.success(`Issue ${issue.issueNumber} ditutup (CLOSED).`);
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Gagal menutup Issue');
    }
  };

  const columns: ColumnsType<ProjectIssueItem> = [
    {
      title: 'Nomor Issue',
      dataIndex: 'issueNumber',
      key: 'issueNumber',
      width: 150,
      render: (num: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#0f172a' }} data-testid={`issue-number-${record.id}`}>{num}</Text>
          {record.sourceRiskId && (
            <Tag color="cyan" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              Materialized Risk
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Judul & Deskripsi',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#64748b', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (sev: string) => getSeverityTag(sev),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (prio: string) => getPriorityTag(prio),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (st: ProjectIssueStatus) => getStatusTag(st),
    },
    {
      title: 'Penanggung Jawab',
      dataIndex: 'owner',
      key: 'owner',
      width: 160,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, color: '#0f172a' }}>
            {record.owner?.fullName || record.owner?.name || `User #${record.ownerId}`}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {record.owner?.email || ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Target Selesai',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 130,
      render: (dueDate: string | null, record) => (
        <div>
          <div style={{ fontSize: 12.5, color: '#334155' }}>
            {dueDate ? dayjs(dueDate).format('DD MMM YYYY') : '-'}
          </div>
          {record.isOverdue && (
            <Tag color="error" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', fontWeight: 700 }}>
              OVERDUE
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => {
        const isOwner = Number(record.ownerId) === Number(currentUserId);
        const canStart = (isAssignedPm || isPmo || isOwner) && record.status === ProjectIssueStatus.OPEN;
        const canResolve = (isAssignedPm || isPmo || isOwner) && record.status === ProjectIssueStatus.IN_PROGRESS;
        const canClose = (isAssignedPm || isPmo || isHoo) && record.status === ProjectIssueStatus.RESOLVED;
        const canReopenResolved = (isAssignedPm || isPmo || isHoo) && record.status === ProjectIssueStatus.RESOLVED;
        const canReopenClosed = (isPmo || isHoo) && record.status === ProjectIssueStatus.CLOSED;
        const canCancel = (isAssignedPm || isPmo || isHoo) && [ProjectIssueStatus.OPEN, ProjectIssueStatus.IN_PROGRESS].includes(record.status);

        return (
          <Space size={4}>
            {onViewDetail && (
              <Tooltip title="Lihat Detail">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onViewDetail(record)}
                  data-testid={`view-issue-btn-${record.id}`}
                />
              </Tooltip>
            )}

            {canStart && (
              <Tooltip title="Mulai Penanganan">
                <Button
                  size="small"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleStart(record)}
                  data-testid={`start-issue-btn-${record.id}`}
                >
                  Mulai
                </Button>
              </Tooltip>
            )}

            {canResolve && (
              <Tooltip title="Tandai Selesai">
                <Button
                  size="small"
                  style={{ backgroundColor: '#16a34a', color: '#fff', borderColor: '#16a34a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => setResolveTarget(record)}
                  data-testid={`resolve-issue-btn-${record.id}`}
                >
                  Resolve
                </Button>
              </Tooltip>
            )}

            {canClose && (
              <Popconfirm
                title="Tutup Issue?"
                description="Status akan menjadi CLOSED secara permanen."
                onConfirm={() => handleClose(record)}
                okText="Tutup"
                cancelText="Batal"
              >
                <Button
                  size="small"
                  icon={<LockOutlined />}
                  data-testid={`close-issue-btn-${record.id}`}
                >
                  Close
                </Button>
              </Popconfirm>
            )}

            {(canReopenResolved || canReopenClosed) && (
              <Tooltip title="Buka Kembali">
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => setReopenTarget(record)}
                  data-testid={`reopen-issue-btn-${record.id}`}
                >
                  Reopen
                </Button>
              </Tooltip>
            )}

            {canCancel && (
              <Tooltip title="Batalkan Issue">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setCancelTarget(record)}
                  data-testid={`cancel-issue-btn-${record.id}`}
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
            options={Object.values(ProjectIssueStatus).map((s) => ({ value: s, label: s }))}
          />
          <Select
            placeholder="Filter Severity"
            allowClear
            style={{ width: 140 }}
            value={filters.severity}
            onChange={(val) => onFilterChange({ ...filters, severity: val })}
            options={Object.values(ProjectIssueSeverity).map((s) => ({ value: s, label: s }))}
          />
          <Select
            placeholder="Filter Priority"
            allowClear
            style={{ width: 140 }}
            value={filters.priority}
            onChange={(val) => onFilterChange({ ...filters, priority: val })}
            options={Object.values(ProjectIssuePriority).map((p) => ({ value: p, label: p }))}
          />
          <Select
            placeholder="Filter Overdue"
            allowClear
            style={{ width: 130 }}
            value={filters.overdueOnly}
            onChange={(val) => onFilterChange({ ...filters, overdueOnly: val })}
            options={[
              { value: 'true', label: 'Hanya Overdue' },
            ]}
          />
        </Space>

        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            data-testid="create-issue-btn"
          >
            Daftarkan Issue
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={issues}
        loading={loading}
        scroll={{ x: 1000 }}
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
          emptyText: <Empty description="Belum ada data Issue terdaftar pada proyek ini" />,
        }}
      />

      {/* Modals */}
      {createModalOpen && (
        <CreateIssueModal
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

      {resolveTarget && (
        <ResolveIssueModal
          open={Boolean(resolveTarget)}
          onClose={() => setResolveTarget(null)}
          onSuccess={() => {
            setResolveTarget(null);
            onRefresh();
          }}
          projectId={projectId}
          issue={resolveTarget}
        />
      )}

      {reopenTarget && (
        <ReopenIssueModal
          open={Boolean(reopenTarget)}
          onClose={() => setReopenTarget(null)}
          onSuccess={() => {
            setReopenTarget(null);
            onRefresh();
          }}
          projectId={projectId}
          issue={reopenTarget}
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
          title="Batalkan Issue"
          recordIdentifier={cancelTarget.issueNumber}
          onConfirm={(reason) =>
            ProjectIssueRiskService.cancelIssue(projectId, cancelTarget.id, cancelTarget.version, reason)
          }
        />
      )}
    </div>
  );
};
