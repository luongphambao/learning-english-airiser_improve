import React, { useState } from 'react';
import { Word } from '@/types';
import { WordCard } from './WordCard';
import { Button } from './Button';
import { optionsForWord } from '@/lib/text/shuffle';
import { splitForBlank } from '@/lib/text/blank';
import { useT } from '@/hooks/use-i18n';

interface ExerciseFillBlankProps {
  word: Word;
  onAnswer: (correct: boolean) => void;
}

export function ExerciseFillBlank({ word, onAnswer }: ExerciseFillBlankProps) {
  const { t } = useT();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Deterministic shuffle (server/client hydration parity) — shared with
  // ExerciseListen.tsx via lib/text/shuffle.ts instead of a duplicated inline copy.
  const options = React.useMemo(
    () => optionsForWord(word.id, word.word, word.distractors?.length ? word.distractors : ['option1', 'option2', 'option3']),
    [word.id, word.word, word.distractors],
  );

  const handleSelect = (option: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    const correct = option.toLowerCase() === word.word.toLowerCase();
    setIsCorrect(correct);

    if (correct) {
      setTimeout(() => {
        onAnswer(true);
      }, 600);
    } else {
      setTimeout(() => {
        setIsFlipped(true);
      }, 300);
    }
  };

  // lib/text/blank.ts escapes the word before building the regex — the old inline
  // `new RegExp('(' + word.word + ')', 'gi')` crashed on any word containing a
  // regex metacharacter, including the app's own seed word "trade-off".
  const blank = word.exampleSentence ? splitForBlank(word.exampleSentence, word.word) : null;

  return (
    <div className="w-full max-w-md mx-auto perspective-1000">
      <div
        className={`transition-all duration-500 transform-style-3d relative ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front side */}
        <div className="backface-hidden bg-surface border border-rule rounded-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono-utility text-xs text-green font-semibold uppercase tracking-wider">
              {t('exercise.fillBlank.title')}
            </span>
            <span className="text-xs italic text-ink-soft">{word.partOfSpeech}</span>
          </div>

          <div className="my-6 text-xl text-ink leading-relaxed font-sans min-h-[80px] flex items-center justify-center text-center">
            <p lang="en">
              {blank ? (
                <>
                  {blank.before}
                  <span className="ruled-blank font-medium text-green">
                    {selectedOption && isCorrect ? word.word : ''}
                  </span>
                  {blank.after}
                </>
              ) : (
                <>Example sentence containing {word.word}</>
              )}
            </p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-3 mt-6">
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
        </div>

        {/* Back side (Flipped on wrong answer) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-surface border border-wrong/30 rounded-card p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono-utility text-wrong">{t('exercise.fillBlank.incorrectLabel')}</span>
              <span className="text-xs font-mono-utility text-ink-soft">{t('exercise.fillBlank.answerLabel', { word: word.word })}</span>
            </div>
            <WordCard word={word} showDetails={true} />
          </div>

          <div className="mt-4 pt-3 border-t border-rule flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                onAnswer(false);
              }}
            >
              {t('exercise.continueCta')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
