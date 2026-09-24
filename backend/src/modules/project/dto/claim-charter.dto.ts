import { IsString, IsOptional, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimCharterDto {
  @ApiPropertyOptional({ description: 'Actual Formal Kickoff Date', example: '2026-09-02' })
  @IsOptional()
  @IsDateString()
  actualKickoffDate?: string;

  @ApiPropertyOptional({ description: 'Estimated Start Date', example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  estimatedStartDate?: string;

  @ApiPropertyOptional({ description: 'Estimated End Date', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  estimatedEndDate?: string;

  @ApiPropertyOptional({ description: 'Project Site Name', example: 'Site Rumah Net FKI Karawang' })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({ description: 'Physical Worksite Address', example: 'Jl. Raya Klari No. 88, Karawang Timur' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City or Regency', example: 'Kabupaten Karawang' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Jawa Barat' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: 'Postal Code', example: '41371' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Latitude (-90 to 90)', example: -6.305421 })
  @IsOptional()
  @IsNumber()
  @Min(-90, { message: 'Latitude harus berada dalam rentang -90 hingga 90' })
  @Max(90, { message: 'Latitude harus berada dalam rentang -90 hingga 90' })
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude (-180 to 180)', example: 107.301452 })
  @IsOptional()
  @IsNumber()
  @Min(-180, { message: 'Longitude harus berada dalam rentang -180 hingga 180' })
  @Max(180, { message: 'Longitude harus berada dalam rentang -180 hingga 180' })
  longitude?: number;
}
