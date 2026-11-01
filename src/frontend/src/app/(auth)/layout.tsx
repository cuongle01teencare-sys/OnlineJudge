import { Code2 } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-paper flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-ink-600 text-white">
            <Code2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl leading-tight font-bold text-slate-900">Online Judge</h1>
            <p className="text-sm text-slate-600">Chấm bài lập trình cho lớp học</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
