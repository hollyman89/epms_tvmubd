import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { Reflector } from '@nestjs/core';

describe('FinanceController', () => {
  let controller: FinanceController;
  let service: FinanceService;
  let reflector: Reflector;

  const mockFinanceService = {
    createInvoice: jest.fn(),
    verifyInvoice: jest.fn(),
    createPayment: jest.fn(),
    getInvoices: jest.fn(),
    getInvoiceById: jest.fn(),
    getPayments: jest.fn(),
    getInvoiceMatchingData: jest.fn(),
    getPoPaymentSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
    service = module.get<FinanceService>(FinanceService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('RBAC Role Metadata Tests (Phase 7E-D-3)', () => {
    it('1. verifyInvoice endpoint should require FINANCE, SUPER_ADMIN, ADMIN, or DIRECTOR roles', () => {
      const roles = reflector.get<string[]>('roles', controller.verifyInvoice);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR']);

      // Negative check: VENDOR, PROCUREMENT, USER are unauthorized
      expect(roles.includes('VENDOR')).toBe(false);
      expect(roles.includes('PROCUREMENT')).toBe(false);
      expect(roles.includes('USER')).toBe(false);
    });

    it('2. createInvoice endpoint should require FINANCE, SUPER_ADMIN, or ADMIN roles', () => {
      const roles = reflector.get<string[]>('roles', controller.createInvoice);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['FINANCE', 'SUPER_ADMIN', 'ADMIN']);
    });

    it('3. getInvoiceMatchingData endpoint should require FINANCE, SUPER_ADMIN, ADMIN, or DIRECTOR roles', () => {
      const roles = reflector.get<string[]>('roles', controller.getInvoiceMatchingData);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR']);
      expect(roles.includes('VENDOR')).toBe(false);
    });
  });

  describe('verifyInvoice endpoint', () => {
    it('should delegate verification to financeService.verifyInvoice with userId from req', async () => {
      const dto = { approved: true, evidenceRef: 'BAST-001', notes: 'Valid' };
      const req = { user: { id: 77 } };
      const mockResult = { id: 10, matchStatus: 'VERIFIED' };

      mockFinanceService.verifyInvoice.mockResolvedValueOnce(mockResult);

      const response = await controller.verifyInvoice(10, dto, req);

      expect(service.verifyInvoice).toHaveBeenCalledWith(10, dto, 77);
      expect(response.message).toBe('Invoice verification approved successfully');
      expect(response.data).toEqual(mockResult);
    });

    it('should return rejection message when approved is false', async () => {
      const dto = { approved: false, notes: 'Missing docs' };
      const req = { user: { id: 77 } };
      const mockResult = { id: 10, matchStatus: 'REJECTED' };

      mockFinanceService.verifyInvoice.mockResolvedValueOnce(mockResult);

      const response = await controller.verifyInvoice(10, dto, req);

      expect(service.verifyInvoice).toHaveBeenCalledWith(10, dto, 77);
      expect(response.message).toBe('Invoice verification rejected');
      expect(response.data).toEqual(mockResult);
    });
  });

  describe('getInvoiceMatchingData endpoint', () => {
    it('should delegate matching query to financeService.getInvoiceMatchingData', async () => {
      const mockMatchingResult = {
        invoiceId: 10,
        poId: 1,
        status: 'MATCHED',
        poTotal: 1000000,
        mismatches: [],
      };
      mockFinanceService.getInvoiceMatchingData.mockResolvedValueOnce(mockMatchingResult);

      const response = await controller.getInvoiceMatchingData(10, 4);

      expect(service.getInvoiceMatchingData).toHaveBeenCalledWith(10, 4);
      expect(response.message).toBe('Invoice matching data retrieved successfully');
      expect(response.data).toEqual(mockMatchingResult);
    });
  });

  describe('getInvoiceById endpoint', () => {
    it('should call financeService.getInvoiceById and return invoice data', async () => {
      const mockInvoice = { id: 15, invoiceNumber: 'INV-20260904-001' };
      mockFinanceService.getInvoiceById.mockResolvedValueOnce(mockInvoice);

      const response = await controller.getInvoiceById(15);
      expect(service.getInvoiceById).toHaveBeenCalledWith(15);
      expect(response.data).toEqual(mockInvoice);
    });
  });

  describe('getPoPaymentSummary endpoint (Phase 7E-D-4)', () => {
    it('should require FINANCE, SUPER_ADMIN, ADMIN, DIRECTOR, or GENERAL_MANAGER roles', () => {
      const roles = reflector.get<string[]>('roles', controller.getPoPaymentSummary);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER']);
    });

    it('should delegate query to financeService.getPoPaymentSummary', async () => {
      const mockSummary = {
        poId: 1,
        poTotal: 100479990,
        totalPaid: 60287994,
        outstanding: 40191996,
        paidPercentage: 60,
      };
      mockFinanceService.getPoPaymentSummary.mockResolvedValueOnce(mockSummary);

      const response = await controller.getPoPaymentSummary(1);
      expect(service.getPoPaymentSummary).toHaveBeenCalledWith(1);
      expect(response.message).toBe('PO payment summary retrieved successfully');
      expect(response.data).toEqual(mockSummary);
    });
  });
});
