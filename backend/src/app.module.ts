import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowModule } from './modules/workflow-engine/workflow.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { FinanceModule } from './modules/finance/finance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DocumentModule } from './modules/document/document.module';
import { AdminUserModule } from './modules/admin-user/admin-user.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { LegalModule } from './modules/legal/legal.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { ContractModule } from './modules/contract/contract.module';
import { QueueModule } from './modules/queue/queue.module';
import { SystemModule } from './modules/system/system.module';
import { InboxModule } from './modules/inbox/inbox.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // DO NOT CREATE TABLES IN CODE
      logging: true,
    }),
    EventEmitterModule.forRoot(),
    SystemModule,
    QueueModule,
    WorkflowModule,
    ProcurementModule,
    FinanceModule,
    DashboardModule,
    NotificationModule,
    DocumentModule,
    AdminUserModule,
    AuthModule,
    ProjectModule,
    MarketingModule,
    LegalModule,
    CustomersModule,
    AnalyticsModule,
    AuditModule,
    ContractModule,
    InboxModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

