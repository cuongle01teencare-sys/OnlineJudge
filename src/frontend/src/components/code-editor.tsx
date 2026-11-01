'use client';

import dynamic from 'next/dynamic';
import { Spinner } from './ui';

const Monaco = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
      <Spinner /> Đang tải trình soạn thảo...
    </div>
  ),
});

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly,
  height = '100%',
}: {
  value: string;
  onChange?: (v: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string | number;
}) {
  return (
    <Monaco
      height={height}
      language={language}
      value={value}
      theme="vs"
      onChange={(v) => onChange?.(v ?? '')}
      loading={
        <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
          <Spinner /> Đang tải trình soạn thảo...
        </div>
      }
      options={{
        readOnly,
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: 'off',
        renderLineHighlight: readOnly ? 'none' : 'line',
        fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
        padding: { top: 8 },
      }}
    />
  );
}
