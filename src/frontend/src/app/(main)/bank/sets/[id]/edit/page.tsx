'use client';

import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/app-shell';
import { RequireRole, STAFF } from '@/components/guards';
import { ProblemSetBuilder } from '@/components/problem-set-builder';
import { useToast } from '@/components/toast';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';

export default function EditSetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.getProblemSet(id), [id]);

  return (
    <RequireRole roles={STAFF}>
      <Container wide>
        <PageHeader
          back={{ href: `/bank/sets/${id}`, label: 'Về trang đề' }}
          title="Sửa đề"
          subtitle="Sửa đề không làm thay đổi các phiên đã giao."
        />
        {loading && !data ? (
          <LoadingState />
        ) : error || !data ? (
          <ErrorState message={error ?? 'Không tìm thấy đề'} onRetry={reload} />
        ) : !data.canEdit ? (
          <ErrorState message="Đề này không thuộc ngân hàng của bạn. Lưu về ngân hàng của bạn rồi sửa bản sao." />
        ) : (
          <ProblemSetBuilder
            key={data.id}
            initial={data}
            submitLabel="Lưu đề"
            onSubmit={async (body) => {
              await api.updateProblemSet(id, body);
              toast.success('Đã lưu đề');
              router.push(`/bank/sets/${id}`);
            }}
          />
        )}
      </Container>
    </RequireRole>
  );
}
