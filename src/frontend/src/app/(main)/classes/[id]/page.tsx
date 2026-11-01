'use client';

import type { ClassroomDto } from '@oj/contracts';
import { Archive, ArchiveRestore, Pencil, Send, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Container } from '@/components/app-shell';
import { ClassCode, ClassCodeInput, MoveStudentControl, TeacherSelect } from '@/components/classes';
import { RequireRole, STAFF } from '@/components/guards';
import { AssignFromBankDialog, SessionList } from '@/components/sessions';
import { ClassBoard } from '@/components/threads';
import { useToast } from '@/components/toast';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  inputClass,
  LoadingState,
  Modal,
  PageHeader,
} from '@/components/ui';
import { useNow } from '@/components/verification';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CLASS_CODE_RE } from '@/lib/classes';
import { formatRemaining, sortSessions } from '@/lib/sessions';
import { useAsync } from '@/lib/use-async';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

function ClassHeader({ cls, onSaved }: { cls: ClassroomDto; onSaved: (c: ClassroomDto) => void }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cls.name);
  const [code, setCode] = useState(cls.code ?? '');
  const [teacherId, setTeacherId] = useState(cls.teacherId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setName(cls.name);
    setCode(cls.code ?? '');
    setTeacherId(cls.teacherId);
    setError(null);
    setEditing(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Nhập tên lớp.');
    if (!CLASS_CODE_RE.test(code)) return setError('Mã lớp cần 4 đến 20 ký tự gồm chữ, số hoặc dấu gạch ngang.');
    setSaving(true);
    try {
      const c = await api.updateClass(cls.id, { name: name.trim(), code, ...(isAdmin ? { teacherId } : {}) });
      onSaved(c);
      setEditing(false);
      toast.success('Đã lưu lớp');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Card className="mb-6 p-5">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tên lớp">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Mã lớp" hint="Đổi mã thì mã cũ không dùng được để đăng ký nữa.">
              <ClassCodeInput value={code} onChange={setCode} name={name} />
            </Field>
            {isAdmin && (
              <Field label="Giáo viên phụ trách">
                <TeacherSelect value={teacherId} onChange={setTeacherId} />
              </Field>
            )}
          </div>
          {error && <InlineAlert>{error}</InlineAlert>}
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Lưu lớp
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Hủy
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
      <div>
        <div className="mb-1 text-sm text-slate-500">Mã lớp để học sinh đăng ký</div>
        {cls.code ? <ClassCode code={cls.code} size="lg" /> : <span className="text-slate-400">—</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Giáo viên</dt>
        <dd className="font-medium">{cls.teacherName}</dd>
        <dt className="text-slate-500">Sĩ số</dt>
        <dd className="font-medium">{cls.studentCount} học sinh</dd>
        <dt className="text-slate-500">Tạo ngày</dt>
        <dd>{formatDate(cls.createdAt)}</dd>
      </dl>
      {cls.status === 'ACTIVE' && (
        <Button variant="secondary" className="ml-auto" onClick={start}>
          <Pencil className="h-4 w-4" />
          Sửa lớp
        </Button>
      )}
    </Card>
  );
}

function Roster({ cls, onCountChange }: { cls: ClassroomDto; onCountChange: (delta: number) => void }) {
  const { data, error, loading, reload, setData } = useAsync(() => api.listClassStudents(cls.id), [cls.id]);
  const classes = useAsync(() => api.listClasses(), []);
  const students = [...(data ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));

  return (
    <Card className="mb-6">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">Học sinh trong lớp</h2>
        {data && <span className="text-sm text-slate-500">{data.length} học sinh</span>}
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : students.length === 0 ? (
        <EmptyState title="Lớp chưa có học sinh">
          {cls.status === 'ACTIVE' ? (
            <>
              Đưa mã lớp <b>{cls.code}</b> cho học sinh. Các em nhập mã này khi đăng ký tài khoản.
            </>
          ) : (
            'Lớp đã lưu trữ nên không nhận học sinh mới.'
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-rule bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Họ tên</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Số điện thoại</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Vào lớp</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s.userId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{s.displayName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.email}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 tabular-nums">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="hover:text-ink-700">
                        {s.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{formatDate(s.enrolledAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {cls.status === 'ACTIVE' && (
                      <MoveStudentControl
                        studentId={s.userId}
                        currentClassId={cls.id}
                        classes={(classes.data ?? []).filter((c) => c.status === 'ACTIVE')}
                        onMoved={() => {
                          setData((prev) => (prev ?? []).filter((x) => x.userId !== s.userId));
                          onCountChange(-1);
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ClassSessions({ cls }: { cls: ClassroomDto }) {
  const { data, error, loading, reload } = useAsync(() => api.listSessions({ classId: cls.id }), [cls.id]);
  const [assigning, setAssigning] = useState(false);
  const archived = cls.status === 'ARCHIVED';
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">Phiên đã giao</h2>
        {!archived && (
          <Button size="sm" onClick={() => setAssigning(true)}>
            <Send className="h-4 w-4" />
            Giao bài cho lớp
          </Button>
        )}
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : (
        <SessionList
          sessions={sortSessions(data ?? [])}
          managerProgress
          emptyTitle="Lớp chưa có phiên nào"
          emptyHint={archived ? undefined : 'Bấm “Giao bài cho lớp” và chọn một đề hoặc một bài trong ngân hàng của bạn.'}
        />
      )}
      <AssignFromBankDialog open={assigning} onClose={() => setAssigning(false)} classId={cls.id} />
    </Card>
  );
}

function LifecycleBar({ cls, onChange }: { cls: ClassroomDto; onChange: (c: ClassroomDto) => void }) {
  const toast = useToast();
  const router = useRouter();
  const now = useNow(60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [days, setDays] = useState('30');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<ClassroomDto>, msg: string) => {
    setBusy(key);
    try {
      onChange(await fn());
      toast.success(msg);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteNow = async () => {
    setBusy('delete');
    setDeleteError(null);
    try {
      await api.deleteClassNow(cls.id, { confirmName });
      toast.success(`Đã xóa lớp ${cls.name}`);
      router.replace('/classes');
    } catch (e) {
      setDeleteError(errorMessage(e));
      setBusy(null);
    }
  };

  if (cls.status === 'ACTIVE') {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-panel border border-rule bg-white px-5 py-3">
        <Badge className="bg-chalk-50 text-chalk-700 ring-1 ring-chalk-200">Đang học</Badge>
        <span className="flex-1 text-sm text-slate-600">
          Học sinh đăng ký được bằng mã lớp và nộp bài trong các phiên đang mở.
        </span>
        <Button variant="secondary" size="sm" onClick={() => setConfirmArchive(true)}>
          <Archive className="h-4 w-4" />
          Lưu trữ lớp
        </Button>
        <ConfirmDialog
          open={confirmArchive}
          title="Lưu trữ lớp này?"
          danger={false}
          confirmLabel="Lưu trữ lớp"
          loading={busy === 'archive'}
          message={
            <ul className="list-disc space-y-1 pl-5">
              <li>Lớp chỉ còn để xem: không nhận học sinh mới, không nộp bài, không giao bài mới.</li>
              <li>Học sinh vẫn mở được các phiên cũ và học bạ vẫn giữ nguyên.</li>
              <li>Bạn có thể khôi phục lớp bất cứ lúc nào, hoặc hẹn xóa hẳn.</li>
            </ul>
          }
          onConfirm={async () => {
            if (await run('archive', () => api.archiveClass(cls.id), 'Đã lưu trữ lớp')) setConfirmArchive(false);
          }}
          onClose={() => setConfirmArchive(false)}
        />
      </div>
    );
  }

  const purgeIn = cls.purgeAt ? new Date(cls.purgeAt).getTime() - now : null;
  return (
    <div className="mb-6 space-y-3 rounded-panel border border-amber-200 bg-amber-50/60 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-amber-100 text-amber-800 ring-1 ring-amber-200">Đã lưu trữ</Badge>
        <span className="flex-1 text-sm text-amber-900">
          Lớp chỉ còn để xem{cls.archivedAt ? ` từ ${formatDate(cls.archivedAt)}` : ''}. Học sinh vẫn mở được các phiên cũ.
        </span>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === 'restore'}
          onClick={() => run('restore', () => api.restoreClass(cls.id), 'Đã khôi phục lớp')}
        >
          <ArchiveRestore className="h-4 w-4" />
          Khôi phục
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-amber-200 pt-3 text-sm">
        {cls.purgeAt ? (
          <>
            <span className="font-medium text-mark-700">
              Sẽ xóa hẳn lúc {formatDateTime(cls.purgeAt)}
              {purgeIn !== null && purgeIn > 0 ? `, ${formatRemaining(purgeIn)}` : ''}
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'cancel'}
              onClick={() => run('cancel', () => api.cancelClassDeletion(cls.id), 'Đã hủy hẹn xóa')}
            >
              Hủy hẹn xóa
            </Button>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2">
              Hẹn xóa sau
              <input
                type="number"
                min={1}
                max={365}
                className={cn(inputClass, 'w-20 py-1')}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              ngày
            </label>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'schedule'}
              onClick={() => {
                const n = Math.round(Number(days));
                if (!(n >= 1 && n <= 365)) return toast.error('Nhập số ngày từ 1 đến 365.');
                run('schedule', () => api.scheduleClassDeletion(cls.id, n), `Đã hẹn xóa lớp sau ${n} ngày`);
              }}
            >
              Hẹn xóa
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-mark-600 hover:bg-mark-50"
          onClick={() => {
            setConfirmName('');
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Xóa ngay
        </Button>
      </div>
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Xóa hẳn lớp này?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={busy === 'delete'}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={deleteNow}
              loading={busy === 'delete'}
              disabled={confirmName.trim() !== cls.name}
            >
              Xóa lớp
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Lớp <b>{cls.name}</b> và mọi phiên của lớp sẽ bị xóa, không khôi phục được. Học sinh chỉ còn tên bài và kết quả
            trong học bạ.
          </p>
          <Field label={`Gõ tên lớp “${cls.name}” để xác nhận`}>
            <input className={inputClass} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoFocus />
          </Field>
          {deleteError && <InlineAlert>{deleteError}</InlineAlert>}
        </div>
      </Modal>
    </div>
  );
}

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: cls, error, loading, reload, setData } = useAsync(() => api.getClass(id), [id]);

  return (
    <RequireRole roles={STAFF}>
      <Container>
        {loading && !cls ? (
          <LoadingState />
        ) : error || !cls ? (
          <ErrorState message={error ?? 'Không tìm thấy lớp'} onRetry={reload} />
        ) : (
          <>
            <PageHeader back={{ href: '/classes', label: 'Lớp' }} title={cls.name} />
            <LifecycleBar cls={cls} onChange={(c) => setData(c)} />
            <ClassHeader key={cls.id + cls.code + cls.teacherId + cls.status} cls={cls} onSaved={(c) => setData(c)} />
            <ClassSessions cls={cls} />
            <ClassBoard classId={cls.id} archived={cls.status === 'ARCHIVED'} isManager />
            <Roster
              cls={cls}
              onCountChange={(d) => setData((prev) => (prev ? { ...prev, studentCount: prev.studentCount + d } : prev!))}
            />
          </>
        )}
      </Container>
    </RequireRole>
  );
}
