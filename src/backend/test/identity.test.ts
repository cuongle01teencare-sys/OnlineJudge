import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '../src/shared/domain/domain-error.js';
import { Email, Phone } from '../src/modules/identity/domain/user.js';
import { MAX_ATTEMPTS, Verification } from '../src/modules/identity/domain/verification.js';

const email = Email.of('An@Truong.edu.vn');

test('phone numbers are normalised to 0xxxxxxxxx', () => {
  assert.equal(Phone.of('+84 912.345.678').value, '0912345678');
  assert.equal(Phone.optional('  '), null);
  assert.throws(() => Phone.of('12345'), DomainError);
});

test('verification is single-use', () => {
  const v = Verification.issue('REGISTER_STUDENT', email, {}, 'hash');
  v.attempt(true);
  assert.throws(() => v.attempt(true), /hết hạn/);
});

test('verification locks after too many wrong codes until a new code is sent', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const v = Verification.issue('RESET_PASSWORD', email, {}, 'hash', t0);
  for (let i = 1; i < MAX_ATTEMPTS; i++) assert.throws(() => v.attempt(false, t0), /còn \d lần/);
  assert.throws(() => v.attempt(false, t0), /quá nhiều lần/);
  assert.throws(() => v.attempt(true, t0), /hết hạn/);

  assert.throws(() => v.reissue('hash2', new Date(t0.getTime() + 30_000)), /đợi 30 giây/);
  const t1 = new Date(t0.getTime() + 61_000);
  v.reissue('hash2', t1);
  v.attempt(true, t1);
});

test('verification expires', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const v = Verification.issue('REGISTER_STUDENT', email, {}, 'hash', t0);
  assert.throws(() => v.attempt(true, new Date(t0.getTime() + 11 * 60_000)), /hết hạn/);
  const invite = Verification.issue('INVITE_TEACHER', email, {}, 'hash', t0);
  assert.ok(invite.isUsable(new Date(t0.getTime() + 6 * 24 * 3600_000)));
});
