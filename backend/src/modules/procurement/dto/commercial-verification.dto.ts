import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClaimVerificationDecision } from "./technical-verification.dto";

export class CommercialVerificationDto {
  @ApiProperty({
    description: "Commercial verification decision",
    enum: ClaimVerificationDecision,
    example: ClaimVerificationDecision.APPROVE,
  })
  @IsEnum(ClaimVerificationDecision)
  @IsNotEmpty()
  decision: ClaimVerificationDecision;

  @ApiPropertyOptional({
    description:
      "Revision notes for submitter (mandatory when decision is RETURN)",
    example: "Periksa kembali perhitungan akumulasi termin 2",
  })
  @IsOptional()
  @IsString()
  revisionNotes?: string;

  @ApiPropertyOptional({
    description: "Rejection reason (mandatory when decision is REJECT)",
    example: "Klaim melebihi pagu kontrak komersial",
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
