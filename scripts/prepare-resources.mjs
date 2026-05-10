#!/usr/bin/env node
/**
 * Fetch the bundled native binaries Snapora ships in `resources/bin/`.
 *
 * - Reads `scripts/manifest.json`.
 * - For each declared binary + arch, downloads, sha256-verifies (or, if
 *   the manifest's sha is empty, locks the discovered sha back in), and
 *   writes the resulting executable into `resources/bin/<name>-<arch>`.
 * - Idempotent: skips if the on-disk binary already matches the manifest sha.
 * - Run via `npm run prepare:resources` (chained from `postinstall`).
 *
 * This is a build script, so ESM is fine — only the Electron main process
 * is locked to CJS (per ADR-0002).
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MANIFEST_PATH = join(HERE, 'manifest.json');
const BIN_DIR = join(ROOT, 'resources', 'bin');

async function sha256(path) {
  const buf = await readFile(path);
  return createHash('sha256').update(buf).digest('hex');
}

async function downloadTo(url, outPath) {
  // Use curl — node:fetch streaming + redirects + progress is still finicky
  // and we already require macOS for everything, so curl is always present.
  const result = spawnSync('curl', ['-L', '-#', '--fail', '-o', outPath, url], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`curl failed (${result.status}) fetching ${url}`);
  }
}

function unzipFlat(zipPath, destDir) {
  const result = spawnSync('unzip', ['-o', '-q', '-d', destDir, zipPath], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`unzip failed (${result.status}) extracting ${zipPath}`);
  }
}

async function findExecutable(rootDir, name) {
  // The downloaded archive may contain the binary at root or one level deep.
  // We just probe a couple of likely paths.
  const candidates = [join(rootDir, name), join(rootDir, name + '_g'), join(rootDir, 'bin', name)];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fallback: shell out to `find`.
  const result = spawnSync('find', [rootDir, '-name', name, '-type', 'f', '-perm', '+0100'], {
    encoding: 'utf8',
  });
  const lines = result.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines[0]) return lines[0];
  throw new Error(`could not find executable ${name} under ${rootDir}`);
}

async function ensureBinary(name, arch, entry, manifest) {
  const targetPath = join(BIN_DIR, `${name}-${arch}`);
  await mkdir(BIN_DIR, { recursive: true });

  // Skip if already present and matches the locked sha.
  if (entry.sha256 && existsSync(targetPath)) {
    const have = await sha256(targetPath);
    if (have === entry.sha256) {
      console.log(`[prepare] ${name}-${arch}: up to date`);
      return false;
    }
    console.log(`[prepare] ${name}-${arch}: sha changed (${have} != ${entry.sha256}); refreshing`);
  }

  const tmpDir = join(tmpdir(), `snapora-prepare-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  const zipPath = join(tmpDir, 'archive.zip');

  console.log(`[prepare] ${name}-${arch}: downloading ${entry.url}`);
  await downloadTo(entry.url, zipPath);
  unzipFlat(zipPath, tmpDir);
  const exePath = await findExecutable(tmpDir, name);

  await mkdir(dirname(targetPath), { recursive: true });
  // Move into place + chmod 0755.
  await writeFile(targetPath, await readFile(exePath), { mode: 0o755 });
  const finalSha = await sha256(targetPath);
  await rm(tmpDir, { recursive: true, force: true });

  if (!entry.sha256) {
    entry.sha256 = finalSha;
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[prepare] ${name}-${arch}: locked sha256 ${finalSha}`);
    return true;
  }
  if (finalSha !== entry.sha256) {
    throw new Error(
      `[prepare] ${name}-${arch}: sha256 mismatch — expected ${entry.sha256}, got ${finalSha}. Refusing to ship a binary that doesn't match the locked manifest.`,
    );
  }
  console.log(`[prepare] ${name}-${arch}: verified (${finalSha.slice(0, 12)}…)`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  // By default we prepare only the host arch for fast `npm install`. CI / dist
  // passes `--all-archs` to fetch both arm64 and x64.
  const wantAll = args.includes('--all-archs');
  const hostArch = process.arch === 'arm64' ? 'arm64' : 'x64';

  const manifestRaw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  for (const [name, decl] of Object.entries(manifest)) {
    if (name.startsWith('_')) continue; // _comment, etc.
    const archs = wantAll ? ['arm64', 'x64'] : [hostArch];
    for (const arch of archs) {
      const entry = decl[arch];
      if (!entry) {
        throw new Error(`manifest: ${name} missing arch ${arch}`);
      }
      try {
        await ensureBinary(name, arch, entry, manifest);
      } catch (err) {
        // Don't break `npm install`; warn so the user can run it later.
        console.warn(`[prepare] ${name}-${arch}: ${err.message}`);
        if (process.env.CI || process.env.SNAPORA_REQUIRE_BIN) {
          process.exit(1);
        }
      }
    }
  }

  // Friendly stat
  try {
    const s = await stat(BIN_DIR);
    if (s.isDirectory()) {
      const files = (
        await import('node:fs/promises').then((m) => m.readdir(BIN_DIR))
      ).join(', ');
      console.log(`[prepare] resources/bin/ contains: ${files || '(empty)'}`);
    }
  } catch {
    /* no-op */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
