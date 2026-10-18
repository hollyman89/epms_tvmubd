'use client';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Typography, Tag, message, Card } from 'antd';
import { LegalService } from '@/services';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { formatCurrency } from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UserIdentityDisplay } from '@/components/common/UserIdentityDisplay';

const { Title, Text } = Typography;

export default function ContractsPage() {
  const { data: contracts = [], isLoading: loading } = useQuery({
    queryKey: ['governance-contracts'],
    queryFn: async () => {
      try {
        const dataArr = await LegalService.getContracts();
        return Array.isArray(dataArr) ? dataArr : [];
      } catch (error) {
        message.error('Gagal memuat data Contracts');
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const columns = useMemo(() => [
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
      render: (val: number) => formatCurrency(val)
    },
    {
      title: 'Status',
      dataIndex: 'legal_status',
      key: 'legal_status',
      render: (status: string) => <StatusBadge domain="legal" status={status || 'DRAFT'} />
    },
    {
      title: 'Project Manager',
      key: 'project_manager',
      render: (_: any, record: any) => {
        if (!record.project_manager && !record.project_manager_id) {
          return <Text>-</Text>;
        }
        return (
          <UserIdentityDisplay
            user={record.project_manager}
            userId={record.project_manager_id}
            fallbackText="-"
            showEmail
          />
        );
      }
    }
  ], []);

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL', 'DIRECTOR', 'HEAD_OF_OPERATIONS']}>
      <div>
        <Title level={3} style={{ fontSize: '24px', fontWeight: 600, lineHeight: '32px', margin: 0, color: '#0f172a' }}>
          Contracts
        </Title>
        <Text type="secondary" style={{ fontSize: 13, color: '#64748b', display: 'block', marginTop: 4 }}>
          Daftar kontrak yang telah sah untuk dieksekusi oleh Operasional.
        </Text>
        
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
    </ProtectedRoute>
  );
}
