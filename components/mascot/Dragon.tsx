import React from 'react';

export type DragonMood = 'idle' | 'happy' | 'sad' | 'excited';

interface DragonProps {
  mood?: DragonMood;
  size?: number;
  className?: string;
  /** When given, the SVG is exposed to assistive tech as role="img" with this
   * label. Omit for a purely decorative dragon sitting next to text that
   * already says the same thing (docs/design.md a11y conventions). */
  label?: string;
}

/**
 * Lexio's mascot (docs/decision.md ADR-030) — a flat, outlined chibi dragon
 * built from plain SVG shapes and CSS keyframes (app/globals.css's
 * `.dragon-*` classes), matching the app's existing "no external animation
 * library, no gradients" conventions (docs/design.md §3 — gradients are
 * banned, so every fill below is a flat design token instead of a second
 * accent hue). Colours are `var(--token)` references rather than Tailwind
 * classes so the dragon re-themes for free on the light/dark toggle, exactly
 * like every other token consumer in the app.
 */
export function Dragon({ mood = 'idle', size = 56, className = '', label }: DragonProps) {
  const bodyAnim = mood === 'sad' ? 'dragon-sad' : mood === 'idle' ? 'dragon-idle' : `dragon-${mood}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`${bodyAnim} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Tail */}
      <path
        d="M28 74 C14 78 10 68 16 60 C20 66 26 68 32 68 Z"
        fill="var(--green)"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        className="dragon-tail"
      />

      {/* Wings */}
      <path
        d="M40 46 C26 38 22 24 30 18 C34 30 40 36 46 40 Z"
        fill="var(--green-wash)"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        className="dragon-wing-left"
      />
      <path
        d="M60 46 C74 38 78 24 70 18 C66 30 60 36 54 40 Z"
        fill="var(--green-wash)"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
        className="dragon-wing-right"
      />

      {/* Body */}
      <ellipse cx="50" cy="64" rx="26" ry="22" fill="var(--green)" stroke="var(--ink)" strokeWidth="2" />
      <ellipse cx="50" cy="70" rx="15" ry="13" fill="var(--paper)" opacity="0.9" />

      {/* Back spikes */}
      <path d="M38 44 L41 36 L44 44 Z" fill="var(--amber)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M47 41 L50 32 L53 41 Z" fill="var(--amber)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M56 44 L59 36 L62 44 Z" fill="var(--amber)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Feet */}
      <ellipse cx="38" cy="85" rx="7" ry="5" fill="var(--green)" stroke="var(--ink)" strokeWidth="2" />
      <ellipse cx="62" cy="85" rx="7" ry="5" fill="var(--green)" stroke="var(--ink)" strokeWidth="2" />

      {/* Head */}
      <circle cx="50" cy="36" r="21" fill="var(--green)" stroke="var(--ink)" strokeWidth="2" />

      {/* Horns */}
      <path d="M36 22 C34 14 38 10 42 12 C40 16 39 20 39 24 Z" fill="var(--amber)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M64 22 C66 14 62 10 58 12 C60 16 61 20 61 24 Z" fill="var(--amber)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Cheeks */}
      <circle cx="36" cy="42" r="4" fill="var(--amber)" opacity="0.35" />
      <circle cx="64" cy="42" r="4" fill="var(--amber)" opacity="0.35" />

      {/* Snout */}
      <ellipse cx="50" cy="43" rx="9" ry="6" fill="var(--paper)" opacity="0.9" />
      <circle cx="46" cy="42" r="1.2" fill="var(--ink)" />
      <circle cx="54" cy="42" r="1.2" fill="var(--ink)" />

      {/* Eyes + mouth, mood-dependent */}
      <DragonFace mood={mood} />

      {/* Celebration sparkles */}
      {(mood === 'happy' || mood === 'excited') && (
        <>
          <Sparkle x={16} y={30} delay="0s" />
          <Sparkle x={84} y={28} delay="0.3s" />
          <Sparkle x={78} y={68} delay="0.6s" />
        </>
      )}

      {/* A single tear for encouragement moments — never punishing, just soft */}
      {mood === 'sad' && (
        <ellipse cx="40" cy="47" rx="2" ry="3.5" fill="var(--green-wash)" stroke="var(--ink)" strokeWidth="1" opacity="0.9" />
      )}
    </svg>
  );
}

function DragonFace({ mood }: { mood: DragonMood }) {
  if (mood === 'sad') {
    return (
      <>
        <ellipse cx="43" cy="33" rx="3" ry="4" fill="var(--ink)" />
        <ellipse cx="57" cy="33" rx="3" ry="4" fill="var(--ink)" />
        <path d="M45 26 L40 24" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M55 26 L60 24" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M45 50 Q50 47 55 50" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }

  if (mood === 'happy' || mood === 'excited') {
    return (
      <>
        {/* ^‿^ closed happy eyes */}
        <path d="M39 32 Q43 27 47 32" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M53 32 Q57 27 61 32" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M43 49 Q50 55 57 49" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
  }

  // idle
  return (
    <>
      <circle cx="43" cy="33" r="3.2" fill="var(--ink)" />
      <circle cx="57" cy="33" r="3.2" fill="var(--ink)" />
      <circle cx="44" cy="31.5" r="1" fill="var(--paper)" />
      <circle cx="58" cy="31.5" r="1" fill="var(--paper)" />
      <path d="M45 49 Q50 52 55 49" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function Sparkle({ x, y, delay }: { x: number; y: number; delay: string }) {
  return (
    <path
      d={`M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5} Z`}
      fill="var(--amber)"
      className="dragon-sparkle"
      style={{ animationDelay: delay }}
    />
  );
}
