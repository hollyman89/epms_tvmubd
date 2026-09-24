import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SaveInitialConditionDto,
  CONDITION_STATUSES,
  ConditionStatus,
} from './dto/save-initial-condition.dto';

export interface ValidatedInitialCondition {
  conditionStatus: ConditionStatus;
  locationCondition: string;
  existingInfrastructure: string | null;
  accessLogistics: string | null;
  initialConstraints: string;
  initialRisks: string;
  pmRecommendation: string | null;
}

@Injectable()
export class InitialConditionValidator {
  /**
   * Validates and sanitizes Initial Condition baseline payload authoritatively.
   */
  public validateAndSanitize(dto: SaveInitialConditionDto): ValidatedInitialCondition {
    if (!dto) {
      throw new BadRequestException('Data kondisi awal proyek tidak boleh kosong');
    }

    // 1. Condition Status
    if (!dto.conditionStatus || !CONDITION_STATUSES.includes(dto.conditionStatus)) {
      throw new BadRequestException(
        `Status kondisi proyek tidak valid. Pilihan: ${CONDITION_STATUSES.join(', ')}`,
      );
    }

    // 2. Location Condition
    const locationCondition = (dto.locationCondition || '').trim();
    if (!locationCondition) {
      throw new BadRequestException('Kondisi fisik lokasi wajib diisi dan tidak boleh hanya spasi');
    }

    // 3. Initial Constraints
    const initialConstraints = (dto.initialConstraints || '').trim();
    if (!initialConstraints) {
      throw new BadRequestException('Kendala awal proyek wajib diisi dan tidak boleh hanya spasi');
    }

    // 4. Initial Risks
    const initialRisks = (dto.initialRisks || '').trim();
    if (!initialRisks) {
      throw new BadRequestException('Risiko awal proyek wajib diisi dan tidak boleh hanya spasi');
    }

    // 5. Optional fields
    const existingInfrastructure = dto.existingInfrastructure
      ? dto.existingInfrastructure.trim() || null
      : null;
    const accessLogistics = dto.accessLogistics
      ? dto.accessLogistics.trim() || null
      : null;
    const pmRecommendation = dto.pmRecommendation
      ? dto.pmRecommendation.trim() || null
      : null;

    return {
      conditionStatus: dto.conditionStatus,
      locationCondition,
      existingInfrastructure,
      accessLogistics,
      initialConstraints,
      initialRisks,
      pmRecommendation,
    };
  }
}
