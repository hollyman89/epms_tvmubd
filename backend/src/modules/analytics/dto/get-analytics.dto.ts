import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DashboardPeriod {
  THIS_MONTH = 'THIS_MONTH',
  LAST_QUARTER = 'LAST_QUARTER',
  YEAR_TO_DATE = 'YEAR_TO_DATE',
  LAST_MONTH = 'LAST_MONTH',
  THIS_QUARTER = 'THIS_QUARTER',
  CUSTOM = 'CUSTOM',
  ALL_TIME = 'ALL_TIME',
}

export class GetAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: DashboardPeriod, default: DashboardPeriod.YEAR_TO_DATE })
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
}
