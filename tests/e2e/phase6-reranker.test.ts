/**
 * Phase 6 — reranker unit tests.
 *
 * Exercises every boost/decay in isolation and then together, to prove
 * the composite scoring behaves as advertised without surprises.
 */

import { describe, it, expect } from 'bun:test';
import {
  rerank,
  similarity,
} from '../../src/services/worker/search/reranker.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function obs(opts: {
  id: number;
  text?: string;
  project?: string;
  title?: string;
  subtitle?: string;
  score?: number;
  created_at_epoch?: number;
  useful?: boolean;
}) {
  return {
    id: opts.id,
    memory_session_id: 's',
    project: opts.project ?? 'p',
    text: opts.text ?? 'some text',
    title: opts.title ?? null,
    subtitle: opts.subtitle ?? null,
    type: 'discovery' as const,
    facts: null,
    narrative: null,
    concepts: null,
    files_read: null,
    files_modified: null,
    prompt_number: null,
    discovery_tokens: 0,
    created_at: new Date(opts.created_at_epoch ?? Date.now()).toISOString(),
    created_at_epoch: opts.created_at_epoch ?? Date.now(),
    score: opts.score,
    ...(opts.useful !== undefined ? { useful: opts.useful } : {}),
  } as any;
}

describe('Phase 6: reranker', () => {
  describe('project boost', () => {
    it('moves a current-project result above a higher-scored off-project result', () => {
      const now = Date.now();
      const results = [
        obs({ id: 1, score: 0.9, project: 'other', text: 'A', created_at_epoch: now }),
        obs({ id: 2, score: 0.8, project: 'mine', text: 'B', created_at_epoch: now }),
      ];
      const out = rerank(results, { currentProject: 'mine', now, projectBoost: 1.5 });
      expect(out[0].item.id).toBe(2);
      expect(out[1].item.id).toBe(1);
    });

    it('is a no-op when currentProject is unset', () => {
      const now = Date.now();
      const results = [
        obs({ id: 1, score: 0.9, project: 'other', text: 'A', created_at_epoch: now }),
        obs({ id: 2, score: 0.8, project: 'mine', text: 'B', created_at_epoch: now }),
      ];
      const out = rerank(results, { now });
      expect(out[0].item.id).toBe(1);
    });
  });

  describe('useful boost', () => {
    it('promotes a useful-flagged result over an equal unflagged one', () => {
      const now = Date.now();
      const results = [
        obs({ id: 1, score: 0.7, text: 'A', created_at_epoch: now }),
        obs({ id: 2, score: 0.7, text: 'B', useful: true, created_at_epoch: now }),
      ];
      const out = rerank(results, { now, usefulBoost: 1.5 });
      expect(out[0].item.id).toBe(2);
    });
  });

  describe('age decay', () => {
    it('lowers scores for older items without dropping below the floor', () => {
      const now = 1_700_000_000_000;
      const fresh = obs({ id: 1, score: 0.9, text: 'fresh', created_at_epoch: now });
      const stale = obs({
        id: 2,
        score: 0.9,
        text: 'stale',
        created_at_epoch: now - 365 * DAY_MS,
      });
      const out = rerank([fresh, stale], { now, halfLifeMs: 30 * DAY_MS, minAgeScale: 0.1 });
      expect(out[0].item.id).toBe(1);
      expect(out[0].modifiers.ageScale).toBeCloseTo(1, 3);
      expect(out[1].modifiers.ageScale).toBeGreaterThanOrEqual(0.1);
      expect(out[1].modifiers.ageScale).toBeLessThan(0.2);
    });

    it('treats a result created exactly one half-life ago as score/2', () => {
      const now = 1_700_000_000_000;
      const target = obs({
        id: 1,
        score: 1.0,
        text: 'x',
        created_at_epoch: now - 30 * DAY_MS,
      });
      const out = rerank([target], { now, halfLifeMs: 30 * DAY_MS, minAgeScale: 0 });
      expect(out[0].modifiers.ageScale).toBeCloseTo(0.5, 3);
      expect(out[0].finalScore).toBeCloseTo(0.5, 3);
    });
  });

  describe('near-duplicate dedupe', () => {
    it('drops an almost-identical lower-scored result', () => {
      const now = Date.now();
      const first = obs({
        id: 1,
        score: 0.9,
        title: 'Added retry logic to worker-service.ts',
        created_at_epoch: now,
      });
      const dup = obs({
        id: 2,
        score: 0.6,
        title: 'Added retry logic to worker-service.ts!',
        created_at_epoch: now,
      });
      const distinct = obs({
        id: 3,
        score: 0.5,
        title: 'Fixed the sqlite migration path',
        created_at_epoch: now,
      });
      const out = rerank([first, dup, distinct], { now, dedupeSimilarityThreshold: 0.85 });
      const ids = out.map((r) => r.item.id);
      expect(ids).toContain(1);
      expect(ids).toContain(3);
      expect(ids).not.toContain(2);
    });

    it('can be disabled', () => {
      const now = Date.now();
      const a = obs({ id: 1, score: 0.9, title: 'Identical', created_at_epoch: now });
      const b = obs({ id: 2, score: 0.6, title: 'Identical', created_at_epoch: now });
      const out = rerank([a, b], { now, dedupe: false });
      expect(out).toHaveLength(2);
    });
  });

  describe('composite', () => {
    it('resolves a realistic three-way ranking correctly', () => {
      const now = 1_700_000_000_000;
      const highScoreStaleOffProject = obs({
        id: 1,
        score: 0.95,
        title: 'stale off-project hit',
        project: 'other',
        created_at_epoch: now - 120 * DAY_MS,
      });
      const midScoreFreshCurrent = obs({
        id: 2,
        score: 0.65,
        title: 'fresh current-project hit',
        project: 'mine',
        created_at_epoch: now,
      });
      const lowScoreFreshUseful = obs({
        id: 3,
        score: 0.55,
        title: 'fresh useful hit',
        project: 'mine',
        created_at_epoch: now,
        useful: true,
      });
      const out = rerank(
        [highScoreStaleOffProject, midScoreFreshCurrent, lowScoreFreshUseful],
        {
          currentProject: 'mine',
          now,
          halfLifeMs: 30 * DAY_MS,
          projectBoost: 1.4,
          usefulBoost: 1.4,
          minAgeScale: 0.2,
        },
      );
      // lowScoreFreshUseful should win because useful + project + fresh
      // dominate the other two.
      expect(out[0].item.id).toBe(3);
      // highScoreStaleOffProject gets punished by age decay heavily enough
      // that the mid-score fresh current-project result beats it.
      expect(out[1].item.id).toBe(2);
      expect(out[2].item.id).toBe(1);
    });
  });

  describe('similarity helper', () => {
    it('returns 1 for identical strings', () => {
      expect(similarity('abc', 'abc')).toBe(1);
    });
    it('returns 0 for empty input', () => {
      expect(similarity('', 'abc')).toBe(0);
    });
    it('is symmetric', () => {
      expect(similarity('hello world', 'hello word')).toBeCloseTo(
        similarity('hello word', 'hello world'),
        3,
      );
    });
    it('decreases with edit distance', () => {
      const high = similarity('the quick brown fox', 'the quick brown fox');
      const lower = similarity('the quick brown fox', 'the slow green cat');
      expect(high).toBeGreaterThan(lower);
    });
  });
});
