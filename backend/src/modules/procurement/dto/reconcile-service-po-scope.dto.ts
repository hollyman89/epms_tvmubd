import { IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ReconcileServicePoScopeDto {
  @ApiProperty({
    description:
      "Mandatory business reason for decommitting remaining service scope under this Purchase Order",
    example:
      "Pekerjaan telah selesai seluruhnya di lapangan. Sisa nilai kontrak jasa tidak lagi diperlukan dan dilepaskan secara komersial.",
  })
  @IsNotEmpty({
    message: "Alasan rekonsiliasi dan pelepasan sisa komitmen wajib diisi.",
  })
  @IsString()
  @MinLength(5, { message: "Alasan rekonsiliasi minimal 5 karakter." })
  reason: string;
}
