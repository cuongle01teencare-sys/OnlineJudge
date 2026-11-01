import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAboutFileIo, toStandardIo } from '../src/shared/domain/standard-io.js';

test('file-based input/output wording becomes standard input/output', () => {
  assert.equal(toStandardIo('Dữ liệu vào từ file BAI1.INP gồm hai số a, b.'), 'Dữ liệu vào từ đầu vào chuẩn gồm hai số a, b.');
  assert.equal(toStandardIo('Đọc dữ liệu từ tệp văn bản "SUM.INP":'), 'Đọc dữ liệu từ đầu vào chuẩn:');
  assert.equal(toStandardIo('Ghi kết quả ra file BAI1.OUT một số nguyên.'), 'Ghi kết quả ra màn hình (đầu ra chuẩn) một số nguyên.');
  assert.equal(toStandardIo('Kết quả ghi vào tập tin KQ.OUT'), 'Kết quả ghi ra màn hình (đầu ra chuẩn)');
  assert.equal(toStandardIo('Dữ liệu vào (BAI1.INP): một dòng chứa n.'), 'Dữ liệu vào: một dòng chứa n.');
  assert.equal(toStandardIo('Tên file chương trình: BAI1.CPP\nCho dãy số nguyên.'), 'Cho dãy số nguyên.');
});

test('every way of giving the input in a file becomes standard input', () => {
  const cases: [string, string][] = [
    ['Dữ liệu vào: cho trong file BAI1.INP gồm hai dòng.', 'Dữ liệu vào: được cho từ đầu vào chuẩn gồm hai dòng.'],
    ['Dữ liệu vào được cho bởi tệp văn bản DAYSO.INP có cấu trúc:', 'Dữ liệu vào được cho từ đầu vào chuẩn có cấu trúc:'],
    ['File dữ liệu vào BAI1.INP gồm một dòng chứa n.', 'Dữ liệu vào gồm một dòng chứa n.'],
    ['Tệp dữ liệu vào: SUM.INP', 'Dữ liệu vào:'],
    ['Tệp vào BAI1.INP gồm:', 'Dữ liệu vào gồm:'],
    ['Tệp input gồm n dòng.', 'Dữ liệu vào gồm n dòng.'],
    ['Input file: input.txt', 'Input:'],
    ['Dòng đầu tiên của tệp chứa số n.', 'Dòng đầu tiên của dữ liệu vào chứa số n.'],
    ['Dữ liệu nằm trong tệp BAI2.INP.', 'Dữ liệu được cho từ đầu vào chuẩn.'],
    ['Dữ liệu vào: Đọc dữ liệu từ tệp input.txt', 'Dữ liệu vào: Đọc dữ liệu từ đầu vào chuẩn'],
  ];
  for (const [source, expected] of cases) assert.equal(toStandardIo(source), expected, source);
});

test('in the output section a bare "file" means the result', () => {
  assert.equal(toStandardIo('File kết quả BAI1.OUT gồm một số.', 'output'), 'Kết quả gồm một số.');
  assert.equal(toStandardIo('Tệp ra: SUM.OUT', 'output'), 'Kết quả:');
  assert.equal(toStandardIo('Kết quả ghi trong file KQ.OUT', 'output'), 'Kết quả in ra màn hình (đầu ra chuẩn)');
  assert.equal(toStandardIo('Dòng đầu của file ghi số cách chọn.', 'output'), 'Dòng đầu của kết quả ghi số cách chọn.');
});

test('text without files is left alone', () => {
  const s = 'Cho n số nguyên. In ra tổng của chúng.\nRa khỏi vòng lặp khi n = 0.';
  assert.equal(toStandardIo(s), s);
  assert.equal(toStandardIo('Profile của học sinh có 3 dòng.'), 'Profile của học sinh có 3 dòng.');
});

test('hints about reading or writing files are recognised', () => {
  for (const note of [
    'Đề yêu cầu đọc từ file BAI1.INP và ghi ra BAI1.OUT, cần chuyển sang stdin/stdout.',
    'Chương trình phải ghi kết quả vào tệp.',
    'Tên file chương trình không rõ.',
    'Học sinh cần dùng freopen.',
    'File đầu vào có thể rất lớn.',
  ]) assert.ok(isAboutFileIo(note), note);
  for (const note of [
    'Đề không ghi độ khó — AI đã ước lượng, hãy kiểm tra lại.',
    'Hình vẽ ở bài 2 không đọc được.',
    'Không tìm thấy ví dụ (test mẫu).',
    'Có nhiều đáp án đúng, cần checker riêng.',
  ]) assert.ok(!isAboutFileIo(note), note);
});

test('imported exams come out with standard input/output', async () => {
  const { ImportService } = await import('../src/modules/importing/application/import.service.js');
  const p = (text: string) => ({ kind: 'paragraph' as const, text });
  const doc = { fileName: 'de.docx', blocks: [
    p('Bài 1. TỔNG HAI SỐ'),
    p('Tên file chương trình: TONG.CPP'),
    p('Cho hai số nguyên a và b.'),
    p('Dữ liệu vào: Đọc từ file TONG.INP một dòng chứa a, b.'),
    p('Kết quả: Ghi ra file TONG.OUT tổng a + b.'),
    p('Ví dụ:'),
    { kind: 'table' as const, rows: [['TONG.INP', 'TONG.OUT'], ['1 2', '3']] },
  ] };
  const service = new ImportService(
    { read: async () => doc } as never,
    { available: false } as never,
    {} as never,
  );
  const [draft] = (await service.parse({ originalName: 'de.docx', mimeType: '', buffer: Buffer.alloc(0) })).drafts;
  assert.equal(draft.inputFormat, 'Đọc từ đầu vào chuẩn một dòng chứa a, b.');
  assert.equal(draft.outputFormat, 'Ghi ra màn hình (đầu ra chuẩn) tổng a + b.');
  assert.doesNotMatch(draft.statement, /TONG\.CPP|file/i);
  assert.deepEqual(draft.samples, [{ input: '1 2\n', expectedOutput: '3\n' }]);
  assert.ok(draft.warnings.every((w) => !isAboutFileIo(w)));
});
