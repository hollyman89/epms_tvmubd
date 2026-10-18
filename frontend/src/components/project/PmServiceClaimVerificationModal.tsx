"use client";

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Alert,
  message,
  Descriptions,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProcurementService,
  ServiceClaimRecord,
} from '@/services/procurement.service';
import { formatNumber } from '@/lib/formatters';

const { Text, Title } = Typography;
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

  const columns = [
    {
      title: 'Item Jasa',
      dataIndex: 'itemNameSnapshot',
      key: 'itemNameSnapshot',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Qty Kontrak',
      dataIndex: 'contractQuantitySnapshot',
      key: 'contractQuantitySnapshot',
      align: 'right' as const,
      render: (v: any) => formatNumber(v),
    },
    {
      title: 'Disetujui Sblmnya',
      dataIndex: 'previousApprovedQuantity',
      key: 'previousApprovedQuantity',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: '#059669' }}>{formatNumber(v)}</span>,
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
      render: (v: any) => formatNumber(v),
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
      width={1000}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SafetyCertificateOutlined style={{ color: '#2563EB', fontSize: 20 }} />
          <span>Verifikasi Teknis Klaim Jasa (Project Manager)</span>
        </div>
      }
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {errorMessage ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Alert
              type="error"
              showIcon
              message="Gagal memuat klaim jasa."
              description={errorMessage}
              style={{ marginBottom: 16, textAlign: 'left' }}
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
              >
                Coba Lagi
              </Button>
              <Button onClick={onClose}>Tutup</Button>
            </Space>
          </div>
        ) : claim ? (
          <div>
            {projectClaims.length > 1 && (
              <div
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
              >
                <Text strong>Pilih Klaim Jasa Proyek:</Text>
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

            <Alert
              type="info"
              message="Verifikasi Teknis & Volume Lapangan"
              description="Periksa kesesuaian volume fisik jasa yang terlaksana di lapangan dan kelengkapan bukti opname/BAST. Verifikasi teknis ini bersifat kontraktual dan TIDAK mengubah progress fisik S-Curve proyek."
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nomor Klaim">
                <span style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace' }}>
                  {claim.claimNumber}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Status Saat Ini">
                <Tag color={claim.status === 'SUBMITTED' ? 'processing' : 'default'}>
                  {claim.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Purchase Order">
                {claim.purchaseOrder?.poNumber || `PO #${claim.poId}`}
              </Descriptions.Item>
              <Descriptions.Item label="Proyek">
                {claim.project?.name || (claim.project as any)?.project_name || `Proyek #${claim.projectId}`}
              </Descriptions.Item>
              <Descriptions.Item label="Vendor Rekanan">
                {claim.vendor?.name || `Vendor #${claim.vendorId}`}
              </Descriptions.Item>
              <Descriptions.Item label="Total Nilai Klaim">
                <span style={{ fontWeight: 700, color: '#059669' }}>
                  {formatNumber(claim.totalClaimAmount || 0)} IDR
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Referensi SPK / WO">
                {claim.serviceOrder?.documentNumber || 'Tanpa SPK (Langsung PO)'}
              </Descriptions.Item>
              <Descriptions.Item label="Periode Pelaksanaan">
                {claim.claimPeriodStart && claim.claimPeriodEnd
                  ? `${dayjs(claim.claimPeriodStart).format('DD/MM/YYYY')} - ${dayjs(claim.claimPeriodEnd).format('DD/MM/YYYY')}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Jenis Dokumen Bukti">
                {claim.acceptanceType || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Nomor Referensi Bukti">
                {claim.acceptanceReference || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Dokumen Bukti">
                {claim.acceptanceDate ? dayjs(claim.acceptanceDate).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              {claim.notes && (
                <Descriptions.Item label="Catatan Klaim" span={2}>
                  {claim.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5}>Daftar Volume Fisik yang Diajukan</Title>
            <Table
              size="small"
              dataSource={claim.items || []}
              rowKey="id"
              columns={columns}
              pagination={false}
              style={{ marginBottom: 16 }}
            />

            {claim.status === 'SUBMITTED' ? (
              <Form form={form} layout="vertical">
                <Form.Item label="Keputusan Verifikasi Teknis">
                  <Space>
                    <Button
                      type={decisionAction === 'APPROVE' ? 'primary' : 'default'}
                      style={decisionAction === 'APPROVE' ? { backgroundColor: '#2563EB', borderColor: '#2563EB' } : {}}
                      onClick={() => setDecisionAction('APPROVE')}
                      icon={<CheckCircleOutlined />}
                    >
                      Setujui Teknis
                    </Button>
                    <Button
                      type={decisionAction === 'RETURN' ? 'primary' : 'default'}
                      style={decisionAction === 'RETURN' ? { backgroundColor: '#D97706', borderColor: '#D97706' } : {}}
                      onClick={() => setDecisionAction('RETURN')}
                      icon={<RollbackOutlined />}
                    >
                      Minta Revisi
                    </Button>
                    <Button
                      danger
                      type={decisionAction === 'REJECT' ? 'primary' : 'default'}
                      onClick={() => setDecisionAction('REJECT')}
                      icon={<CloseCircleOutlined />}
                    >
                      Tolak
                    </Button>
                  </Space>
                </Form.Item>

                {decisionAction !== 'APPROVE' && (
                  <Form.Item
                    name="notes"
                    label={decisionAction === 'RETURN' ? 'Catatan Permintaan Revisi (Wajib)' : 'Alasan Penolakan (Wajib)'}
                    rules={[{ required: true, message: 'Alasan / catatan wajib diisi!' }]}
                  >
                    <TextArea
                      rows={3}
                      placeholder={
                        decisionAction === 'RETURN'
                          ? 'Sebutkan rincian volume atau dokumen yang perlu diperbaiki...'
                          : 'Sebutkan alasan penolakan klaim...'
                      }
                    />
                  </Form.Item>
                )}

                <Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <Button onClick={onClose}>Tutup</Button>
                  <Button
                    type="primary"
                    onClick={handleExecuteDecision}
                    loading={isSubmitting}
                    style={decisionAction === 'APPROVE' ? { backgroundColor: '#2563EB', borderColor: '#2563EB' } : {}}
                  >
                    Simpan Verifikasi Teknis
                  </Button>
                </Space>
              </Form>
            ) : (
              <div style={{ marginTop: 16 }}>
                <Alert
                  type={claim.status === 'PM_VERIFIED' || claim.status === 'APPROVED_FOR_INVOICE' ? 'success' : 'info'}
                  message={`Status Klaim: ${claim.status}`}
                  description={
                    claim.status === 'PM_VERIFIED'
                      ? 'Klaim ini telah diverifikasi teknis oleh Project Manager dan sedang menunggu verifikasi komersial Pengadaan.'
                      : claim.status === 'APPROVED_FOR_INVOICE'
                      ? 'Klaim ini telah disetujui komersial dan memenuhi syarat untuk penerbitan Invoice.'
                      : `Klaim ini berstatus ${claim.status}.`
                  }
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button onClick={onClose}>Tutup</Button>
                </Space>
              </div>
            )}
          </div>
        ) : (
          !loading && (
            <Empty
              description="Belum ada klaim jasa yang diajukan untuk proyek ini."
              style={{ padding: '32px 0' }}
            >
              <Button onClick={onClose}>Tutup</Button>
            </Empty>
          )
        )}
      </Spin>
    </Modal>
  );
};

export default PmServiceClaimVerificationModal;
