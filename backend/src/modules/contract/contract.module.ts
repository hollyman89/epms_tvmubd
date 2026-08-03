import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { PdfTemplateService } from './pdf-template.service';
import { PdfTemplateController } from './pdf-template.controller';
import { Contract } from '../../entities/contract.entity';
import { ContractAmendment } from '../../entities/contract-amendment.entity';
import { Tender } from '../../entities/tender.entity';
import { User } from '../../entities/user.entity';
import { PdfTemplate } from '../../entities/pdf-template.entity';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractAmendment, Tender, User, PdfTemplate]),
    QueueModule,
  ],
  controllers: [ContractController, PdfTemplateController],
  providers: [ContractService, PdfTemplateService],
  exports: [ContractService, PdfTemplateService],
})
export class ContractModule {}
