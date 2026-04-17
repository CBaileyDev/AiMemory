import { describe, it, expect } from 'bun:test';

import {
  calculateObservationTokens,
  calculateTokenEconomics,
} from '../../src/services/context/index.js';
import type { Observation } from '../../src/services/context/types.js';
import { CHARS_PER_TOKEN_ESTIMATE } from '../../src/services/context/types.js';

// Helper to create a minimal observation for testing
function createTestObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 1,
    memory_session_id: 'session-123',
    type: 'discovery',
    title: null,
    subtitle: null,
    narrative: null,
    facts: null,
    concepts: null,
    files_read: null,
    files_modified: null,
    discovery_tokens: null,
    created_at: '2025-01-01T12:00:00.000Z',
    created_at_epoch: 1735732800000,
    ...overrides,
  };
}

describe('TokenCalculator', () => {
  describe('CHARS_PER_TOKEN_ESTIMATE constant', () => {
    // Retained for backwards compatibility: the legacy chars/4 constant is
    // still exported from types.ts as a documented approximation floor.
    // Production token counting now uses the real BPE tokenizer in
    // src/shared/tokenizer.ts. See Phase 1.1 of the AiMemory roadmap.
    it('should be 4 characters per token', () => {
      expect(CHARS_PER_TOKEN_ESTIMATE).toBe(4);
    });
  });

  describe('calculateObservationTokens', () => {
    // Phase 1.1: These tests moved from hardcoded chars/4 expectations to
    // behavioral assertions because the real BPE tokenizer produces
    // content-dependent counts. We assert invariants (positivity,
    // monotonicity, additivity bounds) rather than magic numbers so the
    // tests remain valid if the tokenizer's internal encoding ever changes.

    it('should return a small non-negative count for an observation with no content', () => {
      const obs = createTestObservation();
      const tokens = calculateObservationTokens(obs);
      // null facts stringify to '[]'; empty-ish payload should still
      // yield a deterministic, small, non-negative integer.
      expect(tokens).toBeGreaterThanOrEqual(0);
      expect(tokens).toBeLessThan(10);
      expect(Number.isInteger(tokens)).toBe(true);
    });

    it('should increase token count as title length grows', () => {
      const baseline = calculateObservationTokens(createTestObservation());
      const small = calculateObservationTokens(
        createTestObservation({ title: 'A'.repeat(10) })
      );
      const large = calculateObservationTokens(
        createTestObservation({ title: 'A'.repeat(100) })
      );

      expect(small).toBeGreaterThanOrEqual(baseline);
      expect(large).toBeGreaterThan(small);
    });

    it('should increase token count as subtitle length grows', () => {
      const baseline = calculateObservationTokens(createTestObservation());
      const withSubtitle = calculateObservationTokens(
        createTestObservation({ subtitle: 'word '.repeat(20) })
      );

      expect(withSubtitle).toBeGreaterThan(baseline);
    });

    it('should increase token count as narrative length grows', () => {
      const short = calculateObservationTokens(
        createTestObservation({ narrative: 'The quick brown fox.' })
      );
      const long = calculateObservationTokens(
        createTestObservation({
          narrative: 'The quick brown fox jumps over the lazy dog. '.repeat(10),
        })
      );

      expect(long).toBeGreaterThan(short);
    });

    it('should include facts JSON content in the total count', () => {
      const without = calculateObservationTokens(createTestObservation());
      const withFacts = calculateObservationTokens(
        createTestObservation({ facts: '["fact one", "fact two", "fact three"]' })
      );

      expect(withFacts).toBeGreaterThan(without);
    });

    it('should combine all fields so totals exceed any single field', () => {
      const titleOnly = calculateObservationTokens(
        createTestObservation({ title: 'A'.repeat(20) })
      );
      const combined = calculateObservationTokens(
        createTestObservation({
          title: 'A'.repeat(20),
          subtitle: 'B'.repeat(20),
          narrative: 'C'.repeat(40),
          facts: '["test"]',
        })
      );

      expect(combined).toBeGreaterThan(titleOnly);
    });

    it('should scale to large observations without losing determinism', () => {
      const largeNarrative = 'X'.repeat(4000);
      const obs = createTestObservation({ narrative: largeNarrative });
      const first = calculateObservationTokens(obs);
      const second = calculateObservationTokens(obs);

      // Real tokenizer caches by content hash; identical input must yield
      // identical output, and 4000 chars of text must be a meaningful count.
      expect(first).toBe(second);
      expect(first).toBeGreaterThan(100);
      expect(Number.isInteger(first)).toBe(true);
    });

    it('should return integer token counts', () => {
      const obs = createTestObservation({ title: 'ABCDEFGHI' }); // 9 chars
      const tokens = calculateObservationTokens(obs);
      expect(Number.isInteger(tokens)).toBe(true);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('calculateTokenEconomics', () => {
    it('should return zeros for empty observations array', () => {
      const economics = calculateTokenEconomics([]);

      expect(economics.totalObservations).toBe(0);
      expect(economics.totalReadTokens).toBe(0);
      expect(economics.totalDiscoveryTokens).toBe(0);
      expect(economics.savings).toBe(0);
      expect(economics.savingsPercent).toBe(0);
    });

    it('should count total observations', () => {
      const observations = [
        createTestObservation({ id: 1 }),
        createTestObservation({ id: 2 }),
        createTestObservation({ id: 3 }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.totalObservations).toBe(3);
    });

    it('should sum read tokens additively across identical observations', () => {
      const single = createTestObservation({ title: 'A'.repeat(40) });
      const singleTokens = calculateObservationTokens(single);

      const observations = [
        createTestObservation({ title: 'A'.repeat(40) }),
        createTestObservation({ title: 'A'.repeat(40) }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.totalReadTokens).toBe(singleTokens * 2);
    });

    it('should sum discovery tokens from all observations', () => {
      const observations = [
        createTestObservation({ discovery_tokens: 100 }),
        createTestObservation({ discovery_tokens: 200 }),
        createTestObservation({ discovery_tokens: 300 }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.totalDiscoveryTokens).toBe(600);
    });

    it('should handle null discovery_tokens as 0', () => {
      const observations = [
        createTestObservation({ discovery_tokens: 100 }),
        createTestObservation({ discovery_tokens: null }),
        createTestObservation({ discovery_tokens: 50 }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.totalDiscoveryTokens).toBe(150);
    });

    it('should calculate savings as discovery minus read tokens', () => {
      const obs = createTestObservation({
        title: 'A'.repeat(40),
        discovery_tokens: 500,
      });
      const readTokens = calculateObservationTokens(obs);
      const economics = calculateTokenEconomics([obs]);

      expect(economics.savings).toBe(500 - readTokens);
      expect(economics.totalReadTokens).toBe(readTokens);
    });

    it('should calculate savings percent correctly', () => {
      // Build from what the tokenizer actually says so we don't pin chars/4.
      const obs = createTestObservation({
        title: 'A'.repeat(400),
        discovery_tokens: 10_000,
      });
      const readTokens = calculateObservationTokens(obs);
      const economics = calculateTokenEconomics([obs]);
      const expectedPercent = Math.round(
        ((10_000 - readTokens) / 10_000) * 100
      );

      expect(economics.totalReadTokens).toBe(readTokens);
      expect(economics.totalDiscoveryTokens).toBe(10_000);
      expect(economics.savings).toBe(10_000 - readTokens);
      expect(economics.savingsPercent).toBe(expectedPercent);
      // High-ratio scenario: should be meaningfully positive savings.
      expect(economics.savingsPercent).toBeGreaterThan(50);
    });

    it('should return 0% savings when discovery tokens is 0', () => {
      const observations = [
        createTestObservation({ discovery_tokens: 0 }),
        createTestObservation({ discovery_tokens: null }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.savingsPercent).toBe(0);
    });

    it('should handle negative savings correctly', () => {
      // When read tokens > discovery tokens, savings is negative.
      const observations = [
        createTestObservation({
          narrative: 'X'.repeat(400),
          discovery_tokens: 1, // Intentionally tiny.
        }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.savings).toBeLessThan(0);
    });

    it('should round savings percent to nearest integer', () => {
      // Assert the rounding invariant, not a hardcoded percentage.
      const obs = createTestObservation({
        title: 'A'.repeat(130),
        discovery_tokens: 100,
      });
      const readTokens = calculateObservationTokens(obs);
      const economics = calculateTokenEconomics([obs]);
      const expectedPercent = Math.round(
        ((100 - readTokens) / 100) * 100
      );

      expect(economics.totalReadTokens).toBe(readTokens);
      expect(economics.savingsPercent).toBe(expectedPercent);
      expect(Number.isInteger(economics.savingsPercent)).toBe(true);
    });

    it('should aggregate correctly with multiple observations', () => {
      const observations = [
        createTestObservation({
          id: 1,
          title: 'A'.repeat(20),
          narrative: 'X'.repeat(60),
          discovery_tokens: 500,
        }),
        createTestObservation({
          id: 2,
          title: 'B'.repeat(40),
          subtitle: 'Y'.repeat(40),
          discovery_tokens: 300,
        }),
        createTestObservation({
          id: 3,
          narrative: 'Z'.repeat(100),
          facts: '["fact1", "fact2"]',
          discovery_tokens: 200,
        }),
      ];
      const economics = calculateTokenEconomics(observations);

      expect(economics.totalObservations).toBe(3);
      expect(economics.totalDiscoveryTokens).toBe(1000);
      expect(economics.totalReadTokens).toBeGreaterThan(0);
      expect(economics.savings).toBe(economics.totalDiscoveryTokens - economics.totalReadTokens);
    });
  });
});
