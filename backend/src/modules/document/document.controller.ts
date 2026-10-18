import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  StreamableFile,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { DocumentService } from './document.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: number,
    @Req() req: any,
    @Body('category') category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    const uploadArgs: any[] = [
      entityType,
      Number(entityId),
      file,
      Number(userId),
      userRoles,
    ];
    if (category !== undefined) {
      uploadArgs.push(category);
    }

    const document = await (this.documentService as any).uploadFile(...uploadArgs);
    
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
  async getPresignedUrl(@Body() body: any, @Req() req: any) {
    if (!body.fileName || !body.mimeType || !body.entityType || !body.entityId) {
      throw new BadRequestException('fileName, mimeType, entityType, and entityId are required');
    }

    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    const result = await this.documentService.generatePresignedUrl(
      body.entityType.toLowerCase(),
      body.fileName,
      body.mimeType,
      body.entityType,
      Number(body.entityId),
      Number(userId),
      userRoles,
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
  async saveMetadata(@Body() body: any, @Req() req: any) {
    if (!body.fileName || !body.mimeType || !body.entityType || !body.entityId || !body.key || typeof body.fileSize !== 'number') {
      throw new BadRequestException('fileName, mimeType, fileSize, entityType, entityId, and key are required');
    }

    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    const result = await this.documentService.saveMetadata({
      entityType: body.entityType.toLowerCase(),
      entityId: Number(body.entityId),
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      key: body.key,
      userId: Number(userId),
      userRoles,
    });

    return {
      message: 'Document metadata saved successfully',
      data: result
    };
  }

  @Get()
  @Roles('SUPER_ADMIN', 'DIRECTOR', 'LEGAL', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get all uploaded documents across the system' })
  async getAllDocuments() {
    const documents = await this.documentService.getAllFiles();
    return {
      message: 'All documents retrieved successfully',
      data: documents,
    };
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get all documents for a specific entity' })
  async getEntityDocuments(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: number,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const documents = await this.documentService.getFilesByEntity(
      entityType,
      Number(entityId),
      Number(userId),
      userRoles,
    );
    return {
      message: 'Documents retrieved successfully',
      data: documents,
    };
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Securely download a document by ID' })
  async downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    const { stream, fileName, mimeType, fileSize } = await this.documentService.streamDocument(
      Number(id),
      Number(userId),
      userRoles,
    );

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      ...(fileSize ? { 'Content-Length': String(fileSize) } : {}),
    });

    return new StreamableFile(stream);
  }

  @Get(':id/stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Securely stream a document by ID for inline preview' })
  async streamDocument(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    const { stream, fileName, mimeType, fileSize } = await this.documentService.streamDocument(
      Number(id),
      Number(userId),
      userRoles,
    );

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      ...(fileSize ? { 'Content-Length': String(fileSize) } : {}),
    });

    return new StreamableFile(stream);
  }
}
