import { IsNumber, IsNotEmpty, IsDateString, Min, IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID of the Invoice to be paid' })
  @IsNumber()
  @IsNotEmpty()
  invoiceId: number;

  @ApiProperty({ example: 1, description: 'ID of the approved PaymentRequest' })
  @IsNumber()
  @IsNotEmpty()
  paymentRequestId: number;

  @ApiProperty({ example: '2026-07-15T10:00:00Z', description: 'Date of the payment' })
  @IsDateString()
  @IsNotEmpty()
  paymentDate: string;

  @ApiProperty({ example: 5000000, description: 'Amount paid' })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  paymentAmount?: number;

  @ApiProperty({ required: false, example: 5000000, description: 'Amount paid (alias for paymentAmount)' })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @ApiProperty({ example: 'BANK_TRANSFER', enum: ['BANK_TRANSFER', 'CHEQUE'] })
  @IsEnum(['BANK_TRANSFER', 'CHEQUE'])
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ example: 'TRX-99887766' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @ApiProperty({ required: false, example: 'Bank Mandiri' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false, example: 'Pelunasan invoice' })
  @IsOptional()
  @IsString()
  notes?: string;
}
