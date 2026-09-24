import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { Customer } from '../../entities/customer.entity';
import { Tender, TenderStatus, TenderStage } from '../../entities/tender.entity';
import { Proposal } from '../../entities/proposal.entity';
import { Contract } from '../../entities/contract.entity';
import { TenderActivity } from '../../entities/tender-activity.entity';
import { TenderPriceHistory } from '../../entities/tender-price-history.entity';
import { User } from '../../entities/user.entity';

describe('MarketingService - Anti-Mock Identity & WON Authorization (P0-2)', () => {
  let service: MarketingService;
  let tenderRepo: jest.Mocked<Repository<Tender>>;
  let userRepoMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    userRepoMock = {
      findOne: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === User) return userRepoMock;
          return {
            findOne: jest.fn(),
            save: jest.fn(),
          };
        }),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn().mockImplementation((entity, data) => data),
      },
    };

    dataSourceMock = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return userRepoMock;
        return {
          findOne: jest.fn(),
          save: jest.fn(),
        };
      }),
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(queryRunnerMock.manager);
      }),
    };

    tenderRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: getRepositoryToken(Customer), useValue: {} },
        { provide: getRepositoryToken(Tender), useValue: tenderRepo },
        { provide: getRepositoryToken(Proposal), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Contract), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(TenderActivity), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(TenderPriceHistory), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  describe('updateTenderStatusTransactionally Identity & WON Transition Enforcement', () => {
    it('should reject missing identity with UnauthorizedException when tender is WON', async () => {
      const wonTender: any = {
        id: 10,
        stage: TenderStage.NEGOTIATION,
        status: TenderStatus.WON,
        marketing_pic_id: 99,
        created_by: 99,
        go_nogo_status: 'GO',
      };
      queryRunnerMock.manager.findOne.mockResolvedValue(wonTender);

      // Call without userId (undefined or 0)
      await expect(
        service.updateTenderStatusTransactionally(10, { stage: TenderStage.NEGOTIATION } as any, undefined as any)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-admin/non-director when attempting to modify WON tender', async () => {
      const wonTender: any = {
        id: 10,
        stage: TenderStage.NEGOTIATION,
        status: TenderStatus.WON,
        marketing_pic_id: 15,
        created_by: 15,
        go_nogo_status: 'GO',
      };
      queryRunnerMock.manager.findOne.mockResolvedValue(wonTender);

      // Caller is marketing staff (id 15), not admin/director
      userRepoMock.findOne.mockResolvedValue({
        id: 15,
        roles: [{ name: 'MARKETING' }],
      });

      await expect(
        service.updateTenderStatusTransactionally(10, { stage: TenderStage.NEGOTIATION } as any, 15)
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow ADMIN to modify WON tender without fallback', async () => {
      const wonTender: any = {
        id: 10,
        stage: TenderStage.NEGOTIATION,
        status: TenderStatus.WON,
        marketing_pic_id: 15,
        created_by: 15,
        go_nogo_status: 'GO',
      };
      queryRunnerMock.manager.findOne.mockResolvedValue(wonTender);

      // Caller is Admin (id 2)
      userRepoMock.findOne.mockResolvedValue({
        id: 2,
        roles: [{ name: 'ADMIN' }],
      });

      const result = await service.updateTenderStatusTransactionally(10, { stage: TenderStage.NEGOTIATION } as any, 2);

      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(wonTender.updated_by).toBe(2);
      expect(wonTender.status).toBe(TenderStatus.NEGOTIATION);
    });
  });

  describe('negotiatePrice Identity Enforcement', () => {
    it('should reject missing userId with UnauthorizedException', async () => {
      const tender: any = {
        id: 10,
        stage: TenderStage.PROPOSAL,
        status: TenderStatus.IN_PROGRESS,
        marketing_pic_id: 5,
        created_by: 5,
        go_nogo_status: 'GO',
      };
      tenderRepo.findOne.mockResolvedValue(tender);

      await expect(
        service.negotiatePrice(10, { new_price: 5000000 }, undefined as any)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should block non-admin from negotiating price on WON tender without privilege escalation', async () => {
      const wonTender: any = {
        id: 10,
        stage: TenderStage.WON,
        status: TenderStatus.WON,
        marketing_pic_id: 7,
        created_by: 7,
        go_nogo_status: 'GO',
      };
      tenderRepo.findOne.mockResolvedValue(wonTender);

      // Regular user id 7 without admin role
      userRepoMock.findOne.mockResolvedValue({
        id: 7,
        roles: [{ name: 'MARKETING' }],
      });

      await expect(
        service.negotiatePrice(10, { new_price: 4500000 }, 7, ['MARKETING'])
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadProposal Identity Enforcement', () => {
    it('should reject missing userId with UnauthorizedException', async () => {
      const dummyFile: any = { originalname: 'prop.pdf', filename: 'prop-123.pdf', path: '/tmp/prop.pdf' };
      await expect(
        service.uploadProposal(10, dummyFile, undefined as any)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('saveSPKAndUpdateContract Identity Enforcement', () => {
    it('should reject missing userId with UnauthorizedException', async () => {
      const dummyFile: any = { originalname: 'spk.pdf', filename: 'spk-123.pdf', path: '/tmp/spk.pdf' };
      await expect(
        service.saveSPKAndUpdateContract(10, dummyFile, 'https://storage/spk.pdf', undefined as any)
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
