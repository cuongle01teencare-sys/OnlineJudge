import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { IntegrityFlagStatus } from '@oj/contracts';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { Actor } from '../../../shared/application/actor.js';
import { CurrentActor, Roles } from '../../../shared/presentation/decorators.js';
import { IntegrityService } from '../application/integrity.service.js';

class ListQuery {
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @IsIn(['OPEN', 'ACKNOWLEDGED']) status?: IntegrityFlagStatus;
}

/** Teacher-only: students never reach these routes. */
@Controller('integrity-flags')
@Roles('ADMIN', 'TEACHER')
export class IntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: ListQuery) {
    return this.integrity.list(actor, query);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrity.get(actor, id);
  }

  @Post(':id/acknowledge') @HttpCode(200)
  acknowledge(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.integrity.acknowledge(actor, id);
  }
}
