import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DecideManagementReviewDto,
  MANAGEMENT_DECISIONS,
  ManagementDecision,
} from './dto/decide-management-review.dto';

export interface ValidatedManagementDecision {
  decision: ManagementDecision;
  revisionNotes: string | null;
}

@Injectable()
export class ManagementReviewValidator {
  /**
   * Validates management review decision and enforces revision note requirements.
   */
  public validateDecision(dto: DecideManagementReviewDto): ValidatedManagementDecision {
    if (!dto) {
      throw new BadRequestException('Payload keputusan review tidak boleh kosong');
    }

    if (!dto.decision || !MANAGEMENT_DECISIONS.includes(dto.decision)) {
      throw new BadRequestException(
        `Keputusan review tidak valid. Pilihan: ${MANAGEMENT_DECISIONS.join(', ')}`,
      );
    }

    const trimmedNotes = dto.revisionNotes ? dto.revisionNotes.trim() : null;

    if (dto.decision === 'NEEDS_REVISION') {
      if (!trimmedNotes || trimmedNotes.length < 10) {
        throw new BadRequestException(
          'Catatan revisi wajib diisi minimal 10 karakter ketika meminta perbaikan (NEEDS_REVISION)',
        );
      }
      if (trimmedNotes.length > 2000) {
        throw new BadRequestException('Catatan revisi maksimal 2000 karakter');
      }
    } else {
      // READY_FOR_PROCUREMENT
      if (trimmedNotes && trimmedNotes.length > 2000) {
        throw new BadRequestException('Catatan persetujuan maksimal 2000 karakter');
      }
    }

    return {
      decision: dto.decision,
      revisionNotes: trimmedNotes || null,
    };
  }
}
