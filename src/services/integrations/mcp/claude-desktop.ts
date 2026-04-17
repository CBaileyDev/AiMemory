/**
 * Claude Desktop — MCP integration.
 *
 * The desktop/client companion to Claude Code. MCP servers are declared in
 * `claude_desktop_config.json`, whose location is platform-specific:
 *
 *   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
 *   Windows: %APPDATA%\Claude\claude_desktop_config.json
 *   Linux:   ~/.config/Claude/claude_desktop_config.json
 *
 * We pick the correct path at runtime from `process.platform`. The file
 * uses the standard `{ mcpServers: {...} }` shape.
 *
 * Source:
 *   https://explainmcp.com/mcp-servers/claude-desktop-config-json-guide/
 */

import path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { buildJsonMcpIntegration } from './_shared.js';
import type { Integration } from '../types.js';

/** Resolve the Claude Desktop config file path for the current OS. */
export function claudeDesktopConfigPath(): string {
  const home = homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        'Claude',
        'claude_desktop_config.json',
      );
    default:
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/** Resolve the directory containing the Claude Desktop config. */
function claudeDesktopConfigDir(): string {
  return path.dirname(claudeDesktopConfigPath());
}

export const claudeDesktopIntegration: Integration = buildJsonMcpIntegration({
  id: 'claude-desktop',
  label: 'Claude Desktop',
  tier: 2,
  configPath: () => claudeDesktopConfigPath(),
  configKey: 'mcpServers',
  async detect() {
    const dir = claudeDesktopConfigDir();
    return {
      detected: existsSync(dir),
      reason: existsSync(dir) ? `${dir} exists` : `${dir} not found`,
    };
  },
});
