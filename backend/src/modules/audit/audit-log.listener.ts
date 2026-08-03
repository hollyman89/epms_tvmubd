import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class AuditLogListener {
  private readonly logger = new Logger(AuditLogListener.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  @OnEvent('audit.log')
  async handleAuditLog(payload: {
    action: string;
    entityId: number;
    entityName: string;
    reason?: string;
    oldValue?: any;
    newValue?: any;
    userId?: number;
    ipAddress?: string;
    userAgent?: string;
  }) {
    this.logger.log(`[audit.log] Received event for ${payload.entityName} ID: ${payload.entityId} Action: ${payload.action}`);

    try {
      const log = new AuditLog();
      log.table_name = payload.entityName;
      log.record_id = payload.entityId;
      log.action = payload.action;
      
      // We store the reason inside the new_value or old_value if not provided explicitly, 
      // or we just save it as part of new_value
      const finalNewValue = payload.newValue || {};
      if (payload.reason) {
        finalNewValue.reason = payload.reason;
      }
      
      log.old_value = payload.oldValue || null;
      log.new_value = Object.keys(finalNewValue).length > 0 ? finalNewValue : null;
      log.created_by = payload.userId || 0; // 0 for system
      log.ip_address = payload.ipAddress || null;
      log.user_agent = payload.userAgent || null;

      await this.auditLogRepo.save(log);
    } catch (err) {
      this.logger.error(`[audit.log] Failed to save audit log: ${err.message}`, err.stack);
    }
  }
}
