import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SubmitPaymentRequestDto {
  @ApiProperty({
    example: 17,
    description: "ID of the Invoice to request payment for",
  })
  @IsNumber()
  @IsNotEmpty()
  invoiceId: number;

  @ApiProperty({
    example: 42,
    description: "Optional payment term ID",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  paymentTermId?: number;

  @ApiProperty({
    example: 24000000,
    description: "Requested amount (defaults to invoice amount)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  requestedAmount?: number;

  @ApiProperty({
    example: "Bank Mandiri",
    description: "Vendor Bank Name",
    required: false,
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({
    example: "123-456-7890",
    description: "Vendor Bank Account Number",
    required: false,
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({
    example: "PT Vendor Mandiri",
    description: "Vendor Bank Account Holder",
    required: false,
  })
  @IsOptional()
  @IsString()
  bankAccountHolder?: string;

  @ApiProperty({
    example: "Pengajuan pembayaran termin 1",
    description: "Submission notes",
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
