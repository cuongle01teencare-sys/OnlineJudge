'use client';

import type { SuggestTestCasesRequest, TestCaseSuggestionsDto, UpsertTestCaseRequest } from '@oj/contracts';
import { ChevronDown, ChevronRight, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { IoTextarea } from '../form-fields';
import { Button, Card, EmptyState, inputClass } from '../ui';
import { FEW_TESTS, SuggestTestsDialog } from './test-suggestions';

const preview = (s: string, n = 60) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n)}…` : one || '(trống)';
};

/**
 * The test list of a problem that is not saved yet (creating, importing). Everything stays local until the
 * problem is saved with it. Examples are tests marked "Là ví dụ": they are shown in the statement.
 */
export function TestListEditor({
  tests,
  onChange,
  suggest,
  className,
}: {
  tests: UpsertTestCaseRequest[];
  onChange: (tests: UpsertTestCaseRequest[]) => void;
  suggest: (request: SuggestTestCasesRequest) => Promise<TestCaseSuggestionsDto>;
  className?: string;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  // The list as it grows while the AI dialog adds tests one by one.
  const latest = useRef(tests);
  latest.current = tests;

  const update = (i: number, patch: Partial<UpsertTestCaseRequest>) =>
    onChange(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const toggle = (i: number) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  const add = () => {
    onChange([...tests, { input: '', expectedOutput: '', isSample: tests.length === 0, points: 10 }]);
    setOpen((o) => new Set(o).add(tests.length));
  };
  const remove = (i: number) => {
    onChange(tests.filter((_, j) => j !== i));
    setOpen((o) => new Set([...o].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
  };

  const samples = tests.filter((t) => t.isSample).length;
  const totalPoints = tests.reduce((s, t) => s + (Number(t.points) || 0), 0);

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div>
          <h2 className="font-semibold">
            Bộ test ({tests.length}
            {samples > 0 && `, ${samples} ví dụ`})
          </h2>
          <p className="text-xs text-slate-500">
            Tổng điểm test: {totalPoints}. Test đánh dấu &quot;Là ví dụ&quot; hiển thị trong đề cho học sinh; các test còn lại
            được giữ kín để chấm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSuggesting(true)}>
            <Sparkles className="h-4 w-4" />
            Gợi ý bằng AI
          </Button>
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Thêm test
          </Button>
        </div>
      </div>

      {tests.length > 0 && tests.length < FEW_TESTS && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-ink-50/60 px-5 py-2 text-sm text-slate-700">
          <span>Bộ test còn ít ({tests.length} test), học sinh có thể qua bài dù code còn sai ở trường hợp biên.</span>
          <Button size="sm" variant="ghost" onClick={() => setSuggesting(true)}>
            <Sparkles className="h-4 w-4" />
            Để AI gợi ý thêm
          </Button>
        </div>
      )}

      {tests.length === 0 ? (
        <EmptyState title="Chưa có test nào">
          Bấm <b>Thêm test</b> để tự nhập, hoặc <b>Gợi ý bằng AI</b> để AI đề xuất từ đề bài. Có thể thêm sau khi lưu.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tests.map((t, i) => {
            const expanded = open.has(i);
            return (
              <li key={i} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="flex items-center gap-1 text-sm font-medium tabular-nums text-slate-700"
                    aria-expanded={expanded}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}#{i + 1}
                  </button>
                  <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-slate-500 md:block">
                    {preview(t.input)} ⟹ {preview(t.expectedOutput, 30)}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" checked={t.isSample} onChange={(e) => update(i, { isSample: e.target.checked })} />
                      Là ví dụ
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Điểm test ${i + 1}`}
                        className={cn(inputClass, 'h-8 w-16 px-2 text-xs')}
                        value={t.points}
                        onChange={(e) => update(i, { points: Number(e.target.value) })}
                      />
                      điểm
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(i)}
                      className="text-mark-600 hover:bg-mark-50"
                      aria-label={`Xóa test ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <IoTextarea label="Input" rows={5} value={t.input} onChange={(input) => update(i, { input })} />
                    <IoTextarea
                      label="Output mong đợi"
                      rows={5}
                      value={t.expectedOutput}
                      onChange={(expectedOutput) => update(i, { expectedOutput })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SuggestTestsDialog
        open={suggesting}
        onClose={() => setSuggesting(false)}
        suggest={(request) => suggest(request)}
        addTest={(test) => {
          latest.current = [...latest.current, test];
          onChange(latest.current);
        }}
      />
    </Card>
  );
}
