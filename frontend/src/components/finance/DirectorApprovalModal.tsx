"use client";

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
  Row,
  Col,
  Typography,
  Alert,
  message,
  Card,
  Tag,
  Descriptions,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  RollbackOutlined,
  CloseCircleOutlined,
  DollarCircleOutlined,
  BankOutlined,
  ShopOutlined,
  FileProtectOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { FinanceService, PaymentRequestDto } from '@/services/finance.service';
import { formatCurrency, formatDate } from '@/lib/formatters';

const { Text, Title } = Typography;

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
      width={780}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileProtectOutlined style={{ color: '#1d4ed8', fontSize: 18 }} />
          <span>Review & Persetujuan Pembayaran (Direktur)</span>
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
            message="Status: Dalam Revisi"
            description={`Catatan revisi sebelumnya: "${paymentRequest.revisionNotes || '—'}"`}
            style={{ marginBottom: 16 }}
          />
        )}

        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8fafc' }}>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Nomor Pengajuan">
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8' }}>
                {paymentRequest.requestNumber}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal Pengajuan">
              {formatDate(paymentRequest.submittedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Nomor Invoice">
              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                {invoice?.invoiceNumber || '—'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Nomor PO">
              <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#0f766e' }}>
                {po?.poNumber || '—'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Vendor Rekanan">
              <span style={{ fontWeight: 600 }}>
                {vendor?.name || '—'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Termin Pembayaran">
              <Tag color="cyan">{term?.termName || 'Termin Standar'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Total Nilai Tagihan">
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {formatCurrency(Number(invoice?.totalAmount || 0))}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Jumlah yang Diajukan">
              <span style={{ fontWeight: 800, fontSize: 15, color: '#059669' }}>
                {formatCurrency(reqAmount)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Pemohon (Finance)">
              {paymentRequest.requester?.fullName || 'finance@epms.com'}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan Pemohon">
              {paymentRequest.notes || '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {actionType === 'NONE' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setActionType('REJECT')}
                  id="btn-director-reject-mode"
                >
                  Tolak Pengajuan
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => setActionType('RETURN')}
                  id="btn-director-return-mode"
                  style={{ borderColor: '#d97706', color: '#d97706' }}
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
                style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 600 }}
              >
                Setujui Pembayaran
              </Button>
            </div>
          </div>
        )}

        {actionType === 'RETURN' && (
          <Card
            size="small"
            style={{ marginTop: 16, borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
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
              style={{ marginTop: 8, marginBottom: 12 }}
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

        {actionType === 'REJECT' && (
          <Card
            size="small"
            style={{ marginTop: 16, borderColor: '#ef4444', backgroundColor: '#fef2f2' }}
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
              style={{ marginTop: 8, marginBottom: 12 }}
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
