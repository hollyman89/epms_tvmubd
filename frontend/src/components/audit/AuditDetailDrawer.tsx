"use client";

import React from 'react';
import { Drawer, Descriptions, Tag, Typography, Space, Card, Divider, Alert, Empty } from 'antd';
import {
  HistoryOutlined,
  UserOutlined,
  DatabaseOutlined,
  FieldTimeOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AuditLogRecord } from '@/services/audit.service';

const { Title, Text, Paragraph } = Typography;

interface AuditDetailDrawerProps {
  open: boolean;
  record: AuditLogRecord | null;
  onClose: () => void;
}

const getActionColor = (action?: string) => {
  if (!action) return 'default';
  const upper = action.toUpperCase();
  if (upper.includes('CREATE')) return 'success';
  if (upper.includes('UPDATE')) return 'processing';
  if (upper.includes('DELETE')) return 'error';
  if (upper.includes('APPROVED')) return 'green';
  if (upper.includes('REJECTED')) return 'volcano';
  if (upper.includes('SAVED')) return 'cyan';
  return 'default';
};

export const AuditDetailDrawer: React.FC<AuditDetailDrawerProps> = ({
  open,
  record,
  onClose,
}) => {
  if (!record) return null;

  const formattedDate = dayjs(record.created_at).format('DD MMMM YYYY, HH:mm:ss');
  const actionColor = getActionColor(record.action);

  return (
    <Drawer
      title={
        <Space align="center">
          <HistoryOutlined style={{ color: '#1677ff', fontSize: '18px' }} />
          <span>Detail Jejak Audit #{record.id}</span>
          <Tag color={actionColor} style={{ marginLeft: 8, fontWeight: 600 }}>
            {record.action}
          </Tag>
        </Space>
      }
      placement="right"
      width={720}
      onClose={onClose}
      open={open}
      destroyOnClose
      styles={{
        body: { paddingBottom: 80, background: '#f8fafc' },
      }}
    >
      <Alert
        message="Data Jejak Audit Bersifat Permanen & Append-Only"
        description="Catatan audit ini tersimpan secara permanen di server untuk keperluan tata kelola enterprise dan audit historis."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 20 }}
      />

      {/* Basic Information */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined style={{ color: '#1677ff' }} />
            <span>Informasi Transaksi</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 20, borderRadius: 8 }}
      >
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="ID Audit">
            <Text strong>#{record.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Waktu Server">
            <Space>
              <FieldTimeOutlined style={{ color: '#8c8c8c' }} />
              <Text>{formattedDate}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Entitas / Tabel">
            <Space>
              <DatabaseOutlined style={{ color: '#8c8c8c' }} />
              <Tag color="blue" style={{ fontFamily: 'monospace' }}>
                {record.table_name}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Record ID">
            <Text code strong>
              #{record.record_id}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Aktor / Pelaku" span={2}>
            <Space direction="vertical" size={2}>
              <Space>
                <UserOutlined style={{ color: '#1677ff' }} />
                <Text strong>{record.actor?.full_name || `User #${record.created_by}`}</Text>
                {record.created_by === 0 && <Tag color="gold">SISTEM</Tag>}
              </Space>
              {record.actor?.email && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.actor.email}
                </Text>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="IP Address">
            <Text style={{ fontFamily: 'monospace' }}>
              {record.ip_address || '-'}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="User Agent">
            <Paragraph
              ellipsis={{ rows: 2, expandable: true, symbol: 'detail' }}
              style={{ fontSize: 12, marginBottom: 0, fontFamily: 'monospace' }}
            >
              {record.user_agent || '-'}
            </Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Snapshot Before vs After */}
      <Title level={5} style={{ marginBottom: 12 }}>
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <span>Perbandingan Snapshot Data (Before vs After)</span>
        </Space>
      </Title>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {/* Before (Old Value) */}
        <Card
          title={
            <Space>
              <Tag color="default">SEBELUM (Old Value)</Tag>
              {record.old_value === null && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (Tidak ada data sebelumnya)
                </Text>
              )}
            </Space>
          }
          size="small"
          style={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          {record.old_value !== null ? (
            <pre
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                lineHeight: '1.6',
                overflowX: 'auto',
                margin: 0,
                maxHeight: '320px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              }}
            >
              {JSON.stringify(record.old_value, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <Text type="secondary">
                Entitas baru dibuat (Operasi CREATE). Tidak ada snapshot sebelumnya.
              </Text>
            </div>
          )}
        </Card>

        {/* After (New Value) */}
        <Card
          title={
            <Space>
              <Tag color="success">SESUDAH (New Value)</Tag>
              {record.new_value === null && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (Data dihapus)
                </Text>
              )}
            </Space>
          }
          size="small"
          style={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          {record.new_value !== null ? (
            <pre
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                lineHeight: '1.6',
                overflowX: 'auto',
                margin: 0,
                maxHeight: '320px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              }}
            >
              {JSON.stringify(record.new_value, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <Text type="secondary">
                Entitas telah dihapus (Operasi SOFT_DELETE).
              </Text>
            </div>
          )}
        </Card>
      </div>
    </Drawer>
  );
};

export default AuditDetailDrawer;
