// Global test setup. Provides an in-memory IndexedDB so Dexie-backed repository
// tests (lib/repositories/**, lib/db/**) run without a browser.
import 'fake-indexeddb/auto';

// Node >= 26 defines a built-in `localStorage` global that reads as `undefined`
// unless the runtime is started with --localstorage-file. Vitest refuses to copy
// a jsdom window key onto the global when the key already exists, so files using
// `// @vitest-environment jsdom` (lib/db/__tests__/migrations.test.ts) get that
// undefined instead of jsdom's Storage. CI pins Node 22, where the global does
// not exist and jsdom's value lands normally — so this only bites locally.
if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(String(key)) ?? null,
    setItem: (key, value) => void store.set(String(key), String(value)),
    removeItem: (key) => void store.delete(String(key)),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage,
  });
}
