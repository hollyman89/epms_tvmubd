import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export type CostCategoryKey =
  | 'MATERIAL'
  | 'LABOR'
  | 'SUBCONTRACTOR'
  | 'EQUIPMENT'
  | 'PERMIT'
  | 'OPERATIONAL'
  | 'CONTINGENCY';

export type CostGroupKey = 'DIRECT' | 'INDIRECT' | 'RISK';
export type CostEntryMode = 'DIRECT' | 'ITEMIZED';
export type CostAssignmentScope = 'WBS' | 'PROJECT' | 'UNASSIGNED';
export type CostResourceType =
  | 'MATERIAL'
  | 'LABOR'
  | 'EQUIPMENT'
  | 'SERVICE'
  | 'SUBCONTRACTOR'
  | 'ALLOWANCE';
export type CostSource =
  | 'PM_ESTIMATE'
  | 'PROCUREMENT_REFERENCE'
  | 'HISTORICAL_PRICE'
  | 'VENDOR_QUOTE'
  | 'CONTRACT_SCHEDULE_RATE';
export type CostRateType = 'UNIT_RATE' | 'TIME_BASED' | 'LUMP_SUM';

export const ALLOWED_CATEGORIES: CostCategoryKey[] = [
  'MATERIAL',
  'LABOR',
  'SUBCONTRACTOR',
  'EQUIPMENT',
  'PERMIT',
  'OPERATIONAL',
  'CONTINGENCY',
];

export const ALLOWED_GROUPS: CostGroupKey[] = ['DIRECT', 'INDIRECT', 'RISK'];
export const ALLOWED_MODES: CostEntryMode[] = ['DIRECT', 'ITEMIZED'];
export const ALLOWED_SCOPES: CostAssignmentScope[] = ['WBS', 'PROJECT', 'UNASSIGNED'];
export const ALLOWED_RESOURCE_TYPES: CostResourceType[] = [
  'MATERIAL',
  'LABOR',
  'EQUIPMENT',
  'SERVICE',
  'SUBCONTRACTOR',
  'ALLOWANCE',
];
export const ALLOWED_COST_SOURCES: CostSource[] = [
  'PM_ESTIMATE',
  'PROCUREMENT_REFERENCE',
  'HISTORICAL_PRICE',
  'VENDOR_QUOTE',
  'CONTRACT_SCHEDULE_RATE',
];
export const ALLOWED_RATE_TYPES: CostRateType[] = ['UNIT_RATE', 'TIME_BASED', 'LUMP_SUM'];

export class CostItemDto {
  @ApiProperty({ example: 101, required: false, description: 'Persistent database ID for existing items (absent for new items)' })
  @IsNumber({}, { message: 'Item ID harus berupa angka yang valid' })
  @Min(1)
  @IsOptional()
  id?: number;

  @ApiProperty({ example: 'Kabel Fiber Optic 48 Core', description: 'Item name / title' })
  @IsString({ message: 'Nama item biaya harus berupa teks' })
  @IsNotEmpty({ message: 'Nama item biaya tidak boleh kosong' })
  itemName: string;

  @ApiProperty({ example: 'Spesifikasi Telkom standard single-mode', required: false })
  @IsString({ message: 'Deskripsi item biaya harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi item biaya maksimal 500 karakter' })
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 10.0, default: 1.0, description: 'Resource quantity / volume' })
  @IsNumber({}, { message: 'Quantity harus berupa angka yang valid' })
  @Min(0, { message: 'Quantity tidak boleh negatif' })
  quantity: number;

  @ApiProperty({ example: 'Km', default: 'Unit', required: false, description: 'Unit of measurement' })
  @IsString({ message: 'UOM harus berupa teks' })
  @IsOptional()
  uom?: string;

  @ApiProperty({ example: 'UNIT_RATE', enum: ALLOWED_RATE_TYPES, required: false })
  @IsString()
  @IsIn(ALLOWED_RATE_TYPES, { message: `rateType harus salah satu dari: ${ALLOWED_RATE_TYPES.join(', ')}` })
  @IsOptional()
  rateType?: CostRateType;

  @ApiProperty({ example: 25000000.0, default: 0.0, description: 'Unit price in IDR' })
  @IsNumber({}, { message: 'Unit price harus berupa angka yang valid' })
  @Min(0, { message: 'Unit price tidak boleh negatif' })
  unitPrice: number;

  @ApiProperty({ example: 250000000.0, required: false, description: 'Client subtotal (ignored by server; recomputed as quantity * unitPrice)' })
  @IsNumber({}, { message: 'Subtotal harus berupa angka yang valid' })
  @IsOptional()
  subtotal?: number;

  @ApiProperty({ example: 'MATERIAL', enum: ALLOWED_RESOURCE_TYPES, required: false })
  @IsString()
  @IsIn(ALLOWED_RESOURCE_TYPES, { message: `resourceType harus salah satu dari: ${ALLOWED_RESOURCE_TYPES.join(', ')}` })
  @IsOptional()
  resourceType?: CostResourceType;

  @ApiProperty({ example: 'VENDOR_QUOTE', enum: ALLOWED_COST_SOURCES, required: false })
  @IsString()
  @IsIn(ALLOWED_COST_SOURCES, { message: `costSource harus salah satu dari: ${ALLOWED_COST_SOURCES.join(', ')}` })
  @IsOptional()
  costSource?: CostSource;

  @ApiProperty({ example: 'WBS', enum: ALLOWED_SCOPES, description: 'Scope assignment: WBS, PROJECT, or UNASSIGNED' })
  @IsString()
  @IsIn(ALLOWED_SCOPES, { message: `assignmentScope harus salah satu dari: ${ALLOWED_SCOPES.join(', ')}` })
  assignmentScope: CostAssignmentScope;

  @ApiProperty({ example: 113, required: false, description: 'WBS leaf node database ID (required if scope=WBS; null otherwise)' })
  @IsNumber({}, { message: 'wbsId harus berupa angka yang valid' })
  @Min(1, { message: 'wbsId harus bernilai positif' })
  @IsOptional()
  wbsId?: number | null;

  @ApiProperty({ example: 'Lead time pengiriman 2 minggu', required: false })
  @IsString({ message: 'Catatan biaya harus berupa teks' })
  @IsOptional()
  notes?: string;
}

export class CostCategoryDto {
  @ApiProperty({ example: 'MATERIAL', enum: ALLOWED_CATEGORIES, description: 'Category key' })
  @IsString()
  @IsIn(ALLOWED_CATEGORIES, { message: `categoryKey harus salah satu dari: ${ALLOWED_CATEGORIES.join(', ')}` })
  categoryKey: CostCategoryKey;

  @ApiProperty({ example: 'Material & Consumables', required: false })
  @IsString()
  @IsOptional()
  categoryLabel?: string;

  @ApiProperty({ example: 'DIRECT', enum: ALLOWED_GROUPS, required: false })
  @IsString()
  @IsIn(ALLOWED_GROUPS, { message: `groupKey harus salah satu dari: ${ALLOWED_GROUPS.join(', ')}` })
  @IsOptional()
  groupKey?: CostGroupKey;

  @ApiProperty({ example: 'ITEMIZED', enum: ALLOWED_MODES, description: 'DIRECT or ITEMIZED mode' })
  @IsString()
  @IsIn(ALLOWED_MODES, { message: `mode harus salah satu dari: ${ALLOWED_MODES.join(', ')}` })
  mode: CostEntryMode;

  @ApiProperty({ example: 0, required: false, description: 'Authoritative direct subtotal when mode=DIRECT' })
  @IsNumber({}, { message: 'directSubtotal harus berupa angka yang valid' })
  @Min(0, { message: 'directSubtotal tidak boleh negatif' })
  @IsOptional()
  directSubtotal?: number;

  @ApiProperty({ type: () => [CostItemDto], required: false, description: 'Line items when mode=ITEMIZED' })
  @IsArray({ message: 'items harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => CostItemDto)
  @IsOptional()
  items?: CostItemDto[];
}

export class SaveCostEstimateDto {
  @ApiProperty({ example: 'Estimasi awal kebutuhan material proyek rollout FO', required: false })
  @IsString({ message: 'pmNotes harus berupa teks' })
  @IsOptional()
  pmNotes?: string;

  @ApiProperty({ type: () => [CostCategoryDto], description: 'Array of categorized cost estimates' })
  @IsArray({ message: 'categories harus berupa array' })
  @ArrayMinSize(1, { message: 'Categories tidak boleh kosong' })
  @ValidateNested({ each: true })
  @Type(() => CostCategoryDto)
  categories: CostCategoryDto[];
}
