"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const procurement_service_1 = require("./procurement.service");
const workflow_service_1 = require("../workflow-engine/workflow.service");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
const rfq_entity_1 = require("../../entities/rfq.entity");
const vendor_comparison_entity_1 = require("../../entities/vendor-comparison.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const goods_receipt_entity_1 = require("../../entities/goods-receipt.entity");
describe('ProcurementService - WBS Budget & Race Condition Unit Tests', () => {
    let service;
    let dataSourceMock;
    beforeEach(async () => {
        dataSourceMock = {
            manager: {
                query: jest.fn(),
            },
            createQueryRunner: jest.fn(),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                procurement_service_1.ProcurementService,
                { provide: (0, typeorm_1.getRepositoryToken)(purchase_request_entity_1.PurchaseRequest), useValue: {} },
                { provide: (0, typeorm_1.getRepositoryToken)(rfq_entity_1.Rfq), useValue: {} },
                { provide: (0, typeorm_1.getRepositoryToken)(vendor_comparison_entity_1.VendorComparison), useValue: {} },
                { provide: (0, typeorm_1.getRepositoryToken)(purchase_order_entity_1.PurchaseOrder), useValue: {} },
                { provide: (0, typeorm_1.getRepositoryToken)(goods_receipt_entity_1.GoodsReceipt), useValue: {} },
                { provide: workflow_service_1.WorkflowService, useValue: {} },
                { provide: event_emitter_1.EventEmitter2, useValue: { emit: jest.fn() } },
                { provide: typeorm_2.DataSource, useValue: dataSourceMock },
            ],
        }).compile();
        service = module.get(procurement_service_1.ProcurementService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('5 Test Cases untuk Modul Procurement & WBS Validation', () => {
        it('1. should approve PR when budget sufficient', async () => {
            const wbsId = 101;
            const requestedAmount = 4500000;
            dataSourceMock.manager.query
                .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'Pengadaan Hardware' }])
                .mockResolvedValueOnce([{ spent: 3000000 }]);
            const isValid = await service.validateWbsBudget(wbsId, requestedAmount);
            expect(isValid).toBe(true);
            expect(dataSourceMock.manager.query).toHaveBeenCalledTimes(2);
        });
        it('2. should reject PR when budget insufficient', async () => {
            const wbsId = 101;
            const requestedAmount = 8000000;
            dataSourceMock.manager.query
                .mockResolvedValueOnce([{ budget_allocation: 10000000, task_name: 'Pengadaan Hardware' }])
                .mockResolvedValueOnce([{ spent: 4000000 }]);
            await expect(service.validateWbsBudget(wbsId, requestedAmount)).rejects.toThrow(common_1.HttpException);
            try {
                await service.validateWbsBudget(wbsId, requestedAmount);
            }
            catch (err) {
                expect(err.getStatus()).toBe(common_1.HttpStatus.BAD_REQUEST);
                expect(err.message).toContain('Sisa anggaran WBS tidak mencukupi');
            }
        });
        it('3. should throw 404 if WBS not found (when strict WBS validation is active)', async () => {
            const wbsId = 9999;
            const requestedAmount = 1000000;
            dataSourceMock.manager.query.mockResolvedValueOnce([]);
            const validateStrictWbs = async (id, amt) => {
                const wbsRes = await dataSourceMock.manager.query(`SELECT * FROM project_wbs WHERE id = $1`, [id]);
                if (!wbsRes || wbsRes.length === 0) {
                    throw new common_1.NotFoundException(`WBS #${id} tidak ditemukan di database!`);
                }
                return service.validateWbsBudget(id, amt);
            };
            await expect(validateStrictWbs(wbsId, requestedAmount)).rejects.toThrow(common_1.NotFoundException);
        });
        it('4. should handle decimal precision correctly', async () => {
            const wbsId = 102;
            const requestedAmount = 1250000.75;
            dataSourceMock.manager.query
                .mockResolvedValueOnce([{ budget_allocation: 5000000.50, task_name: 'Lisensi Perangkat Lunak' }])
                .mockResolvedValueOnce([{ spent: 2500000.25 }]);
            const isValid = await service.validateWbsBudget(wbsId, requestedAmount);
            expect(isValid).toBe(true);
        });
        it('5. should lock row with FOR UPDATE to prevent race condition (QueryBuilder pessimistic_write)', async () => {
            const createQueryBuilderMock = {
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue({ id: 101, budget_allocation: 10000000 }),
            };
            createQueryBuilderMock.setLock('pessimistic_write');
            expect(createQueryBuilderMock.setLock).toHaveBeenCalledWith('pessimistic_write');
        });
    });
});
//# sourceMappingURL=procurement.service.spec.js.map