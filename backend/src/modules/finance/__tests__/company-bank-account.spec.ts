import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from '../finance.service';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from '../../../entities/invoice.entity';
import { Payment } from '../../../entities/payment.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../../entities/goods-receipt.entity';
import { PoPaymentTerm } from '../../../entities/po-payment-term.entity';
import { CompanyBankAccount, CompanyBankAccountStatus, CompanyBankAccountPurpose, CompanyBankAccountType } from '../../../entities/company-bank-account.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../../entities/payment-request.entity';
import { AuditLog } from '../../../entities/audit-log.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('CompanyBankAccount & Payment Source Account Control Suite', () => {
  let service: FinanceService;
  let mockQueryRunner: any;
  let mockCompanyBankRepo: any;
  let mockPaymentRepo: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        save: jest.fn(),
        create: jest.fn((entityClass, data) => data),
        update: jest.fn(),
      },
    };

    mockCompanyBankRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    mockPaymentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            getRepository: jest.fn().mockReturnValue(mockCompanyBankRepo),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: getRepositoryToken(PoPaymentTerm), useValue: {} },
        { provide: getRepositoryToken(CompanyBankAccount), useValue: mockCompanyBankRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  describe('Entity Isolation & Transaction Company Code Resolution', () => {
    it('should resolve companyCode from purchaseOrder.purchaseRequest.project', () => {
      const po: any = {
        purchaseRequest: {
          project: {
            company: 'PT UBD',
          },
        },
      };
      const code = service.resolveTransactionCompanyCode(null, null, po, null);
      expect(code).toBe('UBD');
    });

    it('should resolve companyCode from invoice.purchaseOrder.purchaseRequest.project (TVM)', () => {
      const invoice: any = {
        companyCode: 'TVM',
        purchaseOrder: {
          purchaseRequest: {
            project: {
              companyCode: 'TVM',
            },
          },
        },
      };
      const code = service.resolveTransactionCompanyCode(null, invoice, null, null);
      expect(code).toBe('TVM');
    });

    it('should throw BadRequestException if conflicting entities are detected across the chain', () => {
      const invoice: any = {
        companyCode: 'UBD',
      };
      const project: any = {
        companyCode: 'TVM',
      };
      expect(() => {
        service.resolveTransactionCompanyCode(null, invoice, null, project);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if legacy transaction has no identifiable company code (Strict Block)', () => {
      const invoice: any = {
        companyCode: null,
        purchaseOrder: {
          purchaseRequest: {
            project: {
              company: null,
              companyCode: null,
            },
          },
        },
      };
      expect(() => {
        service.resolveTransactionCompanyCode(null, invoice, null, null);
      }).toThrow('Payment execution blocked: Legal entity ownership is missing or cannot be reliably determined.');
    });
  });

  describe('Company Bank Account Creation & Duplication Check', () => {
    it('should throw ConflictException if duplicate active bank account exists for entity', async () => {
      mockCompanyBankRepo.findOne.mockResolvedValueOnce({
        id: 1,
        companyCode: 'UBD',
        bankName: 'Bank Mandiri',
        accountNumber: '1234567890',
      });

      await expect(
        service.createCompanyBankAccount(
          {
            companyCode: 'UBD',
            bankName: 'Bank Mandiri',
            bankCode: 'MANDIRI',
            accountNumber: '1234567890',
            accountHolderName: 'PT Utama Bangun Dananjaya',
            accountType: CompanyBankAccountType.CHECKING,
            accountPurpose: CompanyBankAccountPurpose.OPERATIONAL,
            currency: 'IDR',
            effectiveDate: '2026-01-01',
            changeReason: 'Pembukaan rekening operasional baru',
          },
          1
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should clear other defaults when a new default account is created for that entity', async () => {
      mockCompanyBankRepo.findOne.mockResolvedValueOnce(null); // No duplicate
      const createdAccount = {
        id: 10,
        companyCode: 'UBD',
        bankName: 'Bank Mandiri',
        isDefault: true,
      };
      mockQueryRunner.manager.create.mockReturnValue(createdAccount);
      mockQueryRunner.manager.save.mockResolvedValueOnce(createdAccount);

      const result = await service.createCompanyBankAccount(
        {
          companyCode: 'UBD',
          bankName: 'Bank Mandiri',
          bankCode: 'MANDIRI',
          accountNumber: '1234567890',
          accountHolderName: 'PT Utama Bangun Dananjaya',
          accountType: CompanyBankAccountType.CHECKING,
          accountPurpose: CompanyBankAccountPurpose.OPERATIONAL,
          currency: 'IDR',
          isDefault: true,
          effectiveDate: '2026-01-01',
          changeReason: 'Penetapan rekening operasional default',
        },
        1
      );

      expect(mockQueryRunner.manager.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Payment Execution with Company Source Bank Account Control', () => {
    const validInvoice: any = {
      id: 24,
      poId: 24,
      companyCode: 'TVM',
      invoiceNumber: 'INV-20261113-003',
      totalAmount: 900000,
      paymentStatus: 'UNPAID',
      matchStatus: 'VERIFIED',
      version: 1,
      invoiceTaxDetail: {
        companyCode: 'TVM',
        ppnRate: 11,
        ppnAmount: 99000,
        pphRate: 1,
        pphAmount: 9000,
        grossCommercialLiability: 999000,
        netVendorCashPayable: 990000,
      },
    };

    const validPaymentRequest: any = {
      id: 15,
      invoiceId: 24,
      companyCode: 'TVM',
      status: PaymentRequestStatus.APPROVED_FOR_PAYMENT,
      requestedAmount: 990000,
      approvedAmount: 990000,
      approvalSnapshot: {
        invoiceVersion: 1,
        vendorBankAccount: '123-456-7890',
      },
    };

    const validPo: any = {
      id: 24,
      poNumber: 'PO-20261113-003',
      companyCode: 'TVM',
      totalAmount: 1000000,
      project: {
        companyCode: 'TVM',
      },
    };

    it('should reject payment if selected company bank account belongs to a different entity (Cross-Entity Block)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(validInvoice) // 1: Invoice
        .mockResolvedValueOnce(validPaymentRequest) // 2: PRQ
        .mockResolvedValueOnce(validPo) // 3: PO
        .mockResolvedValueOnce({
          // 4: Selected Account: UBD, but invoice belongs to TVM
          id: 5,
          companyCode: 'UBD',
          bankName: 'Bank BCA',
          bankCode: 'BCA',
          accountNumber: '999888777',
          accountHolderName: 'PT Utama Bangun Dananjaya',
          status: CompanyBankAccountStatus.ACTIVE,
          effectiveDate: '2026-01-01',
          expiryDate: null,
        });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 15,
            companyBankAccountId: 5,
            amount: 990000,
            paymentDate: '2026-11-16',
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'REF-001',
          },
          2
        )
      ).rejects.toThrow('Cross-entity account usage is strictly prohibited');
    });

    it('should reject payment if selected company bank account is INACTIVE', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(validInvoice)
        .mockResolvedValueOnce(validPaymentRequest)
        .mockResolvedValueOnce(validPo)
        .mockResolvedValueOnce({
          id: 6,
          companyCode: 'TVM',
          bankName: 'Bank Mandiri',
          bankCode: 'MANDIRI',
          accountNumber: '111222333',
          accountHolderName: 'PT Tri Visi Mandiri',
          status: CompanyBankAccountStatus.INACTIVE,
          effectiveDate: '2026-01-01',
          expiryDate: null,
        });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 15,
            companyBankAccountId: 6,
            amount: 990000,
            paymentDate: '2026-11-16',
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'REF-002',
          },
          2
        )
      ).rejects.toThrow('Selected company bank account is INACTIVE');
    });

    it('should reject payment if selected company bank account is BLOCKED', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(validInvoice)
        .mockResolvedValueOnce(validPaymentRequest)
        .mockResolvedValueOnce(validPo)
        .mockResolvedValueOnce({
          id: 7,
          companyCode: 'TVM',
          bankName: 'Bank Mandiri',
          bankCode: 'MANDIRI',
          accountNumber: '111222333',
          accountHolderName: 'PT Tri Visi Mandiri',
          status: CompanyBankAccountStatus.BLOCKED,
          effectiveDate: '2026-01-01',
          expiryDate: null,
        });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 15,
            companyBankAccountId: 7,
            amount: 990000,
            paymentDate: '2026-11-16',
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'REF-003',
          },
          2
        )
      ).rejects.toThrow('Selected company bank account is BLOCKED');
    });

    it('should reject payment if selected company bank account is expired', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(validInvoice)
        .mockResolvedValueOnce(validPaymentRequest)
        .mockResolvedValueOnce(validPo)
        .mockResolvedValueOnce({
          id: 8,
          companyCode: 'TVM',
          bankName: 'Bank Mandiri',
          bankCode: 'MANDIRI',
          accountNumber: '111222333',
          accountHolderName: 'PT Tri Visi Mandiri',
          status: CompanyBankAccountStatus.ACTIVE,
          effectiveDate: '2025-01-01',
          expiryDate: '2025-12-31', // Expired
        });

      await expect(
        service.createPayment(
          {
            invoiceId: 24,
            paymentRequestId: 15,
            companyBankAccountId: 8,
            amount: 990000,
            paymentDate: '2026-11-16',
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'REF-004',
          },
          2
        )
      ).rejects.toThrow('Selected company bank account has expired');
    });

    it('should successfully execute payment and persist immutable sourceAccountSnapshot', async () => {
      const activeTVMAccount = {
        id: 9,
        companyCode: 'TVM',
        bankName: 'Bank Mandiri',
        bankCode: 'MANDIRI',
        accountNumber: '111222333',
        accountHolderName: 'PT Tri Visi Mandiri',
        accountType: CompanyBankAccountType.CHECKING,
        accountPurpose: CompanyBankAccountPurpose.VENDOR_PAYMENT,
        currency: 'IDR',
        status: CompanyBankAccountStatus.ACTIVE,
        effectiveDate: '2026-01-01',
        expiryDate: null,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(validInvoice)
        .mockResolvedValueOnce(validPaymentRequest)
        .mockResolvedValueOnce(validPo)
        .mockResolvedValueOnce(activeTVMAccount);

      mockQueryRunner.manager.count.mockResolvedValueOnce(25); // For payment voucher number PAY-20261116-026

      const savedPayment: any = {
        id: 20,
        paymentNumber: 'PAY-20261116-026',
        invoiceId: 24,
        amount: 990000,
        companyBankAccountId: 9,
        sourceAccountSnapshot: {
          id: 9,
          companyCode: 'TVM',
          bankName: 'Bank Mandiri',
          bankCode: 'MANDIRI',
          accountNumber: '111222333',
          accountHolderName: 'PT Tri Visi Mandiri',
          accountType: CompanyBankAccountType.CHECKING,
          accountPurpose: CompanyBankAccountPurpose.VENDOR_PAYMENT,
          currency: 'IDR',
        },
      };

      mockQueryRunner.manager.create.mockReturnValue(savedPayment);
      mockQueryRunner.manager.save.mockResolvedValueOnce(savedPayment);

      const result = await service.createPayment(
        {
          invoiceId: 24,
          paymentRequestId: 15,
          companyBankAccountId: 9,
          amount: 990000,
          paymentDate: '2026-11-16',
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRX-998877',
          notes: 'Pelunasan faktur INV-20261113-003 via Mandiri TVM',
        },
        2
      );

      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.sourceAccountSnapshot).toBeDefined();
      expect(result.sourceAccountSnapshot.companyCode).toBe('TVM');
      expect(result.sourceAccountSnapshot.accountNumber).toBe('111222333');
    });
  });

  describe('Historical Preservation & Backward Compatibility', () => {
    it('should preserve existing historical payments without requiring companyBankAccountId', async () => {
      const historicalPayment: any = {
        id: 1,
        paymentNumber: 'PAY-20260721-001',
        amount: 500000,
        companyBankAccountId: null,
        sourceAccountSnapshot: null,
      };

      mockPaymentRepo.find.mockResolvedValueOnce([historicalPayment]);

      const payments = await service.getPayments();
      expect(payments).toBeDefined();
      expect(payments[0].companyBankAccountId).toBeNull();
      expect(payments[0].sourceAccountSnapshot).toBeNull();
    });
  });
});
