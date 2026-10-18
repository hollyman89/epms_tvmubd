import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ProjectIssueSeverity,
  ProjectIssuePriority,
} from "../../../entities/project-issue.entity";
import { ProjectIssueRiskCategory } from "../../../entities/project-risk.entity";

export class UpdateProjectIssueDto {
  @ApiProperty({
    description:
      "Authoritative expected version for optimistic concurrency control",
    example: 1,
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ description: "Title of the issue", maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: "Detailed description of the issue" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({
    enum: ProjectIssueRiskCategory,
    description: "Category",
  })
  @IsOptional()
  @IsEnum(ProjectIssueRiskCategory)
  category?: ProjectIssueRiskCategory;

  @ApiPropertyOptional({ enum: ProjectIssueSeverity, description: "Severity" })
  @IsOptional()
  @IsEnum(ProjectIssueSeverity)
  severity?: ProjectIssueSeverity;

  @ApiPropertyOptional({ enum: ProjectIssuePriority, description: "Priority" })
  @IsOptional()
  @IsEnum(ProjectIssuePriority)
  priority?: ProjectIssuePriority;

  @ApiPropertyOptional({ description: "Accountable owner user ID", example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownerId?: number;

  @ApiPropertyOptional({
    description: "Optional associated task/WBS ID",
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  taskId?: number;

  @ApiPropertyOptional({
    description: "Target resolution due date (YYYY-MM-DD)",
    example: "2026-11-01",
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
