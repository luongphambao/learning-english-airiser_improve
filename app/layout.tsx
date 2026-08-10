import type { Metadata } from 'next';
import './globals.css';
import { fontVariables } from './fonts';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Lexio — Learning English with Vocabulary & Grammar Quizzes',
  description: 'A calm English vocabulary and grammar app with flashcards, spaced repetition, and AI enrichment.',
};

// Runs before hydration so the resolved theme (light/dark, with 'system' resolved via
// matchMedia) is on <html> for the very first paint — no light-mode flash on a dark
// reload. Reads the `lexio_settings` localStorage key, which stores/settings-store.ts
// mirrors on every theme change (IndexedDB itself can't be read synchronously before
// first paint, so this plain localStorage key is the sync mirror of the Dexie value).
const THEME_INIT_SCRIPT = `(function () {
  try {
    var raw = localStorage.getItem('lexio_settings');
    var pref = raw ? (JSON.parse(raw).theme || 'system') : 'system';
    var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={fontVariables}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="antialiased text-[15px] selection:bg-green-wash selection:text-green">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
