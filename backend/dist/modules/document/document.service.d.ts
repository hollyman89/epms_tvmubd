import { Repository } from 'typeorm';
import { Document } from '../../entities/document.entity';
import { S3Client } from '@aws-sdk/client-s3';
export declare class DocumentService {
    private documentRepository;
    private readonly s3Client;
    constructor(documentRepository: Repository<Document>, s3Client: S3Client);
    uploadToS3(file: Express.Multer.File, folder: string): Promise<string>;
    generatePresignedUrl(folder: string, originalName: string, mimeType: string, entityType: string, entityId: number, userId?: number): Promise<{
        presignedUrl: string;
        finalUrl: string;
        key: string;
    }>;
    saveMetadata(data: {
        entityType: string;
        entityId: number;
        fileName: string;
        mimeType: string;
        fileSize: number;
        key: string;
        userId?: number;
    }): Promise<Document>;
    uploadFile(entityType: string, entityId: number, file: Express.Multer.File, userId?: number): Promise<Document>;
    getFilesByEntity(entityType: string, entityId: number): Promise<{
        fileUrl: string;
        id: number;
        entityType: string;
        entityId: number;
        fileName: string;
        filePath: string;
        mimeType: string;
        fileSize: number;
        createdBy: number;
        updatedBy: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }[]>;
    getFileById(id: number): Promise<Document>;
    getAllFiles(): Promise<{
        fileUrl: string;
        id: number;
        entityType: string;
        entityId: number;
        fileName: string;
        filePath: string;
        mimeType: string;
        fileSize: number;
        createdBy: number;
        updatedBy: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }[]>;
}
