import { NotFoundException } from '@nestjs/common';
import { SalesGateway } from './sales.gateway';
import { MarketingService } from './marketing.service';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

describe('SEC-WS-02: SalesGateway Tender Room Authorization & Scope Gate', () => {
  let gateway: SalesGateway;
  let marketingServiceMock: Partial<jest.Mocked<MarketingService>>;
  const JWT_SECRET = 'test-jwt-secret-key-12345';

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    marketingServiceMock = {
      getTenderById: jest.fn(),
    };

    gateway = new SalesGateway(marketingServiceMock as any);
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockSocket(authData: { userId?: number; roles?: string[]; handshake?: any } = {}): any {
    return {
      id: 'sock-' + Math.random().toString(36).substring(7),
      data: {
        userId: authData.userId,
        roles: authData.roles || [],
      },
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      handshake: authData.handshake || {
        auth: {},
        headers: {},
      },
    };
  }

  describe('1. Unauthenticated Socket Handshake & Join Defense', () => {
    it('handleConnection without token MUST disconnect socket', () => {
      const socket = createMockSocket({ handshake: { auth: {}, headers: {} } });

      gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.data.userId).toBeUndefined();
    });

    it('handleConnection with invalid JWT MUST disconnect socket', () => {
      const socket = createMockSocket({
        handshake: {
          auth: { token: 'Bearer invalid.garbage.token' },
          headers: {},
        },
      });

      gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.data.userId).toBeUndefined();
    });

    it('handleConnection with valid JWT MUST extract userId and roles into socket.data', () => {
      const token = jwt.sign({ sub: 42, roles: ['MARKETING'] }, JWT_SECRET);
      const socket = createMockSocket({
        handshake: {
          auth: { token: `Bearer ${token}` },
          headers: {},
        },
      });

      gateway.handleConnection(socket as any);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data.userId).toBe(42);
      expect(socket.data.roles).toEqual(['MARKETING']);
    });

    it('handleJoinTenderRoom with unauthenticated socket (missing userId) MUST return Unauthorized and NOT join room', async () => {
      const unauthSocket = createMockSocket({ userId: undefined });

      const result = await gateway.handleJoinTenderRoom({ tenderId: 101 }, unauthSocket as any);

      expect(result).toEqual({ status: 'error', message: 'Unauthorized' });
      expect(unauthSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('2. Authenticated but Unauthorized Tender Room Join (IDOR Prevention)', () => {
    it('authenticated user lacking access to tender MUST be DENIED and NOT join room', async () => {
      const socket = createMockSocket({ userId: 99, roles: ['MARKETING'] });

      // MarketingService enforces ownership: throws NotFoundException when access is denied
      (marketingServiceMock.getTenderById as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('Tender not found or access denied'),
      );

      const result = await gateway.handleJoinTenderRoom({ tenderId: 101 }, socket as any);

      expect(marketingServiceMock.getTenderById).toHaveBeenCalledWith(101, 99, ['MARKETING']);
      expect(result).toEqual({ status: 'error', message: 'Access denied to tender room' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('authenticated user querying non-existent tender MUST be DENIED and NOT join room', async () => {
      const socket = createMockSocket({ userId: 5, roles: ['MARKETING'] });

      (marketingServiceMock.getTenderById as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('Tender not found'),
      );

      const result = await gateway.handleJoinTenderRoom({ tenderId: 9999 }, socket as any);

      expect(marketingServiceMock.getTenderById).toHaveBeenCalledWith(9999, 5, ['MARKETING']);
      expect(result).toEqual({ status: 'error', message: 'Access denied to tender room' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('invalid or NaN tenderId MUST be rejected without checking service or joining room', async () => {
      const socket = createMockSocket({ userId: 5, roles: ['MARKETING'] });

      const result = await gateway.handleJoinTenderRoom({ tenderId: 'abc' as any }, socket as any);

      expect(result).toEqual({ status: 'error', message: 'Invalid tenderId' });
      expect(marketingServiceMock.getTenderById).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('3. Valid Authorized Tender Room Join', () => {
    it('tender PIC or creator MUST be ALLOWED to join room:tender:<id>', async () => {
      const socket = createMockSocket({ userId: 10, roles: ['MARKETING'] });

      (marketingServiceMock.getTenderById as jest.Mock).mockResolvedValueOnce({
        id: 101,
        title: 'Authorized Tender Project',
      } as any);

      const result = await gateway.handleJoinTenderRoom({ tenderId: 101 }, socket as any);

      expect(marketingServiceMock.getTenderById).toHaveBeenCalledWith(101, 10, ['MARKETING']);
      expect(socket.join).toHaveBeenCalledWith('room:tender:101');
      expect(result).toEqual({ status: 'joined', room: 'room:tender:101' });
    });

    it('SUPER_ADMIN or MANAGEMENT role MUST be ALLOWED to join any tender room', async () => {
      const socket = createMockSocket({ userId: 1, roles: ['SUPER_ADMIN'] });

      (marketingServiceMock.getTenderById as jest.Mock).mockResolvedValueOnce({
        id: 202,
        title: 'Executive Tender Oversight',
      } as any);

      const result = await gateway.handleJoinTenderRoom({ tenderId: 202 }, socket as any);

      expect(marketingServiceMock.getTenderById).toHaveBeenCalledWith(202, 1, ['SUPER_ADMIN']);
      expect(socket.join).toHaveBeenCalledWith('room:tender:202');
      expect(result).toEqual({ status: 'joined', room: 'room:tender:202' });
    });
  });

  describe('4. Room Membership Lifecycle & Broadcasting', () => {
    it('handleLeaveTenderRoom MUST remove client from room:tender:<id>', () => {
      const socket = createMockSocket({ userId: 10 });

      const result = gateway.handleLeaveTenderRoom({ tenderId: 101 }, socket as any);

      expect(socket.leave).toHaveBeenCalledWith('room:tender:101');
      expect(result).toEqual({ status: 'left', room: 'room:tender:101' });
    });

    it('join-sales-room with authenticated socket MUST join room:sales', () => {
      const socket = createMockSocket({ userId: 10 });

      const result = gateway.handleJoinSalesRoom(socket as any);

      expect(socket.join).toHaveBeenCalledWith('room:sales');
      expect(result).toEqual({ status: 'joined', room: 'room:sales' });
    });

    it('join-sales-room without userId MUST be rejected', () => {
      const socket = createMockSocket({ userId: undefined });

      const result = gateway.handleJoinSalesRoom(socket as any);

      expect(result).toEqual({ status: 'error', message: 'Unauthorized' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('broadcastTenderDelta MUST emit delta to specific tender room and general pipeline update to /sales', () => {
      const mockRoomEmitter = { emit: jest.fn() };
      (gateway.server.to as jest.Mock).mockReturnValue(mockRoomEmitter);

      gateway.broadcastTenderDelta(101, 'tender:status_updated', {
        stage: 'NEGOTIATION',
        status: 'OPEN',
      });

      expect(gateway.server.to).toHaveBeenCalledWith('room:tender:101');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('tender:status_updated', expect.objectContaining({
        tenderId: 101,
        delta: { stage: 'NEGOTIATION', status: 'OPEN' },
      }));

      expect(gateway.server.emit).toHaveBeenCalledWith('sales:pipeline_updated', expect.objectContaining({
        tenderId: 101,
        stage: 'NEGOTIATION',
        status: 'OPEN',
      }));
    });
  });
});
