import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { Document } from '../../entities/document.entity';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentController],
  providers: [
    {
      provide: S3Client,
      useFactory: () => {
        return new S3Client({
          region: process.env.AWS_REGION || 'ap-southeast-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy'
          },
          // For MinIO local testing, we can add endpoint if needed
          // endpoint: process.env.AWS_S3_ENDPOINT,
          // forcePathStyle: true,
        });
      }
    },
    DocumentService
  ],
  exports: [DocumentService],
})
export class DocumentModule {}
