import type { ProblemDraftDto, UpsertProblemRequest, UpsertTestCaseRequest } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import type { ExamDocument } from '../domain/exam-document.js';

export interface UploadedFile {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

/** Port: turns a .docx/.pdf file into the format-neutral ExamDocument (text layer only). */
export abstract class DocumentReader {
  abstract read(file: UploadedFile): Promise<ExamDocument>;
}

/** Port: an AI reader that understands the original document (layout, scans). Optional. */
export abstract class SmartExamReader {
  abstract get available(): boolean;
  /** `extracted` is the text layer when it could be read (used for formats the AI cannot take directly). */
  abstract read(file: UploadedFile, extracted: ExamDocument | null): Promise<ProblemDraftDto[]>;
}

/** Port (anti-corruption layer) towards the Catalog context. */
export abstract class ProblemCatalogGateway {
  abstract createProblem(owner: Actor, problem: UpsertProblemRequest, tests: UpsertTestCaseRequest[]): Promise<string>;
}
