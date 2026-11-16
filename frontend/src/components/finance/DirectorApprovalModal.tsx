"use client";

import React, { useState, useEffect } from 'react';
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
  Divider,
  Space,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  RollbackOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  BankOutlined,
  DollarCircleOutlined,
  FilePdfOutlined,
  EyeOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  ShopOutlined,
  ProjectOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { FinanceService, PaymentRequestDto } from '@/services/finance.service';
import { streamSecureDocument, downloadSecureDocument } from '@/lib/fileDelivery';
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

  // Document attachment states
  const [invoiceDocuments, setInvoiceDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [actionDocId, setActionDocId] = useState<number | null>(null);

  useEffect(() => {
    if (open && paymentRequest) {
      const invId = paymentRequest.invoiceId || paymentRequest.invoice?.id;
      if (invId && !isNaN(invId) && invId > 0) {
        setLoadingDocs(true);
        FinanceService.getInvoiceDocuments(invId)
          .then((docs) => {
            setInvoiceDocuments(Array.isArray(docs) ? docs : []);
          })
          .catch((err) => {
            console.warn('Could not fetch invoice documents for director approval:', err);
            setInvoiceDocuments([]);
          })
          .finally(() => {
            setLoadingDocs(false);
          });
      }
    } else {
      setInvoiceDocuments([]);
      setActionType('NONE');
      setReturnNotes('');
      setRejectReason('');
    }
  }, [open, paymentRequest]);

  if (!paymentRequest) return null;

  const snapshot = (paymentRequest.approvalSnapshot || {}) as any;
  const invoice = paymentRequest.invoice;
  const po = invoice?.purchaseOrder;
  const vendor = po?.vendor;
  const term = paymentRequest.paymentTerm;
  const canDecide = paymentRequest.status === 'PENDING_DIRECTOR_APPROVAL';

  // Stale Snapshot / Version Mismatch Detection (Governance Rule)
  const isStaleSnapshot = Boolean(
    snapshot.invoiceVersion &&
    invoice?.version &&
    Number(invoice.version) > Number(snapshot.invoiceVersion)
  );

  // Authoritative Financial Breakdown (Prioritize immutable snapshot, fallback gracefully to entity)
  const dppAmount = Number(
    snapshot.dppAmount ??
    (invoice?.invoiceTaxDetail?.dppCommercial ? Number(invoice.invoiceTaxDetail.dppCommercial) : Number(invoice?.totalAmount || 0))
  );
  const ppnAmount = Number(
    snapshot.ppnAmount ??
    Number(invoice?.invoiceTaxDetail?.ppnAmount || 0)
  );
  const ppnRate = Number(
    snapshot.ppnRate ??
    (invoice?.invoiceTaxDetail?.ppnRate ? Number(invoice.invoiceTaxDetail.ppnRate) * (Number(invoice.invoiceTaxDetail.ppnRate) <= 1 ? 100 : 1) : (ppnAmount > 0 ? 11 : 0))
  );
  const grossLiability = Number(
    snapshot.grossAmount ??
    (invoice?.invoiceTaxDetail?.grossCommercialLiability ? Number(invoice.invoiceTaxDetail.grossCommercialLiability) : (dppAmount + ppnAmount))
  );
  const pphAmount = Number(
    snapshot.pphAmount ??
    Number(invoice?.invoiceTaxDetail?.pphWithholdingAmount || 0)
  );
  const pphType = snapshot.pphType ?? invoice?.invoiceTaxDetail?.pphType ?? invoice?.invoiceTaxDetail?.taxRuleSnapshot?.pph?.pphType ?? (pphAmount > 0 ? 'PPh' : null);
  const pphRate = Number(
    snapshot.pphRate ??
    (invoice?.invoiceTaxDetail?.pphRate ? Number(invoice.invoiceTaxDetail.pphRate) : invoice?.invoiceTaxDetail?.taxRuleSnapshot?.pph?.rate ?? 0)
  );
  const wapuAmount = Number(
    snapshot.wapuAmount ??
    Number(invoice?.invoiceTaxDetail?.wapuPpnWithheldAmount || 0)
  );
  const priorDeductions = Number(
    snapshot.priorDeductionsAmount ??
    Number(invoice?.invoiceTaxDetail?.priorDeductionsAmount || 0)
  );
  const reqAmount = Number(paymentRequest.requestedAmount || snapshot.requestedAmount || 0);
  const netPayable = Number(snapshot.netPayableAmount ?? reqAmount);

  // Tax Identifiers
  const fakturPajakNumber = snapshot.fakturPajakNumber || invoice?.invoiceTaxDetail?.fakturPajakNumber || invoice?.invoiceTaxDetail?.taxRuleSnapshot?.ppn?.fakturPajakNumber || invoice?.invoiceTaxDetail?.taxRuleSnapshot?.fakturPajakNumber;
  const fakturPajakDate = snapshot.fakturPajakDate || invoice?.invoiceTaxDetail?.fakturPajakDate || invoice?.invoiceTaxDetail?.taxRuleSnapshot?.ppn?.fakturPajakDate;
  const buktiPotongNumber = snapshot.buktiPotongNumber || invoice?.invoiceTaxDetail?.buktiPotongNumber || invoice?.invoiceTaxDetail?.taxRuleSnapshot?.pph?.buktiPotongNumber || invoice?.invoiceTaxDetail?.taxRuleSnapshot?.buktiPotongNumber;
  const buktiPotongDate = snapshot.buktiPotongDate || invoice?.invoiceTaxDetail?.buktiPotongDate || invoice?.invoiceTaxDetail?.taxRuleSnapshot?.pph?.buktiPotongDate;

  // Attached Tax Documents from Document Service
  const fakturDoc = invoiceDocuments.find((d: any) =>
    d.category === 'FAKTUR_PAJAK' || d.category === 'TAX_INVOICE' || (d.fileName && d.fileName.toLowerCase().includes('faktur'))
  );
  const buktiDoc = invoiceDocuments.find((d: any) =>
    d.category === 'BUKTI_POTONG' || d.category === 'WITHHOLDING_TAX' || (d.fileName && (d.fileName.toLowerCase().includes('potong') || d.fileName.toLowerCase().includes('bpu')))
  );

  // Bank Account Information
  const bankName = snapshot.vendorBankName || (paymentRequest as any).bankName || null;
  const bankAccountNumber = snapshot.vendorBankAccount || (paymentRequest as any).bankAccountNumber || null;
  const bankAccountHolder = snapshot.vendorBankAccountHolder || (paymentRequest as any).bankAccountHolder || vendor?.name || null;

  // Transaction Verification Metadata
  const projectName = snapshot.projectName || (po?.purchaseRequest as any)?.project?.name || (invoice as any)?.projectName || '—';
  const orderType = (po as any)?.orderType || 'MATERIAL';
  const matchStatus = snapshot.matchStatus || invoice?.matchStatus || 'MATCHED';
  const grNumber = snapshot.goodsReceiptNumber || '—';
  const scNumber = snapshot.serviceClaimNumber || '—';
  const verifiedByName = snapshot.verifiedByName || (invoice as any)?.verifiedByName || ((invoice as any)?.updatedBy ? `Finance User #${(invoice as any).updatedBy}` : 'Finance Team');
  const verifiedAt = snapshot.verifiedAt || invoice?.updatedAt;

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

  const handlePreviewDocument = async (doc: any) => {
    if (!doc?.id) return;
    setActionDocId(doc.id);
    try {
      const { objectUrl } = await streamSecureDocument(doc.id);
      window.open(objectUrl, '_blank');
    } catch (err: any) {
      message.error(`Gagal membuka berkas dokumen: ${err?.message || 'Akses ditolak atau berkas tidak ditemukan'}`);
    } finally {
      setActionDocId(null);
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    if (!doc?.id) return;
    setActionDocId(doc.id);
    try {
      await downloadSecureDocument(doc.id, doc.fileName || `dokumen-${doc.id}.pdf`);
      message.success('Dokumen berhasil diunduh.');
    } catch (err: any) {
      message.error(`Gagal mengunduh berkas dokumen: ${err?.message || 'Akses ditolak atau berkas tidak ditemukan'}`);
    } finally {
      setActionDocId(null);
    }
  };

  const handleApprove = async () => {
    if (isStaleSnapshot) {
      message.error('Persetujuan tidak dapat diproses karena data invoice telah berubah setelah pengajuan dibuat. Harap minta revisi.');
      return;
    }
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
      width="min(880px, calc(100vw - 24px))"
      style={{ maxWidth: '100vw', top: 20 }}
      title={
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 4 }}>
          <div
            style={{
              width: 40,
              height: 40,
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
            <FileProtectOutlined style={{ color: '#1d4ed8', fontSize: 20 }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, wordBreak: 'break-word' }}>
              Review & Persetujuan Pembayaran (Direktur)
            </div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginTop: 2, wordBreak: 'break-word' }}>
              Tinjau rekonsiliasi keuangan, rincian perpajakan, dan dokumen sebelum memberikan keputusan
            </div>
          </div>
        </div>
      }
      destroyOnClose
      footer={null}
    >
      <div style={{ marginTop: 8 }}>
        {/* Governance Alert: Stale Snapshot / Version Mismatch Detection */}
        {isStaleSnapshot && (
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message={
              <span style={{ fontWeight: 700 }}>
                Perubahan Data Invoice Terdeteksi (Versi Snapshot: {snapshot.invoiceVersion} vs Versi Invoice Terkini: {invoice?.version})
              </span>
            }
            description={
              <div style={{ marginTop: 4, fontSize: 13 }}>
                Data invoice telah diperbarui di sistem setelah pengajuan pembayaran ini diajukan oleh Finance. Persetujuan pembayaran tidak dapat diproses menggunakan snapshot keuangan yang sudah usang (stale). Gunakan tombol <strong>Minta Revisi</strong> agar tim Finance mengajukan ulang sesuai data invoice terbaru.
              </div>
            }
            style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #fca5a5', backgroundColor: '#fef2f2' }}
          />
        )}

        {/* Status Alert: Needs Revision */}
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

        {/* Section 1: Payment Request Identity Header */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
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
              IDENTITAS PENGAJUAN PEMBAYARAN
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', marginTop: 2 }}>
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

        {/* Section 2: Financial Summary Cards (DPP, Gross, Net Cash) */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {/* Card 1: DPP / Commercial Value */}
          <Col xs={24} sm={8}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '12px 14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Nilai DPP / Komersial
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '6px 0 2px 0', fontFamily: 'monospace' }}>
                {formatCurrency(dppAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Dasar Pengenaan Pajak / Nilai Komersial PO
              </div>
            </div>
          </Col>

          {/* Card 2: Total Gross Liability */}
          <Col xs={24} sm={8}>
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #93c5fd',
                borderRadius: 8,
                padding: '12px 14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 2px rgba(29, 78, 216, 0.05)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Tagihan Bruto
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8', margin: '6px 0 2px 0', fontFamily: 'monospace' }}>
                {formatCurrency(grossLiability)}
              </div>
              <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>
                Kewajiban legal faktur (DPP + PPN)
              </div>
            </div>
          </Col>

          {/* Card 3: Net Cash Requested */}
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
                boxShadow: '0 1px 2px rgba(21, 128, 61, 0.05)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Kas Bersih Diajukan
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d', margin: '6px 0 2px 0', fontFamily: 'monospace' }}>
                {formatCurrency(reqAmount)}
              </div>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>
                Pencairan kas vendor (setelah potongan PPh)
              </div>
            </div>
          </Col>
        </Row>

        {/* Section 3: Prominent Director Decision Summary Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid #6ee7b7',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NILAI YANG DIMINTAKAN PERSETUJUAN DIREKTUR
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#065f46', fontFamily: 'monospace', marginTop: 2 }}>
                {formatCurrency(reqAmount)}
              </div>
            </div>
            <Tag color="success" style={{ fontSize: 12, padding: '4px 10px', fontWeight: 600 }}>
              Pencairan Kas Bersih
            </Tag>
          </div>
          <div style={{ fontSize: 12.5, color: '#047857', fontWeight: 600, marginTop: 4 }}>
            Nominal kas yang akan dibayarkan kepada vendor setelah persetujuan dan proses Treasury.
          </div>
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px dashed #a7f3d0',
              fontSize: 11.5,
              color: '#064e3b',
              lineHeight: 1.5,
            }}
          >
            <span>Catatan Rekonsiliasi: </span>
            <span>
              Nominal kas bersih ini dihitung dari Total Tagihan Bruto ({formatCurrency(grossLiability)}) dikurangi potongan pajak PPh ({formatCurrency(pphAmount)}). Pajak PPh yang dipotong tidak dibayarkan ke vendor melainkan disetorkan oleh Finance ke Kas Negara (KPP).
            </span>
          </div>
        </div>

        {/* Section 4: Dedicated Rincian Keuangan & Perpajakan */}
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderRadius: 8,
            borderColor: '#e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarCircleOutlined style={{ color: '#1d4ed8' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                Rincian Rekonsiliasi Keuangan & Perpajakan
              </span>
            </div>
          }
        >
          {/* Breakdown Table / Grid */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 14 }}>
            <Row gutter={[12, 10]}>
              <Col xs={12} sm={6}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Nilai DPP (Dasar Pengenaan):</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  {formatCurrency(dppAmount)}
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  PPN ({ppnRate > 0 ? `${ppnRate}%` : '0%'}):
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ppnAmount > 0 ? '#0284c7' : '#64748b', fontFamily: 'monospace' }}>
                  {ppnAmount > 0 ? `+ ${formatCurrency(ppnAmount)}` : 'Rp 0'}
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Total Tagihan Bruto:</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace' }}>
                  {formatCurrency(grossLiability)}
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Potongan PPh ({pphRate > 0 ? `${pphRate}%` : '0%'}):
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: pphAmount > 0 ? '#dc2626' : '#64748b', fontFamily: 'monospace' }}>
                  {pphAmount > 0 ? `- ${formatCurrency(pphAmount)}` : 'Rp 0'}
                </div>
              </Col>
              {wapuAmount > 0 && (
                <Col xs={12} sm={6}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Potongan WAPU PPN:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>
                    - {formatCurrency(wapuAmount)}
                  </div>
                </Col>
              )}
              {priorDeductions > 0 && (
                <Col xs={12} sm={6}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Potongan Lainnya / Muka:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>
                    - {formatCurrency(priorDeductions)}
                  </div>
                </Col>
              )}
              <Col xs={24} sm={12} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ background: '#ffffff', padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%' }}>
                  <div style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>Jumlah Kas Bersih Vendor (D_cash):</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#047857', fontFamily: 'monospace' }}>
                    {formatCurrency(netPayable)}
                  </div>
                </div>
              </Col>
            </Row>
          </div>

          {/* Tax Administration Documents (Faktur Pajak & Bukti Potong) */}
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            <SafetyCertificateOutlined style={{ marginRight: 6, color: '#0f766e' }} />
            Administrasi Dokumen Perpajakan
          </div>
          <Row gutter={[12, 12]}>
            {/* PPN Box */}
            <Col xs={24} sm={12}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                    PPN — Faktur Pajak
                  </span>
                  {fakturDoc ? (
                    <Tag color="success" style={{ margin: 0, fontSize: 10.5 }}>PDF Terlampir</Tag>
                  ) : ppnAmount > 0 ? (
                    <Tag color="default" style={{ margin: 0, fontSize: 10.5 }}>Belum Ada Berkas</Tag>
                  ) : (
                    <Tag color="default" style={{ margin: 0, fontSize: 10.5 }}>Tidak Ada PPN</Tag>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Nomor Seri Faktur Pajak (NSFP):</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', color: fakturPajakNumber ? '#0f172a' : '#94a3b8' }}>
                  {fakturPajakNumber || '—'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Tanggal Faktur Pajak:</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
                  {fakturPajakDate ? formatDate(fakturPajakDate) : '—'}
                </div>
                {fakturDoc && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      loading={actionDocId === fakturDoc.id}
                      onClick={() => handlePreviewDocument(fakturDoc)}
                      style={{ fontSize: 11 }}
                    >
                      Preview Faktur
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={actionDocId === fakturDoc.id}
                      onClick={() => handleDownloadDocument(fakturDoc)}
                      style={{ fontSize: 11 }}
                    >
                      Unduh
                    </Button>
                  </div>
                )}
              </div>
            </Col>

            {/* PPh Box */}
            <Col xs={24} sm={12}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                    PPh — Bukti Potong
                  </span>
                  {buktiDoc ? (
                    <Tag color="success" style={{ margin: 0, fontSize: 10.5 }}>PDF Terlampir</Tag>
                  ) : pphAmount > 0 ? (
                    <Tag color="default" style={{ margin: 0, fontSize: 10.5 }}>Belum Ada Berkas</Tag>
                  ) : (
                    <Tag color="default" style={{ margin: 0, fontSize: 10.5 }}>Tidak Ada PPh</Tag>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Nomor Bukti Potong:</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', color: buktiPotongNumber ? '#0f172a' : '#94a3b8' }}>
                  {buktiPotongNumber || '—'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Jenis &amp; Tanggal Pemotongan:</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
                  {pphType ? `${pphType} (${pphRate}%)` : '—'} • {buktiPotongDate ? formatDate(buktiPotongDate) : '—'}
                </div>
                {buktiDoc && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      loading={actionDocId === buktiDoc.id}
                      onClick={() => handlePreviewDocument(buktiDoc)}
                      style={{ fontSize: 11 }}
                    >
                      Preview BPU
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={actionDocId === buktiDoc.id}
                      onClick={() => handleDownloadDocument(buktiDoc)}
                      style={{ fontSize: 11 }}
                    >
                      Unduh
                    </Button>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        {/* Section 5: Transaction Information & Verification Context */}
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
            <span>Konteks Transaksi &amp; Verifikasi 3-Way Match</span>
          </div>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Nomor Invoice:</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: 'monospace', color: '#1e293b', marginTop: 2 }}>
                {invoice?.invoiceNumber || '—'}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Nomor Purchase Order (PO):</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: 'monospace', color: '#0f766e', marginTop: 2 }}>
                {po?.poNumber || '—'} <Tag color="cyan" style={{ fontSize: 10.5, marginLeft: 4 }}>{orderType}</Tag>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Vendor Rekanan:</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                <ShopOutlined style={{ marginRight: 4, color: '#64748b' }} />
                {vendor?.name || '—'}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Proyek Terkait:</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#1e293b', marginTop: 2 }}>
                <ProjectOutlined style={{ marginRight: 4, color: '#64748b' }} />
                {projectName}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Termin Pembayaran:</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                {term?.termName || 'Termin Standar'} {term?.percentage ? `(${term.percentage}%)` : ''}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Status Verifikasi Matching:</div>
              <div style={{ marginTop: 2 }}>
                <Tag color={matchStatus === 'VERIFIED' ? 'success' : matchStatus === 'MATCHED' ? 'blue' : 'warning'} style={{ fontWeight: 600 }}>
                  {matchStatus}
                </Tag>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Verifikator Finance:</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#334155', marginTop: 2 }}>
                {verifiedByName}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Waktu Verifikasi:</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#334155', marginTop: 2 }}>
                {verifiedAt ? formatDate(verifiedAt) : '—'}
              </div>
            </Col>
            {orderType === 'MATERIAL' && grNumber !== '—' && (
              <Col xs={24} sm={12}>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Dokumen Goods Receipt (GR):</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace', color: '#0f766e', marginTop: 2 }}>
                  {grNumber}
                </div>
              </Col>
            )}
            {orderType === 'SERVICE' && scNumber !== '—' && (
              <Col xs={24} sm={12}>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Dokumen Service Claim:</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace', color: '#7c3aed', marginTop: 2 }}>
                  {scNumber}
                </div>
              </Col>
            )}
          </Row>
        </div>

        {/* Section 6: Vendor Bank Information */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BankOutlined style={{ color: '#059669' }} />
            <span>Informasi Rekening Bank Tujuan Vendor</span>
          </div>
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Nama Bank:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {bankName || (vendor as any)?.bankName || '—'}
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Nomor Rekening:</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                {bankAccountNumber || (vendor as any)?.bankAccountNumber || '—'}
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Atas Nama Rekening:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {bankAccountHolder || vendor?.name || '—'}
              </div>
            </Col>
          </Row>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>
            Pastikan rekening tujuan sesuai dengan invoice dan data kontrak rekanan sebelum menyetujui pencairan dana.
          </div>
        </div>

        {/* Section 7: Notes & Explanations */}
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
            Catatan Pengajuan dari Finance
          </div>
          <div style={{ fontSize: 13, color: paymentRequest.notes ? '#334155' : '#94a3b8', fontStyle: paymentRequest.notes ? 'normal' : 'italic' }}>
            {paymentRequest.notes || 'Tidak ada catatan khusus dari pemohon.'}
          </div>
        </div>

        {/* Section 8: Decision Actions / Read-Only Footer */}
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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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

              {isStaleSnapshot ? (
                <Tooltip title="Data invoice telah diperbarui di sistem. Persetujuan dicegah untuk melindungi konsistensi data. Minta revisi agar Finance mengajukan ulang.">
                  <Button
                    type="primary"
                    disabled
                    icon={<WarningOutlined />}
                    id="btn-director-approve-disabled"
                    style={{
                      backgroundColor: '#94a3b8',
                      borderColor: '#94a3b8',
                      fontWeight: 600,
                      paddingLeft: 18,
                      paddingRight: 18,
                    }}
                  >
                    Setujui Pembayaran (Data Berubah)
                  </Button>
                </Tooltip>
              ) : (
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
              )}
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

        {/* Action Input: RETURN (Minta Revisi) */}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
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

        {/* Action Input: REJECT (Tolak Pengajuan) */}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
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
