"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Space,
  Tabs,
  Badge,
  Empty,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  DollarCircleOutlined,
  ShopOutlined,
  AuditOutlined,
  EyeOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatNumber } from '@/lib/formatters';
import { FinanceService, InvoiceDto, PaymentRequestDto } from '@/services/finance.service';
import { ProcurementService, PurchaseOrder } from '@/services/procurement.service';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const CreateInvoiceModal = dynamic(
  () => import('@/components/finance/CreateInvoiceModal').then((m) => m.CreateInvoiceModal),
  { ssr: false }
);
const InvoiceDetailModal = dynamic(
  () => import('@/components/finance/InvoiceDetailModal').then((m) => m.InvoiceDetailModal),
  { ssr: false }
);
const ProcessPaymentModal = dynamic(
  () => import('@/components/finance/ProcessPaymentModal').then((m) => m.ProcessPaymentModal),
  { ssr: false }
);
const PaymentReceiptModal = dynamic(
  () => import('@/components/finance/PaymentReceiptModal').then((m) => m.PaymentReceiptModal),
  { ssr: false }
);
const SubmitPaymentRequestModal = dynamic(
  () => import('@/components/finance/SubmitPaymentRequestModal').then((m) => m.SubmitPaymentRequestModal),
  { ssr: false }
);
const ResubmitPaymentRequestModal = dynamic(
  () => import('@/components/finance/ResubmitPaymentRequestModal').then((m) => m.ResubmitPaymentRequestModal),
  { ssr: false }
);
import { PaymentDto } from '@/services/finance.service';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UserIdentityDisplay } from '@/components/common/UserIdentityDisplay';
import { getPaymentRequestActionState } from '@/components/finance/paymentRequestActionability';
import styles from './InvoicesPage.module.css';

const { Title, Text } = Typography;

// Helper to classify payment terms
const isDpTerm = (t: any) => {
  const tType = (t?.termType || '').toUpperCase();
  const tName = (t?.termName || '').toUpperCase();
  return tType === 'DP' || tType === 'DOWN_PAYMENT' || tName.includes('DP') || tName.includes('DOWN PAYMENT') || tName.includes('UANG MUKA');
};

const isProgressTerm = (t: any) => {
  const tType = (t?.termType || '').toUpperCase();
  const tName = (t?.termName || '').toUpperCase();
  return tType === 'PROGRESS' || tName.includes('PROGRESS');
};

const isRetentionTerm = (t: any) => {
  const tType = (t?.termType || '').toUpperCase();
  const tName = (t?.termName || '').toUpperCase();
  return tType === 'RETENTION' || tName.includes('RETEN') || Boolean(t?.isRetention);
};

// Canonical Queue Eligibility Evaluator (Phase FIN-UI-2)
const getQueueTermEligibility = (
  term: any,
  po: PurchaseOrder,
  allTerms: any[],
  allInvoices: InvoiceDto[],
  allGrs: any[]
) => {
  if (!term) {
    return { isEligible: false, statusText: '—', tagColor: 'default', reason: 'Termin tidak valid' };
  }

  if (term.status && term.status !== 'PENDING') {
    return {
      isEligible: false,
      statusText: term.status,
      tagColor: 'default',
      reason: `Termin sudah berstatus ${term.status}`,
    };
  }

  const currentSeq = Number(term.sequence || 1);
  const sortedTerms = [...allTerms].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

  // 1. Sequence Gate: Preceding terms must be settled (DP = PAID, Progress = VERIFIED or PAID)
  let seqPassed = true;
  let seqReason = '';
  if (currentSeq > 1) {
    for (const prev of sortedTerms) {
      if ((prev as any).deletedAt || Number(prev.id) === Number(term.id)) continue;
      const prevSeq = Number(prev.sequence || 0);
      if (prevSeq < currentSeq) {
        const matchingInv = allInvoices.find(
          (inv) => Number(inv.paymentTermId) === Number(prev.id) && (inv as any).status !== 'CANCELLED'
        );
        const effectiveStatus = prev.status || matchingInv?.paymentStatus || 'PENDING';
        if (isDpTerm(prev)) {
          if (effectiveStatus !== 'PAID') {
            seqPassed = false;
            seqReason = `Uang Muka / DP (${prev.termName || 'DP'}) belum berstatus PAID (status: ${effectiveStatus})`;
            break;
          }
        } else {
          const allowed = ['VERIFIED', 'PAID'];
          if (!allowed.includes(effectiveStatus) && matchingInv?.matchStatus !== 'VERIFIED') {
            seqPassed = false;
            seqReason = `Termin sebelumnya (${prev.termName || `Termin #${prevSeq}`}) belum mencapai status VERIFIED atau PAID`;
            break;
          }
        }
      }
    }
  }

  // 2. Physical & GR Evidence across PO
  const poGrs = (allGrs || []).filter((g: any) => {
    const mPo = Number(g.poId || g.purchaseOrderId) === Number(po.id) || g.purchaseOrder?.poNumber === po.poNumber;
    const notDeleted = !g.deletedAt;
    const hasItems = Array.isArray(g.items) && g.items.length > 0;
    return mPo && notDeleted && hasItems;
  });

  let totalPhysicalDeliveryValueAcrossPo = 0;
  for (const gr of poGrs) {
    if (gr.items && Array.isArray(gr.items)) {
      for (const gi of gr.items) {
        const poi = (po.items || []).find((p: any) => Number(p.id) === Number(gi.poItemId));
        if (poi) {
          totalPhysicalDeliveryValueAcrossPo += Number(gi.receivedQuantity || 0) * Number(poi.unitPrice || 0);
        }
      }
    } else if (gr.totalReceivedAmount !== undefined) {
      totalPhysicalDeliveryValueAcrossPo += Number(gr.totalReceivedAmount || 0);
    }
  }

  // 3. Milestone Gate
  let msPassed = true;
  let msReason = '';
  const isProg = isProgressTerm(term);
  const isDp = isDpTerm(term);
  const isRet = isRetentionTerm(term);

  const isServicePo = po.orderType === 'SERVICE';

  if (isDp) {
    if (!['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'].includes(po.status)) {
      msPassed = false;
      msReason = `Status PO (${po.status}) belum siap untuk penagihan DP`;
    }
  } else if (isProg) {
    if (!isServicePo) {
      const is100Percent =
        /100%|fisik\s*100%|lengkap/i.test(term.triggerCondition || '') ||
        Number(term.percentage) === 100;

      if (is100Percent) {
        const isPoCompleted = po.status === 'COMPLETED';
        const unfulfilled = (po.items || []).filter(
          (it: any) => Number(it.receivedQuantity || 0) < Number(it.quantity || 0)
        );
        if (!isPoCompleted || unfulfilled.length > 0) {
          msPassed = false;
          const itemDetail = unfulfilled.map((i: any) => `${i.itemName}: ${i.receivedQuantity || 0}/${i.quantity}`).join(', ');
          msReason = `Kemajuan Fisik 100% belum tercapai (status PO: ${po.status}). Item belum selesai: ${itemDetail || 'Belum lengkap'}`;
        }
      } else {
        const matchPercent = (term.triggerCondition || '').match(/(\d+(?:\.\d+)?)\s*%/);
        const targetPercent = matchPercent ? parseFloat(matchPercent[1]) : Number(term.percentage || 0);
        const poTotal = Number(po.totalAmount || 0);
        if (targetPercent > 0 && targetPercent < 100) {
          const physicalProgress = poTotal > 0 ? (totalPhysicalDeliveryValueAcrossPo / poTotal) * 100 : 0;
          if (Math.round(physicalProgress * 100) / 100 + 0.5 < targetPercent) {
            msPassed = false;
            msReason = `Kemajuan fisik baru mencapai ${physicalProgress.toFixed(1)}% (target: ${targetPercent}%)`;
          }
        }
      }
    }
  } else if (isRet) {
    if (po.status !== 'COMPLETED') {
      msPassed = false;
      msReason = 'Termin retensi hanya dapat ditagihkan setelah Purchase Order berstatus COMPLETED';
    }
  }

  // 4. Financial Capacity Gate (for Progress terms)
  let capPassed = true;
  let capReason = '';
  if (isProg && !isServicePo) {
    if (poGrs.length === 0) {
      capPassed = false;
      capReason = 'Belum ada dokumen Goods Receipt (GR) aktif sebagai dasar fisik penagihan';
    } else {
      let previousProgressBilled = 0;
      for (const inv of allInvoices) {
        if ((inv as any).deletedAt || (inv as any).status === 'CANCELLED') continue;
        const matchesPo = Number(inv.poId) === Number(po.id) || inv.purchaseOrder?.poNumber === po.poNumber;
        if (!matchesPo) continue;
        const invTerm = sortedTerms.find((t) => Number(t.id) === Number(inv.paymentTermId));
        if (invTerm && isProgressTerm(invTerm)) {
          previousProgressBilled += Number(inv.totalAmount || 0);
        }
      }

      const termAmount = Number(term.amount || 0);
      const remainingCapacity = Math.max(0, totalPhysicalDeliveryValueAcrossPo - previousProgressBilled);
      if (remainingCapacity < termAmount - 0.01) {
        capPassed = false;
        const deficit = termAmount - remainingCapacity;
        capReason = `Kapasitas fisik defisit Rp ${Math.round(deficit).toLocaleString('id-ID')}. Plafon fisik tersisa: Rp ${Math.round(remainingCapacity).toLocaleString('id-ID')}, nilai termin: Rp ${termAmount.toLocaleString('id-ID')}`;
      }
    }
  }

  const isEligible = seqPassed && msPassed && capPassed;
  let statusText = `Siap: ${term.termName || `Termin #${currentSeq}`}`;
  let tagColor = 'gold';
  let reason = '';

  if (!isEligible) {
    tagColor = 'orange';
    if (!seqPassed) {
      statusText = `Menunggu Urutan: ${term.termName || `Termin #${currentSeq}`}`;
      reason = seqReason;
    } else if (!msPassed) {
      statusText = `Menunggu Milestone: ${term.termName || `Termin #${currentSeq}`}`;
      reason = msReason;
    } else if (!capPassed) {
      statusText = `Menunggu Kapasitas GR: ${term.termName || `Termin #${currentSeq}`}`;
      reason = capReason;
    } else {
      statusText = `Belum Siap: ${term.termName || `Termin #${currentSeq}`}`;
      reason = 'Syarat penagihan belum terpenuhi';
    }
  }

  return {
    isEligible,
    statusText,
    tagColor,
    reason,
  };
};

export default function InvoicesPage() {
  const { user, isFinance } = useAuth();
  const canCreateInvoice = isFinance;
  const canProcessPayment = isFinance;

  // Active Tab
  const [activeTabKey, setActiveTabKey] = useState<string>('ready_pos');

  // Modal States
  const [selectedPoForInvoice, setSelectedPoForInvoice] = useState<PurchaseOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<InvoiceDto | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Payment Modal States
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<InvoiceDto | null>(null);
  const [isProcessPaymentModalOpen, setIsProcessPaymentModalOpen] = useState<boolean>(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentDto | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [selectedInvoiceForPaymentRequest, setSelectedInvoiceForPaymentRequest] = useState<InvoiceDto | null>(null);
  const [isPaymentRequestModalOpen, setIsPaymentRequestModalOpen] = useState<boolean>(false);
  const [selectedRequestForResubmit, setSelectedRequestForResubmit] = useState<PaymentRequestDto | null>(null);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState<boolean>(false);

  const queryClient = useQueryClient();

  // 1. Fetch All POs from Canonical Backend SSOT API via TanStack Query
  const {
    data: purchaseOrders = [],
    isLoading: loadingPos,
    refetch: fetchPurchaseOrders,
  } = useQuery<PurchaseOrder[]>({
    queryKey: ['finance', 'purchase-orders'],
    queryFn: () => ProcurementService.getPurchaseOrders(),
    staleTime: 60000,
  });

  // 2. Fetch Invoices from Authoritative Backend SSOT API via TanStack Query
  const {
    data: invoices = [],
    isLoading: loadingInvoices,
    refetch: refetchInvoices,
  } = useQuery<InvoiceDto[]>({
    queryKey: ['finance', 'invoices'],
    queryFn: () => FinanceService.getInvoices(),
    staleTime: 60000,
  });

  // 3. Fetch Payments via TanStack Query (shared with /finance/payments)
  const {
    data: allPayments = [],
    refetch: refetchPayments,
  } = useQuery<PaymentDto[]>({
    queryKey: ['finance', 'payments'],
    queryFn: () => FinanceService.getPayments(),
    staleTime: 60000,
  });

  // 4. Fetch Goods Receipts via TanStack Query
  const {
    data: goodsReceipts = [],
    refetch: refetchGoodsReceipts,
  } = useQuery<any[]>({
    queryKey: ['finance', 'goods-receipts'],
    queryFn: () => ProcurementService.getGoodsReceipts(),
    staleTime: 60000,
  });

  // 5. Fetch Payment Requests via TanStack Query
  const {
    data: paymentRequests = [],
    refetch: refetchPaymentRequests,
  } = useQuery<PaymentRequestDto[]>({
    queryKey: ['finance', 'payment-requests'],
    queryFn: () => FinanceService.getPaymentRequests(),
    staleTime: 60000,
  });

  // Map of active payment requests by invoiceId
  const activePaymentRequestsByInvoiceId = useMemo(() => {
    const map = new Map<number, PaymentRequestDto>();
    for (const pr of paymentRequests) {
      if (!pr.invoiceId) continue;
      const invId = Number(pr.invoiceId);
      const existing = map.get(invId);
      if (!existing) {
        map.set(invId, pr);
      } else {
        const activeStatuses = ['PENDING_DIRECTOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED_FOR_PAYMENT'];
        const isPrActive = activeStatuses.includes(pr.status);
        const isExActive = activeStatuses.includes(existing.status);
        if (isPrActive && !isExActive) {
          map.set(invId, pr);
        } else if (Number(pr.id) > Number(existing.id)) {
          map.set(invId, pr);
        }
      }
    }
    return map;
  }, [paymentRequests]);

  // Invalidate helper to refresh finance data when mutations occur
  const fetchInvoices = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'goods-receipts'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] }),
    ]);
  }, [queryClient]);

  // Canonical Phase G Cross-User Synchronization & Reconnect Resync
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      if (detail.aggregateType === 'PurchaseOrder') {
        queryClient.invalidateQueries({ queryKey: ['finance', 'purchase-orders'] });
      } else if (
        detail.aggregateType === 'Invoice' ||
        detail.aggregateType === 'GoodsReceipt' ||
        detail.aggregateType === 'Payment' ||
        detail.aggregateType === 'PaymentRequest'
      ) {
        queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'goods-receipts'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] });
      }
    };

    const handleReconnect = () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    };

    window.addEventListener('epms:business-sync', handleSync);
    window.addEventListener('epms:reconnect-resync', handleReconnect);
    return () => {
      window.removeEventListener('epms:business-sync', handleSync);
      window.removeEventListener('epms:reconnect-resync', handleReconnect);
    };
  }, [queryClient]);

  // 3. Filter POs: POs eligible for billing (DP, Progress with GR, or Full Delivery COMPLETED)
  const readyCompletedPos = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const poInvoices = invoices.filter(
        (inv) =>
          Number(inv.poId) === Number(po.id) ||
          (inv.purchaseOrder?.poNumber && inv.purchaseOrder.poNumber === po.poNumber)
      );

      const terms = po.paymentTerms || [];

      if (terms.length > 0) {
        // Pending terms not yet invoiced
        const pendingTerms = terms.filter((term) => {
          if (term.status && term.status !== 'PENDING') return false;
          return !poInvoices.some((inv) => Number(inv.paymentTermId) === Number(term.id));
        });

        // Active PO with pending terms to monitor / bill
        if (pendingTerms.length > 0 && ['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'].includes(po.status)) {
          return true;
        }

        // If no pending terms, include only if COMPLETED and has existing invoices (for audit/review)
        return po.status === 'COMPLETED' && poInvoices.length > 0;
      }

      // Legacy / Non-term PO (Branch B):
      // Must be COMPLETED status and 100% received
      if (po.status !== 'COMPLETED') return false;
      const totalOrdered = (po.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);
      const totalReceived = (po.items || []).reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0);
      return totalReceived >= totalOrdered && totalOrdered > 0;
    });
  }, [purchaseOrders, invoices]);

  // 4. Statistics Calculation (Authoritative from Backend Data)
  const totalCompletedPosCount = readyCompletedPos.length;
  const pendingInvoicePosCount = useMemo(() => {
    return readyCompletedPos.filter((po) => {
      const poInvoices = invoices.filter(
        (inv) =>
          Number(inv.poId) === Number(po.id) ||
          (inv.purchaseOrder?.poNumber && inv.purchaseOrder.poNumber === po.poNumber)
      );
      const terms = [...(po.paymentTerms || [])].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
      if (terms.length > 0) {
        const nextPending = terms.find((term) => {
          const isInvoiced =
            (term.status && term.status !== 'PENDING') ||
            poInvoices.some((inv) => Number(inv.paymentTermId) === Number(term.id));
          return !isInvoiced;
        });
        if (!nextPending) return false;
        const elig = getQueueTermEligibility(nextPending, po, terms, invoices, goodsReceipts);
        return elig.isEligible;
      }
      return poInvoices.length === 0;
    }).length;
  }, [readyCompletedPos, invoices, goodsReceipts]);
  const monitoredPosCount = Math.max(0, totalCompletedPosCount - pendingInvoicePosCount);

  const totalInvoicedValue = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  }, [invoices]);

  const matchedInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => inv.matchStatus === 'MATCHED').length;
  }, [invoices]);

  const verifiedInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => inv.matchStatus === 'VERIFIED').length;
  }, [invoices]);

  const paidInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => inv.paymentStatus === 'PAID').length;
  }, [invoices]);

  // TAB 1: Columns for PO Siap Ditagihkan
  const readyPoColumns = useMemo(
    () => [
      {
        title: 'Nomor PO',
        key: 'poNumber',
        width: 170,
        render: (_: any, r: PurchaseOrder) => (
          <div>
            <span style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'nowrap' }}>
              {r.poNumber}
            </span>
            <div style={{ marginTop: 2 }}>
              <StatusBadge
                domain="po"
                status={r.status}
                showDot
                style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4 }}
              />
            </div>
          </div>
        ),
      },
      {
        title: 'Proyek',
        key: 'project',
        width: 240,
        render: (_: any, r: PurchaseOrder) => {
          const projectName = r.purchaseRequest?.project?.name || (r as any).projectName || 'Proyek Tanpa Nama';
          const projectId = r.purchaseRequest?.project?.id || (r as any).projectId;
          return (
            <div style={{ maxWidth: 260 }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A', whiteSpace: 'normal', lineHeight: 1.35 }}>
                {projectName}
              </div>
              {projectId ? (
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontSize: 10.5, color: '#64748B', fontFamily: 'monospace' }}>
                    ID #{projectId}
                  </span>
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Vendor Penyedia',
        key: 'vendor',
        width: 210,
        render: (_: any, r: PurchaseOrder) => {
          const vendorName = r.vendor?.name || (r as any).vendorName || 'Vendor Tidak Tercatat';
          const vendorCode = r.vendor?.code || (r as any).vendorCode || '';
          return (
            <div style={{ maxWidth: 220 }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShopOutlined style={{ color: '#0D9488', fontSize: 13 }} />
                <span>{vendorName}</span>
              </div>
              {vendorCode ? (
                <div style={{ marginTop: 2 }}>
                  <span className={styles.subtleCodeTag} style={{ background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1' }}>
                    {vendorCode}
                  </span>
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Total Kontrak PO',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        width: 160,
        align: 'right' as const,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#059669' }}>
            {formatCurrency(val)}
          </span>
        ),
      },
      {
        title: 'Status Realisasi Fisik',
        key: 'fulfillment',
        width: 180,
        render: (_: any, r: PurchaseOrder) => {
          const totalOrdered = (r.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);
          const totalReceived = (r.items || []).reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0);
          const isFullyReceived = totalReceived >= totalOrdered && totalOrdered > 0;

          return (
            <div>
              <Tag
                color={isFullyReceived ? 'success' : totalReceived > 0 ? 'processing' : 'warning'}
                style={{ fontWeight: 600, fontSize: 11, borderRadius: 4, margin: 0, padding: '1px 8px' }}
              >
                {isFullyReceived ? '100% Diterima' : totalReceived > 0 ? 'Parsial' : 'Menunggu Pengiriman'}
              </Tag>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, whiteSpace: 'nowrap' }}>
                {totalReceived}/{totalOrdered} unit · {totalReceived > 0 ? 'GR tercatat' : 'Belum ada GR'}
              </div>
            </div>
          );
        },
      },
      {
        title: 'Status Penagihan',
        key: 'invoiceStatus',
        width: 220,
        render: (_: any, r: PurchaseOrder) => {
          const poInvoices = invoices.filter(
            (i) =>
              Number(i.poId) === Number(r.id) ||
              (i.purchaseOrder?.poNumber && i.purchaseOrder.poNumber === r.poNumber)
          );

          const rawTerms = r.paymentTerms || [];
          const terms = [...rawTerms].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

          if (terms.length > 0) {
            const invoicedCount = terms.filter(
              (t) =>
                (t.status && t.status !== 'PENDING') ||
                poInvoices.some((inv) => Number(inv.paymentTermId) === Number(t.id))
            ).length;

            const nextPendingTerm = terms.find((t) => {
              const isInv =
                (t.status && t.status !== 'PENDING') ||
                poInvoices.some((inv) => Number(inv.paymentTermId) === Number(t.id));
              return !isInv;
            });

            if (nextPendingTerm) {
              const elig = getQueueTermEligibility(nextPendingTerm, r, terms, invoices, goodsReceipts);

              return (
                <div>
                  <Tooltip title={elig.reason || undefined}>
                    <Tag
                      color={elig.isEligible ? 'success' : 'warning'}
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        borderRadius: 4,
                        margin: 0,
                        padding: '1px 8px',
                        cursor: elig.reason ? 'help' : 'default',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {elig.statusText}
                    </Tag>
                  </Tooltip>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, whiteSpace: 'nowrap' }}>
                    {invoicedCount}/{terms.length} Termin Terbit
                  </div>
                </div>
              );
            }

            return (
              <div>
                <Tag
                  color="default"
                  style={{
                    fontWeight: 600,
                    fontSize: 11,
                    borderRadius: 4,
                    margin: 0,
                    padding: '1px 8px',
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ● SEMUA TERMIN TERBIT
                </Tag>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginTop: 3, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {invoicedCount}/{terms.length} Invoice
                </div>
              </div>
            );
          }

          // Legacy / Non-term PO
          if (poInvoices.length > 0) {
            return (
              <div>
                <Tag
                  color="default"
                  style={{
                    fontWeight: 600,
                    fontSize: 11,
                    borderRadius: 4,
                    margin: 0,
                    padding: '1px 8px',
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ● INVOICED
                </Tag>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginTop: 3, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {poInvoices[0].invoiceNumber}
                </div>
              </div>
            );
          }

          return (
            <Tag color="warning" style={{ fontWeight: 600, fontSize: 11, borderRadius: 4, margin: 0, padding: '1px 8px', whiteSpace: 'nowrap' }}>
              Belum Ditagihkan
            </Tag>
          );
        },
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 190,
        align: 'center' as const,
        render: (_: any, r: PurchaseOrder) => {
          const poInvoices = invoices.filter(
            (i) =>
              Number(i.poId) === Number(r.id) ||
              (i.purchaseOrder?.poNumber && i.purchaseOrder.poNumber === r.poNumber)
          );

          const rawTerms = r.paymentTerms || [];
          const terms = [...rawTerms].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

          const nextPendingTerm = terms.find((t) => {
            const isInv =
              (t.status && t.status !== 'PENDING') ||
              poInvoices.some((inv) => Number(inv.paymentTermId) === Number(t.id));
            return !isInv;
          });

          const isTermPo = terms.length > 0;
          const elig = nextPendingTerm
            ? getQueueTermEligibility(nextPendingTerm, r, terms, invoices, goodsReceipts)
            : null;

          const canSubmitAction = isTermPo
            ? Boolean(elig?.isEligible) && canCreateInvoice
            : poInvoices.length === 0 && canCreateInvoice;

          const buttonTitle = isTermPo
            ? elig?.isEligible
              ? 'Terbitkan faktur invoice untuk termin ini'
              : elig?.reason || `Termin ${nextPendingTerm?.termName || ''} belum memenuhi syarat penagihan`
            : undefined;

          return (
            <Space size={6} wrap={false}>
              {nextPendingTerm && (
                <Tooltip title={!canSubmitAction ? buttonTitle : undefined}>
                  <span>
                    <Button
                      size="small"
                      type={canSubmitAction ? 'primary' : 'default'}
                      icon={<SendOutlined />}
                      disabled={!canSubmitAction}
                      onClick={() => {
                        if (!canSubmitAction) return;
                        setSelectedPoForInvoice(r);
                        setIsCreateModalOpen(true);
                      }}
                      className={canSubmitAction ? styles.btnActionPrimary : styles.btnActionDisabled}
                    >
                      Terbitkan Termin
                    </Button>
                  </span>
                </Tooltip>
              )}

              {poInvoices.length > 0 && (
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setSelectedInvoiceForDetail(poInvoices[poInvoices.length - 1]);
                    setIsDetailModalOpen(true);
                  }}
                  className={styles.btnActionSecondary}
                >
                  {terms.length > 0 && nextPendingTerm
                    ? `Invoice (${poInvoices.length})`
                    : 'Lihat Invoice'}
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [canCreateInvoice, invoices, goodsReceipts]
  );

  // TAB 2: Columns for Daftar Invoice
  const invoiceColumns = useMemo(
    () => [
      {
        title: 'Nomor Invoice',
        dataIndex: 'invoiceNumber',
        key: 'invoiceNumber',
        width: 170,
        render: (invNum: string) => (
          <span style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'nowrap' }}>
            {invNum}
          </span>
        ),
      },
      {
        title: 'Nomor PO Terkait',
        key: 'poNumber',
        width: 170,
        render: (_: any, r: InvoiceDto) => {
          const poNum = r.purchaseOrder?.poNumber || (r.poId ? `PO #${r.poId}` : '—');
          return (
            <span style={{ fontWeight: 600, color: '#0F766E', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
              {poNum}
            </span>
          );
        },
      },
      {
        title: 'Vendor Penyedia',
        key: 'vendor',
        width: 200,
        render: (_: any, r: InvoiceDto) => {
          const vName = r.purchaseOrder?.vendor?.name || (r as any).vendorName || '—';
          const vCode = r.purchaseOrder?.vendor?.code || (r as any).vendorCode;
          return (
            <div style={{ maxWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>{vName}</div>
              {vCode && (
                <div style={{ marginTop: 2 }}>
                  <span className={styles.subtleCodeTag} style={{ background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1' }}>
                    {vCode}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: 'Total Tagihan',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        width: 160,
        align: 'right' as const,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#059669', fontSize: 13 }}>
            {formatCurrency(val)}
          </span>
        ),
      },
      {
        title: 'Status Rekonsiliasi',
        dataIndex: 'matchStatus',
        key: 'matchStatus',
        width: 170,
        align: 'center' as const,
        render: (status: string) => {
          const s = (status || '').toUpperCase();
          if (s === 'VERIFIED') {
            return (
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11, background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', whiteSpace: 'nowrap' }}>
                Terverifikasi
              </span>
            );
          }
          if (s === 'MATCHED') {
            return (
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', whiteSpace: 'nowrap' }}>
                Tercocokkan
              </span>
            );
          }
          return (
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11, background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', whiteSpace: 'nowrap' }}>
              Menunggu Rekonsiliasi
            </span>
          );
        },
      },
      {
        title: 'Status Bayar',
        dataIndex: 'paymentStatus',
        key: 'paymentStatus',
        width: 140,
        align: 'center' as const,
        render: (status: string) => {
          const isPaid = (status || '').toUpperCase() === 'PAID';
          return (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 11,
              background: isPaid ? '#ECFDF5' : '#FFFBEB',
              color: isPaid ? '#065F46' : '#92400E',
              border: isPaid ? '1px solid #A7F3D0' : '1px solid #FDE68A',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPaid ? '#10B981' : '#F59E0B' }} />
              {isPaid ? 'Lunas' : 'Belum Dibayar'}
            </span>
          );
        },
      },
      {
        title: 'Tanggal Terbit',
        key: 'invoiceDate',
        width: 130,
        render: (_: any, r: InvoiceDto) => (
          <span style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#475569' }}>
            {formatDate(r.invoiceDate || r.createdAt)}
          </span>
        ),
      },
      {
        title: 'Penerbit',
        key: 'createdBy',
        width: 180,
        render: (_: any, r: InvoiceDto) => {
          const name = r.creator?.fullName || (r.createdBy ? `User #${r.createdBy}` : 'Finance Team');
          const email = r.creator?.email || '';
          return (
            <div style={{ maxWidth: 170 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
              {email && (
                <div style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 220,
        align: 'center' as const,
        render: (_: any, r: InvoiceDto) => {
          const isPaid = r.paymentStatus === 'PAID';
          const paymentRecord = isPaid
            ? allPayments.find((p) => Number(p.invoiceId) === Number(r.id)) || null
            : null;

          const activePrq = activePaymentRequestsByInvoiceId.get(Number(r.id)) || null;
          const uiState = getPaymentRequestActionState(r, activePrq, { isFinance: canProcessPayment });

          return (
            <Space size={6} wrap={false}>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedInvoiceForDetail(r);
                  setIsDetailModalOpen(true);
                }}
                className={styles.btnActionSecondary}
              >
                Lihat Invoice
              </Button>

              {!isPaid && uiState.actionType === 'PENDING_DIRECTOR_APPROVAL' && (
                <Tag
                  color="orange"
                  icon={<ClockCircleOutlined />}
                  id={`tag-pending-director-${r.id}`}
                  style={{
                    padding: '3px 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Menunggu Persetujuan Direktur
                </Tag>
              )}

              {!isPaid && uiState.actionType === 'NEEDS_REVISION' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<SyncOutlined />}
                  id={`btn-resubmit-payment-request-${r.id}`}
                  onClick={() => {
                    setSelectedRequestForResubmit(uiState.activeRequest || activePrq);
                    setIsResubmitModalOpen(true);
                  }}
                  style={{ background: '#D97706', borderColor: '#D97706' }}
                >
                  Revisi Pengajuan
                </Button>
              )}

              {!isPaid && uiState.actionType === 'APPROVED_FOR_PAYMENT' && canProcessPayment && (
                <Button
                  size="small"
                  type="primary"
                  icon={<DollarCircleOutlined />}
                  id={`btn-pay-approved-invoice-${r.id}`}
                  onClick={() => {
                    setSelectedInvoiceForPay(r);
                    setIsProcessPaymentModalOpen(true);
                  }}
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  Bayar Sekarang
                </Button>
              )}

              {!isPaid && uiState.actionType === 'APPROVED_FOR_PAYMENT' && !canProcessPayment && (
                <Tag
                  color="cyan"
                  style={{
                    padding: '3px 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                  }}
                >
                  Disetujui Pembayaran
                </Tag>
              )}

              {!isPaid && (uiState.actionType === 'SUBMIT_NEW' || uiState.actionType === 'CANNOT_SUBMIT') && (
                <Tooltip title={uiState.tooltipMessage}>
                  <span>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      id={`btn-submit-payment-request-${r.id}`}
                      disabled={!uiState.canSubmitNew}
                      onClick={() => {
                        if (uiState.canSubmitNew) {
                          setSelectedInvoiceForPaymentRequest(r);
                          setIsPaymentRequestModalOpen(true);
                        }
                      }}
                      className={styles.btnActionSubmitApproval}
                    >
                      Ajukan Persetujuan
                    </Button>
                  </span>
                </Tooltip>
              )}

              {isPaid && paymentRecord && (
                <Button
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setSelectedPaymentForReceipt(paymentRecord);
                    setIsReceiptModalOpen(true);
                  }}
                  className={styles.btnActionReceipt}
                >
                  Bukti Bayar
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [canCreateInvoice, allPayments, activePaymentRequestsByInvoiceId]
  );

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PROCUREMENT', 'PURCHASING']}>
      <div className={styles.pageContainer}>
        {/* Header Section */}
        <div className={styles.pageHeader}>
          <div>
            <Title level={3} className={styles.headerTitle}>
              Finance &amp; Invoices
            </Title>
            <Text className={styles.headerSubtitle}>
              Verifikasi faktur tagihan vendor berbasis Purchase Order (DP, Progress GR, atau COMPLETED), rekonsiliasi fisik Goods Receipt (GR), dan kesiapan pembayaran.
            </Text>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  <FileTextOutlined />
                </div>
                <span className={styles.cardLabel}>Antrean PO Siap Ditagihkan</span>
              </div>
              <div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardValue}>{pendingInvoicePosCount}</span>
                  <span className={styles.cardUnit}>PO</span>
                </div>
                <div className={styles.cardSubtext} title={monitoredPosCount > 0 ? `${monitoredPosCount} PO Dalam Pemantauan Milestone` : `${pendingInvoicePosCount} PO Siap Diterbitkan Faktur`}>
                  {monitoredPosCount > 0
                    ? `${monitoredPosCount} PO Dalam Pemantauan Milestone`
                    : `${pendingInvoicePosCount} PO Siap Diterbitkan Faktur`}
                </div>
              </div>
            </div>
          </Col>

          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: '#ECFDF5', color: '#059669' }}>
                  <SendOutlined />
                </div>
                <span className={styles.cardLabel}>Invoice Diterbitkan</span>
              </div>
              <div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardValue} style={{ color: '#059669' }}>{invoices.length}</span>
                  <span className={styles.cardUnit}>Faktur</span>
                </div>
                <div className={styles.cardSubtext} title={`${verifiedInvoicesCount} VERIFIED, ${matchedInvoicesCount} MATCHED`}>
                  {verifiedInvoicesCount} VERIFIED, {matchedInvoicesCount} MATCHED
                </div>
              </div>
            </div>
          </Col>

          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                  <DollarCircleOutlined />
                </div>
                <span className={styles.cardLabel}>Total Nilai Penagihan</span>
              </div>
              <div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardCurrencyPrefix}>Rp</span>
                  <span className={styles.cardValue}>{formatNumber(totalInvoicedValue)}</span>
                </div>
                <div className={styles.cardSubtext} title="Sesuai Snapshot Kontrak Pemenang">
                  Sesuai Snapshot Kontrak Pemenang
                </div>
              </div>
            </div>
          </Col>

          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div className={styles.iconSurface} style={{ background: paidInvoicesCount > 0 ? '#ECFDF5' : '#FFFBEB', color: paidInvoicesCount > 0 ? '#059669' : '#D97706' }}>
                  <CheckCircleOutlined />
                </div>
                <span className={styles.cardLabel}>Status Pembayaran</span>
              </div>
              <div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardValue} style={{ color: paidInvoicesCount > 0 ? '#059669' : '#D97706' }}>
                    {paidInvoicesCount}/{invoices.length}
                  </span>
                  <span className={styles.cardUnit} style={{ color: paidInvoicesCount > 0 ? '#059669' : '#D97706', fontWeight: 600 }}>
                    LUNAS
                  </span>
                </div>
                <div className={styles.cardSubtext} title={`${paidInvoicesCount} Faktur Telah Dilunasi Kas/Bank`}>
                  {paidInvoicesCount} Faktur Telah Dilunasi Kas/Bank
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Main Tabs Container */}
        <div className={styles.tabsCard}>
          <Tabs
            className={styles.financeTabs}
            activeKey={activeTabKey}
            onChange={setActiveTabKey}
            items={[
              {
                key: 'ready_pos',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileTextOutlined style={{ fontSize: 13 }} />
                    <span>PO Siap Ditagihkan</span>
                    {pendingInvoicePosCount > 0 && (
                      <span className={`${styles.tabBadge} ${activeTabKey === 'ready_pos' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                        {pendingInvoicePosCount}
                      </span>
                    )}
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12.5, color: '#64748B' }}>
                        Daftar Purchase Order yang memenuhi syarat penagihan termin (DP, Progress GR, atau Full Delivery COMPLETED).
                      </Text>
                    </div>
                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.financeTable}
                        columns={readyPoColumns}
                        dataSource={readyCompletedPos}
                        rowKey={(r) => r.id || r.poNumber}
                        loading={loadingPos}
                        pagination={{ pageSize: 5 }}
                        scroll={{ x: 1050 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={
                                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                                    Belum ada PO yang siap ditagihkan
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 12, color: '#64748B' }}>
                                    Seluruh termin telah diterbitkan atau belum ada PO yang memenuhi syarat penagihan termin (DP/Progress GR).
                                  </Text>
                                </div>
                              }
                            />
                          ),
                        }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: 'invoices_list',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AuditOutlined style={{ fontSize: 13 }} />
                    <span>Daftar Invoice Terbit</span>
                    <span className={`${styles.tabBadge} ${activeTabKey === 'invoices_list' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                      {invoices.length}
                    </span>
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12.5, color: '#64748B' }}>
                        Daftar seluruh faktur tagihan yang telah diterbitkan beserta hasil rekonsiliasi 3-Way Matching dan status pelunasan kas/bank.
                      </Text>
                    </div>
                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.financeTable}
                        loading={loadingInvoices}
                        columns={invoiceColumns}
                        dataSource={invoices}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 1150 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={
                                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                                    Belum ada invoice yang tercatat di sistem
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 12, color: '#64748B' }}>
                                    Data invoice penagihan akan termuat secara otomatis dari modul Finance backend.
                                  </Text>
                                </div>
                              }
                            />
                          ),
                        }}
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>

      {/* CREATE INVOICE MODAL */}
      {selectedPoForInvoice && (
        <CreateInvoiceModal
          open={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setSelectedPoForInvoice(null);
          }}
          po={selectedPoForInvoice as any}
          canCreateInvoice={canCreateInvoice}
          currentUserName={user?.fullName || user?.email || 'Finance Team'}
          onInvoiceCreated={(newInv) => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'purchase-orders'] });
            setActiveTabKey('invoices_list');
          }}
          onViewExistingInvoice={(existingInv) => {
            setSelectedInvoiceForDetail(existingInv);
            setIsDetailModalOpen(true);
          }}
        />
      )}

      {/* INVOICE DETAIL MODAL */}
      {selectedInvoiceForDetail && (
        <InvoiceDetailModal
          open={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedInvoiceForDetail(null);
          }}
          invoice={selectedInvoiceForDetail}
          onVerified={() => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] });
          }}
        />
      )}

      {/* PROCESS PAYMENT MODAL */}
      {selectedInvoiceForPay && canProcessPayment && (
        <ProcessPaymentModal
          open={isProcessPaymentModalOpen}
          onClose={() => {
            setIsProcessPaymentModalOpen(false);
            setSelectedInvoiceForPay(null);
          }}
          invoice={selectedInvoiceForPay}
          canProcessPayment={canProcessPayment}
          currentUserName={user?.fullName || user?.email || 'Finance Team'}
          onPaymentCreated={(newPayment, updatedInvoice) => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] });
          }}
          onViewReceipt={(payment) => {
            setSelectedPaymentForReceipt(payment);
            setIsReceiptModalOpen(true);
          }}
        />
      )}

      {/* PAYMENT RECEIPT MODAL (READ-ONLY) */}
      {selectedPaymentForReceipt && (
        <PaymentReceiptModal
          open={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setSelectedPaymentForReceipt(null);
          }}
          payment={selectedPaymentForReceipt}
        />
      )}

      {/* SUBMIT PAYMENT REQUEST MODAL */}
      {selectedInvoiceForPaymentRequest && (
        <SubmitPaymentRequestModal
          open={isPaymentRequestModalOpen}
          onClose={() => {
            setIsPaymentRequestModalOpen(false);
            setSelectedInvoiceForPaymentRequest(null);
          }}
          invoice={selectedInvoiceForPaymentRequest}
          activeRequest={activePaymentRequestsByInvoiceId.get(Number(selectedInvoiceForPaymentRequest.id))}
          onSubmitted={(res) => {
            queryClient.setQueryData(['finance', 'payment-requests'], (old: PaymentRequestDto[] = []) => [
              res,
              ...old.filter((x) => x.id !== res.id),
            ]);
            queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
            queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] });
          }}
        />
      )}

      {/* RESUBMIT PAYMENT REQUEST MODAL */}
      {selectedRequestForResubmit && (
        <ResubmitPaymentRequestModal
          open={isResubmitModalOpen}
          onClose={() => {
            setIsResubmitModalOpen(false);
            setSelectedRequestForResubmit(null);
          }}
          paymentRequest={selectedRequestForResubmit}
          onResubmitted={(updated) => {
            queryClient.setQueryData(['finance', 'payment-requests'], (old: PaymentRequestDto[] = []) => [
              updated,
              ...old.filter((x) => x.id !== updated.id),
            ]);
            queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
            queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] });
          }}
        />
      )}
      </div>
    </ProtectedRoute>
  );
}
