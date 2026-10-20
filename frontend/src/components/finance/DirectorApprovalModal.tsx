"use client";

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Row,
  Col,
  Typography,
  Alert,
  message,
  Card,
  Tag,
} from 'antd';
import {
  CheckCircleOutlined,
  RollbackOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { FinanceService, PaymentRequestDto } from '@/services/finance.service';
import { formatCurrency, formatDate } from '@/lib/formatters';

const { Text } = Typography;

export interface DirectorApprovalModalProps {
  open: boolean;
  onClose: () => void;
  paymentRequest: PaymentRequestDto | null;
  onDecisionMade?: (updated: PaymentRequestDto) => void;
}

export const DirectorApprovalModal: React.FC<DirectorApprovalModalProps> = ({
  open,
  onClose,
  paymentRequest,
  onDecisionMade,
}) => {
  const [actionType, setActionType] = useState<'NONE' | 'RETURN' | 'REJECT'>('NONE');
  const [returnNotes, setReturnNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  if (!paymentRequest) return null;

  const invoice = paymentRequest.invoice;
  const po = invoice?.purchaseOrder;
  const vendor = po?.vendor;
  const term = paymentRequest.paymentTerm;
  const reqAmount = Number(paymentRequest.requestedAmount || 0);
  const canDecide = paymentRequest.status === 'PENDING_DIRECTOR_APPROVAL';

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_DIRECTOR_APPROVAL':
        return <Tag color="gold" style={{ margin: 0, fontWeight: 600 }}>Menunggu Persetujuan Direktur</Tag>;
      case 'NEEDS_REVISION':
        return <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>Dalam Revisi</Tag>;
      case 'APPROVED_FOR_PAYMENT':
        return <Tag color="success" style={{ margin: 0, fontWeight: 600 }}>Disetujui</Tag>;
      case 'REJECTED':
        return <Tag color="error" style={{ margin: 0, fontWeight: 600 }}>Ditolak</Tag>;
      case 'PAID':
        return <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>Lunas</Tag>;
      default:
        return status ? <Tag style={{ margin: 0 }}>{status}</Tag> : null;
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await FinanceService.decidePaymentRequest(paymentRequest.id, {
        action: 'APPROVE',
        approvedAmount: approvedAmount ?? reqAmount,
      });
      message.success(`Pengajuan pembayaran ${res.requestNumber} BERHASIL DISETUJUI.`);
      if (onDecisionMade) onDecisionMade(res);
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal menyetujui pembayaran';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnNotes.trim()) {
      message.error('Catatan revisi wajib diisi saat mengembalikan pengajuan.');
      return;
    }
    setLoading(true);
    try {
      const res = await FinanceService.decidePaymentRequest(paymentRequest.id, {
        action: 'RETURN',
        revisionNotes: returnNotes.trim(),
      });
      message.success(`Pengajuan pembayaran ${res.requestNumber} dikembalikan untuk direvisi.`);
      if (onDecisionMade) onDecisionMade(res);
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengembalikan pengajuan';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.error('Alasan penolakan wajib diisi saat menolak pengajuan.');
      return;
    }
    setLoading(true);
    try {
      const res = await FinanceService.decidePaymentRequest(paymentRequest.id, {
        action: 'REJECT',
        rejectionReason: rejectReason.trim(),
      });
      message.success(`Pengajuan pembayaran ${res.requestNumber} ditolak.`);
      if (onDecisionMade) onDecisionMade(res);
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal menolak pengajuan';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        setActionType('NONE');
        onClose();
      }}
      width={800}
      title={
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 4 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <FileProtectOutlined style={{ color: '#1d4ed8', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
              Review & Persetujuan Pembayaran (Direktur)
            </div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              Tinjau pengajuan pembayaran sebelum memberikan keputusan
            </div>
          </div>
        </div>
      }
      destroyOnClose
      footer={null}
    >
      <div style={{ marginTop: 12 }}>
        {paymentRequest.status === 'NEEDS_REVISION' && (
          <Alert
            type="warning"
            showIcon
            message={<span style={{ fontWeight: 600 }}>Status: Dalam Revisi</span>}
            description={
              <div style={{ marginTop: 4, fontSize: 13 }}>
                <span>Catatan revisi sebelumnya: </span>
                <span style={{ fontStyle: 'italic', color: '#92400e' }}>
                  "{paymentRequest.revisionNotes || '—'}"
                </span>
              </div>
            }
            style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #fde68a' }}
          />
        )}

        {/* Section: Payment Request Identity */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PENGAJUAN PEMBAYARAN
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', marginTop: 2 }}>
              {paymentRequest.requestNumber}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Diajukan: <span style={{ fontWeight: 500, color: '#334155' }}>{formatDate(paymentRequest.submittedAt)}</span>
              <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span>
              Pemohon: <span style={{ fontWeight: 500, color: '#334155' }}>{paymentRequest.requester?.fullName || 'Finance Team'}</span>
            </div>
          </div>
          {renderStatusBadge(paymentRequest.status)}
        </div>

        {/* Section: Financial Summary Cards */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Nilai Tagihan
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '6px 0 2px 0' }}>
                {formatCurrency(Number(invoice?.totalAmount || 0))}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Nilai bruto faktur tagihan
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 8,
                padding: '12px 14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Jumlah Diajukan
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d', margin: '6px 0 2px 0' }}>
                {formatCurrency(reqAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>
                Nominal persetujuan pembayaran
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Termin Pembayaran
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: '6px 0 2px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={term?.termName || 'Termin Standar'}
              >
                {term?.termName || 'Termin Standar'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {term?.percentage ? `Bobot termin: ${term.percentage}%` : 'Sesuai ketentuan kontrak PO'}
              </div>
            </div>
          </Col>
        </Row>

        {/* Section: Transaction Information */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileTextOutlined style={{ color: '#64748b' }} />
            <span>Informasi Transaksi</span>
          </div>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Nomor Invoice:</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: '#1e293b', marginTop: 2 }}>
                {invoice?.invoiceNumber || '—'}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Nomor Purchase Order (PO):</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: '#0f766e', marginTop: 2 }}>
                {po?.poNumber || '—'}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Vendor Rekanan:</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                {vendor?.name || '—'}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Pemohon (Finance):</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', marginTop: 2 }}>
                {paymentRequest.requester?.fullName || 'Finance Team'}
              </div>
            </Col>
            {(invoice?.status || invoice?.matchStatus) && (
              <>
                {invoice?.status && (
                  <Col xs={24} sm={12}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Status Invoice:</div>
                    <div style={{ marginTop: 2 }}>
                      <Tag color="blue">{invoice.status}</Tag>
                    </div>
                  </Col>
                )}
                {invoice?.matchStatus && (
                  <Col xs={24} sm={12}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Status Rekonsiliasi:</div>
                    <div style={{ marginTop: 2 }}>
                      <Tag color={invoice.matchStatus === 'MATCHED' ? 'success' : 'warning'}>
                        {invoice.matchStatus}
                      </Tag>
                    </div>
                  </Col>
                )}
              </>
            )}
          </Row>
        </div>

        {/* Section: Request Note */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Catatan Pengajuan
          </div>
          <div style={{ fontSize: 13, color: paymentRequest.notes ? '#334155' : '#94a3b8', fontStyle: paymentRequest.notes ? 'normal' : 'italic' }}>
            {paymentRequest.notes || 'Tidak ada catatan khusus dari pemohon.'}
          </div>
        </div>

        {/* Section: Decision Actions / Read-Only Footer */}
        {canDecide ? (
          actionType === 'NONE' && (
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setActionType('REJECT')}
                  id="btn-director-reject-mode"
                  style={{ fontWeight: 500 }}
                >
                  Tolak Pengajuan
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => setActionType('RETURN')}
                  id="btn-director-return-mode"
                  style={{ borderColor: '#d97706', color: '#d97706', fontWeight: 500 }}
                >
                  Minta Revisi
                </Button>
              </div>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={loading}
                onClick={handleApprove}
                id="btn-director-approve"
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  fontWeight: 600,
                  paddingLeft: 18,
                  paddingRight: 18,
                  boxShadow: '0 1px 2px 0 rgba(5, 150, 105, 0.2)',
                }}
              >
                Setujui Pembayaran
              </Button>
            </div>
          )
        ) : (
          <div
            style={{
              borderTop: '1px solid #e2e8f0',
              paddingTop: 16,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <Button
              onClick={onClose}
              id="btn-director-close"
              style={{ minWidth: 100, fontWeight: 500 }}
            >
              Tutup
            </Button>
          </div>
        )}

        {canDecide && actionType === 'RETURN' && (
          <Card
            size="small"
            style={{ marginTop: 16, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 8 }}
            title={<span style={{ color: '#b45309', fontWeight: 600 }}>Kembalikan Pengajuan untuk Revisi</span>}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tuliskan catatan revisi wajib untuk tim Finance (misal: lampiran belum lengkap, nominal perlu disesuaikan):
            </Text>
            <Input.TextArea
              rows={3}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Masukkan instruksi revisi..."
              id="input-director-return-notes"
              style={{ marginTop: 8, marginBottom: 12, borderRadius: 6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setActionType('NONE')} disabled={loading}>
                Batal
              </Button>
              <Button
                type="primary"
                danger
                loading={loading}
                onClick={handleReturn}
                id="btn-director-confirm-return"
                style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
              >
                Kirim Permintaan Revisi
              </Button>
            </div>
          </Card>
        )}

        {canDecide && actionType === 'REJECT' && (
          <Card
            size="small"
            style={{ marginTop: 16, borderColor: '#ef4444', backgroundColor: '#fef2f2', borderRadius: 8 }}
            title={<span style={{ color: '#b91c1c', fontWeight: 600 }}>Tolak Pengajuan Pembayaran</span>}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Alasan penolakan pengajuan (akan dicatat secara permanen):
            </Text>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan..."
              id="input-director-reject-reason"
              style={{ marginTop: 8, marginBottom: 12, borderRadius: 6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setActionType('NONE')} disabled={loading}>
                Batal
              </Button>
              <Button
                type="primary"
                danger
                loading={loading}
                onClick={handleReject}
                id="btn-director-confirm-reject"
              >
                Konfirmasi Tolak
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
};

