/**
 * Regenerates the README screenshots in UI/readme/.
 *
 *   npm run dev            # in another terminal
 *   node scripts/capture-screenshots.mjs
 *
 * The notebook fixture lives in demo-seed.mjs (shared with a11y-scan.mjs); the login
 * gate is passed with the cookie minted in demo-session.mjs.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { grantSession } from './demo-session.mjs';
import { seed } from './demo-seed.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = 'UI/readme';
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

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
  await grantSession(fresh, BASE);
  const p0 = await fresh.newPage();
  await p0.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await shot(p0, '01-today-empty');
  await fresh.close();

  // 2. Everything else, against the seeded notebook.
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  await grantSession(ctx, BASE);
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
  await grantSession(dark, BASE);
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
  await grantSession(mob, BASE);
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
