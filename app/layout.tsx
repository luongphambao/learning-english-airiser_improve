import type { Metadata } from 'next';
import './globals.css';
import { fontVariables } from './fonts';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Lexio — Learning English with Vocabulary & Grammar Quizzes',
  description: 'A calm English vocabulary and grammar app with flashcards, spaced repetition, and AI enrichment.',
};

// Runs before hydration so the resolved theme (light/dark, with 'system' resolved via
// matchMedia) and the display language are on <html> for the very first paint — no
// light-mode/wrong-language flash on reload. Reads the `lexio_settings` localStorage
// key, which stores/settings-store.ts mirrors on every theme/locale change (IndexedDB
// itself can't be read synchronously before first paint, so this plain localStorage
// key is the sync mirror of the Dexie value).
const THEME_INIT_SCRIPT = `(function () {
  try {
    var raw = localStorage.getItem('lexio_settings');
    var stored = raw ? JSON.parse(raw) : {};
    var pref = stored.theme || 'system';
    var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (stored.locale === 'en' || stored.locale === 'vi') root.lang = stored.locale;
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
