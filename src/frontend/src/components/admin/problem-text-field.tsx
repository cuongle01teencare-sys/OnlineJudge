'use client';

import {
  fileIoFields,
  fileIoMessage,
  hasFileIo,
  ioSideOf,
  ProblemTextFieldLabels,
  type ProblemDraftContent,
  type ProblemTextField,
} from '@oj/contracts';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MarkdownField } from '../form-fields';
import { useToast } from '../toast';
import { Spinner } from '../ui';

/** A section the AI can rewrite. */
type Section = ProblemTextField;

/** What one "Dùng gợi ý" switch needs. */
export interface SectionSuggestion {
  on: boolean;
  loading: boolean;
  notes: string[];
  toggle: (on: boolean) => void;
}

/**
 * Per-section AI suggestions for a problem being written (`content.samples` gives the AI the examples). Turning a section on asks the AI and swaps in its
 * version; turning it off puts the teacher's own text back. `apply` must merge into the latest state,
 * since several sections may answer at once (the "whole problem" switch).
 */
export function useSectionSuggestions(
  content: ProblemDraftContent,
  apply: (patch: Partial<Record<Section, string>>) => void,
  sections: Section[],
) {
  const toast = useToast();
  // The teacher's own value of each section while its suggestion is on.
  const [originals, setOriginals] = useState<Partial<Record<Section, string>>>({});
  const [loading, setLoading] = useState<Partial<Record<Section, boolean>>>({});
  const [notes, setNotes] = useState<Partial<Record<Section, string[]>>>({});
  const latest = useRef(content);
  latest.current = content;

  const isOn = (s: Section) => s in originals;

  const toggle = async (s: Section, on: boolean) => {
    if (on === isOn(s) || loading[s]) return;
    if (!on) {
      apply({ [s]: originals[s] });
      setOriginals(({ [s]: _, ...rest }) => rest);
      setNotes(({ [s]: _, ...rest }) => rest);
      return;
    }
    setLoading((l) => ({ ...l, [s]: true }));
    const before = latest.current[s];
    try {
      const res = await api.suggestProblemSection({ section: s, problem: latest.current });
      apply({ [s]: res.text });
      setOriginals((o) => ({ ...o, [s]: before }));
      setNotes((n) => ({ ...n, [s]: res.notes }));
    } catch (e) {
      toast.error(`${ProblemTextFieldLabels[s]}: ${errorMessage(e)}`);
    } finally {
      setLoading((l) => ({ ...l, [s]: false }));
    }
  };

  const of = (s: Section): SectionSuggestion => ({
    on: isOn(s),
    loading: !!loading[s],
    notes: notes[s] ?? [],
    toggle: (on) => void toggle(s, on),
  });

  return {
    of,
    /** The "whole problem" switch: on when every section uses its suggestion. */
    all: {
      on: sections.every(isOn),
      loading: sections.some((s) => loading[s]),
      notes: [],
      toggle: (on: boolean) => sections.forEach((s) => void toggle(s, on)),
    } satisfies SectionSuggestion,
  };
}

export function SuggestionSwitch({
  label,
  suggestion,
  text = 'Dùng gợi ý',
  className,
}: {
  label: string;
  suggestion: SectionSuggestion;
  text?: string;
  className?: string;
}) {
  const { on, loading, toggle } = suggestion;
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700', className)}>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={on}
        aria-busy={loading}
        disabled={loading}
        onClick={() => toggle(!on)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait',
          on ? 'bg-chalk-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white transition-transform',
            on ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
      {loading ? <Spinner className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5 text-ink-600" />}
      {loading ? 'AI đang viết…' : text}
    </label>
  );
}

/** Notes from the AI, and how to go back, under a section that uses its suggestion. */
export function SuggestionNotes({ suggestion }: { suggestion: SectionSuggestion }) {
  if (!suggestion.on) return null;
  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {suggestion.notes.map((n, i) => (
        <p key={i} className="flex items-start gap-1 text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {n}
        </p>
      ))}
      <p className="text-slate-500">Đang dùng gợi ý của AI. Tắt &quot;Dùng gợi ý&quot; để quay lại nội dung gốc.</p>
    </div>
  );
}

/** A statement section with its "Dùng gợi ý" switch; refuses file input/output with an explanation. */
export function ProblemTextField({
  field,
  value,
  onChange,
  rows,
  suggestion,
}: {
  field: ProblemTextField;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  suggestion: SectionSuggestion;
}) {
  const label = ProblemTextFieldLabels[field];
  const fileIo = hasFileIo(value, ioSideOf(field));
  return (
    <MarkdownField
      label={label}
      value={value}
      onChange={onChange}
      rows={rows}
      labelExtra={<SuggestionSwitch label={`Dùng gợi ý cho mục ${label}`} suggestion={suggestion} />}
      below={
        <>
          {fileIo && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-mark-200 bg-mark-50 px-3 py-2 text-sm text-mark-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Mục này còn yêu cầu đọc/ghi file nên chưa lưu được: hệ thống chấm đưa dữ liệu qua bàn phím (đầu vào chuẩn) và
                chấm theo những gì in ra màn hình. Hãy sửa lại, hoặc bật &quot;Dùng gợi ý&quot;.
              </span>
            </p>
          )}
          <SuggestionNotes suggestion={suggestion} />
        </>
      }
    />
  );
}

/** Explains why the form cannot be submitted, or nothing when it can. */
export function FileIoBlocker({ problems }: { problems: { label?: string; content: Parameters<typeof fileIoFields>[0] }[] }) {
  const blocked = problems
    .map((p) => ({ label: p.label, fields: fileIoFields(p.content) }))
    .filter((p) => p.fields.length > 0);
  if (!blocked.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-mark-200 bg-mark-50 px-4 py-3 text-sm text-mark-700">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Chưa lưu được vì đề còn yêu cầu đọc/ghi file
      </p>
      <ul className="mt-1 max-h-28 list-disc space-y-0.5 overflow-auto pl-10">
        {blocked.map((b, i) => (
          <li key={i}>
            {b.label ? `${b.label}: ` : ''}
            {fileIoMessage(b.fields)}
          </li>
        ))}
      </ul>
    </div>
  );
}
