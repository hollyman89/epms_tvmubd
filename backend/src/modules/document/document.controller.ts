import { Controller, Post, Get, Param, Body, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { DocumentService } from './document.service';

// Disabling JwtAuthGuard for easier demo, but normally should be here
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document for an entity (e.g. PO, Invoice)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        entityType: { type: 'string', example: 'PURCHASE_ORDER' },
        entityId: { type: 'number', example: 1 },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: number,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const document = await this.documentService.uploadFile(entityType, Number(entityId), file);
    
    return {
      message: 'Document uploaded successfully',
      data: document
    };
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate a presigned URL to upload file directly to S3 from client' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileName: { type: 'string', example: 'proposal.pdf' },
        mimeType: { type: 'string', example: 'application/pdf' },
        entityType: { type: 'string', example: 'SPK' },
        entityId: { type: 'number', example: 1 },
      },
    },
  })
  async getPresignedUrl(@Body() body: any) {
    if (!body.fileName || !body.mimeType || !body.entityType || !body.entityId) {
      throw new BadRequestException('fileName, mimeType, entityType, and entityId are required');
    }
    const result = await this.documentService.generatePresignedUrl(
      body.entityType.toLowerCase(),
      body.fileName,
      body.mimeType,
      body.entityType,
      body.entityId,
      1 // mock user id
    );

    return {
      message: 'Presigned URL generated successfully',
      data: result
    };
  }

  @Post('metadata')
  @ApiOperation({ summary: 'Save document metadata after successful S3 upload' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileName: { type: 'string', example: 'proposal.pdf' },
        mimeType: { type: 'string', example: 'application/pdf' },
        fileSize: { type: 'number', example: 1048576 },
        entityType: { type: 'string', example: 'SPK' },
        entityId: { type: 'number', example: 1 },
        key: { type: 'string', example: 'spk/1721...-proposal.pdf' },
      },
    },
  })
  async saveMetadata(@Body() body: any) {
    if (!body.fileName || !body.mimeType || !body.entityType || !body.entityId || !body.key || typeof body.fileSize !== 'number') {
      throw new BadRequestException('fileName, mimeType, fileSize, entityType, entityId, and key are required');
    }
    const result = await this.documentService.saveMetadata({
      entityType: body.entityType.toLowerCase(),
      entityId: body.entityId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      key: body.key,
      userId: 1 // mock user id
    });

    return {
      message: 'Document metadata saved successfully',
      data: result
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all uploaded documents across the system' })
  async getAllDocuments() {
    const documents = await this.documentService.getAllFiles();
    return {
      message: 'All documents retrieved successfully',
      data: documents
    };
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get all documents for a specific entity' })
  async getEntityDocuments(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: number,
  ) {
    const documents = await this.documentService.getFilesByEntity(entityType, Number(entityId));
    return {
      message: 'Documents retrieved successfully',
      data: documents
    };
  }
}
