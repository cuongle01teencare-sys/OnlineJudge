import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { VerificationTicketDto } from '@oj/contracts';
import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Verification } from '../domain/verification.js';
import { VerificationRepository } from '../domain/user.repository.js';
import { PasswordHasher } from './ports.js';

/** Generates/checks one-time codes and records attempts on Verification aggregates. */
@Injectable()
export class OneTimeCodes {
  constructor(
    private readonly hasher: PasswordHasher,
    private readonly verifications: VerificationRepository,
  ) {}

  /** Returns the plain code (to email) and its hash (to store). */
  async generate(): Promise<{ code: string; hash: string }> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    return { code, hash: await this.hasher.hash(code) };
  }

  async load(id: string): Promise<Verification> {
    const verification = await this.verifications.findById(id);
    if (!verification) {
      throw DomainError.validation('identity.invalid_code', 'Mã xác thực không đúng hoặc đã hết hạn. Hãy gửi lại mã.');
    }
    return verification;
  }

  /** Checks the code; failed attempts are persisted before the error propagates. */
  async check(verification: Verification, code: string): Promise<void> {
    const matches = verification.isUsable() && (await this.hasher.verify(code.trim(), verification.snapshot.codeHash));
    try {
      verification.attempt(matches);
    } finally {
      await this.verifications.save(verification);
    }
  }
}

export function toTicket(v: Verification): VerificationTicketDto {
  return {
    verificationId: v.id,
    email: v.snapshot.email.value,
    expiresAt: v.snapshot.expiresAt.toISOString(),
    resendAvailableAt: v.resendAvailableAt.toISOString(),
  };
}
