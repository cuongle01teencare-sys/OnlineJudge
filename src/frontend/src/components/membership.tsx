'use client';

import type { ClassroomDto, ClassStudentDto, MembershipRequestDto, MembershipRequestKind, MembershipRequestStatus } from '@oj/contracts';
import { Check, LogOut, UserMinus, UserPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { normalizeClassCode } from '@/lib/classes';
import { useAsync } from '@/lib/use-async';
import { cn, formatDateTime } from '@/lib/utils';
import { useToast } from './toast';
import { Badge, Button, Card, ConfirmDialog, ErrorState, Field, InlineAlert, inputClass, LoadingState, Modal } from './ui';

const kindLabel: Record<MembershipRequestKind, string> = { JOIN: 'Xin vào lớp', LEAVE: 'Xin rời lớp' };
const kindClass: Record<MembershipRequestKind, string> = {
  JOIN: 'bg-chalk-50 text-chalk-700 ring-1 ring-chalk-200',
  LEAVE: 'bg-mark-50 text-mark-700 ring-1 ring-mark-200',
};

export function RequestKindBadge({ kind }: { kind: MembershipRequestKind }) {
  return <Badge className={kindClass[kind]}>{kindLabel[kind]}</Badge>;
}

const statusLabel: Record<MembershipRequestStatus, string> = {
  PENDING: 'Chờ giáo viên duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
};
const statusClass: Record<MembershipRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  APPROVED: 'bg-chalk-100 text-chalk-700',
  REJECTED: 'bg-mark-100 text-mark-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export function RequestStatusBadge({ status }: { status: MembershipRequestStatus }) {
  return <Badge className={statusClass[status]}>{statusLabel[status]}</Badge>;
}

/** The student's own note on a request, quoted. */
function RequestMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-1 max-w-[72ch] border-l-2 border-rule pl-2 text-sm whitespace-pre-line text-slate-600">{message}</p>;
}

// ---------- Student side ----------

/** "Tham gia lớp": class code plus an optional note; sends a join request. */
export function JoinClassForm({ onSent }: { onSent: (r: MembershipRequestDto) => void }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length < 4) return setError('Nhập mã lớp giáo viên đưa, ví dụ 22DTHC5.');
    setSending(true);
    try {
      const r = await api.joinClass({ classCode: code, message: message.trim() || null });
      toast.success(`Đã gửi yêu cầu vào lớp ${r.className}`);
      setCode('');
      setMessage('');
      onSent(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Mã lớp">
        <input
          className={cn(inputClass, 'font-mono tracking-[0.15em]')}
          value={code}
          onChange={(e) => setCode(normalizeClassCode(e.target.value))}
          placeholder="22DTHC5"
          spellCheck={false}
          autoComplete="off"
        />
      </Field>
      <Field label="Lời nhắn cho giáo viên (không bắt buộc)">
        <input
          className={inputClass}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder="Em là Nguyễn Văn A, lớp 11A1"
        />
      </Field>
      {error && <InlineAlert>{error}</InlineAlert>}
      <Button type="submit" loading={sending}>
        <UserPlus className="h-4 w-4" />
        Gửi yêu cầu vào lớp
      </Button>
      <p className="text-xs text-slate-500">Giáo viên duyệt xong, lớp sẽ hiện trong danh sách của bạn.</p>
    </form>
  );
}

/** "Xin rời lớp" with a confirm dialog and an optional note. Shows the pending state instead when one exists. */
export function LeaveClassButton({
  cls,
  pending,
  onSent,
  onCancel,
}: {
  cls: ClassroomDto;
  pending?: MembershipRequestDto;
  onSent: (r: MembershipRequestDto) => void;
  onCancel: (r: MembershipRequestDto) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pending) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Badge className={statusClass.PENDING}>Đang chờ duyệt rời lớp</Badge>
        <CancelRequestButton request={pending} onCancelled={onCancel} />
      </span>
    );
  }
  if (cls.status === 'ARCHIVED') return null;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.leaveClass(cls.id, { message: message.trim() || null });
      toast.success('Đã gửi yêu cầu rời lớp');
      setOpen(false);
      setMessage('');
      onSent(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <LogOut className="h-4 w-4" />
        Xin rời lớp
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Xin rời lớp ${cls.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="danger" onClick={send} loading={busy}>
              Gửi yêu cầu rời lớp
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Giáo viên {cls.teacherName} sẽ duyệt yêu cầu. Khi đã rời lớp, bạn vẫn xem lại được các phiên cũ và bảng tin của lớp,
            nhưng không nộp bài mới.
          </p>
          <Field label="Lý do (không bắt buộc)">
            <textarea
              className={cn(inputClass, 'min-h-20')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              autoFocus
            />
          </Field>
          {error && <InlineAlert>{error}</InlineAlert>}
        </div>
      </Modal>
    </>
  );
}

export function CancelRequestButton({
  request,
  onCancelled,
}: {
  request: MembershipRequestDto;
  onCancelled: (r: MembershipRequestDto) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api.cancelMembershipRequest(request.id);
          toast.success('Đã hủy yêu cầu');
          onCancelled(r);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      Hủy yêu cầu
    </Button>
  );
}

/** The student's requests: pending ones first (with "Hủy yêu cầu"), then the most recent decisions. */
export function MyRequestList({
  requests,
  onChange,
}: {
  requests: MembershipRequestDto[];
  onChange: (r: MembershipRequestDto) => void;
}) {
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING').slice(0, 5);
  if (requests.length === 0) return null;
  return (
    <ul className="divide-y divide-slate-100">
      {[...pending, ...decided].map((r) => (
        <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3">
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-2">
              <RequestKindBadge kind={r.kind} />
              <span className="font-medium text-slate-900">{r.className}</span>
              <RequestStatusBadge status={r.status} />
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-slate-500">
              <span>Giáo viên {r.teacherName}</span>
              <span>Gửi {formatDateTime(r.createdAt)}</span>
              {r.decidedAt && r.status !== 'CANCELLED' && (
                <span>
                  {r.status === 'APPROVED' ? 'Duyệt' : 'Từ chối'} {formatDateTime(r.decidedAt)}
                  {r.decidedByName ? `, bởi ${r.decidedByName}` : ''}
                </span>
              )}
            </div>
            <RequestMessage message={r.message} />
          </div>
          {r.status === 'PENDING' && <CancelRequestButton request={r} onCancelled={onChange} />}
        </li>
      ))}
    </ul>
  );
}

// ---------- Teacher / admin side ----------

/** Pending join and leave requests of one class, with approve / reject. Read-only while the class is archived. */
export function ClassRequestsPanel({ cls, onDecided }: { cls: ClassroomDto; onDecided: () => void }) {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => api.listClassRequests(cls.id), [cls.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const archived = cls.status === 'ARCHIVED';
  const list = data ?? [];
  const joins = list.filter((r) => r.kind === 'JOIN').length;

  // Hidden when there is nothing to decide, so the class page stays quiet.
  if (!loading && !error && list.length === 0) return null;

  const decide = async (r: MembershipRequestDto, approve: boolean) => {
    setBusy(r.id + (approve ? ':ok' : ':no'));
    try {
      await (approve ? api.approveMembershipRequest(r.id) : api.rejectMembershipRequest(r.id));
      toast.success(
        approve
          ? r.kind === 'JOIN'
            ? `Đã nhận ${r.studentName} vào lớp`
            : `Đã cho ${r.studentName} rời lớp`
          : `Đã từ chối yêu cầu của ${r.studentName}`,
      );
      setData((prev) => (prev ?? []).filter((x) => x.id !== r.id));
      onDecided();
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    setBusy('all');
    try {
      const { approved } = await api.approveAllJoinRequests(cls.id);
      toast.success(`Đã nhận ${approved} học sinh vào lớp`);
      setData((prev) => (prev ?? []).filter((x) => x.kind !== 'JOIN'));
      onDecided();
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mb-6 border-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">
          Yêu cầu chờ duyệt
          {list.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums">{list.length}</span>}
        </h2>
        {!archived && joins > 0 && (
          <Button size="sm" variant="success" onClick={approveAll} loading={busy === 'all'} disabled={!!busy && busy !== 'all'}>
            <Check className="h-4 w-4" />
            Duyệt tất cả yêu cầu vào lớp ({joins})
          </Button>
        )}
      </div>
      {archived && (
        <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
          Lớp đã lưu trữ nên chưa duyệt được. Các yêu cầu vẫn được giữ, khôi phục lớp để duyệt.
        </p>
      )}
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <RequestKindBadge kind={r.kind} />
                  <span className="font-medium text-slate-900">{r.studentName}</span>
                  <span className="text-sm break-all text-slate-500">{r.studentEmail}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Gửi {formatDateTime(r.createdAt)}</div>
                <RequestMessage message={r.message} />
              </div>
              {!archived && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={r.kind === 'LEAVE' ? 'secondary' : 'success'}
                    loading={busy === r.id + ':ok'}
                    disabled={!!busy}
                    onClick={() => decide(r, true)}
                  >
                    <Check className="h-4 w-4" />
                    {r.kind === 'JOIN' ? 'Duyệt vào lớp' : 'Duyệt rời lớp'}
                  </Button>
                  <Button size="sm" variant="ghost" loading={busy === r.id + ':no'} disabled={!!busy} onClick={() => decide(r, false)}>
                    <X className="h-4 w-4" />
                    Từ chối
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "Thêm học sinh" by account email: no request, the student is in the class at once. */
export function AddStudentForm({ classId, onAdded }: { classId: string; onAdded: (s: ClassStudentDto) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError('Nhập email tài khoản học sinh.');
    setBusy(true);
    try {
      const s = await api.addStudent(classId, { email: email.trim() });
      toast.success(`Đã thêm ${s.displayName} vào lớp`);
      setEmail('');
      onAdded(s);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-b border-slate-100 px-5 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Thêm học sinh bằng email" className="min-w-0 flex-1 basis-56">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hocsinh@gmail.com"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="secondary" loading={busy}>
          <UserPlus className="h-4 w-4" />
          Thêm học sinh
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Học sinh cần đăng ký tài khoản trước. Thêm bằng email thì vào lớp ngay, không cần duyệt.</p>
      {error && (
        <div className="mt-2">
          <InlineAlert>{error}</InlineAlert>
        </div>
      )}
    </form>
  );
}

/** Roster row action: "Mời ra khỏi lớp", confirmed. The student keeps the class as read-only history. */
export function RemoveStudentButton({
  cls,
  student,
  onRemoved,
}: {
  cls: ClassroomDto;
  student: ClassStudentDto;
  onRemoved: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="text-mark-600 hover:bg-mark-50" onClick={() => setOpen(true)}>
        <UserMinus className="h-4 w-4" />
        Mời ra khỏi lớp
      </Button>
      <ConfirmDialog
        open={open}
        title={`Mời ${student.displayName} ra khỏi lớp?`}
        confirmLabel="Mời ra khỏi lớp"
        loading={busy}
        message={
          <ul className="list-disc space-y-1 pl-5">
            <li>Học sinh không còn trong lớp {cls.name}, không nộp bài mới cho lớp này.</li>
            <li>Các phiên đã làm, bài nộp và học bạ vẫn được giữ; học sinh vẫn xem lại được lớp ở mục lớp cũ.</li>
            <li>Muốn nhận lại, thêm học sinh bằng email hoặc duyệt khi học sinh xin vào lớp.</li>
          </ul>
        }
        onConfirm={async () => {
          setBusy(true);
          try {
            await api.removeStudent(cls.id, student.userId);
            toast.success(`Đã mời ${student.displayName} ra khỏi lớp`);
            setOpen(false);
            onRemoved();
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
