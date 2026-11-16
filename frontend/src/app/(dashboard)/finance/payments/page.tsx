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
  Tag,
  Input,
  Select,
  Modal,
  message,
  Space,
  Radio,
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
  EditOutlined,
  StarOutlined,
  HistoryOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { formatNumber, formatCurrency, formatDate } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  FinanceService,
  InvoiceDto,
  PaymentDto,
  PaymentRequestDto,
  CompanyBankAccountDto,
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
const ManageCompanyBankAccountModal = dynamic(
  () => import('@/components/finance/ManageCompanyBankAccountModal').then((m) => m.ManageCompanyBankAccountModal),
  { ssr: false }
);
const CompanyBankAccountHistoryModal = dynamic(
  () => import('@/components/finance/CompanyBankAccountHistoryModal').then((m) => m.CompanyBankAccountHistoryModal),
  { ssr: false }
);

const { Title, Text } = Typography;
const { Option } = Select;

function PaymentsPageContent() {
  const { user, isFinance, isDirector, isSuperAdmin } = useAuth();
  const isAdmin = useMemo(() => (user?.roles || []).some(r => String(r).toUpperCase() === 'ADMIN'), [user]);
  const canManageAccounts = isSuperAdmin || isAdmin;
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

  // Company Bank Account Master Data States
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState<CompanyBankAccountDto | null>(null);
  const [isManageAccountModalOpen, setIsManageAccountModalOpen] = useState<boolean>(false);
  const [selectedAccountForHistory, setSelectedAccountForHistory] = useState<CompanyBankAccountDto | null>(null);
  const [isAccountHistoryModalOpen, setIsAccountHistoryModalOpen] = useState<boolean>(false);
  const [accountSearchText, setAccountSearchText] = useState<string>('');
  const [accountEntityFilter, setAccountEntityFilter] = useState<string>('ALL');
  const [accountStatusFilter, setAccountStatusFilter] = useState<string>('ALL');
  const [statusActionTarget, setStatusActionTarget] = useState<{ id: number; action: string; title: string } | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState<string>('');
  const [submittingStatus, setSubmittingStatus] = useState<boolean>(false);

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

  // 4. Fetch Company Bank Accounts via TanStack Query
  const {
    data: companyBankAccounts = [],
    isLoading: loadingAccounts,
  } = useQuery<CompanyBankAccountDto[]>({
    queryKey: ['finance', 'company-bank-accounts'],
    queryFn: () => FinanceService.getCompanyBankAccounts(),
    staleTime: 60000,
  });

  // Invalidate helper to refresh all finance payment queries on mutation
  const fetchData = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['finance', 'payment-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['finance', 'company-bank-accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] }),
    ]);
  }, [queryClient]);

  const filteredCompanyBankAccounts = useMemo(() => {
    return companyBankAccounts.filter((acc) => {
      if (accountEntityFilter !== 'ALL' && acc.companyCode !== accountEntityFilter) return false;
      if (accountStatusFilter !== 'ALL' && acc.status !== accountStatusFilter) return false;
      if (accountSearchText.trim().length > 0) {
        const term = accountSearchText.trim().toLowerCase();
        const match =
          acc.bankName.toLowerCase().includes(term) ||
          acc.accountNumber.toLowerCase().includes(term) ||
          acc.accountHolderName.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [companyBankAccounts, accountEntityFilter, accountStatusFilter, accountSearchText]);

  const handleStatusActionSubmit = async () => {
    if (!statusActionTarget) return;
    if (!statusChangeReason || statusChangeReason.trim().length < 5) {
      message.error('Alasan perubahan wajib diisi minimal 5 karakter untuk rekam audit');
      return;
    }
    setSubmittingStatus(true);
    try {
      if (statusActionTarget.action === 'ACTIVATE') {
        await FinanceService.activateCompanyBankAccount(statusActionTarget.id, statusChangeReason.trim());
        message.success('Rekening bank berhasil diaktifkan');
      } else if (statusActionTarget.action === 'DEACTIVATE') {
        await FinanceService.deactivateCompanyBankAccount(statusActionTarget.id, statusChangeReason.trim());
        message.success('Rekening bank berhasil dinonaktifkan');
      } else if (statusActionTarget.action === 'BLOCK') {
        await FinanceService.blockCompanyBankAccount(statusActionTarget.id, statusChangeReason.trim());
        message.success('Rekening bank berhasil diblokir');
      } else if (statusActionTarget.action === 'SET_DEFAULT') {
        await FinanceService.setDefaultCompanyBankAccount(statusActionTarget.id, statusChangeReason.trim());
        message.success('Rekening utama (default) berhasil ditetapkan');
      }
      setStatusActionTarget(null);
      setStatusChangeReason('');
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Gagal mengubah status rekening';
      message.error(msg);
    } finally {
      setSubmittingStatus(false);
    }
  };

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

  const companyBankAccountColumns = useMemo(
    () => [
      {
        title: 'ENTITAS',
        dataIndex: 'companyCode',
        key: 'companyCode',
        width: 110,
        render: (code: string) =>
          code === 'TVM' ? (
            <Tag color="cyan" style={{ fontWeight: 700 }}>
              PT TVM
            </Tag>
          ) : (
            <Tag color="blue" style={{ fontWeight: 700 }}>
              PT UBD
            </Tag>
          ),
      },
      {
        title: 'BANK & NOMOR REKENING',
        key: 'bankAndAccount',
        width: 260,
        render: (_: any, record: CompanyBankAccountDto) => {
          const masked =
            record.accountNumber.length > 4
              ? '••••••' + record.accountNumber.slice(-4)
              : record.accountNumber;
          return (
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                {record.bankName}
                {record.isDefault && (
                  <Tag color="gold" style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                    UTAMA
                  </Tag>
                )}
              </div>
              <div style={{ fontFamily: 'monospace', color: '#1d4ed8', fontSize: 13, fontWeight: 600 }}>
                {masked}
              </div>
              {record.bankCode && (
                <div style={{ fontSize: 11, color: '#64748b' }}>Kode Bank: {record.bankCode}</div>
              )}
            </div>
          );
        },
      },
      {
        title: 'ATAS NAMA (PEMILIK)',
        dataIndex: 'accountHolderName',
        key: 'accountHolderName',
        width: 200,
        render: (val: string) => (
          <span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>{val}</span>
        ),
      },
      {
        title: 'JENIS & PERUNTUKAN',
        key: 'typeAndPurpose',
        width: 200,
        render: (_: any, record: CompanyBankAccountDto) => (
          <div>
            <Tag color="geekblue" style={{ fontSize: 11, margin: '2px 0' }}>
              {record.accountPurpose}
            </Tag>
            <div style={{ fontSize: 11, color: '#64748b' }}>{record.accountType} ({record.currency})</div>
          </div>
        ),
      },
      {
        title: 'MASA BERLAKU',
        key: 'validity',
        width: 170,
        render: (_: any, record: CompanyBankAccountDto) => (
          <div style={{ fontSize: 11.5, color: '#475569' }}>
            <div>Sejak: {formatDate(record.effectiveDate)}</div>
            <div>
              Sampai: {record.expiryDate ? formatDate(record.expiryDate) : <span style={{ color: '#059669', fontWeight: 600 }}>Tanpa Batas</span>}
            </div>
          </div>
        ),
      },
      {
        title: 'STATUS',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: string) => {
          if (status === 'ACTIVE') return <Tag color="success" style={{ fontWeight: 700 }}>AKTIF</Tag>;
          if (status === 'INACTIVE') return <Tag color="warning" style={{ fontWeight: 700 }}>NONAKTIF</Tag>;
          return <Tag color="error" style={{ fontWeight: 700 }}>DIBLOKIR</Tag>;
        },
      },
      {
        title: 'AKSI',
        key: 'action',
        width: 200,
        render: (_: any, record: CompanyBankAccountDto) => (
          <Space size={4} wrap>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                setSelectedAccountForHistory(record);
                setIsAccountHistoryModalOpen(true);
              }}
              style={{ borderRadius: 4, fontSize: 11 }}
            >
              Riwayat
            </Button>
            {canManageAccounts && (
              <>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedAccountForEdit(record);
                    setIsManageAccountModalOpen(true);
                  }}
                  style={{ borderRadius: 4, fontSize: 11 }}
                >
                  Edit
                </Button>
                {record.status === 'ACTIVE' && !record.isDefault && (
                  <Button
                    size="small"
                    icon={<StarOutlined />}
                    onClick={() => {
                      setStatusActionTarget({
                        id: record.id,
                        action: 'SET_DEFAULT',
                        title: `Jadikan Rekening Utama — ${record.bankName} (${record.accountNumber})`,
                      });
                      setStatusChangeReason('');
                    }}
                    style={{ borderRadius: 4, fontSize: 11, color: '#d97706', borderColor: '#fcd34d' }}
                  >
                    Utama
                  </Button>
                )}
                {record.status === 'ACTIVE' ? (
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setStatusActionTarget({
                        id: record.id,
                        action: 'DEACTIVATE',
                        title: `Nonaktifkan Rekening — ${record.bankName} (${record.accountNumber})`,
                      });
                      setStatusChangeReason('');
                    }}
                    style={{ borderRadius: 4, fontSize: 11 }}
                  >
                    Nonaktif
                  </Button>
                ) : (
                  <Button
                    size="small"
                    style={{ borderRadius: 4, fontSize: 11, color: '#059669', borderColor: '#a7f3d0' }}
                    onClick={() => {
                      setStatusActionTarget({
                        id: record.id,
                        action: 'ACTIVATE',
                        title: `Aktifkan Rekening — ${record.bankName} (${record.accountNumber})`,
                      });
                      setStatusChangeReason('');
                    }}
                  >
                    Aktifkan
                  </Button>
                )}
              </>
            )}
          </Space>
        ),
      },
    ],
    [canManageAccounts]
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
              {
                key: 'company_bank_accounts',
                label: (
                  <span>
                    <BankOutlined style={{ marginRight: 6 }} />
                    Rekening Bank Perusahaan
                    <span className={`${styles.tabBadge} ${activeTabKey === 'company_bank_accounts' ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                      {companyBankAccounts.length}
                    </span>
                  </span>
                ),
                children: (
                  <div>
                    <div className={styles.tabDescBar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        Master data rekening kas/bank resmi <strong>PT UBD</strong> dan <strong>PT TVM</strong> sebagai sumber dana eksekusi pembayaran vendor.
                      </div>
                      {canManageAccounts && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setSelectedAccountForEdit(null);
                            setIsManageAccountModalOpen(true);
                          }}
                          style={{ background: '#2563EB', borderColor: '#2563EB', fontWeight: 600 }}
                        >
                          Tambah Rekening
                        </Button>
                      )}
                    </div>

                    {/* Filter and Search Bar */}
                    <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Entitas:</span>
                        <Radio.Group
                          value={accountEntityFilter}
                          onChange={(e) => setAccountEntityFilter(e.target.value)}
                          size="small"
                          buttonStyle="solid"
                        >
                          <Radio.Button value="ALL">Semua</Radio.Button>
                          <Radio.Button value="UBD">PT UBD</Radio.Button>
                          <Radio.Button value="TVM">PT TVM</Radio.Button>
                        </Radio.Group>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Status:</span>
                        <Radio.Group
                          value={accountStatusFilter}
                          onChange={(e) => setAccountStatusFilter(e.target.value)}
                          size="small"
                          buttonStyle="solid"
                        >
                          <Radio.Button value="ALL">Semua</Radio.Button>
                          <Radio.Button value="ACTIVE">Aktif</Radio.Button>
                          <Radio.Button value="INACTIVE">Nonaktif</Radio.Button>
                          <Radio.Button value="BLOCKED">Diblokir</Radio.Button>
                        </Radio.Group>
                      </div>

                      <div style={{ flex: 1, minWidth: 200 }}>
                        <Input
                          placeholder="Cari bank, nomor rekening, atau pemilik..."
                          value={accountSearchText}
                          onChange={(e) => setAccountSearchText(e.target.value)}
                          allowClear
                          size="small"
                          prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                        />
                      </div>
                    </div>

                    <div className={styles.tableContainer}>
                      <Table
                        className={styles.paymentsTable}
                        columns={companyBankAccountColumns}
                        dataSource={filteredCompanyBankAccounts}
                        rowKey="id"
                        loading={loadingAccounts}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 1100 }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={<span style={{ color: '#64748B', fontSize: 13 }}>Belum ada data rekening bank perusahaan yang cocok.</span>}
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

        {/* STATUS ACTION REASON MODAL */}
        <Modal
          title={statusActionTarget?.title || 'Konfirmasi Tindakan'}
          open={!!statusActionTarget}
          onOk={handleStatusActionSubmit}
          onCancel={() => {
            setStatusActionTarget(null);
            setStatusChangeReason('');
          }}
          confirmLoading={submittingStatus}
          okText="Konfirmasi"
          cancelText="Batal"
          okButtonProps={{ danger: statusActionTarget?.action === 'DEACTIVATE' || statusActionTarget?.action === 'BLOCK' }}
          destroyOnClose
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 12 }}>
              Perubahan status rekening kas/bank perusahaan wajib disertai alasan bisnis yang sah untuk dicatat dalam log audit resmi.
            </p>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#0F172A' }}>
              Alasan Perubahan <span style={{ color: '#DC2626' }}>*</span>
            </div>
            <Input.TextArea
              rows={3}
              value={statusChangeReason}
              onChange={(e) => setStatusChangeReason(e.target.value)}
              placeholder="Contoh: Rekening telah ditutup oleh pihak bank / pergantian rekening operasional..."
              maxLength={500}
              showCount
            />
          </div>
        </Modal>

        {/* MANAGE COMPANY BANK ACCOUNT MODAL (CREATE / EDIT) */}
        <ManageCompanyBankAccountModal
          open={isManageAccountModalOpen}
          onClose={() => {
            setIsManageAccountModalOpen(false);
            setSelectedAccountForEdit(null);
          }}
          account={selectedAccountForEdit}
          onSaved={() => {
            fetchData();
          }}
        />

        {/* COMPANY BANK ACCOUNT AUDIT HISTORY MODAL */}
        <CompanyBankAccountHistoryModal
          open={isAccountHistoryModalOpen}
          onClose={() => {
            setIsAccountHistoryModalOpen(false);
            setSelectedAccountForHistory(null);
          }}
          account={selectedAccountForHistory}
        />
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
