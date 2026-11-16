"use client";

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Row,
  Col,
  Button,
  Radio,
  message,
  Typography,
  Alert,
} from 'antd';
import {
  BankOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  FinanceService,
  CompanyBankAccountDto,
  CreateCompanyBankAccountPayload,
  UpdateCompanyBankAccountPayload,
} from '@/services/finance.service';

const { Text } = Typography;
const { Option } = Select;

interface ManageCompanyBankAccountModalProps {
  open: boolean;
  onClose: () => void;
  account?: CompanyBankAccountDto | null;
  accountToEdit?: CompanyBankAccountDto | null;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export const ManageCompanyBankAccountModal: React.FC<ManageCompanyBankAccountModalProps> = ({
  open,
  onClose,
  account,
  accountToEdit,
  onSuccess,
  onSaved,
}) => {
  const activeAccount = accountToEdit ?? account;
  const notifySuccess = onSuccess || onSaved || (() => {});
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const isEditMode = Boolean(activeAccount);

  useEffect(() => {
    if (open) {
      if (activeAccount) {
        form.setFieldsValue({
          companyCode: activeAccount.companyCode,
          bankName: activeAccount.bankName,
          bankCode: activeAccount.bankCode || undefined,
          accountNumber: activeAccount.accountNumber,
          accountHolderName: activeAccount.accountHolderName,
          accountType: activeAccount.accountType,
          accountPurpose: activeAccount.accountPurpose,
          currency: activeAccount.currency || 'IDR',
          isDefault: activeAccount.isDefault,
          effectiveDate: activeAccount.effectiveDate ? dayjs(activeAccount.effectiveDate) : undefined,
          expiryDate: activeAccount.expiryDate ? dayjs(activeAccount.expiryDate) : undefined,
          picName: activeAccount.picName || undefined,
          notes: activeAccount.notes || undefined,
          changeReason: '',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          companyCode: 'UBD',
          accountType: 'GIRO',
          accountPurpose: 'OPERATIONAL',
          currency: 'IDR',
          isDefault: false,
          effectiveDate: dayjs(),
        });
      }
    }
  }, [open, activeAccount, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const effectiveDateStr = values.effectiveDate ? values.effectiveDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const expiryDateStr = values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : null;

      if (isEditMode && activeAccount) {
        const payload: UpdateCompanyBankAccountPayload = {
          bankName: values.bankName.trim(),
          bankCode: values.bankCode ? values.bankCode.trim() : undefined,
          accountNumber: values.accountNumber.trim(),
          accountHolderName: values.accountHolderName.trim(),
          accountType: values.accountType,
          accountPurpose: values.accountPurpose,
          currency: values.currency ? values.currency.trim().toUpperCase() : 'IDR',
          isDefault: values.isDefault,
          effectiveDate: effectiveDateStr,
          expiryDate: expiryDateStr,
          picName: values.picName ? values.picName.trim() : undefined,
          notes: values.notes ? values.notes.trim() : undefined,
          changeReason: values.changeReason.trim(),
        };

        await FinanceService.updateCompanyBankAccount(activeAccount.id, payload);
        message.success('Master data rekening bank perusahaan berhasil diperbarui');
      } else {
        const payload: CreateCompanyBankAccountPayload = {
          companyCode: values.companyCode,
          bankName: values.bankName.trim(),
          bankCode: values.bankCode ? values.bankCode.trim() : undefined,
          accountNumber: values.accountNumber.trim(),
          accountHolderName: values.accountHolderName.trim(),
          accountType: values.accountType,
          accountPurpose: values.accountPurpose,
          currency: values.currency ? values.currency.trim().toUpperCase() : 'IDR',
          isDefault: values.isDefault,
          effectiveDate: effectiveDateStr,
          expiryDate: expiryDateStr,
          picName: values.picName ? values.picName.trim() : undefined,
          notes: values.notes ? values.notes.trim() : undefined,
          changeReason: values.changeReason.trim(),
        };

        await FinanceService.createCompanyBankAccount(payload);
        message.success('Master data rekening bank perusahaan berhasil didaftarkan');
      }

      form.resetFields();
      notifySuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan rekening bank';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BankOutlined style={{ color: '#059669', fontSize: 18 }} />
          <span>{isEditMode ? 'Edit Rekening Bank Perusahaan' : 'Tambah Rekening Bank Perusahaan'}</span>
        </div>
      }
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={isEditMode ? 'Simpan Perubahan' : 'Daftarkan Rekening'}
      cancelText="Batal"
      width={720}
      destroyOnClose
    >
      <div style={{ padding: '8px 0' }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              <strong>Pengendalian Sumber Dana:</strong> Rekening bank operasional yang didaftarkan akan menjadi pilihan sah bagi Tim Finance saat mengeksekusi pembayaran kas/bank untuk entitas terkait.
            </span>
          }
        />

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Entitas Hukum (PT)</span>}
                name="companyCode"
                rules={[{ required: true, message: 'Entitas hukum wajib dipilih' }]}
              >
                <Radio.Group disabled={isEditMode} buttonStyle="solid">
                  <Radio.Button value="UBD">PT UBD</Radio.Button>
                  <Radio.Button value="TVM">PT TVM</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Mata Uang</span>}
                name="currency"
                rules={[{ required: true, message: 'Mata uang wajib diisi' }]}
              >
                <Select style={{ borderRadius: 6 }}>
                  <Option value="IDR">IDR (Rupiah)</Option>
                  <Option value="USD">USD (US Dollar)</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Nama Bank</span>}
                name="bankName"
                rules={[{ required: true, message: 'Nama bank wajib diisi' }]}
              >
                <Input placeholder="Contoh: BCA / Bank Mandiri / BNI / BRI" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Kode Bank / BI-FAST (Opsional)</span>}
                name="bankCode"
              >
                <Input placeholder="Contoh: 014 (BCA), 008 (Mandiri)" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Nomor Rekening</span>}
                name="accountNumber"
                rules={[
                  { required: true, message: 'Nomor rekening wajib diisi' },
                  { pattern: /^[0-9A-Za-z\-]+$/, message: 'Format nomor rekening tidak valid' },
                ]}
              >
                <Input placeholder="Contoh: 1234567890" style={{ borderRadius: 6, fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Nama Pemilik Rekening (Atas Nama)</span>}
                name="accountHolderName"
                rules={[{ required: true, message: 'Nama pemilik rekening wajib diisi' }]}
              >
                <Input placeholder="Contoh: PT UBD / PT TVM" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Jenis Rekening</span>}
                name="accountType"
                rules={[{ required: true, message: 'Jenis rekening wajib dipilih' }]}
              >
                <Select style={{ borderRadius: 6 }}>
                  <Option value="GIRO">Giro Perusahaan (Checking / Current)</Option>
                  <Option value="SAVINGS">Tabungan Operasional (Savings)</Option>
                  <Option value="ESCROW">Escrow / Penampungan Khusus</Option>
                  <Option value="OTHER">Lainnya</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Tujuan / Peruntukan Rekening</span>}
                name="accountPurpose"
                rules={[{ required: true, message: 'Peruntukan rekening wajib dipilih' }]}
              >
                <Select style={{ borderRadius: 6 }}>
                  <Option value="OPERATIONAL">Operasional Umum</Option>
                  <Option value="PROJECT">Proyek Khusus</Option>
                  <Option value="VENDOR_PAYMENT">Pembayaran Vendor &amp; Rekanan</Option>
                  <Option value="TAX_REMITTANCE">Setoran Pajak Kas Negara (KPP)</Option>
                  <Option value="OTHER">Lainnya</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Tanggal Efektif Berlaku</span>}
                name="effectiveDate"
                rules={[{ required: true, message: 'Tanggal efektif wajib diisi' }]}
              >
                <DatePicker style={{ width: '100%', borderRadius: 6 }} format="DD MMMM YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Tanggal Kedaluwarsa (Opsional)</span>}
                name="expiryDate"
              >
                <DatePicker style={{ width: '100%', borderRadius: 6 }} format="DD MMMM YYYY" placeholder="Kosongkan jika aktif tanpa batas" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>PIC / Penanggung Jawab Rekening</span>}
                name="picName"
              >
                <Input placeholder="Contoh: Treasury Lead / Finance Manager" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Jadikan Rekening Utama (Default)</span>}
                name="isDefault"
                valuePropName="checked"
              >
                <Switch checkedChildren="Utama" unCheckedChildren="Biasa" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Catatan Tambahan (Opsional)</span>}
                name="notes"
              >
                <Input.TextArea rows={2} placeholder="Keterangan peruntukan rekening atau nomor branch bank..." style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                label={
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>
                    Alasan Perubahan / Pendaftaran (Wajib Audit Trail) *
                  </span>
                }
                name="changeReason"
                rules={[
                  { required: true, message: 'Alasan perubahan wajib diisi untuk rekam audit' },
                  { min: 5, message: 'Alasan perubahan minimal 5 karakter' },
                ]}
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Jelaskan alasan pendaftaran atau pembaruan data rekening ini..."
                  style={{ borderRadius: 6, borderColor: '#fca5a5' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>
    </Modal>
  );
};
