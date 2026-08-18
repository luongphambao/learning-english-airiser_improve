/**
 * Runtime accessibility scan — the half ESLint cannot do.
 *
 *   npm run dev        # in another terminal (npm run start works too)
 *   npm run a11y
 *
 * eslint-plugin-jsx-a11y reads source and catches static markup mistakes; axe reads
 * the rendered page and catches what only exists after render — computed colour
 * contrast, duplicate ids, heading order, landmark structure, controls whose
 * accessible name resolves to nothing.
 *
 * Exits non-zero on `serious` or `critical` violations so CI can gate on it.
 * `moderate`/`minor` are printed but do not fail the run — see docs/status.md.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { grantSession } from './demo-session.mjs';
import { seed } from './demo-seed.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const FAIL_ON = new Set(['serious', 'critical']);

// /login is scanned signed-out (it is the only page reachable that way); the rest
// are scanned with a session, seeded so they render real content rather than an
// empty state that hides most of the UI.
const PUBLIC_ROUTES = ['/login'];
const ROUTES = ['/today', '/learn', '/learn?mode=doc', '/learn?mode=topic', '/onboarding', '/practice', '/vocabulary', '/progress', '/leaderboard', '/settings'];

const C = { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', bold: '\x1b[1m', off: '\x1b[0m' };

async function scan(page, route, theme) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // let fade-in animations settle before measuring contrast
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = violations.filter((v) => FAIL_ON.has(v.impact));
  const label = `${route} ${C.dim}(${theme})${C.off}`;

  if (violations.length === 0) {
    console.log(`  ${C.green}✓${C.off} ${label}`);
    return [];
  }

  console.log(`  ${blocking.length ? `${C.red}✗` : `${C.yellow}!`}${C.off} ${label}`);
  for (const v of violations) {
    const colour = FAIL_ON.has(v.impact) ? C.red : C.yellow;
    console.log(`      ${colour}${v.impact}${C.off}  ${v.id} — ${v.help}`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`        ${C.dim}${node.target.join(' ')}${C.off}`);
    }
    if (v.nodes.length > 3) console.log(`        ${C.dim}…and ${v.nodes.length - 3} more${C.off}`);
    console.log(`        ${C.dim}${v.helpUrl}${C.off}`);
  }
  return blocking.map((v) => ({ route, theme, id: v.id, impact: v.impact, count: v.nodes.length }));
}

async function main() {
  const browser = await chromium.launch();
  const blocking = [];

  console.log(`${C.bold}Lexio — a11y scan${C.off}  ${C.dim}${BASE} · axe-core, WCAG 2.1 AA${C.off}\n`);

  for (const theme of ['light', 'dark']) {
    console.log(`${C.bold}${theme === 'light' ? 'Light' : 'Dark'} theme${C.off}`);

    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    const anonPage = await anon.newPage();
    for (const route of PUBLIC_ROUTES) blocking.push(...(await scan(anonPage, route, theme)));
    await anon.close();

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    await grantSession(ctx, BASE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
    await seed(page, theme);
    for (const route of ROUTES) blocking.push(...(await scan(page, route, theme)));
    await ctx.close();
    console.log('');
  }

  await browser.close();

  console.log('─'.repeat(60));
  if (blocking.length === 0) {
    console.log(`${C.green}No serious or critical violations.${C.off}`);
    return;
  }
  const total = blocking.reduce((n, b) => n + b.count, 0);
  console.log(`${C.red}${blocking.length} blocking rule(s), ${total} element(s).${C.off}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
