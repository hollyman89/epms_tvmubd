import { IsString, IsOptional, IsNotEmpty } from "class-validator";
import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";

export class SubmitClosureDto {
  @ApiPropertyOptional({
    description: "Catatan pengajuan penutupan proyek oleh Project Manager",
    example: "Seluruh pekerjaan lapangan dan administrasi telah selesai 100%.",
  })
  @IsString()
  @IsOptional()
  submissionNotes?: string;
}

export class ApproveClosureDto {
  @ApiPropertyOptional({
    description: "Catatan persetujuan penutupan proyek",
    example: "Ditinjau dan disetujui.",
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReturnClosureDto {
  @ApiProperty({
    description:
      "Alasan pengembalian/penolakan siklus penutupan proyek (wajib non-kosong)",
    example:
      "Dokumen pendukung BAST belum ditandatangani lengkap oleh pihak klien.",
  })
  @IsString()
  @IsNotEmpty({ message: "Alasan pengembalian (reason) wajib diisi." })
  reason: string;
}
