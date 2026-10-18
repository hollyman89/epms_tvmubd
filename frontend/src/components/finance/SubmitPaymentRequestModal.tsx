"use client";

import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  SendOutlined,
  DollarCircleOutlined,
  BankOutlined,
  FileTextOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { FinanceService, InvoiceDto, PaymentRequestDto } from '@/services/finance.service';
import { formatCurrency } from '@/lib/formatters';

const { Text } = Typography;

export interface SubmitPaymentRequestModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDto | null;
  activeRequest?: PaymentRequestDto | null;
  onSubmitted?: (prq: PaymentRequestDto) => void;
}

export const SubmitPaymentRequestModal: React.FC<SubmitPaymentRequestModalProps> = ({
  open,
  onClose,
  invoice,
  activeRequest,
  onSubmitted,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      const remaining = Number(invoice.totalAmount || 0);
      form.setFieldsValue({
        requestedAmount: remaining,
        bankName: 'Bank Mandiri',
        bankAccountNumber: '123-456-7890',
        bankAccountHolder: invoice.purchaseOrder?.vendor?.name || 'PT Vendor Rekanan',
        notes: `Pengajuan pembayaran faktur ${invoice.invoiceNumber}`,
      });
    }
  }, [open, invoice, form]);

  const isMatchVerified = invoice?.matchStatus === 'MATCHED' || invoice?.matchStatus === 'VERIFIED';
  const hasActiveRequest = Boolean(
    activeRequest &&
    ['PENDING_DIRECTOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED_FOR_PAYMENT'].includes(activeRequest.status || '')
  );

  const handleSubmit = async (values: any) => {
    if (!invoice?.id) return;
    if (hasActiveRequest) {
      message.error(`Terdapat pengajuan pembayaran yang masih aktif (${activeRequest?.requestNumber}) untuk invoice ini.`);
      return;
    }
    if (!isMatchVerified) {
      message.error(`Invoice belum lolos verifikasi 3-way match (${invoice.matchStatus || 'PENDING'}).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await FinanceService.submitPaymentRequest({
        invoiceId: invoice.id,
        paymentTermId: invoice.paymentTermId ? Number(invoice.paymentTermId) : undefined,
        requestedAmount: Number(values.requestedAmount),
        bankName: values.bankName,
        bankAccountNumber: values.bankAccountNumber,
        bankAccountHolder: values.bankAccountHolder,
        notes: values.notes,
      });

      message.success(`Pengajuan pembayaran ${res.requestNumber} berhasil dikirim ke Direktur.`);
      if (onSubmitted) onSubmitted(res);
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengajukan persetujuan pembayaran';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={680}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DollarCircleOutlined style={{ color: '#059669', fontSize: 18 }} />
          <span>Pengajuan Persetujuan Pembayaran ke Direktur</span>
        </div>
      }
      destroyOnClose
      footer={null}
    >
      <div style={{ marginTop: 12 }}>
        {hasActiveRequest && (
          <Alert
            type="warning"
            showIcon
            message="Pengajuan Pembayaran Sedang Aktif"
            description={`Terdapat pengajuan pembayaran yang masih aktif (${activeRequest?.requestNumber || 'PRQ'}, status: ${activeRequest?.status}) untuk invoice ini. Pengajuan baru tidak dapat dibuat sebelum pengajuan ini selesai atau diproses.`}
            style={{ marginBottom: 16 }}
          />
        )}

        {!isMatchVerified && !hasActiveRequest && (
          <Alert
            type="error"
            showIcon
            message="Invoice Belum Lolos Verifikasi 3-Way Match"
            description={`Invoice ini masih berstatus match "${invoice.matchStatus || 'PENDING'}". Pengajuan persetujuan pembayaran hanya dapat diproses setelah invoice diverifikasi (VERIFIED atau MATCHED) oleh Finance Checker.`}
            style={{ marginBottom: 16 }}
          />
        )}

        <Alert
          type="info"
          showIcon
          message="Workflow Persetujuan Pembayaran"
          description="Pengajuan pembayaran akan diteruskan ke Direktur untuk diverifikasi dan disetujui sebelum kas/bank dapat dibayarkan oleh tim Finance."
          style={{ marginBottom: 16 }}
        />

        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8fafc' }}>
          <Row gutter={[16, 12]}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Nomor Invoice:</Text>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8' }}>
                {invoice.invoiceNumber}
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Nomor PO:</Text>
              <div style={{ fontWeight: 600, fontFamily: 'monospace', color: '#0f766e' }}>
                {invoice.purchaseOrder?.poNumber || '—'}
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Vendor Penerima:</Text>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {invoice.purchaseOrder?.vendor?.name || '—'}
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Total Tagihan:</Text>
              <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>
                {formatCurrency(Number(invoice.totalAmount || 0))}
              </div>
            </Col>
            {invoice.paymentTerm?.termName && (
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>Termin:</Text>
                <div>
                  <Tag color="cyan">{invoice.paymentTerm.termName}</Tag>
                </div>
              </Col>
            )}
          </Row>
        </Card>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Jumlah yang Diajukan (Rp)"
            name="requestedAmount"
            rules={[
              { required: true, message: 'Jumlah yang diajukan wajib diisi' },
              {
                validator: async (_, value) => {
                  if (value && value > Number(invoice.totalAmount)) {
                    return Promise.reject(new Error('Jumlah melebihi total tagihan invoice'));
                  }
                  if (value && value <= 0) {
                    return Promise.reject(new Error('Jumlah harus lebih besar dari 0'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => (v ? Number(v.replace(/[^0-9]/g, '')) : 0)}
              min={1}
              id="input-requested-amount"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Nama Bank Vendor"
                name="bankName"
                rules={[{ required: true, message: 'Nama bank wajib diisi' }]}
              >
                <Input prefix={<BankOutlined />} placeholder="Contoh: Bank Mandiri" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Nomor Rekening Vendor"
                name="bankAccountNumber"
                rules={[{ required: true, message: 'Nomor rekening wajib diisi' }]}
              >
                <Input placeholder="Nomor rekening tujuan transfer" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Nama Pemilik Rekening"
            name="bankAccountHolder"
            rules={[{ required: true, message: 'Nama pemilik rekening wajib diisi' }]}
          >
            <Input placeholder="Atas nama rekening" />
          </Form.Item>

          <Form.Item label="Catatan Tambahan" name="notes">
            <Input.TextArea rows={2} placeholder="Catatan pengajuan untuk Direktur..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={!isMatchVerified || hasActiveRequest}
              id="btn-submit-payment-request"
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
            >
              Kirim Pengajuan ke Direktur
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
