/**
 * Phase 2 — symmetric uninstall for MCP-tier IDEs.
 *
 * Before Phase 2, MCP IDEs had only installers. Phase 2 added per-IDE
 * uninstallers via the `Integration` contract. This file asserts that
 * install → uninstall restores the user's config file to a state that
 * contains no claude-mem references.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import {
  createSandbox,
  destroySandbox,
  readSandboxFile,
  seedFile,
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

/**
 * Drive a per-IDE `Integration` through install → uninstall in a subprocess.
 * Uses the `REGISTRY` from `src/services/integrations/registry.ts` so the
 * test exercises the Phase 2 contract end-to-end.
 */
function installUninstallCycle(
  sandbox: Sandbox,
  ideId: string,
): { install: number; uninstall: number } {
  const repoRoot = process.cwd().includes('workspace')
    ? process.cwd().split('workspace')[0] + 'workspace'
    : process.cwd();
  const registryPath = join(repoRoot, 'src/services/integrations/registry.ts');

  const script = `
    const mod = await import(${JSON.stringify(registryPath)});
    const integration = mod.REGISTRY[${JSON.stringify(ideId)}];
    if (!integration) throw new Error('unknown ide: ${ideId}');
    const i = await integration.install();
    if (i !== 0) { console.error('install failed'); process.exit(10 + i); }
    const u = await integration.uninstall();
    if (u !== 0) { console.error('uninstall failed'); process.exit(20 + u); }
    process.exit(0);
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

  // Distinguish install vs uninstall failure via exit code convention above.
  const code = result.status ?? -1;
  if (code === 0) return { install: 0, uninstall: 0 };
  if (code >= 10 && code < 20) return { install: code - 10, uninstall: -1 };
  if (code >= 20 && code < 30) return { install: 0, uninstall: code - 20 };
  throw new Error(
    `subprocess crashed (exit ${code}): ${result.stderr}\n${result.stdout}`,
  );
}

// ---------------------------------------------------------------------------
// One test per MCP IDE — install then uninstall, assert config has no
// claude-mem references afterwards.
// ---------------------------------------------------------------------------

interface SymmetricCase {
  id: string;
  configPath: (s: Sandbox) => string;
  configRoot: 'home' | 'workspace';
}

const CASES: SymmetricCase[] = [
  {
    id: 'copilot-cli',
    configPath: (s) => join(s.home, '.github', 'copilot', 'mcp.json'),
    configRoot: 'home',
  },
  {
    id: 'antigravity',
    configPath: (s) => join(s.home, '.gemini', 'antigravity', 'mcp_config.json'),
    configRoot: 'home',
  },
  {
    id: 'crush',
    configPath: (s) => join(s.home, '.config', 'crush', 'mcp.json'),
    configRoot: 'home',
  },
  {
    id: 'roo-code',
    configPath: (s) => join(s.workspace, '.roo', 'mcp.json'),
    configRoot: 'workspace',
  },
];

for (const c of CASES) {
  describe(`Phase 2: ${c.id} symmetric uninstall`, () => {
    it(`install → uninstall leaves no claude-mem references in ${c.id} config`, () => {
      const sandbox = newSandbox(`sym-${c.id}`);

      const cycle = installUninstallCycle(sandbox, c.id);
      expect(cycle.install).toBe(0);
      expect(cycle.uninstall).toBe(0);

      // Config file may be deleted if it becomes empty, or it may remain
      // without claude-mem references — both are acceptable.
      const content = readSandboxFile(c.configPath(sandbox));
      if (content !== null) {
        expect(content).not.toContain('claude-mem');
      }
    });

    it(`preserves unrelated user entries through install → uninstall (${c.id})`, () => {
      const sandbox = newSandbox(`sym-${c.id}-preserve`);
      const configPath = c.configPath(sandbox);
      // Pre-seed the same shape the installer expects so merge/preserve applies.
      const key = c.id === 'copilot-cli' ? 'servers' : 'mcpServers';
      seedFile(
        configPath,
        JSON.stringify(
          {
            [key]: { 'other-tool': { command: 'node', args: ['/x.js'] } },
            myUserKey: 'keep-me',
          },
          null,
          2,
        ),
      );

      const cycle = installUninstallCycle(sandbox, c.id);
      expect(cycle.install).toBe(0);
      expect(cycle.uninstall).toBe(0);

      const after = readSandboxFile(configPath);
      expect(after).not.toBeNull();
      const parsed = JSON.parse(after!);
      expect(parsed.myUserKey).toBe('keep-me');
      expect(parsed[key]['other-tool']).toBeDefined();
      expect(parsed[key]['claude-mem']).toBeUndefined();
    });
  });
}

describe('Phase 2: goose symmetric uninstall (YAML)', () => {
  it('install → uninstall strips claude-mem from config.yaml', () => {
    const sandbox = newSandbox('sym-goose');

    const cycle = installUninstallCycle(sandbox, 'goose');
    expect(cycle.install).toBe(0);
    expect(cycle.uninstall).toBe(0);

    const content = readSandboxFile(
      join(sandbox.home, '.config', 'goose', 'config.yaml'),
    );
    if (content !== null) {
      expect(content).not.toContain('claude-mem');
    }
  });

  it('preserves existing Goose config through install → uninstall', () => {
    const sandbox = newSandbox('sym-goose-preserve');
    const cfgPath = join(sandbox.home, '.config', 'goose', 'config.yaml');
    seedFile(
      cfgPath,
      [
        'theme: dark',
        'mcpServers:',
        '  other-tool:',
        '    command: /bin/other',
        '',
      ].join('\n'),
    );

    const cycle = installUninstallCycle(sandbox, 'goose');
    expect(cycle.install).toBe(0);
    expect(cycle.uninstall).toBe(0);

    const after = readSandboxFile(cfgPath);
    expect(after).not.toBeNull();
    expect(after!).toContain('theme: dark');
    expect(after!).toContain('other-tool:');
    expect(after!).not.toContain('claude-mem');
  });
});

describe('Phase 2: warp symmetric uninstall', () => {
  it('install → uninstall removes WARP.md context block', () => {
    const sandbox = newSandbox('sym-warp');

    const cycle = installUninstallCycle(sandbox, 'warp');
    expect(cycle.install).toBe(0);
    expect(cycle.uninstall).toBe(0);

    const warpMd = readSandboxFile(join(sandbox.workspace, 'WARP.md'));
    // WARP.md may be deleted when empty, or retain only user content.
    if (warpMd !== null) {
      expect(warpMd).not.toContain('<claude-mem-context>');
    }
  });
});
