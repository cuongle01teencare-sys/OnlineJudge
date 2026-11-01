import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  ClassroomDto,
  ClassStudentDto,
  MembershipRequestDto,
  RegisterRequest,
  UpsertClassroomRequest,
  VerificationTicketDto,
} from '@oj/contracts';
import { isStaff, type Actor } from '../../../shared/application/actor.js';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import {
  STUDENT_REGISTERED,
  USER_DELETED,
  type StudentRegisteredEvent,
  type UserDeletedEvent,
} from '../../identity/identity.events.js';
import { ClassCode, Classroom, Enrollment } from '../domain/classroom.js';
import { ClassroomRepository, EnrollmentRepository, MembershipRequestRepository } from '../domain/classroom.repository.js';
import { MembershipRequest } from '../domain/membership-request.js';
import { PeopleDirectory, type Person } from './ports.js';

const PURGE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MY_REQUESTS_LIMIT = 30;

@Injectable()
export class ClassroomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClassroomService.name);
  private purgeTimer?: NodeJS.Timeout;

  constructor(
    private readonly classes: ClassroomRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly requests: MembershipRequestRepository,
    private readonly people: PeopleDirectory,
    private readonly events: EventPublisher,
  ) {}

  // ---------- Queries ----------

  /** Admin: all classes. Teacher: classes they teach. Student: current classes and history. */
  async list(actor: Actor): Promise<ClassroomDto[]> {
    if (actor.role === 'ADMIN') return this.toDtos(await this.classes.findAll(), actor);
    if (actor.role === 'TEACHER') return this.toDtos(await this.classes.findByTeacher(actor.id), actor);
    const memberships = await this.enrollments.findByStudent(actor.id);
    const classes = await this.classes.findByIds(memberships.map((m) => m.classId));
    return this.toDtos(classes, actor, memberships);
  }

  async get(actor: Actor, id: string): Promise<ClassroomDto> {
    const classroom = await this.load(id);
    if (classroom.isManagedBy(actor)) return (await this.toDtos([classroom], actor))[0];
    const membership = await this.enrollments.find(actor.id, id);
    if (!membership) throw notFound();
    return (await this.toDtos([classroom], actor, [membership]))[0];
  }

  async roster(actor: Actor, id: string): Promise<ClassStudentDto[]> {
    const classroom = await this.load(id);
    classroom.ensureManageableBy(actor);
    const open = await this.enrollments.findOpenByClass(id);
    const people = await this.people.getPeople(open.map((e) => e.studentId));
    return open.filter((e) => people.has(e.studentId)).map((e) => toStudentDto(people.get(e.studentId)!, e)).sort(byName);
  }

  /** Students without any current class (free candidates, or their classes were archived). Admin only. */
  async unassigned(): Promise<ClassStudentDto[]> {
    const [students, open, active] = await Promise.all([
      this.people.listByRole('STUDENT'),
      this.enrollments.findAllOpen(),
      this.classes.findAll(),
    ]);
    const activeIds = new Set(active.filter((c) => c.isActive).map((c) => c.id));
    const current = new Set(open.filter((e) => activeIds.has(e.classId)).map((e) => e.studentId));
    return students.filter((s) => !current.has(s.id)).map((s) => toStudentDto(s, null)).sort(byName);
  }

  // ---------- Commands ----------

  async create(actor: Actor, input: UpsertClassroomRequest): Promise<ClassroomDto> {
    if (!isStaff(actor)) throw DomainError.forbidden('classroom.not_staff', 'Chỉ giáo viên mới được tạo lớp.');
    const teacherId = actor.role === 'ADMIN' && input.teacherId ? input.teacherId : actor.id;
    await this.ensureStaff(teacherId);
    const code = ClassCode.of(input.code);
    await this.ensureCodeFree(code);
    const classroom = Classroom.open(input.name, code, teacherId);
    await this.classes.save(classroom);
    return (await this.toDtos([classroom], actor))[0];
  }

  async update(actor: Actor, id: string, input: UpsertClassroomRequest): Promise<ClassroomDto> {
    const classroom = await this.loadManaged(actor, id);
    classroom.rename(input.name);
    const code = ClassCode.of(input.code);
    if (code.value !== classroom.code.value) {
      await this.ensureCodeFree(code);
      classroom.changeCode(code);
    }
    if (input.teacherId && input.teacherId !== classroom.teacherId) {
      if (actor.role !== 'ADMIN') {
        throw DomainError.forbidden('classroom.only_admin_reassigns', 'Chỉ quản trị viên được đổi giáo viên phụ trách lớp.');
      }
      await this.ensureStaff(input.teacherId);
      classroom.assignTeacher(input.teacherId);
    }
    await this.classes.save(classroom);
    return (await this.toDtos([classroom], actor))[0];
  }

  async archive(actor: Actor, id: string): Promise<ClassroomDto> {
    const classroom = await this.loadManaged(actor, id);
    classroom.archive();
    await this.classes.save(classroom);
    return (await this.toDtos([classroom], actor))[0];
  }

  async restore(actor: Actor, id: string): Promise<ClassroomDto> {
    const classroom = await this.loadManaged(actor, id);
    classroom.restore();
    await this.classes.save(classroom);
    return (await this.toDtos([classroom], actor))[0];
  }

  async scheduleDeletion(actor: Actor, id: string, days: number): Promise<ClassroomDto> {
    const classroom = await this.loadManaged(actor, id);
    classroom.scheduleDeletion(days);
    await this.classes.save(classroom);
    return (await this.toDtos([classroom], actor))[0];
  }

  async cancelDeletion(actor: Actor, id: string): Promise<ClassroomDto> {
    const classroom = await this.loadManaged(actor, id);
    classroom.cancelDeletion();
    await this.classes.save(classroom);
    return (await this.toDtos([classroom], actor))[0];
  }

  async deleteNow(actor: Actor, id: string, confirmName: string): Promise<void> {
    const classroom = await this.loadManaged(actor, id);
    await this.purge(classroom, confirmName);
  }

  /** Teacher/admin puts a student into the class directly. The student's other classes are not affected. */
  async addStudent(actor: Actor, studentId: string, classId: string): Promise<ClassStudentDto> {
    const student = (await this.people.getPeople([studentId])).get(studentId);
    return this.admit(actor, classId, student ?? null);
  }

  async addStudentByEmail(actor: Actor, classId: string, email: string): Promise<ClassStudentDto> {
    return this.admit(actor, classId, await this.people.findByEmail(email));
  }

  /** Teacher/admin takes a student out of the class. History and code stay with the student. */
  async removeStudent(actor: Actor, classId: string, studentId: string): Promise<void> {
    const classroom = await this.loadManaged(actor, classId);
    classroom.ensureActive();
    const membership = await this.enrollments.find(studentId, classId);
    if (!membership?.isOpen) throw DomainError.notFound('classroom.not_member', 'Học sinh không còn ở lớp này.');
    membership.end();
    await this.enrollments.save(membership);
    await this.closePending(studentId, classId, actor.id);
  }

  /** Student sign-up step 1: resolve the optional class code, then let Identity send the OTP. */
  async startRegistration(input: RegisterRequest): Promise<VerificationTicketDto> {
    const { classCode, ...account } = input;
    const classroom = classCode?.trim() ? await this.findJoinable(classCode) : null;
    return this.people.startStudentRegistration(account, classroom?.id ?? null);
  }

  // ---------- Join / leave requests (students ask, the teacher decides) ----------

  async requestJoin(actor: Actor, classCode: string, message?: string | null): Promise<MembershipRequestDto> {
    ensureStudent(actor);
    const classroom = await this.findJoinable(classCode);
    if ((await this.enrollments.find(actor.id, classroom.id))?.isOpen) {
      throw DomainError.conflict('classroom.already_member', `Bạn đã ở trong lớp ${classroom.name}.`);
    }
    if (await this.requests.findPending(actor.id, classroom.id, 'JOIN')) {
      throw DomainError.conflict('classroom.request_exists', `Bạn đã gửi yêu cầu vào lớp ${classroom.name}, hãy chờ giáo viên duyệt.`);
    }
    const request = MembershipRequest.join(actor.id, classroom.id, message);
    await this.requests.save(request);
    return (await this.toRequestDtos([request]))[0];
  }

  async requestLeave(actor: Actor, classId: string, message?: string | null): Promise<MembershipRequestDto> {
    ensureStudent(actor);
    const classroom = await this.load(classId);
    if (!(await this.enrollments.find(actor.id, classId))?.isOpen) throw notFound();
    classroom.ensureActive();
    if (await this.requests.findPending(actor.id, classId, 'LEAVE')) {
      throw DomainError.conflict('classroom.request_exists', 'Bạn đã gửi yêu cầu rời lớp này, hãy chờ giáo viên duyệt.');
    }
    const request = MembershipRequest.leave(actor.id, classId, message);
    await this.requests.save(request);
    return (await this.toRequestDtos([request]))[0];
  }

  async cancelRequest(actor: Actor, id: string): Promise<MembershipRequestDto> {
    const request = await this.requests.findById(id);
    if (!request) throw requestNotFound();
    request.cancel(actor.id);
    await this.requests.save(request);
    return (await this.toRequestDtos([request]))[0];
  }

  async myRequests(actor: Actor): Promise<MembershipRequestDto[]> {
    ensureStudent(actor);
    return this.toRequestDtos(await this.requests.findByStudent(actor.id, MY_REQUESTS_LIMIT));
  }

  /** Pending requests of a class, oldest first. */
  async classRequests(actor: Actor, classId: string): Promise<MembershipRequestDto[]> {
    await this.loadManaged(actor, classId);
    return this.toRequestDtos(await this.requests.findPendingByClass(classId));
  }

  async decide(actor: Actor, id: string, approve: boolean): Promise<MembershipRequestDto> {
    const request = await this.requests.findById(id);
    if (!request) throw requestNotFound();
    const classroom = await this.loadManaged(actor, request.classId);
    if (approve) {
      classroom.ensureActive();
      request.approve(actor.id);
      await this.applyApproved(request);
    } else {
      request.reject(actor.id);
    }
    await this.requests.save(request);
    return (await this.toRequestDtos([request]))[0];
  }

  /** Approves every pending join request of the class (e.g. right after handing out the code). */
  async approveAllJoins(actor: Actor, classId: string): Promise<number> {
    const classroom = await this.loadManaged(actor, classId);
    classroom.ensureActive();
    const joins = (await this.requests.findPendingByClass(classId)).filter((r) => r.kind === 'JOIN');
    for (const request of joins) {
      request.approve(actor.id);
      await this.applyApproved(request);
      await this.requests.save(request);
    }
    return joins.length;
  }

  // ---------- Reactions to other contexts ----------

  /** A class code given at sign-up becomes a join request for the teacher to approve. */
  @OnEvent(STUDENT_REGISTERED, { async: true, promisify: true })
  async onStudentRegistered(event: StudentRegisteredEvent): Promise<void> {
    if (!event.classId) return;
    const classroom = await this.classes.findById(event.classId);
    if (!classroom?.isActive) {
      this.logger.warn(`Class ${event.classId} is gone or archived; no join request for student ${event.userId}`);
      return;
    }
    await this.requests.save(MembershipRequest.join(event.userId, event.classId));
  }

  /** Students lose their memberships; a deleted teacher's classes go to the administrator. */
  @OnEvent(USER_DELETED, { async: true, promisify: true })
  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    if (event.role === 'STUDENT') {
      await this.enrollments.deleteByStudent(event.userId);
      await this.requests.deleteByStudent(event.userId);
      return;
    }
    const orphaned = await this.classes.findByTeacher(event.userId);
    if (!orphaned.length) return;
    const [admin] = await this.people.listByRole('ADMIN');
    for (const classroom of orphaned) {
      classroom.assignTeacher(admin.id);
      await this.classes.save(classroom);
    }
  }

  // ---------- Scheduled deletion ----------

  onModuleInit() {
    this.purgeTimer = setInterval(() => void this.purgeDueClasses(), PURGE_CHECK_INTERVAL_MS);
    void this.purgeDueClasses();
  }

  onModuleDestroy() {
    clearInterval(this.purgeTimer);
  }

  async purgeDueClasses(now = new Date()): Promise<number> {
    let count = 0;
    try {
      for (const classroom of await this.classes.findDueForPurge(now)) {
        await this.purge(classroom, null);
        count++;
      }
    } catch (error) {
      this.logger.error(`Scheduled class deletion failed: ${(error as Error).message}`);
    }
    return count;
  }

  private async purge(classroom: Classroom, confirmName: string | null) {
    classroom.purge(confirmName);
    // Sessions and their content go first (subscribers), then the class itself.
    await this.events.publish(classroom.pullEvents());
    await this.enrollments.deleteByClass(classroom.id);
    await this.requests.deleteByClass(classroom.id);
    await this.classes.delete(classroom.id);
    this.logger.log(`Class ${classroom.name} (${classroom.id}) deleted for good`);
  }

  // ---------- Helpers ----------

  private async admit(actor: Actor, classId: string, student: Person | null): Promise<ClassStudentDto> {
    const classroom = await this.loadManaged(actor, classId);
    classroom.ensureActive();
    if (!student || student.role !== 'STUDENT') {
      throw DomainError.notFound('classroom.student_not_found', 'Không tìm thấy tài khoản học sinh này.');
    }
    const membership = await this.join(student.id, classId);
    await this.closePending(student.id, classId, actor.id);
    return toStudentDto(student, membership);
  }

  /** The teacher acted directly: pending requests of that student for this class are settled. */
  private async closePending(studentId: string, classId: string, deciderId: string) {
    for (const kind of ['JOIN', 'LEAVE'] as const) {
      const request = await this.requests.findPending(studentId, classId, kind);
      if (!request) continue;
      request.approve(deciderId);
      await this.requests.save(request);
    }
  }

  private async applyApproved(request: MembershipRequest) {
    if (request.kind === 'JOIN') {
      await this.join(request.studentId, request.classId);
      return;
    }
    const membership = await this.enrollments.find(request.studentId, request.classId);
    if (membership?.isOpen) {
      membership.end();
      await this.enrollments.save(membership);
    }
  }

  private async findJoinable(classCode: string): Promise<Classroom> {
    const classroom = await this.classes.findByCode(ClassCode.of(classCode));
    if (!classroom || !classroom.isActive) {
      throw DomainError.validation('classroom.wrong_code', 'Mã lớp không đúng hoặc lớp đã kết thúc. Hãy hỏi giáo viên để lấy mã lớp.');
    }
    return classroom;
  }

  /** Opens (or reopens) the student's membership of the class. Other classes are not affected. */
  private async join(studentId: string, classId: string): Promise<Enrollment> {
    let membership = await this.enrollments.find(studentId, classId);
    if (membership) {
      if (!membership.isOpen) membership.reopen();
    } else {
      membership = Enrollment.enroll(studentId, classId);
    }
    await this.enrollments.save(membership);
    return membership;
  }

  private async load(id: string): Promise<Classroom> {
    const classroom = await this.classes.findById(id);
    if (!classroom) throw notFound();
    return classroom;
  }

  private async loadManaged(actor: Actor, id: string): Promise<Classroom> {
    const classroom = await this.load(id);
    classroom.ensureManageableBy(actor);
    return classroom;
  }

  private async ensureCodeFree(code: ClassCode) {
    if (await this.classes.findByCode(code)) {
      throw DomainError.conflict('classroom.code_taken', `Mã lớp ${code.value} đã được dùng cho lớp khác.`);
    }
  }

  private async ensureStaff(userId: string) {
    const person = (await this.people.getPeople([userId])).get(userId);
    if (!person || person.role === 'STUDENT') {
      throw DomainError.validation('classroom.invalid_teacher', 'Giáo viên phụ trách phải là tài khoản giáo viên.');
    }
  }

  private async toDtos(classes: Classroom[], actor: Actor, memberships?: Enrollment[]): Promise<ClassroomDto[]> {
    const ids = classes.map((c) => c.id);
    const managed = classes.filter((c) => c.isManagedBy(actor)).map((c) => c.id);
    const [counts, pending, teachers] = await Promise.all([
      this.enrollments.countOpenByClass(ids),
      this.requests.countPendingByClass(managed),
      this.people.getPeople(classes.map((c) => c.teacherId)),
    ]);
    return classes.map((c) => {
      const membership = memberships?.find((m) => m.classId === c.id);
      return {
        id: c.id,
        name: c.name,
        code: c.isManagedBy(actor) ? c.code.value : null,
        status: c.status,
        teacherId: c.teacherId,
        teacherName: teachers.get(c.teacherId)?.displayName ?? '(không rõ)',
        studentCount: counts.get(c.id) ?? 0,
        archivedAt: c.archivedAt?.toISOString() ?? null,
        purgeAt: c.purgeAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        ...(membership ? { isCurrent: membership.isOpen && c.isActive } : {}),
        ...(c.isManagedBy(actor) ? { pendingRequestCount: pending.get(c.id) ?? 0 } : {}),
      };
    });
  }

  private async toRequestDtos(requests: MembershipRequest[]): Promise<MembershipRequestDto[]> {
    const classes = new Map((await this.classes.findByIds(requests.map((r) => r.classId))).map((c) => [c.id, c]));
    const people = await this.people.getPeople([
      ...requests.flatMap((r) => [r.studentId, r.snapshot.decidedById ?? '']),
      ...[...classes.values()].map((c) => c.teacherId),
    ].filter(Boolean));
    return requests.map((r) => {
      const s = r.snapshot;
      const classroom = classes.get(s.classId);
      const student = people.get(s.studentId);
      return {
        id: r.id,
        kind: s.kind,
        status: s.status,
        classId: s.classId,
        className: classroom?.name ?? '(lớp đã xóa)',
        teacherName: (classroom && people.get(classroom.teacherId)?.displayName) ?? '(không rõ)',
        studentId: s.studentId,
        studentName: student?.displayName ?? '(không rõ)',
        studentEmail: student?.email ?? '',
        message: s.message,
        createdAt: s.createdAt.toISOString(),
        decidedAt: s.decidedAt?.toISOString() ?? null,
        decidedByName: s.decidedById ? (people.get(s.decidedById)?.displayName ?? null) : null,
      };
    });
  }
}

const notFound = () => DomainError.notFound('classroom.not_found', 'Không tìm thấy lớp.');
const requestNotFound = () => DomainError.notFound('classroom.request_not_found', 'Không tìm thấy yêu cầu.');

function ensureStudent(actor: Actor) {
  if (actor.role !== 'STUDENT') {
    throw DomainError.forbidden('classroom.students_only', 'Chỉ học sinh mới gửi yêu cầu vào hoặc rời lớp.');
  }
}
const byName = (a: ClassStudentDto, b: ClassStudentDto) => a.displayName.localeCompare(b.displayName, 'vi');

function toStudentDto(person: Person, enrollment: Enrollment | null): ClassStudentDto {
  return {
    userId: person.id,
    displayName: person.displayName,
    email: person.email,
    phone: person.phone,
    classId: enrollment?.classId ?? null,
    enrolledAt: enrollment?.enrolledAt.toISOString() ?? null,
  };
}
