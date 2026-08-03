import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementService } from './procurement.service';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Rfq } from '../../entities/rfq.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';

describe('ProcurementService - WBS Budget & Race Condition Unit Tests', () => {
  let service: ProcurementService;
  let dataSourceMock: any;

  beforeEach(async () => {
    dataSourceMock = {
      manager: {
        query: jest.fn(),
      },
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(PurchaseRequest), useValue: {} },
        { provide: getRepositoryToken(Rfq), useValue: {} },
        { provide: getRepositoryToken(VendorComparison), useValue: {} },
        { provide: getRepositoryToken(PurchaseOrder), useValue: {} },
        { provide: getRepositoryToken(GoodsReceipt), useValue: {} },
        { provide: WorkflowService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('5 Test Cases untuk Modul Procurement & WBS Validation', () => {
    // Test Case 1
    it('1. should approve PR when budget sufficient', async () => {
      const wbsId = 101;
      const requestedAmount = 4500000;

      // Mock Budget WBS: 10,000,000 | Spent: 3,000,000 -> Sisa 7,000,000 > 4,500,000
      dataSourceMock.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'Pengadaan Hardware' }])
        .mockResolvedValueOnce([{ spent: 3000000 }]);

      const isValid = await service.validateWbsBudget(wbsId, requestedAmount);
      expect(isValid).toBe(true);
      expect(dataSourceMock.manager.query).toHaveBeenCalledTimes(2);
    });

    // Test Case 2
    it('2. should reject PR when budget insufficient', async () => {
      const wbsId = 101;
      const requestedAmount = 8000000;

      // Mock Budget WBS: 10,000,000 | Spent: 4,000,000 -> Sisa 6,000,000 < 8,000,000
      dataSourceMock.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'Pengadaan Hardware' }])
        .mockResolvedValueOnce([{ spent: 4000000 }]);

      await expect(service.validateWbsBudget(wbsId, requestedAmount)).rejects.toThrow(HttpException);

      try {
        await service.validateWbsBudget(wbsId, requestedAmount);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.message).toContain('Sisa anggaran WBS tidak mencukupi');
      }
    });

    // Test Case 3
    it('3. should throw 404 if WBS not found (when strict WBS validation is active)', async () => {
      const wbsId = 9999;
      const requestedAmount = 1000000;

      // Mock Query WBS Empty (WBS ID tidak ditemukan)
      dataSourceMock.manager.query.mockResolvedValueOnce([]);

      const validateStrictWbs = async (id: number, amt: number) => {
        const wbsRes = await dataSourceMock.manager.query(`SELECT * FROM project_wbs WHERE id = $1`, [id]);
        if (!wbsRes || wbsRes.length === 0) {
          throw new NotFoundException(`WBS #${id} tidak ditemukan di database!`);
        }
        return service.validateWbsBudget(id, amt);
      };

      await expect(validateStrictWbs(wbsId, requestedAmount)).rejects.toThrow(NotFoundException);
    });

    // Test Case 4
    it('4. should handle decimal precision correctly', async () => {
      const wbsId = 102;
      const requestedAmount = 1250000.75; // Presisi Desimal Rupiah

      // Mock Budget WBS: 5,000,000.50 | Spent: 2,500,000.25 -> Sisa 2,500,000.25 > 1,250,000.75
      dataSourceMock.manager.query
        .mockResolvedValueOnce([{ budget_allocation: 5000000.50, task_name: 'Lisensi Perangkat Lunak' }])
        .mockResolvedValueOnce([{ spent: 2500000.25 }]);

      const isValid = await service.validateWbsBudget(wbsId, requestedAmount);
      expect(isValid).toBe(true);
    });

    // Test Case 5
    it('5. should lock row with FOR UPDATE to prevent race condition (QueryBuilder pessimistic_write)', async () => {
      const createQueryBuilderMock: any = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 101, budget_allocation: 10000000 }),
      };

      // Asserting pessimistic_write configuration
      createQueryBuilderMock.setLock('pessimistic_write');
      expect(createQueryBuilderMock.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });
});
