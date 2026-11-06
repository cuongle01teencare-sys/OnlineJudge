import { Injectable, Logger } from '@nestjs/common';
import type { AuthResponse, RegisterRequest, UserDto, VerificationTicketDto } from '@oj/contracts';
import { randomUUID } from 'node:crypto';
import type { Actor } from '../../../shared/application/actor.js';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import { STUDENT_REGISTERED, type StudentRegisteredEvent } from '../identity.events.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';
import { DisplayName, Email, Phone, User } from '../domain/user.js';
import { UserRepository, VerificationRepository } from '../domain/user.repository.js';
import { RESEND_COOLDOWN_MS, Verification, VERIFICATION_POLICY } from '../domain/verification.js';
import { OneTimeCodes, toTicket } from './one-time-codes.js';
import { IdentityMailer, PasswordHasher, TokenService } from './ports.js';

export function validatePassword(password: string): void {
  assert(password.length >= 6 && password.length <= 128, 'identity.weak_password', 'Mật khẩu phải có ít nhất 6 ký tự.');
}

/** Use cases of a person acting on their own account: sign-up, sign-in, password reset. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly verifications: VerificationRepository,
    private readonly codes: OneTimeCodes,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly mailer: IdentityMailer,
    private readonly events: EventPublisher,
  ) {}

  // ---------- Student sign-up (2 steps) ----------

  /** `classId` (optional) was resolved from the class code by the Classroom context. */
  async requestRegistration(input: Omit<RegisterRequest, 'classCode'>, classId: string | null): Promise<VerificationTicketDto> {
    const email = Email.of(input.email);
    const displayName = DisplayName.of(input.displayName);
    const phone = Phone.optional(input.phone);
    validatePassword(input.password);
    await this.ensureEmailFree(email);

    const previous = await this.verifications.findOpen(email, 'REGISTER_STUDENT');
    if (previous) {
      if (new Date() < previous.resendAvailableAt) {
        throw DomainError.conflict('identity.resend_too_soon', 'Mã vừa được gửi tới email này. Vui lòng đợi 1 phút rồi thử lại.');
      }
      await this.verifications.delete(previous.id);
    }

    const { code, hash } = await this.codes.generate();
    const verification = Verification.issue('REGISTER_STUDENT', email, {
      displayName: displayName.value,
      phone: phone?.value ?? null,
      classId: classId ?? undefined,
      passwordHash: await this.hasher.hash(input.password),
    }, hash);
    await this.verifications.save(verification);
    await this.mailer.sendRegistrationCode(email.value, displayName.value, code, verification.snapshot.expiresAt);
    return toTicket(verification);
  }

  async completeRegistration(verificationId: string, code: string): Promise<AuthResponse> {
    const verification = await this.codes.load(verificationId);
    verification.ensurePurpose('REGISTER_STUDENT');
    await this.codes.check(verification, code);

    const { email, payload } = verification.snapshot;
    await this.ensureEmailFree(email);
    const user = User.registerStudent({
      email,
      displayName: DisplayName.of(payload.displayName ?? ''),
      phone: Phone.optional(payload.phone),
      passwordHash: payload.passwordHash!,
    });
    await this.users.save(user);
    const event: StudentRegisteredEvent = { name: STUDENT_REGISTERED, occurredAt: new Date(), userId: user.id, classId: payload.classId ?? null };
    await this.events.publish([event]);
    return this.authResponse(user);
  }

  /** "Send again" for sign-up and password reset codes. */
  async resendCode(verificationId: string): Promise<VerificationTicketDto> {
    const verification = await this.codes.load(verificationId);
    const { purpose, email, payload } = verification.snapshot;
    assert(purpose !== 'INVITE_TEACHER', 'identity.invalid_code', 'Lời mời giáo viên chỉ được gửi lại bởi quản trị viên.');
    const { code, hash } = await this.codes.generate();
    verification.reissue(hash);
    await this.verifications.save(verification);

    const name = payload.displayName ?? (await this.users.findByEmail(email))?.displayName ?? '';
    const expiresAt = verification.snapshot.expiresAt;
    if (purpose === 'REGISTER_STUDENT') await this.mailer.sendRegistrationCode(email.value, name, code, expiresAt);
    else await this.mailer.sendPasswordResetCode(email.value, name, code, expiresAt);
    return toTicket(verification);
  }

  // ---------- Sign-in ----------

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(Email.of(email));
    if (!user || !(await this.hasher.verify(password, user.passwordHash))) {
      throw DomainError.unauthorized('identity.bad_credentials', 'Email hoặc mật khẩu không đúng.');
    }
    return this.authResponse(user);
  }

  async me(actor: Actor): Promise<UserDto> {
    const user = await this.users.findById(actor.id);
    if (!user) throw DomainError.unauthorized('identity.user_gone', 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.');
    return toUserDto(user);
  }

  // ---------- Password reset ----------

  /** Always answers with a ticket so the response does not reveal whether the email has an account. */
  async forgotPassword(rawEmail: string): Promise<VerificationTicketDto> {
    const email = Email.of(rawEmail);
    const user = await this.users.findByEmail(email);
    if (!user) return decoyTicket(email);

    const { code, hash } = await this.codes.generate();
    let verification = await this.verifications.findOpen(email, 'RESET_PASSWORD');
    if (verification) verification.reissue(hash);
    else verification = Verification.issue('RESET_PASSWORD', email, {}, hash);
    await this.verifications.save(verification);
    await this.mailer.sendPasswordResetCode(email.value, user.displayName, code, verification.snapshot.expiresAt);
    return toTicket(verification);
  }

  async resetPassword(verificationId: string, code: string, newPassword: string): Promise<AuthResponse> {
    validatePassword(newPassword);
    const verification = await this.codes.load(verificationId);
    verification.ensurePurpose('RESET_PASSWORD');
    await this.codes.check(verification, code);

    const user = await this.users.findByEmail(verification.snapshot.email);
    if (!user) throw DomainError.notFound('identity.user_not_found', 'Không tìm thấy tài khoản.');
    user.changePassword(await this.hasher.hash(newPassword));
    await this.users.save(user);
    return this.authResponse(user);
  }

  // ---------- Bootstrap ----------

  /** Guarantees the system has exactly one administrator (created from configuration). */
  async ensureAdmin(email: string, password: string, displayName: string): Promise<void> {
    if (await this.users.adminExists()) return;
    const admin = User.bootstrapAdmin({
      email: Email.of(email),
      displayName: DisplayName.of(displayName),
      phone: null,
      passwordHash: await this.hasher.hash(password),
    });
    await this.users.save(admin);
    this.logger.log(`Created administrator account ${admin.email.value}`);
  }

  private async ensureEmailFree(email: Email) {
    if (await this.users.findByEmail(email)) {
      throw DomainError.conflict('identity.email_taken', 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng "Quên mật khẩu".');
    }
  }

  private async authResponse(user: User): Promise<AuthResponse> {
    const accessToken = await this.tokens.issue({ id: user.id, role: user.role, name: user.displayName });
    return { accessToken, user: toUserDto(user) };
  }
}

function decoyTicket(email: Email): VerificationTicketDto {
  const now = Date.now();
  return {
    verificationId: randomUUID(),
    email: email.value,
    expiresAt: new Date(now + VERIFICATION_POLICY.RESET_PASSWORD.ttlMs).toISOString(),
    resendAvailableAt: new Date(now + RESEND_COOLDOWN_MS).toISOString(),
  };
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email.value,
    displayName: user.displayName,
    role: user.role,
    phone: user.phone?.value ?? null,
    createdAt: user.createdAt.toISOString(),
    vip: user.vip,
    canUseAi: user.canUseAi,
  };
}
