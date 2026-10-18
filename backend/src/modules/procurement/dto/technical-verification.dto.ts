import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum ClaimVerificationDecision {
  APPROVE = "APPROVE",
  RETURN = "RETURN",
  REJECT = "REJECT",
}

export class TechnicalVerificationDto {
  @ApiProperty({
    description: "Technical verification decision",
    enum: ClaimVerificationDecision,
    example: ClaimVerificationDecision.APPROVE,
  })
  @IsEnum(ClaimVerificationDecision)
  @IsNotEmpty()
  decision: ClaimVerificationDecision;

  @ApiPropertyOptional({
    description:
      "Revision notes for submitter (mandatory when decision is RETURN)",
    example:
      "Volume item pengaspalan perlu disesuaikan dengan opname lapangan 10 Oktober",
  })
  @IsOptional()
  @IsString()
  revisionNotes?: string;

  @ApiPropertyOptional({
    description: "Rejection reason (mandatory when decision is REJECT)",
    example: "Pekerjaan tidak sesuai spesifikasi teknis dan ditolak total",
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
