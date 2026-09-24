import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogListener } from './audit-log.listener';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, User]),
  ],
  controllers: [AuditController],
  providers: [AuditLogListener, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
