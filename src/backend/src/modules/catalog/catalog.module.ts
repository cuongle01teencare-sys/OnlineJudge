import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module.js';
import { CatalogFacade } from './application/catalog.facade.js';
import { ProblemSectionWriter, TestCaseSuggester } from './application/ports.js';
import { ProblemService } from './application/problem.service.js';
import { UnshareChecks } from './application/unshare-checks.js';
import { ProblemQueries, ProblemRepository } from './domain/problem.repository.js';
import { ClaudeSectionWriter } from './infrastructure/claude-section-writer.js';
import { ClaudeTestCaseSuggester } from './infrastructure/claude-test-case-suggester.js';
import { ProblemOrmEntity, TestCaseOrmEntity } from './infrastructure/problem.orm-entities.js';
import { TypeOrmProblemQueries, TypeOrmProblemRepository } from './infrastructure/typeorm-problem.repository.js';
import { ProblemsController } from './presentation/problems.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProblemOrmEntity, TestCaseOrmEntity]), IdentityModule],
  controllers: [ProblemsController],
  providers: [
    ProblemService,
    CatalogFacade,
    UnshareChecks,
    { provide: ProblemRepository, useClass: TypeOrmProblemRepository },
    { provide: ProblemQueries, useClass: TypeOrmProblemQueries },
    { provide: TestCaseSuggester, useClass: ClaudeTestCaseSuggester },
    { provide: ProblemSectionWriter, useClass: ClaudeSectionWriter },
  ],
  // Only the published interface leaves the context.
  exports: [CatalogFacade],
})
export class CatalogModule {}
