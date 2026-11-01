import type { Actor } from '../../../shared/application/actor.js';

export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract verify(plain: string, hash: string): Promise<boolean>;
}

export abstract class TokenService {
  abstract issue(actor: Actor): Promise<string>;
  /** Returns null for invalid/expired tokens. */
  abstract verify(token: string): Promise<Actor | null>;
}

/** Port: identity-related emails. Wording lives in the adapter; the application only says what to send. */
export abstract class IdentityMailer {
  abstract sendRegistrationCode(to: string, name: string, code: string, expiresAt: Date): Promise<void>;
  abstract sendPasswordResetCode(to: string, name: string, code: string, expiresAt: Date): Promise<void>;
  abstract sendTeacherInvitation(to: string, name: string, acceptUrl: string, code: string, expiresAt: Date): Promise<void>;
}
