'use client';

import type { ClassroomDto, SessionDto } from '@oj/contracts';
import { Container } from '@/components/app-shell';
import { SessionList } from '@/components/sessions';
import { ClassBoard } from '@/components/threads';
import { Badge, Card, ErrorState, InlineAlert, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { sortSessions } from '@/lib/sessions';
import { useAsync } from '@/lib/use-async';

function ClassBlock({ cls, sessions, current }: { cls: ClassroomDto; sessions: SessionDto[]; current: boolean }) {
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3">
        <h2 className="text-lg font-semibold">Lớp {cls.name}</h2>
        <span className="text-sm text-slate-500">Giáo viên {cls.teacherName}</span>
        {cls.status === 'ARCHIVED' && (
          <Badge className="bg-amber-100 text-amber-800 ring-1 ring-amber-200">Đã lưu trữ, chỉ xem</Badge>
        )}
        {!current && cls.status === 'ACTIVE' && <Badge className="bg-slate-100 text-slate-600">Lớp cũ, chỉ xem</Badge>}
      </div>
      <SessionList
        sessions={sortSessions(sessions)}
        emptyTitle={current ? 'Giáo viên chưa giao bài nào' : 'Lớp này không có phiên nào'}
        emptyHint={current ? 'Khi giáo viên giao bài, phiên mới sẽ hiện ở đây.' : undefined}
      />
    </Card>
  );
}

export default function MyClassPage() {
  const classes = useAsync(() => api.listClasses(), []);
  const sessions = useAsync(() => api.listSessions({ audience: 'CLASS' }), []);

  if ((classes.loading && !classes.data) || (sessions.loading && !sessions.data)) return <LoadingState />;
  if (classes.error || sessions.error)
    return (
      <Container>
        <ErrorState
          message={classes.error ?? sessions.error ?? ''}
          onRetry={() => {
            classes.reload();
            sessions.reload();
          }}
        />
      </Container>
    );

  const list = classes.data ?? [];
  const current =
    list.find((c) => c.isCurrent !== false && c.status === 'ACTIVE') ?? list.find((c) => c.isCurrent !== false);
  const former = list.filter((c) => c !== current);
  const byClass = (id: string) => (sessions.data ?? []).filter((s) => s.classId === id);

  return (
    <Container>
      <PageHeader title="Lớp của tôi" subtitle="Các phiên giáo viên đã giao. Phiên đang mở và sắp hết hạn được xếp lên đầu." />
      {current ? (
        <>
          <ClassBlock cls={current} sessions={byClass(current.id)} current />
          <ClassBoard classId={current.id} archived={current.status === 'ARCHIVED'} isManager={false} />
        </>
      ) : (
        <div className="mb-6">
          <InlineAlert kind="warning">
            {former.some((c) => c.status === 'ARCHIVED')
              ? 'Lớp của bạn đã kết thúc và được lưu trữ: bạn vẫn xem lại được bài cũ và bảng tin bên dưới. Khi giáo viên xếp bạn vào lớp mới, bài mới sẽ hiện ở đây.'
              : 'Bạn chưa thuộc lớp nào. Hãy báo giáo viên để được xếp vào lớp; trong lúc chờ, vào Luyện tập để làm bài công khai.'}
          </InlineAlert>
        </div>
      )}
      {former.length > 0 && (
        <>
          <h2 className="mb-3 text-base font-semibold text-slate-700">Lớp cũ</h2>
          {former.map((c) => (
            <div key={c.id}>
              <ClassBlock cls={c} sessions={byClass(c.id)} current={false} />
              <ClassBoard classId={c.id} archived={c.status === 'ARCHIVED'} isManager={false} canPost={false} />
            </div>
          ))}
        </>
      )}
    </Container>
  );
}
