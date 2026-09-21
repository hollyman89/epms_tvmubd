import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class VendorDataDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  vendorId: number;

  @ApiProperty({ example: 45000000 })
  @IsNumber()
  @IsNotEmpty()
  offeredAmount: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isWinner: boolean;
}

export class SubmitVendorComparisonDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  rfqId: number;

  @ApiProperty({ type: [VendorDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorDataDto)
  vendors: VendorDataDto[];

  @ApiProperty({ example: 'Evaluasi berdasarkan harga terendah dan spesifikasi', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
