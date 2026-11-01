import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Languages, type Language } from '@oj/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { Actor } from '../../../shared/application/actor.js';
import { CurrentActor, Roles } from '../../../shared/presentation/decorators.js';
import { PaginationQuery } from '../../../shared/presentation/pagination.dto.js';
import { JudgingService } from '../application/judging.service.js';

const KEY = /^[A-Za-z]{1,3}$/;

class SubmitBody {
  @IsUUID() sessionId: string;
  @Matches(KEY) problemKey: string;
  @IsIn(Languages, { message: 'Ngôn ngữ không được hỗ trợ.' }) language: Language;
  @IsString() @MaxLength(70_000) sourceCode: string;
}

class ListQuery extends PaginationQuery {
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @Matches(KEY) problemKey?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() mine?: boolean;
}

class RejudgeBody {
  @IsOptional() @Matches(KEY) problemKey?: string;
}

/** Lives under /sessions because a rejudge is a session-level action, but judging owns submissions. */
@Controller('sessions')
export class RejudgeController {
  constructor(private readonly judging: JudgingService) {}

  @Post(':id/rejudge') @Roles('ADMIN', 'TEACHER') @HttpCode(200)
  rejudge(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: RejudgeBody) {
    return this.judging.rejudge(actor, id, body.problemKey ?? null);
  }
}

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly judging: JudgingService) {}

  @Post()
  submit(@CurrentActor() actor: Actor, @Body() body: SubmitBody) {
    return this.judging.submit(actor, body);
  }

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: ListQuery) {
    return this.judging.list(actor, query);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.judging.get(actor, id);
  }
}
