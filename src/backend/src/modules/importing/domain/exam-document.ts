/** Format-neutral representation of an uploaded exam: a flat list of paragraphs and tables. */
export type DocumentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'image' };

export interface ExamDocument {
  fileName: string;
  blocks: DocumentBlock[];
}

export function documentText(doc: ExamDocument): string {
  return doc.blocks
    .map((b) =>
      b.kind === 'paragraph' ? b.text : b.kind === 'table' ? b.rows.map((r) => r.join(' | ')).join('\n') : '[Hình ảnh]',
    )
    .join('\n');
}
