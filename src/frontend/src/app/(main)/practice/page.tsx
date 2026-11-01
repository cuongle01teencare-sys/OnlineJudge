'use client';

import { Container } from '@/components/app-shell';
import { SessionList } from '@/components/sessions';
import { Card, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sortSessions } from '@/lib/sessions';
import { useAsync } from '@/lib/use-async';

export default function PracticePage() {
  const { isStaff } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.listSessions({ audience: 'PUBLIC' }), []);
  return (
    <Container>
      <PageHeader
        title="Luyện tập"
        subtitle={
          isStaff
            ? 'Các phiên công khai. Giáo viên có thể vào làm thử như học sinh.'
            : 'Bài công khai cho mọi người. Kết quả được ghi vào học bạ của bạn.'
        }
      />
      <Card>
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : (
          <SessionList
            sessions={sortSessions(data ?? [])}
            emptyTitle="Chưa có phiên công khai nào"
            emptyHint={
              isStaff ? 'Giao một đề hoặc một bài với lựa chọn “Công khai cho mọi người”.' : 'Quay lại sau nhé.'
            }
          />
        )}
      </Card>
    </Container>
  );
}
