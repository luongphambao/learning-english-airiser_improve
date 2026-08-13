import React from 'react';
import { Word } from '@/types';
import { Volume2 } from 'lucide-react';

interface WordCardProps {
  word: Word;
  onPlayAudio?: () => void;
  showDetails?: boolean;
}

export function WordCard({ word, onPlayAudio, showDetails = true }: WordCardProps) {
  return (
    <div className="bg-surface border border-rule rounded-card p-6 relative transition-all">
      {/* Header: Word & Audio */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 lang="en" className="font-serif-display text-4xl sm:text-5xl text-ink tracking-tight leading-none mb-2">
            {word.word}
          </h2>
          <div className="flex items-center gap-3">
            <span lang="en" className="font-mono-utility text-ink-soft text-sm tracking-wide">
              {word.ipa || '/.../'}
            </span>
            <span lang="en" className="text-ink-soft italic text-sm font-sans">
              {word.partOfSpeech || 'word'}
            </span>
            {word.isLeech && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono-utility bg-amber/10 text-amber-ink border border-amber/30">
                Từ khó
              </span>
            )}
          </div>
        </div>

        {onPlayAudio && (
          <button
            onClick={onPlayAudio}
            className="p-3 rounded-card bg-green-wash text-green hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
            title="Nghe phát âm"
            aria-label="Nghe phát âm"
          >
            <Volume2 size={20} />
          </button>
        )}
      </div>

      <div className="w-full h-[1px] bg-rule my-4" />

      {/* Meaning */}
      <p className="text-ink text-lg font-medium leading-snug">
        {word.meaningVi}
      </p>

      {/* Example Sentence */}
      {showDetails && word.exampleSentence && (
        <div className="mt-4 p-4 rounded-card bg-paper border-l-4 border-green">
          <p lang="en" className="text-sm text-ink italic leading-relaxed">
            &ldquo;{word.exampleSentence}&rdquo;
          </p>
        </div>
      )}

      {/* Collocations */}
      {showDetails && word.collocations && word.collocations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-rule">
          <span className="text-xs font-mono-utility text-ink-soft uppercase tracking-wider block mb-2">
            Thường đi với (Collocations)
          </span>
          <div className="space-y-1.5">
            {word.collocations.map((col, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                <span lang="en" className="font-serif-display text-base text-ink">{col.phrase}</span>
                <span className="text-ink-soft">{col.meaningVi}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Word Family */}
      {showDetails && word.wordFamily && word.wordFamily.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
          <span className="font-mono-utility">Cùng họ:</span>
          <span lang="en">{word.wordFamily.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
