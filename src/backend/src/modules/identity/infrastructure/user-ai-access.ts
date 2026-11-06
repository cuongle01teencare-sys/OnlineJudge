import { Injectable } from '@nestjs/common';
import { AiAccess } from '../../../shared/application/ai-access.js';
import { UserRepository } from '../domain/user.repository.js';

/** AI access read from the account itself (administrators and VIP teachers). */
@Injectable()
export class UserAiAccess extends AiAccess {
  constructor(private readonly users: UserRepository) {
    super();
  }

  async allows(userId: string): Promise<boolean> {
    return (await this.users.findById(userId))?.canUseAi ?? false;
  }
}
