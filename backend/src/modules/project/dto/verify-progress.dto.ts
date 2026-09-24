import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class VerifyProgressDto {
  @IsNotEmpty({ message: 'Keputusan verifikasi (decision) wajib diisi' })
  @IsString()
  @IsIn(['APPROVE', 'REJECT'], { message: 'Keputusan harus berupa APPROVE atau REJECT' })
  decision: 'APPROVE' | 'REJECT';

  @ValidateIf((o) => o.decision === 'REJECT')
  @IsNotEmpty({ message: 'Alasan penolakan (rejectionReason) wajib diisi saat keputusan adalah REJECT' })
  @IsString()
  rejectionReason?: string;
}
