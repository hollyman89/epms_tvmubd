import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconcileItemDto {
  @ApiProperty({ description: 'Target CostItem ID from active APPROVED RAB of the same project', example: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'targetCostItemId wajib diisi' })
  targetCostItemId: number;

  @ApiPropertyOptional({ description: 'Mapped quantity override (defaults to PR Item quantity)', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001, { message: 'mappedQuantity harus lebih besar dari 0' })
  mappedQuantity?: number;

  @ApiPropertyOptional({ description: 'Mapped amount override (defaults to PR Item total price)', example: 1500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'mappedAmount tidak boleh negatif' })
  mappedAmount?: number;

  @ApiPropertyOptional({ description: 'Match type or classification rationale', example: 'MANUAL_MAPPING' })
  @IsOptional()
  @IsString()
  matchType?: string;

  @ApiPropertyOptional({ description: 'Reconciliation notes', example: 'Mapped to CostItem Beton K-300' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExcludeItemDto {
  @ApiProperty({ description: 'Mandatory reason for excluding historical item from project RAB quota', example: 'Non-project administrative expense' })
  @IsString()
  @IsNotEmpty({ message: 'Alasan eksklusi (reason) wajib diisi' })
  reason: string;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Verified by Head of Operations' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryReconciliationDto {
  @ApiPropertyOptional({ description: 'Filter by Project ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  projectId?: number;

  @ApiPropertyOptional({ description: 'Filter by Reconciliation Status (PENDING, RECONCILED, EXCLUDED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by PR Origin (LEGACY, AD_HOC)' })
  @IsOptional()
  @IsString()
  origin?: 'LEGACY' | 'AD_HOC';
}
