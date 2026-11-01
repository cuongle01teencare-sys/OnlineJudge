import { Injectable } from '@nestjs/common';
import type { RegisterRequest, Role } from '@oj/contracts';
import { IdentityFacade } from '../../identity/application/identity.facade.js';
import { PeopleDirectory } from '../application/ports.js';

@Injectable()
export class IdentityPeopleDirectory extends PeopleDirectory {
  constructor(private readonly identity: IdentityFacade) {
    super();
  }

  getPeople(ids: string[]) {
    return this.identity.getUsers(ids);
  }

  listByRole(role: Role) {
    return this.identity.listByRole(role);
  }

  startStudentRegistration(input: Omit<RegisterRequest, 'classCode'>, classId: string) {
    return this.identity.requestStudentRegistration(input, classId);
  }
}
