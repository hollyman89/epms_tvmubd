'use client';
import React, { useState, useEffect } from 'react';
import { Table, Typography, Tag, Space, message, Card } from 'antd';
import { LegalService } from '@/services';
import { MainLayout } from '../../../components/MainLayout';
import { ProtectedRoute } from '../../../components/ProtectedRoute';

const { Title, Text } = Typography;

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const dataArr = await LegalService.getContracts();
      setContracts(Array.isArray(dataArr) ? dataArr : []);
    } catch (error) {
      message.error('Gagal memuat data Contracts');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'No. Kontrak',
      dataIndex: 'contract_number',
      key: 'contract_number',
      render: (text: string) => <Text strong>{text || '-'}</Text>
    },
    {
      title: 'Nilai Kontrak',
      dataIndex: 'contract_value',
      key: 'contract_value',
      render: (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`
    },
    {
      title: 'Status',
      dataIndex: 'legal_status',
      key: 'legal_status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'APPROVED') color = 'success';
        if (status === 'ON_REVIEW') color = 'processing';
        if (status === 'REJECTED') color = 'error';
        return <Tag color={color}>{status || 'DRAFT'}</Tag>;
      }
    },
    {
      title: 'Project Manager',
      key: 'project_manager',
      render: (_: any, record: any) => {
        const pmName = record.project_manager?.name || '-';
        return <Text>{pmName}</Text>;
      }
    }
  ];

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL', 'DIRECTOR', 'PROJECT_MANAGER', 'HEAD_OF_OPERATIONS']}>
      <MainLayout>
        <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
          <Title level={2}>Contracts</Title>
          <Text type="secondary">Daftar kontrak yang telah sah untuk dieksekusi oleh Operasional.</Text>
          
          <Card style={{ marginTop: 24 }} bodyStyle={{ padding: 0 }}>
            <Table
              columns={columns}
              dataSource={contracts}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
