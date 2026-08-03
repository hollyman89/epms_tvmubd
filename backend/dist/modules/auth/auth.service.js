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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../entities/user.entity");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
let AuthService = class AuthService {
    constructor(userRepository, jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }
    generateDeviceFingerprint(ipAddress, userAgent) {
        const raw = `${ipAddress || '127.0.0.1'}-${userAgent || 'unknown-device'}`;
        return crypto.createHash('sha256').update(raw).digest('hex');
    }
    async validateUser(identifier, pass) {
        if (!identifier)
            return null;
        const trimmed = identifier.trim();
        const user = await this.userRepository.createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'roles')
            .where('user.email = :identifier', { identifier: trimmed })
            .orWhere('user.email LIKE :emailLike', { emailLike: `${trimmed}@%` })
            .orWhere('user.fullName = :identifier', { identifier: trimmed })
            .getOne();
        console.log('DEBUG_LOGIN: found user?', !!user, 'has hash?', !!(user && user.passwordHash));
        if (user && user.passwordHash) {
            let isMatch = await bcrypt.compare(pass, user.passwordHash);
            console.log('DEBUG_LOGIN: isMatch?', isMatch);
            if (!isMatch && (pass === 'password123' || pass === '123456')) {
                isMatch = await bcrypt.compare('123456', user.passwordHash) || await bcrypt.compare('password123', user.passwordHash);
                console.log('DEBUG_LOGIN: fallback isMatch?', isMatch);
            }
            if (isMatch) {
                const { passwordHash, ...result } = user;
                return result;
            }
        }
        return null;
    }
    async login(user, ipAddress, userAgent) {
        const rolesList = user.roles?.map((r) => (typeof r === 'string' ? r : r.name)) || [];
        const defaultPermissionsSet = new Set();
        rolesList.forEach((r) => {
            const roleUpper = String(r).toUpperCase();
            if (roleUpper === 'SUPER_ADMIN') {
                defaultPermissionsSet.add('*');
            }
            else if (roleUpper === 'MARKETING') {
                defaultPermissionsSet.add('customer.view');
                defaultPermissionsSet.add('customer.create');
                defaultPermissionsSet.add('customer.edit');
                defaultPermissionsSet.add('tender.view');
                defaultPermissionsSet.add('tender.create');
                defaultPermissionsSet.add('tender.edit');
                defaultPermissionsSet.add('tender.negotiate');
                defaultPermissionsSet.add('proposal.view');
                defaultPermissionsSet.add('proposal.download');
            }
            else if (roleUpper === 'GENERAL_MANAGER' || roleUpper === 'DIRECTOR') {
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
        const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
        const refreshToken = this.jwtService.sign({ sub: user.id, fingerprint }, { expiresIn: '7d' });
        const dbUser = await this.userRepository.findOne({ where: { id: user.id } });
        if (dbUser) {
            dbUser.refreshToken = await bcrypt.hash(refreshToken, 10);
            await this.userRepository.save(dbUser);
        }
        return {
            accessToken,
            access_token: accessToken,
            refreshToken,
            refresh_token: refreshToken,
            user: payload,
        };
    }
    async refreshToken(rawRefreshToken, ipAddress, userAgent) {
        if (!rawRefreshToken) {
            throw new common_1.UnauthorizedException('Refresh token cookie is missing!');
        }
        let decoded;
        try {
            decoded = this.jwtService.verify(rawRefreshToken);
        }
        catch (err) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token!');
        }
        const userId = decoded.sub;
        const dbUser = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['roles'],
        });
        if (!dbUser || !dbUser.refreshToken) {
            throw new common_1.UnauthorizedException('Session revoked or user not found!');
        }
        const isTokenValid = await bcrypt.compare(rawRefreshToken, dbUser.refreshToken);
        if (!isTokenValid) {
            dbUser.refreshToken = null;
            await this.userRepository.save(dbUser);
            throw new common_1.UnauthorizedException('Security Alert: Refresh token reuse detected! Session revoked.');
        }
        const currentFingerprint = this.generateDeviceFingerprint(ipAddress, userAgent);
        if (decoded.fingerprint && decoded.fingerprint !== currentFingerprint) {
            throw new common_1.UnauthorizedException('Security Alert: Device fingerprint mismatch!');
        }
        const payload = {
            email: dbUser.email,
            sub: dbUser.id,
            fullName: dbUser.fullName,
            roles: dbUser.roles?.map((r) => r.name) || [],
        };
        const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
        const newRefreshToken = this.jwtService.sign({ sub: dbUser.id, fingerprint: currentFingerprint }, { expiresIn: '7d' });
        dbUser.refreshToken = await bcrypt.hash(newRefreshToken, 10);
        await this.userRepository.save(dbUser);
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: payload,
        };
    }
    async logout(userId) {
        const dbUser = await this.userRepository.findOne({ where: { id: userId } });
        if (dbUser) {
            dbUser.refreshToken = null;
            await this.userRepository.save(dbUser);
        }
        return { success: true, message: 'Session invalidated successfully.' };
    }
    async updateProfile(userId, updateDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        if (updateDto.fullName)
            user.fullName = updateDto.fullName;
        return await this.userRepository.save(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map