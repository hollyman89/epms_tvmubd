import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications'
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        this.logger.warn(`Client disconnected (No Token): ${client.id}`);
        client.disconnect();
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      const secret = process.env.JWT_SECRET;
      if (!secret) { client.disconnect(); return; }
      
      const decoded = jwt.verify(token, secret) as any;

      if (!decoded || !decoded.sub) {
        this.logger.warn(`Client disconnected (Invalid Token): ${client.id}`);
        client.disconnect();
        return;
      }

      const userId = decoded.sub;
      client.data.userId = userId;
      
      const roomName = `room:user:${userId}`;
      client.join(roomName);
      
      this.logger.log(`Client connected: ${client.id} | Joined room: ${roomName}`);
    } catch (err) {
      this.logger.error(`Client connection error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendNotificationToUser(userId: number, notification: any) {
    const roomName = `room:user:${userId}`;
    this.server.to(roomName).emit('new_notification', notification);
    this.logger.log(`Pushed notification to ${roomName}`);
  }
}
