import { IsNumber, IsString, IsNotEmpty, IsArray, ValidateNested, IsDateString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoodsReceiptItemDto {
  @ApiProperty({ example: 1, description: 'ID of the Purchase Order Item' })
  @IsNumber()
  @IsNotEmpty()
  poItemId: number;

  @ApiProperty({ example: 5, description: 'Quantity received' })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  receivedQuantity: number;

  @ApiPropertyOptional({ example: 'Box slightly damaged', description: 'Remarks for this specific item' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({ example: 1, description: 'ID of the Purchase Order' })
  @IsNumber()
  @IsNotEmpty()
  purchaseOrderId: number;

  @ApiProperty({ example: '2026-07-09T10:00:00Z', description: 'Date of receipt' })
  @IsDateString()
  @IsNotEmpty()
  receiptDate: string;

  @ApiPropertyOptional({ example: 'Received by warehouse staff A', description: 'General remarks for the receipt' })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty({ type: [GoodsReceiptItemDto], description: 'List of received items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  @IsNotEmpty()
  items: GoodsReceiptItemDto[];
}
