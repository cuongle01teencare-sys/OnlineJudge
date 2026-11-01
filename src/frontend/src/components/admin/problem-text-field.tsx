'use client';

import {
  fileIoFields,
  fileIoMessage,
  hasFileIo,
  ioSideOf,
  ProblemTextFieldLabels,
  toStandardIo,
  type ProblemTextField,
} from '@oj/contracts';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownField } from '../form-fields';

function SuggestionSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
      <button
        type="button"
        role="switch"
        aria-label={`Dùng gợi ý cho mục ${label}`}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-chalk-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
      <Wand2 className="h-3.5 w-3.5 text-ink-600" />
      Dùng gợi ý
    </label>
  );
}

/**
 * A statement section that keeps the teacher's wording. When it asks to read or write files, a switch
 * next to the label swaps in the standard-input/output rewrite (and back to the original when turned off).
 */
export function ProblemTextField({
  field,
  value,
  onChange,
  rows,
}: {
  field: ProblemTextField;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const side = ioSideOf(field);
  // The teacher's own text while the suggestion is on.
  const [original, setOriginal] = useState<string | null>(null);
  const usingSuggestion = original !== null;
  const fileIo = hasFileIo(value, side);
  const suggestion = fileIo ? toStandardIo(value, side) : value;
  const canSuggest = usingSuggestion || suggestion !== value;

  const toggle = (on: boolean) => {
    if (on) {
      setOriginal(value);
      onChange(suggestion);
    } else {
      onChange(original ?? value);
      setOriginal(null);
    }
  };

  return (
    <MarkdownField
      label={ProblemTextFieldLabels[field]}
      value={value}
      onChange={onChange}
      rows={rows}
      labelExtra={
        canSuggest && <SuggestionSwitch label={ProblemTextFieldLabels[field]} checked={usingSuggestion} onChange={toggle} />
      }
      below={
        fileIo ? (
          <div className="mt-2 rounded-lg border border-mark-200 bg-mark-50 px-3 py-2 text-sm text-mark-700">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Mục này còn yêu cầu đọc/ghi file nên chưa lưu được: hệ thống chấm đưa dữ liệu qua bàn phím (đầu vào chuẩn)
                và chấm theo những gì in ra màn hình. Hãy sửa lại{suggestion !== value && ', hoặc bật "Dùng gợi ý"'}.
              </span>
            </p>
            {suggestion !== value && !usingSuggestion && (
              <p className="mt-1 pl-6 text-xs text-slate-600">
                Gợi ý: <span className="whitespace-pre-wrap">{suggestion || '(để trống)'}</span>
              </p>
            )}
          </div>
        ) : usingSuggestion ? (
          <p className="mt-1 text-xs text-slate-500">Đang dùng gợi ý. Tắt &quot;Dùng gợi ý&quot; để quay lại nội dung gốc.</p>
        ) : null
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
          <li key={i}>{b.label ? `${b.label}: ` : ''}{fileIoMessage(b.fields)}</li>
        ))}
      </ul>
    </div>
  );
}
