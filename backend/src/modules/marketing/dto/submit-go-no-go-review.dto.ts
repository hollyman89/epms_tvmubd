import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMaxSize, ValidateNested, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReadinessDto {
  @ApiProperty({ enum: ['CLEAR', 'PARTIAL', 'UNCLEAR'], example: 'CLEAR' })
  @IsString()
  @IsIn(['CLEAR', 'PARTIAL', 'UNCLEAR'], { message: 'Customer requirement readiness harus CLEAR, PARTIAL, atau UNCLEAR' })
  customerRequirement: 'CLEAR' | 'PARTIAL' | 'UNCLEAR';

  @ApiProperty({ enum: ['READY', 'PARTIAL', 'NOT_READY'], example: 'READY' })
  @IsString()
  @IsIn(['READY', 'PARTIAL', 'NOT_READY'], { message: 'Commercial information readiness harus READY, PARTIAL, atau NOT_READY' })
  commercialInformation: 'READY' | 'PARTIAL' | 'NOT_READY';

  @ApiProperty({ enum: ['FEASIBLE', 'AT_RISK'], example: 'FEASIBLE' })
  @IsString()
  @IsIn(['FEASIBLE', 'AT_RISK'], { message: 'Timeline readiness harus FEASIBLE atau AT_RISK' })
  timeline: 'FEASIBLE' | 'AT_RISK';
}

export class SubmitGoNoGoReviewDto {
  @ApiProperty({ description: 'Ringkasan eksekutif kelayakan opportunity', example: 'Opportunity strategis dengan repeat customer.' })
  @IsString()
  @IsNotEmpty({ message: 'Ringkasan eksekutif wajib diisi' })
  executiveSummary: string;

  @ApiPropertyOptional({ description: 'Concern utama (maksimal 3)', example: ['Timeline ketat'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Concern utama maksimal 3 item' })
  keyConcerns?: string[];

  @ApiProperty({ type: ReadinessDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ReadinessDto)
  readiness: ReadinessDto;

  @ApiProperty({ enum: ['GO', 'REVIEW'], example: 'GO' })
  @IsString()
  @IsIn(['GO', 'REVIEW'], { message: 'Rekomendasi marketing harus GO atau REVIEW' })
  marketingRecommendation: 'GO' | 'REVIEW';

  @ApiProperty({ description: 'Alasan rekomendasi marketing', example: 'Margin sehat dan risiko delivery terkendali' })
  @IsString()
  @IsNotEmpty({ message: 'Alasan rekomendasi marketing wajib diisi' })
  marketingRecommendationReason: string;
}
