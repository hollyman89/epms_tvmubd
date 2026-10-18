import {
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateServiceClaimItemDto } from "./create-service-claim.dto";
import { ServiceClaimAcceptanceType } from "../../../entities/service-claim.entity";

export class UpdateServiceClaimDto {
  @ApiPropertyOptional({
    description: "Optional Service Order (SPK / WO) ID",
    example: 501,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  serviceOrderId?: number;

  @ApiPropertyOptional({
    description: "Claim period start date",
    example: "2026-10-01",
  })
  @IsOptional()
  @IsDateString()
  claimPeriodStart?: string;

  @ApiPropertyOptional({
    description: "Claim period end date",
    example: "2026-10-15",
  })
  @IsOptional()
  @IsDateString()
  claimPeriodEnd?: string;

  @ApiPropertyOptional({
    description: "Acceptance evidence type",
    enum: ServiceClaimAcceptanceType,
    example: ServiceClaimAcceptanceType.PROGRESS_CERTIFICATE,
  })
  @IsOptional()
  @IsEnum(ServiceClaimAcceptanceType)
  acceptanceType?: ServiceClaimAcceptanceType;

  @ApiPropertyOptional({
    description: "Acceptance or BAST reference number",
    example: "BAST-2026-001",
  })
  @IsOptional()
  @IsString()
  acceptanceReference?: string;

  @ApiPropertyOptional({
    description: "Acceptance or BAST date",
    example: "2026-10-15",
  })
  @IsOptional()
  @IsDateString()
  acceptanceDate?: string;

  @ApiPropertyOptional({ description: "General claim notes" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: "Claim line items",
    type: [CreateServiceClaimItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceClaimItemDto)
  items?: CreateServiceClaimItemDto[];
}
