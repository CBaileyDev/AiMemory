import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Observation, Summary, UserPrompt } from '../types';
import { GraphCanvas } from './GraphCanvas';
import { flattenToLeaves } from '../utils/graph';
import type { GraphDrawNode } from '../utils/graph';
import { useTheme } from '../hooks/useTheme';

interface GraphPageProps {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  onJumpToObservation?: (id: number) => void;
}

const LEGEND_COLORS = [
  'var(--accent-primary)',
  'var(--source-gemini-cli)',
  'var(--source-roo-code)',
  'var(--source-cursor)'
];

export function GraphPage({ observations, summaries, prompts, onJumpToObservation }: GraphPageProps) {
  const leaves = useMemo(
    () => flattenToLeaves(observations, summaries, prompts),
    [observations, summaries, prompts]
  );
  const [selected, setSelected] = useState<GraphDrawNode | null>(null);
  const { scheme } = useTheme();
  const [accentRgb, setAccentRgb] = useState('rgb(34, 211, 238)');

  const legendItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const leaf of leaves) {
      const project = leaf.project?.trim();
      if (!project) continue;
      counts.set(project, (counts.get(project) || 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label], index) => ({
        label,
        color: LEGEND_COLORS[index % LEGEND_COLORS.length]
      }));
  }, [leaves]);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const c = cs.getPropertyValue('--accent-primary').trim();
    if (c) setAccentRgb(c);
  }, [scheme]);

  const onSelectNode = useCallback((node: GraphDrawNode | null) => {
    setSelected(node);
  }, []);

  return (
    <div className="am-graph-page">
      <div className="am-graph-page__stage">
        <div className="am-graph-page__hint">Scroll to zoom · Drag to pan · Click nodes</div>

        {legendItems.length > 0 && (
          <aside className="am-graph-page__legend" aria-label="Node clusters">
            <div className="am-graph-page__legend-title">Node clusters</div>
            <div className="am-graph-page__legend-list">
              {legendItems.map((item) => (
                <div key={item.label} className="am-graph-page__legend-item">
                  <span
                    className="am-graph-page__legend-dot"
                    aria-hidden="true"
                    style={{ background: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {selected && (
          <aside className="am-graph-page__focus" aria-live="polite">
            <div className="am-graph-page__focus-label">
              {selected.leaf ? `${selected.leaf.kind} #${selected.leaf.dbId}` : selected.label}
            </div>
            <div className="am-graph-page__focus-meta">
              <span>{selected.project || 'Unknown project'}</span>
              <span>{selected.agent || 'Unknown source'}</span>
              {selected.leaf && <span>{selected.leaf.memoryType}</span>}
              {!selected.leaf && selected.count != null && selected.count > 1 && <span>{selected.count} memories</span>}
            </div>
            {selected.leaf?.kind === 'observation' && onJumpToObservation && (
              <button
                type="button"
                className="am-graph-page__focus-button"
                onClick={() => onJumpToObservation(selected.leaf!.dbId)}
              >
                Open in feed
              </button>
            )}
          </aside>
        )}

        <div className="am-graph-page__canvas-wrap">
          <GraphCanvas leaves={leaves} accentRgb={accentRgb} onSelectNode={onSelectNode} />
        </div>
      </div>
    </div>
  );
}
