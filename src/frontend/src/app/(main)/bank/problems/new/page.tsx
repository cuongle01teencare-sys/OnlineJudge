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
          subtitle="Bài mới nằm trong ngân hàng của bạn ở chế độ riêng tư. Sau khi lưu, thêm test và lời giải."
        />
        <ProblemForm
          initial={emptyProblem}
          submitLabel="Tạo bài & tiếp tục thêm test"
          onSubmit={async (v) => {
            const p = await api.createProblem(v);
            toast.success(`Đã tạo bài ${p.code}`);
            router.push(`/bank/problems/${p.id}?tab=tests`);
          }}
        />
      </Container>
    </RequireRole>
  );
}
