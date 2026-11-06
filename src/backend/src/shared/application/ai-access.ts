import { DomainError } from '../domain/domain-error.js';
import type { Actor } from './actor.js';

/**
 * Port: who may use the AI features. Only administrators and VIP teachers may; regular teacher accounts may not.
 * Implemented by the Identity context, which looks the account up on every call so an upgrade (or a downgrade)
 * applies at once, without signing in again.
 */
export abstract class AiAccess {
  abstract allows(userId: string): Promise<boolean>;

  /** Throws a 403 explaining the VIP requirement when the actor may not use AI. */
  async ensureAllowed(actor: Actor): Promise<void> {
    if (!(await this.allows(actor.id))) throw aiRequiresVip();
  }
}

export const aiRequiresVip = () =>
  DomainError.forbidden('ai.vip_required', 'Tính năng AI chỉ dành cho tài khoản giáo viên VIP. Hãy liên hệ quản trị viên để nâng cấp.');
