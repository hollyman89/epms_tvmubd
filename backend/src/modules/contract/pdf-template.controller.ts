import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PdfTemplateService } from './pdf-template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('PDF Template Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pdf-templates')
export class PdfTemplateController {
  constructor(private readonly pdfTemplateService: PdfTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Handlebars PDF templates' })
  async findAll() {
    return await this.pdfTemplateService.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'LEGAL')
  @ApiOperation({ summary: 'Create new PDF Handlebars template version' })
  async createTemplate(
    @Body() dto: { name: string; content: string; variable_mapping?: any }
  ) {
    return await this.pdfTemplateService.createTemplate(dto);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview Handlebars template HTML rendering with sample JSON payload' })
  async previewTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() sampleData?: Record<string, any>
  ) {
    return await this.pdfTemplateService.previewTemplate(id, sampleData);
  }

  @Post(':id/render')
  @ApiOperation({ summary: 'Render dynamic contract PDF & compute SHA-256 digital signature' })
  async renderContractPdf(
    @Param('id', ParseIntPipe) id: number,
    @Body() contractData: Record<string, any>
  ) {
    return await this.pdfTemplateService.renderContractPdf(id, contractData);
  }
}
