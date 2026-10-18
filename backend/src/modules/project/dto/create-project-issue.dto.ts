import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ProjectIssueSeverity,
  ProjectIssuePriority,
} from "../../../entities/project-issue.entity";
import { ProjectIssueRiskCategory } from "../../../entities/project-risk.entity";

export class CreateProjectIssueDto {
  @ApiProperty({ description: "Title of the issue", maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: "Detailed description of the issue" })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: ProjectIssueRiskCategory, description: "Category" })
  @IsEnum(ProjectIssueRiskCategory)
  category: ProjectIssueRiskCategory;

  @ApiProperty({
    enum: ProjectIssueSeverity,
    description: "Severity (impact magnitude)",
  })
  @IsEnum(ProjectIssueSeverity)
  severity: ProjectIssueSeverity;

  @ApiProperty({
    enum: ProjectIssuePriority,
    description: "Priority (urgency)",
  })
  @IsEnum(ProjectIssuePriority)
  priority: ProjectIssuePriority;

  @ApiProperty({ description: "Accountable owner user ID", example: 2 })
  @IsInt()
  @Min(1)
  ownerId: number;

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
