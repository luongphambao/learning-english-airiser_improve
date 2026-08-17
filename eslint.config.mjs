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
    // eslint-config-next enables six jsx-a11y rules, all at `warn`, and none of
    // them cover keyboard access, labelling, or heading order. These are the
    // rules that catch what an axe scan flags as serious/critical — see
    // scripts/a11y-scan.mjs for the runtime half of the same check.
    files: ["**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-activedescendant-has-tabindex": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/autocomplete-valid": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/iframe-has-title": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      // depth 2 (the default) misses labels that wrap their control and text in
      // a flex/stack wrapper, which is how every checkbox row in this app is built.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 5 }],
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/scope": "error",
      "jsx-a11y/tabindex-no-positive": "error",
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
