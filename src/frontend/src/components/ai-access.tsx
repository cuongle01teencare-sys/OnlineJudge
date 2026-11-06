'use client';

import { Crown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const AI_VIP_HINT = 'Tính năng AI chỉ dành cho tài khoản giáo viên VIP. Hãy liên hệ quản trị viên để nâng cấp.';

/** Whether the signed-in account may use the AI features (administrators and VIP teachers). */
export function useCanUseAi(): boolean {
  return useAuth().user?.canUseAi ?? false;
}

/** Shown in place of an AI control for regular (non-VIP) teacher accounts. */
export function VipOnly({ label = 'AI', className }: { label?: string; className?: string }) {
  return (
    <span
      title={AI_VIP_HINT}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800 ring-1 ring-amber-200',
        className,
      )}
    >
      <Crown className="h-3 w-3" />
      {label} · chỉ dành cho VIP
    </span>
  );
}
