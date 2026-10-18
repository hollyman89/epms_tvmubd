import { IsOptional, IsInt, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryServiceClaimDto {
  @ApiPropertyOptional({
    description: "Filter by Purchase Order ID",
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  poId?: number;

  @ApiPropertyOptional({ description: "Filter by Project ID", example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @ApiPropertyOptional({ description: "Filter by Vendor ID", example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendorId?: number;

  @ApiPropertyOptional({
    description: "Filter by claim status",
    example: "APPROVED_FOR_INVOICE",
  })
  @IsOptional()
  @IsString()
  status?: string;
}
