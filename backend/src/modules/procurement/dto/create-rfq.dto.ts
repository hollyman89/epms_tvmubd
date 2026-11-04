import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRfqDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  purchaseRequestId: number;

  @ApiPropertyOptional({ example: '2026-07-20T12:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  closingDate?: string;

  @ApiPropertyOptional({ example: 'Spesifikasi teknis material standar ASTM A36', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
