import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async findAll(roleName?: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const query = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .select(['user.id', 'user.email', 'user.fullName', 'user.isActive', 'user.createdAt', 'role.name'])
      .where('user.deletedAt IS NULL');

    if (roleName) {
      query.andWhere('role.name = :roleName', { roleName });
    }

    query.orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getRoles() {
    return this.roleRepository.find({
      order: { name: 'ASC' },
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    const { email, fullName, password, roleId } = createUserDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if role exists
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException('Invalid Role ID');
    }

    // Hash password
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
    // Don't return password hash
    const { passwordHash, ...result } = savedUser;
    return result;
  }

  async updateRole(id: number, updateRoleDto: UpdateRoleDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.roleRepository.findOne({ where: { id: updateRoleDto.roleId } });
    if (!role) {
      throw new BadRequestException('Invalid Role ID');
    }

    user.roles = [role];
    await this.userRepository.save(user);

    return this.userRepository.findOne({ where: { id }, relations: ['roles'], select: ['id', 'email', 'fullName'] });
  }

  async removeUser(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Soft delete
    await this.userRepository.softDelete(id);
    return { message: 'User deleted successfully' };
  }
}
