// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../page';
import { resetDbForTests } from '@/lib/db/dexie';
import { resetRepos, getRepos } from '@/lib/repositories';

const replace = vi.fn();
// next/navigation has no router outside the App Router runtime, and BackHeader uses
// it too — this is the only mock these tests need.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));

afterEach(cleanup);
beforeEach(() => {
  resetDbForTests();
  resetRepos();
  replace.mockClear();
});

const goalField = () => screen.getByLabelText('Mục tiêu học tiếng Anh của bạn') as HTMLInputElement;

/** Waits past the initial `answered === undefined` spinner. */
async function renderOnboarding() {
  render(<OnboardingPage />);
  await screen.findByRole('heading', { name: 'Bạn học tiếng Anh để làm gì?' });
}

describe('OnboardingPage — the ask', () => {
  it('asks both questions once nothing has been answered', async () => {
    await renderOnboarding();
    expect(goalField()).toBeDefined();
    expect(screen.getByLabelText('Lĩnh vực của bạn')).toBeDefined();
  });

  it('saves the goal, the field, and the answered stamp together', async () => {
    await renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'IELTS' }));
    fireEvent.change(screen.getByLabelText('Lĩnh vực của bạn'), { target: { value: '  môi trường học  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(async () => {
      const { settings } = await getRepos().user.getProfile();
      expect(settings.learningGoal.text).toBe('IELTS 6.5');
      expect(settings.learningGoal.kind).toBe('ielts');
      expect(settings.learningGoal.setAt).not.toBeNull();
      expect(settings.contextTopic).toBe('môi trường học');
    });
  });

  it('trims a goal to the length the AI contract accepts instead of rejecting it', async () => {
    await renderOnboarding();

    fireEvent.change(goalField(), { target: { value: 'x'.repeat(200) } });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(async () => {
      const { settings } = await getRepos().user.getProfile();
      expect(settings.learningGoal.text).toHaveLength(120);
    });
  });
});

describe('OnboardingPage — skipping', () => {
  it('records that the question was asked, so it is never asked again', async () => {
    await renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua, để sau' }));

    await waitFor(async () => {
      const { settings } = await getRepos().user.getProfile();
      expect(settings.learningGoal.setAt).not.toBeNull();
      expect(settings.learningGoal.text).toBe('');
    });
  });

  it('leaves the work field alone rather than blanking it', async () => {
    await getRepos().user.updateSettings({ contextTopic: 'marketing' });
    await renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua, để sau' }));

    await waitFor(async () => {
      const { settings } = await getRepos().user.getProfile();
      expect(settings.contextTopic).toBe('marketing');
    });
  });
});

describe('OnboardingPage — where it sends you next', () => {
  // The regression this guards: answering flips `answered` to true, which fired the
  // forward-returning-learners effect and overwrote /placement with /today — sending
  // a brand-new learner to an empty home screen instead of the test that fills their
  // notebook. Caught only by walking the real app; now pinned here.
  it('sends a learner with an empty notebook to the placement test', async () => {
    await renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/placement'));
    expect(replace).not.toHaveBeenCalledWith('/today');
  });

  it('sends a learner who already has words home', async () => {
    await getRepos().words.add({ word: 'leverage', source: { kind: 'manual', label: '', at: 1 } });
    await renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'));
  });

  it('forwards a learner who already answered, without flashing the form', async () => {
    await getRepos().user.updateSettings({
      learningGoal: { kind: 'ielts', text: 'IELTS 6.5', setAt: 1_700_000_000_000 },
    });

    render(<OnboardingPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'));
    expect(screen.queryByRole('heading', { name: 'Bạn học tiếng Anh để làm gì?' })).toBeNull();
  });
});
