import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export type ConditionStatus = 'NORMAL' | 'PERLU_PERHATIAN' | 'BERISIKO';

export const CONDITION_STATUSES: ConditionStatus[] = [
  'NORMAL',
  'PERLU_PERHATIAN',
  'BERISIKO',
];

export class SaveInitialConditionDto {
  @IsNotEmpty({ message: 'Status kondisi proyek wajib dipilih' })
  @IsEnum(CONDITION_STATUSES, {
    message: 'Status kondisi proyek harus salah satu dari: NORMAL, PERLU_PERHATIAN, BERISIKO',
  })
  conditionStatus: ConditionStatus;

  @IsNotEmpty({ message: 'Kondisi fisik lokasi wajib diisi' })
  @IsString({ message: 'Kondisi lokasi harus berupa teks' })
  locationCondition: string;

  @IsOptional()
  @IsString({ message: 'Infrastruktur eksisting harus berupa teks' })
  existingInfrastructure?: string | null;

  @IsOptional()
  @IsString({ message: 'Akses logistik harus berupa teks' })
  accessLogistics?: string | null;

  @IsNotEmpty({ message: 'Kendala awal proyek wajib diisi' })
  @IsString({ message: 'Kendala awal harus berupa teks' })
  initialConstraints: string;

  @IsNotEmpty({ message: 'Risiko awal proyek wajib diisi' })
  @IsString({ message: 'Risiko awal harus berupa teks' })
  initialRisks: string;

  @IsOptional()
  @IsString({ message: 'Rekomendasi PM harus berupa teks' })
  pmRecommendation?: string | null;
}
