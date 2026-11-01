'use client';

import { useRouter } from 'next/navigation';
import { emptyProblem, ProblemForm } from '@/components/admin/problem-form';
import { Container } from '@/components/app-shell';
import { RequireRole, STAFF } from '@/components/guards';
import { useToast } from '@/components/toast';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

export default function NewProblemPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <RequireRole roles={STAFF}>
      <Container>
        <PageHeader
          back={{ href: '/bank', label: 'Ngân hàng' }}
          title="Tạo bài"
          subtitle="Soạn đề và bộ test (tự nhập hoặc nhờ AI gợi ý), đánh dấu test nào là ví dụ. Bài mới nằm trong ngân hàng của bạn ở chế độ riêng tư."
        />
        <ProblemForm
          initial={emptyProblem}
          submitLabel="Tạo bài"
          withTests
          onSubmit={async (v, testCases) => {
            const p = await api.createProblem({ ...v, testCases });
            toast.success(`Đã tạo bài ${p.code} với ${p.testCases.length} test`);
            router.push(`/bank/problems/${p.id}`);
          }}
        />
      </Container>
    </RequireRole>
  );
}
