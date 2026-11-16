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
  FileTextOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  SwapRightOutlined,
  AuditOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  FinanceService,
  InvoiceDto,
  PaymentDto,
  CreatePaymentPayload,
  PaymentRequestDto,
  CompanyBankAccountDto,
} from '@/services/finance.service';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/formatters';

const { Text } = Typography;
const { Option } = Select;

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
  canProcessPayment = false,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [freshInvoice, setFreshInvoice] = useState<InvoiceDto | null>(null);
  const [freshPaymentRequest, setFreshPaymentRequest] = useState<PaymentRequestDto | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingValues, setPendingValues] = useState<any>(null);

  // Derive numeric ID from prop invoice
  const invoiceId = invoice ? Number((invoice as any).id || (invoice as any).invoiceId) : null;
  const paymentRequestId = paymentRequest ? Number(paymentRequest.id) : null;

  // Fetch fresh invoice and payment request from backend SSOT on modal open
  const loadFreshData = useCallback(async (invId: number, prqId?: number | null) => {
    try {
      const invData = await FinanceService.getInvoiceById(invId);
      setFreshInvoice(invData);
    } catch (err) {
      console.warn('Could not fetch fresh invoice for payment modal:', err);
    }

    if (prqId && !isNaN(prqId) && prqId > 0) {
      try {
        const prqData = await FinanceService.getPaymentRequestById(prqId);
        setFreshPaymentRequest(prqData);
      } catch (err) {
        console.warn('Could not fetch fresh payment request for payment modal:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (open && invoiceId && !isNaN(invoiceId) && invoiceId > 0) {
      loadFreshData(invoiceId, paymentRequestId);
    } else {
      setFreshInvoice(null);
      setFreshPaymentRequest(null);
      setShowConfirmModal(false);
      setPendingValues(null);
    }
  }, [open, invoiceId, paymentRequestId, loadFreshData]);

  // Use fresh backend records if available, fallback to props
  const activeInvoice = freshInvoice || invoice;
  const activePaymentRequest = freshPaymentRequest || paymentRequest;

  // Metadata Extraction from Backend SSOT Invoice & Relations
  const invoiceNumber = activeInvoice?.invoiceNumber || '—';
  const po = (activeInvoice as any)?.purchaseOrder;
  const poNumber = po?.poNumber || (activeInvoice as any)?.poNumber || '—';
  const orderType = (po?.orderType || (activeInvoice as any)?.orderType || 'MATERIAL').toUpperCase();
  const vendor = po?.vendor || (activeInvoice as any)?.vendor;
  const vendorName = vendor?.name || (activeInvoice as any)?.vendorName || '—';
  const vendorCode = vendor?.code || (activeInvoice as any)?.vendorCode || '';
  const purchaseRequest = po?.purchaseRequest;
  const project = purchaseRequest?.project || (activeInvoice as any)?.project;
  const projectName = project?.name || (activeInvoice as any)?.projectName || 'Proyek Tanpa Nama';
  const projectId = project?.id || purchaseRequest?.projectId || (activeInvoice as any)?.projectId;
  const paymentTerm = (activeInvoice as any)?.paymentTerm;
  const termName = paymentTerm?.termName || 'Pelunasan Penuh';
  const matchStatus = activeInvoice?.matchStatus || 'PENDING';
  const isPaid = (activeInvoice as any)?.paymentStatus === 'PAID';
  const paymentStatus = (activeInvoice as any)?.paymentStatus || 'UNPAID';

  // Tax Details & Approval Snapshot SSOT
  const taxDetail = activeInvoice?.invoiceTaxDetail;
  const snapshot = activePaymentRequest?.approvalSnapshot;

  // Commercial DPP (PO Value)
  const dppAmount = taxDetail?.dppCommercial != null
    ? Number(taxDetail.dppCommercial)
    : (snapshot?.dppAmount != null ? Number(snapshot.dppAmount) : Number(activeInvoice?.totalAmount || 0));

  // PPN Details
  const ppnAmount = taxDetail?.ppnAmount != null
    ? Number(taxDetail.ppnAmount)
    : (snapshot?.ppnAmount != null ? Number(snapshot.ppnAmount) : 0);
  const rawPpnRate = taxDetail?.ppnRate != null
    ? Number(taxDetail.ppnRate)
    : (snapshot?.ppnRate != null ? Number(snapshot.ppnRate) : null);
  const ppnRate = rawPpnRate != null
    ? (rawPpnRate < 1 && rawPpnRate > 0 ? Math.round(rawPpnRate * 100) : rawPpnRate)
    : (ppnAmount > 0 ? 11 : 0);

  // Gross Invoice Liability (DPP + PPN)
  const grossLiability = taxDetail?.grossCommercialLiability != null
    ? Number(taxDetail.grossCommercialLiability)
    : (snapshot?.grossAmount != null ? Number(snapshot.grossAmount) : (dppAmount + ppnAmount));

  // PPh Withholding Details
  const pphAmount = taxDetail?.pphWithholdingAmount != null
    ? Number(taxDetail.pphWithholdingAmount)
    : (snapshot?.pphAmount != null ? Number(snapshot.pphAmount) : 0);
  const pphRate = snapshot?.pphRate != null
    ? Number(snapshot.pphRate)
    : (taxDetail?.taxRuleSnapshot?.pph?.rate != null ? Number(taxDetail.taxRuleSnapshot.pph.rate) : (pphAmount > 0 ? 1 : 0));

  // Additional Deductions
  const wapuAmount = Number(taxDetail?.wapuPpnWithheldAmount || snapshot?.wapuAmount || 0);
  const priorDeductionsAmount = Number(taxDetail?.priorDeductionsAmount || snapshot?.priorDeductionsAmount || 0);

  // Net Vendor Cash Payable
  const netVendorCashPayable = taxDetail?.netVendorCashPayable != null
    ? Number(taxDetail.netVendorCashPayable)
    : (snapshot?.netPayableAmount != null
      ? Number(snapshot.netPayableAmount)
      : Math.max(0, grossLiability - pphAmount - wapuAmount - priorDeductionsAmount));

  // Calculate cumulative cash payments on invoice
  const alreadyPaidCash = useMemo(() => {
    if (!activeInvoice?.payments || !Array.isArray(activeInvoice.payments)) return 0;
    return activeInvoice.payments.reduce(
      (sum: number, p: any) => sum + (p.deletedAt ? 0 : Number(p.amount || p.amountPaid || 0)),
      0
    );
  }, [activeInvoice]);

  // Remaining Net Vendor Cash Payable on this Invoice
  const remainingNetCash = Math.max(0, netVendorCashPayable - alreadyPaidCash);

  // Director Approved Cash Amount
  const directorApprovedAmount = activePaymentRequest?.approvedAmount != null
    ? Number(activePaymentRequest.approvedAmount)
    : (snapshot?.netPayableAmount != null
      ? Number(snapshot.netPayableAmount)
      : (snapshot?.requestedAmount != null ? Number(snapshot.requestedAmount) : netVendorCashPayable));

  // Already Paid Cash against this specific Payment Request
  const alreadyPaidOnThisPrq = useMemo(() => {
    if (!activeInvoice?.payments || !Array.isArray(activeInvoice.payments) || !activePaymentRequest?.id) return 0;
    return activeInvoice.payments.reduce(
      (sum: number, p: any) =>
        sum +
        (!p.deletedAt && Number(p.paymentRequestId) === Number(activePaymentRequest.id)
          ? Number(p.amount || p.amountPaid || 0)
          : 0),
      0
    );
  }, [activeInvoice, activePaymentRequest]);

  // Remaining Approved Amount for this execution
  const remainingApprovedAmount = Math.max(0, directorApprovedAmount - alreadyPaidOnThisPrq);

  // Maximum allowable payment for current execution
  const maxPaymentAllowed = Math.min(remainingApprovedAmount, remainingNetCash);

  // Vendor Bank Destination Account
  const vendorBankName =
    snapshot?.vendorBankName ||
    (vendor as any)?.bankName ||
    'Bank Mandiri';
  const vendorBankAccount =
    snapshot?.vendorBankAccount ||
    (vendor as any)?.bankAccountNumber ||
    (vendor as any)?.bankAccount ||
    '';
  const vendorBankAccountHolder =
    snapshot?.vendorBankAccountHolder ||
    (vendor as any)?.bankAccountHolder ||
    vendorName;

  // Approver Details
  const requestNumber = activePaymentRequest?.requestNumber || 'PRQ-20261115-001';
  const requestStatus = activePaymentRequest?.status || 'APPROVED_FOR_PAYMENT';
  const isApproved = requestStatus === 'APPROVED_FOR_PAYMENT';
  const approverName =
    activePaymentRequest?.approver?.fullName ||
    activePaymentRequest?.approver?.email ||
    snapshot?.approverName ||
    'Direktur';
  const approvedAt = activePaymentRequest?.approvedAt || snapshot?.approvedAt || (snapshot as any)?.directorApprovedAt;
  const approvalNotes =
    (activePaymentRequest as any)?.approvalNotes ||
    (snapshot as any)?.approvalNotes ||
    activePaymentRequest?.notes ||
    null;

  // Stale Snapshot Version Detection
  const isStaleSnapshot = Boolean(
    activeInvoice?.version &&
    snapshot?.invoiceVersion &&
    activeInvoice.version > snapshot.invoiceVersion
  );

  // Missing Destination Account Detection
  const isMissingDestination = !vendorBankAccount || String(vendorBankAccount).trim() === '';

  // Authoritative Legal Entity Resolution
  const transactionCompanyCode = useMemo(() => {
    const raw =
      (activePaymentRequest as any)?.companyCode ||
      (activeInvoice as any)?.companyCode ||
      (taxDetail as any)?.companyCode ||
      (po as any)?.companyCode ||
      (project as any)?.companyCode ||
      (project as any)?.company;
    if (!raw) return undefined;
    const str = String(raw).trim().toUpperCase();
    if (str.includes('TVM')) return 'TVM';
    if (str.includes('UBD')) return 'UBD';
    return undefined;
  }, [activePaymentRequest, activeInvoice, taxDetail, po, project]);

  // Query Authoritative Eligible Company Bank Accounts
  const {
    data: eligibleCompanyBankAccounts = [],
    isLoading: loadingAccounts,
  } = useQuery<CompanyBankAccountDto[]>({
    queryKey: ['finance', 'company-bank-accounts', 'eligible', transactionCompanyCode],
    queryFn: () => FinanceService.getEligibleCompanyBankAccounts(transactionCompanyCode),
    enabled: open,
    staleTime: 30000,
  });

  const defaultAccount = useMemo(() => {
    return (
      eligibleCompanyBankAccounts.find((a) => a.isDefault) ||
      eligibleCompanyBankAccounts[0] ||
      null
    );
  }, [eligibleCompanyBankAccounts]);

  const watchedAccountId = Form.useWatch('companyBankAccountId', form);
  const selectedSourceAccount = useMemo(() => {
    if (watchedAccountId) {
      const found = eligibleCompanyBankAccounts.find((a) => Number(a.id) === Number(watchedAccountId));
      if (found) return found;
    }
    return defaultAccount;
  }, [watchedAccountId, eligibleCompanyBankAccounts, defaultAccount]);

  // Gating Flags for Legal Entity & Bank Account Selection
  const hasValidCompanyCode = Boolean(
    transactionCompanyCode && (transactionCompanyCode === 'UBD' || transactionCompanyCode === 'TVM')
  );
  const hasEligibleAccounts = eligibleCompanyBankAccounts.length > 0;
  const isAccountGated = !hasValidCompanyCode || (!loadingAccounts && !hasEligibleAccounts);

  // Gating Flag for Submission
  const canSubmitPayment =
    canProcessPayment &&
    !isPaid &&
    isApproved &&
    !isStaleSnapshot &&
    !isMissingDestination &&
    !isAccountGated &&
    maxPaymentAllowed > 0;

  // Watch paymentAmount input for real-time remaining preview
  const watchedPaymentAmount = Form.useWatch('paymentAmount', form);
  const currentProposedPayment = Number(watchedPaymentAmount ?? maxPaymentAllowed ?? 0);
  const projectedRemainingApproved = Math.max(0, remainingApprovedAmount - currentProposedPayment);
  const isPartialRealization =
    currentProposedPayment > 0 &&
    maxPaymentAllowed > 0 &&
    currentProposedPayment < remainingApprovedAmount;

  // Synchronize form initial values
  useEffect(() => {
    if (open && activeInvoice) {
      const defaultAmount = maxPaymentAllowed > 0 ? maxPaymentAllowed : 0;
      form.setFieldsValue({
        paymentDate: dayjs(),
        paymentMethod: 'BANK_TRANSFER',
        paymentAmount: defaultAmount,
        companyBankAccountId: defaultAccount?.id || undefined,
        referenceNumber: '',
        notes: `Pembayaran ${orderType === 'SERVICE' ? 'jasa' : 'pengadaan'} tagihan ${invoiceNumber} untuk vendor ${vendorName}.`,
      });
    } else if (!open) {
      form.resetFields();
    }
  }, [open, activeInvoice, maxPaymentAllowed, invoiceNumber, vendorName, orderType, defaultAccount, form]);

  // When default account loads asynchronously, update form if not selected
  useEffect(() => {
    if (open && defaultAccount && !form.getFieldValue('companyBankAccountId')) {
      form.setFieldsValue({ companyBankAccountId: defaultAccount.id });
    }
  }, [open, defaultAccount, form]);

  // Step 1: Trigger Form Validation & Open Confirmation Modal
  const handleInitiatePayment = async () => {
    try {
      const values = await form.validateFields();
      if (Number(values.paymentAmount) > maxPaymentAllowed) {
        message.error(`Nominal pembayaran melebihi batas yang diizinkan (Rp ${maxPaymentAllowed.toLocaleString('id-ID')}).`);
        return;
      }
      setPendingValues(values);
      setShowConfirmModal(true);
    } catch (err: any) {
      console.error('[ProcessPaymentModal] Form validation failed:', err);
      message.error('Harap periksa isian formulir yang belum valid.');
    }
  };

  // Step 2: Confirm & Execute Authoritative Backend Payment Creation
  const handleConfirmedSubmit = async () => {
    if (!invoiceId) {
      message.error('ID Invoice tidak valid.');
      return;
    }

    if (!canProcessPayment) {
      message.error('Hanya role Finance yang berwenang mengeksekusi pembayaran.');
      return;
    }

    if (!pendingValues) return;

    setIsSubmitting(true);
    try {
      const selectedId = Number(pendingValues.companyBankAccountId || selectedSourceAccount?.id);
      const payload: CreatePaymentPayload = {
        invoiceId: Number(invoiceId),
        paymentRequestId: activePaymentRequest?.id ? Number(activePaymentRequest.id) : undefined,
        paymentDate: pendingValues.paymentDate
          ? pendingValues.paymentDate.toISOString()
          : new Date().toISOString(),
        paymentAmount: Number(pendingValues.paymentAmount),
        amount: Number(pendingValues.paymentAmount),
        companyBankAccountId: selectedId,
        paymentMethod: pendingValues.paymentMethod || 'BANK_TRANSFER',
        referenceNumber: (pendingValues.referenceNumber || '').trim(),
        bankName: selectedSourceAccount?.bankName || 'Bank Mandiri',
        notes: (pendingValues.notes || '').trim(),
      };

      const newPayment = await FinanceService.createPayment(payload);

      setShowConfirmModal(false);

      if (newPayment.paymentStatus === 'PAID' || newPayment.isFullyPaid) {
        message.success('Pembayaran berhasil diproses: Invoice telah lunas (PAID).');
      } else if (newPayment.paymentStatus === 'PARTIALLY_PAID') {
        message.success(
          `Pembayaran sebagian berhasil (PARTIALLY_PAID). Sisa kas bersih: Rp ${(newPayment.remainingAmount || 0).toLocaleString('id-ID')}`
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
        'Gagal memproses pembayaran. Periksa kembali nominal persetujuan atau integritas invoice.';
      message.error(apiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invoice) return null;

  // Segregation of Duties: Block non-finance roles
  if (!canProcessPayment) {
    return (
      <Modal
        open={open}
        onCancel={onClose}
        width="min(500px, calc(100vw - 24px))"
        style={{ maxWidth: '100vw' }}
        centered
        destroyOnClose
        title="Otoritas Pembayaran Ditolak"
        footer={[
          <Button key="close" onClick={onClose} style={{ borderRadius: 6, minHeight: 44 }}>
            Tutup
          </Button>,
        ]}
      >
        <Alert
          type="error"
          showIcon
          icon={<LockOutlined />}
          message="Segregation of Duties (SoD) Enforced"
          description="Hanya role Finance yang berwenang mengakses dan mengeksekusi pembayaran kas/bank vendor. Hak akses Anda dibatasi oleh kebijakan tata kelola sistem."
          style={{ margin: '16px 0', borderRadius: 8 }}
        />
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width="min(980px, calc(100vw - 24px))"
        style={{ maxWidth: '100vw', top: 12, paddingBottom: 0 }}
        styles={{
          content: {
            maxHeight: 'calc(100vh - 24px)',
            display: 'flex',
            flexDirection: 'column',
            padding: '14px 18px',
            overflow: 'hidden',
          },
          header: {
            flexShrink: 0,
            paddingBottom: 10,
            marginBottom: 0,
            borderBottom: '1px solid #e2e8f0',
          },
          body: {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '10px 8px',
          },
          footer: {
            flexShrink: 0,
            paddingTop: 10,
            marginTop: 0,
            borderTop: '1px solid #e2e8f0',
          },
        }}
        centered
        destroyOnClose
        title={
          /* SECTION A: COMPACT WORKSPACE HEADER */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingRight: 28,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 8,
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DollarCircleOutlined style={{ fontSize: 19 }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15.5,
                    color: '#0f172a',
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                  }}
                >
                  Eksekusi Pembayaran Kas/Bank (Treasury Execution) — {invoiceNumber}
                </div>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    wordBreak: 'break-word',
                    display: 'block',
                  }}
                >
                  Workspace realisasi pembayaran tagihan vendor berdasarkan persetujuan Direktur
                </Text>
              </div>
            </div>

            <Space size={6} wrap>
              {hasValidCompanyCode && (
                <Tag
                  color={transactionCompanyCode === 'TVM' ? 'cyan' : 'blue'}
                  style={{ margin: 0, fontWeight: 700, fontSize: 11, padding: '2px 8px' }}
                >
                  Entitas: PT {transactionCompanyCode}
                </Tag>
              )}
              <Tag
                color={isApproved ? 'green' : 'orange'}
                style={{ margin: 0, fontWeight: 700, fontSize: 11, padding: '2px 8px' }}
              >
                ● {requestStatus}
              </Tag>
              <Tag
                color={isPaid ? 'green' : paymentStatus === 'PARTIALLY_PAID' ? 'orange' : 'red'}
                style={{ margin: 0, fontWeight: 700, fontSize: 11, padding: '2px 8px' }}
              >
                ● {paymentStatus}
              </Tag>
            </Space>
          </div>
        }
        footer={
          /* SECTION G: STICKY ACTION FOOTER */
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 15 }} />
                <Text style={{ fontSize: 12.5, color: '#334155' }}>
                  Disetujui Direktur:{' '}
                  <strong style={{ color: '#059669', fontSize: 13.5, fontFamily: 'monospace' }}>
                    Rp {directorApprovedAmount.toLocaleString('id-ID')}
                  </strong>
                </Text>
              </div>
              {alreadyPaidCash > 0 && (
                <Tag color="warning" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                  Terbayar: Rp {alreadyPaidCash.toLocaleString('id-ID')} • Sisa: Rp{' '}
                  {remainingApprovedAmount.toLocaleString('id-ID')}
                </Tag>
              )}
              {isPartialRealization && (
                <Tag color="gold" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                  Realisasi Parsial: Rp {currentProposedPayment.toLocaleString('id-ID')}
                </Tag>
              )}
            </div>

            <Space size={10} wrap>
              <Button
                onClick={onClose}
                style={{ borderRadius: 6, minHeight: 42, padding: '0 18px', fontWeight: 500 }}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="primary"
                onClick={handleInitiatePayment}
                loading={isSubmitting}
                disabled={!canSubmitPayment || isSubmitting}
                icon={<SendOutlined />}
                id="btn-submit-process-payment"
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  minHeight: 42,
                  padding: '0 22px',
                  backgroundColor: canSubmitPayment ? '#059669' : undefined,
                  borderColor: canSubmitPayment ? '#059669' : undefined,
                }}
              >
                {isPaid
                  ? 'Invoice Telah Lunas'
                  : !isApproved
                  ? 'Menunggu Persetujuan Direktur'
                  : isStaleSnapshot
                  ? 'Perlu Revisi Persetujuan'
                  : 'Proses Pembayaran'}
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* SECTION A.2: COMPACT TRANSACTION CONTEXT BAR */}
          <div
            style={{
              background: '#f8fafc',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Row gutter={[12, 8]} align="middle">
              <Col xs={24} sm={12} md={6}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Faktur Invoice &amp; PO
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', fontFamily: 'monospace' }}>
                    {invoiceNumber}
                  </span>
                  <Tag
                    color={matchStatus === 'VERIFIED' ? 'green' : matchStatus === 'MATCHED' ? 'blue' : 'orange'}
                    style={{ fontSize: 10, margin: 0, fontWeight: 700, lineHeight: '16px' }}
                  >
                    ● {matchStatus}
                  </Tag>
                  <Tag
                    color={orderType === 'SERVICE' ? 'geekblue' : 'blue'}
                    style={{ fontSize: 10, margin: 0, fontWeight: 600, lineHeight: '16px' }}
                  >
                    {orderType}
                  </Tag>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                  PO: <strong>{poNumber}</strong> • <span style={{ color: '#6d28d9' }}>{termName}</span>
                </div>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Vendor Penerima
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#0f766e',
                    marginTop: 2,
                    wordBreak: 'break-word',
                  }}
                >
                  <ShopOutlined style={{ marginRight: 5 }} />
                  {vendorName}
                </div>
                {vendorCode && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Kode Vendor: <strong style={{ fontFamily: 'monospace' }}>{vendorCode}</strong>
                  </div>
                )}
              </Col>

              <Col xs={24} sm={12} md={7}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Proyek Terkait
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: '#0f172a',
                    wordBreak: 'break-word',
                    marginTop: 2,
                    lineHeight: 1.35,
                  }}
                >
                  {projectName}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {projectId ? `Project ID #${projectId}` : 'Tanpa ID Proyek'}
                </div>
              </Col>

              <Col xs={24} sm={12} md={5}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Pengajuan Pembayaran
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    marginTop: 2,
                  }}
                >
                  {requestNumber}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Status: <strong style={{ color: isApproved ? '#059669' : '#d97706' }}>{requestStatus}</strong>
                </div>
              </Col>
            </Row>
          </div>

          {/* CRITICAL GATING & COMPLIANCE ALERTS */}
          {isStaleSnapshot && (
            <Alert
              type="error"
              showIcon
              icon={<WarningOutlined />}
              message="Perubahan Data Invoice Terdeteksi (Stale Approval Snapshot)"
              description={`Versi data invoice saat ini (${activeInvoice?.version}) lebih baru dari versi data saat persetujuan Direktur diberikan (${snapshot?.invoiceVersion}). Demi integritas kepatuhan keuangan, eksekusi pembayaran diblokir. Harap minta revisi (Return) Payment Request agar ditinjau ulang.`}
              style={{ borderRadius: 8 }}
            />
          )}

          {!isApproved && (
            <Alert
              type="warning"
              showIcon
              message="Payment Request Belum Disetujui Direktur"
              description={`Status pengajuan pembayaran saat ini adalah "${requestStatus}". Sesuai tata kelola keuangan, pencairan dana hanya dapat dilakukan setelah persetujuan resmi Direktur (APPROVED_FOR_PAYMENT).`}
              style={{ borderRadius: 8 }}
            />
          )}

          {isMissingDestination && (
            <Alert
              type="error"
              showIcon
              message="Rekening Tujuan Vendor Belum Terdaftar"
              description="Nomor rekening bank tujuan pencairan vendor belum terdaftar pada master vendor atau snapshot persetujuan. Harap lengkapi rekening tujuan vendor sebelum memproses pembayaran."
              style={{ borderRadius: 8 }}
            />
          )}

          {isPaid && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="Invoice Ini Sudah Lunas (PAID)"
              description="Seluruh kewajiban pembayaran faktur vendor telah terselesaikan. Bukti pembayaran dapat dicetak atau dilihat melalui Riwayat Pembayaran."
              style={{ borderRadius: 8 }}
            />
          )}

          {/* SECTION B & C: UNIFIED FINANCIAL SUMMARY & DIRECTOR APPROVAL GOVERNANCE */}
          <Row gutter={[12, 12]} align="stretch">
            {/* LEFT (7 COLS): SECTION B — FINANCIAL SUMMARY & TAX RECONCILIATION */}
            <Col xs={24} lg={14} style={{ display: 'flex' }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '10px 12px',
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileTextOutlined style={{ color: '#059669', fontSize: 14 }} />
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                        Rincian Keuangan &amp; Rekonsiliasi Pembayaran
                      </span>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Otoritatif Backend SSOT
                    </Text>
                  </div>

                  {/* 3 Primary KPI Highlight Cards */}
                  <Row gutter={[8, 8]}>
                    <Col xs={24} sm={8}>
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          Nilai DPP / Komersial
                        </div>
                        <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', margin: '2px 0' }}>
                          Rp {dppAmount.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.25 }}>
                          Nilai komersial PO / Dasar Pengenaan Pajak
                        </div>
                      </div>
                    </Col>

                    <Col xs={24} sm={8}>
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          Total Tagihan Bruto
                        </div>
                        <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', margin: '2px 0' }}>
                          Rp {grossLiability.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.25 }}>
                          Kewajiban legal faktur (DPP + PPN)
                        </div>
                      </div>
                    </Col>

                    <Col xs={24} sm={8}>
                      <div
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #6ee7b7',
                          borderRadius: 6,
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                          Kas Bersih Disetujui
                        </div>
                        <div style={{ fontSize: 15.5, fontWeight: 800, color: '#059669', fontFamily: 'monospace', margin: '2px 0' }}>
                          Rp {directorApprovedAmount.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: 10, color: '#047857', lineHeight: 1.25 }}>
                          Pencairan kas vendor setelah potongan PPh
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* Compact Tax & Settlement Breakdown Strip */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11.5,
                  }}
                >
                  <Row gutter={[12, 6]} align="middle">
                    <Col xs={12} sm={6}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                        Nilai DPP (Dasar Pengenaan):
                      </span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                        Rp {dppAmount.toLocaleString('id-ID')}
                      </strong>
                    </Col>

                    <Col xs={12} sm={6}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                        PPN ({ppnRate}%):
                      </span>
                      <strong style={{ color: ppnAmount > 0 ? '#1d4ed8' : '#64748b', fontFamily: 'monospace' }}>
                        {ppnAmount > 0 ? `+ Rp ${ppnAmount.toLocaleString('id-ID')}` : 'Tidak Ada PPN'}
                      </strong>
                    </Col>

                    <Col xs={12} sm={6}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                        Total Tagihan Bruto:
                      </span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                        Rp {grossLiability.toLocaleString('id-ID')}
                      </strong>
                    </Col>

                    <Col xs={12} sm={6}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                        Potongan PPh ({pphRate}%):
                      </span>
                      <strong style={{ color: pphAmount > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                        {pphAmount > 0 ? `- Rp ${pphAmount.toLocaleString('id-ID')}` : 'Tidak Ada PPh'}
                      </strong>
                    </Col>

                    {wapuAmount > 0 && (
                      <Col xs={12} sm={6}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                          PPN Dipungut WAPU:
                        </span>
                        <strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>
                          - Rp {wapuAmount.toLocaleString('id-ID')}
                        </strong>
                      </Col>
                    )}

                    {priorDeductionsAmount > 0 && (
                      <Col xs={12} sm={6}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                          Potongan Lainnya:
                        </span>
                        <strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>
                          - Rp {priorDeductionsAmount.toLocaleString('id-ID')}
                        </strong>
                      </Col>
                    )}

                    {alreadyPaidCash > 0 && (
                      <Col xs={12} sm={6}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: 10.5 }}>
                          Terbayar Sebelumnya:
                        </span>
                        <strong style={{ color: '#b45309', fontFamily: 'monospace' }}>
                          - Rp {alreadyPaidCash.toLocaleString('id-ID')}
                        </strong>
                      </Col>
                    )}
                  </Row>

                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 6,
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: '#065f46', fontWeight: 600, fontSize: 11.5 }}>
                      Sisa Kas Bersih Vendor yang Berhak Dibayar:
                    </span>
                    <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace', fontSize: 13.5 }}>
                      Rp {remainingNetCash.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </Col>

            {/* RIGHT (10 COLS): SECTION C — DIRECTOR APPROVAL SUMMARY (READ-ONLY) */}
            <Col xs={24} lg={10} style={{ display: 'flex' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  border: '1px solid #34d399',
                  borderRadius: 8,
                  padding: '10px 12px',
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AuditOutlined style={{ color: '#047857', fontSize: 13 }} />
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: '#065f46',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          NOMINAL YANG DISETUJUI DIREKTUR
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 21,
                          fontWeight: 800,
                          color: '#047857',
                          fontFamily: 'monospace',
                          lineHeight: 1.2,
                          margin: '3px 0 2px',
                        }}
                      >
                        Rp {directorApprovedAmount.toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#065f46', fontWeight: 600 }}>
                        Pencairan Kas Bersih Vendor (D_cash)
                      </div>
                    </div>

                    <Tag color="green" style={{ fontSize: 10.5, fontWeight: 700, margin: 0 }}>
                      ● {requestStatus}
                    </Tag>
                  </div>

                  {/* Read-only Approval Metadata */}
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      background: 'rgba(255, 255, 255, 0.75)',
                      borderRadius: 6,
                      border: '1px solid #a7f3d0',
                      fontSize: 11.5,
                      color: '#334155',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748b' }}>Disetujui oleh:</span>
                      <strong>{approverName}</strong>
                    </div>
                    {approvedAt && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                        <span style={{ color: '#64748b' }}>Waktu Otorisasi:</span>
                        <span>{formatDateTime(approvedAt)}</span>
                      </div>
                    )}
                    {approvalNotes && (
                      <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed #a7f3d0', fontSize: 11 }}>
                        <span style={{ color: '#64748b' }}>Catatan: </span>
                        <span style={{ color: '#0f172a' }}>{approvalNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.45 }}>
                  <strong>Keterangan Kas &amp; Perpajakan:</strong> Direktur menyetujui pencairan kas bersih sebesar{' '}
                  <strong>Rp {directorApprovedAmount.toLocaleString('id-ID')}</strong> untuk ditransfer ke rekening vendor.
                  {pphAmount > 0 && (
                    <span>
                      {' '}Potongan PPh sebesar <strong>Rp {pphAmount.toLocaleString('id-ID')}</strong> ({pphRate}%) tidak ditransfer ke vendor,
                      melainkan merupakan kewajiban potongan pajak yang disetorkan terpisah oleh Treasury ke Kas Negara (KPP).
                    </span>
                  )}
                  {alreadyPaidCash > 0 && (
                    <div style={{ marginTop: 4, color: '#b45309', fontWeight: 600 }}>
                      ⚠️ Telah dilakukan pembayaran sebelumnya sebesar Rp {alreadyPaidCash.toLocaleString('id-ID')}. Sisa persetujuan aktif: Rp {remainingApprovedAmount.toLocaleString('id-ID')}.
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* ENTITY & ACCOUNT GATING ALERTS */}
          {!hasValidCompanyCode && (
            <Alert
              type="error"
              showIcon
              message={
                <span>
                  <strong>Kepemilikan Entitas Tidak Diketahui:</strong> Data transaksi tidak memiliki kepemilikan entitas hukum (PT UBD / PT TVM) yang terverifikasi. Eksekusi kas/bank diblokir untuk mencegah kesalahan pembebanan rekening operasional.
                </span>
              }
              style={{ borderRadius: 8 }}
            />
          )}

          {!hasEligibleAccounts && hasValidCompanyCode && !loadingAccounts && (
            <Alert
              type="warning"
              showIcon
              message={
                <span>
                  <strong>Tidak Ada Rekening Sumber Dana:</strong> Belum ada rekening bank operasional yang aktif &amp; sah untuk entitas <strong>PT {transactionCompanyCode}</strong>. Eksekusi pembayaran kas diblokir. Harap hubungi Administrator untuk mendaftarkan master rekening bank perusahaan.
                </span>
              }
              style={{ borderRadius: 8 }}
            />
          )}

          {/* FORM WRAPPER FOR SECTION D (SOURCE ACCOUNT) & SECTION E (PAYMENT DETAILS) */}
          <Form
            form={form}
            layout="vertical"
            disabled={!canSubmitPayment || isSubmitting}
          >
            {/* SECTION D: SIDE-BY-SIDE BANK ACCOUNT ROUTING (SOURCE VS. DESTINATION) */}
            <Row gutter={[12, 12]} align="stretch" style={{ marginBottom: 12 }}>
              {/* D.1: SOURCE ACCOUNT — COMPANY BANK ACCOUNT */}
              <Col xs={24} md={12} style={{ display: 'flex' }}>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '10px 12px',
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BankOutlined style={{ color: '#059669', fontSize: 15 }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                          Bank Sumber Dana (Rekening Operasional Perusahaan)
                        </span>
                      </div>
                      {hasValidCompanyCode && (
                        <Tag
                          color={transactionCompanyCode === 'TVM' ? 'cyan' : 'blue'}
                          style={{ fontSize: 10.5, fontWeight: 700, margin: 0 }}
                        >
                          PT {transactionCompanyCode}
                        </Tag>
                      )}
                    </div>

                    <Form.Item
                      name="companyBankAccountId"
                      style={{ marginBottom: 8 }}
                      rules={[{ required: true, message: 'Rekening operasional sumber dana wajib dipilih' }]}
                    >
                      <Select
                        showSearch
                        placeholder={
                          loadingAccounts
                            ? 'Memuat rekening bank perusahaan...'
                            : 'Pilih rekening operasional perusahaan'
                        }
                        loading={loadingAccounts}
                        disabled={!canSubmitPayment || loadingAccounts || eligibleCompanyBankAccounts.length === 0}
                        style={{ borderRadius: 6, minHeight: 40 }}
                        optionLabelProp="label"
                        filterOption={(input, option) => {
                          const text = String((option as any)?.searchtext || '').toLowerCase();
                          return text.includes(input.toLowerCase());
                        }}
                      >
                        {eligibleCompanyBankAccounts.map((acc) => {
                          const maskedNum =
                            acc.accountNumber.length > 4
                              ? `••••••${acc.accountNumber.slice(-4)}`
                              : acc.accountNumber;
                          return (
                            <Option
                              key={acc.id}
                              value={acc.id}
                              label={`${acc.bankName} — ${maskedNum} (${acc.companyCode})`}
                              searchtext={`${acc.bankName} ${acc.accountNumber} ${acc.accountHolderName} ${acc.companyCode}`}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: 13, color: '#0f172a' }}>{acc.bankName}</strong>
                                  <Tag
                                    color={acc.companyCode === 'TVM' ? 'cyan' : 'blue'}
                                    style={{ margin: 0, fontSize: 10 }}
                                  >
                                    {acc.companyCode}
                                  </Tag>
                                </div>
                                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                                  {maskedNum}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                  a/n {acc.accountHolderName} • {acc.accountPurpose} {acc.isDefault ? '(Utama)' : ''}
                                </div>
                              </div>
                            </Option>
                          );
                        })}
                      </Select>
                    </Form.Item>
                  </div>

                  {selectedSourceAccount ? (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 11.5,
                      }}
                    >
                      <Row gutter={[8, 4]}>
                        <Col xs={12}>
                          <span style={{ color: '#64748b', fontSize: 10.5, display: 'block' }}>
                            BANK &amp; NO. REKENING:
                          </span>
                          <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                            {selectedSourceAccount.bankName} •{' '}
                            {selectedSourceAccount.accountNumber.length > 4
                              ? '••••••' + selectedSourceAccount.accountNumber.slice(-4)
                              : selectedSourceAccount.accountNumber}
                          </strong>
                        </Col>
                        <Col xs={12}>
                          <span style={{ color: '#64748b', fontSize: 10.5, display: 'block' }}>
                            PEMEGANG REKENING:
                          </span>
                          <strong style={{ color: '#0f172a' }}>
                            {selectedSourceAccount.accountHolderName}
                          </strong>
                        </Col>
                      </Row>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 6,
                          paddingTop: 5,
                          borderTop: '1px dashed #e2e8f0',
                          flexWrap: 'wrap',
                          gap: 4,
                        }}
                      >
                        <Space size={4} wrap>
                          <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>
                            {selectedSourceAccount.accountPurpose}
                          </Tag>
                          <Tag color="green" style={{ fontSize: 10, margin: 0 }}>
                            ● {selectedSourceAccount.status || 'ACTIVE'}
                          </Tag>
                          {selectedSourceAccount.isDefault && (
                            <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>
                              Rekening Utama
                            </Tag>
                          )}
                        </Space>
                        <span style={{ fontSize: 10.5, color: '#64748b' }}>
                          Entitas: <strong>{selectedSourceAccount.companyCode === 'TVM' ? 'PT TVM' : 'PT UBD'}</strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: 6,
                        padding: '10px 12px',
                        fontSize: 11.5,
                        color: '#64748b',
                      }}
                    >
                      Pilih rekening sumber dana operasional perusahaan dari daftar master data di atas.
                    </div>
                  )}
                </div>
              </Col>

              {/* D.2: DESTINATION ACCOUNT — VENDOR BANK ACCOUNT (READ-ONLY) */}
              <Col xs={24} md={12} style={{ display: 'flex' }}>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '10px 12px',
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BankOutlined style={{ color: '#1d4ed8', fontSize: 15 }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                          Rekening Penerima / Vendor (Destination Account)
                        </span>
                      </div>
                      <Tag color="blue" style={{ fontSize: 10.5, margin: 0, fontWeight: 600 }}>
                        Rekening Terverifikasi
                      </Tag>
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}
                    >
                      <Row gutter={[12, 8]}>
                        <Col xs={12} sm={8}>
                          <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>
                            NAMA BANK TUJUAN:
                          </Text>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginTop: 2 }}>
                            {vendorBankName}
                          </div>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>
                            NOMOR REKENING TUJUAN:
                          </Text>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13.5,
                              color: '#1d4ed8',
                              fontFamily: 'monospace',
                              marginTop: 2,
                            }}
                          >
                            {vendorBankAccount || '—'}
                          </div>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>
                            ATAS NAMA REKENING:
                          </Text>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 12.5,
                              color: '#0f172a',
                              marginTop: 2,
                              wordBreak: 'break-word',
                            }}
                          >
                            {vendorBankAccountHolder}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      marginTop: 8,
                      borderTop: '1px dashed #e2e8f0',
                      paddingTop: 6,
                      lineHeight: 1.4,
                    }}
                  >
                    ℹ️ <strong>Perhatian Keamanan:</strong> Transfer kas keluar hanya boleh ditujukan ke rekening vendor yang terdaftar di atas. Perubahan nomor rekening penerima memerlukan revisi pengajuan dan persetujuan ulang Direktur.
                  </div>
                </div>
              </Col>
            </Row>

            {/* SECTION E: PAYMENT EXECUTION FORM (GROUPED PAYMENT DETAILS) */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <CreditCardOutlined style={{ color: '#0f172a', fontSize: 14 }} />
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                  Detail Realisasi Pembayaran
                </span>
              </div>

              <Row gutter={[14, 4]}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Tanggal Pembayaran Realisasi</span>}
                    name="paymentDate"
                    style={{ marginBottom: 10 }}
                    rules={[{ required: true, message: 'Tanggal pembayaran wajib dipilih' }]}
                  >
                    <DatePicker
                      style={{ width: '100%', borderRadius: 6, minHeight: 40 }}
                      format="DD MMMM YYYY"
                      allowClear={false}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={8}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Metode Pembayaran Realisasi</span>}
                    name="paymentMethod"
                    style={{ marginBottom: 10 }}
                    rules={[{ required: true, message: 'Metode pembayaran wajib dipilih' }]}
                  >
                    <Select style={{ borderRadius: 6, minHeight: 40 }}>
                      <Option value="BANK_TRANSFER">Transfer Bank (RTGS / Kliring / BI-FAST)</Option>
                      <Option value="CHEQUE">Cek / Bilyet Giro</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={8}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Nomor Referensi Transaksi (No. Bukti Transfer)</span>}
                    name="referenceNumber"
                    style={{ marginBottom: 10 }}
                    rules={[
                      { required: true, message: 'Nomor referensi / bukti transfer wajib diisi untuk transfer bank' },
                      {
                        validator: async (_, value) => {
                          if (!value || String(value).trim().length === 0) {
                            return Promise.reject(new Error('Nomor referensi transaksi tidak boleh kosong'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input
                      id="input-payment-ref-number"
                      placeholder="Contoh: TRX-20261115-001 / No. Bukti Transfer Bank"
                      style={{ borderRadius: 6, minHeight: 40, fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          width: '100%',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 12 }}>Nominal Pembayaran Realisasi (Rp)</span>
                        {maxPaymentAllowed > 0 && (
                          <a
                            onClick={() => form.setFieldsValue({ paymentAmount: maxPaymentAllowed })}
                            style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}
                          >
                            Isi Sisa Persetujuan (Rp {maxPaymentAllowed.toLocaleString('id-ID')})
                          </a>
                        )}
                      </div>
                    }
                    name="paymentAmount"
                    style={{ marginBottom: 4 }}
                    rules={[
                      { required: true, message: 'Nominal pembayaran wajib diisi' },
                      {
                        validator: async (_, value) => {
                          const num = Number(value);
                          if (!num || isNaN(num) || num <= 0) {
                            return Promise.reject(new Error('Nominal pembayaran harus lebih besar dari Rp 0'));
                          }
                          if (num > remainingApprovedAmount) {
                            return Promise.reject(
                              new Error(`Nominal melebihi sisa persetujuan Direktur (Rp ${remainingApprovedAmount.toLocaleString('id-ID')})`)
                            );
                          }
                          if (num > remainingNetCash) {
                            return Promise.reject(
                              new Error(`Nominal melebihi sisa kas bersih tagihan (Rp ${remainingNetCash.toLocaleString('id-ID')})`)
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        fontSize: 15,
                        color: '#059669',
                        minHeight: 40,
                      }}
                      formatter={(val) => `Rp ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      parser={(val) => val!.replace(/Rp\s?|(\.*)/g, '') as any}
                      min={1}
                      max={maxPaymentAllowed}
                    />
                  </Form.Item>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Sisa persetujuan setelah pembayaran ini:{' '}
                    <strong
                      style={{
                        color: projectedRemainingApproved === 0 ? '#059669' : '#b45309',
                        fontFamily: 'monospace',
                      }}
                    >
                      Rp {projectedRemainingApproved.toLocaleString('id-ID')}
                    </strong>
                    {isPartialRealization && (
                      <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 600 }}>
                        (Pembayaran Bertahap / Partial Settlement)
                      </span>
                    )}
                  </div>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan / Berita Pembayaran</span>}
                    name="notes"
                    style={{ marginBottom: 4 }}
                  >
                    <Input
                      placeholder="Catatan atau berita acara transfer bank"
                      style={{ borderRadius: 6, minHeight: 40 }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </Form>
        </div>
      </Modal>

      {/* SECTION F: PRE-EXECUTION CONFIRMATION MODAL */}
      <Modal
        open={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        width="min(640px, calc(100vw - 24px))"
        style={{ maxWidth: '100vw' }}
        centered
        destroyOnClose
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ExclamationCircleOutlined style={{ color: '#059669', fontSize: 20 }} />
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Konfirmasi Realisasi Pembayaran Kas/Bank
            </div>
          </div>
        }
        footer={[
          <Button
            key="cancel"
            onClick={() => setShowConfirmModal(false)}
            style={{ borderRadius: 6, minHeight: 44 }}
            disabled={isSubmitting}
          >
            Batal / Edit
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirmedSubmit}
            loading={isSubmitting}
            icon={<SendOutlined />}
            id="btn-confirm-payment-submission"
            style={{
              borderRadius: 6,
              fontWeight: 600,
              minHeight: 44,
              backgroundColor: '#059669',
              borderColor: '#059669',
              padding: '0 20px',
            }}
          >
            Konfirmasi &amp; Catat Pembayaran
          </Button>,
        ]}
      >
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text style={{ fontSize: 12.5, color: '#475569' }}>
            Harap tinjau kembali rincian eksekusi kas keluar berikut sebelum mencatat realisasi pembayaran secara permanen ke jurnal Treasury:
          </Text>

          {/* Warning if realization amount differs from remaining approved amount */}
          {Number(pendingValues?.paymentAmount || 0) < remainingApprovedAmount && (
            <Alert
              type="warning"
              showIcon
              message="Perhatian: Nominal Realisasi di Bawah Sisa Persetujuan Direktur"
              description={`Nominal realisasi (Rp ${Number(pendingValues?.paymentAmount || 0).toLocaleString('id-ID')}) lebih kecil dari sisa persetujuan Direktur (Rp ${remainingApprovedAmount.toLocaleString('id-ID')}). Transaksi ini akan dicatat sebagai Pembayaran Sebagian (PARTIALLY_PAID).`}
              style={{ borderRadius: 8 }}
            />
          )}

          {/* Side-by-Side Source -> Destination Routing Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            <Row gutter={[12, 8]} align="middle">
              <Col xs={24} sm={11}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Rekening Sumber (Perusahaan)
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginTop: 2 }}>
                  {selectedSourceAccount?.bankName || '—'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#059669', fontWeight: 700 }}>
                  {selectedSourceAccount
                    ? selectedSourceAccount.accountNumber.length > 4
                      ? '••••••' + selectedSourceAccount.accountNumber.slice(-4)
                      : selectedSourceAccount.accountNumber
                    : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  a/n {selectedSourceAccount?.accountHolderName} ({selectedSourceAccount?.companyCode})
                </div>
              </Col>

              <Col xs={24} sm={2} style={{ textAlign: 'center' }}>
                <SwapRightOutlined style={{ fontSize: 20, color: '#059669' }} />
              </Col>

              <Col xs={24} sm={11}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Rekening Tujuan (Vendor)
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginTop: 2 }}>
                  {vendorBankName}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#1d4ed8', fontWeight: 700 }}>
                  {vendorBankAccount || '—'}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  a/n {vendorBankAccountHolder}
                </div>
              </Col>
            </Row>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', paddingBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Nomor Faktur / PRQ:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                {invoiceNumber} / {requestNumber}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', paddingBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Metode &amp; No. Referensi:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                {pendingValues?.paymentMethod || 'BANK_TRANSFER'} — {pendingValues?.referenceNumber || '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', paddingBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Persetujuan Direktur:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                Rp {directorApprovedAmount.toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', paddingBottom: 6 }}>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>Nominal Realisasi Transfer:</span>
              <span style={{ fontWeight: 800, color: '#059669', fontSize: 14.5, fontFamily: 'monospace' }}>
                Rp {Number(pendingValues?.paymentAmount || 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', paddingBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Sisa Persetujuan Setelah Bayar:</span>
              <span
                style={{
                  fontWeight: 700,
                  color: remainingApprovedAmount - Number(pendingValues?.paymentAmount || 0) === 0 ? '#059669' : '#b45309',
                  fontFamily: 'monospace',
                }}
              >
                Rp {(remainingApprovedAmount - Number(pendingValues?.paymentAmount || 0)).toLocaleString('id-ID')}
              </span>
            </div>

            {pphAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
                <span style={{ color: '#64748b' }}>Kewajiban PPh (Kas Negara):</span>
                <span style={{ fontWeight: 600, color: '#dc2626', fontFamily: 'monospace' }}>
                  Rp {pphAmount.toLocaleString('id-ID')} (Disetor terpisah ke KPP)
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ProcessPaymentModal;
