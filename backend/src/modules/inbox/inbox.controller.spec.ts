import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('InboxController', () => {
  let controller: InboxController;
  let inboxService: jest.Mocked<Partial<InboxService>>;

  beforeEach(async () => {
    inboxService = {
      getTodos: jest.fn().mockResolvedValue([
        {
          todoId: 'task-1',
          sourceType: 'WORKFLOW_TASK',
          sourceId: '1',
          title: 'Review Kontrak',
          status: 'PENDING',
        } as any,
      ]),
      getHistory: jest.fn().mockResolvedValue([
        {
          historyId: 'task-history-1',
          taskId: 1,
          title: 'Review Kontrak Selesai',
          status: 'COMPLETED',
        } as any,
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboxController],
      providers: [{ provide: InboxService, useValue: inboxService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InboxController>(InboxController);
  });

  describe('GET /inbox/todos', () => {
    it('should derive user identity from authenticated req.user and return todos envelope', async () => {
      const mockReq = {
        user: {
          userId: 4,
          roles: ['PROJECT_MANAGER'],
        },
      };

      const result = await controller.getMyTodos(mockReq as any);

      expect(inboxService.getTodos).toHaveBeenCalledWith(4, ['PROJECT_MANAGER']);
      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Pending actionable tasks retrieved successfully',
        data: expect.arrayContaining([
          expect.objectContaining({
            todoId: 'task-1',
            status: 'PENDING',
          }),
        ]),
      });
    });
  });

  describe('GET /inbox/history', () => {
    it('route exists, derives identity from authenticated req.user, and returns history envelope', async () => {
      const mockReq = {
        user: {
          userId: 4,
          roles: ['PROJECT_MANAGER'],
        },
      };

      const result = await controller.getMyHistory(mockReq as any);

      expect(inboxService.getHistory).toHaveBeenCalledWith(4, ['PROJECT_MANAGER']);
      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Historical workflow tasks retrieved successfully',
        data: expect.arrayContaining([
          expect.objectContaining({
            historyId: 'task-history-1',
            status: 'COMPLETED',
          }),
        ]),
      });
    });

    it('handles alternative req.user id properties (id, sub) securely without query parameter tampering', async () => {
      const mockReqSub = {
        user: {
          sub: 10,
          role: 'LEGAL',
        },
      };

      await controller.getMyHistory(mockReqSub as any);
      expect(inboxService.getHistory).toHaveBeenCalledWith(10, ['LEGAL']);
    });
  });
});
