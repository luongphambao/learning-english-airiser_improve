import { IBM_Plex_Mono, Instrument_Serif, Inter } from 'next/font/google';

// Self-hosted via next/font instead of a <link> to fonts.googleapis.com — removes a
// render-blocking round trip to a third-party origin and the FOIT that hit Vietnamese
// diacritics under the old <link>-based loading. Subsets/weights match what the app
// actually uses (see docs/design.md §1).
export const inter = Inter({
  subsets: ['latin', 'vietnamese'], // UI copy is Vietnamese — this subset is required
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const fontVariables = `${inter.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`;
