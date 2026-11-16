import { IsNotEmpty, IsOptional, IsNumber, IsString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemTaxCategory, NonWithholdingReason } from '../../../entities/invoice-item-tax-detail.entity';

export class DetermineLineTaxDto {
  @IsNotEmpty()
  @IsNumber()
  invoiceItemId: number;

  @IsNotEmpty()
  @IsEnum(ItemTaxCategory)
  itemTaxCategory: ItemTaxCategory;

  @IsOptional()
  @IsNumber()
  pphTaxRegimeRuleId?: number | null;

  @IsOptional()
  @IsEnum(NonWithholdingReason)
  nonWithholdingReason?: NonWithholdingReason | null;

  @IsNotEmpty()
  @IsNumber()
  lineDpp: number;

  @IsOptional()
  @IsNumber()
  linePpnRate?: number;

  @IsOptional()
  @IsNumber()
  linePphRate?: number;
}

export class DetermineInvoiceTaxDto {
  @IsNotEmpty()
  @IsNumber()
  invoiceId: number;

  @IsNotEmpty()
  @IsString()
  companyCode: string; // 'UBD' | 'TVM'

  @IsOptional()
  @IsNumber()
  taxRegimePpnId?: number | null;

  @IsOptional()
  @IsNumber()
  primaryPphRegimeId?: number | null;

  @IsOptional()
  @IsNumber()
  priorDeductionsAmount?: number;

  @IsOptional()
  @IsNumber()
  wapuPpnWithheldAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetermineLineTaxDto)
  lineItems?: DetermineLineTaxDto[];
}

