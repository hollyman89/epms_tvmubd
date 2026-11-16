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
  InputNumber,
  DatePicker,
  Form,
  message,
  Select,
  Upload,
  Tooltip,
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
  EditOutlined,
  UploadOutlined,
  FilePdfOutlined,
  CalculatorOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import { ProcurementService } from '@/services/procurement.service';
import { PPH_TYPE_OPTIONS } from './CreateInvoiceModal';
import {
  FinanceService,
  InvoiceDto,
  MatchingResult,
  MismatchCode,
  MISMATCH_DEFINITIONS,
} from '@/services/finance.service';
import UserIdentityDisplay from '@/components/common/UserIdentityDisplay';
import { normalizeInvoiceItem } from './invoiceItemProjection';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatQuantityWithUom,
  formatPercentage,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ResponsiveFinanceModal } from './ResponsiveFinanceModal';
import { streamSecureDocument, downloadSecureDocument } from '@/lib/fileDelivery';
import styles from './InvoiceDetailModal.module.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

export interface InvoiceDetailModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDto | null;
  onVerified?: () => void;
}

const formatRp = (val: number | undefined | null) => formatCurrency(val);

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  open,
  onClose,
  invoice,
  onVerified,
}) => {
  const { user, isFinance } = useAuth();
  const canVerify = isFinance;

  // Authoritative data states from backend
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(
    (invoice as any)?.matchingResult || (invoice as any)?.matching || null
  );
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

  // Authoritative Tax Administration States (Section 9 Mandate)
  const [taxData, setTaxData] = useState<any>(null);
  const [loadingTax, setLoadingTax] = useState<boolean>(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState<boolean>(false);
  const [submittingTax, setSubmittingTax] = useState<boolean>(false);
  const [taxForm] = Form.useForm();
  const [fakturFile, setFakturFile] = useState<File | null>(null);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [invoiceDocuments, setInvoiceDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(false);

  // Semi-Automatic Tax Calculation & Manual Override States for Sub-Modal
  const [isTaxPpnOverridden, setIsTaxPpnOverridden] = useState<boolean>(false);
  const [isTaxPphOverridden, setIsTaxPphOverridden] = useState<boolean>(false);

  // Watches for Tax Sub-Modal
  const taxDppWatch = Form.useWatch('dppAmount', taxForm);
  const taxPpnRateWatch = Form.useWatch('ppnRate', taxForm);
  const taxPphRateWatch = Form.useWatch('pphRate', taxForm);
  const taxPphBaseWatch = Form.useWatch('taxableBase', taxForm);

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

  // Fetch Tax Details from Backend (GET /api/v1/finance/invoices/:id/tax)
  const loadTaxData = useCallback(async (id: number) => {
    setLoadingTax(true);
    try {
      const data = await FinanceService.getInvoiceTax(id);
      setTaxData(data);
    } catch (err) {
      console.warn('Could not fetch tax details:', err);
      setTaxData(null);
    } finally {
      setLoadingTax(false);
    }
  }, []);

  // Fetch Attached Documents from Backend (GET /api/v1/documents/entity/INVOICE/:id)
  const loadDocuments = useCallback(async (id: number) => {
    setLoadingDocuments(true);
    try {
      const docs = await FinanceService.getInvoiceDocuments(id);
      setInvoiceDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.warn('Could not fetch invoice documents:', err);
      setInvoiceDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  // Secure File Delivery Handlers (Preview & Download)
  const [actionDocId, setActionDocId] = useState<number | null>(null);

  const handlePreviewDocument = useCallback(async (doc: any) => {
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
  }, []);

  const handleDownloadDocument = useCallback(async (doc: any) => {
    if (!doc?.id) return;
    setActionDocId(doc.id);
    try {
      await downloadSecureDocument(doc.id, doc.fileName || `dokumen-${doc.id}.pdf`);
    } catch (err: any) {
      message.error(`Gagal mengunduh berkas dokumen: ${err?.message || 'Akses ditolak atau berkas tidak ditemukan'}`);
    } finally {
      setActionDocId(null);
    }
  }, []);

  useEffect(() => {
    if (open && invoiceId && !isNaN(invoiceId) && invoiceId > 0) {
      loadMatching(invoiceId, vendorId);
      loadFreshInvoice(invoiceId);
      loadTaxData(invoiceId);
      loadDocuments(invoiceId);
    } else {
      setMatchingResult(null);
      setFreshInvoice(null);
      setMatchingError(null);
      setTaxData(null);
      setInvoiceDocuments([]);
    }
  }, [open, invoiceId, vendorId, loadMatching, loadFreshInvoice, loadTaxData, loadDocuments]);

  // Derive PO ID for fetching canonical Goods Receipts
  const poIdForGr = Number(
    (freshInvoice as any)?.poId ||
    (invoice as any)?.poId ||
    (freshInvoice as any)?.purchaseOrder?.id ||
    (invoice as any)?.purchaseOrder?.id ||
    matchingResult?.poId ||
    0
  );

  // Load PO Goods Receipts from backend (Only for MATERIAL PO)
  useEffect(() => {
    const isService = Boolean(
      (freshInvoice as any)?.purchaseOrder?.orderType === 'SERVICE' ||
      (freshInvoice as any)?.orderType === 'SERVICE' ||
      (invoice as any)?.purchaseOrder?.orderType === 'SERVICE' ||
      (invoice as any)?.orderType === 'SERVICE' ||
      freshInvoice?.serviceClaimId ||
      invoice?.serviceClaimId
    );
    if (open && poIdForGr > 0 && !isService) {
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
  }, [open, poIdForGr, freshInvoice, invoice]);

  const selectedVerifyGr = useMemo(() => {
    if (!selectedVerifyGrId) return null;
    return poGoodsReceipts.find((g) => Number(g.id) === Number(selectedVerifyGrId)) || null;
  }, [selectedVerifyGrId, poGoodsReceipts]);

  if (!invoice) return null;

  // Effective Display Fields (Prefer fresh backend invoice if available)
  const activeInvoice = freshInvoice || invoice;
  const isServicePo = Boolean(
    (activeInvoice as any)?.purchaseOrder?.orderType === 'SERVICE' ||
    (activeInvoice as any)?.orderType === 'SERVICE' ||
    (invoice as any)?.purchaseOrder?.orderType === 'SERVICE' ||
    (invoice as any)?.orderType === 'SERVICE' ||
    activeInvoice?.serviceClaimId ||
    (activeInvoice as any)?.serviceClaim ||
    (invoice as any)?.serviceClaimId
  );
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
    if (!isServicePo && isProgressInvoice && !selectedVerifyGrId) {
      message.error('Harap pilih dokumen Goods Receipt (GR) valid terlebih dahulu.');
      return;
    }
    setSubmittingAction(true);
    try {
      // Authoritative Finance Verification Tax Completeness Gate (Frontend Check)
      const detailObj = taxData?.taxDetail || (taxData as any)?.invoiceTaxDetail || (activeInvoice as any)?.invoiceTaxDetail;
      const snapshot = detailObj?.taxRuleSnapshot || (taxData as any)?.invoiceTaxDetail?.taxRuleSnapshot;
      const ppnRecord = taxData?.ppnRecords?.[0] || (taxData as any)?.ppnMasukanRecords?.[0];
      const pphRecord = taxData?.pphRecords?.[0] || (taxData as any)?.pphWithholdingRecords?.[0];

      const ppnAmountVal = Number(detailObj?.ppnAmount ?? ppnRecord?.ppnAmount ?? snapshot?.ppn?.ppnAmount ?? 0);
      const pphAmountVal = Number(detailObj?.pphAmount ?? detailObj?.pphWithholdingAmount ?? pphRecord?.withheldAmount ?? snapshot?.pph?.withheldAmount ?? 0);

      const isPpnApp = ppnAmountVal > 0 || (taxData?.ppnRecords && taxData.ppnRecords.length > 0);
      const nsfpVal = detailObj?.fakturPajakNumber || ppnRecord?.fakturPajakNumber || snapshot?.ppn?.fakturPajakNumber || snapshot?.fakturPajakNumber;
      const cleanNsfp = nsfpVal ? String(nsfpVal).trim().replace(/[\.\-]/g, '') : '';
      const fpDateVal = detailObj?.fakturPajakDate || ppnRecord?.fakturPajakDate || snapshot?.ppn?.fakturPajakDate;

      const isPphApp = pphAmountVal > 0 || (taxData?.pphRecords && taxData.pphRecords.length > 0);
      const bpNumVal = detailObj?.buktiPotongNumber || pphRecord?.buktiPotongNumber || snapshot?.pph?.buktiPotongNumber || snapshot?.buktiPotongNumber;
      const bpDateVal = detailObj?.buktiPotongDate || pphRecord?.buktiPotongDate || snapshot?.pph?.buktiPotongDate;

      const frontendTaxErrors: string[] = [];
      if (isPpnApp) {
        if (!cleanNsfp) {
          frontendTaxErrors.push('Nomor Faktur Pajak (NSFP) wajib diisi.');
        } else if (!/^[0-9]{16}$/.test(cleanNsfp)) {
          frontendTaxErrors.push('Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.');
        }
        if (!fpDateVal || isNaN(new Date(fpDateVal).getTime())) {
          frontendTaxErrors.push('Tanggal Faktur Pajak wajib diisi.');
        }
      }
      if (isPphApp) {
        if (!bpNumVal || !String(bpNumVal).trim()) {
          frontendTaxErrors.push('Nomor Bukti Potong wajib diisi.');
        }
        if (!bpDateVal || isNaN(new Date(bpDateVal).getTime())) {
          frontendTaxErrors.push('Tanggal Bukti Potong wajib diisi.');
        }
      }

      if (frontendTaxErrors.length > 0) {
        frontendTaxErrors.forEach((err) => message.error(err));
        message.error('Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice.');
        setSubmittingAction(false);
        return;
      }

      const payload: any = {
        approved: true,
        notes: verifyNotes.trim() || undefined,
      };

      if (!isServicePo && isProgressInvoice) {
        payload.goodsReceiptId = selectedVerifyGrId ? Number(selectedVerifyGrId) : undefined;
        payload.evidenceRef = selectedVerifyGr?.grNumber || evidenceRef.trim() || undefined;
      } else if (isServicePo) {
        const scNumber = (activeInvoice as any)?.serviceClaim?.claimNumber;
        payload.evidenceRef = scNumber || evidenceRef.trim() || undefined;
      } else {
        payload.evidenceRef = evidenceRef.trim() || undefined;
      }

      await FinanceService.verifyInvoice(invoiceId, payload);
      message.success(isServicePo ? 'Invoice jasa berhasil diverifikasi (Rekonsiliasi Jasa lolos)!' : 'Invoice berhasil diverifikasi secara sah oleh Finance!');
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

  // Arithmetic Calculation Helpers for Tax Sub-Modal
  const computePpnAmount = (dpp: number | null | undefined, rate: number | null | undefined): number | undefined => {
    if (dpp === null || dpp === undefined || rate === null || rate === undefined) return undefined;
    const numDpp = Number(dpp);
    const numRate = Number(rate);
    if (isNaN(numDpp) || isNaN(numRate)) return undefined;
    return Math.round((numDpp * numRate) / 100);
  };

  const computePphWithheld = (base: number | null | undefined, rate: number | null | undefined): number | undefined => {
    if (base === null || base === undefined || rate === null || rate === undefined) return undefined;
    const numBase = Number(base);
    const numRate = Number(rate);
    if (isNaN(numBase) || isNaN(numRate)) return undefined;
    return Math.round((numBase * numRate) / 100);
  };

  const handleTaxDppChange = (dppVal: number | null) => {
    if (!isTaxPpnOverridden) {
      const rate = taxForm.getFieldValue('ppnRate');
      const calculated = computePpnAmount(dppVal, rate);
      if (calculated !== undefined) {
        taxForm.setFieldsValue({ ppnAmount: calculated });
      }
    }
  };

  const handleTaxPpnRateChange = (rateVal: number | null) => {
    if (!isTaxPpnOverridden) {
      const dpp = taxForm.getFieldValue('dppAmount');
      const calculated = computePpnAmount(dpp, rateVal);
      if (calculated !== undefined) {
        taxForm.setFieldsValue({ ppnAmount: calculated });
      }
    }
  };

  const handleTaxPpnAmountChange = (amtVal: number | null) => {
    const dpp = taxForm.getFieldValue('dppAmount');
    const rate = taxForm.getFieldValue('ppnRate');
    const calculated = computePpnAmount(dpp, rate);
    if (calculated !== undefined) {
      if (amtVal !== null && amtVal !== undefined && amtVal !== calculated) {
        setIsTaxPpnOverridden(true);
      } else if (amtVal === calculated) {
        setIsTaxPpnOverridden(false);
      }
    } else if (amtVal !== null && amtVal !== undefined) {
      setIsTaxPpnOverridden(true);
    }
  };

  const handleResetTaxPpnAuto = () => {
    setIsTaxPpnOverridden(false);
    const dpp = taxForm.getFieldValue('dppAmount');
    const rate = taxForm.getFieldValue('ppnRate');
    const calculated = computePpnAmount(dpp, rate);
    if (calculated !== undefined) {
      taxForm.setFieldsValue({ ppnAmount: calculated });
    }
  };

  const handleTaxPphBaseChange = (baseVal: number | null) => {
    if (!isTaxPphOverridden) {
      const rate = taxForm.getFieldValue('pphRate');
      const calculated = computePphWithheld(baseVal, rate);
      if (calculated !== undefined) {
        taxForm.setFieldsValue({ withheldAmount: calculated });
      }
    }
  };

  const handleTaxPphRateChange = (rateVal: number | null) => {
    if (!isTaxPphOverridden) {
      const base = taxForm.getFieldValue('taxableBase');
      const calculated = computePphWithheld(base, rateVal);
      if (calculated !== undefined) {
        taxForm.setFieldsValue({ withheldAmount: calculated });
      }
    }
  };

  const handleTaxWithheldAmountChange = (amtVal: number | null) => {
    const base = taxForm.getFieldValue('taxableBase');
    const rate = taxForm.getFieldValue('pphRate');
    const calculated = computePphWithheld(base, rate);
    if (calculated !== undefined) {
      if (amtVal !== null && amtVal !== undefined && amtVal !== calculated) {
        setIsTaxPphOverridden(true);
      } else if (amtVal === calculated) {
        setIsTaxPphOverridden(false);
      }
    } else if (amtVal !== null && amtVal !== undefined) {
      setIsTaxPphOverridden(true);
    }
  };

  const handleResetTaxPphAuto = () => {
    setIsTaxPphOverridden(false);
    const base = taxForm.getFieldValue('taxableBase');
    const rate = taxForm.getFieldValue('pphRate');
    const calculated = computePphWithheld(base, rate);
    if (calculated !== undefined) {
      taxForm.setFieldsValue({ withheldAmount: calculated });
    }
  };

  // Open Tax Update Modal
  const handleOpenTaxModal = () => {
    const detail = taxData?.taxDetail || taxData?.invoiceTaxDetail;
    const ppn = taxData?.ppnRecords?.[0] || taxData?.ppnMasukanRecords?.[0];
    const pph = taxData?.pphRecords?.[0] || taxData?.pphWithholdingRecords?.[0];
    const snapshot = detail?.taxRuleSnapshot || taxData?.invoiceTaxDetail?.taxRuleSnapshot;

    const ppnRateVal = detail?.ppnRate ?? snapshot?.ppn?.ppnRate ?? ppn?.taxRate ?? undefined;
    const pphRateVal = detail?.pphRate ?? snapshot?.pph?.rate ?? pph?.withholdingRate ?? undefined;
    const dppVal = detail?.dppCommercial || detail?.taxBasis || ppn?.dppAmount || snapshot?.ppn?.dppAmount || totalAmount;
    const ppnVal = detail?.ppnAmount || ppn?.ppnAmount || snapshot?.ppn?.ppnAmount || undefined;
    const baseVal = detail?.dppCommercial || detail?.taxBasis || pph?.taxableBase || snapshot?.pph?.taxableBase || totalAmount;
    const withheldVal = detail?.pphWithholdingAmount || detail?.pphAmount || pph?.withheldAmount || snapshot?.pph?.withheldAmount || undefined;

    const expectedPpn = computePpnAmount(dppVal, ppnRateVal);
    const isPpnDiff = (expectedPpn !== undefined && ppnVal !== undefined && Number(ppnVal) !== expectedPpn);

    const expectedPph = computePphWithheld(baseVal, pphRateVal);
    const isPphDiff = (expectedPph !== undefined && withheldVal !== undefined && Number(withheldVal) !== expectedPph);

    setIsTaxPpnOverridden(isPpnDiff);
    setIsTaxPphOverridden(isPphDiff);

    taxForm.setFieldsValue({
      fakturPajakNumber: detail?.fakturPajakNumber || ppn?.fakturPajakNumber || snapshot?.ppn?.fakturPajakNumber || snapshot?.fakturPajakNumber || '',
      fakturPajakDate: detail?.fakturPajakDate ? dayjs(detail.fakturPajakDate) : ppn?.fakturPajakDate ? dayjs(ppn.fakturPajakDate) : snapshot?.ppn?.fakturPajakDate ? dayjs(snapshot.ppn.fakturPajakDate) : undefined,
      dppAmount: dppVal,
      ppnRate: ppnRateVal,
      ppnAmount: ppnVal,
      pphType: detail?.pphType || pph?.pphRegime || snapshot?.pph?.pphType || undefined,
      pphRate: pphRateVal,
      taxableBase: baseVal,
      withheldAmount: withheldVal,
      buktiPotongNumber: detail?.buktiPotongNumber || pph?.buktiPotongNumber || snapshot?.pph?.buktiPotongNumber || snapshot?.buktiPotongNumber || '',
      buktiPotongDate: detail?.buktiPotongDate ? dayjs(detail.buktiPotongDate) : pph?.buktiPotongDate ? dayjs(pph.buktiPotongDate) : snapshot?.pph?.buktiPotongDate ? dayjs(snapshot.pph.buktiPotongDate) : undefined,
    });
    setFakturFile(null);
    setBuktiFile(null);
    setIsTaxModalOpen(true);
  };

  const handleTaxSubmit = async (values: any) => {
    if (!invoiceId) return;
    setSubmittingTax(true);
    try {
      const payload: any = {};
      const fpNum = values.fakturPajakNumber;
      const fpDate = values.fakturPajakDate;
      const dpp = values.dppAmount != null && values.dppAmount !== '' ? Number(values.dppAmount) : undefined;
      const ppnRate = values.ppnRate != null && values.ppnRate !== '' ? Number(values.ppnRate) : undefined;
      const ppn = values.ppnAmount != null && values.ppnAmount !== '' ? Number(values.ppnAmount) : undefined;

      if (fpNum || fpDate || dpp != null || ppnRate != null || ppn != null) {
        const fpClean = fpNum ? String(fpNum).trim().replace(/[\.\-]/g, '') : '';
        if (!fpClean) {
          message.error('Nomor Faktur Pajak (NSFP) wajib diisi.');
          setSubmittingTax(false);
          return;
        }
        if (!/^[0-9]{16}$/.test(fpClean)) {
          message.error('Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka.');
          setSubmittingTax(false);
          return;
        }
        if (!fpDate) {
          message.error('Tanggal Faktur Pajak wajib diisi.');
          setSubmittingTax(false);
          return;
        }
        payload.ppn = {
          fakturPajakNumber: fpNum ? String(fpNum).trim() : undefined,
          fakturPajakDate: fpDate ? dayjs(fpDate).format('YYYY-MM-DD') : undefined,
          dppAmount: dpp,
          ppnRate: ppnRate,
          ppnAmount: ppn,
        };
      }

      const pType = values.pphType;
      const pRate = values.pphRate != null && values.pphRate !== '' ? Number(values.pphRate) : undefined;
      const tBase = values.taxableBase != null && values.taxableBase !== '' ? Number(values.taxableBase) : undefined;
      const wAmt = values.withheldAmount != null && values.withheldAmount !== '' ? Number(values.withheldAmount) : undefined;
      const bpNum = values.buktiPotongNumber;
      const bpDate = values.buktiPotongDate;

      if (pType || pRate != null || tBase != null || wAmt != null || bpNum || bpDate) {
        const bpClean = bpNum ? String(bpNum).trim() : '';
        if (!bpClean) {
          message.error('Nomor Bukti Potong wajib diisi.');
          setSubmittingTax(false);
          return;
        }
        if (!bpDate) {
          message.error('Tanggal Bukti Potong wajib diisi.');
          setSubmittingTax(false);
          return;
        }
        payload.pph = {
          pphType: pType || undefined,
          rate: pRate,
          taxableBase: tBase,
          withheldAmount: wAmt,
          buktiPotongNumber: bpClean || undefined,
          buktiPotongDate: bpDate ? dayjs(bpDate).format('YYYY-MM-DD') : undefined,
        };
      }

      await FinanceService.updateInvoiceTax(invoiceId, payload);

      let uploadErrOccurred = false;
      if (fakturFile) {
        try {
          await FinanceService.uploadInvoiceDocument({
            file: fakturFile,
            entityType: 'INVOICE',
            entityId: invoiceId,
            category: 'FAKTUR_PAJAK',
          });
        } catch (uploadErr: any) {
          uploadErrOccurred = true;
          message.error(`Gagal mengunggah Faktur Pajak: ${uploadErr?.message || 'Error server'}`);
        }
      }

      if (buktiFile) {
        try {
          await FinanceService.uploadInvoiceDocument({
            file: buktiFile,
            entityType: 'INVOICE',
            entityId: invoiceId,
            category: 'BUKTI_POTONG',
          });
        } catch (uploadErr: any) {
          uploadErrOccurred = true;
          message.error(`Gagal mengunggah Bukti Potong: ${uploadErr?.message || 'Error server'}`);
        }
      }

      if (!uploadErrOccurred) {
        message.success('Data administrasi perpajakan dan berkas invoice berhasil diperbarui.');
      } else {
        message.warning('Informasi pajak diperbarui, namun ada berkas pendukung yang gagal diunggah.');
      }
      setIsTaxModalOpen(false);
      loadTaxData(invoiceId);
      loadDocuments(invoiceId);
    } catch (err: any) {
      console.error('Failed to update tax details:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal memperbarui data pajak.';
      message.error(errMsg);
    } finally {
      setSubmittingTax(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    return (
      <StatusBadge
        domain="reconciliation"
        status={currentMatchStatus}
        style={{ fontSize: 12, padding: '2px 8px', margin: 0 }}
      />
    );
  };

  return (
    <>
      <ResponsiveFinanceModal
        open={open}
        onCancel={onClose}
        domain="INVOICE"
        size="full"
        destroyOnClose
        title={`Rincian & Verifikasi Invoice — ${invoiceNumber}`}
        subtitle="Faktur tagihan vendor terintegrasi authoritative Finance Matching Engine & Jadwal Termin PO"
        headerIcon={<FileTextOutlined />}
        footerExtra={
          <div className={styles.footerExtraContainer}>
            <div className={styles.footerIdentityRow}>
              <SafetyCertificateOutlined
                style={{
                  color: isVerified ? '#059669' : isMatched ? '#0284c7' : isMismatch ? '#dc2626' : '#d97706',
                  fontSize: 15,
                  flexShrink: 0,
                }}
              />
              <span className={styles.footerInvoiceNumber}>
                Nomor Faktur: <strong>{invoiceNumber}</strong>
              </span>
            </div>
            <div className={styles.footerStatusRow}>
              <span className={styles.footerStatusLabel}>Rekonsiliasi:</span>
              {renderStatusBadge()}
              <span className={styles.footerStatusLabel}>Pembayaran:</span>
              <StatusBadge
                domain="payment"
                status={(activeInvoice as any).paymentStatus || 'UNPAID'}
                showDot
                style={{ margin: 0, fontWeight: 700 }}
              />
            </div>
          </div>
        }
        footerActions={
          <div className={styles.footerActionsContainer}>
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
                  disabled={!isServicePo && isProgressInvoice && (!selectedVerifyGrId || poGoodsReceipts.length === 0)}
                  style={{
                    backgroundColor: '#059669',
                    borderColor: '#059669',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  {isServicePo ? 'Verifikasi Invoice Jasa' : 'Verifikasi Invoice'}
                </Button>
              </>
            )}
            <Button onClick={onClose} style={{ borderRadius: 6 }} className={styles.closeActionButton}>
              Tutup
            </Button>
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
                <StatusBadge
                  domain="po"
                  status={(activeInvoice as any).purchaseOrder?.status || 'ISSUED'}
                  showDot
                  style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}
                />
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
                <StatusBadge
                  domain="invoice"
                  status={(activeInvoice as any).paymentStatus || 'UNPAID'}
                  showDot
                  style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}
                />
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
                    {isServicePo
                      ? 'Authoritative Service Reconciliation Engine (Rekonsiliasi Jasa)'
                      : 'Authoritative Finance Matching Engine (SSOT API)'}
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
                  <div style={{ marginTop: 6 }}>
                    <Alert
                      type="warning"
                      showIcon
                      message={
                        <span style={{ fontWeight: 700, fontSize: 12 }}>
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
                                className={styles.mismatchCard}
                                data-testid={`mismatch-card-${idx}`}
                              >
                                <div className={styles.mismatchHeader}>
                                  <Tag color={def.badgeColor} style={{ margin: 0, fontWeight: 700, fontSize: 10.5 }}>
                                    {def.label}
                                  </Tag>
                                  <span className={styles.mismatchCodeBadge}>
                                    [{m.code}]
                                  </span>
                                </div>
                                <div className={styles.mismatchDescription}>
                                  {m.message || def.fallbackMessage}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      }
                      style={{ borderRadius: 8, border: '1px solid #fbd38d', padding: '10px 12px' }}
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

          {/* Desktop Metadata View */}
          <div className={styles.desktopMetadataView} data-testid="desktop-invoice-metadata">
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
                <UserIdentityDisplay
                  user={(activeInvoice as any).creator}
                  userId={(activeInvoice as any).createdBy}
                  fallbackRole="Finance Team"
                  showEmail
                />
              </Descriptions.Item>
              <Descriptions.Item label="Waktu Terbit" span={2}>
                {activeInvoice.createdAt ? dayjs(activeInvoice.createdAt).format('DD/MM/YYYY HH:mm') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* Mobile Metadata View */}
          <div className={styles.mobileMetadataView} data-testid="mobile-invoice-metadata">
            <div className={styles.metadataCard}>
              <div className={styles.metadataRow}>
                <span className={styles.metadataLabel}>Nomor Invoice:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8', wordBreak: 'break-all' }}>
                  {invoiceNumber}
                </span>
              </div>
              <div className={styles.metadataRow}>
                <span className={styles.metadataLabel}>Tanggal Terbit:</span>
                <span>{activeInvoice.invoiceDate ? dayjs(activeInvoice.invoiceDate).format('DD MMMM YYYY') : '—'}</span>
              </div>
              <div className={styles.metadataRow}>
                <span className={styles.metadataLabel}>Termin Pembayaran:</span>
                <span style={{ fontWeight: 500 }}>
                  {paymentTerm ? `${paymentTerm.termName} (${paymentTerm.percentage}%)` : (activeInvoice as any).paymentTerms || 'Net 30 Days'}
                </span>
              </div>
              <div className={styles.metadataRow}>
                <span className={styles.metadataLabel}>Diterbitkan Oleh:</span>
                <div>
                  <UserIdentityDisplay
                    user={(activeInvoice as any).creator}
                    userId={(activeInvoice as any).createdBy}
                    fallbackRole="Finance Team"
                    showEmail
                  />
                </div>
              </div>
              <div className={styles.metadataRow}>
                <span className={styles.metadataLabel}>Waktu Terbit:</span>
                <span style={{ color: '#64748b', fontSize: 11 }}>
                  {activeInvoice.createdAt ? dayjs(activeInvoice.createdAt).format('DD/MM/YYYY HH:mm') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* EVIDENCE SECTION: SERVICE CLAIM FOR SERVICE PO, CANONICAL GR FOR MATERIAL PO */}
          {isServicePo ? (
            <div
              style={{
                background: '#f0fdf4',
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid #bbf7d0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: '6px 10px', background: '#dcfce7', borderRadius: 8, color: '#16a34a' }}>
                    <SafetyCertificateOutlined style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>
                      Bukti Pelaksanaan: Service Claim Disetujui ({(activeInvoice as any).serviceClaim?.claimNumber || ((activeInvoice as any).serviceClaimId ? `SCL #${(activeInvoice as any).serviceClaimId}` : 'Klaim Jasa')})
                    </div>
                    <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                      Status: <Tag color="green" style={{ fontWeight: 700, margin: '0 4px' }}>{(activeInvoice as any).serviceClaim?.status || 'APPROVED_FOR_INVOICE'}</Tag>
                      — Nilai Disetujui: <strong>Rp {Number((activeInvoice as any).serviceClaim?.approvedClaimAmount || activeInvoice.totalAmount || 0).toLocaleString('id-ID')}</strong>
                      {(activeInvoice as any).serviceClaim?.serviceOrder?.soNumber && (
                        <span style={{ marginLeft: 8 }}>
                          — SPK/WO: <strong>{(activeInvoice as any).serviceClaim.serviceOrder.soNumber}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Tag color="green" style={{ fontWeight: 700, fontSize: 11, padding: '2px 8px', margin: 0 }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />
                  KLAIM JASA DISETUJUI
                </Tag>
              </div>
            </div>
          ) : isProgressInvoice ? (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px dashed #cbd5e1', flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Pilih Dokumen GR Bukti Fisik:</Text>
                  <Select
                    size="small"
                    style={{ flex: 1, minWidth: 220, maxWidth: '100%' }}
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
          ) : null}

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

              {/* Desktop Table View */}
              <div className={styles.desktopTableView} data-testid="desktop-items-table">
                <Table
                  size="small"
                  rowKey={(it: any) => it.id || it.key || it.poItemId}
                  dataSource={activeInvoice.items}
                  pagination={false}
                  scroll={{ x: 650, y: 200 }}
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
                      render: (_: any, it: any) => {
                        const { itemName, specification } = normalizeInvoiceItem(it);
                        return (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>
                              {itemName}
                            </div>
                            {specification && (
                              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                                {specification}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              {it.categoryName && (
                                <Tag color="blue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                                  {it.categoryName}
                                </Tag>
                              )}
                              {it.wbsNodeId && (
                                <Tag color="geekblue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                                  WBS: {it.wbsNodeId}
                                </Tag>
                              )}
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Qty Ditagih',
                      dataIndex: 'quantity',
                      key: 'quantity',
                      width: 120,
                      align: 'center' as const,
                      render: (qty: number, it: any) => {
                        const { uom } = normalizeInvoiceItem(it);
                        return (
                          <span style={{ fontWeight: 600 }}>
                            {formatQuantityWithUom(qty, uom)}
                          </span>
                        );
                      },
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

              {/* Mobile Card View */}
              <div className={styles.mobileCardView} data-testid="mobile-items-cards">
                {activeInvoice.items.map((it: any, idx: number) => {
                  const { itemName, specification, uom } = normalizeInvoiceItem(it);
                  return (
                    <div key={it.id || it.key || it.poItemId || idx} className={styles.mobileItemCard} data-testid={`mobile-item-card-${idx}`}>
                      <div className={styles.cardHeader}>
                        <div className={styles.itemTitleBlock}>
                          <span className={styles.itemIndexBadge}>{idx + 1}</span>
                          <div>
                            <div className={styles.itemNameText}>{itemName}</div>
                            {specification && (
                              <div className={styles.itemSpecificationText}>{specification}</div>
                            )}
                            <div className={styles.tagsRow}>
                              {it.categoryName && (
                                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px' }}>
                                  {it.categoryName}
                                </Tag>
                              )}
                              {it.wbsNodeId && (
                                <Tag color="geekblue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px' }}>
                                  WBS: {it.wbsNodeId}
                                </Tag>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.cardStatsGrid}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Qty Ditagih:</span>
                          <span className={styles.statValueBold}>{formatQuantityWithUom(it.quantity, uom)}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Harga Satuan:</span>
                          <span className={styles.statValueMono}>{formatRp(it.unitPrice)}</span>
                        </div>
                      </div>

                      <div className={styles.cardFooter}>
                        <span className={styles.statLabel}>Subtotal:</span>
                        <span className={styles.statValueEmerald}>{formatRp(it.totalPrice)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <InfoCircleOutlined style={{ color: '#0284c7', marginRight: 6 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Invoice ini ditagihkan berdasarkan <strong>Jadwal Termin Pembayaran (Term-Based Schedule)</strong> tanpa rincian item fisik terpisah.
              </Text>
            </div>
          )}

          {/* ADMINISTRASI PERPAJAKAN & BUKTI DOKUMEN (FAKTUR PAJAK & BUKTI POTONG) */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
            <div
              style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Space size={8}>
                <AuditOutlined style={{ color: '#2563eb', fontSize: 16 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  Administrasi Perpajakan &amp; Bukti Dokumen
                </span>
                <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, fontWeight: 700 }}>
                  ADMINISTRATIF &amp; REKONSILIASI
                </Tag>
              </Space>
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                onClick={handleOpenTaxModal}
                style={{ borderRadius: 6, fontSize: 11.5 }}
              >
                Lengkapi / Ubah Data Pajak
              </Button>
            </div>

            <div style={{ padding: 14 }}>
              {loadingTax ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Spin size="small" /> <Text type="secondary" style={{ marginLeft: 8 }}>Memuat data administrasi pajak...</Text>
                </div>
              ) : taxData?.taxDetail || (taxData as any)?.invoiceTaxDetail || (activeInvoice as any)?.invoiceTaxDetail || (taxData?.ppnRecords && taxData.ppnRecords.length > 0) || (taxData?.pphRecords && taxData.pphRecords.length > 0) || (taxData?.ppnMasukanRecords && taxData.ppnMasukanRecords.length > 0) || (taxData?.pphWithholdingRecords && taxData.pphWithholdingRecords.length > 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    const detailObj = taxData?.taxDetail || (taxData as any)?.invoiceTaxDetail || (activeInvoice as any)?.invoiceTaxDetail;
                    const snapshot = detailObj?.taxRuleSnapshot || (taxData as any)?.invoiceTaxDetail?.taxRuleSnapshot;
                    const ppnRecord = taxData?.ppnRecords?.[0] || (taxData as any)?.ppnMasukanRecords?.[0];
                    const pphRecord = taxData?.pphRecords?.[0] || (taxData as any)?.pphWithholdingRecords?.[0];

                    const nsfpNumber = detailObj?.fakturPajakNumber || ppnRecord?.fakturPajakNumber || snapshot?.ppn?.fakturPajakNumber || snapshot?.fakturPajakNumber || '—';
                    const fpRawDate = detailObj?.fakturPajakDate || ppnRecord?.fakturPajakDate || snapshot?.ppn?.fakturPajakDate;
                    const fpDateDisplay = fpRawDate ? dayjs(fpRawDate).format('DD/MM/YYYY') : '—';
                    const dppPpnVal = Number(detailObj?.taxBasis ?? detailObj?.dppCommercial ?? ppnRecord?.dppAmount ?? snapshot?.ppn?.dppAmount ?? totalAmount ?? 0);
                    const ppnAmountVal = Number(detailObj?.ppnAmount ?? ppnRecord?.ppnAmount ?? snapshot?.ppn?.ppnAmount ?? 0);
                    const ppnRateVal = detailObj?.ppnRate ?? ppnRecord?.taxRate ?? snapshot?.ppn?.ppnRate ?? (dppPpnVal > 0 && ppnAmountVal > 0 ? Math.round((ppnAmountVal / dppPpnVal) * 100) : 11);

                    const bpNumber = detailObj?.buktiPotongNumber || pphRecord?.buktiPotongNumber || snapshot?.pph?.buktiPotongNumber || snapshot?.buktiPotongNumber || '—';
                    const bpRawDate = detailObj?.buktiPotongDate || pphRecord?.buktiPotongDate || snapshot?.pph?.buktiPotongDate;
                    const bpDateDisplay = bpRawDate ? dayjs(bpRawDate).format('DD/MM/YYYY') : '—';
                    const pphRateDisplay = detailObj?.pphRate != null ? `${detailObj.pphRate}%` : pphRecord?.withholdingRate != null ? `${pphRecord.withholdingRate}%` : snapshot?.pph?.rate != null ? `${snapshot.pph.rate}%` : '—';
                    const pphBaseVal = Number(detailObj?.taxBasis ?? detailObj?.dppCommercial ?? pphRecord?.taxableBase ?? snapshot?.pph?.taxableBase ?? totalAmount ?? 0);
                    const pphAmountVal = Number(detailObj?.pphAmount ?? detailObj?.pphWithholdingAmount ?? pphRecord?.withheldAmount ?? snapshot?.pph?.withheldAmount ?? 0);
                    const pphTypeVal = detailObj?.pphType || pphRecord?.pphRegime || snapshot?.pph?.pphType || 'PPh';

                    const fakturDoc = invoiceDocuments.find((d: any) => d.category === 'FAKTUR_PAJAK');
                    const buktiDoc = invoiceDocuments.find((d: any) => d.category === 'BUKTI_POTONG');

                    const isPpnApp = ppnAmountVal > 0 || (taxData?.ppnRecords && taxData.ppnRecords.length > 0) || Boolean(detailObj?.ppnAmount && Number(detailObj.ppnAmount) > 0);
                    const cleanNsfp = (nsfpNumber && nsfpNumber !== '—') ? String(nsfpNumber).trim().replace(/[\.\-]/g, '') : '';
                    const isNsfpValid = cleanNsfp.length === 16 && /^[0-9]{16}$/.test(cleanNsfp);
                    const isFpDateValid = Boolean(fpRawDate && !isNaN(new Date(fpRawDate).getTime()));

                    const isPphApp = pphAmountVal > 0 || (taxData?.pphRecords && taxData.pphRecords.length > 0) || Boolean(detailObj?.pphAmount && Number(detailObj.pphAmount) > 0);
                    const isBpNumValid = Boolean(bpNumber && bpNumber !== '—' && String(bpNumber).trim());
                    const isBpDateValid = Boolean(bpRawDate && !isNaN(new Date(bpRawDate).getTime()));

                    const missingTaxList: string[] = [];
                    if (isPpnApp) {
                      if (!isNsfpValid) missingTaxList.push('Nomor Faktur Pajak (NSFP)');
                      if (!isFpDateValid) missingTaxList.push('Tanggal Faktur Pajak');
                    }
                    if (isPphApp) {
                      if (!isBpNumValid) missingTaxList.push('Nomor Bukti Potong');
                      if (!isBpDateValid) missingTaxList.push('Tanggal Bukti Potong');
                    }

                    return (
                      <>
                        {missingTaxList.length > 0 && (
                          <Alert
                            type="warning"
                            showIcon
                            message="Lengkapi administrasi perpajakan sebelum melakukan Verifikasi Invoice."
                            description={
                              <div style={{ fontSize: 11.5, marginTop: 4 }}>
                                Bidang wajib yang belum lengkap: <strong style={{ color: '#b45309' }}>{missingTaxList.join(', ')}</strong>.
                              </div>
                            }
                            action={
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<EditOutlined />}
                                onClick={handleOpenTaxModal}
                                style={{ fontSize: 11 }}
                              >
                                Lengkapi Data Pajak
                              </Button>
                            }
                            style={{ borderRadius: 6, border: '1px solid #fde68a', background: '#fffbeb', marginBottom: 12 }}
                          />
                        )}
                        <Row gutter={[16, 12]}>
                        {/* Faktur Pajak PPN Box */}
                        <Col xs={24} md={12}>
                          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 6, border: '1px solid #e2e8f0', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 12, color: '#1e3a8a' }}>
                                <FileTextOutlined style={{ marginRight: 6 }} />
                                Faktur Pajak (PPN Masukan)
                              </span>
                              <Space size={4}>
                                <Tag color="geekblue" style={{ fontSize: 9.5, margin: 0, fontWeight: 700 }}>
                                  {ppnRateVal}%
                                </Tag>
                                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, fontWeight: 700 }}>
                                  {ppnRecord?.creditableStatus || ppnRecord?.creditabilityStatus || 'TERCATAT'}
                                </Tag>
                              </Space>
                            </div>
                            <Row gutter={[8, 8]}>
                              <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>NOMOR NSFP:</Text>
                                  {isPpnApp && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>}
                                  {isPpnApp && !isNsfpValid && (
                                    <Tag color="error" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                                      {cleanNsfp.length > 0 ? '16 Digit' : 'Wajib'}
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: (isPpnApp && !isNsfpValid) ? '#dc2626' : '#0f172a' }}>
                                  {nsfpNumber}
                                </div>
                              </Col>
                              <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>TANGGAL FAKTUR:</Text>
                                  {isPpnApp && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>}
                                  {isPpnApp && !isFpDateValid && (
                                    <Tag color="error" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                                      Wajib
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontSize: 11.5, color: (isPpnApp && !isFpDateValid) ? '#dc2626' : '#334155', fontWeight: 600 }}>
                                  {fpDateDisplay}
                                </div>
                              </Col>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 10 }}>DPP PPN:</Text>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#1d4ed8' }}>
                                  {formatRp(dppPpnVal)}
                                </div>
                              </Col>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 10 }}>NOMINAL PPN:</Text>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#0284c7' }}>
                                  {formatRp(ppnAmountVal)}
                                </div>
                              </Col>
                              <Col span={24}>
                                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                    <FilePdfOutlined style={{ color: '#dc2626' }} />
                                    {fakturDoc ? (
                                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                        {fakturDoc.fileName}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ada berkas PDF Faktur Pajak</span>
                                    )}
                                  </span>
                                  {fakturDoc && (
                                    <Space size={4}>
                                      <Button
                                        size="small"
                                        type="link"
                                        icon={<EyeOutlined />}
                                        loading={actionDocId === fakturDoc.id}
                                        style={{ fontSize: 11, padding: '0 4px', height: 22 }}
                                        onClick={() => handlePreviewDocument(fakturDoc)}
                                      >
                                        Preview
                                      </Button>
                                      <Button
                                        size="small"
                                        type="link"
                                        icon={<DownloadOutlined />}
                                        loading={actionDocId === fakturDoc.id}
                                        style={{ fontSize: 11, padding: '0 4px', height: 22 }}
                                        onClick={() => handleDownloadDocument(fakturDoc)}
                                      >
                                        Unduh
                                      </Button>
                                    </Space>
                                  )}
                                </div>
                              </Col>
                            </Row>
                          </div>
                        </Col>

                        {/* Bukti Potong PPh Box */}
                        <Col xs={24} md={12}>
                          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 6, border: '1px solid #e2e8f0', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 12, color: '#166534' }}>
                                <DollarCircleOutlined style={{ marginRight: 6 }} />
                                Bukti Potong ({pphTypeVal})
                              </span>
                              <Tag color="green" style={{ fontSize: 10, margin: 0, fontWeight: 700 }}>
                                {pphRecord?.withholdingStatus || 'TERCATAT'}
                              </Tag>
                            </div>
                            <Row gutter={[8, 8]}>
                              <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>NOMOR BUKTI POTONG:</Text>
                                  {isPphApp && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>}
                                  {isPphApp && !isBpNumValid && (
                                    <Tag color="error" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                                      Wajib
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: (isPphApp && !isBpNumValid) ? '#dc2626' : '#0f172a' }}>
                                  {bpNumber}
                                </div>
                              </Col>
                              <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>TANGGAL BUKTI POTONG:</Text>
                                  {isPphApp && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>*</span>}
                                  {isPphApp && !isBpDateValid && (
                                    <Tag color="error" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                                      Wajib
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontSize: 11.5, color: (isPphApp && !isBpDateValid) ? '#dc2626' : '#334155', fontWeight: 600 }}>
                                  {bpDateDisplay}
                                </div>
                              </Col>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 10 }}>TARIF PEMOTONGAN:</Text>
                                <div style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>
                                  {pphRateDisplay}
                                </div>
                              </Col>
                              <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 10 }}>DASAR PENGENAAN:</Text>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#1d4ed8' }}>
                                  {formatRp(pphBaseVal)}
                                </div>
                              </Col>
                              <Col span={24}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>NOMINAL PPH TERPOTONG:</Text>
                                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#dc2626' }}>
                                    {formatRp(pphAmountVal)}
                                  </div>
                                </div>
                              </Col>
                              <Col span={24}>
                                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                    <FilePdfOutlined style={{ color: '#dc2626' }} />
                                    {buktiDoc ? (
                                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                        {buktiDoc.fileName}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ada berkas PDF Bukti Potong</span>
                                    )}
                                  </span>
                                  {buktiDoc && (
                                    <Space size={4}>
                                      <Button
                                        size="small"
                                        type="link"
                                        icon={<EyeOutlined />}
                                        loading={actionDocId === buktiDoc.id}
                                        style={{ fontSize: 11, padding: '0 4px', height: 22 }}
                                        onClick={() => handlePreviewDocument(buktiDoc)}
                                      >
                                        Preview
                                      </Button>
                                      <Button
                                        size="small"
                                        type="link"
                                        icon={<DownloadOutlined />}
                                        loading={actionDocId === buktiDoc.id}
                                        style={{ fontSize: 11, padding: '0 4px', height: 22 }}
                                        onClick={() => handleDownloadDocument(buktiDoc)}
                                      >
                                        Unduh
                                      </Button>
                                    </Space>
                                  )}
                                </div>
                              </Col>
                            </Row>
                          </div>
                        </Col>
                      </Row>
                    </>
                  );
                })()}

                  {/* Settlement Parity Strip */}
                  <div
                    style={{
                      background: '#f0fdf4',
                      padding: '12px 14px',
                      borderRadius: 6,
                      border: '1px solid #86efac',
                    }}
                  >
                    {(() => {
                      const detailObj = taxData?.taxDetail || (taxData as any)?.invoiceTaxDetail || (activeInvoice as any)?.invoiceTaxDetail;
                      const ppnAmt = Number(detailObj?.ppnAmount || taxData?.ppnRecords?.[0]?.ppnAmount || 0);
                      const pphAmt = Number(detailObj?.pphWithholdingAmount || detailObj?.pphAmount || taxData?.pphRecords?.[0]?.withheldAmount || 0);
                      const effectiveGrossLiability = detailObj?.grossCommercialLiability != null
                        ? Number(detailObj.grossCommercialLiability)
                        : (totalAmount + ppnAmt);
                      const netVendorCashPayable = detailObj?.netVendorCashPayable != null
                        ? Number(detailObj.netVendorCashPayable)
                        : Math.max(0, effectiveGrossLiability - pphAmt);

                      return (
                        <>
                          <Row gutter={[16, 8]} align="middle">
                            <Col xs={24} sm={8}>
                              <Text type="secondary" style={{ fontSize: 10.5 }}>1. BRUTO KOMERSIAL (L_comm):</Text>
                              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', fontFamily: 'monospace' }}>
                                {formatRp(effectiveGrossLiability)}
                              </div>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Text type="secondary" style={{ fontSize: 10.5 }}>2. POTONGAN PPH (W_tax):</Text>
                              <div style={{ fontWeight: 800, fontSize: 14, color: '#dc2626', fontFamily: 'monospace' }}>
                                - {formatRp(pphAmt)}
                              </div>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Text type="secondary" style={{ fontSize: 10.5 }}>3. ESTIMASI KAS BERSIH VENDOR (D_cash):</Text>
                              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#059669', fontFamily: 'monospace' }}>
                                {formatRp(netVendorCashPayable)}
                              </div>
                            </Col>
                          </Row>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #bbf7d0' }}>
                            Formula: D_cash = L_comm - W_tax (DPP + PPN - PPh).
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                  <Alert
                    type="info"
                    showIcon
                    message="Informasi Perpajakan Belum Dilengkapi"
                    description="Faktur Pajak dan Bukti Potong bersifat opsional dan tidak menghambat matching maupun verifikasi komersial. Anda dapat melengkapi informasi kapan saja menggunakan tombol di atas."
                    style={{ borderRadius: 6, textAlign: 'left' }}
                  />
                </div>
              )}
            </div>
          </div>

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

              {/* Desktop Table View */}
              <div className={styles.desktopTableView} data-testid="desktop-payment-history-table">
                <Table
                  size="small"
                  rowKey={(p: any) => p.id || p.paymentNumber}
                  dataSource={activeInvoice.payments.filter((p: any) => !p.deletedAt)}
                  pagination={false}
                  scroll={{ x: 500, y: 160 }}
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

              {/* Mobile Card View */}
              <div className={styles.mobileCardView} data-testid="mobile-payment-history-cards">
                {activeInvoice.payments.filter((p: any) => !p.deletedAt).map((p: any, idx: number) => (
                  <div key={p.id || p.paymentNumber || idx} className={styles.paymentCard} data-testid={`payment-card-${idx}`}>
                    <div className={styles.paymentHeader}>
                      <span className={styles.paymentNumber}>{p.paymentNumber || '—'}</span>
                      <span className={styles.paymentDate}>{p.paymentDate ? dayjs(p.paymentDate).format('DD MMM YYYY') : '—'}</span>
                    </div>
                    <div className={styles.paymentRow}>
                      <span style={{ color: '#64748b' }}>Nominal Pembayaran:</span>
                      <span className={styles.statValueEmerald}>{formatRp(p.amount)}</span>
                    </div>
                    {p.createdAt && (
                      <div className={styles.paymentRow}>
                        <span style={{ color: '#64748b', fontSize: 11 }}>Diproses:</span>
                        <span style={{ color: '#334155', fontSize: 11 }}>{dayjs(p.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ResponsiveFinanceModal>

      {/* VERIFY INVOICE SUB-MODAL */}
      <ResponsiveFinanceModal
        open={isVerifyModalOpen}
        onCancel={() => !submittingAction && setIsVerifyModalOpen(false)}
        title={isServicePo ? `Verifikasi Invoice Jasa — ${invoiceNumber}` : `Verifikasi Faktur Invoice — ${invoiceNumber}`}
        subtitle="Validasi otoritatif Finance sebelum penerbitan status VERIFIED."
        domain="APPROVAL"
        size="compact"
        hideSsotBadge
        headerIconTheme="green"
        headerIcon={<CheckCircleOutlined style={{ color: '#059669', fontSize: 20 }} />}
        primaryActionText={isServicePo ? 'Konfirmasi Rekonsiliasi Jasa' : 'Konfirmasi & Setujui Verifikasi'}
        onPrimaryAction={handleVerifySubmit}
        isSubmitting={submittingAction}
        isSubmitDisabled={
          (!isServicePo && isProgressInvoice && (!selectedVerifyGrId || poGoodsReceipts.length === 0)) ||
          (!isServicePo && isRetentionInvoice && !evidenceRef.trim())
        }
        cancelText="Batal"
        destroyOnClose
      >
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Alert
            type="info"
            showIcon
            message={isServicePo ? 'Validasi Rekonsiliasi Jasa (Backend SSOT)' : 'Validasi Finance Authoritative (Backend SSOT)'}
            description={
              isServicePo
                ? 'Invoice jasa diverifikasi terhadap Service Claim yang telah disetujui (APPROVED_FOR_INVOICE). Tidak memerlukan Goods Receipt (GR).'
                : isProgressInvoice
                ? 'Invoice termin Progress wajib divalidasi terhadap Goods Receipt (GR) fisik yang tercatat di database.'
                : 'Tindakan ini akan mengunci status invoice menjadi VERIFIED di database. Pastikan seluruh dokumen pendukung fisik/elektronik telah sesuai.'
            }
            style={{ borderRadius: 6 }}
          />

          {isServicePo ? (
            <div
              style={{
                background: '#f0fdf4',
                padding: '12px 14px',
                borderRadius: 6,
                border: '1px solid #bbf7d0',
                fontSize: 11.5,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: '#166534', marginBottom: 6 }}>
                Dokumen Bukti Pelaksanaan: Service Claim Disetujui
              </div>
              <Row gutter={[8, 6]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: 10 }}>NOMOR KLAIM JASA:</Text>
                  <div style={{ fontWeight: 700, color: '#166534', fontFamily: 'monospace' }}>
                    {(activeInvoice as any).serviceClaim?.claimNumber || `Claim #${(activeInvoice as any).serviceClaimId || '—'}`}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: 10 }}>STATUS KLAIM:</Text>
                  <div>
                    <Tag color="green" style={{ fontWeight: 700, margin: 0 }}>
                      {(activeInvoice as any).serviceClaim?.status || 'APPROVED_FOR_INVOICE'}
                    </Tag>
                  </div>
                </Col>
                <Col xs={24} sm={12} style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 10 }}>NILAI KLAIM DISETUJUI:</Text>
                  <div style={{ fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>
                    Rp {Number((activeInvoice as any).serviceClaim?.approvedClaimAmount || activeInvoice.totalAmount || 0).toLocaleString('id-ID')}
                  </div>
                </Col>
                {(activeInvoice as any).serviceClaim?.serviceOrder?.soNumber && (
                  <Col xs={24} sm={12} style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 10 }}>NOMOR SPK/WO:</Text>
                    <div style={{ fontWeight: 600, color: '#334155' }}>
                      {(activeInvoice as any).serviceClaim.serviceOrder.soNumber}
                    </div>
                  </Col>
                )}
              </Row>
            </div>
          ) : isProgressInvoice ? (
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
                        <Col xs={24} sm={12}>
                          <Text type="secondary" style={{ fontSize: 10 }}>NOMOR GR:</Text>
                          <div style={{ fontWeight: 700, color: '#166534', fontFamily: 'monospace' }}>
                            {selectedVerifyGr.grNumber} (ID #{selectedVerifyGr.id})
                          </div>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Text type="secondary" style={{ fontSize: 10 }}>NILAI FISIK DITERIMA:</Text>
                          <div style={{ fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>
                            Rp {Number(selectedVerifyGr.totalReceivedAmount || 0).toLocaleString('id-ID')}
                          </div>
                        </Col>
                        <Col xs={24} sm={24} style={{ marginTop: 4 }}>
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
      </ResponsiveFinanceModal>

      {/* REJECT INVOICE SUB-MODAL */}
      <ResponsiveFinanceModal
        open={isRejectModalOpen}
        onCancel={() => !submittingAction && setIsRejectModalOpen(false)}
        title={`Tolak Verifikasi Invoice — ${invoiceNumber}`}
        subtitle="Penolakan akan mengubah status invoice menjadi REJECTED dan mengembalikan faktur ke vendor."
        domain="FORM"
        size="compact"
        hideSsotBadge
        headerIconTheme="red"
        headerIcon={<CloseCircleOutlined style={{ color: '#dc2626', fontSize: 20 }} />}
        primaryActionText="Tolak Invoice"
        onPrimaryAction={handleRejectSubmit}
        isSubmitting={submittingAction}
        isPrimaryDanger
        cancelText="Batal"
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
      </ResponsiveFinanceModal>

      {/* TAX ADMINISTRATION SUB-MODAL */}
      <ResponsiveFinanceModal
        open={isTaxModalOpen}
        onCancel={() => !submittingTax && setIsTaxModalOpen(false)}
        title={`Administrasi Perpajakan — Invoice ${invoiceNumber}`}
        subtitle="Pencatatan nomor Faktur Pajak, Bukti Potong, dan berkas PDF pendukung"
        domain="INVOICE"
        size="compact"
        hideSsotBadge
        headerIconTheme="blue"
        headerIcon={<AuditOutlined style={{ color: '#2563eb', fontSize: 20 }} />}
        primaryActionText="Simpan Data Pajak"
        onPrimaryAction={() => taxForm.submit()}
        isSubmitting={submittingTax}
        cancelText="Batal"
        destroyOnClose
      >
        <Form
          form={taxForm}
          layout="vertical"
          onFinish={handleTaxSubmit}
          style={{ padding: '8px 0' }}
        >
          {/* Section A PPN */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e3a8a', marginBottom: 8 }}>
              Bagian A — Faktur Pajak (PPN Masukan)
            </div>
            <Row gutter={12}>
              <Col xs={24} sm={14}>
                <Form.Item
                  label={<span>Nomor Faktur Pajak (NSFP) <span style={{ color: '#dc2626' }}>*</span></span>}
                  name="fakturPajakNumber"
                >
                  <Input placeholder="010.000-26.12345678" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item
                  label={<span>Tanggal Faktur Pajak <span style={{ color: '#dc2626' }}>*</span></span>}
                  name="fakturPajakDate"
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={14}>
                <Form.Item label="DPP PPN (Rp)" name="dppAmount">
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="0"
                    formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(val) => (val ? Number(val.replace(/\./g, '')) : 0)}
                    onChange={handleTaxDppChange}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item label="Tarif PPN (%)" name="ppnRate">
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="Contoh: 11"
                    min={0}
                    max={100}
                    step={0.05}
                    onChange={handleTaxPpnRateChange}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={24}>
                <Form.Item
                  label={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>Nominal PPN (Rp)</span>
                      <Space size={4}>
                        {isTaxPpnOverridden ? (
                          <>
                            <Tag color="orange" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                              Override Manual
                            </Tag>
                            <Button
                              type="link"
                              size="small"
                              onClick={handleResetTaxPpnAuto}
                              style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            >
                              Hitung Ulang
                            </Button>
                          </>
                        ) : (taxPpnRateWatch !== undefined && taxPpnRateWatch !== null && taxPpnRateWatch !== '' && taxDppWatch !== undefined && taxDppWatch !== null && taxDppWatch !== '') ? (
                          <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                            Dihitung Otomatis
                          </Tag>
                        ) : null}
                      </Space>
                    </div>
                  }
                  name="ppnAmount"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="0"
                    formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(val) => (val ? Number(val.replace(/\./g, '')) : 0)}
                    onChange={handleTaxPpnAmountChange}
                  />
                </Form.Item>
              </Col>
            </Row>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Unggah Berkas Faktur Pajak (PDF):
              </div>
              {invoiceDocuments.find((d: any) => d.category === 'FAKTUR_PAJAK') && !fakturFile && (
                <div style={{ fontSize: 11, color: '#1e3a8a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Berkas tersimpan: <strong>{invoiceDocuments.find((d: any) => d.category === 'FAKTUR_PAJAK').fileName}</strong></span>
                  <Button
                    size="small"
                    type="link"
                    loading={actionDocId === invoiceDocuments.find((d: any) => d.category === 'FAKTUR_PAJAK')?.id}
                    style={{ fontSize: 11, padding: 0, height: 'auto' }}
                    onClick={() => {
                      const d = invoiceDocuments.find((doc: any) => doc.category === 'FAKTUR_PAJAK');
                      handlePreviewDocument(d);
                    }}
                  >
                    (Lihat PDF)
                  </Button>
                </div>
              )}
              {!fakturFile ? (
                <Upload
                  beforeUpload={(file) => {
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                      message.error('Dokumen Faktur Pajak harus berformat PDF.');
                      return false;
                    }
                    setFakturFile(file);
                    return false;
                  }}
                  showUploadList={false}
                  accept="application/pdf"
                >
                  <Button icon={<UploadOutlined />} size="small">
                    {invoiceDocuments.find((d: any) => d.category === 'FAKTUR_PAJAK') ? 'Ganti PDF Faktur Pajak' : 'Pilih PDF Faktur Pajak'}
                  </Button>
                </Upload>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#e2e8f0', borderRadius: 4 }}>
                  <FilePdfOutlined style={{ color: '#dc2626' }} />
                  <span style={{ fontSize: 11 }}>{fakturFile.name} (akan diunggah)</span>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setFakturFile(null)} />
                </div>
              )}
            </div>
          </div>

          {/* Section B PPh */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#166534', marginBottom: 8 }}>
              Bagian B — Bukti Potong (PPh)
            </div>
            <Row gutter={12}>
              <Col xs={24} sm={16}>
                <Form.Item label="Jenis PPh" name="pphType">
                  <Select
                    placeholder="Pilih jenis PPh (Opsional)..."
                    options={PPH_TYPE_OPTIONS}
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Tarif PPh (%)" name="pphRate">
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="Contoh: 2"
                    min={0}
                    max={100}
                    step={0.05}
                    onChange={handleTaxPphRateChange}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Dasar Pengenaan PPh (Rp)" name="taxableBase">
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="0"
                    formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(val) => (val ? Number(val.replace(/\./g, '')) : 0)}
                    onChange={handleTaxPphBaseChange}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>Nominal PPh Terpotong (Rp)</span>
                      <Space size={4}>
                        {isTaxPphOverridden ? (
                          <>
                            <Tag color="orange" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                              Override Manual
                            </Tag>
                            <Button
                              type="link"
                              size="small"
                              onClick={handleResetTaxPphAuto}
                              style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            >
                              Hitung Ulang
                            </Button>
                          </>
                        ) : (taxPphRateWatch !== undefined && taxPphRateWatch !== null && taxPphRateWatch !== '' && taxPphBaseWatch !== undefined && taxPphBaseWatch !== null && taxPphBaseWatch !== '') ? (
                          <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                            Dihitung Otomatis
                          </Tag>
                        ) : null}
                      </Space>
                    </div>
                  }
                  name="withheldAmount"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="0"
                    formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(val) => (val ? Number(val.replace(/\./g, '')) : 0)}
                    onChange={handleTaxWithheldAmountChange}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={14}>
                <Form.Item
                  label={<span>Nomor Bukti Potong <span style={{ color: '#dc2626' }}>*</span></span>}
                  name="buktiPotongNumber"
                >
                  <Input placeholder="Nomor BPU..." allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item
                  label={<span>Tanggal Bukti Potong <span style={{ color: '#dc2626' }}>*</span></span>}
                  name="buktiPotongDate"
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Unggah Berkas Bukti Potong (PDF):
              </div>
              {invoiceDocuments.find((d: any) => d.category === 'BUKTI_POTONG') && !buktiFile && (
                <div style={{ fontSize: 11, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Berkas tersimpan: <strong>{invoiceDocuments.find((d: any) => d.category === 'BUKTI_POTONG').fileName}</strong></span>
                  <Button
                    size="small"
                    type="link"
                    loading={actionDocId === invoiceDocuments.find((d: any) => d.category === 'BUKTI_POTONG')?.id}
                    style={{ fontSize: 11, padding: 0, height: 'auto' }}
                    onClick={() => {
                      const d = invoiceDocuments.find((doc: any) => doc.category === 'BUKTI_POTONG');
                      handlePreviewDocument(d);
                    }}
                  >
                    (Lihat PDF)
                  </Button>
                </div>
              )}
              {!buktiFile ? (
                <Upload
                  beforeUpload={(file) => {
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                      message.error('Dokumen Bukti Potong harus berformat PDF.');
                      return false;
                    }
                    setBuktiFile(file);
                    return false;
                  }}
                  showUploadList={false}
                  accept="application/pdf"
                >
                  <Button icon={<UploadOutlined />} size="small">
                    {invoiceDocuments.find((d: any) => d.category === 'BUKTI_POTONG') ? 'Ganti PDF Bukti Potong' : 'Pilih PDF Bukti Potong'}
                  </Button>
                </Upload>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#e2e8f0', borderRadius: 4 }}>
                  <FilePdfOutlined style={{ color: '#dc2626' }} />
                  <span style={{ fontSize: 11 }}>{buktiFile.name} (akan diunggah)</span>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setBuktiFile(null)} />
                </div>
              )}
            </div>
          </div>
        </Form>
      </ResponsiveFinanceModal>
    </>
  );
};

export default InvoiceDetailModal;
