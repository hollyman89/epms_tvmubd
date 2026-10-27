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
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
  UseFilters,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage, MulterError } from 'multer';
import { DocumentService } from './document.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Route-scoped exception filter for Document Upload endpoint.
 * Catches Multer errors (such as LIMIT_FILE_SIZE) and PayloadTooLargeException,
 * normalizing them into controlled HTTP 413 / 400 responses without leaking Multer internals.
 */
@Catch(MulterError, PayloadTooLargeException)
export class DocumentUploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DocumentUploadExceptionFilter.name);

  catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<any>();
    const correlationId = request?.correlationId || (request?.headers?.['x-correlation-id'] as string) || 'N/A';

    const isOversize =
      (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') ||
      exception instanceof PayloadTooLargeException ||
      (exception as any)?.status === 413;

    if (isOversize) {
      this.logger.warn(
        `[DocumentUpload] File size limit exceeded (>20MB) on ${request?.method || 'POST'} ${request?.url || '/api/v1/documents/upload'}. correlationId=${correlationId}`,
      );
      return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'Payload Too Large',
        message: 'Ukuran berkas melebihi batas maksimal 20 MB.',
      });
    }

    this.logger.warn(
      `[DocumentUpload] Multer error [${(exception as any).code || 'UPLOAD_ERROR'}]: ${exception.message}. correlationId=${correlationId}`,
    );
    return response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Format atau parameter berkas tidak valid.',
    });
  }
}

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

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
  @UseFilters(DocumentUploadExceptionFilter)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: number,
    @Req() req: any,
    @Body('category') category?: string,
  ) {
    const correlationId = req?.correlationId || (req?.headers?.['x-correlation-id'] as string) || 'N/A';

    // Diagnostic observability: Detect premature client connection termination
    req?.on?.('close', () => {
      if (!req.complete && !req.res?.writableEnded) {
        this.logger.warn(
          `[DocumentUpload] Request aborted/closed prematurely by client: entityType=${entityType}, entityId=${entityId}, correlationId=${correlationId}`,
        );
      }
    });

    if (!file) {
      this.logger.warn(
        `[DocumentUpload] Rejected: file is required. correlationId=${correlationId}`,
      );
      throw new BadRequestException('File is required');
    }

    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    this.logger.log(
      `[DocumentUpload] Upload started: entityType=${entityType}, entityId=${entityId}, category=${category || 'NONE'}, fileName=${file.originalname}, fileSize=${file.size}, mimeType=${file.mimetype}, correlationId=${correlationId}`,
    );

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

    try {
      const document = await (this.documentService as any).uploadFile(...uploadArgs);
      
      this.logger.log(
        `[DocumentUpload] Upload succeeded: documentId=${document?.id}, entityType=${entityType}, entityId=${entityId}, correlationId=${correlationId}`,
      );

      return {
        message: 'Document uploaded successfully',
        data: document,
      };
    } catch (err: any) {
      const errName = err?.name || 'Error';
      const errMsg = err?.message || 'Unknown error';
      const isDbError =
        errName.includes('QueryFailed') ||
        errName.includes('TypeORM') ||
        err?.code === 'ER_DUP_ENTRY';
      const failureType = isDbError
        ? 'DB_PERSISTENCE_FAILURE'
        : 'SERVICE_STORAGE_FAILURE';

      this.logger.error(
        `[DocumentUpload] Failed (${failureType}): entityType=${entityType}, entityId=${entityId}, fileSize=${file?.size}, errorClass=${errName}, message=${errMsg}, correlationId=${correlationId}`,
      );
      throw err;
    }
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
