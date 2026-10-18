import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreatePoPaymentTermDto } from './create-po-payment-term.dto';

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

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  pr_item_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  cost_item_id?: number;
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

  @ApiProperty({
    type: [CreatePoPaymentTermDto],
    description: 'Configurable payment terms schedule. Total percentage must equal exactly 100.00%',
  })
  @IsArray({ message: 'Payment terms harus berupa array' })
  @ArrayNotEmpty({ message: 'Payment terms wajib diisi minimal 1 termin' })
  @ValidateNested({ each: true })
  @Type(() => CreatePoPaymentTermDto)
  payment_terms: CreatePoPaymentTermDto[];

  @ApiProperty({
    type: [PoItemDto],
    required: false,
    description: 'Optional client reference items; server derives authoritative items & pricing directly from winning quotation in database',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  po_items?: PoItemDto[];

  @ApiProperty({ required: false, example: 'Gudang Karawang' })
  @IsOptional()
  @IsString()
  delivery_location?: string;

  @ApiProperty({ required: false, example: '2026-09-20T00:00:00.000Z' })
  @IsOptional()
  delivery_date?: Date;

  @ApiProperty({ required: false, example: 'Pengiriman bertahap' })
  @IsOptional()
  @IsString()
  notes?: string;
}
