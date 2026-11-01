'use client';

import { LanguageLabels } from '@oj/contracts';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Container } from '@/components/app-shell';
import { CodeBlock } from '@/components/code-block';
import { RequireRole, STAFF } from '@/components/guards';
import { FlagKindBadge, FlagLevel, FlagStatus } from '@/components/integrity';
import { useToast } from '@/components/toast';
import { Button, Card, ErrorState, InlineAlert, LoadingState, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { sessionHref } from '@/lib/sessions';
import { useAsync } from '@/lib/use-async';
import { formatDateTime } from '@/lib/utils';

export default function IntegrityFlagPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: f, error, loading, reload, setData } = useAsync(() => api.getIntegrityFlag(id), [id]);
  const [busy, setBusy] = useState(false);

  const ack = async () => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await api.acknowledgeIntegrityFlag(f.id);
      setData({ ...f, ...r });
      toast.success('Đã đánh dấu đã xem');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequireRole roles={STAFF}>
      <Container wide>
        {loading && !f ? (
          <LoadingState />
        ) : error || !f ? (
          <ErrorState message={error ?? 'Không tìm thấy gợi ý'} onRetry={reload} />
        ) : (
          <>
            <PageHeader
              back={{ href: '/integrity', label: 'Cần xem lại' }}
              title="Gợi ý cần xem lại — không phải kết luận"
              subtitle={
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <FlagKindBadge kind={f.kind} />
                  <FlagLevel flag={f} />
                  <FlagStatus flag={f} />
                  <Link href={sessionHref(f.sessionId)} className="hover:text-ink-700">
                    Phiên {f.sessionTitle}
                  </Link>
                  <span>{f.problemTitle}</span>
                  <span>{formatDateTime(f.createdAt)}</span>
                </span>
              }
              actions={
                f.status === 'OPEN' ? (
                  <Button onClick={ack} loading={busy}>
                    <Check className="h-4 w-4" />
                    Đánh dấu đã xem
                  </Button>
                ) : (
                  <span className="text-sm text-slate-500">
                    Đã xem{f.acknowledgedByName ? ` bởi ${f.acknowledgedByName}` : ''}
                    {f.acknowledgedAt ? ` lúc ${formatDateTime(f.acknowledgedAt)}` : ''}
                  </span>
                )
              }
            />
            <div className="mb-5">
              <InlineAlert kind="info">
                {f.summary} Hãy đọc code và trao đổi với học sinh trước khi kết luận. Học sinh không thấy gợi ý này và điểm
                không bị thay đổi.
              </InlineAlert>
            </div>

            {f.kind === 'PLAGIARISM' ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
                    <h2 className="font-semibold">{f.userDisplayName}</h2>
                    <span className="text-xs text-slate-500">
                      {LanguageLabels[f.language]}{' '}
                      <Link href={`/submissions/${f.submissionId}`} className="text-ink-600 hover:underline">
                        Mở bài nộp
                      </Link>
                    </span>
                  </div>
                  <div className="p-3">
                    <CodeBlock code={f.code} language={f.language} maxHeight="70vh" />
                  </div>
                </Card>
                <Card className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
                    <h2 className="font-semibold">{f.matchedUserDisplayName ?? 'Bài nộp tương tự'}</h2>
                    <span className="text-xs text-slate-500">
                      Giống {Math.round(f.score * 100)}%
                      {f.matchedSubmissionId && (
                        <>
                          {' '}
                          <Link href={`/submissions/${f.matchedSubmissionId}`} className="text-ink-600 hover:underline">
                            Mở bài nộp
                          </Link>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="p-3">
                    {f.matchedCode ? (
                      <CodeBlock code={f.matchedCode} language={f.matchedLanguage} maxHeight="70vh" />
                    ) : (
                      <p className="p-3 text-sm text-slate-500">Không còn code của bài nộp này.</p>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
                <Card className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
                    <h2 className="font-semibold">{f.userDisplayName}</h2>
                    <span className="text-xs text-slate-500">
                      {LanguageLabels[f.language]}{' '}
                      <Link href={`/submissions/${f.submissionId}`} className="text-ink-600 hover:underline">
                        Mở bài nộp
                      </Link>
                    </span>
                  </div>
                  <div className="p-3">
                    <CodeBlock code={f.code} language={f.language} maxHeight="75vh" highlights={f.segments} />
                  </div>
                </Card>
                <Card className="self-start p-5">
                  <h2 className="font-semibold">Lý do</h2>
                  {f.reasons.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {f.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Không có lý do cụ thể.</p>
                  )}
                  {f.segments.length > 0 && (
                    <>
                      <h3 className="mt-4 text-sm font-semibold">Đoạn code đáng xem (tô vàng)</h3>
                      <ul className="mt-1 space-y-1 text-sm text-slate-700">
                        {f.segments.map((s, i) => (
                          <li key={i}>
                            <span className="tabular-nums">
                              Dòng {s.startLine}
                              {s.endLine !== s.startLine ? `–${s.endLine}` : ''}
                            </span>
                            : {s.reason}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </Container>
    </RequireRole>
  );
}
