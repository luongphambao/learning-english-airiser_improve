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

/** Tail-to-head body: a loose coil at the base, rising into a rearing,
 * cobra-like S-curve neck — matching the reference photo the project owner
 * supplied (a raised neck instead of the earlier version's flat coiled ball
 * with the head sitting on top of it). Drawn once as a stroked path so the
 * whole body reads as one continuous line. */
const BODY_PATH =
  'M80 88 C55 96 20 90 28 80 C33 73 50 78 55 72 C60 64 40 56 46 46 C50 38 62 34 58 24 C56 20 52 18 48 16';

/** Head pivot — the head ellipse and every face feature (eyes, mouth, tongue,
 * tear) share this exact rotation so they all tilt together as one rigid
 * unit; without it, curved features like the eyebrows visibly disagreed with
 * the tilted head silhouette. */
const HEAD_CX = 45;
const HEAD_CY = 16;
const HEAD_ROTATE = -24;
const HEAD_TRANSFORM = `rotate(${HEAD_ROTATE} ${HEAD_CX} ${HEAD_CY})`;

/**
 * Lexio's mascot (docs/decision.md ADR-030) — a flat, outlined cartoon snake
 * rearing up out of a loose coil, built from plain SVG shapes and CSS
 * keyframes (app/globals.css's `.mascot-*` classes). Solid green body with a
 * cream belly stripe and bulging top-of-head eyes, modelled after a second
 * reference photo the project owner supplied — a rearing "cobra" pose rather
 * than the earlier flat coiled-ball version. No external animation library,
 * no gradients (docs/design.md §3 — every fill is a flat colour).
 * `--mascot-fill`/`--mascot-belly` are dedicated tokens kept separate from
 * `--green` (app/globals.css) so the app's own accent colour is untouched
 * even as this illustration keeps changing on request.
 */
export function Mascot({ mood = 'idle', size = 56, className = '', label }: MascotProps) {
  const bodyAnim = mood === 'sad' ? 'mascot-sad' : mood === 'idle' ? 'mascot-idle' : `mascot-${mood}`;
  const showTongue = mood !== 'sad';

  return (
    <svg
      viewBox="-3 -3 106 106"
      width={size}
      height={size}
      className={`${bodyAnim} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Tail tip, peeking out from under the coil */}
      <path d="M78 78 C90 80, 92 88, 82 92 C84 85, 82 80, 76 80 Z" fill="var(--ink)" />
      <path d="M78 80 C87 82, 88 87, 81 90 C83 85, 81 81.5, 77 81.5 Z" fill="var(--mascot-fill)" />

      {/* Body — ink stroke underneath, cream belly stroke on top, green back
          narrower still, leaving a cream sliver down the whole underside from
          tail to chin. */}
      <path d={BODY_PATH} fill="none" stroke="var(--ink)" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
      <path d={BODY_PATH} fill="none" stroke="var(--mascot-belly)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={BODY_PATH} fill="none" stroke="var(--mascot-fill)" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(-1.8, -1.8)" />

      {/* Head + every face feature share HEAD_TRANSFORM so they tilt together
          as one rigid unit — small and elongated, continuing the neck rather
          than a big round chibi ball, per the reference. */}
      <g transform={HEAD_TRANSFORM}>
        <ellipse cx={HEAD_CX} cy={HEAD_CY} rx="14" ry="10.5" fill="var(--mascot-fill)" stroke="var(--ink)" strokeWidth="2.3" />

        <MascotFace mood={mood} />

        {/* Small tongue tip, just poking past the jaw */}
        {showTongue && (
          <path
            d="M33.5 19.6 L28.2 21.7 M33.5 19.6 L29.5 23.9"
            fill="none"
            stroke="var(--wrong)"
            strokeWidth="2"
            strokeLinecap="round"
            className="mascot-tongue"
            style={{ transformOrigin: '33.5px 19.6px' }}
          />
        )}

        {/* A single tear for encouragement moments — never punishing, just soft */}
        {mood === 'sad' && (
          <ellipse cx="30.5" cy="11.7" rx="2.1" ry="3.4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" opacity="0.95" />
        )}
      </g>

      {/* Celebration sparkles */}
      {(mood === 'happy' || mood === 'excited') && (
        <>
          <Sparkle x={10} y={26} delay="0s" />
          <Sparkle x={78} y={16} delay="0.3s" />
          <Sparkle x={88} y={50} delay="0.6s" />
        </>
      )}
    </svg>
  );
}

function MascotFace({ mood }: { mood: MascotMood }) {
  if (mood === 'sad') {
    return (
      <>
        <BulgeEye cx={37.1} cy={9.2} droopy />
        <BulgeEye cx={52.8} cy={10.7} droopy />
        <path d="M36.4 23.1 Q38.8 27.5 43.7 26.4" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }

  if (mood === 'happy' || mood === 'excited') {
    // Same round eyes as idle (arcs thin enough to read as eyebrows kept
    // merging into the head's own outline at this size) — happy instead
    // reads through a wide open grin plus the sparkles/bounce around it.
    return (
      <>
        <BulgeEye cx={37.5} cy={8.3} />
        <BulgeEye cx={53.2} cy={9.8} />
        <path d="M35 21 Q44 30 51 22" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
  }

  // idle — round bulging eyes on top of the head, per the reference
  return (
    <>
      <BulgeEye cx={37.5} cy={8.3} />
      <BulgeEye cx={53.2} cy={9.8} />
      <path d="M35.9 21.8 Q39 27 44.1 25.4" fill="none" stroke="var(--ink)" strokeWidth="2.1" strokeLinecap="round" />
    </>
  );
}

/** Big round "googly" eye sitting on top of the head, white sclera with an
 * ink ring, a large dark pupil, and a highlight — the reference's most
 * distinctive feature versus the earlier chibi-ball head. */
function BulgeEye({ cx, cy, droopy = false }: { cx: number; cy: number; droopy?: boolean }) {
  return (
    <>
      <circle cx={cx} cy={cy} r="6.4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.8" />
      <circle cx={cx} cy={cy + (droopy ? 1.6 : 0.6)} r="3.6" fill="var(--ink)" />
      <circle cx={cx + 1.8} cy={cy - 1.8} r="1.5" fill="var(--paper)" />
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
