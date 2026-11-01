import { Injectable, Logger } from '@nestjs/common';
import type { ImportProblemsResponse, ParsedExamDto, ProblemDraftDto } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import { assert } from '../../../shared/domain/domain-error.js';
import { isAboutFileIo, toStandardIo } from '../../../shared/domain/standard-io.js';
import { documentText, type ExamDocument } from '../domain/exam-document.js';
import { ExamParser } from '../domain/exam-parser.js';
import { DocumentReader, ProblemCatalogGateway, SmartExamReader, type UploadedFile } from './ports.js';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly parser = new ExamParser();

  constructor(
    private readonly reader: DocumentReader,
    private readonly smartReader: SmartExamReader,
    private readonly catalog: ProblemCatalogGateway,
  ) {}

  /**
   * Step 1: read + split into drafts. Stateless; nothing is persisted until the teacher confirms.
   * The AI reader is tried first when available; the rule-based parser is the fallback.
   */
  async parse(file: UploadedFile): Promise<ParsedExamDto> {
    // The text layer may be empty (scanned PDF); that only matters if the AI reader is not used.
    const doc: ExamDocument | null = await this.reader.read(file).catch(() => null);
    const rawText = doc ? documentText(doc) : '';

    if (this.smartReader.available) {
      try {
        const drafts = await this.smartReader.read(file, doc);
        return { fileName: file.originalName, parser: 'AI', drafts: drafts.map(withStandardIo), rawText };
      } catch (error) {
        this.logger.warn(`AI reader failed for ${file.originalName}, using the rule-based parser: ${(error as Error).message}`);
      }
    }

    assert(doc && rawText.trim().length > 0, 'import.empty_document',
      'Không đọc được chữ trong tài liệu (có thể là PDF dạng ảnh scan). Đọc đề bằng AI sẽ xử lý được loại tệp này.');
    return { fileName: file.originalName, parser: 'BASIC', drafts: this.parser.parse(doc).map(withStandardIo), rawText };
  }

  /** Step 2: create problems from the reviewed drafts; samples become sample test cases. */
  async confirm(actor: Actor, drafts: ProblemDraftDto[]): Promise<ImportProblemsResponse> {
    assert(drafts.length > 0 && drafts.length <= 50, 'import.invalid_count', 'Số bài nhập phải từ 1 đến 50.');
    const problemIds: string[] = [];
    for (const draft of drafts) {
      problemIds.push(
        await this.catalog.createProblem(
          actor,
          {
            title: draft.title,
            difficulty: draft.difficulty,
            tags: [],
            statement: draft.statement,
            inputFormat: draft.inputFormat,
            outputFormat: draft.outputFormat,
            constraints: draft.constraints,
            timeLimitMs: draft.timeLimitMs,
            memoryLimitMb: draft.memoryLimitMb,
          },
          draft.samples.map((s) => ({ input: s.input, expectedOutput: s.expectedOutput, isSample: true, points: 1 })),
        ),
      );
    }
    return { problemIds };
  }
}

/** The judge uses standard input/output only: file wording is rewritten and hints about files dropped. */
function withStandardIo(draft: ProblemDraftDto): ProblemDraftDto {
  return {
    ...draft,
    statement: toStandardIo(draft.statement),
    inputFormat: toStandardIo(draft.inputFormat),
    outputFormat: toStandardIo(draft.outputFormat, 'output'),
    constraints: toStandardIo(draft.constraints),
    warnings: draft.warnings.filter((w) => !isAboutFileIo(w)),
  };
}
