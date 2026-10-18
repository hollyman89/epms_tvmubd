import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, DENY_ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const denyRoles = this.reflector.getAllAndOverride<string[]>(DENY_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hasRequired = Boolean(requiredRoles && requiredRoles.length > 0);
    const hasDeny = Boolean(denyRoles && denyRoles.length > 0);

    if (!hasRequired && !hasDeny) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      return false;
    }

    const userRolesUpper = user.roles.map((r: string) => String(r).toUpperCase());

    // 1. Explicit Deny Check: If user has ANY denied role, immediately reject (403)
    if (hasDeny) {
      const denyRolesUpper = denyRoles.map((r: string) => String(r).toUpperCase());
      const hasDeniedRole = userRolesUpper.some((role) => denyRolesUpper.includes(role));
      if (hasDeniedRole) {
        return false;
      }
    }

    // 2. Required Roles Check: If required roles specified, user must match at least one
    if (hasRequired) {
      return requiredRoles.some((role) => userRolesUpper.includes(String(role).toUpperCase()));
    }

    return true;
  }
}
