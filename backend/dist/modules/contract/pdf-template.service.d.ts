import { Repository } from 'typeorm';
import { PdfTemplate } from '../../entities/pdf-template.entity';
export declare class PdfTemplateService {
    private templateRepo;
    private readonly logger;
    private compiledCache;
    constructor(templateRepo: Repository<PdfTemplate>);
    private renderHandlebars;
    validateTemplate(content: string): boolean;
    createTemplate(dto: {
        name: string;
        content: string;
        variable_mapping?: any;
    }): Promise<{
        statusCode: number;
        message: string;
        template: PdfTemplate;
    }>;
    findAll(): Promise<PdfTemplate[]>;
    previewTemplate(templateId: number, sampleData?: Record<string, any>): Promise<{
        statusCode: number;
        templateId: number;
        name: string;
        version: number;
        renderedHtml: string;
        sampleData: Record<string, any>;
    }>;
    renderContractPdf(templateId: number, contractData: Record<string, any>): Promise<{
        statusCode: number;
        templateId: number;
        contractNumber: any;
        documentHash: string;
        compiledHtml: string;
        downloadUrl: string;
    }>;
}
