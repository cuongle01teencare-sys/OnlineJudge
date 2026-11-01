'use client';

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';

/**
 * Renders problem statements / explanations. Content may be Markdown or plain text
 * (imported from .docx/.pdf), so single line breaks are preserved.
 */
export function Markdown({ children, className }: { children: string | null | undefined; className?: string }) {
  if (!children || !children.trim()) return null;
  return (
    <div className={cn('markdown prose prose-slate max-w-none prose-sm sm:prose-base', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
