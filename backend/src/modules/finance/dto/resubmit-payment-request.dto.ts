import { IsOptional, IsString, IsNumber, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ResubmitPaymentRequestDto {
  @ApiProperty({
    example: 24000000,
    description: "Revised requested amount",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  requestedAmount?: number;

  @ApiProperty({
    example: "Bank Mandiri",
    description: "Updated Vendor Bank Name",
    required: false,
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({
    example: "123-456-7890",
    description: "Updated Vendor Bank Account Number",
    required: false,
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({
    example: "PT Vendor Mandiri",
    description: "Updated Vendor Bank Account Holder",
    required: false,
  })
  @IsOptional()
  @IsString()
  bankAccountHolder?: string;

  @ApiProperty({
    example: "Dokumen pendukung telah diperbarui sesuai instruksi Direktur.",
    description: "Finance revision remarks",
    required: false,
  })
  @IsOptional()
  @IsString()
  revisionNotes?: string;

  @ApiProperty({
    example: "Catatan pengajuan ulang",
    description: "Additional notes",
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
