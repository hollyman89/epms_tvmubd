import { IsEnum, IsOptional, IsDateString, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { DashboardPeriod } from "../../analytics/dto/get-analytics.dto";

export class GetExecutiveSummaryDto {
  @ApiPropertyOptional({
    enum: DashboardPeriod,
    default: DashboardPeriod.YEAR_TO_DATE,
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod = DashboardPeriod.YEAR_TO_DATE;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Authorized Division Scope ID or ALL' })
  @IsOptional()
  @IsString()
  divisionId?: string;

  @ApiPropertyOptional({ description: 'Alias for divisionId (ALL, UBD, TVM)' })
  @IsOptional()
  @IsString()
  scope?: string;
}

