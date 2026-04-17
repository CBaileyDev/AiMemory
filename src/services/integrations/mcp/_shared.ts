/**
 * Shared helpers for JSON-based MCP integrations.
 *
 * Split out of `McpIntegrations.ts` as part of Phase 2 (uniform integration
 * contract). Every MCP IDE that writes a JSON config file now gets its own
 * file under `src/services/integrations/mcp/` using this helper — the
 * symmetry is what makes doctor / backup / uninstall tractable.
 *
 * Goose is the one exception — its config is YAML, so it ships in its own
 * file under `mcp/goose.ts` with a separate helper.
 */

import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { readJsonSafe } from '../../../utils/json-utils.js';
import { findMcpServerPath } from '../CursorHooksInstaller.js';
import { injectContextIntoMarkdownFile } from '../../../utils/context-injection.js';
import type {
  DoctorFinding,
  DoctorReport,
  DoctorStatus,
  ExitCode,
  Integration,
  IntegrationTier,
} from '../types.js';
import { backupFile, createBackupSession, pruneBackups } from '../_backup.js';

const PLACEHOLDER_CONTEXT = `# claude-mem: Cross-Session Memory

*No context yet. Complete your first session and context will appear here.*

Use claude-mem's MCP search tools for manual memory queries.`;

const CLAUDE_MEM_SERVER_KEY = 'claude-mem';

export interface McpIdeDefinition {
  id: string;
  label: string;
  tier: IntegrationTier;
  /** Path to the JSON config file the installer writes. */
  configPath: (sandbox: { cwd: string }) => string;
  /** Either `servers` (Copilot CLI) or `mcpServers` (everyone else). */
  configKey: 'servers' | 'mcpServers';
  /** Optional companion context file. */
  contextFile?: (sandbox: { cwd: string }) => string;
  /**
   * Pre-install gate. If this returns `{ skipConfig: true, reason }`, the
   * installer will not touch the JSON config — used by Warp which requires
   * `~/.warp/` to exist (otherwise MCP is configured through Warp Drive UI).
   */
  skipConfigIf?: () => { skipConfig: boolean; reason?: string };
  /**
   * Detection probe — typically "does the IDE's config dir exist?"
   * Must not write anything.
   */
  detect: () => Promise<{ detected: boolean; reason: string }>;
}

/**
 * Build a full `Integration` from a JSON-based MCP IDE definition. The
 * returned object has install / uninstall / doctor / backupPaths /
 * detect conforming to the Phase 2 contract.
 */
export function buildJsonMcpIntegration(def: McpIdeDefinition): Integration {
  const cwd = () => ({ cwd: process.cwd() });

  return {
    id: def.id,
    label: def.label,
    tier: def.tier,
    detect: def.detect,
    backupPaths(): string[] {
      const paths = [def.configPath(cwd())];
      if (def.contextFile) paths.push(def.contextFile(cwd()));
      return paths;
    },

    async install(opts): Promise<ExitCode> {
      const log = opts?.silent ? () => {} : console.log;
      const err = opts?.silent ? () => {} : console.error;
      log(`\nInstalling Claude-Mem MCP integration for ${def.label}...\n`);

      const mcpServerPath = findMcpServerPath();
      if (!mcpServerPath) {
        err('Could not find MCP server script');
        err('   Expected at: ~/.claude/plugins/marketplaces/thedotmack/plugin/scripts/mcp-server.cjs');
        return 1;
      }

      const configPath = def.configPath(cwd());
      const contextPath = def.contextFile?.(cwd());

      const session = createBackupSession(`mcp-${def.id}-install`);

      try {
        const skip = def.skipConfigIf?.();
        if (skip?.skipConfig) {
          log(`  Note: ${skip.reason ?? 'skipping config write'}`);
        } else {
          backupFile(session, configPath);
          writeJsonMcpConfig(configPath, mcpServerPath, def.configKey);
          log(`  MCP config written to: ${configPath}`);
        }

        if (contextPath) {
          backupFile(session, contextPath);
          injectContextIntoMarkdownFile(contextPath, PLACEHOLDER_CONTEXT);
          log(`  Context placeholder written to: ${contextPath}`);
        }

        pruneBackups();

        log(`\nInstallation complete!\n`);
        log(`MCP config:  ${configPath}`);
        if (contextPath) log(`Context:     ${contextPath}`);
        log(`\nNote: MCP-only integration — transcript capture is not available for ${def.label}.`);
        log(`Next steps:\n  1. Start claude-mem worker: npx claude-mem start\n  2. Restart ${def.label}\n`);
        return 0;
      } catch (error) {
        err(`\nInstallation failed: ${(error as Error).message}`);
        return 1;
      }
    },

    async uninstall(opts): Promise<ExitCode> {
      const log = opts?.silent ? () => {} : console.log;
      log(`\nUninstalling Claude-Mem MCP integration for ${def.label}...\n`);

      const session = createBackupSession(`mcp-${def.id}-uninstall`);
      const configPath = def.configPath(cwd());
      const contextPath = def.contextFile?.(cwd());

      try {
        if (existsSync(configPath)) {
          backupFile(session, configPath);
          removeClaudeMemFromJsonConfig(configPath, def.configKey);
          log(`  Removed claude-mem entry from ${configPath}`);
        }
        if (contextPath && existsSync(contextPath)) {
          backupFile(session, contextPath);
          removeClaudeMemContextBlock(contextPath);
          log(`  Removed claude-mem context from ${contextPath}`);
        }
        pruneBackups();
        return 0;
      } catch (error) {
        console.error(`\nUninstallation failed: ${(error as Error).message}`);
        return 1;
      }
    },

    async doctor(): Promise<DoctorReport> {
      const findings: DoctorFinding[] = [];
      const configPath = def.configPath(cwd());
      const contextPath = def.contextFile?.(cwd());

      if (!existsSync(configPath)) {
        findings.push({
          status: 'not-installed',
          message: `${def.label} MCP config not found`,
          hint: `Run: npx claude-mem install --ide ${def.id}`,
        });
      } else {
        try {
          const raw = readFileSync(configPath, 'utf-8');
          const parsed = JSON.parse(raw);
          const section = parsed[def.configKey];
          if (section && section[CLAUDE_MEM_SERVER_KEY]) {
            findings.push({
              status: 'ok',
              message: `${def.label} MCP config contains claude-mem entry`,
            });
          } else {
            findings.push({
              status: 'not-installed',
              message: `${def.label} MCP config is present but claude-mem is not registered`,
              hint: `Run: npx claude-mem install --ide ${def.id}`,
            });
          }
        } catch (error) {
          findings.push({
            status: 'fail',
            message: `${def.label} MCP config is corrupt: ${(error as Error).message}`,
            hint: `Restore the latest backup from ~/.claude-mem/backups/ or recreate with install.`,
          });
        }
      }

      if (contextPath) {
        if (!existsSync(contextPath)) {
          findings.push({
            status: 'warn',
            message: `${def.label} context file missing`,
            hint: `Reinstall to recreate: npx claude-mem install --ide ${def.id}`,
          });
        } else {
          const content = readFileSync(contextPath, 'utf-8');
          if (!content.includes('claude-mem')) {
            findings.push({
              status: 'warn',
              message: `${def.label} context file exists but contains no claude-mem block`,
              hint: `Reinstall to rewrite: npx claude-mem install --ide ${def.id}`,
            });
          } else {
            findings.push({ status: 'ok', message: `${def.label} context file OK` });
          }
        }
      }

      return {
        status: aggregate(findings),
        findings,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Low-level JSON + context mutators
// ---------------------------------------------------------------------------

function writeJsonMcpConfig(
  configPath: string,
  mcpServerPath: string,
  configKey: 'servers' | 'mcpServers',
): void {
  mkdirSync(path.dirname(configPath), { recursive: true });
  const existing = readJsonSafe<Record<string, any>>(configPath, {});
  if (!existing[configKey]) existing[configKey] = {};
  existing[configKey][CLAUDE_MEM_SERVER_KEY] = {
    command: process.execPath,
    args: [mcpServerPath],
  };
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
}

function removeClaudeMemFromJsonConfig(
  configPath: string,
  configKey: 'servers' | 'mcpServers',
): void {
  const existing = readJsonSafe<Record<string, any>>(configPath, {});
  if (existing[configKey]?.[CLAUDE_MEM_SERVER_KEY]) {
    delete existing[configKey][CLAUDE_MEM_SERVER_KEY];
    if (Object.keys(existing[configKey]).length === 0) {
      delete existing[configKey];
    }
  }
  // If the config is now empty, remove the file entirely to keep the
  // user's disk clean.
  if (Object.keys(existing).length === 0) {
    unlinkSync(configPath);
  } else {
    writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
  }
}

function removeClaudeMemContextBlock(contextPath: string): void {
  const content = readFileSync(contextPath, 'utf-8');
  const startTag = '<claude-mem-context>';
  const endTag = '</claude-mem-context>';

  const startIdx = content.indexOf(startTag);
  const endIdx = content.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1) return;

  const before = content.slice(0, startIdx).replace(/\n+$/, '');
  const after = content.slice(endIdx + endTag.length).replace(/^\n+/, '');
  const next = [before, after].filter((s) => s.trim().length > 0).join('\n\n').trim();

  if (next.length === 0) {
    unlinkSync(contextPath);
  } else {
    writeFileSync(contextPath, next + '\n');
  }
}

function aggregate(findings: DoctorFinding[]): DoctorStatus {
  if (findings.some((f) => f.status === 'fail')) return 'fail';
  if (findings.some((f) => f.status === 'warn')) return 'warn';
  if (findings.every((f) => f.status === 'not-installed')) return 'not-installed';
  if (findings.every((f) => f.status === 'ok')) return 'ok';
  return 'unknown';
}

export { CLAUDE_MEM_SERVER_KEY };
