"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Descriptions,
  Table,
  Card,
  Alert,
  Spin,
  Input,
  Form,
  message,
  Select,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  CalendarOutlined,
  AuditOutlined,
  DollarCircleOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import { ProcurementService } from '@/services/procurement.service';
import {
  FinanceService,
  InvoiceDto,
  MatchingResult,
  MismatchCode,
  MISMATCH_DEFINITIONS,
} from '@/services/finance.service';

const { Text, Title } = Typography;
const { TextArea } = Input;

export interface InvoiceDetailModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDto | null;
  onVerified?: () => void;
}

const formatRp = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '—';
  return `Rp ${Number(val).toLocaleString('id-ID')}`;
};

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  open,
  onClose,
  invoice,
  onVerified,
}) => {
  const { user, isFinance, isSuperAdmin } = useAuth();
  const userRoles = user?.roles || [];
  const canVerify = isFinance || isSuperAdmin || userRoles.includes('ADMIN') || userRoles.includes('DIRECTOR');

  // Authoritative data states from backend
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null);
  const [loadingMatching, setLoadingMatching] = useState<boolean>(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [freshInvoice, setFreshInvoice] = useState<InvoiceDto | null>(null);

  // Verification & Rejection Sub-Modal States
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [evidenceRef, setEvidenceRef] = useState<string>('');
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Canonical Goods Receipt States for Invoice Verification (Phase GR-6)
  const [poGoodsReceipts, setPoGoodsReceipts] = useState<any[]>([]);
  const [loadingPoGrs, setLoadingPoGrs] = useState<boolean>(false);
  const [selectedVerifyGrId, setSelectedVerifyGrId] = useState<number | undefined>(undefined);

  // Derive numeric ID
  const invoiceId = invoice ? Number((invoice as any).id || (invoice as any).invoiceId) : null;
  const vendorId = invoice
    ? Number(
        (invoice as any).purchaseOrder?.vendorId ||
          (invoice as any).vendorId ||
          (invoice as any).purchaseOrder?.vendor?.id
      ) || undefined
    : undefined;

  // Fetch Authoritative Matching Preview
  const loadMatching = useCallback(async (id: number, vId?: number, grId?: number, evRef?: string) => {
    setLoadingMatching(true);
    setMatchingError(null);
    try {
      const result = await FinanceService.getInvoiceMatching(id, vId, grId, evRef);
      setMatchingResult(result);
    } catch (err: any) {
      console.error('Failed to load invoice matching data:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Gagal memuat evaluasi matching dari server.';
      setMatchingError(errMsg);
    } finally {
      setLoadingMatching(false);
    }
  }, []);

  // Fetch Fresh Invoice Details from Backend
  const loadFreshInvoice = useCallback(async (id: number) => {
    try {
      const data = await FinanceService.getInvoiceById(id);
      setFreshInvoice(data);
    } catch (err) {
      console.warn('Could not fetch single invoice details from backend:', err);
    }
  }, []);

  useEffect(() => {
    if (open && invoiceId && !isNaN(invoiceId) && invoiceId > 0) {
      loadMatching(invoiceId, vendorId);
      loadFreshInvoice(invoiceId);
    } else {
      setMatchingResult(null);
      setFreshInvoice(null);
      setMatchingError(null);
    }
  }, [open, invoiceId, vendorId, loadMatching, loadFreshInvoice]);

  // Derive PO ID for fetching canonical Goods Receipts
  const poIdForGr = Number(
    (freshInvoice as any)?.poId ||
    (invoice as any)?.poId ||
    (freshInvoice as any)?.purchaseOrder?.id ||
    (invoice as any)?.purchaseOrder?.id ||
    matchingResult?.poId ||
    0
  );

  // Load PO Goods Receipts from backend
  useEffect(() => {
    if (open && poIdForGr > 0) {
      setLoadingPoGrs(true);
      ProcurementService.getGoodsReceipts()
        .then((allGrs) => {
          const matching = (allGrs || []).filter((g: any) => {
            const matchesPo = Number(g.poId || g.purchaseOrderId) === Number(poIdForGr);
            const notDeleted = !g.deletedAt;
            return matchesPo && notDeleted;
          });
          setPoGoodsReceipts(matching);
          if (matching.length > 0) {
            setSelectedVerifyGrId((prev) => {
              if (prev && matching.some((g: any) => Number(g.id) === Number(prev))) {
                return prev;
              }
              const defaultGr = matchingResult?.goodsReceiptId
                ? matching.find((g: any) => Number(g.id) === Number(matchingResult.goodsReceiptId)) || matching[0]
                : matching[0];
              setEvidenceRef(defaultGr.grNumber);
              return defaultGr.id;
            });
          } else {
            setSelectedVerifyGrId(undefined);
          }
        })
        .catch((err) => {
          console.error('Failed to load PO Goods Receipts:', err);
          setPoGoodsReceipts([]);
        })
        .finally(() => {
          setLoadingPoGrs(false);
        });
    } else {
      setPoGoodsReceipts([]);
      setSelectedVerifyGrId(undefined);
    }
  }, [open, poIdForGr]);

  const selectedVerifyGr = useMemo(() => {
    if (!selectedVerifyGrId) return null;
    return poGoodsReceipts.find((g) => Number(g.id) === Number(selectedVerifyGrId)) || null;
  }, [selectedVerifyGrId, poGoodsReceipts]);

  if (!invoice) return null;

  // Effective Display Fields (Prefer fresh backend invoice if available)
  const activeInvoice = freshInvoice || invoice;
  const invoiceNumber = activeInvoice.invoiceNumber;
  const poNumber =
    (activeInvoice as any).purchaseOrder?.poNumber ||
    (activeInvoice as any).poNumber ||
    (matchingResult ? `PO #${matchingResult.poId}` : '—');
  const vendorName =
    (activeInvoice as any).purchaseOrder?.vendor?.name ||
    (activeInvoice as any).vendorName ||
    '—';
  const vendorCode =
    (activeInvoice as any).purchaseOrder?.vendor?.code ||
    (activeInvoice as any).vendorCode ||
    '—';
  const projectObj = (activeInvoice as any).purchaseOrder?.purchaseRequest?.project;
  const projectName =
    projectObj?.name ||
    (activeInvoice as any).projectName ||
    'Proyek Tidak Tersedia';
  const projectId =
    projectObj?.id ||
    (activeInvoice as any).purchaseOrder?.purchaseRequest?.projectId ||
    (activeInvoice as any).projectId;
  const projectCode =
    projectObj?.code ||
    (activeInvoice as any).projectCode;

  const paymentTerm =
    (activeInvoice as any).paymentTerm || (activeInvoice as any).purchaseOrder?.paymentTerms?.[0];
  const totalAmount = Number(activeInvoice.totalAmount || 0);

  // Term Classifications
  const termType = (paymentTerm?.termType || '').toUpperCase();
  const termName = (paymentTerm?.termName || '').toUpperCase();
  const isProgressInvoice = termType === 'PROGRESS' || termName.includes('PROGRESS');
  const isRetentionInvoice = termType === 'RETENTION' || termName.includes('RETEN');
  const isDpInvoice = termType === 'DP' || termName.includes('DP') || termName.includes('DOWN PAYMENT') || termName.includes('UANG MUKA');

  // Status mapping
  const currentMatchStatus =
    matchingResult?.status ||
    activeInvoice.matchStatus ||
    'PENDING';
  const isMatched = currentMatchStatus === 'MATCHED';
  const isVerified = currentMatchStatus === 'VERIFIED';
  const isMismatch = currentMatchStatus === 'MISMATCH' || currentMatchStatus === 'MISMATCHED';
  const isRejected = currentMatchStatus === 'REJECTED';
  const isPaid = (activeInvoice as any).paymentStatus === 'PAID';

  // Verification Handler
  const handleVerifySubmit = async () => {
    if (!invoiceId) return;
    if (isProgressInvoice && !selectedVerifyGrId) {
      message.error('Harap pilih dokumen Goods Receipt (GR) valid terlebih dahulu.');
      return;
    }
    setSubmittingAction(true);
    try {
      const payload: any = {
        approved: true,
        notes: verifyNotes.trim() || undefined,
      };

      if (isProgressInvoice) {
        payload.goodsReceiptId = selectedVerifyGrId ? Number(selectedVerifyGrId) : undefined;
        payload.evidenceRef = selectedVerifyGr?.grNumber || evidenceRef.trim() || undefined;
      } else {
        payload.evidenceRef = evidenceRef.trim() || undefined;
      }

      await FinanceService.verifyInvoice(invoiceId, payload);
      message.success('Invoice berhasil diverifikasi secara sah oleh Finance!');
      setIsVerifyModalOpen(false);
      setEvidenceRef('');
      setVerifyNotes('');
      // Refresh authoritative data
      await loadMatching(invoiceId, vendorId);
      await loadFreshInvoice(invoiceId);
      onVerified?.();
    } catch (err: any) {
      console.error('Invoice verification error:', err);
      const resData = err.response?.data;
      let errorMsg = 'Verifikasi invoice gagal.';
      if (resData?.message) {
        errorMsg = typeof resData.message === 'string' ? resData.message : JSON.stringify(resData.message);
      }
      message.error(errorMsg);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Rejection Handler
  const handleRejectSubmit = async () => {
    if (!invoiceId) return;
    if (!rejectNotes.trim()) {
      message.warning('Harap berikan alasan penolakan pada catatan.');
      return;
    }
    setSubmittingAction(true);
    try {
      await FinanceService.verifyInvoice(invoiceId, {
        approved: false,
        notes: rejectNotes.trim(),
      });
      message.warning('Verifikasi invoice telah ditolak.');
      setIsRejectModalOpen(false);
      setRejectNotes('');
      // Refresh authoritative data
      await loadMatching(invoiceId, vendorId);
      await loadFreshInvoice(invoiceId);
      onVerified?.();
    } catch (err: any) {
      console.error('Invoice rejection error:', err);
      const resData = err.response?.data;
      let errorMsg = 'Gagal memproses penolakan verifikasi.';
      if (resData?.message) {
        errorMsg = typeof resData.message === 'string' ? resData.message : JSON.stringify(resData.message);
      }
      message.error(errorMsg);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    if (isVerified) {
      return (
        <Tag color="green" style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', margin: 0 }}>
          <SafetyCertificateOutlined style={{ marginRight: 4 }} />
          VERIFIED (TERVERIFIKASI)
        </Tag>
      );
    }
    if (isMatched) {
      return (
        <Tag color="cyan" style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', margin: 0 }}>
          <CheckCircleOutlined style={{ marginRight: 4 }} />
          MATCHED (SIAP DIVERIFIKASI)
        </Tag>
      );
    }
    if (isMismatch) {
      return (
        <Tag color="red" style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', margin: 0 }}>
          <CloseCircleOutlined style={{ marginRight: 4 }} />
          MISMATCH (TERDAPAT DISKREPANSI)
        </Tag>
      );
    }
    if (isRejected) {
      return (
        <Tag color="magenta" style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', margin: 0 }}>
          <CloseOutlined style={{ marginRight: 4 }} />
          REJECTED (VERIFIKASI DITOLAK)
        </Tag>
      );
    }
    return (
      <Tag color="gold" style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', margin: 0 }}>
        PENDING EVALUATION
      </Tag>
    );
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width="min(1180px, 96vw)"
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
              <SafetyCertificateOutlined
                style={{
                  color: isVerified ? '#059669' : isMatched ? '#0284c7' : isMismatch ? '#dc2626' : '#d97706',
                  fontSize: 16,
                }}
              />
              <Text style={{ fontSize: 12 }}>
                Nomor Faktur: <strong>{invoiceNumber}</strong> — Status Rekonsiliasi: {renderStatusBadge()} — Pembayaran:{' '}
                <Tag color={isPaid ? 'green' : 'orange'} style={{ margin: '0 4px', fontWeight: 700 }}>
                  ● {(activeInvoice as any).paymentStatus || 'UNPAID'}
                </Tag>
              </Text>
            </div>

            <Space size={8}>
              {/* Verification and Rejection Buttons (RBAC + MATCHED status guard) */}
              {canVerify && isMatched && !isVerified && !isRejected && !isPaid && (
                <>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => setIsRejectModalOpen(true)}
                    style={{ borderRadius: 6, fontWeight: 600 }}
                  >
                    Tolak Verifikasi
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => setIsVerifyModalOpen(true)}
                    disabled={isProgressInvoice && (!selectedVerifyGrId || poGoodsReceipts.length === 0)}
                    style={{
                      backgroundColor: '#059669',
                      borderColor: '#059669',
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    Verifikasi Invoice
                  </Button>
                </>
              )}

              <Button onClick={onClose} style={{ borderRadius: 6 }}>
                Tutup
              </Button>
            </Space>
          </div>
        }
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
            <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 8, color: '#2563eb' }}>
              <FileTextOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                Rincian &amp; Verifikasi Invoice — {invoiceNumber}
              </div>
              <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                Faktur tagihan vendor terintegrasi authoritative Finance Matching Engine &amp; Jadwal Termin PO
              </Text>
            </div>
          </div>
        }
      >
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Top Context Descriptions */}
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Row gutter={[12, 8]} align="middle">
              <Col xs={24} sm={6}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{projectName}</div>
                {projectId ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    <Tag color="blue" style={{ fontSize: 9.5, margin: 0 }}>Project #{projectId}</Tag>
                    {projectCode && (
                      <Tag color="cyan" style={{ fontSize: 9.5, margin: 0 }}>{projectCode}</Tag>
                    )}
                  </div>
                ) : (
                  <Tag style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID Tidak Tersedia</Tag>
                )}
              </Col>
              <Col xs={24} sm={6}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PURCHASE ORDER:</Text>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8', fontFamily: 'monospace' }}>
                  {poNumber}
                </div>
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, marginTop: 2, fontWeight: 700 }}>
                  ● {(activeInvoice as any).purchaseOrder?.status || 'AKTIF'}
                </Tag>
              </Col>
              <Col xs={24} sm={6}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PENYEDIA:</Text>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                  <ShopOutlined style={{ marginRight: 4 }} />
                  {vendorName}
                </div>
                <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>
              </Col>
              <Col xs={24} sm={6}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>TOTAL TAGIHAN INVOICE:</Text>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>
                  {formatRp(totalAmount)}
                </div>
                <Tag color="orange" style={{ fontSize: 9.5, margin: 0, marginTop: 2, fontWeight: 700 }}>
                  ● {(activeInvoice as any).paymentStatus || 'UNPAID'}
                </Tag>
              </Col>
            </Row>
          </div>

          {/* AUTHORITATIVE MATCHING PANEL (SSOT BACKEND) */}
          <Card
            size="small"
            style={{
              borderRadius: 8,
              border: isVerified
                ? '1px solid #86efac'
                : isMatched
                ? '1px solid #7dd3fc'
                : isMismatch
                ? '1px solid #fca5a5'
                : isRejected
                ? '1px solid #f472b6'
                : '1px solid #cbd5e1',
              background: isVerified
                ? '#f0fdf4'
                : isMatched
                ? '#f0f9ff'
                : isMismatch
                ? '#fef2f2'
                : isRejected
                ? '#fdf2f8'
                : '#f8fafc',
            }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Space size={8}>
                  <AuditOutlined
                    style={{
                      color: isVerified ? '#059669' : isMatched ? '#0284c7' : isMismatch ? '#dc2626' : '#64748b',
                      fontSize: 16,
                    }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                    Authoritative Finance Matching Engine (SSOT API)
                  </span>
                </Space>
                <div>{renderStatusBadge()}</div>
              </div>
            }
          >
            {loadingMatching ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Spin tip="Mengevaluasi rekonsiliasi matching dari backend..." />
              </div>
            ) : matchingError ? (
              <Alert
                type="error"
                showIcon
                message="Evaluasi Matching Gagal Diperoleh"
                description={matchingError}
                style={{ borderRadius: 6 }}
              />
            ) : matchingResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* PARTIAL INVOICE & TERMIN BREAKDOWN */}
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>
                      Rincian Termin &amp; Penagihan Parsial (Partial Invoice)
                    </span>
                    {paymentTerm && (
                      <Tag color="geekblue" style={{ fontWeight: 600 }}>
                        Termin #{paymentTerm.sequence}: {paymentTerm.termName} ({paymentTerm.percentage}%)
                      </Tag>
                    )}
                  </div>

                  <Row gutter={[16, 12]}>
                    <Col xs={24} sm={8}>
                      <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <Text type="secondary" style={{ fontSize: 10.5 }}>1. NILAI KONTRAK TERMIN</Text>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: '#1d4ed8', fontFamily: 'monospace', marginTop: 2 }}>
                          {matchingResult.termAmount != null ? formatRp(matchingResult.termAmount) : formatRp(matchingResult.poTotal)}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          {matchingResult.termPercentage != null ? `Porsi: ${matchingResult.termPercentage}% dari PO` : 'Full Settlement (Legacy)'}
                        </div>
                      </div>
                    </Col>

                    <Col xs={24} sm={8}>
                      <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <Text type="secondary" style={{ fontSize: 10.5 }}>2. TAGIHAN INVOICE INI</Text>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: '#059669', fontFamily: 'monospace', marginTop: 2 }}>
                          {formatRp(matchingResult.invoicedAmount)}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          Nominal tertagih pada dokumen ini
                        </div>
                      </div>
                    </Col>

                    <Col xs={24} sm={8}>
                      <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <Text type="secondary" style={{ fontSize: 10.5 }}>3. SISA TERMIN BELUM DITAGIHKAN</Text>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 14.5,
                            color: Number(matchingResult.remainingTermAmount || 0) > 0 ? '#d97706' : '#059669',
                            fontFamily: 'monospace',
                            marginTop: 2,
                          }}
                        >
                          {matchingResult.remainingTermAmount != null ? formatRp(matchingResult.remainingTermAmount) : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          Sisa plafon pada termin ini
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* PO CUMULATIVE & SETTLEMENT AUDIT */}
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>
                      Akumulasi Kontrak PO Keseluruhan (Audit Trail)
                    </span>
                  </div>

                  <Row gutter={[12, 10]}>
                    <Col xs={12} sm={6}>
                      <Text type="secondary" style={{ fontSize: 10 }}>TOTAL KONTRAK PO:</Text>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>
                        {formatRp(matchingResult.poTotal)}
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Text type="secondary" style={{ fontSize: 10 }}>TOTAL INVOICE KUMULATIF:</Text>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#2563eb', fontFamily: 'monospace' }}>
                        {formatRp(matchingResult.cumulativeInvoicedAmount)}
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Text type="secondary" style={{ fontSize: 10 }}>SISA PLAFON KONTRAK PO:</Text>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#059669', fontFamily: 'monospace' }}>
                        {formatRp(matchingResult.remainingPoAmount)}
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Text type="secondary" style={{ fontSize: 10 }}>TOTAL DIBAYARKAN (KAS/BANK):</Text>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0d9488', fontFamily: 'monospace' }}>
                        {formatRp(matchingResult.cumulativePaidAmount)}
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* MISMATCHES LIST (SHOW ALL) */}
                {matchingResult.mismatches && matchingResult.mismatches.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <Alert
                      type="warning"
                      showIcon
                      message={
                        <span style={{ fontWeight: 700 }}>
                          Ditemukan {matchingResult.mismatches.length} Catatan Ketidaksesuaian (Mismatch):
                        </span>
                      }
                      description={
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {matchingResult.mismatches.map((m, idx) => {
                            const def = MISMATCH_DEFINITIONS[m.code] || {
                              label: m.code,
                              severity: 'warning',
                              badgeColor: 'orange',
                              fallbackMessage: m.message,
                            };
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  background: '#ffffff',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #fed7aa',
                                }}
                              >
                                <Tag color={def.badgeColor} style={{ margin: 0, fontWeight: 700, fontSize: 10.5 }}>
                                  {def.label}
                                </Tag>
                                <div style={{ fontSize: 11.5, color: '#7c2d12', flex: 1 }}>
                                  <strong>[{m.code}]</strong> {m.message || def.fallbackMessage}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      }
                      style={{ borderRadius: 8, border: '1px solid #fbd38d' }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                Evaluasi matching belum tersedia untuk invoice ini.
              </Text>
            )}
          </Card>

          {/* Invoice Metadata Descriptions */}
          <Descriptions
            size="small"
            bordered
            column={{ xs: 1, sm: 3 }}
            style={{ borderRadius: 6, overflow: 'hidden' }}
          >
            <Descriptions.Item label="Nomor Invoice">
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8' }}>
                {invoiceNumber}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal Terbit Faktur">
              {activeInvoice.invoiceDate ? dayjs(activeInvoice.invoiceDate).format('DD MMMM YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Termin Pembayaran">
              {paymentTerm ? `${paymentTerm.termName} (${paymentTerm.percentage}%)` : (activeInvoice as any).paymentTerms || 'Net 30 Days'}
            </Descriptions.Item>
            <Descriptions.Item label="Diterbitkan Oleh">
              {(activeInvoice as any).createdBy ? `User #${(activeInvoice as any).createdBy}` : 'Finance Team'}
            </Descriptions.Item>
            <Descriptions.Item label="Waktu Terbit" span={2}>
              {activeInvoice.createdAt ? dayjs(activeInvoice.createdAt).format('DD/MM/YYYY HH:mm') : '—'}
            </Descriptions.Item>
          </Descriptions>

          {/* CANONICAL GOODS RECEIPT EVIDENCE CARD (Phase GR-6 for Progress Invoices) */}
          {isProgressInvoice && (
            <div
              style={{
                background: selectedVerifyGr ? '#f0fdf4' : '#fffbeb',
                padding: '14px 16px',
                borderRadius: 8,
                border: `1px solid ${selectedVerifyGr ? '#bbf7d0' : '#fde68a'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: '6px 10px', background: selectedVerifyGr ? '#dcfce7' : '#fef3c7', borderRadius: 8, color: selectedVerifyGr ? '#16a34a' : '#d97706' }}>
                    <InboxOutlined style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: selectedVerifyGr ? '#166534' : '#92400e' }}>
                      Bukti Fisik Canonical: {selectedVerifyGr ? selectedVerifyGr.grNumber : (matchingResult?.goodsReceiptNumber || (poGoodsReceipts.length > 0 ? poGoodsReceipts[0].grNumber : 'Goods Receipt'))}
                    </div>
                    <div style={{ fontSize: 11, color: selectedVerifyGr ? '#15803d' : '#b45309', marginTop: 2 }}>
                      {selectedVerifyGr
                        ? `Tanggal Diterima: ${dayjs(selectedVerifyGr.receiptDate).format('DD MMMM YYYY')} — Nilai Fisik: Rp ${Number(selectedVerifyGr.totalReceivedAmount || 0).toLocaleString('id-ID')}`
                        : poGoodsReceipts.length > 0
                        ? `Tersedia ${poGoodsReceipts.length} Goods Receipt aktif untuk Purchase Order ini.`
                        : 'Menunggu penautan dokumen penerimaan barang (Goods Receipt)'}
                    </div>
                  </div>
                </div>
                <Tag color={selectedVerifyGr ? 'green' : 'orange'} style={{ fontWeight: 700, fontSize: 11, padding: '2px 8px', margin: 0 }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />
                  {selectedVerifyGr ? 'CANONICAL GR TERPILIH' : 'BELUM MEMILIH GR'}
                </Tag>
              </div>

              {poGoodsReceipts.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px dashed #cbd5e1' }}>
                  <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Pilih Dokumen GR Bukti Fisik:</Text>
                  <Select
                    size="small"
                    style={{ flex: 1, maxWidth: 440 }}
                    value={selectedVerifyGrId}
                    onChange={(val) => {
                      setSelectedVerifyGrId(val);
                      const grObj = poGoodsReceipts.find((g) => Number(g.id) === Number(val));
                      const ref = grObj?.grNumber || '';
                      setEvidenceRef(ref);
                      if (invoiceId) {
                        loadMatching(invoiceId, vendorId, val, ref);
                      }
                    }}
                    options={poGoodsReceipts.map((gr) => ({
                      value: gr.id,
                      label: `${gr.grNumber} | ${dayjs(gr.receiptDate).format('DD/MM/YYYY')} | Rp ${Number(gr.totalReceivedAmount || 0).toLocaleString('id-ID')}`,
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Items Breakdown Table (If Items Exist) */}
          {activeInvoice.items && activeInvoice.items.length > 0 ? (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>
                  Daftar Item Penagihan Terlampir ({activeInvoice.items.length} Item)
                </span>
                <Tag color="cyan" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                  READ-ONLY DOKUMEN SAH
                </Tag>
              </div>

              <Table
                size="small"
                rowKey={(it: any) => it.id || it.key || it.poItemId}
                dataSource={activeInvoice.items}
                pagination={false}
                scroll={{ y: 200 }}
                columns={[
                  {
                    title: 'No',
                    key: 'index',
                    width: 45,
                    align: 'center' as const,
                    render: (_: any, __: any, index: number) => (
                      <span style={{ color: '#64748b', fontSize: 11 }}>{index + 1}</span>
                    ),
                  },
                  {
                    title: 'Nama Item & Spesifikasi',
                    key: 'name',
                    render: (_: any, it: any) => (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>
                          {it.poItem?.itemName || it.itemName || `Item #${it.poItemId}`}
                        </div>
                        {it.categoryName && (
                          <Tag color="blue" style={{ fontSize: 9, margin: 0, padding: '0 4px', marginTop: 2 }}>
                            {it.categoryName}
                          </Tag>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: 'Qty Ditagih',
                    dataIndex: 'quantity',
                    key: 'quantity',
                    width: 90,
                    align: 'center' as const,
                    render: (qty: number) => <span style={{ fontWeight: 600 }}>{qty}</span>,
                  },
                  {
                    title: 'Harga Satuan',
                    dataIndex: 'unitPrice',
                    key: 'unitPrice',
                    width: 140,
                    align: 'right' as const,
                    render: (price: number) => (
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f172a', fontWeight: 600 }}>
                        {formatRp(price)}
                      </span>
                    ),
                  },
                  {
                    title: 'Subtotal',
                    dataIndex: 'totalPrice',
                    key: 'totalPrice',
                    width: 150,
                    align: 'right' as const,
                    render: (subtotal: number) => (
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#059669' }}>
                        {formatRp(subtotal)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <InfoCircleOutlined style={{ color: '#0284c7', marginRight: 6 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Invoice ini ditagihkan berdasarkan <strong>Jadwal Termin Pembayaran (Term-Based Schedule)</strong> tanpa rincian item fisik terpisah.
              </Text>
            </div>
          )}

          {/* AUTHORITATIVE PAYMENT HISTORY (READ-ONLY) */}
          {activeInvoice.payments && activeInvoice.payments.length > 0 && (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#ecfdf5',
                  borderBottom: '1px solid #d1fae5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#065f46' }}>
                  <DollarCircleOutlined style={{ marginRight: 6 }} />
                  Riwayat Pembayaran ({activeInvoice.payments.length} Transaksi)
                </span>
                <Tag color="green" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                  READ-ONLY BACKEND SSOT
                </Tag>
              </div>

              <Table
                size="small"
                rowKey={(p: any) => p.id || p.paymentNumber}
                dataSource={activeInvoice.payments.filter((p: any) => !p.deletedAt)}
                pagination={false}
                scroll={{ y: 160 }}
                columns={[
                  {
                    title: 'No. Bukti Bayar',
                    dataIndex: 'paymentNumber',
                    key: 'paymentNumber',
                    render: (num: string) => (
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11, color: '#047857' }}>
                        {num || '—'}
                      </span>
                    ),
                  },
                  {
                    title: 'Tanggal',
                    dataIndex: 'paymentDate',
                    key: 'paymentDate',
                    width: 120,
                    render: (d: string) => d ? dayjs(d).format('DD MMM YYYY') : '—',
                  },
                  {
                    title: 'Nominal',
                    dataIndex: 'amount',
                    key: 'amount',
                    width: 160,
                    align: 'right' as const,
                    render: (amt: number) => (
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#059669' }}>
                        {formatRp(amt)}
                      </span>
                    ),
                  },
                  {
                    title: 'Diproses',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    width: 140,
                    render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '—',
                  },
                ]}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* VERIFY INVOICE SUB-MODAL */}
      <Modal
        open={isVerifyModalOpen}
        onCancel={() => !submittingAction && setIsVerifyModalOpen(false)}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#059669', fontSize: 18 }} />
            <span>Verifikasi Faktur Invoice — {invoiceNumber}</span>
          </Space>
        }
        confirmLoading={submittingAction}
        onOk={handleVerifySubmit}
        okText="Konfirmasi & Setujui Verifikasi"
        cancelText="Batal"
        okButtonProps={{
          style: { backgroundColor: '#059669', borderColor: '#059669', fontWeight: 600 },
          disabled:
            (isProgressInvoice && (!selectedVerifyGrId || poGoodsReceipts.length === 0)) ||
            (isRetentionInvoice && !evidenceRef.trim()),
        }}
        destroyOnClose
      >
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Alert
            type="info"
            showIcon
            message="Validasi Finance Authoritative (Backend SSOT)"
            description={
              isProgressInvoice
                ? 'Invoice termin Progress wajib divalidasi terhadap Goods Receipt (GR) fisik yang tercatat di database.'
                : 'Tindakan ini akan mengunci status invoice menjadi VERIFIED di database. Pastikan seluruh dokumen pendukung fisik/elektronik telah sesuai.'
            }
            style={{ borderRadius: 6 }}
          />

          {isProgressInvoice ? (
            <div>
              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 12, color: '#1e3a8a' }}>
                  Dokumen Goods Receipt (GR) Bukti Penerimaan Fisik <span style={{ color: '#dc2626' }}>*</span>:
                </Text>
              </div>

              {loadingPoGrs ? (
                <div style={{ padding: '12px 0', textAlign: 'center' }}>
                  <Spin size="small" /> <Text type="secondary" style={{ marginLeft: 8 }}>Memuat data GR...</Text>
                </div>
              ) : poGoodsReceipts.length === 0 ? (
                <Alert
                  type="error"
                  showIcon
                  message="Tidak Ditemukan Goods Receipt Aktif"
                  description="PO ini belum memiliki dokumen Goods Receipt aktif. Termin Progress tidak dapat diverifikasi tanpa bukti penerimaan fisik."
                  style={{ borderRadius: 6 }}
                />
              ) : (
                <>
                  <Select
                    placeholder="Pilih Goods Receipt yang memvalidasi fisik invoice..."
                    style={{ width: '100%', borderRadius: 6 }}
                    value={selectedVerifyGrId}
                    onChange={(val) => {
                      setSelectedVerifyGrId(val);
                      const grObj = poGoodsReceipts.find((g) => Number(g.id) === Number(val));
                      const ref = grObj?.grNumber || '';
                      setEvidenceRef(ref);
                      if (invoiceId) {
                        loadMatching(invoiceId, vendorId, val, ref);
                      }
                    }}
                    options={poGoodsReceipts.map((gr) => ({
                      value: gr.id,
                      label: `${gr.grNumber} | Tanggal: ${dayjs(gr.receiptDate).format('DD/MM/YYYY')} | Nilai Fisik: Rp ${Number(gr.totalReceivedAmount || 0).toLocaleString('id-ID')}`,
                    }))}
                  />

                  {selectedVerifyGr && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        borderRadius: 6,
                        border: '1px solid #bbf7d0',
                        fontSize: 11.5,
                      }}
                    >
                      <Row gutter={[8, 4]}>
                        <Col span={12}>
                          <Text type="secondary" style={{ fontSize: 10 }}>NOMOR GR:</Text>
                          <div style={{ fontWeight: 700, color: '#166534', fontFamily: 'monospace' }}>
                            {selectedVerifyGr.grNumber} (ID #{selectedVerifyGr.id})
                          </div>
                        </Col>
                        <Col span={12}>
                          <Text type="secondary" style={{ fontSize: 10 }}>NILAI FISIK DITERIMA:</Text>
                          <div style={{ fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>
                            Rp {Number(selectedVerifyGr.totalReceivedAmount || 0).toLocaleString('id-ID')}
                          </div>
                        </Col>
                        <Col span={24} style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 10 }}>TANGGAL PENERIMAAN:</Text>
                          <div style={{ color: '#334155' }}>
                            {dayjs(selectedVerifyGr.receiptDate).format('DD MMMM YYYY')}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : isRetentionInvoice ? (
            <div>
              <Text strong style={{ fontSize: 12 }}>
                Nomor Referensi Dokumen BAST (Berita Acara Serah Terima) <span style={{ color: '#dc2626' }}>*</span>:
              </Text>
              <Input
                placeholder="Contoh: BAST-2026/09/001 atau BAST-FINAL-KARAWANG"
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
                style={{ marginTop: 4, borderRadius: 6 }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Wajib untuk termin Retensi setelah PO berstatus COMPLETED.
              </Text>
            </div>
          ) : isDpInvoice ? (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <Text strong style={{ fontSize: 12, color: '#0369a1' }}>
                <CheckCircleOutlined style={{ marginRight: 6 }} />
                Termin Uang Muka (DP)
              </Text>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Termin Down Payment tidak mensyaratkan verifikasi fisik Goods Receipt atau dokumen serah terima.
              </div>
            </div>
          ) : (
            <div>
              <Text strong style={{ fontSize: 12 }}>
                Nomor Referensi Dokumen Pendukung (Opsional):
              </Text>
              <Input
                placeholder="Contoh: SJ-SUPLAI-102 / BAST..."
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
                style={{ marginTop: 4, borderRadius: 6 }}
              />
            </div>
          )}

          <div>
            <Text strong style={{ fontSize: 12 }}>Catatan Verifikasi Finance (Opsional):</Text>
            <TextArea
              rows={3}
              placeholder="Catatan hasil verifikasi rekening, kelengkapan pajak, atau nomor FP..."
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              style={{ marginTop: 4, borderRadius: 6 }}
            />
          </div>
        </div>
      </Modal>

      {/* REJECT INVOICE SUB-MODAL */}
      <Modal
        open={isRejectModalOpen}
        onCancel={() => !submittingAction && setIsRejectModalOpen(false)}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#dc2626', fontSize: 18 }} />
            <span>Tolak Verifikasi Invoice — {invoiceNumber}</span>
          </Space>
        }
        confirmLoading={submittingAction}
        onOk={handleRejectSubmit}
        okText="Tolak Invoice"
        cancelText="Batal"
        okButtonProps={{ danger: true, style: { fontWeight: 600 } }}
        destroyOnClose
      >
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Alert
            type="error"
            showIcon
            message="Perhatian Penolakan Faktur"
            description="Invoice yang ditolak akan berstatus REJECTED. Vendor perlu memperbaiki faktur atau dokumen terkait sebelum dapat ditagihkan kembali."
            style={{ borderRadius: 6 }}
          />

          <div>
            <Text strong style={{ fontSize: 12, color: '#dc2626' }}>
              Alasan Penolakan / Catatan Finance (Wajib):
            </Text>
            <TextArea
              rows={4}
              placeholder="Tuliskan secara spesifik alasan penolakan verifikasi faktur..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              style={{ marginTop: 4, borderRadius: 6 }}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default InvoiceDetailModal;
