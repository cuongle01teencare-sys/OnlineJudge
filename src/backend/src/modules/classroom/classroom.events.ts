/** Published language of the Classroom context. */
export const CLASS_PURGED = 'classroom.class-purged';

/** A class was deleted for good: its sessions must go, learning records keep titles only. */
export interface ClassPurgedEvent {
  name: typeof CLASS_PURGED;
  occurredAt: Date;
  classId: string;
  className: string;
}
