'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Container } from '@/components/app-shell';
import { SubmissionsTable } from '@/components/submissions-table';
import { Card, EmptyState, ErrorState, inputClass, LoadingState, PageHeader, Pagination } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/use-async';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

function SubmissionsList() {
  const { isStaff, isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('sessionId') || '';
  const [mine, setMine] = useState(!isStaff || !sessionId);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [sessionId, mine]);
  // Teachers can list everyone's submissions only inside a session they manage.
  useEffect(() => {
    if (isStaff && !isAdmin && !sessionId) setMine(true);
  }, [isStaff, isAdmin, sessionId]);

  const sessions = useAsync(() => api.listSessions(), [], isStaff);
  const managed = useMemo(
    () => (sessions.data ?? []).filter((s) => s.canManage).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions.data],
  );

  const { data, error, loading, reload } = useAsync(
    () =>
      api.listSubmissions({
        sessionId: sessionId || undefined,
        mine: isStaff ? mine : true,
        page,
        pageSize: PAGE_SIZE,
      }),
    [sessionId, mine, page, isStaff],
  );

  const pending = data?.items.some((s) => s.status !== 'DONE');
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(reload, 2000);
    return () => clearTimeout(t);
  }, [pending, data, reload]);

  const setSession = (value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set('sessionId', value);
    else sp.delete('sessionId');
    if (value) setMine(false);
    const qs = sp.toString();
    router.replace(qs ? `/submissions?${qs}` : '/submissions');
  };

  const canSeeAll = isAdmin || !!sessionId;

  return (
    <Container>
      <PageHeader
        title={isStaff ? 'Bài nộp' : 'Bài nộp của tôi'}
        subtitle={isStaff ? 'Chọn một phiên để xem bài nộp của học sinh.' : 'Bấm vào một bài nộp để xem chi tiết.'}
      />

      {isStaff && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
          <select
            className={cn(inputClass, 'w-auto min-w-64')}
            value={sessionId}
            onChange={(e) => setSession(e.target.value)}
            aria-label="Phiên"
          >
            <option value="">{isAdmin ? 'Mọi phiên' : 'Chọn phiên…'}</option>
            {managed.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.className ? ` (lớp ${s.className})` : ' (công khai)'}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-control bg-slate-100 p-1 text-sm">
            <button
              type="button"
              disabled={!canSeeAll}
              onClick={() => setMine(false)}
              className={cn(
                'rounded-[4px] px-3 py-1 disabled:opacity-50',
                !mine ? 'bg-white font-medium ring-1 ring-slate-300' : 'text-slate-600',
              )}
              title={canSeeAll ? undefined : 'Chọn một phiên trước'}
            >
              Mọi người
            </button>
            <button
              type="button"
              onClick={() => setMine(true)}
              className={cn('rounded-[4px] px-3 py-1', mine ? 'bg-white font-medium ring-1 ring-slate-300' : 'text-slate-600')}
            >
              Của tôi
            </button>
          </div>
        </Card>
      )}

      <Card>
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Chưa có bài nộp nào" />
        ) : (
          <>
            <SubmissionsTable items={data.items} showUser={isStaff && !mine} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </Container>
  );
}

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SubmissionsList />
    </Suspense>
  );
}
