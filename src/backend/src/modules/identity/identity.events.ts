import type { Role } from '@oj/contracts';

/**
 * Published language of the Identity context: integration events other contexts may subscribe to.
 * Subscribers depend on this file only, never on identity domain classes.
 */
export const STUDENT_REGISTERED = 'identity.student-registered';
export const USER_DELETED = 'identity.user-deleted';

export interface StudentRegisteredEvent {
  name: typeof STUDENT_REGISTERED;
  occurredAt: Date;
  userId: string;
  /** The class chosen (by class code) at sign-up. */
  classId: string;
}

export interface UserDeletedEvent {
  name: typeof USER_DELETED;
  occurredAt: Date;
  userId: string;
  role: Role;
}
