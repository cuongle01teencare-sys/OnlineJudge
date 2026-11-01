import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor.js';
import { SessionFacade } from '../../assessment/application/session.facade.js';
import { JudgingFacade } from '../../judging/application/judging.facade.js';
import { SessionAccess, SubmissionSource } from '../application/ports.js';

@Injectable()
export class JudgingSubmissionSource extends SubmissionSource {
  constructor(private readonly judging: JudgingFacade) {
    super();
  }

  get(id: string) {
    return this.judging.getSubmission(id);
  }

  ofProblem(sessionId: string, problemKey: string) {
    return this.judging.submissionsOfProblem(sessionId, problemKey);
  }
}

@Injectable()
export class AssessmentSessionAccess extends SessionAccess {
  constructor(private readonly sessions: SessionFacade) {
    super();
  }

  checkInfo(sessionId: string, problemKey: string) {
    return this.sessions.integrityContext(sessionId, problemKey);
  }

  canReview(actor: Actor, sessionId: string) {
    return this.sessions.canReview(actor, sessionId);
  }
}
