"use client";

import React from 'react';
import {
  Modal,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Descriptions,
  Card,
  Divider,
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  DollarCircleOutlined,
  ShopOutlined,
  CalendarOutlined,
  BankOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PaymentDto } from '@/services/finance.service';

const { Text, Title } = Typography;

export interface PaymentReceiptModalProps {
  open: boolean;
  onClose: () => void;
  payment: PaymentDto | any | null;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  open,
  onClose,
  payment,
}) => {
  if (!payment) return null;

  const paymentNumber = payment.paymentNumber || '—';
  const amount = Number(payment.amount || 0);
  const invoiceNumber = (payment as any).invoiceNumber || payment.invoice?.invoiceNumber || '—';
  const projectName =
    (payment as any).projectName ||
    payment.invoice?.purchaseOrder?.purchaseRequest?.project?.name ||
    'Proyek Tanpa Nama';
  const projectId =
    (payment as any).projectId ||
    payment.invoice?.purchaseOrder?.purchaseRequest?.projectId;
  const poNumber =
    (payment as any).poNumber ||
    payment.invoice?.purchaseOrder?.poNumber ||
    '—';
  const vendorName =
    (payment as any).vendorName ||
    payment.invoice?.purchaseOrder?.vendor?.name ||
    '—';
  const vendorCode =
    (payment as any).vendorCode ||
    payment.invoice?.purchaseOrder?.vendor?.code ||
    '';
  const paymentDate = payment.paymentDate;
  const paymentMethod = payment.paymentMethod || 'BANK_TRANSFER';
  const referenceNumber = payment.referenceNumber || '—';
  const bankName = payment.bankName || 'Bank Mandiri (Rekening Operasional Proyek)';
  const createdBy =
    typeof payment.createdBy === 'number'
      ? `User #${payment.createdBy}`
      : (payment.createdBy || 'Finance Team');
  const createdAt = payment.createdAt;
  const notes = payment.notes;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(780px, 94vw)"
      centered
      destroyOnClose
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#059669', fontSize: 16 }} />
            <Text style={{ fontSize: 12 }}>
              Voucher Sah: <strong>{paymentNumber}</strong> — Status:{' '}
              <Tag color="green" style={{ margin: '0 4px', fontWeight: 700 }}>
                ● LUNAS (PAID)
              </Tag>
            </Text>
          </div>

          <Button onClick={onClose} style={{ borderRadius: 6 }}>
            Tutup
          </Button>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#ecfdf5', borderRadius: 8, color: '#059669' }}>
            <DollarCircleOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Bukti Pengeluaran Kas/Bank (Payment Voucher) — {paymentNumber}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              Tanda bukti pelunasan sah tagihan pengadaan barang/jasa vendor
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Large Amount Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
            padding: '16px 20px',
            borderRadius: 8,
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5, color: '#a7f3d0' }}>
              TOTAL REALISASI PEMBAYARAN:
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', marginTop: 2 }}>
              Rp {amount.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: 11, color: '#d1fae5', marginTop: 2 }}>
              Pelunasan 100% Faktur Invoice: {invoiceNumber}
            </div>
          </div>

          <Tag
            color="success"
            style={{
              fontSize: 13,
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: 6,
              background: '#ffffff',
              color: '#047857',
              border: 'none',
            }}
          >
            ✅ PAID / LUNAS
          </Tag>
        </div>

        {/* Top Context Descriptions */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{projectName}</div>
              {projectId ? (
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID #{projectId}</Tag>
              ) : (
                <Tag style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID Tidak Tersedia</Tag>
              )}
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>NOMOR PO:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {poNumber}
              </div>
              <Tag color="green" style={{ fontSize: 9.5, margin: 0, marginTop: 2, fontWeight: 700 }}>
                ● COMPLETED
              </Tag>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PENERIMA:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {vendorName}
              </div>
              {vendorCode && <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>}
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>FAKTUR TAGIHAN:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#334155', fontFamily: 'monospace' }}>
                {invoiceNumber}
              </div>
              <Tag color="purple" style={{ fontSize: 9.5, margin: 0, marginTop: 2, fontWeight: 700 }}>
                ● 100% INVOICED
              </Tag>
            </Col>
          </Row>
        </div>

        {/* Voucher Metadata Descriptions */}
        <Descriptions
          size="small"
          bordered
          column={{ xs: 1, sm: 2 }}
          style={{ borderRadius: 6, overflow: 'hidden' }}
        >
          <Descriptions.Item label="Nomor Bukti Kas/Bank (Voucher)">
            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#047857' }}>
              {paymentNumber}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Realisasi Bayar">
            <CalendarOutlined style={{ marginRight: 4, color: '#64748b' }} />
            {paymentDate ? dayjs(paymentDate).format('DD MMMM YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Metode Pembayaran">
            <Tag color="blue" style={{ fontWeight: 700 }}>
              {paymentMethod}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="No. Referensi Transaksi Bank / Cek">
            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>
              {referenceNumber}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Rekening / Bank Sumber Dana">
            <BankOutlined style={{ marginRight: 4, color: '#64748b' }} />
            {bankName}
          </Descriptions.Item>
          <Descriptions.Item label="Diproses Oleh">
            {createdBy} {createdAt ? `(${dayjs(createdAt).format('DD/MM/YYYY HH:mm')})` : ''}
          </Descriptions.Item>
          {notes && (
            <Descriptions.Item label="Catatan Transaksi" span={2}>
              {notes}
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    </Modal>
  );
};

export default PaymentReceiptModal;
