import { IsNumber, IsString, IsNotEmpty, IsArray, ValidateNested, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class InvoiceItemDto {
  @ApiProperty({ example: 1, description: 'ID of the Purchase Order Item' })
  @IsNumber()
  @IsNotEmpty()
  poItemId: number;

  @ApiProperty({ example: 5, description: 'Quantity billed' })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 1000000, description: 'Unit price' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unitPrice: number;

  @ApiProperty({ example: 5000000, description: 'Total price for this item' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  totalPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 1, description: 'ID of the Purchase Order' })
  @IsNumber()
  @IsNotEmpty()
  purchaseOrderId: number;

  @ApiProperty({ example: '2026-07-09T10:00:00Z', description: 'Date of the invoice' })
  @IsDateString()
  @IsNotEmpty()
  invoiceDate: string;

  @ApiProperty({ type: [InvoiceItemDto], description: 'List of billed items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsNotEmpty()
  items: InvoiceItemDto[];
}
