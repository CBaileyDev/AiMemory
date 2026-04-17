/**
 * `npx claude-mem ask <question>` — natural-language memory query.
 *
 * Phase 6 elevation of `/mem-search`. Unlike `search`, which returns raw
 * JSON, `ask` produces a human-readable answer with citations to specific
 * observation ids.
 *
 * Pipeline:
 *   1. Hit `GET /api/search?query=<question>` on the running worker.
 *   2. Assemble the top N results into a compact, terminal-friendly
 *      answer — title, subtitle, created_at, a short quote, and a
 *      cite key like `[#123]` that maps back to the DB row.
 *   3. If `--model <id>` is passed, forward the question + results to
 *      an LLM synth endpoint on the worker. The default (no flag)
 *      never calls an LLM and never requires a paid API key.
 *
 * The non-LLM default is the whole point — users get a useful answer
 * out of the box, and power users can opt into model synthesis.
 */

import pc from 'picocolors';
import {
  claudeMemDataDirectory,
  isPluginInstalled,
} from '../utils/paths.js';
import { existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Option parsing
// ---------------------------------------------------------------------------

export interface AskOptions {
  question: string;
  /** Optional LLM id; when set, the worker is asked to synthesize. */
  model?: string;
  /** Max number of search results to quote in the answer. Default 5. */
  limit?: number;
  /** Emit as JSON instead of human-readable text. Default false. */
  json?: boolean;
  /** Restrict to a specific project. Default: inferred from cwd basename. */
  project?: string;
}

export function parseAskArgs(argv: string[]): AskOptions {
  const questionParts: string[] = [];
  const opts: Partial<AskOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--model') {
      opts.model = argv[++i];
    } else if (a === '--limit') {
      opts.limit = parseInt(argv[++i] ?? '', 10);
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--project') {
      opts.project = argv[++i];
    } else if (a === '--help' || a === '-h') {
      printAskHelp();
      process.exit(0);
    } else {
      questionParts.push(a);
    }
  }
  return {
    question: questionParts.join(' ').trim(),
    ...opts,
  };
}

function printAskHelp(): void {
  console.log(`
${pc.bold('npx claude-mem ask')} — natural-language memory query

Usage:
  npx claude-mem ask <question> [flags]

Flags:
  --limit <n>      Maximum number of results to include (default 5)
  --project <id>   Restrict to a specific project (default: cwd)
  --model <id>     Synthesize an answer via the worker's LLM (opt-in)
  --json           Emit structured JSON for downstream tooling
  --help           Show this help

Examples:
  npx claude-mem ask "how did I fix the sqlite migration last week?"
  npx claude-mem ask --limit 3 "what tools does the agent use?"
  npx claude-mem ask --json "summarize recent bugfixes"
`);
}

// ---------------------------------------------------------------------------
// Worker calls
// ---------------------------------------------------------------------------

interface SearchHit {
  id?: number;
  title?: string | null;
  subtitle?: string | null;
  text?: string | null;
  prompt_text?: string | null;
  project?: string;
  type?: string;
  created_at?: string;
  created_at_epoch?: number;
  score?: number;
  rank?: number;
}

interface SearchResponse {
  observations?: SearchHit[];
  sessions?: SearchHit[];
  prompts?: SearchHit[];
}

function workerBase(): string {
  const port = process.env.CLAUDE_MEM_WORKER_PORT || '37777';
  return `http://127.0.0.1:${port}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Synthesis — non-LLM default answer
// ---------------------------------------------------------------------------

interface Cite {
  key: string;
  hit: SearchHit;
  kind: 'observation' | 'session' | 'prompt';
}

function collectHits(resp: SearchResponse, limit: number): Cite[] {
  const all: Cite[] = [];
  for (const hit of resp.observations ?? []) all.push({ key: `obs#${hit.id}`, hit, kind: 'observation' });
  for (const hit of resp.sessions ?? []) all.push({ key: `ses#${hit.id}`, hit, kind: 'session' });
  for (const hit of resp.prompts ?? []) all.push({ key: `prm#${hit.id}`, hit, kind: 'prompt' });
  // Stable ordering: by score desc, then created_at_epoch desc.
  all.sort((a, b) => {
    const sa = a.hit.score ?? inverseRank(a.hit.rank);
    const sb = b.hit.score ?? inverseRank(b.hit.rank);
    if (sb !== sa) return sb - sa;
    return (b.hit.created_at_epoch ?? 0) - (a.hit.created_at_epoch ?? 0);
  });
  return all.slice(0, Math.max(1, limit));
}

function inverseRank(rank?: number): number {
  if (typeof rank !== 'number' || !isFinite(rank) || rank <= 0) return 0;
  return 1 / (1 + rank);
}

function renderText(question: string, cites: Cite[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(pc.bold(`Q: ${question}`));
  lines.push('');

  if (cites.length === 0) {
    lines.push(pc.dim('No relevant memories found.'));
    lines.push('');
    lines.push('Try broadening the question, or run: npx claude-mem doctor');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(pc.bold('Most relevant memories:'));
  lines.push('');
  for (const cite of cites) {
    const { hit } = cite;
    const title = hit.title ?? hit.subtitle ?? shortExcerpt(hit.text ?? hit.prompt_text ?? '');
    const date = hit.created_at ? hit.created_at.slice(0, 10) : '';
    const label = `[${cite.key}]`;
    lines.push(`  ${pc.cyan(label)} ${pc.bold(title || '(no title)')}`);
    const meta = [date, hit.project, hit.type].filter(Boolean).join(' · ');
    if (meta) lines.push(`           ${pc.dim(meta)}`);
    const body = shortExcerpt(hit.text ?? hit.prompt_text ?? '', 220);
    if (body && body !== title) {
      lines.push(`           ${body}`);
    }
    lines.push('');
  }

  lines.push(pc.dim('Cite keys above map to SQLite row ids (e.g. `obs#123`).'));
  lines.push(pc.dim('For LLM-synthesized answers, pass --model <id>.'));
  lines.push('');
  return lines.join('\n');
}

function shortExcerpt(raw: string, max: number = 120): string {
  if (!raw) return '';
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + '…';
}

// ---------------------------------------------------------------------------
// LLM synthesis (opt-in)
// ---------------------------------------------------------------------------

async function requestModelSynthesis(
  question: string,
  cites: Cite[],
  model: string,
): Promise<string | null> {
  const url = `${workerBase()}/api/ask`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question,
        model,
        hits: cites.map((c) => ({ kind: c.kind, key: c.key, hit: c.hit })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { answer?: string };
    return body.answer ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runAskCommand(argv: string[]): Promise<void> {
  const opts = parseAskArgs(argv);

  if (!opts.question) {
    console.error(pc.red('Usage: npx claude-mem ask <question>'));
    console.error(`Run: ${pc.bold('npx claude-mem ask --help')}`);
    process.exit(1);
  }

  ensureInstalledOrExit();

  const limit = typeof opts.limit === 'number' && isFinite(opts.limit) ? opts.limit : 5;
  const project =
    opts.project ??
    (process.cwd() ? basename(process.cwd()) : undefined);

  // 1. Search
  const searchUrl =
    `${workerBase()}/api/search?query=${encodeURIComponent(opts.question)}` +
    (project ? `&project=${encodeURIComponent(project)}` : '') +
    `&limit=${encodeURIComponent(String(Math.max(5, limit * 2)))}`;

  const resp = await fetchJson<SearchResponse>(searchUrl);
  if (!resp) {
    console.error(pc.red('Worker is not reachable — cannot run ask.'));
    console.error(`Start it with: ${pc.bold('npx claude-mem start')}`);
    process.exit(1);
  }

  const cites = collectHits(resp, limit);

  // 2. (Optional) LLM synthesis
  let synthesis: string | null = null;
  if (opts.model) {
    synthesis = await requestModelSynthesis(opts.question, cites, opts.model);
    if (synthesis === null) {
      console.error(
        pc.yellow(
          `Note: model synthesis unavailable (model=${opts.model}) — falling back to citation list.`,
        ),
      );
    }
  }

  // 3. Render
  if (opts.json) {
    const payload = {
      question: opts.question,
      model: opts.model ?? null,
      synthesis,
      citations: cites.map((c) => ({ key: c.key, kind: c.kind, hit: c.hit })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (synthesis) {
    console.log('');
    console.log(pc.bold(`Q: ${opts.question}`));
    console.log('');
    console.log(synthesis);
    console.log('');
    console.log(pc.bold('Citations:'));
    for (const cite of cites) {
      const title = cite.hit.title ?? cite.hit.subtitle ?? shortExcerpt(cite.hit.text ?? cite.hit.prompt_text ?? '');
      console.log(`  ${pc.cyan(`[${cite.key}]`)} ${title}`);
    }
    console.log('');
    return;
  }

  console.log(renderText(opts.question, cites));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureInstalledOrExit(): void {
  if (!isPluginInstalled()) {
    // Even without the marketplace plugin, the user may have a running
    // standalone worker + data dir. Allow `ask` when the data dir exists.
    const dataDir = claudeMemDataDirectory();
    if (existsSync(join(dataDir, 'claude-mem.db'))) return;
    console.error(pc.red('claude-mem is not installed.'));
    console.error(`Run: ${pc.bold('npx claude-mem install')}`);
    process.exit(1);
  }
}

function basename(p: string): string {
  const normalized = p.replace(/[\\/]+$/, '');
  const idx = Math.max(
    normalized.lastIndexOf('/'),
    normalized.lastIndexOf('\\'),
  );
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}
