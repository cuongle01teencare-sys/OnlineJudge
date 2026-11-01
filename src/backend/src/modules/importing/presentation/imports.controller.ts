import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Difficulties, type Difficulty } from '@oj/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Actor } from '../../../shared/application/actor.js';
import { CurrentActor, Roles } from '../../../shared/presentation/decorators.js';
import { ImportService } from '../application/import.service.js';

class SampleBody {
  @IsString() input: string;
  @IsString() expectedOutput: string;
}

class DraftBody {
  @IsString() title: string;
  @IsIn(Difficulties) difficulty: Difficulty;
  @IsString() statement: string;
  @IsString() inputFormat: string;
  @IsString() outputFormat: string;
  @IsString() constraints: string;
  @IsInt() timeLimitMs: number;
  @IsInt() memoryLimitMb: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SampleBody) samples: SampleBody[];
  @IsArray() @IsString({ each: true }) warnings: string[];
}

class ParseTextBody {
  @IsString() @MaxLength(100_000, { message: 'Nội dung dài quá 100.000 ký tự. Hãy chia thành nhiều lần.' }) text: string;
}

class ConfirmBody {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => DraftBody)
  drafts: DraftBody[];
}

@Controller('imports')
@Roles('ADMIN', 'TEACHER')
export class ImportsController {
  constructor(private readonly imports: ImportService) {}

  @Post('parse') @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  parse(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw DomainError.validation('import.no_file', 'Vui lòng chọn tệp .docx hoặc .pdf.');
    // Multer decodes the multipart filename as latin1; restore UTF-8 (Vietnamese names).
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.imports.parse({ originalName, mimeType: file.mimetype, buffer: file.buffer });
  }

  /** Same as `parse`, for exam text pasted by the teacher. */
  @Post('parse-text') @HttpCode(200)
  parseText(@Body() body: ParseTextBody) {
    return this.imports.parseText(body.text);
  }

  @Post('confirm')
  confirm(@CurrentActor() actor: Actor, @Body() body: ConfirmBody) {
    return this.imports.confirm(actor, body.drafts);
  }
}
