import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuotationItemDto {
  @ApiProperty({ example: 1, required: true })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  prItemId: number;

  @ApiProperty({ example: 'Kabel Fiber Optic 24 Core ADSS' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 'PCS' })
  @IsString()
  @IsNotEmpty()
  uom: string;

  @ApiProperty({ example: 12000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unitPrice: number;

  @ApiProperty({ example: 'Termasuk garansi 1 tahun', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateQuotationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  rfqId: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  vendorId: number;

  @ApiProperty({ example: 'QT-VEN-2026-09-001', required: false })
  @IsOptional()
  @IsString()
  vendorRef?: string;

  @ApiProperty({ example: '2026-09-02T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  quotationDate?: string;

  @ApiProperty({ example: '2026-09-30T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ example: 14, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  leadTimeDays?: number;

  @ApiProperty({ example: 'Pengiriman franko lokasi proyek Karawang', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateQuotationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  @IsNotEmpty()
  items: CreateQuotationItemDto[];
}
