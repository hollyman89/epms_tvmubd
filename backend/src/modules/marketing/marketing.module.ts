import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { TenderScheduler } from './tender.scheduler';
import { Customer } from '../../entities/customer.entity';
import { Tender } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract } from '../../entities/contract.entity';
import { TenderActivity } from '../../entities/tender-activity.entity';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { User } from '../../entities/user.entity';
import { NotificationModule } from '../notification/notification.module';

import { SalesGateway } from './sales.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Tender, Proposal, Contract, TenderActivity, TenderPriceHistory, User]),
    NotificationModule, // Replaces RabbitMQ — uses EventEmitter2 + WebSocket
  ],
  controllers: [MarketingController],
  providers: [MarketingService, TenderScheduler, SalesGateway],
  exports: [MarketingService, SalesGateway],
})
export class MarketingModule {}

