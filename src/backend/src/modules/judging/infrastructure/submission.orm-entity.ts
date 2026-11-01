import type { TestCaseResult } from '@oj/contracts';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('submissions')
@Index(['userId', 'createdAt'])
@Index(['sessionId', 'problemKey'])
export class SubmissionOrmEntity {
  @PrimaryColumn('uuid') id: string;

  @Column('uuid') userId: string;
  @Column({ type: 'varchar', length: 80 }) userDisplayName: string;

  /** Plain reference: submissions outlive their session (students keep their code). */
  @Column('uuid') sessionId: string;
  @Column({ type: 'varchar', length: 200 }) sessionTitle: string;
  @Column({ type: 'varchar', length: 4 }) problemKey: string;
  @Column({ type: 'varchar', length: 210 }) problemTitle: string;

  @Column({ type: 'varchar', length: 16 }) language: string;
  @Column('text') sourceCode: string;
  @Column('real') totalPoints: number;
  @Column('int', { default: 1 }) judgeRun: number;

  @Index()
  @Column({ type: 'varchar', length: 16 }) status: string;
  @Column({ type: 'varchar', length: 8, nullable: true }) verdict: string | null;
  @Column('real', { default: 0 }) score: number;
  @Column('text', { nullable: true }) compileOutput: string | null;
  @Column('jsonb', { default: [] }) testResults: TestCaseResult[];

  @Column('timestamptz') createdAt: Date;
  @Column('timestamptz', { nullable: true }) judgedAt: Date | null;
}
