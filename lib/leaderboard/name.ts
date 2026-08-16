// Pure name helpers for the leaderboard — no Firebase, no Dexie, so this stays
// node-testable like the rest of lib/leaderboard/**.

// Two-letter monogram from the last two syllables of a Vietnamese given-name-last
// full name (e.g. "Lê Thị Hồng Vân" -> "HV", not "LT"). Falls back gracefully for
// single-word names ("Alex" -> "A") since real signed-in users can have any name
// shape, unlike the old hand-authored mock roster this was originally written for.
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const lastTwo = parts.slice(-2);
  return lastTwo.map((p) => p.charAt(0).toUpperCase()).join('');
}

// Mirrors firestore.rules' `name.size() <= 40` on the published doc. Enforced
// here (not in the Zod domain schema — see lib/domain/user.ts's leaderboardName
// comment for why) and via the Settings input's `maxLength`.
export const NAME_MAX_LENGTH = 40;

export interface NameSources {
  /** `settings.leaderboardName` — an explicit user override, takes priority over
   * everything else. */
  nickname: string | null;
  /** Firebase Auth `displayName` — set on email registration if the user typed a
   * name (optional field), or by Google sign-in (currently disabled,
   * GOOGLE_SIGNIN_ENABLED = false in lib/auth/firebase-auth.ts). Frequently null. */
  displayName: string | null | undefined;
}

/**
 * Fallback chain for the name shown on the real leaderboard: explicit nickname ->
 * Auth displayName -> a generic placeholder. Needed because the name field at
 * sign-up is optional (app/(stack)/login/page.tsx passes `name.trim() ||
 * undefined`) and Google sign-in — the other source of a real displayName — is
 * currently disabled, so a lot of accounts have no displayName at all.
 *
 * Deliberately does NOT fall back to the local part of the email
 * ("nguyen.van.a@gmail.com" -> "nguyen.van.a"): that would publish a
 * near-identifying real name to every other signed-in user, which is exactly
 * what keeping `leaderboard/{uid}` free of `email` (lib/leaderboard/map.ts) was
 * meant to prevent — a derived leak is still a leak. `fallbackLabel` is passed
 * in rather than imported from i18n so this file stays hook-free
 * (lib/leaderboard/types.ts's Translate convention).
 */
export function resolveDisplayName(sources: NameSources, fallbackLabel: string): string {
  const nickname = sources.nickname?.trim();
  if (nickname) return nickname.slice(0, NAME_MAX_LENGTH);

  const displayName = sources.displayName?.trim();
  if (displayName) return displayName.slice(0, NAME_MAX_LENGTH);

  return fallbackLabel;
}
