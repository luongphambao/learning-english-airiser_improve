// Global test setup. Provides an in-memory IndexedDB so Dexie-backed repository
// tests (lib/repositories/**, lib/db/**) run without a browser.
import 'fake-indexeddb/auto';
