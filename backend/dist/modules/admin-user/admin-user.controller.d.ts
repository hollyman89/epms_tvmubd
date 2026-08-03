import { AdminUserService } from './admin-user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
export declare class AdminUserController {
    private readonly adminUserService;
    constructor(adminUserService: AdminUserService);
    findAll(role?: string): Promise<import("../../entities/user.entity").User[]>;
    create(createUserDto: CreateUserDto): Promise<{
        id: number;
        email: string;
        refreshToken: string;
        fullName: string;
        isActive: boolean;
        roles: import("../../entities/role.entity").Role[];
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }>;
    updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<import("../../entities/user.entity").User>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
