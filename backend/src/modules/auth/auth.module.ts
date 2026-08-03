import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserSessionService } from './user-session.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../entities/user.entity';
import { UserSession } from '../../entities/user-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserSessionService, JwtStrategy],
  exports: [AuthService, UserSessionService],
})
export class AuthModule {}
