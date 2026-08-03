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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const user_session_service_1 = require("./user-session.service");
const login_dto_1 = require("./dto/login.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
let AuthController = class AuthController {
    constructor(authService, userSessionService) {
        this.authService = authService;
        this.userSessionService = userSessionService;
    }
    setRefreshTokenCookie(res, refreshToken) {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/api/v1/auth',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
    }
    clearRefreshTokenCookie(res) {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refresh_token', '', {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/api/v1/auth',
            maxAge: 0,
            expires: new Date(0),
        });
    }
    async login(loginDto, req, res) {
        const user = await this.authService.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Login gagal. Periksa kembali email dan password Anda.');
        }
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const result = await this.authService.login(user, ipAddress, userAgent);
        this.setRefreshTokenCookie(res, result.refreshToken);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Login successful',
            accessToken: result.accessToken,
            user: result.user,
        };
    }
    async refresh(req, res) {
        const rawRefreshToken = req.cookies?.['refresh_token'] || req.body?.refreshToken;
        if (!rawRefreshToken) {
            throw new common_1.UnauthorizedException('Refresh token cookie is missing!');
        }
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const result = await this.authService.refreshToken(rawRefreshToken, ipAddress, userAgent);
        this.setRefreshTokenCookie(res, result.refreshToken);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Token refreshed and rotated successfully',
            accessToken: result.accessToken,
            user: result.user,
        };
    }
    async logout(req, res) {
        const userId = req.user?.sub || req.user?.userId;
        if (userId) {
            await this.authService.logout(userId);
        }
        this.clearRefreshTokenCookie(res);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Logout successful and session invalidated.',
        };
    }
    async updateProfile(req, updateDto) {
        try {
            const userId = req.user?.sub || req.user?.userId;
            const result = await this.authService.updateProfile(userId, updateDto);
            return {
                message: 'Profile updated successfully',
                data: result,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async getActiveSessions(req) {
        const userId = req.user?.sub || req.user?.userId;
        const sessions = await this.userSessionService.getUserActiveSessions(userId);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Active sessions retrieved successfully',
            data: sessions,
        };
    }
    async revokeSession(id, req) {
        const userId = req.user?.sub || req.user?.userId;
        return await this.userSessionService.revokeSession(userId, id);
    }
    async revokeAllOtherSessions(req) {
        const userId = req.user?.sub || req.user?.userId;
        return await this.userSessionService.revokeAllOtherSessions(userId);
    }
    async forceLogoutAllSessions(req) {
        const userId = req.user?.sub || req.user?.userId;
        return await this.userSessionService.forceLogoutAllSessions(userId);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login and receive Access Token (15m) + HttpOnly Refresh Token Cookie (7d)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Rotate Refresh Token Cookie and receive NEW Access Token (Rate Limited max 5 req/min)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token refreshed and rotated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or revoked refresh token' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Logout, invalidate session in DB, and clear HttpOnly Refresh Token Cookie' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Put)('profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Update user profile' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Get)('sessions'),
    (0, swagger_1.ApiOperation)({ summary: 'List all active multi-device sessions for logged in user' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getActiveSessions", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Delete)('sessions/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Revoke specific device session by session ID' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revokeSession", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Delete)('sessions/all-others'),
    (0, swagger_1.ApiOperation)({ summary: 'Revoke all other active sessions (e.g. on password change)' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revokeAllOtherSessions", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Post)('sessions/force-logout'),
    (0, swagger_1.ApiOperation)({ summary: 'Force logout all sessions for current user' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forceLogoutAllSessions", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth & Cookie Security'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        user_session_service_1.UserSessionService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map