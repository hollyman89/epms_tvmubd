import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AuditQueryDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number (1-based, min 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Items per page (1..100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term across table_name, action, record_id' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ description: 'Filter start date (ISO 8601 string, e.g. 2026-09-01 or 2026-09-01T00:00:00Z)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter end date (ISO 8601 string, e.g. 2026-09-11 or 2026-09-11T23:59:59Z)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by exact table / entity name (e.g. vendors, contracts)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  tableName?: string;

  @ApiPropertyOptional({ description: 'Filter by exact action (e.g. CREATE, UPDATE, SOFT_DELETE)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by actor ID (numeric user ID >= 0, where 0 represents System)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actorId?: number;
}
