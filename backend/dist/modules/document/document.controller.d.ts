import { DocumentService } from './document.service';
export declare class DocumentController {
    private readonly documentService;
    constructor(documentService: DocumentService);
    uploadFile(file: Express.Multer.File, entityType: string, entityId: number): Promise<{
        message: string;
        data: import("../../entities/document.entity").Document;
    }>;
    getPresignedUrl(body: any): Promise<{
        message: string;
        data: {
            presignedUrl: string;
            finalUrl: string;
            key: string;
        };
    }>;
    saveMetadata(body: any): Promise<{
        message: string;
        data: import("../../entities/document.entity").Document;
    }>;
    getAllDocuments(): Promise<{
        message: string;
        data: {
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
        }[];
    }>;
    getEntityDocuments(entityType: string, entityId: number): Promise<{
        message: string;
        data: {
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
        }[];
    }>;
}
