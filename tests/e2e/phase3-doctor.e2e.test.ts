/**
 * Phase 3 — `npx claude-mem doctor` end-to-end tests.
 *
 * The doctor command calls `process.exit`, so each test drives it through
 * a bun subprocess against a fake HOME sandbox. We assert:
 *   - Fresh HOME (nothing installed) exits `0` with `not-installed`-class
 *     findings — doctor must not error on an empty machine.
 *   - After a per-IDE install, `--ide <id>` reports `ok`.
 *   - After breaking the config, `--ide <id>` reports `fail` and exits 2.
 *   - `--fix` re-runs install and recovers the IDE to `ok`.
 *   - `--json` emits a parseable `DoctorReport` with a top-level `status`.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  createSandbox,
  destroySandbox,
  readSandboxFile,
  type Sandbox,
} from './harness.js';

const sandboxes: Sandbox[] = [];
function newSandbox(label: string): Sandbox {
  const s = createSandbox(label);
  sandboxes.push(s);
  return s;
}
afterEach(() => {
  while (sandboxes.length) {
    const s = sandboxes.pop();
    if (s) destroySandbox(s);
  }
});

const repoRoot = process.cwd();
const doctorModule = join(repoRoot, 'src/npx-cli/commands/doctor.ts');
const registryModule = join(repoRoot, 'src/services/integrations/registry.ts');

interface Result {
  exit: number;
  stdout: string;
  stderr: string;
}

function runDoctor(sandbox: Sandbox, args: string[] = []): Result {
  const script = `
    const mod = await import(${JSON.stringify(doctorModule)});
    await mod.runDoctorCommand(${JSON.stringify(args)});
  `;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    CLAUDE_CONFIG_DIR: join(sandbox.home, '.claude'),
    CLAUDE_MEM_DATA_DIR: join(sandbox.home, '.claude-mem'),
    OPENCODE_CONFIG_DIR: join(sandbox.home, '.config', 'opencode'),
    // Use a port that is almost certainly unbound so worker check times out
    // quickly without hitting the real worker running on 37777.
    CLAUDE_MEM_WORKER_PORT: '39991',
    // Disable any terminal coloring — cleaner string assertions.
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };
  const result = spawnSync('bun', ['-e', script], {
    cwd: sandbox.workspace,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    exit: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** Install an IDE via the registry in a subprocess, using the same env. */
function installIde(sandbox: Sandbox, ideId: string): void {
  const script = `
    const mod = await import(${JSON.stringify(registryModule)});
    const integration = mod.REGISTRY[${JSON.stringify(ideId)}];
    const result = await integration.install({ silent: true });
    process.exit(typeof result === 'number' ? result : 0);
  `;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    CLAUDE_CONFIG_DIR: join(sandbox.home, '.claude'),
    CLAUDE_MEM_DATA_DIR: join(sandbox.home, '.claude-mem'),
    OPENCODE_CONFIG_DIR: join(sandbox.home, '.config', 'opencode'),
  };
  const result = spawnSync('bun', ['-e', script], {
    cwd: sandbox.workspace,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (result.status !== 0) {
    throw new Error(`installIde(${ideId}) failed: ${result.stderr}\n${result.stdout}`);
  }
}

describe('Phase 3: doctor — fresh HOME', () => {
  it('reports not-installed cleanly on a brand-new HOME and exits 1 (warn) or 0', () => {
    const sandbox = newSandbox('doctor-fresh');
    const result = runDoctor(sandbox);
    // Fresh HOME will have a missing plugin → "not-installed" plus missing
    // data dir (warn) → exit 1.
    expect([0, 1]).toContain(result.exit);
    expect(result.stdout).toContain('Plugin install');
    expect(result.stdout).toContain('Plugin not installed');
    expect(result.stdout).toContain('IDE: Gemini CLI');
  });

  it('--json emits a parseable DoctorReport', () => {
    const sandbox = newSandbox('doctor-json');
    const result = runDoctor(sandbox, ['--json']);
    expect([0, 1, 2]).toContain(result.exit);

    // Everything above the JSON object should be empty (render() not called
    // when --json is set), but allow trailing newlines.
    const parsed = JSON.parse(result.stdout);
    expect(['ok', 'warn', 'fail', 'not-installed', 'unknown']).toContain(parsed.status);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(Array.isArray(parsed.sections)).toBe(true);
    const titles = parsed.sections.map((s: any) => s.title);
    expect(titles).toContain('Environment');
    expect(titles).toContain('Plugin install');
  });
});

describe('Phase 3: doctor --ide <id>', () => {
  it('reports ok after installing Gemini CLI', () => {
    const sandbox = newSandbox('doctor-gemini-ok');
    installIde(sandbox, 'gemini-cli');

    const result = runDoctor(sandbox, ['--ide', 'gemini-cli']);
    expect(result.exit).toBe(0);
    expect(result.stdout).toContain('Gemini CLI hooks include claude-mem');
  });

  it('reports not-installed before install', () => {
    // Seed ~/.gemini so detect() returns true, but skip the installer so
    // doctor can observe the "settings.json missing" finding.
    const sandbox = newSandbox('doctor-gemini-notinst');
    const { mkdirSync } = require('fs') as typeof import('fs');
    mkdirSync(join(sandbox.home, '.gemini'), { recursive: true });

    const result = runDoctor(sandbox, ['--ide', 'gemini-cli']);
    // Gemini detected, but no settings.json → not-installed → overall
    // status is not-installed → exit 0.
    expect(result.exit).toBe(0);
    expect(result.stdout).toContain('not found');
  });

  it('reports fail when config is corrupt and exits 2', () => {
    const sandbox = newSandbox('doctor-gemini-corrupt');
    installIde(sandbox, 'gemini-cli');

    // Corrupt the settings file intentionally.
    const settingsPath = join(sandbox.home, '.gemini', 'settings.json');
    writeFileSync(settingsPath, '{not valid json');

    const result = runDoctor(sandbox, ['--ide', 'gemini-cli']);
    expect(result.exit).toBe(2);
    expect(result.stdout).toContain('corrupt');
  });

  it('returns non-zero and hints for an unknown IDE', () => {
    const sandbox = newSandbox('doctor-unknown-ide');
    const result = runDoctor(sandbox, ['--ide', 'made-up-ide']);
    expect(result.exit).toBe(2);
    expect(result.stderr).toContain('Unknown IDE');
  });
});

describe('Phase 3: doctor --fix', () => {
  it('repairs a deleted Gemini hook and brings IDE back to ok', () => {
    const sandbox = newSandbox('doctor-fix-gemini');
    installIde(sandbox, 'gemini-cli');

    // Simulate the hook going missing — overwrite the file with an empty
    // object, which would otherwise make doctor report "not-installed".
    const settingsPath = join(sandbox.home, '.gemini', 'settings.json');
    writeFileSync(settingsPath, '{}');

    const before = runDoctor(sandbox, ['--ide', 'gemini-cli']);
    expect(before.stdout).toContain('lacks claude-mem');

    const after = runDoctor(sandbox, ['--ide', 'gemini-cli', '--fix']);
    expect(after.exit).toBe(0);
    expect(after.stdout).toContain('hooks include claude-mem');
    // settings.json now has claude-mem back
    const content = readSandboxFile(settingsPath);
    expect(content).toContain('claude-mem');
  });
});

describe('Phase 3: doctor --json contract', () => {
  it('each section has findings[] with { status, message }', () => {
    const sandbox = newSandbox('doctor-contract');
    installIde(sandbox, 'crush');

    const result = runDoctor(sandbox, ['--json']);
    const parsed = JSON.parse(result.stdout);

    for (const section of parsed.sections) {
      expect(typeof section.title).toBe('string');
      expect(Array.isArray(section.findings)).toBe(true);
      for (const finding of section.findings) {
        expect(['ok', 'warn', 'fail', 'not-installed', 'unknown']).toContain(finding.status);
        expect(typeof finding.message).toBe('string');
      }
    }
  });
});
