import React, { useState, useEffect, useRef } from 'react';
import { Word } from '@/types';
import { Volume2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Dragon } from './mascot/Dragon';
import { optionsForWord } from '@/lib/text/shuffle';
import { fetchSpeech } from '@/lib/api/ai-client';
import { useT } from '@/hooks/use-i18n';

interface ExerciseListenProps {
  word: Word;
  onAnswer: (correct: boolean) => void;
}

export function ExerciseListen({ word, onAnswer }: ExerciseListenProps) {
  const { t } = useT();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // Deterministic shuffle (server/client hydration parity) — shared with
  // ExerciseFillBlank.tsx via lib/text/shuffle.ts instead of a duplicated inline
  // copy (docs/progress/00-baseline-audit.md #8).
  const options = React.useMemo(
    () => optionsForWord(word.id, word.word, word.distractors?.length ? word.distractors : ['option1', 'option2', 'option3']),
    [word.id, word.word, word.distractors],
  );

  const fallbackBrowserSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word.exampleSentence || word.word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const playUrl = (url: string) => {
    try {
      const audio = new Audio(url);
      audio.play().catch(() => fallbackBrowserSpeech());
    } catch {
      fallbackBrowserSpeech();
    }
  };

  // Server now returns a real, playable audio/wav Blob (lib/audio/pcm-to-wav.ts) —
  // fixed the bug where Gemini's raw PCM was mislabelled as WAV and always failed
  // to decode (docs/progress/00-baseline-audit.md #4). `fetchSpeech` returns null
  // for "no TTS provider configured" or any upstream failure — both are a normal
  // "fall back to the browser voice" state here, not an error to surface.
  const fetchAndPlay = async () => {
    setIsPlaying(true);
    try {
      const blob = await fetchSpeech(word.exampleSentence || word.word);
      if (blob) {
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setAudioUrl(url);
        playUrl(url);
      } else {
        fallbackBrowserSpeech();
      }
    } catch {
      fallbackBrowserSpeech();
    } finally {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsPlaying(true);
      try {
        const blob = await fetchSpeech(word.exampleSentence || word.word);
        if (!mounted) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setAudioUrl(url);
          playUrl(url);
        } else {
          fallbackBrowserSpeech();
        }
      } catch {
        if (mounted) fallbackBrowserSpeech();
      } finally {
        if (mounted) setIsPlaying(false);
      }
    })();
    return () => {
      mounted = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id, word.exampleSentence, word.word]);

  const handleSelect = (option: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    const correct = option.toLowerCase() === word.word.toLowerCase();
    setIsCorrect(correct);
    setShowAnswer(true);

    if (correct) {
      setTimeout(() => {
        onAnswer(true);
      }, 700);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-surface border border-rule rounded-card p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono-utility text-xs text-green font-semibold uppercase tracking-wider">
          {t('exercise.listen.title')}
        </span>
        <span className="text-xs italic text-ink-soft">{word.partOfSpeech}</span>
      </div>

      {/* Audio Button */}
      <div className="my-8 flex flex-col items-center justify-center text-center">
        <button
          onClick={() => (audioUrl ? playUrl(audioUrl) : fetchAndPlay())}
          className="w-20 h-20 rounded-card bg-green-wash text-green flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer mb-3"
          aria-label={t('exercise.listen.playAudioAria')}
        >
          {isPlaying ? <RefreshCw className="animate-spin" size={32} /> : <Volume2 size={36} />}
        </button>
        <span className="text-xs text-ink-soft font-mono-utility">
          {t('exercise.listen.tapToListen')}
        </span>
      </div>

      {/* Reveal sentence after answering */}
      {showAnswer && (
        <div aria-live="polite" className="mb-6 p-4 rounded-card bg-paper border border-rule text-center animate-fade-in">
          <div className="flex justify-center mb-1">
            <Dragon mood={isCorrect ? 'happy' : 'sad'} size={32} />
          </div>
          <p lang="en" className="font-serif-display text-2xl text-ink mb-1">{word.word}</p>
          <p lang="en" className="text-sm text-ink-soft italic mb-2">&ldquo;{word.exampleSentence}&rdquo;</p>
          <p className="text-sm font-semibold text-green">{word.meaningVi}</p>
        </div>
      )}

      {/* Options Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {options.map((option, idx) => {
          let btnClass =
            'p-3.5 rounded-btn text-base font-semibold border border-rule text-ink bg-paper hover:border-green hover:bg-green-wash transition-all cursor-pointer text-center';

          if (selectedOption === option) {
            if (isCorrect) {
              btnClass =
                'p-3.5 rounded-btn text-base font-semibold border-2 border-green text-paper bg-green text-center';
            } else {
              btnClass =
                'p-3.5 rounded-btn text-base font-semibold border-2 border-wrong text-paper bg-wrong text-center';
            }
          }

          return (
            <button
              key={idx}
              lang="en"
              onClick={() => handleSelect(option)}
              disabled={selectedOption !== null}
              className={btnClass}
            >
              {option}
            </button>
          );
        })}
      </div>

      {showAnswer && !isCorrect && (
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={() => onAnswer(false)}>
            {t('exercise.continueCta')}
          </Button>
        </div>
      )}
    </div>
  );
}
