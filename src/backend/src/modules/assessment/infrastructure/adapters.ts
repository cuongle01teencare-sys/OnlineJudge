import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor.js';
import { CatalogFacade } from '../../catalog/application/catalog.facade.js';
import { ClassroomFacade } from '../../classroom/application/classroom.facade.js';
import { ClassAccess, ProblemCatalog } from '../application/ports.js';

@Injectable()
export class CatalogProblemCatalog extends ProblemCatalog {
  constructor(private readonly catalog: CatalogFacade) {
    super();
  }

  getDetails(ids: string[], viewer: Actor | null) {
    return this.catalog.getProblemDetails(ids, viewer);
  }

  async snapshot(actor: Actor, ids: string[]) {
    const snapshots = await this.catalog.snapshotForSession(actor, ids);
    return snapshots.map(({ id, ownerId: _, ...s }) => ({ ...s, sourceProblemId: id }));
  }

  copyIntoBank(actor: Actor, ids: string[]) {
    return this.catalog.copyIntoBank(actor, ids);
  }
}

@Injectable()
export class ClassroomClassAccess extends ClassAccess {
  constructor(private readonly classrooms: ClassroomFacade) {
    super();
  }

  getClasses(ids: string[]) {
    return this.classrooms.getClasses(ids);
  }

  managedClassIds(actor: Actor) {
    return this.classrooms.managedClassIds(actor);
  }

  canManage(actor: Actor, classId: string) {
    return this.classrooms.canManage(actor, classId);
  }

  membership(userId: string, classId: string) {
    return this.classrooms.membership(userId, classId);
  }

  classIdsOfStudent(studentId: string) {
    return this.classrooms.classIdsOfStudent(studentId);
  }

  currentStudents(classId: string) {
    return this.classrooms.currentStudents(classId);
  }
}
