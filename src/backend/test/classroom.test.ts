import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Actor } from '../src/shared/application/actor.js';
import { DomainError } from '../src/shared/domain/domain-error.js';
import { ClassCode, Classroom, Enrollment } from '../src/modules/classroom/domain/classroom.js';

const admin: Actor = { id: 'a', role: 'ADMIN', name: 'Admin' };
const lan: Actor = { id: 't1', role: 'TEACHER', name: 'Cô Lan' };
const minh: Actor = { id: 't2', role: 'TEACHER', name: 'Thầy Minh' };

test('class code accepts meaningful codes like 22DTHC5, case-insensitive', () => {
  assert.equal(ClassCode.of(' 22dthc5 ').value, '22DTHC5');
  assert.equal(ClassCode.of('K22-TIN').value, 'K22-TIN');
  assert.throws(() => ClassCode.of('Lớp 11A'), DomainError);
  assert.throws(() => ClassCode.of('abc'), DomainError);
});

test('only the class teacher or the admin manages a class', () => {
  const c = Classroom.open('22DTHC5 – Lập trình C', ClassCode.of('22DTHC5'), lan.id);
  assert.ok(c.isManagedBy(lan) && c.isManagedBy(admin) && !c.isManagedBy(minh));
  assert.throws(() => c.ensureManageableBy(minh), /giáo viên phụ trách/);
});

test('archive makes the class read-only; restore reopens it', () => {
  const c = Classroom.open('Lớp A', ClassCode.of('LOPA'), lan.id);
  c.archive();
  assert.equal(c.status, 'ARCHIVED');
  assert.throws(() => c.rename('Lớp B'), /lưu trữ/);
  c.restore();
  c.rename('Lớp B');
  assert.equal(c.name, 'Lớp B');
});

test('deleting for good requires an archived class and the exact name; scheduling works', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const c = Classroom.open('Lớp A', ClassCode.of('LOPA'), lan.id);
  assert.throws(() => c.purge('Lớp A'), /lưu trữ lớp trước/);
  assert.throws(() => c.scheduleDeletion(30, t0), /lưu trữ lớp trước/);
  c.archive(t0);
  c.scheduleDeletion(30, t0);
  assert.ok(!c.isDueForPurge(new Date(t0.getTime() + 29 * 86_400_000)));
  assert.ok(c.isDueForPurge(new Date(t0.getTime() + 30 * 86_400_000)));
  c.cancelDeletion();
  assert.ok(!c.isDueForPurge(new Date(t0.getTime() + 99 * 86_400_000)));
  assert.throws(() => c.purge('Lop A'), /không khớp/);
  c.purge('Lớp A');
  assert.equal(c.pullEvents()[0].name, 'classroom.class-purged');
});

test('a membership ends when the student leaves and can be reopened', () => {
  const e = Enrollment.enroll('s1', 'c1');
  assert.ok(e.isOpen);
  e.end();
  assert.ok(!e.isOpen && e.endedAt);
  e.reopen();
  assert.ok(e.isOpen);
});
