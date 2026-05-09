import { protocol } from 'electron';
import { readFile } from 'node:fs/promises';
import logger from '@main/logger';

/**
 * The renderer is served from http://localhost:5173 in dev and file://… in prod.
 * In both cases, loading captured screenshots via raw `file://` URLs trips
 * Electron's web-security ("Not allowed to load local resource"). We register
 * `snap://` as a privileged scheme that reads the file from disk and returns
 * a Response, then send `snap:///abs/path.png` to the renderer in IPC.
 */

export const SNAP_PROTOCOL = 'snap';

// MUST run before app.whenReady — call once at module load via index.ts.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SNAP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function mimeTypeFor(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

export function registerSnapProtocol(): void {
  protocol.handle(SNAP_PROTOCOL, async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);
    try {
      const data = await readFile(filePath);
      logger.info('snap: served', { filePath, bytes: data.byteLength });
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': mimeTypeFor(filePath) },
      });
    } catch (err) {
      logger.warn('snap: read failed', { url: request.url, filePath, err });
      return new Response('Not found', { status: 404 });
    }
  });
  logger.info('snap protocol: registered');
}

/**
 * Convert an absolute local file path to a snap:// URL for the renderer.
 *
 * We pin a fixed host (`capture`) because the WHATWG URL parser interprets
 * the first path segment as a host with `standard: true` schemes — and
 * lowercases it. With `snap:///Users/arya/foo.png` the parser turns it
 * into `snap://users/arya/foo.png` and we can't read that file.
 */
export function toSnapUrl(absolutePath: string): string {
  return `snap://capture${encodeURI(absolutePath)}`;
}
