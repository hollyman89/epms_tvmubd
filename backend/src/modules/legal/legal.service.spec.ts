import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { LegalService } from './legal.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Tender, TenderStatus } from '../../entities/tender.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { Project } from '../../entities/project.entity';

describe('LegalService - State Machine Transitions & SPK Prerequisite (P0-4E2 / SEC-11-02)', () => {
  let service: LegalService;
  let contractRepoMock: any;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let eventEmitterMock: any;
  let tenderRepoMock: any;

  const createMockContract = (overrides?: Partial<Contract>): Contract => {
    return {
      id: 101,
      contract_number: 'CONT-2026-0001',
      proposal_id: 201,
      tender_id: 301,
      customer_id: 401,
      contract_value: 150000000,
      start_date: new Date('2026-09-01'),
      end_date: new Date('2027-09-01'),
      status: 'PENDING_LEGAL_REVIEW',
      legal_status: LegalStatus.DRAFT,
      legal_reviewer_id: null as any,
      legal_notes: null as any,
      spk_file_url: 'https://s3.ap-southeast-1.amazonaws.com/bucket/spk/CONT-2026-0001.pdf',
      grace_deadline: null as any,
      grace_extension_count: 0,
      grace_extended_by: null as any,
      grace_extended_at: null as any,
      created_by: 1,
      updated_by: 1,
      deleted_by: null as any,
      created_at: new Date('2026-09-01'),
      updated_at: new Date('2026-09-01'),
      deleted_at: null as any,
      version: 1,
      proposal: {
        id: 201,
        tender_id: 301,
        status: 'SUBMITTED',
        created_by: 2,
        tender: {
          id: 301,
          title: 'Pengadaan Server DC 2026',
          stage: 'WON',
          status: TenderStatus.WON,
          spk_verification_status: 'PENDING',
          created_by: 3,
          marketing_pic_id: 4,
        } as Tender,
      } as Proposal,
      customer: null as any,
      legal_reviewer: null as any,
      project_manager_id: 10,
      project_manager: null as any,
      ops_team_activated_at: null as any,
      grace_extended_by_user: null as any,
      amendments: [],
      ...overrides,
    } as Contract;
  };

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn().mockImplementation((entityClass: any, entity: any) => Promise.resolve({ ...entity })),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => ({ ...data })),
        findOne: jest.fn().mockResolvedValue(null),
      },
    };

    contractRepoMock = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    tenderRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      getRepository: jest.fn().mockReturnValue(tenderRepoMock),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalService,
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<LegalService>(LegalService);
  });

  describe('Positive Valid Transitions', () => {
    it('1. DRAFT + PENDING_LEGAL_REVIEW → APPROVED + valid SPK = PASS', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
        spk_file_url: 'https://bucket.s3.amazonaws.com/spk/valid.pdf',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.APPROVED, legalNotes: 'All clauses approved' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.APPROVED);
      expect(result.status).toBe('ACTIVE');
      expect(queryRunnerMock.startTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).toHaveBeenCalledWith(Contract, expect.objectContaining({
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        legal_reviewer_id: 99,
      }));
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('legal.contract.approved', expect.objectContaining({
        contractId: 101,
        legalStatus: LegalStatus.APPROVED,
        status: 'ACTIVE',
      }));
    });

    it('2. ON_REVIEW + PENDING_LEGAL_REVIEW → APPROVED + valid SPK = PASS', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.ON_REVIEW,
        status: 'PENDING_LEGAL_REVIEW',
        spk_file_url: 'https://bucket.s3.amazonaws.com/spk/valid.pdf',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.APPROVED, legalNotes: 'Approved after review' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.APPROVED);
      expect(result.status).toBe('ACTIVE');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('3. DRAFT + PENDING_LEGAL_REVIEW → REJECTED = PASS', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.REJECTED, legalNotes: 'Terms unacceptable' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.REJECTED);
      expect(result.status).toBe('REJECTED');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.manager.save).toHaveBeenCalledWith(Contract, expect.objectContaining({
        legal_status: LegalStatus.REJECTED,
        status: 'REJECTED',
      }));
    });

    it('4. DRAFT + PENDING_LEGAL_REVIEW → REVISION_REQUESTED = PASS', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
        grace_extension_count: 0,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED, legalNotes: 'Fix liability clause' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.REVISION_REQUESTED);
      expect(result.status).toBe('REVISION_NEEDED');
      expect(result.grace_extension_count).toBe(1);
      expect(result.grace_deadline).toBeDefined();
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('contract.revision_requested', expect.objectContaining({
        contractId: 101,
        legalStatus: LegalStatus.REVISION_REQUESTED,
      }));
    });

    it('5. ON_REVIEW + PENDING_LEGAL_REVIEW → REJECTED = PASS', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.ON_REVIEW,
        status: 'PENDING_LEGAL_REVIEW',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.REJECTED, legalNotes: 'Rejected on final review' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.REJECTED);
      expect(result.status).toBe('REJECTED');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('6. ON_REVIEW + PENDING_LEGAL_REVIEW → REVISION_REQUESTED = PASS', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.ON_REVIEW,
        status: 'PENDING_LEGAL_REVIEW',
        grace_extension_count: 1,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED, legalNotes: 'Revise payment terms' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.REVISION_REQUESTED);
      expect(result.status).toBe('REVISION_NEEDED');
      expect(result.grace_extension_count).toBe(2);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Negative Tests: Terminal State Protection', () => {
    it('7. REJECTED → APPROVED = 400 rejected before transaction & mutation', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.REJECTED,
        status: 'REJECTED',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new BadRequestException('Kontrak sudah berstatus REJECTED dan tidak dapat ditinjau ulang'));

      // Assertion: rejection occurred BEFORE transaction/mutation
      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.REJECTED);
      expect(contract.status).toBe('REJECTED');
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });

    it('8. REJECTED → REVISION_REQUESTED = rejected before transaction & mutation', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.REJECTED,
        status: 'REJECTED',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED }, 99),
      ).rejects.toThrow(new BadRequestException('Kontrak sudah berstatus REJECTED dan tidak dapat ditinjau ulang'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.REJECTED);
    });

    it('9. APPROVED → REJECTED = rejected before transaction & mutation', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REJECTED }, 99),
      ).rejects.toThrow(new BadRequestException('Kontrak sudah berstatus APPROVED dan tidak dapat ditinjau ulang'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.APPROVED);
      expect(contract.status).toBe('ACTIVE');
    });

    it('10. APPROVED → REVISION_REQUESTED = rejected before transaction & mutation', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED }, 99),
      ).rejects.toThrow(new BadRequestException('Kontrak sudah berstatus APPROVED dan tidak dapat ditinjau ulang'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('11. APPROVED → APPROVED = rejected before transaction & mutation', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new BadRequestException('Kontrak sudah berstatus APPROVED dan tidak dapat ditinjau ulang'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('Extra: REJECTED → REJECTED = rejected before transaction & mutation', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.REJECTED,
        status: 'REJECTED',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REJECTED }, 99),
      ).rejects.toThrow(new BadRequestException('Kontrak sudah berstatus REJECTED dan tidak dapat ditinjau ulang'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });
  });

  describe('Negative Tests: Revision State Protection', () => {
    it('12. REVISION state → APPROVED without formal resubmission = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.REVISION_REQUESTED,
        status: 'REVISION_NEEDED',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new BadRequestException('Dokumen revisi belum diperbarui oleh Marketing'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.REVISION_REQUESTED);
      expect(contract.status).toBe('REVISION_NEEDED');
    });

    it('Extra: REVISION state → REJECTED without formal resubmission = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.REVISION_REQUESTED,
        status: 'REVISION_NEEDED',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REJECTED }, 99),
      ).rejects.toThrow(new BadRequestException('Dokumen revisi belum diperbarui oleh Marketing'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Negative Tests: SPK Prerequisite for Approval', () => {
    it('13. APPROVED with missing (null/undefined) spk_file_url = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
        spk_file_url: null as any,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new BadRequestException('Dokumen SPK wajib diunggah sebelum kontrak dapat disetujui (APPROVED)'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.DRAFT);
      expect(contract.status).toBe('PENDING_LEGAL_REVIEW');
    });

    it('14. APPROVED with empty string spk_file_url = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
        spk_file_url: '',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new BadRequestException('Dokumen SPK wajib diunggah sebelum kontrak dapat disetujui (APPROVED)'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('15. APPROVED with whitespace-only spk_file_url = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
        spk_file_url: '     ',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new BadRequestException('Dokumen SPK wajib diunggah sebelum kontrak dapat disetujui (APPROVED)'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });
  });

  describe('SoD Enforcement: Self-Approval / Self-Review Prevention (SEC-11-03)', () => {
    it('1. Contract creator attempts APPROVED → 403 ForbiddenException', async () => {
      const contract = createMockContract({
        created_by: 99, // reviewer is contract creator
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(
        new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.'),
      );

      // Verify no mutation or transaction
      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.DRAFT);
      expect(contract.status).toBe('PENDING_LEGAL_REVIEW');
    });

    it('2. Contract creator attempts REJECTED → 403 ForbiddenException', async () => {
      const contract = createMockContract({
        created_by: 99,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REJECTED }, 99),
      ).rejects.toThrow(
        new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.'),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('3. Contract creator attempts REVISION_REQUESTED → 403 ForbiddenException', async () => {
      const contract = createMockContract({
        created_by: 99,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED }, 99),
      ).rejects.toThrow(
        new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.'),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('4. Proposal creator attempts APPROVED → 403 ForbiddenException', async () => {
      const contract = createMockContract({
        created_by: 1,
        proposal: {
          id: 201,
          tender_id: 301,
          status: 'SUBMITTED',
          created_by: 99, // reviewer is proposal creator
          tender: {
            id: 301,
            title: 'Pengadaan Server DC 2026',
            stage: 'WON',
            status: TenderStatus.WON,
            spk_verification_status: 'PENDING',
            created_by: 3,
            marketing_pic_id: 4,
          } as Tender,
        } as Proposal,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(
        new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.'),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('5. Tender creator attempts APPROVED → 403 ForbiddenException', async () => {
      const contract = createMockContract({
        created_by: 1,
        proposal: {
          id: 201,
          tender_id: 301,
          status: 'SUBMITTED',
          created_by: 2,
          tender: {
            id: 301,
            title: 'Pengadaan Server DC 2026',
            stage: 'WON',
            status: TenderStatus.WON,
            spk_verification_status: 'PENDING',
            created_by: 99, // reviewer is tender creator
            marketing_pic_id: 4,
          } as Tender,
        } as Proposal,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(
        new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.'),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('6. Marketing PIC attempts APPROVED → 403 ForbiddenException', async () => {
      const contract = createMockContract({
        created_by: 1,
        proposal: {
          id: 201,
          tender_id: 301,
          status: 'SUBMITTED',
          created_by: 2,
          tender: {
            id: 301,
            title: 'Pengadaan Server DC 2026',
            stage: 'WON',
            status: TenderStatus.WON,
            spk_verification_status: 'PENDING',
            created_by: 3,
            marketing_pic_id: 99, // reviewer is marketing PIC
          } as Tender,
        } as Proposal,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(
        new ForbiddenException('Anda tidak dapat melakukan review atas kontrak yang Anda buat atau tangani sendiri.'),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('7. Different legitimate Legal reviewer → existing behavior PASS', async () => {
      const contract = createMockContract({
        created_by: 1,
        proposal: {
          id: 201,
          tender_id: 301,
          status: 'SUBMITTED',
          created_by: 2,
          tender: {
            id: 301,
            title: 'Pengadaan Server DC 2026',
            stage: 'WON',
            status: TenderStatus.WON,
            spk_verification_status: 'PENDING',
            created_by: 3,
            marketing_pic_id: 4,
          } as Tender,
        } as Proposal,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      // Reviewer is 99 (different from 1, 2, 3, 4)
      const result = await service.reviewContract(
        { contractId: 101, legalStatus: LegalStatus.APPROVED, legalNotes: 'Legitimate review' },
        99,
      );

      expect(result.legal_status).toBe(LegalStatus.APPROVED);
      expect(result.status).toBe('ACTIVE');
      expect(queryRunnerMock.startTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('8. Verify rejected SoD request does NOT mutate contract, proposal, tender, nor create AuditLog/OutboxEvent', async () => {
      const contract = createMockContract({
        created_by: 99,
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(ForbiddenException);

      // Zero transaction, zero save, zero audit, zero outbox, zero emit
      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.create).not.toHaveBeenCalled();
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
      expect(contract.legal_status).toBe(LegalStatus.DRAFT);
      expect(contract.status).toBe('PENDING_LEGAL_REVIEW');
      expect(contract.proposal.status).toBe('SUBMITTED');
      expect(contract.proposal.tender.stage).toBe('WON');
      expect(contract.proposal.tender.spk_verification_status).toBe('PENDING');
    });
  });

  describe('Negative Tests: Entry State Enforcement & Other Guards', () => {
    it('16. Non-review contract status (e.g. DRAFT) = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'DRAFT', // Not yet PENDING_LEGAL_REVIEW
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(
        new BadRequestException("Kontrak dengan status 'DRAFT' dan status legal 'DRAFT' tidak memenuhi syarat untuk Legal Review"),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
    });

    it('17. Invalid requested decision status (e.g. DRAFT or UNKNOWN) = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: 'INVALID_STATUS' as any }, 99),
      ).rejects.toThrow(new BadRequestException('Status review legal tidak valid: INVALID_STATUS'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
    });

    it('18. REVISION_REQUESTED beyond max limit (>= 3) = rejected', async () => {
      const contract = createMockContract({
        legal_status: LegalStatus.DRAFT,
        status: 'PENDING_LEGAL_REVIEW',
        grace_extension_count: 3,
      });
      contractRepoMock.findOne.mockResolvedValue(contract);

      await expect(
        service.reviewContract({ contractId: 101, legalStatus: LegalStatus.REVISION_REQUESTED }, 99),
      ).rejects.toThrow(
        new BadRequestException(
          'Batas Maksimal Perpanjangan Grace SLA (3x) telah tercapai untuk Kontrak #101! Tidak dapat meminta revisi lagi.',
        ),
      );

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.manager.save).not.toHaveBeenCalled();
    });

    it('19. Contract not found = throws NotFoundException', async () => {
      contractRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.reviewContract({ contractId: 99999, legalStatus: LegalStatus.APPROVED }, 99),
      ).rejects.toThrow(new NotFoundException('Contract not found for provided ID/Proposal ID'));

      expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
    });
  });
});

describe('LegalService - Start Project Validation (P0-4E4 / SEC-11-06)', () => {
  let service: LegalService;
  let contractRepoMock: any;
  let dataSourceMock: any;
  let queryRunnerMock: any;
  let eventEmitterMock: any;

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((entityClass: any, data: any) => ({ ...data, id: 999 })),
        save: jest.fn().mockImplementation((entityClass: any, entity: any) => Promise.resolve({ ...entity, id: entity.id || 999 })),
      },
    };

    contractRepoMock = {
      findOne: jest.fn(),
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      getRepository: jest.fn(),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalService,
        { provide: getRepositoryToken(Contract), useValue: contractRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<LegalService>(LegalService);
  });

  it('1. should throw NotFoundException if tender does not exist', async () => {
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return null;
      return null;
    });

    await expect(service.startProject({ tenderId: 1001 }, 50)).rejects.toThrow(
      new NotFoundException('Tender #1001 tidak ditemukan.'),
    );

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  it('2. should throw BadRequestException if tender is not in WON status/stage', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'LEAD',
      status: TenderStatus.NEW,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      return null;
    });

    await expect(service.startProject({ tenderId: 1001 }, 50)).rejects.toThrow(
      new BadRequestException(
        'Tender #1001 belum berstatus WON (stage: LEAD, status: NEW). Proyek tidak dapat diinisiasi.',
      ),
    );

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  it('3. should throw BadRequestException if contract for tender does not exist', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return null;
      if (entityClass === Proposal) return null;
      return null;
    });

    await expect(service.startProject({ tenderId: 1001 }, 50)).rejects.toThrow(
      new BadRequestException('Kontrak untuk Tender #1001 tidak ditemukan. Proyek tidak dapat diinisiasi.'),
    );

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  it('4. should throw BadRequestException if contract is not APPROVED', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      tender_id: 1001,
      legal_status: LegalStatus.DRAFT,
      status: 'ACTIVE',
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      return null;
    });

    await expect(service.startProject({ tenderId: 1001 }, 50)).rejects.toThrow(
      new BadRequestException(
        'Kontrak terkait #501 belum berstatus APPROVED dan ACTIVE (legal_status: DRAFT, status: ACTIVE). Proyek tidak dapat diinisiasi.',
      ),
    );

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  it('5. should throw BadRequestException if contract is APPROVED but not ACTIVE', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      tender_id: 1001,
      legal_status: LegalStatus.APPROVED,
      status: 'PENDING_LEGAL_REVIEW',
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      return null;
    });

    await expect(service.startProject({ tenderId: 1001 }, 50)).rejects.toThrow(
      new BadRequestException(
        'Kontrak terkait #501 belum berstatus APPROVED dan ACTIVE (legal_status: APPROVED, status: PENDING_LEGAL_REVIEW). Proyek tidak dapat diinisiasi.',
      ),
    );

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
  });

  it('Case A: startProject() without PM assignment -> no fake PM, no manager assignment, queue remains PENDING_KICKOFF', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      tender_id: 1001,
      contract_number: 'CONT-2026-1001',
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: null,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      if (entityClass === Project) return null;
      return null;
    });

    const result = await service.startProject({ tenderId: 1001 }, 10);

    // Expected:
    // 1. no fake PM & project remains unassigned/not created
    expect(result.project).toBeNull();
    expect(queryRunnerMock.manager.create).not.toHaveBeenCalledWith(Project, expect.anything());

    // 2. no manager assignment on contract
    expect(result.contract.project_manager_id).toBeNull();

    // 3. queue remains PENDING_KICKOFF in PMO queue audit log
    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(AuditLog, {
      table_name: 'contracts',
      record_id: 501,
      action: 'CONTRACT_RELEASED_TO_PMO_QUEUE',
      old_value: null,
      new_value: {
        contract_id: 501,
        contract_number: 'CONT-2026-1001',
        tender_id: 1001,
        legal_status: LegalStatus.APPROVED,
        status: 'ACTIVE',
        project_code: 'CONT-2026-1001',
        pmo_queue: 'PENDING_KICKOFF',
      },
      created_by: 10,
    });
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
  });

  it('Case B: startProject() with dto.managerId on unassigned contract -> dto.managerId ignored, project remains unassigned / not created', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      tender_id: 1001,
      contract_number: 'CONT-2026-1001',
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: null,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      if (entityClass === Project) return null;
      return null;
    });

    // Caller attempts to supply dto.managerId
    const result = await service.startProject({ tenderId: 1001, managerId: 88 }, 10);

    // Expected:
    // 1. dto.managerId TIDAK membuat PM ownership
    // 2. project remains unassigned / not created
    expect(result.project).toBeNull();
    expect(queryRunnerMock.manager.create).not.toHaveBeenCalledWith(Project, expect.anything());
    expect(result.contract.project_manager_id).toBeNull();
    expect(result.contract.project_manager_id).not.toBe(88);

    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(AuditLog, expect.objectContaining({
      action: 'CONTRACT_RELEASED_TO_PMO_QUEUE',
      new_value: expect.objectContaining({
        pmo_queue: 'PENDING_KICKOFF',
      }),
    }));
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('Case C: Authenticated Admin calls Legal Release -> Admin does not become PM (projects.manager_id !== adminId && contracts.project_manager_id !== adminId)', async () => {
    const adminId = 1;
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      tender_id: 1001,
      contract_number: 'CONT-2026-1001',
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: null,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      if (entityClass === Project) return null;
      return null;
    });

    const result = await service.startProject({ tenderId: 1001 }, adminId);

    // Expected:
    // 1. Admin tidak menjadi PM
    expect(result.project).toBeNull();
    expect(result.contract.project_manager_id).not.toBe(adminId);
    expect(result.contract.project_manager_id).toBeNull();

    // 2. No project created with adminId
    expect(queryRunnerMock.manager.create).not.toHaveBeenCalledWith(Project, expect.objectContaining({
      managerId: adminId,
    }));

    // 3. Admin is only recorded as audit creator of PMO queue release
    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(AuditLog, expect.objectContaining({
      table_name: 'contracts',
      record_id: 501,
      action: 'CONTRACT_RELEASED_TO_PMO_QUEUE',
      created_by: adminId,
    }));
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('Case D: Existing legitimate PM assignment -> existing assignment preserved, never overwrite with caller', async () => {
    const adminCallerId = 1;
    const legitimatePmId = 50;
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      tender_id: 1001,
      contract_number: 'CONT-2026-1001',
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: legitimatePmId, // legitimate pre-existing assignment
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      if (entityClass === Project) return null;
      return null;
    });

    const result = await service.startProject({ tenderId: 1001, managerId: 99 }, adminCallerId);

    // Expected:
    // 1. existing assignment preserved
    expect(result.project).toBeDefined();
    expect(result.project.managerId).toBe(legitimatePmId);
    // 2. jangan overwrite dengan caller
    expect(result.project.managerId).not.toBe(adminCallerId);
    expect(result.project.managerId).not.toBe(99); // dto.managerId ignored
    expect(result.contract.project_manager_id).toBe(legitimatePmId);
    expect(result.contract.project_manager_id).not.toBe(adminCallerId);

    // 3. Status PLANNING
    expect(result.project.status).toBe('PLANNING');
    expect(result.project.code).toBe('CONT-2026-1001');

    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(Project, {
      code: 'CONT-2026-1001',
      name: 'Tender ERP 2026',
      status: 'PLANNING',
      managerId: legitimatePmId,
      contractId: 501,
    });
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('7. should find contract via Proposal fallback if contract.tender_id is null', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockProposal = {
      id: 701,
      tender_id: 1001,
    };
    const mockContract = {
      id: 502,
      contract_number: 'CONT-2026-1002',
      proposal_id: 701,
      tender_id: null,
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
      project_manager_id: 50,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any, criteria: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract && criteria?.where?.tender_id) return null;
      if (entityClass === Proposal && criteria?.where?.tender_id) return mockProposal;
      if (entityClass === Contract && criteria?.where?.proposal_id === 701) return mockContract;
      if (entityClass === Project) return null;
      return null;
    });

    const result = await service.startProject({ tenderId: 1001 }, 50);

    expect(result.project).toBeDefined();
    expect(result.project.code).toBe('CONT-2026-1002');
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('project.started', expect.objectContaining({
      projectId: 999,
      tenderId: 1001,
    }));
  });

  it('8. should reuse existing project without re-creating if already initiated', async () => {
    const mockTender = {
      id: 1001,
      title: 'Tender ERP 2026',
      stage: 'WON',
      status: TenderStatus.WON,
    };
    const mockContract = {
      id: 501,
      contract_number: 'CONT-2026-1001',
      tender_id: 1001,
      legal_status: LegalStatus.APPROVED,
      status: 'ACTIVE',
    };
    const existingProject = {
      id: 888,
      code: 'CONT-2026-1001',
      name: 'Tender ERP 2026',
      status: 'PLANNING',
      managerId: 50,
    };
    queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any) => {
      if (entityClass === Tender) return mockTender;
      if (entityClass === Contract) return mockContract;
      if (entityClass === Project) return existingProject;
      return null;
    });

    const result = await service.startProject({ tenderId: 1001 }, 50);

    expect(result.project).toBeDefined();
    expect(result.project.id).toBe(888);
    expect(queryRunnerMock.manager.create).not.toHaveBeenCalledWith(Project, expect.anything());
    expect(queryRunnerMock.manager.create).toHaveBeenCalledWith(AuditLog, expect.objectContaining({
      action: 'PROJECT_INITIATED',
      record_id: 888,
    }));
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
  });
});

