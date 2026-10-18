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
  Descriptions,
} from 'antd';
import {
  SendOutlined,
  DollarCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { FinanceService, PaymentRequestDto } from '@/services/finance.service';
import { formatCurrency } from '@/lib/formatters';

const { Text } = Typography;

export interface ResubmitPaymentRequestModalProps {
  open: boolean;
  onClose: () => void;
  paymentRequest: PaymentRequestDto | null;
  onResubmitted?: (updated: PaymentRequestDto) => void;
}

export const ResubmitPaymentRequestModal: React.FC<ResubmitPaymentRequestModalProps> = ({
  open,
  onClose,
  paymentRequest,
  onResubmitted,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && paymentRequest) {
      form.setFieldsValue({
        requestedAmount: Number(paymentRequest.requestedAmount || 0),
        revisionNotes: '',
        notes: paymentRequest.notes || '',
      });
    }
  }, [open, paymentRequest, form]);

  if (!paymentRequest) return null;

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await FinanceService.resubmitPaymentRequest(paymentRequest.id, {
        requestedAmount: Number(values.requestedAmount),
        revisionNotes: values.revisionNotes,
        notes: values.notes,
      });

      message.success(`Pengajuan pembayaran ${res.requestNumber} berhasil diajukan ulang ke Direktur.`);
      if (onResubmitted) onResubmitted(res);
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengajukan ulang pembayaran';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={680}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DollarCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <span>Revisi & Ajukan Ulang Pembayaran (Finance)</span>
        </div>
      }
      destroyOnClose
      footer={null}
    >
      <div style={{ marginTop: 12 }}>
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Catatan Revisi dari Direktur"
          description={
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>
              {paymentRequest.revisionNotes || 'Mohon tinjau kembali data pengajuan pembayaran ini.'}
            </div>
          }
          style={{ marginBottom: 16 }}
        />

        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8fafc' }}>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Nomor Pengajuan">
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                {paymentRequest.requestNumber}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Nomor Invoice">
              {paymentRequest.invoice?.invoiceNumber || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Vendor">
              {paymentRequest.invoice?.purchaseOrder?.vendor?.name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Nilai Invoice">
              {formatCurrency(Number(paymentRequest.invoice?.totalAmount || 0))}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Jumlah yang Diajukan (Rp)"
            name="requestedAmount"
            rules={[
              { required: true, message: 'Jumlah yang diajukan wajib diisi' },
              {
                validator: async (_, value) => {
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
              id="input-resubmit-amount"
            />
          </Form.Item>

          <Form.Item
            label="Tanggapan / Catatan Perbaikan Finance"
            name="revisionNotes"
            rules={[{ required: true, message: 'Tanggapan perbaikan wajib diisi' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Jelaskan perbaikan yang telah dilakukan berdasarkan catatan Direktur..."
              id="input-finance-revision-notes"
            />
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
              id="btn-resubmit-payment-request"
              style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 600 }}
            >
              Ajukan Ulang ke Direktur
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
