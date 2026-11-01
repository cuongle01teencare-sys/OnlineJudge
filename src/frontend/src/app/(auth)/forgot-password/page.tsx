'use client';

import type { VerificationTicketDto } from '@oj/contracts';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, Field, InlineAlert, inputClass } from '@/components/ui';
import { CodeExpiry, OTP_LENGTH, OtpInput, ResendCodeButton, useNow } from '@/components/verification';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const now = useNow();

  const [email, setEmail] = useState('');
  const [ticket, setTicket] = useState<VerificationTicketDto | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setTicket(await api.forgotPassword({ email: email.trim() }));
      setCode('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setError(null);
    if (code.length !== OTP_LENGTH) return setError('Nhập đủ 6 chữ số trong email.');
    if (password.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (password !== confirm) return setError('Hai mật khẩu chưa khớp. Nhập lại mật khẩu ở ô thứ hai.');
    setSubmitting(true);
    try {
      const res = await api.resetPassword({ verificationId: ticket.verificationId, code, newPassword: password });
      signIn(res);
      toast.success('Đã đặt lại mật khẩu');
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (!ticket) {
    return (
      <Card className="p-6">
        <Link href="/login" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-ink-700">
          <ChevronLeft className="h-4 w-4" />
          Đăng nhập
        </Link>
        <h2 className="text-lg font-semibold">Quên mật khẩu</h2>
        <p className="mb-4 text-sm text-slate-500">Nhập email bạn dùng để đăng nhập. Chúng tôi sẽ gửi mã để đặt mật khẩu mới.</p>
        <form onSubmit={sendCode} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && <InlineAlert>{error}</InlineAlert>}
          <Button type="submit" className="w-full" loading={submitting}>
            Gửi mã
          </Button>
        </form>
      </Card>
    );
  }

  const expired = new Date(ticket.expiresAt).getTime() <= now;
  return (
    <Card className="p-6">
      <button
        type="button"
        onClick={() => {
          setTicket(null);
          setError(null);
        }}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-ink-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Đổi email
      </button>
      <h2 className="text-lg font-semibold">Đặt mật khẩu mới</h2>
      <p className="mt-1 text-sm text-slate-600">
        Nếu email có tài khoản, mã đã được gửi tới <b className="text-slate-900">{ticket.email}</b>.
      </p>
      <form onSubmit={reset} className="mt-5 space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Mã xác minh</span>
          <OtpInput value={code} onChange={setCode} autoFocus disabled={submitting} />
        </div>
        <CodeExpiry ticket={ticket} now={now} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu mới">
            <input
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
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
        <Button type="submit" className="w-full" loading={submitting} disabled={expired}>
          Đặt lại mật khẩu
        </Button>
      </form>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>Không thấy email? Xem cả thư mục Spam.</span>
        <ResendCodeButton
          ticket={ticket}
          now={now}
          onResent={(t) => {
            setTicket(t);
            setCode('');
            setError(null);
          }}
        />
      </div>
    </Card>
  );
}
