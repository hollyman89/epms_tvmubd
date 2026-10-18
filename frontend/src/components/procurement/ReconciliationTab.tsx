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
  Alert,
  Empty,
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  ProcurementService,
  UnresolvedReconciliationItem,
} from '@/services/procurement.service';
import { ReconciliationItemModal } from './ReconciliationItemModal';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatQuantity } from '@/lib/formatters';
import styles from './ProcurementPage.module.css';

const { Text } = Typography;

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

  // Authorized Mutation roles: PROCUREMENT, PURCHASING
  const canMutate =
    isProcurement ||
    userRoles.includes('PURCHASING');

  const [originFilter, setOriginFilter] = useState<'ALL' | 'LEGACY' | 'AD_HOC'>('ALL');
  const [selectedPrItemId, setSelectedPrItemId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const {
    data: unresolvedItems = [],
    isLoading,
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
      title: 'NOMOR PR',
      key: 'prNumber',
      width: 170,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <div>
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#0F172A' }}>
            {r.purchaseRequest?.prNumber || `PR-${r.prId}`}
          </span>
          <div style={{ fontSize: 10.5, color: '#64748B' }}>Item ID: #{r.id}</div>
        </div>
      ),
    },
    {
      title: 'ASAL PENGADAAN',
      key: 'origin',
      width: 140,
      render: (_: any, r: UnresolvedReconciliationItem) => {
        const origin = r.purchaseRequest?.origin || 'AD_HOC';
        const color = origin === 'LEGACY' ? 'purple' : 'orange';
        return (
          <Tag color={color} style={{ fontWeight: 700, borderRadius: 4, margin: 0, fontSize: 11 }}>
            ● {origin}
          </Tag>
        );
      },
    },
    {
      title: 'PROYEK',
      key: 'project',
      width: 220,
      render: (_: any, r: UnresolvedReconciliationItem) => {
        const p = r.purchaseRequest?.project;
        return p ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>{p.name}</div>
            {p.code && (
              <span className={styles.subtleCodeTag} style={{ background: '#F1F5F9', color: '#475569', display: 'inline-block', marginTop: 2 }}>
                {p.code}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: '#94A3B8' }}>Proyek #{r.purchaseRequest?.projectId || '—'}</span>
        );
      },
    },
    {
      title: 'NAMA ITEM PR HISTORIS',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (val: string) => <span style={{ fontWeight: 600, color: '#1E293B', fontSize: 12.5 }}>{val}</span>,
    },
    {
      title: 'JUMLAH',
      key: 'quantity',
      width: 130,
      align: 'right' as const,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <span className={styles.currencyText} style={{ color: '#1D4ED8' }}>
          {formatQuantity(Number(r.quantity || 0))} {r.uom || 'Unit'}
        </span>
      ),
    },
    {
      title: 'ESTIMASI HARGA SATUAN',
      dataIndex: 'estimatedUnitPrice',
      key: 'estimatedUnitPrice',
      width: 160,
      align: 'right' as const,
      render: (val: number) => (
        <span className={styles.currencyText} style={{ color: '#0F172A' }}>
          {formatCurrency(Number(val || 0))}
        </span>
      ),
    },
    {
      title: 'STATUS PR',
      key: 'status',
      width: 130,
      align: 'center' as const,
      render: (_: any, r: UnresolvedReconciliationItem) => (
        <Tag color="cyan" style={{ fontWeight: 600, margin: 0, borderRadius: 4 }}>
          {r.purchaseRequest?.status || 'SUBMITTED'}
        </Tag>
      ),
    },
    {
      title: 'AKSI',
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
          className={canMutate ? styles.btnActionBlue : styles.btnActionSecondary}
        >
          {canMutate ? 'Rekonsiliasi' : 'Lihat Detail'}
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
        style={{ margin: '16px 0', borderRadius: 8 }}
      />
    );
  }

  return (
    <div>
      {/* Refined Compact Safety Gate Banner */}
      {unresolvedItems.length > 0 ? (
        <div className={styles.safetyGateWarning}>
          <ExclamationCircleFilled style={{ color: '#D97706', fontSize: 18, flexShrink: 0 }} />
          <div>
            <div className={styles.safetyGateTitle} style={{ color: '#92400E' }}>
              Safety Gate Concurrency &amp; Quota Aktif ({unresolvedItems.length} Item Menunggu Rekonsiliasi)
            </div>
            <div className={styles.safetyGateDesc} style={{ color: '#B45309' }}>
              Item pengadaan langsung historis atau ad-hoc belum dipetakan ke CostItem RAB aktif. Selesaikan rekonsiliasi agar paket pengadaan baru pada proyek terkait dapat disetujui.
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.safetyGateSuccess}>
          <CheckCircleFilled style={{ color: '#059669', fontSize: 18, flexShrink: 0 }} />
          <div>
            <div className={styles.safetyGateTitle} style={{ color: '#065F46' }}>
              Safety Gate Bersih — Seluruh Item Terekonsiliasi
            </div>
            <div className={styles.safetyGateDesc} style={{ color: '#047857' }}>
              Tidak ada item PR legacy atau ad-hoc yang menggantung. Seluruh pengadaan proyek berada pada jalur paket pengadaan canonical.
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & Filter */}
      <div className={styles.tabToolbar}>
        <Space size={12} wrap align="center">
          <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
            <FilterOutlined style={{ marginRight: 6 }} />
            Origin Pengadaan:
          </span>
          <Select
            size="small"
            value={originFilter}
            onChange={(v) => setOriginFilter(v)}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: 'Semua Origin' },
              { value: 'LEGACY', label: 'LEGACY' },
              { value: 'AD_HOC', label: 'AD_HOC' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Menampilkan {unresolvedItems.length} item antrean
          </Text>
        </Space>

        <Button
          size="small"
          icon={<SyncOutlined spin={isLoading} />}
          onClick={() => refetch()}
          className={styles.btnActionSecondary}
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <Table
          className={styles.procurementTable}
          columns={columns}
          dataSource={unresolvedItems}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 1050 }}
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
      </div>

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
