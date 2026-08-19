import React from 'react';

export type MascotMood = 'idle' | 'happy' | 'sad' | 'excited';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  /** When given, the SVG is exposed to assistive tech as role="img" with this
   * label. Omit for a purely decorative mascot sitting next to text that
   * already says the same thing (docs/design.md a11y conventions). */
  label?: string;
}

/** The coiled body, drawn once as a stroked path rather than stacked shapes:
 * an ink stroke underneath and a narrower fill stroke on top is what produces
 * the even outline, and a single path keeps the coil reading as one continuous
 * body instead of separate segments. */
const BODY_PATH = 'M72 88 C44 94, 22 86, 28 77 C34 68, 70 71, 68 63 C66 57, 53 57, 50 54';

/**
 * Lexio's mascot (docs/decision.md ADR-030) — a flat, outlined chibi snake
 * coiled upright, built from plain SVG shapes and CSS keyframes
 * (app/globals.css's `.mascot-*` classes), matching the app's existing "no
 * external animation library, no gradients" conventions (docs/design.md §3 —
 * gradients are banned, so every fill below is a flat colour instead of a
 * second accent hue). `--mascot-fill`/`--mascot-fill-wash` are dedicated
 * tokens kept separate from `--green` (app/globals.css) so the app's own
 * accent colour is untouched even as this illustration's colour keeps
 * changing on request.
 */
export function Mascot({ mood = 'idle', size = 56, className = '', label }: MascotProps) {
  const bodyAnim = mood === 'sad' ? 'mascot-sad' : mood === 'idle' ? 'mascot-idle' : `mascot-${mood}`;
  const showTongue = mood !== 'sad';

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
      {/* Tapered tail tip — two stacked triangles (ink behind, fill in front)
          whose bases sit inside the body path's round cap, so the join is
          hidden and the coil ends in a point rather than a blunt stub. */}
      <path d="M72 79 L93 88 L72 97 Z" fill="var(--ink)" />

      <path d={BODY_PATH} fill="none" stroke="var(--ink)" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
      <path d={BODY_PATH} fill="none" stroke="var(--mascot-fill)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 82 L87.5 88 L72 94 Z" fill="var(--mascot-fill)" />

      {/* Belly — a lighter stroke tucked along the underside of the bottom coil.
          The one bit of shading, still a flat colour and not a gradient. */}
      <path
        d="M67 88 C46 93, 29 86, 31 79"
        fill="none"
        stroke="var(--mascot-fill-wash)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* Head */}
      <ellipse cx="50" cy="30" rx="23" ry="21" fill="var(--mascot-fill)" stroke="var(--ink)" strokeWidth="2.5" />

      {/* Cheeks */}
      <circle cx="31" cy="36" r="4.5" fill="var(--amber)" opacity="0.32" />
      <circle cx="69" cy="36" r="4.5" fill="var(--amber)" opacity="0.32" />

      <MascotFace mood={mood} />

      {/* Forked tongue, hanging just under the mouth — flicks via
          .mascot-tongue's CSS animation */}
      {showTongue && (
        <path
          d="M50 40 L50 46 M50 46 L47 49.5 M50 46 L53 49.5"
          fill="none"
          stroke="var(--wrong)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mascot-tongue"
          style={{ transformOrigin: '50px 40px' }}
        />
      )}

      {/* A single tear for encouragement moments — never punishing, just soft */}
      {mood === 'sad' && (
        <ellipse cx="34" cy="40" rx="2.3" ry="3.8" fill="var(--mascot-fill-wash)" stroke="var(--ink)" strokeWidth="1" opacity="0.95" />
      )}

      {/* Celebration sparkles */}
      {(mood === 'happy' || mood === 'excited') && (
        <>
          <Sparkle x={13} y={30} delay="0s" />
          <Sparkle x={87} y={26} delay="0.3s" />
          <Sparkle x={89} y={58} delay="0.6s" />
        </>
      )}
    </svg>
  );
}

function MascotFace({ mood }: { mood: MascotMood }) {
  if (mood === 'sad') {
    return (
      <>
        <Eye cx={41} cy={29} droopy />
        <Eye cx={59} cy={29} droopy />
        <path d="M44 18 L35 15" stroke="var(--ink)" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M56 18 L65 15" stroke="var(--ink)" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M45 43 Q50 39 55 43" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
  }

  if (mood === 'happy' || mood === 'excited') {
    return (
      <>
        {/* ^‿^ closed happy eyes */}
        <path d="M34 29 Q41 21 48 29" fill="none" stroke="var(--ink)" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M52 29 Q59 21 66 29" fill="none" stroke="var(--ink)" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M44 36 Q50 43 56 36" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      </>
    );
  }

  // idle
  return (
    <>
      <Eye cx={41} cy={28} />
      <Eye cx={59} cy={28} />
      <path d="M45 36 Q50 40 55 36" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

/** Big chibi eye — white sclera, ink pupil, offset highlight. */
function Eye({ cx, cy, droopy = false }: { cx: number; cy: number; droopy?: boolean }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx="6" ry={droopy ? 5.8 : 6.8} fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.7" />
      <circle cx={cx} cy={cy + (droopy ? 1.2 : 0.5)} r="3.4" fill="var(--ink)" />
      <circle cx={cx + 1.7} cy={cy - 1.7} r="1.5" fill="var(--paper)" />
    </>
  );
}

function Sparkle({ x, y, delay }: { x: number; y: number; delay: string }) {
  return (
    <path
      d={`M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5} Z`}
      fill="var(--amber)"
      className="mascot-sparkle"
      style={{ animationDelay: delay }}
    />
  );
}
