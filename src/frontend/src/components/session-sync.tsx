'use client';

import type { SessionDto, SessionSyncPreviewDto } from '@oj/contracts';
import { ArrowDownUp, GitCompare, Minus, PenLine, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from './toast';
import { Button, ErrorState, InlineAlert, LoadingState, Modal } from './ui';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        {icon}
        {title}
      </h3>
      <ul className="space-y-0.5 pl-6 text-sm text-slate-700">{children}</ul>
    </div>
  );
}

function Changes({ p }: { p: SessionSyncPreviewDto }) {
  const affected = p.removed.reduce((n, r) => n + r.studentsWithSubmissions, 0);
  return (
    <div className="space-y-4">
      {p.added.length > 0 && (
        <Section icon={<Plus className="h-4 w-4 text-chalk-700" />} title={`Thêm ${p.added.length} bài`}>
          {p.added.map((a) => (
            <li key={a.code}>
              {a.code} · {a.title} <span className="text-slate-500">({a.points} điểm)</span>
            </li>
          ))}
        </Section>
      )}
      {p.removed.length > 0 && (
        <Section icon={<Minus className="h-4 w-4 text-mark-600" />} title={`Bỏ ${p.removed.length} bài khỏi phiên`}>
          {p.removed.map((r) => (
            <li key={r.key}>
              Bài {r.key}. {r.title}
              {r.studentsWithSubmissions > 0 && (
                <span className="text-mark-700"> — {r.studentsWithSubmissions} học sinh đã nộp</span>
              )}
            </li>
          ))}
        </Section>
      )}
      {p.pointsChanged.length > 0 && (
        <Section icon={<PenLine className="h-4 w-4 text-ink-600" />} title="Đổi điểm">
          {p.pointsChanged.map((c) => (
            <li key={c.key}>
              Bài {c.key}. {c.title}: {c.from} → {c.to} điểm
            </li>
          ))}
        </Section>
      )}
      {p.contentChanged.length > 0 && (
        <Section icon={<GitCompare className="h-4 w-4 text-ink-600" />} title="Cập nhật nội dung (đề, giới hạn hoặc test) và chấm lại">
          {p.contentChanged.map((c) => (
            <li key={c.key}>
              Bài {c.key}. {c.title}
            </li>
          ))}
        </Section>
      )}
      {p.reordered && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <ArrowDownUp className="h-4 w-4 text-ink-600" />
          Sắp xếp lại thứ tự bài theo đề gốc
          <span className="font-normal text-slate-500">(mỗi bài giữ nguyên chữ cái A, B, C…)</span>
        </p>
      )}
      {affected > 0 && (
        <InlineAlert kind="warning">
          Bài nộp của các bài bị bỏ vẫn còn trong lịch sử của học sinh nhưng không còn được tính điểm trong phiên và học bạ.
        </InlineAlert>
      )}
    </div>
  );
}

/** "Đồng bộ với đề gốc": preview what changed in the source set since it was given, then apply and rejudge. */
export function SessionSyncButton({ session, onSession }: { session: SessionDto; onSession: (s: SessionDto) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SessionSyncPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview(await api.previewSessionSync(session.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const show = () => {
    setOpen(true);
    setPreview(null);
    void load();
  };

  const apply = async () => {
    setApplying(true);
    try {
      const { session: updated, changes } = await api.syncSession(session.id);
      onSession(updated);
      let queued = 0;
      for (const c of changes.contentChanged) queued += (await api.rejudgeSession(session.id, { problemKey: c.key })).queued;
      toast.success(queued ? `Đã đồng bộ với đề gốc và đưa ${queued} bài nộp vào hàng chờ chấm lại` : 'Đã đồng bộ với đề gốc');
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={show}>
        <GitCompare className="h-4 w-4" />
        Đồng bộ với đề gốc
      </Button>
      <Modal
        open={open}
        onClose={() => !applying && setOpen(false)}
        title={preview ? `Đồng bộ với đề “${preview.setTitle}”` : 'Đồng bộ với đề gốc'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={applying}>
              {preview && !preview.hasChanges ? 'Đóng' : 'Hủy'}
            </Button>
            {preview?.hasChanges && (
              <Button onClick={apply} loading={applying}>
                Đồng bộ
              </Button>
            )}
          </>
        }
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : preview && !preview.hasChanges ? (
          <p className="text-sm text-slate-600">Phiên đã giống đề gốc trong ngân hàng, không có gì để đồng bộ.</p>
        ) : preview ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Đề gốc đã thay đổi kể từ khi giao. Đồng bộ sẽ làm phiên giống đề hiện tại trong ngân hàng:
            </p>
            <Changes p={preview} />
            {session.state === 'OPEN' && (
              <InlineAlert kind="info">Phiên đang mở: học sinh đang làm bài sẽ thấy thay đổi ngay sau khi đồng bộ.</InlineAlert>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
