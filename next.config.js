/** @type {import('next').NextConfig} */

// R2 origin the /r2-audio proxy forwards to. No hardcoded bucket fallback:
// if this is unset the proxy rewrites are skipped rather than silently
// pointing at someone else's bucket.
const r2ProxyOrigin = String(process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '')
  .trim()
  .replace(/\/+$/, '');

// Optional custom CDN domain the browser hits directly (requires CORS on the bucket).
const audioCdnOrigin = (() => {
  const value = String(process.env.NEXT_PUBLIC_R2_CDN_URL || '').trim();
  if (!/^https?:\/\//i.test(value)) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
})();

if (!r2ProxyOrigin && !audioCdnOrigin) {
  console.warn('[next.config] No R2_PUBLIC_URL or NEXT_PUBLIC_R2_CDN_URL set — catalog audio will not resolve.');
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'serial=()',
      'bluetooth=()',
      'microphone=(self)',
      'clipboard-read=(self)',
      'clipboard-write=(self)',
    ].join(', '),
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https: data:",
      "connect-src 'self' https://plausible.io https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.elevenlabs.io https://pixabay.com https://pixabay.com/api/ https://*.r2.cloudflarestorage.com https://*.r2.dev https://irc-ws.chat.twitch.tv wss://irc-ws.chat.twitch.tv wss://irc-ws.chat.twitch.tv:443"
        + (audioCdnOrigin ? ` ${audioCdnOrigin}` : ''),
      "font-src 'self'",
      "worker-src 'self' blob:",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const privateRouteHeaders = [
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['ffmpeg-static'],

  // Allow importing the Howler audio library which uses browser globals
  // eslint-disable-next-line no-unused-vars
  webpack(config, { isServer }) {
    if (isServer) {
      // Howler and audio APIs are browser-only – mark as false so Webpack
      // replaces imports with an empty module instead of referencing a
      // non-existent global (the 'Howl' global does not exist server-side).
      config.externals = [
        ...(config.externals || []),
        { howler: false },
      ];
    }
    return config;
  },

  // Proxy R2 audio through Next.js to avoid CORS issues with pub-*.r2.dev.
  // Prefer NEXT_PUBLIC_R2_CDN_URL (custom domain + CORS) so audio bytes skip this hop.
  async rewrites() {
    if (!r2ProxyOrigin) return [];
    return [
      {
        source: '/r2-audio/:path*',
        destination: `${r2ProxyOrigin}/:path*`,
      },
      {
        source: '/Saved%20sounds/:path*',
        destination: `${r2ProxyOrigin}/Saved%20sounds/:path*`,
      },
      {
        source: '/Saved sounds/:path*',
        destination: `${r2ProxyOrigin}/Saved%20sounds/:path*`,
      },
    ];
  },

  // Security headers
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/login',
        headers: privateRouteHeaders,
      },
      {
        source: '/dashboard',
        headers: privateRouteHeaders,
      },
      {
        source: '/obs',
        headers: privateRouteHeaders,
      },
    ];
  },
};

export default nextConfig;
