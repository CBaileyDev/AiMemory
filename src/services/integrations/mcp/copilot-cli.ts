/**
 * Copilot CLI — MCP integration.
 *
 * Writes `~/.github/copilot/mcp.json` (`servers` key), plus a workspace-local
 * `.github/copilot-instructions.md` context file.
 */

import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

export const copilotCliIntegration: Integration = buildJsonMcpIntegration({
  id: 'copilot-cli',
  label: 'Copilot CLI',
  tier: 2,
  configPath: () => path.join(homedir(), '.github', 'copilot', 'mcp.json'),
  configKey: 'servers',
  contextFile: ({ cwd }) => path.join(cwd, '.github', 'copilot-instructions.md'),
  async detect() {
    const p = path.join(homedir(), '.copilot');
    return {
      detected: existsSync(p),
      reason: existsSync(p) ? `${p} exists` : `${p} not found`,
    };
  },
});
