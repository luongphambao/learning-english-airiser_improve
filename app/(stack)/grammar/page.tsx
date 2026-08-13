'use client';

import React, { useState } from 'react';
import { GRAMMAR_TOPICS } from '@/lib/grammarData';
import { GrammarTopic } from '@/types';
import { GrammarQuizCard } from '@/components/GrammarQuizCard';
import { Button } from '@/components/Button';
import { BackHeader } from '@/components/layout/back-header';
import { getRepos } from '@/lib/repositories';
import { useLastGrammarAttempts } from '@/hooks/use-grammar';
import { Trophy, ArrowLeft } from 'lucide-react';

// Moved off the tab bar into (stack) (docs/decision.md ADR-013 — de-emphasized per
// strategy doc §33, not removed: it has a real practice history behind it,
// grammarAttempts/ADR-011, so it stays a working feature reached from Practice).
// Ported from screens/GrammarScreen.tsx (Phase 2 — routing only, logic unchanged).
export default function GrammarPage() {
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const lastAttempts = useLastGrammarAttempts();

  const handleStartTopic = (topic: GrammarTopic) => {
    setSelectedTopic(topic);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizFinished(false);
  };

  const handleAnswerQuestion = (correct: boolean) => {
    const finalScore = correct ? score + 1 : score;
    if (correct) {
      setScore(finalScore);
    }

    if (selectedTopic && currentQuestionIndex + 1 < selectedTopic.questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setQuizFinished(true);
      if (selectedTopic) {
        void getRepos().grammar.recordAttempt(selectedTopic.id, finalScore, selectedTopic.questions.length, Date.now());
      }
    }
  };

  const handleReset = () => {
    setSelectedTopic(null);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizFinished(false);
  };

  return (
    <>
      <BackHeader title="Ngữ pháp" />
      <div className="pt-6">
        {!selectedTopic && (
          <div className="space-y-6">
            <div className="pb-3 border-b border-rule">
              <h2 className="font-serif-display text-3xl text-ink mb-1">
                Chủ đề Ngữ pháp công sở
              </h2>
              <p className="text-xs text-ink-soft">
                Luyện tập các điểm ngữ pháp then chốt để viết email và giao tiếp tự tin.
              </p>
            </div>

            <div className="space-y-4">
              {GRAMMAR_TOPICS.map((topic) => {
                const last = lastAttempts[topic.id];
                return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleStartTopic(topic)}
                  className="w-full text-left p-6 rounded-card bg-surface border border-rule hover:border-green transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono-utility text-xs font-semibold text-green bg-green-wash px-3 py-1 rounded-full border border-green/20">
                      Level {topic.level}
                    </span>
                    <span className="text-xs text-ink-soft font-mono-utility font-medium">
                      {topic.questions.length} câu hỏi{last && ` · Lần trước: ${last.score}/${last.total}`}
                    </span>
                  </div>
                  <h3 className="font-serif-display text-2xl text-ink group-hover:text-green transition-colors mb-1">
                    {topic.titleVi}
                  </h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    {topic.descriptionVi}
                  </p>
                </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedTopic && quizFinished && (() => {
          const total = selectedTopic.questions.length;
          const percentage = Math.round((score / total) * 100);
          return (
            <div className="py-10 px-6 text-center bg-surface border border-rule rounded-card space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-wash text-green flex items-center justify-center mx-auto">
                <Trophy size={32} />
              </div>

              <div>
                <h3 className="font-serif-display text-3xl text-ink mb-1">
                  Hoàn thành bài tập!
                </h3>
                <p className="text-sm text-ink-soft">
                  Chủ đề: {selectedTopic.titleVi}
                </p>
              </div>

              <div className="p-4 rounded-btn bg-paper border border-rule inline-block min-w-[200px]">
                <span className="block font-mono-utility text-3xl font-semibold text-green mb-1">
                  {score} / {total}
                </span>
                <span className="text-xs text-ink-soft font-mono-utility">
                  Tỉ lệ chính xác: {percentage}%
                </span>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button variant="primary" onClick={() => handleStartTopic(selectedTopic)}>
                  Làm lại chủ đề này
                </Button>
                <Button variant="quiet" onClick={handleReset}>
                  Quay lại danh sách chủ đề
                </Button>
              </div>
            </div>
          );
        })()}

        {selectedTopic && !quizFinished && (() => {
          const currentQ = selectedTopic.questions[currentQuestionIndex];
          if (!currentQ) return null;
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-rule">
                <button
                  onClick={handleReset}
                  className="text-xs text-ink-soft hover:text-ink flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  Danh sách chủ đề
                </button>
                <span className="font-mono-utility text-xs text-ink-soft">
                  Câu {currentQuestionIndex + 1} / {selectedTopic.questions.length}
                </span>
              </div>

              <GrammarQuizCard question={currentQ} onAnswer={handleAnswerQuestion} />
            </div>
          );
        })()}
      </div>
    </>
  );
}
