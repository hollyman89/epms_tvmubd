import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../entities/document.entity';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private readonly s3Client: S3Client,
  ) {}

  /**
   * Sanitizes a user-supplied fileName for safe S3 key generation.
   * Strips path separators, rejects traversal and null bytes, and normalizes characters to [a-zA-Z0-9._-].
   */
  sanitizeFileName(rawName: string): string {
    if (!rawName || typeof rawName !== 'string') {
      throw new BadRequestException('Nama berkas tidak valid');
    }

    const trimmed = rawName.trim();
    if (!trimmed || trimmed.includes('\0') || trimmed.includes('..') || /%2e%2e/i.test(trimmed)) {
      throw new BadRequestException('Nama berkas tidak boleh mengandung karakter tidak aman atau path traversal');
    }

    // Strip directory separators (both POSIX and Windows)
    const baseName = path.basename(trimmed.replace(/\\/g, '/')).trim();
    if (!baseName || baseName === '.' || baseName === '..') {
      throw new BadRequestException('Nama berkas tidak valid');
    }

    const ext = path.extname(baseName);
    const nameWithoutExt = path.basename(baseName, ext);

    // Whitelist [a-zA-Z0-9._-]
    const safeBase = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 120);
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase().slice(0, 15);

    const result = `${safeBase || 'document'}${safeExt || ''}`;
    if (!result || result === '.' || result.startsWith('.')) {
      return `document${safeExt || '.bin'}`;
    }
    return result;
  }

  /**
   * Resolves the allowed S3 key prefixes for a given entity type.
   */
  getAllowedPrefixesForEntity(entityType: string): string[] {
    const normalized = String(entityType || '').trim().toUpperCase();
    switch (normalized) {
      case 'PROJECT':
        return ['project/', 'projects/'];
      case 'CONTRACT':
        return ['contract/', 'contracts/'];
      case 'TENDER':
        return ['tender/', 'tenders/'];
      default:
        return [`${normalized.toLowerCase()}/`, `${normalized.toLowerCase()}s/`];
    }
  }

  async uploadToS3(file: Express.Multer.File, folder: string) {
    const safeName = this.sanitizeFileName(file.originalname);
    const key = `${folder}/${Date.now()}-${safeName}`;
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

  async generatePresignedUrl(
    folder: string,
    fileName: string,
    mimeType: string,
    entityType: string,
    entityId: number,
    userId?: number,
    userRoles: string[] = [],
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required for presigned URL operations');
    }
    if (!entityId || isNaN(Number(entityId)) || Number(entityId) <= 0) {
      throw new BadRequestException('Parameter entityId tidak valid');
    }
    if (!entityType || typeof entityType !== 'string') {
      throw new BadRequestException('Parameter entityType tidak valid');
    }

    await this.validateDocumentEntityAccess(entityType, Number(entityId), Number(userId), userRoles);

    const safeFileName = this.sanitizeFileName(fileName);
    const normalizedType = entityType.trim().toUpperCase();
    const serverFolder = normalizedType.toLowerCase();
    const key = `${serverFolder}/${Date.now()}-${safeFileName}`;
    const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType || 'application/octet-stream',
    });
    
    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    const finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      finalUrl,
      key
    };
  }

  async saveMetadata(data: {
    entityType: string;
    entityId: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
    key: string;
    userId?: number;
    userRoles?: string[];
  }) {
    if (!data.userId) {
      throw new UnauthorizedException('User ID is required for document metadata operations');
    }
    if (!data.entityId || isNaN(Number(data.entityId)) || Number(data.entityId) <= 0) {
      throw new BadRequestException('Parameter entityId tidak valid');
    }
    if (!data.entityType || typeof data.entityType !== 'string') {
      throw new BadRequestException('Parameter entityType tidak valid');
    }
    if (typeof data.fileSize !== 'number' || data.fileSize < 0) {
      throw new BadRequestException('Parameter fileSize tidak valid');
    }

    // 1. Validasi otorisasi entitas sebelum persistensi
    await this.validateDocumentEntityAccess(
      data.entityType,
      Number(data.entityId),
      Number(data.userId),
      data.userRoles || [],
    );

    // 2. Validasi integritas S3 object key
    if (!data.key || typeof data.key !== 'string' || !data.key.trim()) {
      throw new BadRequestException('S3 object key wajib diisi');
    }

    const trimmedKey = data.key.trim();

    // Reject path traversal, absolute path, control characters, and encoded traversal
    if (
      trimmedKey.startsWith('/') ||
      trimmedKey.startsWith('\\') ||
      trimmedKey.includes('..') ||
      trimmedKey.includes('\0') ||
      /%2e%2e/i.test(trimmedKey)
    ) {
      throw new BadRequestException('Format S3 object key tidak valid atau mengandung path traversal');
    }

    // Validasi bahwa key berada pada prefix yang diizinkan untuk entityType
    const allowedPrefixes = this.getAllowedPrefixesForEntity(data.entityType);
    const matchedPrefix = allowedPrefixes.find((prefix) => trimmedKey.startsWith(prefix));

    if (!matchedPrefix) {
      throw new BadRequestException(
        `S3 object key '${trimmedKey}' tidak valid untuk entityType '${data.entityType}'. Key wajib menggunakan prefix '${data.entityType.toLowerCase()}/'`,
      );
    }

    // Key setelah prefix tidak boleh kosong atau menunjuk ke subdirektori
    const keyRemainder = trimmedKey.slice(matchedPrefix.length);
    if (!keyRemainder || keyRemainder.includes('/') || keyRemainder.includes('\\')) {
      throw new BadRequestException('S3 object key tidak boleh mengarah ke subdirektori atau bernilai kosong');
    }

    // 3. Sanitasi nama berkas
    const safeFileName = this.sanitizeFileName(data.fileName);

    const bucket = process.env.AWS_S3_BUCKET || 'epms-bucket';
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    const finalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${trimmedKey}`;

    const document = this.documentRepository.create({
      entityType: data.entityType,
      entityId: Number(data.entityId),
      fileName: safeFileName,
      filePath: finalUrl,
      mimeType: data.mimeType || 'application/octet-stream',
      fileSize: data.fileSize,
      createdBy: Number(data.userId),
    });

    return await this.documentRepository.save(document);
  }

  async uploadFile(
    entityType: string,
    entityId: number,
    file: Express.Multer.File,
    userId?: number,
    userRoles: string[] = [],
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required for document operations');
    }
    if (!entityId || isNaN(Number(entityId)) || Number(entityId) <= 0) {
      throw new BadRequestException('Parameter entityId tidak valid');
    }
    if (!entityType || typeof entityType !== 'string') {
      throw new BadRequestException('Parameter entityType tidak valid');
    }

    await this.validateDocumentEntityAccess(entityType, Number(entityId), Number(userId), userRoles);

    const safeFileName = this.sanitizeFileName(file.originalname);
    const fileUrl = await this.uploadToS3(file, entityType.toLowerCase());

    const document = this.documentRepository.create({
      entityType,
      entityId: Number(entityId),
      fileName: safeFileName,
      filePath: fileUrl, // Store URL in DB
      mimeType: file.mimetype,
      fileSize: file.size,
      createdBy: Number(userId),
    });

    return await this.documentRepository.save(document);
  }

  async validateDocumentEntityAccess(
    entityType: string,
    entityId: number,
    userId: number,
    userRoles: string[] = [],
  ): Promise<void> {
    const normalizedType = String(entityType || '').trim().toUpperCase();
    const roles = (Array.isArray(userRoles) ? userRoles : [userRoles]).map((r: any) =>
      String(r?.name || r).toUpperCase(),
    );
    const currentUserId = Number(userId);

    switch (normalizedType) {
      case 'PROJECT': {
        const project = await this.documentRepository.manager.findOne(Project, {
          where: { id: entityId },
        });
        if (!project) {
          throw new NotFoundException(`Project #${entityId} tidak ditemukan`);
        }

        // Super Admin & Management / PMO roles allowed
        if (
          roles.includes('SUPER_ADMIN') ||
          roles.includes('PMO') ||
          roles.includes('DIRECTOR') ||
          roles.includes('GENERAL_MANAGER') ||
          roles.includes('HEAD_OF_OPERATIONS')
        ) {
          return;
        }

        const assignedPmId = project.managerId ? Number(project.managerId) : null;
        if (assignedPmId && assignedPmId === currentUserId) {
          return;
        }

        throw new ForbiddenException(
          'Akses ditolak: Hanya Project Manager yang ditugaskan atau manajemen yang berhak mengakses dokumen proyek ini',
        );
      }

      case 'CONTRACT': {
        const contract = await this.documentRepository.manager.findOne(Contract, {
          where: { id: entityId },
          relations: ['proposal', 'proposal.tender'],
        });
        if (!contract) {
          throw new NotFoundException(`Contract #${entityId} tidak ditemukan`);
        }

        // Super Admin & Legal & Executive roles allowed
        if (
          roles.includes('SUPER_ADMIN') ||
          roles.includes('LEGAL') ||
          roles.includes('DIRECTOR') ||
          roles.includes('GENERAL_MANAGER') ||
          roles.includes('HEAD_OF_OPERATIONS')
        ) {
          return;
        }

        const assignedPmId = contract.project_manager_id ? Number(contract.project_manager_id) : null;
        const creatorId = contract.created_by ? Number(contract.created_by) : null;
        const tenderPicId = contract.proposal?.tender?.marketing_pic_id
          ? Number(contract.proposal.tender.marketing_pic_id)
          : null;

        if (
          (assignedPmId && assignedPmId === currentUserId) ||
          (creatorId && creatorId === currentUserId) ||
          (tenderPicId && tenderPicId === currentUserId)
        ) {
          return;
        }

        throw new ForbiddenException(
          'Akses ditolak: Anda tidak memiliki relasi atau izin untuk mengakses dokumen kontrak ini',
        );
      }

      case 'TENDER': {
        const tender = await this.documentRepository.manager.findOne(Tender, {
          where: { id: entityId },
        });
        if (!tender) {
          throw new NotFoundException(`Tender #${entityId} tidak ditemukan`);
        }

        // Super Admin & Executive roles allowed
        if (
          roles.includes('SUPER_ADMIN') ||
          roles.includes('DIRECTOR') ||
          roles.includes('GENERAL_MANAGER') ||
          roles.includes('HEAD_OF_OPERATIONS')
        ) {
          return;
        }

        const marketingPicId = tender.marketing_pic_id ? Number(tender.marketing_pic_id) : null;
        const creatorId = tender.created_by ? Number(tender.created_by) : null;

        if (
          (marketingPicId && marketingPicId === currentUserId) ||
          (creatorId && creatorId === currentUserId)
        ) {
          return;
        }

        throw new ForbiddenException(
          'Akses ditolak: Hanya Marketing PIC atau manajemen yang berhak mengakses dokumen tender ini',
        );
      }

      default: {
        throw new BadRequestException(
          `Tipe entitas '${entityType}' tidak valid atau tidak didukung untuk operasi dokumen`,
        );
      }
    }
  }

  async getFilesByEntity(
    entityType: string,
    entityId: number,
    userId?: number,
    userRoles: string[] = [],
  ) {
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak valid');
    }
    if (!entityId || isNaN(Number(entityId)) || Number(entityId) <= 0) {
      throw new BadRequestException('Parameter entityId tidak valid');
    }
    if (!entityType || typeof entityType !== 'string') {
      throw new BadRequestException('Parameter entityType tidak valid');
    }

    await this.validateDocumentEntityAccess(entityType, Number(entityId), Number(userId), userRoles);

    const documents = await this.documentRepository.find({
      where: [
        { entityType: entityType, entityId: Number(entityId) },
        { entityType: entityType.toLowerCase(), entityId: Number(entityId) },
        { entityType: entityType.toUpperCase(), entityId: Number(entityId) },
      ],
      order: { createdAt: 'DESC' },
    });

    return documents.map(doc => {
      const streamUrl = `/api/v1/documents/${doc.id}/stream`;
      const downloadUrl = `/api/v1/documents/${doc.id}/download`;
      return {
        ...doc,
        filePath: streamUrl,
        fileUrl: streamUrl,
        streamUrl,
        downloadUrl,
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

  resolveLocalFilePath(filePath: string): string | null {
    if (!filePath) return null;

    let clean = filePath.split('?')[0].split('#')[0];

    // If full URL with baseUrl
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const urlObj = new URL(clean);
        clean = urlObj.pathname;
      } catch {
        // keep clean
      }
    }

    clean = clean.replace(/^\/+/, '');
    if (clean.startsWith('api/v1/uploads/')) {
      clean = clean.replace(/^api\/v1\//, '');
    }

    const candidates: string[] = [];
    if (path.isAbsolute(clean)) {
      candidates.push(clean);
    } else {
      candidates.push(path.join(process.cwd(), clean));
    }

    if (clean.startsWith('uploads/')) {
      const withoutUploads = clean.replace(/^uploads\//, '');
      candidates.push(path.join(process.cwd(), 'uploads', withoutUploads));
      candidates.push(path.join(__dirname, '..', '..', '..', 'uploads', withoutUploads));
      candidates.push(path.join(process.cwd(), 'uploads', 'contracts', path.basename(clean)));
      candidates.push(path.join(process.cwd(), 'uploads', 'proposals', path.basename(clean)));
    } else {
      candidates.push(path.join(process.cwd(), 'uploads', clean));
      candidates.push(path.join(process.cwd(), 'uploads', 'contracts', path.basename(clean)));
      candidates.push(path.join(process.cwd(), 'uploads', 'proposals', path.basename(clean)));
      candidates.push(path.join(__dirname, '..', '..', '..', 'uploads', 'contracts', path.basename(clean)));
      candidates.push(path.join(__dirname, '..', '..', '..', 'uploads', 'proposals', path.basename(clean)));
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          if (fs.statSync(candidate).isFile()) {
            return candidate;
          }
        } catch {
          // continue
        }
      }
    }

    return null;
  }

  /**
   * Safely parses S3 bucket and object key from stored URL or URI reference.
   * Supports:
   * - https://<bucket>.s3.<region>.amazonaws.com/<key>
   * - https://<bucket>.s3.amazonaws.com/<key>
   * - s3://<bucket>/<key>
   * Rejects path traversal semantics, control characters, and empty components.
   */
  parseS3Reference(rawUrl: string): { bucket: string; key: string } | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    // Reject path traversal semantics, control characters, or percent-encoded traversal in raw reference
    if (trimmed.includes('..') || trimmed.includes('\0') || /%2e%2e/i.test(trimmed)) {
      return null;
    }

    // 1. s3://<bucket>/<key>
    if (trimmed.startsWith('s3://')) {
      const pathPart = trimmed.slice(5);
      const slashIndex = pathPart.indexOf('/');
      if (slashIndex <= 0) return null;
      const bucket = pathPart.slice(0, slashIndex);
      const key = pathPart.slice(slashIndex + 1);
      if (!bucket || !key || key.includes('..') || key.includes('\0') || /%2e%2e/i.test(key)) return null;
      return { bucket, key };
    }

    // 2. http:// or https:// with amazonaws.com
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (!host.includes('amazonaws.com')) {
          return null;
        }

        // Virtual-hosted style: <bucket>.s3.<region>.amazonaws.com OR <bucket>.s3.amazonaws.com
        const virtualMatch = host.match(/^([a-z0-9.-]+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/);
        if (virtualMatch) {
          const bucket = virtualMatch[1];
          const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
          if (!bucket || !key || key.includes('..') || key.includes('\0') || /%2e%2e/i.test(key)) return null;
          return { bucket, key };
        }

        // Path-style: s3.<region>.amazonaws.com/<bucket>/<key> OR s3.amazonaws.com/<bucket>/<key>
        const pathMatch = host.match(/^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/);
        if (pathMatch) {
          const rawPath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
          const parts = rawPath.split('/');
          if (parts.length < 2) return null;
          const bucket = parts[0];
          const key = parts.slice(1).join('/');
          if (!bucket || !key || key.includes('..') || key.includes('\0') || /%2e%2e/i.test(key)) return null;
          return { bucket, key };
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  async streamDocument(
    documentId: number,
    userId: number,
    userRoles: string[] = [],
  ): Promise<{
    stream: fs.ReadStream | any;
    document: Document;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }> {
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna diperlukan untuk mengunduh dokumen');
    }
    if (!documentId || isNaN(Number(documentId)) || Number(documentId) <= 0) {
      throw new BadRequestException('Parameter documentId tidak valid');
    }

    // 1. Cari document berdasarkan id
    const document = await this.documentRepository.findOne({
      where: { id: Number(documentId) },
    });
    if (!document) {
      throw new NotFoundException(`Dokumen #${documentId} tidak ditemukan`);
    }

    // 2 & 3. Validasi hak akses entitas melalui boundary terverifikasi
    await this.validateDocumentEntityAccess(
      document.entityType,
      Number(document.entityId),
      Number(userId),
      userRoles,
    );

    // 4. Deteksi apakah berkas tersimpan di cloud storage (AWS S3)
    const s3Ref = this.parseS3Reference(document.filePath);
    if (s3Ref) {
      try {
        const command = new GetObjectCommand({
          Bucket: s3Ref.bucket,
          Key: s3Ref.key,
        });
        const s3Response = await this.s3Client.send(command);
        if (!s3Response.Body) {
          throw new NotFoundException('Berkas fisik dokumen tidak ditemukan di cloud storage (S3)');
        }

        const fileName = document.fileName || path.basename(s3Ref.key) || 'document.pdf';
        const mimeType = (s3Response.ContentType as string) || document.mimeType || 'application/octet-stream';
        const fileSize = (s3Response.ContentLength as number) || document.fileSize || 0;

        return {
          stream: s3Response.Body as any,
          document,
          fileName,
          mimeType,
          fileSize,
        };
      } catch (err: any) {
        if (
          err instanceof NotFoundException ||
          err instanceof ForbiddenException ||
          err instanceof UnauthorizedException ||
          err instanceof BadRequestException
        ) {
          throw err;
        }
        if (
          err.name === 'NoSuchKey' ||
          err.name === 'NotFound' ||
          err.$metadata?.httpStatusCode === 404
        ) {
          throw new NotFoundException('Berkas fisik dokumen tidak ditemukan di cloud storage (S3)');
        }
        // Safe storage error without leaking credentials, bucket secrets, or AWS internals
        throw new NotFoundException('Berkas fisik dokumen tidak dapat diakses atau tidak ditemukan di cloud storage');
      }
    }

    // Reject malformed S3 URLs or traversal attempts on cloud references
    if (
      document.filePath &&
      (document.filePath.includes('.amazonaws.com') || document.filePath.startsWith('s3://'))
    ) {
      throw new BadRequestException('Format URL S3/cloud storage tidak valid atau path traversal terdeteksi');
    }

    // 5. Cari berkas fisik di local filesystem
    const resolvedPath = this.resolveLocalFilePath(document.filePath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Berkas fisik dokumen tidak ditemukan di server');
    }

    const fileSize = document.fileSize || fs.statSync(resolvedPath).size;
    const stream = fs.createReadStream(resolvedPath);

    return {
      stream,
      document,
      fileName: document.fileName || path.basename(resolvedPath),
      mimeType: document.mimeType || 'application/octet-stream',
      fileSize,
    };
  }

  async getAllFiles() {
    const documents = await this.documentRepository.find({
      order: { createdAt: 'DESC' },
    });

    return documents.map(doc => {
      const streamUrl = `/api/v1/documents/${doc.id}/stream`;
      const downloadUrl = `/api/v1/documents/${doc.id}/download`;
      return {
        ...doc,
        filePath: streamUrl,
        fileUrl: streamUrl,
        streamUrl,
        downloadUrl,
      };
    });
  }
}
