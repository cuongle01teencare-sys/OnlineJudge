import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Language, SubmissionStatus, Verdict } from '@oj/contracts';
import { In, Repository } from 'typeorm';
import { SourceCode, Submission } from '../domain/submission.js';
import {
  SubmissionQueries,
  SubmissionRepository,
  type SubmissionListFilter,
} from '../domain/submission.repository.js';
import { SubmissionOrmEntity } from './submission.orm-entity.js';

@Injectable()
export class TypeOrmSubmissionRepository extends SubmissionRepository {
  constructor(@InjectRepository(SubmissionOrmEntity) private readonly repo: Repository<SubmissionOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async save(submission: Submission) {
    const s = submission.snapshot;
    await this.repo.save({
      id: submission.id,
      userId: s.userId,
      userDisplayName: s.userDisplayName,
      sessionId: s.sessionId,
      sessionTitle: s.sessionTitle,
      problemKey: s.problemKey,
      problemTitle: s.problemTitle,
      language: s.source.language,
      sourceCode: s.source.text,
      totalPoints: s.totalPoints,
      judgeRun: s.judgeRun,
      status: s.status,
      verdict: s.verdict,
      score: s.score,
      compileOutput: s.compileOutput,
      testResults: s.testResults,
      createdAt: s.createdAt,
      judgedAt: s.judgedAt,
    });
  }

  countUnfinishedByUser(userId: string) {
    return this.repo.countBy({ userId, status: In(['PENDING', 'JUDGING']) });
  }

  countForProblem(userId: string, sessionId: string, problemKey: string) {
    return this.repo.countBy({ userId, sessionId, problemKey });
  }

  async findBySession(sessionId: string, problemKey: string | null) {
    const rows = await this.repo.find({ where: problemKey ? { sessionId, problemKey } : { sessionId }, order: { createdAt: 'ASC' } });
    return rows.map(toDomain);
  }
}

@Injectable()
export class TypeOrmSubmissionQueries extends SubmissionQueries {
  constructor(@InjectRepository(SubmissionOrmEntity) private readonly repo: Repository<SubmissionOrmEntity>) {
    super();
  }

  async list(filter: SubmissionListFilter) {
    const where = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.sessionId ? { sessionId: filter.sessionId } : {}),
      ...(filter.problemKey ? { problemKey: filter.problemKey } : {}),
    };
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    });
    return { items: rows.map(toDomain), total };
  }
}

function toDomain(row: SubmissionOrmEntity): Submission {
  return Submission.rehydrate(row.id, {
    userId: row.userId,
    userDisplayName: row.userDisplayName,
    sessionId: row.sessionId,
    sessionTitle: row.sessionTitle,
    problemKey: row.problemKey,
    problemTitle: row.problemTitle,
    source: SourceCode.of(row.language as Language, row.sourceCode),
    totalPoints: row.totalPoints,
    judgeRun: row.judgeRun,
    status: row.status as SubmissionStatus,
    verdict: row.verdict as Verdict | null,
    score: row.score,
    compileOutput: row.compileOutput,
    testResults: row.testResults,
    createdAt: row.createdAt,
    judgedAt: row.judgedAt,
  });
}
