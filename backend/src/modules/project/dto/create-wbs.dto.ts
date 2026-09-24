import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateWbsDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @ApiProperty({ example: null, required: false })
  @IsNumber()
  @IsOptional()
  parentWbsId?: number;

  @ApiProperty({ example: 'WBS-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Phase 1: Design' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  level?: number;

  @ApiProperty({ example: 15.5, required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  weightPercentage?: number;

  @ApiProperty({ example: 'Site survey, koordinasi perizinan instansi & K3 operasional', required: false })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;
}
