'use client';

import type { IntegrityFlagStatus } from '@oj/contracts';
import { useState } from 'react';
import { Container } from '@/components/app-shell';
import { RequireRole, STAFF } from '@/components/guards';
import { FlagList } from '@/components/integrity';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { cn } from '@/lib/utils';

export default function IntegrityPage() {
  const [status, setStatus] = useState<IntegrityFlagStatus>('OPEN');
  const { data, error, loading, reload } = useAsync(() => api.listIntegrityFlags({ status }), [status]);
  const flags = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <RequireRole roles={STAFF}>
      <Container>
        <PageHeader
          title="Cần xem lại"
          subtitle="Gợi ý tự động từ kiểm tra đạo văn và kiểm tra dùng AI trong các phiên bạn quản lý. Đây không phải kết luận."
        />
        <div className="mb-4 inline-flex rounded-control bg-slate-100 p-1 text-sm">
          {(['OPEN', 'ACKNOWLEDGED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn('rounded-[4px] px-3 py-1', status === s ? 'bg-white font-medium ring-1 ring-slate-300' : 'text-slate-600')}
            >
              {s === 'OPEN' ? 'Mới' : 'Đã xem'}
            </button>
          ))}
        </div>
        <Card>
          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={reload} />
            </div>
          ) : flags.length === 0 ? (
            <EmptyState title={status === 'OPEN' ? 'Không có gợi ý mới' : 'Chưa xem gợi ý nào'}>
              Bật “Kiểm tra đạo văn” hoặc “Kiểm tra dùng AI” trong cài đặt phiên để nhận gợi ý.
            </EmptyState>
          ) : (
            <FlagList flags={flags} showSession />
          )}
        </Card>
      </Container>
    </RequireRole>
  );
}
