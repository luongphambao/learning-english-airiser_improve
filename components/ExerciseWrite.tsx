import React, { useState } from 'react';
import { Word } from '@/types';
import { Button } from './Button';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { callTask } from '@/lib/api/ai-client';
import { ApiError } from '@/lib/api/client';

interface ExerciseWriteProps {
  word: Word;
  onAnswer: (correct: boolean) => void;
  contextTopic?: string;
}

export function ExerciseWrite({ word, onAnswer, contextTopic = 'software engineering' }: ExerciseWriteProps) {
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
      const data = await callTask('gradeSentence', { word: word.word, sentence: userSentence, contextTopic });
      setResult(data);
    } catch (err) {
      // Previously this branch fabricated a passing grade and an "AI-written"
      // sentence nobody wrote (audit #43) — an honest error is shown instead.
      setError(err instanceof ApiError ? err.messageVi : 'Không chấm được câu. Kiểm tra kết nối rồi thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const hintCollocation =
    word.collocations && word.collocations.length > 0
      ? word.collocations[0].phrase
      : null;

  return (
    <div className="w-full max-w-lg mx-auto bg-surface border border-rule rounded-3xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono-utility text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
          Bài tập: Tự đặt câu
        </span>
        <span className="text-xs italic text-ink-soft">{word.partOfSpeech}</span>
      </div>

      {/* Target Word Overview */}
      <div className="mb-5 text-center">
        <h3 lang="en" className="font-serif-display text-4xl sm:text-5xl text-ink mb-1">{word.word}</h3>
        <p lang="en" className="font-mono-utility text-xs text-ink-soft mb-2">{word.ipa}</p>
        <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{word.meaningVi}</p>
      </div>

      {/* Input Textarea */}
      <div className="mb-4">
        <label className="block text-xs font-mono-utility text-ink-soft mb-2">
          Đặt 1 câu tiếng Anh có chứa từ &ldquo;{word.word}&rdquo;:
        </label>
        <textarea
          lang="en"
          value={userSentence}
          onChange={(e) => setUserSentence(e.target.value)}
          placeholder={`Ví dụ: We need to ${word.word} the process...`}
          disabled={loading || result !== null}
          rows={3}
          className="w-full p-4 rounded-xl bg-paper border border-rule text-ink text-sm focus:outline-none focus:border-indigo-500 resize-none transition-all"
        />
        {hintCollocation && (
          <p className="mt-1.5 text-xs text-ink-soft italic">
            Gợi ý cụm từ: <span className="font-medium text-ink">{hintCollocation}</span>
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
                Đang chấm câu...
              </>
            ) : (
              'Kiểm tra câu'
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
            {result.isCorrect ? (
              <CheckCircle2 className="text-green" size={20} />
            ) : (
              <AlertCircle className="text-wrong" size={20} />
            )}
            <span
              className={`font-medium text-sm ${
                result.isCorrect ? 'text-green' : 'text-wrong'
              }`}
            >
              {result.isCorrect ? 'Đặt câu đúng!' : 'Cần điều chỉnh thêm'}
            </span>
          </div>

          <p className="text-sm text-ink mb-3 leading-relaxed">{result.feedbackVi}</p>

          <div className="p-3 rounded-[12px] bg-paper border border-rule mb-5">
            <span className="block text-xs text-ink-soft italic mb-1">
              Cách nói tự nhiên hơn từ AI:
            </span>
            <p lang="en" className="text-sm text-ink font-medium">&ldquo;{result.improvedSentence}&rdquo;</p>
          </div>

          <Button variant="primary" onClick={() => onAnswer(result.isCorrect)} className="w-full">
            Tiếp tục
          </Button>
        </div>
      )}
    </div>
  );
}
