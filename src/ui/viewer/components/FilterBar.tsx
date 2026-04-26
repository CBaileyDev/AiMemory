import React from 'react';
import type { FilterState, FilterAction } from '../state/filterReducer';

const TYPE_OPTIONS = [
  { id: 'learned', label: 'Decision', color: 'var(--type-decision)' },
  { id: 'bugfix', label: 'Bugfix', color: 'var(--type-bugfix)' },
  { id: 'completed', label: 'Feature', color: 'var(--type-feature)' },
  { id: 'investigated', label: 'Refactor', color: 'var(--type-refactor)' },
  { id: 'next-steps', label: 'Discovery', color: 'var(--type-discovery)' }
];

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

interface SourceTotal {
  id: string;
  total: number;
}

interface FilterBarProps {
  state: FilterState;
  dispatch: (action: FilterAction) => void;
  sourceTotals: SourceTotal[];
  selectedProject: string | null;
}

const ICON_FOLDER = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const ICON_CLOCK = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const ICON_FILTER = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 5h18l-7 9v6l-4-2v-4z" />
  </svg>
);

export function FilterBar({ state, dispatch, sourceTotals, selectedProject }: FilterBarProps) {
  const sourceOpts = sourceTotals.filter((s) => s.total > 0).slice(0, 8);

  const isTypeActive = (id: string) => state.types.includes(id);
  const isSourceActive = (id: string) => state.sources.includes(id);

  return (
    <div className="filterbar">
      <div className="filterbar-group">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${isTypeActive(t.id) ? 'is-active' : ''}`}
            onClick={() => dispatch({ kind: 'toggleType', value: t.id })}
          >
            <span className="swatch" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      {sourceOpts.length > 0 && <div className="filterbar-divider" />}

      <div className="filterbar-group">
        {sourceOpts.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${isSourceActive(s.id) ? 'is-active' : ''}`}
            onClick={() => dispatch({ kind: 'toggleSource', value: s.id })}
          >
            <span className="swatch" style={{ background: SOURCE_COLORS[s.id] ?? 'var(--ink-2)' }} />
            {SOURCE_LABELS[s.id] ?? s.id}
            <span className="count">{s.total.toLocaleString('en-US')}</span>
          </button>
        ))}
      </div>

      <div className="filterbar-spacer" />

      <button type="button" className="chip">
        {ICON_FOLDER}
        Project: {selectedProject ?? 'all'}
      </button>
      <button type="button" className="chip">
        {ICON_CLOCK}
        Last 7d
      </button>
      <button type="button" className="btn ghost sm">
        {ICON_FILTER}
        Saved views
      </button>
    </div>
  );
}
