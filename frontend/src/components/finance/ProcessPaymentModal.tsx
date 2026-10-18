"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  DollarCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  BankOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { FinanceService, InvoiceDto, PaymentDto, CreatePaymentPayload, PaymentRequestDto } from '@/services/finance.service';

const { Text } = Typography;
const { Option } = Select;

// 1. PROCESS PAYMENT MODAL PROPS & COMPONENT

export interface ProcessPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDto | any | null;
  paymentRequest?: PaymentRequestDto | null;
  onPaymentCreated?: (payment: PaymentDto, updatedInvoice?: any) => void;
  onViewReceipt?: (payment: PaymentDto) => void;
  currentUserName?: string;
  canProcessPayment?: boolean;
}

export const ProcessPaymentModal: React.FC<ProcessPaymentModalProps> = ({
  open,
  onClose,
  invoice,
  paymentRequest,
  onPaymentCreated,
  onViewReceipt,
  currentUserName = 'Finance Team',
  canProcessPayment = true,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [freshInvoice, setFreshInvoice] = useState<InvoiceDto | null>(null);

  // Derive numeric ID from prop invoice
  const invoiceId = invoice ? Number((invoice as any).id || (invoice as any).invoiceId) : null;

  // Fetch fresh invoice from backend SSOT on modal open
  const loadFreshInvoice = useCallback(async (id: number) => {
    try {
      const data = await FinanceService.getInvoiceById(id);
      setFreshInvoice(data);
    } catch (err) {
      console.warn('Could not fetch fresh invoice for payment modal:', err);
    }
  }, []);

  useEffect(() => {
    if (open && invoiceId && !isNaN(invoiceId) && invoiceId > 0) {
      loadFreshInvoice(invoiceId);
    } else {
      setFreshInvoice(null);
    }
  }, [open, invoiceId, loadFreshInvoice]);

  // Use fresh backend invoice if available, fallback to prop
  const activeInvoice = freshInvoice || invoice;

  // Safe Metadata Extraction from Backend SSOT Invoice
  const invoiceNumber = activeInvoice?.invoiceNumber || '';
  const poNumber =
    (activeInvoice as any)?.purchaseOrder?.poNumber ||
    (activeInvoice as any)?.poNumber ||
    '—';
  const vendorName =
    (activeInvoice as any)?.purchaseOrder?.vendor?.name ||
    (activeInvoice as any)?.vendorName ||
    '—';
  const vendorCode =
    (activeInvoice as any)?.purchaseOrder?.vendor?.code ||
    (activeInvoice as any)?.vendorCode ||
    '';
  const projectName =
    (activeInvoice as any)?.purchaseOrder?.purchaseRequest?.project?.name ||
    (activeInvoice as any)?.projectName ||
    'Proyek Tanpa Nama';
  const projectId =
    (activeInvoice as any)?.purchaseOrder?.purchaseRequest?.projectId ||
    (activeInvoice as any)?.projectId;
  const totalAmount = Number(activeInvoice?.totalAmount || 0);
  const matchStatus = activeInvoice?.matchStatus || 'PENDING';
  const isPaid = (activeInvoice as any)?.paymentStatus === 'PAID';
  const paymentStatus = (activeInvoice as any)?.paymentStatus || 'UNPAID';
  const termName = (activeInvoice as any)?.paymentTerm?.termName || 'Full Contract';

  // Calculate outstanding from authoritative backend payments
  const alreadyPaid = useMemo(() => {
    if (!activeInvoice?.payments || !Array.isArray(activeInvoice.payments)) return 0;
    return activeInvoice.payments.reduce(
      (sum: number, p: any) => sum + (p.deletedAt ? 0 : Number(p.amount || 0)),
      0
    );
  }, [activeInvoice]);

  const remainingBalance = Math.max(0, totalAmount - alreadyPaid);

  // Synchronize form when modal opens with active invoice
  useEffect(() => {
    if (open && activeInvoice) {
      const currentRef = form.getFieldValue('referenceNumber');
      const currentNotes = form.getFieldValue('notes');
      form.setFieldsValue({
        paymentDate: form.getFieldValue('paymentDate') || dayjs(),
        paymentMethod: form.getFieldValue('paymentMethod') || 'BANK_TRANSFER',
        paymentAmount: form.getFieldValue('paymentAmount') ?? Number(paymentRequest?.approvedAmount || paymentRequest?.requestedAmount || (remainingBalance > 0 ? remainingBalance : totalAmount)),
        bankName: form.getFieldValue('bankName') || 'Bank Mandiri (Rekening Operasional Proyek)',
        referenceNumber: currentRef || '',
        notes: currentNotes || `Pembayaran tagihan ${invoiceNumber} untuk vendor ${vendorName}.`,
      });
    } else if (!open) {
      form.resetFields();
    }
  }, [open, activeInvoice, paymentRequest, remainingBalance, totalAmount, invoiceNumber, vendorName, form]);

  // Submit Handler: Authoritative Backend Payment Execution
  const handleSubmit = async (values: any) => {
    if (!invoiceId) {
      message.error('ID Invoice tidak valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePaymentPayload = {
        invoiceId: Number(invoiceId),
        paymentRequestId: paymentRequest?.id ? Number(paymentRequest.id) : undefined,
        paymentDate: values.paymentDate
          ? values.paymentDate.toISOString()
          : new Date().toISOString(),
        paymentAmount: Number(values.paymentAmount),
        amount: Number(values.paymentAmount),
        paymentMethod: values.paymentMethod || 'BANK_TRANSFER',
        referenceNumber: (values.referenceNumber || '').trim(),
        bankName: (values.bankName || '').trim(),
        notes: (values.notes || '').trim(),
      };

      const newPayment = await FinanceService.createPayment(payload);

      // Informative status display based on server authoritative response
      if (newPayment.paymentStatus === 'PAID' || newPayment.isFullyPaid) {
        message.success('Pembayaran berhasil diproses: Invoice telah lunas (PAID).');
      } else if (newPayment.paymentStatus === 'PARTIALLY_PAID') {
        message.success(
          `Pembayaran sebagian berhasil (PARTIALLY_PAID). Sisa tagihan: Rp ${(newPayment.remainingAmount || 0).toLocaleString('id-ID')}`
        );
      } else {
        message.success(`Pembayaran ${newPayment.paymentNumber || ''} berhasil diproses.`);
      }

      if (onPaymentCreated) {
        onPaymentCreated(newPayment);
      }
      if (onViewReceipt) {
        onViewReceipt(newPayment);
      }
      onClose();
    } catch (err: any) {
      console.error('Payment processing failed detail:', JSON.stringify(err?.response?.data || err?.message));
      const apiError =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal memproses pembayaran. Periksa kembali saldo tagihan atau status verifikasi invoice.';
      message.error(apiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(860px, 95vw)"
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
            <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 16 }} />
            <Text style={{ fontSize: 12 }}>
              Total Tagihan:{' '}
              <strong style={{ color: '#059669', fontSize: 13, fontFamily: 'monospace' }}>
                Rp {totalAmount.toLocaleString('id-ID')}
              </strong>
              {alreadyPaid > 0 ? (
                <span style={{ marginLeft: 6, color: '#64748b' }}>
                  (Terbayar: Rp {alreadyPaid.toLocaleString('id-ID')})
                </span>
              ) : null}
            </Text>
          </div>

          <Space size={8}>
            <Button onClick={onClose} style={{ borderRadius: 6 }} disabled={isSubmitting}>
              Batal
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                try {
                  const values = await form.validateFields();
                  await handleSubmit(values);
                } catch (err: any) {
                  console.error('[ProcessPaymentModal] Form validation failed:', err);
                  message.error('Harap periksa isian formulir yang belum valid.');
                }
              }}
              loading={isSubmitting}
              disabled={!canProcessPayment || isPaid || isSubmitting}
              icon={<SendOutlined />}
              id="btn-submit-process-payment"
              style={{
                borderRadius: 6,
                fontWeight: 600,
                backgroundColor: isPaid ? undefined : '#059669',
                borderColor: isPaid ? undefined : '#059669',
              }}
            >
              {isPaid ? 'Invoice Telah Lunas' : 'Proses Pembayaran'}
            </Button>
          </Space>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#ecfdf5', borderRadius: 8, color: '#059669' }}>
            <DollarCircleOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Eksekusi Pembayaran Tagihan — {invoiceNumber}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              Pencatatan realisasi transfer kas/bank untuk pelunasan faktur vendor yang telah tervalidasi Finance
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Authoritative Matching & Settlement Status Strip */}
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
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>FAKTUR INVOICE:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {invoiceNumber}
              </div>
              <Space size={4} style={{ marginTop: 2 }}>
                <Tag color={matchStatus === 'VERIFIED' ? 'green' : matchStatus === 'MATCHED' ? 'blue' : 'orange'} style={{ fontSize: 9.5, margin: 0, fontWeight: 700 }}>
                  ● {matchStatus}
                </Tag>
                <Tag color="purple" style={{ fontSize: 9.5, margin: 0 }}>
                  {termName}
                </Tag>
              </Space>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PENERIMA:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {vendorName}
              </div>
              {vendorCode && <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>}
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>PO: {poNumber}</div>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>STATUS &amp; SISA TAGIHAN:</Text>
              <div style={{ fontWeight: 800, fontSize: 15, color: remainingBalance > 0 ? '#d97706' : '#059669', fontFamily: 'monospace' }}>
                Rp {remainingBalance.toLocaleString('id-ID')}
              </div>
              <Tag color={isPaid ? 'green' : paymentStatus === 'PARTIALLY_PAID' ? 'orange' : 'red'} style={{ fontSize: 9.5, margin: 0, marginTop: 2, fontWeight: 700 }}>
                ● {paymentStatus}
              </Tag>
            </Col>
          </Row>
        </div>

        {isPaid && (
          <Alert
            type="success"
            showIcon
            message="Invoice Ini Sudah Lunas (PAID)"
            description="Tidak ada tagihan tertunda pada invoice ini. Bukti pembayaran dapat dilihat melalui tab Riwayat Pembayaran."
            style={{ borderRadius: 6 }}
          />
        )}

        {/* Payment Input Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={isPaid || isSubmitting}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Tanggal Pembayaran Realisasi</span>}
                name="paymentDate"
                rules={[{ required: true, message: 'Tanggal pembayaran wajib dipilih' }]}
              >
                <DatePicker
                  style={{ width: '100%', borderRadius: 6 }}
                  format="DD MMMM YYYY"
                  allowClear={false}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Metode Pembayaran</span>}
                name="paymentMethod"
                rules={[{ required: true, message: 'Metode pembayaran wajib dipilih' }]}
              >
                <Select style={{ borderRadius: 6 }}>
                  <Option value="BANK_TRANSFER">Transfer Bank (RTGS / Kliring / BI-FAST)</Option>
                  <Option value="CHEQUE">Cek / Bilyet Giro</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>Nominal Pembayaran Realisasi (Rp)</span>
                    {remainingBalance > 0 && (
                      <a
                        onClick={() => form.setFieldsValue({ paymentAmount: remainingBalance })}
                        style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}
                      >
                        Isi Sisa Tagihan (Rp {remainingBalance.toLocaleString('id-ID')})
                      </a>
                    )}
                  </div>
                }
                name="paymentAmount"
                rules={[
                  { required: true, message: 'Nominal pembayaran wajib diisi' },
                  {
                    validator: async (_, value) => {
                      if (!value || Number(value) <= 0) {
                        return Promise.reject(new Error('Nominal pembayaran harus lebih besar dari Rp 0'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 6, fontWeight: 700, fontFamily: 'monospace', color: '#059669' }}
                  formatter={(val) => `Rp ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(val) => val!.replace(/Rp\s?|(\.*)/g, '') as any}
                  min={1}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Nomor Referensi Transaksi (No. Bukti Transfer)</span>}
                name="referenceNumber"
                rules={[{ required: true, message: 'Nomor referensi / bukti transfer wajib diisi' }]}
              >
                <Input id="input-payment-ref-number" placeholder="Contoh: TRX-20260908-001 / No. Bukti Transfer Bank" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Bank Sumber Dana</span>}
                name="bankName"
              >
                <Input prefix={<BankOutlined />} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan Pembayaran</span>}
                name="notes"
              >
                <Input style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>
    </Modal>
  );
};

export default ProcessPaymentModal;
