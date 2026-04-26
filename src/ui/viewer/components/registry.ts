/**
 * Source + memory-type registries.
 *
 * Maps real platform_source / observation type strings into the design's
 * semantic colors and labels. Source colors carry meaning everywhere they
 * appear: feed icon stripe, source dot, source card mark, savings bar,
 * graph cluster.
 */

export interface SourceMeta {
  id: string;
  name: string;
  short: string;
  color: string;
  kind: string;
}

export interface TypeMeta {
  key: string;
  label: string;
  color: string;
}

const SOURCE_TABLE: SourceMeta[] = [
  { id: 'claude-code', name: 'Claude Code', short: 'CC', color: 'var(--src-claude)', kind: 'plugin' },
  { id: 'claude-desktop', name: 'Claude Desktop', short: 'CD', color: 'var(--src-claude)', kind: 'MCP' },
  { id: 'claude', name: 'Claude', short: 'Cl', color: 'var(--src-claude)', kind: 'sdk' },
  { id: 'codex-cli', name: 'Codex', short: 'Cx', color: 'var(--src-codex)', kind: 'transcript' },
  { id: 'codex-vscode', name: 'Codex VS Code', short: 'CV', color: 'var(--src-codex)', kind: 'extension' },
  { id: 'cursor', name: 'Cursor', short: 'Cu', color: 'var(--src-cursor)', kind: 'hooks' },
  { id: 'gemini-cli', name: 'Gemini', short: 'Gm', color: 'var(--src-gemini)', kind: 'hooks+MCP' },
  { id: 'gemini-vscode', name: 'Gemini VS Code', short: 'GV', color: 'var(--src-gemini)', kind: 'extension' },
  { id: 'antigravity', name: 'Antigravity', short: 'Ag', color: 'var(--src-gemini)', kind: 'hooks' },
  { id: 'kimi', name: 'Kimi', short: 'Ki', color: 'var(--src-kimi)', kind: 'MCP' },
  { id: 'kimi-code', name: 'Kimi Code', short: 'Kc', color: 'var(--src-kimi)', kind: 'MCP' },
  { id: 'windsurf', name: 'Windsurf', short: 'Ws', color: 'var(--src-windsurf)', kind: 'hooks' },
  { id: 'opencode', name: 'OpenCode', short: 'Oc', color: 'var(--src-opencode)', kind: 'plugin' },
  { id: 'openclaw', name: 'OpenClaw', short: 'Ow', color: 'var(--src-windsurf)', kind: 'plugin' },
  { id: 'copilot-cli', name: 'Copilot CLI', short: 'Co', color: 'var(--src-copilot)', kind: 'MCP' },
  { id: 'warp', name: 'Warp', short: 'Wp', color: 'var(--src-warp)', kind: 'MCP' },
  { id: 'roo-code', name: 'Roo Code', short: 'Rc', color: 'var(--src-roo)', kind: 'MCP' },
  { id: 'goose', name: 'Goose', short: 'Gs', color: 'var(--src-goose)', kind: 'MCP' },
  { id: 'crush', name: 'Crush', short: 'Cr', color: 'var(--src-crush)', kind: 'MCP' }
];

const SOURCE_BY_ID = new Map(SOURCE_TABLE.map(s => [s.id, s]));

const SOURCE_ALIASES: Record<string, string> = {
  codex: 'codex-cli',
  cli: 'claude',
  copilot: 'copilot-cli',
  gemini: 'gemini-cli',
  claudedesktop: 'claude-desktop',
  vscode: 'codex-vscode',
  ide: 'cursor'
};

export function sourceMeta(id: string | null | undefined): SourceMeta {
  if (!id) {
    return { id: 'unknown', name: 'Unknown', short: '?', color: 'var(--ink-2)', kind: 'unknown' };
  }
  const aliasedId = SOURCE_ALIASES[id] || id;
  const found = SOURCE_BY_ID.get(aliasedId);
  if (found) return { ...found, id }; // keep the original id for the card
  // Fall back to a deterministic rendering for unknown ids
  const short = id
    .split(/[-_/ ]+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || id.slice(0, 2).toUpperCase();
  return { id, name: id, short, color: 'var(--ink-2)', kind: 'unknown' };
}

export const ALL_SOURCES: ReadonlyArray<SourceMeta> = SOURCE_TABLE;

const TYPE_TABLE: Record<string, TypeMeta> = {
  decision:      { key: 'decision',      label: 'Decision',      color: 'var(--type-decision)' },
  bugfix:        { key: 'bugfix',        label: 'Bugfix',        color: 'var(--type-bugfix)' },
  feature:       { key: 'feature',       label: 'Feature',       color: 'var(--type-feature)' },
  refactor:      { key: 'refactor',      label: 'Refactor',      color: 'var(--type-refactor)' },
  discovery:     { key: 'discovery',     label: 'Discovery',     color: 'var(--type-discovery)' },
  investigation: { key: 'investigation', label: 'Investigation', color: 'var(--type-investigation)' },
  prompt:        { key: 'prompt',        label: 'Prompt',        color: 'var(--type-prompt)' },
  next:          { key: 'next',          label: 'Next step',     color: 'var(--type-next)' }
};

const TYPE_ALIASES: Record<string, string> = {
  learned: 'decision',
  completed: 'feature',
  investigated: 'investigation',
  'next-steps': 'next',
  next_steps: 'next',
  bug: 'bugfix',
  summary: 'decision'
};

export function normalizeTypeKey(raw: string | null | undefined): string {
  if (!raw) return 'decision';
  const k = raw.trim().toLowerCase().replace(/_/g, '-');
  return TYPE_ALIASES[k] || (TYPE_TABLE[k] ? k : 'decision');
}

export function typeMeta(raw: string | null | undefined): TypeMeta {
  return TYPE_TABLE[normalizeTypeKey(raw)] || TYPE_TABLE.decision;
}

export const ALL_TYPES: ReadonlyArray<TypeMeta> = Object.values(TYPE_TABLE);

export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatRelativeTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return 'now';
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function shortTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function dayBucket(ms: number | null | undefined): string {
  if (!ms) return 'Unknown';
  const d = new Date(ms);
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) {
    return d.toLocaleDateString([], { weekday: 'long' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
