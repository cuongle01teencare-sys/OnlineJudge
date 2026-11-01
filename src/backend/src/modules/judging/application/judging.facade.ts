import { Injectable } from '@nestjs/common';
import type { Language, Verdict } from '@oj/contracts';
import { SubmissionRepository } from '../domain/submission.repository.js';
import type { Submission } from '../domain/submission.js';

export interface SubmissionInfo {
  id: string;
  userId: string;
  userDisplayName: string;
  sessionId: string;
  sessionTitle: string;
  problemKey: string;
  problemTitle: string;
  language: Language;
  code: string;
  verdict: Verdict | null;
  createdAt: Date;
}

/** Published interface of the Judging context (used by Integrity). */
@Injectable()
export class JudgingFacade {
  constructor(private readonly submissions: SubmissionRepository) {}

  async getSubmission(id: string): Promise<SubmissionInfo | null> {
    const s = await this.submissions.findById(id);
    return s ? info(s) : null;
  }

  async submissionsOfProblem(sessionId: string, problemKey: string): Promise<SubmissionInfo[]> {
    return (await this.submissions.findBySession(sessionId, problemKey)).map(info);
  }
}

function info(s: Submission): SubmissionInfo {
  const st = s.snapshot;
  return {
    id: s.id,
    userId: st.userId,
    userDisplayName: st.userDisplayName,
    sessionId: st.sessionId,
    sessionTitle: st.sessionTitle,
    problemKey: st.problemKey,
    problemTitle: st.problemTitle,
    language: st.source.language,
    code: st.source.text,
    verdict: st.verdict,
    createdAt: st.createdAt,
  };
}
