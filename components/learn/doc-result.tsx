'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, CheckCircle2, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/Button';
import { TriageList, type TriageListItem } from '@/components/TriageList';
import { useDocStore } from '@/stores/doc-store';
import type { KnownState } from '@/lib/domain';

const CATEGORY_VI: Record<string, string> = {
  academic: 'Học thuật',
  technical: 'Chuyên ngành',
  ielts: 'IELTS',
  phrasal: 'Phrasal verb',
  idiom: 'Thành ngữ',
};

// The result half of the "tải tài liệu -> đào từ vựng -> phân loại 3 mức" flow
// (docs/decision.md ADR-021) — mirrors the shape of Learn's work-mode result
// screen (analyzing/ready/done/error) but reads its own store, since a
// CandidateWord[] triage screen has nothing in common with WorkAnalysis's 4
// insight arrays.
const UNIT_VI: Record<'page' | 'part', string> = { page: 'trang', part: 'đoạn' };

export function DocResult({ onStartOver }: { onStartOver: () => void }) {
  const { status, candidates, unitLabel, totalUnits, truncatedAtUnit, degraded, progress, error, fileName, saveTriage } =
    useDocStore();
  const [saveResult, setSaveResult] = useState<{ added: number; skipped: number } | null>(null);

  async function handleConfirm(choices: Record<string, KnownState>) {
    const result = await saveTriage(choices, Date.now());
    setSaveResult(result);
  }

  if (status === 'analyzing') {
    const unitWord = UNIT_VI[unitLabel];
    return (
      <div className="py-20 text-center space-y-4">
        <Loader2 size={40} className="mx-auto text-green animate-spin" />
        <p className="font-serif-display text-2xl text-ink">Đang tìm từ vựng trong tài liệu...</p>
        <p className="text-sm text-ink-soft">
          {progress
            ? `Đã xong ${progress.completed}/${progress.total} phần (tổng ${totalUnits} ${unitWord}). Có thể mất một phút.`
            : 'Đang chuẩn bị phân tích. Có thể mất một phút.'}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-wrong" />
        <p className="font-serif-display text-2xl text-ink">Không phân tích được tài liệu</p>
        <p className="text-sm text-ink-soft max-w-sm mx-auto">{error ?? 'Đã có lỗi xảy ra.'}</p>
        <Button variant="primary" onClick={onStartOver}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (saveResult) {
    return (
      <div className="py-20 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-green" />
        <p className="font-serif-display text-2xl text-ink">Đã thêm {saveResult.added} từ vào sổ tay</p>
        <p className="text-sm text-ink-soft">
          {saveResult.skipped > 0
            ? `${saveResult.skipped} từ bạn đã biết rõ — không thêm vào sổ tay.`
            : 'Sẵn sàng ôn ngay hôm nay.'}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button variant="quiet" onClick={onStartOver}>
            <RotateCcw size={16} />
            Học tài liệu khác
          </Button>
          <Link href="/vocabulary">
            <Button variant="quiet">Mở sổ tay</Button>
          </Link>
          <Link href="/practice">
            <Button variant="primary">Luyện tập ngay</Button>
          </Link>
        </div>
      </div>
    );
  }

  if ((status === 'ready' || status === 'saving' || status === 'done') && candidates.length > 0) {
    const items: TriageListItem[] = candidates.map((c) => ({
      id: c.word,
      word: c.word,
      vi: `${c.meaningVi}${c.cefr ? ` · ${c.cefr}` : ''}${CATEGORY_VI[c.category] ? ` · ${CATEGORY_VI[c.category]}` : ''}`,
      cefr: c.cefr,
      initialTriage: c.triage ?? undefined,
      note: c.sentenceFromDoc ? `"${c.sentenceFromDoc}" — ${c.sentenceSource === 'document' ? 'từ tài liệu' : 'AI viết'}` : undefined,
    }));

    return (
      <div className="space-y-5 pb-24">
        <div>
          <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block mb-1.5">
            Phân tích bởi Gemini
          </span>
          <h1 className="font-serif-display text-3xl text-ink mb-2">Từ vựng trong {fileName ?? 'tài liệu'}</h1>
          <p className="text-sm text-ink-soft">
            {candidates.length} từ đáng học. Chọn mức độ bạn đã biết cho từng từ trước khi thêm vào sổ tay.
          </p>
          {truncatedAtUnit !== null && (
            <p className="text-xs text-ink-soft flex items-center gap-1.5 mt-2">
              <Info size={14} />
              Tài liệu dài hơn {truncatedAtUnit} {UNIT_VI[unitLabel]} — chỉ phân tích {truncatedAtUnit} {UNIT_VI[unitLabel]}{' '}
              đầu.
            </p>
          )}
          {degraded && (
            <p className="text-xs text-ink-soft flex items-center gap-1.5 mt-2">
              <AlertTriangle size={14} />
              Một số phần tài liệu chưa phân tích được — bạn vẫn có thể học từ những từ đã tìm thấy.
            </p>
          )}
        </div>
        <TriageList items={items} onConfirm={handleConfirm} confirming={status === 'saving'} confirmLabel="Thêm vào sổ tay" />
      </div>
    );
  }

  return null;
}
