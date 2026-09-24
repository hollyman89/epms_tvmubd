'use client';

import React from 'react';
import { Drawer, Typography, Table, Tag, Space, Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ProgressLedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: any[];
}

export const ProgressLedgerDrawer: React.FC<ProgressLedgerDrawerProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Task',
      dataIndex: 'taskName',
      key: 'taskName',
      render: (text: string, record: any) => text || record.taskCode,
    },
    {
      title: 'Type',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type: string, record: any) => {
        let color = 'default';
        if (type === 'ROUTINE_UPDATE') color = 'blue';
        if (type === 'CRITICAL_EVENT') color = 'warning';
        if (type === 'MILESTONE_COMPLETION') color = 'purple';
        if (record.progressDelta < 0) color = 'error';
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: any) => (
        <Space>
          <Text type="secondary">{record.previousProgress}%</Text>
          <Text type="secondary">{'->'}</Text>
          <Text strong>{record.reportedProgress}%</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'OFFICIAL') color = 'success';
        if (status === 'PENDING_VERIFICATION') color = 'processing';
        if (status === 'REJECTED') color = 'error';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Submitter',
      dataIndex: 'submitterName',
      key: 'submitterName',
    },
    {
      title: 'Evidence',
      key: 'evidence',
      render: (_: any, record: any) => {
        if (!record.evidence || record.evidence.length === 0) return '-';
        return (
          <Space direction="vertical" size="small">
            {record.evidence.map((ev: any) => (
              <Button 
                key={ev.id} 
                type="link" 
                icon={<FileTextOutlined />} 
                size="small" 
                style={{ padding: 0 }}
              >
                {ev.fileName || `Doc #${ev.documentId}`}
              </Button>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Remarks / Rejection',
      key: 'remarks',
      render: (_: any, record: any) => (
        <Space direction="vertical" size="small" style={{ maxWidth: 200 }}>
          {record.reason && (
            <div><Text type="secondary">Reason:</Text> <Text>{record.reason}</Text></div>
          )}
          {record.rejectionReason && (
            <div><Text type="danger">Rejected:</Text> <Text>{record.rejectionReason}</Text></div>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Drawer
      title="Project Progress Ledger"
      width={1000}
      open={isOpen}
      onClose={onClose}
    >
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        size="small"
      />
    </Drawer>
  );
};
