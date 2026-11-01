import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor.js';
import { CurrentActor, Roles } from '../../../shared/presentation/decorators.js';
import { ProblemService } from '../application/problem.service.js';
import {
  ProblemListQuery,
  SharingBody,
  UpsertProblemBody,
  UpsertSolutionBody,
  UpsertTestCaseBody,
} from './problem.dto.js';

/** Teachers' problem banks. Students reach problems only through sessions. */
@Controller('problems')
@Roles('ADMIN', 'TEACHER')
export class ProblemsController {
  constructor(private readonly problems: ProblemService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: ProblemListQuery) {
    return this.problems.list(actor, { ...query, scope: query.scope ?? 'mine' });
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.problems.get(actor, id);
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: UpsertProblemBody) {
    return this.problems.create(actor, body);
  }

  @Put(':id')
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpsertProblemBody) {
    return this.problems.update(actor, id, body);
  }

  @Delete(':id') @HttpCode(204)
  delete(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.problems.delete(actor, id);
  }

  @Put(':id/sharing')
  share(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: SharingBody) {
    return this.problems.share(actor, id, body);
  }

  @Post(':id/copy')
  copy(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.problems.copy(actor, id);
  }

  @Post(':id/test-cases')
  addTestCase(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpsertTestCaseBody) {
    return this.problems.addTestCase(actor, id, body);
  }

  @Put(':id/test-cases/:testCaseId')
  updateTestCase(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('testCaseId', ParseUUIDPipe) testCaseId: string,
    @Body() body: UpsertTestCaseBody,
  ) {
    return this.problems.updateTestCase(actor, id, testCaseId, body);
  }

  @Delete(':id/test-cases/:testCaseId') @HttpCode(204)
  removeTestCase(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('testCaseId', ParseUUIDPipe) testCaseId: string,
  ) {
    return this.problems.removeTestCase(actor, id, testCaseId);
  }

  @Put(':id/solution')
  setSolution(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpsertSolutionBody) {
    return this.problems.setSolution(actor, id, body);
  }

  @Delete(':id/solution') @HttpCode(204)
  clearSolution(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.problems.clearSolution(actor, id);
  }
}
