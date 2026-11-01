'use client';

import type { VerificationTicketDto } from '@oj/contracts';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field, InlineAlert, inputClass } from '@/components/ui';
import { CodeExpiry, OTP_LENGTH, OtpInput, ResendCodeButton, useNow } from '@/components/verification';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const now = useNow();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [classCode, setClassCode] = useState('');
  const [ticket, setTicket] = useState<VerificationTicketDto | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const phoneClean = phone.trim();
    if (password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    if (password !== confirm) return setError('Hai mật khẩu chưa khớp. Nhập lại mật khẩu ở ô thứ hai.');
    setSubmitting(true);
    try {
      const t = await api.register({
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phoneClean || null,
        password,
        classCode: classCode.trim(),
      });
      setTicket(t);
      setCode('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async (value = code) => {
    if (!ticket) return;
    setError(null);
    if (value.length !== OTP_LENGTH) return setError('Nhập đủ 6 chữ số trong email.');
    setSubmitting(true);
    try {
      const res = await api.verifyRegistration({ verificationId: ticket.verificationId, code: value });
      signIn(res);
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (ticket) {
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
        <h2 className="text-lg font-semibold">Nhập mã xác minh</h2>
        <p className="mt-1 text-sm text-slate-600">
          Đã gửi mã tới <b className="text-slate-900">{ticket.email}</b>. Mở email và nhập 6 chữ số.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <OtpInput value={code} onChange={setCode} onComplete={verify} autoFocus disabled={submitting} invalid={!!error} />
          <CodeExpiry ticket={ticket} now={now} />
          {error && <InlineAlert>{error}</InlineAlert>}
          <Button type="submit" className="w-full" loading={submitting} disabled={expired || code.length !== OTP_LENGTH}>
            Xác minh và tạo tài khoản
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

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Tạo tài khoản học sinh</h2>
      <p className="mb-4 text-sm text-slate-500">Tài khoản giáo viên được tạo qua lời mời của quản trị viên.</p>
      <form onSubmit={sendCode} className="space-y-4">
        <Field label="Họ và tên">
          <input
            required
            autoComplete="name"
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </Field>
        <Field label="Email" hint="Mã xác minh sẽ được gửi tới email này.">
          <input
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Số điện thoại (không bắt buộc)" hint="Chỉ để giáo viên liên hệ khi cần.">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912345678"
          />
        </Field>
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
        <Field label="Mã lớp" hint="Mã lớp do giáo viên cung cấp, ví dụ 22DTHC5.">
          <input
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass} font-mono tracking-widest uppercase`}
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
          />
        </Field>
        {error && <InlineAlert>{error}</InlineAlert>}
        <Button type="submit" className="w-full" loading={submitting}>
          Gửi mã xác minh
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-medium text-ink-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </Card>
  );
}
