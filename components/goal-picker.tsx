'use client';

import { GOAL_MAX_LENGTH, type GoalKind, type LearningGoal } from '@/lib/domain';
import { useT } from '@/hooks/use-i18n';

// docs/decision.md ADR-028. Controlled and storage-free — onboarding
// (app/(stack)/onboarding/page.tsx) writes it once with a fresh `setAt`, Settings
// writes it on every edit while preserving the existing `setAt`. Keeping the write
// in the callers is what lets one component serve both without a mode flag.

/** Chips are shortcuts that prefill the text box, not a closed set of answers: the
 * text stays editable afterwards, and typing something unlisted is a first-class
 * answer (`kind: 'custom'`). Each `exampleKey` resolves to a concrete starting
 * point ("IELTS 6.5") rather than a category name, because a goal the AI can act on
 * needs the target, not the exam. */
const CHIPS: { kind: Exclude<GoalKind, 'custom'>; labelKey: string; exampleKey: string }[] = [
  { kind: 'ielts', labelKey: 'goalPicker.chips.ielts', exampleKey: 'goalPicker.examples.ielts' },
  { kind: 'toeic', labelKey: 'goalPicker.chips.toeic', exampleKey: 'goalPicker.examples.toeic' },
  { kind: 'communication', labelKey: 'goalPicker.chips.communication', exampleKey: 'goalPicker.examples.communication' },
  { kind: 'work', labelKey: 'goalPicker.chips.work', exampleKey: 'goalPicker.examples.work' },
  { kind: 'academic', labelKey: 'goalPicker.chips.academic', exampleKey: 'goalPicker.examples.academic' },
];

interface GoalPickerProps {
  value: Pick<LearningGoal, 'kind' | 'text'>;
  onChange: (next: Pick<LearningGoal, 'kind' | 'text'>) => void;
}

export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const { t } = useT();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.kind}
            type="button"
            aria-pressed={value.kind === chip.kind}
            onClick={() => onChange({ kind: chip.kind, text: t(chip.exampleKey) })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              value.kind === chip.kind
                ? 'border-green bg-green-wash text-green'
                : 'border-rule bg-paper text-ink-soft hover:text-ink'
            }`}
          >
            {t(chip.labelKey)}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value.text}
        maxLength={GOAL_MAX_LENGTH}
        // Typing over a chip's example makes the answer the user's own, so the chip
        // stops being highlighted unless the text still matches what it filled in.
        onChange={(e) => {
          const text = e.target.value;
          const matched = CHIPS.find((chip) => t(chip.exampleKey) === text);
          onChange({ kind: matched?.kind ?? 'custom', text });
        }}
        placeholder={t('goalPicker.placeholder')}
        aria-label={t('goalPicker.inputAria')}
        className="w-full px-3.5 py-2.5 rounded-card border border-rule bg-surface text-sm text-ink focus:outline-none focus:border-green"
      />
    </div>
  );
}
