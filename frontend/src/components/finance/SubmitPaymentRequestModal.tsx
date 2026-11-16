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
  const [taxDetail, setTaxDetail] = useState<any>((invoice as any)?.invoiceTaxDetail || null);
  const [loadingTax, setLoadingTax] = useState<boolean>(false);

  useEffect(() => {
    if (open && invoice) {
      let isSubscribed = true;
      const directItd = (invoice as any).invoiceTaxDetail;
      if (directItd) {
        setTaxDetail(directItd);
        const netCash = directItd.netVendorCashPayable != null
          ? Number(directItd.netVendorCashPayable)
          : Number(invoice.totalAmount || 0);
        form.setFieldsValue({
          requestedAmount: netCash,
          bankName: 'Bank Mandiri',
          bankAccountNumber: '123-456-7890',
          bankAccountHolder: invoice.purchaseOrder?.vendor?.name || 'PT Vendor Rekanan',
          notes: `Pengajuan pembayaran faktur ${invoice.invoiceNumber}`,
        });
      } else if (invoice.id) {
        setLoadingTax(true);
        FinanceService.getInvoiceTax(invoice.id)
          .then((res: any) => {
            if (!isSubscribed) return;
            const fetchedItd = res?.taxDetail || res?.invoiceTaxDetail || res?.data?.invoiceTaxDetail || res?.data?.taxDetail;
            setTaxDetail(fetchedItd || null);
            const netCash = fetchedItd?.netVendorCashPayable != null
              ? Number(fetchedItd.netVendorCashPayable)
              : Number(invoice.totalAmount || 0);
            form.setFieldsValue({
              requestedAmount: netCash,
              bankName: 'Bank Mandiri',
              bankAccountNumber: '123-456-7890',
              bankAccountHolder: invoice.purchaseOrder?.vendor?.name || 'PT Vendor Rekanan',
              notes: `Pengajuan pembayaran faktur ${invoice.invoiceNumber}`,
            });
          })
          .catch(() => {
            if (isSubscribed) {
              form.setFieldsValue({
                requestedAmount: Number(invoice.totalAmount || 0),
                bankName: 'Bank Mandiri',
                bankAccountNumber: '123-456-7890',
                bankAccountHolder: invoice.purchaseOrder?.vendor?.name || 'PT Vendor Rekanan',
                notes: `Pengajuan pembayaran faktur ${invoice.invoiceNumber}`,
              });
            }
          })
          .finally(() => {
            if (isSubscribed) setLoadingTax(false);
          });
      }

      return () => {
        isSubscribed = false;
      };
    }
  }, [open, invoice, form]);

  const isMatchVerified = invoice?.matchStatus === 'MATCHED' || invoice?.matchStatus === 'VERIFIED';
  const hasActiveRequest = Boolean(
    activeRequest &&
    ['PENDING_DIRECTOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED_FOR_PAYMENT'].includes(activeRequest.status || '')
  );

  // Financial breakdown variables (Authoritative Tax Settlement)
  const dppAmount = Number(taxDetail?.dppCommercial ?? invoice?.totalAmount ?? 0);
  const ppnAmount = Number(taxDetail?.ppnAmount ?? 0);
  const grossLiability = Number(taxDetail?.grossCommercialLiability ?? (dppAmount + ppnAmount));
  const pphAmount = Number(taxDetail?.pphWithholdingAmount ?? 0);
  const wapuAmount = Number(taxDetail?.wapuPpnWithheldAmount ?? 0);
  const priorDeductions = Number(taxDetail?.priorDeductionsAmount ?? 0);

  // Existing cash payments already disbursed
  const existingPaymentsSum = Array.isArray(invoice?.payments)
    ? invoice.payments.reduce((acc: number, p: any) => (!p.deletedAt ? acc + Number(p.amount || 0) : acc), 0)
    : 0;

  const netVendorCashPayable = Number(taxDetail?.netVendorCashPayable ?? Math.max(0, grossLiability - pphAmount - wapuAmount - priorDeductions));
  const remainingNetPayable = Math.max(0, netVendorCashPayable - existingPaymentsSum);
  const hasTaxOrDeductions = ppnAmount > 0 || pphAmount > 0 || wapuAmount > 0 || priorDeductions > 0;

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
      width="min(680px, calc(100vw - 24px))"
      style={{ maxWidth: '100vw' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DollarCircleOutlined style={{ color: '#059669', fontSize: 18, flexShrink: 0 }} />
          <span style={{ wordBreak: 'break-word', minWidth: 0, flex: 1 }}>Pengajuan Persetujuan Pembayaran ke Direktur</span>
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

        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Row gutter={[16, 10]}>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Nomor Invoice:</Text>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8', fontSize: 13 }}>
                {invoice.invoiceNumber}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Nomor PO:</Text>
              <div style={{ fontWeight: 600, fontFamily: 'monospace', color: '#0f766e', fontSize: 13 }}>
                {invoice.purchaseOrder?.poNumber || '—'}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Vendor Penerima:</Text>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12.5 }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {invoice.purchaseOrder?.vendor?.name || '—'}
              </div>
            </Col>
            {invoice.paymentTerm?.termName && (
              <Col xs={24} sm={12}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Termin Procurement:</Text>
                <div>
                  <Tag color="cyan" style={{ fontSize: 11, margin: 0, fontWeight: 600 }}>{invoice.paymentTerm.termName}</Tag>
                </div>
              </Col>
            )}
          </Row>

          {/* Authoritative Settlement Breakdown */}
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1e3a8a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Rincian Rekonsiliasi Tagihan &amp; Kas Bersih Vendor
            </div>
            <Row gutter={[12, 8]}>
              <Col xs={12} sm={hasTaxOrDeductions ? 5 : 8}>
                <Text type="secondary" style={{ fontSize: 10.5 }}>Nilai DPP:</Text>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5, color: '#0f172a' }}>
                  {formatCurrency(dppAmount)}
                </div>
              </Col>
              {ppnAmount > 0 && (
                <Col xs={12} sm={5}>
                  <Text type="secondary" style={{ fontSize: 10.5 }}>PPN (11%):</Text>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5, color: '#0284c7' }}>
                    + {formatCurrency(ppnAmount)}
                  </div>
                </Col>
              )}
              <Col xs={12} sm={hasTaxOrDeductions ? 5 : 8}>
                <Text type="secondary" style={{ fontSize: 10.5 }}>Total Tagihan Bruto:</Text>
                <div style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 13, color: '#1d4ed8' }}>
                  {formatCurrency(grossLiability)}
                </div>
              </Col>
              {pphAmount > 0 && (
                <Col xs={12} sm={4}>
                  <Text type="secondary" style={{ fontSize: 10.5 }}>Potongan PPh:</Text>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5, color: '#dc2626' }}>
                    - {formatCurrency(pphAmount)}
                  </div>
                </Col>
              )}
              <Col xs={12} sm={hasTaxOrDeductions ? 5 : 8}>
                <Text type="secondary" style={{ fontSize: 10.5, color: '#059669', fontWeight: 600 }}>Jumlah Kas Bersih Vendor:</Text>
                <div style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 13.5, color: '#059669' }}>
                  {formatCurrency(netVendorCashPayable)}
                </div>
              </Col>
            </Row>

            {existingPaymentsSum > 0 && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span>Kas Sudah Dibayar: <strong style={{ color: '#0f172a' }}>{formatCurrency(existingPaymentsSum)}</strong></span>
                <span>Sisa Kas Bersih yang Dapat Diajukan: <strong style={{ color: '#059669' }}>{formatCurrency(remainingNetPayable)}</strong></span>
              </div>
            )}
          </div>
        </Card>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 4 }}>
                <span>Jumlah yang Diajukan (Rp)</span>
                <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                  Maksimum Kas Bersih: {formatCurrency(remainingNetPayable)}
                </span>
              </div>
            }
            name="requestedAmount"
            rules={[
              { required: true, message: 'Jumlah yang diajukan wajib diisi' },
              {
                validator: async (_, value) => {
                  if (value && value <= 0) {
                    return Promise.reject(new Error('Jumlah harus lebih besar dari 0'));
                  }
                  if (value && value > remainingNetPayable) {
                    return Promise.reject(
                      new Error(`Jumlah melebihi sisa kas bersih yang dapat dibayarkan ke vendor (${formatCurrency(remainingNetPayable)})`)
                    );
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
              max={remainingNetPayable}
              id="input-requested-amount"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Nama Bank Vendor"
                name="bankName"
                rules={[{ required: true, message: 'Nama bank wajib diisi' }]}
              >
                <Input prefix={<BankOutlined />} placeholder="Contoh: Bank Mandiri" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
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
