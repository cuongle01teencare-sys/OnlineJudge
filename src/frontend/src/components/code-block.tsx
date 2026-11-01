'use client';

import type { Language } from '@oj/contracts';
import hljs from 'highlight.js/lib/core';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Split highlight.js HTML output into lines, closing and re-opening spans
 * that cross line boundaries so each line is valid standalone HTML.
 */
function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const stack: string[] = [];
  let current = '';
  const re = /(<span[^>]*>)|(<\/span>)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) {
      stack.push(m[1]);
      current += m[1];
    } else if (m[2]) {
      stack.pop();
      current += m[2];
    } else if (m[3]) {
      const parts = m[3].split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          current += '</span>'.repeat(stack.length);
          lines.push(current);
          current = stack.join('');
        }
        current += parts[i];
      }
    }
  }
  lines.push(current);
  return lines;
}

/** Syntax-highlighted, line-numbered code (light theme; print friendly). */
export function CodeBlock({
  code,
  language,
  className,
  maxHeight,
  highlights,
}: {
  code: string;
  language: Language | string | null | undefined;
  className?: string;
  maxHeight?: string;
  /** 1-based line ranges to mark (e.g. integrity review), with a short note shown on hover. */
  highlights?: { startLine: number; endLine: number; reason?: string }[];
}) {
  const marked = (n: number) => highlights?.find((h) => n >= h.startLine && n <= h.endLine);
  const lines = useMemo(() => {
    const src = code.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    let html: string;
    try {
      html =
        language && hljs.getLanguage(language)
          ? hljs.highlight(src, { language, ignoreIllegals: true }).value
          : escapeHtml(src);
    } catch {
      html = escapeHtml(src);
    }
    return splitHighlightedLines(html);
  }, [code, language]);

  return (
    <div
      className={cn('code-block overflow-auto rounded-lg border border-slate-200 bg-slate-50', className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse font-mono text-[13px] leading-5">
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={cn(marked(i + 1) && 'bg-amber-100/70')}
              title={marked(i + 1)?.reason || undefined}
            >
              <td className="code-ln w-10 border-r border-slate-200 pr-2 pl-3 text-right align-top text-slate-400 select-none">
                {i + 1}
              </td>
              <td
                className="code-line hljs-line pr-4 pl-3 align-top whitespace-pre-wrap [overflow-wrap:anywhere] text-slate-800"
                dangerouslySetInnerHTML={{ __html: line || '&#8203;' }}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
