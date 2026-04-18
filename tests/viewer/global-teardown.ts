/**
 * Stops the dev server started in global-setup and cleans up the
 * isolated tmp data dir. Best-effort: does not throw if the state
 * file is missing.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default async function globalTeardown(): Promise<void> {
  const stateFile = process.env.CLAUDE_MEM_VIEWER_TEST_STATE_FILE;
  if (!stateFile || !fs.existsSync(stateFile)) return;

  let state: { pid?: number; dataDir?: string; port?: string } = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch {
    return;
  }

  if (state.pid) {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch {
      /* already dead */
    }
  }

  const tmpRoot = path.join(os.tmpdir(), 'claude-mem-viewer-test-');
  if (state.dataDir && state.dataDir.startsWith(tmpRoot)) {
    try {
      fs.rmSync(state.dataDir, { recursive: true, force: true });
    } catch {
      /* tolerate leftover handles */
    }
  }
}
