import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ClassroomModule } from '../classroom/classroom.module.js';
import { ClassAccess, LearningRecordStore, ProblemCatalog } from './application/ports.js';
import { ProblemSetService } from './application/problem-set.service.js';
import { SessionFacade } from './application/session.facade.js';
import { SessionService } from './application/session.service.js';
import { AttemptRepository, ProblemSetRepository, SessionRepository } from './domain/repositories.js';
import { CatalogProblemCatalog, ClassroomClassAccess } from './infrastructure/adapters.js';
import { TypeOrmLearningRecordStore } from './infrastructure/learning-record.store.js';
import {
  LearningProgressOrmEntity,
  LearningSessionOrmEntity,
  ProblemSetOrmEntity,
  SessionAttemptOrmEntity,
  SessionOrmEntity,
  SessionTestsOrmEntity,
} from './infrastructure/orm-entities.js';
import {
  TypeOrmAttemptRepository,
  TypeOrmProblemSetRepository,
  TypeOrmSessionRepository,
} from './infrastructure/repositories.js';
import { ProblemSetsController, ProgressController, SessionsController } from './presentation/assessment.controllers.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProblemSetOrmEntity,
      SessionOrmEntity,
      SessionTestsOrmEntity,
      SessionAttemptOrmEntity,
      LearningSessionOrmEntity,
      LearningProgressOrmEntity,
    ]),
    CatalogModule,
    ClassroomModule,
  ],
  controllers: [ProblemSetsController, SessionsController, ProgressController],
  providers: [
    ProblemSetService,
    SessionService,
    SessionFacade,
    { provide: ProblemSetRepository, useClass: TypeOrmProblemSetRepository },
    { provide: SessionRepository, useClass: TypeOrmSessionRepository },
    { provide: AttemptRepository, useClass: TypeOrmAttemptRepository },
    { provide: LearningRecordStore, useClass: TypeOrmLearningRecordStore },
    { provide: ProblemCatalog, useClass: CatalogProblemCatalog },
    { provide: ClassAccess, useClass: ClassroomClassAccess },
  ],
  exports: [SessionFacade],
})
export class AssessmentModule {}
