import { Module, Global } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../../entities/contract.entity';
// import { EmailProcessor } from './email.processor';
// import { PdfProcessor } from './pdf.processor';
// import { QueueMonitoringController } from './queue-monitoring.controller';

const mockQueueProvider = (name: string) => ({
  provide: getQueueToken(name),
  useValue: {
    add: async () => ({ id: 'mock-job-id' }),
    on: () => {},
    process: () => {},
  },
});

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Contract])],
  controllers: [],
  providers: [
    mockQueueProvider('email-send'),
    mockQueueProvider('email-dlq'),
    mockQueueProvider('pdf-generation'),
  ],
  exports: [
    getQueueToken('email-send'),
    getQueueToken('email-dlq'),
    getQueueToken('pdf-generation'),
  ],
})
export class QueueModule {}
