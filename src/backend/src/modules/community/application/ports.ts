import type { ClassStatus } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import type { Thread } from '../domain/thread.js';

export abstract class ThreadRepository {
  abstract findById(id: string): Promise<Thread | null>;
  abstract listByClass(classId: string, topic?: { sessionId?: string; problemKey?: string }): Promise<Thread[]>;
  abstract save(thread: Thread): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract deleteByClass(classId: string): Promise<void>;
}

/** Port (ACL) towards Classroom. */
export abstract class ClassMembership {
  abstract status(classId: string): Promise<ClassStatus | null>;
  abstract canManage(actor: Actor, classId: string): Promise<boolean>;
  abstract membership(userId: string, classId: string): Promise<'current' | 'former' | null>;
}

/** Port (ACL) towards Assessment. */
export abstract class SessionDirectory {
  abstract summary(sessionId: string): Promise<{ classId: string | null; title: string; problemKeys: string[] } | null>;
}
