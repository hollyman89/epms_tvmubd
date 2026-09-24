import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaymentTermType } from '../../../entities/po-payment-term.entity';

export class CreatePoPaymentTermDto {
  @ApiProperty({ example: 1, description: 'Sequence number starting from 1' })
  @IsInt({ message: 'Sequence harus berupa bilangan bulat' })
  @Min(1, { message: 'Sequence harus lebih besar dari 0' })
  sequence: number;

  @ApiProperty({ example: 'Termin 1 - DP', description: 'Name of the payment term' })
  @IsString()
  @IsNotEmpty({ message: 'Nama termin (term_name) wajib diisi' })
  term_name: string;

  @ApiProperty({
    enum: PaymentTermType,
    example: PaymentTermType.DOWN_PAYMENT,
    description: 'Term type: DOWN_PAYMENT, PROGRESS, FINAL_DELIVERY, RETENTION',
  })
  @IsEnum(PaymentTermType, { message: 'Tipe termin (term_type) tidak valid' })
  term_type: PaymentTermType;

  @ApiProperty({ example: 30, description: 'Percentage of the term (0 < percentage <= 100)' })
  @IsNumber({}, { message: 'Persentase termin harus berupa angka' })
  @Min(0.01, { message: 'Persentase termin harus lebih besar dari 0' })
  @Max(100, { message: 'Persentase termin tidak boleh melebihi 100' })
  percentage: number;

  @ApiProperty({ required: false, example: 'PO Diterbitkan', description: 'Trigger condition description' })
  @IsOptional()
  @IsString()
  trigger_condition?: string;

  @ApiProperty({ required: false, example: false, description: 'Flag indicating retention term' })
  @IsOptional()
  @IsBoolean()
  is_retention?: boolean;

  @ApiProperty({ required: false, example: 90, description: 'Retention period in days if term is retention' })
  @IsOptional()
  @IsInt({ message: 'Retention days harus berupa bilangan bulat' })
  @Min(1, { message: 'Retention days harus lebih besar dari 0 hari' })
  retention_days?: number;

  @ApiProperty({
    required: false,
    example: 30143997,
    description: 'Optional client reference amount; server derives authoritative amount from total PO',
  })
  @IsOptional()
  @IsNumber()
  amount?: number;
}
