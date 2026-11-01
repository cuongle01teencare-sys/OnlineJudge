'use client';

import type { Role } from '@oj/contracts';
import { ShieldAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { LinkButton, LoadingState } from './ui';

/** Redirects to /login when not authenticated. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) return <LoadingState label="Đang kiểm tra đăng nhập..." />;
  return <>{children}</>;
}

/** Shows a "no permission" message if the user's role is not allowed. Must be inside RequireAuth. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold">Bạn không có quyền truy cập trang này</h1>
        <LinkButton href="/" variant="secondary">
          Về trang chủ
        </LinkButton>
      </div>
    );
  }
  return <>{children}</>;
}

export const STAFF: Role[] = ['ADMIN', 'TEACHER'];
export const ADMIN_ONLY: Role[] = ['ADMIN'];
