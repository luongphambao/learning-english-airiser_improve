/**
 * Regenerates the README screenshots in UI/readme/.
 *
 *   npm run dev            # in another terminal
 *   node scripts/capture-screenshots.mjs
 *
 * The app is local-first (Dexie/IndexedDB) and, since ADR-017, no longer seeds itself
 * — a fresh profile lands on the empty-notebook CTA. So this script writes a small
 * fixed dataset straight into IndexedDB between navigations, which is also what keeps
 * the shots reproducible: same words, same streak, same counts on every run. Dexie
 * stores are ordinary IndexedDB object stores, so no app code is needed to fill them;
 * the row shapes below mirror toRow() in lib/db/rows.ts and DEFAULT_STATS/
 * DEFAULT_SETTINGS in lib/repositories/dexie/user-repository.ts. If either shape
 * changes, this file must follow.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = 'UI/readme';
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

// A frozen "now" would make dueAt drift out of the past as the fixture ages; anchor
// everything to run time instead so the plan always shows words due today.
const NOW = Date.now();
const DAY = 86_400_000;

const WORDS = [
  { word: 'trade-off', ipa: '/ˈtreɪd.ɒf/', partOfSpeech: 'noun', meaningVi: 'Sự đánh đổi giữa các lựa chọn', exampleSentence: 'Engineering requires a careful trade-off between speed and security.', distractors: ['breakthrough', 'consensus', 'bottleneck'] },
  { word: 'deprecate', ipa: '/ˈdep.rə.keɪt/', partOfSpeech: 'verb', meaningVi: 'Ngưng hỗ trợ một tính năng hoặc API cũ', exampleSentence: 'We will deprecate the v1 endpoint next month.', distractors: ['compile', 'instantiate', 'refactor'] },
  { word: 'bottleneck', ipa: '/ˈbɒt.əl.nek/', partOfSpeech: 'noun', meaningVi: 'Điểm nghẽn gây chậm toàn bộ hệ thống', exampleSentence: 'The missing index was the primary bottleneck during peak traffic.', distractors: ['benchmark', 'pipeline', 'deployment'] },
  { word: 'mitigate', ipa: '/ˈmɪt.ɪ.ɡeɪt/', partOfSpeech: 'verb', meaningVi: 'Giảm thiểu rủi ro hoặc tác động tiêu cực', exampleSentence: 'Rate limiting helps mitigate denial-of-service risk.', distractors: ['exacerbate', 'stimulate', 'provoke'] },
  { word: 'redundant', ipa: '/rɪˈdʌn.dənt/', partOfSpeech: 'adjective', meaningVi: 'Dư thừa, có phương án dự phòng', exampleSentence: 'We deployed redundant multi-region servers to prevent downtime.', distractors: ['scarce', 'obsolete', 'vulnerable'] },
  { word: 'throughput', ipa: '/ˈθruː.pʊt/', partOfSpeech: 'noun', meaningVi: 'Thông lượng, khối lượng xử lý trong một đơn vị thời gian', exampleSentence: 'Batching raised throughput without adding servers.', distractors: ['latency', 'downtime', 'overhead'] },
  { word: 'leverage', ipa: '/ˈliː.vər.ɪdʒ/', partOfSpeech: 'verb', meaningVi: 'Tận dụng một nguồn lực sẵn có', exampleSentence: 'We leverage the existing cache instead of adding a new service.', distractors: ['discard', 'postpone', 'duplicate'] },
  { word: 'constitute', ipa: '/ˈkɒn.stɪ.tʃuːt/', partOfSpeech: 'verb', meaningVi: 'Cấu thành, tạo nên', exampleSentence: 'These three checks constitute the release gate.', distractors: ['dissolve', 'estimate', 'delegate'] },
];

function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Mirrors lib/db/rows.ts toRow(): isLeech is 0/1 (IndexedDB cannot index booleans). */
function wordRows() {
  return WORDS.map((seed, i) => ({
    id: `w_shot_${i}`,
    ...seed,
    wordLower: seed.word.toLowerCase(),
    collocations: [],
    wordFamily: [],
    source: { kind: 'manual', label: 'Tự thêm', at: NOW },
    audioUrl: null,
    createdAt: NOW - (WORDS.length - i) * DAY,
    // First four are due now (so "Hôm nay" has a real plan); the rest sit in future.
    dueAt: i < 4 ? NOW - 60_000 : NOW + (i - 3) * DAY,
    easeLevel: i < 4 ? 1 : 2,
    reviewCount: i < 4 ? 2 : 5,
    lapseCount: 0,
    consecutiveCorrect: i < 4 ? 1 : 3,
    isLeech: 0,
    status: i < 4 ? 'learning' : 'known',
    updatedAt: NOW,
    deletedAt: null,
    entryType: 'word',
    noteVi: '',
    originalText: null,
    cefr: 'B2',
  }));
}

function userRow(theme) {
  const history = {};
  for (let d = 0; d < 6; d++) history[dayKey(NOW - d * DAY)] = 6 - d;
  return {
    id: 'local', // USER_ID, lib/db/dexie.ts
    settings: {
      reminderHour: null, studyTime: null, theme, locale: 'vi',
      contextTopic: 'software engineering', level: 'B2', sessionSize: 5,
      levelProfile: { declared: 'B2', placement: null, work: null, srs: null, updatedAt: NOW, lastPromptedAt: null },
    },
    stats: {
      streak: 6, longestStreak: 11, lastStudiedOn: dayKey(NOW), freezeUsedOn: null,
      totalReviews: 128, totalCorrect: 109, daysStudied: 24, history,
    },
    updatedAt: NOW,
  };
}

/** Writes rows with the raw IndexedDB API — opening without a version means "attach to
 * whatever Dexie already created", so this never races Dexie's own upgrade path. */
async function seed(page, theme) {
  await page.evaluate(
    async ({ words, user }) => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('lexio');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['words', 'user'], 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        for (const w of words) tx.objectStore('words').put(w);
        tx.objectStore('user').put(user);
      });
      db.close();
    },
    { words: wordRows(), user: userRow(theme) },
  );
}

async function shot(page, name) {
  await page.waitForTimeout(700); // let fade-in animations settle
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('captured', name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // 1. Empty notebook — the real first-run state, before any seeding.
  const fresh = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const p0 = await fresh.newPage();
  await p0.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await shot(p0, '01-today-empty');
  await fresh.close();

  // 2. Everything else, against the seeded notebook.
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await seed(page, 'light');

  for (const [route, name] of [
    ['/today', '02-today'],
    ['/learn', '03-learn-work'],
    ['/learn?mode=doc', '04-learn-doc'],
    ['/practice', '05-practice'],
    ['/vocabulary', '06-vocabulary'],
    ['/progress', '07-progress'],
    ['/leaderboard', '08-leaderboard'],
    ['/settings', '09-settings'],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await shot(page, name);
  }
  await ctx.close();

  // 3. Dark theme — set in the profile row, so the app boots straight into it.
  const dark = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2, colorScheme: 'dark' });
  const pd = await dark.newPage();
  await pd.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await seed(pd, 'dark');
  await pd.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await shot(pd, '10-today-dark');
  await pd.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
  await shot(pd, '11-progress-dark');
  await dark.close();

  // 4. Mobile — the app is phone-first (fixed bottom tab bar under md).
  const mob = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pm = await mob.newPage();
  await pm.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await seed(pm, 'light');
  await pm.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await shot(pm, '12-today-mobile');
  await mob.close();

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
