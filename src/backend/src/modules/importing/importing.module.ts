import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ImportService } from './application/import.service.js';
import { DocumentReader, ProblemCatalogGateway, SmartExamReader } from './application/ports.js';
import { ClaudeExamReader } from './infrastructure/claude-exam-reader.js';
import { CatalogFacadeGateway } from './infrastructure/catalog.gateway.js';
import { MammothPdfDocumentReader } from './infrastructure/document-reader.js';
import { ImportsController } from './presentation/imports.controller.js';

@Module({
  imports: [CatalogModule],
  controllers: [ImportsController],
  providers: [
    ImportService,
    { provide: DocumentReader, useClass: MammothPdfDocumentReader },
    { provide: SmartExamReader, useClass: ClaudeExamReader },
    { provide: ProblemCatalogGateway, useClass: CatalogFacadeGateway },
  ],
})
export class ImportingModule {}
