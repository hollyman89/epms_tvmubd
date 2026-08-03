import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { SlaGraceService } from './sla-grace.service';
import { Contract } from '../../entities/contract.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Tender } from '../../entities/tender.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Proposal, Tender, Project, AuditLog, OutboxEvent])],
  controllers: [LegalController],
  providers: [LegalService, SlaGraceService],
  exports: [LegalService, SlaGraceService],
})
export class LegalModule {}
