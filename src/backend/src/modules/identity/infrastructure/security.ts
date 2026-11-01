import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@oj/contracts';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Actor } from '../../../shared/application/actor.js';
import { PasswordHasher, TokenService } from '../application/ports.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** scrypt-based hasher (no native dependencies). Format: scrypt$<salt hex>$<hash hex> */
@Injectable()
export class ScryptPasswordHasher extends PasswordHasher {
  async hash(plain: string) {
    const salt = randomBytes(16);
    const hash = await scrypt(plain, salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  }

  async verify(plain: string, stored: string) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(plain, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(actual, expected);
  }
}

@Injectable()
export class JwtTokenService extends TokenService {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(actor: Actor) {
    return this.jwt.signAsync({ sub: actor.id, role: actor.role, name: actor.name });
  }

  async verify(token: string): Promise<Actor | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role; name: string }>(token);
      return { id: payload.sub, role: payload.role, name: payload.name };
    } catch {
      return null;
    }
  }
}
