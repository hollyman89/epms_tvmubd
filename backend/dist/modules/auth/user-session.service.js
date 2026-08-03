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
var UserSessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_session_entity_1 = require("../../entities/user-session.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
const crypto = require("crypto");
let UserSessionService = UserSessionService_1 = class UserSessionService {
    constructor(sessionRepo, eventEmitter) {
        this.sessionRepo = sessionRepo;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(UserSessionService_1.name);
    }
    generateFingerprint(ipAddress, userAgent, deviceId) {
        const raw = `${ipAddress || '127.0.0.1'}-${userAgent || 'unknown'}-${deviceId || 'default-device'}`;
        return crypto.createHash('sha256').update(raw).digest('hex');
    }
    async recordSessionActivity(userId, ipAddress, userAgent, deviceId) {
        const fingerprint = this.generateFingerprint(ipAddress, userAgent, deviceId);
        const now = new Date();
        await this.detectSuspiciousActivity(userId, ipAddress);
        let session = await this.sessionRepo.findOne({
            where: { user_id: userId, device_fingerprint: fingerprint, is_active: true },
        });
        if (!session) {
            session = this.sessionRepo.create({
                user_id: userId,
                device_fingerprint: fingerprint,
                device_id: deviceId || 'device-' + Date.now(),
                ip_address: ipAddress || '127.0.0.1',
                user_agent: userAgent || 'Unknown Agent',
                last_activity: now,
                is_active: true,
            });
        }
        else {
            session.last_activity = now;
            session.ip_address = ipAddress || session.ip_address;
        }
        await this.sessionRepo.save(session);
        return session;
    }
    async getUserActiveSessions(userId) {
        return await this.sessionRepo.find({
            where: { user_id: userId, is_active: true },
            order: { last_activity: 'DESC' },
        });
    }
    async revokeSession(userId, sessionId) {
        const session = await this.sessionRepo.findOne({
            where: { id: sessionId, user_id: userId, is_active: true },
        });
        if (!session)
            throw new common_1.NotFoundException('Active session not found or already revoked');
        session.is_active = false;
        await this.sessionRepo.save(session);
        this.eventEmitter.emit('audit.log', {
            action: 'SESSION_REVOKED',
            entityId: sessionId,
            entityName: 'user_sessions',
            reason: `Session #${sessionId} (${session.ip_address}) revoked by user`,
            userId,
        });
        return { statusCode: 200, message: `Session #${sessionId} revoked successfully.` };
    }
    async revokeAllOtherSessions(userId, currentSessionId) {
        const query = this.sessionRepo.createQueryBuilder()
            .update(user_session_entity_1.UserSession)
            .set({ is_active: false })
            .where('user_id = :userId AND is_active = true', { userId });
        if (currentSessionId) {
            query.andWhere('id != :currentSessionId', { currentSessionId });
        }
        const result = await query.execute();
        this.eventEmitter.emit('audit.log', {
            action: 'ALL_OTHER_SESSIONS_REVOKED',
            entityId: userId,
            entityName: 'users',
            reason: `All other sessions revoked for User #${userId}`,
            userId,
        });
        return {
            statusCode: 200,
            revokedCount: result.affected || 0,
            message: 'All other active sessions have been revoked.',
        };
    }
    async forceLogoutAllSessions(userId) {
        await this.sessionRepo.update({ user_id: userId, is_active: true }, { is_active: false });
        this.eventEmitter.emit('audit.log', {
            action: 'FORCE_LOGOUT_ALL_SESSIONS',
            entityId: userId,
            entityName: 'users',
            reason: `Force logout executed. All sessions revoked for User #${userId}`,
            userId,
        });
        return { statusCode: 200, message: 'All device sessions force-logged out.' };
    }
    async autoRevokeInactiveSessions() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await this.sessionRepo.update({ is_active: true, last_activity: (0, typeorm_2.LessThan)(thirtyDaysAgo) }, { is_active: false });
        this.logger.log(`Auto-revoked ${result.affected || 0} inactive sessions (>30 days).`);
        return result.affected || 0;
    }
    async detectSuspiciousActivity(userId, currentIp) {
        const recentSessions = await this.sessionRepo.find({
            where: { user_id: userId, is_active: true },
            order: { last_activity: 'DESC' },
            take: 5,
        });
        const distinctIps = new Set(recentSessions.map((s) => s.ip_address));
        if (distinctIps.size >= 3 && !distinctIps.has(currentIp)) {
            this.logger.warn(`🚨 SUSPICIOUS ACTIVITY DETECTED: User #${userId} accessed from multiple distinct IPs (${Array.from(distinctIps).join(', ')})!`);
            this.eventEmitter.emit('audit.log', {
                action: 'SUSPICIOUS_LOGIN_LOCATION',
                entityId: userId,
                entityName: 'users',
                reason: `Access attempt from unusual IP ${currentIp}. Multiple active IPs detected: ${Array.from(distinctIps).join(', ')}`,
                userId,
            });
        }
    }
};
exports.UserSessionService = UserSessionService;
exports.UserSessionService = UserSessionService = UserSessionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_session_entity_1.UserSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], UserSessionService);
//# sourceMappingURL=user-session.service.js.map