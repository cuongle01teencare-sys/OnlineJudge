import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExamParser } from '../src/modules/importing/domain/exam-parser.js';
import type { DocumentBlock } from '../src/modules/importing/domain/exam-document.js';
import { htmlToBlocks } from '../src/modules/importing/infrastructure/document-reader.js';

const p = (text: string): DocumentBlock => ({ kind: 'paragraph', text });
const parse = (blocks: DocumentBlock[]) => new ExamParser().parse({ fileName: 'de.docx', blocks });

test('splits a Vietnamese exam into problems with sections, limits and table samples', () => {
  const drafts = parse([
    p('ĐỀ THI HỌC SINH GIỎI TIN HỌC'),
    p('Thời gian làm bài: 150 phút'),
    p('Bài 1. TỔNG HAI SỐ (5 điểm)'),
    p('Độ khó: Dễ'),
    p('Cho hai số nguyên a và b. Hãy tính a + b.'),
    p('Dữ liệu vào: Một dòng chứa hai số nguyên a, b.'),
    p('Kết quả: In ra tổng a + b.'),
    p('Giới hạn: |a|, |b| ≤ 10^9'),
    p('Ví dụ:'),
    { kind: 'table', rows: [['Input', 'Output'], ['1 2', '3'], ['10 20', '30']] },
    p('Bài 2: Dãy con'),
    p('Thời gian: 2 giây. Bộ nhớ: 512 MB'),
    p('Mức độ: khó'),
    p('Đếm số dãy con có tổng bằng K.'),
    p('Input'),
    p('Dòng đầu chứa n và K.'),
    p('Output'),
    p('Một số nguyên là đáp số.'),
    p('Ví dụ'),
    p('Input'),
    p('3 3'),
    p('1 2 3'),
    p('Output'),
    p('2'),
  ]);

  assert.equal(drafts.length, 2);
  const [a, b] = drafts;
  assert.equal(a.title, 'TỔNG HAI SỐ');
  assert.equal(a.difficulty, 'EASY');
  assert.match(a.statement, /tính a \+ b/);
  assert.match(a.inputFormat, /hai số nguyên a, b/);
  assert.match(a.outputFormat, /tổng a \+ b/);
  assert.match(a.constraints, /10\^9/);
  assert.deepEqual(a.samples, [
    { input: '1 2\n', expectedOutput: '3\n' },
    { input: '10 20\n', expectedOutput: '30\n' },
  ]);

  assert.equal(b.title, 'Dãy con');
  assert.equal(b.difficulty, 'HARD');
  assert.equal(b.timeLimitMs, 2000);
  assert.equal(b.memoryLimitMb, 512);
  assert.match(b.inputFormat, /n và K/);
  assert.deepEqual(b.samples, [{ input: '3 3\n1 2 3\n', expectedOutput: '2\n' }]);
  assert.ok(!b.warnings.some((w) => w.includes('ví dụ')));
});

test('single problem without "Bài N" header uses the first line as title and warns', () => {
  const [draft] = parse([p('Số nguyên tố'), p('Kiểm tra n có phải số nguyên tố.')]);
  assert.equal(draft.title, 'Số nguyên tố');
  assert.ok(draft.warnings.some((w) => w.includes('ví dụ')));
  assert.equal(draft.difficulty, 'MEDIUM');
});

test('converts mammoth HTML (paragraphs, line breaks, tables) to blocks', () => {
  const blocks = htmlToBlocks(
    '<p>Bài 1. A &amp; B</p><table><tr><td><p>Input</p></td><td><p>Output</p></td></tr>' +
      '<tr><td><p>1</p><p>2</p></td><td><p>3</p></td></tr></table><p>x<br />y</p>',
  );
  assert.deepEqual(blocks, [
    { kind: 'paragraph', text: 'Bài 1. A & B' },
    { kind: 'table', rows: [['Input', 'Output'], ['1\n2', '3']] },
    { kind: 'paragraph', text: 'x\ny' },
  ]);
});
