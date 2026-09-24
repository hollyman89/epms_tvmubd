import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export type ManagementDecision = 'READY_FOR_PROCUREMENT' | 'NEEDS_REVISION';

export const MANAGEMENT_DECISIONS: ManagementDecision[] = [
  'READY_FOR_PROCUREMENT',
  'NEEDS_REVISION',
];

export class DecideManagementReviewDto {
  @IsNotEmpty({ message: 'Keputusan review wajib dipilih' })
  @IsEnum(MANAGEMENT_DECISIONS, {
    message: 'Keputusan review harus salah satu dari: READY_FOR_PROCUREMENT, NEEDS_REVISION',
  })
  decision: ManagementDecision;

  @IsOptional()
  @IsString({ message: 'Catatan revisi harus berupa teks' })
  @MaxLength(2000, { message: 'Catatan revisi maksimal 2000 karakter' })
  revisionNotes?: string | null;
}
