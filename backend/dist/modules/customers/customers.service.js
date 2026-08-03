"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const customer_entity_1 = require("../../entities/customer.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
let CustomersService = class CustomersService {
    constructor(customerRepo, tendersRepository, auditRepo) {
        this.customerRepo = customerRepo;
        this.tendersRepository = tendersRepository;
        this.auditRepo = auditRepo;
    }
    async logAudit(action, entityId, oldData, newData, userId, ipAddress, userAgent) {
        const log = this.auditRepo.create({
            action,
            table_name: 'customers',
            record_id: entityId,
            old_value: oldData,
            new_value: newData,
            created_by: userId,
            ip_address: ipAddress,
            user_agent: userAgent,
        });
        await this.auditRepo.save(log);
    }
    async generateNextCode() {
        const lastCustomer = await this.customerRepo.findOne({
            order: { id: 'DESC' },
            where: {}
        });
        let nextSeq = 1;
        if (lastCustomer && lastCustomer.code) {
            const match = lastCustomer.code.match(/CUST-(\d+)/);
            if (match && match[1]) {
                nextSeq = parseInt(match[1], 10) + 1;
            }
            else {
                nextSeq = Number(lastCustomer.id) + 1;
            }
        }
        const formattedSeq = nextSeq.toString().padStart(3, '0');
        return `CUST-${formattedSeq}`;
    }
    async create(dto, userId) {
        const code = await this.generateNextCode();
        const customer = this.customerRepo.create({
            ...dto,
            code,
            created_by: userId,
        });
        return this.customerRepo.save(customer);
    }
    async findAll(query) {
        const { search, sector, status, page = 1, limit = 10 } = query;
        const qb = this.customerRepo.createQueryBuilder('customer');
        if (search) {
            qb.andWhere('(customer.name LIKE :search OR customer.company LIKE :search OR customer.email LIKE :search)', { search: `%${search}%` });
        }
        if (sector) {
            qb.andWhere('customer.business_sector = :sector', { sector });
        }
        if (status) {
            qb.andWhere('customer.status = :status', { status });
        }
        qb.orderBy('customer.id', 'DESC');
        qb.skip((page - 1) * limit);
        qb.take(limit);
        const [data, total] = await qb.getManyAndCount();
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async findOne(id) {
        const customer = await this.customerRepo.findOne({
            where: { id },
            relations: ['tenders']
        });
        if (!customer)
            throw new common_1.NotFoundException('Customer not found');
        return customer;
    }
    async update(id, dto, userId, ipAddress, userAgent) {
        if (dto.company !== undefined) {
            const existing = await this.customerRepo.findOne({
                where: {
                    company: dto.company,
                    id: (0, typeorm_2.Not)(id),
                },
            });
            if (existing) {
                throw new common_1.HttpException('Legal Company sudah terdaftar. Harap gunakan nama yang unik.', 409);
            }
        }
        const oldData = await this.findOne(id);
        await this.customerRepo.update(id, { ...dto, updated_by: userId });
        const newData = await this.findOne(id);
        await this.logAudit('UPDATE', id, oldData, newData, userId, ipAddress, userAgent);
        return newData;
    }
    async remove(id, userId, ipAddress, userAgent) {
        const customer = await this.findOne(id);
        const activeTenders = await this.tendersRepository.find({
            where: {
                customer_id: id,
                status: (0, typeorm_2.Not)((0, typeorm_2.In)(['WON', 'LOST', 'CANCELLED'])),
            },
        });
        if (activeTenders.length > 0) {
            const tenderNames = activeTenders.map(t => t.title).join(', ');
            throw new common_1.HttpException(`Tidak dapat menghapus Customer karena masih memiliki Tender aktif: ${tenderNames}`, 409);
        }
        await this.customerRepo.update(id, { deleted_by: userId });
        await this.customerRepo.softDelete(id);
        await this.logAudit('SOFT_DELETE', id, customer, null, userId, ipAddress, userAgent);
        return { message: 'Customer deleted successfully' };
    }
    async exportCustomers() {
        const customers = await this.customerRepo.find();
        return {
            filename: `customers_export_${Date.now()}.csv`,
            total: customers.length,
            data: customers,
        };
    }
    async importCustomers(items, userId) {
        let imported = 0;
        for (const item of items) {
            if (item.name) {
                const uniqueSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
                const code = item.code || `CUST-IMP-${uniqueSuffix}`;
                const c = this.customerRepo.create({
                    ...item,
                    code,
                    company: item.company || item.name,
                    created_by: userId,
                });
                await this.customerRepo.save(c);
                imported++;
            }
        }
        return { status: 'success', imported };
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __param(1, (0, typeorm_1.InjectRepository)(tender_entity_1.Tender)),
    __param(2, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CustomersService);
//# sourceMappingURL=customers.service.js.map