import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Phase 8 (docs/progress/board.md) — safe to enable now that the last
    // no-restricted-syntax debt (arbitrary bg-[var(--...)] values) is cleaned up.
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  // docs/decision.md ADR-015 — the vocabulary corpus (lib/corpus/**) is fetched from
  // public/, not imported, so it costs 0 bundle bytes; this header is what makes
  // that fetch cheap on every load after the first. The version segment in the path
  // (/corpus/v1/...) is the cache-buster: bumping to v2 invalidates this immutable
  // cache for free, no header change needed.
  async headers() {
    return [
      {
        source: '/corpus/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
