import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type NodeKind = 'cluster' | 'leaf';

interface SimNode {
  id: string;
  kind: NodeKind;
  label: string;
  color: string;
  cssVar: string;
  parent?: string;
  /** Visual radius in svg units */
  radius: number;
  /** Soft "mass" for charge force */
  mass: number;
  count: number;
  // Physics state
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned by user drag */
  fx?: number | null;
  fy?: number | null;
  // Cluster-specific aggregates
  projects?: Set<string>;
  concepts?: string[];
  typeMix?: Map<string, number>;
}

interface SimLink {
  source: string;
  target: string;
  strength: number; // 0..1
}

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

const W = 1600;
const H = 900;
const CENTER = { x: W / 2, y: H / 2 };

export function GraphPage({ observations, summaries, prompts }: GraphPageProps) {
  const [zoom, setZoom] = useState<0 | 1 | 2>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });

  // ---------- Build nodes & links ----------
  const { nodes, links, clusterIndex } = useMemo(() => {
    const bySource = new Map<string, SimNode>();
    const projectsBySource = new Map<string, Set<string>>();
    const conceptsBySource = new Map<string, Map<string, number>>();
    const typeMixBySource = new Map<string, Map<string, number>>();

    const addItem = (
      sourceRaw: string | null | undefined,
      project: string | null | undefined,
      type: string | null | undefined,
      concepts: string | null | undefined
    ) => {
      const source = (sourceRaw || 'claude').toLowerCase();
      let cluster = bySource.get(source);
      if (!cluster) {
        cluster = {
          id: source,
          kind: 'cluster',
          label: SOURCE_LABELS[source] ?? source,
          color: SOURCE_COLORS[source] ?? 'var(--ink-2)',
          cssVar: SOURCE_COLORS[source] ?? 'var(--ink-2)',
          radius: 28,
          mass: 1,
          count: 0,
          x: CENTER.x + (Math.random() - 0.5) * 200,
          y: CENTER.y + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0
        };
        bySource.set(source, cluster);
        projectsBySource.set(source, new Set());
        conceptsBySource.set(source, new Map());
        typeMixBySource.set(source, new Map());
      }
      cluster.count += 1;
      if (project) projectsBySource.get(source)!.add(project);
      const typeKey = normalizeType(type);
      const tm = typeMixBySource.get(source)!;
      tm.set(typeKey, (tm.get(typeKey) ?? 0) + 1);
      if (concepts) {
        try {
          const parsed = JSON.parse(concepts);
          if (Array.isArray(parsed)) {
            const cm = conceptsBySource.get(source)!;
            parsed.slice(0, 8).forEach((c) => {
              if (typeof c === 'string') cm.set(c, (cm.get(c) ?? 0) + 1);
            });
          }
        } catch {
          /* ignore */
        }
      }
    };

    observations.forEach((o) => addItem(o.platform_source, o.project, o.type, o.concepts ?? null));
    summaries.forEach((s) => addItem(s.platform_source, s.project, 'completed', null));
    prompts.forEach((p) => addItem(p.platform_source, p.project, 'prompt', null));

    const clusters = Array.from(bySource.values());
    clusters.sort((a, b) => b.count - a.count);
    const max = Math.max(...clusters.map((c) => c.count), 1);
    clusters.forEach((c, i) => {
      c.radius = 22 + Math.min(56, (c.count / max) * 50);
      c.mass = 1.4 + (c.count / max) * 1.2;
      const a = (i / clusters.length) * Math.PI * 2;
      const r = 220;
      c.x = CENTER.x + Math.cos(a) * r;
      c.y = CENTER.y + Math.sin(a) * r;
      c.projects = projectsBySource.get(c.id);
      c.concepts = Array.from(conceptsBySource.get(c.id)!.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k]) => k);
      c.typeMix = typeMixBySource.get(c.id);
    });

    const top = clusters.slice(0, 12);
    const allNodes: SimNode[] = [...top];
    const allLinks: SimLink[] = [];

    // Project-shared edges between clusters: if two clusters share a project, link them
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const a = top[i];
        const b = top[j];
        const sharedProjects = [...(a.projects ?? [])].filter((p) =>
          b.projects?.has(p)
        ).length;
        const sharedConcepts = (a.concepts ?? []).filter((c) =>
          b.concepts?.includes(c)
        ).length;
        const total = sharedProjects * 2 + sharedConcepts;
        if (total > 0) {
          allLinks.push({ source: a.id, target: b.id, strength: Math.min(1, total / 5) });
        }
      }
    }
    // Keep at least one chain link to the largest cluster so the graph doesn't fly apart.
    if (top.length > 1 && allLinks.length === 0) {
      for (let i = 1; i < top.length; i++) {
        allLinks.push({ source: top[0].id, target: top[i].id, strength: 0.4 });
      }
    }

    // Sub-leaves for zoom level >= 1: a few sample memories per cluster
    if (zoom >= 1) {
      // Build a sample of recent memories per cluster
      const recent: Array<{ source: string; id: number; type: string; title: string; project: string }>
        = [];
      observations.slice(0, 240).forEach((o) =>
        recent.push({
          source: (o.platform_source || 'claude').toLowerCase(),
          id: o.id,
          type: normalizeType(o.type),
          title: o.title ?? 'observation',
          project: o.project ?? ''
        })
      );
      summaries.slice(0, 80).forEach((s) =>
        recent.push({
          source: (s.platform_source || 'claude').toLowerCase(),
          id: s.id + 100000,
          type: normalizeType('completed'),
          title: s.request ?? 'summary',
          project: s.project ?? ''
        })
      );

      // Cap leaves per cluster
      const perCluster = zoom === 2 ? 18 : 8;
      const counts = new Map<string, number>();
      for (const m of recent) {
        const c = bySource.get(m.source);
        if (!c) continue;
        const n = counts.get(m.source) ?? 0;
        if (n >= perCluster) continue;
        counts.set(m.source, n + 1);
        const angle = Math.random() * Math.PI * 2;
        const r = c.radius + 60 + Math.random() * 60;
        const node: SimNode = {
          id: `${m.source}:${m.id}`,
          kind: 'leaf',
          parent: m.source,
          label: m.title.slice(0, 60),
          color: TYPE_COLORS[m.type] ?? 'var(--ink-2)',
          cssVar: TYPE_COLORS[m.type] ?? 'var(--ink-2)',
          radius: zoom === 2 ? 6 : 4.5,
          mass: 0.18,
          count: 1,
          x: c.x + Math.cos(angle) * r,
          y: c.y + Math.sin(angle) * r,
          vx: 0,
          vy: 0
        };
        allNodes.push(node);
        allLinks.push({ source: m.source, target: node.id, strength: 0.65 });
      }
    }

    const clusterIdx = new Map<string, SimNode>();
    top.forEach((c) => clusterIdx.set(c.id, c));

    return { nodes: allNodes, links: allLinks, clusterIndex: clusterIdx };
  }, [observations, summaries, prompts, zoom]);

  // ---------- Force simulation ----------
  // Keep mutable refs so we don't reset positions on every state change.
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const draftRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const dragRef = useRef<{ id: string | null; offX: number; offY: number }>({
    id: null,
    offX: 0,
    offY: 0
  });
  const panRef = useRef<{ active: boolean; px: number; py: number; tx: number; ty: number }>({
    active: false,
    px: 0,
    py: 0,
    tx: 0,
    ty: 0
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, forceTick] = useState(0);

  // Sync new nodes/links into the live simulation, preserving existing positions.
  useEffect(() => {
    const live = nodesRef.current;
    const next = new Map<string, SimNode>();
    nodes.forEach((n) => {
      const existing = live.get(n.id);
      if (existing) {
        // Preserve position + velocity, refresh visual + aggregate fields.
        existing.label = n.label;
        existing.color = n.color;
        existing.cssVar = n.cssVar;
        existing.radius = n.radius;
        existing.mass = n.mass;
        existing.count = n.count;
        existing.kind = n.kind;
        existing.parent = n.parent;
        existing.projects = n.projects;
        existing.concepts = n.concepts;
        existing.typeMix = n.typeMix;
        next.set(n.id, existing);
      } else {
        next.set(n.id, n);
      }
    });
    nodesRef.current = next;
    draftRef.current = Array.from(next.values());
    linksRef.current = links;
    forceTick((v) => v + 1);
  }, [nodes, links]);

  // Animation loop: integrate forces and request redraws.
  useEffect(() => {
    let raf = 0;
    const integrate = () => {
      const arr = draftRef.current;
      const links = linksRef.current;
      if (!arr.length) {
        raf = requestAnimationFrame(integrate);
        return;
      }
      // Charge (Coulomb-like) repulsion — only between cluster nodes, plus mild repulsion among leaves of the same cluster.
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i];
        if (a.fx != null && a.fy != null) continue;
        for (let j = i + 1; j < arr.length; j++) {
          const b = arr[j];
          // Skip cross-cluster leaf↔leaf forces (would explode the sim).
          if (a.kind === 'leaf' && b.kind === 'leaf' && a.parent !== b.parent) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 9) d2 = 9;
          const dist = Math.sqrt(d2);
          // Charge magnitude scales with mass.
          const charge =
            a.kind === 'cluster' && b.kind === 'cluster'
              ? -14000 * a.mass * b.mass
              : a.kind === 'leaf' && b.kind === 'leaf'
                ? -120
                : -360 * b.mass;
          const f = charge / d2;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          a.vx -= fx;
          a.vy -= fy;
          if (b.fx == null || b.fy == null) {
            b.vx += fx;
            b.vy += fy;
          }

          // Hard collision constraint between cluster nodes — keep their
          // bounding circles from overlapping.
          if (a.kind === 'cluster' && b.kind === 'cluster') {
            const minDist = a.radius + b.radius + 80;
            if (dist < minDist) {
              const overlap = (minDist - dist) / 2;
              const ox = (dx / dist) * overlap;
              const oy = (dy / dist) * overlap;
              if (a.fx == null) {
                a.x -= ox;
                a.y -= oy;
              }
              if (b.fx == null) {
                b.x += ox;
                b.y += oy;
              }
            }
          }
        }
      }
      // Spring (link) attraction
      const map = nodesRef.current;
      for (const l of links) {
        const a = map.get(l.source);
        const b = map.get(l.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target =
          b.kind === 'leaf' || a.kind === 'leaf'
            ? (a.radius + b.radius) + 36
            : 220;
        const k = b.kind === 'leaf' || a.kind === 'leaf' ? 0.06 : 0.025;
        const force = (dist - target) * k * l.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a.fx == null || a.fy == null) {
          a.vx += fx;
          a.vy += fy;
        }
        if (b.fx == null || b.fy == null) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // Center gravity
      for (const n of arr) {
        if (n.fx != null && n.fy != null) continue;
        const cx = CENTER.x;
        const cy = CENTER.y;
        const k = n.kind === 'cluster' ? 0.0035 : 0.005;
        n.vx += (cx - n.x) * k;
        n.vy += (cy - n.y) * k;
      }
      // Integrate + damping
      const damp = 0.86;
      for (const n of arr) {
        if (n.fx != null && n.fy != null) {
          n.x = n.fx;
          n.y = n.fy;
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= damp;
        n.vy *= damp;
        // Clamp velocity
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > 12) {
          n.vx = (n.vx / sp) * 12;
          n.vy = (n.vy / sp) * 12;
        }
        n.x += n.vx;
        n.y += n.vy;
      }

      // Hard collision pass (post-integration) — keep cluster bubbles apart.
      const clusters = arr.filter((n) => n.kind === 'cluster');
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const a = clusters[i];
          const b = clusters[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const minDist = a.radius + b.radius + 90;
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            const ux = dx / dist;
            const uy = dy / dist;
            if (a.fx == null) {
              a.x -= ux * overlap;
              a.y -= uy * overlap;
            }
            if (b.fx == null) {
              b.x += ux * overlap;
              b.y += uy * overlap;
            }
          }
        }
      }
      forceTick((v) => (v + 1) % 10000);
      raf = requestAnimationFrame(integrate);
    };
    raf = requestAnimationFrame(integrate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------- Pan / Zoom ----------
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: sx, y: sy };
      const rect = svg.getBoundingClientRect();
      // Map screen → svg viewBox coords
      const vx = ((sx - rect.left) / rect.width) * W;
      const vy = ((sy - rect.top) / rect.height) * H;
      // Apply inverse view transform
      return { x: (vx - view.tx) / view.k, y: (vy - view.ty) / view.k };
    },
    [view]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const newK = Math.max(0.4, Math.min(4, v.k * factor));
        const svg = svgRef.current;
        if (!svg) return v;
        const rect = svg.getBoundingClientRect();
        const vx = ((e.clientX - rect.left) / rect.width) * W;
        const vy = ((e.clientY - rect.top) / rect.height) * H;
        // keep cursor anchored
        const nx = vx - (vx - v.tx) * (newK / v.k);
        const ny = vy - (vy - v.ty) * (newK / v.k);
        return { k: newK, tx: nx, ty: ny };
      });
    },
    []
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Check if clicked on a node (handled by node listeners) — otherwise pan
      const tgt = e.target as SVGElement;
      if (tgt.closest('[data-node-id]')) return;
      panRef.current = {
        active: true,
        px: e.clientX,
        py: e.clientY,
        tx: view.tx,
        ty: view.ty
      };
    },
    [view]
  );

  // Global mousemove / mouseup so dragging can extend off-svg
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // node drag
      if (dragRef.current.id) {
        const w = screenToWorld(e.clientX, e.clientY);
        const node = nodesRef.current.get(dragRef.current.id);
        if (node) {
          node.fx = w.x + dragRef.current.offX;
          node.fy = w.y + dragRef.current.offY;
        }
        return;
      }
      // pan
      if (panRef.current.active) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const dxScreen = e.clientX - panRef.current.px;
        const dyScreen = e.clientY - panRef.current.py;
        // Convert pixel delta to viewBox delta
        const dxView = (dxScreen / rect.width) * W;
        const dyView = (dyScreen / rect.height) * H;
        setView((v) => ({
          k: v.k,
          tx: panRef.current.tx + dxView,
          ty: panRef.current.ty + dyView
        }));
      }
    };
    const onUp = () => {
      if (dragRef.current.id) {
        const node = nodesRef.current.get(dragRef.current.id);
        if (node) {
          node.fx = null;
          node.fy = null;
        }
        dragRef.current = { id: null, offX: 0, offY: 0 };
      }
      panRef.current.active = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [screenToWorld]);

  const onNodeMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const node = nodesRef.current.get(id);
      if (!node) return;
      const w = screenToWorld(e.clientX, e.clientY);
      dragRef.current = { id, offX: node.x - w.x, offY: node.y - w.y };
      node.fx = node.x;
      node.fy = node.y;
      if (node.kind === 'cluster') setSelected(id);
    },
    [screenToWorld]
  );

  const fit = useCallback(() => {
    setView({ k: 1, tx: 0, ty: 0 });
  }, []);

  // ---------- Selection / highlight ----------
  const highlightNode = hovered ?? selected;
  const connectedSet = useMemo(() => {
    if (!highlightNode) return null;
    const set = new Set<string>([highlightNode]);
    for (const l of linksRef.current) {
      if (l.source === highlightNode) set.add(l.target);
      if (l.target === highlightNode) set.add(l.source);
    }
    return set;
  }, [highlightNode, links]);

  const sel = clusterIndex.get(selected ?? clusterIndex.keys().next().value ?? '');
  const totalMemories = nodes.filter((n) => n.kind === 'cluster').reduce((s, c) => s + c.count, 0);
  const totalLinks = links.filter((l) => {
    const a = nodesRef.current.get(l.source);
    const b = nodesRef.current.get(l.target);
    return a?.kind === 'cluster' && b?.kind === 'cluster';
  }).length;

  const memoryMix = useMemo(() => {
    if (!sel?.typeMix) return [];
    const total = Array.from(sel.typeMix.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Array.from(sel.typeMix.entries())
      .map(([type, n]) => ({ type, pct: Math.round((n / total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [sel]);

  const drawNodes = draftRef.current;

  return (
    <div className="route" style={{ padding: 0 }} data-screen-label="02 Graph">
      <div
        style={{
          padding: 'var(--sp-7) var(--sp-7) var(--sp-4)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 16
        }}
      >
        <h1 className="route-title">Memory Atlas</h1>
        <span className="route-sub mono">
          {totalMemories.toLocaleString('en-US')} memories · {clusterIndex.size} clusters · {totalLinks} cross-links · zoom {zoom}/2
        </span>
      </div>

      <div className="graph-stage">
        <div className="graph-grid" />

        <svg
          ref={svgRef}
          className="graph-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          style={{ cursor: panRef.current.active ? 'grabbing' : 'grab' }}
        >
          <defs>
            <radialGradient id="clusterGlow">
              <stop offset="0%" stopColor="var(--cyan-300)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--cyan-300)" stopOpacity="0" />
            </radialGradient>
            <filter id="leafGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="clusterRingGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {/* Links */}
            {links.map((l, i) => {
              const a = nodesRef.current.get(l.source);
              const b = nodesRef.current.get(l.target);
              if (!a || !b) return null;
              const isSel =
                connectedSet && (connectedSet.has(l.source) || connectedSet.has(l.target));
              const isLeaf = a.kind === 'leaf' || b.kind === 'leaf';
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isSel ? 'var(--cyan-300)' : 'var(--line-3)'}
                  strokeOpacity={
                    connectedSet ? (isSel ? 0.85 : 0.08) : isLeaf ? 0.32 : 0.42
                  }
                  strokeWidth={isSel ? 1.3 : isLeaf ? 0.7 : 1}
                  strokeDasharray={!isSel && !isLeaf ? '3 4' : '0'}
                  pointerEvents="none"
                />
              );
            })}

            {/* Leaf nodes (memories) */}
            {drawNodes
              .filter((n) => n.kind === 'leaf')
              .map((n) => {
                const isHi =
                  connectedSet?.has(n.id) ||
                  (n.parent != null && connectedSet?.has(n.parent));
                const dim = connectedSet && !isHi;
                return (
                  <g
                    key={n.id}
                    data-node-id={n.id}
                    transform={`translate(${n.x} ${n.y})`}
                    style={{ cursor: 'pointer', opacity: dim ? 0.18 : 1 }}
                    onMouseDown={(e) => onNodeMouseDown(n.id, e)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <circle
                      r={n.radius}
                      fill={n.color}
                      fillOpacity={isHi ? 0.95 : 0.7}
                      stroke={n.color}
                      strokeOpacity={0.6}
                      strokeWidth="0.6"
                      filter="url(#leafGlow)"
                    />
                  </g>
                );
              })}

            {/* Cluster nodes */}
            {drawNodes
              .filter((n) => n.kind === 'cluster')
              .map((n) => {
                const isSel = n.id === selected;
                const isHi = connectedSet?.has(n.id);
                const dim = connectedSet && !isHi;
                return (
                  <g
                    key={n.id}
                    data-node-id={n.id}
                    transform={`translate(${n.x} ${n.y})`}
                    style={{ cursor: 'pointer', opacity: dim ? 0.3 : 1 }}
                    onMouseDown={(e) => onNodeMouseDown(n.id, e)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <circle r={n.radius * 1.8} fill="url(#clusterGlow)" opacity={isSel ? 1 : isHi ? 0.7 : 0.4} />
                    <circle
                      r={n.radius}
                      fill={isSel ? 'var(--bg-3)' : 'var(--bg-2)'}
                      stroke={n.color}
                      strokeWidth={isSel ? 2.4 : 1.4}
                      strokeOpacity={isSel ? 1 : 0.85}
                      filter={isSel ? 'url(#clusterRingGlow)' : undefined}
                    />
                    <circle r={n.radius * 0.6} fill={n.color} opacity={isSel ? 0.22 : 0.12} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isSel ? 'var(--ink-0)' : 'var(--ink-1)'}
                      fontSize={Math.max(11, n.radius * 0.42)}
                      fontWeight="600"
                      fontFamily="var(--font-sans)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {compactNumber(n.count)}
                    </text>
                    <text
                      y={n.radius + 18}
                      textAnchor="middle"
                      fill="var(--ink-1)"
                      fontSize="12"
                      fontFamily="var(--font-mono)"
                      style={{ pointerEvents: 'none', letterSpacing: '0.04em', userSelect: 'none' }}
                    >
                      {n.label}
                    </text>
                    {isSel && (
                      <circle
                        r={n.radius + 9}
                        fill="none"
                        stroke="var(--cyan-300)"
                        strokeOpacity="0.55"
                        strokeDasharray="3 4"
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from="0 0 0"
                          to="360 0 0"
                          dur="40s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
          </g>
        </svg>

        <div className="graph-controls">
          <button
            type="button"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, (z + 1) as 0 | 1 | 2))}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0, (z - 1) as 0 | 1 | 2))}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <div className="sep" />
          <button type="button" title="Fit" onClick={fit}>
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
          {Array.from(clusterIndex.values()).slice(0, 6).map((c) => (
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
              {sel?.projects?.size ?? 0} projects
            </span>
          </div>

          {sel?.concepts && sel.concepts.length > 0 && (
            <div className="insp-section">
              <h4>Top concepts</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sel.concepts.slice(0, 8).map((c) => (
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 11.5,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {memoryMix.map(({ type, pct }) => (
                  <div
                    key={type}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '96px 1fr 32px',
                      gap: 8,
                      alignItems: 'center'
                    }}
                  >
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

          {sel?.projects && sel.projects.size > 0 && (
            <div className="insp-section">
              <h4>Projects</h4>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  color: 'var(--ink-1)'
                }}
              >
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
            {drawNodes.filter((n) => n.kind === 'cluster').map((c) => (
              <circle key={c.id} cx={c.x} cy={c.y} r={c.radius * 0.7} fill={c.color} opacity="0.7" />
            ))}
          </svg>
          <div
            className="vp"
            style={{
              left: `${Math.max(0, Math.min(80, -view.tx / W * 100 / view.k))}%`,
              top: `${Math.max(0, Math.min(80, -view.ty / H * 100 / view.k))}%`,
              width: `${Math.min(100, 100 / view.k)}%`,
              height: `${Math.min(100, 100 / view.k)}%`
            }}
          />
        </div>

        <div className="graph-hint">
          <span className="kbd">drag</span>
          <span>reposition</span>
          <span className="graph-hint__sep">·</span>
          <span className="kbd">scroll</span>
          <span>zoom</span>
          <span className="graph-hint__sep">·</span>
          <span className="kbd">click</span>
          <span>select</span>
        </div>
      </div>
    </div>
  );
}
