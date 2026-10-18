import { IsOptional, IsString, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryProjectIssueDto {
  @ApiPropertyOptional({
    description:
      "Filter by status (OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED)",
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: "Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)",
  })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({
    description: "Filter by priority (LOW, MEDIUM, HIGH, URGENT)",
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: "Filter by category" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: "Filter by ownerId" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ownerId?: number;

  @ApiPropertyOptional({
    description: "Filter only overdue issues (true/false)",
  })
  @IsOptional()
  @IsString()
  overdueOnly?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Page limit", default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
