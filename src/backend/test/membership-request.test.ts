import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MembershipRequest } from '../src/modules/classroom/domain/membership-request.js';

test('a join request starts pending and is decided once', () => {
  const request = MembershipRequest.join('s1', 'c1', '  Em là học sinh lớp 10A  ');
  assert.equal(request.snapshot.status, 'PENDING');
  assert.equal(request.snapshot.message, 'Em là học sinh lớp 10A');
  request.approve('t1');
  assert.equal(request.snapshot.status, 'APPROVED');
  assert.equal(request.snapshot.decidedById, 't1');
  assert.throws(() => request.reject('t1'), /đã được xử lý/);
});

test('only the student who asked can cancel; an empty message is stored as none', () => {
  const request = MembershipRequest.leave('s1', 'c1', '   ');
  assert.equal(request.kind, 'LEAVE');
  assert.equal(request.snapshot.message, null);
  assert.throws(() => request.cancel('s2'), /của chính mình/);
  request.cancel('s1');
  assert.equal(request.snapshot.status, 'CANCELLED');
  assert.equal(request.snapshot.decidedById, null);
});

test('messages are limited to 500 characters', () => {
  assert.throws(() => MembershipRequest.join('s1', 'c1', 'x'.repeat(501)), /500/);
});
