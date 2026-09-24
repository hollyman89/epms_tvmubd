import { Injectable, UnauthorizedException, BadRequestException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UserSessionService } from './user-session.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    @Optional() private userSessionService?: UserSessionService,
  ) {}

  /**
  /**
   * Device Fingerprint Generator (Anchored to User-Agent for stable session identification across dynamic IP changes)
   */
  generateDeviceFingerprint(ipAddress: string, userAgent: string): string {
    const raw = `ua:${userAgent || 'unknown-device'}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private parseTokenStore(raw: string | null): Array<{ hash: string; createdAt: number; rotatedAt?: number }> {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      if (typeof raw === 'string' && raw.length > 0) {
        return [{ hash: raw, createdAt: Date.now() }];
      }
    }
    return [];
  }

  private serializeTokenStore(items: Array<{ hash: string; createdAt: number; rotatedAt?: number }>): string {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const graceCutoff = Date.now() - 60 * 1000;
    const valid = items.filter((item) => {
      if (item.rotatedAt && item.rotatedAt < graceCutoff) return false;
      return item.createdAt > cutoff;
    });
    return JSON.stringify(valid.slice(-10));
  }

  async validateUser(identifier: string, pass: string): Promise<any> {
    if (!identifier) return null;
    const trimmed = identifier.trim();

    const user = await this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('user.email = :identifier', { identifier: trimmed })
      .orWhere('user.email LIKE :emailLike', { emailLike: `${trimmed}@%` })
      .orWhere('user.fullName = :identifier', { identifier: trimmed })
      .getOne();

    if (user && user.passwordHash) {
      const isMatch = await bcrypt.compare(pass, user.passwordHash);
      if (isMatch) {
        const { passwordHash, ...result } = user;
        return result;
      }
    }
    return null;
  }

  /**
   * Login with Access Token (15 min) & HttpOnly Refresh Token (7d)
   */
  async login(user: any, ipAddress: string, userAgent: string) {
    const rolesList = user.roles?.map((r: any) => (typeof r === 'string' ? r : r.name)) || [];
    
    // Derive granular permissions dynamically based on roles for backward-compatible RBAC
    const defaultPermissionsSet = new Set<string>();
    rolesList.forEach((r: string) => {
      const roleUpper = String(r).toUpperCase();
      if (roleUpper === 'SUPER_ADMIN') {
        defaultPermissionsSet.add('*');
      } else if (roleUpper === 'MARKETING') {
        defaultPermissionsSet.add('customer.view');
        defaultPermissionsSet.add('customer.create');
        defaultPermissionsSet.add('customer.edit');
        defaultPermissionsSet.add('tender.view');
        defaultPermissionsSet.add('tender.create');
        defaultPermissionsSet.add('tender.edit');
        defaultPermissionsSet.add('tender.negotiate');
        defaultPermissionsSet.add('proposal.view');
        defaultPermissionsSet.add('proposal.download');
      } else if (roleUpper === 'GENERAL_MANAGER' || roleUpper === 'DIRECTOR') {
        defaultPermissionsSet.add('customer.view');
        defaultPermissionsSet.add('customer.create');
        defaultPermissionsSet.add('customer.edit');
        defaultPermissionsSet.add('tender.view');
        defaultPermissionsSet.add('tender.approve');
        defaultPermissionsSet.add('proposal.view');
        defaultPermissionsSet.add('proposal.download');
        defaultPermissionsSet.add('analytics.view');
      }
    });

    const payload = {
      email: user.email,
      sub: user.id,
      fullName: user.fullName,
      roles: rolesList,
      permissions: Array.from(defaultPermissionsSet),
      companyId: user.companyId || 1,
      branchId: user.branchId || 1,
      tenantId: user.tenantId || 'default',
    };

    const fingerprint = this.generateDeviceFingerprint(ipAddress, userAgent);

    // Access Token expires in 15 minutes
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    // Refresh Token expires in 7 days
    const refreshToken = this.jwtService.sign(
      { sub: user.id, fingerprint },
      { expiresIn: '7d' }
    );

    // Store Hashed Refresh Token in DB for session revocation
    const dbUser = await this.userRepository.findOne({ where: { id: user.id } });
    if (dbUser) {
      const newHash = await bcrypt.hash(refreshToken, 10);
      const store = this.parseTokenStore(dbUser.refreshToken);
      store.push({ hash: newHash, createdAt: Date.now() });
      dbUser.refreshToken = this.serializeTokenStore(store);
      await this.userRepository.save(dbUser);
    }

    if (this.userSessionService) {
      await this.userSessionService.recordSessionActivity(user.id, ipAddress, userAgent, 'device-default');
    }

    return {
      accessToken,
      access_token: accessToken,
      refreshToken,
      refresh_token: refreshToken,
      user: payload,
    };
  }

  /**
   * Refresh Token Rotation Mechanism
   */
  async refreshToken(rawRefreshToken: string, ipAddress: string, userAgent: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing!');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(rawRefreshToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token!');
    }

    const userId = decoded.sub;
    const dbUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!dbUser || !dbUser.refreshToken) {
      throw new UnauthorizedException('Session revoked or user not found!');
    }

    const store = this.parseTokenStore(dbUser.refreshToken);
    let matchedItemIndex = -1;

    for (let i = 0; i < store.length; i++) {
      const isMatch = await bcrypt.compare(rawRefreshToken, store[i].hash);
      if (isMatch) {
        matchedItemIndex = i;
        break;
      }
    }

    if (matchedItemIndex === -1) {
      throw new UnauthorizedException('Invalid or revoked refresh token!');
    }

    const matchedItem = store[matchedItemIndex];
    const now = Date.now();

    // Concurrent request rotation grace period (within 60s of previous rotation)
    if (matchedItem.rotatedAt && now - matchedItem.rotatedAt < 60000) {
      const payload = {
        email: dbUser.email,
        sub: dbUser.id,
        fullName: dbUser.fullName,
        roles: dbUser.roles?.map((r: any) => r.name) || [],
      };
      const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
      return {
        accessToken: newAccessToken,
        refreshToken: rawRefreshToken,
        user: payload,
      };
    }

    // Device Fingerprint Verification
    const currentFingerprint = this.generateDeviceFingerprint(ipAddress, userAgent);
    if (decoded.fingerprint && decoded.fingerprint !== currentFingerprint) {
      throw new UnauthorizedException('Security Alert: Device fingerprint mismatch!');
    }

    // Issue NEW Access Token (15m) & NEW Refresh Token (7d) - Token Rotation
    const payload = {
      email: dbUser.email,
      sub: dbUser.id,
      fullName: dbUser.fullName,
      roles: dbUser.roles?.map((r: any) => r.name) || [],
    };

    const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = this.jwtService.sign(
      { sub: dbUser.id, fingerprint: currentFingerprint },
      { expiresIn: '7d' }
    );

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    matchedItem.rotatedAt = now;
    store.push({ hash: newHash, createdAt: now });

    dbUser.refreshToken = this.serializeTokenStore(store);
    await this.userRepository.save(dbUser);

    if (this.userSessionService) {
      await this.userSessionService.recordSessionActivity(dbUser.id, ipAddress, userAgent, 'device-default');
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: payload,
    };
  }

  /**
   * Session Invalidation on Logout
   */
  async logout(userId?: number, rawRefreshToken?: string) {
    let effectiveUserId = userId;
    if (!effectiveUserId && rawRefreshToken) {
      try {
        const decoded: any = this.jwtService.decode(rawRefreshToken);
        if (decoded && decoded.sub) {
          effectiveUserId = Number(decoded.sub);
        }
      } catch {
        // Ignore token decoding failure during logout
      }
    }

    if (!effectiveUserId) {
      return { success: true, message: 'Session invalidated.' };
    }

    const dbUser = await this.userRepository.findOne({ where: { id: effectiveUserId } });
    if (dbUser && dbUser.refreshToken) {
      if (rawRefreshToken) {
        const store = this.parseTokenStore(dbUser.refreshToken);
        const remaining = [];
        for (const item of store) {
          const isMatch = await bcrypt.compare(rawRefreshToken, item.hash);
          if (!isMatch) remaining.push(item);
        }
        dbUser.refreshToken = remaining.length > 0 ? this.serializeTokenStore(remaining) : null;
      } else {
        dbUser.refreshToken = null;
      }
      await this.userRepository.save(dbUser);
    }
    return { success: true, message: 'Session invalidated successfully.' };
  }

  async updateProfile(userId: number, updateDto: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (updateDto.fullName) user.fullName = updateDto.fullName;
    return await this.userRepository.save(user);
  }
}
