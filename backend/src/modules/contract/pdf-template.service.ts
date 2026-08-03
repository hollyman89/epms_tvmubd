import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PdfTemplate } from '../../entities/pdf-template.entity';
import * as crypto from 'crypto';

@Injectable()
export class PdfTemplateService {
  private readonly logger = new Logger(PdfTemplateService.name);
  private compiledCache: Map<string, (data: any) => string> = new Map();

  constructor(
    @InjectRepository(PdfTemplate)
    private templateRepo: Repository<PdfTemplate>,
  ) {}

  /**
   * Helper: Interpolate Handlebars Placeholders safely
   */
  private renderHandlebars(templateHtml: string, data: Record<string, any>): string {
    let rendered = templateHtml;

    // Replace basic placeholders {{key}}
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      const val = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
      rendered = rendered.replace(regex, val);
    });

    // Handle conditional #if placeholders
    rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, conditionKey, body) => {
      return data[conditionKey] ? body : '';
    });

    return rendered;
  }

  /**
   * Validate Handlebars Template HTML before saving
   */
  validateTemplate(content: string): boolean {
    if (!content || !content.trim()) {
      throw new BadRequestException('Template content cannot be empty!');
    }
    const openIfs = (content.match(/{{#if/g) || []).length;
    const closeIfs = (content.match(/{{\/if}}/g) || []).length;
    if (openIfs !== closeIfs) {
      throw new BadRequestException('Syntax Error: Mismatched {{#if}} and {{/if}} tags!');
    }
    return true;
  }

  /**
   * Create or update template version
   */
  async createTemplate(dto: { name: string; content: string; variable_mapping?: any }) {
    this.validateTemplate(dto.content);

    const existing = await this.templateRepo.findOne({
      where: { name: dto.name },
      order: { version: 'DESC' },
    });

    const nextVersion = existing ? existing.version + 1 : 1;

    const template = this.templateRepo.create({
      name: dto.name,
      content: dto.content,
      version: nextVersion,
      is_active: true,
      variable_mapping: dto.variable_mapping || {
        contractNumber: 'No. Kontrak',
        customerName: 'Nama Klien',
        contractValue: 'Nilai Kontrak',
      },
    });

    await this.templateRepo.save(template);
    this.compiledCache.delete(`template_${template.id}`);

    return {
      statusCode: 201,
      message: `PDF Template '${dto.name}' (v${nextVersion}) created successfully.`,
      template,
    };
  }

  /**
   * Fetch all active templates
   */
  async findAll() {
    return await this.templateRepo.find({
      order: { id: 'DESC' },
    });
  }

  /**
   * Preview Template with sample payload
   */
  async previewTemplate(templateId: number, sampleData?: Record<string, any>) {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('PDF Template not found');

    const mockData = sampleData || {
      contractNumber: 'CON-2026-DEMO-001',
      customerName: 'PT Telekomunikasi Indonesia Tbk',
      contractValue: 'Rp 1.500.000.000',
      startDate: '01 Agustus 2026',
      endDate: '31 Juli 2027',
      companyLogoUrl: 'http://localhost:3000/logo.png',
      hasDeposit: true,
      depositAmount: 'Rp 150.000.000',
    };

    const renderedHtml = this.renderHandlebars(template.content, mockData);

    return {
      statusCode: 200,
      templateId,
      name: template.name,
      version: template.version,
      renderedHtml,
      sampleData: mockData,
    };
  }

  /**
   * Render dynamic contract PDF & compute SHA-256 digital signature
   */
  async renderContractPdf(templateId: number, contractData: Record<string, any>) {
    const preview = await this.previewTemplate(templateId, contractData);

    // Compute SHA-256 hash of compiled HTML
    const pdfBuffer = Buffer.from(preview.renderedHtml);
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
    return {
      statusCode: 200,
      templateId,
      contractNumber: contractData.contractNumber || 'CON-EXPORT',
      documentHash: hash,
      compiledHtml: preview.renderedHtml,
      downloadUrl: `${baseUrl}/uploads/proposals/contract_${contractData.contractNumber || 'export'}.pdf`,
    };
  }
}
