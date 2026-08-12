# Multi-stage build for the Next.js app (output: 'standalone' in next.config.ts —
# see there for why: the standalone build traces only the deps each route actually
# needs into .next/standalone, instead of shipping the full node_modules tree).
#
# No secrets/API keys are needed at build time: every env var this app reads
# (AI_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY, GOOGLE_CLIENT_*, ...) is read
# server-side at request time (lib/ai/config.ts, lib/auth/google.ts), never
# inlined into the client bundle — there are no NEXT_PUBLIC_* vars in this repo.
# They're supplied at `docker run` time instead (see README/docs for the full list
# in .env.example).
#
# Debian slim, not Alpine: Tailwind v4's `lightningcss` (pulled in via
# @tailwindcss/postcss) ships prebuilt native binaries per platform, and the
# `-musl` variant (Alpine's libc) reliably fails to resolve under `npm ci` even
# though package-lock.json lists it as an optionalDependency — a known class of
# bug when npm picks the platform-specific optional package on Alpine ("Cannot
# find module '../lightningcss.linux-x64-musl.node'" at `next build`/`next
# start`, since next/font's CSS pipeline loads it too). The `-gnu` variant this
# image needs instead resolves reliably, at the cost of a larger base image.
FROM node:22-bookworm-slim AS base

# ---- deps: install once, cached across builds as long as the lockfile is unchanged
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal runtime image — only the standalone server + static assets
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
