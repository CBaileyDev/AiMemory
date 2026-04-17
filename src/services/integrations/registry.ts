/**
 * Central integration registry.
 *
 * Every IDE claude-mem supports is exposed here as an `Integration`. The
 * npx CLI, the doctor command, and the e2e harness all use this registry
 * instead of hard-coding per-IDE switch statements.
 *
 * Tier-1 installers (Cursor, Gemini CLI, Windsurf, OpenCode, OpenClaw,
 * Codex CLI) are wrapped here — their underlying implementations live in
 * the matching `*Installer.ts` files. Tier-2 (MCP) integrations live
 * under `./mcp/`.
 */

import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import type {
  DoctorFinding,
  DoctorReport,
  ExitCode,
  Integration,
} from './types.js';
import { MCP_INTEGRATIONS } from './mcp/index.js';
import {
  installCursorHooks,
  uninstallCursorHooks,
  configureCursorMcp,
} from './CursorHooksInstaller.js';
import {
  installGeminiCliHooks,
  uninstallGeminiCliHooks,
} from './GeminiCliHooksInstaller.js';
import {
  installWindsurfHooks,
  uninstallWindsurfHooks,
} from './WindsurfHooksInstaller.js';
import {
  installOpenCodeIntegration,
  uninstallOpenCodePlugin,
  getInstalledPluginPath,
  getOpenCodeAgentsMdPath,
  getOpenCodeConfigDirectory,
} from './OpenCodeInstaller.js';
import {
  installOpenClawIntegration,
  uninstallOpenClawPlugin,
  getOpenClawConfigDirectory,
  getOpenClawClaudeMemExtensionDirectory,
  getOpenClawConfigFilePath,
} from './OpenClawInstaller.js';
import {
  installCodexCli,
  uninstallCodexCli,
} from './CodexCliInstaller.js';
import { DEFAULT_CONFIG_PATH as CODEX_WATCH_CONFIG_PATH } from '../transcripts/config.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function detectedIf(path: string) {
  return existsSync(path)
    ? { detected: true, reason: `${path} exists` }
    : { detected: false, reason: `${path} not found` };
}

function aggregate(findings: DoctorFinding[]): DoctorReport['status'] {
  if (findings.some((f) => f.status === 'fail')) return 'fail';
  if (findings.some((f) => f.status === 'warn')) return 'warn';
  if (findings.every((f) => f.status === 'not-installed')) return 'not-installed';
  if (findings.every((f) => f.status === 'ok')) return 'ok';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Tier 1 adapters
// ---------------------------------------------------------------------------

const cursorIntegration: Integration = {
  id: 'cursor',
  label: 'Cursor',
  tier: 1,
  async detect() {
    return detectedIf(path.join(homedir(), '.cursor'));
  },
  backupPaths() {
    return [
      path.join(homedir(), '.cursor', 'hooks.json'),
      path.join(homedir(), '.cursor', 'mcp.json'),
    ];
  },
  async install(): Promise<ExitCode> {
    const hooks = await installCursorHooks('user');
    if (hooks !== 0) return 1;
    const mcp = configureCursorMcp('user');
    return mcp === 0 ? 0 : 1;
  },
  async uninstall(): Promise<ExitCode> {
    return uninstallCursorHooks('user') === 0 ? 0 : 1;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const hooksPath = path.join(homedir(), '.cursor', 'hooks.json');
    if (!existsSync(hooksPath)) {
      findings.push({
        status: 'not-installed',
        message: 'Cursor hooks.json not found',
        hint: 'Run: npx claude-mem install --ide cursor',
      });
    } else {
      const content = readFileSync(hooksPath, 'utf-8');
      findings.push(
        content.includes('hook cursor')
          ? { status: 'ok', message: 'Cursor hooks.json references claude-mem' }
          : {
              status: 'warn',
              message: 'Cursor hooks.json exists but has no claude-mem hooks',
              hint: 'Run: npx claude-mem install --ide cursor',
            },
      );
    }
    return { status: aggregate(findings), findings };
  },
};

const geminiCliIntegration: Integration = {
  id: 'gemini-cli',
  label: 'Gemini CLI',
  tier: 1,
  async detect() {
    return detectedIf(path.join(homedir(), '.gemini'));
  },
  backupPaths() {
    return [
      path.join(homedir(), '.gemini', 'settings.json'),
      path.join(homedir(), '.gemini', 'GEMINI.md'),
    ];
  },
  async install(): Promise<ExitCode> {
    return (await installGeminiCliHooks()) === 0 ? 0 : 1;
  },
  async uninstall(): Promise<ExitCode> {
    return uninstallGeminiCliHooks() === 0 ? 0 : 1;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const settingsPath = path.join(homedir(), '.gemini', 'settings.json');
    if (!existsSync(settingsPath)) {
      findings.push({
        status: 'not-installed',
        message: 'Gemini settings.json not found',
        hint: 'Run: npx claude-mem install --ide gemini-cli',
      });
    } else {
      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        const str = JSON.stringify(settings.hooks ?? {});
        findings.push(
          str.includes('claude-mem')
            ? { status: 'ok', message: 'Gemini CLI hooks include claude-mem' }
            : {
                status: 'not-installed',
                message: 'Gemini settings.json lacks claude-mem hooks',
                hint: 'Run: npx claude-mem install --ide gemini-cli',
              },
        );
      } catch {
        findings.push({
          status: 'fail',
          message: 'Gemini settings.json is corrupt',
          hint: 'Restore from ~/.claude-mem/backups/ or delete the file and reinstall.',
        });
      }
    }
    return { status: aggregate(findings), findings };
  },
};

const windsurfIntegration: Integration = {
  id: 'windsurf',
  label: 'Windsurf',
  tier: 1,
  async detect() {
    return detectedIf(path.join(homedir(), '.codeium', 'windsurf'));
  },
  backupPaths() {
    return [path.join(homedir(), '.codeium', 'windsurf', 'hooks.json')];
  },
  async install(): Promise<ExitCode> {
    return (await installWindsurfHooks()) === 0 ? 0 : 1;
  },
  async uninstall(): Promise<ExitCode> {
    return uninstallWindsurfHooks() === 0 ? 0 : 1;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const hooksPath = path.join(homedir(), '.codeium', 'windsurf', 'hooks.json');
    if (!existsSync(hooksPath)) {
      findings.push({
        status: 'not-installed',
        message: 'Windsurf hooks.json not found',
        hint: 'Run: npx claude-mem install --ide windsurf',
      });
    } else {
      const content = readFileSync(hooksPath, 'utf-8');
      findings.push(
        content.includes('worker-service')
          ? { status: 'ok', message: 'Windsurf hooks include claude-mem' }
          : {
              status: 'not-installed',
              message: 'Windsurf hooks.json lacks claude-mem hooks',
              hint: 'Run: npx claude-mem install --ide windsurf',
            },
      );
    }
    return { status: aggregate(findings), findings };
  },
};

const openCodeIntegration: Integration = {
  id: 'opencode',
  label: 'OpenCode',
  tier: 1,
  async detect() {
    return detectedIf(getOpenCodeConfigDirectory());
  },
  backupPaths() {
    return [getOpenCodeAgentsMdPath(), getInstalledPluginPath()];
  },
  async install(): Promise<ExitCode> {
    return (await installOpenCodeIntegration()) === 0 ? 0 : 1;
  },
  async uninstall(): Promise<ExitCode> {
    return uninstallOpenCodePlugin() === 0 ? 0 : 1;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const pluginPath = getInstalledPluginPath();
    if (!existsSync(pluginPath)) {
      findings.push({
        status: 'not-installed',
        message: 'OpenCode plugin file not found',
        hint: 'Run: npx claude-mem install --ide opencode',
      });
    } else {
      findings.push({ status: 'ok', message: 'OpenCode plugin installed' });
    }
    return { status: aggregate(findings), findings };
  },
};

const openClawIntegration: Integration = {
  id: 'openclaw',
  label: 'OpenClaw',
  tier: 1,
  async detect() {
    return detectedIf(getOpenClawConfigDirectory());
  },
  backupPaths() {
    return [getOpenClawConfigFilePath()];
  },
  async install(): Promise<ExitCode> {
    return (await installOpenClawIntegration()) === 0 ? 0 : 1;
  },
  async uninstall(): Promise<ExitCode> {
    return uninstallOpenClawPlugin() === 0 ? 0 : 1;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const extensionDir = getOpenClawClaudeMemExtensionDirectory();
    if (!existsSync(path.join(extensionDir, 'dist', 'index.js'))) {
      findings.push({
        status: 'not-installed',
        message: 'OpenClaw extension not installed',
        hint: 'Run: npx claude-mem install --ide openclaw',
      });
    } else {
      findings.push({ status: 'ok', message: 'OpenClaw extension installed' });
    }
    return { status: aggregate(findings), findings };
  },
};

const codexCliIntegration: Integration = {
  id: 'codex-cli',
  label: 'Codex CLI',
  tier: 3,
  async detect() {
    return detectedIf(path.join(homedir(), '.codex'));
  },
  backupPaths() {
    return [CODEX_WATCH_CONFIG_PATH];
  },
  async install(): Promise<ExitCode> {
    return (await installCodexCli()) === 0 ? 0 : 1;
  },
  async uninstall(): Promise<ExitCode> {
    return uninstallCodexCli() === 0 ? 0 : 1;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    if (!existsSync(CODEX_WATCH_CONFIG_PATH)) {
      findings.push({
        status: 'not-installed',
        message: 'Codex transcript-watch config not found',
        hint: 'Run: npx claude-mem install --ide codex-cli',
      });
    } else {
      try {
        const cfg = JSON.parse(readFileSync(CODEX_WATCH_CONFIG_PATH, 'utf-8'));
        const hasCodex = Array.isArray(cfg.watches) && cfg.watches.some((w: any) => w.name === 'codex');
        findings.push(
          hasCodex
            ? { status: 'ok', message: 'Codex transcript watch registered' }
            : {
                status: 'not-installed',
                message: 'transcript-watch.json exists but lacks codex entry',
                hint: 'Run: npx claude-mem install --ide codex-cli',
              },
        );
      } catch {
        findings.push({
          status: 'fail',
          message: 'transcript-watch.json is corrupt',
          hint: 'Delete the file and reinstall.',
        });
      }
    }
    return { status: aggregate(findings), findings };
  },
};

const claudeCodeIntegration: Integration = {
  id: 'claude-code',
  label: 'Claude Code',
  tier: 1,
  async detect() {
    return detectedIf(path.join(homedir(), '.claude'));
  },
  backupPaths() {
    return [];
  },
  async install(): Promise<ExitCode> {
    // Handled via native `claude plugin install`; the npx installer shells
    // out to the Claude CLI directly. This entry exists so the registry
    // is complete and doctor() can still report status.
    return 0;
  },
  async doctor(): Promise<DoctorReport> {
    const findings: DoctorFinding[] = [];
    const marketplaceDir = path.join(
      process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'),
      'plugins',
      'marketplaces',
      'thedotmack',
    );
    findings.push(
      existsSync(marketplaceDir)
        ? { status: 'ok', message: 'Claude Code marketplace contains claude-mem' }
        : {
            status: 'not-installed',
            message: 'claude-mem marketplace not found',
            hint: 'Run: npx claude-mem install --ide claude-code',
          },
    );
    return { status: aggregate(findings), findings };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const REGISTRY: Record<string, Integration> = {
  'claude-code': claudeCodeIntegration,
  cursor: cursorIntegration,
  'gemini-cli': geminiCliIntegration,
  windsurf: windsurfIntegration,
  opencode: openCodeIntegration,
  openclaw: openClawIntegration,
  'codex-cli': codexCliIntegration,
  ...MCP_INTEGRATIONS,
};

export const ALL_IDE_IDS = Object.keys(REGISTRY);

export function getIntegration(id: string): Integration | undefined {
  return REGISTRY[id];
}
