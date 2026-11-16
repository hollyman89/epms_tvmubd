import { IsNumber, IsNotEmpty, IsArray, ValidateNested, IsDateString, Min, IsOptional, IsString, Matches } from 'class-validator';
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

export class CreateInvoiceTaxPpnDto {
  @ApiProperty({ example: '010.000-26.12345678', description: 'Nomor Faktur Pajak (NSFP)', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{3}\.?[0-9]{3}-?[0-9]{2}\.?[0-9]{8}$|^[0-9]{16}$/, {
    message: 'Nomor Faktur Pajak (NSFP) harus terdiri dari 16 digit angka (contoh: 010.000-26.12345678)',
  })
  fakturPajakNumber?: string;

  @ApiProperty({ example: '2026-07-09T10:00:00Z', description: 'Tanggal Faktur Pajak', required: false })
  @IsDateString()
  @IsOptional()
  fakturPajakDate?: string;

  @ApiProperty({ example: 10000000, description: 'Dasar Pengenaan Pajak (DPP)', required: false })
  @IsNumber()
  @IsOptional()
  dppAmount?: number;

  @ApiProperty({ example: 11, description: 'Tarif PPN (%)', required: false })
  @IsNumber()
  @IsOptional()
  ppnRate?: number;

  @ApiProperty({ example: 1100000, description: 'Nominal PPN', required: false })
  @IsNumber()
  @IsOptional()
  ppnAmount?: number;

  @ApiProperty({ example: 12, description: 'ID of uploaded supporting document (PDF)', required: false })
  @IsNumber()
  @IsOptional()
  documentId?: number;
}

export class CreateInvoiceTaxPphDto {
  @ApiProperty({ example: 'PPH_23', description: 'Jenis PPh (e.g. PPH_23, PPH_4_2, PPH_21, PPH_22, OTHER)', required: false })
  @IsString()
  @IsOptional()
  pphType?: string;

  @ApiProperty({ example: 2.0, description: 'Tarif PPh dalam persentase (e.g. 2 untuk 2%)', required: false })
  @IsNumber()
  @IsOptional()
  rate?: number;

  @ApiProperty({ example: 10000000, description: 'Dasar Pengenaan PPh', required: false })
  @IsNumber()
  @IsOptional()
  taxableBase?: number;

  @ApiProperty({ example: 200000, description: 'Nominal PPh dipotong', required: false })
  @IsNumber()
  @IsOptional()
  withheldAmount?: number;

  @ApiProperty({ example: 'BP-2026-001', description: 'Nomor Bukti Potong', required: false })
  @IsString()
  @IsOptional()
  buktiPotongNumber?: string;

  @ApiProperty({ example: '2026-07-09T10:00:00Z', description: 'Tanggal Bukti Potong', required: false })
  @IsDateString()
  @IsOptional()
  buktiPotongDate?: string;

  @ApiProperty({ example: 13, description: 'ID of uploaded supporting document (PDF)', required: false })
  @IsNumber()
  @IsOptional()
  documentId?: number;
}

export class CreateInvoiceTaxDto {
  @ApiProperty({ type: CreateInvoiceTaxPpnDto, description: 'Data Administrasi PPN (Opsional)', required: false })
  @ValidateNested()
  @Type(() => CreateInvoiceTaxPpnDto)
  @IsOptional()
  ppn?: CreateInvoiceTaxPpnDto;

  @ApiProperty({ type: CreateInvoiceTaxPphDto, description: 'Data Administrasi PPh (Opsional)', required: false })
  @ValidateNested()
  @Type(() => CreateInvoiceTaxPphDto)
  @IsOptional()
  pph?: CreateInvoiceTaxPphDto;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 1, description: 'ID of the Purchase Order' })
  @IsNumber()
  @IsNotEmpty()
  purchaseOrderId: number;

  @ApiProperty({ example: 1, description: 'Optional ID of the PO Payment Term being invoiced', required: false })
  @IsNumber()
  @IsOptional()
  paymentTermId?: number;

  @ApiProperty({ example: 1, description: 'Optional ID of the Goods Receipt supporting this progress invoice', required: false })
  @IsNumber()
  @IsOptional()
  goodsReceiptId?: number;

  @ApiProperty({ example: 'GR-20260908-001', description: 'Optional GR Number or Evidence Reference', required: false })
  @IsString()
  @IsOptional()
  evidenceRef?: string;

  @ApiProperty({ example: 1, description: 'Optional ID of the Service Claim supporting this service invoice', required: false })
  @IsNumber()
  @IsOptional()
  serviceClaimId?: number;

  @ApiProperty({ example: '2026-07-09T10:00:00Z', description: 'Date of the invoice' })
  @IsDateString()
  @IsNotEmpty()
  invoiceDate: string;

  @ApiProperty({ type: [InvoiceItemDto], description: 'List of billed items', required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsOptional()
  items?: InvoiceItemDto[];

  @ApiProperty({ type: CreateInvoiceTaxDto, description: 'Optional tax administration data (PPN & PPh)', required: false })
  @ValidateNested()
  @Type(() => CreateInvoiceTaxDto)
  @IsOptional()
  tax?: CreateInvoiceTaxDto;
}
