import React, { useEffect, useRef } from 'react';
import type { MemoryLeaf } from '../utils/graph';
import {
  buildLodGraph,
  seededRandom,
  resolveAgentColor,
  type GraphDrawNode,
  type GraphEdge
} from '../utils/graph';

interface GraphCanvasProps {
  leaves: MemoryLeaf[];
  accentRgb: string;
  onSelectNode: (node: GraphDrawNode | null) => void;
}

function lodFromZoom(zoom: number): 0 | 1 | 2 {
  if (zoom < 0.66) return 0;
  if (zoom < 1.24) return 1;
  return 2;
}

function toRgba(rgb: string, alpha: number): string {
  if (rgb.startsWith('rgba(')) {
    return rgb.replace(/rgba\((.+),\s*[^,]+\)$/, `rgba($1, ${alpha})`);
  }
  if (rgb.startsWith('rgb(')) {
    return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  return rgb;
}

const RADAR_RADII = [140, 270, 400, 520];
const COMET_EDGE_LIMIT = 300;

function materializeGraph(
  leaves: MemoryLeaf[],
  lod: 0 | 1 | 2,
  accentRgb: string
): { nodes: GraphDrawNode[]; edges: GraphEdge[] } {
  const rng = seededRandom(42 + lod * 997 + leaves.length * 13);
  const built = buildLodGraph(leaves, lod, accentRgb, rng);

  return {
    nodes: built.nodes.map((node, id) => {
      const nextNode: GraphDrawNode = { ...node, id, connections: [...node.connections] };
      if (lod >= 1 && nextNode.agent) {
        nextNode.color = resolveAgentColor(nextNode.agent, accentRgb);
      }
      return nextNode;
    }),
    edges: built.edges
  };
}

function drawTooltipBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}

export function GraphCanvas({ leaves, accentRgb, onSelectNode }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leavesRef = useRef(leaves);
  leavesRef.current = leaves;

  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;

  const stateRef = useRef({
    nodes: [] as GraphDrawNode[],
    edges: [] as GraphEdge[],
    lod: 0 as 0 | 1 | 2,
    camera: { x: 0, y: 0, zoom: 0.52 },
    mouse: {
      x: 0,
      y: 0,
      down: false,
      dragNode: null as number | null,
      hoveredNode: null as number | null,
      downNode: null as number | null,
      dragged: false
    },
    time: 0,
    animFrame: null as number | null,
    accent: accentRgb,
    paused: typeof document !== 'undefined' ? document.hidden : false
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Explicit types preserve narrowing inside closures (TypeScript loses narrowing across function boundaries)
    const canvasEl: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = ctx;
    const state = stateRef.current;

    function rebuild(lod: 0 | 1 | 2) {
      const built = materializeGraph(leavesRef.current, lod, state.accent);
      state.nodes = built.nodes;
      state.edges = built.edges;
      state.lod = lod;
    }

    rebuild(lodFromZoom(state.camera.zoom));

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvasEl.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvasEl.width = rect.width * dpr;
      canvasEl.height = rect.height * dpr;
      canvasEl.style.width = `${rect.width}px`;
      canvasEl.style.height = `${rect.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function toWorld(sx: number, sy: number) {
      const rect = canvasEl.getBoundingClientRect();
      const cam = state.camera;
      return {
        x: (sx - rect.width / 2) / cam.zoom - cam.x,
        y: (sy - rect.height / 2) / cam.zoom - cam.y
      };
    }

    function draw(time: number) {
      state.time = time;
      if (state.paused) {
        state.animFrame = requestAnimationFrame(draw);
        return;
      }

      const rect = canvasEl.getBoundingClientRect();
      const { width, height } = rect;
      const cam = state.camera;

      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(width / 2, height / 2);
      context.scale(cam.zoom, cam.zoom);
      context.translate(cam.x, cam.y);

      const radarRadii = RADAR_RADII;
      context.strokeStyle = 'rgba(255,255,255,0.014)';
      context.lineWidth = 0.5 / cam.zoom;
      for (const radius of radarRadii) {
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.stroke();
      }

      const scanAngle = (time * 0.0004) % (Math.PI * 2);
      context.beginPath();
      context.arc(0, 0, radarRadii[radarRadii.length - 1], scanAngle, scanAngle + 0.02);
      context.strokeStyle = toRgba(state.accent, 0.18);
      context.lineWidth = 1.1 / cam.zoom;
      context.stroke();

      for (const edge of state.edges) {
        const a = state.nodes[edge.from];
        const b = state.nodes[edge.to];
        if (!a || !b) continue;

        const isHovered =
          state.mouse.hoveredNode !== null &&
          (edge.from === state.mouse.hoveredNode || edge.to === state.mouse.hoveredNode);

        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.strokeStyle = isHovered ? toRgba(a.color, 0.35) : toRgba(state.accent, 0.08);
        context.lineWidth = isHovered ? 1.1 / cam.zoom : 0.55 / cam.zoom;
        context.stroke();
      }

      if (state.lod < 2) {
        const visibleEdges = Math.min(state.edges.length, COMET_EDGE_LIMIT);
        const pulseTime = time * 0.001;

        for (let i = 0; i < visibleEdges; i++) {
          if (i % 3 !== 0) continue;

          const edge = state.edges[i];
          const a = state.nodes[edge.from];
          const b = state.nodes[edge.to];
          if (!a || !b) continue;

          const cycle = (pulseTime * (0.3 + (i % 5) * 0.08) + i * 0.17) % 5;
          if (cycle > 1) continue;

          for (let segment = 0; segment < 6; segment++) {
            const t = cycle - segment * 0.05;
            if (t < 0) break;

            const px = a.x + (b.x - a.x) * t;
            const py = a.y + (b.y - a.y) * t;
            const radius = Math.max(0.35 / cam.zoom, (2.2 - segment * 0.3) / cam.zoom);

            context.beginPath();
            context.arc(px, py, radius, 0, Math.PI * 2);
            context.fillStyle = toRgba(a.color, Math.max(0.08, 0.95 - segment * 0.16));
            context.fill();
          }
        }
      }

      if (state.lod < 2) {
        for (const node of state.nodes) {
          if (!node.isHub) continue;

          const burstPhase = (time * 0.001 + node.pulsePhase) % 4;
          if (burstPhase >= 0.3) continue;

          const burstAlpha = 1 - burstPhase / 0.3;
          const burstRadius = node.radius * 2 + burstPhase * 40;
          context.beginPath();
          context.arc(node.x, node.y, burstRadius, 0, Math.PI * 2);
          context.strokeStyle = toRgba(node.color, burstAlpha * 0.3);
          context.lineWidth = 1 / cam.zoom;
          context.stroke();
        }
      }

      for (const node of state.nodes) {
        const pulse = Math.sin(time * 0.002 + node.pulsePhase) * 0.3 + 0.7;
        const isHovered = state.mouse.hoveredNode === node.id;
        const isConnectedToHover =
          state.mouse.hoveredNode !== null &&
          node.connections.includes(state.mouse.hoveredNode);

        let alpha = node.brightness * pulse;
        let radius = node.radius;

        if (state.mouse.hoveredNode !== null) {
          if (isHovered) {
            alpha = 1;
            radius *= 1.35;
          } else if (isConnectedToHover) {
            alpha = 0.7;
            radius *= 1.1;
          } else {
            alpha *= 0.22;
          }
        }

        if (isHovered || (node.isHub && state.lod < 2)) {
          context.shadowBlur = radius * 2;
          context.shadowColor = toRgba(node.color, alpha * 0.5);
          
          const glow = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 4);
          glow.addColorStop(0, toRgba(node.color, alpha * 0.22));
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          context.beginPath();
          context.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
          context.fillStyle = glow;
          context.fill();
        }

        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = toRgba(node.color, alpha);
        context.fill();
        
        // Reset shadow for subsequent draws
        context.shadowBlur = 0;
      }

      if (state.mouse.hoveredNode !== null) {
        const node = state.nodes[state.mouse.hoveredNode];
        if (node) {
          const extra = node.count && node.count > 1 ? ` · ${node.count}` : '';
          const label =
            node.leaf != null
              ? `${node.leaf.kind} · ${node.project} · ${node.agent}`
              : `${node.label}${extra}`;
          const fontSize = 11 / cam.zoom;
          const bubblePadX = 8 / cam.zoom;
          const bubbleYOffset = 18 / cam.zoom;
          const bubbleHeight = 22 / cam.zoom;
          const bubbleRadius = 6 / cam.zoom;

          context.font = `500 ${fontSize}px ui-sans-serif, system-ui`;
          context.textBaseline = 'middle';
          const metrics = context.measureText(label);
          const bubbleWidth = metrics.width + bubblePadX * 2;
          const bubbleX = node.x - bubbleWidth / 2;
          const bubbleY = node.y - node.radius - bubbleYOffset - bubbleHeight / 2;

          context.fillStyle = 'rgba(10,10,14,0.92)';
          drawTooltipBubble(context, bubbleX, bubbleY, bubbleWidth, bubbleHeight, bubbleRadius);
          context.fill();
          context.strokeStyle = toRgba(node.color, 0.35);
          context.lineWidth = 1 / cam.zoom;
          context.stroke();

          context.fillStyle = '#e8e6e1';
          context.fillText(label, bubbleX + bubblePadX, bubbleY + bubbleHeight / 2);
        }
      }

      context.restore();
      state.animFrame = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const deltaPx = Math.hypot(mx - state.mouse.x, my - state.mouse.y);

      if (state.mouse.down && deltaPx > 2) {
        state.mouse.dragged = true;
      }

      if (state.mouse.down && state.mouse.dragNode !== null) {
        const world = toWorld(mx, my);
        const node = state.nodes[state.mouse.dragNode];
        if (node) {
          node.x = world.x;
          node.y = world.y;
        }
        state.mouse.x = mx;
        state.mouse.y = my;
        return;
      }

      if (state.mouse.down && state.mouse.dragNode === null) {
        const dx = (mx - state.mouse.x) / state.camera.zoom;
        const dy = (my - state.mouse.y) / state.camera.zoom;
        state.camera.x += dx;
        state.camera.y += dy;
      }

      state.mouse.x = mx;
      state.mouse.y = my;

      const world = toWorld(mx, my);
      let hovered: number | null = null;
      for (let i = state.nodes.length - 1; i >= 0; i--) {
        const node = state.nodes[i];
        const dx = world.x - node.x;
        const dy = world.y - node.y;
        if (dx * dx + dy * dy < (node.radius + 6 / state.camera.zoom) ** 2) {
          hovered = i;
          break;
        }
      }

      state.mouse.hoveredNode = hovered;
      canvasEl.style.cursor = hovered !== null ? 'pointer' : state.mouse.down ? 'grabbing' : 'grab';
    }

    function onMouseDown(e: MouseEvent) {
      state.mouse.down = true;
      state.mouse.dragged = false;
      state.mouse.downNode = state.mouse.hoveredNode;
      const rect = canvasEl.getBoundingClientRect();
      state.mouse.x = e.clientX - rect.left;
      state.mouse.y = e.clientY - rect.top;

      if (state.mouse.hoveredNode !== null) {
        state.mouse.dragNode = state.mouse.hoveredNode;
      }
      canvasEl.style.cursor = 'grabbing';
    }

    function onMouseUp() {
      const clicked = state.mouse.hoveredNode;
      if (
        clicked !== null &&
        state.mouse.downNode === clicked &&
        !state.mouse.dragged
      ) {
        onSelectRef.current(state.nodes[clicked] ?? null);
      }

      state.mouse.down = false;
      state.mouse.dragNode = null;
      state.mouse.downNode = null;
      state.mouse.dragged = false;
      canvasEl.style.cursor = state.mouse.hoveredNode !== null ? 'pointer' : 'grab';
    }

    function onMouseLeave() {
      state.mouse.down = false;
      state.mouse.dragNode = null;
      state.mouse.hoveredNode = null;
      state.mouse.downNode = null;
      state.mouse.dragged = false;
      canvasEl.style.cursor = 'grab';
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.94 : 1.07;
      state.camera.zoom = Math.max(0.36, Math.min(3.2, state.camera.zoom * delta));
      const nextLod = lodFromZoom(state.camera.zoom);
      if (nextLod !== state.lod) rebuild(nextLod);
    }

    function onVisibilityChange() {
      state.paused = document.hidden;
    }

    resize();
    onVisibilityChange();
    state.animFrame = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    canvasEl.addEventListener('mousemove', onMouseMove);
    canvasEl.addEventListener('mousedown', onMouseDown);
    canvasEl.addEventListener('mouseup', onMouseUp);
    canvasEl.addEventListener('mouseleave', onMouseLeave);
    canvasEl.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      if (state.animFrame !== null) cancelAnimationFrame(state.animFrame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvasEl.removeEventListener('mousemove', onMouseMove);
      canvasEl.removeEventListener('mousedown', onMouseDown);
      canvasEl.removeEventListener('mouseup', onMouseUp);
      canvasEl.removeEventListener('mouseleave', onMouseLeave);
      canvasEl.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canvas RAF + listeners mount once; data/accent sync below.
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    state.accent = accentRgb;
    const lod = lodFromZoom(state.camera.zoom);
    const built = materializeGraph(leaves, lod, accentRgb);
    state.nodes = built.nodes;
    state.edges = built.edges;
    state.lod = lod;
  }, [leaves, accentRgb]);

  return (
    <div className="am-graph-canvas">
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />
    </div>
  );
}
