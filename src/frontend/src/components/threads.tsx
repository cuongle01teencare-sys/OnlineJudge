'use client';

import type { Role, SessionDto, ThreadKind, ThreadSummaryDto } from '@oj/contracts';
import { HelpCircle, Megaphone, MessageSquare, Pin, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { cn, formatDateTime } from '@/lib/utils';
import { MarkdownField } from './form-fields';
import { useToast } from './toast';
import { Badge, Button, Card, EmptyState, ErrorState, Field, InlineAlert, inputClass, LoadingState, Modal } from './ui';

export function ThreadKindBadge({ kind }: { kind: ThreadKind }) {
  return kind === 'ANNOUNCEMENT' ? (
    <Badge className="bg-ink-50 text-ink-700 ring-1 ring-ink-200">
      <Megaphone className="mr-1 h-3 w-3" aria-hidden="true" />
      Thông báo
    </Badge>
  ) : (
    <Badge className="bg-sky-50 text-sky-800 ring-1 ring-sky-200">
      <HelpCircle className="mr-1 h-3 w-3" aria-hidden="true" />
      Hỏi đáp
    </Badge>
  );
}

export function AuthorName({ name, role }: { name: string; role: Role }) {
  const staff = role === 'TEACHER' || role === 'ADMIN';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('font-medium', staff ? 'text-ink-700' : 'text-slate-800')}>{name}</span>
      {staff && <Badge className="bg-ink-600 text-white">Giáo viên</Badge>}
    </span>
  );
}

/** Pinned first, then latest activity (the backend already sorts; this keeps local inserts in order). */
function sortThreads(list: ThreadSummaryDto[]) {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function ThreadList({ threads, compact }: { threads: ThreadSummaryDto[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100">
      {sortThreads(threads).map((t) => (
        <li key={t.id}>
          <Link href={`/threads/${t.id}`} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 px-5 hover:bg-slate-50', compact ? 'py-2.5' : 'py-3.5')}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {t.pinned && <Pin className="h-3.5 w-3.5 text-ink-600" aria-label="Đã ghim" />}
                <ThreadKindBadge kind={t.kind} />
                <span className="font-medium text-slate-900">{t.title}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-4 text-xs text-slate-500">
                <AuthorName name={t.authorName} role={t.authorRole} />
                {t.sessionTitle && (
                  <span>
                    Về {t.problemKey ? `bài ${t.problemKey}, ` : ''}
                    {t.sessionTitle}
                  </span>
                )}
                <span>Hoạt động {formatDateTime(t.lastActivityAt)}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm text-slate-500 tabular-nums">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {t.replyCount}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NewThreadDialog({
  open,
  onClose,
  classId,
  isManager,
  preset,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  isManager: boolean;
  preset?: { sessionId: string; problemKey: string | null };
  onCreated?: (t: ThreadSummaryDto) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const sessions = useAsync<SessionDto[]>(() => api.listSessions({ classId }), [classId], open);
  const [kind, setKind] = useState<ThreadKind>('QUESTION');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [problemKey, setProblemKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(preset ? 'QUESTION' : isManager ? 'ANNOUNCEMENT' : 'QUESTION');
    setTitle('');
    setBody('');
    setSessionId(preset?.sessionId ?? '');
    setProblemKey(preset?.problemKey ?? '');
    setError(null);
  }, [open, preset, isManager]);

  const session = (sessions.data ?? []).find((s) => s.id === sessionId);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Đặt tiêu đề ngắn cho bài đăng.');
    if (!body.trim()) return setError(kind === 'QUESTION' ? 'Viết câu hỏi của bạn.' : 'Viết nội dung thông báo.');
    setSaving(true);
    try {
      const t = await api.createThread(classId, {
        kind,
        title: title.trim(),
        body,
        sessionId: sessionId || null,
        problemKey: sessionId && problemKey ? problemKey : null,
      });
      toast.success(kind === 'QUESTION' ? 'Đã gửi câu hỏi' : 'Đã đăng thông báo');
      onCreated?.(t);
      onClose();
      router.push(`/threads/${t.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={kind === 'QUESTION' ? 'Đặt câu hỏi' : 'Đăng thông báo'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={() => submit()} loading={saving}>
            {kind === 'QUESTION' ? 'Gửi câu hỏi' : 'Đăng thông báo'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {isManager && !preset && (
          <div className="inline-flex rounded-control bg-slate-100 p-1 text-sm" role="radiogroup" aria-label="Loại bài đăng">
            {(['ANNOUNCEMENT', 'QUESTION'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn('rounded-[4px] px-3 py-1', kind === k ? 'bg-white font-medium ring-1 ring-slate-300' : 'text-slate-600')}
              >
                {k === 'ANNOUNCEMENT' ? 'Thông báo' : 'Hỏi đáp'}
              </button>
            ))}
          </div>
        )}
        <Field label="Tiêu đề">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'QUESTION' ? 'Bài B bị quá thời gian ở test lớn' : 'Lịch kiểm tra tuần sau'}
            autoFocus
          />
        </Field>
        <MarkdownField
          label={kind === 'QUESTION' ? 'Câu hỏi' : 'Nội dung'}
          value={body}
          onChange={setBody}
          rows={6}
          placeholder={kind === 'QUESTION' ? 'Mô tả bạn đã thử gì và chỗ nào chưa hiểu. Có thể dán code trong ```.' : undefined}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Về phiên (không bắt buộc)">
            <select
              className={inputClass}
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setProblemKey('');
              }}
            >
              <option value="">Không gắn với phiên nào</option>
              {(sessions.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bài">
            <select className={inputClass} value={problemKey} onChange={(e) => setProblemKey(e.target.value)} disabled={!session}>
              <option value="">Cả phiên</option>
              {[...(session?.problems ?? [])]
                .sort((a, b) => a.order - b.order)
                .map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.key}. {p.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** "Bảng tin lớp": announcements and Q&A of one class. */
export function ClassBoard({
  classId,
  archived,
  isManager,
  canPost = true,
}: {
  classId: string;
  archived: boolean;
  isManager: boolean;
  /** false for classes the student has left. */
  canPost?: boolean;
}) {
  const { data, error, loading, reload, setData } = useAsync(() => api.listThreads(classId), [classId]);
  const [creating, setCreating] = useState(false);
  const writable = !archived && canPost;
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">Bảng tin lớp</h2>
        {writable && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {isManager ? 'Đăng bài' : 'Đặt câu hỏi'}
          </Button>
        )}
      </div>
      {archived && <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">Lớp đã lưu trữ nên bảng tin chỉ còn để đọc.</p>}
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="Chưa có bài đăng nào">
          {writable ? (isManager ? 'Đăng thông báo đầu tiên cho lớp.' : 'Có chỗ chưa hiểu? Đặt câu hỏi cho giáo viên và các bạn.') : undefined}
        </EmptyState>
      ) : (
        <ThreadList threads={data} />
      )}
      {writable && (
        <NewThreadDialog
          open={creating}
          onClose={() => setCreating(false)}
          classId={classId}
          isManager={isManager}
          onCreated={(t) => setData((prev) => [t, ...(prev ?? [])])}
        />
      )}
    </Card>
  );
}

/** Solve page: questions about this problem, plus "Hỏi về bài này". */
export function ProblemQuestions({
  classId,
  sessionId,
  problemKey,
  canAsk,
  isManager,
}: {
  classId: string;
  sessionId: string;
  problemKey: string;
  canAsk: boolean;
  isManager: boolean;
}) {
  const { data, loading } = useAsync(() => api.listThreads(classId, { sessionId, problemKey }), [classId, sessionId, problemKey]);
  const [asking, setAsking] = useState(false);
  const [preset] = useState(() => ({ sessionId, problemKey }));
  return (
    <section className="mt-8 border-t border-rule pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Câu hỏi về bài này</h2>
        {canAsk && (
          <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 hover:underline">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Hỏi về bài này
          </button>
        )}
      </div>
      {loading && !data ? (
        <p className="text-sm text-slate-400">Đang tải…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có câu hỏi nào.</p>
      ) : (
        <div className="-mx-5">
          <ThreadList threads={data} compact />
        </div>
      )}
      {canAsk && (
        <NewThreadDialog open={asking} onClose={() => setAsking(false)} classId={classId} isManager={isManager} preset={preset} />
      )}
    </section>
  );
}
