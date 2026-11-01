'use client';

import { MailWarning } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, Field, InlineAlert, inputClass, LoadingState } from '@/components/ui';
import { OTP_LENGTH, OtpInput } from '@/components/verification';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/use-async';
import { formatDateTime } from '@/lib/utils';

function InvalidInvite({ message }: { message: string }) {
  return (
    <Card className="p-6">
      <MailWarning className="mb-3 h-7 w-7 text-mark-600" aria-hidden="true" />
      <h2 className="text-lg font-semibold">Không mở được lời mời</h2>
      <p className="mt-1 text-sm text-mark-700">{message}</p>
      <p className="mt-3 text-sm text-slate-600">
        {/gửi lại/i.test(message) ? 'Sau khi nhận email mới, mở' : 'Hãy nhờ quản trị viên gửi lại lời mời, rồi mở'} đường
        link trong email mới nhất.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/login" className="font-medium text-ink-600 hover:underline">
          Về trang đăng nhập
        </Link>
      </p>
    </Card>
  );
}

function AcceptInvite() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const { signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const invite = useAsync(() => api.getInvitation(id), [id], !!id);
  const [code, setCode] = useState(() => (params.get('code') ?? '').replace(/\D/g, '').slice(0, OTP_LENGTH));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!id) return <InvalidInvite message="Đường link thiếu mã lời mời." />;
  if (invite.loading) return <LoadingState label="Đang mở lời mời..." />;
  if (invite.error || !invite.data) return <InvalidInvite message={invite.error ?? 'Lời mời không hợp lệ.'} />;
  const inv = invite.data;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== OTP_LENGTH) return setError('Nhập đủ 6 chữ số của mã mời trong email.');
    if (password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    if (password !== confirm) return setError('Hai mật khẩu chưa khớp. Nhập lại mật khẩu ở ô thứ hai.');
    setSubmitting(true);
    try {
      const res = await api.acceptInvitation({ invitationId: id, code, password });
      signIn(res);
      toast.success('Đã kích hoạt tài khoản giáo viên');
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Kích hoạt tài khoản giáo viên</h2>
      <p className="mt-1 text-sm text-slate-600">Đặt mật khẩu để bắt đầu dùng hệ thống.</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-control border border-rule bg-slate-50 px-4 py-3 text-sm">
        <dt className="text-slate-500">Họ tên</dt>
        <dd className="font-medium text-slate-900">{inv.displayName}</dd>
        <dt className="text-slate-500">Email</dt>
        <dd className="font-medium break-all text-slate-900">{inv.email}</dd>
        <dt className="text-slate-500">Hết hạn</dt>
        <dd className="text-slate-700">{formatDateTime(inv.expiresAt)}</dd>
      </dl>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Mã mời</span>
          <OtpInput value={code} onChange={setCode} disabled={submitting} />
          <span className="mt-1 block text-xs text-slate-500">Đã điền sẵn từ đường link. Nếu chỉ có mã, nhập 6 chữ số trong email.</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu">
            <input
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Nhập lại mật khẩu">
            <input
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <Button type="submit" className="w-full" loading={submitting}>
          Kích hoạt tài khoản
        </Button>
      </form>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AcceptInvite />
    </Suspense>
  );
}
