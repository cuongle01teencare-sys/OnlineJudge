import type { Role } from '@oj/contracts';

/** The authenticated user performing a use case. */
export interface Actor {
  id: string;
  role: Role;
  name: string;
}

export const isStaff = (actor: Actor): boolean => actor.role === 'ADMIN' || actor.role === 'TEACHER';
