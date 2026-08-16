import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next ships a legacy (.eslintrc-style) config; FlatCompat is the
// documented bridge for consuming it from ESLint 9's flat config format.
const compat = new FlatCompat({ baseDirectory: __dirname });

export default defineConfig([
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "docs/ui/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // lib/srs/**, lib/level/**, and lib/leaderboard/** must stay pure: no
    // wall-clock reads. `now` is always an injected parameter — see
    // docs/decision.md ADR-004/007/017/023 and the timezone bug this used to hide
    // (lib/srs.ts mixing Asia/Ho_Chi_Minh and local tz).
    files: ["lib/srs/**/*.ts", "lib/level/**/*.ts", "lib/leaderboard/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "lib/srs/**, lib/level/**, and lib/leaderboard/** must be pure — take `now` as a parameter instead of Date.now().",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "lib/srs/**, lib/level/**, and lib/leaderboard/** must be pure — take `now` as a parameter instead of new Date().",
        },
      ],
    },
  },
  {
    // Design tokens must be consumed as Tailwind utilities (bg-paper, text-ink-soft)
    // after Phase 1, not as arbitrary CSS-var values — see docs/design.md §3.
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\[var\\(--/]",
          message: "Use a design-system utility (e.g. bg-paper) instead of an arbitrary bg-[var(--...)] value.",
        },
      ],
    },
  },
]);
