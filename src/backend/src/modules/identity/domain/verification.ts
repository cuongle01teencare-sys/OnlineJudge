import { AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Email } from './user.js';

export type VerificationPurpose = 'REGISTER_STUDENT' | 'INVITE_TEACHER' | 'RESET_PASSWORD';

/** Data carried until the verification succeeds (the account does not exist before that). */
export interface VerificationPayload {
  displayName?: string;
  /** Class the student joins (opaque id owned by the Classroom context). */
  classId?: string;
  phone?: string | null;
  passwordHash?: string;
}

export const VERIFICATION_POLICY: Record<VerificationPurpose, { ttlMs: number }> = {
  REGISTER_STUDENT: { ttlMs: 10 * 60_000 },
  RESET_PASSWORD: { ttlMs: 10 * 60_000 },
  INVITE_TEACHER: { ttlMs: 7 * 24 * 60 * 60_000 },
};
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_ATTEMPTS = 5;

export interface VerificationState {
  purpose: VerificationPurpose;
  email: Email;
  payload: VerificationPayload;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

const invalidCode = () =>
  DomainError.validation('identity.invalid_code', 'Mã xác thực không đúng hoặc đã hết hạn. Hãy kiểm tra lại email hoặc gửi lại mã.');

/**
 * A one-time code sent to an email address to prove ownership before something happens
 * (account creation, teacher activation, password reset). The plain code is never stored.
 */
export class Verification extends AggregateRoot {
  private constructor(id: string, private state: VerificationState) {
    super(id);
  }

  static issue(purpose: VerificationPurpose, email: Email, payload: VerificationPayload, codeHash: string, now = new Date()): Verification {
    return new Verification(newId(), {
      purpose,
      email,
      payload,
      codeHash,
      attempts: 0,
      expiresAt: new Date(now.getTime() + VERIFICATION_POLICY[purpose].ttlMs),
      lastSentAt: now,
      consumedAt: null,
      createdAt: now,
    });
  }

  static rehydrate(id: string, state: VerificationState): Verification {
    return new Verification(id, state);
  }

  get snapshot(): Readonly<VerificationState> {
    return this.state;
  }

  get resendAvailableAt(): Date {
    return new Date(this.state.lastSentAt.getTime() + RESEND_COOLDOWN_MS);
  }

  isUsable(now = new Date()): boolean {
    return !this.state.consumedAt && now < this.state.expiresAt && this.state.attempts < MAX_ATTEMPTS;
  }

  ensurePurpose(purpose: VerificationPurpose): void {
    if (this.state.purpose !== purpose) throw invalidCode();
  }

  /** New code (old one stops working), new expiry, attempts reset. */
  reissue(codeHash: string, now = new Date()): void {
    if (this.state.consumedAt) throw invalidCode();
    if (now < this.resendAvailableAt) {
      const seconds = Math.ceil((this.resendAvailableAt.getTime() - now.getTime()) / 1000);
      throw DomainError.conflict('identity.resend_too_soon', `Vui lòng đợi ${seconds} giây rồi gửi lại mã.`);
    }
    this.state = {
      ...this.state,
      codeHash,
      attempts: 0,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + VERIFICATION_POLICY[this.state.purpose].ttlMs),
    };
  }

  /**
   * Records an attempt; `codeMatches` is computed by the application (hashing is infrastructure).
   * On success the verification is consumed and cannot be used again.
   */
  attempt(codeMatches: boolean, now = new Date()): void {
    if (!this.isUsable(now)) throw invalidCode();
    if (!codeMatches) {
      this.state.attempts++;
      const left = MAX_ATTEMPTS - this.state.attempts;
      throw DomainError.validation('identity.wrong_code',
        left > 0 ? `Mã xác thực không đúng. Bạn còn ${left} lần thử.` : 'Bạn đã nhập sai quá nhiều lần. Hãy gửi lại mã mới.');
    }
    this.state.consumedAt = now;
  }
}
