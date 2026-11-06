"use client";

import React from 'react';
import {
  Button,
  Tag,
  Row,
  Col,
  Typography,
  Descriptions,
} from 'antd';
import {
  CheckCircleOutlined,
  DollarCircleOutlined,
  ShopOutlined,
  CalendarOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { PaymentDto } from '@/services/finance.service';
import UserIdentityDisplay from '@/components/common/UserIdentityDisplay';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ResponsiveFinanceModal } from './ResponsiveFinanceModal';
import styles from './PaymentReceiptModal.module.css';

const { Text } = Typography;

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
  const createdAt = payment.createdAt;
  const notes = payment.notes;

  return (
    <ResponsiveFinanceModal
      open={open}
      onCancel={onClose}
      domain="PAYMENT"
      size="medium"
      destroyOnClose
      title={`Bukti Pengeluaran Kas/Bank (Payment Voucher) — ${paymentNumber}`}
      subtitle="Tanda bukti pelunasan sah tagihan pengadaan barang/jasa vendor"
      headerIcon={<DollarCircleOutlined style={{ fontSize: 18 }} />}
      headerIconTheme="green"
      footerExtra={
        <div className={styles.footerExtra}>
          <CheckCircleOutlined style={{ color: '#059669', fontSize: 16 }} />
          <span className={styles.footerText}>
            Voucher Sah: <strong>{paymentNumber}</strong> — Status:{' '}
            <StatusBadge domain="payment" status="PAID" showDot style={{ margin: '0 4px', fontWeight: 700 }} />
          </span>
        </div>
      }
      footerActions={
        <Button onClick={onClose} style={{ borderRadius: 6 }} className={styles.closeBtn}>
          Tutup
        </Button>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Large Amount Banner */}
        <div className={styles.amountBanner}>
          <div className={styles.amountInfoBlock}>
            <div className={styles.amountLabel}>
              TOTAL REALISASI PEMBAYARAN:
            </div>
            <div className={styles.amountValue}>
              {formatCurrency(amount)}
            </div>
            <div className={styles.amountSubtext}>
              Pelunasan 100% Faktur Invoice: {invoiceNumber}
            </div>
          </div>

          <StatusBadge
            domain="payment"
            status="PAID"
            style={{
              fontSize: 13,
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: 6,
              background: '#ffffff',
              color: '#047857',
              border: 'none',
              alignSelf: 'flex-start',
            }}
          />
        </div>

        {/* Top Context Descriptions */}
        <div className={styles.topContextBox}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{projectName}</div>
              {projectId ? (
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID #{projectId}</Tag>
              ) : (
                <Tag style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID Tidak Tersedia</Tag>
              )}
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>NOMOR PO:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {poNumber}
              </div>
              <StatusBadge
                domain="po"
                status="COMPLETED"
                showDot
                style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PENERIMA:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {vendorName}
              </div>
              {vendorCode && <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>}
            </Col>
            <Col xs={24} sm={12} md={6}>
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

        {/* Desktop Table View */}
        <div className={styles.desktopTableView} data-testid="desktop-payment-receipt-table">
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
              {formatDate(paymentDate)}
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
            <Descriptions.Item label="Pencatat / Petugas Pembayaran">
              <UserIdentityDisplay
                user={(payment as any).creator}
                userId={payment.createdBy}
                fallbackRole="Petugas Pembayaran"
                showEmail
              />
              {createdAt && (
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                  ({formatDateTime(createdAt)})
                </span>
              )}
            </Descriptions.Item>
            {notes && (
              <Descriptions.Item label="Catatan Transaksi" span={2}>
                {notes}
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>

        {/* Mobile Card View */}
        <div className={styles.mobileCardView} data-testid="mobile-payment-receipt-cards">
          {/* Card 1: Voucher & Tanggal */}
          <div className={styles.receiptCard} data-testid="receipt-card-voucher">
            <div className={styles.cardSection}>
              <div className={styles.cardFieldLabel}>NOMOR BUKTI KAS/BANK (VOUCHER)</div>
              <div className={styles.cardFieldValuePrimary}>{paymentNumber}</div>
            </div>
            <div className={styles.cardDivider} />
            <div className={styles.cardFieldGrid}>
              <div>
                <div className={styles.cardFieldLabel}>TANGGAL REALISASI</div>
                <div className={styles.cardFieldValue}>
                  <CalendarOutlined style={{ marginRight: 4, color: '#64748b' }} />
                  {formatDate(paymentDate)}
                </div>
              </div>
              <div>
                <div className={styles.cardFieldLabel}>METODE BAYAR</div>
                <div style={{ marginTop: 2 }}>
                  <Tag color="blue" style={{ fontWeight: 700, margin: 0 }}>
                    {paymentMethod}
                  </Tag>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bank & Referensi Transaksi */}
          <div className={styles.receiptCard} data-testid="receipt-card-bank">
            <div className={styles.cardSection}>
              <div className={styles.cardFieldLabel}>NO. REFERENSI TRANSAKSI BANK / CEK</div>
              <div className={styles.cardFieldValueMono}>{referenceNumber}</div>
            </div>
            <div className={styles.cardDivider} />
            <div className={styles.cardSection}>
              <div className={styles.cardFieldLabel}>REKENING / BANK SUMBER DANA</div>
              <div className={styles.cardFieldValue}>
                <BankOutlined style={{ marginRight: 4, color: '#64748b' }} />
                {bankName}
              </div>
            </div>
          </div>

          {/* Card 3: Petugas & Waktu Pencatatan */}
          <div className={styles.receiptCard} data-testid="receipt-card-officer">
            <div className={styles.cardSection}>
              <div className={styles.cardFieldLabel}>PENCATAT / PETUGAS PEMBAYARAN</div>
              <div style={{ marginTop: 2 }}>
                <UserIdentityDisplay
                  user={(payment as any).creator}
                  userId={payment.createdBy}
                  fallbackRole="Petugas Pembayaran"
                  showEmail
                />
              </div>
              {createdAt && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Dicatat pada: {formatDateTime(createdAt)}
                </div>
              )}
            </div>
            {notes && (
              <>
                <div className={styles.cardDivider} />
                <div className={styles.cardSection}>
                  <div className={styles.cardFieldLabel}>CATATAN TRANSAKSI</div>
                  <div className={styles.cardNotesValue}>{notes}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ResponsiveFinanceModal>
  );
};

export default PaymentReceiptModal;
