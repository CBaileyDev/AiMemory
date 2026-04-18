import { logger } from '../../../utils/logger.js';

/**
 * Phase 6 — search result reranker.
 *
 * Takes a pre-scored list of search results and applies four boosts /
 * decays on top of the base relevance score:
 *
 *   1. Project boost   — results from the current project rank higher.
 *   2. Useful boost    — results flagged `useful` (future Phase 5 feedback
 *                        loop) get an extra multiplier. Safe to apply
 *                        pre-feedback-landing because unflagged rows are
 *                        unaffected.
 *   3. Age decay       — exponential half-life so stale observations fade.
 *   4. Near-duplicate dedupe
 *                      — drops results whose normalized text is within
 *                        Levenshtein distance of an earlier (higher-scored)
 *                        result.
 *
 * Pure function — no I/O, no global state. The worker wires this in
 * behind a setting flag so it can be A/B'd against the existing ranker.
 *
 * Scoring model:
 *   finalScore = baseScore * projectMult * usefulMult * ageDecay
 *
 * All multipliers are ≥ 0. Dedupe happens after scoring, not before, so a
 * high-quality stale match is not displaced by a noisy fresh one.
 */

import type {
  ObservationSearchResult,
  SessionSummarySearchResult,
  UserPromptSearchResult,
} from '../../sqlite/types.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RerankerOptions {
  /** Stable project id to boost; undefined disables the project boost. */
  currentProject?: string;
  /** Multiplier applied to results matching currentProject. Default 1.25. */
  projectBoost?: number;
  /** Multiplier applied when a result is flagged `useful`. Default 1.35. */
  usefulBoost?: number;
  /** Half-life for age decay in milliseconds. Default 30 days. */
  halfLifeMs?: number;
  /** Floor applied after age decay so very old results don't fall to 0. Default 0.2. */
  minAgeScale?: number;
  /** Enable near-duplicate dedupe. Default true. */
  dedupe?: boolean;
  /** Normalized edit-distance threshold above which two strings are "similar enough". Default 0.85. */
  dedupeSimilarityThreshold?: number;
  /** "Now" in epoch ms — injectable for tests. Default Date.now(). */
  now?: number;
}

const DEFAULTS: Required<Omit<RerankerOptions, 'currentProject' | 'now'>> = {
  projectBoost: 1.25,
  usefulBoost: 1.35,
  halfLifeMs: 30 * 24 * 60 * 60 * 1000,
  minAgeScale: 0.2,
  dedupe: true,
  dedupeSimilarityThreshold: 0.85,
};

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

type AnyResult =
  | ObservationSearchResult
  | SessionSummarySearchResult
  | UserPromptSearchResult;

export interface ScoredResult<T extends AnyResult> {
  item: T;
  /** Base score from the underlying search strategy (0..1, higher = better). */
  baseScore: number;
  /** Score after all boosts/decays applied. */
  finalScore: number;
  /** Which modifiers fired — useful for debugging/logging. */
  modifiers: {
    projectMult: number;
    usefulMult: number;
    ageScale: number;
  };
}

/**
 * Rerank a list of search results in place of their relevance order.
 *
 * - Input is expected to have `created_at_epoch` (present on every row
 *   type) and optionally `score` or `rank`.
 * - Items without a numeric base score get the neutral score `0.5`.
 * - Items with `useful === true` get a boost; anything else is treated
 *   as unflagged.
 * - Items with `project === currentProject` get the project boost.
 */
export function rerank<T extends AnyResult>(
  results: T[],
  options: RerankerOptions = {},
): ScoredResult<T>[] {
  const opts = { ...DEFAULTS, ...options };
  const now = options.now ?? Date.now();

  const scored: ScoredResult<T>[] = results.map((item) => {
    const baseScore = toBaseScore(item);
    const projectMult =
      options.currentProject &&
      'project' in item &&
      (item as any).project === options.currentProject
        ? opts.projectBoost
        : 1;
    const usefulMult = (item as any).useful === true ? opts.usefulBoost : 1;
    const ageScale = computeAgeScale(
      toEpoch(item),
      now,
      opts.halfLifeMs,
      opts.minAgeScale,
    );
    const finalScore = baseScore * projectMult * usefulMult * ageScale;
    return {
      item,
      baseScore,
      finalScore,
      modifiers: { projectMult, usefulMult, ageScale },
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);

  const output = opts.dedupe ? dedupeScored(scored, opts.dedupeSimilarityThreshold) : scored;
  logger.debug('WORKER', 'rerank complete', { inputCount: results.length, outputCount: output.length });
  return output;
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function toBaseScore(item: AnyResult): number {
  // Prefer the normalized score if the strategy produced one.
  if (typeof item.score === 'number' && isFinite(item.score)) {
    return clamp01(item.score);
  }
  // Fall back to inverse rank if FTS5 supplied only `rank` (lower = better).
  if (typeof item.rank === 'number' && isFinite(item.rank) && item.rank > 0) {
    return clamp01(1 / (1 + item.rank));
  }
  return 0.5;
}

function toEpoch(item: AnyResult): number {
  const epoch = (item as any).created_at_epoch;
  if (typeof epoch === 'number' && isFinite(epoch)) return epoch;
  const iso = (item as any).created_at;
  if (typeof iso === 'string') {
    const parsed = Date.parse(iso);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function computeAgeScale(
  createdAtMs: number,
  nowMs: number,
  halfLifeMs: number,
  floor: number,
): number {
  const deltaMs = Math.max(0, nowMs - createdAtMs);
  // Standard exponential decay: (1/2)^(delta / halfLife)
  const decay = Math.pow(0.5, deltaMs / halfLifeMs);
  return Math.max(floor, decay);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// ---------------------------------------------------------------------------
// Near-duplicate dedupe
// ---------------------------------------------------------------------------

function dedupeScored<T extends AnyResult>(
  scored: ScoredResult<T>[],
  threshold: number,
): ScoredResult<T>[] {
  const kept: ScoredResult<T>[] = [];
  const keptSignatures: string[] = [];

  for (const entry of scored) {
    const sig = signature(entry.item);
    const isDup = keptSignatures.some((existing) =>
      similarity(existing, sig) >= threshold,
    );
    if (!isDup) {
      kept.push(entry);
      keptSignatures.push(sig);
    }
  }

  return kept;
}

/**
 * Collapse a result to a normalized short signature that's cheap to compare.
 * We prefer a title/subtitle combo where available (observations/sessions)
 * and fall back to the raw text body for prompts.
 */
function signature(item: AnyResult): string {
  const anyItem = item as any;
  const candidates = [anyItem.title, anyItem.subtitle, anyItem.text, anyItem.prompt_text]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const raw = candidates.join(' ');
  return raw
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, '')
    .trim()
    .slice(0, 120);
}

/** Similarity in [0, 1] using a bounded Levenshtein. 1 = identical. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  const distance = levenshtein(longer, shorter, longer.length);
  return (longer.length - distance) / longer.length;
}

/** Classic edit-distance with an early-exit when distance exceeds budget. */
function levenshtein(a: string, b: string, _budget: number): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Rolling-row DP
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}
