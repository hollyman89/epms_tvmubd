"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const jwt = require("jsonwebtoken");
let NotificationGateway = NotificationGateway_1 = class NotificationGateway {
    constructor() {
        this.logger = new common_1.Logger(NotificationGateway_1.name);
    }
    handleConnection(client) {
        try {
            const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
            if (!authHeader) {
                this.logger.warn(`Client disconnected (No Token): ${client.id}`);
                client.disconnect();
                return;
            }
            const token = authHeader.replace('Bearer ', '');
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                client.disconnect();
                return;
            }
            const decoded = jwt.verify(token, secret);
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
        }
        catch (err) {
            this.logger.error(`Client connection error: ${err.message}`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    sendNotificationToUser(userId, notification) {
        const roomName = `room:user:${userId}`;
        this.server.to(roomName).emit('new_notification', notification);
        this.logger.log(`Pushed notification to ${roomName}`);
    }
};
exports.NotificationGateway = NotificationGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationGateway.prototype, "server", void 0);
exports.NotificationGateway = NotificationGateway = NotificationGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        namespace: '/notifications'
    })
], NotificationGateway);
//# sourceMappingURL=notification.gateway.js.map