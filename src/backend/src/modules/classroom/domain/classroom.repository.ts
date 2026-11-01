import type { ClassCode, Classroom, Enrollment } from './classroom.js';

export abstract class ClassroomRepository {
  abstract findById(id: string): Promise<Classroom | null>;
  abstract findByIds(ids: string[]): Promise<Classroom[]>;
  abstract findByCode(code: ClassCode): Promise<Classroom | null>;
  abstract findAll(): Promise<Classroom[]>;
  abstract findByTeacher(teacherId: string): Promise<Classroom[]>;
  abstract findDueForPurge(now: Date): Promise<Classroom[]>;
  abstract save(classroom: Classroom): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export abstract class EnrollmentRepository {
  /** All memberships of a student (current and history). */
  abstract findByStudent(studentId: string): Promise<Enrollment[]>;
  abstract find(studentId: string, classId: string): Promise<Enrollment | null>;
  /** Open memberships of a class. */
  abstract findOpenByClass(classId: string): Promise<Enrollment[]>;
  abstract findAllOpen(): Promise<Enrollment[]>;
  /** classId -> number of open memberships */
  abstract countOpenByClass(classIds: string[]): Promise<Map<string, number>>;
  abstract save(enrollment: Enrollment): Promise<void>;
  abstract deleteByStudent(studentId: string): Promise<void>;
  abstract deleteByClass(classId: string): Promise<void>;
}
