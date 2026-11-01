import type { MembershipRequestKind, MembershipRequestStatus } from '@oj/contracts';
import { AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';

export interface MembershipRequestState {
  kind: MembershipRequestKind;
  status: MembershipRequestStatus;
  studentId: string;
  classId: string;
  message: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  decidedById: string | null;
}

/**
 * A student's request to join or to leave a class. Students never change their memberships
 * themselves: the class teacher (or the admin) approves or rejects. PENDING is the only open state.
 */
export class MembershipRequest extends AggregateRoot {
  private constructor(id: string, private state: MembershipRequestState) {
    super(id);
  }

  static join(studentId: string, classId: string, message?: string | null): MembershipRequest {
    return MembershipRequest.open('JOIN', studentId, classId, message);
  }

  static leave(studentId: string, classId: string, message?: string | null): MembershipRequest {
    return MembershipRequest.open('LEAVE', studentId, classId, message);
  }

  private static open(kind: MembershipRequestKind, studentId: string, classId: string, message?: string | null) {
    return new MembershipRequest(newId(), {
      kind,
      status: 'PENDING',
      studentId,
      classId,
      message: validMessage(message),
      createdAt: new Date(),
      decidedAt: null,
      decidedById: null,
    });
  }

  static rehydrate(id: string, state: MembershipRequestState): MembershipRequest {
    return new MembershipRequest(id, state);
  }

  get snapshot(): Readonly<MembershipRequestState> {
    return this.state;
  }

  get kind() { return this.state.kind; }
  get studentId() { return this.state.studentId; }
  get classId() { return this.state.classId; }
  get isPending() { return this.state.status === 'PENDING'; }

  approve(deciderId: string, now = new Date()): void {
    this.decide('APPROVED', deciderId, now);
  }

  reject(deciderId: string, now = new Date()): void {
    this.decide('REJECTED', deciderId, now);
  }

  /** Withdrawn by the student who sent it. */
  cancel(studentId: string, now = new Date()): void {
    if (studentId !== this.state.studentId) {
      throw DomainError.forbidden('classroom.request_not_yours', 'Bạn chỉ có thể hủy yêu cầu của chính mình.');
    }
    this.decide('CANCELLED', null, now);
  }

  private decide(status: MembershipRequestStatus, deciderId: string | null, now: Date) {
    if (!this.isPending) {
      throw DomainError.conflict('classroom.request_closed', 'Yêu cầu này đã được xử lý.');
    }
    this.state = { ...this.state, status, decidedAt: now, decidedById: deciderId };
  }
}

function validMessage(message?: string | null): string | null {
  const value = message?.trim() ?? '';
  assert(value.length <= 500, 'classroom.invalid_message', 'Lời nhắn tối đa 500 ký tự.');
  return value || null;
}
