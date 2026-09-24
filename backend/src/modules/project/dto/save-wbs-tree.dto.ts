import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WbsNodeDto {
  @ApiProperty({ example: 101, required: false, description: 'Persistent database ID for existing nodes (absent for new nodes)' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  id?: number;

  @ApiProperty({ example: '1.0', description: 'WBS code identifier' })
  @IsString()
  @IsNotEmpty({ message: 'Kode WBS tidak boleh kosong' })
  code: string;

  @ApiProperty({ example: 'Persiapan, Survey & Perizinan', description: 'WBS item title' })
  @IsString()
  @IsNotEmpty({ message: 'Nama WBS tidak boleh kosong' })
  name: string;

  @ApiProperty({ example: 1, required: false, description: 'Hierarchy level (1=Work Package, 2=Sub Package, 3=Deliverable)' })
  @IsNumber()
  @Min(1)
  @Max(3)
  @IsOptional()
  level?: number;

  @ApiProperty({ example: 15.0, required: false, description: 'Weight percentage (0-100)' })
  @IsNumber()
  @Min(0, { message: 'Bobot WBS tidak boleh negatif' })
  @Max(100, { message: 'Bobot WBS tidak boleh melebihi 100%' })
  @IsOptional()
  weightPercentage?: number;

  @ApiProperty({ example: 'Site survey, koordinasi perizinan instansi & K3 operasional', required: false })
  @IsString()
  @MaxLength(500, { message: 'Deskripsi WBS maksimal 500 karakter' })
  @IsOptional()
  description?: string;

  @ApiProperty({ type: () => [WbsNodeDto], required: false, description: 'Nested child WBS nodes' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WbsNodeDto)
  @IsOptional()
  children?: WbsNodeDto[];
}

export class SaveWbsTreeDto {
  @ApiProperty({ type: () => [WbsNodeDto], description: 'Hierarchical array of root Work Packages' })
  @IsArray({ message: 'Payload WBS nodes harus berupa array' })
  @ArrayMinSize(1, { message: 'Struktur WBS tidak boleh kosong. Minimal memiliki 1 Work Package.' })
  @ValidateNested({ each: true })
  @Type(() => WbsNodeDto)
  nodes: WbsNodeDto[];
}
