import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateTenderDto {
  @ApiProperty({ example: 1, description: 'Customer ID' })
  @IsNumber()
  @IsNotEmpty()
  customerId: number;

  @ApiProperty({ example: 'IT Infrastructure Project 2026', description: 'Title of the tender / project' })
  @IsString()
  @IsNotEmpty()
  projectName: string; // The UI might send 'title' but we map it

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  marketingPicId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  picCustomerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  picCustomerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  picCustomerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessSector?: string;

  @ApiPropertyOptional({ default: 'LEAD' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  probabilityPercentage?: number;

  @ApiPropertyOptional({ default: 'MEDIUM' })
  @IsOptional()
  @IsString()
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 150000000, description: 'Estimated budget in IDR' })
  @IsNumber()
  @IsNotEmpty()
  estimatedBudget: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedClosingDate?: string;

  @ApiPropertyOptional({ default: 'TENDER' })
  @IsOptional()
  @IsString()
  procurementType?: 'TENDER' | 'DIRECT_APPOINTMENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  bidSubmissionDeadline?: string;
}

export class UpdateTenderStatusDto {
  @ApiProperty({ example: 'Won', enum: ['LEAD', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'Won', 'Lost'] })
  @IsString()
  @IsNotEmpty()
  stage: string;
}

export class UpdateTenderDto extends PartialType(CreateTenderDto) {}
