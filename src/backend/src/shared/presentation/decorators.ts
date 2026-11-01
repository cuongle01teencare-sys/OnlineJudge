import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@oj/contracts';
import type { Actor } from '../application/actor.js';

export const IS_PUBLIC = 'oj:isPublic';
export const ROLES = 'oj:roles';

/** Route does not require authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route requires one of the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Injects the authenticated Actor (set by the auth guard). */
export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().actor,
);
