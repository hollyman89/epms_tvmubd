import { IsInt, IsEnum, IsOptional, IsDateString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ProjectIssueSeverity,
  ProjectIssuePriority,
} from "../../../entities/project-issue.entity";

export class MaterializeProjectRiskDto {
  @ApiProperty({
    description: "Authoritative expected version of the risk",
    example: 1,
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({
    enum: ProjectIssueSeverity,
    description:
      "Mandatory evaluated severity of the materialized issue (cannot be auto-mapped from risk level)",
    example: ProjectIssueSeverity.HIGH,
  })
  @IsEnum(ProjectIssueSeverity)
  severity: ProjectIssueSeverity;

  @ApiProperty({
    enum: ProjectIssuePriority,
    description:
      "Mandatory operational priority of the materialized issue (cannot be defaulted to HIGH)",
    example: ProjectIssuePriority.HIGH,
  })
  @IsEnum(ProjectIssuePriority)
  priority: ProjectIssuePriority;

  @ApiPropertyOptional({
    description: "Target resolution due date (YYYY-MM-DD)",
    example: "2026-11-15",
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: "Optional owner override for the generated issue",
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownerId?: number;
}
