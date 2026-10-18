import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CancelServiceClaimDto {
  @ApiPropertyOptional({
    description: "Reason for cancellation",
    example: "Dibatalkan karena revisi scope pekerjaan",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
