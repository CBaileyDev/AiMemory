/**
 * `npx claude-mem doctor` — system-wide self-diagnosis.
 *
 * Runs a series of checks against the current machine's claude-mem
 * install and reports their status. The goal is to answer the question
 * "is memory working?" without the user ever opening SQLite or logs.
 *
 * Checks run in three groups:
 *   1. Environment     — Node, Bun, writable HOME
 *   2. Plugin install  — marketplace directory + version sanity
 *   3. Worker + data   — /api/health, DB file presence
 *   4. Per-IDE         — dispatches to each Integration's `doctor()`
 *
 * Flags:
 *   --ide <id>   Only run per-IDE checks for one IDE.
 *   --json       Emit the full DoctorReport as structured JSON.
 *   --fix        Attempt safe auto-repair: re-run failing installers,
 *                create missing `~/.claude-mem/` directory, etc.
 *                Never deletes user data.
 *
 * Exit code:
 *   0 when every check is `ok` or `not-installed` in a standalone IDE.
 *   1 when any check is `warn`.
 *   2 when any check is `fail`.
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import pc from 'picocolors';
import type {
  DoctorFinding,
  DoctorReport,
  DoctorStatus,
  Integration,
} from '../../services/integrations/types.js';
import { REGISTRY } from '../../services/integrations/registry.js';
import {
  claudeMemDataDirectory,
  isPluginInstalled,
  marketplaceDirectory,
  readPluginVersion,
} from '../utils/paths.js';
import { resolveBunBinaryPath } from '../utils/bun-resolver.js';

// ---------------------------------------------------------------------------
// Option parsing
// ---------------------------------------------------------------------------

export interface DoctorOptions {
  ide?: string;
  json?: boolean;
  fix?: boolean;
}

export function parseDoctorArgs(args: string[]): DoctorOptions {
  const opts: DoctorOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--fix') opts.fix = true;
    else if (arg === '--ide') {
      opts.ide = args[++i];
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Section runners
// ---------------------------------------------------------------------------

interface Section {
  title: string;
  findings: DoctorFinding[];
}

async function checkEnvironment(): Promise<Section> {
  const findings: DoctorFinding[] = [];

  findings.push({
    status: parseMajor(process.version) >= 18 ? 'ok' : 'fail',
    message: `Node ${process.version}`,
    hint:
      parseMajor(process.version) >= 18
        ? undefined
        : 'claude-mem requires Node 18+. Install from https://nodejs.org/',
  });

  const bunPath = resolveBunBinaryPath();
  if (bunPath) {
    findings.push({ status: 'ok', message: `Bun found: ${bunPath}` });
  } else {
    findings.push({
      status: 'warn',
      message: 'Bun runtime not found on PATH',
      hint: 'Install Bun: curl -fsSL https://bun.sh/install | bash',
    });
  }

  const home = homedir();
  findings.push(
    existsSync(home)
      ? { status: 'ok', message: `HOME writable at ${home}` }
      : { status: 'fail', message: `HOME directory ${home} does not exist` },
  );

  return { title: 'Environment', findings };
}

async function checkPluginInstall(): Promise<Section> {
  const findings: DoctorFinding[] = [];
  const marketplaceDir = marketplaceDirectory();

  if (!isPluginInstalled()) {
    findings.push({
      status: 'not-installed',
      message: `Plugin not installed at ${marketplaceDir}`,
      hint: 'Run: npx claude-mem install',
    });
    return { title: 'Plugin install', findings };
  }

  findings.push({
    status: 'ok',
    message: `Plugin installed at ${marketplaceDir}`,
  });

  try {
    const version = readPluginVersion();
    findings.push({ status: 'ok', message: `Plugin version: ${version}` });
  } catch (error) {
    findings.push({
      status: 'warn',
      message: `Unable to read plugin version: ${(error as Error).message}`,
    });
  }

  return { title: 'Plugin install', findings };
}

async function checkWorkerAndData(): Promise<Section> {
  const findings: DoctorFinding[] = [];
  const dataDir = claudeMemDataDirectory();

  findings.push(
    existsSync(dataDir)
      ? { status: 'ok', message: `Data directory: ${dataDir}` }
      : {
          status: 'warn',
          message: `Data directory missing: ${dataDir}`,
          hint: 'Will be created on first worker start, or run doctor --fix.',
        },
  );

  const dbPath = path.join(dataDir, 'claude-mem.db');
  findings.push(
    existsSync(dbPath)
      ? { status: 'ok', message: `SQLite DB present: ${dbPath}` }
      : {
          status: 'warn',
          message: `SQLite DB not found at ${dbPath}`,
          hint: 'Will be created when the worker first runs.',
        },
  );

  // Worker health — only check if we can hit the local port quickly.
  const port = process.env.CLAUDE_MEM_WORKER_PORT || '37777';
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok) {
      findings.push({ status: 'ok', message: `Worker responding on :${port}` });
    } else {
      findings.push({
        status: 'warn',
        message: `Worker responded with status ${response.status} on :${port}`,
        hint: 'Run: npx claude-mem restart',
      });
    }
  } catch {
    findings.push({
      status: 'warn',
      message: `Worker not reachable on :${port}`,
      hint: 'Run: npx claude-mem start',
    });
  }

  return { title: 'Worker + data', findings };
}

async function checkOneIde(id: string, integration: Integration): Promise<Section> {
  const detection = await integration.detect();
  if (!detection.detected) {
    return {
      title: `IDE: ${integration.label}`,
      findings: [
        {
          status: 'not-installed',
          message: `${integration.label} not detected (${detection.reason})`,
        },
      ],
    };
  }

  const report = await integration.doctor();
  return {
    title: `IDE: ${integration.label}`,
    findings: report.findings,
  };
}

async function checkAllIdes(only?: string): Promise<Section[]> {
  const sections: Section[] = [];
  const ids = only ? [only] : Object.keys(REGISTRY);
  for (const id of ids) {
    const integration = REGISTRY[id];
    if (!integration) continue;
    sections.push(await checkOneIde(id, integration));
  }
  return sections;
}

// ---------------------------------------------------------------------------
// --fix implementation
// ---------------------------------------------------------------------------

async function applyFixes(sections: Section[]): Promise<Section[]> {
  const fixed: Section[] = [];
  // Ensure ~/.claude-mem/ exists.
  const dataDir = claudeMemDataDirectory();
  if (!existsSync(dataDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(dataDir, { recursive: true });
  }

  // Reinstall IDEs with failed/not-installed findings that were detected.
  for (const section of sections) {
    if (!section.title.startsWith('IDE: ')) {
      fixed.push(section);
      continue;
    }
    const label = section.title.slice('IDE: '.length);
    const entry = Object.entries(REGISTRY).find(([, i]) => i.label === label);
    if (!entry) {
      fixed.push(section);
      continue;
    }
    const [, integration] = entry;
    const needsFix = section.findings.some(
      (f) => f.status === 'not-installed' || f.status === 'fail',
    );
    const det = await integration.detect();
    if (needsFix && det.detected) {
      try {
        await integration.install({ silent: true });
        // Re-run doctor for this IDE after the repair attempt.
        fixed.push(await checkOneIde(integration.id, integration));
        continue;
      } catch {
        // Fall through and emit the original section.
      }
    }
    fixed.push(section);
  }
  return fixed;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function dot(status: DoctorStatus): string {
  switch (status) {
    case 'ok':
      return pc.green('●');
    case 'warn':
      return pc.yellow('●');
    case 'fail':
      return pc.red('●');
    case 'not-installed':
      return pc.dim('○');
    default:
      return pc.dim('?');
  }
}

function render(sections: Section[]): void {
  for (const section of sections) {
    console.log('');
    console.log(pc.bold(section.title));
    for (const finding of section.findings) {
      const head = `  ${dot(finding.status)} ${finding.message}`;
      console.log(head);
      if (finding.hint) {
        console.log(pc.dim(`     → ${finding.hint}`));
      }
    }
  }
  console.log('');
}

function overallStatus(sections: Section[]): DoctorStatus {
  const all = sections.flatMap((s) => s.findings);
  if (all.some((f) => f.status === 'fail')) return 'fail';
  if (all.some((f) => f.status === 'warn')) return 'warn';
  if (all.every((f) => f.status === 'not-installed')) return 'not-installed';
  if (all.every((f) => f.status === 'ok')) return 'ok';
  return 'unknown';
}

function exitCodeFor(status: DoctorStatus): number {
  if (status === 'fail') return 2;
  if (status === 'warn') return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runDoctorCommand(args: string[] = []): Promise<void> {
  const opts = parseDoctorArgs(args);

  // If a specific IDE was requested, only run its section.
  let sections: Section[] = [];
  if (opts.ide) {
    const integration = REGISTRY[opts.ide];
    if (!integration) {
      const known = Object.keys(REGISTRY).join(', ');
      console.error(pc.red(`Unknown IDE: ${opts.ide}`));
      console.error(`Known IDEs: ${known}`);
      process.exit(2);
    }
    sections.push(await checkOneIde(opts.ide, integration));
  } else {
    sections.push(await checkEnvironment());
    sections.push(await checkPluginInstall());
    sections.push(await checkWorkerAndData());
    sections.push(...(await checkAllIdes()));
  }

  if (opts.fix) {
    sections = await applyFixes(sections);
  }

  const status = overallStatus(sections);

  if (opts.json) {
    const report: DoctorReport & { sections: Section[] } = {
      status,
      findings: sections.flatMap((s) => s.findings),
      sections,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    render(sections);
    const summaryDot = dot(status);
    const summary = pc.bold(summaryLine(status));
    console.log(`${summaryDot} ${summary}`);
  }

  process.exit(exitCodeFor(status));
}

function summaryLine(status: DoctorStatus): string {
  switch (status) {
    case 'ok':
      return 'All checks passed.';
    case 'warn':
      return 'claude-mem is working, with warnings — see above.';
    case 'fail':
      return 'claude-mem has failed checks — see above.';
    case 'not-installed':
      return 'claude-mem does not appear to be installed.';
    default:
      return 'claude-mem status: unknown.';
  }
}

function parseMajor(version: string): number {
  const match = version.match(/v?(\d+)/);
  return match ? parseInt(match[1]!, 10) : 0;
}
