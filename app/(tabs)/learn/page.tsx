'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWordsList } from '@/hooks/use-words';
import { useProfile } from '@/hooks/use-profile';
import { useImportsList } from '@/hooks/use-imports';
import { useWorkStore } from '@/stores/work-store';
import { useDocStore } from '@/stores/doc-store';
import { Button } from '@/components/Button';
import { UploadDropzone } from '@/components/learn/upload-dropzone';
import { DocResult } from '@/components/learn/doc-result';
import { parseDocumentFile } from '@/lib/api/parse-doc-client';
import { ApiError } from '@/lib/api/client';
import { splitIntoUnits } from '@/lib/documents/extract';
import {
  FileText, Loader2, AlertTriangle, CheckCircle2, Sparkles, ChevronDown,
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

type LearnMode = 'work' | 'doc';

// Remembers whichever tab the user picked last, so returning to /learn doesn't
// always reset to "Từ công việc" — the ?mode= query param (below) still wins when
// present, e.g. a link that specifically wants the doc-upload tab.
const LEARN_MODE_STORAGE_KEY = 'lexio:learnMode';

// The signature feature (docs/decision.md ADR-014, strategy doc §7) plus its
// document-upload sibling (docs/decision.md ADR-021): paste a real piece of
// workplace English, or upload a document/PDF/DOCX -> AI returns vocabulary
// (+ phrases/grammar/rewrites for the work mode) -> user selects/triages what to
// save -> saved items enter the notebook already scheduled for practice (SRS).
// State lives in stores/work-store.ts and stores/doc-store.ts; this page stays
// presentational (docs/architecture.md §1 — no component here calls Dexie or
// /api/ai/* directly).
export default function LearnPage() {
  const words = useWordsList();
  const { settings } = useProfile();
  const pastImports = useImportsList(10);
  const searchParams = useSearchParams();

  const [learnMode, setLearnMode] = useState<LearnMode>('work');
  const [autoOpenFileDialog, setAutoOpenFileDialog] = useState(false);

  const workFileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const workStore = useWorkStore();
  const docStore = useDocStore();

  const [workText, setWorkText] = useState('');
  const [workFileName, setWorkFileName] = useState<string | null>(null);
  const [workFileError, setWorkFileError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{ count: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [docText, setDocText] = useState('');
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [docFileError, setDocFileError] = useState<string | null>(null);
  const [docFileBusy, setDocFileBusy] = useState(false);
  // Real page/paragraph boundaries from the upload — kept apart from `docText`
  // (which stays the editable preview) so analysis can chunk on real pages instead
  // of re-splitting a flat string. Any manual edit to the textarea invalidates this
  // (handleDocTextChange below) and falls back to re-deriving units from whatever
  // the user typed, losing exact page numbers but staying correct.
  const [docUnits, setDocUnits] = useState<string[] | null>(null);
  const [docUnitLabel, setDocUnitLabel] = useState<'page' | 'part'>('part');

  function switchMode(mode: LearnMode) {
    setLearnMode(mode);
    window.localStorage.setItem(LEARN_MODE_STORAGE_KEY, mode);
  }

  useEffect(() => {
    const mode = searchParams.get('mode');
    // 'file' is the pre-ADR-021 param name — kept working for old links/bookmarks
    // (app/upload/page.tsx among them) as an alias for 'doc'.
    if (mode === 'doc' || mode === 'file') {
      setLearnMode('doc');
      setAutoOpenFileDialog(true);
      return;
    }
    const saved = window.localStorage.getItem(LEARN_MODE_STORAGE_KEY);
    if (saved === 'work' || saved === 'doc') setLearnMode(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoOpenFileDialog && learnMode === 'doc') {
      docFileInputRef.current?.click();
      setAutoOpenFileDialog(false);
    }
  }, [autoOpenFileDialog, learnMode]);

  function handleWorkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWorkFileError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== 'string' || content.trim().length === 0) {
        setWorkFileError('Không đọc được nội dung văn bản từ tệp này. Thử dán trực tiếp đoạn văn bên dưới.');
        return;
      }
      setWorkText(content);
      setWorkFileName(file.name);
    };
    reader.onerror = () => setWorkFileError('Không đọc được tệp. Tệp có thể bị hỏng — thử tệp khác hoặc dán văn bản.');
    reader.readAsText(file);
  }

  function handleDocTextChange(value: string) {
    setDocText(value);
    setDocUnits(null); // manual edit invalidates the cached page/paragraph boundaries
  }

  async function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocFileError(null);
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content !== 'string' || content.trim().length === 0) {
          setDocFileError('Không đọc được nội dung văn bản từ tệp này. Thử dán trực tiếp đoạn văn bên dưới.');
          return;
        }
        setDocText(content);
        setDocFileName(file.name);
        setDocUnits(splitIntoUnits(content));
        setDocUnitLabel('part');
      };
      reader.onerror = () => setDocFileError('Không đọc được tệp. Tệp có thể bị hỏng — thử tệp khác hoặc dán văn bản.');
      reader.readAsText(file);
      return;
    }

    setDocFileBusy(true);
    try {
      const parsed = await parseDocumentFile(file);
      setDocText(parsed.units.join('\n\n'));
      setDocFileName(parsed.fileName);
      setDocUnits(parsed.units);
      setDocUnitLabel(parsed.unitLabel);
    } catch (err) {
      setDocFileError(err instanceof ApiError ? err.messageVi : 'Không đọc được tệp. Thử tệp khác hoặc dán văn bản.');
    } finally {
      setDocFileBusy(false);
    }
  }

  async function runWorkAnalyze() {
    const trimmed = workText.trim();
    if (!trimmed) return;
    await workStore.analyze({
      text: trimmed.slice(0, 10_000),
      fileName: workFileName ?? 'Đoạn văn đã dán',
      sourceType: 'other',
      level: settings.level,
      contextTopic: settings.contextTopic,
      excludeWords: words.map((w) => w.word),
    });
  }

  async function runDocAnalyze() {
    const trimmed = docText.trim();
    if (!trimmed) return;
    // Prefer the real page/paragraph boundaries from the upload; only re-derive
    // from the flat textarea if the user hand-edited it (docUnits was cleared) or
    // they never uploaded a file at all (plain paste).
    const units = docUnits ?? splitIntoUnits(trimmed);
    const unitLabel = docUnits ? docUnitLabel : 'part';
    await docStore.analyze({
      units,
      unitLabel,
      fileName: docFileName ?? 'Đoạn văn đã dán',
      kind: docFileName?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
      level: settings.level,
      contextTopic: settings.contextTopic,
    });
  }

  async function confirmSave() {
    if (submitting) return;
    setSubmitting(true);
    const result = await workStore.saveSelected(Date.now());
    setSaveResult({ count: result.count });
    setSubmitting(false);
  }

  function startOver() {
    workStore.reset();
    docStore.reset();
    setWorkText('');
    setWorkFileName(null);
    setWorkFileError(null);
    setSaveResult(null);
    setDocText('');
    setDocFileName(null);
    setDocFileError(null);
    setDocUnits(null);
  }

  function openPastImport(imp: { id: string; kind: string }) {
    if (imp.kind === 'work') {
      switchMode('work');
      workStore.open(imp.id);
    } else {
      switchMode('doc');
      docStore.open(imp.id);
    }
  }

  const selectedCount =
    (workStore.analysis?.insights.filter((i) => i.saved).length ?? 0) +
    (workStore.analysis?.rewrites.filter((r) => r.saved).length ?? 0);

  const showWorkIdle = learnMode === 'work' && workStore.status === 'idle';
  const showDocIdle = learnMode === 'doc' && docStore.status === 'idle';

  return (
    <div className="pb-nav max-w-2xl mx-auto">
      {(showWorkIdle || showDocIdle) && (
        <div className="space-y-5">
          <div className="flex gap-1 p-1 bg-surface border border-rule rounded-xl">
            <button
              type="button"
              onClick={() => switchMode('work')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                learnMode === 'work' ? 'bg-green-wash text-green' : 'text-ink-soft'
              }`}
            >
              Từ công việc
            </button>
            <button
              type="button"
              onClick={() => switchMode('doc')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                learnMode === 'doc' ? 'bg-green-wash text-green' : 'text-ink-soft'
              }`}
            >
              Từ tài liệu
            </button>
          </div>

          {learnMode === 'work' ? (
            <>
              <div>
                <h1 className="font-serif-display text-3xl text-ink mb-1">Học từ công việc thật</h1>
                <p className="text-sm text-ink-soft">
                  Dán một email, báo cáo, ghi chú họp hay tài liệu tiếng Anh bạn đang dùng ở công ty. AI sẽ tìm từ
                  vựng, cụm từ chuyên nghiệp, lỗi ngữ pháp và cách viết chuyên nghiệp hơn trong đó.
                </p>
              </div>
              <UploadDropzone
                accept=".txt,.md"
                hint="Bấm để tải tệp văn bản (.txt, .md)"
                fileInputRef={workFileInputRef}
                onFile={handleWorkFile}
                fileError={workFileError}
                pastedFileName={workFileName}
                text={workText}
                onTextChange={setWorkText}
                placeholder="Dán đoạn văn tiếng Anh vào đây..."
              />
              <Button variant="primary" onClick={runWorkAnalyze} disabled={!workText.trim()} className="w-full">
                Phân tích với Gemini
              </Button>
            </>
          ) : (
            <>
              <div>
                <h1 className="font-serif-display text-3xl text-ink mb-1">Đào từ vựng từ tài liệu</h1>
                <p className="text-sm text-ink-soft">
                  Tải một tài liệu, bài báo hay bài viết tiếng Anh bạn đang đọc (.txt, .md, .pdf, .docx). AI sẽ tìm
                  những từ vựng đáng học mà có thể bạn chưa biết, kèm câu ví dụ ngay trong tài liệu.
                </p>
              </div>
              <UploadDropzone
                accept=".txt,.md,.pdf,.docx"
                hint="Bấm để tải tệp (.txt, .md, .pdf, .docx)"
                fileInputRef={docFileInputRef}
                onFile={handleDocFile}
                fileBusy={docFileBusy}
                fileError={docFileError}
                pastedFileName={docFileName}
                text={docText}
                onTextChange={handleDocTextChange}
                placeholder="Dán đoạn văn tiếng Anh vào đây..."
                maxLength={200_000}
              />
              <Button variant="primary" onClick={runDocAnalyze} disabled={!docText.trim() || docFileBusy} className="w-full">
                Tìm từ vựng đáng học
              </Button>
            </>
          )}

          {pastImports.length > 0 && (
            <div className="pt-4 border-t border-rule">
              <span className="font-mono-utility text-xs text-ink-soft uppercase tracking-wider block mb-2">
                Đã phân tích trước đó
              </span>
              <div className="space-y-1.5">
                {pastImports.map((imp) => (
                  <button
                    key={imp.id}
                    type="button"
                    onClick={() => openPastImport(imp)}
                    className="w-full text-left p-3 rounded-xl bg-surface border border-rule hover:border-green transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-ink-soft shrink-0" />
                      <span className="text-sm text-ink truncate">{imp.fileName}</span>
                    </span>
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

      {learnMode === 'doc' && docStore.status !== 'idle' && <DocResult onStartOver={startOver} />}

      {learnMode === 'work' && workStore.status === 'analyzing' && (
        <div className="py-20 text-center space-y-4">
          <Loader2 size={40} className="mx-auto text-green animate-spin" />
          <p className="font-serif-display text-2xl text-ink">Đang đọc tài liệu của bạn...</p>
          <p className="text-sm text-ink-soft">
            Gemini đang tìm từ vựng, cụm từ và lỗi ngữ pháp đáng học. Có thể mất đến một phút.
          </p>
        </div>
      )}

      {learnMode === 'work' && (workStore.status === 'ready' || workStore.status === 'saving') && workStore.analysis && !saveResult && (
        <div className="space-y-6 pb-24">
          <div>
            <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block mb-1.5">
              Phân tích bởi Gemini
            </span>
            <h1 className="font-serif-display text-3xl text-ink mb-2">
              {workStore.analysis.summary.headlineVi || 'Kết quả phân tích'}
            </h1>
            <p className="text-sm text-ink-soft">
              {INPUT_TYPE_VI[workStore.analysis.summary.inputTypeVi] ?? workStore.analysis.summary.inputTypeVi}
              {' · '}
              {[
                workStore.analysis.summary.wordCount > 0 && `${workStore.analysis.summary.wordCount} từ vựng`,
                workStore.analysis.summary.phraseCount > 0 && `${workStore.analysis.summary.phraseCount} cụm từ`,
                workStore.analysis.summary.grammarCount > 0 && `${workStore.analysis.summary.grammarCount} điểm ngữ pháp`,
                workStore.analysis.summary.rewriteCount > 0 && `${workStore.analysis.summary.rewriteCount} cách viết hay hơn`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          {workStore.analysis.rewrites.map((rewrite) => (
            <RewriteCard key={rewrite.id} rewrite={rewrite} onToggleSave={() => workStore.toggleRewrite(rewrite.id)} />
          ))}

          <InsightSection
            title="Từ vựng"
            kind="vocab"
            items={workStore.analysis.insights.filter((i) => i.kind === 'vocab')}
            onToggle={workStore.toggleInsight}
          />
          <InsightSection
            title="Cụm từ chuyên nghiệp"
            kind="phrase"
            items={workStore.analysis.insights.filter((i) => i.kind === 'phrase')}
            onToggle={workStore.toggleInsight}
          />
          <InsightSection
            title="Điểm ngữ pháp"
            kind="grammar"
            items={workStore.analysis.insights.filter((i) => i.kind === 'grammar')}
            onToggle={workStore.toggleInsight}
          />

          {workStore.analysis.insights.length === 0 && workStore.analysis.rewrites.length === 0 && (
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

      {learnMode === 'work' && saveResult && (
        <div className="py-20 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-green" />
          <p className="font-serif-display text-2xl text-ink">Đã thêm {saveResult.count} mục vào sổ tay</p>
          <p className="text-sm text-ink-soft">
            AI đã chuẩn bị sẵn ví dụ và lựa chọn luyện tập cho từng mục — sẵn sàng ôn ngay hôm nay.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button variant="quiet" onClick={startOver}>
              <FileText size={16} />
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

      {learnMode === 'work' && workStore.status === 'error' && (
        <div className="py-20 text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-wrong" />
          <p className="font-serif-display text-2xl text-ink">Không phân tích được tài liệu</p>
          <p className="text-sm text-ink-soft max-w-sm mx-auto">{workStore.error ?? 'Đã có lỗi xảy ra.'}</p>
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
