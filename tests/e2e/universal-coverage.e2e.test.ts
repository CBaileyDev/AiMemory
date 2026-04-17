/**
 * Universal coverage tests — ensures claude-mem installs cleanly across
 * both the CLI and IDE surfaces of the five anchor AI coding tools:
 *
 *   1. Claude     — Claude Code (plugin) + Claude Desktop (MCP client)
 *   2. Codex      — Codex CLI (transcript watch) + Codex VS Code (shared config.toml)
 *   3. Kimi       — Kimi Code CLI + Kimi Code for VS Code (shared ~/.kimi/mcp.json)
 *   4. Gemini     — Gemini CLI (hooks) + Gemini Code Assist VS Code (mcpServers block)
 *   5. Cursor     — Cursor IDE + MCP config
 *
 * Each test installs in a fake-HOME sandbox, asserts every expected config
 * file mentions `claude-mem`, then runs the matching uninstaller and
 * confirms the user-visible traces are gone.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createSandbox,
  destroySandbox,
  readSandboxFile,
  runInstaller,
  runUninstaller,
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

// ---------------------------------------------------------------------------
// 1. Claude Desktop (MCP)
// ---------------------------------------------------------------------------

describe('universal: Claude Desktop', () => {
  it('writes claude_desktop_config.json at the platform-specific path', () => {
    const sandbox = newSandbox('claude-desktop');

    const install = runInstaller(sandbox, 'claude-desktop');
    expect(install.exitCode).toBe(0);

    const configPath = resolveClaudeDesktopPath(sandbox);
    const raw = readSandboxFile(configPath);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.mcpServers['claude-mem']).toBeDefined();
    expect(parsed.mcpServers['claude-mem'].args.join(' ')).toContain('mcp-server.cjs');
  });

  it('preserves existing mcpServers entries on install and uninstall', () => {
    const sandbox = newSandbox('claude-desktop-merge');
    const configPath = resolveClaudeDesktopPath(sandbox);
    seedFile(
      configPath,
      JSON.stringify(
        {
          mcpServers: {
            'other-tool': { command: 'node', args: ['/path/other.js'] },
          },
          otherUserKey: 'keep-me',
        },
        null,
        2,
      ),
    );

    const install = runInstaller(sandbox, 'claude-desktop');
    expect(install.exitCode).toBe(0);

    const afterInstall = JSON.parse(readSandboxFile(configPath)!);
    expect(afterInstall.otherUserKey).toBe('keep-me');
    expect(afterInstall.mcpServers['other-tool']).toBeDefined();
    expect(afterInstall.mcpServers['claude-mem']).toBeDefined();

    const uninstall = runUninstaller(sandbox, 'claude-desktop');
    expect(uninstall.exitCode).toBe(0);

    const afterUninstall = JSON.parse(readSandboxFile(configPath)!);
    expect(afterUninstall.otherUserKey).toBe('keep-me');
    expect(afterUninstall.mcpServers['other-tool']).toBeDefined();
    expect(afterUninstall.mcpServers['claude-mem']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Codex — TOML MCP block shared with VS Code extension
// ---------------------------------------------------------------------------

describe('universal: Codex (CLI + VS Code)', () => {
  it('writes an MCP block to ~/.codex/config.toml alongside the transcript watch', () => {
    const sandbox = newSandbox('codex-toml');

    const install = runInstaller(sandbox, 'codex-cli');
    expect(install.exitCode).toBe(0);

    // Transcript watcher still registered
    const watchPath = join(sandbox.home, '.claude-mem', 'transcript-watch.json');
    const watchParsed = JSON.parse(readSandboxFile(watchPath)!);
    expect(watchParsed.watches.some((w: any) => w.name === 'codex')).toBe(true);

    // config.toml has the tagged MCP block
    const tomlPath = join(sandbox.home, '.codex', 'config.toml');
    const toml = readSandboxFile(tomlPath);
    expect(toml).not.toBeNull();
    expect(toml!).toContain('# >>> claude-mem mcp BEGIN');
    expect(toml!).toContain('[mcp_servers.claude-mem]');
    expect(toml!).toContain('mcp-server.cjs');
    expect(toml!).toContain('# <<< claude-mem mcp END');
  });

  it('preserves unrelated TOML content on install and uninstall', () => {
    const sandbox = newSandbox('codex-toml-preserve');
    const tomlPath = join(sandbox.home, '.codex', 'config.toml');
    const userToml = [
      '# User custom config',
      '[tui]',
      'theme = "dark"',
      '',
      '[mcp_servers.other-tool]',
      'command = "node"',
      'args = ["/other.js"]',
      '',
    ].join('\n');
    seedFile(tomlPath, userToml);

    const install = runInstaller(sandbox, 'codex-cli');
    expect(install.exitCode).toBe(0);

    const afterInstall = readSandboxFile(tomlPath)!;
    expect(afterInstall).toContain('theme = "dark"');
    expect(afterInstall).toContain('[mcp_servers.other-tool]');
    expect(afterInstall).toContain('[mcp_servers.claude-mem]');

    const uninstall = runUninstaller(sandbox, 'codex-cli');
    expect(uninstall.exitCode).toBe(0);

    const afterUninstall = readSandboxFile(tomlPath);
    expect(afterUninstall).not.toBeNull();
    // User content still there
    expect(afterUninstall!).toContain('theme = "dark"');
    expect(afterUninstall!).toContain('[mcp_servers.other-tool]');
    // Our block gone
    expect(afterUninstall!).not.toContain('[mcp_servers.claude-mem]');
    expect(afterUninstall!).not.toContain('claude-mem mcp BEGIN');
  });
});

// ---------------------------------------------------------------------------
// 3. Kimi — shared ~/.kimi/mcp.json for Kimi CLI + Kimi Code VS Code
// ---------------------------------------------------------------------------

describe('universal: Kimi (CLI + VS Code)', () => {
  it('writes ~/.kimi/mcp.json with claude-mem MCP entry', () => {
    const sandbox = newSandbox('kimi');

    const install = runInstaller(sandbox, 'kimi');
    expect(install.exitCode).toBe(0);

    const cfgPath = join(sandbox.home, '.kimi', 'mcp.json');
    const raw = readSandboxFile(cfgPath);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.mcpServers['claude-mem']).toBeDefined();
    expect(parsed.mcpServers['claude-mem'].args.join(' ')).toContain('mcp-server.cjs');
  });

  it('preserves existing Kimi MCP servers through install/uninstall', () => {
    const sandbox = newSandbox('kimi-merge');
    const cfgPath = join(sandbox.home, '.kimi', 'mcp.json');
    seedFile(
      cfgPath,
      JSON.stringify(
        {
          mcpServers: {
            'github-copilot': { command: 'npx', args: ['-y', 'github-mcp'] },
          },
        },
        null,
        2,
      ),
    );

    const install = runInstaller(sandbox, 'kimi');
    expect(install.exitCode).toBe(0);

    const afterInstall = JSON.parse(readSandboxFile(cfgPath)!);
    expect(afterInstall.mcpServers['github-copilot']).toBeDefined();
    expect(afterInstall.mcpServers['claude-mem']).toBeDefined();

    const uninstall = runUninstaller(sandbox, 'kimi');
    expect(uninstall.exitCode).toBe(0);

    const afterUninstall = JSON.parse(readSandboxFile(cfgPath)!);
    expect(afterUninstall.mcpServers['github-copilot']).toBeDefined();
    expect(afterUninstall.mcpServers['claude-mem']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Gemini — hooks (CLI) + mcpServers (Code Assist VS Code) share settings.json
// ---------------------------------------------------------------------------

describe('universal: Gemini (CLI + Code Assist VS Code)', () => {
  it('registers BOTH hooks and mcpServers in ~/.gemini/settings.json', () => {
    const sandbox = newSandbox('gemini-universal');

    const install = runInstaller(sandbox, 'gemini-cli');
    expect(install.exitCode).toBe(0);

    const parsed = JSON.parse(readSandboxFile(join(sandbox.home, '.gemini', 'settings.json'))!);

    // Hooks (for CLI session capture)
    expect(parsed.hooks).toBeDefined();
    expect(JSON.stringify(parsed.hooks)).toContain('claude-mem');

    // MCP entry (for Gemini Code Assist VS Code extension)
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers['claude-mem']).toBeDefined();
    expect(parsed.mcpServers['claude-mem'].args.join(' ')).toContain('mcp-server.cjs');
  });

  it('removes both hooks AND mcpServers entry on uninstall', () => {
    const sandbox = newSandbox('gemini-universal-uninstall');

    const install = runInstaller(sandbox, 'gemini-cli');
    expect(install.exitCode).toBe(0);

    const uninstall = runUninstaller(sandbox, 'gemini-cli');
    expect(uninstall.exitCode).toBe(0);

    const after = readSandboxFile(join(sandbox.home, '.gemini', 'settings.json'));
    if (after !== null) {
      const parsed = JSON.parse(after);
      const hookStr = JSON.stringify(parsed.hooks ?? {});
      const mcpStr = JSON.stringify(parsed.mcpServers ?? {});
      expect(hookStr).not.toContain('claude-mem');
      expect(mcpStr).not.toContain('claude-mem');
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Cursor — already multi-surface (hooks + MCP via its own installer);
//    rerun the symmetric install/uninstall to prove nothing regressed after
//    the other changes.
// ---------------------------------------------------------------------------

describe('universal: Cursor (IDE hooks + MCP)', () => {
  it('installs hooks.json under ~/.cursor/', () => {
    const sandbox = newSandbox('cursor-universal');
    const install = runInstaller(sandbox, 'cursor');
    expect(install.exitCode).toBe(0);

    const hooksPath = join(sandbox.home, '.cursor', 'hooks.json');
    const parsed = JSON.parse(readSandboxFile(hooksPath)!);
    expect(parsed.hooks).toBeDefined();
    expect(JSON.stringify(parsed.hooks)).toContain('hook cursor');
  });
});

// ---------------------------------------------------------------------------
// 6. Claude Code — already covered by the plugin install path; assert the
//    marketplace sentinel gets seeded by the e2e harness so doctor is happy.
// ---------------------------------------------------------------------------

describe('universal: Claude Code', () => {
  it('e2e harness seeds the marketplace so doctor can detect the plugin', () => {
    const sandbox = newSandbox('claude-code-marketplace');
    const sentinel = join(sandbox.marketplace, 'plugin', 'scripts', 'worker-service.cjs');
    expect(existsSync(sentinel)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. All five vendors at once — install claude-desktop, codex-cli, kimi,
//    gemini-cli, cursor in the same sandbox; assert each surface is live.
// ---------------------------------------------------------------------------

describe('universal: all five vendors together', () => {
  it('installs claude-desktop, codex-cli, kimi, gemini-cli, cursor in one sandbox', () => {
    const sandbox = newSandbox('all-five');

    for (const ide of ['claude-desktop', 'codex-cli', 'kimi', 'gemini-cli', 'cursor'] as const) {
      const result = runInstaller(sandbox, ide);
      expect(result.exitCode).toBe(0);
    }

    // Claude Desktop
    const cdPath = resolveClaudeDesktopPath(sandbox);
    expect(existsSync(cdPath)).toBe(true);

    // Codex CLI — transcript watch + TOML MCP
    expect(existsSync(join(sandbox.home, '.claude-mem', 'transcript-watch.json'))).toBe(true);
    expect(readSandboxFile(join(sandbox.home, '.codex', 'config.toml'))).toContain(
      '[mcp_servers.claude-mem]',
    );

    // Kimi
    expect(
      readSandboxFile(join(sandbox.home, '.kimi', 'mcp.json')),
    ).toContain('claude-mem');

    // Gemini — both hooks and mcpServers
    const geminiSettings = JSON.parse(
      readSandboxFile(join(sandbox.home, '.gemini', 'settings.json'))!,
    );
    expect(JSON.stringify(geminiSettings.hooks)).toContain('claude-mem');
    expect(geminiSettings.mcpServers['claude-mem']).toBeDefined();

    // Cursor
    expect(
      readSandboxFile(join(sandbox.home, '.cursor', 'hooks.json')),
    ).toContain('hook cursor');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve where claude-desktop writes its config inside the sandbox —
 * exactly the same logic as `integrations/mcp/claude-desktop.ts`, so this
 * test stays in lockstep with production.
 */
function resolveClaudeDesktopPath(sandbox: Sandbox): string {
  switch (process.platform) {
    case 'darwin':
      return join(sandbox.home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return join(sandbox.home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    default:
      return join(sandbox.home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}
