'use client';

import { Difficulties, DifficultyLabels, fileIoFields, type Difficulty, type UpsertProblemRequest } from '@oj/contracts';
import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TagsInput } from '../form-fields';
import { Button, Card, Field, InlineAlert, inputClass } from '../ui';
import { FileIoBlocker, ProblemTextField } from './problem-text-field';

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

export function ProblemForm({
  initial,
  onSubmit,
  submitLabel = 'Lưu',
}: {
  initial: UpsertProblemRequest;
  onSubmit: (v: UpsertProblemRequest) => Promise<void>;
  submitLabel?: string;
}) {
  const [v, setV] = useState<UpsertProblemRequest>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof UpsertProblemRequest>(k: K, val: UpsertProblemRequest[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const blocked = fileIoFields(v).length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (blocked) return;
    if (!v.title.trim()) return setError('Vui lòng nhập tên bài.');
    if (!(v.timeLimitMs > 0) || !(v.memoryLimitMb > 0)) return setError('Giới hạn thời gian/bộ nhớ phải lớn hơn 0.');
    setSaving(true);
    try {
      await onSubmit({ ...v, title: v.title.trim() });
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
        <ProblemTextField field="statement" value={v.statement} onChange={(s) => set('statement', s)} rows={12} />
        <ProblemTextField field="inputFormat" value={v.inputFormat} onChange={(s) => set('inputFormat', s)} rows={4} />
        <ProblemTextField field="outputFormat" value={v.outputFormat} onChange={(s) => set('outputFormat', s)} rows={4} />
        <ProblemTextField field="constraints" value={v.constraints} onChange={(s) => set('constraints', s)} rows={3} />
      </Card>

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
