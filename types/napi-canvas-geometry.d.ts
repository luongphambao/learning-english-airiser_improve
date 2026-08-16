// @napi-rs/canvas ships types only for its package root (index.d.ts), which pulls in
// the native Skia surface. lib/documents/extract.server.ts deliberately imports the
// geometry submodule on its own — see the comment there for why — so declare just the
// three classes that file exports. Typing them as the DOM lib's own constructors (in
// tsconfig's `lib`) is what lets the DOMMatrix polyfill assign to globalThis without a
// cast; they are spec-compatible implementations, which is the whole point of using
// them as a polyfill.
declare module '@napi-rs/canvas/geometry.js' {
  export const DOMMatrix: typeof globalThis.DOMMatrix;
  export const DOMPoint: typeof globalThis.DOMPoint;
  export const DOMRect: typeof globalThis.DOMRect;

  // The file is CommonJS, so a bundler may surface `module.exports` here instead of as
  // named exports — extract.server.ts reads both, and this makes that typecheck.
  const geometry: {
    DOMMatrix: typeof globalThis.DOMMatrix;
    DOMPoint: typeof globalThis.DOMPoint;
    DOMRect: typeof globalThis.DOMRect;
  };
  export default geometry;
}
