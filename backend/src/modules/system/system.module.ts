import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { TracingInterceptor } from './tracing.interceptor';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, Contract, Tender, Project, AuditLog]),
  ],
  controllers: [ObservabilityController],
  providers: [
    ObservabilityService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TracingInterceptor,
    },
  ],
  exports: [ObservabilityService],
})
export class SystemModule {}
