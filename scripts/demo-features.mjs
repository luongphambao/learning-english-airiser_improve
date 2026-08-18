/**
 * End-to-end feature demo / walkthrough for Lexio.
 *
 *   npm run dev                  # in another terminal
 *   npm run demo                 # every scene, headless, screenshots to UI/demo/
 *   npm run demo -- --headed --slow=250    # watch it happen
 *   npm run demo -- --only=learn-doc,practice
 *   npm run demo -- --list
 *
 * Why this exists, and how it differs from scripts/capture-screenshots.mjs: that
 * script only navigates and screenshots, so it proves nothing about behaviour.
 * This one DRIVES the app the way a user would — types into the paste box, clicks
 * "Phân tích", triages words, answers exercise cards — and asserts what should be
 * on screen afterwards. Every scene prints PASS/FAIL, so it doubles as a smoke
 * test of the whole product surface.
 *
 * Every /api/ai/* call is intercepted and answered from the FIXTURES table below.
 * That means the demo runs with no GEMINI_API_KEY, costs nothing, never hits a
 * rate limit, and — most importantly — is deterministic, so a failed assertion
 * means the app changed, not that the model had an off day. The response shapes
 * mirror lib/ai/tasks/contracts.ts; if a contract changes, this file must follow.
 *
 * Seeding uses the raw IndexedDB API (same approach and row shapes as
 * capture-screenshots.mjs — see its header) so a scene can start from an exact
 * known notebook state instead of whatever the previous scene left behind.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { grantSession } from './demo-session.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = 'UI/demo';
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : argv.includes(`--${name}`) ? true : fallback;
};
const HEADED = flag('headed', false) === true;
const SLOW = Number(flag('slow', 0)) || 0;
const ONLY = flag('only') ? String(flag('only')).split(',').map((s) => s.trim()) : null;
const KEEP_OPEN = flag('keep-open', false) === true;

// ---------------------------------------------------------------------------
// Fixtures — canned AI responses, shaped exactly like lib/ai/tasks/contracts.ts
// ---------------------------------------------------------------------------

const WORK_EMAIL = `Hi Trang,

Following up on the API migration. We are behind on the v1 deprecation and I
want to make sure we don't ship a regression. Can you circle back with the
latest throughput numbers before Thursday? I think we need to push back the
launch by one week to mitigate the risk.

I is very sorry for the short notice.

Thanks,
Minh`;

const DOC_TEXT = `Distributed systems rarely fail all at once. They degrade.
A queue backs up, a replica falls behind, and latency creeps past the threshold
nobody is watching. The team that notices first is usually the one that
instrumented the boring paths.

Resilience is not redundancy. Redundancy is a tactic; resilience is the property
that survives when the tactic is exhausted. Graceful degradation — shedding load
deliberately rather than collapsing — is what separates an incident from an
outage.`;

const FIXTURES = {
  // POST /api/ai/analyze-work -> AnalyzeWorkOutput
  analyzeWork: {
    words: [
      {
        text: 'deprecation',
        cefr: 'C1',
        meaningVi: 'việc ngừng hỗ trợ một phiên bản/API cũ',
        whyVi: 'Từ chuẩn trong thông báo kỹ thuật, bạn sẽ gặp lại rất nhiều.',
        exampleSentence: 'We are behind on the v1 deprecation.',
        distractors: ['deployment', 'delegation', 'depreciation'],
      },
      {
        text: 'regression',
        cefr: 'B2',
        meaningVi: 'lỗi phát sinh làm hỏng tính năng vốn đang chạy tốt',
        whyVi: 'Dùng hằng ngày khi review và release.',
        exampleSentence: "I want to make sure we don't ship a regression.",
        distractors: ['recursion', 'refactor', 'rollback'],
      },
      {
        text: 'mitigate',
        cefr: 'B2',
        meaningVi: 'giảm thiểu rủi ro hoặc tác động xấu',
        whyVi: 'Động từ trang trọng, hợp văn phong báo cáo.',
        exampleSentence: 'We need to push back the launch to mitigate the risk.',
        distractors: ['aggravate', 'accelerate', 'allocate'],
      },
    ],
    phrases: [
      {
        text: 'circle back',
        meaningVi: 'quay lại trao đổi tiếp về việc gì đó',
        usageVi: 'Rất thông dụng trong email công việc; lịch sự hơn "tell me again".',
        exampleSentence: 'Can you circle back with the latest throughput numbers?',
        distractors: ['loop around', 'turn back', 'ring again'],
      },
      {
        text: 'push back the launch',
        meaningVi: 'dời lịch ra mắt sang muộn hơn',
        usageVi: 'Nói giảm nhẹ hơn "delay the launch".',
        exampleSentence: 'I think we need to push back the launch by one week.',
        distractors: ['press the launch', 'pull the launch', 'shove the launch'],
      },
    ],
    grammarInsights: [
      {
        original: 'I is very sorry for the short notice.',
        corrected: 'I am very sorry for the short notice.',
        focusWord: 'am',
        rule: 'Subject–verb agreement',
        explanationVi: 'Chủ ngữ "I" luôn đi với "am", không phải "is".',
        distractors: ['are', 'be', 'was'],
      },
    ],
    professionalRewrites: [
      {
        original: 'I is very sorry for the short notice.',
        rewrite: 'Apologies for the short notice — I appreciate you turning this around quickly.',
        reasonVi:
          'Vừa sửa lỗi ngữ pháp, vừa đổi sang giọng văn chuyên nghiệp: xin lỗi ngắn gọn rồi ghi nhận công sức của người nhận.',
        keyPhrase: 'apologies for the short notice',
      },
    ],
    summary: {
      inputTypeVi: 'work_email',
      estimatedLevel: 'B2',
      headlineVi: 'Email theo dõi tiến độ migration API',
      wordCount: 3,
      phraseCount: 2,
      grammarCount: 1,
      rewriteCount: 1,
      opportunityCount: 7,
    },
  },

  // POST /api/ai/analyze-doc -> AnalyzeDocumentOutput
  analyzeDocument: {
    candidates: [
      {
        word: 'degrade',
        cefr: 'B2',
        category: 'technical',
        meaningVi: 'suy giảm dần chất lượng/hiệu năng',
        sentenceFromDoc: 'Distributed systems rarely fail all at once. They degrade.',
        sentenceSource: 'document',
        distractors: ['upgrade', 'downgrade', 'grade'],
      },
      {
        word: 'threshold',
        cefr: 'B2',
        category: 'academic',
        meaningVi: 'ngưỡng giới hạn',
        sentenceFromDoc: 'Latency creeps past the threshold nobody is watching.',
        sentenceSource: 'document',
        distractors: ['thrash', 'throughput', 'threadbare'],
      },
      {
        word: 'resilience',
        cefr: 'C1',
        category: 'academic',
        meaningVi: 'khả năng chống chịu và phục hồi',
        sentenceFromDoc: 'Resilience is not redundancy.',
        sentenceSource: 'document',
        distractors: ['reluctance', 'residence', 'resonance'],
      },
      {
        word: 'redundancy',
        cefr: 'C1',
        category: 'technical',
        meaningVi: 'sự dự phòng (nhiều bản sao để phòng hỏng hóc)',
        sentenceFromDoc: 'Redundancy is a tactic; resilience is the property that survives.',
        sentenceSource: 'document',
        distractors: ['abundance', 'reluctance', 'redundant'],
      },
      {
        word: 'graceful degradation',
        cefr: 'C1',
        category: 'technical',
        meaningVi: 'suy giảm có kiểm soát thay vì sập hoàn toàn',
        sentenceFromDoc: 'Graceful degradation is what separates an incident from an outage.',
        sentenceSource: 'document',
        distractors: ['hard failure', 'cold start', 'full outage'],
      },
      {
        word: 'shed load',
        cefr: 'C1',
        category: 'phrasal',
        meaningVi: 'chủ động từ chối bớt tải để giữ hệ thống sống',
        sentenceFromDoc: 'Shedding load deliberately rather than collapsing.',
        sentenceSource: 'document',
        distractors: ['drop packets', 'spill over', 'cut power'],
      },
    ],
  },

  // POST /api/ai/enrich -> EnrichWordOutput
  enrichWord: {
    ipa: '/ˈleerɪdʒ/',
    partOfSpeech: 'verb',
    meaningVi: 'tận dụng một nguồn lực sẵn có để đạt kết quả lớn hơn',
    exampleSentence: 'We leverage the existing cache instead of adding a new service.',
    distractors: ['discard', 'postpone', 'duplicate'],
    collocations: [
      { phrase: 'leverage existing infrastructure', meaningVi: 'tận dụng hạ tầng sẵn có' },
      { phrase: 'leverage our position', meaningVi: 'tận dụng vị thế của chúng ta' },
    ],
    wordFamily: ['leveraged', 'leveraging', 'leverageable'],
    cefr: 'B2',
  },

  // POST /api/ai/extract -> ExtractWordsOutput
  extractWords: {
    words: [
      { word: 'bottleneck', reason: 'Điểm nghẽn — từ khoá khi bàn về hiệu năng.' },
      { word: 'provision', reason: 'Cấp phát tài nguyên; rất hay gặp trong hạ tầng.' },
      { word: 'idempotent', reason: 'Thuộc tính quan trọng của API an toàn khi gọi lại.' },
    ],
  },

  // POST /api/ai/suggest-words -> SuggestTopicWordsOutput (docs/decision.md ADR-028)
  suggestTopicWords: {
    words: [
      {
        word: 'emission',
        cefr: 'B2',
        meaningVi: 'lượng khí thải ra môi trường',
        exampleSentence: 'The factory cut its carbon emission by half last year.',
        distractors: ['omission', 'admission', 'transmission'],
      },
      {
        word: 'renewable',
        cefr: 'B2',
        meaningVi: 'có thể tái tạo, không cạn kiệt',
        exampleSentence: 'Most of the grid now runs on renewable energy sources.',
        distractors: ['reusable', 'removable', 'reliable'],
      },
      {
        word: 'depletion',
        cefr: 'C1',
        meaningVi: 'sự cạn kiệt của một nguồn tài nguyên',
        exampleSentence: 'Groundwater depletion is worse in the dry season.',
        distractors: ['deployment', 'deduction', 'detention'],
      },
    ],
  },

  // POST /api/ai/grade-sentence -> GradeSentenceOutput
  gradeSentence: {
    isCorrect: true,
    feedbackVi: 'Câu đúng ngữ pháp và dùng từ đúng ngữ cảnh. Rất tự nhiên!',
    improvedSentence: 'We should leverage the existing cache before adding a new service.',
  },

  // POST /api/ai/enrich-batch -> EnrichWordBatchOutput. Echoes back whatever
  // words were requested, so the corpus top-up path (stores/topup-store.ts)
  // resolves instead of falling into its degraded branch.
  enrichWordBatch: (body) => ({
    items: (body.words ?? []).map((word) => ({
      word,
      ipa: `/${word}/`,
      partOfSpeech: 'noun',
      meaningVi: `nghĩa demo của "${word}"`,
      exampleSentence: `This sentence uses ${word} in a normal working context.`,
      distractors: ['alpha', 'beta', 'gamma'],
      collocations: [],
      wordFamily: [],
    })),
  }),
};

// ---------------------------------------------------------------------------
// Seed data — mirrors toRow() in lib/db/rows.ts and DEFAULT_* in
// lib/repositories/dexie/user-repository.ts
// ---------------------------------------------------------------------------

const NOW = Date.now();
const DAY = 86_400_000;

const SEED_WORDS = [
  { word: 'trade-off', ipa: '/ˈtreɪd.ɒf/', partOfSpeech: 'noun', meaningVi: 'Sự đánh đổi giữa các lựa chọn', exampleSentence: 'Engineering requires a careful trade-off between speed and security.', distractors: ['breakthrough', 'consensus', 'bottleneck'] },
  { word: 'deprecate', ipa: '/ˈdep.rə.keɪt/', partOfSpeech: 'verb', meaningVi: 'Ngưng hỗ trợ một tính năng hoặc API cũ', exampleSentence: 'We will deprecate the v1 endpoint next month.', distractors: ['compile', 'instantiate', 'refactor'] },
  { word: 'bottleneck', ipa: '/ˈbɒt.əl.nek/', partOfSpeech: 'noun', meaningVi: 'Điểm nghẽn gây chậm toàn bộ hệ thống', exampleSentence: 'The missing index was the primary bottleneck during peak traffic.', distractors: ['benchmark', 'pipeline', 'deployment'] },
  { word: 'mitigate', ipa: '/ˈmɪt.ɪ.ɡeɪt/', partOfSpeech: 'verb', meaningVi: 'Giảm thiểu rủi ro hoặc tác động tiêu cực', exampleSentence: 'Rate limiting helps mitigate denial-of-service risk.', distractors: ['exacerbate', 'stimulate', 'provoke'] },
  { word: 'redundant', ipa: '/rɪˈdʌn.dənt/', partOfSpeech: 'adjective', meaningVi: 'Dư thừa, có phương án dự phòng', exampleSentence: 'We deployed redundant multi-region servers to prevent downtime.', distractors: ['scarce', 'obsolete', 'vulnerable'] },
  { word: 'throughput', ipa: '/ˈθruː.pʊt/', partOfSpeech: 'noun', meaningVi: 'Thông lượng, khối lượng xử lý trong một đơn vị thời gian', exampleSentence: 'Batching raised throughput without adding servers.', distractors: ['latency', 'downtime', 'overhead'] },
  { word: 'constitute', ipa: '/ˈkɒn.stɪ.tʃuːt/', partOfSpeech: 'verb', meaningVi: 'Cấu thành, tạo nên', exampleSentence: 'These three checks constitute the release gate.', distractors: ['dissolve', 'estimate', 'delegate'] },
  { word: 'provision', ipa: '/prəˈvɪʒ.ən/', partOfSpeech: 'verb', meaningVi: 'Cấp phát, chuẩn bị sẵn tài nguyên', exampleSentence: 'Terraform will provision the staging cluster automatically.', distractors: ['decommission', 'inspect', 'audit'] },
];

const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * @param dueCount how many of the seeded words are due right now. 0 gives the
 *   "nothing to practise" state the review-fallback scene needs.
 */
function wordRows(dueCount = 4) {
  return SEED_WORDS.map((seed, i) => ({
    id: `w_demo_${i}`,
    ...seed,
    wordLower: seed.word.toLowerCase(),
    collocations: [],
    wordFamily: [],
    source: { kind: 'manual', label: 'Tự thêm', at: NOW },
    audioUrl: null,
    createdAt: NOW - (SEED_WORDS.length - i) * DAY,
    dueAt: i < dueCount ? NOW - 60_000 : NOW + (i - dueCount + 1) * DAY,
    easeLevel: i < dueCount ? 1 : 3,
    // reviewCount > 0 everywhere: a word with reviewCount 0 counts as "new" and
    // would be pulled into a session by newNeverReviewed(), which defeats
    // dueCount: 0.
    reviewCount: i < dueCount ? 2 : 6,
    lapseCount: 0,
    consecutiveCorrect: i < dueCount ? 1 : 4,
    isLeech: 0,
    status: i < dueCount ? 'learning' : 'known',
    updatedAt: NOW,
    deletedAt: null,
    entryType: 'word',
    noteVi: '',
    originalText: null,
    cefr: 'B2',
  }));
}

function userRow({ theme = 'light', sessionSize = 5 } = {}) {
  const history = {};
  for (let d = 0; d < 6; d++) history[dayKey(NOW - d * DAY)] = 6 - d;
  return {
    id: 'local',
    settings: {
      reminderHour: null, studyTime: null, theme, locale: 'vi',
      contextTopic: 'software engineering', level: 'B2', sessionSize,
      levelProfile: { declared: 'B2', placement: null, work: null, srs: null, updatedAt: NOW, lastPromptedAt: null },
    },
    stats: {
      streak: 6, longestStreak: 11, lastStudiedOn: dayKey(NOW), freezeUsedOn: null,
      totalReviews: 128, totalCorrect: 109, daysStudied: 24, history,
    },
    updatedAt: NOW,
  };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const results = [];
let currentScene = '';

const log = {
  scene: (name, title) => {
    currentScene = name;
    console.log(`\n\x1b[1m\x1b[36m▸ ${title}\x1b[0m \x1b[2m(${name})\x1b[0m`);
  },
  step: (msg) => console.log(`  \x1b[2m·\x1b[0m ${msg}`),
  pass: (msg) => {
    results.push({ scene: currentScene, msg, ok: true });
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  },
  fail: (msg, detail) => {
    results.push({ scene: currentScene, msg, ok: false, detail });
    console.log(`  \x1b[31m✗ ${msg}\x1b[0m${detail ? `\n      \x1b[2m${detail}\x1b[0m` : ''}`);
  },
};

/** Asserts a locator becomes visible; never throws, so one broken scene doesn't
 * abort the rest of the walkthrough. */
async function expectVisible(locator, description, timeout = 12_000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    log.pass(description);
    return true;
  } catch (err) {
    log.fail(description, String(err).split('\n')[0]);
    return false;
  }
}

async function expectHidden(locator, description, timeout = 8_000) {
  try {
    await locator.first().waitFor({ state: 'hidden', timeout });
    log.pass(description);
    return true;
  } catch {
    log.fail(description, 'still visible');
    return false;
  }
}

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = `${OUT}/${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(400); // let fade-in animations settle
  await page.screenshot({ path: file });
  log.step(`📸 ${file}`);
}

/** The "3 / 5" counter under the progress dots — the only reliable signal that a
 * card was actually accepted, since every exercise type looks different. */
async function cardCounter(page) {
  const el = page.getByText(/^\s*\d+\s*\/\s*\d+\s*$/).first();
  return (await el.textContent().catch(() => null))?.trim() ?? null;
}

/** Answers whatever exercise card is on screen, whatever kind it is. Returns
 * false once no card is left (i.e. the session finished). */
async function answerOneCard(page) {
  const before = await cardCounter(page);

  // Write exercise: a textarea + "Kiểm tra câu"
  const writeBox = page.locator('textarea').first();
  if (await writeBox.isVisible().catch(() => false)) {
    await writeBox.fill('We should leverage the existing cache instead of adding a new service.');
    await page.getByRole('button', { name: /Kiểm tra câu/i }).click();
    await page.getByRole('button', { name: /^Tiếp tục$/ }).click({ timeout: 15_000 });
    return true;
  }

  // Recall exercise: a single-line input + "Kiểm tra"
  const recallBox = page.locator('input[placeholder="Nhập từ tiếng Anh..."]');
  if (await recallBox.isVisible().catch(() => false)) {
    await recallBox.fill('guess');
    await page.getByRole('button', { name: /^Kiểm tra$/ }).click();
    await page.getByRole('button', { name: /^Tiếp tục$/ }).click({ timeout: 10_000 });
    return true;
  }

  // Fill-blank / listen: a 4-option MCQ grid. Clicking the first option is right
  // about a quarter of the time; when it's wrong the card flips to its answer
  // side and needs a "Tiếp tục". That button lives on a `rotate-y-180
  // backface-hidden` face, which Playwright reports as visible but cannot click
  // normally (the un-rotated front face still owns the hit point) — hence
  // force:true, and hence checking the counter rather than trusting either.
  const options = page.locator('div.grid.grid-cols-2 > button');
  if ((await options.count()) > 0) {
    await options.first().click();
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.waitForTimeout(250);
      if ((await cardCounter(page)) !== before) return true; // card accepted
      const cont = page.getByRole('button', { name: /^Tiếp tục$/ });
      if (await cont.count()) await cont.first().click({ force: true }).catch(() => {});
    }
    return true; // last card of the session: the counter disappears entirely
  }

  return false;
}

/** Plays a whole session to completion. Returns how many cards were answered. */
async function finishSession(page, maxCards = 12) {
  let answered = 0;
  for (let i = 0; i < maxCards; i++) {
    if (!(await answerOneCard(page))) break;
    answered += 1;
    await page.waitForTimeout(250);
  }
  return answered;
}

/** Writes rows straight into IndexedDB. Opening without a version means "attach to
 * whatever Dexie already created", so this never forces a version bump of its own —
 * but it CAN win the race and attach before Dexie has created any store at all,
 * which surfaces as "One of the specified object stores was not found". Hence the
 * retry loop: wait until the schema is actually there, then write. */
async function seed(page, { words = wordRows(), user = userRow(), meta = [], clear = true } = {}) {
  await page.evaluate(
    async ({ words, user, meta, clear }) => {
      const STORES = ['words', 'user', 'studySessions', 'imports', 'meta'];
      const open = () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('lexio');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

      let db = await open();
      for (let i = 0; i < 40 && !STORES.every((n) => db.objectStoreNames.contains(n)); i++) {
        db.close();
        await new Promise((r) => setTimeout(r, 250));
        db = await open();
      }

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        if (clear) {
          tx.objectStore('words').clear();
          tx.objectStore('studySessions').clear();
          tx.objectStore('imports').clear();
        }
        for (const w of words) tx.objectStore('words').put(w);
        for (const m of meta) tx.objectStore('meta').put(m);
        tx.objectStore('user').put(user);
      });
      db.close();
    },
    { words, user, meta, clear },
  );
}

/** Intercepts every AI call and answers it from FIXTURES. */
async function mockAi(context) {
  await context.route('**/api/ai/**', async (route) => {
    const url = route.request().url();
    let body = {};
    try {
      body = route.request().postDataJSON() ?? {};
    } catch {
      /* tts sends JSON too, but a parse failure just means "no echo needed" */
    }

    const pick = url.includes('/analyze-work')
      ? FIXTURES.analyzeWork
      : url.includes('/analyze-doc')
        ? FIXTURES.analyzeDocument
        : url.includes('/enrich-batch')
          ? FIXTURES.enrichWordBatch(body)
          : url.includes('/enrich')
            ? FIXTURES.enrichWord
            : url.includes('/extract')
              ? FIXTURES.extractWords
              : url.includes('/grade-sentence')
                ? FIXTURES.gradeSentence
                : url.includes('/suggest-words')
                  ? FIXTURES.suggestTopicWords
                  : null;

    if (!pick) {
      // /api/ai/tts — 501 is exactly what a build with no TTS provider returns,
      // and the listen exercise treats it as a normal "no audio" state.
      return route.fulfill({ status: 501, contentType: 'application/json', body: '{}' });
    }
    // A small delay keeps the loading states visible in --headed mode instead of
    // flashing past in a single frame.
    await new Promise((r) => setTimeout(r, 350));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pick) });
  });
}

async function newSession(browser, { viewport = DESKTOP, colorScheme = 'light', mobile = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 3 : 2,
    colorScheme,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await grantSession(context, BASE);
  await mockAi(context);
  const page = await context.newPage();
  page.on('pageerror', (err) => log.fail('uncaught page error', String(err).split('\n')[0]));
  return { context, page };
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const SCENES = [
  {
    name: 'onboarding',
    title: 'Người dùng mới: sổ tay trống → kiểm tra trình độ → có từ đầu tiên',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });

      await expectVisible(page.getByRole('button', { name: /Kiểm tra trình độ/i }), 'Sổ tay trống hiện CTA kiểm tra trình độ (không tự seed từ)');
      await shot(page, 'onboarding-empty');

      await page.getByRole('button', { name: /Kiểm tra trình độ/i }).click();
      await expectVisible(page.getByRole('heading', { level: 1 }), 'Màn hình 20 từ yes/no hiện ra (chạy offline, không gọi AI)');
      await shot(page, 'onboarding-placement-test');

      // Tick the first few — enough to score a level without claiming C2.
      const checkboxes = page.locator('input[type="checkbox"]');
      const total = await checkboxes.count();
      for (let i = 0; i < Math.min(6, total); i++) await checkboxes.nth(i).check();
      await shot(page, 'onboarding-placement-answered');

      await page.getByRole('button', { name: /Xem kết quả/i }).click();
      await page.waitForTimeout(700);
      await shot(page, 'onboarding-placement-triage');

      const confirm = page.getByRole('button', { name: /Bắt đầu học/i });
      if (await confirm.isVisible().catch(() => false)) {
        await expectVisible(page.getByText(/Đã biết rõ/).first(), 'Màn phân loại 3 mức (đã biết / mang máng / chưa biết)');
        await confirm.click();
      }
      await expectVisible(page.getByText(/Trình độ của bạn:/).first(), 'Kết quả CEFR được ghi lại');
      await shot(page, 'onboarding-placement-done');

      await context.close();
    },
  },

  {
    name: 'home',
    title: 'Trang chủ: kế hoạch hôm nay đọc từ dữ liệu thật',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });

      await expectVisible(page.getByText(/chuỗi ngày|ngày liên tiếp/i).first(), 'Thẻ streak hiển thị');
      await expectVisible(page.getByRole('link', { name: /Bắt đầu|Luyện tập/i }).first(), 'CTA vào buổi luyện tập');
      await expectVisible(page.getByText(/từ đến hạn ôn|từ mới chưa học/).first(), 'Kế hoạch hôm nay liệt kê số từ đến hạn/từ mới');
      await shot(page, 'home-with-plan');
      await context.close();
    },
  },

  {
    name: 'learn-work',
    title: 'Học từ công việc thật: dán email → AI phân tích → chọn → lưu vào sổ tay',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Từ công việc' }).click();
      await expectVisible(page.getByPlaceholder(/Dán đoạn văn/), 'Giao diện dán/tải văn bản');
      await shot(page, 'learn-work-idle');

      await page.getByPlaceholder(/Dán đoạn văn/).fill(WORK_EMAIL);
      await page.getByRole('button', { name: /Phân tích với Gemini/i }).click();

      await expectVisible(page.getByText(/Phân tích bởi Gemini/), 'Kết quả phân tích trả về');
      await expectVisible(page.getByText('deprecation').first(), 'Có mục Từ vựng');
      await expectVisible(page.getByText('circle back').first(), 'Có mục Cụm từ chuyên nghiệp');
      await expectVisible(page.getByText(/Subject–verb agreement/).first(), 'Có mục Điểm ngữ pháp');
      await expectVisible(page.getByText(/Apologies for the short notice/).first(), 'Có gợi ý viết lại chuyên nghiệp hơn');
      await expectVisible(page.getByRole('button', { name: /Học tài liệu khác/ }).first(), 'Có lối thoát khỏi màn kết quả (sửa lỗi one-way door)');
      await shot(page, 'learn-work-result');

      // Tick the first three insights, then save.
      const boxes = page.locator('input[type="checkbox"]');
      for (let i = 0; i < 3; i++) await boxes.nth(i).check();
      await page.getByRole('button', { name: /Thêm \d+ mục vào sổ tay/ }).click();

      await expectVisible(page.getByText(/Đã thêm \d+ mục vào sổ tay/), 'Màn hình xác nhận đã lưu');
      await shot(page, 'learn-work-saved');

      // The words really landed in the notebook, not just on screen.
      await page.goto(`${BASE}/vocabulary`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText('deprecation').first(), 'Từ vừa lưu xuất hiện trong Sổ tay (đi qua Dexie thật)');
      await context.close();
    },
  },

  {
    name: 'learn-doc',
    title: 'Đào từ vựng từ tài liệu: dán tài liệu → phân loại 3 mức → lưu',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      await page.goto(`${BASE}/learn?mode=doc`, { waitUntil: 'networkidle' });
      await page.keyboard.press('Escape'); // ?mode=doc auto-opens the OS file dialog
      await expectVisible(page.getByRole('heading', { name: /Đào từ vựng từ tài liệu/ }), 'Tab "Từ tài liệu" mở sẵn từ ?mode=doc');
      await shot(page, 'learn-doc-idle');

      await page.getByPlaceholder(/Dán đoạn văn/).fill(DOC_TEXT);
      await page.getByRole('button', { name: /Tìm từ vựng đáng học/ }).click();

      await expectVisible(page.getByText(/Từ vựng trong/), 'Màn phân loại từ ứng viên');
      await expectVisible(page.getByText('resilience').first(), 'Ứng viên kèm câu ví dụ lấy từ chính tài liệu');
      await shot(page, 'learn-doc-triage');

      await page.getByRole('button', { name: /Thêm vào sổ tay/ }).click();
      await expectVisible(page.getByText(/Đã thêm \d+ từ vào sổ tay/), 'Màn hình xác nhận đã lưu');
      await shot(page, 'learn-doc-saved');
      await context.close();
    },
  },

  {
    name: 'learn-return',
    title: '⭐ Lỗi đã sửa: rời tab sau khi lưu rồi quay lại → phải thấy màn hình tải lên',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      // --- doc mode ---
      await page.goto(`${BASE}/learn?mode=doc`, { waitUntil: 'networkidle' });
      await page.keyboard.press('Escape');
      await page.getByPlaceholder(/Dán đoạn văn/).fill(DOC_TEXT);
      await page.getByRole('button', { name: /Tìm từ vựng đáng học/ }).click();
      await page.getByRole('button', { name: /Thêm vào sổ tay/ }).click({ timeout: 20_000 });
      await expectVisible(page.getByText(/Đã thêm \d+ từ vào sổ tay/), 'Đã lưu xong từ tài liệu');

      log.step('→ chuyển sang tab Trang chủ, rồi quay lại tab Học');
      await page.getByRole('link', { name: /Trang chủ/ }).first().click();
      await page.waitForURL('**/today');
      await page.getByRole('link', { name: /^Học/ }).first().click();
      await page.waitForURL('**/learn');

      await expectVisible(page.getByPlaceholder(/Dán đoạn văn/), 'Quay lại tab Học → thấy lại giao diện tải lên/dán');
      await expectHidden(page.getByRole('button', { name: /^Thêm vào sổ tay$/ }), 'Danh sách phân loại cũ KHÔNG còn (không thể lưu lại lần hai)');
      await expectVisible(page.getByRole('button', { name: 'Từ tài liệu' }), 'Hai tab chế độ quay lại');
      await shot(page, 'learn-return-upload-again');

      // --- work mode: same bug, same fix ---
      await page.getByRole('button', { name: 'Từ công việc' }).click();
      await page.getByPlaceholder(/Dán đoạn văn/).fill(WORK_EMAIL);
      await page.getByRole('button', { name: /Phân tích với Gemini/i }).click();
      await page.locator('input[type="checkbox"]').first().check();
      await page.getByRole('button', { name: /Thêm \d+ mục vào sổ tay/ }).click();
      await expectVisible(page.getByText(/Đã thêm \d+ mục vào sổ tay/), 'Đã lưu xong từ công việc');

      await page.getByRole('link', { name: /Sổ tay/ }).first().click();
      await page.waitForURL('**/vocabulary');
      await page.getByRole('link', { name: /^Học/ }).first().click();
      await page.waitForURL('**/learn');

      await expectVisible(page.getByPlaceholder(/Dán đoạn văn/), 'Chế độ "Từ công việc" cũng quay về giao diện dán');
      await expectHidden(page.getByRole('button', { name: /Thêm \d+ mục vào sổ tay/ }), 'Nút lưu của phân tích cũ KHÔNG còn');
      await shot(page, 'learn-return-work-again');

      // Nothing was lost: the finished import is still in the history list.
      await expectVisible(page.getByText(/Đã phân tích trước đó/), 'Bản phân tích cũ vẫn nằm trong lịch sử "Đã phân tích trước đó"');
      await context.close();
    },
  },

  {
    name: 'practice',
    title: 'Luyện tập: 4 loại bài tập → hoàn thành → học tiếp ngay',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      // 8 due words with sessionSize 4 => a full first session AND a real second
      // round waiting behind it.
      await seed(page, { words: wordRows(8), user: userRow({ sessionSize: 4 }) });

      await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText(/Bài tập:/).first(), 'Buổi học dựng xong và hiện thẻ đầu tiên');
      await shot(page, 'practice-card');

      const answered = await finishSession(page);
      log.step(`đã trả lời ${answered} thẻ`);
      await expectVisible(page.getByText(/Đã học xong|Xuất sắc/).first(), 'Màn hình hoàn thành buổi học');
      await expectVisible(page.getByRole('button', { name: /Học tiếp \d+ từ/ }), '⭐ Còn từ đến hạn → có nút "Học tiếp" ngay tại chỗ');
      await shot(page, 'practice-complete-continue');

      await page.getByRole('button', { name: /Học tiếp \d+ từ/ }).click();
      await expectVisible(page.getByText(/Bài tập:/).first(), '⭐ Bấm "Học tiếp" dựng buổi mới mà không phải rời màn hình');
      await shot(page, 'practice-second-round');
      await context.close();
    },
  },

  {
    name: 'practice-review',
    title: '⭐ Hết từ đến hạn: báo đã thông thạo + ôn tập ngẫu nhiên hoặc học từ mới',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      // Nothing due, nothing new — but the notebook is full.
      //
      // The corpus top-up (stores/topup-store.ts) fires on /practice mount and
      // would inject up to 20 fresh corpus words a day, which makes "hết từ rồi"
      // literally unreachable while it still has budget. Exhausting its daily
      // counter is what a real user hits on their 21st word of the day — and it
      // is the only way to see this branch. Keys mirror addedTodayKey()/
      // LAST_RUN_KEY in stores/topup-store.ts.
      await seed(page, {
        words: wordRows(0),
        meta: [
          { key: `topup:addedOn:${dayKey(NOW)}`, value: 20 },
          { key: 'topup:lastRunAt', value: NOW },
        ],
      });

      await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText(/đã học xong|không còn từ nào/i).first(), 'Báo rằng không còn từ nào tới hạn');
      await expectVisible(page.getByRole('button', { name: /Ôn tập ngẫu nhiên/ }), '⭐ Có lựa chọn ôn tập ngẫu nhiên');
      await expectVisible(page.getByRole('button', { name: /Học thêm từ mới/ }), '⭐ Có lựa chọn học thêm từ mới');
      await shot(page, 'practice-all-caught-up');

      await page.getByRole('button', { name: /Ôn tập ngẫu nhiên/ }).click();
      await expectVisible(page.getByText(/Bài tập:/).first(), '⭐ Buổi ôn ngẫu nhiên dựng được từ các từ không tới hạn');
      await shot(page, 'practice-random-review');

      await finishSession(page);
      await expectVisible(page.getByText(/Đã ôn lại \d+ từ/), '⭐ Màn kết thúc nói rõ đây là buổi ôn lại, không phải kế hoạch hôm nay');
      await shot(page, 'practice-review-complete');
      await context.close();
    },
  },

  {
    name: 'practice-return',
    title: 'Lỗi đã sửa: hoàn thành buổi học → rời tab → quay lại phải dựng buổi mới',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page, { words: wordRows(8), user: userRow({ sessionSize: 3 }) });

      await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle' });
      await finishSession(page);
      await expectVisible(page.getByText(/Đã học xong|Xuất sắc/).first(), 'Buổi học đầu tiên hoàn thành');

      log.step('→ sang tab Sổ tay rồi quay lại tab Luyện tập');
      await page.getByRole('link', { name: /Sổ tay/ }).first().click();
      await page.waitForURL('**/vocabulary');
      await page.getByRole('link', { name: /Luyện tập/ }).first().click();
      await page.waitForURL('**/practice');

      await expectVisible(page.getByText(/Bài tập:/).first(), 'Quay lại → dựng buổi học mới (trước đây kẹt ở màn hoàn thành cũ)');
      await shot(page, 'practice-return-new-session');
      await context.close();
    },
  },

  {
    name: 'vocabulary',
    title: 'Sổ tay: thêm từ thủ công (AI làm giàu), trích từ đoạn văn, xem chi tiết, xoá',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      await page.goto(`${BASE}/vocabulary`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText('bottleneck').first(), 'Danh sách từ hiển thị');
      await shot(page, 'vocabulary-list');

      // Search
      await page.getByPlaceholder(/Tìm/).fill('through');
      await expectVisible(page.getByText('throughput').first(), 'Tìm kiếm lọc theo từ và nghĩa');
      await page.getByPlaceholder(/Tìm/).fill('');

      // Add by typing -> background enrichment fills IPA/meaning
      await page.getByRole('button', { name: /Thêm từ mới/ }).click();
      await shot(page, 'vocabulary-add-sheet');
      await page.getByPlaceholder(/leverage|Nhập/).first().fill('leverage');
      await page.getByRole('button', { name: /^Lưu từ ngay$/ }).click();
      await expectVisible(page.getByText('leverage').first(), 'Từ tự thêm xuất hiện ngay');
      await expectVisible(page.getByText(/tận dụng một nguồn lực/), 'Gemini làm giàu nền: IPA + nghĩa + ví dụ tự điền vào');
      await shot(page, 'vocabulary-enriched');

      // Extract from pasted text
      await page.getByRole('button', { name: /Thêm từ mới/ }).click();
      await page.getByRole('button', { name: /Dán đoạn văn/ }).click();
      await page.locator('textarea').first().fill('The provisioning pipeline has an idempotent retry and a clear bottleneck.');
      await page.getByRole('button', { name: /Phân tích/ }).click();
      await expectVisible(page.getByText('idempotent').first(), 'AI đề xuất từ đáng học từ đoạn văn dán vào');
      await shot(page, 'vocabulary-extract');
      await page.getByRole('button', { name: /Thêm tất cả \d+ từ/ }).click();

      // Detail sheet
      await page.getByText('bottleneck').first().click();
      await expectVisible(page.getByText(/Nguồn|Ngày thêm/).first(), 'Sheet chi tiết: nguồn, ngày thêm, số lần ôn, lần ôn kế tiếp');
      await shot(page, 'vocabulary-detail');
      await context.close();
    },
  },

  {
    name: 'progress',
    title: 'Tiến độ + Bảng xếp hạng',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText(/Đã thuộc|Đang học/).first(), 'Bốn ô chỉ số đọc từ dữ liệu thật');
      await expectVisible(page.locator('svg.recharts-surface').first(), 'Biểu đồ 7 ngày vẽ từ stats.history');
      await shot(page, 'progress');

      await page.goto(`${BASE}/leaderboard`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText(/Bạn|hạng/i).first(), 'Bảng xếp hạng có hàng của chính bạn');
      await shot(page, 'leaderboard');
      await context.close();
    },
  },

  {
    name: 'grammar',
    title: 'Ngữ pháp + Kế hoạch học',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      await page.goto(`${BASE}/grammar`, { waitUntil: 'networkidle' });
      await expectVisible(page.locator('button, a').filter({ hasText: /thì|câu|từ loại|Present|Past/i }).first(), 'Danh sách chủ đề ngữ pháp');
      await shot(page, 'grammar-topics');

      await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText(/Tuần này/), 'Kế hoạch học đọc từ lịch sử ôn tập thật');
      await shot(page, 'calendar');
      await context.close();
    },
  },

  {
    name: 'settings',
    title: 'Cài đặt: chủ đề, ngôn ngữ, số thẻ mỗi buổi, Gmail, đồng bộ',
    async run(browser) {
      const { context, page } = await newSession(browser);
      await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(page);

      await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
      await expectVisible(page.getByText(/Tài khoản/).first(), 'Thẻ tài khoản');
      await expectVisible(page.getByText(/Gmail|nhắc/i).first(), 'Thẻ nhắc học qua Gmail');
      await shot(page, 'settings');
      await context.close();
    },
  },

  {
    name: 'dark-mobile',
    title: 'Giao diện tối và bản điện thoại',
    async run(browser) {
      const dark = await newSession(browser, { colorScheme: 'dark' });
      await dark.page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(dark.page, { user: userRow({ theme: 'dark' }) });
      await dark.page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await expectVisible(dark.page.locator('html[data-theme="dark"]'), 'Chủ đề tối áp dụng ngay khi khởi động (không nháy sáng)');
      await shot(dark.page, 'dark-today');
      await dark.page.goto(`${BASE}/practice`, { waitUntil: 'networkidle' });
      await shot(dark.page, 'dark-practice');
      await dark.context.close();

      const mob = await newSession(browser, { viewport: MOBILE, mobile: true });
      await mob.page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await seed(mob.page);
      await mob.page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
      await expectVisible(mob.page.locator('nav.md\\:hidden'), 'Thanh tab dưới đáy ở kích thước điện thoại');
      await shot(mob.page, 'mobile-today');
      await mob.page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' });
      await shot(mob.page, 'mobile-learn');
      await mob.context.close();
    },
  },
];

// ---------------------------------------------------------------------------

async function main() {
  if (flag('list')) {
    console.log('\nCác cảnh có sẵn:\n');
    for (const s of SCENES) console.log(`  ${s.name.padEnd(18)} ${s.title}`);
    console.log('');
    return;
  }

  const scenes = ONLY ? SCENES.filter((s) => ONLY.includes(s.name)) : SCENES;
  if (scenes.length === 0) {
    console.error(`Không có cảnh nào khớp --only=${ONLY?.join(',')}. Chạy --list để xem danh sách.`);
    process.exitCode = 1;
    return;
  }

  await mkdir(OUT, { recursive: true });

  // Fail fast with a useful message rather than 12 confusing timeouts.
  try {
    const res = await fetch(`${BASE}/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`\n✗ Không kết nối được ${BASE} — hãy chạy \`npm run dev\` ở terminal khác.\n  (${err})`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n\x1b[1mLexio — demo ${scenes.length} tính năng\x1b[0m  \x1b[2m${BASE} → ${OUT}/\x1b[0m`);
  console.log('\x1b[2mMọi lời gọi /api/ai/* đều được thay bằng dữ liệu mẫu — không cần API key, không tốn phí.\x1b[0m');

  const browser = await chromium.launch({ headless: !HEADED, slowMo: SLOW });
  for (const scene of scenes) {
    log.scene(scene.name, scene.title);
    try {
      await scene.run(browser);
    } catch (err) {
      log.fail(`cảnh "${scene.name}" dừng giữa chừng`, String(err).split('\n')[0]);
    }
  }
  if (KEEP_OPEN) {
    console.log('\n\x1b[2m--keep-open: trình duyệt vẫn mở, Ctrl+C để thoát.\x1b[0m');
    await new Promise(() => {});
  }
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n\x1b[1m${'─'.repeat(60)}\x1b[0m`);
  console.log(`  \x1b[32m${results.length - failed.length} đạt\x1b[0m · ${failed.length ? `\x1b[31m${failed.length} lỗi\x1b[0m` : '0 lỗi'} · ${shotIndex} ảnh trong ${OUT}/`);
  if (failed.length) {
    console.log('');
    for (const f of failed) console.log(`  \x1b[31m✗\x1b[0m [${f.scene}] ${f.msg}`);
    process.exitCode = 1;
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
