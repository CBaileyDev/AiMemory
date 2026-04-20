import type { Observation, Summary, UserPrompt } from '../types';

export type MemoryKind = 'observation' | 'summary' | 'prompt';

export interface MemoryLeaf {
  id: string;
  kind: MemoryKind;
  dbId: number;
  project: string;
  platform_source: string;
  memoryType: string;
  created_at_epoch: number;
}

export interface GraphEdge {
  from: number;
  to: number;
}

export interface GraphDrawNode {
  id: number;
  x: number;
  y: number;
  radius: number;
  label: string;
  color: string;
  project: string;
  agent: string;
  memType: string;
  lod: 0 | 1 | 2;
  leaf?: MemoryLeaf;
  count?: number;
  isHub?: boolean;
  brightness: number;
  pulsePhase: number;
  connections: number[];
}

/** Deterministic pseudo-random in [0, 1). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

function inferSummaryMemoryType(s: Summary): string {
  if (s.learned?.trim()) return 'learned';
  if (s.completed?.trim()) return 'completed';
  if (s.investigated?.trim()) return 'investigated';
  if (s.next_steps?.trim()) return 'next-steps';
  return 'completed';
}

export function flattenToLeaves(
  observations: Observation[],
  summaries: Summary[],
  prompts: UserPrompt[]
): MemoryLeaf[] {
  const out: MemoryLeaf[] = [];
  for (const o of observations) {
    out.push({
      id: `o-${o.id}`,
      kind: 'observation',
      dbId: o.id,
      project: o.project || '(unknown)',
      platform_source: o.platform_source || 'claude-code',
      memoryType: o.type || 'learned',
      created_at_epoch: o.created_at_epoch
    });
  }
  for (const s of summaries) {
    out.push({
      id: `s-${s.id}`,
      kind: 'summary',
      dbId: s.id,
      project: s.project || '(unknown)',
      platform_source: s.platform_source || 'claude-code',
      memoryType: inferSummaryMemoryType(s),
      created_at_epoch: s.created_at_epoch
    });
  }
  for (const p of prompts) {
    out.push({
      id: `p-${p.id}`,
      kind: 'prompt',
      dbId: p.id,
      project: p.project || '(unknown)',
      platform_source: p.platform_source || 'claude-code',
      memoryType: 'prompt',
      created_at_epoch: p.created_at_epoch
    });
  }
  return out;
}

/**
 * Build drawable nodes + edges for a zoom band (LOD).
 * LOD 0 = project aggregates, 1 = (project, agent), 2 = leaves.
 */
export function buildLodGraph(
  leaves: MemoryLeaf[],
  lod: 0 | 1 | 2,
  accentRgb: string,
  rng: () => number
): { nodes: Omit<GraphDrawNode, 'id'>[]; edges: GraphEdge[] } {
  if (leaves.length === 0) {
    const cx = 0;
    const cy = 0;
    return {
      nodes: [{
        x: cx,
        y: cy,
        radius: 14,
        label: 'No memories yet',
        color: accentRgb,
        project: '',
        agent: '',
        memType: '',
        lod,
        brightness: 0.8,
        pulsePhase: rng() * Math.PI * 2,
        connections: [],
        isHub: true,
        count: 0
      }],
      edges: []
    };
  }

  type Agg = Map<string, MemoryLeaf[]>;

  function keyProject(l: MemoryLeaf) {
    return l.project;
  }
  function keyProjAgent(l: MemoryLeaf) {
    return `${l.project}\u0000${l.platform_source}`;
  }

  let groups: Agg = new Map();
  if (lod === 0) {
    for (const l of leaves) {
      const k = keyProject(l);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(l);
    }
  } else if (lod === 1) {
    for (const l of leaves) {
      const k = keyProjAgent(l);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(l);
    }
  } else {
    for (const l of leaves) {
      groups.set(l.id, [l]);
    }
  }

  // Sort biggest aggregates toward the center (higher-count = hub, gets inner ring).
  const entries = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  // Spider-web ring layout — concentric rings sized by node count.
  // Ring radii roughly align with the radar grid circles drawn in GraphCanvas
  // ([150, 280, 410, 540]) so the web feels locked to the scan reticle.
  const ringRadii = (() => {
    const n = entries.length;
    if (n <= 6) return [220];
    if (n <= 18) return [170, 320];
    if (n <= 44) return [150, 290, 430];
    return [140, 270, 400, 520];
  })();

  // Distribute entries across rings — inner rings smaller, outer rings larger,
  // so circumference density stays roughly even.
  const ringWeights = ringRadii.map((r) => r);
  const weightSum = ringWeights.reduce((a, b) => a + b, 0);
  const ringCounts: number[] = ringWeights.map((w, idx) =>
    idx === ringWeights.length - 1 ? 0 : Math.max(1, Math.round((w / weightSum) * entries.length))
  );
  let placed = ringCounts.slice(0, -1).reduce((a, b) => a + b, 0);
  ringCounts[ringCounts.length - 1] = Math.max(0, entries.length - placed);
  // If inner rings over-allocated, trim from outside in.
  while (placed > entries.length) {
    for (let i = ringCounts.length - 2; i >= 0 && placed > entries.length; i--) {
      if (ringCounts[i] > 1) { ringCounts[i]--; placed--; }
    }
  }

  const nodes: Omit<GraphDrawNode, 'id'>[] = [];
  // Track each node's ring index and slot index so we can build orbital + spoke edges.
  const ringOfNode: number[] = [];
  const ringSlot: number[] = [];
  const ringNodes: number[][] = ringRadii.map(() => []);

  let cursor = 0;
  ringCounts.forEach((ringSize, ringIdx) => {
    const r = ringRadii[ringIdx]!;
    const angleStep = (Math.PI * 2) / Math.max(ringSize, 1);
    const ringPhase = ringIdx * 0.37 + rng() * 0.12;

    for (let slot = 0; slot < ringSize; slot++) {
      const entry = entries[cursor++];
      if (!entry) break;
      const [key, ls] = entry;

      const angle = angleStep * slot + ringPhase + (rng() - 0.5) * angleStep * 0.18;
      const radialJitter = (rng() - 0.5) * 18;
      const px = Math.cos(angle) * (r + radialJitter);
      const py = Math.sin(angle) * (r + radialJitter);

      const count = lod === 2 ? 1 : ls.length;
      const sample = ls[0];
      const proj = lod === 2 ? sample!.project : key.split('\u0000')[0] ?? sample!.project;
      const agent = lod === 2
        ? sample!.platform_source
        : key.includes('\u0000')
          ? key.split('\u0000')[1] ?? sample!.platform_source
          : sample!.platform_source;
      const memType = lod === 2 ? sample!.memoryType : '';

      let label = proj;
      if (lod === 1) label = `${proj.slice(0, 18)} · ${agent}`;
      if (lod === 2) label = `${sample!.memoryType} #${sample!.dbId}`;

      // Inner-ring nodes are the visual "hubs" (they anchor the radial spokes).
      const hub = ringIdx === 0 && ringRadii.length > 1;
      const radius =
        lod === 2
          ? 2.5 + rng() * 2.5
          : Math.min(26, 6 + Math.sqrt(count) * 2.4);

      const nodeIndex = nodes.length;
      nodes.push({
        x: px,
        y: py,
        radius,
        label,
        color: accentRgb,
        project: proj,
        agent,
        memType,
        lod,
        leaf: lod === 2 ? sample : undefined,
        count,
        isHub: hub,
        brightness: 0.4 + rng() * 0.6,
        pulsePhase: rng() * Math.PI * 2,
        connections: []
      });
      ringOfNode[nodeIndex] = ringIdx;
      ringSlot[nodeIndex] = slot;
      ringNodes[ringIdx]!.push(nodeIndex);
    }
  });

  // Build spider-web edges: orbital (ring-neighbor) strands + radial spokes inward.
  const edges: GraphEdge[] = [];
  const linked = new Set<string>();
  const link = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (linked.has(key)) return;
    linked.add(key);
    edges.push({ from: a, to: b });
    nodes[a]!.connections.push(b);
    nodes[b]!.connections.push(a);
  };

  ringNodes.forEach((ring, ringIdx) => {
    if (ring.length === 0) return;

    // Orbital edges — close the ring into a chain (or loop when it has ≥3 nodes).
    if (ring.length >= 2) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        if (ring.length === 2 && i === 1) break;
        link(a, b);
      }
    }

    // Radial spoke edges — connect to the closest-angle node on the next inner ring.
    if (ringIdx > 0) {
      const inner = ringNodes[ringIdx - 1]!;
      if (inner.length === 0) return;
      for (const nodeIdx of ring) {
        const nx = nodes[nodeIdx]!.x;
        const ny = nodes[nodeIdx]!.y;
        const nodeAngle = Math.atan2(ny, nx);
        let best = inner[0]!;
        let bestDelta = Infinity;
        for (const innerIdx of inner) {
          const ix = nodes[innerIdx]!.x;
          const iy = nodes[innerIdx]!.y;
          const innerAngle = Math.atan2(iy, ix);
          let delta = Math.abs(nodeAngle - innerAngle);
          if (delta > Math.PI) delta = Math.PI * 2 - delta;
          if (delta < bestDelta) {
            bestDelta = delta;
            best = innerIdx;
          }
        }
        link(nodeIdx, best);
      }
    }
  });

  // Handle the single-ring degenerate case — add a gentle radial spoke to origin-adjacent
  // siblings via project/agent affinity so there's still web structure when rings === 1.
  if (ringRadii.length === 1 && nodes.length > 2) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      if (n.connections.length >= 3) continue;
      for (let j = i + 2; j < nodes.length && n.connections.length < 3; j++) {
        const m = nodes[j]!;
        if (n.project === m.project || n.agent === m.agent) {
          link(i, j);
          break;
        }
      }
    }
  }

  return { nodes, edges };
}

const sourceColorMemo = new Map<string, string>();

/** Resolve --source-<id> to computed RGB for canvas (approximate). */
export function resolveAgentColor(agent: string, accentFallback: string): string {
  if (typeof document === 'undefined') return accentFallback;
  const slug = agent.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const mk = `${slug}|${accentFallback}`;
  const hit = sourceColorMemo.get(mk);
  if (hit) return hit;

  const el = document.createElement('div');
  el.style.color = `var(--source-${slug}, var(--accent-primary))`;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const out = rgb || accentFallback;
  sourceColorMemo.set(mk, out);
  return out;
}
