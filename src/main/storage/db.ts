import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import logger from '@main/logger';
import type { CaptureMode } from '@shared/types';

/**
 * Capture history — local SQLite, no remote sync.
 *
 * Schema (current):
 *   captures(id, file_path, captured_at ISO, mode, width, height)
 * Migrations are applied in-order at open time.
 */

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const dbPath = join(app.getPath('userData'), 'snapora.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  applyMigrations(db);
  logger.info('db: opened', { path: dbPath });
  return db;
}

const MIGRATIONS: { name: string; up: string }[] = [
  {
    name: '0001-create-captures',
    up: `
      CREATE TABLE captures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        mode TEXT NOT NULL,
        width INTEGER,
        height INTEGER
      );
      CREATE INDEX idx_captures_captured_at ON captures(captured_at DESC);
    `,
  },
  {
    name: '0002-add-kind-and-duration',
    up: `
      ALTER TABLE captures ADD COLUMN kind TEXT NOT NULL DEFAULT 'screenshot';
      ALTER TABLE captures ADD COLUMN duration_ms INTEGER;
      CREATE INDEX idx_captures_kind ON captures(kind);
    `,
  },
];

function applyMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    database
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => (row as { name: string }).name),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    database.exec('BEGIN');
    try {
      database.exec(migration.up);
      database
        .prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString());
      database.exec('COMMIT');
      logger.info('db: migration applied', { name: migration.name });
    } catch (err) {
      database.exec('ROLLBACK');
      logger.error('db: migration failed', { name: migration.name, err });
      throw err;
    }
  }
}

export type CaptureKind = 'screenshot' | 'recording';

export interface CaptureRow {
  id: number;
  filePath: string;
  capturedAt: string;
  mode: CaptureMode;
  width: number | null;
  height: number | null;
  kind: CaptureKind;
  durationMs: number | null;
  /** Whether the file still exists on disk (computed at read time, not stored). */
  exists: boolean;
}

export interface InsertCaptureInput {
  filePath: string;
  capturedAt: string;
  mode: CaptureMode;
  width: number | null;
  height: number | null;
  /** Defaults to 'screenshot' if omitted. */
  kind?: CaptureKind;
  /** Total duration of a recording in ms; null/undefined for screenshots. */
  durationMs?: number | null;
}

export function insertCapture(input: InsertCaptureInput): number {
  const result = getDb()
    .prepare(
      `INSERT INTO captures (file_path, captured_at, mode, width, height, kind, duration_ms)
       VALUES (@filePath, @capturedAt, @mode, @width, @height, @kind, @durationMs)`,
    )
    .run({
      ...input,
      kind: input.kind ?? 'screenshot',
      durationMs: input.durationMs ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function listCaptures(limit = 100): CaptureRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, file_path, captured_at, mode, width, height, kind, duration_ms
       FROM captures
       ORDER BY captured_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    file_path: string;
    captured_at: string;
    mode: CaptureMode;
    width: number | null;
    height: number | null;
    kind: CaptureKind;
    duration_ms: number | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    filePath: r.file_path,
    capturedAt: r.captured_at,
    mode: r.mode,
    width: r.width,
    height: r.height,
    kind: r.kind,
    durationMs: r.duration_ms,
    exists: existsSync(r.file_path),
  }));
}

export function deleteCapture(id: number): void {
  getDb().prepare('DELETE FROM captures WHERE id = ?').run(id);
}

export function clearCaptures(): void {
  getDb().exec('DELETE FROM captures');
}

export function closeDb(): void {
  if (!db) return;
  db.close();
  db = null;
}
