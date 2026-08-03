import { PdfTemplateService } from './pdf-template.service';
export declare class PdfTemplateController {
    private readonly pdfTemplateService;
    constructor(pdfTemplateService: PdfTemplateService);
    findAll(): Promise<import("../../entities/pdf-template.entity").PdfTemplate[]>;
    createTemplate(dto: {
        name: string;
        content: string;
        variable_mapping?: any;
    }): Promise<{
        statusCode: number;
        message: string;
        template: import("../../entities/pdf-template.entity").PdfTemplate;
    }>;
    previewTemplate(id: number, sampleData?: Record<string, any>): Promise<{
        statusCode: number;
        templateId: number;
        name: string;
        version: number;
        renderedHtml: string;
        sampleData: Record<string, any>;
    }>;
    renderContractPdf(id: number, contractData: Record<string, any>): Promise<{
        statusCode: number;
        templateId: number;
        contractNumber: any;
        documentHash: string;
        compiledHtml: string;
        downloadUrl: string;
    }>;
}
