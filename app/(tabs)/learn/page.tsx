'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWordsList } from '@/hooks/use-words';
import { useProfile } from '@/hooks/use-profile';
import { useImportsList } from '@/hooks/use-imports';
import { useWorkStore } from '@/stores/work-store';
import { Button } from '@/components/Button';
import {
  FileText, Loader2, AlertTriangle, CheckCircle2, Upload, RotateCcw, Sparkles, ChevronDown,
} from 'lucide-react';

const INPUT_TYPE_VI: Record<string, string> = {
  work_email: 'Email công việc',
  email: 'Email công việc',
  report: 'Báo cáo',
  meeting_note: 'Ghi chú họp',
  chat: 'Tin nhắn công việc',
  document: 'Tài liệu',
  other: 'Văn bản',
};

// The signature feature (docs/decision.md ADR-014, strategy doc §7): paste a real
// piece of workplace English -> Gemini returns vocabulary, professional phrases,
// grammar insights and professional rewrites in one pass -> user selects what to
// save -> saved items enter the notebook already scheduled for practice (SRS).
// State lives in stores/work-store.ts; this page is presentational only
// (docs/architecture.md §1 — no component here calls Dexie or /api/ai/* directly).
export default function LearnPage() {
  const words = useWordsList();
  const { settings } = useProfile();
  const pastImports = useImportsList(10).filter((imp) => imp.kind === 'work');
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { status, analysis, error, analyze, toggleInsight, toggleRewrite, saveSelected, open, reset } =
    useWorkStore();

  const [text, setText] = useState('');
  const [pastedFileName, setPastedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{ count: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('mode') === 'file') fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== 'string' || content.trim().length === 0) {
        setFileError('Không đọc được nội dung văn bản từ tệp này. Thử dán trực tiếp đoạn văn bên dưới.');
        return;
      }
      setText(content);
      setPastedFileName(file.name);
    };
    reader.onerror = () => setFileError('Không đọc được tệp. Tệp có thể bị hỏng — thử tệp khác hoặc dán văn bản.');
    reader.readAsText(file);
  }

  async function runAnalyze() {
    const trimmed = text.trim();
    if (!trimmed) return;
    await analyze({
      text: trimmed.slice(0, 10_000),
      fileName: pastedFileName ?? 'Đoạn văn đã dán',
      sourceType: 'other',
      level: settings.level,
      contextTopic: settings.contextTopic,
      excludeWords: words.map((w) => w.word),
    });
  }

  async function confirmSave() {
    if (submitting) return;
    setSubmitting(true);
    const result = await saveSelected(Date.now());
    setSaveResult({ count: result.count });
    setSubmitting(false);
  }

  function startOver() {
    reset();
    setText('');
    setPastedFileName(null);
    setFileError(null);
    setSaveResult(null);
  }

  const selectedCount =
    (analysis?.insights.filter((i) => i.saved).length ?? 0) + (analysis?.rewrites.filter((r) => r.saved).length ?? 0);

  return (
    <div className="pb-nav max-w-2xl mx-auto">
      {status === 'idle' && (
        <div className="space-y-5">
          <div>
            <h1 className="font-serif-display text-3xl text-ink mb-1">Học từ công việc thật</h1>
            <p className="text-sm text-ink-soft">
              Dán một email, báo cáo, ghi chú họp hay tài liệu tiếng Anh bạn đang dùng ở công ty. AI sẽ tìm từ
              vựng, cụm từ chuyên nghiệp, lỗi ngữ pháp và cách viết chuyên nghiệp hơn trong đó.
            </p>
          </div>

          <div className="border-2 border-dashed border-rule rounded-card p-5 text-center hover:border-green transition-all">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              onChange={handleFile}
              className="hidden"
              id="doc-file-input"
            />
            <label htmlFor="doc-file-input" className="cursor-pointer block">
              <Upload size={28} className="mx-auto text-green mb-2" />
              <span className="text-sm font-medium text-ink block mb-1">Bấm để tải tệp văn bản (.txt, .md)</span>
              <span className="text-xs text-ink-soft">Hoặc dán trực tiếp đoạn văn bên dưới</span>
            </label>
          </div>

          {fileError && (
            <p className="text-xs text-wrong flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {fileError}
            </p>
          )}

          {pastedFileName && (
            <p className="text-xs text-ink-soft flex items-center gap-1.5">
              <FileText size={14} />
              Đã nạp: {pastedFileName}
            </p>
          )}

          <textarea
            lang="en"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dán đoạn văn tiếng Anh vào đây..."
            rows={10}
            maxLength={10_000}
            className="w-full p-3.5 rounded-card bg-surface border border-rule text-sm text-ink focus:outline-none focus:border-green resize-none"
          />
          <p className="text-xs text-ink-soft text-right">{text.length}/10000</p>

          <Button variant="primary" onClick={runAnalyze} disabled={!text.trim()} className="w-full">
            Phân tích với Gemini
          </Button>

          {pastImports.length > 0 && (
            <div className="pt-4 border-t border-rule">
              <span className="text-xs font-mono-utility text-ink-soft uppercase tracking-wider block mb-2">
                Đã phân tích trước đó
              </span>
              <div className="space-y-1.5">
                {pastImports.map((imp) => (
                  <button
                    key={imp.id}
                    type="button"
                    onClick={() => open(imp.id)}
                    className="w-full text-left p-3 rounded-xl bg-surface border border-rule hover:border-green transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sm text-ink truncate">{imp.fileName}</span>
                    <span className="text-[11px] font-mono-utility text-ink-soft shrink-0 ml-2">
                      {imp.status === 'ready' && 'Xem kết quả'}
                      {imp.status === 'done' && `Đã thêm ${imp.addedCount} mục`}
                      {imp.status === 'failed' && 'Lỗi'}
                      {imp.status === 'analyzing' && 'Đang phân tích...'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'analyzing' && (
        <div className="py-20 text-center space-y-4">
          <Loader2 size={40} className="mx-auto text-green animate-spin" />
          <p className="font-serif-display text-2xl text-ink">Đang đọc tài liệu của bạn...</p>
          <p className="text-sm text-ink-soft">
            Gemini đang tìm từ vựng, cụm từ và lỗi ngữ pháp đáng học. Có thể mất đến một phút.
          </p>
        </div>
      )}

      {(status === 'ready' || status === 'saving') && analysis && !saveResult && (
        <div className="space-y-6 pb-24">
          <div>
            <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block mb-1.5">
              Phân tích bởi Gemini
            </span>
            <h1 className="font-serif-display text-3xl text-ink mb-2">
              {analysis.summary.headlineVi || 'Kết quả phân tích'}
            </h1>
            <p className="text-sm text-ink-soft">
              {INPUT_TYPE_VI[analysis.summary.inputTypeVi] ?? analysis.summary.inputTypeVi}
              {' · '}
              {[
                analysis.summary.wordCount > 0 && `${analysis.summary.wordCount} từ vựng`,
                analysis.summary.phraseCount > 0 && `${analysis.summary.phraseCount} cụm từ`,
                analysis.summary.grammarCount > 0 && `${analysis.summary.grammarCount} điểm ngữ pháp`,
                analysis.summary.rewriteCount > 0 && `${analysis.summary.rewriteCount} cách viết hay hơn`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          {analysis.rewrites.map((rewrite) => (
            <RewriteCard key={rewrite.id} rewrite={rewrite} onToggleSave={() => toggleRewrite(rewrite.id)} />
          ))}

          <InsightSection
            title="Từ vựng"
            kind="vocab"
            items={analysis.insights.filter((i) => i.kind === 'vocab')}
            onToggle={toggleInsight}
          />
          <InsightSection
            title="Cụm từ chuyên nghiệp"
            kind="phrase"
            items={analysis.insights.filter((i) => i.kind === 'phrase')}
            onToggle={toggleInsight}
          />
          <InsightSection
            title="Điểm ngữ pháp"
            kind="grammar"
            items={analysis.insights.filter((i) => i.kind === 'grammar')}
            onToggle={toggleInsight}
          />

          {analysis.insights.length === 0 && analysis.rewrites.length === 0 && (
            <p className="text-sm text-ink-soft text-center py-8">
              Văn bản của bạn không có cơ hội học tập rõ ràng nào — thử một đoạn dài hơn hoặc mang tính công việc
              hơn.
            </p>
          )}

          <div className="fixed inset-x-0 above-nav z-30 bg-surface border-t border-rule p-4">
            <div className="max-w-2xl mx-auto">
              <Button
                variant="primary"
                onClick={confirmSave}
                disabled={submitting || selectedCount === 0}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang thêm...
                  </>
                ) : (
                  `Thêm ${selectedCount} mục vào sổ tay`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {saveResult && (
        <div className="py-20 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-green" />
          <p className="font-serif-display text-2xl text-ink">Đã thêm {saveResult.count} mục vào sổ tay</p>
          <p className="text-sm text-ink-soft">
            AI đã chuẩn bị sẵn ví dụ và lựa chọn luyện tập cho từng mục — sẵn sàng ôn ngay hôm nay.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button variant="quiet" onClick={startOver}>
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
      )}

      {status === 'error' && (
        <div className="py-20 text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-wrong" />
          <p className="font-serif-display text-2xl text-ink">Không phân tích được tài liệu</p>
          <p className="text-sm text-ink-soft max-w-sm mx-auto">{error ?? 'Đã có lỗi xảy ra.'}</p>
          <Button variant="primary" onClick={startOver}>
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
}

function InsightSection({
  title,
  items,
  onToggle,
}: {
  title: string;
  kind: string;
  items: NonNullable<ReturnType<typeof useWorkStore.getState>['analysis']>['insights'];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block">
        {title} ({items.length})
      </span>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className={`block p-4 rounded-card border cursor-pointer transition-all ${
              item.saved ? 'border-green bg-green-wash' : 'border-rule bg-surface'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={item.saved}
                onChange={() => onToggle(item.id)}
                className="mt-1.5 accent-green"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span lang="en" className="font-serif-display text-xl text-ink">
                    {item.text}
                  </span>
                  {item.cefr && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-utility bg-paper text-ink-soft border border-rule">
                      {item.cefr}
                    </span>
                  )}
                  {item.ruleLabel && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-utility bg-paper text-ink-soft border border-rule">
                      {item.ruleLabel}
                    </span>
                  )}
                </div>
                {item.originalText && (
                  <p lang="en" className="text-xs text-ink-soft line-through decoration-wrong/60">
                    {item.originalText}
                  </p>
                )}
                <p className="text-sm text-ink">{item.meaningVi}</p>
                <p className="text-xs text-ink-soft leading-relaxed">{item.noteVi}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function RewriteCard({
  rewrite,
  onToggleSave,
}: {
  rewrite: NonNullable<ReturnType<typeof useWorkStore.getState>['analysis']>['rewrites'][number];
  onToggleSave: () => void;
}) {
  return (
    <article className="bg-surface border border-rule rounded-card shadow-card p-5 sm:p-6 space-y-4">
      <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
        <Sparkles size={14} className="text-green" />
        Cách viết chuyên nghiệp hơn
      </span>

      <div>
        <span className="text-xs italic text-ink-soft block mb-1.5">Bạn viết</span>
        <p lang="en" className="text-[15px] text-ink-soft leading-relaxed border-l-2 border-rule pl-3">
          {rewrite.original}
        </p>
      </div>

      <div className="flex items-center gap-2 text-green" aria-hidden="true">
        <ChevronDown size={16} />
      </div>

      <div>
        <span className="text-xs italic text-ink-soft block mb-1.5">Nên viết</span>
        <p lang="en" className="font-serif-display text-2xl sm:text-[26px] text-ink leading-snug">
          {rewrite.rewrite}
        </p>
      </div>

      <div>
        <span className="text-xs italic text-ink-soft block mb-1">Vì sao hay hơn</span>
        <p className="text-[13px] text-ink-soft leading-relaxed">{rewrite.reasonVi}</p>
      </div>

      {rewrite.keyPhrase && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant={rewrite.saved ? 'primary' : 'quiet'} onClick={onToggleSave}>
            {rewrite.saved ? <CheckCircle2 size={16} /> : null}
            {rewrite.saved ? `Đã chọn lưu "${rewrite.keyPhrase}"` : `Lưu cụm từ "${rewrite.keyPhrase}"`}
          </Button>
        </div>
      )}
    </article>
  );
}
