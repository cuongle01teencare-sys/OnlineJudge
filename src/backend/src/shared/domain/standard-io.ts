/**
 * The judge feeds tests on standard input and compares standard output; programs never open files.
 * Exams written for file-based contests ("Dữ liệu vào từ file BAI1.INP", "Ghi kết quả ra file BAI1.OUT")
 * are rewritten to standard I/O, and hints about files are dropped.
 */

/** Which section the text comes from: decides what a bare "the file" refers to. */
export type IoSide = 'input' | 'output';

const FILE = '(?:tệp|file|tập tin)(?:\\s+văn\\s+bản)?';
// A file name such as BAI1.INP, sum.out or "DAYSO.TXT" (quotes and parentheses allowed around it).
const NAME = '[\\s:]*["“(]?[\\p{L}\\d_-]+\\.(?:inp|out|in|ans|txt|dat)["”)]?';
const B = '(?<![\\p{L}\\d])'; // word start (\b does not know Vietnamese letters)
const E = '(?![\\p{L}\\d])'; // word end
const WORD_END = `${E}(?!\\.[\\p{L}\\d])`; // "input" but not "input.txt"
const INPUT_WORDS = '(?:dữ\\s+liệu\\s+vào|dữ\\s+liệu\\s+đầu\\s+vào|dữ\\s+liệu|đầu\\s+vào|vào|nhập|input)';
const OUTPUT_WORDS = '(?:dữ\\s+liệu\\s+ra|dữ\\s+liệu\\s+đầu\\s+ra|kết\\s+quả|đầu\\s+ra|ra|xuất|output)';
const STDIN = 'đầu vào chuẩn';
const STDOUT = 'màn hình (đầu ra chuẩn)';

const re = (source: string, flags = 'giu') => new RegExp(source, flags);
const isOutputName = (match: string) => /\.(?:out|ans)["”)]?$/i.test(match.trim());

/** "Tệp vào: SUM.INP" keeps its colon once the file name is gone. */
const colon = (match: string) => (match.includes(':') ? ':' : '');

/** Keeps a capital first letter when the replaced words started the sentence. */
const keepCase = (match: string, text: string) => {
  const first = match.trimStart()[0] ?? '';
  return first !== first.toLowerCase() ? text[0].toUpperCase() + text.slice(1) : text;
};

function rules(side: IoSide): [RegExp, string | ((match: string) => string)][] {
  const theData = side === 'output' ? 'kết quả' : 'dữ liệu vào';
  return [
    // "Tên file chương trình: BAI1.CPP", "Tên tệp bài làm là SUM.PAS": the line is meaningless without files.
    [re(`^.*tên\\s+(?:tệp|file|tập tin)\\s+(?:chương trình|bài làm|mã nguồn).*$`, 'gimu'), ''],
    // "Input file: input.txt", "output file"
    [re(`${B}(input|output)\\s+file${E}(?:${NAME})?`), (m) => (/^\s*i/i.test(m) ? 'Input' : 'Output') + colon(m)],
    // "File dữ liệu vào BAI1.INP gồm", "Tệp vào: SUM.INP", "Tệp dữ liệu: X.INP"
    [re(`${B}${FILE}\\s+${INPUT_WORDS}${WORD_END}(?:${NAME})?`), (m) => keepCase(m, 'dữ liệu vào') + colon(m)],
    // "File kết quả BAI1.OUT gồm", "Tệp ra: SUM.OUT"
    [re(`${B}${FILE}\\s+${OUTPUT_WORDS}${WORD_END}(?:${NAME})?`), (m) => keepCase(m, 'kết quả') + colon(m)],
    // "đọc từ file BAI1.INP", "nhập vào từ tệp văn bản SUM.INP"
    [re(`${B}từ\\s+${FILE}(?:${NAME})?`), `từ ${STDIN}`],
    // "ghi ra file BAI1.OUT", "ghi kết quả vào tệp SUM.OUT", "đưa ra tập tin KQ.OUT"
    [re(`${B}(?:ra|vào)\\s+${FILE}(?:${NAME})?`), `ra ${STDOUT}`],
    // "cho trong file BAI1.INP", "được cho bởi tệp DAYSO.INP", "nằm trong tệp X.INP", "ghi trong file KQ.OUT"
    [re(`${B}(?:(?:được\\s+)?(?:cho|nằm|chứa|lưu|ghi)\\s+)?(?:trong|bởi|ở|tại)\\s+${FILE}(?:${NAME})?`),
      (m) => (isOutputName(m) || /^\s*ghi/i.test(m) || (side === 'output' && !/\.(?:inp|in|txt|dat)/i.test(m))
        ? `in ra ${STDOUT}`
        : `được cho từ ${STDIN}`)],
    // "Dòng đầu tiên của tệp chứa n" -> "của dữ liệu vào" (or "của kết quả" in the output section)
    [re(`${B}(của|trên)\\s+${FILE}${E}(?:${NAME})?`), (m) => `${m.trim().split(/\s+/)[0]} ${theData}`],
    // Anything left: "file BAI1.INP", "tệp SUM.OUT"
    [re(`${B}${FILE}${NAME}`), ''],
    // Bare file names: "Dữ liệu vào (BAI1.INP):", "Input: input.txt"
    [re(`\\s*["“(]?${B}(?:[\\p{L}\\d_-]+\\.(?:inp|out|ans)|input\\.txt|output\\.txt)${E}["”)]?`), ''],
  ];
}

/** Rewrites file-based input/output wording to standard input/output. */
export function toStandardIo(text: string, side: IoSide = 'input'): string {
  let out = text;
  for (const [pattern, replacement] of rules(side)) {
    out = out.replace(pattern, replacement as string);
  }
  return out
    .replace(/[ \t]+([:.,;])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const FILE_HINT = new RegExp(
  [
    `\\.(?:inp|out)${E}`,
    'freopen|fopen|[io]?fstream|assign\\s*\\(|redirect',
    `${B}(?:đọc|ghi|viết|xuất|nhập|lưu|in|mở|đưa)${E}[^.\\n]{0,40}${B}(?:tệp|file|tập tin)`,
    `${B}(?:tệp|file|tập tin)\\s+(?:vào|ra|đầu vào|đầu ra|input|output|kết quả|dữ liệu)`,
    `${B}(?:input|output)\\s+file`,
    'tên\\s+(?:tệp|file|tập tin)',
  ].join('|'),
  'iu',
);

/** True for a hint about reading or writing files, which does not apply to this judge. */
export function isAboutFileIo(note: string): boolean {
  return FILE_HINT.test(note);
}
