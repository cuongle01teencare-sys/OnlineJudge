'use client';

import { useRouter } from 'next/navigation';
import { Container } from '@/components/app-shell';
import { RequireRole, STAFF } from '@/components/guards';
import { ProblemSetBuilder } from '@/components/problem-set-builder';
import { useToast } from '@/components/toast';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

export default function NewSetPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <RequireRole roles={STAFF}>
      <Container wide>
        <PageHeader
          back={{ href: '/bank/sets', label: 'Ngân hàng' }}
          title="Tạo đề"
          subtitle="Đề nằm trong ngân hàng của bạn. Khi sẵn sàng, bấm “Giao bài” để giao cho một lớp hoặc công khai."
        />
        <ProblemSetBuilder
          submitLabel="Lưu đề"
          onSubmit={async (body) => {
            const s = await api.createProblemSet(body);
            toast.success('Đã lưu đề');
            router.push(`/bank/sets/${s.id}`);
          }}
        />
      </Container>
    </RequireRole>
  );
}
