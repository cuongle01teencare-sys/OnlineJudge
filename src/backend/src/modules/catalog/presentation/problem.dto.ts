import { Difficulties, Languages, type BankScope, type Difficulty, type Language } from '@oj/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQuery } from '../../../shared/presentation/pagination.dto.js';

export class ProblemListQuery extends PaginationQuery {
  @IsOptional() @IsIn(['mine', 'public', 'all']) scope?: BankScope;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(Difficulties) difficulty?: Difficulty;
  @IsOptional() @IsString() @MaxLength(50) tag?: string;
}

export class UpsertProblemBody {
  @IsString() @MaxLength(200) title: string;
  @IsIn(Difficulties, { message: 'Mức độ khó không hợp lệ.' }) difficulty: Difficulty;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags: string[];
  @IsString() @MaxLength(100_000) statement: string;
  @IsString() @MaxLength(20_000) inputFormat: string;
  @IsString() @MaxLength(20_000) outputFormat: string;
  @IsString() @MaxLength(20_000) constraints: string;
  @Type(() => Number) @IsInt() timeLimitMs: number;
  @Type(() => Number) @IsInt() memoryLimitMb: number;
}

export class UpsertTestCaseBody {
  @IsString() input: string;
  @IsString() expectedOutput: string;
  @IsBoolean() isSample: boolean;
  @Type(() => Number) @IsNumber() @Min(0) points: number;
}

export class SharingBody {
  @IsBoolean() isPublic: boolean;
  @IsBoolean() publicTests: boolean;
  @IsBoolean() publicSolution: boolean;
}

export class UpsertSolutionBody {
  @IsString() @MaxLength(100_000) explanation: string;
  @ValidateIf((_, v) => v !== null) @IsIn(Languages) language: Language | null;
  @IsString() @MaxLength(100_000) code: string;
}
