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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SalesGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const jwt = require("jsonwebtoken");
const event_emitter_1 = require("@nestjs/event-emitter");
let SalesGateway = SalesGateway_1 = class SalesGateway {
    constructor() {
        this.logger = new common_1.Logger(SalesGateway_1.name);
    }
    handleConnection(client) {
        try {
            const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
            if (!authHeader) {
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
                client.disconnect();
                return;
            }
            client.data.userId = decoded.sub;
            this.logger.log(`Sales Client Connected: ${client.id} (User ${decoded.sub})`);
        }
        catch (err) {
            this.logger.error(`Sales Gateway Connection error: ${err.message}`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Sales Client Disconnected: ${client.id}`);
    }
    handleJoinSalesRoom(client) {
        client.join('room:sales');
        console.log('🟢 Client join room:sales:', client.id);
        this.logger.log(`Client ${client.id} joined room:sales`);
        return { status: 'joined', room: 'room:sales' };
    }
    handleJoinTenderRoom(data, client) {
        if (data?.tenderId) {
            const roomName = `room:tender:${data.tenderId}`;
            client.join(roomName);
            this.logger.log(`Client ${client.id} joined Tender Room: ${roomName}`);
            return { status: 'joined', room: roomName };
        }
    }
    handleLeaveTenderRoom(data, client) {
        if (data?.tenderId) {
            const roomName = `room:tender:${data.tenderId}`;
            client.leave(roomName);
            this.logger.log(`Client ${client.id} left Tender Room: ${roomName}`);
            return { status: 'left', room: roomName };
        }
    }
    handleTenderUpdate(payload) {
        if (!this.server)
            return;
        this.logger.log(`Broadcasting sales:pipeline_updated to namespace...`);
        this.server.emit('sales:pipeline_updated', payload);
    }
    broadcastTenderDelta(tenderId, event, deltaPayload) {
        if (!this.server)
            return;
        const roomName = `room:tender:${tenderId}`;
        this.server.to(roomName).emit(event, {
            tenderId,
            timestamp: new Date().toISOString(),
            delta: deltaPayload,
        });
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
};
exports.SalesGateway = SalesGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SalesGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-sales-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SalesGateway.prototype, "handleJoinSalesRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_tender_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SalesGateway.prototype, "handleJoinTenderRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_tender_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SalesGateway.prototype, "handleLeaveTenderRoom", null);
__decorate([
    (0, event_emitter_1.OnEvent)('marketing.tender.management_update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesGateway.prototype, "handleTenderUpdate", null);
exports.SalesGateway = SalesGateway = SalesGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        namespace: '/sales',
    })
], SalesGateway);
//# sourceMappingURL=sales.gateway.js.map