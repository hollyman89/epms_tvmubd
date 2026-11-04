import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateRfqDto } from '../dto/create-rfq.dto';
import { CreateGoodsReceiptDto, GoodsReceiptItemDto } from '../dto/create-gr.dto';
import { AddRfqNotesAndGoodsReceiptDeliveryNote1793200000000 } from '../../../migrations/1793200000000-AddRfqNotesAndGoodsReceiptDeliveryNote';
import { ProcurementService } from '../procurement.service';
import { Rfq } from '../../../entities/rfq.entity';
import { GoodsReceipt } from '../../../entities/goods-receipt.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../../entities/purchase-request.entity';

describe('Procurement Phase A Persistence & Schema Support (P0-001 & P0-002)', () => {
  describe('1. CreateRfqDto Validation (P0-001)', () => {
    it('accepts valid payload with optional notes', async () => {
      const dto = plainToInstance(CreateRfqDto, {
        purchaseRequestId: 10,
        closingDate: '2026-11-20T12:00:00Z',
        notes: 'Spesifikasi teknis ASTM A36 dan toleransi tebal 0.5mm',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.notes).toBe('Spesifikasi teknis ASTM A36 dan toleransi tebal 0.5mm');
    });

    it('accepts valid payload without notes (optional)', async () => {
      const dto = plainToInstance(CreateRfqDto, {
        purchaseRequestId: 10,
        closingDate: '2026-11-20T12:00:00Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.notes).toBeUndefined();
    });

    it('rejects invalid notes type (e.g., number)', async () => {
      const dto = plainToInstance(CreateRfqDto, {
        purchaseRequestId: 10,
        closingDate: '2026-11-20T12:00:00Z',
        notes: 12345,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'notes')).toBe(true);
    });
  });

  describe('2. CreateGoodsReceiptDto Validation (P0-002)', () => {
    const validItem: GoodsReceiptItemDto = {
      poItemId: 1,
      receivedQuantity: 5,
      remarks: 'Kondisi kemasan utuh',
    };

    it('accepts valid payload with deliveryNoteNumber', async () => {
      const dto = plainToInstance(CreateGoodsReceiptDto, {
        purchaseOrderId: 5,
        receiptDate: '2026-11-15T09:00:00Z',
        deliveryNoteNumber: 'SJ-2026-11-0089',
        remarks: 'Diterima oleh security shift pagi',
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.deliveryNoteNumber).toBe('SJ-2026-11-0089');
    });

    it('accepts valid payload without deliveryNoteNumber (optional)', async () => {
      const dto = plainToInstance(CreateGoodsReceiptDto, {
        purchaseOrderId: 5,
        receiptDate: '2026-11-15T09:00:00Z',
        remarks: 'Tanpa nomor surat jalan',
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.deliveryNoteNumber).toBeUndefined();
    });

    it('rejects invalid deliveryNoteNumber type (e.g., number)', async () => {
      const dto = plainToInstance(CreateGoodsReceiptDto, {
        purchaseOrderId: 5,
        receiptDate: '2026-11-15T09:00:00Z',
        deliveryNoteNumber: 998877,
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'deliveryNoteNumber')).toBe(true);
    });
  });

  describe('3. TypeORM Migration File Contract (1793200000000)', () => {
    let migration: AddRfqNotesAndGoodsReceiptDeliveryNote1793200000000;
    let queryRunnerMock: any;

    beforeEach(() => {
      migration = new AddRfqNotesAndGoodsReceiptDeliveryNote1793200000000();
      queryRunnerMock = {
        hasColumn: jest.fn(),
        query: jest.fn().mockResolvedValue(true),
      };
    });

    it('up: executes ALTER TABLE when columns do not exist', async () => {
      queryRunnerMock.hasColumn.mockImplementation(async (tableName: string, colName: string) => false);

      await migration.up(queryRunnerMock);

      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('rfqs', 'notes');
      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('goods_receipts', 'delivery_note_number');

      expect(queryRunnerMock.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE `rfqs`\n        ADD COLUMN `notes` TEXT NULL AFTER `closing_date`'),
      );
      expect(queryRunnerMock.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE `goods_receipts`\n        ADD COLUMN `delivery_note_number` VARCHAR(100) NULL AFTER `remarks`'),
      );
    });

    it('up: is idempotent and skips column addition when columns already exist', async () => {
      queryRunnerMock.hasColumn.mockImplementation(async (tableName: string, colName: string) => true);

      await migration.up(queryRunnerMock);

      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('rfqs', 'notes');
      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('goods_receipts', 'delivery_note_number');
      expect(queryRunnerMock.query).not.toHaveBeenCalled();
    });

    it('down: drops columns when they exist', async () => {
      queryRunnerMock.hasColumn.mockImplementation(async (tableName: string, colName: string) => true);

      await migration.down(queryRunnerMock);

      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('goods_receipts', 'delivery_note_number');
      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('rfqs', 'notes');

      expect(queryRunnerMock.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE `goods_receipts`\n        DROP COLUMN `delivery_note_number`'),
      );
      expect(queryRunnerMock.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE `rfqs`\n        DROP COLUMN `notes`'),
      );
    });

    it('down: is idempotent and skips drop when columns do not exist', async () => {
      queryRunnerMock.hasColumn.mockImplementation(async (tableName: string, colName: string) => false);

      await migration.down(queryRunnerMock);

      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('goods_receipts', 'delivery_note_number');
      expect(queryRunnerMock.hasColumn).toHaveBeenCalledWith('rfqs', 'notes');
      expect(queryRunnerMock.query).not.toHaveBeenCalled();
    });
  });

  describe('4. ProcurementService RFQ Notes Persistence Mapping', () => {
    let service: ProcurementService;
    let prRepoMock: any;
    let rfqRepoMock: any;
    let dataSourceMock: any;
    let managerMock: any;

    beforeEach(() => {
      const mockApprovedPr: Partial<PurchaseRequest> = {
        id: 101,
        prNumber: 'PR-20261104-001',
        projectId: 7,
        status: 'APPROVED',
      };

      prRepoMock = {
        findOne: jest.fn().mockResolvedValue(mockApprovedPr),
      };

      rfqRepoMock = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
      };

      managerMock = {
        findOne: jest.fn().mockResolvedValue(null),
        createQueryBuilder: jest.fn().mockReturnValue({
          withDeleted: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            rfqNumber: 'RFQ-20261104-001',
          }),
        }),
        create: jest.fn().mockImplementation((entityClass, data) => ({
          ...data,
        })),
        save: jest.fn().mockImplementation((entityClass, data) =>
          Promise.resolve({
            id: 201,
            ...data,
            createdAt: new Date(),
          }),
        ),
      };

      dataSourceMock = {
        transaction: jest.fn().mockImplementation(async (cb) => cb(managerMock)),
      };

      service = new ProcurementService(
        prRepoMock,
        rfqRepoMock,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        dataSourceMock,
        {} as any,
      );
    });

    it('persists trimmed notes into Rfq entity when notes are supplied', async () => {
      const result = await service.createRfq({
        purchaseRequestId: 101,
        closingDate: '2026-11-20T12:00:00Z',
        notes: '   Kebutuhan mendesak untuk fase pondasi proyek   ',
      });

      expect(result.success).toBe(true);
      expect(managerMock.create).toHaveBeenCalledWith(
        Rfq,
        expect.objectContaining({
          prId: 101,
          notes: 'Kebutuhan mendesak untuk fase pondasi proyek',
        }),
      );
      expect(result.data.notes).toBe('Kebutuhan mendesak untuk fase pondasi proyek');
    });

    it('maps notes to null when notes property is undefined or empty', async () => {
      const result = await service.createRfq({
        purchaseRequestId: 101,
        closingDate: '2026-11-20T12:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(managerMock.create).toHaveBeenCalledWith(
        Rfq,
        expect.objectContaining({
          prId: 101,
          notes: null,
        }),
      );
      expect(result.data.notes).toBeNull();
    });
  });

  describe('5. ProcurementService Goods Receipt Delivery Note Persistence Mapping', () => {
    let service: ProcurementService;
    let poRepoMock: any;
    let grRepoMock: any;
    let dataSourceMock: any;
    let queryRunnerMock: any;
    let managerMock: any;

    const mockPo: Partial<PurchaseOrder> = {
      id: 50,
      poNumber: 'PO-20261104-001',
      orderType: 'GOODS' as any,
      status: 'ISSUED',
      items: [
        {
          id: 501,
          poId: 50,
          quantity: 10,
          receivedQuantity: 0,
          unitPrice: 150000,
        } as any,
      ],
    };

    beforeEach(() => {
      poRepoMock = {
        findOne: jest.fn().mockResolvedValue(mockPo),
      };

      grRepoMock = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
      };

      managerMock = {
        findOne: jest.fn().mockResolvedValue({
          ...mockPo,
          items: [
            {
              id: 501,
              poId: 50,
              quantity: 10,
              receivedQuantity: 0,
              unitPrice: 150000,
            },
          ],
        }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((entityClass, data) => ({
          ...data,
        })),
        save: jest.fn().mockImplementation((entityOrData, data) => {
          const payload = data !== undefined ? data : entityOrData;
          if (Array.isArray(payload)) {
            return Promise.resolve(payload.map((item, idx) => ({ id: idx + 1, ...item })));
          }
          return Promise.resolve({
            id: 301,
            ...payload,
            createdAt: new Date(),
          });
        }),
      };

      queryRunnerMock = {
        connect: jest.fn().mockResolvedValue(true),
        startTransaction: jest.fn().mockResolvedValue(true),
        commitTransaction: jest.fn().mockResolvedValue(true),
        rollbackTransaction: jest.fn().mockResolvedValue(true),
        release: jest.fn().mockResolvedValue(true),
        manager: managerMock,
      };

      dataSourceMock = {
        createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      };

      service = new ProcurementService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        poRepoMock,
        grRepoMock,
        {} as any,
        dataSourceMock,
        {} as any,
      );
    });

    it('persists trimmed deliveryNoteNumber into GoodsReceipt entity when provided', async () => {
      const result = await service.createGoodsReceipt(
        {
          purchaseOrderId: 50,
          receiptDate: '2026-11-04T10:00:00Z',
          deliveryNoteNumber: '   SJ-DO-2026/XI/0045   ',
          remarks: 'Surat jalan asli telah ditandatangani',
          items: [
            {
              poItemId: 501,
              receivedQuantity: 4,
              remarks: 'Batch A',
            },
          ],
        },
        99,
      );

      expect(result.success).toBe(true);
      expect(managerMock.create).toHaveBeenCalledWith(
        GoodsReceipt,
        expect.objectContaining({
          poId: 50,
          deliveryNoteNumber: 'SJ-DO-2026/XI/0045',
          remarks: 'Surat jalan asli telah ditandatangani',
        }),
      );
      expect(result.data.deliveryNoteNumber).toBe('SJ-DO-2026/XI/0045');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('maps deliveryNoteNumber to null when omitted', async () => {
      const result = await service.createGoodsReceipt(
        {
          purchaseOrderId: 50,
          receiptDate: '2026-11-04T10:00:00Z',
          items: [
            {
              poItemId: 501,
              receivedQuantity: 4,
            },
          ],
        },
        99,
      );

      expect(result.success).toBe(true);
      expect(managerMock.create).toHaveBeenCalledWith(
        GoodsReceipt,
        expect.objectContaining({
          poId: 50,
          deliveryNoteNumber: null,
        }),
      );
      expect(result.data.deliveryNoteNumber).toBeNull();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });
  });
});

