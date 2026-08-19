import React, { useState } from 'react';
import { Word } from '@/types';
import { Button } from './Button';
import { Loader2 } from 'lucide-react';
import { Mascot } from './mascot/Mascot';
import { callTask } from '@/lib/api/ai-client';
import { ApiError } from '@/lib/api/client';
import { useT } from '@/hooks/use-i18n';

interface ExerciseWriteProps {
  word: Word;
  onAnswer: (correct: boolean) => void;
  contextTopic?: string;
  goal?: string;
}

export function ExerciseWrite({ word, onAnswer, contextTopic = 'software engineering', goal }: ExerciseWriteProps) {
  const { t } = useT();
  const [userSentence, setUserSentence] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    feedbackVi: string;
    improvedSentence: string;
  } | null>(null);

  const handleGrade = async () => {
    if (!userSentence.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callTask('gradeSentence', { word: word.word, sentence: userSentence, contextTopic, goal });
      setResult(data);
    } catch (err) {
      // Previously this branch fabricated a passing grade and an "AI-written"
      // sentence nobody wrote (audit #43) — an honest error is shown instead.
      setError(err instanceof ApiError ? err.messageVi : t('exercise.write.gradeError'));
    } finally {
      setLoading(false);
    }
  };

  const hintCollocation =
    word.collocations && word.collocations.length > 0
      ? word.collocations[0].phrase
      : null;

  return (
    <div className="w-full max-w-lg mx-auto bg-surface border border-rule rounded-card p-6 sm:p-8">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono-utility text-xs text-green font-semibold uppercase tracking-wider">
          {t('exercise.write.title')}
        </span>
        <span className="text-xs italic text-ink-soft">{word.partOfSpeech}</span>
      </div>

      {/* Target Word Overview */}
      <div className="mb-5 text-center">
        <h3 lang="en" className="font-serif-display text-4xl sm:text-5xl text-ink mb-1">{word.word}</h3>
        <p lang="en" className="font-mono-utility text-xs text-ink-soft mb-2">{word.ipa}</p>
        <p className="text-base font-semibold text-green">{word.meaningVi}</p>
      </div>

      {/* Input Textarea */}
      <div className="mb-4">
        <label className="block text-xs font-mono-utility text-ink-soft mb-2">
          {t('exercise.write.prompt', { word: word.word })}
        </label>
        <textarea
          lang="en"
          value={userSentence}
          onChange={(e) => setUserSentence(e.target.value)}
          placeholder={t('exercise.write.placeholder', { word: word.word })}
          disabled={loading || result !== null}
          rows={3}
          className="w-full p-4 rounded-btn bg-paper border border-rule text-ink text-sm focus:outline-none focus:border-green resize-none transition-all"
        />
        {hintCollocation && (
          <p className="mt-1.5 text-xs text-ink-soft italic">
            {t('exercise.write.hintLabel')} <span className="font-medium text-ink">{hintCollocation}</span>
          </p>
        )}
      </div>

      {/* Grade Action Button */}
      {!result && (
        <>
          <Button
            variant="primary"
            onClick={handleGrade}
            disabled={loading || !userSentence.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {t('exercise.write.grading')}
              </>
            ) : (
              t('exercise.write.checkButton')
            )}
          </Button>
          {error && (
            <p role="alert" className="mt-2 text-xs text-wrong">
              {error}
            </p>
          )}
        </>
      )}

      {/* Feedback Section */}
      {result && (
        <div aria-live="polite" className="mt-5 pt-4 border-t border-rule animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Mascot mood={result.isCorrect ? 'happy' : 'sad'} size={28} />
            <span
              className={`font-medium text-sm ${
                result.isCorrect ? 'text-green' : 'text-wrong'
              }`}
            >
              {result.isCorrect ? t('exercise.write.correctFeedback') : t('exercise.write.needsAdjustment')}
            </span>
          </div>

          <p className="text-sm text-ink mb-3 leading-relaxed">{result.feedbackVi}</p>

          <div className="p-3 rounded-[12px] bg-paper border border-rule mb-5">
            <span className="block text-xs text-ink-soft italic mb-1">
              {t('exercise.write.aiSuggestionLabel')}
            </span>
            <p lang="en" className="text-sm text-ink font-medium">&ldquo;{result.improvedSentence}&rdquo;</p>
          </div>

          <Button variant="primary" onClick={() => onAnswer(result.isCorrect)} className="w-full">
            {t('exercise.continueCta')}
          </Button>
        </div>
      )}
    </div>
  );
}
