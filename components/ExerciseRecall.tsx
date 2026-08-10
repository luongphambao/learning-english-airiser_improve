import React, { useState } from 'react';
import { Word } from '@/types';
import { Button } from './Button';

interface ExerciseRecallProps {
  word: Word;
  onAnswer: (correct: boolean) => void;
}

export function ExerciseRecall({ word, onAnswer }: ExerciseRecallProps) {
  const [typedInput, setTypedInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedInput.trim() || submitted) return;

    const target = word.word.trim().toLowerCase();
    const typed = typedInput.trim().toLowerCase();

    const correct = target === typed;
    setIsCorrect(correct);
    setSubmitted(true);
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-surface border border-rule rounded-3xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono-utility text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
          Bài tập: Nhớ từ từ nghĩa tiếng Việt
        </span>
        <span className="text-xs italic text-ink-soft">{word.partOfSpeech}</span>
      </div>

      <div className="my-6 text-center">
        <p lang="en" className="text-xs font-mono-utility text-ink-soft mb-2">{word.ipa}</p>
        <h3 className="text-2xl font-bold text-ink mb-1">{word.meaningVi}</h3>
      </div>

      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          lang="en"
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Nhập từ tiếng Anh..."
          disabled={submitted}
          autoFocus
          className="w-full p-4 rounded-xl bg-paper border border-rule text-ink text-center text-lg font-semibold focus:outline-none focus:border-indigo-500 transition-all mb-4"
        />

        {!submitted ? (
          <Button variant="primary" type="submit" disabled={!typedInput.trim()} className="w-full">
            Kiểm tra
          </Button>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div
              aria-live="polite"
              className={`p-4 rounded-xl text-center font-semibold ${
                isCorrect
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
              }`}
            >
              {isCorrect ? 'Chính xác!' : <>Từ đúng là: <span lang="en">{word.word}</span></>}
            </div>

            <Button variant="primary" onClick={() => onAnswer(isCorrect || false)} className="w-full">
              Tiếp tục
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
