import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '@main/logger';
import type { SelectionRect } from '@shared/types';

const execFileAsync = promisify(execFile);

/**
 * macOS window-bounds via System Events (AppleScript). Used by the window
 * recording flow so we can crop ffmpeg's display capture down to JUST the
 * picked window's rect — instead of recording the full display + menu bar.
 *
 * Requires Accessibility permission (which we already prompt for via the
 * effects overlay). Returns `null` on permission failure or no match.
 *
 * Matching strategy: enumerate all visible windows of all visible processes,
 * match by window title (the only stable handle desktopCapturer gives us
 * back). On title collision (rare for the user's foreground window), we
 * pick the first match — same heuristic CleanShot uses pre-SCK.
 */

interface OsaWindow {
  app: string;
  title: string;
  rect: SelectionRect;
}

// JavaScript-for-Automation (JXA) script: enumerates windows via the public
// Quartz CGWindowListCopyWindowInfo API. Crucially this is a C function
// call, NOT an Apple Event — so we don't need Automation permission for
// "System Events" (the previous AppleScript approach did and was failing
// silently when the user hadn't granted it). The flags (1<<0)|(1<<4) are
// kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements.
//
// JXA doesn't auto-bind C functions; we declare the signature ourselves.
// Output: one window per line, tab-separated app|title|x|y|w|h.
const JXA_SCRIPT = `
ObjC.import('Cocoa');
ObjC.bindFunction('CGWindowListCopyWindowInfo', ['id', ['uint32', 'uint32']]);
const opts = (1 << 0) | (1 << 4);
const arr = $.CGWindowListCopyWindowInfo(opts, 0);
const lines = [];
for (let i = 0; i < arr.count; i++) {
  const dict = arr.objectAtIndex(i);
  const layer = ObjC.unwrap(dict.objectForKey('kCGWindowLayer'));
  if (layer !== 0) continue;
  const owner = ObjC.unwrap(dict.objectForKey('kCGWindowOwnerName')) || '';
  const name = ObjC.unwrap(dict.objectForKey('kCGWindowName')) || '';
  const b = dict.objectForKey('kCGWindowBounds');
  if (!b) continue;
  const x = Math.round(ObjC.unwrap(b.objectForKey('X')));
  const y = Math.round(ObjC.unwrap(b.objectForKey('Y')));
  const w = Math.round(ObjC.unwrap(b.objectForKey('Width')));
  const h = Math.round(ObjC.unwrap(b.objectForKey('Height')));
  if (w < 50 || h < 50) continue;
  lines.push([owner, name, x, y, w, h].join('\\t'));
}
lines.join('\\n');
`;

async function listWindows(): Promise<OsaWindow[]> {
  try {
    const { stdout } = await execFileAsync(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', JXA_SCRIPT],
      { timeout: 2000, maxBuffer: 1024 * 256 },
    );
    const out: OsaWindow[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 6) continue;
      const app = parts[0]!;
      const title = parts[1]!;
      const xi = parseInt(parts[2]!, 10);
      const yi = parseInt(parts[3]!, 10);
      const wi = parseInt(parts[4]!, 10);
      const hi = parseInt(parts[5]!, 10);
      if (!Number.isFinite(xi + yi + wi + hi)) continue;
      out.push({ app, title, rect: { x: xi, y: yi, width: wi, height: hi } });
    }
    logger.info('windowBounds: enumerated', { count: out.length });
    return out;
  } catch (err) {
    // Surface the real stderr — Node's exec rejection message just says
    // "Command failed".
    const e = err as { stderr?: string; code?: number };
    const stderr = (e.stderr ?? '').trim();
    logger.warn('windowBounds: osascript failed', {
      code: e.code,
      stderr: stderr.slice(0, 400),
    });
    return [];
  }
}

/**
 * Look up the bounds of the window with the given title. Pass the optional
 * `appHint` (e.g. from desktopCapturer) to disambiguate when multiple
 * windows share a title.
 */
export async function findWindowBounds(
  title: string,
  appHint?: string | null,
): Promise<SelectionRect | null> {
  const wins = await listWindows();
  if (wins.length === 0) return null;
  const lowered = title.trim().toLowerCase();
  // Exact title + app match wins.
  if (appHint) {
    const hit = wins.find(
      (w) => w.title.toLowerCase() === lowered && w.app.toLowerCase() === appHint.toLowerCase(),
    );
    if (hit) return hit.rect;
  }
  // Exact title only.
  const exact = wins.find((w) => w.title.toLowerCase() === lowered);
  if (exact) return exact.rect;
  // Substring match — desktopCapturer sometimes adds prefixes/suffixes.
  const fuzzy = wins.find(
    (w) => w.title.toLowerCase().includes(lowered) || lowered.includes(w.title.toLowerCase()),
  );
  return fuzzy?.rect ?? null;
}
