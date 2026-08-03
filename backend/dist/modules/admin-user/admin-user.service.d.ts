import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
export declare class AdminUserService {
    private userRepository;
    private roleRepository;
    constructor(userRepository: Repository<User>, roleRepository: Repository<Role>);
    findAll(roleName?: string): Promise<User[]>;
    createUser(createUserDto: CreateUserDto): Promise<{
        id: number;
        email: string;
        refreshToken: string;
        fullName: string;
        isActive: boolean;
        roles: Role[];
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }>;
    updateRole(id: number, updateRoleDto: UpdateRoleDto): Promise<User>;
    removeUser(id: number): Promise<{
        message: string;
    }>;
}
