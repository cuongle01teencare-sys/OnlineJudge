import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module.js';
import { ClassroomModule } from '../classroom/classroom.module.js';
import { CommunityService } from './application/community.service.js';
import { ClassMembership, SessionDirectory, ThreadRepository } from './application/ports.js';
import { AssessmentSessionDirectory, ClassroomMembership } from './infrastructure/adapters.js';
import { ThreadOrmEntity, TypeOrmThreadRepository } from './infrastructure/persistence.js';
import { ClassThreadsController, ThreadsController } from './presentation/community.controllers.js';

/** The class board: announcements and Q&A. */
@Module({
  imports: [TypeOrmModule.forFeature([ThreadOrmEntity]), ClassroomModule, AssessmentModule],
  controllers: [ClassThreadsController, ThreadsController],
  providers: [
    CommunityService,
    { provide: ThreadRepository, useClass: TypeOrmThreadRepository },
    { provide: ClassMembership, useClass: ClassroomMembership },
    { provide: SessionDirectory, useClass: AssessmentSessionDirectory },
  ],
})
export class CommunityModule {}
