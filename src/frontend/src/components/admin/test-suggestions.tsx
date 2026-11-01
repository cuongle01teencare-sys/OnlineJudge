'use client';

import type {
  SuggestTestCasesRequest,
  TestCaseSuggestionDto,
  TestCaseSuggestionsDto,
  UpsertTestCaseRequest,
} from '@oj/contracts';
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { IoTextarea } from '../form-fields';
import { useToast } from '../toast';
import { Badge, Button, inputClass, Modal, Spinner } from '../ui';

/** Below this many tests the manager nudges the editor towards AI suggestions. */
export const FEW_TESTS = 5;

interface Draft extends TestCaseSuggestionDto {
  picked: boolean;
  open: boolean;
  /** Shown to students in the statement. */
  isSample: boolean;
}

/**
 * Asks the AI for extra tests, lets the editor review and edit them, then adds the picked ones one by one
 * (`addTest` saves one test of a saved problem, or appends to the list of a problem being written).
 * Nothing reaches the problem until "Thêm".
 */
export function SuggestTestsDialog({
  open,
  onClose,
  suggest,
  addTest,
}: {
  open: boolean;
  onClose: () => void;
  suggest: (request: SuggestTestCasesRequest) => Promise<TestCaseSuggestionsDto>;
  addTest: (test: UpsertTestCaseRequest) => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [points, setPoints] = useState(10);
  const [adding, setAdding] = useState(false);

  const busy = loading || adding;
  const picked = drafts?.filter((d) => d.picked) ?? [];

  const close = () => {
    if (busy) return;
    setDrafts(null);
    setNotes([]);
    onClose();
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await suggest({ count, focus: focus.trim() || null });
      // Tests whose output the AI computed by hand start unticked: the editor should check them first.
      setDrafts(res.suggestions.map((s) => ({ ...s, picked: s.outputVerified, open: false, isSample: false })));
      setNotes(res.notes);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds && ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const add = async () => {
    setAdding(true);
    const added: Draft[] = [];
    try {
      for (const d of picked) {
        await addTest({ input: d.input, expectedOutput: d.expectedOutput, isSample: d.isSample, points: Number(points) || 0 });
        added.push(d);
      }
      toast.success(`Đã thêm ${added.length} test`);
      setDrafts(null);
      setNotes([]);
      onClose();
    } catch (e) {
      toast.error(added.length ? `Đã thêm ${added.length} test, rồi gặp lỗi: ${errorMessage(e)}` : errorMessage(e));
      // Keep only what was not added yet, so a retry does not duplicate.
      setDrafts((ds) => ds && ds.filter((d) => !added.includes(d)));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ink-600" />
          Gợi ý test bằng AI
        </span>
      }
      wide
      footer={
        drafts ? (
          <>
            <Button variant="secondary" onClick={() => setDrafts(null)} disabled={busy}>
              <RotateCcw className="h-4 w-4" />
              Gợi ý lại
            </Button>
            <Button onClick={add} loading={adding} disabled={!picked.length || loading}>
              Thêm {picked.length} test đã chọn
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Hủy
            </Button>
            <Button onClick={generate} loading={loading}>
              <Sparkles className="h-4 w-4" />
              Tạo gợi ý
            </Button>
          </>
        )
      }
    >
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-600">
          <Spinner className="h-6 w-6" />
          <p>AI đang đọc đề, viết lời giải và chạy thử để tính output.</p>
          <p className="text-xs text-slate-500">Thường mất 30 giây đến 2 phút. Đừng đóng cửa sổ này.</p>
        </div>
      ) : !drafts ? (
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">
            AI đọc đề, các test hiện có và lời giải mẫu (nếu có), rồi đề xuất test mới: trường hợp biên, trường hợp đặc biệt
            và vài test ngẫu nhiên. Bạn xem lại và chọn test nào để thêm. Không có gì được lưu cho tới khi bạn bấm Thêm.
          </p>
          <label className="flex items-center gap-2">
            Số test
            <select className={cn(inputClass, 'w-24')} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span>Muốn tập trung vào (không bắt buộc)</span>
            <input
              className={inputClass}
              maxLength={300}
              placeholder="Ví dụ: n = 1, số âm, mảng toàn số bằng nhau"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-500">
            AI chỉ tạo test nhỏ (vài nghìn ký tự). Test rất lớn để kiểm tra tốc độ nên sinh bằng chương trình riêng.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {notes.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <p className="font-medium">AI lưu ý</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {drafts.length === 0 ? (
            <p className="py-6 text-center text-slate-500">AI không tìm được test mới nào khác các test đã có. Thử đổi phần muốn tập trung.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  Điểm mỗi test
                  <input
                    type="number"
                    min={0}
                    className={cn(inputClass, 'w-24')}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                  />
                </label>
                <span className="text-xs text-slate-500">Bấm vào từng test để xem và sửa input/output.</span>
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {drafts.map((d, i) => (
                  <li key={i} className="px-3 py-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        aria-label={`Chọn test ${i + 1}`}
                        checked={d.picked}
                        onChange={(e) => update(i, { picked: e.target.checked })}
                      />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => update(i, { open: !d.open })}>
                        <span className="flex flex-wrap items-center gap-2">
                          {d.open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="font-medium">Test {i + 1}</span>
                          {d.outputVerified ? (
                            <Badge className="bg-chalk-50 text-chalk-700 ring-1 ring-chalk-200">
                              <CircleCheck className="mr-1 inline h-3 w-3" />
                              Output đã chạy thử
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                              <CircleAlert className="mr-1 inline h-3 w-3" />
                              AI tự tính, hãy kiểm tra
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-slate-600">{d.purpose}</span>
                      </button>
                      <label className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-slate-600">
                        <input type="checkbox" checked={d.isSample} onChange={(e) => update(i, { isSample: e.target.checked })} />
                        Là ví dụ
                      </label>
                    </div>
                    {d.open && (
                      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <IoTextarea label="Input" rows={8} value={d.input} onChange={(input) => update(i, { input })} />
                        <IoTextarea
                          label="Output mong đợi"
                          rows={8}
                          value={d.expectedOutput}
                          onChange={(expectedOutput) => update(i, { expectedOutput })}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
