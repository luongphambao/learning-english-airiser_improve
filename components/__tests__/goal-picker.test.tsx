// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { GoalPicker } from '../goal-picker';
import { resetDbForTests } from '@/lib/db/dexie';
import { resetRepos } from '@/lib/repositories';
import type { GoalKind } from '@/lib/domain';

// The repo's first component render tests (docs/progress/board.md Phase 12). Only
// `// @vitest-environment jsdom` is needed beyond the existing setup: fake-indexeddb
// is already global (vitest.setup.ts), which is what lets useT() -> useProfile() ->
// useLiveQuery reach Dexie. Cleanup is explicit because the config does not set
// `globals: true`, so testing-library's automatic afterEach never registers.
afterEach(cleanup);
beforeEach(() => {
  resetDbForTests();
  resetRepos();
});

/** Renders the controlled component with local state, mirroring how both callers
 * (onboarding and Settings) drive it, and reports every change to the spy. */
function renderPicker(initial: { kind: GoalKind; text: string } = { kind: 'custom', text: '' }) {
  const onChange = vi.fn();
  let value = initial;
  const { rerender } = render(<GoalPicker value={value} onChange={onChange} />);
  const apply = () => {
    value = onChange.mock.calls.at(-1)![0];
    rerender(<GoalPicker value={value} onChange={onChange} />);
    return value;
  };
  return { onChange, apply };
}

describe('GoalPicker', () => {
  it('renders every chip plus the free-text box', () => {
    renderPicker();
    for (const label of ['IELTS', 'TOEIC', 'Giao tiếp', 'Công việc', 'Học thuật']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
    expect(screen.getByLabelText('Mục tiêu học tiếng Anh của bạn')).toBeDefined();
  });

  it('a chip prefills the text box with a concrete target, not the category name', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'IELTS' }));
    // "IELTS 6.5", not "IELTS" — a goal the AI can act on needs the target.
    expect(onChange).toHaveBeenCalledWith({ kind: 'ielts', text: 'IELTS 6.5' });
  });

  it('marks the matching chip pressed, and only that one', () => {
    const { apply } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'TOEIC' }));
    apply();
    expect(screen.getByRole('button', { name: 'TOEIC' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'IELTS' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('typing over a chip example makes the answer custom again', () => {
    const { onChange, apply } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'IELTS' }));
    apply();

    fireEvent.change(screen.getByLabelText('Mục tiêu học tiếng Anh của bạn'), {
      target: { value: 'IELTS 7.0 for a work visa' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'custom', text: 'IELTS 7.0 for a work visa' });
  });

  it('re-highlights the chip when the text is typed back to its example', () => {
    const { onChange } = renderPicker({ kind: 'custom', text: 'IELTS 6.' });
    fireEvent.change(screen.getByLabelText('Mục tiêu học tiếng Anh của bạn'), {
      target: { value: 'IELTS 6.5' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'ielts', text: 'IELTS 6.5' });
  });

  it('caps the input at the length the AI contract accepts', () => {
    renderPicker();
    // GoalField in lib/ai/tasks/contracts.ts uses .max(120), which REJECTS rather
    // than truncates — a longer value would make every AI call fail client-side.
    expect(screen.getByLabelText('Mục tiêu học tiếng Anh của bạn').getAttribute('maxLength')).toBe('120');
  });
});
