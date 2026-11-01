'use client';

import { useParams } from 'next/navigation';
import { Container } from '@/components/app-shell';
import { LeaveClassButton } from '@/components/membership';
import { SessionList } from '@/components/sessions';
import { ClassBoard } from '@/components/threads';
import { Badge, Card, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { sortSessions } from '@/lib/sessions';
import { useAsync } from '@/lib/use-async';

/** One of the student's classes: its sessions and board. Read-only for classes the student left or that were archived. */
export default function MyClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const classes = useAsync(() => api.listClasses(), []);
  const sessions = useAsync(() => api.listSessions({ audience: 'CLASS' }), []);
  const requests = useAsync(() => api.myMembershipRequests(), []);

  if ((classes.loading && !classes.data) || (sessions.loading && !sessions.data)) return <LoadingState />;
  const back = { href: '/my-class', label: 'Lớp của tôi' };
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

  const cls = (classes.data ?? []).find((c) => c.id === classId);
  if (!cls)
    return (
      <Container>
        <PageHeader back={back} title="Không tìm thấy lớp" />
        <ErrorState message="Bạn không ở trong lớp này. Mở Lớp của tôi để xem các lớp của bạn hoặc xin vào lớp bằng mã." />
      </Container>
    );

  const current = cls.isCurrent !== false;
  const archived = cls.status === 'ARCHIVED';
  const list = sortSessions((sessions.data ?? []).filter((s) => s.classId === cls.id));
  const pendingLeave = (requests.data ?? []).find(
    (r) => r.classId === cls.id && r.kind === 'LEAVE' && r.status === 'PENDING',
  );

  return (
    <Container>
      <PageHeader
        back={back}
        title={`Lớp ${cls.name}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Giáo viên {cls.teacherName}</span>
            {archived && <Badge className="bg-amber-100 text-amber-800 ring-1 ring-amber-200">Đã lưu trữ, chỉ xem</Badge>}
            {!current && !archived && <Badge className="bg-slate-100 text-slate-600">Đã rời lớp, chỉ xem</Badge>}
          </span>
        }
        actions={
          current &&
          requests.data && (
            <LeaveClassButton
              cls={cls}
              pending={pendingLeave}
              onSent={() => requests.reload()}
              onCancel={() => requests.reload()}
            />
          )
        }
      />
      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Phiên giáo viên đã giao</h2>
          <p className="text-sm text-slate-500">Phiên đang mở và sắp hết hạn được xếp lên đầu.</p>
        </div>
        <SessionList
          sessions={list}
          emptyTitle={current && !archived ? 'Giáo viên chưa giao bài nào' : 'Lớp này không có phiên nào'}
          emptyHint={current && !archived ? 'Khi giáo viên giao bài, phiên mới sẽ hiện ở đây.' : undefined}
        />
      </Card>
      <ClassBoard classId={cls.id} archived={archived} isManager={false} canPost={current} />
    </Container>
  );
}
