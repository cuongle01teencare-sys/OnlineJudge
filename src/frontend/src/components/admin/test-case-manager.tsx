'use client';

import type { TestCaseDto, UpsertTestCaseRequest } from '@oj/contracts';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { IoTextarea } from '../form-fields';
import { useToast } from '../toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, inputClass, Modal } from '../ui';

const emptyTest: UpsertTestCaseRequest = { input: '', expectedOutput: '', isSample: false, points: 10 };

function preview(s: string, n = 80) {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n)}…` : one || '(trống)';
}

export function TestCaseManager({
  problemId,
  testCases,
  onChange,
}: {
  problemId: string;
  testCases: TestCaseDto[];
  onChange: (tcs: TestCaseDto[]) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; value: UpsertTestCaseRequest } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<TestCaseDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = [...testCases].sort((a, b) => a.order - b.order);
  const totalPoints = sorted.reduce((s, t) => s + (t.points || 0), 0);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = { ...editing.value, points: Number(editing.value.points) || 0 };
      if (editing.id) {
        const tc = await api.updateTestCase(problemId, editing.id, body);
        onChange(testCases.map((t) => (t.id === tc.id ? tc : t)));
        toast.success('Đã cập nhật test');
      } else {
        const tc = await api.createTestCase(problemId, body);
        onChange([...testCases, tc]);
        toast.success('Đã thêm test');
      }
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleSample = async (t: TestCaseDto) => {
    try {
      const tc = await api.updateTestCase(problemId, t.id, {
        input: t.input,
        expectedOutput: t.expectedOutput,
        points: t.points,
        isSample: !t.isSample,
      });
      onChange(testCases.map((x) => (x.id === tc.id ? tc : x)));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteTestCase(problemId, deleting.id);
      onChange(testCases.filter((t) => t.id !== deleting.id));
      toast.success('Đã xóa test');
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div>
          <h2 className="font-semibold">Bộ test ({sorted.length})</h2>
          <p className="text-xs text-slate-500">
            Tổng điểm test: {totalPoints}. Điểm bài nộp được quy đổi về thang 100. Test &quot;ví dụ&quot; hiển thị cho học sinh.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ id: null, value: { ...emptyTest } })}>
          <Plus className="h-4 w-4" />
          Thêm test
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="Chưa có test nào">Thêm ít nhất một test để có thể chấm bài.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((t, i) => {
            const open = !!expanded[t.id];
            return (
              <li key={t.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((x) => ({ ...x, [t.id]: !open }))}
                    className="flex items-center gap-1 text-sm font-medium tabular-nums text-slate-700"
                  >
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}#{i + 1}
                  </button>
                  {t.isSample && <Badge className="bg-sky-100 text-sky-700">Ví dụ</Badge>}
                  <Badge>{t.points} điểm</Badge>
                  <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-slate-500 md:block">
                    {preview(t.input)}  ⟹  {preview(t.expectedOutput, 40)}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <label className="mr-2 flex cursor-pointer items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" checked={t.isSample} onChange={() => toggleSample(t)} />
                      Ví dụ
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: t.id,
                          value: { input: t.input, expectedOutput: t.expectedOutput, isSample: t.isSample, points: t.points },
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} className="text-mark-600 hover:bg-mark-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <pre className="io-block max-h-60 overflow-auto rounded border border-slate-200 bg-slate-50 p-2">{t.input}</pre>
                    <pre className="io-block max-h-60 overflow-auto rounded border border-slate-200 bg-slate-50 p-2">
                      {t.expectedOutput}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Sửa test' : 'Thêm test'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={save} loading={saving}>
              Lưu test
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <IoTextarea
                label="Input"
                rows={12}
                value={editing.value.input}
                onChange={(input) => setEditing({ ...editing, value: { ...editing.value, input } })}
              />
              <IoTextarea
                label="Output mong đợi"
                rows={12}
                value={editing.value.expectedOutput}
                onChange={(expectedOutput) => setEditing({ ...editing, value: { ...editing.value, expectedOutput } })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                Điểm
                <input
                  type="number"
                  min={0}
                  className={cn(inputClass, 'w-24')}
                  value={editing.value.points}
                  onChange={(e) => setEditing({ ...editing, value: { ...editing.value, points: Number(e.target.value) } })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.value.isSample}
                  onChange={(e) => setEditing({ ...editing, value: { ...editing.value, isSample: e.target.checked } })}
                />
                Là test ví dụ (hiển thị trong đề)
              </label>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Xóa test?"
        message="Test này sẽ bị xóa vĩnh viễn."
        loading={deleteBusy}
        onConfirm={doDelete}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}
