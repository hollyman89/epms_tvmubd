"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  DatePicker,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Alert,
  message,
  Card,
  Select,
  Spin,
} from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
  CalendarOutlined,
  ShopOutlined,
  AuditOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { PurchaseOrder, PoPaymentTermRecord, ProcurementService } from '@/services/procurement.service';
import { InvoiceDto, FinanceService, CreateInvoicePayload } from '@/services/finance.service';

const { Text } = Typography;

// 1. MODAL PROPS

export interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  po: PurchaseOrder | any | null;
  onInvoiceCreated?: (inv: InvoiceDto) => void;
  onViewExistingInvoice?: (inv: InvoiceDto | any) => void;
  currentUserName?: string;
  canCreateInvoice?: boolean;
  initialPaymentTermId?: number;
  initialServiceClaimId?: number;
}

// 2. CANONICAL CREATE INVOICE MODAL COMPONENT

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  open,
  onClose,
  po,
  onInvoiceCreated,
  onViewExistingInvoice,
  currentUserName = 'Finance Team',
  canCreateInvoice = true,
  initialPaymentTermId,
  initialServiceClaimId,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>(undefined);

  // Canonical Goods Receipt States for Progress Billing (Phase GR-6)
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [loadingGrs, setLoadingGrs] = useState<boolean>(false);
  const [selectedGrId, setSelectedGrId] = useState<number | undefined>(undefined);

  // Canonical Service Claim States for SERVICE PO
  const [approvedServiceClaims, setApprovedServiceClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState<boolean>(false);
  const [selectedServiceClaimId, setSelectedServiceClaimId] = useState<number | undefined>(undefined);

  // Authoritative Existing Invoices for PO (Phase GR-8C)
  const [existingInvoices, setExistingInvoices] = useState<InvoiceDto[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);

  // Derived PO Metadata
  const poId = Number(po?.id || po?.poId || 0);
  const poNumber = po?.poNumber || '';
  const vendorName = po?.vendor?.name || po?.vendorName || 'Vendor';
  const vendorCode = po?.vendor?.code || po?.vendorCode || '';
  const projectName = po?.purchaseRequest?.project?.name || po?.projectName || 'Proyek Tanpa Nama';
  const projectId = po?.purchaseRequest?.projectId || po?.projectId;
  const totalPoAmount = Number(po?.totalAmount || 0);

  // Authoritative Payment Terms from PO (Backend SSOT)
  const paymentTerms: PoPaymentTermRecord[] = useMemo(() => {
    if (po?.paymentTerms && Array.isArray(po.paymentTerms)) {
      return po.paymentTerms;
    }
    return [];
  }, [po]);

  // Active Selected Term
  const activeTerm = useMemo(() => {
    if (!selectedTermId || paymentTerms.length === 0) return null;
    return paymentTerms.find((t) => Number(t.id) === Number(selectedTermId)) || null;
  }, [selectedTermId, paymentTerms]);

  // Term Classifications
  const isProgressTerm = useMemo(() => {
    if (!activeTerm) return false;
    const tType = (activeTerm.termType || '').toUpperCase();
    const tName = (activeTerm.termName || '').toUpperCase();
    return tType === 'PROGRESS' || tName.includes('PROGRESS');
  }, [activeTerm]);

  const isDpTerm = useMemo(() => {
    if (!activeTerm) return false;
    const tType = (activeTerm.termType || '').toUpperCase();
    const tName = (activeTerm.termName || '').toUpperCase();
    return tType === 'DP' || tName.includes('DP') || tName.includes('DOWN PAYMENT') || tName.includes('UANG MUKA');
  }, [activeTerm]);

  const isRetentionTerm = useMemo(() => {
    if (!activeTerm) return false;
    const tType = (activeTerm.termType || '').toUpperCase();
    const tName = (activeTerm.termName || '').toUpperCase();
    return tType === 'RETENTION' || tName.includes('RETEN');
  }, [activeTerm]);

  // Invoice Amount: Term amount (if term selected) or Total PO amount (Branch B)
  const invoiceTotalAmount = useMemo(() => {
    if (activeTerm) {
      return Number(activeTerm.amount || 0);
    }
    return totalPoAmount;
  }, [activeTerm, totalPoAmount]);

  // Load Canonical Goods Receipts and Existing Invoices from backend when modal opens on a PO
  useEffect(() => {
    if (open && poId) {
      setLoadingGrs(true);
      setLoadingInvoices(true);
      Promise.all([
        ProcurementService.getGoodsReceipts(),
        FinanceService.getInvoices(),
      ])
        .then(([allGrs, allInvoices]) => {
          const validGrs = (allGrs || []).filter((gr: any) => {
            const matchesPo = Number(gr.poId || gr.purchaseOrderId) === Number(poId);
            const notDeleted = !gr.deletedAt;
            const hasItems = Array.isArray(gr.items) && gr.items.length > 0;
            const hasPositiveQty = hasItems && gr.items.some((it: any) => Number(it.receivedQuantity || 0) > 0);
            return matchesPo && notDeleted && hasItems && hasPositiveQty;
          });
          setGoodsReceipts(validGrs);
          // If exactly 1 valid GR exists for the PO, auto-select it
          if (validGrs.length === 1) {
            setSelectedGrId(validGrs[0].id);
          } else {
            setSelectedGrId(undefined);
          }

          const poInvoices = (allInvoices || []).filter(
            (inv) => Number(inv.poId) === Number(poId) && !(inv as any).deletedAt && inv.status !== 'CANCELLED'
          );
          setExistingInvoices(poInvoices);
        })
        .catch((err) => {
          console.error('Failed to load data for CreateInvoiceModal:', err);
          setGoodsReceipts([]);
          setExistingInvoices([]);
        })
        .finally(() => {
          setLoadingGrs(false);
          setLoadingInvoices(false);
        });

      if (po?.orderType === 'SERVICE') {
        setLoadingClaims(true);
        ProcurementService.getServiceClaims({ poId: Number(poId), status: 'APPROVED_FOR_INVOICE' })
          .then((claims) => {
            const validClaims = (claims || []).filter(c => c.status === 'APPROVED_FOR_INVOICE');
            setApprovedServiceClaims(validClaims);
            if (initialServiceClaimId && validClaims.some((c) => Number(c.id) === Number(initialServiceClaimId))) {
              setSelectedServiceClaimId(Number(initialServiceClaimId));
            } else if (validClaims.length === 1) {
              setSelectedServiceClaimId(validClaims[0].id);
            } else {
              setSelectedServiceClaimId(undefined);
            }
          })
          .catch((err) => {
            console.error('Failed to load service claims for CreateInvoiceModal:', err);
            setApprovedServiceClaims([]);
          })
          .finally(() => setLoadingClaims(false));
      } else {
        setApprovedServiceClaims([]);
        setSelectedServiceClaimId(undefined);
      }
    } else {
      setGoodsReceipts([]);
      setExistingInvoices([]);
      setSelectedGrId(undefined);
      setApprovedServiceClaims([]);
      setSelectedServiceClaimId(undefined);
    }
  }, [open, poId, po, initialServiceClaimId]);

  // Selected Canonical Goods Receipt
  const selectedGr = useMemo(() => {
    if (!selectedGrId) return null;
    return goodsReceipts.find((g) => Number(g.id) === Number(selectedGrId)) || null;
  }, [selectedGrId, goodsReceipts]);

  // PO Items Breakdown (Full PO) with authoritative receivedQuantity
  const poItems = useMemo(() => {
    if (!po?.items || !Array.isArray(po.items)) return [];
    return po.items.map((it: any, idx: number) => {
      const qty = Number(it.quantity || 1);
      const receivedQty = Number(it.receivedQuantity || it.received_quantity || 0);
      const price = Number(it.unitPrice || 0);
      const subtotal = Number(it.totalPrice || qty * price);
      return {
        key: String(it.id || idx),
        id: Number(it.id || idx + 1),
        itemName: it.itemName || `Item Pengadaan #${idx + 1}`,
        categoryName: it.categoryName || 'Material',
        quantity: qty,
        receivedQuantity: receivedQty,
        uom: it.uom || 'Unit',
        unitPrice: price,
        totalPrice: subtotal,
        wbsNodeId: it.wbsNodeId,
      };
    });
  }, [po]);

  // Justified Items Breakdown for PROGRESS Billing (Only items/quantities justifiable by GR)
  const progressInvoiceItems = useMemo(() => {
    if (!selectedGr || !Array.isArray(selectedGr.items)) return [];
    return selectedGr.items
      .filter((grItem: any) => Number(grItem.receivedQuantity || 0) > 0)
      .map((grItem: any, idx: number) => {
        const poItem = poItems.find((p) => Number(p.id) === Number(grItem.poItemId)) || (grItem.purchaseOrderItem ? {
          id: Number(grItem.purchaseOrderItem.id),
          itemName: grItem.purchaseOrderItem.itemName,
          categoryName: grItem.purchaseOrderItem.categoryName || 'Material',
          quantity: Number(grItem.purchaseOrderItem.quantity || 0),
          uom: grItem.purchaseOrderItem.uom || 'Unit',
          unitPrice: Number(grItem.purchaseOrderItem.unitPrice || 0),
          wbsNodeId: grItem.purchaseOrderItem.wbsNodeId,
        } : null);

        const receivedQty = Number(grItem.receivedQuantity || 0);
        const orderedQty = poItem ? Number(poItem.quantity || 0) : receivedQty;
        const unitPrice = poItem ? Number(poItem.unitPrice || 0) : 0;
        const outstandingQty = Math.max(0, orderedQty - receivedQty);
        const subtotal = receivedQty * unitPrice;

        return {
          key: String(grItem.id || idx),
          id: Number(grItem.id || idx + 1),
          poItemId: Number(grItem.poItemId),
          itemName: poItem?.itemName || `Item #${grItem.poItemId}`,
          categoryName: poItem?.categoryName || 'Material',
          orderedQty,
          receivedQty,
          outstandingQty,
          quantity: receivedQty, // Capped strictly at physical receipt
          uom: poItem?.uom || 'Unit',
          unitPrice,
          totalPrice: subtotal,
          wbsNodeId: poItem?.wbsNodeId,
          remarks: grItem.remarks,
        };
      });
  }, [selectedGr, poItems]);

  // Total Physical Delivery Value of Selected GR
  const totalPhysicalDeliveryValue = useMemo(() => {
    if (selectedGr?.totalReceivedAmount !== undefined && !isNaN(Number(selectedGr.totalReceivedAmount))) {
      return Number(selectedGr.totalReceivedAmount);
    }
    return progressInvoiceItems.reduce((acc, it) => acc + it.totalPrice, 0);
  }, [selectedGr, progressInvoiceItems]);

  // Active PO Invoices (from API or props)
  const activePoInvoices = useMemo(() => {
    if (existingInvoices.length > 0) return existingInvoices;
    if (po?.invoices && Array.isArray(po.invoices)) {
      return po.invoices.filter((inv: any) => !inv.deletedAt && inv.status !== 'CANCELLED');
    }
    return [];
  }, [existingInvoices, po]);

  // Total Physical Delivery Value across all active Goods Receipts of this PO
  const totalPhysicalDeliveryValueAcrossPo = useMemo(() => {
    let total = 0;
    for (const gr of goodsReceipts) {
      if (gr.deletedAt) continue;
      if (gr.items && Array.isArray(gr.items)) {
        for (const gi of gr.items) {
          const poi = poItems.find((p) => Number(p.id) === Number(gi.poItemId));
          if (poi) {
            total += Number(gi.receivedQuantity || 0) * Number(poi.unitPrice || 0);
          }
        }
      } else if (gr.totalReceivedAmount !== undefined && !isNaN(Number(gr.totalReceivedAmount))) {
        total += Number(gr.totalReceivedAmount);
      }
    }
    if (total === 0 && selectedGr?.totalReceivedAmount) {
      total = Number(selectedGr.totalReceivedAmount);
    }
    return Math.round(total * 100) / 100;
  }, [goodsReceipts, poItems, selectedGr]);

  // Previous Progress Invoices Billed on this PO (excluding current term, DP, and cancelled)
  const previousProgressBilled = useMemo(() => {
    let sum = 0;
    for (const inv of activePoInvoices) {
      const term = paymentTerms.find((t) => Number(t.id) === Number(inv.paymentTermId)) || inv.paymentTerm;
      const tType = (term?.termType || '').toUpperCase();
      const tName = (term?.termName || '').toUpperCase();
      const isProgress = tType === 'PROGRESS' || tName.includes('PROGRESS');
      if (isProgress) {
        sum += Number(inv.totalAmount || 0);
      }
    }
    return Math.round(sum * 100) / 100;
  }, [activePoInvoices, paymentTerms]);

  // Remaining Progress Capacity
  const remainingProgressCapacity = useMemo(() => {
    return Math.max(0, Math.round((totalPhysicalDeliveryValueAcrossPo - previousProgressBilled) * 100) / 100);
  }, [totalPhysicalDeliveryValueAcrossPo, previousProgressBilled]);

  const isFinanciallySupported = useMemo(() => {
    if (!isProgressTerm) return true;
    return Math.round(remainingProgressCapacity * 100) / 100 >= Math.round(invoiceTotalAmount * 100) / 100 - 0.01;
  }, [isProgressTerm, remainingProgressCapacity, invoiceTotalAmount]);

  const capacityDeficit = useMemo(() => {
    if (!isProgressTerm || isFinanciallySupported) return 0;
    return Math.max(0, Math.round((invoiceTotalAmount - remainingProgressCapacity) * 100) / 100);
  }, [isProgressTerm, isFinanciallySupported, invoiceTotalAmount, remainingProgressCapacity]);

  // Gate Evaluator Functions (Phase GR-8C Frontend SSOT Alignment)
  const evaluateSequence = (term: PoPaymentTermRecord | null) => {
    if (!term || Number(term.sequence) <= 1) return { passed: true, reason: '' };
    const currentSeq = Number(term.sequence);

    for (const prevTerm of paymentTerms) {
      if ((prevTerm as any).deletedAt || Number(prevTerm.id) === Number(term.id)) continue;
      const prevSeq = Number(prevTerm.sequence);
      if (prevSeq < currentSeq) {
        const prevType = (prevTerm.termType || '').toUpperCase();
        const prevName = (prevTerm.termName || '').toUpperCase();
        const isPrevDp =
          prevType === 'DP' ||
          prevName.includes('DP') ||
          prevName.includes('DOWN PAYMENT') ||
          prevName.includes('UANG MUKA');

        const matchingInvoice = activePoInvoices.find((inv) => Number(inv.paymentTermId) === Number(prevTerm.id));
        const effectiveStatus =
          prevTerm.status ||
          matchingInvoice?.paymentStatus ||
          matchingInvoice?.status ||
          'PENDING';

        if (isPrevDp) {
          if (effectiveStatus !== 'PAID') {
            return {
              passed: false,
              reason: `Termin urutan ${currentSeq} (${term.termName}) belum dapat ditagihkan karena Uang Muka / DP (${prevTerm.termName}) belum berstatus PAID (status saat ini: ${effectiveStatus}).`,
            };
          }
        } else {
          const allowed = ['VERIFIED', 'PAID'];
          const isVerifiedOrPaid =
            allowed.includes(effectiveStatus) ||
            matchingInvoice?.matchStatus === 'VERIFIED' ||
            matchingInvoice?.paymentStatus === 'PAID';
          if (!isVerifiedOrPaid) {
            return {
              passed: false,
              reason: `Termin urutan ${currentSeq} (${term.termName}) belum dapat ditagihkan karena termin sebelumnya (${prevTerm.termName}) belum mencapai status VERIFIED atau PAID (status saat ini: ${effectiveStatus}).`,
            };
          }
        }
      }
    }
    return { passed: true, reason: '' };
  };

  const evaluateMilestone = (term: PoPaymentTermRecord | null) => {
    if (!term) return { passed: true, reason: '' };
    const tType = (term.termType || '').toUpperCase();
    const tName = (term.termName || '').toUpperCase();
    const isProgress = tType === 'PROGRESS' || tName.includes('PROGRESS');
    if (!isProgress) return { passed: true, reason: '' };
    if (po?.orderType === 'SERVICE') return { passed: true, reason: '' };

    const is100Percent =
      /100%|fisik\s*100%|lengkap/i.test(term.triggerCondition || '') ||
      Number(term.percentage) === 100;

    if (is100Percent) {
      const isPoCompleted = po?.status === 'COMPLETED';
      const unfulfilledItems = poItems.filter((it) => Number(it.receivedQuantity || 0) < Number(it.quantity || 0));
      const allItemsCompleted = isPoCompleted && poItems.length > 0 && unfulfilledItems.length === 0;

      if (!allItemsCompleted) {
        const itemDetails =
          unfulfilledItems.length > 0
            ? unfulfilledItems.map((i) => `${i.itemName}: ${i.receivedQuantity || 0}/${i.quantity}`).join(', ')
            : 'Kuantitas fisik barang belum lengkap 100%';
        return {
          passed: false,
          reason: `Kemajuan Fisik 100% belum tercapai (status PO: ${po?.status || 'ACTIVE'}). Item belum selesai: ${itemDetails}.`,
        };
      }
      return { passed: true, reason: '' };
    } else {
      const matchPercent = (term.triggerCondition || '').match(/(\d+(?:\.\d+)?)\s*%/);
      const targetPercent = matchPercent ? parseFloat(matchPercent[1]) : Number(term.percentage || 0);
      if (targetPercent > 0 && targetPercent < 100) {
        const physicalProgress = totalPoAmount > 0 ? (totalPhysicalDeliveryValueAcrossPo / totalPoAmount) * 100 : 0;
        if (Math.round(physicalProgress * 100) / 100 + 0.5 < targetPercent) {
          return {
            passed: false,
            reason: `Kemajuan fisik baru mencapai ${physicalProgress.toFixed(2)}% (target syarat termin: ${targetPercent}%).`,
          };
        }
      }
      return { passed: true, reason: '' };
    }
  };

  const evaluateRetention = (term: PoPaymentTermRecord | null) => {
    if (!term) return { passed: true, reason: '' };
    const tType = (term.termType || '').toUpperCase();
    const tName = (term.termName || '').toUpperCase();
    const isRetention = tType === 'RETENTION' || tName.includes('RETEN');
    if (!isRetention) return { passed: true, reason: '' };

    if (po?.status !== 'COMPLETED') {
      return {
        passed: false,
        reason: 'Termin retensi hanya dapat ditagihkan setelah Purchase Order berstatus COMPLETED.',
      };
    }
    return { passed: true, reason: '' };
  };

  const getTermEligibility = (term: PoPaymentTermRecord | null) => {
    if (!term) return { isEligible: true, seqPassed: true, msPassed: true, capPassed: true, retPassed: true, reasons: [], statusTag: '' };

    if (term.status && term.status !== 'PENDING') {
      return {
        isEligible: false,
        seqPassed: true,
        msPassed: true,
        capPassed: true,
        retPassed: true,
        reasons: [`Termin sudah berstatus ${term.status}`],
        statusTag: `[${term.status}]`,
      };
    }

    const seq = evaluateSequence(term);
    const ms = evaluateMilestone(term);
    const ret = evaluateRetention(term);

    let capPassed = true;
    let capReason = '';
    const tType = (term.termType || '').toUpperCase();
    const tName = (term.termName || '').toUpperCase();
    const isProgress = tType === 'PROGRESS' || tName.includes('PROGRESS');

    if (po?.orderType === 'SERVICE') {
      const isTermDp = (term.termType || '').toUpperCase() === 'DP' || (term.termName || '').toUpperCase().includes('DP');
      if (!isTermDp) {
        if (approvedServiceClaims.length === 0) {
          capPassed = false;
          capReason = 'Belum ada Klaim Jasa yang disetujui (APPROVED_FOR_INVOICE) untuk PO Jasa ini.';
        }
      }
    } else if (isProgress) {
      if (goodsReceipts.length === 0) {
        capPassed = false;
        capReason = 'Belum ada dokumen Goods Receipt (GR) aktif sebagai dasar fisik penagihan.';
      } else if (!isFinanciallySupported) {
        capPassed = false;
        capReason = `Kapasitas fisik defisit Rp ${capacityDeficit.toLocaleString('id-ID')}. Plafon fisik tersisa: Rp ${remainingProgressCapacity.toLocaleString('id-ID')}, nilai termin: Rp ${Number(term.amount || 0).toLocaleString('id-ID')}.`;
      }
    }

    const reasons: string[] = [];
    if (!seq.passed) reasons.push(seq.reason);
    if (!ms.passed) reasons.push(ms.reason);
    if (!capPassed) reasons.push(capReason);
    if (!ret.passed) reasons.push(ret.reason);

    const isEligible = reasons.length === 0;

    let statusTag = '[SIAP DITAGIHKAN]';
    if (!isEligible) {
      if (!seq.passed) statusTag = '[MENUNGGU URUTAN]';
      else if (!ms.passed) statusTag = '[BELUM MEMENUHI MILESTONE]';
      else if (!capPassed) statusTag = '[KAPASITAS DEFISIT]';
      else if (!ret.passed) statusTag = '[PO BELUM SELESAI]';
      else statusTag = '[BELUM MEMENUHI SYARAT]';
    }

    return {
      isEligible,
      seqPassed: seq.passed,
      msPassed: ms.passed,
      capPassed,
      retPassed: ret.passed,
      reasons,
      statusTag,
    };
  };

  const activeTermEligibility = useMemo(() => {
    return getTermEligibility(activeTerm);
  }, [activeTerm, paymentTerms, activePoInvoices, po, totalPoAmount, totalPhysicalDeliveryValueAcrossPo, isFinanciallySupported, capacityDeficit, remainingProgressCapacity, goodsReceipts, poItems]);

  // Initialize or reset form state on modal open
  useEffect(() => {
    if (open && po) {
      setSubmitError(null);
      if (paymentTerms.length > 0) {
        // Auto-select initialPaymentTermId if provided, else first PENDING term
        const matchedInitial = initialPaymentTermId
          ? paymentTerms.find((t) => Number(t.id) === Number(initialPaymentTermId))
          : null;
        const pendingTerm = paymentTerms.find((t) => t.status === 'PENDING' || !t.status);
        const initialTermId = matchedInitial ? matchedInitial.id : (pendingTerm ? pendingTerm.id : paymentTerms[0]?.id);
        setSelectedTermId(initialTermId);
        form.setFieldsValue({
          paymentTermId: initialTermId,
          invoiceDate: dayjs(),
          taxInvoiceNumber: '',
          notes: '',
        });
      } else {
        setSelectedTermId(undefined);
        form.setFieldsValue({
          paymentTermId: undefined,
          invoiceDate: dayjs(),
          taxInvoiceNumber: '',
          notes: '',
        });
      }
    }
  }, [open, po, paymentTerms, form, initialPaymentTermId]);

  // Submit Handler: Canonical Backend API Dispatch (POST /api/v1/finance/invoices)
  const handleSubmit = async (values: any) => {
    if (!po || !poId) {
      message.error('Data Purchase Order tidak ditemukan.');
      return;
    }

    // Frontend Safety Guard for PROGRESS / SERVICE terms
    if (po?.orderType === 'SERVICE' && !isDpTerm) {
      if (!selectedServiceClaimId) {
        message.error('Wajib memilih Klaim Jasa yang telah disetujui (APPROVED_FOR_INVOICE) sebagai dasar penagihan jasa.');
        return;
      }
    } else if (po?.orderType !== 'SERVICE' && isProgressTerm) {
      if (!selectedGrId || !selectedGr) {
        message.error('Wajib memilih Goods Receipt (GR) yang sah sebagai dasar fisik penagihan Progress.');
        return;
      }
      if (progressInvoiceItems.length === 0) {
        message.error('Goods Receipt yang dipilih tidak memiliki kuantitas barang yang diterima.');
        return;
      }
    }

    // Comprehensive Frontend Gate Validation (Milestone, Financial Capacity, Sequence, Retention)
    if (activeTerm && !activeTermEligibility.isEligible) {
      const primaryReason = activeTermEligibility.reasons[0] || 'Termin belum memenuhi syarat penagihan.';
      message.error(primaryReason);
      setSubmitError(primaryReason);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const invoiceDateVal: Dayjs = values.invoiceDate || dayjs();
      const termIdToSubmit = values.paymentTermId ? Number(values.paymentTermId) : undefined;

      // Items payload: For PROGRESS, strictly use justified GR items; for others, use poItems
      const itemsPayload = (po?.orderType !== 'SERVICE' && isProgressTerm)
        ? progressInvoiceItems.map((it) => ({
            poItemId: it.poItemId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
          }))
        : poItems.length > 0
        ? poItems.map((it) => ({
            poItemId: it.id,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
          }))
        : undefined;

      const payload: any = {
        purchaseOrderId: poId,
        paymentTermId: termIdToSubmit,
        invoiceDate: invoiceDateVal.toISOString(),
        items: itemsPayload,
      };

      if (po?.orderType === 'SERVICE' && !isDpTerm) {
        payload.serviceClaimId = Number(selectedServiceClaimId);
      } else if (po?.orderType !== 'SERVICE' && isProgressTerm && selectedGr) {
        payload.goodsReceiptId = Number(selectedGrId);
        payload.evidenceRef = selectedGr.grNumber;
      }

      const createdInvoice = await FinanceService.createInvoice(payload);

      message.success(
        `Invoice (${createdInvoice.invoiceNumber || 'Baru'}) berhasil diterbitkan ke Backend Finance.`
      );

      onInvoiceCreated?.(createdInvoice);
      onClose();
    } catch (err: any) {
      console.error('Failed to create invoice via backend:', err);
      const backendMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal menerbitkan Invoice ke server.';
      const formattedMsg = Array.isArray(backendMsg) ? backendMsg.join(', ') : String(backendMsg);
      setSubmitError(formattedMsg);
      message.error(formattedMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!po) return null;

  // Validation state for submission button
  const isProgressBlocked = po?.orderType === 'SERVICE'
    ? (isProgressTerm && !selectedServiceClaimId)
    : (isProgressTerm && (!selectedGrId || progressInvoiceItems.length === 0));
  const isTermIneligible = Boolean(activeTerm && !activeTermEligibility.isEligible);
  const isSubmitDisabled = !canCreateInvoice || isSubmitting || isProgressBlocked || isTermIneligible;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1140px, 96vw)"
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
              Otoritas Matching &amp; Status:{' '}
              <Tag color="blue" style={{ fontWeight: 700, margin: '0 4px' }}>
                BACKEND SSOT
              </Tag>
              — Evaluasi:{' '}
              <Tag color="default" style={{ fontWeight: 600, margin: '0 4px' }}>
                MATCHING ENGINE
              </Tag>
            </Text>
          </div>

          <Space size={8} wrap>
            {isTermIneligible && (
              <Text type="danger" style={{ fontSize: 11, fontWeight: 600 }}>
                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                {activeTermEligibility.statusTag.replace(/[\[\]]/g, '')}: {activeTermEligibility.reasons[0]}
              </Text>
            )}
            <Button onClick={onClose} style={{ borderRadius: 6 }} disabled={isSubmitting}>
              Batal
            </Button>
            {canCreateInvoice && (
              <Button
                type="primary"
                loading={isSubmitting}
                disabled={isSubmitDisabled}
                onClick={() => form.submit()}
                icon={<SendOutlined />}
                style={{
                  backgroundColor: isSubmitDisabled ? undefined : '#059669',
                  borderColor: isSubmitDisabled ? undefined : '#059669',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {activeTerm
                  ? `Terbitkan Invoice Termin #${activeTerm.sequence} (${activeTerm.percentage}%)`
                  : 'Terbitkan Invoice Tagihan (100% PO)'}
              </Button>
            )}
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
              Penerbitan Invoice Penagihan Vendor — PO {poNumber}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              Pembuatan faktur penagihan vendor berbasis Purchase Order dan evaluasi Backend Matching Engine
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Backend Validation / Submission Error Alert */}
        {submitError && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setSubmitError(null)}
            message={<span style={{ fontWeight: 700 }}>Validasi Server Backend Menolak Penerbitan Invoice</span>}
            description={<div style={{ fontSize: 12, marginTop: 4 }}>{submitError}</div>}
            style={{ borderRadius: 8 }}
          />
        )}

        {/* Milestone & Capacity Gate Ineligibility Warning Alert */}
        {activeTerm && !activeTermEligibility.isEligible && (
          <Alert
            type="warning"
            showIcon
            message={
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                Termin #{activeTerm.sequence} ({activeTerm.termName}) Belum Memenuhi Syarat Penagihan
              </div>
            }
            description={
              <div style={{ fontSize: 12, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!activeTermEligibility.seqPassed && (
                  <div>
                    <Tag color="volcano" style={{ fontWeight: 700 }}>URUTAN TERMIN</Tag>
                    <span>{activeTermEligibility.reasons.find(r => r.includes('urutan'))}</span>
                  </div>
                )}
                {!activeTermEligibility.msPassed && (
                  <div>
                    <Tag color="error" style={{ fontWeight: 700 }}>MILESTONE FISIK</Tag>
                    <span>{activeTermEligibility.reasons.find(r => r.includes('milestone') || r.includes('Kemajuan Fisik'))}</span>
                  </div>
                )}
                {!activeTermEligibility.capPassed && (
                  <div>
                    <Tag color="orange" style={{ fontWeight: 700 }}>KAPASITAS FISIK</Tag>
                    <span>{activeTermEligibility.reasons.find(r => r.includes('defisit') || r.includes('kapasitas') || r.includes('Plafon'))}</span>
                  </div>
                )}
                {!activeTermEligibility.retPassed && (
                  <div>
                    <Tag color="purple" style={{ fontWeight: 700 }}>SYARAT RETENSI</Tag>
                    <span>{activeTermEligibility.reasons.find(r => r.includes('retensi'))}</span>
                  </div>
                )}
              </div>
            }
            style={{ borderRadius: 8, border: '1px solid #fed7aa', background: '#fffaf5' }}
          />
        )}

        {/* PO & Vendor Context Strip */}
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
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PURCHASE ORDER:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {poNumber}
              </div>
              <Tag color="green" style={{ fontSize: 9.5, margin: 0, marginTop: 2, fontWeight: 700 }}>
                ● {po.status || 'ACTIVE'}
              </Tag>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PENYEDIA:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {vendorName}
              </div>
              {vendorCode && <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>}
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>KONFIGURASI TERMIN:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>
                {paymentTerms.length > 0
                  ? `${paymentTerms.length} Jadwal Termin Terdaftar`
                  : (typeof po.paymentTerms === 'string' ? po.paymentTerms : 'Full Delivery (100%)')}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                {paymentTerms.length > 0 ? 'Pilih termin di formulir bawah' : 'Penagihan sekaligus'}
              </div>
            </Col>
          </Row>
        </div>

        {/* Invoice Metadata Form (Form Input Termin, Tanggal, & Dokumen Pajak) */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            invoiceDate: dayjs(),
            taxInvoiceNumber: '',
            notes: '',
          }}
        >
          <Row gutter={16}>
            {paymentTerms.length > 0 ? (
              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      Pilih Termin Pembayaran PO <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                  }
                  name="paymentTermId"
                  rules={[{ required: true, message: 'Termin pembayaran wajib dipilih' }]}
                >
                  <Select
                    placeholder="Pilih Termin Pembayaran..."
                    style={{ width: '100%', borderRadius: 6 }}
                    onChange={(val) => setSelectedTermId(val)}
                    options={paymentTerms.map((t) => {
                      const elig = getTermEligibility(t);
                      const isAlreadyProcessed = t.status && t.status !== 'PENDING';
                      return {
                        value: t.id,
                        disabled: isAlreadyProcessed,
                        label: `Termin #${t.sequence}: ${t.termName} (${t.percentage}%) — Rp ${Number(t.amount).toLocaleString('id-ID')} ${elig.statusTag}`,
                      };
                    })}
                  />
                </Form.Item>
              </Col>
            ) : null}

            <Col xs={24} sm={paymentTerms.length > 0 ? 12 : 8}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Tanggal Faktur / Invoice</span>}
                name="invoiceDate"
                rules={[{ required: true, message: 'Tanggal invoice wajib diisi' }]}
              >
                <DatePicker
                  style={{ width: '100%', borderRadius: 6 }}
                  format="DD MMMM YYYY"
                  allowClear={false}
                  disabledDate={(d) => d && d.isAfter(dayjs())}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={paymentTerms.length > 0 ? 12 : 8}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Nomor Faktur Pajak / E-Faktur (Opsional)</span>}
                name="taxInvoiceNumber"
              >
                <Input placeholder="Contoh: 010.000-26.12345678..." style={{ borderRadius: 6, fontSize: 11.5 }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={paymentTerms.length > 0 ? 12 : 8}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan Khusus Finance (Opsional)</span>}
                name="notes"
              >
                <Input placeholder="Catatan perihal penagihan / rekening..." style={{ borderRadius: 6, fontSize: 11.5 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* CANONICAL SERVICE CLAIM SELECTOR FOR SERVICE PO */}
          {po?.orderType === 'SERVICE' && !isDpTerm && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                borderRadius: 8,
                border: '1px solid #93c5fd',
                background: '#eff6ff',
              }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={8}>
                    <SafetyCertificateOutlined style={{ color: '#2563eb', fontSize: 16 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>
                      Klaim Jasa Disetujui
                    </span>
                  </Space>
                  <Tag color="blue" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                    VALIDASI CANONICAL SSOT
                  </Tag>
                </div>
              }
            >
              {loadingClaims ? (
                <div style={{ padding: '12px 0', textAlign: 'center' }}>
                  <Spin size="small" />{' '}
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    Memuat daftar Klaim Jasa yang disetujui...
                  </Text>
                </div>
              ) : approvedServiceClaims.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Belum Ada Klaim Jasa Disetujui (APPROVED_FOR_INVOICE) Pada PO Ini"
                  description="Penagihan termin progress/final jasa memerlukan Klaim Jasa yang telah disetujui secara komersial oleh tim Procurement dan diverifikasi teknis oleh Project Manager."
                  style={{ borderRadius: 6 }}
                />
              ) : (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 12, color: '#1e3a8a' }}>
                      Pilih Klaim Jasa yang Sah <span style={{ color: '#dc2626' }}>*</span>:
                    </Text>
                  </div>
                  <Select
                    placeholder="Pilih Klaim Jasa yang memvalidasi penagihan termin ini..."
                    style={{ width: '100%', borderRadius: 6 }}
                    value={selectedServiceClaimId}
                    onChange={(val) => setSelectedServiceClaimId(val)}
                    options={approvedServiceClaims.map((claim) => ({
                      value: claim.id,
                      label: `${claim.claimNumber} | Nilai Disetujui: Rp ${Number(claim.approvedClaimAmount || claim.totalClaimAmount || 0).toLocaleString('id-ID')} | Vendor: ${vendorName}${claim.acceptanceReference ? ` | Bukti: ${claim.acceptanceReference}` : ''}`,
                    }))}
                  />

                  {selectedServiceClaimId && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        background: '#ffffff',
                        borderRadius: 6,
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {(() => {
                        const sc = approvedServiceClaims.find(c => Number(c.id) === Number(selectedServiceClaimId));
                        if (!sc) return null;
                        return (
                          <Row gutter={[12, 8]} align="middle">
                            <Col xs={24} sm={6}>
                              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>NOMOR KLAIM:</Text>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e40af', fontFamily: 'monospace' }}>
                                {sc.claimNumber}
                              </div>
                            </Col>
                            <Col xs={24} sm={6}>
                              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PERIODE KLAIM:</Text>
                              <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
                                {sc.claimPeriodStart && sc.claimPeriodEnd ? `${dayjs(sc.claimPeriodStart).format('DD/MM/YYYY')} - ${dayjs(sc.claimPeriodEnd).format('DD/MM/YYYY')}` : '—'}
                              </div>
                            </Col>
                            <Col xs={24} sm={6}>
                              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>NILAI DISETUJUI:</Text>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#059669', fontFamily: 'monospace' }}>
                                Rp {Number(sc.approvedClaimAmount || sc.totalClaimAmount || 0).toLocaleString('id-ID')}
                              </div>
                            </Col>
                            <Col xs={24} sm={6}>
                              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>REFERENSI BUKTI:</Text>
                              <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
                                {sc.acceptanceReference || sc.acceptanceType || '—'}
                              </div>
                            </Col>
                          </Row>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* CANONICAL GOODS RECEIPT SELECTOR FOR PROGRESS TERMIN (MATERIAL PO ONLY) */}
          {po?.orderType !== 'SERVICE' && isProgressTerm && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                borderRadius: 8,
                border: '1px solid #93c5fd',
                background: '#eff6ff',
              }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={8}>
                    <InboxOutlined style={{ color: '#2563eb', fontSize: 16 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>
                      Pilih Dokumen Goods Receipt (GR) — Bukti Fisik Penagihan Progress
                    </span>
                  </Space>
                  <Tag color="blue" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                    VALIDASI CANONICAL SSOT
                  </Tag>
                </div>
              }
            >
              {loadingGrs ? (
                <div style={{ padding: '12px 0', textAlign: 'center' }}>
                  <Spin size="small" />{' '}
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    Memuat daftar Goods Receipt dari server...
                  </Text>
                </div>
              ) : goodsReceipts.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Belum Ada Goods Receipt (GR) Aktif Pada PO Ini"
                  description="Termin Progress wajib memiliki dasar penerimaan barang (Goods Receipt) aktual dari Procurement. Penagihan belum dapat diterbitkan hingga fisik barang/pekerjaan diterima."
                  style={{ borderRadius: 6 }}
                />
              ) : (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 12, color: '#1e3a8a' }}>
                      Pilih Goods Receipt yang Sah <span style={{ color: '#dc2626' }}>*</span>:
                    </Text>
                  </div>
                  <Select
                    placeholder="Pilih Goods Receipt yang memvalidasi penagihan termin ini..."
                    style={{ width: '100%', borderRadius: 6 }}
                    value={selectedGrId}
                    onChange={(val) => setSelectedGrId(val)}
                    options={goodsReceipts.map((gr) => ({
                      value: gr.id,
                      label: `${gr.grNumber} | Tanggal: ${dayjs(gr.receiptDate).format('DD/MM/YYYY')} | Nilai Fisik: Rp ${Number(gr.totalReceivedAmount || 0).toLocaleString('id-ID')}${gr.remarks ? ` — ${gr.remarks}` : ''}`,
                    }))}
                  />

                  {selectedGr && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        background: '#ffffff',
                        borderRadius: 6,
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <Row gutter={[12, 8]} align="middle">
                        <Col xs={24} sm={6}>
                          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>NOMOR GR:</Text>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e40af', fontFamily: 'monospace' }}>
                            {selectedGr.grNumber}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            Canonical GR ID: #{selectedGr.id}
                          </div>
                        </Col>
                        <Col xs={24} sm={6}>
                          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>TANGGAL PENERIMAAN:</Text>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
                            {dayjs(selectedGr.receiptDate).format('DD MMMM YYYY')}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            Diterima oleh Gudang/PMO
                          </div>
                        </Col>
                        <Col xs={24} sm={6}>
                          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>TOTAL NILAI FISIK GR:</Text>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: '#059669', fontFamily: 'monospace' }}>
                            Rp {totalPhysicalDeliveryValue.toLocaleString('id-ID')}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            Nilai Penerimaan GR Ini
                          </div>
                        </Col>
                        <Col xs={24} sm={6}>
                          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>DUKUNGAN TERMIN:</Text>
                          <div style={{ marginTop: 2 }}>
                            {isFinanciallySupported ? (
                              <Tag color="success" style={{ fontWeight: 700, fontSize: 10.5, margin: 0 }}>
                                <CheckCircleOutlined style={{ marginRight: 4 }} />
                                KAPASITAS FISIK MEMADAI
                              </Tag>
                            ) : (
                              <Tag color="error" style={{ fontWeight: 700, fontSize: 10.5, margin: 0 }}>
                                <CloseCircleOutlined style={{ marginRight: 4 }} />
                                KAPASITAS FISIK DEFISIT
                              </Tag>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: isFinanciallySupported ? '#64748b' : '#dc2626', marginTop: 2, fontWeight: isFinanciallySupported ? 400 : 600 }}>
                            {isFinanciallySupported
                              ? `Sisa Plafon: Rp ${remainingProgressCapacity.toLocaleString('id-ID')}`
                              : `Defisit: Rp ${capacityDeficit.toLocaleString('id-ID')} (Sisa: Rp ${remainingProgressCapacity.toLocaleString('id-ID')})`}
                          </div>
                        </Col>
                      </Row>

                      {/* Cumulative Progress Capacity Breakdown Strip */}
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          background: isFinanciallySupported ? '#f0fdf4' : '#fff1f2',
                          borderRadius: 6,
                          border: `1px solid ${isFinanciallySupported ? '#bbf7d0' : '#fecdd3'}`,
                          fontSize: 11,
                        }}
                      >
                        <Row gutter={[8, 4]}>
                          <Col xs={12} sm={6}>
                            <Text type="secondary" style={{ fontSize: 9.5 }}>TOTAL FISIK GR PO:</Text>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                              Rp {totalPhysicalDeliveryValueAcrossPo.toLocaleString('id-ID')}
                            </div>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Text type="secondary" style={{ fontSize: 9.5 }}>PROGRESS DITAGIHKAN:</Text>
                            <div style={{ fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                              Rp {previousProgressBilled.toLocaleString('id-ID')}
                            </div>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Text type="secondary" style={{ fontSize: 9.5 }}>SISA PLAFON FISIK:</Text>
                            <div style={{ fontWeight: 800, color: isFinanciallySupported ? '#059669' : '#dc2626', fontFamily: 'monospace' }}>
                              Rp {remainingProgressCapacity.toLocaleString('id-ID')}
                            </div>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Text type="secondary" style={{ fontSize: 9.5 }}>STATUS TERMIN INI:</Text>
                            <div style={{ fontWeight: 700, color: isFinanciallySupported ? '#059669' : '#dc2626' }}>
                              {isFinanciallySupported ? 'Memadai (≥ Termin)' : `Defisit Rp ${capacityDeficit.toLocaleString('id-ID')}`}
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </Form>

        {/* FINANCIAL SUMMARY CARD */}
        <Card
          size="small"
          style={{
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
          }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={8}>
                <AuditOutlined style={{ color: '#2563eb', fontSize: 16 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  Ringkasan Penagihan &amp; Evaluasi Matching SSOT
                </span>
              </Space>
              <Tag color="processing" style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}>
                EVALUASI OTOMATIS BACKEND
              </Tag>
            </div>
          }
        >
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} sm={8}>
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>1. TOTAL KONTRAK PO</Text>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1d4ed8', fontFamily: 'monospace', marginTop: 2 }}>
                  Rp {totalPoAmount.toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                  {poItems.length} Item Terdaftar di Kontrak
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  2. NILAI TAGIHAN INVOICE {activeTerm ? `(TERMIN #${activeTerm.sequence})` : '(FULL PO)'}
                </Text>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#059669', fontFamily: 'monospace', marginTop: 2 }}>
                  Rp {invoiceTotalAmount.toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                  {activeTerm
                    ? `${activeTerm.percentage}% dari Total Kontrak (${activeTerm.termName})`
                    : '100% Nilai Kontrak PO'}
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>3. STATUS MATCHING &amp; VERIFIKASI</Text>
                <div style={{ marginTop: 4 }}>
                  {activeTerm && !activeTermEligibility.isEligible ? (
                    <Tag color="error" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                      ● {activeTermEligibility.statusTag.replace(/[\[\]]/g, '')}
                    </Tag>
                  ) : (
                    <Tag color="gold" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                      ● PENDING VERIFIKASI
                    </Tag>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: activeTerm && !activeTermEligibility.isEligible ? '#dc2626' : '#64748b', marginTop: 4 }}>
                  {activeTerm && !activeTermEligibility.isEligible
                    ? (activeTermEligibility.reasons[0] || 'Syarat penagihan belum terpenuhi')
                    : isProgressTerm
                    ? (selectedGr ? `Divalidasi dengan ${selectedGr.grNumber}` : 'Menunggu pemilihan Goods Receipt')
                    : 'Dievaluasi Matching Engine SSOT'}
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        {/* ITEMS BREAKDOWN TABLE (For Progress: Justified GR Items; For Others: Full PO Items) */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 12px',
              background: isProgressTerm ? '#f0fdf4' : '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 12.5, color: isProgressTerm ? '#166534' : '#334155' }}>
              {isProgressTerm
                ? `Rincian Item Yang Divalidasi GR #${selectedGr?.grNumber || '—'} (${progressInvoiceItems.length} Item Diterima Fisik)`
                : `Daftar Item Kontrak PO: ${vendorName} (${poItems.length} Item)`}
            </span>
            <Tag color={isProgressTerm ? 'green' : 'cyan'} style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
              {isProgressTerm ? 'KUANTITAS FISIK JUSTIFIKASI GR' : 'HARGA & KUANTITAS KONTRAK (READ-ONLY)'}
            </Tag>
          </div>

          {isProgressTerm ? (
            <Table
              size="small"
              rowKey="key"
              dataSource={progressInvoiceItems}
              pagination={false}
              scroll={{ y: 220 }}
              locale={{ emptyText: selectedGrId ? 'Tidak ada item yang diterima pada Goods Receipt ini' : 'Pilih Goods Receipt terlebih dahulu' }}
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
                  dataIndex: 'itemName',
                  key: 'itemName',
                  render: (name: string, it: any) => (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>{name}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        <Tag color="blue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                          {it.categoryName || 'Material'}
                        </Tag>
                        {it.wbsNodeId && (
                          <Tag color="geekblue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                            WBS #{it.wbsNodeId}
                          </Tag>
                        )}
                        {it.remarks && (
                          <Tag style={{ fontSize: 9, margin: 0, padding: '0 4px', color: '#64748b' }}>
                            {it.remarks}
                          </Tag>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'Qty Kontrak',
                  dataIndex: 'orderedQty',
                  key: 'orderedQty',
                  width: 85,
                  align: 'center' as const,
                  render: (qty: number) => <span style={{ color: '#64748b', fontSize: 11 }}>{qty}</span>,
                },
                {
                  title: 'Qty Fisik (GR)',
                  dataIndex: 'receivedQty',
                  key: 'receivedQty',
                  width: 95,
                  align: 'center' as const,
                  render: (qty: number) => (
                    <Tag color="green" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                      {qty}
                    </Tag>
                  ),
                },
                {
                  title: 'Sisa Outstanding',
                  dataIndex: 'outstandingQty',
                  key: 'outstandingQty',
                  width: 100,
                  align: 'center' as const,
                  render: (qty: number) => (
                    <span style={{ fontSize: 11, color: qty > 0 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                      {qty}
                    </span>
                  ),
                },
                {
                  title: 'Qty Ditagih',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 90,
                  align: 'center' as const,
                  render: (qty: number) => (
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}>
                      {qty}
                    </span>
                  ),
                },
                {
                  title: 'Satuan',
                  dataIndex: 'uom',
                  key: 'uom',
                  width: 65,
                  align: 'center' as const,
                  render: (uom: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{uom}</span>,
                },
                {
                  title: 'Harga Satuan',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 135,
                  align: 'right' as const,
                  render: (price: number) => (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f172a', fontWeight: 600 }}>
                      Rp {price.toLocaleString('id-ID')}
                    </span>
                  ),
                },
                {
                  title: 'Subtotal Fisik',
                  dataIndex: 'totalPrice',
                  key: 'totalPrice',
                  width: 150,
                  align: 'right' as const,
                  render: (subtotal: number) => (
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#059669' }}>
                      Rp {subtotal.toLocaleString('id-ID')}
                    </span>
                  ),
                },
              ]}
            />
          ) : (
            <Table
              size="small"
              rowKey="key"
              dataSource={poItems}
              pagination={false}
              scroll={{ y: 220 }}
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
                  dataIndex: 'itemName',
                  key: 'itemName',
                  render: (name: string, it: any) => (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>{name}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        <Tag color="blue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                          {it.categoryName || 'Material'}
                        </Tag>
                        {it.wbsNodeId && (
                          <Tag color="geekblue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                            WBS #{it.wbsNodeId}
                          </Tag>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'Qty Kontrak',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 90,
                  align: 'center' as const,
                  render: (qty: number) => <span style={{ fontWeight: 600 }}>{qty}</span>,
                },
                {
                  title: 'Qty Diterima (GR)',
                  dataIndex: 'receivedQuantity',
                  key: 'receivedQuantity',
                  width: 110,
                  align: 'center' as const,
                  render: (rec: number, it: any) => (
                    <Tag
                      color={rec >= it.quantity ? 'green' : rec > 0 ? 'orange' : 'default'}
                      style={{ fontWeight: 700, fontSize: 11, margin: 0 }}
                    >
                      {rec} / {it.quantity}
                    </Tag>
                  ),
                },
                {
                  title: 'Satuan',
                  dataIndex: 'uom',
                  key: 'uom',
                  width: 70,
                  align: 'center' as const,
                  render: (uom: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{uom}</span>,
                },
                {
                  title: 'Harga Satuan',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 150,
                  align: 'right' as const,
                  render: (price: number) => (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f172a', fontWeight: 600 }}>
                      Rp {price.toLocaleString('id-ID')}
                    </span>
                  ),
                },
                {
                  title: 'Subtotal Kontrak',
                  dataIndex: 'totalPrice',
                  key: 'totalPrice',
                  width: 160,
                  align: 'right' as const,
                  render: (subtotal: number) => (
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#059669' }}>
                      Rp {subtotal.toLocaleString('id-ID')}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CreateInvoiceModal;

