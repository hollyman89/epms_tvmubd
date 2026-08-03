import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LegalReviewDto {
  @ApiProperty({ example: 1, description: 'ID of the Proposal', required: false })
  @IsNumber()
  @IsOptional()
  proposalId?: number;

  @ApiProperty({ example: 1, description: 'ID or Number of the Contract', required: false })
  @IsOptional()
  contractId?: any;

  @ApiProperty({ example: 'APPROVED', enum: ['DRAFT', 'ON_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'] })
  @IsString()
  @IsNotEmpty()
  legalStatus: string;

  @ApiProperty({ example: 'All clauses look good.', required: false })
  @IsString()
  @IsOptional()
  legalNotes?: string;
}
