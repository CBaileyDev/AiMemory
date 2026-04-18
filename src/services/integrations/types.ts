/**
 * Integration Types — shared types for IDE integrations.
 *
 * The `Integration` interface is the uniform contract every IDE installer
 * conforms to. Each installer publishes
 * detect / install / uninstall / doctor / backupPaths, and the registry
 * (`registry.ts`) dispatches to the correct integration by id.
 */

/** Tier 1 = hook/plugin (real-time capture). Tier 2 = MCP-only. Tier 3 = transcript watcher. */
export type IntegrationTier = 1 | 2 | 3;

/** Exit code semantics used across the codebase: 0 = success, 1 = failure. */
export type ExitCode = 0 | 1;

export interface DetectionResult {
  /** True iff the IDE appears installed on this machine. */
  detected: boolean;
  /** The concrete evidence — typically the path that was checked. */
  reason: string;
}

export type DoctorStatus = 'ok' | 'warn' | 'fail' | 'not-installed' | 'unknown';

export interface DoctorFinding {
  /** Severity of this finding — drives the overall doctor exit code. */
  status: DoctorStatus;
  /** Short human-readable message (<= 120 chars). */
  message: string;
  /** Optional remediation hint. */
  hint?: string;
}

export interface DoctorReport {
  /** Aggregate status (worst of all findings). */
  status: DoctorStatus;
  /** One finding per check performed. */
  findings: DoctorFinding[];
}

/**
 * Options passed to `install`. Callers may extend this; unknown fields are
 * ignored by the integration.
 */
export interface InstallOpts {
  /** Suppress non-error console output (used by `doctor --fix` repair path). */
  silent?: boolean;
}

export interface UninstallOpts {
  silent?: boolean;
}

/**
 * The uniform installer contract. Every file under `src/services/integrations/`
 * (including each MCP sub-installer) should conform.
 *
 * The contract is intentionally minimal — it documents the surface the
 * orchestration layer (`src/npx-cli/commands/*`) and the doctor command
 * rely on, and nothing else.
 */
export interface Integration {
  /** Stable machine-readable identifier, e.g. `gemini-cli`. */
  id: string;
  /** Human label, e.g. `Gemini CLI`. */
  label: string;
  /** Tier — determines the integration type (see `IntegrationTier`). */
  tier: IntegrationTier;
  /** Lightweight "is this IDE installed?" probe. Must not write anything. */
  detect(): Promise<DetectionResult>;
  /** Full installer — writes config, copies artefacts, etc. */
  install(opts?: InstallOpts): Promise<ExitCode>;
  /**
   * Symmetric uninstaller — reverses `install`, preserving any user
   * content that lived alongside the claude-mem block. MAY be undefined
   * for integrations where uninstall is not meaningful (e.g. `claude-code`,
   * which delegates to its native CLI).
   */
  uninstall?(opts?: UninstallOpts): Promise<ExitCode>;
  /** Self-diagnostic report — used by `npx claude-mem doctor`. */
  doctor(): Promise<DoctorReport>;
  /** The list of user-config file paths this installer writes to. */
  backupPaths(): string[];
}

// ============================================================================
// Cursor-specific types (legacy — kept for backwards compatibility)
// ============================================================================

export interface CursorMcpConfig {
  mcpServers: {
    [name: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

export type CursorInstallTarget = 'project' | 'user' | 'enterprise';
export type Platform = 'windows' | 'unix';

export interface CursorHooksJson {
  version: number;
  hooks: {
    beforeSubmitPrompt?: Array<{ command: string }>;
    afterMCPExecution?: Array<{ command: string }>;
    afterShellExecution?: Array<{ command: string }>;
    afterFileEdit?: Array<{ command: string }>;
    stop?: Array<{ command: string }>;
  };
}
