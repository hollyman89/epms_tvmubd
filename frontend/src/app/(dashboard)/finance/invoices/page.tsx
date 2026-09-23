"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { FinanceService, InvoiceDto } from '@/services/finance.service';
import { ProcurementService, PurchaseOrder } from '@/services/procurement.service';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CreateInvoiceModal } from '@/components/finance/CreateInvoiceModal';
import { InvoiceDetailModal } from '@/components/finance/InvoiceDetailModal';
import {
  ProcessPaymentModal,
} from '@/components/finance/ProcessPaymentModal';
import { PaymentReceiptModal } from '@/components/finance/PaymentReceiptModal';
import { PaymentDto } from '@/services/finance.service';

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

  if (isDp) {
    if (!['ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED'].includes(po.status)) {
      msPassed = false;
      msReason = `Status PO (${po.status}) belum siap untuk penagihan DP`;
    }
  } else if (isProg) {
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
  } else if (isRet) {
    if (po.status !== 'COMPLETED') {
      msPassed = false;
      msReason = 'Termin retensi hanya dapat ditagihkan setelah Purchase Order berstatus COMPLETED';
    }
  }

  // 4. Financial Capacity Gate (for Progress terms)
  let capPassed = true;
  let capReason = '';
  if (isProg) {
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
  const { user, isFinance, isSuperAdmin } = useAuth();
  const canCreateInvoice = isFinance || isSuperAdmin;
  const canProcessPayment = useMemo(() => {
    const authorizedRoles = ['FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'];
    return (user?.roles || []).some((r) => authorizedRoles.includes(r));
  }, [user]);

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

  // Version counter for reactive updates
  const [invoiceVersion, setInvoiceVersion] = useState<number>(0);
  const [poVersion, setPoVersion] = useState<number>(0);

  // 1. Fetch All POs from Canonical Backend SSOT API (ProcurementService)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loadingPos, setLoadingPos] = useState<boolean>(true);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingPos(true);
    try {
      const data = await ProcurementService.getPurchaseOrders();
      setPurchaseOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch purchase orders from backend SSOT:', err);
    } finally {
      setLoadingPos(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders, poVersion]);

  // 2. Fetch Invoices and Goods Receipts from Authoritative Backend SSOT API
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentDto[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(true);

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const [invoiceData, paymentData, grData] = await Promise.all([
        FinanceService.getInvoices().catch(() => []),
        FinanceService.getPayments().catch(() => []),
        ProcurementService.getGoodsReceipts().catch(() => []),
      ]);
      setInvoices(invoiceData || []);
      setAllPayments(paymentData || []);
      setGoodsReceipts(grData || []);
    } catch (err) {
      console.error('Failed to fetch invoices/payments/GRs from backend:', err);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices, invoiceVersion]);


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
        render: (_: any, r: PurchaseOrder) => {
          const statusColor =
            r.status === 'COMPLETED'
              ? 'green'
              : r.status === 'PARTIALLY_FULFILLED'
              ? 'cyan'
              : r.status === 'ISSUED'
              ? 'blue'
              : 'default';

          return (
            <div>
              <span style={{ fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {r.poNumber}
              </span>
              <div>
                <Tag color={statusColor} style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2, padding: '0 4px' }}>
                  ● {r.status}
                </Tag>
              </div>
            </div>
          );
        },
      },
      {
        title: 'Proyek',
        key: 'project',
        render: (_: any, r: PurchaseOrder) => {
          const projectName = r.purchaseRequest?.project?.name || (r as any).projectName || 'Proyek Tanpa Nama';
          const projectId = r.purchaseRequest?.project?.id || (r as any).projectId;
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{projectName}</div>
              {projectId ? (
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                  Project ID #{projectId}
                </Tag>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Vendor Penyedia',
        key: 'vendor',
        render: (_: any, r: PurchaseOrder) => {
          const vendorName = r.vendor?.name || (r as any).vendorName || 'Vendor Tidak Tercatat';
          const vendorCode = r.vendor?.code || (r as any).vendorCode || '';
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#0f766e' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {vendorName}
              </div>
              {vendorCode ? (
                <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                  {vendorCode}
                </Tag>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Total Kontrak PO',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        align: 'right' as const,
        render: (val: number) => (
          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5, color: '#059669' }}>
            Rp {Number(val || 0).toLocaleString('id-ID')}
          </span>
        ),
      },
      {
        title: 'Status Realisasi Fisik',
        key: 'fulfillment',
        render: (_: any, r: PurchaseOrder) => {
          const totalOrdered = (r.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);
          const totalReceived = (r.items || []).reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0);
          const isFullyReceived = totalReceived >= totalOrdered && totalOrdered > 0;

          return (
            <div>
              <Tag color={isFullyReceived ? 'green' : totalReceived > 0 ? 'processing' : 'orange'} style={{ fontWeight: 700, margin: 0 }}>
                {isFullyReceived ? '✅ 100% DITERIMA' : totalReceived > 0 ? '📦 PARSIAL' : '⏳ MENUNGGU PENGIRIMAN'}
              </Tag>
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                {totalReceived}/{totalOrdered} Unit {totalReceived > 0 ? '• GR Tercatat' : '• Belum ada GR'}
              </div>
            </div>
          );
        },
      },
      {
        title: 'Status Penagihan',
        key: 'invoiceStatus',
        width: 190,
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
                      color={elig.tagColor}
                      style={{ fontWeight: 700, margin: 0, cursor: elig.reason ? 'help' : 'default' }}
                    >
                      ⏳ {elig.statusText}
                    </Tag>
                  </Tooltip>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                    {invoicedCount}/{terms.length} Termin Terbit
                  </div>
                </div>
              );
            }

            return (
              <div>
                <Tag color="purple" style={{ fontWeight: 700, margin: 0 }}>
                  ● SEMUA TERMIN TERBIT
                </Tag>
                <div style={{ fontSize: 10.5, color: '#6b21a8', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                  {invoicedCount}/{terms.length} Invoice
                </div>
              </div>
            );
          }

          // Legacy / Non-term PO
          if (poInvoices.length > 0) {
            return (
              <div>
                <Tag color="purple" style={{ fontWeight: 700, margin: 0 }}>
                  ● INVOICED
                </Tag>
                <div style={{ fontSize: 10.5, color: '#6b21a8', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                  {poInvoices[0].invoiceNumber}
                </div>
              </div>
            );
          }

          return (
            <Tag color="gold" style={{ fontWeight: 600, margin: 0 }}>
              ⏳ Belum Ditagihkan
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
            <Space size={6}>
              {nextPendingTerm && (
                <Tooltip title={!canSubmitAction ? buttonTitle : undefined}>
                  <span>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      disabled={!canSubmitAction}
                      onClick={() => {
                        if (!canSubmitAction) return;
                        setSelectedPoForInvoice(r);
                        setIsCreateModalOpen(true);
                      }}
                      style={{
                        backgroundColor: canSubmitAction ? '#059669' : undefined,
                        borderColor: canSubmitAction ? '#059669' : undefined,
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
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
                  style={{
                    borderColor: '#9333ea',
                    color: '#9333ea',
                    background: '#faf5ff',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
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
        render: (invNum: string) => (
          <span style={{ fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
            {invNum}
          </span>
        ),
      },
      {
        title: 'Nomor PO Terkait',
        key: 'poNumber',
        render: (_: any, r: InvoiceDto) => {
          const poNum = r.purchaseOrder?.poNumber || (r.poId ? `PO #${r.poId}` : '—');
          return (
            <span style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'monospace' }}>
              {poNum}
            </span>
          );
        },
      },
      {
        title: 'Vendor Penyedia',
        key: 'vendor',
        render: (_: any, r: InvoiceDto) => {
          const vName = r.purchaseOrder?.vendor?.name || (r as any).vendorName || '—';
          const vCode = r.purchaseOrder?.vendor?.code || (r as any).vendorCode;
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{vName}</div>
              {vCode && (
                <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                  {vCode}
                </Tag>
              )}
            </div>
          );
        },
      },
      {
        title: 'Total Tagihan',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        align: 'right' as const,
        render: (val: number) => (
          <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 12.5, color: '#059669' }}>
            Rp {Number(val || 0).toLocaleString('id-ID')}
          </span>
        ),
      },
      {
        title: 'Status Rekonsiliasi',
        dataIndex: 'matchStatus',
        key: 'matchStatus',
        width: 155,
        align: 'center' as const,
        render: (status: string) => {
          if (status === 'VERIFIED') {
            return (
              <Tag color="green" style={{ fontWeight: 700 }}>
                <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                VERIFIED
              </Tag>
            );
          }
          if (status === 'MATCHED') {
            return (
              <Tag color="cyan" style={{ fontWeight: 700 }}>
                <CheckCircleOutlined style={{ marginRight: 4 }} />
                MATCHED
              </Tag>
            );
          }
          if (status === 'MISMATCH' || status === 'MISMATCHED') {
            return (
              <Tag color="red" style={{ fontWeight: 700 }}>
                <CloseCircleOutlined style={{ marginRight: 4 }} />
                MISMATCH
              </Tag>
            );
          }
          if (status === 'REJECTED') {
            return (
              <Tag color="magenta" style={{ fontWeight: 700 }}>
                <CloseOutlined style={{ marginRight: 4 }} />
                REJECTED
              </Tag>
            );
          }
          return (
            <Tag color="gold" style={{ fontWeight: 700 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {status || 'PENDING'}
            </Tag>
          );
        },
      },
      {
        title: 'Status Bayar',
        dataIndex: 'paymentStatus',
        key: 'paymentStatus',
        width: 120,
        align: 'center' as const,
        render: (status: string) => (
          <Tag color={status === 'PAID' ? 'green' : status === 'PARTIALLY_PAID' ? 'blue' : 'orange'} style={{ fontWeight: 700 }}>
            ● {status || 'UNPAID'}
          </Tag>
        ),
      },
      {
        title: 'Tanggal Terbit',
        key: 'invoiceDate',
        render: (_: any, r: InvoiceDto) => {
          const date = r.invoiceDate || r.createdAt;
          return date ? dayjs(date).format('DD MMM YYYY') : '—';
        },
      },
      {
        title: 'Penerbit',
        dataIndex: 'createdBy',
        key: 'createdBy',
        render: (by: any) => <span style={{ fontSize: 11, color: '#64748b' }}>{by ? `User #${by}` : 'Finance Team'}</span>,
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 220,
        align: 'center' as const,
        render: (_: any, r: InvoiceDto) => {
          const isVerifiedOrMatched = r.matchStatus === 'VERIFIED' || r.matchStatus === 'MATCHED';
          const isPaid = r.paymentStatus === 'PAID';
          const paymentRecord = isPaid
            ? allPayments.find((p) => Number(p.invoiceId) === Number(r.id)) || null
            : null;

          return (
            <Space size={6} wrap>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedInvoiceForDetail(r);
                  setIsDetailModalOpen(true);
                }}
                style={{
                  borderColor: '#2563eb',
                  color: '#2563eb',
                  background: '#eff6ff',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                Lihat Invoice
              </Button>

              {isVerifiedOrMatched && !isPaid && (
                <Button
                  size="small"
                  type="primary"
                  icon={<DollarCircleOutlined />}
                  disabled={!canCreateInvoice}
                  onClick={() => {
                    setSelectedInvoiceForPay(r);
                    setIsProcessPaymentModalOpen(true);
                  }}
                  style={{
                    backgroundColor: canCreateInvoice ? '#059669' : undefined,
                    borderColor: canCreateInvoice ? '#059669' : undefined,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  Proses Bayar
                </Button>
              )}

              {isPaid && paymentRecord && (
                <Button
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setSelectedPaymentForReceipt(paymentRecord);
                    setIsReceiptModalOpen(true);
                  }}
                  style={{
                    borderColor: '#059669',
                    color: '#059669',
                    background: '#ecfdf5',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  Bukti Bayar
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [canCreateInvoice, allPayments]
  );

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PROCUREMENT', 'PURCHASING']}>
      <div style={{ padding: 24 }}>
      {/* Header Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
              Finance Invoicing &amp; 3-Way Matching Workstation
            </Title>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>
              Verifikasi faktur tagihan vendor berbasis Purchase Order (DP, Progress GR, atau COMPLETED) dan rekonsiliasi fisik Goods Receipt (GR).
            </Text>
          </div>

          <Tag color="blue" style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
            Role Akses: {user?.roles?.join(', ') || 'FINANCE'}
          </Tag>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Antrean PO Siap Ditagihkan</span>}
              value={pendingInvoicePosCount}
              prefix={<FileTextOutlined style={{ color: '#2563eb' }} />}
              suffix={<span style={{ fontSize: 11, color: '#94a3b8' }}>PO</span>}
              valueStyle={{ fontWeight: 700, color: '#1e293b' }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              {monitoredPosCount > 0
                ? `${monitoredPosCount} PO Dalam Pemantauan Milestone`
                : `${pendingInvoicePosCount} PO Siap Diterbitkan Faktur`}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Invoice Diterbitkan</span>}
              value={invoices.length}
              prefix={<SendOutlined style={{ color: '#059669' }} />}
              suffix={<span style={{ fontSize: 11, color: '#94a3b8' }}>Faktur</span>}
              valueStyle={{ fontWeight: 700, color: '#059669' }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              {verifiedInvoicesCount} VERIFIED, {matchedInvoicesCount} MATCHED
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Total Nilai Penagihan (100% PO)</span>}
              value={totalInvoicedValue}
              precision={0}
              prefix={<span style={{ fontSize: 13, marginRight: 2 }}>Rp</span>}
              valueStyle={{ fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Sesuai Snapshot Kontrak Pemenang
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Status Pembayaran</span>}
              value={`${paidInvoicesCount}/${invoices.length} LUNAS`}
              prefix={<CheckCircleOutlined style={{ color: paidInvoicesCount > 0 ? '#059669' : '#d97706' }} />}
              valueStyle={{
                fontWeight: 700,
                color: paidInvoicesCount > 0 ? '#059669' : '#d97706',
                fontSize: 16,
              }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              {paidInvoicesCount} Faktur Telah Dilunasi Kas/Bank
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs Container */}
      <Card
        size="small"
        style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}
        bodyStyle={{ padding: '8px 16px 16px' }}
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          items={[
            {
              key: 'ready_pos',
              label: (
                <Space size={6}>
                  <FileTextOutlined />
                  <span>PO Siap Ditagihkan</span>
                  <Badge count={pendingInvoicePosCount} overflowCount={99} style={{ backgroundColor: '#059669' }} />
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Daftar Purchase Order yang memenuhi syarat penagihan termin (DP, Progress GR, atau Full Delivery COMPLETED).
                    </Text>
                  </div>
                  <Table
                    columns={readyPoColumns}
                    dataSource={readyCompletedPos}
                    rowKey={(r) => r.id || r.poNumber}
                    loading={loadingPos}
                    pagination={{ pageSize: 5 }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                                Belum ada PO yang siap ditagihkan
                              </div>
                              <Text type="secondary" style={{ fontSize: 11.5 }}>
                                Seluruh termin telah diterbitkan atau belum ada PO yang memenuhi syarat penagihan termin (DP/Progress GR).
                              </Text>
                            </div>
                          }
                        />
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'invoices_list',
              label: (
                <Space size={6}>
                  <AuditOutlined />
                  <span>Daftar Invoice Terbit</span>
                  <Badge count={invoices.length} overflowCount={99} style={{ backgroundColor: '#2563eb' }} />
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Daftar seluruh faktur tagihan yang telah diterbitkan beserta hasil rekonsiliasi 3-Way Matching dan status pelunasan kas/bank.
                    </Text>
                  </div>
                  <Table
                    loading={loadingInvoices}
                    columns={invoiceColumns}
                    dataSource={invoices}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                                Belum ada invoice yang tercatat di sistem
                              </div>
                              <Text type="secondary" style={{ fontSize: 11.5 }}>
                                Data invoice penagihan akan termuat secara otomatis dari modul Finance backend.
                              </Text>
                            </div>
                          }
                        />
                      ),
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

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
            fetchInvoices();
            fetchPurchaseOrders();
            setPoVersion((v) => v + 1);
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
            fetchInvoices();
          }}
        />
      )}

      {/* PROCESS PAYMENT MODAL */}
      {selectedInvoiceForPay && (
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
            setInvoiceVersion((v) => v + 1);
            fetchInvoices();
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
      </div>
    </ProtectedRoute>
  );
}
