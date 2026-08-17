/**
 * The app requires a login (app/providers.tsx). These scripts drive a local dev
 * server with no real account, so they mint the same `lexio_user_session` cookie
 * app/api/auth/session/route.ts issues — the shape read back by getUserSession()
 * in lib/auth/user-session.ts.
 *
 * This works because the cookie is an unsigned base64 blob. That is a known,
 * documented limitation (docs/competition-audit.md §6.2, P3): the guard it backs
 * is a product gate, not a security boundary — the real spend guards are the
 * origin check and the per-IP rate limiter, neither of which a cookie bypasses.
 *
 * Deliberately carries no uid-bearing Firebase session, so Dexie stays on the
 * local `lexio` database — the same one both scripts seed directly.
 */
export const DEMO_SESSION = {
  uid: 'demo-script-user',
  email: 'demo@lexio.local',
  name: 'Demo',
  loginMethod: 'email',
  createdAt: 0,
};

/** Grants a Playwright browser context access past the login gate. */
export async function grantSession(context, baseUrl) {
  await context.addCookies([
    {
      name: 'lexio_user_session',
      value: Buffer.from(JSON.stringify({ ...DEMO_SESSION, createdAt: Date.now() })).toString('base64'),
      url: baseUrl,
    },
  ]);
}
