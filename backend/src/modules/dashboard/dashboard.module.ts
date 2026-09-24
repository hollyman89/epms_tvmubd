import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project, 
      Payment,
      PurchaseOrder,
      PurchaseRequest
    ]),
    CacheModule.register({
      // We use memory cache by default. For redis, we could use store: redisStore
      ttl: 60000, // 60 seconds TTL
      max: 100, // max items
    }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
