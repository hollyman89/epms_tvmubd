import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsNumber, Min, MinLength, MaxLength, Matches, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @ApiProperty({ example: 'PT Teknologi Cerdas' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'PT Teknologi Cerdas Indonesia' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  company?: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  contact_person: string;

  @ApiProperty({ example: '08123456789' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+62|0)[0-9]{9,14}$/, { message: 'Format nomor telepon Indonesia tidak valid' })
  phone: string;

  @ApiProperty({ example: 'budi@teknologicerdas.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  business_sector?: string;

  @ApiPropertyOptional({ example: 'Jakarta' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE', 'PROSPECT'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'PROSPECT'])
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  marketing_pic_id?: number;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact_person?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^(\+62|0)[0-9]{9,14}$/, { message: 'Format nomor telepon Indonesia tidak valid' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['Telekomunikasi & Internet', 'Teknologi Informasi & Software', 'Transportasi & Logistik', 'Konstruksi', 'Finansial', 'Lainnya'])
  business_sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'PROSPECT'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'PROSPECT'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  marketing_pic_id?: number;
}

export class CustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, company, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ enum: ['Active', 'Inactive'] })
  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
