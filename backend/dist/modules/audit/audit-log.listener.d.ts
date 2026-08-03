import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
export declare class AuditLogListener {
    private readonly auditLogRepo;
    private readonly logger;
    constructor(auditLogRepo: Repository<AuditLog>);
    handleAuditLog(payload: {
        action: string;
        entityId: number;
        entityName: string;
        reason?: string;
        oldValue?: any;
        newValue?: any;
        userId?: number;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;
}
