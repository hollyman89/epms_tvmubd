'use client';

import React, { useState } from 'react';
import {
  Card,
  Table,
  Typography,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Alert,
  Empty,
  Badge,
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined,
  EyeOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  ProcurementService,
  UnresolvedReconciliationItem,
} from '@/services/procurement.service';
import { ReconciliationItemModal } from './ReconciliationItemModal';
import { useAuth } from '@/context/AuthContext';

const { Title, Text } = Typography;

export interface ReconciliationTabProps {
  onReconciliationChanged?: () => void;
}

export const ReconciliationTab: React.FC<ReconciliationTabProps> = ({
  onReconciliationChanged,
}) => {
  const { user, isProcurement, isSuperAdmin, isProjectManager } = useAuth();
  const userRoles = (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());

  // Authorized GET roles matching backend @Roles: PROCUREMENT, PURCHASING, PROJECT_MANAGER, SUPER_ADMIN, ADMIN
  const canRead =
    isProcurement ||
    isSuperAdmin ||
    isProjectManager ||
    userRoles.includes('PURCHASING') ||
    userRoles.includes('ADMIN');

  // Authorized Mutation roles matching backend @Roles: PROCUREMENT, PURCHASING, SUPER_ADMIN, ADMIN
  const canMutate =
    isProcurement ||
    isSuperAdmin ||
    userRoles.includes('PURCHASING') ||
    userRoles.includes('ADMIN');

  const [originFilter, setOriginFilter] = useState<'ALL' | 'LEGACY' | 'AD_HOC'>('ALL');
  const [selectedPrItemId, setSelectedPrItemId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const {
    data: unresolvedItems = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['procurement', 'reconciliations', originFilter],
    queryFn: () =>
      ProcurementService.getUnresolvedReconciliations({
        origin: originFilter === 'ALL' ? undefined : originFilter,
      }),
    enabled: Boolean(user && canRead),
    staleTime: 30 * 1000,
  });

  const columns = [
    {
      title: 'Nomor PR',
      key: 'prNumber',
      width: 170,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
            {r.purchaseRequest?.prNumber || `PR-${r.prId}`}
          </span>
          <div style={{ fontSize: 10.5, color: '#64748b' }}>Item ID: #{r.id}</div>
        </div>
      ),
    },
    {
      title: 'Asal Pengadaan (Origin)',
      key: 'origin',
      width: 130,
      render: (_: any, r: UnresolvedReconciliationItem) => {
        const origin = r.purchaseRequest?.origin || 'AD_HOC';
        const color = origin === 'LEGACY' ? 'purple' : 'orange';
        return (
          <Tag color={color} style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
            ● {origin}
          </Tag>
        );
      },
    },
    {
      title: 'Proyek',
      key: 'project',
      width: 240,
      render: (_: any, r: UnresolvedReconciliationItem) => {
        const p = r.purchaseRequest?.project;
        return p ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0f172a' }}>{p.name}</div>
            {p.code && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{p.code}</Tag>}
          </div>
        ) : (
          <span style={{ color: '#94a3b8' }}>Proyek #{r.purchaseRequest?.projectId || '—'}</span>
        );
      },
    },
    {
      title: 'Nama Item PR Historis',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (val: string) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{val}</span>,
    },
    {
      title: 'Jumlah',
      key: 'quantity',
      width: 120,
      align: 'right' as const,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
          {Number(r.quantity || 0).toLocaleString('id-ID')} {r.uom || 'Unit'}
        </span>
      ),
    },
    {
      title: 'Estimasi Harga Satuan',
      dataIndex: 'estimatedUnitPrice',
      key: 'estimatedUnitPrice',
      width: 140,
      align: 'right' as const,
      render: (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`,
    },
    {
      title: 'Status PR',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <Tag color="cyan" style={{ fontWeight: 600, margin: 0 }}>
          {r.purchaseRequest?.status || 'SUBMITTED'}
        </Tag>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 140,
      align: 'center' as const,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <Button
          size="small"
          type="primary"
          icon={<SafetyCertificateOutlined />}
          onClick={() => {
            setSelectedPrItemId(r.id);
            setIsModalOpen(true);
          }}
          style={{
            backgroundColor: canMutate ? '#2563eb' : '#64748b',
            borderColor: canMutate ? '#2563eb' : '#64748b',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 11.5,
          }}
        >
          {canMutate ? 'Rekonsiliasi Item' : 'Lihat Detail'}
        </Button>
      ),
    },
  ];

  if (!canRead) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Akses Rekonsiliasi Terbatas"
        description="Tab Rekonsiliasi hanya dapat diakses oleh role Procurement, Purchasing, Project Manager, dan Super Admin sesuai kebijakan backend."
        style={{ margin: '16px 0' }}
      />
    );
  }

  return (
    <div>
      <Card
        size="small"
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          marginBottom: 24,
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '4px 0' }}>
            <Space size={8}>
              <SafetyCertificateOutlined style={{ color: '#2563eb', fontSize: 17 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                Antrean Rekonsiliasi Pengadaan Historis (LEGACY &amp; AD_HOC)
              </span>
              <Tag
                color={unresolvedItems.length > 0 ? 'volcano' : 'green'}
                style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}
              >
                {unresolvedItems.length} Item Belum Selesai
              </Tag>
            </Space>

            <Space size={10}>
              <Space size={4}>
                <FilterOutlined style={{ color: '#64748b', fontSize: 12 }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>Origin:</span>
                <Select
                  size="small"
                  value={originFilter}
                  onChange={(v) => setOriginFilter(v)}
                  style={{ width: 130 }}
                  options={[
                    { value: 'ALL', label: 'Semua Origin' },
                    { value: 'LEGACY', label: 'LEGACY' },
                    { value: 'AD_HOC', label: 'AD_HOC' },
                  ]}
                />
              </Space>

              <Button
                size="small"
                type="text"
                icon={<SyncOutlined spin={isLoading} />}
                onClick={() => refetch()}
                style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 600 }}
              >
                Refresh
              </Button>
            </Space>
          </div>
        }
      >
        {unresolvedItems.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleFilled style={{ color: '#d97706' }} />}
            message={<span style={{ fontWeight: 700 }}>Safety Gate Concurrency &amp; Quota Aktif</span>}
            description={
              <div style={{ fontSize: 12, color: '#92400e' }}>
                Item di bawah merupakan pengadaan langsung historis atau ad-hoc yang belum dipetakan ke CostItem RAB aktif.
                Paket pengadaan baru pada proyek yang bersangkutan akan ditangguhkan oleh server (HTTP 422) hingga seluruh item direkonsiliasi atau dieksklusi.
              </div>
            }
            style={{ marginBottom: 16, backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
          />
        ) : (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleFilled style={{ color: '#059669' }} />}
            message={<span style={{ fontWeight: 700 }}>Safety Gate Bersih — Seluruh Item Terekonsiliasi</span>}
            description="Tidak ada item PR legacy atau ad-hoc yang menggantung. Seluruh pengadaan proyek berada pada jalur paket pengadaan canonical."
            style={{ marginBottom: 16, backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}
          />
        )}

        <Table
          columns={columns}
          dataSource={unresolvedItems}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                      Tidak ada antrean rekonsiliasi yang tertunda
                    </div>
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      Semua transaksi telah terekonsiliasi secara aman ke RAB proyek.
                    </Text>
                  </div>
                }
              />
            ),
          }}
        />
      </Card>

      {/* Reconcile / Exclude Modal */}
      {selectedPrItemId && (
        <ReconciliationItemModal
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPrItemId(null);
          }}
          prItemId={selectedPrItemId}
          onSuccess={() => {
            refetch();
            if (onReconciliationChanged) onReconciliationChanged();
          }}
        />
      )}
    </div>
  );
};
