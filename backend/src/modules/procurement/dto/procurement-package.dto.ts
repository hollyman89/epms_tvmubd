import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProcurementPackageStatus } from '../../../entities/procurement-package.entity';

export class CreatePackageItemDto {
  @ApiProperty({ description: 'Cost Item ID from approved RAB', example: 101 })
  @IsNumber()
  @IsNotEmpty()
  costItemId: number;

  @ApiProperty({ description: 'Requested quantity', example: 10 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0.0001)
  requestedQty: number;

  @ApiPropertyOptional({ description: 'Required date (YYYY-MM-DD)', example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  requiredDate?: string;
}

export class CreatePackageDraftDto {
  @ApiProperty({ description: 'Project ID (must be IN_PROGRESS)', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @ApiProperty({ description: 'Package Title', example: 'Pengadaan Kabel MV & LV Substation' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Package Description', example: 'Kebutuhan kabel untuk pekerjaan feeder' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Required date (YYYY-MM-DD)', example: '2026-10-20' })
  @IsOptional()
  @IsDateString()
  requiredDate?: string;

  @ApiProperty({ type: [CreatePackageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePackageItemDto)
  items: CreatePackageItemDto[];
}

export class UpdatePackageDraftDto {
  @ApiPropertyOptional({ description: 'Package Title', example: 'Pengadaan Kabel MV & LV Substation Revisi' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Package Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Required date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  requiredDate?: string;

  @ApiPropertyOptional({ type: [CreatePackageItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePackageItemDto)
  items?: CreatePackageItemDto[];
}

export class ReturnPackageDto {
  @ApiProperty({ description: 'Catatan pengembalian/revisi untuk PM', example: 'Spesifikasi material perlu diperjelas' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CancelPackageDto {
  @ApiPropertyOptional({ description: 'Alasan pembatalan paket', example: 'Perubahan lingkup kerja' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryPackageDto {
  @ApiPropertyOptional({ description: 'Filter by Project ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  projectId?: number;

  @ApiPropertyOptional({ enum: ProcurementPackageStatus, description: 'Filter by Status' })
  @IsOptional()
  @IsEnum(ProcurementPackageStatus)
  status?: ProcurementPackageStatus;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  search?: string;
}
