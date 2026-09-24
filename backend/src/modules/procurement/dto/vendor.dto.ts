import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateVendorDto {
  @ApiPropertyOptional({ example: 'VND-006', description: 'Unique vendor code (server-generated)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  @ApiProperty({ example: 'PT Mitra Teknologi Utama', description: 'Vendor company name' })
  @IsString()
  @IsNotEmpty({ message: 'Nama vendor wajib diisi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 45, Jakarta Selatan', description: 'Vendor office address' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address?: string;

  @ApiPropertyOptional({ example: '01.234.567.8-901.000', description: 'Tax ID / NPWP' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  taxId?: string;

  @ApiPropertyOptional({ example: 'Hardware', description: 'Category or vendor type' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  vendorType?: string;
}

export class UpdateVendorDto {
  @ApiPropertyOptional({ example: 'PT Mitra Teknologi Utama Updated', description: 'Vendor company name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nama vendor tidak boleh kosong jika diubah' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 45, Gedung A Lt. 3, Jakarta Selatan', description: 'Vendor office address' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address?: string;

  @ApiPropertyOptional({ example: '01.234.567.8-901.000', description: 'Tax ID / NPWP' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  taxId?: string;

  @ApiPropertyOptional({ example: 'Hardware', description: 'Category or vendor type' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  vendorType?: string;
}

export class VendorQueryDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search term across vendor code and name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor type / category' })
  @IsOptional()
  @IsString()
  vendorType?: string;
}
