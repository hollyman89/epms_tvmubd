import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const uid = payload.sub || payload.userId || payload.id;
    return {
      userId: uid,
      id: uid,
      sub: uid,
      email: payload.email,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      companyId: payload.companyId || 1,
      branchId: payload.branchId || 1,
      tenantId: payload.tenantId || 'default',
    };
  }
}
