import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Typography,
  Dropdown,
  Switch,
  Tooltip,
  Alert,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  DeleteOutlined,
  InboxOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import WorkflowDefinitionService, {
  WorkflowDefinition,
  CANONICAL_WORKFLOW_KEYS,
} from '@/services/workflowDefinition.service';

const { Title, Text } = Typography;

interface WorkflowListProps {
  onOpenDefinition: (workflowKey: string) => void;
  userRole: string;
  userRoles?: string[];
}

export const WorkflowList: React.FC<WorkflowListProps> = ({
  onOpenDefinition,
  userRole,
  userRoles = [],
}) => {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Create Modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Delete Confirmation Modal
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [targetDeleteWorkflow, setTargetDeleteWorkflow] = useState<WorkflowDefinition | null>(null);
  const [deleteInputKey, setDeleteInputKey] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Archive Confirmation Modal
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  const [targetArchiveWorkflow, setTargetArchiveWorkflow] = useState<WorkflowDefinition | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const isSuperAdmin =
    userRole === 'SUPER_ADMIN' || (userRoles && userRoles.includes('SUPER_ADMIN'));
  const canCreate = isSuperAdmin || userRole === 'HEAD_OF_OPERATIONS';

  const fetchDefinitions = async (archived = showArchived) => {
    try {
      setLoading(true);
      const data = await WorkflowDefinitionService.getDefinitions(archived);
      setDefinitions(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to fetch definitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions(showArchived);
  }, [showArchived]);

  const handleCreate = async (values: any) => {
    try {
      setLoading(true);
      const res = await WorkflowDefinitionService.createDefinition(values);
      message.success(`Workflow ${res.workflowKey} created successfully`);
      setIsModalVisible(false);
      form.resetFields();
      fetchDefinitions(showArchived);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (workflow: WorkflowDefinition) => {
    setTargetDeleteWorkflow(workflow);
    setDeleteInputKey('');
    setDeleteError(null);
    setIsDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!targetDeleteWorkflow) return;
    if (deleteInputKey !== targetDeleteWorkflow.workflowKey) return;

    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await WorkflowDefinitionService.deleteDefinition(targetDeleteWorkflow.workflowKey);
      message.success(`Workflow '${targetDeleteWorkflow.workflowKey}' deleted successfully`);
      setIsDeleteModalVisible(false);
      setTargetDeleteWorkflow(null);
      setDeleteInputKey('');
      await fetchDefinitions(showArchived);
    } catch (err: any) {
      const status = err?.response?.status;
      const backendMsg = err?.response?.data?.message;

      if (status === 403) {
        const msg = backendMsg || 'Forbidden: You are not authorized to delete this workflow.';
        setDeleteError(msg);
        message.error(msg);
      } else if (status === 404) {
        const msg = backendMsg || 'Workflow not found. The list has been refreshed.';
        setDeleteError(msg);
        message.warning(msg);
        setIsDeleteModalVisible(false);
        await fetchDefinitions(showArchived);
      } else if (status === 409) {
        const msg =
          backendMsg ||
          'Conflict: Workflow cannot be deleted due to existing dependencies or execution history.';
        setDeleteError(msg);
        message.error(msg);
      } else {
        const msg = backendMsg || 'Operation failed. An unexpected error occurred.';
        setDeleteError(msg);
        message.error(msg);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const openArchiveModal = (workflow: WorkflowDefinition) => {
    setTargetArchiveWorkflow(workflow);
    setArchiveError(null);
    setIsArchiveModalVisible(true);
  };

  const handleArchive = async () => {
    if (!targetArchiveWorkflow) return;

    try {
      setArchiveLoading(true);
      setArchiveError(null);
      await WorkflowDefinitionService.archiveDefinition(targetArchiveWorkflow.workflowKey);
      message.success(`Workflow '${targetArchiveWorkflow.workflowKey}' archived successfully`);
      setIsArchiveModalVisible(false);
      setTargetArchiveWorkflow(null);
      await fetchDefinitions(showArchived);
    } catch (err: any) {
      const status = err?.response?.status;
      const backendMsg = err?.response?.data?.message;

      if (status === 403) {
        const msg = backendMsg || 'Forbidden: You are not authorized to archive this workflow.';
        setArchiveError(msg);
        message.error(msg);
      } else if (status === 404) {
        const msg = backendMsg || 'Workflow not found. The list has been refreshed.';
        setArchiveError(msg);
        message.warning(msg);
        setIsArchiveModalVisible(false);
        await fetchDefinitions(showArchived);
      } else if (status === 409) {
        const msg =
          backendMsg ||
          'Conflict: Workflow cannot be archived because it has active instances.';
        setArchiveError(msg);
        message.error(msg);
      } else {
        const msg = backendMsg || 'Operation failed. An unexpected error occurred.';
        setArchiveError(msg);
        message.error(msg);
      }
    } finally {
      setArchiveLoading(false);
    }
  };

  const columns = [
    {
      title: 'Workflow Key',
      dataIndex: 'workflowKey',
      key: 'workflowKey',
      render: (text: string) => (
        <Space>
          <Text strong>{text}</Text>
          {CANONICAL_WORKFLOW_KEYS.includes(text) && (
            <Tooltip title="Canonical System Workflow (Protected)">
              <Tag icon={<LockOutlined />} color="purple" style={{ margin: 0 }}>
                Protected
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Domain',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain: string) => <Tag color="blue">{domain}</Tag>,
    },
    {
      title: 'Active Version',
      dataIndex: 'activeVersion',
      key: 'activeVersion',
      render: (v: number) => (v ? `v${v}` : <Text type="secondary">None</Text>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'PUBLISHED') color = 'green';
        else if (status === 'DRAFT') color = 'orange';
        else if (status === 'ARCHIVED') color = 'default';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: WorkflowDefinition) => {
        const isCanonical = CANONICAL_WORKFLOW_KEYS.includes(record.workflowKey);
        const isArchived = record.status === 'ARCHIVED';
        const canDelete = isSuperAdmin && !isCanonical && !isArchived && record.status === 'DRAFT';
        const canArchive = isSuperAdmin && !isCanonical && !isArchived && record.status === 'PUBLISHED';

        const menuItems: any[] = [];
        if (canDelete) {
          menuItems.push({
            key: 'delete',
            danger: true,
            icon: <DeleteOutlined />,
            label: 'Delete Workflow',
            onClick: () => openDeleteModal(record),
          });
        }
        if (canArchive) {
          menuItems.push({
            key: 'archive',
            icon: <InboxOutlined />,
            label: 'Archive Workflow',
            onClick: () => openArchiveModal(record),
          });
        }

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => onOpenDefinition(record.workflowKey)}
            >
              Open
            </Button>

            {menuItems.length > 0 && (
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Button
                  size="small"
                  icon={<MoreOutlined />}
                  data-testid={`more-actions-${record.workflowKey}`}
                  aria-label={`Actions for ${record.workflowKey}`}
                />
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 600 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Workflow Definitions
          </Title>
          <Text type="secondary">Manage enterprise workflows and approvals.</Text>
        </div>
        <Space size="middle">
          <Space>
            <Text type="secondary">Show Archived</Text>
            <Switch
              checked={showArchived}
              onChange={(checked) => setShowArchived(checked)}
              data-testid="show-archived-switch"
            />
          </Space>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
              Create Workflow
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={definitions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Create Modal */}
      <Modal
        title="Create New Workflow Definition"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="workflowKey"
            label="Workflow Key"
            rules={[{ required: true, message: 'Please input workflow key (e.g. PR_APPROVAL)' }]}
          >
            <Input placeholder="e.g. PR_APPROVAL" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Workflow Name"
            rules={[{ required: true, message: 'Please input workflow name' }]}
          >
            <Input placeholder="e.g. Purchase Request Approval" />
          </Form.Item>
          <Form.Item
            name="domain"
            label="Domain"
            rules={[{ required: true }]}
            initialValue="PROCUREMENT"
          >
            <Select>
              <Select.Option value="PROCUREMENT">Procurement</Select.Option>
              <Select.Option value="FINANCE">Finance</Select.Option>
              <Select.Option value="PROJECT">Project</Select.Option>
              <Select.Option value="LEGAL">Legal</Select.Option>
              <Select.Option value="GENERAL">General</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Workflow description..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Delete Workflow Definition</span>
          </Space>
        }
        open={isDeleteModalVisible}
        destroyOnClose
        onCancel={() => {
          if (!deleteLoading) {
            setIsDeleteModalVisible(false);
            setTargetDeleteWorkflow(null);
            setDeleteInputKey('');
            setDeleteError(null);
          }
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsDeleteModalVisible(false);
              setTargetDeleteWorkflow(null);
              setDeleteInputKey('');
              setDeleteError(null);
            }}
            disabled={deleteLoading}
          >
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deleteLoading}
            disabled={
              deleteLoading ||
              !targetDeleteWorkflow ||
              deleteInputKey !== targetDeleteWorkflow.workflowKey
            }
            onClick={handleDelete}
            data-testid="confirm-delete-btn"
          >
            Delete Workflow
          </Button>,
        ]}
      >
        {targetDeleteWorkflow && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="Destructive Action"
              description="This draft workflow will be permanently removed. This action cannot be undone."
            />

            {deleteError && (
              <Alert
                type="error"
                showIcon
                message="Delete Rejected"
                description={deleteError}
                data-testid="delete-error-alert"
              />
            )}

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Workflow Name">
                {targetDeleteWorkflow.name}
              </Descriptions.Item>
              <Descriptions.Item label="Workflow Key">
                <Text code strong>
                  {targetDeleteWorkflow.workflowKey}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Domain">
                <Tag color="blue">{targetDeleteWorkflow.domain}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color="orange">{targetDeleteWorkflow.status}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Text>
                To confirm, please type <Text code strong>{targetDeleteWorkflow.workflowKey}</Text>{' '}
                below:
              </Text>
              <Input
                style={{ marginTop: 8 }}
                placeholder={targetDeleteWorkflow.workflowKey}
                value={deleteInputKey}
                onChange={(e) => setDeleteInputKey(e.target.value.trim())}
                data-testid="delete-key-input"
                disabled={deleteLoading}
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        title={
          <Space>
            <InboxOutlined style={{ color: '#faad14' }} />
            <span>Archive Workflow Definition</span>
          </Space>
        }
        open={isArchiveModalVisible}
        destroyOnClose
        onCancel={() => {
          if (!archiveLoading) {
            setIsArchiveModalVisible(false);
            setTargetArchiveWorkflow(null);
            setArchiveError(null);
          }
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsArchiveModalVisible(false);
              setTargetArchiveWorkflow(null);
              setArchiveError(null);
            }}
            disabled={archiveLoading}
          >
            Cancel
          </Button>,
          <Button
            key="archive"
            type="primary"
            loading={archiveLoading}
            disabled={archiveLoading}
            onClick={handleArchive}
            data-testid="confirm-archive-btn"
          >
            Archive Workflow
          </Button>,
        ]}
      >
        {targetArchiveWorkflow && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Workflow Retirement"
              description="Archiving will deactivate this workflow. It can no longer be used for new instances or versions. All completed execution history and records remain fully intact."
            />

            {archiveError && (
              <Alert
                type="error"
                showIcon
                message="Archive Rejected"
                description={archiveError}
                data-testid="archive-error-alert"
              />
            )}

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Workflow Name">
                {targetArchiveWorkflow.name}
              </Descriptions.Item>
              <Descriptions.Item label="Workflow Key">
                <Text code strong>
                  {targetArchiveWorkflow.workflowKey}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Domain">
                <Tag color="blue">{targetArchiveWorkflow.domain}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Active Version">
                {targetArchiveWorkflow.activeVersion
                  ? `v${targetArchiveWorkflow.activeVersion}`
                  : 'None'}
              </Descriptions.Item>
              <Descriptions.Item label="Current Status">
                <Tag color="green">{targetArchiveWorkflow.status}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  );
};

