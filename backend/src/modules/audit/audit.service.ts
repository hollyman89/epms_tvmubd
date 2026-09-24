import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { AuditQueryDto } from './dto/audit-query.dto';

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /credential/i,
];

/**
 * Recursively sanitizes JSON snapshot values in memory.
 * Never modifies the underlying database record.
 */
export function sanitizeSnapshot(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshot(item));
  }

  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      result[key] = sanitizeSnapshot(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export interface SafeActor {
  id: number;
  full_name: string;
  email: string;
}

export interface AuditLogResponseItem {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent: string | null;
  created_by: number | null;
  created_at: Date;
  actor: SafeActor | null;
}

export interface PaginatedAuditLogsResponse {
  data: AuditLogResponseItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Canonical Read Query for EPMS Audit Trail.
   * STRICT READ ONLY - never mutates or writes audit records.
   */
  async getAuditLogs(query: AuditQueryDto): Promise<PaginatedAuditLogsResponse> {
    // 1. Enforce bounded pagination parameters
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    // 2. Build parameterized query
    const qb = this.auditLogRepo.createQueryBuilder('audit');

    // 3. Exact table name filter
    if (query.tableName && query.tableName.trim()) {
      qb.andWhere('audit.table_name = :tableName', { tableName: query.tableName.trim() });
    }

    // 4. Exact action filter
    if (query.action && query.action.trim()) {
      qb.andWhere('audit.action = :action', { action: query.action.trim() });
    }

    // 5. Actor ID filter (0 allowed for System)
    if (query.actorId !== undefined && query.actorId !== null && !isNaN(Number(query.actorId))) {
      qb.andWhere('audit.created_by = :actorId', { actorId: Number(query.actorId) });
    }

    // 6. Date range filtering with timestamp-safe boundary semantics
    // dateFrom: >= start of requested date
    if (query.dateFrom) {
      const fromDate = new Date(query.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        if (query.dateFrom.length === 10) {
          fromDate.setUTCHours(0, 0, 0, 0);
        }
        qb.andWhere('audit.created_at >= :dateFrom', { dateFrom: fromDate });
      }
    }

    // dateTo: < start of following date (if YYYY-MM-DD) so entire selected date is included
    if (query.dateTo) {
      const toDate = new Date(query.dateTo);
      if (!isNaN(toDate.getTime())) {
        if (query.dateTo.length === 10) {
          toDate.setUTCDate(toDate.getUTCDate() + 1);
          toDate.setUTCHours(0, 0, 0, 0);
          qb.andWhere('audit.created_at < :dateTo', { dateTo: toDate });
        } else {
          qb.andWhere('audit.created_at <= :dateTo', { dateTo: toDate });
        }
      }
    }

    // 7. Search semantics: explicitly searches across table_name, action, record_id
    if (query.search && query.search.trim()) {
      const trimmedSearch = query.search.trim();
      const numericRecordId = Number(trimmedSearch);

      if (!isNaN(numericRecordId) && Number.isInteger(numericRecordId) && numericRecordId > 0) {
        qb.andWhere(
          '(audit.table_name LIKE :searchPattern OR audit.action LIKE :searchPattern OR audit.record_id = :numericRecordId)',
          { searchPattern: `%${trimmedSearch}%`, numericRecordId },
        );
      } else {
        qb.andWhere(
          '(audit.table_name LIKE :searchPattern OR audit.action LIKE :searchPattern)',
          { searchPattern: `%${trimmedSearch}%` },
        );
      }
    }

    // 8. Deterministic descending order by created_at DESC, id DESC
    qb.orderBy('audit.created_at', 'DESC');
    qb.addOrderBy('audit.id', 'DESC');

    // 9. Pagination execution
    qb.skip(skip);
    qb.take(limit);

    const [logs, total] = await qb.getManyAndCount();

    // 10. Safe Actor Lookup: Batch query from users table exposing ONLY id, full_name, email
    const userIds = [
      ...new Set(
        logs
          .map((l) => Number(l.created_by))
          .filter((id) => id > 0 && !isNaN(id)),
      ),
    ];

    const userMap = new Map<number, SafeActor>();
    if (userIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(userIds) },
        select: ['id', 'fullName', 'email'],
      });
      for (const u of users) {
        userMap.set(Number(u.id), {
          id: Number(u.id),
          full_name: u.fullName,
          email: u.email,
        });
      }
    }

    // 11. Transform into canonical response format with in-memory snapshot sanitization
    const data: AuditLogResponseItem[] = logs.map((log) => {
      let actor: SafeActor | null = null;
      const createdByNum = log.created_by !== null && log.created_by !== undefined ? Number(log.created_by) : null;

      if (createdByNum === 0 || createdByNum === null) {
        actor = { id: 0, full_name: 'System', email: 'system@epms.internal' };
      } else if (userMap.has(createdByNum)) {
        actor = userMap.get(createdByNum)!;
      } else {
        actor = { id: createdByNum, full_name: `User #${createdByNum}`, email: '' };
      }

      return {
        id: Number(log.id),
        table_name: log.table_name,
        record_id: Number(log.record_id),
        action: log.action,
        old_value: sanitizeSnapshot(log.old_value),
        new_value: sanitizeSnapshot(log.new_value),
        ip_address: log.ip_address || null,
        user_agent: log.user_agent || null,
        created_by: createdByNum,
        created_at: log.created_at,
        actor,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
