/**
 * Code similarity by fingerprinting (the idea behind MOSS):
 * 1. tokenize, dropping comments/whitespace and replacing identifiers, numbers and strings by placeholders,
 *    so renaming variables or reformatting does not hide copying;
 * 2. hash every k-gram of tokens;
 * 3. keep the minimum hash of each window of w consecutive k-grams ("winnowing");
 * 4. similarity = Jaccard index of the two fingerprint sets.
 * Short programs are not compared: trivial solutions all look alike.
 */
const K = 5;
const WINDOW = 4;
export const MIN_TOKENS = 40;

const KEYWORDS = new Set([
  // C / C++ / Java / JS
  'int', 'long', 'short', 'char', 'float', 'double', 'bool', 'boolean', 'void', 'auto', 'const', 'static', 'unsigned',
  'signed', 'struct', 'class', 'public', 'private', 'protected', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'new', 'delete', 'true', 'false', 'null', 'nullptr', 'this', 'template', 'typename',
  'using', 'namespace', 'include', 'define', 'let', 'var', 'function', 'import', 'export', 'try', 'catch', 'throw',
  'string', 'vector', 'map', 'set', 'pair', 'cin', 'cout', 'scanf', 'printf', 'endl', 'main', 'sizeof', 'typedef',
  'final', 'extends', 'implements', 'interface', 'throws', 'String', 'System', 'Scanner', 'Math', 'console',
  // Python
  'def', 'in', 'not', 'and', 'or', 'is', 'elif', 'pass', 'lambda', 'None', 'True', 'False', 'from', 'as', 'with',
  'yield', 'global', 'range', 'len', 'print', 'input', 'map', 'list', 'dict', 'sorted', 'sum', 'min', 'max', 'split',
]);

/** Tokens with identifiers/literals abstracted. */
export function normalizedTokens(code: string): string[] {
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/^\s*#(?!include|define)[^\n]*/gm, ' ') // Python comments (keep C preprocessor lines)
    .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, ' S ');
  const tokens: string[] = [];
  const re = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--|[+\-*/%=<>!&|^~?:;,.(){}[\]]/g;
  for (const m of stripped.matchAll(re)) {
    const t = m[0];
    if (t[0] === '"' || t[0] === "'") tokens.push('S');
    else if (/^\d/.test(t)) tokens.push('N');
    else if (/^[A-Za-z_]/.test(t)) tokens.push(KEYWORDS.has(t) ? t : 'I');
    else tokens.push(t);
  }
  return tokens;
}

/** Winnowed fingerprint set; null if the program is too short to compare meaningfully. */
export function fingerprint(code: string): Set<number> | null {
  const tokens = normalizedTokens(code);
  if (tokens.length < MIN_TOKENS) return null;
  const hashes: number[] = [];
  for (let i = 0; i + K <= tokens.length; i++) hashes.push(hash(tokens.slice(i, i + K).join('\u0001')));
  const result = new Set<number>();
  for (let i = 0; i + WINDOW <= hashes.length; i++) {
    let min = hashes[i];
    for (let j = 1; j < WINDOW; j++) min = Math.min(min, hashes[i + j]);
    result.add(min);
  }
  return result;
}

export function similarity(a: Set<number>, b: Set<number>): number {
  let common = 0;
  for (const h of a) if (b.has(h)) common++;
  const union = a.size + b.size - common;
  return union === 0 ? 0 : common / union;
}

/** FNV-1a 32-bit. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
