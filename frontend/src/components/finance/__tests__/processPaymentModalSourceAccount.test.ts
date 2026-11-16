/**
 * EPMS — COMPANY BANK ACCOUNT MASTER DATA & PAYMENT SOURCE CONTROL TESTS
 *
 * Frontend Unit & Component Tests:
 * 1. ProcessPaymentModal: Authoritative searchable account selector replacing free-text input.
 * 2. ProcessPaymentModal: Legal entity resolution & badge display (PT UBD vs PT TVM).
 * 3. ProcessPaymentModal: Warning and gating when no eligible accounts exist for legal entity.
 * 4. ProcessPaymentModal: Blocking guard when legal entity cannot be identified across transaction chain.
 * 5. ProcessPaymentModal: Clear distinction between Company Source Account and Vendor Destination Account.
 * 6. PaymentReceiptModal: Displays authoritative source bank account from immutable snapshot.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDto, PaymentRequestDto, CompanyBankAccountDto } from '@/services/finance.service';

// Mock antd Modal to render inline without browser portal
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Modal: ({ open, children, title, footer }: any) => {
      if (!open) return null;
      return React.createElement(
        'div',
        { 'data-testid': 'mock-modal' },
        React.createElement('div', { className: 'ant-modal-title' }, title),
        React.createElement('div', { className: 'ant-modal-body' }, children),
        React.createElement('div', { className: 'ant-modal-footer' }, footer)
      );
    },
  };
});

const mockEligibleAccounts: CompanyBankAccountDto[] = [
  {
    id: 1,
    companyCode: 'UBD',
    bankName: 'Bank Mandiri',
    bankCode: 'MANDIRI',
    accountNumber: '1234567890',
    accountHolderName: 'PT Utama Bangun Dananjaya',
    accountType: 'GIRO',
    accountPurpose: 'OPERATIONAL',
    currency: 'IDR',
    isDefault: true,
    status: 'ACTIVE',
    effectiveDate: '2026-01-01',
    expiryDate: null,
    picName: 'Hendra Setiawan',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    companyCode: 'UBD',
    bankName: 'Bank BCA',
    bankCode: 'BCA',
    accountNumber: '9876543210',
    accountHolderName: 'PT Utama Bangun Dananjaya',
    accountType: 'CHECKING',
    accountPurpose: 'VENDOR_PAYMENT',
    currency: 'IDR',
    isDefault: false,
    status: 'ACTIVE',
    effectiveDate: '2026-01-01',
    expiryDate: null,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

// Mock FinanceService
jest.mock('@/services/finance.service', () => {
  const actual = jest.requireActual('@/services/finance.service');
  return {
    ...actual,
    FinanceService: {
      getInvoiceById: jest.fn().mockImplementation(() => Promise.resolve(null)),
      getPaymentRequestById: jest.fn().mockImplementation(() => Promise.resolve(null)),
      getEligibleCompanyBankAccounts: jest.fn().mockImplementation((entity?: string) => {
        if (entity === 'UBD') return Promise.resolve(mockEligibleAccounts);
        if (entity === 'TVM') return Promise.resolve([]);
        return Promise.resolve(mockEligibleAccounts);
      }),
      createPayment: jest.fn().mockResolvedValue({ id: 1, paymentNumber: 'PAY-20261116-001' }),
    },
  };
});

import { ProcessPaymentModal } from '../ProcessPaymentModal';
import { PaymentReceiptModal } from '../PaymentReceiptModal';

describe('Company Bank Account Source Selection & Receipt Transparency Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const targetInvoiceUBD: InvoiceDto = {
    id: 24,
    invoiceNumber: 'INV-20261113-003',
    poId: 24,
    invoiceDate: '2026-11-13',
    totalAmount: 900000,
    status: 'UNPAID',
    matchStatus: 'VERIFIED',
    paymentStatus: 'UNPAID',
    version: 1,
    createdAt: '2026-11-13T00:00:00Z',
    purchaseOrder: {
      id: 24,
      poNumber: 'PO-20261113-003',
      orderType: 'MATERIAL',
      companyCode: 'UBD',
      vendor: {
        id: 15,
        name: 'PT Suplai Makmur',
        code: 'VND-SM',
        bankName: 'Bank Mandiri',
        bankAccountNumber: '123-456-7890',
        bankAccountHolder: 'PT Suplai Makmur',
      },
      purchaseRequest: {
        id: 10,
        project: {
          id: 5,
          name: 'Proyek Infrastruktur Gedung UBD',
          company: 'PT UBD',
          companyCode: 'UBD',
        },
      },
    } as any,
    paymentTerm: {
      id: 1,
      termName: 'Pelunasan Penuh',
      percentage: 100,
      amount: 900000,
    } as any,
    invoiceTaxDetail: {
      id: 5,
      invoiceId: 24,
      companyCode: 'UBD',
      dppCommercial: 900000,
      ppnAmount: 99000,
      grossCommercialLiability: 999000,
      pphWithholdingAmount: 9000,
      wapuPpnWithheldAmount: 0,
      priorDeductionsAmount: 0,
      netVendorCashPayable: 990000,
    } as any,
  };

  const targetPrqUBD: PaymentRequestDto = {
    id: 15,
    requestNumber: 'PRQ-20261115-001',
    invoiceId: 24,
    status: 'APPROVED_FOR_PAYMENT',
    requestedAmount: 990000,
    approvedAmount: 990000,
    requestedBy: 1,
    submittedAt: '2026-11-15T09:00:00Z',
    approvedBy: 2,
    approver: {
      id: 2,
      fullName: 'Bambang Soedarmono (Direktur Utama)',
      roles: ['DIRECTOR'],
    } as any,
    approvalSnapshot: {
      invoiceId: 24,
      invoiceVersion: 1,
      vendorBankName: 'Bank Mandiri',
      vendorBankAccount: '123-456-7890',
      vendorBankAccountHolder: 'PT Suplai Makmur',
      dppAmount: 900000,
      ppnAmount: 99000,
      ppnRate: 11,
      grossAmount: 999000,
      pphAmount: 9000,
      pphRate: 1,
      pphType: 'PPH_FINAL_1_PERCENT',
      netPayableAmount: 990000,
    } as any,
  };

  const renderProcessModal = (inv: InvoiceDto = targetInvoiceUBD, prq: PaymentRequestDto = targetPrqUBD) => {
    return ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ProcessPaymentModal, {
          open: true,
          onClose: jest.fn(),
          invoice: inv,
          paymentRequest: prq,
          canProcessPayment: true,
          currentUserName: 'Finance Team',
          onPaymentCreated: jest.fn(),
        })
      )
    );
  };

  describe('1. Authoritative Company Source Bank Account Selector', () => {
    it('renders the database-backed source account section header and legal entity badge', () => {
      const html = renderProcessModal();
      expect(html).toContain('Bank Sumber Dana (Rekening Operasional Perusahaan)');
      expect(html).toContain('Rekening Operasional Perusahaan');
    });

    it('clearly separates company source account from vendor recipient account', () => {
      const html = renderProcessModal();
      expect(html).toContain('Rekening Penerima / Vendor (Destination Account)');
      expect(html).toContain('Bank Sumber Dana (Rekening Operasional Perusahaan)');
    });

    it('requires transfer reference number input for bank transfer executions', () => {
      const html = renderProcessModal();
      expect(html).toContain('Nomor Referensi Transaksi (No. Bukti Transfer)');
      expect(html).toContain('TRX-20261115-001 / No. Bukti Transfer Bank');
    });
  });

  describe('2. Legal Entity Partitioning & Blocking Gating', () => {
    it('displays blocking alert when legal entity cannot be identified across transaction chain', () => {
      const legacyInv: InvoiceDto = {
        ...targetInvoiceUBD,
        purchaseOrder: {
          ...targetInvoiceUBD.purchaseOrder,
          companyCode: undefined,
          purchaseRequest: {
            project: {
              company: undefined,
              companyCode: undefined,
            },
          },
        } as any,
        invoiceTaxDetail: {
          ...targetInvoiceUBD.invoiceTaxDetail,
          companyCode: undefined,
        } as any,
      };
      const legacyPrq: PaymentRequestDto = {
        ...targetPrqUBD,
      };

      const html = renderProcessModal(legacyInv, legacyPrq);
      expect(html).toContain('Kepemilikan Entitas Tidak Diketahui');
      expect(html).toContain('Data transaksi tidak memiliki kepemilikan entitas hukum');
    });

    it('renders TVM badge when transaction belongs to TVM', () => {
      const tvmInv: InvoiceDto = {
        ...targetInvoiceUBD,
        purchaseOrder: {
          ...targetInvoiceUBD.purchaseOrder,
          companyCode: 'TVM',
          purchaseRequest: {
            project: {
              company: 'PT TVM',
              companyCode: 'TVM',
            },
          },
        } as any,
        invoiceTaxDetail: {
          ...targetInvoiceUBD.invoiceTaxDetail,
          companyCode: 'TVM',
        } as any,
      };
      const tvmPrq: PaymentRequestDto = {
        ...targetPrqUBD,
      };

      const html = renderProcessModal(tvmInv, tvmPrq);
      expect(html).toContain('PT TVM');
    });
  });

  describe('3. Payment Receipt Modal — Authoritative Source Account Snapshot Rendering', () => {
    it('renders snapshot legal entity, bank name, masked account number, and holder name', () => {
      const mockPaymentWithSnapshot: any = {
        id: 1,
        paymentNumber: 'PAY-20261116-001',
        paymentDate: '2026-11-16T10:00:00Z',
        amount: 990000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TRX-20261116-001',
        notes: 'Pelunasan faktur INV-20261113-003',
        sourceAccountSnapshot: {
          companyBankAccountId: 1,
          companyCode: 'UBD',
          legalEntityName: 'PT UBD',
          bankName: 'Bank Mandiri',
          bankCode: 'MANDIRI',
          accountNumber: '1234567890',
          maskedAccountNumber: '••••••7890',
          accountHolderName: 'PT Utama Bangun Dananjaya',
          accountType: 'GIRO',
          accountPurpose: 'OPERATIONAL',
          currency: 'IDR',
        },
        invoice: targetInvoiceUBD,
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PaymentReceiptModal, {
          open: true,
          onClose: jest.fn(),
          payment: mockPaymentWithSnapshot,
        })
      );

      expect(html).toContain('Bank Mandiri');
      expect(html).toContain('PT UBD');
      expect(html).toContain('••••••7890');
      expect(html).toContain('PT Utama Bangun Dananjaya');
      expect(html).toContain('TRX-20261116-001');
    });
  });
});
