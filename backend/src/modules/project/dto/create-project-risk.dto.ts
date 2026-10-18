import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectIssueRiskCategory } from "../../../entities/project-risk.entity";

export class CreateProjectRiskDto {
  @ApiProperty({ description: "Title of the risk", maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: "Detailed description of the risk" })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: ProjectIssueRiskCategory, description: "Category" })
  @IsEnum(ProjectIssueRiskCategory)
  category: ProjectIssueRiskCategory;

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

  @ApiPropertyOptional({ description: "Probability (1..5)", example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  probability?: number;

  @ApiPropertyOptional({ description: "Impact (1..5)", example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  impact?: number;

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
