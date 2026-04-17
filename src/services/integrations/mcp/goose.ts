/**
 * Goose — MCP integration (YAML).
 *
 * Goose stores config at `~/.config/goose/config.yaml`. We avoid pulling in
 * a YAML parser by manipulating the file as text. The claude-mem block is
 * appended under `mcpServers:` if that key exists, or the whole `mcpServers:`
 * block is appended if the file has no such key. Existing content and
 * indentation are preserved.
 */

import path from 'path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { findMcpServerPath } from '../CursorHooksInstaller.js';
import { backupFile, createBackupSession, pruneBackups } from '../_backup.js';
import type {
  DoctorFinding,
  DoctorReport,
  ExitCode,
  Integration,
} from '../types.js';

function gooseConfigPath(): string {
  return path.join(homedir(), '.config', 'goose', 'config.yaml');
}

function buildEntryYaml(mcpServerPath: string): string {
  return [
    '  claude-mem:',
    `    command: ${process.execPath}`,
    '    args:',
    `      - ${mcpServerPath}`,
  ].join('\n');
}

function buildBlockYaml(mcpServerPath: string): string {
  return ['mcpServers:', buildEntryYaml(mcpServerPath)].join('\n');
}

export const gooseIntegration: Integration = {
  id: 'goose',
  label: 'Goose',
  tier: 2,

  async detect() {
    const p = path.join(homedir(), '.config', 'goose');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },

  backupPaths() {
    return [gooseConfigPath()];
  },

  async install(opts): Promise<ExitCode> {
    const log = opts?.silent ? () => {} : console.log;
    const err = opts?.silent ? () => {} : console.error;
    log('\nInstalling Claude-Mem MCP integration for Goose...\n');

    const mcpServerPath = findMcpServerPath();
    if (!mcpServerPath) {
      err('Could not find MCP server script');
      return 1;
    }

    const session = createBackupSession('mcp-goose-install');
    const configPath = gooseConfigPath();

    try {
      mkdirSync(path.dirname(configPath), { recursive: true });
      backupFile(session, configPath);

      if (existsSync(configPath)) {
        let yaml = readFileSync(configPath, 'utf-8');

        if (yaml.includes('claude-mem:') && yaml.includes('mcpServers:')) {
          // Replace existing entry
          const pattern = /( {2}claude-mem:\n(?:.*\n)*?(?= {2}\S|\n\n|^\S|$))/m;
          yaml = yaml.replace(pattern, buildEntryYaml(mcpServerPath) + '\n');
        } else if (yaml.includes('mcpServers:')) {
          const idx = yaml.indexOf('mcpServers:') + 'mcpServers:'.length;
          yaml = yaml.slice(0, idx) + '\n' + buildEntryYaml(mcpServerPath) + yaml.slice(idx);
        } else {
          yaml = yaml.trimEnd() + '\n\n' + buildBlockYaml(mcpServerPath) + '\n';
        }

        writeFileSync(configPath, yaml);
      } else {
        writeFileSync(configPath, buildBlockYaml(mcpServerPath) + '\n');
      }

      pruneBackups();
      log(`  Config: ${configPath}`);
      return 0;
    } catch (error) {
      err(`\nInstallation failed: ${(error as Error).message}`);
      return 1;
    }
  },

  async uninstall(opts): Promise<ExitCode> {
    const log = opts?.silent ? () => {} : console.log;
    const configPath = gooseConfigPath();
    if (!existsSync(configPath)) {
      log('  No Goose config found — nothing to remove.');
      return 0;
    }

    const session = createBackupSession('mcp-goose-uninstall');
    backupFile(session, configPath);

    try {
      let yaml = readFileSync(configPath, 'utf-8');
      // Remove the claude-mem entry block. The block is terminated by
      // either the next top-level key, the next entry under mcpServers,
      // a blank line, or EOF.
      const pattern = /\n? {2}claude-mem:\n(?:(?: {4,}.*|\s*)\n)*/;
      yaml = yaml.replace(pattern, '\n');

      // Collapse an empty `mcpServers:` block — if the only child was
      // claude-mem, remove the whole block.
      yaml = yaml.replace(/\nmcpServers:\s*\n(?=\S|$)/g, '\n');

      // Trim trailing whitespace
      yaml = yaml.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

      if (yaml.trim().length === 0) {
        unlinkSync(configPath);
      } else {
        writeFileSync(configPath, yaml);
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
    const configPath = gooseConfigPath();

    if (!existsSync(configPath)) {
      findings.push({
        status: 'not-installed',
        message: 'Goose MCP config not found',
        hint: 'Run: npx claude-mem install --ide goose',
      });
    } else {
      const yaml = readFileSync(configPath, 'utf-8');
      if (yaml.includes('claude-mem:') && yaml.includes('mcpServers:')) {
        findings.push({ status: 'ok', message: 'Goose MCP config contains claude-mem entry' });
      } else {
        findings.push({
          status: 'not-installed',
          message: 'Goose config exists but claude-mem is not registered',
          hint: 'Run: npx claude-mem install --ide goose',
        });
      }
    }

    const status =
      findings.some((f) => f.status === 'fail')
        ? 'fail'
        : findings.some((f) => f.status === 'not-installed')
          ? 'not-installed'
          : 'ok';

    return { status, findings };
  },
};
