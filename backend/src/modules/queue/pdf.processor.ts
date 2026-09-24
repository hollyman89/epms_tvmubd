import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as PDFDocument from 'pdfkit';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../../entities/contract.entity';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Processor('pdf-generation', { concurrency: 5 })
export class PdfProcessor extends WorkerHost {
  private s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock_key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret',
    },
  });

  constructor(
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`[Worker] Memproses PDF untuk Contract ID: ${job.data.contractId}`);
    
    // Fetch Contract from DB
    const contract = await this.contractRepo.findOne({ where: { id: job.data.contractId } });
    if (!contract) {
      throw new Error(`Contract ${job.data.contractId} not found`);
    }

    // Create a new PDF document
    const doc = new PDFDocument();
    
    let buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    
    // Adding content
    doc.fontSize(20).text(`Contract Document - ${contract.contract_number || 'DRAFT'}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Status: ${contract.legal_status}`);
    doc.fontSize(12).text(`Generated asynchronously via BullMQ worker.`);
    
    return new Promise((resolve, reject) => {
      doc.on('end', async () => {
        try {
          const pdfData = Buffer.concat(buffers);
          console.log(`[Worker] PDF Generated successfully. Size: ${pdfData.length} bytes.`);
          
          const key = `contracts/${contract.id}-${Date.now()}.pdf`;
          
          await this.s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET || 'epms-staging-bucket',
            Key: key,
            Body: pdfData,
            ContentType: 'application/pdf',
          }));
          
          const streamUrl = `/api/v1/contracts/${contract.id}/spk/stream`;
          const downloadUrl = `/api/v1/contracts/${contract.id}/spk/download`;
          console.log(`[Worker] Uploaded contract PDF to S3 for Contract ID: ${contract.id}`);
          
          resolve({
            status: 'completed',
            contractId: contract.id,
            streamUrl,
            downloadUrl,
            url: streamUrl,
          });
        } catch (error) {
          console.error(`[Worker] S3 Upload failed: ${error.message}`);
          reject(error);
        }
      });
      doc.end();
    });
  }
}
