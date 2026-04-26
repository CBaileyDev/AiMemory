import React, { useMemo, useState } from 'react';
import type { Observation, Summary, UserPrompt } from '../types';

interface GraphPageProps {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  onJumpToObservation?: (id: number) => void;
}

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
  claude: 'Claude',
  'codex-cli': 'Codex',
  'codex-vscode': 'Codex VS Code',
  codex: 'Codex',
  cursor: 'Cursor',
  'gemini-cli': 'Gemini',
  'gemini-vscode': 'Gemini VS Code',
  gemini: 'Gemini',
  kimi: 'Kimi Code',
  'kimi-code': 'Kimi Code',
  windsurf: 'Windsurf',
  opencode: 'OpenCode',
  copilot: 'Copilot',
  'copilot-cli': 'Copilot',
  warp: 'Warp',
  'roo-code': 'Roo Code',
  goose: 'Goose',
  crush: 'Crush'
};

const TYPE_LABELS: Record<string, string> = {
  learned: 'Decision',
  bugfix: 'Bugfix',
  completed: 'Feature',
  investigated: 'Refactor',
  'next-steps': 'Discovery',
  prompt: 'Prompt'
};

const TYPE_COLORS: Record<string, string> = {
  learned: 'var(--type-decision)',
  bugfix: 'var(--type-bugfix)',
  completed: 'var(--type-feature)',
  investigated: 'var(--type-refactor)',
  'next-steps': 'var(--type-discovery)',
  prompt: 'var(--type-prompt)'
};

interface ClusterNode {
  id: string;
  label: string;
  color: string;
  count: number;
  x: number;
  y: number;
  size: number;
  projects: Set<string>;
  concepts: string[];
  typeMix: Map<string, number>;
}

interface SubNode {
  id: string;
  parent: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

const CLUSTER_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 0.30, y: 0.42 },
  { x: 0.62, y: 0.30 },
  { x: 0.74, y: 0.58 },
  { x: 0.42, y: 0.72 },
  { x: 0.18, y: 0.68 },
  { x: 0.84, y: 0.36 },
  { x: 0.52, y: 0.16 },
  { x: 0.12, y: 0.24 },
  { x: 0.90, y: 0.72 },
  { x: 0.30, y: 0.18 }
];

function normalizeType(t?: string | null): string {
  if (!t) return 'completed';
  const n = t.trim().toLowerCase().replace(/_/g, '-');
  if (n === 'decision') return 'learned';
  if (n === 'feature') return 'completed';
  if (n === 'refactor') return 'investigated';
  if (n === 'discovery') return 'next-steps';
  if (n === 'bug') return 'bugfix';
  return n;
}

function compactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function GraphPage({ observations, summaries, prompts }: GraphPageProps) {
  const [zoom, setZoom] = useState<0 | 1 | 2>(1);
  const [selected, setSelected] = useState<string | null>(null);

  const clusters = useMemo<ClusterNode[]>(() => {
    const bySource = new Map<string, ClusterNode>();

    const addItem = (
      sourceRaw: string | null | undefined,
      project: string | null | undefined,
      type: string | null | undefined,
      concepts: string | null | undefined
    ) => {
      const source = (sourceRaw || 'claude').toLowerCase();
      let cluster = bySource.get(source);
      if (!cluster) {
        const idx = bySource.size;
        const pos = CLUSTER_POSITIONS[idx % CLUSTER_POSITIONS.length];
        cluster = {
          id: source,
          label: SOURCE_LABELS[source] ?? source,
          color: SOURCE_COLORS[source] ?? 'var(--ink-2)',
          count: 0,
          x: pos.x,
          y: pos.y,
          size: 28,
          projects: new Set<string>(),
          concepts: [],
          typeMix: new Map<string, number>()
        };
        bySource.set(source, cluster);
      }
      cluster.count += 1;
      if (project) cluster.projects.add(project);
      const typeKey = normalizeType(type);
      cluster.typeMix.set(typeKey, (cluster.typeMix.get(typeKey) ?? 0) + 1);
      if (concepts) {
        try {
          const parsed = JSON.parse(concepts);
          if (Array.isArray(parsed)) {
            parsed.slice(0, 4).forEach((c) => {
              if (typeof c === 'string' && cluster!.concepts.length < 12) {
                cluster!.concepts.push(c);
              }
            });
          }
        } catch {
          /* ignore non-JSON */
        }
      }
    };

    observations.forEach((o) => addItem(o.platform_source, o.project, o.type, o.concepts ?? null));
    summaries.forEach((s) => addItem(s.platform_source, s.project, 'completed', null));
    prompts.forEach((p) => addItem(p.platform_source, p.project, 'prompt', null));

    const arr = Array.from(bySource.values());
    arr.sort((a, b) => b.count - a.count);
    const max = Math.max(...arr.map((c) => c.count), 1);
    arr.forEach((c) => {
      c.size = 22 + Math.min(56, (c.count / max) * 50);
    });
    return arr.slice(0, 10);
  }, [observations, summaries, prompts]);

  const subs = useMemo<SubNode[]>(() => {
    if (zoom < 1) return [];
    const arr: SubNode[] = [];
    clusters.forEach((c) => {
      const n = Math.max(3, Math.min(8, Math.round(c.count / 6)));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (c.id.charCodeAt(1) || 0);
        const r = 0.085 + (i % 3) * 0.012;
        arr.push({
          id: `${c.id}-${i}`,
          parent: c.id,
          x: c.x + Math.cos(a) * r,
          y: c.y + Math.sin(a) * r * 1.4,
          size: 5 + (zoom >= 2 ? 2 : 0),
          color: c.color
        });
      }
    });
    return arr;
  }, [clusters, zoom]);

  const links = useMemo<Array<[string, string]>>(() => {
    if (clusters.length < 2) return [];
    const out: Array<[string, string]> = [];
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < Math.min(clusters.length, i + 3); j++) {
        out.push([clusters[i].id, clusters[j].id]);
      }
    }
    return out;
  }, [clusters]);

  const sel = clusters.find((c) => c.id === selected) ?? clusters[0];
  const totalMemories = clusters.reduce((s, c) => s + c.count, 0);

  const W = 1600;
  const H = 900;
  const project = (x: number, y: number) => [x * W, y * H] as [number, number];

  const memoryMix = useMemo(() => {
    if (!sel) return [];
    const total = Array.from(sel.typeMix.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Array.from(sel.typeMix.entries())
      .map(([type, n]) => ({ type, pct: Math.round((n / total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [sel]);

  const topConcepts = useMemo(() => {
    if (!sel) return [];
    const counts = new Map<string, number>();
    sel.concepts.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c);
  }, [sel]);

  return (
    <div className="route" style={{ padding: 0 }} data-screen-label="02 Graph">
      <div style={{ padding: 'var(--sp-7) var(--sp-7) var(--sp-4)', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <h1 className="route-title">Memory Atlas</h1>
        <span className="route-sub mono">
          {totalMemories.toLocaleString('en-US')} memories · {clusters.length} clusters · {links.length} cross-links · zoom level {zoom}/2
        </span>
      </div>

      <div className="graph-stage">
        <div className="graph-grid" />

        <svg className="graph-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="clusterGlow">
              <stop offset="0%" stopColor="var(--cyan-300)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--cyan-300)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {links.map(([a, b], i) => {
            const A = clusters.find((c) => c.id === a)!;
            const B = clusters.find((c) => c.id === b)!;
            if (!A || !B) return null;
            const [x1, y1] = project(A.x, A.y);
            const [x2, y2] = project(B.x, B.y);
            const isSel = a === selected || b === selected;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isSel ? 'var(--cyan-300)' : 'var(--line-3)'}
                strokeOpacity={isSel ? 0.8 : 0.45}
                strokeWidth={isSel ? 1.6 : 1}
                strokeDasharray={isSel ? '0' : '3 4'}
              />
            );
          })}

          {subs.map((s) => {
            const [x, y] = project(s.x, s.y);
            const isSelCluster = s.parent === selected;
            return (
              <circle
                key={s.id}
                cx={x}
                cy={y}
                r={s.size}
                fill={s.color}
                fillOpacity={isSelCluster ? 0.9 : 0.55}
                stroke={s.color}
                strokeOpacity={0.4}
                strokeWidth="0.5"
              />
            );
          })}

          {clusters.map((c) => {
            const [x, y] = project(c.x, c.y);
            const isSel = c.id === (selected ?? clusters[0]?.id);
            return (
              <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c.id)}>
                <circle cx={x} cy={y} r={c.size * 1.8} fill="url(#clusterGlow)" opacity={isSel ? 1 : 0.4} />
                <circle
                  cx={x}
                  cy={y}
                  r={c.size}
                  fill={isSel ? 'var(--bg-3)' : 'var(--bg-2)'}
                  stroke={c.color}
                  strokeWidth={isSel ? 2 : 1.2}
                  strokeOpacity={isSel ? 1 : 0.7}
                />
                <circle cx={x} cy={y} r={c.size * 0.55} fill={c.color} opacity={isSel ? 0.18 : 0.1} />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSel ? 'var(--ink-0)' : 'var(--ink-1)'}
                  fontSize="14"
                  fontWeight="600"
                  fontFamily="var(--font-sans)"
                  style={{ pointerEvents: 'none' }}
                >
                  {compactNumber(c.count)}
                </text>
                <text
                  x={x}
                  y={y + c.size + 18}
                  textAnchor="middle"
                  fill="var(--ink-1)"
                  fontSize="12"
                  fontFamily="var(--font-mono)"
                  style={{ pointerEvents: 'none', letterSpacing: '0.04em' }}
                >
                  {c.label}
                </text>
                {isSel && (
                  <circle cx={x} cy={y} r={c.size + 8} fill="none" stroke="var(--cyan-300)" strokeOpacity="0.5" strokeDasharray="3 4">
                    <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="40s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        <div className="graph-controls">
          <button type="button" title="Zoom in" onClick={() => setZoom((z) => Math.min(2, (z + 1) as 0 | 1 | 2))}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button type="button" title="Zoom out" onClick={() => setZoom((z) => Math.max(0, (z - 1) as 0 | 1 | 2))}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <div className="sep" />
          <button type="button" title="Fit">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4" />
            </svg>
          </button>
        </div>

        <div className="graph-zoomstrip">
          {[0, 1, 2].map((z) => (
            <span
              key={z}
              className={`zoomstep ${zoom === z ? 'is-active' : ''}`}
              onClick={() => setZoom(z as 0 | 1 | 2)}
              role="button"
              tabIndex={0}
            >
              {z === 0 ? 'Clusters' : z === 1 ? 'Sub-clusters' : 'Memories'}
            </span>
          ))}
        </div>

        <div className="graph-breadcrumbs">
          <span>atlas</span>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <b>{sel?.label ?? '—'}</b>
        </div>

        <div className="graph-legend">
          <h5>Clusters by source</h5>
          {clusters.slice(0, 6).map((c) => (
            <div key={c.id} className="legend-row">
              <span className="swatch" style={{ background: c.color }} />
              <span>{c.label}</span>
              <span className="count tnum">{c.count.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>

        <div className="graph-inspector">
          <div className="insp-eyebrow">CLUSTER</div>
          <h3 className="insp-title">{sel?.label ?? 'No data'}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className="chip" style={{ height: 20, fontSize: 11 }}>
              <span className="swatch" style={{ background: sel?.color }} />
              {(sel?.count ?? 0).toLocaleString('en-US')} memories
            </span>
            <span className="chip" style={{ height: 20, fontSize: 11 }}>
              {sel?.projects.size ?? 0} projects
            </span>
          </div>

          {topConcepts.length > 0 && (
            <div className="insp-section">
              <h4>Top concepts</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {topConcepts.map((c) => (
                  <span key={c} className="file-pill" style={{ color: 'var(--cyan-100)' }}>
                    #{c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {memoryMix.length > 0 && (
            <div className="insp-section">
              <h4>Memory mix</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
                {memoryMix.map(({ type, pct }) => (
                  <div key={type} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 32px', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--ink-1)' }}>{TYPE_LABELS[type] ?? type}</span>
                    <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: TYPE_COLORS[type] ?? 'var(--ink-2)' }} />
                    </div>
                    <span style={{ textAlign: 'right', color: 'var(--ink-2)' }}>{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sel && Array.from(sel.projects).length > 0 && (
            <div className="insp-section">
              <h4>Projects</h4>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7, color: 'var(--ink-1)' }}>
                {Array.from(sel.projects).slice(0, 6).map((p) => (
                  <div key={p}>↳ {p}</div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="btn primary" style={{ marginTop: 'auto' }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Open in Feed
          </button>
        </div>

        <div className="graph-minimap">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {clusters.map((c) => {
              const [x, y] = [c.x * W, c.y * H];
              return <circle key={c.id} cx={x} cy={y} r={c.size * 0.7} fill={c.color} opacity="0.7" />;
            })}
          </svg>
          <div className="vp" style={{ left: '20%', top: '20%', width: '60%', height: '60%' }} />
        </div>
      </div>
    </div>
  );
}
