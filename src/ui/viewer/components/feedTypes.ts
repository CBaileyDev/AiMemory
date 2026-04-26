/**
 * Unified FeedItem shape — folds Observation, Summary, and UserPrompt into a
 * single type the new design's MemoryCard can render.
 */

import type { Observation, Summary, UserPrompt } from '../types';

export interface ItemTokens {
  cost: number;
  reused: number;
  saved: number;
}

export interface FeedItem {
  kind: 'observation' | 'summary' | 'prompt';
  id: number;
  type: string;
  title: string;
  summary: string | null;
  project: string | null;
  platform_source: string;
  created_at_epoch: number;
  files: string[];
  concepts: string[];
  tokens: ItemTokens;
}

const TOKENS_PER_MEMORY = 800;
const AVG_REUSE = 3.2;

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.filter(Boolean).map(String);
    } catch {
      // fall through
    }
  }
  return trimmed
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function deriveTokens(approxBodyChars: number): ItemTokens {
  // Rough heuristic: 1 token ≈ 4 chars; cost is what we actually spent to
  // capture the memory, reused is per-recall savings, saved = reused − cost.
  const cost = Math.max(150, Math.round(approxBodyChars / 4));
  const reused = Math.round(TOKENS_PER_MEMORY * AVG_REUSE);
  const saved = Math.max(0, reused - cost);
  return { cost, reused, saved };
}

export function observationToFeedItem(o: Observation): FeedItem {
  const titleSeed =
    o.title?.trim() || o.subtitle?.trim() || o.narrative?.split('.')[0] || `Observation ${o.id}`;
  const summarySeed =
    o.subtitle && o.subtitle !== o.title ? o.subtitle : o.narrative || o.text || null;
  const bodyLen = (o.narrative || o.text || o.title || '').length;
  return {
    kind: 'observation',
    id: o.id,
    type: o.type || 'decision',
    title: titleSeed.length > 140 ? `${titleSeed.slice(0, 137)}…` : titleSeed,
    summary: summarySeed,
    project: o.project || null,
    platform_source: o.platform_source || 'claude',
    created_at_epoch: typeof o.created_at_epoch === 'number'
      ? o.created_at_epoch * (o.created_at_epoch < 1e12 ? 1000 : 1)
      : Date.parse(o.created_at) || Date.now(),
    files: parseList(o.files_modified ?? o.files_read),
    concepts: parseList(o.concepts).slice(0, 8),
    tokens: deriveTokens(bodyLen)
  };
}

export function summaryToFeedItem(s: Summary): FeedItem {
  const sections = [s.completed, s.investigated, s.learned, s.next_steps].filter(Boolean) as string[];
  const titleSeed = s.request?.trim() || sections[0]?.split('\n')[0] || `Session ${s.id}`;
  const summarySeed = sections.join(' · ') || null;
  const bodyLen = sections.join(' ').length;
  const inferred =
    s.completed?.trim() ? 'feature' :
    s.investigated?.trim() ? 'investigation' :
    s.learned?.trim() ? 'decision' :
    s.next_steps?.trim() ? 'next' : 'decision';
  return {
    kind: 'summary',
    id: s.id,
    type: inferred,
    title: titleSeed.length > 140 ? `${titleSeed.slice(0, 137)}…` : titleSeed,
    summary: summarySeed,
    project: s.project || null,
    platform_source: s.platform_source || 'claude',
    created_at_epoch: typeof s.created_at_epoch === 'number'
      ? s.created_at_epoch * (s.created_at_epoch < 1e12 ? 1000 : 1)
      : Date.now(),
    files: [],
    concepts: [],
    tokens: deriveTokens(bodyLen)
  };
}

export function promptToFeedItem(p: UserPrompt): FeedItem {
  const titleSeed = (p.prompt_text || '').split('\n')[0] || `Prompt ${p.id}`;
  return {
    kind: 'prompt',
    id: p.id,
    type: 'prompt',
    title: titleSeed.length > 140 ? `${titleSeed.slice(0, 137)}…` : titleSeed,
    summary: p.prompt_text || null,
    project: p.project || null,
    platform_source: p.platform_source || 'claude',
    created_at_epoch: typeof p.created_at_epoch === 'number'
      ? p.created_at_epoch * (p.created_at_epoch < 1e12 ? 1000 : 1)
      : Date.now(),
    files: [],
    concepts: [],
    tokens: deriveTokens(p.prompt_text?.length ?? 0)
  };
}
