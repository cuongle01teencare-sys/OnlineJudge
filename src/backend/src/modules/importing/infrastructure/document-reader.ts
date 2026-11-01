import { Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { DocumentReader, type UploadedFile } from '../application/ports.js';
import type { DocumentBlock, ExamDocument } from '../domain/exam-document.js';

/** Reads .docx through mammoth (HTML keeps tables, which often hold sample tests) and .pdf through unpdf. */
@Injectable()
export class MammothPdfDocumentReader extends DocumentReader {
  async read(file: UploadedFile): Promise<ExamDocument> {
    const name = file.originalName.toLowerCase();
    if (name.endsWith('.docx')) {
      const { value } = await mammoth.convertToHtml({ buffer: file.buffer });
      return { fileName: file.originalName, blocks: htmlToBlocks(value) };
    }
    if (name.endsWith('.pdf')) {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(file.buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      const blocks: DocumentBlock[] = text.split(/\r?\n/).map((line) => ({ kind: 'paragraph', text: line }));
      return { fileName: file.originalName, blocks };
    }
    throw DomainError.validation('import.unsupported_type', 'Chỉ hỗ trợ tệp .docx hoặc .pdf.');
  }
}

/** Minimal converter for mammoth's (simple, well-formed) HTML output. */
export function htmlToBlocks(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  let text = '';
  let tableDepth = 0;
  let rows: string[][] = [];
  let row: string[] | null = null;
  let cell: string[] | null = null;

  const flushParagraph = () => {
    const value = decode(text);
    text = '';
    if (cell) {
      cell.push(value);
    } else if (value.trim()) {
      blocks.push({ kind: 'paragraph', text: value });
    }
  };

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      text += token;
      continue;
    }
    const tag = /^<\/?\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase() ?? '';
    const closing = token.startsWith('</');
    switch (tag) {
      case 'br':
        text += '\n';
        break;
      case 'p': case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': case 'li':
        if (closing) flushParagraph();
        else if (text.trim()) flushParagraph();
        break;
      case 'img':
        if (!cell) blocks.push({ kind: 'image' });
        break;
      case 'table':
        if (!closing) {
          if (tableDepth++ === 0) rows = [];
        } else if (--tableDepth === 0) {
          blocks.push({ kind: 'table', rows });
        }
        break;
      case 'tr':
        if (tableDepth !== 1) break;
        if (!closing) row = [];
        else if (row) {
          rows.push(row);
          row = null;
        }
        break;
      case 'td': case 'th':
        if (tableDepth !== 1) break;
        if (!closing) cell = [];
        else if (cell) {
          if (text.trim()) flushParagraph();
          row?.push(cell.join('\n'));
          cell = null;
        }
        break;
    }
  }
  if (text.trim()) flushParagraph();
  return blocks;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}
