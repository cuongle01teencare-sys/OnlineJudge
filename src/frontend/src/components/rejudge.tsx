'use client';

import type { SessionDto } from '@oj/contracts';
import { RefreshCcw, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from './toast';
import { Button, Card, ConfirmDialog, inputClass } from './ui';
import { cn } from '@/lib/utils';

type Pending = { kind: 'rejudge'; key: string | null } | { kind: 'refresh' } | null;

/** Manager tools: rejudge (all or one problem) and refresh problems from the bank, then rejudge. */
export function RejudgeTools({ session, onSession }: { session: SessionDto; onSession: (s: SessionDto) => void }) {
  const toast = useToast();
  const [key, setKey] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const problems = [...session.problems].sort((a, b) => a.order - b.order);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'refresh') {
        const s = await api.refreshSession(session.id);
        onSession(s);
        const r = await api.rejudgeSession(session.id, {});
        toast.success(`Đã cập nhật đề và đưa ${r.queued} bài nộp vào hàng chờ chấm lại`);
        setNote(`Đã cập nhật đề từ ngân hàng. ${r.queued} bài nộp đang được chấm lại.`);
      } else {
        const r = await api.rejudgeSession(session.id, pending.key ? { problemKey: pending.key } : {});
        toast.success(`Đã đưa ${r.queued} bài nộp vào hàng chờ chấm lại`);
        setNote(`${r.queued} bài nộp đang được chấm lại.`);
      }
      setPending(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const target = pending?.kind === 'rejudge' && pending.key ? problems.find((p) => p.key === pending.key) : null;

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Chấm lại</h2>
      <p className="mt-1 text-sm text-slate-600">
        Dùng khi bạn sửa test hoặc phát hiện lỗi đề. Điểm và học bạ của học sinh được tính lại theo kết quả mới.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPending({ kind: 'rejudge', key: null })}>
          <RotateCw className="h-4 w-4" />
          Chấm lại tất cả
        </Button>
        <span className="inline-flex items-center gap-1.5">
          <select className={cn(inputClass, 'w-auto py-1 text-sm')} value={key} onChange={(e) => setKey(e.target.value)} aria-label="Bài cần chấm lại">
            <option value="">Chọn bài…</option>
            {problems.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key}. {p.title}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" disabled={!key} onClick={() => setPending({ kind: 'rejudge', key })}>
            Chấm lại bài {key || '…'}
          </Button>
        </span>
        <Button variant="secondary" size="sm" onClick={() => setPending({ kind: 'refresh' })}>
          <RefreshCcw className="h-4 w-4" />
          Cập nhật đề từ ngân hàng & chấm lại
        </Button>
      </div>
      {note && (
        <p className="mt-3 text-sm text-slate-600">
          {note} Trong lúc chấm lại, bảng điểm có thể tạm thấp hơn; tải lại sau ít phút.
        </p>
      )}
      <ConfirmDialog
        open={!!pending}
        danger={false}
        loading={busy}
        title={
          pending?.kind === 'refresh'
            ? 'Cập nhật đề từ ngân hàng và chấm lại?'
            : target
              ? `Chấm lại bài ${target.key}?`
              : 'Chấm lại mọi bài nộp?'
        }
        confirmLabel={pending?.kind === 'refresh' ? 'Cập nhật và chấm lại' : 'Chấm lại'}
        message={
          pending?.kind === 'refresh' ? (
            <>
              Đề, giới hạn và bộ test của các bài trong phiên sẽ được lấy lại từ ngân hàng (giữ nguyên thứ tự và điểm). Sau
              đó mọi bài nộp được chấm lại, nên điểm của học sinh có thể thay đổi theo test mới.
            </>
          ) : (
            <>
              {target ? `Mọi bài nộp của bài ${target.key}. ${target.title}` : 'Mọi bài nộp trong phiên'} sẽ được chấm lại với
              bộ test hiện tại của phiên. Điểm và học bạ được tính lại theo kết quả mới.
            </>
          )
        }
        onConfirm={run}
        onClose={() => setPending(null)}
      />
    </Card>
  );
}
