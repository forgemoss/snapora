import { session } from 'electron';

/**
 * Apply Content-Security-Policy as a response header rather than a `<meta>` tag.
 * This lets us relax it for dev (Vite HMR uses ws://) and tighten it for prod.
 *
 * The renderer is sandboxed and contextIsolation is on, so CSP is defense in
 * depth: it limits what *bundled* scripts/styles can do if they're ever
 * compromised, but contextIsolation already prevents the renderer from
 * touching Node directly.
 */
export function installContentSecurityPolicy(): void {
  const isDev = !!process.env.ELECTRON_RENDERER_URL;

  const directives = [
    "default-src 'self'",
    // Vite's React preamble in dev injects an inline <script>, so 'unsafe-inline'
    // is required there. Production gets none of these relaxations.
    `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind + React inline-style
    "img-src 'self' data: blob: snap:",
    // The editor and HUD play .mp4 / .gif from the snap:// scheme; CSP needs
    // media-src explicitly because <video> falls back to default-src otherwise.
    "media-src 'self' blob: snap:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? ' ws://localhost:* http://localhost:* https://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];

  const csp = directives.join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Strip any existing CSP header before adding ours. HTTP headers are
    // case-insensitive but Node objects aren't — Vite (or other upstream)
    // sometimes returns `content-security-policy` lowercased, which would
    // sit alongside our `Content-Security-Policy` and the browser merges
    // multiple policies into the *most restrictive* — silently dropping
    // our `media-src` allowance for snap://.
    const headers: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(details.responseHeaders ?? {})) {
      if (k.toLowerCase() !== 'content-security-policy') headers[k] = v;
    }
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
}
