import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyInvoiceDto {
  @ApiProperty({ example: true, description: 'True to approve verification, false to reject' })
  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;

  @ApiProperty({
    example: 1,
    description: 'Optional Goods Receipt ID to link/verify physical delivery',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  goodsReceiptId?: number;

  @ApiProperty({
    example: 'GR-20260908-001',
    description: 'Evidence reference (e.g. GR number, delivery note, or BAST)',
    required: false,
  })
  @IsString()
  @IsOptional()
  evidenceRef?: string;

  @ApiProperty({
    example: 1,
    description: 'Claimed Vendor ID for consistency assertion against authoritative PO vendor',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  vendorId?: number;

  @ApiProperty({
    example: 'Dokumen verifikasi termin sesuai kontrak dan syarat pembayaran terpenuhi',
    description: 'Finance review notes or rejection explanation',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
