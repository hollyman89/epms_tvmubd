import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import Decimal from 'decimal.js';
import { TaxRemittanceRecord, RemittanceStatus } from '../../entities/tax-remittance-record.entity';
import { TaxRemittanceAllocation, AllocationStatus } from '../../entities/tax-remittance-allocation.entity';
import { PphWithholdingRecord, RecognitionStatus } from '../../entities/pph-withholding-record.entity';
import { StatutoryTaxLiability, StatutoryLiabilityStatus } from '../../entities/statutory-tax-liability.entity';

export interface CreateDraftRemittanceDto {
  companyCode: string;
  taxPeriodMonth: number;
  taxPeriodYear: number;
  taxRegime: string;
  djpBillingCode: string;
  remittedAmount: number;
  bankAccountNumber: string;
  djpBillingExpiredAt?: Date | null;
}

export interface SettleRemittanceNtpnDto {
  remittanceId: number;
  ntpn: string;
  remittanceDate: Date;
  bankReferenceNumber: string;
}

export interface AllocateRemittanceDto {
  remittanceRecordId: number;
  withholdingRecordId: number;
  allocatedAmount: number;
}

export interface ReverseRemittanceDto {
  remittanceRecordId: number;
  reversalReason: string;
}

@Injectable()
export class TaxRemittanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TaxRemittanceRecord)
    private readonly remittanceRepository: Repository<TaxRemittanceRecord>,
    @InjectRepository(TaxRemittanceAllocation)
    private readonly allocationRepository: Repository<TaxRemittanceAllocation>,
    @InjectRepository(PphWithholdingRecord)
    private readonly withholdingRepository: Repository<PphWithholdingRecord>,
    @InjectRepository(StatutoryTaxLiability)
    private readonly liabilityRepository: Repository<StatutoryTaxLiability>,
  ) {}

  private toMoney(val: any): Decimal {
    if (val === undefined || val === null) return new Decimal(0);
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return new Decimal(0);
    return new Decimal(String(val).trim()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  async createDraftBilling(dto: CreateDraftRemittanceDto, userId: number): Promise<TaxRemittanceRecord> {
    const companyCode = String(dto.companyCode || '').toUpperCase();
    if (!['UBD', 'TVM'].includes(companyCode)) {
      throw new BadRequestException(`Invalid company_code: ${companyCode}. Must be UBD or TVM.`);
    }

    const remittedAmount = this.toMoney(dto.remittedAmount);
    if (!remittedAmount.greaterThan(0)) {
      throw new BadRequestException('Remitted amount must be greater than 0');
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.remittanceRepository.count();
    const remittanceNumber = `REM-${companyCode}-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const record = this.remittanceRepository.create({
      remittanceNumber,
      companyCode,
      taxPeriodMonth: dto.taxPeriodMonth,
      taxPeriodYear: dto.taxPeriodYear,
      taxRegime: dto.taxRegime,
      djpBillingCode: dto.djpBillingCode,
      djpBillingExpiredAt: dto.djpBillingExpiredAt || null,
      remittedAmount: remittedAmount.toNumber(),
      allocatedAmount: 0.0,
      unallocatedAmount: remittedAmount.toNumber(),
      bankAccountNumber: dto.bankAccountNumber,
      remittanceStatus: RemittanceStatus.DRAFT_BILLING,
      createdBy: userId,
    });

    return await this.remittanceRepository.save(record);
  }

  async settleRemittanceNtpn(dto: SettleRemittanceNtpnDto, userId: number): Promise<TaxRemittanceRecord> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const record = await queryRunner.manager.findOne(TaxRemittanceRecord, {
        where: { id: dto.remittanceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!record) {
        throw new NotFoundException(`Remittance record ${dto.remittanceId} not found`);
      }

      if (record.remittanceStatus !== RemittanceStatus.DRAFT_BILLING) {
        throw new BadRequestException(
          `Cannot settle remittance in status ${record.remittanceStatus}. Must be DRAFT_BILLING.`
        );
      }

      if (!dto.ntpn || dto.ntpn.length !== 16) {
        throw new BadRequestException('NTPN must be a valid 16-character alphanumeric string');
      }

      record.ntpn = dto.ntpn.toUpperCase();
      record.remittanceDate = dto.remittanceDate;
      record.bankReferenceNumber = dto.bankReferenceNumber;
      record.remittanceStatus = RemittanceStatus.SETTLED_NTPN;
      record.executedBy = userId;

      const saved = await queryRunner.manager.save(TaxRemittanceRecord, record);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async allocateRemittance(dto: AllocateRemittanceDto, userId: number): Promise<TaxRemittanceAllocation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const remittance = await queryRunner.manager.findOne(TaxRemittanceRecord, {
        where: { id: dto.remittanceRecordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!remittance) {
        throw new NotFoundException(`Remittance record ${dto.remittanceRecordId} not found`);
      }
      if (remittance.remittanceStatus !== RemittanceStatus.SETTLED_NTPN) {
        throw new BadRequestException('Only SETTLED_NTPN remittances can be allocated to withholding records');
      }

      const withholding = await queryRunner.manager.findOne(PphWithholdingRecord, {
        where: { id: dto.withholdingRecordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!withholding) {
        throw new NotFoundException(`Withholding record ${dto.withholdingRecordId} not found`);
      }
      if (withholding.recognitionStatus === RecognitionStatus.CANCELLED) {
        throw new BadRequestException('Cannot allocate remittance to a CANCELLED withholding record');
      }

      // Assert Dimensional Equality (Invariant 3)
      if (
        remittance.companyCode !== withholding.companyCode ||
        remittance.taxPeriodYear !== withholding.taxPeriodYear ||
        remittance.taxPeriodMonth !== withholding.taxPeriodMonth ||
        remittance.taxRegime !== withholding.pphRegime
      ) {
        throw new BadRequestException(
          `Dimensional mismatch between Remittance (${remittance.companyCode}, ${remittance.taxPeriodYear}-${remittance.taxPeriodMonth}, ${remittance.taxRegime}) and Withholding (${withholding.companyCode}, ${withholding.taxPeriodYear}-${withholding.taxPeriodMonth}, ${withholding.pphRegime})`
        );
      }

      const liability = await queryRunner.manager.findOne(StatutoryTaxLiability, {
        where: { id: withholding.statutoryTaxLiabilityId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!liability) {
        throw new NotFoundException(`Statutory liability ${withholding.statutoryTaxLiabilityId} not found`);
      }

      const allocateAmountDec = this.toMoney(dto.allocatedAmount);
      if (!allocateAmountDec.greaterThan(0)) {
        throw new BadRequestException('Allocation amount must be greater than 0');
      }

      const unallocatedDec = this.toMoney(remittance.unallocatedAmount);
      if (allocateAmountDec.greaterThan(unallocatedDec)) {
        throw new BadRequestException(
          `Allocation amount (${allocateAmountDec.toNumber()}) exceeds available unallocated remittance cash (${unallocatedDec.toNumber()})`
        );
      }

      const outstandingWithholdingDec = this.toMoney(withholding.outstandingWithheldAmount);
      if (allocateAmountDec.greaterThan(outstandingWithholdingDec)) {
        throw new BadRequestException(
          `Allocation amount (${allocateAmountDec.toNumber()}) exceeds outstanding withholding obligation (${outstandingWithholdingDec.toNumber()})`
        );
      }

      // Update Remittance
      remittance.allocatedAmount = this.toMoney(remittance.allocatedAmount).plus(allocateAmountDec).toNumber();
      remittance.unallocatedAmount = this.toMoney(remittance.unallocatedAmount).minus(allocateAmountDec).toNumber();
      await queryRunner.manager.save(TaxRemittanceRecord, remittance);

      // Update Withholding
      const newTotalRemitted = this.toMoney(withholding.totalRemittedAmount).plus(allocateAmountDec);
      const newOutstanding = this.toMoney(withholding.withheldAmount).minus(newTotalRemitted);
      withholding.totalRemittedAmount = newTotalRemitted.toNumber();
      withholding.outstandingWithheldAmount = newOutstanding.toNumber();
      if (newOutstanding.equals(0)) {
        withholding.recognitionStatus = RecognitionStatus.FULLY_REMITTED;
      } else {
        withholding.recognitionStatus = RecognitionStatus.PARTIALLY_REMITTED;
      }
      await queryRunner.manager.save(PphWithholdingRecord, withholding);

      // Update Statutory Liability
      const newLiabilityRemitted = this.toMoney(liability.totalRemittedAmount).plus(allocateAmountDec);
      const newLiabilityOutstanding = this.toMoney(liability.totalWithheldAmount).minus(newLiabilityRemitted);
      liability.totalRemittedAmount = newLiabilityRemitted.toNumber();
      liability.outstandingBalance = newLiabilityOutstanding.toNumber();
      if (newLiabilityOutstanding.equals(0) && this.toMoney(liability.totalWithheldAmount).greaterThan(0)) {
        liability.status = StatutoryLiabilityStatus.DISCHARGED;
      } else {
        liability.status = StatutoryLiabilityStatus.PARTIALLY_SETTLED;
      }
      await queryRunner.manager.save(StatutoryTaxLiability, liability);

      // Create Allocation
      const allocation = queryRunner.manager.create(TaxRemittanceAllocation, {
        remittanceRecordId: remittance.id,
        withholdingRecordId: withholding.id,
        statutoryLiabilityId: liability.id,
        companyCode: remittance.companyCode,
        taxPeriodMonth: remittance.taxPeriodMonth,
        taxPeriodYear: remittance.taxPeriodYear,
        taxRegime: remittance.taxRegime,
        allocatedAmount: allocateAmountDec.toNumber(),
        allocationStatus: AllocationStatus.ALLOCATED,
        allocatedBy: userId,
      });

      const savedAllocation = await queryRunner.manager.save(TaxRemittanceAllocation, allocation);
      await queryRunner.commitTransaction();
      return savedAllocation;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async reverseRemittance(dto: ReverseRemittanceDto, userId: number): Promise<TaxRemittanceRecord> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const remittance = await queryRunner.manager.findOne(TaxRemittanceRecord, {
        where: { id: dto.remittanceRecordId },
        lock: { mode: 'pessimistic_write' },
        relations: ['allocations'],
      });
      if (!remittance) {
        throw new NotFoundException(`Remittance ${dto.remittanceRecordId} not found`);
      }
      if (remittance.remittanceStatus === RemittanceStatus.REVERSED) {
        throw new BadRequestException('Remittance is already REVERSED');
      }
      if (!dto.reversalReason) {
        throw new BadRequestException('reversalReason is mandatory');
      }

      // Reverse all active allocations
      const activeAllocations = (remittance.allocations || []).filter(
        a => a.allocationStatus === AllocationStatus.ALLOCATED
      );

      const now = new Date();
      for (const alloc of activeAllocations) {
        alloc.allocationStatus = AllocationStatus.REVERSED;
        alloc.reversalReason = dto.reversalReason;
        alloc.reversedBy = userId;
        alloc.reversedAt = now;
        await queryRunner.manager.save(TaxRemittanceAllocation, alloc);

        // Revert Withholding
        const withholding = await queryRunner.manager.findOne(PphWithholdingRecord, {
          where: { id: alloc.withholdingRecordId },
          lock: { mode: 'pessimistic_write' },
        });
        if (withholding && withholding.recognitionStatus !== RecognitionStatus.CANCELLED) {
          const revertedRemitted = this.toMoney(withholding.totalRemittedAmount).minus(alloc.allocatedAmount);
          const revertedOutstanding = this.toMoney(withholding.withheldAmount).minus(revertedRemitted);
          withholding.totalRemittedAmount = Math.max(0, revertedRemitted.toNumber());
          withholding.outstandingWithheldAmount = revertedOutstanding.toNumber();
          if (revertedRemitted.equals(0)) {
            withholding.recognitionStatus = RecognitionStatus.RECOGNIZED_UNREMITTED;
          } else {
            withholding.recognitionStatus = RecognitionStatus.PARTIALLY_REMITTED;
          }
          await queryRunner.manager.save(PphWithholdingRecord, withholding);
        }

        // Revert Liability
        const liability = await queryRunner.manager.findOne(StatutoryTaxLiability, {
          where: { id: alloc.statutoryLiabilityId },
          lock: { mode: 'pessimistic_write' },
        });
        if (liability) {
          const revertedLiabilityRemitted = this.toMoney(liability.totalRemittedAmount).minus(alloc.allocatedAmount);
          const revertedLiabilityOutstanding = this.toMoney(liability.totalWithheldAmount).minus(revertedLiabilityRemitted);
          liability.totalRemittedAmount = Math.max(0, revertedLiabilityRemitted.toNumber());
          liability.outstandingBalance = revertedLiabilityOutstanding.toNumber();
          if (revertedLiabilityRemitted.equals(0)) {
            liability.status = StatutoryLiabilityStatus.OPEN;
          } else {
            liability.status = StatutoryLiabilityStatus.PARTIALLY_SETTLED;
          }
          await queryRunner.manager.save(StatutoryTaxLiability, liability);
        }
      }

      // Update Remittance Voucher to REVERSED
      remittance.remittanceStatus = RemittanceStatus.REVERSED;
      remittance.allocatedAmount = 0.0;
      remittance.unallocatedAmount = remittance.remittedAmount;
      remittance.reversalReason = dto.reversalReason;
      remittance.reversedBy = userId;
      remittance.reversedAt = now;

      const savedRemittance = await queryRunner.manager.save(TaxRemittanceRecord, remittance);
      await queryRunner.commitTransaction();
      return savedRemittance;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

