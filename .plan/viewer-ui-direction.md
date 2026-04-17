# Viewer UI 2.0 — Visual Direction (Phase 0)

Owner: Opus. Reviewer: Sonnet.
Referenced by: Phases 1–11 in `viewer-ui.md`.

This document locks the visual grammar every downstream phase inherits. When
anything in a later phase disagrees with this direction, fix the direction
here first, then the consumer.

---

## 1. Brand colors

**Why not GitHub blue.** `#0969da` is generic IDE chrome. AiMemory is the
memory layer under 15 coding surfaces — it must read as product, not chrome.

### Neutral scale (tokens: `--neutral-50..900`)

The only grey system used anywhere. Every tint, border, background, and
muted text derives from this ramp.

| Token | Light | Dark |
|---|---|---|
| `--neutral-50`  | `#fbfaf8` | `#0f0e0c` |
| `--neutral-100` | `#f4f2ee` | `#161513` |
| `--neutral-200` | `#e8e4dc` | `#1e1c19` |
| `--neutral-300` | `#d6d1c6` | `#2a2723` |
| `--neutral-400` | `#a8a195` | `#3a3631` |
| `--neutral-500` | `#7a7468` | `#5a544b` |
| `--neutral-600` | `#57524a` | `#8a8377` |
| `--neutral-700` | `#3a3731` | `#b0a99c` |
| `--neutral-800` | `#24221e` | `#d4ccbf` |
| `--neutral-900` | `#141311` | `#ebe5d9` |

### Accent + feedback

| Role | Light | Dark |
|---|---|---|
| `--accent-primary`   | `#7c3aed` | `#a78bfa` |
| `--accent-primary-soft` | `rgb(124 58 237 / 10%)` | `rgb(167 139 250 / 14%)` |
| `--accent-success`   | `#10b981` | `#34d399` |
| `--accent-warning`   | `#f59e0b` | `#fbbf24` |
| `--accent-error`     | `#ef4444` | `#f87171` |
| `--accent-info`      | `#3b82f6` | `#60a5fa` |

### Source hues (Phase 3 cards + Phase 4 source strip + Phase 5 dashboard)

Each integration gets one hue. At 10px dot size every adjacent pair must be
distinguishable. The squint test: reduce the swatch sheet to 50% opacity —
every dot must still be locatable.

| Source | Hue (light) | Hue (dark) |
|---|---|---|
| `claude-code` / `claude-desktop` | `#ff9d3b` | `#ffb366` |
| `codex-cli` / `codex-vscode`     | `#10a37f` | `#34c8a1` |
| `gemini-cli` / `gemini-vscode`   | `#4285f4` | `#6ba3ff` |
| `kimi` / `kimi-code`             | `#a78bfa` | `#c4b0ff` |
| `cursor`                         | `#111113` | `#f4f4f5` |
| `windsurf`                       | `#22c55e` | `#4ade80` |
| `opencode`                       | `#f97316` | `#fb923c` |
| `openclaw`                       | `#84cc16` | `#a3e635` |
| `copilot-cli`                    | `#6e56cf` | `#9580ff` |
| `antigravity`                    | `#ec4899` | `#f472b6` |
| `goose`                          | `#eab308` | `#fbbf24` |
| `crush`                          | `#06b6d4` | `#22d3ee` |
| `roo-code`                       | `#14b8a6` | `#2dd4bf` |
| `warp`                           | `#f43f5e` | `#fb7185` |
| `all` (default)                  | `--neutral-500` | `--neutral-500` |

**Fallback tier buckets** if 15 dots ever get too crowded at very small
sizes: `claude-*` → orange, `codex-*` → teal, `gemini-*` → blue,
`kimi-*` → purple, `cursor` → mono, everything else → `--neutral-500`.
Phase 3 prefers the per-IDE hue; Phase 5 always uses the per-IDE hue.

---

## 2. Typography

**Body/UI:** `Inter Variable` (system fallback → `-apple-system`,
`BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, sans-serif). 14px base, line
height 1.55. No external CDN — we rely on the system Inter when available
and fall back gracefully.

**Mono/data:** `Monaspace Radon` (already bundled). 13px, 1.45 line height.
Used for IDs, cite keys, file paths, terminal previews.

**Type scale (strict):**

| Token | Size | Usage |
|---|---|---|
| `--text-xs`   | 0.75rem  / 12px | metadata, labels, kbd hints |
| `--text-sm`   | 0.8125rem / 13px | chips, mono IDs |
| `--text-base` | 0.875rem / 14px | body, cards |
| `--text-md`   | 1rem / 16px | card titles |
| `--text-lg`   | 1.125rem / 18px | section headers |
| `--text-xl`   | 1.375rem / 22px | page headers |
| `--text-2xl`  | 1.75rem / 28px | dashboard totals |
| `--text-3xl`  | 2.25rem / 36px | empty-state hero |

---

## 3. Spacing scale

rem-anchored. Every padding/margin snaps to a step.

| Token | Rem | Px |
|---|---|---|
| `--space-1` | 0.25rem | 4 |
| `--space-2` | 0.5rem  | 8 |
| `--space-3` | 0.75rem | 12 |
| `--space-4` | 1rem    | 16 |
| `--space-5` | 1.25rem | 20 |
| `--space-6` | 1.5rem  | 24 |
| `--space-7` | 2rem    | 32 |
| `--space-8` | 2.5rem  | 40 |
| `--space-9` | 3.5rem  | 56 |
| `--space-10`| 5rem    | 80 |

Semantic aliases:

| Token | Value |
|---|---|
| `--space-card-padding` | `--space-5` |
| `--space-card-gap`     | `--space-4` |
| `--space-section-gap`  | `--space-7` |
| `--space-feed-gutter`  | `--space-6` |

---

## 4. Motion

Durations — `--motion-ui: 120ms`, `--motion-card: 180ms`,
`--motion-modal: 240ms`.

Easing — `--ease-in: cubic-bezier(0.16, 1, 0.3, 1)`,
`--ease-out: cubic-bezier(0.4, 0, 0.2, 1)`.

`prefers-reduced-motion: reduce` collapses all durations to `0s` via a
single media query block in `tokens.css`.

---

## 5. Elevation

| Token | Light | Dark (colored bloom) |
|---|---|---|
| `--elev-0` | `0 0 0 1px var(--neutral-200)` | `0 0 0 1px var(--neutral-300)` |
| `--elev-1` | `0 1px 2px rgb(0 0 0 / 4%), 0 4px 12px rgb(0 0 0 / 4%)` | `0 1px 2px rgb(0 0 0 / 40%), 0 12px 24px rgb(124 58 237 / 8%)` |
| `--elev-2` | `0 8px 24px rgb(0 0 0 / 8%), 0 2px 8px rgb(0 0 0 / 6%)` | `0 18px 40px rgb(0 0 0 / 55%), 0 4px 12px rgb(124 58 237 / 10%)` |
| `--elev-3` | `0 24px 48px rgb(0 0 0 / 16%), 0 8px 24px rgb(0 0 0 / 12%)` | `0 32px 64px rgb(0 0 0 / 70%), 0 8px 24px rgb(124 58 237 / 14%)` |

---

## 6. Screens

Figma-less wireframes. Every screen survives at 1440×900, 1024×768, 375px.

### 6.1 Home / feed (populated)

```
┌─ Header ────────────────────────────────────────────────────────┐
│ [◉] aimemory  /  feed   sources   settings    [search ⌘K] [?]   │
├─────────────────────────────────────────────────────────────────┤
│ ▸ [all] [claude-code ● 4.1k] [codex-cli ● 1.4k] [cursor ● 1.8k] │
│   [gemini-cli ● 2.0k] [kimi ● 920] [+ 9 more]          strip →  │
│                                                                 │
│ filters: [bugfix ×] [project:claude-mem ×]   Esc to clear all   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────────────────────────────────────────────────────── ┐    │
│ │ ● claude-code  claude-mem / decision   2m ago   [obs#42] │    │
│ │                                                           │    │
│ │ Migration to per-session store finalized                  │    │
│ │ Cut over writes on deploy; old table drop lands next.     │    │
│ │ [migration] [store] [src/services/sessions.ts]            │    │
│ └───────────────────────────────────────────────────────── ┘    │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Home / feed (empty — fresh install)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                       No memories yet                           │
│                                                                 │
│         Start a session in any of these tools to begin.         │
│                                                                 │
│        [○ claude-code] [○ codex-cli] [○ cursor] [○ kimi]       │
│                  dotted = detected, no data                     │
│                                                                 │
│                  Read the setup guide → docs                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Sources dashboard

```
┌─ Sources ────────────────────────────────────────────────────────┐
│  Total 12,487          Week 1,203 ▲18%   Active 7 / 15  Last 12s │
├──────────────────────────────────────────────────────────────────┤
│ ● claude-code   4,102   12s ago   ▇▇▇▇▇▇▇▇▇▇                    │
│ ● gemini-cli    2,041    2m ago   ▇▇▇▇▇▇                         │
│ ● cursor        1,820    8m ago   ▇▇▇▇                           │
│ ● codex-cli     1,400    1h ago   ▇▇▇                            │
│ ● kimi            920    3h ago   ▇▇                             │
│ ○ windsurf        445    2d ago   ▇                              │
│ ○ opencode        310    5d ago   ▇                              │
│─ not installed ─────────────────────────────────────────────────│
│ openclaw · antigravity · goose · crush · roo-code · warp · …    │
└──────────────────────────────────────────────────────────────────┘
```

### 6.4 Command palette (`⌘K`)

```
┌──────────────────────────────────────────────────────┐
│  [search memory or ? to ask]                         │
├──────────────────────────────────────────────────────┤
│  Memory                                              │
│   obs#42  Migration to per-session store finalized  │
│   obs#37  Fixed off-by-one in pagination cursor     │
│  Actions                                             │
│   → Open sources dashboard        g s               │
│   → Restart worker                                  │
│   → Toggle theme                                    │
│  Sources                                             │
│   → Filter feed → claude-code                       │
└──────────────────────────────────────────────────────┘
```

### 6.5 Ask panel (`⌘J`)

```
┌── Ask ──────────────────────────────────────── drag ─┐
│ How did I fix the migration?                      ↵  │
├──────────────────────────────────────────────────────┤
│ Synthesis (optional, model-gated):                   │
│   Cutover ran on deploy, old table dropped next day. │
│                                                      │
│ Citations:                                           │
│   [obs#42] Migration to per-session store finalized  │
│   [obs#39] Old table retained for one cycle          │
│   [obs#37] Fixed off-by-one in pagination cursor     │
└──────────────────────────────────────────────────────┘
     click [obs#42] → feed scrolls, card pulses 1.2s
```

### 6.6 Settings

```
┌─ Settings ───────────────────────────────────────────┐
│  [General]     Theme       ◉ auto  ○ light  ○ dark  │
│   Sources       Port       37777                     │
│   Search        Log level  info ▾                    │
│   Context                                            │
│   Privacy                                            │
│   MCP                                                │
│   About                                              │
└──────────────────────────────────────────────────────┘
```

### 6.7 Mobile (375px)

Header collapses to one row: logo + ⌘K search icon + menu. Source strip
scrolls horizontally. Cards stack full-width with 12px gutters. Ask panel
becomes full-screen when open.

### 6.8 Dark mode

All screens above swap to the dark neutral scale. Elevations use colored
bloom (violet at low alpha) instead of flat black shadow. Source dots
brighten one step for dark-mode legibility.

---

## 7. Acceptance

Every downstream phase cites this document by section number. If any phase
produces output that conflicts with sections 1–5, the phase stops, opens a
fix-up edit here, and only then continues.
