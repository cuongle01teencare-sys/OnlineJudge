import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Role } from '@oj/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { Email, Phone, User } from '../domain/user.js';
import { UserRepository, VerificationRepository } from '../domain/user.repository.js';
import { Verification, type VerificationPurpose } from '../domain/verification.js';
import { UserOrmEntity, VerificationOrmEntity } from './user.orm-entity.js';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? toUser(row) : null;
  }

  async findByEmail(email: Email) {
    const row = await this.repo.findOneBy({ email: email.value });
    return row ? toUser(row) : null;
  }

  async findAll() {
    return (await this.repo.find({ order: { createdAt: 'ASC' } })).map(toUser);
  }

  async findByIds(ids: string[]) {
    return ids.length ? (await this.repo.findBy({ id: In(ids) })).map(toUser) : [];
  }

  async findByRole(role: Role) {
    return (await this.repo.find({ where: { role }, order: { displayName: 'ASC' } })).map(toUser);
  }

  async adminExists() {
    return this.repo.existsBy({ role: 'ADMIN' });
  }

  async save(user: User) {
    await this.repo.save({
      id: user.id,
      email: user.email.value,
      displayName: user.displayName,
      phone: user.phone?.value ?? null,
      role: user.role,
      passwordHash: user.passwordHash,
      vip: user.vip,
      createdAt: user.createdAt,
    });
  }

  async delete(id: string) {
    await this.repo.delete({ id });
  }
}

function toUser(row: UserOrmEntity): User {
  return User.rehydrate(row.id, {
    email: Email.of(row.email),
    displayName: row.displayName,
    phone: row.phone ? Phone.of(row.phone) : null,
    role: row.role as Role,
    passwordHash: row.passwordHash,
    vip: row.vip ?? false,
    createdAt: row.createdAt,
  });
}

@Injectable()
export class TypeOrmVerificationRepository extends VerificationRepository {
  constructor(@InjectRepository(VerificationOrmEntity) private readonly repo: Repository<VerificationOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? toVerification(row) : null;
  }

  async findOpen(email: Email, purpose: VerificationPurpose) {
    const row = await this.repo.findOne({
      where: { email: email.value, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return row ? toVerification(row) : null;
  }

  async findOpenByPurpose(purpose: VerificationPurpose) {
    const rows = await this.repo.find({ where: { purpose, consumedAt: IsNull() }, order: { createdAt: 'DESC' } });
    return rows.map(toVerification);
  }

  async save(v: Verification) {
    const s = v.snapshot;
    await this.repo.save({
      id: v.id,
      purpose: s.purpose,
      email: s.email.value,
      payload: s.payload,
      codeHash: s.codeHash,
      attempts: s.attempts,
      expiresAt: s.expiresAt,
      lastSentAt: s.lastSentAt,
      consumedAt: s.consumedAt,
      createdAt: s.createdAt,
    });
  }

  async delete(id: string) {
    await this.repo.delete({ id });
  }
}

function toVerification(row: VerificationOrmEntity): Verification {
  return Verification.rehydrate(row.id, {
    purpose: row.purpose as VerificationPurpose,
    email: Email.of(row.email),
    payload: row.payload,
    codeHash: row.codeHash,
    attempts: row.attempts,
    expiresAt: row.expiresAt,
    lastSentAt: row.lastSentAt,
    consumedAt: row.consumedAt,
    createdAt: row.createdAt,
  });
}
