'use client';

import { CheckCircle2, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { Container } from '@/components/app-shell';
import { RequireRole, STAFF } from '@/components/guards';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { cn, formatDateTime, formatPoints } from '@/lib/utils';

export default function SessionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const session = useAsync(() => api.getSession(id), [id]);
  const { data, error, loading, reload } = useAsync(() => api.getSessionResults(id), [id]);

  const rows = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName, 'vi')),
    [data],
  );
  const maxTotal = data?.problems.reduce((s, p) => s + p.points, 0) ?? 0;
  const completed = rows.filter((r) => r.completed).length;

  const exportCsv = () => {
    if (!data) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = [
      'STT',
      'Học sinh',
      ...data.problems.map((p, i) => `Bài ${i + 1} (${p.code})`),
      'Tổng',
      'Số bài đã giải',
      'Hoàn thành',
      'Nộp lần cuối',
    ];
    const lines = rows.map((r, i) => [
      i + 1,
      r.displayName,
      ...data.problems.map((p) => formatPoints(r.scores[p.key] ?? 0)),
      formatPoints(r.total),
      r.solvedCount,
      r.completed ? 'Có' : 'Chưa',
      r.lastSubmissionAt ? formatDateTime(r.lastSubmissionAt) : '',
    ]);
    const csv = '﻿' + [header, ...lines].map((l) => l.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ket-qua-${session.data?.title ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRole roles={STAFF}>
      <Container wide>
        <PageHeader
          back={{ href: `/sessions/${id}`, label: 'Về phiên' }}
          title={`Kết quả: ${session.data?.title ?? ''}`}
          subtitle={
            data && (
              <span className="flex flex-wrap gap-x-4">
                <span>{session.data?.audience === 'PUBLIC' ? 'Công khai' : `Lớp ${session.data?.className ?? ''}`}</span>
                <span>
                  {completed}/{rows.length} người hoàn thành
                </span>
                <span>Điểm mỗi bài là điểm cao nhất; chưa nộp tính 0.</span>
              </span>
            )
          }
          actions={
            data &&
            rows.length > 0 && (
              <Button variant="secondary" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Tải bảng điểm (CSV)
              </Button>
            )
          }
        />
        <Card>
          {loading && !data ? (
            <LoadingState />
          ) : error || !data ? (
            <div className="p-4">
              <ErrorState message={error ?? 'Không tải được kết quả'} onRetry={reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Chưa có ai trong bảng điểm">Kết quả hiện ở đây khi học sinh bắt đầu nộp bài.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-rule bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-4 py-2.5">Học sinh</th>
                    <th className="px-3 py-2.5 text-center">Đã giải</th>
                    {data.problems.map((p, i) => (
                      <th key={p.key} className="px-3 py-2.5 text-right" title={p.title}>
                        Bài {i + 1}
                        <div className="font-normal text-slate-400">{p.points} điểm</div>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right">
                      Tổng
                      <div className="font-normal text-slate-400">{maxTotal} điểm</div>
                    </th>
                    <th className="hidden px-4 py-2.5 lg:table-cell">Nộp lần cuối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.userId} className="hover:bg-slate-50">
                      <td className="sticky left-0 bg-white px-4 py-2 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {r.displayName}
                          {r.completed && (
                            <CheckCircle2 className="h-4 w-4 text-chalk-600" aria-label="Hoàn thành" />
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {r.solvedCount}/{data.problems.length}
                      </td>
                      {data.problems.map((p) => {
                        const v = r.scores[p.key] ?? 0;
                        return (
                          <td
                            key={p.key}
                            className={cn(
                              'px-3 py-2 text-right tabular-nums',
                              v >= p.points ? 'font-semibold text-chalk-700' : v > 0 ? 'text-slate-800' : 'text-slate-300',
                            )}
                          >
                            {formatPoints(v)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right font-bold tabular-nums">{formatPoints(r.total)}</td>
                      <td className="hidden px-4 py-2 text-slate-500 lg:table-cell">
                        {r.lastSubmissionAt ? (
                          <Link href={`/submissions?sessionId=${id}`} className="hover:text-ink-700">
                            {formatDateTime(r.lastSubmissionAt)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Container>
    </RequireRole>
  );
}
