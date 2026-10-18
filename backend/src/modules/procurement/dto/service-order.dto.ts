import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ServiceOrderDocumentType } from "../../../entities/service-order.entity";

export class CreateServiceOrderDto {
  @ApiProperty({ example: 2, description: "Target SERVICE Purchase Order ID" })
  @IsNumber({}, { message: "purchaseOrderId harus berupa angka yang valid" })
  @IsNotEmpty({ message: "purchaseOrderId wajib diisi" })
  purchaseOrderId: number;

  @ApiProperty({
    example: "SPK",
    enum: ServiceOrderDocumentType,
    description: "SPK or WORK_ORDER",
  })
  @IsEnum(ServiceOrderDocumentType, {
    message: "documentType harus berupa SPK atau WORK_ORDER",
  })
  @IsNotEmpty({ message: "documentType wajib diisi" })
  documentType: ServiceOrderDocumentType;

  @ApiProperty({
    example:
      "Pekerjaan penarikan dan splicing kabel FO 48 core ruas Karawang - Klari",
    description: "Detailed scope of work instruction",
  })
  @IsString({ message: "scopeOfWork harus berupa teks" })
  @IsNotEmpty({ message: "scopeOfWork tidak boleh kosong" })
  scopeOfWork: string;

  @ApiProperty({
    example: "Ruas Jalan Karawang - Klari, Karawang Timur",
    required: false,
  })
  @IsString({ message: "workLocation harus berupa teks" })
  @MaxLength(255, { message: "workLocation maksimal 255 karakter" })
  @IsOptional()
  workLocation?: string;

  @ApiProperty({ example: "2026-10-15", required: false })
  @IsString({
    message: "startDate harus berupa teks format tanggal (YYYY-MM-DD)",
  })
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: "2026-11-15", required: false })
  @IsString({
    message: "endDate harus berupa teks format tanggal (YYYY-MM-DD)",
  })
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    example: "Mengikuti SOP K3 Telkom dan pengawasan lapangan berkala",
    required: false,
  })
  @IsString({ message: "notes harus berupa teks" })
  @IsOptional()
  notes?: string;
}

export class UpdateServiceOrderDto {
  @ApiProperty({
    example: "SPK",
    enum: ServiceOrderDocumentType,
    required: false,
  })
  @IsEnum(ServiceOrderDocumentType, {
    message: "documentType harus berupa SPK atau WORK_ORDER",
  })
  @IsOptional()
  documentType?: ServiceOrderDocumentType;

  @ApiProperty({
    example: "Pekerjaan penarikan dan splicing kabel FO 48 core revisi",
    required: false,
  })
  @IsString({ message: "scopeOfWork harus berupa teks" })
  @IsOptional()
  scopeOfWork?: string;

  @ApiProperty({ example: "Ruas Jalan Karawang - Klari", required: false })
  @IsString({ message: "workLocation harus berupa teks" })
  @MaxLength(255, { message: "workLocation maksimal 255 karakter" })
  @IsOptional()
  workLocation?: string;

  @ApiProperty({ example: "2026-10-15", required: false })
  @IsString({
    message: "startDate harus berupa teks format tanggal (YYYY-MM-DD)",
  })
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: "2026-11-15", required: false })
  @IsString({
    message: "endDate harus berupa teks format tanggal (YYYY-MM-DD)",
  })
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: "Catatan tambahan pengawasan", required: false })
  @IsString({ message: "notes harus berupa teks" })
  @IsOptional()
  notes?: string;
}

export class CancelServiceOrderDto {
  @ApiProperty({ example: "Dibatalkan karena perubahan ruang lingkup WBS" })
  @IsString({ message: "reason harus berupa teks" })
  @IsNotEmpty({ message: "Alasan pembatalan (reason) wajib diisi" })
  reason: string;
}

export class QueryServiceOrderDto {
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  projectId?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  purchaseOrderId?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  vendorId?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;
}
