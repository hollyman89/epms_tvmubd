import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const DENY_ROLES_KEY = 'deny_roles';
export const DenyRoles = (...roles: string[]) => SetMetadata(DENY_ROLES_KEY, roles);
