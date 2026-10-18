'use client';

import React from 'react';
import {
  Drawer,
  Typography,
  Tag,
  Descriptions,
  Table,
  Button,
  Space,
  Alert,
  Spin,
  Empty,
  Divider,
} from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  RollbackOutlined,
  EyeOutlined,
  ClockCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import {
  ProcurementService,
  ProcurementPackage,
  ProcurementPackageStatus,
} from '@/services/procurement.service';
import { useAuth } from '@/context/AuthContext';
import UserIdentityDisplay from '@/components/common/UserIdentityDisplay';

const { Title, Text, Paragraph } = Typography;

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatQuantity,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import { resolveStatusPresentation } from '@/lib/statusPresentation';

export interface ProcurementPackageDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  packageId: number | null;
  onReturnClick?: (pkg: ProcurementPackage) => void;
  onCreatePrClick?: (pkg: ProcurementPackage) => void;
  onViewLinkedPrClick?: (pr: any) => void;
}

export const getPackageStatusTag = (status: ProcurementPackageStatus | string) => {
  const p = resolveStatusPresentation('package', status);
  let icon: React.ReactNode = null;
  if (p.rawStatus === 'SUBMITTED') icon = <ClockCircleFilled />;
  else if (p.rawStatus === 'PR_CREATED') icon = <CheckCircleFilled />;
  else if (p.rawStatus === 'RETURNED') icon = <RollbackOutlined />;
  else if (p.rawStatus === 'CANCELLED') icon = <StopOutlined />;

  return (
    <Tag color={p.color} icon={icon} style={{ fontWeight: 700, padding: '2px 8px' }}>
      {p.label}
    </Tag>
  );
};

export const ProcurementPackageDetailDrawer: React.FC<ProcurementPackageDetailDrawerProps> = ({
  open,
  onClose,
  packageId,
  onReturnClick,
  onCreatePrClick,
  onViewLinkedPrClick,
}) => {
  const { user, isProcurement } = useAuth();
  const canPerformProcurementAction =
    isProcurement || Boolean(user?.roles?.includes('PURCHASING'));

  const {
    data: pkg,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['procurement', 'packages', packageId],
    queryFn: () => ProcurementService.getPackageById(packageId!),
    enabled: Boolean(open && packageId && packageId > 0),
    staleTime: 30 * 1000,
  });

  const columns = [
    {
      title: 'Item RAB',
      key: 'itemName',
      width: 220,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.itemName}</div>
          {r.costItemId && (
            <span style={{ fontSize: 10.5, color: '#64748b' }}>CostItem ID: #{r.costItemId}</span>
          )}
        </div>
      ),
    },
    {
      title: 'WBS Task',
      key: 'wbs',
      width: 180,
      render: (_: any, r: any) => {
        const wbsName = r.wbs?.task_name || r.wbs?.name;
        const wbsCode = r.wbs?.wbs_code || r.wbs?.code;
        return wbsName ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{wbsName}</div>
            {wbsCode && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{wbsCode}</Tag>}
          </div>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
        );
      },
    },
    {
      title: 'Satuan',
      dataIndex: 'uom',
      key: 'uom',
      width: 90,
      align: 'center' as const,
      render: (val: string) => <Tag style={{ margin: 0 }}>{val || 'Unit'}</Tag>,
    },
    {
      title: 'Baseline RAB',
      dataIndex: 'baselineQty',
      key: 'baselineQty',
      width: 110,
      align: 'right' as const,
      render: (val: number) => formatQuantity(val),
    },
    {
      title: 'Jumlah Diminta',
      dataIndex: 'requestedQty',
      key: 'requestedQty',
      width: 130,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
          {formatQuantity(val)}
        </span>
      ),
    },
    {
      title: 'Estimasi Harga',
      dataIndex: 'estimatedUnitPrice',
      key: 'estimatedUnitPrice',
      width: 140,
      align: 'right' as const,
      render: (val: number) => formatCurrency(val),
    },
    {
      title: 'Subtotal',
      dataIndex: 'estimatedTotal',
      key: 'estimatedTotal',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 700, color: '#059669' }}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      title: 'Tgl Dibutuhkan',
      dataIndex: 'requiredDate',
      key: 'requiredDate',
      width: 120,
      align: 'center' as const,
      render: (val: string) => formatDate(val),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(960px, 95vw)"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Detail Paket Pengadaan</span>
          {pkg?.status && getPackageStatusTag(pkg.status)}
        </div>
      }
      extra={
        <Button onClick={onClose} size="small">
          Tutup
        </Button>
      }
      footer={
        pkg && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Ref ID Paket: #{pkg.id} | Dibuat: {formatDateTime(pkg.createdAt)}
            </span>
            <Space size={8}>
              {pkg.status === 'SUBMITTED' && canPerformProcurementAction && (
                <>
                  <Button
                    icon={<RollbackOutlined />}
                    danger
                    onClick={() => onReturnClick && onReturnClick(pkg)}
                  >
                    Kembalikan ke PM
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                    onClick={() => onCreatePrClick && onCreatePrClick(pkg)}
                  >
                    Terbitkan Purchase Request (PR)
                  </Button>
                </>
              )}

              {pkg.status === 'PR_CREATED' && pkg.purchaseRequest && (
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => onViewLinkedPrClick && onViewLinkedPrClick(pkg.purchaseRequest)}
                  style={{ backgroundColor: '#1d4ed8' }}
                >
                  Lihat Purchase Request #{pkg.purchaseRequest.prNumber}
                </Button>
              )}
            </Space>
          </div>
        )
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" tip="Memuat detail paket pengadaan..." />
        </div>
      ) : isError ? (
        <Alert
          type="error"
          message="Gagal memuat detail paket"
          description={(error as any)?.response?.data?.message || (error as any)?.message || 'Terjadi kesalahan sistem.'}
          action={
            <Button size="small" type="primary" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          }
          showIcon
        />
      ) : !pkg ? (
        <Empty description="Data paket tidak ditemukan." />
      ) : (
        <div>
          {/* Rejection Alert if RETURNED */}
          {pkg.rejectionNotes && (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleFilled style={{ color: '#d97706' }} />}
              message={<span style={{ fontWeight: 700 }}>Catatan Pengembalian / Permintaan Revisi</span>}
              description={
                <div style={{ marginTop: 4 }}>
                  <Paragraph style={{ margin: 0, color: '#92400e', whiteSpace: 'pre-wrap' }}>
                    {pkg.rejectionNotes}
                  </Paragraph>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>
                    Direview oleh: <strong>{pkg.reviewer?.fullName || 'Tim Procurement'}</strong>
                    {pkg.reviewedAt && ` (${formatDateTime(pkg.reviewedAt)})`}
                  </div>
                </div>
              }
              style={{ marginBottom: 16, border: '1px solid #fde68a', backgroundColor: '#fffbeb' }}
            />
          )}

          {/* Linked PR Alert if PR_CREATED */}
          {pkg.status === 'PR_CREATED' && pkg.purchaseRequest && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleFilled style={{ color: '#059669' }} />}
              message={<span style={{ fontWeight: 700 }}>Purchase Request Berhasil Diterbitkan</span>}
              description={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Nomor PR: <strong style={{ fontFamily: 'monospace' }}>{pkg.purchaseRequest.prNumber}</strong> | Status Workflow: <StatusBadge domain="pr" status={pkg.purchaseRequest.status} />
                  </div>
                  <Button
                    size="small"
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => onViewLinkedPrClick && onViewLinkedPrClick(pkg.purchaseRequest)}
                  >
                    Buka Detail PR
                  </Button>
                </div>
              }
              style={{ marginBottom: 16, border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5' }}
            />
          )}

          {/* Header Descriptions */}
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            style={{ marginBottom: 20 }}
          >
            <Descriptions.Item label="Nomor Paket">
              <span style={{ fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {pkg.packageNumber}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getPackageStatusTag(pkg.status)}
            </Descriptions.Item>
            <Descriptions.Item label="Total Estimasi">
              <span style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
                {formatCurrency(pkg.totalEstimatedAmount)}
              </span>
            </Descriptions.Item>

            <Descriptions.Item label="Proyek" span={2}>
              <div>
                <span style={{ fontWeight: 600 }}>{pkg.project?.name || '—'}</span>
                {pkg.project?.code && (
                  <Tag color="blue" style={{ marginLeft: 6, fontSize: 10.5, fontFamily: 'monospace' }}>
                    {pkg.project.code}
                  </Tag>
                )}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal Dibutuhkan">
              {formatDate(pkg.requiredDate)}
            </Descriptions.Item>

            <Descriptions.Item label="Project Manager (Pemohon)">
              <UserIdentityDisplay
                user={pkg.requester}
                userId={pkg.requestedBy}
                fallbackRole="Project Manager"
                showEmail
              />
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal Pengajuan">
              {formatDateTime(pkg.submittedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Jumlah Item">
              <strong>{(pkg.items || []).length}</strong> Item Terdaftar
            </Descriptions.Item>
          </Descriptions>

          {/* Judul & Deskripsi Paket */}
          <div style={{ marginBottom: 18, background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Judul Paket:</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{pkg.title}</div>
            {pkg.description && (
              <>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Keterangan / Ruang Lingkup:</div>
                <div style={{ fontSize: 12.5, color: '#334155', whiteSpace: 'pre-wrap' }}>{pkg.description}</div>
              </>
            )}
          </div>

          <Divider style={{ margin: '14px 0' }} />

          {/* Items Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
              Daftar Item Material / Jasa dalam Paket
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              *Baseline kuota diambil dari estimasi biaya (RAB) berstatus APPROVED aktif.
            </span>
          </div>

          <Table
            size="small"
            columns={columns}
            dataSource={pkg.items || []}
            rowKey="id"
            pagination={false}
            scroll={{ x: 800 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6} align="right">
                    <strong>Total Nilai Estimasi Pengadaan:</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ color: '#059669' }}>
                      {formatCurrency(pkg.totalEstimatedAmount)}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </div>
      )}
    </Drawer>
  );
};
