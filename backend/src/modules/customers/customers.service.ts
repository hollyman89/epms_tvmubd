import { Injectable, NotFoundException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Not, In } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Tender } from '../../entities/tender.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Tender) private tendersRepository: Repository<Tender>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  private async logAudit(action: 'UPDATE' | 'SOFT_DELETE' | 'RESTORE', entityId: number, oldData: any, newData: any, userId: number, ipAddress?: string, userAgent?: string) {
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

  private async generateNextCode(): Promise<string> {
    const lastCustomer = await this.customerRepo.findOne({
      order: { id: 'DESC' },
      where: {}
    });

    let nextSeq = 1;
    if (lastCustomer && lastCustomer.code) {
      const match = lastCustomer.code.match(/CUST-(\d+)/);
      if (match && match[1]) {
        nextSeq = parseInt(match[1], 10) + 1;
      } else {
        // Fallback to id if parsing fails
        nextSeq = Number(lastCustomer.id) + 1;
      }
    }

    const formattedSeq = nextSeq.toString().padStart(3, '0');
    return `CUST-${formattedSeq}`;
  }

  async create(dto: CreateCustomerDto, userId: number) {
    const code = await this.generateNextCode();
    const customer = this.customerRepo.create({
      ...dto,
      code,
      created_by: userId,
    });
    return this.customerRepo.save(customer);
  }

  async findAll(query: CustomerQueryDto) {
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

  async findOne(id: number) {
    const customer = await this.customerRepo.findOne({ 
      where: { id },
      relations: ['tenders']
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: number, dto: UpdateCustomerDto, userId: number, ipAddress?: string, userAgent?: string) {
    if (dto.company !== undefined) {
      const existing = await this.customerRepo.findOne({
        where: {
          company: dto.company,
          id: Not(id),
        },
      });
      if (existing) {
        throw new HttpException('Legal Company sudah terdaftar. Harap gunakan nama yang unik.', 409);
      }
    }

    const oldData = await this.findOne(id);
    await this.customerRepo.update(id, { ...dto, updated_by: userId });
    const newData = await this.findOne(id);

    await this.logAudit('UPDATE', id, oldData, newData, userId, ipAddress, userAgent);

    return newData;
  }

  async remove(id: number, userId: number, ipAddress?: string, userAgent?: string) {
    const customer = await this.findOne(id);

    const activeTenders = await this.tendersRepository.find({
      where: {
        customer_id: id,
        status: Not(In(['WON', 'LOST', 'CANCELLED'] as any)),
      },
    });

    if (activeTenders.length > 0) {
      const tenderNames = activeTenders.map(t => t.title).join(', ');
      throw new HttpException(`Tidak dapat menghapus Customer karena masih memiliki Tender aktif: ${tenderNames}`, 409);
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

  async importCustomers(items: any[], userId: number) {
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
}
