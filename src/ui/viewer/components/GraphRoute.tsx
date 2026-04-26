import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './Icons';
import {
  ALL_TYPES,
  formatNumber,
  formatRelativeTime,
  normalizeTypeKey,
  sourceMeta,
  typeMeta
} from './registry';
import type { FeedItem } from './feedTypes';

interface ClusterNode {
  id: string;
  label: string;
  count: number;
  color: string;
  x: number;
  y: number;
  size: number;
  itemIds: number[];
}

interface SubNode {
  id: string;
  parent: string;
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
}

interface ClusterMix {
  key: string;
  label: string;
  color: string;
  pct: number;
}

const STAGE_W = 1600;
const STAGE_H = 900;

interface GraphRouteProps {
  items: FeedItem[];
  isConnected: boolean;
  onJump?: (id: number) => void;
}

export function GraphRoute({ items, isConnected, onJump }: GraphRouteProps) {
  const [zoom, setZoom] = useState<0 | 1 | 2>(1);
  const [selected, setSelected] = useState<string | null>(null);

  // Cluster items by platform_source. Top 8 form the visible atlas; the rest
  // collapse into "other".
  const { clusters, links, totalLinks } = useMemo(
    () => buildClusters(items),
    [items]
  );

  // Sub-clusters projected around each cluster (project-scoped).
  const subs = useMemo(() => buildSubNodes(clusters, items, zoom), [clusters, items, zoom]);

  // Default selection on first render once data is available
  useEffect(() => {
    if (selected || clusters.length === 0) return;
    setSelected(clusters[0].id);
  }, [selected, clusters]);

  const sel = clusters.find(c => c.id === selected) || clusters[0] || null;

  return (
    <div className="route" style={{ padding: 0 }}>
      <div
        style={{
          padding: 'var(--sp-7) var(--sp-7) var(--sp-4)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <h1 className="route-title">Memory Atlas</h1>
        <span className="route-sub mono">
          {formatNumber(items.length)} memories · {clusters.length} clusters · {totalLinks}{' '}
          cross-links · zoom level {zoom}/2
          {!isConnected && ' · offline'}
        </span>
      </div>

      <div className="graph-stage">
        <div className="graph-grid" />

        {clusters.length === 0 ? (
          <div
            className="empty"
            style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
          >
            <div className="empty-glyph">
              <Icons.Graph size={20} />
            </div>
            <div className="empty-title">Atlas is empty</div>
            <div className="empty-msg">
              Capture observations from your IDE — clusters will form as concepts repeat.
            </div>
          </div>
        ) : (
          <svg
            className="graph-svg"
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="clusterGlow">
                <stop offset="0%" stopColor="var(--cyan-300)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--cyan-300)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Links */}
            {links.map(([a, b], i) => {
              const A = clusters.find(c => c.id === a);
              const B = clusters.find(c => c.id === b);
              if (!A || !B) return null;
              const x1 = A.x * STAGE_W;
              const y1 = A.y * STAGE_H;
              const x2 = B.x * STAGE_W;
              const y2 = B.y * STAGE_H;
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

            {/* Sub nodes (zoom >= 1) */}
            {subs.map(s => (
              <circle
                key={s.id}
                cx={s.x * STAGE_W}
                cy={s.y * STAGE_H}
                r={s.size}
                fill={s.color}
                fillOpacity={s.parent === selected ? 0.9 : 0.55}
                stroke={s.color}
                strokeOpacity={0.4}
                strokeWidth={0.5}
              />
            ))}

            {/* Clusters */}
            {clusters.map(c => {
              const x = c.x * STAGE_W;
              const y = c.y * STAGE_H;
              const isSel = c.id === selected;
              return (
                <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c.id)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={c.size * 1.8}
                    fill="url(#clusterGlow)"
                    opacity={isSel ? 1 : 0.4}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={c.size}
                    fill={isSel ? 'var(--bg-3)' : 'var(--bg-2)'}
                    stroke={c.color}
                    strokeWidth={isSel ? 2 : 1.2}
                    strokeOpacity={isSel ? 1 : 0.7}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={c.size * 0.55}
                    fill={c.color}
                    opacity={isSel ? 0.18 : 0.1}
                  />
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
                    {c.count >= 1000 ? `${(c.count / 1000).toFixed(1)}k` : c.count}
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
                    <circle
                      cx={x}
                      cy={y}
                      r={c.size + 8}
                      fill="none"
                      stroke="var(--cyan-300)"
                      strokeOpacity="0.5"
                      strokeDasharray="3 4"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${x} ${y}`}
                        to={`360 ${x} ${y}`}
                        dur="40s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Controls */}
        <div className="graph-controls" role="toolbar" aria-label="Graph zoom controls">
          <button
            type="button"
            title="Zoom in"
            onClick={() => setZoom(z => (z === 2 ? 2 : ((z + 1) as 0 | 1 | 2)))}
          >
            <Icons.Plus size={14} />
          </button>
          <button
            type="button"
            title="Zoom out"
            onClick={() => setZoom(z => (z === 0 ? 0 : ((z - 1) as 0 | 1 | 2)))}
          >
            <Icons.Minus size={14} />
          </button>
          <div className="sep" />
          <button type="button" title="Fit" onClick={() => setZoom(1)}>
            <Icons.Fit size={14} />
          </button>
        </div>

        {/* Zoom strip */}
        <div className="graph-zoomstrip">
          {([0, 1, 2] as const).map(z => (
            <button
              key={z}
              type="button"
              className={`zoomstep ${zoom === z ? 'is-active' : ''}`}
              onClick={() => setZoom(z)}
            >
              {z === 0 ? 'Clusters' : z === 1 ? 'Sub-clusters' : 'Memories'}
            </button>
          ))}
        </div>

        {/* Breadcrumbs */}
        {sel && (
          <div className="graph-breadcrumbs">
            <span>atlas</span>
            <Icons.Chevron size={11} />
            <b>{sel.label}</b>
            {zoom >= 2 && sel.itemIds.length > 0 && (
              <>
                <Icons.Chevron size={11} />
                <span>obs#{sel.itemIds[0]}</span>
              </>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="graph-legend">
          <h5>Clusters by source</h5>
          {clusters.slice(0, 6).map(c => (
            <div key={c.id} className="legend-row">
              <span className="swatch" style={{ background: c.color }} />
              <span>{c.label}</span>
              <span className="count tnum">{formatNumber(c.count)}</span>
            </div>
          ))}
          {clusters.length > 6 && (
            <div className="legend-row">
              <span className="swatch" style={{ background: 'var(--ink-2)' }} />
              <span>Other</span>
              <span className="count tnum">
                {formatNumber(clusters.slice(6).reduce((s, c) => s + c.count, 0))}
              </span>
            </div>
          )}
        </div>

        {/* Inspector */}
        {sel && (
          <ClusterInspector cluster={sel} items={items} onJump={onJump} />
        )}

        {/* Minimap */}
        <div className="graph-minimap">
          <svg
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {clusters.map(c => (
              <circle
                key={c.id}
                cx={c.x * STAGE_W}
                cy={c.y * STAGE_H}
                r={c.size * 0.7}
                fill={c.color}
                opacity={c.id === selected ? 0.9 : 0.5}
              />
            ))}
          </svg>
          <div className="vp" style={{ left: '20%', top: '20%', width: '60%', height: '60%' }} />
        </div>
      </div>
    </div>
  );
}

function ClusterInspector({
  cluster,
  items,
  onJump
}: {
  cluster: ClusterNode;
  items: FeedItem[];
  onJump?: (id: number) => void;
}) {
  const clusterItems = useMemo(
    () => items.filter(it => cluster.itemIds.includes(it.id)),
    [cluster.itemIds, items]
  );

  const projects = useMemo(() => {
    const set = new Set<string>();
    clusterItems.forEach(it => {
      if (it.project) set.add(it.project);
    });
    return Array.from(set);
  }, [clusterItems]);

  const ageSpan = useMemo(() => {
    if (clusterItems.length === 0) return '—';
    const times = clusterItems.map(it => it.created_at_epoch).filter(Boolean);
    if (!times.length) return '—';
    const span = Math.max(...times) - Math.min(...times);
    const days = Math.round(span / 86_400_000);
    return days === 0 ? 'today' : `${days}d span`;
  }, [clusterItems]);

  const lastSeen = useMemo(() => {
    if (clusterItems.length === 0) return null;
    return Math.max(...clusterItems.map(it => it.created_at_epoch));
  }, [clusterItems]);

  const concepts = useMemo(() => {
    const counts = new Map<string, number>();
    clusterItems.forEach(it =>
      it.concepts.forEach(c => counts.set(c, (counts.get(c) || 0) + 1))
    );
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c);
  }, [clusterItems]);

  const mix: ClusterMix[] = useMemo(() => {
    if (clusterItems.length === 0) return [];
    const counts = new Map<string, number>();
    clusterItems.forEach(it => {
      const key = normalizeTypeKey(it.type);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const total = clusterItems.length;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, count]) => {
        const meta = typeMeta(key);
        return {
          key,
          label: meta.label,
          color: meta.color,
          pct: Math.round((count / total) * 100)
        };
      });
  }, [clusterItems]);

  return (
    <div className="graph-inspector">
      <div className="insp-eyebrow">CLUSTER</div>
      <h3 className="insp-title">{cluster.label}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span className="chip" style={{ height: 20, fontSize: 11 }}>
          <span className="swatch" style={{ background: cluster.color }} />
          {formatNumber(cluster.count)} memories
        </span>
        <span className="chip" style={{ height: 20, fontSize: 11 }}>
          <Icons.Folder size={10} /> {projects.length || 0} projects
        </span>
        <span className="chip" style={{ height: 20, fontSize: 11 }}>
          <Icons.Clock size={10} /> {ageSpan}
        </span>
      </div>

      {concepts.length > 0 && (
        <div className="insp-section">
          <h4>Top concepts</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {concepts.map(c => (
              <span key={c} className="file-pill" style={{ color: 'var(--cyan-100)' }}>
                #{c}
              </span>
            ))}
          </div>
        </div>
      )}

      {mix.length > 0 && (
        <div className="insp-section">
          <h4>Memory mix</h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)'
            }}
          >
            {mix.map(m => (
              <div
                key={m.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '96px 1fr 32px',
                  gap: 8,
                  alignItems: 'center'
                }}
              >
                <span style={{ color: 'var(--ink-1)' }}>{m.label}</span>
                <div
                  style={{
                    height: 4,
                    background: 'var(--bg-3)',
                    borderRadius: 999,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${m.pct}%`,
                      height: '100%',
                      background: m.color
                    }}
                  />
                </div>
                <span style={{ textAlign: 'right', color: 'var(--ink-2)' }}>{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastSeen && (
        <div className="insp-section">
          <h4>Last activity</h4>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-1)' }}>
            {formatRelativeTime(lastSeen)}
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn primary"
        style={{ marginTop: 'auto' }}
        onClick={() => {
          if (cluster.itemIds[0] && onJump) onJump(cluster.itemIds[0]);
        }}
      >
        <Icons.Eye size={12} /> Open in Feed
      </button>
    </div>
  );
}

/* ============================================================
 * Cluster + sub-node generation
 * ============================================================ */

function buildClusters(items: FeedItem[]): {
  clusters: ClusterNode[];
  links: Array<[string, string]>;
  totalLinks: number;
} {
  if (items.length === 0) {
    return { clusters: [], links: [], totalLinks: 0 };
  }

  // Group by source
  const groups = new Map<string, FeedItem[]>();
  items.forEach(it => {
    const k = it.platform_source || 'unknown';
    const arr = groups.get(k);
    if (arr) arr.push(it);
    else groups.set(k, [it]);
  });

  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8);

  // Anchors arranged on two stable orbits — deterministic layout, not animated.
  const anchors: Array<[number, number, number]> = [
    // [x_norm, y_norm, size]
    [0.28, 0.42, 64],
    [0.62, 0.30, 56],
    [0.74, 0.58, 48],
    [0.42, 0.72, 44],
    [0.18, 0.68, 36],
    [0.84, 0.36, 40],
    [0.52, 0.16, 32],
    [0.12, 0.24, 30]
  ];

  const clusters: ClusterNode[] = top.map(([id, group], i) => {
    const meta = sourceMeta(id);
    const a = anchors[i] || anchors[anchors.length - 1];
    return {
      id,
      label: meta.name,
      count: group.length,
      color: meta.color,
      x: a[0],
      y: a[1],
      size: Math.max(28, Math.min(64, a[2] * Math.sqrt(group.length / Math.max(1, top[0][1].length)))),
      itemIds: group.map(g => g.id)
    };
  });

  if (rest.length > 0) {
    const restCount = rest.reduce((s, [, g]) => s + g.length, 0);
    const restIds = rest.flatMap(([, g]) => g.map(x => x.id));
    clusters.push({
      id: '__other__',
      label: 'Other',
      count: restCount,
      color: 'var(--ink-2)',
      x: 0.92,
      y: 0.78,
      size: Math.max(24, Math.min(40, 24 + Math.log10(1 + restCount) * 6)),
      itemIds: restIds
    });
  }

  // Links: nearest-neighbor adjacency in the layout (each cluster linked to
  // its 1-2 closest peers). Deterministic and visually clean.
  const links: Array<[string, string]> = [];
  for (let i = 0; i < clusters.length; i++) {
    const a = clusters[i];
    const ranked = clusters
      .map((c, j) => ({ c, j, d: i === j ? Infinity : dist(a, c) }))
      .sort((x, y) => x.d - y.d);
    for (let k = 0; k < Math.min(2, ranked.length); k++) {
      const b = ranked[k].c;
      if (!links.some(l => (l[0] === a.id && l[1] === b.id) || (l[0] === b.id && l[1] === a.id))) {
        links.push([a.id, b.id]);
      }
    }
  }

  return { clusters, links, totalLinks: links.length };
}

function buildSubNodes(clusters: ClusterNode[], items: FeedItem[], zoom: number): SubNode[] {
  if (zoom < 1 || clusters.length === 0) return [];
  const out: SubNode[] = [];
  clusters.forEach(c => {
    // Bucket items in this cluster by project
    const itemsInCluster = items.filter(it => c.itemIds.includes(it.id));
    const projects = new Map<string, number>();
    itemsInCluster.forEach(it => {
      const k = it.project || 'misc';
      projects.set(k, (projects.get(k) || 0) + 1);
    });
    const arr = Array.from(projects.entries()).slice(0, 8);
    arr.forEach(([proj, count], i) => {
      const a = (i / Math.max(1, arr.length)) * Math.PI * 2 + (c.id.charCodeAt(0) || 0) * 0.13;
      const r = 0.07 + (i % 3) * 0.012;
      out.push({
        id: `${c.id}-${proj}-${i}`,
        parent: c.id,
        x: c.x + Math.cos(a) * r,
        y: c.y + Math.sin(a) * r * 1.4,
        size: 5 + (zoom >= 2 ? 2 : 0) + Math.min(4, Math.log10(1 + count)),
        color: c.color,
        label: proj
      });
    });
  });
  return out;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
