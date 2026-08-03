import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { UserSession } from '../../entities/user-session.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

@Injectable()
export class UserSessionService {
  private readonly logger = new Logger(UserSessionService.name);

  constructor(
    @InjectRepository(UserSession)
    private sessionRepo: Repository<UserSession>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Device Fingerprint Generator using IP + User-Agent + X-Device-ID
   */
  generateFingerprint(ipAddress: string, userAgent: string, deviceId: string): string {
    const raw = `${ipAddress || '127.0.0.1'}-${userAgent || 'unknown'}-${deviceId || 'default-device'}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Register or update active session on login / request
   */
  async recordSessionActivity(userId: number, ipAddress: string, userAgent: string, deviceId: string) {
    const fingerprint = this.generateFingerprint(ipAddress, userAgent, deviceId);
    const now = new Date();

    // Check suspicious activity (multiple IP shifts)
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
    } else {
      session.last_activity = now;
      session.ip_address = ipAddress || session.ip_address;
    }

    await this.sessionRepo.save(session);
    return session;
  }

  /**
   * Get all active sessions for user
   */
  async getUserActiveSessions(userId: number) {
    return await this.sessionRepo.find({
      where: { user_id: userId, is_active: true },
      order: { last_activity: 'DESC' },
    });
  }

  /**
   * Revoke specific session by ID
   */
  async revokeSession(userId: number, sessionId: number) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, user_id: userId, is_active: true },
    });

    if (!session) throw new NotFoundException('Active session not found or already revoked');

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

  /**
   * Revoke all OTHER sessions (e.g. on password change)
   */
  async revokeAllOtherSessions(userId: number, currentSessionId?: number) {
    const query = this.sessionRepo.createQueryBuilder()
      .update(UserSession)
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

  /**
   * Force logout (Revoke ALL sessions)
   */
  async forceLogoutAllSessions(userId: number) {
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

  /**
   * Auto-revoke inactive sessions (> 30 days of inactivity)
   */
  async autoRevokeInactiveSessions() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.sessionRepo.update(
      { is_active: true, last_activity: LessThan(thirtyDaysAgo) },
      { is_active: false }
    );
    this.logger.log(`Auto-revoked ${result.affected || 0} inactive sessions (>30 days).`);
    return result.affected || 0;
  }

  /**
   * Detect Suspicious Activity (Multiple IP shifts)
   */
  private async detectSuspiciousActivity(userId: number, currentIp: string) {
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
}
