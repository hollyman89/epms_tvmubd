import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';

export class PoItemDto {
  @ApiProperty({ example: 'Laptop Lenovo ThinkPad' })
  @IsString()
  @IsNotEmpty()
  item_name: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 25000000 })
  @IsNumber()
  @IsNotEmpty()
  unit_price: number;

  @ApiProperty({ example: 50000000 })
  @IsNumber()
  @IsNotEmpty()
  total_price: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  purchase_request_id: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsNotEmpty()
  vendor_id: number;

  @ApiProperty({ type: [PoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  po_items: PoItemDto[];
}
