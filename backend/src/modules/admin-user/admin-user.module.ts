import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUserService } from './admin-user.service';
import { AdminUserController } from './admin-user.controller';
import { AdminRoleController } from './admin-role.controller';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  controllers: [AdminUserController, AdminRoleController],
  providers: [AdminUserService],
})
export class AdminUserModule {}
