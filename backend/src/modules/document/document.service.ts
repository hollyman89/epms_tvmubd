import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../entities/document.entity';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private readonly s3Client: S3Client,
  ) {}

  async uploadToS3(file: Express.Multer.File, folder: string) {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    
    await this.s3Client.send(command);
    
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async generatePresignedUrl(folder: string, originalName: string, mimeType: string, entityType: string, entityId: number, userId?: number) {
    const key = `${folder}/${Date.now()}-${originalName}`;
    const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
    });
    
    // URL expires in 15 minutes (900 seconds)
    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    const finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      presignedUrl,
      finalUrl,
      key
    };
  }

  async saveMetadata(data: { entityType: string, entityId: number, fileName: string, mimeType: string, fileSize: number, key: string, userId?: number }) {
    const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    const finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${data.key}`;

    const document = this.documentRepository.create({
      entityType: data.entityType,
      entityId: data.entityId,
      fileName: data.fileName,
      filePath: finalUrl,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      createdBy: data.userId || 1,
    });

    return await this.documentRepository.save(document);
  }

  async uploadFile(entityType: string, entityId: number, file: Express.Multer.File, userId?: number) {
    const fileUrl = await this.uploadToS3(file, entityType.toLowerCase());

    const document = this.documentRepository.create({
      entityType,
      entityId,
      fileName: file.originalname,
      filePath: fileUrl, // Store URL in DB
      mimeType: file.mimetype,
      fileSize: file.size,
      createdBy: userId || 1, // Default to admin for demo
    });

    return await this.documentRepository.save(document);
  }

  async getFilesByEntity(entityType: string, entityId: number) {
    const documents = await this.documentRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });

    const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
    return documents.map(doc => {
      let fileUrl = doc.filePath || '';
      if (!fileUrl.startsWith('http')) {
        const cleanPath = fileUrl.replace(/^\/+/, '');
        if (cleanPath.startsWith('uploads/')) {
          fileUrl = `${baseUrl}/${cleanPath}`;
        } else if (cleanPath.startsWith('proposals/')) {
          fileUrl = `${baseUrl}/uploads/${cleanPath}`;
        } else {
          fileUrl = `${baseUrl}/uploads/proposals/${cleanPath}`;
        }
      }
      return {
        ...doc,
        fileUrl,
      };
    });
  }

  async getFileById(id: number) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async getAllFiles() {
    const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
    const documents = await this.documentRepository.find({
      order: { createdAt: 'DESC' },
    });

    return documents.map(doc => {
      let fileUrl = doc.filePath || '';
      if (!fileUrl.startsWith('http')) {
        const cleanPath = fileUrl.replace(/^\/+/, '');
        if (cleanPath.startsWith('uploads/')) {
          fileUrl = `${baseUrl}/${cleanPath}`;
        } else if (cleanPath.startsWith('proposals/')) {
          fileUrl = `${baseUrl}/uploads/${cleanPath}`;
        } else {
          fileUrl = `${baseUrl}/uploads/proposals/${cleanPath}`;
        }
      }
      return {
        ...doc,
        fileUrl,
      };
    });
  }
}
