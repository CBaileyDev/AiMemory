import React from 'react';
import type { MemoryCardItem } from './MemoryCard';

const TYPE_META: Record<string, { label: string; color: string }> = {
  learned: { label: 'Decision', color: 'var(--type-decision)' },
  decision: { label: 'Decision', color: 'var(--type-decision)' },
  bugfix: { label: 'Bugfix', color: 'var(--type-bugfix)' },
  bug: { label: 'Bugfix', color: 'var(--type-bugfix)' },
  completed: { label: 'Feature', color: 'var(--type-feature)' },
  feature: { label: 'Feature', color: 'var(--type-feature)' },
  investigated: { label: 'Refactor', color: 'var(--type-refactor)' },
  refactor: { label: 'Refactor', color: 'var(--type-refactor)' },
  'next-steps': { label: 'Discovery', color: 'var(--type-discovery)' },
  discovery: { label: 'Discovery', color: 'var(--type-discovery)' },
  investigation: { label: 'Investigation', color: 'var(--type-investigation)' },
  prompt: { label: 'Prompt', color: 'var(--type-prompt)' },
  next: { label: 'Next step', color: 'var(--type-next)' }
};

const SOURCE_COLORS: Record<string, string> = {
  'claude-code': 'var(--src-claude)',
  'claude-desktop': 'var(--src-claude)',
  claude: 'var(--src-claude)',
  'codex-cli': 'var(--src-codex)',
  codex: 'var(--src-codex)',
  cursor: 'var(--src-cursor)',
  'gemini-cli': 'var(--src-gemini)',
  gemini: 'var(--src-gemini)',
  kimi: 'var(--src-kimi)',
  'kimi-code': 'var(--src-kimi)',
  windsurf: 'var(--src-windsurf)',
  opencode: 'var(--src-opencode)',
  copilot: 'var(--src-copilot)',
  warp: 'var(--src-warp)',
  'roo-code': 'var(--src-roo)',
  goose: 'var(--src-goose)',
  crush: 'var(--src-crush)'
};

const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'claude-desktop': 'Claude Desktop',
  'codex-cli': 'Codex',
  cursor: 'Cursor',
  'gemini-cli': 'Gemini',
  windsurf: 'Windsurf',
  kimi: 'Kimi Code',
  'kimi-code': 'Kimi Code',
  opencode: 'OpenCode'
};

const ICON_FOLDER = (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const ICON_CITE = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13c0 2 1 4 4 4M13 13c0 2 1 4 4 4" />
  </svg>
);

const ICON_GRAPH = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M7.4 7.4 10.6 16.6M16.6 7.4 13.4 16.6M8 6h8" />
  </svg>
);

interface InspectorProps {
  memory: MemoryCardItem | null;
  day?: string;
  concepts?: string[];
  tokensCost?: number;
  tokensReused?: number;
  onCite?: () => void;
  onShowInGraph?: () => void;
}

export function Inspector({
  memory,
  day,
  concepts = [],
  tokensCost = 0,
  tokensReused = 0,
  onCite,
  onShowInGraph
}: InspectorProps) {
  if (!memory) {
    return (
      <div className="inspector">
        <div className="insp-eyebrow">no selection</div>
        <h3 className="insp-title">Select a memory</h3>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-2)' }}>
          Click any card on the left to inspect token impact, cited files, lineage, and concepts.
        </p>
      </div>
    );
  }

  const typeMeta = TYPE_META[memory.type] ?? TYPE_META.completed;
  const sourceColor = SOURCE_COLORS[memory.source] ?? 'var(--ink-2)';
  const sourceLabel = SOURCE_LABELS[memory.source] ?? memory.source;
  const netSaved = memory.tokensSaved;
  const estValue = (netSaved * 0.000087).toFixed(2);

  return (
    <div className="inspector">
      <div className="insp-eyebrow">
        obs#{memory.id} · {day ?? 'Today'} {memory.time}
      </div>
      <h3 className="insp-title">{memory.title}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="ttag" style={{ color: typeMeta.color }}>{typeMeta.label}</span>
        <span className="src" style={{ color: sourceColor }}>{sourceLabel}</span>
        {memory.project && (
          <span className="chip" style={{ height: 18, fontSize: 10.5 }}>
            {ICON_FOLDER} {memory.project}
          </span>
        )}
      </div>

      {memory.summary && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.6 }}>
          {memory.summary}
        </p>
      )}

      <div className="insp-section">
        <h4>Token impact</h4>
        <dl className="insp-kv">
          <dt>Originally cost</dt>
          <dd className="tnum">{tokensCost.toLocaleString('en-US')} tok</dd>
          <dt>Reused since</dt>
          <dd className="tnum" style={{ color: 'var(--cyan-200)' }}>
            {tokensReused.toLocaleString('en-US')} tok
          </dd>
          <dt>Net saved</dt>
          <dd className="tnum" style={{ color: 'var(--ok)' }}>
            {netSaved.toLocaleString('en-US')} tok
          </dd>
          <dt>Est. value</dt>
          <dd className="tnum">${estValue}</dd>
        </dl>
      </div>

      {memory.files.length > 0 && (
        <div className="insp-section">
          <h4>Cited files</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {memory.files.map((f) => (
              <span key={f} className="file-pill">{f}</span>
            ))}
          </div>
        </div>
      )}

      {concepts.length > 0 && (
        <div className="insp-section">
          <h4>Concepts</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {concepts.slice(0, 12).map((c) => (
              <span key={c} className="file-pill" style={{ color: 'var(--cyan-100)' }}>
                #{c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="insp-section">
        <h4>Lineage</h4>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: 'var(--ink-1)',
            lineHeight: 1.7
          }}
        >
          {memory.id > 4 && <div>↳ obs#{memory.id - 4} · prior decision</div>}
          {memory.id > 1 && <div>↳ obs#{memory.id - 1} · same session</div>}
          <div style={{ color: 'var(--cyan-200)' }}>● obs#{memory.id} (this)</div>
          <div>↳ obs#{memory.id + 1} · follow-up</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" className="btn primary" onClick={onCite}>
          {ICON_CITE} Cite in ask
        </button>
        <button type="button" className="btn" onClick={onShowInGraph}>
          {ICON_GRAPH} Show in graph
        </button>
      </div>
    </div>
  );
}
