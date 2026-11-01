import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  ClassroomDto,
  ClassStudentDto,
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
import { ClassroomRepository, EnrollmentRepository } from '../domain/classroom.repository.js';
import { PeopleDirectory, type Person } from './ports.js';

const PURGE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class ClassroomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClassroomService.name);
  private purgeTimer?: NodeJS.Timeout;

  constructor(
    private readonly classes: ClassroomRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly people: PeopleDirectory,
    private readonly events: EventPublisher,
  ) {}

  // ---------- Queries ----------

  /** Admin: all classes. Teacher: classes they teach. Student: current class and history. */
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

  /** Students without a current class (e.g. their class was archived). Admin only. */
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

  /** Students who joined another class meanwhile stay there (one current class per student). */
  async restore(actor: Actor, id: string): Promise<ClassroomDto> {
    const classroom = await this.loadManaged(actor, id);
    classroom.restore();
    for (const membership of await this.enrollments.findOpenByClass(id)) {
      if (await this.currentClassId(membership.studentId, id)) {
        membership.end();
        await this.enrollments.save(membership);
      }
    }
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

  /** Assign a student to an active class, or move them from their current class. */
  async moveStudent(actor: Actor, studentId: string, classId: string): Promise<ClassStudentDto> {
    const target = await this.loadManaged(actor, classId);
    target.ensureActive();
    const student = (await this.people.getPeople([studentId])).get(studentId);
    if (!student || student.role !== 'STUDENT') {
      throw DomainError.notFound('classroom.student_not_found', 'Không tìm thấy học sinh.');
    }
    const currentId = await this.currentClassId(studentId);
    if (currentId && currentId !== classId) {
      const source = await this.classes.findById(currentId);
      if (source && !source.isManagedBy(actor)) {
        throw DomainError.forbidden('classroom.not_teacher', 'Học sinh đang ở lớp của giáo viên khác; hãy nhờ quản trị viên chuyển lớp.');
      }
    }
    const membership = await this.join(studentId, classId);
    return toStudentDto(student, membership);
  }

  /** Student sign-up step 1: resolve the class code, then let Identity send the OTP. */
  async startRegistration(input: RegisterRequest): Promise<VerificationTicketDto> {
    const classroom = await this.classes.findByCode(ClassCode.of(input.classCode));
    if (!classroom || !classroom.isActive) {
      throw DomainError.validation('classroom.wrong_code', 'Mã lớp không đúng hoặc lớp đã kết thúc. Hãy hỏi giáo viên để lấy mã lớp.');
    }
    const { classCode: _, ...account } = input;
    return this.people.startStudentRegistration(account, classroom.id);
  }

  // ---------- Reactions to other contexts ----------

  @OnEvent(STUDENT_REGISTERED, { async: true, promisify: true })
  async onStudentRegistered(event: StudentRegisteredEvent): Promise<void> {
    const classroom = await this.classes.findById(event.classId);
    if (!classroom?.isActive) {
      this.logger.warn(`Class ${event.classId} is gone or archived; student ${event.userId} stays unassigned`);
      return;
    }
    await this.join(event.userId, event.classId);
  }

  /** Students lose their memberships; a deleted teacher's classes go to the administrator. */
  @OnEvent(USER_DELETED, { async: true, promisify: true })
  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    if (event.role === 'STUDENT') {
      await this.enrollments.deleteByStudent(event.userId);
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
    await this.classes.delete(classroom.id);
    this.logger.log(`Class ${classroom.name} (${classroom.id}) deleted for good`);
  }

  // ---------- Helpers ----------

  /** The student's current class: an open membership in an ACTIVE class (optionally ignoring one class). */
  private async currentClassId(studentId: string, except?: string): Promise<string | null> {
    const open = (await this.enrollments.findByStudent(studentId)).filter((m) => m.isOpen && m.classId !== except);
    if (!open.length) return null;
    const classes = await this.classes.findByIds(open.map((m) => m.classId));
    return classes.find((c) => c.isActive)?.id ?? null;
  }

  /** Makes `classId` the student's current class, ending the previous current membership. */
  private async join(studentId: string, classId: string): Promise<Enrollment> {
    const currentId = await this.currentClassId(studentId, classId);
    if (currentId) {
      const previous = await this.enrollments.find(studentId, currentId);
      previous?.end();
      if (previous) await this.enrollments.save(previous);
    }
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
    const [counts, teachers] = await Promise.all([
      this.enrollments.countOpenByClass(ids),
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
      };
    });
  }
}

const notFound = () => DomainError.notFound('classroom.not_found', 'Không tìm thấy lớp.');
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
