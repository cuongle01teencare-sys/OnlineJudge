import type { Role } from '@oj/contracts';
import type { Email, User } from './user.js';
import type { Verification, VerificationPurpose } from './verification.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: Email): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract findByIds(ids: string[]): Promise<User[]>;
  abstract findByRole(role: Role): Promise<User[]>;
  abstract adminExists(): Promise<boolean>;
  abstract save(user: User): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export abstract class VerificationRepository {
  abstract findById(id: string): Promise<Verification | null>;
  /** Latest not-yet-consumed verification for this email and purpose. */
  abstract findOpen(email: Email, purpose: VerificationPurpose): Promise<Verification | null>;
  abstract findOpenByPurpose(purpose: VerificationPurpose): Promise<Verification[]>;
  abstract save(verification: Verification): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
