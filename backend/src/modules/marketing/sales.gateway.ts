import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/sales',
})
export class SalesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SalesGateway.name);

  handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        client.disconnect();
        return;
      }
      const token = authHeader.replace('Bearer ', '');
      const secret = process.env.JWT_SECRET;
      if (!secret) { client.disconnect(); return; }
      const decoded = jwt.verify(token, secret) as any;
      if (!decoded || !decoded.sub) {
        client.disconnect();
        return;
      }
      client.data.userId = decoded.sub;
      this.logger.log(`Sales Client Connected: ${client.id} (User ${decoded.sub})`);
    } catch (err) {
      this.logger.error(`Sales Gateway Connection error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Sales Client Disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-sales-room')
  handleJoinSalesRoom(@ConnectedSocket() client: Socket) {
    client.join('room:sales');
    console.log('🟢 Client join room:sales:', client.id);
    this.logger.log(`Client ${client.id} joined room:sales`);
    return { status: 'joined', room: 'room:sales' };
  }

  @SubscribeMessage('join_tender_room')
  handleJoinTenderRoom(@MessageBody() data: { tenderId: number }, @ConnectedSocket() client: Socket) {
    if (data?.tenderId) {
      const roomName = `room:tender:${data.tenderId}`;
      client.join(roomName);
      this.logger.log(`Client ${client.id} joined Tender Room: ${roomName}`);
      return { status: 'joined', room: roomName };
    }
  }

  @SubscribeMessage('leave_tender_room')
  handleLeaveTenderRoom(@MessageBody() data: { tenderId: number }, @ConnectedSocket() client: Socket) {
    if (data?.tenderId) {
      const roomName = `room:tender:${data.tenderId}`;
      client.leave(roomName);
      this.logger.log(`Client ${client.id} left Tender Room: ${roomName}`);
      return { status: 'left', room: roomName };
    }
  }

  @OnEvent('marketing.tender.management_update')
  handleTenderUpdate(payload: any) {
    if (!this.server) return;
    this.logger.log(`Broadcasting sales:pipeline_updated to namespace...`);
    this.server.emit('sales:pipeline_updated', payload);
  }

  /**
   * Broadcast Delta Payload to Tender Room & Sales Room
   */
  broadcastTenderDelta(tenderId: number, event: string, deltaPayload: any) {
    if (!this.server) return;
    const roomName = `room:tender:${tenderId}`;
    this.server.to(roomName).emit(event, {
      tenderId,
      timestamp: new Date().toISOString(),
      delta: deltaPayload,
    });
    // Broadcast to room:sales and namespace /sales
    const payload = {
      tenderId,
      stage: deltaPayload?.stage,
      status: deltaPayload?.status,
      updatedAt: new Date().toISOString(),
      delta: deltaPayload,
    };
    this.server.to('room:sales').emit('sales:pipeline_updated', payload);
    this.server.emit('sales:pipeline_updated', payload);
  }
}
