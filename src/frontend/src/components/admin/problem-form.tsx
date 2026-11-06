'use client';

import {
  Difficulties,
  DifficultyLabels,
  fileIoFields,
  type Difficulty,
  type UpsertProblemRequest,
  type UpsertTestCaseRequest,
} from '@oj/contracts';
import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { TagsInput } from '../form-fields';
import { Button, Card, Field, InlineAlert, inputClass } from '../ui';
import { FileIoBlocker, ProblemTextField, SuggestionSwitch, useSectionSuggestions } from './problem-text-field';
import { TestListEditor } from './test-list-editor';

export const emptyProblem: UpsertProblemRequest = {
  title: '',
  difficulty: 'EASY',
  tags: [],
  statement: '',
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  timeLimitMs: 1000,
  memoryLimitMb: 256,
};

/**
 * The statement of a problem. When creating (`withTests`), the test list is written here too and saved with
 * the problem; a saved problem edits its tests separately (each change is saved at once).
 */
export function ProblemForm({
  initial,
  onSubmit,
  submitLabel = 'Lưu',
  withTests = false,
}: {
  initial: UpsertProblemRequest;
  onSubmit: (v: UpsertProblemRequest, tests: UpsertTestCaseRequest[]) => Promise<void>;
  submitLabel?: string;
  withTests?: boolean;
}) {
  const [v, setV] = useState<UpsertProblemRequest>(initial);
  const [tests, setTests] = useState<UpsertTestCaseRequest[]>([]);
  const samples = tests.filter((t) => t.isSample);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof UpsertProblemRequest>(k: K, val: UpsertProblemRequest[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const blocked = fileIoFields(v).length > 0;
  const suggestions = useSectionSuggestions(
    { ...v, samples },
    (patch) => setV((prev) => ({ ...prev, ...(patch as Partial<UpsertProblemRequest>) })),
    ['statement', 'inputFormat', 'outputFormat', 'constraints'],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (blocked) return;
    if (!v.title.trim()) return setError('Vui lòng nhập tên bài.');
    if (!(v.timeLimitMs > 0) || !(v.memoryLimitMb > 0)) return setError('Giới hạn thời gian/bộ nhớ phải lớn hơn 0.');
    setSaving(true);
    try {
      await onSubmit({ ...v, title: v.title.trim() }, tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Tên bài *" className="md:col-span-2">
            <input className={inputClass} value={v.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Độ khó">
            <select
              className={inputClass}
              value={v.difficulty}
              onChange={(e) => set('difficulty', e.target.value as Difficulty)}
            >
              {Difficulties.map((d) => (
                <option key={d} value={d}>
                  {DifficultyLabels[d]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Chủ đề (tags)" className="md:col-span-2">
            <TagsInput value={v.tags} onChange={(t) => set('tags', t)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Thời gian (ms)">
              <input
                type="number"
                min={100}
                step={100}
                className={inputClass}
                value={v.timeLimitMs}
                onChange={(e) => set('timeLimitMs', Number(e.target.value))}
              />
            </Field>
            <Field label="Bộ nhớ (MB)">
              <input
                type="number"
                min={16}
                step={16}
                className={inputClass}
                value={v.memoryLimitMb}
                onChange={(e) => set('memoryLimitMb', Number(e.target.value))}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h2 className="font-semibold text-slate-800">Nội dung đề</h2>
          <SuggestionSwitch
            label="Dùng gợi ý của AI cho tất cả các mục"
            text="Dùng gợi ý cho cả bài"
            suggestion={suggestions.all}
            className="text-sm"
            showLocked
          />
        </div>
        {(
          [
            ['statement', 12],
            ['inputFormat', 4],
            ['outputFormat', 4],
            ['constraints', 3],
          ] as const
        ).map(([field, rows]) => (
          <ProblemTextField
            key={field}
            field={field}
            value={v[field]}
            onChange={(s) => set(field, s)}
            rows={rows}
            suggestion={suggestions.of(field)}
          />
        ))}
      </Card>

      {withTests && (
        <TestListEditor
          tests={tests}
          onChange={setTests}
          suggest={(request) => api.suggestDraftTests({ ...request, problem: { ...v, samples }, tests })}
        />
      )}

      {error && <InlineAlert>{error}</InlineAlert>}
      <div className="sticky bottom-0 z-10 -mx-4 space-y-3 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <FileIoBlocker problems={[{ content: v }]} />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={blocked}>
            <Save className="h-4 w-4" />
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
