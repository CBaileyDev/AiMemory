/**
 * Shared tokenizer for AiMemory.
 *
 * Phase 1.1 of the AiMemory roadmap replaces the ubiquitous
 * `Math.ceil(text.length / 4)` estimator with a real BPE tokenizer.
 *
 * Design notes:
 * - Uses `js-tiktoken` (pure JS, no WASM) so it works identically under Bun,
 *   Node, and the installed plugin runtime without native-addon issues.
 * - Defaults to the `cl100k_base` encoding. This is OpenAI's tokenizer but is
 *   a closer approximation to Anthropic's tokenizer than chars/4 — typical
 *   divergence is 2-8%. Anthropic does not publish a public offline tokenizer,
 *   so cl100k_base is the best portable baseline. Callers that care about
 *   exactness can pass `{ encoding: 'o200k_base' }` for GPT-4o-class models.
 * - Encoding is lazy: the BPE tables (~1MB) are only loaded on first use.
 *   Hook/CLI code paths that never count tokens pay zero startup cost.
 * - A bounded LRU cache keyed by SHA-256 of the input avoids re-tokenizing
 *   the same narrative/observation across multiple render passes.
 * - If tiktoken fails to load for any reason (corrupted install, sandboxed
 *   runtime, etc.) we fall back to the chars/4 heuristic and log once. Token
 *   counting is informational, never load-bearing for correctness.
 *
 * Callers: prefer `countTokens(text)` for a single string. For hot loops
 * rendering many short strings, the internal cache removes most of the cost.
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';

export type TokenEncoding = 'cl100k_base' | 'o200k_base' | 'p50k_base' | 'r50k_base';

export interface CountTokensOptions {
  /** BPE encoding to use. Defaults to cl100k_base (closest portable match to Anthropic/OpenAI families). */
  encoding?: TokenEncoding;
  /** Skip the cache for this call. Useful for benchmarking. */
  bypassCache?: boolean;
}

// ---------------------------------------------------------------------------
// Lazy encoder loader
// ---------------------------------------------------------------------------

// Cache the encoder instance per encoding name. We only ever load on demand.
const encoderCache = new Map<TokenEncoding, { encode: (text: string) => number[] } | null>();

// Track whether we've already logged the fallback warning (avoid log spam).
let fallbackWarningEmitted = false;

function loadEncoder(encoding: TokenEncoding): { encode: (text: string) => number[] } | null {
  if (encoderCache.has(encoding)) {
    return encoderCache.get(encoding) ?? null;
  }

  try {
    // `require` resolved lazily so hooks that never tokenize don't pay
    // the ~1MB BPE table load cost.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tiktoken = require('js-tiktoken');
    const encoder = tiktoken.getEncoding(encoding);
    encoderCache.set(encoding, encoder);
    return encoder;
  } catch (err) {
    if (!fallbackWarningEmitted) {
      fallbackWarningEmitted = true;
      logger.warn(
        'TOKENIZER',
        'js-tiktoken unavailable; falling back to chars/4 heuristic',
        { encoding, error: (err as Error).message }
      );
    }
    encoderCache.set(encoding, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Content-hash LRU cache
// ---------------------------------------------------------------------------

/** Cap the cache to avoid unbounded memory growth in long-running workers. */
const MAX_CACHE_ENTRIES = 4096;

// Map preserves insertion order → cheap LRU: delete on hit, re-insert, and
// drop the oldest entry when we overflow.
const tokenCountCache = new Map<string, number>();

function cacheKey(text: string, encoding: TokenEncoding): string {
  // SHA-256 keeps keys short even for huge corpus renderings. The extra cost
  // vs. a raw-string key is paid back by avoiding a multi-megabyte Map key.
  const hash = createHash('sha256').update(text).digest('hex');
  return `${encoding}:${hash}`;
}

function cacheGet(key: string): number | undefined {
  if (!tokenCountCache.has(key)) return undefined;
  const value = tokenCountCache.get(key)!;
  // LRU touch: move to end
  tokenCountCache.delete(key);
  tokenCountCache.set(key, value);
  return value;
}

function cacheSet(key: string, value: number): void {
  if (tokenCountCache.size >= MAX_CACHE_ENTRIES) {
    // Drop the oldest entry
    const firstKey = tokenCountCache.keys().next().value;
    if (firstKey !== undefined) tokenCountCache.delete(firstKey);
  }
  tokenCountCache.set(key, value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Heuristic fallback used when the real encoder can't be loaded. */
function fallbackCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens for a piece of text.
 *
 * Returns a real BPE token count when `js-tiktoken` is available, falling back
 * to the chars/4 heuristic otherwise. `null`/empty input returns 0.
 *
 * Results are cached by SHA-256 of the input + encoding name, so calling this
 * repeatedly for the same narrative is effectively free after the first call.
 */
export function countTokens(
  text: string | null | undefined,
  options: CountTokensOptions = {}
): number {
  if (!text) return 0;

  const encoding: TokenEncoding = options.encoding ?? 'cl100k_base';
  const key = options.bypassCache ? null : cacheKey(text, encoding);

  if (key) {
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
  }

  let count: number;
  const encoder = loadEncoder(encoding);
  if (encoder) {
    try {
      count = encoder.encode(text).length;
    } catch (err) {
      // Rare: malformed input. Fall back rather than propagate.
      logger.debug(
        'TOKENIZER',
        'Encoder threw; falling back to chars/4',
        { encoding, error: (err as Error).message, preview: text.slice(0, 64) }
      );
      count = fallbackCount(text);
    }
  } else {
    count = fallbackCount(text);
  }

  if (key) cacheSet(key, count);
  return count;
}

/**
 * True if a real BPE tokenizer is currently available. Exposed for diagnostics
 * and for the token-savings dashboard to tag counts as "estimated" vs. "exact".
 */
export function hasRealTokenizer(): boolean {
  // Probe the default encoding lazily.
  return loadEncoder('cl100k_base') !== null;
}

/**
 * Clear the internal cache. Intended for tests and benchmarks.
 */
export function resetTokenizerCache(): void {
  tokenCountCache.clear();
}
