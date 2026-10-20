"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Table,
  Typography,
  Row,
  Col,
  Button,
  Tabs,
  Empty,
  Tooltip,
} from 'antd';
import {
  DollarCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  BankOutlined,
  FileProtectOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { formatNumber, formatCurrency, formatDate } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  FinanceService,
  InvoiceDto,
  PaymentDto,
  PaymentRequestDto,
} from '@/services/finance.service';
import dynamic from 'next/dynamic';
import styles from './PaymentsPage.module.css';

const ProcessPaymentModal = dynamic(
  () => import('@/components/finance/ProcessPaymentModal').then((m) => m.ProcessPaymentModal),
  { ssr: false }
);
const PaymentReceiptModal = dynamic(
  () => import('@/components/finance/PaymentReceiptModal').then((m) => m.PaymentReceiptModal),
  { ssr: false }
);
const DirectorApprovalModal = dynamic(
  () => import('@/components/finance/DirectorApprovalModal').then((m) => m.DirectorApprovalModal),
  { ssr: false }
);
const ResubmitPaymentRequestModal = dynamic(
  () => import('@/components/finance/ResubmitPaymentRequestModal').then((m) => m.ResubmitPaymentRequestModal),
  { ssr: false }
);

const { Title, Text } = Typography;

function PaymentsPageContent() {
  const { user, isFinance, isDirector } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const reqIdParam = searchParams.get('requestId');

  const canProcessPayment = isFinance;

  // Active Tab
  const [activeTabKey, setActiveTabKey] = useState<string>(() => {
    if (tabParam) return tabParam;
    if (isDirector) return 'approvals';
    return 'ready_to_pay';
  });

  // Modal States
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<InvoiceDto | null>(null);
  const [selectedRequestForPay, setSelectedRequestForPay] = useState<PaymentRequestDto | null>(null);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState<boolean>(false);

  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentDto | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<PaymentRequestDto | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);

  const [selectedRequestForResubmit, setSelectedRequestForResubmit] = useState<PaymentRequestDto | null>(null);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState<boolean>(false);

  const queryClient = useQueryClient();

  // 1. Fetch Invoices via TanStack Query (shared with /finance/invoices)
  const {
    data: invoices = [],
  } = useQuery<InvoiceDto[]>({
    queryKey: ['finance', 'invoices'],
    queryFn: () => FinanceService.getInvoices(),
    staleTime: 60000,
  });

  // 2. Fetch Payments via TanStack Query (shared with /finance/invoices)
  const {
    data: payments = [],
  } = useQuery<PaymentDto[]>({
    queryKey: ['finance', 'payments'],
    queryFn: () => FinanceService.getPayments(),
    staleTime: 60000,
  });

  // 3. Fetch Payment Requests via TanStack Query
  const {
    data: paymentRequests = [],
    isLoading: loading,
  } = useQuery<PaymentRequestDto[]>({
    queryKey: ['finance', 'payment-requests'],
    queryFn: () => FinanceService.getPaymentRequests(),
    staleTime: 60000,
  });

  // Invalidate helper to refresh all finance payment queries on mutation
  const fetchData = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] }),
    ]);
  }, [queryClient]);

  // Deep-link handler
  useEffect(() => {
    if (tabParam) {
      setActiveTabKey(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (reqIdParam && paymentRequests.length > 0) {
      const targetReq = paymentRequests.find((r) => String(r.id) === reqIdParam || r.requestNumber === reqIdParam);
      if (targetReq) {
        if (targetReq.status === 'PENDING_DIRECTOR_APPROVAL') {
          setActiveTabKey('approvals');
          setSelectedRequestForApproval(targetReq);
          setIsApprovalModalOpen(true);
        } else if (targetReq.status === 'NEEDS_REVISION') {
          if (canProcessPayment) {
            setActiveTabKey('requests');
            setSelectedRequestForResubmit(targetReq);
            setIsResubmitModalOpen(true);
          }
        } else if (targetReq.status === 'APPROVED_FOR_PAYMENT') {
          // STRICT ROLE-AWARE DEEP-LINK: ONLY FINANCE CAN AUTO-OPEN PAYMENT EXECUTION MODAL
          if (canProcessPayment) {
            setActiveTabKey('ready_to_pay');
            setSelectedRequestForPay(targetReq);
            setSelectedInvoiceForPay(targetReq.invoice || invoices.find(i => Number(i.id) === Number(targetReq.invoiceId)) || null);
            setIsProcessModalOpen(true);
          }
        }
      }
    }
  }, [reqIdParam, paymentRequests, invoices, canProcessPayment]);

  // Cross-user event sync
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (
        detail.aggregateType === 'Payment' ||
        detail.aggregateType === 'PaymentRequest' ||
        (detail.aggregateType === 'Invoice' && detail.eventName === 'finance.invoice.verified')
      ) {
        fetchData();
      }
    };

    window.addEventListener('epms:business-sync', handleSync);
    window.addEventListener('epms:reconnect-resync', fetchData);
    return () => {
      window.removeEventListener('epms:business-sync', handleSync);
      window.removeEventListener('epms:reconnect-resync', fetchData);
    };
  }, [fetchData]);

  // Filter approved requests ready for payment
  const approvedPaymentRequests = useMemo(() => {
    return paymentRequests.filter((r) => r.status === 'APPROVED_FOR_PAYMENT');
  }, [paymentRequests]);

  // Filter pending approvals for Director
  const pendingDirectorApprovals = useMemo(() => {
    return paymentRequests.filter((r) => r.status === 'PENDING_DIRECTOR_APPROVAL');
  }, [paymentRequests]);

  // Statistics
  const totalApprovedReadyCount = approvedPaymentRequests.length;
  const totalPendingDirectorCount = pendingDirectorApprovals.length;
  const totalPaidVouchersCount = payments.length;

  const totalPaidAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  // Status badge helper for Payment Requests
  const renderPaymentRequestStatus = (status: string) => {
    switch (status) {
      case 'PENDING_DIRECTOR_APPROVAL':
        return (
          <span className={styles.statusBadgePending}>
            <span className={styles.statusDotPending} />
            Menunggu Persetujuan Direktur
          </span>
        );
      case 'NEEDS_REVISION':
        return (
          <span className={styles.statusBadgeRevision}>
            <span className={styles.statusDotRevision} />
            Perlu Revisi
          </span>
        );
      case 'APPROVED_FOR_PAYMENT':
        return (
          <span className={styles.statusBadgeApproved}>
            <span className={styles.statusDotApproved} />
            Disetujui Pembayaran
          </span>
        );
      case 'PAID':
        return (
          <span className={styles.statusBadgePaid}>
            <span className={styles.statusDotPaid} />
            Lunas (PAID)
          </span>
        );
      case 'REJECTED':
        return (
          <span className={styles.statusBadgeRejected}>
            <span className={styles.statusDotRejected} />
            Ditolak
          </span>
        );
      default:
        return (
          <span className={styles.statusBadgePending}>
            <span className={styles.statusDotPending} />
            {status}
          </span>
        );
    }
  };

  // TAB 1: Columns for Tagihan Siap Dibayar (APPROVED_FOR_PAYMENT)
  const readyPaymentColumns = useMemo(
    () => [
      {
        title: 'NOMOR PENGAJUAN',
        dataIndex: 'requestNumber',
        key: 'requestNumber',
        width: 170,
        render: (reqNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#1D4ED8' }}>
            {reqNum}
          </span>
        ),
      },
      {
        title: 'NOMOR INVOICE',
        key: 'invoiceNumber',
        width: 160,
        render: (_: any, r: PaymentRequestDto) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#0F172A' }}>
            {r.invoice?.invoiceNumber || `INV #${r.invoiceId}`}
          </span>
        ),
      },
      {
        title: 'PO TERKAIT',
        key: 'poNumber',
        width: 150,
        render: (_: any, r: PaymentRequestDto) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#0F766E' }}>
            {r.invoice?.purchaseOrder?.poNumber || '—'}
          </span>
        ),
      },
      {
        title: 'VENDOR PENERIMA',
        key: 'vendor',
        render: (_: any, r: PaymentRequestDto) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>
              {r.invoice?.purchaseOrder?.vendor?.name || '—'}
            </div>
            {r.invoice?.purchaseOrder?.vendor?.code ? (
              <span className={styles.subtleCodeTag} style={{ background: '#F1F5F9', color: '#475569', marginTop: 2, display: 'inline-block' }}>
                {r.invoice.purchaseOrder.vendor.code}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        title: 'NILAI DISETUJUI',
        key: 'approvedAmount',
        align: 'right' as const,
        width: 160,
        render: (_: any, r: PaymentRequestDto) => (
          <span className={styles.currencyText} style={{ color: '#059669', fontSize: 13 }}>
            {formatCurrency(Number(r.approvedAmount || r.requestedAmount))}
          </span>
        ),
      },
      {
        title: 'STATUS PERSETUJUAN',
        dataIndex: 'status',
        key: 'status',
        width: 170,
        align: 'center' as const,
        render: () => (
          <span className={styles.statusBadgeApproved}>
            <span className={styles.statusDotApproved} />
            Siap Dibayar
          </span>
        ),
      },
      {
        title: 'DISETUJUI OLEH',
        key: 'approvedBy',
        width: 160,
        render: (_: any, r: PaymentRequestDto) => (
          <span style={{ fontSize: 12, color: '#475569' }}>
            {r.approver?.fullName || 'Direktur Utama'}
          </span>
        ),
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 170,
        align: 'center' as const,
        render: (_: any, r: PaymentRequestDto) => {
          if (!canProcessPayment) {
            return (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Siap Dibayar
              </span>
            );
          }
          if (r.status !== 'APPROVED_FOR_PAYMENT') {
            return (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                —
              </span>
            );
          }
          return (
            <Button
              size="small"
              type="primary"
              icon={<DollarCircleOutlined />}
              id={`btn-process-payment-${r.id}`}
              onClick={() => {
                setSelectedRequestForPay(r);
                setSelectedInvoiceForPay(r.invoice || invoices.find(i => Number(i.id) === Number(r.invoiceId)) || null);
                setIsProcessModalOpen(true);
              }}
              className={styles.btnActionPrimary}
            >
              PROSES PEMBAYARAN
            </Button>
          );
        },
      },
    ],
    [canProcessPayment, invoices]
  );

  // TAB 2: Columns for Pengajuan Pembayaran (Finance Tracking View)
  const paymentRequestColumns = useMemo(
    () => [
      {
        title: 'NOMOR PENGAJUAN',
        dataIndex: 'requestNumber',
        key: 'requestNumber',
        width: 170,
        render: (reqNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#1D4ED8' }}>
            {reqNum}
          </span>
        ),
      },
      {
        title: 'NOMOR INVOICE',
        key: 'invoiceNumber',
        width: 160,
        render: (_: any, r: PaymentRequestDto) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#0F172A' }}>
            {r.invoice?.invoiceNumber || `INV #${r.invoiceId}`}
          </span>
        ),
      },
      {
        title: 'VENDOR REKANAN',
        key: 'vendor',
        width: 200,
        render: (_: any, r: PaymentRequestDto) => (
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>
            {r.invoice?.purchaseOrder?.vendor?.name || '—'}
          </span>
        ),
      },
      {
        title: 'JUMLAH DIAJUKAN',
        dataIndex: 'requestedAmount',
        key: 'requestedAmount',
        align: 'right' as const,
        width: 160,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#0F172A' }}>
            {formatCurrency(Number(val))}
          </span>
        ),
      },
      {
        title: 'STATUS',
        dataIndex: 'status',
        key: 'status',
        width: 190,
        align: 'center' as const,
        render: (status: string) => renderPaymentRequestStatus(status),
      },
      {
        title: 'CATATAN / ALASAN DIREKTUR',
        key: 'notes',
        render: (_: any, r: PaymentRequestDto) => {
          if (r.status === 'NEEDS_REVISION' && r.revisionNotes) {
            return (
              <div className={styles.revisionBox}>
                <ExclamationCircleOutlined style={{ color: '#D97706', fontSize: 13, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div className={styles.revisionTitle}>Catatan Revisi Direktur</div>
                  <div className={styles.revisionText}>&quot;{r.revisionNotes}&quot;</div>
                </div>
              </div>
            );
          }
          if (r.status === 'REJECTED' && r.rejectionReason) {
            return (
              <div className={styles.revisionBox} style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                <CloseCircleOutlined style={{ color: '#DC2626', fontSize: 13, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div className={styles.revisionTitle} style={{ color: '#B91C1C' }}>Alasan Penolakan</div>
                  <div className={styles.revisionText} style={{ color: '#991B1B' }}>&quot;{r.rejectionReason}&quot;</div>
                </div>
              </div>
            );
          }
          return (
            <span
              style={{
                color: '#64748B',
                fontSize: 12,
                maxWidth: 260,
                display: 'inline-block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={r.notes || ''}
            >
              {r.notes || '—'}
            </span>
          );
        },
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 170,
        align: 'center' as const,
        render: (_: any, r: PaymentRequestDto) => {
          if (r.status === 'NEEDS_REVISION') {
            if (canProcessPayment) {
              return (
                <Button
                  size="small"
                  type="primary"
                  icon={<SyncOutlined />}
                  id={`btn-resubmit-req-${r.id}`}
                  onClick={() => {
                    setSelectedRequestForResubmit(r);
                    setIsResubmitModalOpen(true);
                  }}
                  className={styles.btnActionResubmit}
                >
                  AJUKAN ULANG
                </Button>
              );
            }
          }
          if (r.status === 'APPROVED_FOR_PAYMENT') {
            if (canProcessPayment) {
              return (
                <Button
                  size="small"
                  type="primary"
                  icon={<DollarCircleOutlined />}
                  id={`btn-pay-req-${r.id}`}
                  onClick={() => {
                    setSelectedRequestForPay(r);
                    setSelectedInvoiceForPay(r.invoice || invoices.find(i => Number(i.id) === Number(r.invoiceId)) || null);
                    setIsProcessModalOpen(true);
                  }}
                  className={styles.btnActionPrimary}
                >
                  Bayar Sekarang
                </Button>
              );
            }
          }
          return (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedRequestForApproval(r);
                setIsApprovalModalOpen(true);
              }}
              className={styles.btnActionSecondary}
            >
              Lihat Detail
            </Button>
          );
        },
      },
    ],
    [canProcessPayment, invoices]
  );

  // TAB 3: Columns for Persetujuan Direktur (Director Approver View)
  const directorApprovalColumns = useMemo(
    () => [
      {
        title: 'NOMOR PENGAJUAN',
        dataIndex: 'requestNumber',
        key: 'requestNumber',
        width: 170,
        render: (reqNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#1D4ED8' }}>
            {reqNum}
          </span>
        ),
      },
      {
        title: 'NOMOR INVOICE',
        key: 'invoiceNumber',
        width: 160,
        render: (_: any, r: PaymentRequestDto) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#0F172A' }}>
            {r.invoice?.invoiceNumber || `INV #${r.invoiceId}`}
          </span>
        ),
      },
      {
        title: 'PO TERKAIT',
        key: 'poNumber',
        width: 150,
        render: (_: any, r: PaymentRequestDto) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#0F766E' }}>
            {r.invoice?.purchaseOrder?.poNumber || '—'}
          </span>
        ),
      },
      {
        title: 'VENDOR PENERIMA',
        key: 'vendor',
        render: (_: any, r: PaymentRequestDto) => (
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#0F172A' }}>
            {r.invoice?.purchaseOrder?.vendor?.name || '—'}
          </span>
        ),
      },
      {
        title: 'JUMLAH DIAJUKAN',
        dataIndex: 'requestedAmount',
        key: 'requestedAmount',
        align: 'right' as const,
        width: 160,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#059669', fontSize: 13 }}>
            {formatCurrency(Number(val))}
          </span>
        ),
      },
      {
        title: 'PEMOHON',
        key: 'requester',
        width: 160,
        render: (_: any, r: PaymentRequestDto) => (
          <span style={{ fontSize: 12, color: '#475569' }}>
            {r.requester?.fullName || 'finance@epms.com'}
          </span>
        ),
      },
      {
        title: 'TANGGAL MASUK',
        dataIndex: 'submittedAt',
        key: 'submittedAt',
        width: 140,
        render: (d: string) => <span className={styles.idMonospace} style={{ fontSize: 12 }}>{formatDate(d)}</span>,
      },
      {
        title: 'AKSI',
        key: 'action',
        align: 'center' as const,
        width: 170,
        render: (_: any, r: PaymentRequestDto) => (
          <Button
            size="small"
            type="primary"
            icon={<FileProtectOutlined />}
            id={`btn-director-review-${r.id}`}
            onClick={() => {
              setSelectedRequestForApproval(r);
              setIsApprovalModalOpen(true);
            }}
            className={styles.btnActionReview}
          >
            Review &amp; Putuskan
          </Button>
        ),
      },
    ],
    []
  );

  // TAB 4: Columns for Riwayat Pembayaran / Voucher
  const paymentVoucherColumns = useMemo(
    () => [
      {
        title: 'NOMOR BUKTI BAYAR',
        dataIndex: 'paymentNumber',
        key: 'paymentNumber',
        width: 180,
        render: (pNum: string) => (
          <span className={styles.idMonospace} style={{ fontWeight: 700, color: '#059669' }}>
            {pNum}
          </span>
        ),
      },
      {
        title: 'NOMOR INVOICE',
        key: 'invoiceNumber',
        width: 160,
        render: (_: any, r: PaymentDto) => (
          <span className={styles.idMonospace} style={{ fontWeight: 600, color: '#1D4ED8' }}>
            {r.invoice?.invoiceNumber || `INV #${r.invoiceId}`}
          </span>
        ),
      },
      {
        title: 'NOMINAL DIBAYAR',
        dataIndex: 'amount',
        key: 'amount',
        align: 'right' as const,
        width: 160,
        render: (val: number) => (
          <span className={styles.currencyText} style={{ color: '#0F172A', fontSize: 13 }}>
            {formatCurrency(Number(val))}
          </span>
        ),
      },
      {
        title: 'TANGGAL BAYAR',
        dataIndex: 'paymentDate',
        key: 'paymentDate',
        width: 150,
        render: (d: string) => <span className={styles.idMonospace} style={{ fontSize: 12 }}>{formatDate(d)}</span>,
      },
      {
        title: 'AKSI',
        key: 'action',
        align: 'center' as const,
        width: 160,
        render: (_: any, r: PaymentDto) => (
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setSelectedPaymentForReceipt(r);
              setIsReceiptModalOpen(true);
            }}
            className={styles.btnActionReceipt}
          >
            Lihat Bukti Bayar
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'MANAGER']}>
      <div className={styles.pageContainer}>
        {/* Header Section */}
        <div className={styles.pageHeader}>
          <div>
            <Title level={3} className={styles.headerTitle}>
              Payments &amp; Kas/Bank
            </Title>
            <div className={styles.headerSubtitle}>
              Pengajuan pembayaran faktur, persetujuan Direktur, eksekusi kas/bank, dan bukti bayar (voucher).
            </div>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <Row gutter={[16, 16]} className={styles.metricsRow}>
          {/* Card 1: Menunggu Persetujuan Direktur */}
          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div>
                <div className={styles.cardHeader}>
                  <div className={styles.iconSurface} style={{ background: '#FEF3C7', color: '#D97706' }}>
                    <ClockCircleOutlined />
                  </div>
                  <span className={styles.cardLabel} title="Menunggu Persetujuan Direktur">
                    Menunggu Persetujuan Direktur
                  </span>
                </div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardValue} style={{ color: '#D97706' }}>
                    {totalPendingDirectorCount}
                  </span>
                  <span className={styles.cardUnit}>Pengajuan</span>
                </div>
              </div>
              <div className={styles.cardSubtext}>
                Antrean persetujuan Direktur
              </div>
            </div>
          </Col>

          {/* Card 2: Tagihan Siap Dibayar */}
          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div>
                <div className={styles.cardHeader}>
                  <div className={styles.iconSurface} style={{ background: '#D1FAE5', color: '#059669' }}>
                    <DollarCircleOutlined />
                  </div>
                  <span className={styles.cardLabel} title="Tagihan Siap Dibayar">
                    Tagihan Siap Dibayar
                  </span>
                </div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardValue} style={{ color: '#059669' }}>
                    {totalApprovedReadyCount}
                  </span>
                  <span className={styles.cardUnit}>Faktur</span>
                </div>
              </div>
              <div className={styles.cardSubtext}>
                Disetujui &amp; siap kas/bank
              </div>
            </div>
          </Col>

          {/* Card 3: Voucher Pelunasan Selesai */}
          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div>
                <div className={styles.cardHeader}>
                  <div className={styles.iconSurface} style={{ background: '#E0E7FF', color: '#4F46E5' }}>
                    <CheckCircleOutlined />
                  </div>
                  <span className={styles.cardLabel} title="Voucher Pelunasan Selesai">
                    Voucher Pelunasan Selesai
                  </span>
                </div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardValue} style={{ color: '#0F172A' }}>
                    {totalPaidVouchersCount}
                  </span>
                  <span className={styles.cardUnit}>Voucher</span>
                </div>
              </div>
              <div className={styles.cardSubtext}>
                Status lunas (PAID)
              </div>
            </div>
          </Col>

          {/* Card 4: Total Realisasi Kas Keluar */}
          <Col xs={24} sm={12} md={12} xl={6}>
            <div className={styles.summaryCard}>
              <div>
                <div className={styles.cardHeader}>
                  <div className={styles.iconSurface} style={{ background: '#F1F5F9', color: '#0F172A' }}>
                    <BankOutlined />
                  </div>
                  <span className={styles.cardLabel} title="Total Realisasi Kas Keluar">
                    Total Realisasi Kas Keluar
                  </span>
                </div>
                <div className={styles.cardValueRow}>
                  <span className={styles.cardCurrencyPrefix}>Rp</span>
                  <span className={styles.cardValue}>
                    {formatNumber(totalPaidAmount)}
                  </span>
                </div>
              </div>
              <div className={styles.cardSubtext}>
                Total kas/bank keluar
              </div>
            </div>
          </Col>
        </Row>

        {/* Main Tabs Container */}
        <div className={styles.tabsCard}>
          <Tabs
            className={styles.paymentsTabs}
            activeKey={activeTabKey}
            onChange={setActiveTabKey}
            items={[
              {
                key: 'ready_to_pay',
                label: (
                  <span>
                    <DollarCircleOutlined style={{ marginRight: 6 }} />
                    Tagihan Siap Dibayar
                    <span className={`${styles.tabBadge} ${activeTabKey === 'ready_to_pay' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                      {totalApprovedReadyCount}
                    </span>
                  </span>
                ),
                children: (
                  <div>
                    <div className={styles.tabDescBar}>
                      Daftar pengajuan pembayaran yang telah disetujui Direktur (<strong style={{ color: '#059669' }}>APPROVED_FOR_PAYMENT</strong>) dan siap dieksekusi kas/bank oleh Tim Finance.
                    </div>
                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.paymentsTable}
                        columns={readyPaymentColumns}
                        dataSource={approvedPaymentRequests}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 1050 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={<span style={{ color: '#64748B', fontSize: 13 }}>Tidak ada tagihan yang siap dibayar saat ini.</span>}
                            />
                          ),
                        }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: 'requests',
                label: (
                  <span>
                    <SendOutlined style={{ marginRight: 6 }} />
                    Daftar Pengajuan Pembayaran
                    <span className={`${styles.tabBadge} ${activeTabKey === 'requests' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                      {paymentRequests.length}
                    </span>
                  </span>
                ),
                children: (
                  <div>
                    <div className={styles.tabDescBar}>
                      Status seluruh pengajuan pembayaran: Menunggu Persetujuan Direktur, Perlu Revisi, Disetujui, atau Lunas.
                    </div>
                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.paymentsTable}
                        columns={paymentRequestColumns}
                        dataSource={paymentRequests}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 1050 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={<span style={{ color: '#64748B', fontSize: 13 }}>Belum ada riwayat pengajuan pembayaran yang terekam.</span>}
                            />
                          ),
                        }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: 'approvals',
                label: (
                  <span>
                    <FileProtectOutlined style={{ marginRight: 6 }} />
                    Persetujuan Direktur
                    <span className={`${styles.tabBadge} ${activeTabKey === 'approvals' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                      {totalPendingDirectorCount}
                    </span>
                  </span>
                ),
                children: (
                  <div>
                    <div className={styles.tabDescBar}>
                      Antrean verifikasi Direktur Utama untuk meninjau data faktur, PO, termin, dan memberikan persetujuan pembayaran kas/bank.
                    </div>
                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.paymentsTable}
                        columns={directorApprovalColumns}
                        dataSource={pendingDirectorApprovals}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 1050 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={<span style={{ color: '#64748B', fontSize: 13 }}>Tidak ada pengajuan yang membutuhkan persetujuan Direktur saat ini.</span>}
                            />
                          ),
                        }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: 'payment_vouchers',
                label: (
                  <span>
                    <CheckCircleOutlined style={{ marginRight: 6 }} />
                    Riwayat Pembayaran / Voucher
                    <span className={`${styles.tabBadge} ${activeTabKey === 'payment_vouchers' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                      {payments.length}
                    </span>
                  </span>
                ),
                children: (
                  <div>
                    <div className={styles.tabDescBar}>
                      Arsip resmi seluruh bukti pembayaran kas/bank (<code className={styles.subtleCodeTag} style={{ background: '#E2E8F0', color: '#1E293B' }}>PAY-XXX</code>) yang telah terekam di sistem EPMS.
                    </div>
                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.paymentsTable}
                        columns={paymentVoucherColumns}
                        dataSource={payments}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 950 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={<span style={{ color: '#64748B', fontSize: 13 }}>Belum ada riwayat bukti pembayaran yang terekam.</span>}
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

        {/* PROCESS PAYMENT MODAL */}
        {selectedInvoiceForPay && canProcessPayment && (
          <ProcessPaymentModal
            open={isProcessModalOpen}
            onClose={() => {
              setIsProcessModalOpen(false);
              setSelectedInvoiceForPay(null);
              setSelectedRequestForPay(null);
            }}
            invoice={selectedInvoiceForPay as any}
            paymentRequest={selectedRequestForPay}
            canProcessPayment={canProcessPayment}
            currentUserName={user?.fullName || user?.email || 'Finance Team'}
            onPaymentCreated={() => {
              fetchData();
              setActiveTabKey('payment_vouchers');
            }}
            onViewReceipt={(payment) => {
              setSelectedPaymentForReceipt(payment as any);
              setIsReceiptModalOpen(true);
            }}
          />
        )}

        {/* PAYMENT RECEIPT MODAL */}
        {selectedPaymentForReceipt && (
          <PaymentReceiptModal
            open={isReceiptModalOpen}
            onClose={() => {
              setIsReceiptModalOpen(false);
              setSelectedPaymentForReceipt(null);
            }}
            payment={selectedPaymentForReceipt as any}
          />
        )}

        {/* DIRECTOR APPROVAL MODAL */}
        {selectedRequestForApproval && (
          <DirectorApprovalModal
            open={isApprovalModalOpen}
            onClose={() => {
              setIsApprovalModalOpen(false);
              setSelectedRequestForApproval(null);
            }}
            paymentRequest={selectedRequestForApproval}
            onDecisionMade={() => {
              fetchData();
            }}
          />
        )}

        {/* FINANCE RESUBMIT MODAL */}
        {selectedRequestForResubmit && (
          <ResubmitPaymentRequestModal
            open={isResubmitModalOpen}
            onClose={() => {
              setIsResubmitModalOpen(false);
              setSelectedRequestForResubmit(null);
            }}
            paymentRequest={selectedRequestForResubmit}
            onResubmitted={() => {
              fetchData();
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Memuat workstation pembayaran...</div>}>
      <PaymentsPageContent />
    </Suspense>
  );
}
