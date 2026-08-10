import React, { useState } from 'react';
import { GrammarQuestion } from '@/types';
import { Button } from './Button';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

interface GrammarQuizCardProps {
  question: GrammarQuestion;
  onAnswer: (correct: boolean) => void;
}

export function GrammarQuizCard({ question, onAnswer }: GrammarQuizCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleOptionSelect = (index: number) => {
    if (submitted) return;
    setSelectedIndex(index);
    setSubmitted(true);
  };

  const isCorrect = selectedIndex === question.correctIndex;

  const renderSentenceWithBlank = () => {
    const parts = question.sentenceWithBlank.split('____');
    if (parts.length < 2) return <p lang="en">{question.sentenceWithBlank}</p>;

    return (
      <p lang="en" className="text-lg text-ink leading-relaxed font-sans text-center">
        {parts[0]}
        <span className="ruled-blank font-medium text-green">
          {submitted ? question.options[question.correctIndex] : selectedIndex !== null ? question.options[selectedIndex] : ''}
        </span>
        {parts[1]}
      </p>
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-surface border border-rule rounded-3xl p-6 sm:p-8 shadow-xs">
      {/* Title */}
      <div className="mb-4 pb-3 border-b border-rule flex items-center justify-between">
        <span className="font-mono-utility text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider block">
          Grammar Quiz: {question.title}
        </span>
        <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-0.5 rounded-full">
          Level B2
        </span>
      </div>

      <p className="text-sm text-ink-soft font-medium mb-3">{question.prompt}</p>

      {/* Sentence Box */}
      <div className="my-5 p-5 rounded-2xl bg-paper border border-rule flex items-center justify-center min-h-[90px]">
        {renderSentenceWithBlank()}
      </div>

      {/* Options */}
      <div className="space-y-2.5 my-4">
        {question.options.map((opt, idx) => {
          let btnStyle =
            'w-full p-4 rounded-xl text-left text-sm font-semibold border border-rule bg-paper hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-ink transition-all cursor-pointer flex items-center justify-between';

          if (submitted) {
            if (idx === question.correctIndex) {
              btnStyle =
                'w-full p-4 rounded-xl text-left text-sm font-semibold border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-between';
            } else if (idx === selectedIndex) {
              btnStyle =
                'w-full p-4 rounded-xl text-left text-sm font-semibold border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-between';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionSelect(idx)}
              disabled={submitted}
              className={btnStyle}
            >
              <span lang="en">{opt}</span>
              {submitted && idx === question.correctIndex && <CheckCircle2 size={18} className="text-emerald-600" />}
              {submitted && idx === selectedIndex && idx !== question.correctIndex && (
                <XCircle size={18} className="text-rose-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation Box */}
      {submitted && (
        <div className="mt-5 p-4 rounded-2xl bg-paper border border-rule animate-fade-in space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Lightbulb size={18} />
            <span className="text-xs font-mono-utility font-semibold uppercase tracking-wider">
              Giải thích & Quy tắc ngữ pháp
            </span>
          </div>
          <p className="text-xs text-ink leading-relaxed">{question.explanationVi}</p>
          <div className="pt-2 border-t border-rule">
            <span className="text-[11px] text-ink-soft font-mono-utility block">
              Ghi nhớ: {question.ruleSummary}
            </span>
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="primary" onClick={() => onAnswer(isCorrect)}>
              Tiếp tục
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
