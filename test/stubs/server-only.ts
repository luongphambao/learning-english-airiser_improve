// Vitest runs plain Node, not Next.js's webpack/turbopack — the real `server-only`
// package throws unconditionally outside that bundler's special aliasing (it has no
// way to know "this file only ever ran on the server" without the bundler's help).
// vitest.config.ts aliases `server-only` to this no-op for tests, matching the
// standard workaround documented by the package itself for non-Next test runners.
export {};
