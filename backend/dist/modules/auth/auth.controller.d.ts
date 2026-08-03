import { HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserSessionService } from './user-session.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class AuthController {
    private readonly authService;
    private readonly userSessionService;
    constructor(authService: AuthService, userSessionService: UserSessionService);
    private setRefreshTokenCookie;
    private clearRefreshTokenCookie;
    login(loginDto: LoginDto, req: any, res: any): Promise<{
        statusCode: HttpStatus;
        message: string;
        accessToken: string;
        user: {
            email: any;
            sub: any;
            fullName: any;
            roles: any;
            permissions: string[];
            companyId: any;
            branchId: any;
            tenantId: any;
        };
    }>;
    refresh(req: any, res: any): Promise<{
        statusCode: HttpStatus;
        message: string;
        accessToken: string;
        user: {
            email: string;
            sub: number;
            fullName: string;
            roles: any[];
        };
    }>;
    logout(req: any, res: any): Promise<{
        statusCode: HttpStatus;
        message: string;
    }>;
    updateProfile(req: any, updateDto: UpdateProfileDto): Promise<{
        message: string;
        data: import("../../entities/user.entity").User;
    }>;
    getActiveSessions(req: any): Promise<{
        statusCode: HttpStatus;
        message: string;
        data: import("../../entities/user-session.entity").UserSession[];
    }>;
    revokeSession(id: number, req: any): Promise<{
        statusCode: number;
        message: string;
    }>;
    revokeAllOtherSessions(req: any): Promise<{
        statusCode: number;
        revokedCount: number;
        message: string;
    }>;
    forceLogoutAllSessions(req: any): Promise<{
        statusCode: number;
        message: string;
    }>;
}
