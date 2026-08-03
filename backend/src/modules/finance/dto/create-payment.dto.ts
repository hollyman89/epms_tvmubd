import { IsNumber, IsNotEmpty, IsDateString, Min, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID of the Invoice to be paid' })
  @IsNumber()
  @IsNotEmpty()
  invoiceId: number;

  @ApiProperty({ example: '2026-07-15T10:00:00Z', description: 'Date of the payment' })
  @IsDateString()
  @IsNotEmpty()
  paymentDate: string;

  @ApiProperty({ example: 5000000, description: 'Amount paid' })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  paymentAmount: number;

  @ApiProperty({ example: 'BANK_TRANSFER', enum: ['BANK_TRANSFER', 'CHEQUE'] })
  @IsEnum(['BANK_TRANSFER', 'CHEQUE'])
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ example: 'TRX-99887766' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;
}
