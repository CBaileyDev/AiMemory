import React from 'react';
import { SourceDot } from './primitives/SourceDot';

interface SourceStripProps {
  sources: string[];
  selected: string[];
  counts?: Record<string, number>;
  onToggle: (source: string, exclusive?: boolean) => void;
}

export function SourceStrip({ sources, selected, counts, onToggle }: SourceStripProps) {
  const isAll = selected.length === 0;
  return (
    <div className="am-source-strip" role="tablist" aria-label="Filter by source">
      <button
        type="button"
        role="tab"
        aria-selected={isAll}
        className={`am-source-chip ${isAll ? 'is-active' : ''}`}
        onClick={() => { if (!isAll) selected.slice().forEach(s => onToggle(s)); }}
      >
        <SourceDot source="all" />
        <span>all</span>
      </button>
      {sources.map((s) => {
        const active = selected.includes(s);
        const count = counts?.[s];
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            className={`am-source-chip ${active ? 'is-active' : ''}`}
            onClick={(e) => onToggle(s, !e.shiftKey)}
            title={`${s}${count != null ? ` — ${count} observations` : ''} · Shift-click to multi-select`}
          >
            <SourceDot source={s} />
            <span>{s}</span>
            {count != null && <span className="am-source-chip__count">{formatCount(count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}
