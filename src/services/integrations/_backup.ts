/**
 * Shared backup + restore helper for IDE installers.
 *
 * Every installer under `src/services/integrations/` touches at least one
 * user-authored config file. Before writing, we copy the current file to a
 * timestamped directory under `~/.claude-mem/backups/` so an uninstall
 * (or a failed install) can restore the user's previous state byte-for-byte.
 *
 * Design goals:
 *   - Zero network, zero side effects outside `DATA_DIR/backups/`.
 *   - Safe on macOS, Linux, Windows (absolute paths only; `fs.cpSync`
 *     handles file copy uniformly).
 *   - Prune to the most recent N backup sessions to avoid unbounded growth.
 *   - Never throw on backup failure — backups are best-effort.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'fs';
import { dirname, isAbsolute, join, relative } from 'path';
import { BACKUPS_DIR, DATA_DIR } from '../../shared/paths.js';

/** Keep at most this many backup sessions. Oldest sessions are pruned first. */
const MAX_BACKUP_SESSIONS = 10;

/**
 * Stable identifier for a single "backup session" — typically the timestamp
 * of the overall install/uninstall invocation. All files captured within
 * one run share a session id so they can be restored atomically.
 */
export type BackupSessionId = string;

/**
 * Create a new backup session and return its id. The caller passes the id
 * to every subsequent `backupFile()` call within the same run.
 */
export function createBackupSession(label: string = 'install'): BackupSessionId {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return `${timestamp}_${sanitize(label)}`;
}

/**
 * Copy a file into the given backup session. No-op if the source file does
 * not exist, so callers can always call this before writing even if the
 * target is a brand-new file.
 *
 * The backup preserves the file's absolute path encoded as a sub-directory
 * so restoration is unambiguous.
 */
export function backupFile(session: BackupSessionId, sourcePath: string): void {
  try {
    if (!existsSync(sourcePath)) return;

    const sessionDir = getSessionDirectory(session);
    const destPath = mapSourceToSession(sessionDir, sourcePath);
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(sourcePath, destPath);

    // Record an "absent" marker for files that existed so restore knows
    // this file was touched by the session. We don't need an explicit
    // marker because the presence of the backup file itself is the marker.
  } catch {
    // Backup is best-effort. The actual install/uninstall still proceeds.
  }
}

/**
 * Restore every file captured within a backup session to its original path.
 *
 * Files that were backed up will be overwritten. Files created by the
 * install (and therefore not present in the backup session) are not touched
 * here — the caller's uninstaller is responsible for deleting new files.
 */
export function restoreSession(session: BackupSessionId): number {
  const sessionDir = getSessionDirectory(session);
  if (!existsSync(sessionDir)) return 0;

  let restored = 0;
  for (const abs of walkFiles(sessionDir)) {
    const originalPath = mapSessionToSource(sessionDir, abs);
    try {
      mkdirSync(dirname(originalPath), { recursive: true });
      copyFileSync(abs, originalPath);
      restored++;
    } catch {
      // Skip files we cannot restore; surface errors through caller logs.
    }
  }
  return restored;
}

/**
 * Delete old backup sessions, keeping the N most recent. Called at the
 * end of every install / uninstall. Never throws.
 */
export function pruneBackups(max: number = MAX_BACKUP_SESSIONS): void {
  try {
    if (!existsSync(BACKUPS_DIR)) return;
    const entries = readdirSync(BACKUPS_DIR)
      .map((name) => ({
        name,
        path: join(BACKUPS_DIR, name),
      }))
      .filter((entry) => {
        try {
          return statSync(entry.path).isDirectory();
        } catch {
          return false;
        }
      })
      // Session ids start with ISO timestamps, so lexical sort is chronological.
      .sort((a, b) => a.name.localeCompare(b.name));

    const toRemove = entries.slice(0, Math.max(0, entries.length - max));
    for (const entry of toRemove) {
      try {
        rmSync(entry.path, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
  } catch {
    // Pruning is best-effort; never surface errors to the caller.
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function getSessionDirectory(session: BackupSessionId): string {
  return join(BACKUPS_DIR, session);
}

/**
 * Encode an absolute source path into the session directory. On POSIX:
 *   /home/a/.gemini/settings.json  →  <session>/abs/home/a/.gemini/settings.json
 * On Windows:
 *   C:\Users\a\.gemini\settings.json  →  <session>\abs\C\Users\a\.gemini\settings.json
 */
function mapSourceToSession(sessionDir: string, sourcePath: string): string {
  if (!isAbsolute(sourcePath)) {
    throw new Error(`backup: refusing to back up relative path: ${sourcePath}`);
  }
  const normalized = sourcePath
    .replace(/^([A-Za-z]):/, '$1') // drop drive colon on Windows
    .replace(/^[/\\]+/, ''); // drop leading slash
  return join(sessionDir, 'abs', normalized);
}

/** Reverse of `mapSourceToSession`. */
function mapSessionToSource(sessionDir: string, sessionedPath: string): string {
  const rel = relative(join(sessionDir, 'abs'), sessionedPath);
  if (process.platform === 'win32' && /^[A-Za-z][\\/]/.test(rel)) {
    const drive = rel[0];
    const rest = rel.slice(1).replace(/^[\\/]/, '');
    return `${drive}:\\${rest}`;
  }
  return `/${rel}`;
}

function* walkFiles(root: string): Generator<string> {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(abs);
    } else if (entry.isFile()) {
      yield abs;
    }
  }
}

function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40) || 'session';
}

/** Test helper — where backups live. Primarily useful for assertions. */
export function backupsRoot(): string {
  return BACKUPS_DIR;
}

/** Test helper — DATA_DIR (drives where backups land). */
export function backupsDataDir(): string {
  return DATA_DIR;
}
