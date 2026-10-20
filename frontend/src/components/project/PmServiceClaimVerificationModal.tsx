"use client";

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  Tag,
  Space,
  Typography,
  Alert,
  message,
  Spin,
  Table,
  Select,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProcurementService,
  ServiceClaimRecord,
} from '@/services/procurement.service';
import { formatNumber } from '@/lib/formatters';

const { Text } = Typography;
const { TextArea } = Input;

export interface ModalViewState {
  type: 'LOADING' | 'ERROR' | 'DETAIL' | 'EMPTY';
  title?: string;
  description?: string;
  claim?: ServiceClaimRecord | null;
}

export function resolveModalViewState(state: {
  loading: boolean;
  errorMessage: string | null;
  claim: ServiceClaimRecord | null;
}): ModalViewState {
  if (state.errorMessage) {
    return {
      type: 'ERROR',
      title: 'Gagal memuat klaim jasa.',
      description: state.errorMessage,
    };
  }
  if (state.claim) {
    return {
      type: 'DETAIL',
      claim: state.claim,
    };
  }
  if (!state.loading) {
    return {
      type: 'EMPTY',
      description: 'Belum ada klaim jasa yang diajukan untuk proyek ini.',
    };
  }
  return {
    type: 'LOADING',
  };
}

export interface PmServiceClaimVerificationModalProps {
  open: boolean;
  claimId?: number | null;
  claim?: ServiceClaimRecord | null;
  projectId?: number | null;
  onClose: () => void;
  onSuccess?: (updatedClaim: ServiceClaimRecord) => void;
}

export const PmServiceClaimVerificationModal: React.FC<PmServiceClaimVerificationModalProps> = ({
  open,
  claimId,
  claim: initialClaim,
  projectId,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claim, setClaim] = useState<ServiceClaimRecord | null>(initialClaim || null);
  const [projectClaims, setProjectClaims] = useState<ServiceClaimRecord[]>([]);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'RETURN' | 'REJECT'>('APPROVE');

  const resolvedClaimId = claimId || initialClaim?.id;

  const loadClaimDetail = async (id: number) => {
    setLoading(true);
    setErrorMessage(null);
    form.resetFields();
    setDecisionAction('APPROVE');
    try {
      const data = await ProcurementService.getServiceClaimById(Number(id));
      setClaim(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Gagal memuat detail klaim jasa.';
      setErrorMessage(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectClaims = (pid: number) => {
    setLoading(true);
    setErrorMessage(null);
    form.resetFields();
    setDecisionAction('APPROVE');
    ProcurementService.getServiceClaims({ projectId: Number(pid) })
      .then(async (claimsList) => {
        setProjectClaims(claimsList);
        if (claimsList.length > 0) {
          const target = claimsList.find((c) => c.status === 'SUBMITTED') || claimsList[0];
          const fullClaim = await ProcurementService.getServiceClaimById(target.id);
          setClaim(fullClaim);
        } else {
          setClaim(null);
        }
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message || err?.message || 'Gagal memuat klaim jasa.';
        setErrorMessage(msg);
        message.error(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open && resolvedClaimId) {
      void loadClaimDetail(Number(resolvedClaimId));
    } else if (open && !resolvedClaimId && projectId) {
      loadProjectClaims(Number(projectId));
    } else if (!open) {
      setErrorMessage(null);
      setClaim(null);
      setProjectClaims([]);
    }
  }, [open, resolvedClaimId, projectId]);

  const handleExecuteDecision = async () => {
    if (!claim) return;
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);

      const res = await ProcurementService.verifyTechnicalServiceClaim(claim.id, {
        decision: decisionAction,
        revisionNotes: decisionAction === 'RETURN' ? values.notes : undefined,
        rejectionReason: decisionAction === 'REJECT' ? values.notes : undefined,
      });

      if (decisionAction === 'APPROVE') {
        message.success(`Klaim Jasa ${res.claimNumber} berhasil diverifikasi teknis.`);
      } else if (decisionAction === 'RETURN') {
        message.success(`Klaim Jasa ${res.claimNumber} berhasil dikembalikan untuk revisi.`);
      } else {
        message.success(`Klaim Jasa ${res.claimNumber} ditolak.`);
      }

      onSuccess?.(res);
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses verifikasi teknis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <Tag
            style={{
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              borderColor: '#bfdbfe',
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {status}
          </Tag>
        );
      case 'PM_VERIFIED':
        return (
          <Tag
            style={{
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              borderColor: '#bbf7d0',
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {status}
          </Tag>
        );
      case 'APPROVED_FOR_INVOICE':
        return (
          <Tag
            style={{
              backgroundColor: '#ecfdf5',
              color: '#047857',
              borderColor: '#a7f3d0',
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {status}
          </Tag>
        );
      case 'NEEDS_REVISION':
      case 'RETURNED':
        return (
          <Tag
            style={{
              backgroundColor: '#fffbeb',
              color: '#b45309',
              borderColor: '#fde68a',
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {status}
          </Tag>
        );
      case 'REJECTED':
      case 'CANCELLED':
        return (
          <Tag
            style={{
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              borderColor: '#fecaca',
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {status}
          </Tag>
        );
      default:
        return (
          <Tag
            style={{
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {status}
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: 'Item Jasa',
      dataIndex: 'itemNameSnapshot',
      key: 'itemNameSnapshot',
      render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Qty Kontrak',
      dataIndex: 'contractQuantitySnapshot',
      key: 'contractQuantitySnapshot',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontWeight: 500 }}>{formatNumber(v)}</span>,
    },
    {
      title: 'Disetujui Sblmnya',
      dataIndex: 'previousApprovedQuantity',
      key: 'previousApprovedQuantity',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: '#059669', fontWeight: 600 }}>{formatNumber(v)}</span>,
    },
    {
      title: 'Klaim Saat Ini',
      dataIndex: 'currentClaimQuantity',
      key: 'currentClaimQuantity',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#1D4ED8', fontSize: 13 }}>
          {formatNumber(v)}
        </span>
      ),
    },
    {
      title: 'Kumulatif Disetujui',
      dataIndex: 'cumulativeApprovedQuantity',
      key: 'cumulativeApprovedQuantity',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontWeight: 500 }}>{formatNumber(v)}</span>,
    },
    {
      title: 'Sisa Kuantitas',
      dataIndex: 'remainingQuantity',
      key: 'remainingQuantity',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#D97706' }}>
          {formatNumber(v)}
        </span>
      ),
    },
    {
      title: 'Satuan',
      dataIndex: 'uomSnapshot',
      key: 'uomSnapshot',
      render: (v: any) => <span style={{ color: '#64748b' }}>{v || '—'}</span>,
    },
    {
      title: 'Lokasi Pelaksanaan',
      dataIndex: 'workLocation',
      key: 'workLocation',
      render: (v: string) => v || '—',
    },
    {
      title: 'Catatan Item',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string) => v || '—',
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1040}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SafetyCertificateOutlined style={{ color: '#2563EB', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.25 }}>
              Verifikasi Teknis Klaim Jasa (Project Manager)
            </div>
          </div>
        </div>
      }
      footer={null}
      destroyOnClose
    >
      <style>{`
        .service-claim-navy-table .ant-table-thead > tr > th {
          background: #0f233a !important;
          color: #ffffff !important;
          font-weight: 600 !important;
          font-size: 11.5px !important;
          border-bottom: 1px solid #1e3a5f !important;
          padding: 9px 12px !important;
        }
        .service-claim-navy-table .ant-table-thead > tr > th::before {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }
        .service-claim-navy-table .ant-table-tbody > tr > td {
          padding: 8px 12px !important;
          font-size: 12px !important;
        }
        .service-claim-navy-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
      `}</style>

      <Spin spinning={loading}>
        {errorMessage ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Alert
              type="error"
              showIcon
              message="Gagal memuat klaim jasa."
              description={errorMessage}
              style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
            />
            <Space>
              <Button
                type="primary"
                onClick={() => {
                  if (resolvedClaimId) {
                    void loadClaimDetail(Number(resolvedClaimId));
                  } else if (projectId) {
                    loadProjectClaims(Number(projectId));
                  }
                }}
                style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', borderRadius: 6 }}
              >
                Coba Lagi
              </Button>
              <Button onClick={onClose} style={{ borderRadius: 6 }}>
                Tutup
              </Button>
            </Space>
          </div>
        ) : claim ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
            {projectClaims.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                  Pilih Klaim Jasa Proyek:
                </Text>
                <Select
                  value={claim.id}
                  onChange={(id) => void loadClaimDetail(id)}
                  style={{ minWidth: 340 }}
                  options={projectClaims.map((c) => ({
                    value: c.id,
                    label: `${c.claimNumber} (${c.status}) — ${formatNumber(c.totalClaimAmount || 0)} IDR`,
                  }))}
                />
              </div>
            )}

            {/* Information / Guidance Banner */}
            <Alert
              type="info"
              showIcon
              message={
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e40af' }}>
                  Verifikasi Teknis & Volume Lapangan
                </span>
              }
              description={
                <div style={{ fontSize: 12, color: '#2563eb', lineHeight: 1.5, marginTop: 2 }}>
                  Periksa kesesuaian volume fisik jasa yang terlaksana di lapangan dan kelengkapan bukti opname/BAST. Verifikasi teknis ini bersifat kontraktual dan TIDAK mengubah progress fisik S-Curve proyek.
                </div>
              }
              style={{
                borderRadius: 8,
                border: '1px solid #bfdbfe',
                backgroundColor: '#eff6ff',
                padding: '10px 14px',
              }}
            />

            {/* Informasi Klaim Section */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                backgroundColor: '#ffffff',
                overflow: 'hidden',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '10px 14px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    backgroundColor: '#eff6ff',
                    border: '1px solid #dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileTextOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                  Informasi Klaim
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px 24px',
                  }}
                >
                  {/* Row 1: Nomor Klaim | Status Saat Ini */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Nomor Klaim
                    </div>
                    <span style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace', fontSize: 13 }}>
                      {claim.claimNumber}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Status Saat Ini
                    </div>
                    <div>
                      {renderStatusTag(claim.status)}
                    </div>
                  </div>

                  {/* Row 2: Purchase Order | Proyek */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Purchase Order
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                      {claim.purchaseOrder?.poNumber || (claim.poId ? `PO #${claim.poId}` : '—')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Proyek
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                      {claim.project?.name || (claim.project as any)?.project_name || (claim.projectId ? `Proyek #${claim.projectId}` : '—')}
                    </div>
                  </div>

                  {/* Row 3: Vendor Rekanan | Total Nilai Klaim */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Vendor Rekanan
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                      {claim.vendor?.name || (claim.vendorId ? `Vendor #${claim.vendorId}` : '—')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Total Nilai Klaim
                    </div>
                    <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>
                      {formatNumber(claim.totalClaimAmount || 0)} IDR
                    </div>
                  </div>

                  {/* Row 4: Referensi SPK / WO | Periode Pelaksanaan */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Referensi SPK / WO
                    </div>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 13 }}>
                      {claim.serviceOrder?.documentNumber || 'Tanpa SPK (Langsung PO)'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Periode Pelaksanaan
                    </div>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 13 }}>
                      {claim.claimPeriodStart && claim.claimPeriodEnd
                        ? `${dayjs(claim.claimPeriodStart).format('DD/MM/YYYY')} - ${dayjs(claim.claimPeriodEnd).format('DD/MM/YYYY')}`
                        : '—'}
                    </div>
                  </div>

                  {/* Row 5: Jenis Dokumen Bukti | Nomor Referensi Bukti */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Jenis Dokumen Bukti
                    </div>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 13 }}>
                      {claim.acceptanceType || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Nomor Referensi Bukti
                    </div>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 13 }}>
                      {claim.acceptanceReference || '—'}
                    </div>
                  </div>

                  {/* Row 6: Tanggal Dokumen Bukti */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      Tanggal Dokumen Bukti
                    </div>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: 13 }}>
                      {claim.acceptanceDate ? dayjs(claim.acceptanceDate).format('DD/MM/YYYY') : '—'}
                    </div>
                  </div>
                  <div></div>

                  {/* Optional Catatan Klaim */}
                  {claim.notes && (
                    <div style={{ gridColumn: 'span 2', marginTop: 4, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        Catatan Klaim
                      </div>
                      <div style={{ fontSize: 13, color: '#334155', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        {claim.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Daftar Volume Fisik yang Diajukan */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                backgroundColor: '#ffffff',
                overflow: 'hidden',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '10px 14px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    backgroundColor: '#eff6ff',
                    border: '1px solid #dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppstoreOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                  Daftar Volume Fisik yang Diajukan
                </span>
              </div>
              <div style={{ padding: 0 }}>
                <Table
                  className="service-claim-navy-table"
                  size="small"
                  dataSource={claim.items || []}
                  rowKey="id"
                  columns={columns}
                  pagination={false}
                  scroll={{ x: 950 }}
                />
              </div>
            </div>

            {/* Status Klaim / Keputusan Verifikasi Teknis */}
            {claim.status === 'SUBMITTED' ? (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  padding: '16px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
                }}
              >
                <Form form={form} layout="vertical">
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                      Keputusan Verifikasi Teknis
                    </div>
                    <Space size={10}>
                      <Button
                        type={decisionAction === 'APPROVE' ? 'primary' : 'default'}
                        style={
                          decisionAction === 'APPROVE'
                            ? { backgroundColor: '#2563EB', borderColor: '#2563EB', fontWeight: 500, borderRadius: 6 }
                            : { borderRadius: 6, fontWeight: 500 }
                        }
                        onClick={() => setDecisionAction('APPROVE')}
                        icon={<CheckCircleOutlined />}
                      >
                        Setujui Teknis
                      </Button>
                      <Button
                        type={decisionAction === 'RETURN' ? 'primary' : 'default'}
                        style={
                          decisionAction === 'RETURN'
                            ? { backgroundColor: '#D97706', borderColor: '#D97706', fontWeight: 500, borderRadius: 6 }
                            : { borderRadius: 6, fontWeight: 500 }
                        }
                        onClick={() => setDecisionAction('RETURN')}
                        icon={<RollbackOutlined />}
                      >
                        Minta Revisi
                      </Button>
                      <Button
                        danger
                        type={decisionAction === 'REJECT' ? 'primary' : 'default'}
                        style={{ borderRadius: 6, fontWeight: 500 }}
                        onClick={() => setDecisionAction('REJECT')}
                        icon={<CloseCircleOutlined />}
                      >
                        Tolak
                      </Button>
                    </Space>
                  </div>

                  {decisionAction !== 'APPROVE' && (
                    <Form.Item
                      name="notes"
                      label={
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                          {decisionAction === 'RETURN' ? 'Catatan Permintaan Revisi (Wajib)' : 'Alasan Penolakan (Wajib)'}
                        </span>
                      }
                      rules={[{ required: true, message: 'Alasan / catatan wajib diisi!' }]}
                      style={{ marginBottom: 16 }}
                    >
                      <TextArea
                        rows={3}
                        placeholder={
                          decisionAction === 'RETURN'
                            ? 'Sebutkan rincian volume atau dokumen yang perlu diperbaiki...'
                            : 'Sebutkan alasan penolakan klaim...'
                        }
                        style={{ borderRadius: 6 }}
                      />
                    </Form.Item>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 12,
                      paddingTop: 12,
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <Button onClick={onClose} style={{ borderRadius: 6, height: 36, padding: '0 16px' }}>
                      Tutup
                    </Button>
                    <Button
                      type="primary"
                      onClick={handleExecuteDecision}
                      loading={isSubmitting}
                      style={{
                        backgroundColor: '#2563EB',
                        borderColor: '#2563EB',
                        borderRadius: 6,
                        fontWeight: 500,
                        height: 36,
                        padding: '0 20px',
                      }}
                    >
                      Simpan Verifikasi Teknis
                    </Button>
                  </div>
                </Form>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Alert
                  type={
                    claim.status === 'PM_VERIFIED' || claim.status === 'APPROVED_FOR_INVOICE'
                      ? 'success'
                      : claim.status === 'REJECTED' || claim.status === 'CANCELLED'
                      ? 'error'
                      : claim.status === 'NEEDS_REVISION'
                      ? 'warning'
                      : 'info'
                  }
                  showIcon
                  message={
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      Status Klaim: {claim.status}
                    </span>
                  }
                  description={
                    <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
                      {claim.status === 'PM_VERIFIED'
                        ? 'Klaim ini telah diverifikasi teknis oleh Project Manager dan sedang menunggu verifikasi komersial Pengadaan.'
                        : claim.status === 'APPROVED_FOR_INVOICE'
                        ? 'Klaim ini telah disetujui komersial dan memenuhi syarat untuk penerbitan Invoice.'
                        : `Klaim ini berstatus ${claim.status}.`}
                    </div>
                  }
                  style={{
                    borderRadius: 8,
                    border:
                      claim.status === 'PM_VERIFIED' || claim.status === 'APPROVED_FOR_INVOICE'
                        ? '1px solid #86efac'
                        : claim.status === 'REJECTED' || claim.status === 'CANCELLED'
                        ? '1px solid #fca5a5'
                        : claim.status === 'NEEDS_REVISION'
                        ? '1px solid #fde68a'
                        : '1px solid #bfdbfe',
                    backgroundColor:
                      claim.status === 'PM_VERIFIED' || claim.status === 'APPROVED_FOR_INVOICE'
                        ? '#f0fdf4'
                        : claim.status === 'REJECTED' || claim.status === 'CANCELLED'
                        ? '#fef2f2'
                        : claim.status === 'NEEDS_REVISION'
                        ? '#fffbeb'
                        : '#eff6ff',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                  <Button
                    onClick={onClose}
                    style={{
                      borderRadius: 6,
                      height: 36,
                      padding: '0 20px',
                      fontWeight: 500,
                    }}
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          !loading && (
            <Empty
              description="Belum ada klaim jasa yang diajukan untuk proyek ini."
              style={{ padding: '32px 0' }}
            >
              <Button onClick={onClose} style={{ borderRadius: 6 }}>
                Tutup
              </Button>
            </Empty>
          )
        )}
      </Spin>
    </Modal>
  );
};

export default PmServiceClaimVerificationModal;
