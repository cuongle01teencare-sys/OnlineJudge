import type { RegisterRequest, Role, VerificationTicketDto } from '@oj/contracts';

export interface Person {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  role: Role;
}

/** Port (ACL) towards the Identity context. */
export abstract class PeopleDirectory {
  abstract getPeople(ids: string[]): Promise<Map<string, Person>>;
  abstract listByRole(role: Role): Promise<Person[]>;
  abstract startStudentRegistration(input: Omit<RegisterRequest, 'classCode'>, classId: string): Promise<VerificationTicketDto>;
}
