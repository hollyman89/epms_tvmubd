import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowDefinitionDto {
  @ApiProperty({ description: 'Unique identifier for the workflow (e.g., PR_APPROVAL)' })
  @IsString()
  @IsNotEmpty()
  workflowKey: string;

  @ApiProperty({ description: 'Display name of the workflow' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the workflow' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Domain grouping for the workflow (e.g., PROCUREMENT)' })
  @IsString()
  @IsOptional()
  domain?: string;
}

export class CreateWorkflowVersionDto {
  @ApiProperty({ description: 'JSON structure of the BPMN definition' })
  @IsObject()
  @IsNotEmpty()
  bpmnJson: any;
}
