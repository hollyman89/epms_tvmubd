import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenderDetailResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  customerId: number;

  @ApiPropertyOptional()
  customerName: string | null;

  @ApiProperty()
  projectName: string;

  @ApiPropertyOptional()
  procurementType: string | null;

  @ApiPropertyOptional()
  source: string | null;

  @ApiPropertyOptional()
  stage: string | null;

  @ApiPropertyOptional()
  priority: string | null;

  @ApiPropertyOptional()
  estimatedBudget: string | null;

  @ApiPropertyOptional()
  probabilityPercentage: number | null;

  @ApiPropertyOptional()
  expectedClosingDate: Date | null;

  @ApiPropertyOptional()
  bidSubmissionDeadline: Date | null;

  @ApiPropertyOptional()
  marketingPicId: number | null;

  @ApiPropertyOptional()
  marketingPicName: string | null;

  @ApiPropertyOptional()
  picCustomerName: string | null;

  @ApiPropertyOptional()
  picCustomerPhone: string | null;

  @ApiPropertyOptional()
  projectLocation: string | null;

  @ApiPropertyOptional()
  notes: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  legalStatus?: string | null;

  @ApiPropertyOptional()
  legalNotes?: string | null;
}
