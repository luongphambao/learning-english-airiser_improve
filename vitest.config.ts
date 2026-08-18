import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Two projects so lib/srs tests run under two different host timezones —
// this is what catches timezone-leakage bugs like the one in the old lib/srs.ts
// (getTodayDateString used Asia/Ho_Chi_Minh while getYesterdayDateString used the
// local timezone; identical output under one TZ can still diverge under another).
export default defineConfig({
  // tsconfig.json sets `jsx: "preserve"` because Next's own compiler handles JSX in
  // the app build. Vitest transforms with esbuild instead, which honours that
  // setting and leaves JSX untransformed — so a `.tsx` test throws "React is not
  // defined" at render. The app never imports React explicitly (Next injects the
  // automatic runtime), so the fix belongs here, not as an import in every test.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The real server-only package throws unconditionally when required outside
      // Next's bundler (see test/stubs/server-only.ts) — swapped for a no-op here.
      'server-only': path.resolve(__dirname, './test/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // A future test run filtered down to zero matching files (e.g. `vitest run
    // some-nonexistent-pattern`) should not fail CI outright.
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'tz-utc',
          env: { TZ: 'UTC' },
        },
      },
      {
        extends: true,
        test: {
          name: 'tz-ny',
          env: { TZ: 'America/New_York' },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
