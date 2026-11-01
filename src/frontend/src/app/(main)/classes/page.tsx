'use client';

import type { ClassroomDto } from '@oj/contracts';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Container } from '@/components/app-shell';
import { ClassCode, ClassFormModal, MoveStudentControl } from '@/components/classes';
import { RequireRole, STAFF } from '@/components/guards';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/use-async';
import { formatDate } from '@/lib/utils';

function UnassignedStudents({ classes, onAssigned }: { classes: ClassroomDto[]; onAssigned: () => void }) {
  const { data, error, loading, reload, setData } = useAsync(() => api.listUnassignedStudents(), []);
  return (
    <Card className="mt-6">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">Học sinh chưa có lớp</h2>
        {data && data.length > 0 && <span className="text-sm text-slate-500">{data.length} học sinh</span>}
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Mọi học sinh đều đã có lớp.</p>
      ) : classes.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-600">Có {data.length} học sinh chưa có lớp. Tạo lớp trước để xếp các em vào lớp.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-rule bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Họ tên</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Số điện thoại</th>
                <th className="px-4 py-2.5">Xếp vào lớp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((s) => (
                <tr key={s.userId}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{s.displayName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.email}</td>
                  <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{s.phone ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <MoveStudentControl
                      studentId={s.userId}
                      currentClassId={null}
                      classes={classes}
                      label="Chọn lớp"
                      onMoved={() => {
                        setData((prev) => (prev ?? []).filter((x) => x.userId !== s.userId));
                        onAssigned();
                      }}
                    />
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

export default function ClassesPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload, setData } = useAsync(() => api.listClasses(), []);
  const [creating, setCreating] = useState(false);
  const classes = [...(data ?? [])].sort(
    (a, b) => (a.status === b.status ? 0 : a.status === 'ACTIVE' ? -1 : 1) || a.name.localeCompare(b.name, 'vi'),
  );

  return (
    <RequireRole roles={STAFF}>
      <Container>
        <PageHeader
          title="Lớp"
          subtitle={
            isAdmin
              ? 'Tất cả các lớp. Mỗi lớp có một giáo viên phụ trách và một mã để học sinh đăng ký.'
              : 'Các lớp bạn phụ trách. Đưa mã lớp cho học sinh để các em đăng ký.'
          }
          actions={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Tạo lớp
            </Button>
          }
        />

        <Card>
          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={reload} />
            </div>
          ) : classes.length === 0 ? (
            <EmptyState title="Chưa có lớp nào">
              Tạo lớp đầu tiên, rồi đưa mã lớp cho học sinh để các em đăng ký. Đề cũng được giao theo lớp.
              <div className="mt-3">
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  Tạo lớp
                </Button>
              </div>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-slate-50">
                  <div className="min-w-[14rem] flex-1">
                    <Link href={`/classes/${c.id}`} className="text-lg font-semibold text-slate-900 hover:text-ink-700">
                      {c.name}
                    </Link>
                    {c.status === 'ARCHIVED' && (
                      <Badge className="ml-2 bg-amber-100 text-amber-800 ring-1 ring-amber-200">Đã lưu trữ</Badge>
                    )}
                    <div className="flex flex-wrap gap-x-4 text-sm text-slate-500">
                      <span>Giáo viên: {c.teacherName}</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {c.studentCount} học sinh
                      </span>
                      <span>Tạo ngày {formatDate(c.createdAt)}</span>
                    </div>
                  </div>
                  {c.code && <ClassCode code={c.code} />}
                  <Link href={`/classes/${c.id}`} className="text-sm font-medium text-ink-600 hover:underline">
                    Mở lớp
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isAdmin && data && (
          <UnassignedStudents classes={classes.filter((c) => c.status === 'ACTIVE')} onAssigned={reload} />
        )}

        <ClassFormModal
          open={creating}
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            setCreating(false);
            setData((prev) => [...(prev ?? []), c]);
            router.push(`/classes/${c.id}`);
          }}
        />
      </Container>
    </RequireRole>
  );
}
