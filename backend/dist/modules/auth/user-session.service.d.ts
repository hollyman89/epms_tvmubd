import { Repository } from 'typeorm';
import { UserSession } from '../../entities/user-session.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class UserSessionService {
    private sessionRepo;
    private eventEmitter;
    private readonly logger;
    constructor(sessionRepo: Repository<UserSession>, eventEmitter: EventEmitter2);
    generateFingerprint(ipAddress: string, userAgent: string, deviceId: string): string;
    recordSessionActivity(userId: number, ipAddress: string, userAgent: string, deviceId: string): Promise<UserSession>;
    getUserActiveSessions(userId: number): Promise<UserSession[]>;
    revokeSession(userId: number, sessionId: number): Promise<{
        statusCode: number;
        message: string;
    }>;
    revokeAllOtherSessions(userId: number, currentSessionId?: number): Promise<{
        statusCode: number;
        revokedCount: number;
        message: string;
    }>;
    forceLogoutAllSessions(userId: number): Promise<{
        statusCode: number;
        message: string;
    }>;
    autoRevokeInactiveSessions(): Promise<number>;
    private detectSuspiciousActivity;
}
