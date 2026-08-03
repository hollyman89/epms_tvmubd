import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateRfqDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  purchaseRequestId: number;

  @ApiProperty({ example: '2026-07-20T12:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  closingDate?: string;
}
