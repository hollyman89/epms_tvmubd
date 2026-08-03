'use client';

import React, { useState, useEffect } from 'react';
import { Card, Tag, Typography, Space, Button, Table, Modal, Input, message, Progress, Badge } from 'antd';
import { ClockCircleOutlined, PlusOutlined, FieldTimeOutlined, WarningOutlined } from '@ant-design/icons';
import { LegalService } from '@/services';

const { Text } = Typography;

export interface GraceExtensionItem {
  contractId: number;
  contractNumber: string;
  extensionCount: number;
  maxLimit: number;
  graceDeadline: string;
  extendedAt: string;
  status: string;
}

export const SlaGraceExtensionWidget: React.FC = () => {
  const [data, setData] = useState<GraceExtensionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchGraceData();
  }, []);

  const fetchGraceData = async () => {
    setLoading(true);
    try {
      const resData = await LegalService.getSlaGrace();
      if (resData) {
        setData(resData);
      }
    } catch (err) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestGrace = async () => {
    if (!selectedContractId) return;
    setSubmitting(true);
    try {
      await LegalService.requestGraceExtension(selectedContractId, { daysToAdd: 3, reason });
      message.success('Perpanjangan Grace SLA (+3 Hari) berhasil diterapkan!');
      setModalOpen(false);
      setReason('');
      fetchGraceData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal mengajukan grace SLA extension');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'No. Kontrak',
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: 'Batas Grace SLA',
      dataIndex: 'graceDeadline',
      key: 'graceDeadline',
      render: (dateStr: string) => (
        <Space size={4}>
          <ClockCircleOutlined style={{ color: '#d97706' }} />
          <Text style={{ fontSize: 12 }}>{new Date(dateStr).toLocaleDateString('id-ID')}</Text>
        </Space>
      ),
    },
    {
      title: 'Progress Perpanjangan (Max 3x)',
      key: 'progress',
      render: (_: any, record: GraceExtensionItem) => {
        const percent = Math.round((record.extensionCount / record.maxLimit) * 100);
        const isMaxed = record.extensionCount >= record.maxLimit;
        return (
          <Space>
            <Progress
              percent={percent}
              size="small"
              status={isMaxed ? 'exception' : 'active'}
              style={{ width: 100 }}
              format={() => `${record.extensionCount}/${record.maxLimit}`}
            />
            {isMaxed && <Tag color="error">Batas Maksimal</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: any, record: GraceExtensionItem) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<PlusOutlined />}
          disabled={record.extensionCount >= record.maxLimit}
          onClick={() => {
            setSelectedContractId(record.contractId);
            setModalOpen(true);
          }}
        >
          Perpanjang (+3 Hari)
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <FieldTimeOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <Text strong style={{ fontSize: 14 }}>SLA Grace Deadline Extension Monitor</Text>
          <Badge count={data.length} overflowCount={99} style={{ backgroundColor: '#d97706' }} />
        </Space>
      }
      style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <Table
        dataSource={data}
        columns={columns}
        rowKey="contractId"
        loading={loading}
        pagination={false}
        size="small"
      />

      {/* Modal Form Grace SLA Request */}
      <Modal
        title="Pengajuan Perpanjangan Grace SLA (+3 Hari)"
        open={modalOpen}
        onOk={handleRequestGrace}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        okText="Terapkan Grace Extension"
        cancelText="Batal"
      >
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Alasan Perpanjangan Grace SLA (Wajib diisi untuk audit trail):
          </Text>
          <Input.TextArea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masukkan catatan alasan perbaikan revisi dokumen dari Legal..."
          />
        </div>
      </Modal>
    </Card>
  );
};
