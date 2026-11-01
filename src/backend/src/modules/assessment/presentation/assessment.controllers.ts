import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  Languages,
  ProblemSetTypes,
  type BankScope,
  type FeedbackMode,
  type Language,
  type ProblemSetType,
  type SessionAudience,
} from '@oj/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Actor } from '../../../shared/application/actor.js';
import { CurrentActor, Roles } from '../../../shared/presentation/decorators.js';
import { ProblemSetService } from '../application/problem-set.service.js';
import { SessionService } from '../application/session.service.js';

// ---------- Problem set bank ----------

class ItemBody {
  @IsUUID() problemId: string;
  @Type(() => Number) @IsNumber() @Min(0) points: number;
}

class UpsertProblemSetBody {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(20_000) description: string;
  @IsIn(ProblemSetTypes) type: ProblemSetType;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ItemBody) items: ItemBody[];
}

class SetSharingBody {
  @IsBoolean() isPublic: boolean;
}

class ScopeQuery {
  @IsOptional() @IsIn(['mine', 'public', 'all']) scope?: BankScope;
}

@Controller('problem-sets')
@Roles('ADMIN', 'TEACHER')
export class ProblemSetsController {
  constructor(private readonly sets: ProblemSetService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: ScopeQuery) {
    return this.sets.list(actor, query.scope ?? 'mine');
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sets.get(actor, id);
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: UpsertProblemSetBody) {
    return this.sets.create(actor, body);
  }

  @Put(':id')
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpsertProblemSetBody) {
    return this.sets.update(actor, id, body);
  }

  @Delete(':id') @HttpCode(204)
  delete(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sets.delete(actor, id);
  }

  @Put(':id/sharing')
  share(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: SetSharingBody) {
    return this.sets.share(actor, id, body.isPublic);
  }

  @Post(':id/copy')
  copy(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sets.copy(actor, id);
  }

  @Get(':id/answer-key')
  answerKey(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sets.answerKey(actor, id);
  }
}

// ---------- Sessions ----------

class SourceBody {
  @IsIn(['SET', 'PROBLEM']) kind: 'SET' | 'PROBLEM';
  @ValidateIf((o) => o.kind === 'SET') @IsUUID() setId?: string;
  @ValidateIf((o) => o.kind === 'PROBLEM') @IsUUID() problemId?: string;
}

class SettingsBody {
  @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(1440) durationMinutes: number | null;
  @IsArray() @IsIn(Languages, { each: true }) allowedLanguages: Language[];
  @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(1000) maxSubmissionsPerProblem: number | null;
  @IsIn(['FULL', 'SCORE_ONLY', 'HIDDEN_UNTIL_CLOSED']) feedback: FeedbackMode;
  @IsOptional() @IsBoolean() checkPlagiarism = false;
  @IsOptional() @IsBoolean() checkAiUsage = false;
}

class CreateSessionBody {
  @ValidateNested() @Type(() => SourceBody) source: SourceBody;
  @ValidateIf((_, v) => v !== null) @IsUUID() classId: string | null;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(20_000) description?: string;
  @ValidateIf((_, v) => v !== null) @IsDateString() opensAt: string | null;
  @ValidateIf((_, v) => v !== null) @IsDateString() closesAt: string | null;
  @IsOptional() @ValidateNested() @Type(() => SettingsBody) settings?: SettingsBody;
}

class UpdateSessionBody {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(20_000) description: string;
  @ValidateIf((_, v) => v !== null) @IsDateString() opensAt: string | null;
  @ValidateIf((_, v) => v !== null) @IsDateString() closesAt: string | null;
  @ValidateNested() @Type(() => SettingsBody) settings: SettingsBody;
}

class ListSessionsQuery {
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @IsIn(['CLASS', 'PUBLIC']) audience?: SessionAudience;
}

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: ListSessionsQuery) {
    return this.sessions.list(actor, query);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.get(actor, id);
  }

  @Get(':id/problems/:key')
  problem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
  ) {
    return this.sessions.getProblem(actor, id, key);
  }

  @Post() @Roles('ADMIN', 'TEACHER')
  create(@CurrentActor() actor: Actor, @Body() body: CreateSessionBody) {
    const source = body.source.kind === 'SET'
      ? { kind: 'SET' as const, setId: body.source.setId! }
      : { kind: 'PROBLEM' as const, problemId: body.source.problemId! };
    return this.sessions.create(actor, { ...body, source });
  }

  @Put(':id') @Roles('ADMIN', 'TEACHER')
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSessionBody) {
    return this.sessions.update(actor, id, body);
  }

  @Delete(':id') @Roles('ADMIN', 'TEACHER') @HttpCode(204)
  delete(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.delete(actor, id);
  }

  @Post(':id/start') @HttpCode(200)
  start(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.start(actor, id);
  }

  @Post(':id/refresh') @Roles('ADMIN', 'TEACHER') @HttpCode(200)
  refresh(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.refresh(actor, id);
  }

  @Get(':id/results') @Roles('ADMIN', 'TEACHER')
  results(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.results(actor, id);
  }
}

@Controller('progress')
export class ProgressController {
  constructor(private readonly sessions: SessionService) {}

  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return this.sessions.learningRecord(actor);
  }
}

