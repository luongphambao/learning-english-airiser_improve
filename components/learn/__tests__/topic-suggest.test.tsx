// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopicSuggest } from '../topic-suggest';
import { useTopicStore, type TopicCandidate } from '@/stores/topic-store';
import { resetDbForTests } from '@/lib/db/dexie';
import { resetRepos } from '@/lib/repositories';
import { ERROR_KEY, apiErrorKey } from '@/lib/i18n/api-error';

// Drives the component against the real store with its async edges (`suggest`)
// stubbed, so these tests cover what the store tests cannot: which screen each
// status renders, and that the error line resolves a key rather than printing it.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  resetDbForTests();
  resetRepos();
  useTopicStore.getState().reset();
});

const CANDIDATES: TopicCandidate[] = [
  { word: 'emission', cefr: 'B2', meaningVi: 'lượng khí thải', exampleSentence: 'It cut its emission.', distractors: ['a', 'b', 'c'] },
  { word: 'renewable', cefr: 'B2', meaningVi: 'có thể tái tạo', exampleSentence: 'A renewable source.', distractors: ['a', 'b', 'c'] },
];

// The store's own transitions are covered in stores/__tests__/topic-store.test.ts;
// here the state is set directly so each screen can be rendered in isolation.
const setState = useTopicStore.setState;

describe('TopicSuggest — idle', () => {
  it('offers example topics and keeps the CTA disabled until something is typed', () => {
    render(<TopicSuggest />);
    const cta = screen.getByRole('button', { name: /Tìm từ cho chủ đề này/ });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Môi trường' })).toBeDefined();
  });

  it('an example chip fills the input and enables the CTA', () => {
    render(<TopicSuggest />);
    fireEvent.click(screen.getByRole('button', { name: 'Môi trường' }));
    expect((screen.getByLabelText('Chủ đề bạn muốn học') as HTMLInputElement).value).toBe('Môi trường');
    expect((screen.getByRole('button', { name: /Tìm từ cho chủ đề này/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('passes the learner level, field and goal down to the store, not just the topic', async () => {
    const suggest = vi.fn().mockResolvedValue(undefined);
    setState({ suggest });
    render(<TopicSuggest />);

    fireEvent.change(screen.getByLabelText('Chủ đề bạn muốn học'), { target: { value: '  môi trường  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Tìm từ cho chủ đề này/ }));

    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
    // Trimmed, and carrying the whole profile — a topic alone would lose the level
    // and goal that make the suggestions fit this learner.
    expect(suggest).toHaveBeenCalledWith({
      topic: 'môi trường',
      level: 'B2',
      contextTopic: 'software engineering',
      goal: '',
    });
  });

  it('does not call the store for a whitespace-only topic', async () => {
    const suggest = vi.fn().mockResolvedValue(undefined);
    setState({ suggest });
    render(<TopicSuggest />);

    fireEvent.change(screen.getByLabelText('Chủ đề bạn muốn học'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByLabelText('Chủ đề bạn muốn học'), { key: 'Enter' });

    expect(suggest).not.toHaveBeenCalled();
  });
});

describe('TopicSuggest — result', () => {
  it('renders one triage card per candidate, with the example sentence as the note', () => {
    setState({ status: 'ready', topic: 'môi trường', candidates: CANDIDATES });
    render(<TopicSuggest />);

    expect(screen.getByText('emission')).toBeDefined();
    expect(screen.getByText('renewable')).toBeDefined();
    expect(screen.getByText('It cut its emission.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Lưu vào sổ tay/ })).toBeDefined();
  });

  it('hands the triage choices to the store, defaulting each card by its CEFR band', async () => {
    const saveTriage = vi.fn().mockResolvedValue({ added: 1, skipped: 1 });
    setState({ status: 'ready', topic: 'môi trường', candidates: CANDIDATES, saveTriage });
    render(<TopicSuggest />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Đã biết rõ' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Lưu vào sổ tay/ }));

    await waitFor(() => expect(saveTriage).toHaveBeenCalledTimes(1));
    // B2 defaults to 'partial' (defaultTriageForCefr), and the card just clicked
    // overrides to 'known' — which is the branch that sends it to `skipped`.
    expect(saveTriage.mock.calls[0][0]).toEqual({ emission: 'known', renewable: 'partial' });
  });
});

describe('TopicSuggest — success', () => {
  it('offers practice straight away once words were saved', () => {
    setState({ status: 'done', topic: 'môi trường', savedResult: { added: 2, skipped: 1 } });
    render(<TopicSuggest />);

    expect(screen.getByText('Đã thêm 2 từ')).toBeDefined();
    expect(screen.getByText(/1 từ bạn đã biết rõ được bỏ qua/)).toBeDefined();
    expect(screen.getByRole('link', { name: /Luyện tập ngay/ }).getAttribute('href')).toBe('/practice');
  });

  it('omits the skipped note when nothing was skipped', () => {
    setState({ status: 'done', topic: 'môi trường', savedResult: { added: 3, skipped: 0 } });
    render(<TopicSuggest />);

    expect(screen.getByText('Các từ này đã sẵn sàng để luyện tập.')).toBeDefined();
  });
});

describe('TopicSuggest — error', () => {
  it('resolves a server problem code into a real sentence, never the raw key', () => {
    setState({ status: 'error', errorKey: apiErrorKey('rate_limited') });
    render(<TopicSuggest />);

    expect(screen.getByText('Bạn thao tác hơi nhanh. Đợi một chút rồi thử lại.')).toBeDefined();
    expect(screen.queryByText(/@apiError/)).toBeNull();
  });

  it('distinguishes "nothing found" from "the call failed"', () => {
    setState({ status: 'error', errorKey: ERROR_KEY.topicEmpty });
    render(<TopicSuggest />);

    expect(screen.getByText(/Không tìm được từ nào cho chủ đề này/)).toBeDefined();
  });

  it('falls back to the screen message for an unrecognised code', () => {
    setState({ status: 'error', errorKey: apiErrorKey('a_code_from_the_future') });
    render(<TopicSuggest />);

    expect(screen.getByText('Không tạo được danh sách từ. Thử lại sau.')).toBeDefined();
  });

  it('lets the learner start over instead of dead-ending', () => {
    setState({ status: 'error', errorKey: ERROR_KEY.topicFailed });
    render(<TopicSuggest />);

    fireEvent.click(screen.getByRole('button', { name: /Thử chủ đề khác/ }));
    expect(useTopicStore.getState().status).toBe('idle');
  });
});
