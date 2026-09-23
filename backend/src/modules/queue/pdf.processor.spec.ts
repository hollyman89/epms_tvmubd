import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PdfProcessor } from './pdf.processor';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Job } from 'bullmq';

describe('PdfProcessor - P0-3E3 Worker Storage URL Cleanup (S3-05)', () => {
  let processor: PdfProcessor;
  let contractRepo: Partial<Record<keyof Repository<Contract>, jest.Mock>>;
  let s3SendSpy: jest.SpyInstance;

  const mockContract: Partial<Contract> = {
    id: 101,
    contract_number: 'CONT/2026/09/0101',
    legal_status: LegalStatus.APPROVED,
  };

  beforeEach(async () => {
    contractRepo = {
      findOne: jest.fn().mockResolvedValue(mockContract),
    };

    // Spy on S3Client.prototype.send to avoid real AWS calls
    s3SendSpy = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: any) => {
      return {} as any;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfProcessor,
        {
          provide: getRepositoryToken(Contract),
          useValue: contractRepo,
        },
      ],
    }).compile();

    processor = module.get<PdfProcessor>(PdfProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('Completed PDF job tidak mengembalikan raw S3 URL (amazonaws.com)', async () => {
    const mockJob = {
      data: { contractId: 101 },
    } as Job;

    const result = await processor.process(mockJob);

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(JSON.stringify(result)).not.toContain('amazonaws.com');
    expect(JSON.stringify(result)).not.toContain('.s3.');
    expect(JSON.stringify(result)).not.toContain('s3://');
  });

  it('Result mengandung business reference (contractId) dan canonical endpoint yang valid', async () => {
    const mockJob = {
      data: { contractId: 101 },
    } as Job;

    const result = await processor.process(mockJob);

    expect(result.contractId).toBe(101);
    expect(result.streamUrl).toBe('/api/v1/contracts/101/spk/stream');
    expect(result.downloadUrl).toBe('/api/v1/contracts/101/spk/download');
    expect(result.url).toBe('/api/v1/contracts/101/spk/stream');
  });

  it('Tidak ada bucket/region/object URL leakage pada response worker', async () => {
    const mockJob = {
      data: { contractId: 101 },
    } as Job;

    const result = await processor.process(mockJob);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('epms-staging-bucket');
    expect(serialized).not.toContain('epms-bucket');
    expect(serialized).not.toContain('us-east-1');
    expect(serialized).not.toContain('ap-southeast-1');
    expect(serialized).not.toContain('/uploads/');
  });

  it('S3 PutObjectCommand tetap dipanggil dengan key internal yang aman', async () => {
    const mockJob = {
      data: { contractId: 101 },
    } as Job;

    await processor.process(mockJob);

    expect(s3SendSpy).toHaveBeenCalledTimes(1);
    const sentCommand = s3SendSpy.mock.calls[0][0];
    expect(sentCommand).toBeInstanceOf(PutObjectCommand);
    expect(sentCommand.input.Bucket).toBeDefined();
    expect(sentCommand.input.Key).toMatch(/^contracts\/101-\d+\.pdf$/);
    expect(sentCommand.input.ContentType).toBe('application/pdf');
  });

  it('Contract not found melempar error dan tidak mengembalikan URL palsu', async () => {
    contractRepo.findOne!.mockResolvedValueOnce(null);

    const mockJob = {
      data: { contractId: 999 },
    } as Job;

    await expect(processor.process(mockJob)).rejects.toThrow('Contract 999 not found');
    expect(s3SendSpy).not.toHaveBeenCalled();
  });
});
