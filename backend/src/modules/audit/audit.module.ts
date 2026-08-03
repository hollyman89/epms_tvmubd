import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogListener } from './audit-log.listener';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog])
  ],
  providers: [AuditLogListener],
})
export class AuditModule {}
