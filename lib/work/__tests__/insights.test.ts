import { describe, expect, it } from 'vitest';
import { mapAnalyzeWorkOutput, entryTypeForInsight } from '../insights';
import type { TaskOutput } from '@/lib/ai/tasks/contracts';

function fixture(): TaskOutput<'analyzeWork'> {
  return {
    words: [
      {
        text: 'deadline', cefr: 'B2', meaningVi: 'hạn chót', whyVi: 'Hay dùng trong công việc',
        exampleSentence: 'The deadline is Friday.', distractors: ['limit', 'target', 'goal'],
      },
    ],
    phrases: [
      {
        text: 'extend the deadline', meaningVi: 'gia hạn thời hạn', usageVi: 'Khi xin thêm thời gian',
        exampleSentence: 'Would it be possible to extend the deadline?',
        distractors: ['delay the deadline', 'push the deadline', 'move the deadline'],
      },
    ],
    grammarInsights: [
      {
        original: 'our team need more time', corrected: 'our team needs more time',
        focusWord: 'needs', rule: 'Subject-verb agreement',
        explanationVi: 'Team là danh từ số ít trong ngữ cảnh này.',
        distractors: ['need', 'needing', 'needed'],
      },
    ],
    professionalRewrites: [
      {
        original: 'I want to ask if your team can delay the deadline.',
        rewrite: 'Would it be possible to extend the deadline until Friday?',
        reasonVi: 'Lịch sự và tự nhiên hơn.', keyPhrase: 'extend the deadline',
      },
    ],
    summary: {
      inputTypeVi: 'Email công việc', estimatedLevel: 'B2', headlineVi: 'Email về deadline',
      wordCount: 1, phraseCount: 1, grammarCount: 1, rewriteCount: 1, opportunityCount: 4,
    },
  };
}

describe('mapAnalyzeWorkOutput', () => {
  it('flattens words/phrases/grammarInsights into one ordered insights list', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    expect(analysis.insights.map((i) => i.kind)).toEqual(['vocab', 'phrase', 'grammar']);
  });

  it('assigns stable `${kind}-${index}` ids', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    expect(analysis.insights.map((i) => i.id)).toEqual(['vocab-0', 'phrase-0', 'grammar-0']);
  });

  it('maps grammar fields correctly: text=focusWord, exampleSentence=corrected, originalText=original', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    const grammar = analysis.insights.find((i) => i.kind === 'grammar')!;
    expect(grammar.text).toBe('needs');
    expect(grammar.exampleSentence).toBe('our team needs more time');
    expect(grammar.originalText).toBe('our team need more time');
    expect(grammar.ruleLabel).toBe('Subject-verb agreement');
  });

  it('vocab and phrase insights have no originalText/ruleLabel', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    const vocab = analysis.insights.find((i) => i.kind === 'vocab')!;
    const phrase = analysis.insights.find((i) => i.kind === 'phrase')!;
    expect(vocab.originalText).toBeNull();
    expect(vocab.ruleLabel).toBeNull();
    expect(phrase.cefr).toBeNull();
  });

  it('insights default to saved=true (select-all); rewrites default to saved=false (own explicit save button)', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    expect(analysis.insights.every((i) => i.saved)).toBe(true);
    expect(analysis.rewrites.every((r) => !r.saved)).toBe(true);
  });

  it('maps rewrite cards with a stable id and preserves the keyPhrase', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    expect(analysis.rewrites).toHaveLength(1);
    expect(analysis.rewrites[0]!.id).toBe('rewrite-0');
    expect(analysis.rewrites[0]!.keyPhrase).toBe('extend the deadline');
  });

  it('every array may be empty and the mapper still returns valid (empty) sections', () => {
    const empty = fixture();
    empty.words = [];
    empty.phrases = [];
    empty.grammarInsights = [];
    empty.professionalRewrites = [];
    const analysis = mapAnalyzeWorkOutput(empty);
    expect(analysis.insights).toEqual([]);
    expect(analysis.rewrites).toEqual([]);
  });

  it('carries the summary through unchanged', () => {
    const analysis = mapAnalyzeWorkOutput(fixture());
    expect(analysis.summary.headlineVi).toBe('Email về deadline');
    expect(analysis.summary.opportunityCount).toBe(4);
  });
});

describe('entryTypeForInsight', () => {
  it('maps vocab -> word, phrase -> phrase, grammar -> grammar', () => {
    expect(entryTypeForInsight('vocab')).toBe('word');
    expect(entryTypeForInsight('phrase')).toBe('phrase');
    expect(entryTypeForInsight('grammar')).toBe('grammar');
  });
});
