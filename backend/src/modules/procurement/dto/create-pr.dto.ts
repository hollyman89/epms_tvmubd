import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';

export class PrItemDto {
  @ApiProperty({ example: 'Laptop Lenovo ThinkPad' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 25000000 })
  @IsNumber()
  @IsNotEmpty()
  estimatedUnitPrice: number;
}

export class CreatePurchaseRequestDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @ApiProperty({ example: 50000000 })
  @IsNumber()
  @IsNotEmpty()
  totalEstimatedAmount: number;

  @ApiProperty({ type: [PrItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrItemDto)
  items: PrItemDto[];
}
