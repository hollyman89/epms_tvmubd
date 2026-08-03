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
exports.AdminUserService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const user_entity_1 = require("../../entities/user.entity");
const role_entity_1 = require("../../entities/role.entity");
let AdminUserService = class AdminUserService {
    constructor(userRepository, roleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }
    async findAll(roleName) {
        const query = this.userRepository.createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'role')
            .select(['user.id', 'user.email', 'user.fullName', 'user.isActive', 'user.createdAt', 'role.name'])
            .where('user.deletedAt IS NULL');
        if (roleName) {
            query.andWhere('role.name = :roleName', { roleName });
        }
        return await query.getMany();
    }
    async createUser(createUserDto) {
        const { email, fullName, password, roleId } = createUserDto;
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const role = await this.roleRepository.findOne({ where: { id: roleId } });
        if (!role) {
            throw new common_1.BadRequestException('Invalid Role ID');
        }
        const saltOrRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltOrRounds);
        const user = this.userRepository.create({
            email,
            fullName,
            passwordHash: hashedPassword,
            roles: [role],
            isActive: true,
        });
        const savedUser = await this.userRepository.save(user);
        const { passwordHash, ...result } = savedUser;
        return result;
    }
    async updateRole(id, updateRoleDto) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const role = await this.roleRepository.findOne({ where: { id: updateRoleDto.roleId } });
        if (!role) {
            throw new common_1.BadRequestException('Invalid Role ID');
        }
        user.roles = [role];
        await this.userRepository.save(user);
        return this.userRepository.findOne({ where: { id }, relations: ['roles'], select: ['id', 'email', 'fullName'] });
    }
    async removeUser(id) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.userRepository.softDelete(id);
        return { message: 'User deleted successfully' };
    }
};
exports.AdminUserService = AdminUserService;
exports.AdminUserService = AdminUserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AdminUserService);
//# sourceMappingURL=admin-user.service.js.map