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
  DollarCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  AuditOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BankOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  FinanceService,
  InvoiceDto,
  PaymentDto,
} from '@/services/finance.service';
import {
  ProcessPaymentModal,
} from '@/components/finance/ProcessPaymentModal';
import { PaymentReceiptModal } from '@/components/finance/PaymentReceiptModal';

const { Title, Text } = Typography;

export default function PaymentsPage() {
  const { user } = useAuth();
  const canProcessPayment = useMemo(() => {
    const authorizedRoles = ['FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'];
    return (user?.roles || []).some((r) => authorizedRoles.includes(r));
  }, [user]);

  // Active Tab
  const [activeTabKey, setActiveTabKey] = useState<string>('ready_to_pay');

  // Backend SSOT Data States
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<InvoiceDto | null>(null);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState<boolean>(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentDto | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Version counter for reactive re-fetch
  const [version, setVersion] = useState<number>(0);

  // Fetch Invoices and Payments Authoritatively from Backend SSOT
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invData, payData] = await Promise.all([
        FinanceService.getInvoices(),
        FinanceService.getPayments(),
      ]);
      setInvoices(invData || []);
      setPayments(payData || []);
    } catch (err) {
      console.error('Failed to load finance payment data from backend SSOT:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, version]);

  // Canonical Phase G Cross-User Synchronization & Reconnect Resync
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (
        detail.aggregateType === 'Payment' ||
        (detail.aggregateType === 'Invoice' && detail.eventName === 'finance.invoice.verified')
      ) {
        fetchData();
      }
    };

    const handleReconnect = () => {
      fetchData();
    };

    window.addEventListener('epms:business-sync', handleSync);
    window.addEventListener('epms:reconnect-resync', handleReconnect);
    return () => {
      window.removeEventListener('epms:business-sync', handleSync);
      window.removeEventListener('epms:reconnect-resync', handleReconnect);
    };
  }, [fetchData]);

  // Filter Invoices: Only MATCHED / VERIFIED & UNPAID / PARTIALLY_PAID Invoices
  const readyToPayInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        (inv.matchStatus === 'MATCHED' || inv.matchStatus === 'VERIFIED') &&
        inv.paymentStatus !== 'PAID'
    );
  }, [invoices]);

  // Statistics (Authoritative Backend SSOT Fact)
  const totalReadyToPayCount = readyToPayInvoices.length;
  const totalPaidVouchersCount = payments.length;

  const totalPaidAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const totalOutstandingToPay = useMemo(() => {
    return readyToPayInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  }, [readyToPayInvoices]);

  // TAB 1: Columns for Tagihan Siap Dibayar
  const readyInvoiceColumns = useMemo(
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
        render: (_: any, r: InvoiceDto) => (
          <span style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'monospace' }}>
            {r.purchaseOrder?.poNumber || '—'}
          </span>
        ),
      },
      {
        title: 'Vendor Penerima',
        key: 'vendor',
        render: (_: any, r: InvoiceDto) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>
              {r.purchaseOrder?.vendor?.name || '—'}
            </div>
            {r.purchaseOrder?.vendor?.code ? (
              <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                {r.purchaseOrder.vendor.code}
              </Tag>
            ) : null}
          </div>
        ),
      },
      {
        title: 'Nilai Tagihan',
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
        title: '3-Way Match',
        dataIndex: 'matchStatus',
        key: 'matchStatus',
        width: 125,
        align: 'center' as const,
        render: (status: string) => (
          <Tag color={status === 'VERIFIED' || status === 'MATCHED' ? 'green' : 'orange'} style={{ fontWeight: 700 }}>
            ● {status}
          </Tag>
        ),
      },
      {
        title: 'Status Bayar',
        dataIndex: 'paymentStatus',
        key: 'paymentStatus',
        width: 110,
        align: 'center' as const,
        render: (status: string) => (
          <Tag color="orange" style={{ fontWeight: 700 }}>
            ● {status}
          </Tag>
        ),
      },
      {
        title: 'Termin',
        key: 'paymentTerms',
        render: (_: any, r: InvoiceDto) => (
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {r.paymentTerm?.termName || 'Full Contract'}
          </span>
        ),
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 190,
        align: 'center' as const,
        render: (_: any, r: InvoiceDto) => (
          <Tooltip title={canProcessPayment ? 'Proses pembayaran kas/bank untuk tagihan ini' : 'Hanya role Finance yang dapat memproses pembayaran'}>
            <span>
              <Button
                size="small"
                type="primary"
                icon={<DollarCircleOutlined />}
                disabled={!canProcessPayment}
                onClick={() => {
                  setSelectedInvoiceForPay(r);
                  setIsProcessModalOpen(true);
                }}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11,
                  backgroundColor: canProcessPayment ? '#059669' : undefined,
                  borderColor: canProcessPayment ? '#059669' : undefined,
                }}
              >
                Proses Pembayaran
              </Button>
            </span>
          </Tooltip>
        ),
      },
    ],
    []
  );

  // TAB 2: Columns for Riwayat Pembayaran / Voucher
  const paymentVoucherColumns = useMemo(
    () => [
      {
        title: 'Nomor Bukti Bayar',
        dataIndex: 'paymentNumber',
        key: 'paymentNumber',
        render: (payNum: string) => (
          <span style={{ fontWeight: 700, color: '#047857', fontFamily: 'monospace' }}>
            {payNum}
          </span>
        ),
      },
      {
        title: 'Nomor Invoice',
        key: 'invoiceNumber',
        render: (_: any, r: PaymentDto) => (
          <span style={{ fontWeight: 600, color: '#1d4ed8', fontFamily: 'monospace' }}>
            {r.invoice?.invoiceNumber || (r as any).invoiceNumber || '—'}
          </span>
        ),
      },
      {
        title: 'Nomor PO',
        key: 'poNumber',
        render: (_: any, r: PaymentDto) => (
          <span style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'monospace' }}>
            {r.invoice?.purchaseOrder?.poNumber || (r as any).poNumber || '—'}
          </span>
        ),
      },
      {
        title: 'Vendor Penerima',
        key: 'vendor',
        render: (_: any, r: PaymentDto) => {
          const vName = r.invoice?.purchaseOrder?.vendor?.name || (r as any).vendorName || '—';
          const vCode = r.invoice?.purchaseOrder?.vendor?.code || (r as any).vendorCode || '';
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{vName}</div>
              {vCode ? (
                <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                  {vCode}
                </Tag>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Total Pelunasan',
        dataIndex: 'amount',
        key: 'amount',
        align: 'right' as const,
        render: (val: number) => (
          <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 12.5, color: '#059669' }}>
            Rp {Number(val || 0).toLocaleString('id-ID')}
          </span>
        ),
      },
      {
        title: 'Metode & Ref',
        key: 'method',
        render: (_: any, r: PaymentDto) => (
          <div>
            <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', fontWeight: 600 }}>
              {r.paymentMethod || 'BANK_TRANSFER'}
            </Tag>
            {r.referenceNumber ? (
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                Ref: {r.referenceNumber}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: 'Tanggal Bayar',
        dataIndex: 'paymentDate',
        key: 'paymentDate',
        render: (date: string) => (date ? dayjs(date).format('DD MMM YYYY') : '—'),
      },
      {
        title: 'Status',
        key: 'status',
        width: 100,
        align: 'center' as const,
        render: () => (
          <Tag color="green" style={{ fontWeight: 700 }}>
            ● PAID
          </Tag>
        ),
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 150,
        align: 'center' as const,
        render: (_: any, r: PaymentDto) => (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPaymentForReceipt(r);
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
            Lihat Bukti Bayar
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'MANAGER']}>
      <div style={{ padding: 24 }}>
      {/* Header Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
              Finance Payment Processing &amp; Voucher Workstation
            </Title>
            <Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>
              Pencatatan realisasi pengeluaran kas/bank atas faktur tagihan vendor yang telah terekonsiliasi 3-Way Matching.
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
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Tagihan Siap Dibayar (MATCHED)</span>}
              value={totalReadyToPayCount}
              prefix={<DollarCircleOutlined style={{ color: '#d97706' }} />}
              suffix={<span style={{ fontSize: 11, color: '#94a3b8' }}>Faktur</span>}
              valueStyle={{ fontWeight: 700, color: '#d97706' }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Rp {totalOutstandingToPay.toLocaleString('id-ID')} Total Outstanding
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Voucher Pelunasan Diterbitkan</span>}
              value={totalPaidVouchersCount}
              prefix={<CheckCircleOutlined style={{ color: '#059669' }} />}
              suffix={<span style={{ fontSize: 11, color: '#94a3b8' }}>Voucher</span>}
              valueStyle={{ fontWeight: 700, color: '#059669' }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Status Kas: Lunas (PAID)
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Total Realisasi Kas Keluar</span>}
              value={totalPaidAmount}
              precision={0}
              prefix={<span style={{ fontSize: 13, marginRight: 2 }}>Rp</span>}
              valueStyle={{ fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Sesuai Bukti Bank Transfer / Cek
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 11.5, color: '#64748b' }}>Kebijakan Pembayaran</span>}
              value="Multi-Term"
              prefix={<SafetyCertificateOutlined style={{ color: '#2563eb' }} />}
              valueStyle={{ fontWeight: 700, color: '#2563eb', fontSize: 18 }}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Settlement &amp; Partial Payment SSOT
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
              key: 'ready_to_pay',
              label: (
                <Space size={6}>
                  <DollarCircleOutlined />
                  <span>Tagihan Siap Dibayar</span>
                  <Badge count={totalReadyToPayCount} overflowCount={99} style={{ backgroundColor: '#d97706' }} />
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Daftar invoice berstatus <strong>MATCHED</strong> atau <strong>VERIFIED</strong> dan <strong>UNPAID</strong> yang memenuhi syarat eksekusi kas/bank.
                    </Text>
                  </div>
                  <Table
                    columns={readyInvoiceColumns}
                    dataSource={readyToPayInvoices}
                    rowKey={(r) => r.id || r.invoiceNumber}
                    loading={loading}
                    pagination={{ pageSize: 5 }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                                Tidak ada tagihan yang menunggu pembayaran
                              </div>
                              <Text type="secondary" style={{ fontSize: 11.5 }}>
                                Seluruh invoice yang berstatus MATCHED atau VERIFIED telah dibayar lunas atau belum ada invoice baru yang diterbitkan.
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
              key: 'payment_vouchers',
              label: (
                <Space size={6}>
                  <CheckCircleOutlined />
                  <span>Riwayat Pembayaran / Voucher</span>
                  <Badge count={payments.length} overflowCount={99} style={{ backgroundColor: '#059669' }} />
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Arsip voucher pembayaran kas/bank resmi (`PAY-XXX`) atas tagihan vendor yang telah lunas.
                    </Text>
                  </div>
                  <Table
                    columns={paymentVoucherColumns}
                    dataSource={payments}
                    rowKey={(r) => r.id || r.paymentNumber}
                    loading={loading}
                    pagination={{ pageSize: 5 }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                                Belum ada riwayat pembayaran kas/bank
                              </div>
                              <Text type="secondary" style={{ fontSize: 11.5 }}>
                                Data riwayat pembayaran kas/bank diambil langsung dari backend server.
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

      {/* PROCESS PAYMENT MODAL */}
      {selectedInvoiceForPay && (
        <ProcessPaymentModal
          open={isProcessModalOpen}
          onClose={() => {
            setIsProcessModalOpen(false);
            setSelectedInvoiceForPay(null);
          }}
          invoice={selectedInvoiceForPay as any}
          canProcessPayment={canProcessPayment}
          currentUserName={user?.fullName || user?.email || 'Finance Team'}
          onPaymentCreated={(newPayment) => {
            fetchData();
            setActiveTabKey('payment_vouchers');
          }}
          onViewReceipt={(payment) => {
            setSelectedPaymentForReceipt(payment as any);
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
          payment={selectedPaymentForReceipt as any}
        />
      )}
      </div>
    </ProtectedRoute>
  );
}
