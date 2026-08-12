'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useWordsList } from '@/hooks/use-words';
import { useEnrichmentStore } from '@/stores/enrichment-store';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { Word } from '@/types';
import { WordCard } from '@/components/WordCard';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Plus, Search, Loader2, FileText, Type, Upload, Trash2 } from 'lucide-react';

// Rewritten on the repository layer + enrichment-store (Phase 5) — replaces
// screens/WordsScreen.tsx / context/WordsContext.tsx. `addWord` now returns the
// persisted row with a real id before triggering enrichment by that id, which is
// what makes bug #9 (audit — enrichment searched a stale in-memory array right
// after the word was queued into state) structurally impossible: there is no
// in-memory array to search, only a DB lookup by id.
export default function WordsPage() {
  const words = useWordsList();
  const pendingIds = useEnrichmentStore((s) => s.pendingIds);
  const enrich = useEnrichmentStore((s) => s.enrich);

  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState<'type' | 'paste' | 'file'>('type');

  const [typedWord, setTypedWord] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [extractedCandidates, setExtractedCandidates] = useState<Array<{ word: string; reason: string }>>([]);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWords = words.filter((w) =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.meaningVi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function addWord(text: string, source: Word['source']) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const word = await getRepos().words.add({ word: trimmed, source });
    void enrich(word.id);
  }

  const handleSaveTypedWord = async () => {
    if (!typedWord.trim()) return;
    await addWord(typedWord, { kind: 'manual', label: 'Tự thêm', at: Date.now() });
    setTypedWord('');
    setIsAddSheetOpen(false);
  };

  const handleExtractPastedText = async () => {
    if (!pastedText.trim()) return;
    setLoadingExtract(true);
    try {
      const data = await callTask('extractWords', { text: pastedText });
      setExtractedCandidates(data.words);
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setLoadingExtract(false);
    }
  };

  const handleSaveCandidates = async (candidateList: string[]) => {
    const now = Date.now();
    for (const w of candidateList) {
      await addWord(w, { kind: 'paste', label: 'Đoạn văn đã dán', at: now });
    }
    setExtractedCandidates([]);
    setPastedText('');
    setIsAddSheetOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm từ vựng hoặc nghĩa tiếng Việt..."
          className="w-full pl-10 pr-4 py-2.5 rounded-[12px] bg-surface border border-rule text-sm text-ink focus:outline-none focus:border-green transition-all"
        />
      </div>

      {filteredWords.length === 0 ? (
        <div className="text-center py-12 bg-surface border border-rule rounded-[16px]">
          <p className="font-serif-display text-2xl text-ink mb-1">Chưa có từ nào trong sổ</p>
          <p className="text-sm text-ink-soft">
            Bấm nút dấu cộng bên dưới để thêm từ mới đầu tiên.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-rule rounded-[16px] divide-y divide-rule overflow-hidden">
          {filteredWords.map((word) => {
            const isEnriching = pendingIds.has(word.id);
            return (
              <button
                key={word.id}
                type="button"
                onClick={() => setSelectedWord(word)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-paper transition-colors cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 lang="en" className="font-serif-display text-2xl text-ink group-hover:text-green transition-colors">
                      {word.word}
                    </h3>
                    <span lang="en" className="font-mono-utility text-xs text-ink-soft">{word.ipa}</span>
                  </div>
                  <p className="text-xs text-ink-soft mt-0.5 line-clamp-1">
                    {isEnriching ? (
                      <span className="animate-pulse text-amber">Đang tải nghĩa AI...</span>
                    ) : (
                      word.meaningVi || 'Đang chờ làm giàu nội dung...'
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono-utility ${
                      word.status === 'known'
                        ? 'bg-green-wash text-green'
                        : word.status === 'learning'
                        ? 'bg-amber/10 text-amber'
                        : 'bg-rule text-ink-soft'
                    }`}
                  >
                    {word.status === 'known' ? 'Đã thuộc' : word.status === 'learning' ? 'Đang học' : 'Từ mới'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setIsAddSheetOpen(true)}
        className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-green text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer z-30"
        aria-label="Thêm từ mới"
      >
        <Plus size={28} />
      </button>

      <Sheet isOpen={selectedWord !== null} onClose={() => setSelectedWord(null)}>
        {selectedWord && (
          <div className="space-y-6">
            <WordCard word={selectedWord} showDetails={true} />

            {/* Provenance + review stats — the sheet used to show only the source
                label; docs/progress/board.md Phase 7 flagged this as one of the 3
                things "Chi tiết từ" was missing (collocations/wordFamily above were
                already wired in WordCard, just always empty until bug #1 was fixed
                in Phase 5). */}
            <div className="pt-4 border-t border-rule grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="block text-ink-soft font-mono-utility uppercase tracking-wide mb-0.5">
                  Nguồn
                </span>
                <span className="text-ink">{selectedWord.source?.label || 'Tự thêm'}</span>
              </div>
              <div>
                <span className="block text-ink-soft font-mono-utility uppercase tracking-wide mb-0.5">
                  Ngày thêm
                </span>
                <span className="text-ink">
                  {new Date(selectedWord.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div>
                <span className="block text-ink-soft font-mono-utility uppercase tracking-wide mb-0.5">
                  Đã ôn tập
                </span>
                <span className="text-ink">{selectedWord.reviewCount} lần</span>
              </div>
              <div>
                <span className="block text-ink-soft font-mono-utility uppercase tracking-wide mb-0.5">
                  Ôn lại tiếp
                </span>
                <span className="text-ink">
                  {selectedWord.status === 'new'
                    ? 'Chưa học'
                    : new Date(selectedWord.dueAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-rule flex justify-end items-center">
              <Button
                variant="danger"
                onClick={async () => {
                  await getRepos().words.remove(selectedWord.id);
                  setSelectedWord(null);
                }}
              >
                <Trash2 size={16} />
                Xoá từ
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        isOpen={isAddSheetOpen}
        onClose={() => {
          setIsAddSheetOpen(false);
          setExtractedCandidates([]);
        }}
        title="Thêm từ vựng mới"
      >
        <div className="space-y-5">
          <div className="flex rounded-[12px] bg-paper p-1 border border-rule">
            <button
              onClick={() => setActiveAddTab('type')}
              className={`flex-1 py-2 text-xs font-medium rounded-[8px] transition-all cursor-pointer ${
                activeAddTab === 'type'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-soft'
              }`}
            >
              <Type size={14} className="inline mr-1.5" />
              Gõ từ
            </button>
            <button
              onClick={() => setActiveAddTab('paste')}
              className={`flex-1 py-2 text-xs font-medium rounded-[8px] transition-all cursor-pointer ${
                activeAddTab === 'paste'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-soft'
              }`}
            >
              <FileText size={14} className="inline mr-1.5" />
              Dán đoạn văn
            </button>
            <button
              onClick={() => setActiveAddTab('file')}
              className={`flex-1 py-2 text-xs font-medium rounded-[8px] transition-all cursor-pointer ${
                activeAddTab === 'file'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-soft'
              }`}
            >
              <Upload size={14} className="inline mr-1.5" />
              Tải tệp
            </button>
          </div>

          {activeAddTab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono-utility text-ink-soft mb-2">
                  Nhập từ tiếng Anh:
                </label>
                <input
                  type="text"
                  lang="en"
                  value={typedWord}
                  onChange={(e) => setTypedWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTypedWord()}
                  placeholder="Ví dụ: leverage, orchestrate..."
                  className="w-full p-3.5 rounded-[12px] bg-paper border border-rule text-base font-serif-display text-ink focus:outline-none focus:border-green"
                />
              </div>
              <p className="text-xs text-ink-soft">
                AI sẽ tự động làm giàu thông tin: phát âm IPA, nghĩa tiếng Việt, câu ví dụ và collocations đi kèm.
              </p>
              <Button
                variant="primary"
                onClick={handleSaveTypedWord}
                disabled={!typedWord.trim()}
                className="w-full"
              >
                Lưu từ ngay
              </Button>
            </div>
          )}

          {activeAddTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono-utility text-ink-soft mb-2">
                  Dán bài đọc / email / tài liệu công việc:
                </label>
                <textarea
                  lang="en"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Dán đoạn văn tiếng Anh vào đây..."
                  rows={4}
                  className="w-full p-3.5 rounded-[12px] bg-paper border border-rule text-sm text-ink focus:outline-none focus:border-green resize-none"
                />
              </div>

              {extractedCandidates.length === 0 ? (
                <Button
                  variant="primary"
                  onClick={handleExtractPastedText}
                  disabled={loadingExtract || !pastedText.trim()}
                  className="w-full"
                >
                  {loadingExtract ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Đang trích xuất từ vựng...
                    </>
                  ) : (
                    'Phân tích & Lọc từ đáng học'
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <span className="block text-xs font-mono-utility text-ink-soft">
                    Các từ vựng gợi ý:
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {extractedCandidates.map((cand, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-[8px] bg-paper border border-rule flex items-center justify-between"
                      >
                        <div>
                          <span lang="en" className="font-serif-display text-lg text-ink mr-2">
                            {cand.word}
                          </span>
                          <span className="text-xs text-ink-soft">{cand.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => handleSaveCandidates(extractedCandidates.map((c) => c.word))}
                    className="w-full"
                  >
                    Thêm tất cả {extractedCandidates.length} từ vào sổ
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeAddTab === 'file' && (
            <div className="space-y-4 text-center py-4">
              <Upload size={32} className="mx-auto text-green" />
              <p className="text-sm text-ink">
                Phân tích cả tài liệu (tệp .txt/.md hoặc dán văn bản dài) trên màn riêng — có bộ lọc theo trình độ và
                phân loại từng từ trước khi thêm vào sổ.
              </p>
              <Link href="/tai-tai-lieu" onClick={() => setIsAddSheetOpen(false)}>
                <Button variant="primary" className="w-full">
                  Mở màn Tải tài liệu
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
