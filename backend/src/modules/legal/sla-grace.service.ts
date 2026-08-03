import { Injectable, OnModuleInit, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Contract } from '../../entities/contract.entity';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SlaGraceService implements OnModuleInit {
  private readonly logger = new Logger(SlaGraceService.name);

  constructor(
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 1. NestJS Startup Runner: Ensure Grace Extension Columns Exist
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing SLA Grace Deadline Migration Runner...');
      await this.dataSource.query(`
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_deadline TIMESTAMP NULL;
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_extended_by BIGINT NULL;
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_extended_at TIMESTAMP NULL;
        ALTER TABLE contracts ADD COLUMN IF NOT EXISTS grace_extension_count INT DEFAULT 0;
      `);
      this.logger.log('✅ SLA Grace Extension columns verified on database startup.');
    } catch (err: any) {
      this.logger.warn(`SLA Grace Startup Migration Notice: ${err.message}`);
    }
  }

  /**
   * 2. Event Listener: Triggers automatic 3-day grace extension when contract status becomes REVISION_REQUESTED
   */
  @OnEvent('contract.revision_requested')
  async handleRevisionRequested(payload: { contractId: number; userId: number; reason?: string }) {
    this.logger.log(`Handling contract.revision_requested for Contract #${payload.contractId}`);
    await this.requestGraceExtension(payload.contractId, 3, payload.userId, payload.reason || 'Revisi Dokumen dari Legal');
  }

  /**
   * 3. Core Logic: Request SLA Grace Extension (Enforces Max 3 Limit)
   */
  async requestGraceExtension(contractId: number, daysToAdd: number = 3, userId: number, reason?: string) {
    const contract = await this.contractRepo.findOne({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    const currentCount = Number(contract.grace_extension_count || 0);

    // Enforce Max 3 Extensions Limit
    if (currentCount >= 3) {
      throw new BadRequestException(
        `Batas Maksimal Perpanjangan Grace SLA (3x) telah tercapai untuk Kontrak #${contractId}! Tidak dapat menambah grace period lagi.`
      );
    }

    const now = new Date();
    const currentDeadline = contract.grace_deadline ? new Date(contract.grace_deadline) : now;
    const newDeadline = new Date(currentDeadline.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    contract.grace_deadline = newDeadline;
    contract.grace_extended_by = userId;
    contract.grace_extended_at = now;
    contract.grace_extension_count = currentCount + 1;

    await this.contractRepo.save(contract);

    // Audit Log & Notification
    this.eventEmitter.emit('audit.log', {
      action: 'SLA_GRACE_EXTENDED',
      entityId: contractId,
      entityName: 'contracts',
      reason: `Grace deadline extended +${daysToAdd} days (Attempt ${contract.grace_extension_count}/3). Reason: ${reason || 'N/A'}`,
      userId,
    });

    this.eventEmitter.emit('notification.send', {
      recipientId: userId,
      title: 'Grace SLA Deadline Diperpanjang',
      message: `Batas waktu SLA Kontrak diperpanjang +${daysToAdd} hari hingga ${newDeadline.toLocaleDateString('id-ID')}. (Perpanjangan ke-${contract.grace_extension_count}/3).`,
      type: 'INFO',
    });

    return {
      statusCode: 200,
      contractId,
      extensionCount: contract.grace_extension_count,
      maxLimit: 3,
      graceDeadline: newDeadline.toISOString(),
      message: `Perpanjangan Grace SLA ke-${contract.grace_extension_count}/3 berhasil diterapkan (+${daysToAdd} hari).`,
    };
  }

  /**
   * 4. Fetch Active Grace Extensions for Dashboard Widget
   */
  async getActiveGraceExtensions() {
    try {
      const activeContracts = await this.contractRepo.find({
        take: 10
      });

      return activeContracts.map((c) => ({
        contractId: c.id,
        contractNumber: c.contract_number,
        extensionCount: c.grace_extension_count || 0,
        maxLimit: 3,
        graceDeadline: c.grace_deadline || null,
        extendedAt: c.grace_extended_at || null,
        status: c.legal_status || c.status || 'ACTIVE',
      }));
    } catch (e) {
      return [];
    }
  }
}
