import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsOptional()
  level?: number;
}
