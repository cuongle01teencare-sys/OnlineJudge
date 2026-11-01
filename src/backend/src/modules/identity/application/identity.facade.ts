import { Injectable } from '@nestjs/common';
import type { RegisterRequest, Role, VerificationTicketDto } from '@oj/contracts';
import { UserRepository } from '../domain/user.repository.js';
import { AccountService } from './account.service.js';

export interface UserSummary {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  role: Role;
}

/** Published interface of the Identity context (open host service). */
@Injectable()
export class IdentityFacade {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AccountService,
  ) {}

  async getUsers(ids: string[]): Promise<Map<string, UserSummary>> {
    return new Map((await this.users.findByIds([...new Set(ids)])).map((u) => [u.id, summary(u)]));
  }

  async listByRole(role: Role): Promise<UserSummary[]> {
    return (await this.users.findByRole(role)).map(summary);
  }

  /** Starts student sign-up into an already-resolved class. */
  requestStudentRegistration(input: Omit<RegisterRequest, 'classCode'>, classId: string): Promise<VerificationTicketDto> {
    return this.accounts.requestRegistration(input, classId);
  }
}

function summary(u: { id: string; displayName: string; email: { value: string }; phone: { value: string } | null; role: Role }): UserSummary {
  return { id: u.id, displayName: u.displayName, email: u.email.value, phone: u.phone?.value ?? null, role: u.role };
}
