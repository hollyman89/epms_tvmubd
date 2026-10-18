import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum DirectorDecisionAction {
  APPROVE = "APPROVE",
  RETURN = "RETURN",
  REJECT = "REJECT",
}

export class DecidePaymentRequestDto {
  @ApiProperty({
    example: "APPROVE",
    enum: DirectorDecisionAction,
    description: "Decision action: APPROVE, RETURN, or REJECT",
  })
  @IsEnum(DirectorDecisionAction)
  @IsNotEmpty()
  action: DirectorDecisionAction;

  @ApiProperty({
    example: "Mohon lampirkan bukti serah terima asli",
    description: "Revision notes (mandatory when action is RETURN)",
    required: false,
  })
  @IsOptional()
  @IsString()
  revisionNotes?: string;

  @ApiProperty({
    example: "Pengajuan ditolak karena kontrak dibatalkan",
    description: "Rejection reason (mandatory when action is REJECT)",
    required: false,
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiProperty({
    example: 24000000,
    description: "Approved amount (defaults to requested amount if omitted)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  approvedAmount?: number;
}
