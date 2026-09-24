import { IsNumber, IsInt, Min, Max, IsString, IsNotEmpty, IsArray, IsOptional, IsIn } from 'class-validator';

export class ProgressClaimDto {
  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(100)
  reportedProgress: number;

  /**
   * Critical event type, required for critical claims.
   * Must be one of the approved categories if provided.
   */
  @IsOptional()
  @IsString()
  @IsIn(['FAT_PASSED', 'SAT_PASSED', 'BAST_SUBMITTED', 'COMMISSIONING'])
  eventType?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  documentIds?: number[];
}
