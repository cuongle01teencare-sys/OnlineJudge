/**
 * Published language of the Catalog context: integration events other contexts may subscribe to.
 * Subscribers depend on this file only, never on catalog domain classes.
 */
export const PROBLEM_DELETED = 'catalog.problem-deleted';

export interface ProblemDeletedEvent {
  name: typeof PROBLEM_DELETED;
  problemId: string;
  occurredAt: Date;
}
