'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWordsList } from '@/hooks/use-words';
import { useProfile } from '@/hooks/use-profile';
import { useImportsList } from '@/hooks/use-imports';
import { useWorkStore } from '@/stores/work-store';
import { useDocStore } from '@/stores/doc-store';
import { useT } from '@/hooks/use-i18n';
import { Button } from '@/components/Button';
import { UploadDropzone } from '@/components/learn/upload-dropzone';
import { DocResult } from '@/components/learn/doc-result';
import { parseDocumentFile } from '@/lib/api/parse-doc-client';
import { ApiError } from '@/lib/api/client';
import { splitIntoUnits } from '@/lib/documents/extract';
import {
  FileText, Loader2, AlertTriangle, CheckCircle2, Sparkles, ChevronDown,
} from 'lucide-react';

const INPUT_TYPE_LABEL_KEYS: Record<string, string> = {
  work_email: 'learn.inputTypes.workEmail',
  email: 'learn.inputTypes.workEmail',
  report: 'learn.inputTypes.report',
  meeting_note: 'learn.inputTypes.meetingNote',
  chat: 'learn.inputTypes.chat',
  document: 'learn.inputTypes.document',
  other: 'learn.inputTypes.other',
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
  const { t } = useT();

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
        setWorkFileError(t('learn.errors.fileEmptyText'));
        return;
      }
      setWorkText(content);
      setWorkFileName(file.name);
    };
    reader.onerror = () => setWorkFileError(t('learn.errors.fileUnreadable'));
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
          setDocFileError(t('learn.errors.fileEmptyText'));
          return;
        }
        setDocText(content);
        setDocFileName(file.name);
        setDocUnits(splitIntoUnits(content));
        setDocUnitLabel('part');
      };
      reader.onerror = () => setDocFileError(t('learn.errors.fileUnreadable'));
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
      setDocFileError(err instanceof ApiError ? err.messageVi : t('learn.errors.fileParseFailed'));
    } finally {
      setDocFileBusy(false);
    }
  }

  async function runWorkAnalyze() {
    const trimmed = workText.trim();
    if (!trimmed) return;
    await workStore.analyze({
      text: trimmed.slice(0, 10_000),
      fileName: workFileName ?? t('learn.pastedTextName'),
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
      fileName: docFileName ?? t('learn.pastedTextName'),
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
              {t('learn.tabs.work')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('doc')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                learnMode === 'doc' ? 'bg-green-wash text-green' : 'text-ink-soft'
              }`}
            >
              {t('learn.tabs.doc')}
            </button>
          </div>

          {learnMode === 'work' ? (
            <>
              <div>
                <h1 className="font-serif-display text-3xl text-ink mb-1">{t('learn.work.heading')}</h1>
                <p className="text-sm text-ink-soft">
                  {t('learn.work.subtitle')}
                </p>
              </div>
              <UploadDropzone
                accept=".txt,.md"
                hint={t('learn.work.uploadHint')}
                fileInputRef={workFileInputRef}
                onFile={handleWorkFile}
                fileError={workFileError}
                pastedFileName={workFileName}
                text={workText}
                onTextChange={setWorkText}
                placeholder={t('learn.pastePlaceholder')}
              />
              <Button variant="primary" onClick={runWorkAnalyze} disabled={!workText.trim()} className="w-full">
                {t('learn.work.analyzeButton')}
              </Button>
            </>
          ) : (
            <>
              <div>
                <h1 className="font-serif-display text-3xl text-ink mb-1">{t('learn.doc.heading')}</h1>
                <p className="text-sm text-ink-soft">
                  {t('learn.doc.subtitle')}
                </p>
              </div>
              <UploadDropzone
                accept=".txt,.md,.pdf,.docx"
                hint={t('learn.doc.uploadHint')}
                fileInputRef={docFileInputRef}
                onFile={handleDocFile}
                fileBusy={docFileBusy}
                fileError={docFileError}
                pastedFileName={docFileName}
                text={docText}
                onTextChange={handleDocTextChange}
                placeholder={t('learn.pastePlaceholder')}
                maxLength={200_000}
              />
              <Button variant="primary" onClick={runDocAnalyze} disabled={!docText.trim() || docFileBusy} className="w-full">
                {t('learn.doc.analyzeButton')}
              </Button>
            </>
          )}

          {pastImports.length > 0 && (
            <div className="pt-4 border-t border-rule">
              <span className="font-mono-utility text-xs text-ink-soft uppercase tracking-wider block mb-2">
                {t('learn.pastImportsLabel')}
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
                      {imp.status === 'ready' && t('learn.importStatus.ready')}
                      {imp.status === 'done' && t('learn.importStatus.done', { count: imp.addedCount })}
                      {imp.status === 'failed' && t('learn.importStatus.failed')}
                      {imp.status === 'analyzing' && t('learn.importStatus.analyzing')}
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
          <p className="font-serif-display text-2xl text-ink">{t('learn.analyzingHeading')}</p>
          <p className="text-sm text-ink-soft">
            {t('learn.analyzingBody')}
          </p>
        </div>
      )}

      {learnMode === 'work' && (workStore.status === 'ready' || workStore.status === 'saving') && workStore.analysis && !saveResult && (
        <div className="space-y-6 pb-24">
          <div>
            <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block mb-1.5">
              {t('learn.resultLabel')}
            </span>
            <h1 className="font-serif-display text-3xl text-ink mb-2">
              {workStore.analysis.summary.headlineVi || t('learn.defaultHeadline')}
            </h1>
            <p className="text-sm text-ink-soft">
              {INPUT_TYPE_LABEL_KEYS[workStore.analysis.summary.inputTypeVi]
                ? t(INPUT_TYPE_LABEL_KEYS[workStore.analysis.summary.inputTypeVi])
                : workStore.analysis.summary.inputTypeVi}
              {' · '}
              {[
                workStore.analysis.summary.wordCount > 0 && t('learn.counts.words', { count: workStore.analysis.summary.wordCount }),
                workStore.analysis.summary.phraseCount > 0 && t('learn.counts.phrases', { count: workStore.analysis.summary.phraseCount }),
                workStore.analysis.summary.grammarCount > 0 && t('learn.counts.grammar', { count: workStore.analysis.summary.grammarCount }),
                workStore.analysis.summary.rewriteCount > 0 && t('learn.counts.rewrites', { count: workStore.analysis.summary.rewriteCount }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          {workStore.analysis.rewrites.map((rewrite) => (
            <RewriteCard key={rewrite.id} rewrite={rewrite} onToggleSave={() => workStore.toggleRewrite(rewrite.id)} />
          ))}

          <InsightSection
            title={t('learn.section.vocab')}
            kind="vocab"
            items={workStore.analysis.insights.filter((i) => i.kind === 'vocab')}
            onToggle={workStore.toggleInsight}
          />
          <InsightSection
            title={t('learn.section.phrase')}
            kind="phrase"
            items={workStore.analysis.insights.filter((i) => i.kind === 'phrase')}
            onToggle={workStore.toggleInsight}
          />
          <InsightSection
            title={t('learn.section.grammar')}
            kind="grammar"
            items={workStore.analysis.insights.filter((i) => i.kind === 'grammar')}
            onToggle={workStore.toggleInsight}
          />

          {workStore.analysis.insights.length === 0 && workStore.analysis.rewrites.length === 0 && (
            <p className="text-sm text-ink-soft text-center py-8">
              {t('learn.noInsights')}
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
                    {t('learn.addingButton')}
                  </>
                ) : (
                  t('learn.addButton', { count: selectedCount })
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {learnMode === 'work' && saveResult && (
        <div className="py-20 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-green" />
          <p className="font-serif-display text-2xl text-ink">{t('learn.savedHeading', { count: saveResult.count })}</p>
          <p className="text-sm text-ink-soft">
            {t('learn.savedBody')}
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button variant="quiet" onClick={startOver}>
              <FileText size={16} />
              {t('learn.learnAnotherDoc')}
            </Button>
            <Link href="/vocabulary">
              <Button variant="quiet">{t('learn.openNotebook')}</Button>
            </Link>
            <Link href="/practice">
              <Button variant="primary">{t('learn.practiceNow')}</Button>
            </Link>
          </div>
        </div>
      )}

      {learnMode === 'work' && workStore.status === 'error' && (
        <div className="py-20 text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-wrong" />
          <p className="font-serif-display text-2xl text-ink">{t('learn.errorHeading')}</p>
          <p className="text-sm text-ink-soft max-w-sm mx-auto">{workStore.error ?? t('learn.genericError')}</p>
          <Button variant="primary" onClick={startOver}>
            {t('learn.retryButton')}
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
  const { t } = useT();
  return (
    <article className="bg-surface border border-rule rounded-card shadow-card p-5 sm:p-6 space-y-4">
      <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
        <Sparkles size={14} className="text-green" />
        {t('learn.rewrite.label')}
      </span>

      <div>
        <span className="text-xs italic text-ink-soft block mb-1.5">{t('learn.rewrite.original')}</span>
        <p lang="en" className="text-[15px] text-ink-soft leading-relaxed border-l-2 border-rule pl-3">
          {rewrite.original}
        </p>
      </div>

      <div className="flex items-center gap-2 text-green" aria-hidden="true">
        <ChevronDown size={16} />
      </div>

      <div>
        <span className="text-xs italic text-ink-soft block mb-1.5">{t('learn.rewrite.suggested')}</span>
        <p lang="en" className="font-serif-display text-2xl sm:text-[26px] text-ink leading-snug">
          {rewrite.rewrite}
        </p>
      </div>

      <div>
        <span className="text-xs italic text-ink-soft block mb-1">{t('learn.rewrite.reason')}</span>
        <p className="text-[13px] text-ink-soft leading-relaxed">{rewrite.reasonVi}</p>
      </div>

      {rewrite.keyPhrase && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant={rewrite.saved ? 'primary' : 'quiet'} onClick={onToggleSave}>
            {rewrite.saved ? <CheckCircle2 size={16} /> : null}
            {rewrite.saved
              ? t('learn.rewrite.savedPhrase', { phrase: rewrite.keyPhrase })
              : t('learn.rewrite.savePhrase', { phrase: rewrite.keyPhrase })}
          </Button>
        </div>
      )}
    </article>
  );
}
