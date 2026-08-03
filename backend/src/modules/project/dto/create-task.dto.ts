import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  wbsId: number;

  @ApiProperty({ example: 2, required: false })
  @IsNumber()
  @IsOptional()
  assigneeId?: number;

  @ApiProperty({ example: 'Design Database Schema' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'TODO' })
  @IsString()
  @IsOptional()
  status?: string;
}
