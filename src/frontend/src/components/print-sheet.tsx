'use client';

import { LanguageLabels, ProblemSetTypeLabels, type AnswerKeyDto, type ProblemDetailDto } from '@oj/contracts';
import { ChevronLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { CodeBlock } from './code-block';
import { RequireAuth, RequireRole, STAFF } from './guards';
import { Markdown } from './markdown';
import { Button, ErrorState, LoadingState } from './ui';

function Toolbar({ setId, title, hint }: { setId: string; title: string; hint: string }) {
  return (
    <div className="no-print sticky top-0 z-10 border-b border-rule bg-white">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
        <Link href={`/bank/sets/${setId}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-ink-700">
          <ChevronLeft className="h-4 w-4" />
          Về trang đề
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{title}</div>
          <div className="hidden text-xs text-slate-500 sm:block">{hint}</div>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          In / Lưu PDF
        </Button>
      </div>
    </div>
  );
}

function SheetHeader({ data, answerKey }: { data: AnswerKeyDto; answerKey: boolean }) {
  const s = data.problemSet;
  return (
    <header className="mb-6 border-b-2 border-black pb-4 text-center">
      <div className="text-sm">
        {ProblemSetTypeLabels[s.type]}
      </div>
      <h1 className="mt-1 text-[20pt] leading-tight font-bold">{s.title}</h1>
      {answerKey && <div className="mt-1 text-[13pt] font-bold">Đáp án và hướng dẫn chấm</div>}
      <div className="mt-2 flex flex-wrap justify-center gap-x-6 text-sm">
        <span>
          {data.problems.length} bài, tổng {s.totalPoints} điểm
        </span>
        <span>Thời gian làm bài: ........ phút</span>
      </div>
      {!answerKey && (
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-6 text-left text-[12pt]">
          <span>Họ và tên: ..............................................................</span>
          <span>Lớp: ..................</span>
        </div>
      )}
    </header>
  );
}

function SampleTable({ p }: { p: ProblemDetailDto }) {
  const samples = p.testCases.filter((t) => t.isSample).sort((a, b) => a.order - b.order);
  if (samples.length === 0) return null;
  return (
    <div className="avoid-break mt-3">
      <div className="mb-1 font-bold">Ví dụ</div>
      <table className="w-full border-collapse text-[11pt]">
        <thead>
          <tr>
            <th className="w-1/2 border border-black px-2 py-1 text-left">Input</th>
            <th className="w-1/2 border border-black px-2 py-1 text-left">Output</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((t) => (
            <tr key={t.id} className="sample-block align-top">
              <td className="border border-black px-2 py-1">
                <pre className="io-block">{t.input}</pre>
              </td>
              <td className="border border-black px-2 py-1">
                <pre className="io-block">{t.expectedOutput}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="font-bold">{label}</div>
      {children}
    </div>
  );
}

function ProblemBlock({ p, index, answerKey }: { p: AnswerKeyDto['problems'][number]; index: number; answerKey: boolean }) {
  return (
    <section className="print-problem mb-10">
      <h2 className="text-[14pt] leading-snug font-bold">
        Bài {index + 1}. {p.title} <span className="font-normal">({p.points} điểm)</span>
      </h2>
      <div className="mb-2 text-[10.5pt]">
        Giới hạn thời gian {p.timeLimitMs} ms, bộ nhớ {p.memoryLimitMb} MB.
      </div>
      {answerKey ? (
        <details open className="text-[11pt]">
          <summary className="no-print cursor-pointer text-sm text-slate-500">Đề bài</summary>
          <Markdown className="prose-sm!">{p.statement}</Markdown>
        </details>
      ) : (
        <Markdown>{p.statement}</Markdown>
      )}
      {p.inputFormat?.trim() && (
        <Labeled label="Dữ liệu vào">
          <Markdown>{p.inputFormat}</Markdown>
        </Labeled>
      )}
      {p.outputFormat?.trim() && (
        <Labeled label="Kết quả">
          <Markdown>{p.outputFormat}</Markdown>
        </Labeled>
      )}
      {p.constraints?.trim() && (
        <Labeled label="Ràng buộc">
          <Markdown>{p.constraints}</Markdown>
        </Labeled>
      )}
      <SampleTable p={p} />

      {answerKey && (
        <div className="mt-5 border-t border-black pt-3">
          <div className="text-[13pt] font-bold">Hướng dẫn giải</div>
          {p.solution?.explanation?.trim() ? (
            <Markdown>{p.solution.explanation}</Markdown>
          ) : (
            <p className="italic">Chưa có hướng dẫn.</p>
          )}
          {p.solution?.code?.trim() && (
            <div className="mt-3">
              <div className="mb-1 font-bold">
                Chương trình mẫu{p.solution.language ? ` (${LanguageLabels[p.solution.language]})` : ''}
              </div>
              <CodeBlock code={p.solution.code} language={p.solution.language} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SheetContent({ answerKey }: { answerKey: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(() => api.getAnswerKey(id), [id]);

  useEffect(() => {
    if (data) document.title = `${answerKey ? 'Đáp án' : 'Đề'}: ${data.problemSet.title}`;
  }, [data, answerKey]);

  if (loading && !data) return <LoadingState />;
  if (error || !data)
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState message={error ?? 'Không tải được đề'} onRetry={reload} />
      </div>
    );

  const problems = [...data.problems];
  const order = new Map(data.problemSet.items.map((i) => [i.problemId, i.order]));
  problems.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <Toolbar
        setId={id}
        title={answerKey ? 'In đáp án' : 'In đề'}
        hint={
          answerKey
            ? 'Bản dành cho giáo viên: có hướng dẫn giải và chương trình mẫu.'
            : 'Bản cho học sinh: chỉ có đề bài và ví dụ, không có lời giải.'
        }
      />
      <main className="print-page print-sheet mx-auto my-6 max-w-[210mm] bg-white px-5 py-8 sm:px-[16mm] sm:py-[18mm] ring-1 ring-rule print:my-0 print:ring-0">
        <SheetHeader data={data} answerKey={answerKey} />
        {problems.map((p, i) => (
          <ProblemBlock key={p.id} p={p} index={i} answerKey={answerKey} />
        ))}
      </main>
    </div>
  );
}

export function PrintSheet({ answerKey }: { answerKey: boolean }) {
  return (
    <RequireAuth>
      <RequireRole roles={STAFF}>
        <SheetContent answerKey={answerKey} />
      </RequireRole>
    </RequireAuth>
  );
}
