import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceClaimAcceptanceType } from "../../../entities/service-claim.entity";

export class CreateServiceClaimItemDto {
  @ApiProperty({ description: "ID of the Purchase Order Item", example: 101 })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  poItemId: number;

  @ApiProperty({
    description: "Current quantity claimed in this period",
    example: 100.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  currentClaimQuantity: number;

  @ApiPropertyOptional({
    description: "Work location on site",
    example: "Zona A - KM 12",
  })
  @IsOptional()
  @IsString()
  workLocation?: string;

  @ApiPropertyOptional({
    description: "Item notes or field remarks",
    example: "Pengerjaan sesuai checklist QC",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateServiceClaimDto {
  @ApiProperty({
    description: "Purchase Order ID (must be SERVICE PO)",
    example: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  purchaseOrderId?: number;

  @ApiPropertyOptional({ description: "Alias for purchaseOrderId", example: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  poId?: number;

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

  @ApiProperty({
    description: "Claim line items",
    type: [CreateServiceClaimItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceClaimItemDto)
  @IsNotEmpty()
  items: CreateServiceClaimItemDto[];
}
