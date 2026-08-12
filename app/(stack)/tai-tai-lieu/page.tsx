'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { applyTriage } from '@/lib/srs/schedule';
import { ApiError } from '@/lib/api/client';
import { useWordsList } from '@/hooks/use-words';
import { useProfile } from '@/hooks/use-profile';
import { useImport, useImportsList } from '@/hooks/use-imports';
import { useEnrichmentStore } from '@/stores/enrichment-store';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/Button';
import type { CandidateWord, KnownState } from '@/lib/domain';
import { FileText, Loader2, AlertTriangle, CheckCircle2, Upload, RotateCcw } from 'lucide-react';

type Step = 'input' | 'analyzing' | 'triage' | 'success' | 'error';

const CEFR_FILTERS = ['all', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrFilter = (typeof CEFR_FILTERS)[number];

const TRIAGE_LABEL: Record<KnownState, string> = {
  known: 'Biết rõ',
  partial: 'Sơ sơ',
  unknown: 'Chưa biết',
};

// New screen (docs/progress/board.md Phase 7 — "Phân loại từ" was flagged the most
// important missing screen). Paste/upload -> analyzeDocument -> triage -> add to
// sổ. Uses the analyzeDocument task that already existed from Phase 6 but previously
// had no consumer. Text-only input for now (inlineFiles capability not enabled for
// the OpenAI-compatible provider — see docs/spec-gaps.md / board.md Phase 6 note).
export default function ImportPage() {
  const words = useWordsList();
  const { settings } = useProfile();
  const enrich = useEnrichmentStore((s) => s.enrich);
  const pastImports = useImportsList(10);

  const [step, setStep] = useState<Step>('input');
  const [importId, setImportId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cefrFilter, setCefrFilter] = useState<CefrFilter>('all');
  const [addedCount, setAddedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const current = useImport(importId);

  function reset() {
    setStep('input');
    setImportId(null);
    setText('');
    setFileName(null);
    setFileError(null);
    setCefrFilter('all');
    setAddedCount(0);
  }

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
      setFileName(file.name);
    };
    reader.onerror = () => setFileError('Không đọc được tệp. Tệp có thể bị hỏng — thử tệp khác hoặc dán văn bản.');
    reader.readAsText(file);
  }

  async function analyze() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStep('analyzing');
    const repos = getRepos();
    const created = await repos.imports.create({ fileName: fileName ?? 'Đoạn văn đã dán', kind: 'text' });
    setImportId(created.id);
    try {
      const excludeWords = words.map((w) => w.word);
      const result = await callTask('analyzeDocument', {
        documentText: trimmed.slice(0, 10_000),
        level: settings.level,
        contextTopic: settings.contextTopic,
        excludeWords,
      });
      const candidates: CandidateWord[] = result.candidates.map((c) => ({ ...c, triage: null }));
      await repos.imports.setCandidates(created.id, candidates);
      setStep('triage');
    } catch (err) {
      const message = err instanceof ApiError ? err.messageVi : 'Không phân tích được tài liệu. Thử lại sau.';
      await repos.imports.fail(created.id, message);
      setStep('error');
    }
  }

  async function openImport(id: string) {
    const row = await getRepos().imports.get(id);
    if (!row) return;
    setImportId(id);
    setFileName(row.fileName);
    if (row.status === 'analyzing') setStep('analyzing');
    else if (row.status === 'ready') setStep('triage');
    else if (row.status === 'failed') setStep('error');
    else setStep('input');
  }

  async function setTriage(word: string, triage: KnownState) {
    if (!importId) return;
    await getRepos().imports.setTriage(importId, word, triage);
  }

  async function confirmTriage() {
    if (!current || submitting) return;
    setSubmitting(true);
    const repos = getRepos();
    const now = Date.now();
    const toAdd = current.candidates.filter((c) => c.triage === 'partial' || c.triage === 'unknown');

    let added = 0;
    for (const candidate of toAdd) {
      const word = await repos.words.add({
        word: candidate.word,
        source: { kind: 'paste', label: `Tài liệu: ${current.fileName}`, at: now },
      });
      await repos.words.patch(word.id, {
        meaningVi: candidate.meaningVi,
        exampleSentence: candidate.sentenceFromDoc,
      });
      if (candidate.triage === 'partial') {
        const scheduled = applyTriage('partial', now);
        if (scheduled) await repos.words.patch(word.id, scheduled);
      }
      void enrich(word.id, settings.contextTopic);
      added += 1;
    }

    await repos.imports.complete(current.id, added);
    setAddedCount(added);
    setSubmitting(false);
    setStep('success');
  }

  const visibleCandidates =
    current?.candidates.filter((c) => cefrFilter === 'all' || c.cefr === cefrFilter) ?? [];
  const decidedCount = current?.candidates.filter((c) => c.triage === 'partial' || c.triage === 'unknown').length ?? 0;

  return (
    <>
      <BackHeader title="Tải tài liệu" />
      <div className="pt-6 pb-24 max-w-2xl mx-auto">
        {step === 'input' && (
          <div className="space-y-5">
            <div>
              <h1 className="font-serif-display text-3xl text-ink mb-1">Phân tích tài liệu</h1>
              <p className="text-sm text-ink-soft">
                Dán một đoạn văn, email, hoặc tài liệu công việc. AI sẽ tìm những từ đáng học ở trình độ{' '}
                <span className="font-mono-utility">{settings.level}</span> trở lên, kèm nghĩa và câu ví dụ trích từ
                chính văn bản.
              </p>
            </div>

            <div className="border-2 border-dashed border-rule rounded-card p-5 text-center hover:border-green transition-all">
              <input type="file" accept=".txt,.md" onChange={handleFile} className="hidden" id="doc-file-input" />
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

            {fileName && (
              <p className="text-xs text-ink-soft flex items-center gap-1.5">
                <FileText size={14} />
                Đã nạp: {fileName}
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

            <Button variant="primary" onClick={analyze} disabled={!text.trim()} className="w-full">
              Phân tích tài liệu
            </Button>

            {pastImports.length > 0 && (
              <div className="pt-4 border-t border-rule">
                <span className="text-xs font-mono-utility text-ink-soft uppercase tracking-wider block mb-2">
                  Đã tải trước đó
                </span>
                <div className="space-y-1.5">
                  {pastImports.map((imp) => (
                    <button
                      key={imp.id}
                      type="button"
                      onClick={() => openImport(imp.id)}
                      className="w-full text-left p-3 rounded-xl bg-surface border border-rule hover:border-green transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-sm text-ink truncate">{imp.fileName}</span>
                      <span className="text-[11px] font-mono-utility text-ink-soft shrink-0 ml-2">
                        {imp.status === 'ready' && `${imp.candidates.length} từ chờ phân loại`}
                        {imp.status === 'done' && `Đã thêm ${imp.addedCount} từ`}
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

        {step === 'analyzing' && (
          <div className="py-20 text-center space-y-4">
            <Loader2 size={40} className="mx-auto text-green animate-spin" />
            <p className="font-serif-display text-2xl text-ink">Đang phân tích tài liệu...</p>
            <p className="text-sm text-ink-soft">
              AI đang tìm từ vựng đáng học. Có thể mất đến một phút với tài liệu dài.
            </p>
          </div>
        )}

        {step === 'triage' && current && (
          <div className="space-y-4">
            <div>
              <h1 className="font-serif-display text-3xl text-ink mb-1">Phân loại từ</h1>
              <p className="text-sm text-ink-soft">
                Tìm thấy {current.candidates.length} từ trong &ldquo;{current.fileName}&rdquo;. Đánh dấu mức độ bạn đã
                biết mỗi từ — những từ &ldquo;Sơ sơ&rdquo; và &ldquo;Chưa biết&rdquo; sẽ được thêm vào sổ.
              </p>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {CEFR_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCefrFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono-utility border transition-all cursor-pointer ${
                    cefrFilter === f ? 'border-green bg-green-wash text-green' : 'border-rule text-ink-soft'
                  }`}
                >
                  {f === 'all' ? 'Tất cả' : f}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {visibleCandidates.map((candidate) => (
                <div key={candidate.word} className="p-4 rounded-2xl bg-surface border border-rule space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span lang="en" className="font-serif-display text-xl text-ink">{candidate.word}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-utility bg-paper text-ink-soft border border-rule">
                          {candidate.cefr}
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft mt-0.5">{candidate.meaningVi}</p>
                    </div>
                  </div>
                  <p lang="en" className="text-xs text-ink-soft italic border-l-2 border-rule pl-2.5">
                    &ldquo;{candidate.sentenceFromDoc}&rdquo;
                  </p>
                  <div className="flex gap-1.5">
                    {(Object.keys(TRIAGE_LABEL) as KnownState[]).map((state) => (
                      <button
                        key={state}
                        type="button"
                        onClick={() => setTriage(candidate.word, state)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          candidate.triage === state
                            ? state === 'known'
                              ? 'border-green bg-green-wash text-green'
                              : state === 'partial'
                                ? 'border-amber bg-amber/10 text-amber'
                                : 'border-wrong bg-wrong/10 text-wrong'
                            : 'border-rule text-ink-soft'
                        }`}
                      >
                        {TRIAGE_LABEL[state]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-rule p-4">
              <div className="max-w-2xl mx-auto">
                <Button variant="primary" onClick={confirmTriage} disabled={submitting} className="w-full">
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Đang thêm...
                    </>
                  ) : (
                    `Thêm ${decidedCount} từ vào sổ`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-20 text-center space-y-4">
            <CheckCircle2 size={48} className="mx-auto text-green" />
            <p className="font-serif-display text-2xl text-ink">Đã thêm {addedCount} từ vào sổ</p>
            <p className="text-sm text-ink-soft">
              AI đang làm giàu nghĩa, phát âm và collocations cho từng từ ở nền — quay lại Sổ từ sau vài giây.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="quiet" onClick={reset}>
                <RotateCcw size={16} />
                Tải tài liệu khác
              </Button>
              <Link href="/so-tu">
                <Button variant="primary">Xem sổ từ</Button>
              </Link>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="py-20 text-center space-y-4">
            <AlertTriangle size={48} className="mx-auto text-wrong" />
            <p className="font-serif-display text-2xl text-ink">Không phân tích được tài liệu</p>
            <p className="text-sm text-ink-soft max-w-sm mx-auto">{current?.error ?? 'Đã có lỗi xảy ra.'}</p>
            <Button variant="primary" onClick={reset}>
              Thử lại
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
