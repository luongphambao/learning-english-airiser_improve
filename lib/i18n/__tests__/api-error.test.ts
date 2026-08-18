import { describe, expect, it } from 'vitest';
import { apiErrorKey, resolveErrorMessage, ERROR_KEY } from '../api-error';
import { translate } from '../translate';
import type { Locale } from '@/lib/domain';

const t = (locale: Locale) => (key: string, vars?: Record<string, string | number>) =>
  translate(locale, key, vars);

describe('apiErrorKey', () => {
  it('turns a server problem code into a marked i18n key', () => {
    expect(apiErrorKey('rate_limited')).toBe('@apiError.rate_limited');
  });
});

describe('resolveErrorMessage', () => {
  it('resolves a known code in both languages', () => {
    expect(resolveErrorMessage(apiErrorKey('rate_limited'), t('vi'))).toBe(
      'Bạn thao tác hơi nhanh. Đợi một chút rồi thử lại.',
    );
    expect(resolveErrorMessage(apiErrorKey('rate_limited'), t('en'))).toBe(
      'That was a little fast. Wait a moment and try again.',
    );
  });

  // A newer server deployment can return a code this client's dictionary predates.
  // Printing "apiError.some_new_code" at the user would be worse than a generic line.
  it('degrades an unrecognised code to the generic message, not the raw key', () => {
    expect(resolveErrorMessage(apiErrorKey('a_code_from_the_future'), t('en'))).toBe(
      'Something went wrong. Please try again later.',
    );
  });

  it('resolves the non-API store error keys', () => {
    expect(resolveErrorMessage(ERROR_KEY.topicEmpty, t('en'))).toBe(
      'No words found for that topic. Try describing it more specifically.',
    );
    expect(resolveErrorMessage(ERROR_KEY.topicFailed, t('vi'))).toBe('Không tạo được danh sách từ. Thử lại sau.');
  });

  // Import rows written before ADR-028 hold a Vietnamese sentence with no marker.
  // They must keep rendering exactly as they did — there is no backfill.
  it('passes a legacy unmarked message through verbatim', () => {
    expect(resolveErrorMessage('Không phân tích được tài liệu. Thử lại sau.', t('en'))).toBe(
      'Không phân tích được tài liệu. Thử lại sau.',
    );
  });

  it('uses the caller fallback when there is no error at all', () => {
    expect(resolveErrorMessage(null, t('en'), 'nothing wrong')).toBe('nothing wrong');
  });

  it('every apiError key exists in both dictionaries', () => {
    // Mirrors lib/api/problem.ts's ProblemCode. That module is `server-only`, so the
    // list cannot be imported here — this test is what keeps the copy honest.
    const CODES = [
      'bad_request', 'invalid_input', 'forbidden_origin', 'payload_too_large', 'rate_limited',
      'auth', 'login_required', 'gmail_not_connected', 'quota_exhausted', 'timeout', 'aborted',
      'upstream_unavailable', 'content_filtered', 'invalid_output', 'unsupported_capability',
      'document_encrypted', 'document_no_text', 'unsupported_file_type', 'unknown',
    ];
    for (const locale of ['vi', 'en'] as const) {
      for (const code of CODES) {
        const key = `apiError.${code}`;
        expect(translate(locale, key), `${locale}:${key}`).not.toBe(key);
      }
    }
  });
});
