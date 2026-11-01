import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid-paper flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-hand text-6xl text-mark">404</p>
      <h1 className="text-xl font-semibold">Không có trang này</h1>
      <p className="text-sm text-slate-600">Đường dẫn có thể đã sai hoặc nội dung đã bị xóa.</p>
      <Link href="/" className="font-medium text-ink-600 hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
