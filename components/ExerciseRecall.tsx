import React, { useState } from 'react';
import { Word } from '@/types';
import { Button } from './Button';
import { Dragon } from './mascot/Dragon';
import { useT } from '@/hooks/use-i18n';

interface ExerciseRecallProps {
  word: Word;
  onAnswer: (correct: boolean) => void;
}

export function ExerciseRecall({ word, onAnswer }: ExerciseRecallProps) {
  const { t } = useT();
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
    <div className="w-full max-w-lg mx-auto bg-surface border border-rule rounded-card p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono-utility text-xs text-green font-semibold uppercase tracking-wider">
          {t('exercise.recall.title')}
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
          placeholder={t('exercise.recall.placeholder')}
          disabled={submitted}
          autoFocus
          className="w-full p-4 rounded-btn bg-paper border border-rule text-ink text-center text-lg font-semibold focus:outline-none focus:border-green transition-all mb-4"
        />

        {!submitted ? (
          <Button variant="primary" type="submit" disabled={!typedInput.trim()} className="w-full">
            {t('exercise.check')}
          </Button>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div
              aria-live="polite"
              className={`p-4 rounded-btn text-center font-semibold border flex items-center justify-center gap-3 ${
                isCorrect ? 'bg-green-wash text-green border-green/30' : 'bg-wrong/10 text-wrong border-wrong/30'
              }`}
            >
              <Dragon mood={isCorrect ? 'happy' : 'sad'} size={32} />
              <span>
                {isCorrect ? t('exercise.recall.correctFeedback') : <>{t('exercise.recall.answerIsLabel')} <span lang="en">{word.word}</span></>}
              </span>
            </div>

            <Button variant="primary" onClick={() => onAnswer(isCorrect || false)} className="w-full">
              {t('exercise.continueCta')}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
