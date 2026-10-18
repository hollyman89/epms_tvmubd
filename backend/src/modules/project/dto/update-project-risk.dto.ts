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
import { ProjectIssueRiskCategory } from "../../../entities/project-risk.entity";

export class UpdateProjectRiskDto {
  @ApiProperty({ description: "Authoritative expected version", example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ description: "Title of the risk", maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: "Detailed description of the risk" })
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

  @ApiPropertyOptional({ description: "Proactive mitigation plan" })
  @IsOptional()
  @IsString()
  mitigationPlan?: string;

  @ApiPropertyOptional({ description: "Fallback contingency plan" })
  @IsOptional()
  @IsString()
  contingencyPlan?: string;

  @ApiPropertyOptional({
    description: "Target date for mitigation implementation (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ description: "Periodic review date (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  reviewDate?: string;
}
