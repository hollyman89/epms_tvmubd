import { Role } from './role.entity';
export declare class User {
    id: number;
    email: string;
    passwordHash: string;
    refreshToken: string;
    fullName: string;
    isActive: boolean;
    roles: Role[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
}
