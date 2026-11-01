import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { DocumentReader, type UploadedFile } from '../application/ports.js';
import type { DocumentBlock, ExamDocument } from '../domain/exam-document.js';
import { inlineEquations } from './omml.js';

/** Reads .docx through mammoth (HTML keeps tables, which often hold sample tests) and .pdf through unpdf. */
@Injectable()
export class MammothPdfDocumentReader extends DocumentReader {
  async read(file: UploadedFile): Promise<ExamDocument> {
    const name = file.originalName.toLowerCase();
    if (name.endsWith('.docx')) {
      const { value } = await mammoth.convertToHtml({ buffer: await withPlainEquations(file.buffer) });
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

/** mammoth drops Word equations; turn them into text runs first (only when the document has any). */
async function withPlainEquations(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const part = zip.file('word/document.xml');
  const xml = await part?.async('string');
  if (!xml || !xml.includes('<m:oMath')) return buffer;
  zip.file('word/document.xml', inlineEquations(xml));
  return zip.generateAsync({ type: 'nodebuffer' });
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
  // Where the current <sup>/<sub> started in `text`.
  let scriptStart = -1;

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
      // Word superscript/subscript runs: 10<sup>6</sup> must not read as "106".
      case 'sup': case 'sub':
        if (!closing) scriptStart = text.length;
        else if (scriptStart >= 0) {
          text = text.slice(0, scriptStart) + script(tag === 'sup' ? '^' : '_', text.slice(scriptStart));
          scriptStart = -1;
        }
        break;
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

/** 10^6, 10^{18}, a_i, a_{i+1}: plain text that also reads as LaTeX. */
function script(mark: '^' | '_', inner: string): string {
  const value = inner.trim();
  if (!value) return inner;
  return decode(value).length === 1 ? `${mark}${value}` : `${mark}{${value}}`;
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
