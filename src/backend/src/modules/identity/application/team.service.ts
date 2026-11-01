import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthResponse,
  InvitationDto,
  InvitationPreviewDto,
  InviteTeacherRequest,
  UserDto,
} from '@oj/contracts';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { USER_DELETED, type UserDeletedEvent } from '../identity.events.js';
import { DisplayName, Email, Phone, User } from '../domain/user.js';
import { UserRepository, VerificationRepository } from '../domain/user.repository.js';
import { Verification } from '../domain/verification.js';
import { toUserDto, validatePassword } from './account.service.js';
import { OneTimeCodes } from './one-time-codes.js';
import { IdentityMailer, PasswordHasher, TokenService } from './ports.js';

/** Admin use cases: the user list and teacher invitations (teacher accepts and sets their own password). */
@Injectable()
export class TeamService {
  private readonly frontendUrl: string;

  constructor(
    private readonly users: UserRepository,
    private readonly verifications: VerificationRepository,
    private readonly codes: OneTimeCodes,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly mailer: IdentityMailer,
    private readonly events: EventPublisher,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  async listUsers(): Promise<UserDto[]> {
    return (await this.users.findAll()).map(toUserDto);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw DomainError.notFound('identity.user_not_found', 'Không tìm thấy người dùng.');
    user.ensureDeletable();
    await this.users.delete(id);
    const event: UserDeletedEvent = { name: USER_DELETED, occurredAt: new Date(), userId: id, role: user.role };
    await this.events.publish([event]);
  }

  // ---------- Invitations ----------

  async invite(input: InviteTeacherRequest): Promise<InvitationDto> {
    const email = Email.of(input.email);
    const displayName = DisplayName.of(input.displayName);
    const phone = Phone.optional(input.phone);
    if (await this.users.findByEmail(email)) {
      throw DomainError.conflict('identity.email_taken', 'Email này đã có tài khoản.');
    }
    if (await this.verifications.findOpen(email, 'INVITE_TEACHER')) {
      throw DomainError.conflict('identity.already_invited', 'Đã có lời mời cho email này. Hãy dùng "Gửi lại lời mời".');
    }
    const { code, hash } = await this.codes.generate();
    const invitation = Verification.issue('INVITE_TEACHER', email, { displayName: displayName.value, phone: phone?.value ?? null }, hash);
    await this.verifications.save(invitation);
    await this.send(invitation, code);
    return toInvitationDto(invitation);
  }

  async listInvitations(): Promise<InvitationDto[]> {
    return (await this.verifications.findOpenByPurpose('INVITE_TEACHER')).map(toInvitationDto);
  }

  async resendInvitation(id: string): Promise<InvitationDto> {
    const invitation = await this.loadInvitation(id);
    const { code, hash } = await this.codes.generate();
    invitation.reissue(hash);
    await this.verifications.save(invitation);
    await this.send(invitation, code);
    return toInvitationDto(invitation);
  }

  async cancelInvitation(id: string): Promise<void> {
    await this.loadInvitation(id);
    await this.verifications.delete(id);
  }

  async previewInvitation(id: string): Promise<InvitationPreviewDto> {
    const invitation = await this.loadInvitation(id);
    if (!invitation.isUsable()) {
      throw DomainError.validation('identity.invitation_expired', 'Lời mời đã hết hạn hoặc đã được dùng. Hãy nhờ quản trị viên gửi lại.');
    }
    const s = invitation.snapshot;
    return { email: s.email.value, displayName: s.payload.displayName ?? '', expiresAt: s.expiresAt.toISOString() };
  }

  async acceptInvitation(id: string, code: string, password: string): Promise<AuthResponse> {
    validatePassword(password);
    const invitation = await this.loadInvitation(id);
    await this.codes.check(invitation, code);

    const { email, payload } = invitation.snapshot;
    if (await this.users.findByEmail(email)) {
      throw DomainError.conflict('identity.email_taken', 'Email này đã có tài khoản. Hãy đăng nhập.');
    }
    const user = User.acceptTeacherInvitation({
      email,
      displayName: DisplayName.of(payload.displayName ?? ''),
      phone: Phone.optional(payload.phone),
      passwordHash: await this.hasher.hash(password),
    });
    await this.users.save(user);
    const accessToken = await this.tokens.issue({ id: user.id, role: user.role, name: user.displayName });
    return { accessToken, user: toUserDto(user) };
  }

  private async loadInvitation(id: string): Promise<Verification> {
    const invitation = await this.verifications.findById(id);
    if (!invitation || invitation.snapshot.purpose !== 'INVITE_TEACHER') {
      throw DomainError.notFound('identity.invitation_not_found', 'Không tìm thấy lời mời.');
    }
    return invitation;
  }

  private send(invitation: Verification, code: string) {
    const s = invitation.snapshot;
    const url = `${this.frontendUrl}/invite?id=${invitation.id}&code=${code}`;
    return this.mailer.sendTeacherInvitation(s.email.value, s.payload.displayName ?? '', url, code, s.expiresAt);
  }
}

function toInvitationDto(v: Verification): InvitationDto {
  const s = v.snapshot;
  return {
    id: v.id,
    email: s.email.value,
    displayName: s.payload.displayName ?? '',
    phone: s.payload.phone ?? null,
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  };
}
