import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartWorkflowInstanceDto {
  @ApiProperty({ description: 'Unique key of the workflow to instantiate', example: 'PR_APPROVAL' })
  @IsString()
  @IsNotEmpty()
  workflowKey: string;

  @ApiProperty({ description: 'Type of business entity (polymorphic ref)', example: 'PURCHASE_REQUEST' })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty({ description: 'ID of the business entity (polymorphic ref)', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  entityId: number;

  @ApiPropertyOptional({ description: 'Initial payload/context for condition routing', example: { amount: 15000000 } })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;
}

export class CompleteWorkflowTaskDto {
  @ApiProperty({ description: 'Decision action', enum: ['APPROVE', 'REJECT', 'RETURN', 'PASS', 'RESUBMIT'], example: 'APPROVE' })
  @IsString()
  @IsIn(['APPROVE', 'REJECT', 'RETURN', 'PASS', 'RESUBMIT'])
  action: 'APPROVE' | 'REJECT' | 'RETURN' | 'PASS' | 'RESUBMIT';

  @ApiPropertyOptional({ description: 'Reason / decision comment', example: 'Approved within threshold.' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Updated runtime context variables', example: { approvedAmount: 15000000 } })
  @IsObject()
  @IsOptional()
  contextUpdate?: Record<string, any>;
}
