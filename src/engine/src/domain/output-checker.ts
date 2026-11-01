/**
 * Default token-insensitive-to-trailing-whitespace checker:
 * lines are compared after trimming trailing spaces, trailing blank lines are ignored,
 * CRLF and LF are treated the same.
 */
export function outputsMatch(actual: string, expected: string): boolean {
  return normalize(actual) === normalize(expected);
}

function normalize(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
