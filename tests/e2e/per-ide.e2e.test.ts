/**
 * Per-IDE end-to-end smoke tests.
 *
 * For each IDE integration we:
 *   1. Spin up a fake HOME + workspace sandbox.
 *   2. Invoke the installer inside a bun subprocess.
 *   3. Assert the installer exited 0.
 *   4. Assert the expected config file(s) now exist under the sandbox
 *      and contain claude-mem markers.
 *   5. Run the uninstaller (if any) and assert claude-mem traces are gone.
 *
 * Non-goals:
 *   - We do NOT stand up the worker, DB, or network server. Installers
 *     already gracefully fall back when the worker is absent.
 *   - We do NOT test the hook command execution path. That belongs to
 *     `tests/integration/hook-execution-e2e.test.ts` (already covered).
 *
 * Runs under `bun test tests/e2e/`.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createSandbox,
  destroySandbox,
  readSandboxFile,
  runInstaller,
  runUninstaller,
  seedFile,
  type IdeId,
  type Sandbox,
} from './harness.js';

// Global pool so afterEach can clean up even if a test throws.
const sandboxes: Sandbox[] = [];

function newSandbox(label: string): Sandbox {
  const sandbox = createSandbox(label);
  sandboxes.push(sandbox);
  return sandbox;
}

afterEach(() => {
  while (sandboxes.length > 0) {
    const sandbox = sandboxes.pop();
    if (sandbox) destroySandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// Pre-flight: verify the subprocess runner itself works before running 13
// IDE tests. Catches environment issues (missing bun, bad module path) early.
// ---------------------------------------------------------------------------

describe('E2E harness', () => {
  it('creates and tears down a sandbox cleanly', () => {
    const sandbox = newSandbox('sanity');
    expect(existsSync(sandbox.home)).toBe(true);
    expect(existsSync(sandbox.workspace)).toBe(true);
    expect(existsSync(join(sandbox.marketplace, 'plugin', 'scripts', 'worker-service.cjs'))).toBe(true);
    expect(existsSync(join(sandbox.marketplace, 'plugin', 'scripts', 'mcp-server.cjs'))).toBe(true);
    expect(existsSync(join(sandbox.marketplace, 'openclaw', 'dist', 'index.js'))).toBe(true);
    expect(existsSync(join(sandbox.marketplace, 'dist', 'opencode-plugin', 'index.js'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Per-IDE tests
// ---------------------------------------------------------------------------

describe('IDE: gemini-cli', () => {
  it('writes hooks to ~/.gemini/settings.json and removes them on uninstall', () => {
    const sandbox = newSandbox('gemini');

    const install = runInstaller(sandbox, 'gemini-cli');
    expect(install.exitCode).toBe(0);

    const settingsPath = join(sandbox.home, '.gemini', 'settings.json');
    const settings = readSandboxFile(settingsPath);
    expect(settings).not.toBeNull();
    const parsed = JSON.parse(settings!);
    expect(parsed.hooks).toBeDefined();
    expect(parsed.hooks.AfterTool).toBeDefined();
    // claude-mem hook must be present by name
    const hookStr = JSON.stringify(parsed.hooks);
    expect(hookStr).toContain('claude-mem');

    // GEMINI.md placeholder should also be written
    const geminiMd = readSandboxFile(join(sandbox.home, '.gemini', 'GEMINI.md'));
    expect(geminiMd).not.toBeNull();
    expect(geminiMd!).toContain('<claude-mem-context>');

    const uninstall = runUninstaller(sandbox, 'gemini-cli');
    expect(uninstall.exitCode).toBe(0);

    const after = readSandboxFile(settingsPath);
    expect(after).not.toBeNull();
    const afterParsed = JSON.parse(after!);
    // Either hooks object is gone or it has no claude-mem refs
    const afterStr = JSON.stringify(afterParsed.hooks ?? {});
    expect(afterStr).not.toContain('claude-mem');

    const mdAfter = readSandboxFile(join(sandbox.home, '.gemini', 'GEMINI.md'));
    // File may still exist, but tagged block must be gone
    if (mdAfter !== null) {
      expect(mdAfter).not.toContain('<claude-mem-context>');
    }
  });

  it('preserves existing user settings in ~/.gemini/settings.json', () => {
    const sandbox = newSandbox('gemini-merge');

    const settingsPath = join(sandbox.home, '.gemini', 'settings.json');
    seedFile(
      settingsPath,
      JSON.stringify({ theme: 'dark', apiKey: 'USER-SHOULD-NOT-LOSE-THIS' }, null, 2),
    );

    const install = runInstaller(sandbox, 'gemini-cli');
    expect(install.exitCode).toBe(0);

    const merged = JSON.parse(readSandboxFile(settingsPath)!);
    expect(merged.theme).toBe('dark');
    expect(merged.apiKey).toBe('USER-SHOULD-NOT-LOSE-THIS');
    expect(merged.hooks).toBeDefined();

    const uninstall = runUninstaller(sandbox, 'gemini-cli');
    expect(uninstall.exitCode).toBe(0);

    const final = JSON.parse(readSandboxFile(settingsPath)!);
    expect(final.theme).toBe('dark');
    expect(final.apiKey).toBe('USER-SHOULD-NOT-LOSE-THIS');
  });
});

describe('IDE: windsurf', () => {
  it('writes hooks to ~/.codeium/windsurf/hooks.json and cleans up', () => {
    const sandbox = newSandbox('windsurf');

    const install = runInstaller(sandbox, 'windsurf');
    expect(install.exitCode).toBe(0);

    const hooksPath = join(sandbox.home, '.codeium', 'windsurf', 'hooks.json');
    const content = readSandboxFile(hooksPath);
    expect(content).not.toBeNull();
    const parsed = JSON.parse(content!);
    expect(parsed.hooks.pre_user_prompt).toBeDefined();
    expect(parsed.hooks.post_write_code).toBeDefined();
    expect(JSON.stringify(parsed)).toContain('worker-service');

    // Workspace-level context rule gets seeded
    const rule = join(sandbox.workspace, '.windsurf', 'rules', 'claude-mem-context.md');
    expect(existsSync(rule)).toBe(true);

    const uninstall = runUninstaller(sandbox, 'windsurf');
    expect(uninstall.exitCode).toBe(0);

    // hooks.json is either deleted (if only our hooks were there) or cleaned
    const after = readSandboxFile(hooksPath);
    if (after !== null) {
      expect(after).not.toContain('worker-service');
    }
    expect(existsSync(rule)).toBe(false);
  });

  it('preserves third-party hooks under hooks.json', () => {
    const sandbox = newSandbox('windsurf-merge');
    const hooksPath = join(sandbox.home, '.codeium', 'windsurf', 'hooks.json');
    seedFile(
      hooksPath,
      JSON.stringify(
        {
          hooks: {
            post_run_command: [
              { command: '/bin/echo user-custom-hook', show_output: true, working_directory: '/' },
            ],
          },
        },
        null,
        2,
      ),
    );

    const install = runInstaller(sandbox, 'windsurf');
    expect(install.exitCode).toBe(0);

    const parsed = JSON.parse(readSandboxFile(hooksPath)!);
    expect(JSON.stringify(parsed)).toContain('user-custom-hook');
    expect(JSON.stringify(parsed)).toContain('worker-service');

    const uninstall = runUninstaller(sandbox, 'windsurf');
    expect(uninstall.exitCode).toBe(0);
    const afterParsed = JSON.parse(readSandboxFile(hooksPath)!);
    // User hook survived, our hook removed
    expect(JSON.stringify(afterParsed)).toContain('user-custom-hook');
    expect(JSON.stringify(afterParsed)).not.toContain('worker-service');
  });
});

describe('IDE: cursor', () => {
  it('writes hooks.json under ~/.cursor/', () => {
    const sandbox = newSandbox('cursor');

    const install = runInstaller(sandbox, 'cursor');
    expect(install.exitCode).toBe(0);

    const hooksPath = join(sandbox.home, '.cursor', 'hooks.json');
    const content = readSandboxFile(hooksPath);
    expect(content).not.toBeNull();
    const parsed = JSON.parse(content!);
    expect(parsed.version).toBe(1);
    expect(parsed.hooks.beforeSubmitPrompt).toBeDefined();
    expect(JSON.stringify(parsed)).toContain('hook cursor');

    const uninstall = runUninstaller(sandbox, 'cursor');
    expect(uninstall.exitCode).toBe(0);

    // Cursor's user-level uninstall deletes or empties hooks.json
    const after = readSandboxFile(hooksPath);
    if (after !== null) {
      expect(after).not.toContain('hook cursor');
    }
  });
});

describe('IDE: opencode', () => {
  it('copies the plugin bundle and writes AGENTS.md', () => {
    const sandbox = newSandbox('opencode');

    const install = runInstaller(sandbox, 'opencode');
    expect(install.exitCode).toBe(0);

    const pluginPath = join(sandbox.home, '.config', 'opencode', 'plugins', 'claude-mem.js');
    expect(existsSync(pluginPath)).toBe(true);

    const agentsMd = readSandboxFile(join(sandbox.home, '.config', 'opencode', 'AGENTS.md'));
    expect(agentsMd).not.toBeNull();
    expect(agentsMd!).toContain('<claude-mem-context>');

    const uninstall = runUninstaller(sandbox, 'opencode');
    expect(uninstall.exitCode).toBe(0);

    expect(existsSync(pluginPath)).toBe(false);
    const after = readSandboxFile(join(sandbox.home, '.config', 'opencode', 'AGENTS.md'));
    if (after !== null) {
      expect(after).not.toContain('<claude-mem-context>');
    }
  });
});

describe('IDE: codex-cli', () => {
  it('registers a codex watch in transcript-watch.json', () => {
    const sandbox = newSandbox('codex');

    const install = runInstaller(sandbox, 'codex-cli');
    expect(install.exitCode).toBe(0);

    const watchPath = join(sandbox.home, '.claude-mem', 'transcript-watch.json');
    const content = readSandboxFile(watchPath);
    expect(content).not.toBeNull();
    const parsed = JSON.parse(content!);
    expect(parsed.watches).toBeDefined();
    expect(parsed.watches.some((w: any) => w.name === 'codex')).toBe(true);
    expect(parsed.schemas?.codex).toBeDefined();

    const uninstall = runUninstaller(sandbox, 'codex-cli');
    expect(uninstall.exitCode).toBe(0);

    const after = JSON.parse(readSandboxFile(watchPath)!);
    expect(after.watches.some((w: any) => w.name === 'codex')).toBe(false);
    expect(after.schemas?.codex).toBeUndefined();
  });
});

describe('IDE: openclaw', () => {
  it('installs plugin files and registers in openclaw.json', () => {
    const sandbox = newSandbox('openclaw');

    const install = runInstaller(sandbox, 'openclaw');
    expect(install.exitCode).toBe(0);

    const extensionDir = join(sandbox.home, '.openclaw', 'extensions', 'claude-mem');
    expect(existsSync(join(extensionDir, 'dist', 'index.js'))).toBe(true);
    expect(existsSync(join(extensionDir, 'package.json'))).toBe(true);

    const cfg = JSON.parse(readSandboxFile(join(sandbox.home, '.openclaw', 'openclaw.json'))!);
    expect(cfg.plugins.entries['claude-mem']).toBeDefined();
    expect(cfg.plugins.entries['claude-mem'].enabled).toBe(true);
    expect(cfg.plugins.slots.memory).toBe('claude-mem');

    const uninstall = runUninstaller(sandbox, 'openclaw');
    expect(uninstall.exitCode).toBe(0);
    expect(existsSync(extensionDir)).toBe(false);
    const cfgAfter = JSON.parse(
      readSandboxFile(join(sandbox.home, '.openclaw', 'openclaw.json'))!,
    );
    expect(cfgAfter.plugins?.entries?.['claude-mem']).toBeUndefined();
    expect(cfgAfter.plugins?.slots?.memory).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MCP-tier IDEs — each writes a single JSON (or YAML for Goose) file.
// These intentionally do NOT have dedicated uninstallers in the current
// codebase; the test asserts that install is correct and documents the
// symmetric-uninstall gap that Phase 2 must close.
// ---------------------------------------------------------------------------

interface McpCase {
  id: IdeId;
  /** Relative path under sandbox.home OR sandbox.workspace. */
  configPath: (sandbox: Sandbox) => string;
  configRoot: 'home' | 'workspace';
  /** Key the installer uses to nest claude-mem under. */
  serverKey: 'mcpServers' | 'servers';
  /** True when this IDE also writes a context markdown file. */
  hasContextFile: boolean;
  contextPath?: (sandbox: Sandbox) => string;
}

const MCP_CASES: McpCase[] = [
  {
    id: 'copilot-cli',
    configPath: (s) => join(s.home, '.github', 'copilot', 'mcp.json'),
    configRoot: 'home',
    serverKey: 'servers',
    hasContextFile: true,
    contextPath: (s) => join(s.workspace, '.github', 'copilot-instructions.md'),
  },
  {
    id: 'antigravity',
    configPath: (s) => join(s.home, '.gemini', 'antigravity', 'mcp_config.json'),
    configRoot: 'home',
    serverKey: 'mcpServers',
    hasContextFile: true,
    contextPath: (s) => join(s.workspace, '.agent', 'rules', 'claude-mem-context.md'),
  },
  {
    id: 'crush',
    configPath: (s) => join(s.home, '.config', 'crush', 'mcp.json'),
    configRoot: 'home',
    serverKey: 'mcpServers',
    hasContextFile: false,
  },
  {
    id: 'roo-code',
    configPath: (s) => join(s.workspace, '.roo', 'mcp.json'),
    configRoot: 'workspace',
    serverKey: 'mcpServers',
    hasContextFile: true,
    contextPath: (s) => join(s.workspace, '.roo', 'rules', 'claude-mem-context.md'),
  },
  // Warp skips config write entirely unless ~/.warp exists — see harness note
  // under its dedicated block below.
];

for (const mcp of MCP_CASES) {
  describe(`IDE: ${mcp.id} (MCP)`, () => {
    it('writes MCP server config with claude-mem entry', () => {
      const sandbox = newSandbox(mcp.id);

      const install = runInstaller(sandbox, mcp.id);
      expect(install.exitCode).toBe(0);

      const configPath = mcp.configPath(sandbox);
      const raw = readSandboxFile(configPath);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed[mcp.serverKey]).toBeDefined();
      expect(parsed[mcp.serverKey]['claude-mem']).toBeDefined();
      expect(parsed[mcp.serverKey]['claude-mem'].args.join(' ')).toContain('mcp-server.cjs');

      if (mcp.hasContextFile && mcp.contextPath) {
        expect(existsSync(mcp.contextPath(sandbox))).toBe(true);
      }
    });

    it('preserves unrelated keys in an existing config file', () => {
      const sandbox = newSandbox(`${mcp.id}-merge`);
      const configPath = mcp.configPath(sandbox);
      seedFile(
        configPath,
        JSON.stringify(
          {
            [mcp.serverKey]: {
              'other-tool': { command: 'node', args: ['/path/to/other.js'] },
            },
            unrelatedKey: 'preserved',
          },
          null,
          2,
        ),
      );

      const install = runInstaller(sandbox, mcp.id);
      expect(install.exitCode).toBe(0);

      const parsed = JSON.parse(readSandboxFile(configPath)!);
      expect(parsed.unrelatedKey).toBe('preserved');
      expect(parsed[mcp.serverKey]['other-tool']).toBeDefined();
      expect(parsed[mcp.serverKey]['claude-mem']).toBeDefined();
    });
  });
}

// Warp has the "skip write if ~/.warp missing" branch — test both arms.
describe('IDE: warp (MCP)', () => {
  it('writes WARP.md context even when ~/.warp is missing', () => {
    const sandbox = newSandbox('warp-no-dir');

    const install = runInstaller(sandbox, 'warp');
    expect(install.exitCode).toBe(0);

    // WARP.md is written in the workspace regardless of ~/.warp presence
    expect(existsSync(join(sandbox.workspace, 'WARP.md'))).toBe(true);
    // No ~/.warp/mcp.json should exist (install skipped)
    expect(existsSync(join(sandbox.home, '.warp', 'mcp.json'))).toBe(false);
  });

  it('writes mcp.json when ~/.warp already exists', () => {
    const sandbox = newSandbox('warp-dir');
    seedFile(join(sandbox.home, '.warp', 'sentinel'), 'present\n');

    const install = runInstaller(sandbox, 'warp');
    expect(install.exitCode).toBe(0);

    const cfg = readSandboxFile(join(sandbox.home, '.warp', 'mcp.json'));
    expect(cfg).not.toBeNull();
    expect(cfg!).toContain('claude-mem');
  });
});

// Goose uses YAML — not JSON — so it gets its own block.
describe('IDE: goose (MCP)', () => {
  it('writes YAML MCP config referencing the claude-mem server', () => {
    const sandbox = newSandbox('goose');

    const install = runInstaller(sandbox, 'goose');
    expect(install.exitCode).toBe(0);

    const cfg = readSandboxFile(join(sandbox.home, '.config', 'goose', 'config.yaml'));
    expect(cfg).not.toBeNull();
    expect(cfg!).toContain('mcpServers:');
    expect(cfg!).toContain('claude-mem:');
    expect(cfg!).toContain('mcp-server.cjs');
  });

  it('appends under an existing mcpServers block without clobbering', () => {
    const sandbox = newSandbox('goose-merge');
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

    const install = runInstaller(sandbox, 'goose');
    expect(install.exitCode).toBe(0);

    const cfg = readSandboxFile(cfgPath)!;
    expect(cfg).toContain('theme: dark');
    expect(cfg).toContain('other-tool:');
    expect(cfg).toContain('claude-mem:');
  });
});
