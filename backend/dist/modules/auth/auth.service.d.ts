import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
export declare class AuthService {
    private userRepository;
    private jwtService;
    constructor(userRepository: Repository<User>, jwtService: JwtService);
    generateDeviceFingerprint(ipAddress: string, userAgent: string): string;
    validateUser(identifier: string, pass: string): Promise<any>;
    login(user: any, ipAddress: string, userAgent: string): Promise<{
        accessToken: string;
        access_token: string;
        refreshToken: string;
        refresh_token: string;
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
    refreshToken(rawRefreshToken: string, ipAddress: string, userAgent: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            email: string;
            sub: number;
            fullName: string;
            roles: any[];
        };
    }>;
    logout(userId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    updateProfile(userId: number, updateDto: any): Promise<User>;
}
