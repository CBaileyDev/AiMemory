import React from 'react';

const TYPE_META: Record<string, { label: string; color: string; iconKey: string }> = {
  learned: { label: 'Decision', color: 'var(--type-decision)', iconKey: 'star' },
  decision: { label: 'Decision', color: 'var(--type-decision)', iconKey: 'star' },
  bugfix: { label: 'Bugfix', color: 'var(--type-bugfix)', iconKey: 'bug' },
  bug: { label: 'Bugfix', color: 'var(--type-bugfix)', iconKey: 'bug' },
  completed: { label: 'Feature', color: 'var(--type-feature)', iconKey: 'plus' },
  feature: { label: 'Feature', color: 'var(--type-feature)', iconKey: 'plus' },
  investigated: { label: 'Refactor', color: 'var(--type-refactor)', iconKey: 'layers' },
  refactor: { label: 'Refactor', color: 'var(--type-refactor)', iconKey: 'layers' },
  'next-steps': { label: 'Discovery', color: 'var(--type-discovery)', iconKey: 'spark' },
  discovery: { label: 'Discovery', color: 'var(--type-discovery)', iconKey: 'spark' },
  investigation: { label: 'Investigation', color: 'var(--type-investigation)', iconKey: 'eye' },
  prompt: { label: 'Prompt', color: 'var(--type-prompt)', iconKey: 'ask' },
  next: { label: 'Next step', color: 'var(--type-next)', iconKey: 'arrow' }
};

const SOURCE_COLORS: Record<string, string> = {
  'claude-code': 'var(--src-claude)',
  'claude-desktop': 'var(--src-claude)',
  claude: 'var(--src-claude)',
  'codex-cli': 'var(--src-codex)',
  'codex-vscode': 'var(--src-codex)',
  codex: 'var(--src-codex)',
  cursor: 'var(--src-cursor)',
  'gemini-cli': 'var(--src-gemini)',
  'gemini-vscode': 'var(--src-gemini)',
  gemini: 'var(--src-gemini)',
  kimi: 'var(--src-kimi)',
  'kimi-code': 'var(--src-kimi)',
  windsurf: 'var(--src-windsurf)',
  opencode: 'var(--src-opencode)',
  copilot: 'var(--src-copilot)',
  'copilot-cli': 'var(--src-copilot)',
  warp: 'var(--src-warp)',
  'roo-code': 'var(--src-roo)',
  goose: 'var(--src-goose)',
  crush: 'var(--src-crush)'
};

const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'claude-desktop': 'Claude Desktop',
  'codex-cli': 'Codex',
  'codex-vscode': 'Codex',
  'gemini-cli': 'Gemini',
  'gemini-vscode': 'Gemini',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  kimi: 'Kimi Code',
  'kimi-code': 'Kimi Code',
  opencode: 'OpenCode',
  copilot: 'Copilot',
  'copilot-cli': 'Copilot',
  warp: 'Warp',
  'roo-code': 'Roo Code',
  goose: 'Goose',
  crush: 'Crush'
};

const ICONS: Record<string, React.ReactNode> = {
  star: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" strokeWidth="0" aria-hidden="true">
      <path d="m12 2 2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 16.4 6.4 19.5 7.8 13 3 8.6l6.4-.6L12 2z" />
    </svg>
  ),
  bug: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 7V5a3 3 0 1 1 6 0v2M5 11h14M5 15h14M12 7v14" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="m12 2 2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 16.4 6.4 19.5 7.8 13 3 8.6l6.4-.6L12 2z" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  ask: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 4.5 16.8L21 21l-1.2-4.5A9 9 0 0 0 12 3z" />
      <path d="M9.5 10a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
};

const ICON_BOLT = (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

export interface MemoryCardItem {
  id: number;
  type: string;
  source: string;
  title: string;
  summary: string;
  project: string;
  files: string[];
  time: string;
  tokensSaved: number;
  isFresh?: boolean;
}

interface MemoryCardProps {
  item: MemoryCardItem;
  selected: boolean;
  onSelect: (id: number) => void;
}

export function MemoryCard({ item, selected, onSelect }: MemoryCardProps) {
  const typeMeta = TYPE_META[item.type] ?? TYPE_META.completed;
  const sourceColor = SOURCE_COLORS[item.source] ?? 'var(--ink-2)';
  const sourceLabel = SOURCE_LABELS[item.source] ?? item.source;
  const icon = ICONS[typeMeta.iconKey] ?? ICONS.star;

  return (
    <div
      className={`mem ${selected ? 'is-selected' : ''} ${item.isFresh ? 'is-new' : ''}`}
      onClick={() => onSelect(item.id)}
      role="button"
      tabIndex={0}
    >
      <div className="mem-icon" style={{ color: typeMeta.color }}>
        {icon}
      </div>
      <div className="mem-body">
        <div className="mem-row">
          <span className="ttag" style={{ color: typeMeta.color }}>{typeMeta.label}</span>
          <span className="src" style={{ color: sourceColor }}>{sourceLabel}</span>
          {item.project && (
            <span className="muted mono" style={{ fontSize: 11 }}>· {item.project}</span>
          )}
          <span className="faint mono" style={{ fontSize: 11 }}>· obs#{item.id}</span>
        </div>
        <h3 className="mem-title" style={{ marginTop: 6 }}>{item.title}</h3>
        {item.summary && <p className="mem-summary">{item.summary}</p>}
        {item.files.length > 0 && (
          <div className="mem-files">
            {item.files.slice(0, 6).map((f) => (
              <span key={f} className="file-pill">{f}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mem-side">
        <span className="mem-time mono">{item.time}</span>
        {item.tokensSaved > 0 ? (
          <span
            className="mem-tokens reused"
            title="Tokens saved by recalling instead of reprompting"
          >
            {ICON_BOLT} {item.tokensSaved.toLocaleString('en-US')} saved
          </span>
        ) : (
          <span className="mem-time">new entry</span>
        )}
      </div>
    </div>
  );
}
