/**
 * Single source of truth for the sectioned Settings page. Declares each
 * settings section, the fields it contains, their input types, validation
 * ranges, default values, and inline hints. Drives both rendering and
 * client-side validation in `components/settings/SettingsPage.tsx`.
 *
 * Keep this schema purely declarative — no JSX, no side effects, no hooks.
 * Rendering lives in `components/settings/`.
 */

import type { Settings } from '../types';

/** Boolean-ish settings are stored as 'true' | 'false' strings on disk. */
export type BooleanString = 'true' | 'false';

export type FieldKind = 'text' | 'password' | 'number' | 'select' | 'toggle' | 'textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export interface NumberFieldConstraints {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

/**
 * A single field's descriptor.
 *
 * Fields map 1:1 to a key in `Settings`. The renderer reads the current
 * value from `formState[key]`, applies the control type, and commits
 * updates through a single `onChange(key, value)` callback.
 */
export interface SettingsField {
  id: string;                              // unique id in the DOM
  key: keyof Settings | string;            // settings key (string to allow keys not yet in Settings type)
  label: string;                           // <label>
  hint?: string;                           // inline help text (never a tooltip)
  kind: FieldKind;
  number?: NumberFieldConstraints;
  options?: SelectOption[];                // for kind: 'select'
  placeholder?: string;                    // for kind: 'text'|'password'|'number'|'textarea'
  multiline?: { rows: number };            // for kind: 'textarea'
  /** Fallback value used when the settings file has no value for `key`. */
  defaultValue?: string;
  /** When present, field is only shown if `formState[key] === value` holds for another key. */
  visibleWhen?: { key: keyof Settings | string; equals: string };
  /** When present, field is only shown if any of the values match. */
  visibleWhenIn?: { key: keyof Settings | string; in: string[] };
}

export interface SettingsSectionDef {
  id: string;                              // URL fragment id (e.g. 'general')
  title: string;                           // <h2>
  description?: string;                    // <p> under the title
  /** Optional group header for a run of fields inside the section. */
  groups?: Array<{
    id: string;
    title?: string;
    description?: string;
    fields: SettingsField[];
  }>;
  /** Fields that do not belong to any group (rendered at the top of the section). */
  fields?: SettingsField[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shared constraints for numeric ranges that match SettingsDefaultsManager. */
const OBSERVATIONS_RANGE: NumberFieldConstraints = { min: 1, max: 200, step: 1, unit: 'obs' };
const SESSIONS_RANGE: NumberFieldConstraints = { min: 1, max: 50, step: 1, unit: 'sessions' };
const FULL_COUNT_RANGE: NumberFieldConstraints = { min: 0, max: 20, step: 1 };
const PORT_RANGE: NumberFieldConstraints = { min: 1024, max: 65535, step: 1 };
const SEMANTIC_LIMIT_RANGE: NumberFieldConstraints = { min: 1, max: 20, step: 1, unit: 'obs' };
const SEARCH_HALFLIFE_RANGE: NumberFieldConstraints = { min: 1, max: 365, step: 1, unit: 'days' };
const SEARCH_BOOST_RANGE: NumberFieldConstraints = { min: 0, max: 5, step: 0.1 };
const DEDUPE_RANGE: NumberFieldConstraints = { min: 0.5, max: 0.99, step: 0.01 };

// ---------------------------------------------------------------------------
// Section declarations
// ---------------------------------------------------------------------------

export const SECTION_GENERAL: SettingsSectionDef = {
  id: 'general',
  title: 'General',
  description: 'Theme, worker network, and logging.',
  fields: [
    {
      id: 'general-theme',
      key: '__theme',
      label: 'Theme',
      hint: 'System follows your OS preference. Saves instantly and does not affect the settings file.',
      kind: 'select',
      options: [
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' }
      ]
    },
    {
      id: 'general-worker-port',
      key: 'CLAUDE_MEM_WORKER_PORT',
      label: 'Worker port',
      hint: 'Requires a worker restart to take effect.',
      kind: 'number',
      number: PORT_RANGE
    },
    {
      id: 'general-worker-host',
      key: 'CLAUDE_MEM_WORKER_HOST',
      label: 'Worker host',
      hint: 'Loopback only. Remote hosts are intentionally unsupported.',
      kind: 'text'
    },
    {
      id: 'general-log-level',
      key: 'CLAUDE_MEM_LOG_LEVEL',
      label: 'Log level',
      kind: 'select',
      defaultValue: 'INFO',
      options: [
        { value: 'ERROR', label: 'Error' },
        { value: 'WARN', label: 'Warn' },
        { value: 'INFO', label: 'Info (default)' },
        { value: 'DEBUG', label: 'Debug' }
      ]
    }
  ]
};

export const SECTION_SOURCES: SettingsSectionDef = {
  id: 'sources',
  title: 'Sources',
  description:
    'Per-IDE capture tuning. Adapters read these knobs before emitting observations. Values are stored under the `sources` object in ~/.claude-mem/settings.json.',
  fields: []
};

/** IDE ids that appear on the Sources section. Aligned to --source-* tokens. */
export const SOURCE_IDS: string[] = [
  'claude-code',
  'claude-desktop',
  'codex-cli',
  'codex-vscode',
  'gemini-cli',
  'gemini-vscode',
  'kimi',
  'kimi-code',
  'cursor',
  'windsurf',
  'opencode',
  'openclaw',
  'copilot-cli',
  'antigravity',
  'goose',
  'crush',
  'roo-code',
  'warp'
];

export const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'claude-desktop': 'Claude Desktop',
  'codex-cli': 'Codex CLI',
  'codex-vscode': 'Codex VS Code',
  'gemini-cli': 'Gemini CLI',
  'gemini-vscode': 'Gemini VS Code',
  'kimi': 'Kimi',
  'kimi-code': 'Kimi Code',
  'cursor': 'Cursor',
  'windsurf': 'Windsurf',
  'opencode': 'OpenCode',
  'openclaw': 'OpenClaw',
  'copilot-cli': 'Copilot CLI',
  'antigravity': 'Antigravity',
  'goose': 'Goose',
  'crush': 'Crush',
  'roo-code': 'Roo Code',
  'warp': 'Warp'
};

export const SECTION_SEARCH: SettingsSectionDef = {
  id: 'search',
  title: 'Search',
  description:
    'Reranker and dedupe controls. Changes apply on the next search without a worker restart.',
  fields: [
    {
      id: 'search-project-boost',
      key: 'CLAUDE_MEM_SEARCH_PROJECT_BOOST',
      label: 'Project boost',
      hint: 'Multiplier applied when a result belongs to the current project. 1.0 = no boost.',
      kind: 'number',
      number: SEARCH_BOOST_RANGE,
      defaultValue: '1.5'
    },
    {
      id: 'search-useful-boost',
      key: 'CLAUDE_MEM_SEARCH_USEFUL_BOOST',
      label: 'Useful boost',
      hint: 'Multiplier for observations a user has marked useful. Phase-in gradually.',
      kind: 'number',
      number: SEARCH_BOOST_RANGE,
      defaultValue: '1.2'
    },
    {
      id: 'search-halflife',
      key: 'CLAUDE_MEM_SEARCH_HALFLIFE_DAYS',
      label: 'Freshness half-life',
      hint: 'Scores decay exponentially; half-life in days.',
      kind: 'number',
      number: SEARCH_HALFLIFE_RANGE,
      defaultValue: '30'
    },
    {
      id: 'search-dedupe',
      key: 'CLAUDE_MEM_SEARCH_DEDUPE_THRESHOLD',
      label: 'Dedupe threshold',
      hint: 'Cosine similarity above this collapses near-duplicate results. 0.5–0.99.',
      kind: 'number',
      number: DEDUPE_RANGE,
      defaultValue: '0.92'
    },
    {
      id: 'search-semantic-inject',
      key: 'CLAUDE_MEM_SEMANTIC_INJECT',
      label: 'Semantic context injection',
      hint: 'Inject the most relevant observations on every UserPromptSubmit. Experimental.',
      kind: 'toggle',
      defaultValue: 'false'
    },
    {
      id: 'search-semantic-limit',
      key: 'CLAUDE_MEM_SEMANTIC_INJECT_LIMIT',
      label: 'Semantic injection limit',
      hint: 'Top-N observations to inject per prompt when semantic injection is on.',
      kind: 'number',
      number: SEMANTIC_LIMIT_RANGE,
      defaultValue: '5',
      visibleWhen: { key: 'CLAUDE_MEM_SEMANTIC_INJECT', equals: 'true' }
    }
  ]
};

export const SECTION_CONTEXT: SettingsSectionDef = {
  id: 'context-injection',
  title: 'Context injection',
  description:
    'Controls the context block rendered on SessionStart. The live preview at the bottom of this section reflects the current form state.',
  groups: [
    {
      id: 'loading',
      title: 'Loading',
      fields: [
        {
          id: 'context-observations',
          key: 'CLAUDE_MEM_CONTEXT_OBSERVATIONS',
          label: 'Observations',
          hint: 'Recent observations to include. 1–200.',
          kind: 'number',
          number: OBSERVATIONS_RANGE
        },
        {
          id: 'context-sessions',
          key: 'CLAUDE_MEM_CONTEXT_SESSION_COUNT',
          label: 'Sessions',
          hint: 'Recent sessions to pull from. 1–50.',
          kind: 'number',
          number: SESSIONS_RANGE
        }
      ]
    },
    {
      id: 'display',
      title: 'Display',
      fields: [
        {
          id: 'context-full-count',
          key: 'CLAUDE_MEM_CONTEXT_FULL_COUNT',
          label: 'Full observations',
          hint: 'How many observations render expanded. 0–20.',
          kind: 'number',
          number: FULL_COUNT_RANGE
        },
        {
          id: 'context-full-field',
          key: 'CLAUDE_MEM_CONTEXT_FULL_FIELD',
          label: 'Expand field',
          kind: 'select',
          options: [
            { value: 'narrative', label: 'Narrative' },
            { value: 'facts', label: 'Facts' }
          ]
        }
      ]
    },
    {
      id: 'feature-toggles',
      title: 'Feature toggles',
      fields: [
        {
          id: 'context-last-summary',
          key: 'CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY',
          label: "Include previous session's summary",
          kind: 'toggle'
        },
        {
          id: 'context-last-message',
          key: 'CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE',
          label: "Include previous session's final message",
          kind: 'toggle'
        }
      ]
    },
    {
      id: 'token-economics',
      title: 'Token economics',
      description: 'Columns shown in context tables.',
      fields: [
        { id: 'context-show-read', key: 'CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS', label: 'Read cost', kind: 'toggle' },
        { id: 'context-show-work', key: 'CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS', label: 'Work investment', kind: 'toggle' },
        { id: 'context-show-savings-abs', key: 'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT', label: 'Savings amount', kind: 'toggle' },
        { id: 'context-show-savings-pct', key: 'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT', label: 'Savings percent', kind: 'toggle' }
      ]
    },
    {
      id: 'providers',
      title: 'AI provider',
      description:
        'Synthesis model for summaries. Observation ingestion does not require a paid provider.',
      fields: [
        {
          id: 'context-provider',
          key: 'CLAUDE_MEM_PROVIDER',
          label: 'Provider',
          kind: 'select',
          options: [
            { value: 'claude', label: 'Claude (uses your Claude account)' },
            { value: 'gemini', label: 'Gemini (requires API key)' },
            { value: 'openrouter', label: 'OpenRouter (multi-model)' }
          ]
        },
        {
          id: 'context-claude-model',
          key: 'CLAUDE_MEM_MODEL',
          label: 'Claude model',
          kind: 'select',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'claude' },
          options: [
            { value: 'haiku', label: 'haiku (fastest)' },
            { value: 'sonnet', label: 'sonnet (balanced)' },
            { value: 'opus', label: 'opus (highest quality)' }
          ]
        },
        {
          id: 'context-gemini-key',
          key: 'CLAUDE_MEM_GEMINI_API_KEY',
          label: 'Gemini API key',
          kind: 'password',
          placeholder: 'Enter key or set GEMINI_API_KEY env var',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'gemini' }
        },
        {
          id: 'context-gemini-model',
          key: 'CLAUDE_MEM_GEMINI_MODEL',
          label: 'Gemini model',
          kind: 'select',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'gemini' },
          options: [
            { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (10 RPM free)' },
            { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (5 RPM free)' },
            { value: 'gemini-3-flash-preview', label: 'gemini-3-flash-preview (5 RPM free)' }
          ]
        },
        {
          id: 'context-gemini-rate',
          key: 'CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED',
          label: 'Gemini rate limiting',
          hint: 'On for free tier, off if you have billing (1000+ RPM).',
          kind: 'toggle',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'gemini' }
        },
        {
          id: 'context-openrouter-key',
          key: 'CLAUDE_MEM_OPENROUTER_API_KEY',
          label: 'OpenRouter API key',
          kind: 'password',
          placeholder: 'Enter key or set OPENROUTER_API_KEY env var',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'openrouter' }
        },
        {
          id: 'context-openrouter-model',
          key: 'CLAUDE_MEM_OPENROUTER_MODEL',
          label: 'OpenRouter model',
          kind: 'text',
          placeholder: 'e.g. xiaomi/mimo-v2-flash:free',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'openrouter' }
        },
        {
          id: 'context-openrouter-site',
          key: 'CLAUDE_MEM_OPENROUTER_SITE_URL',
          label: 'OpenRouter site URL (optional)',
          kind: 'text',
          placeholder: 'https://yoursite.com',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'openrouter' }
        },
        {
          id: 'context-openrouter-app',
          key: 'CLAUDE_MEM_OPENROUTER_APP_NAME',
          label: 'OpenRouter app name (optional)',
          kind: 'text',
          placeholder: 'claude-mem',
          visibleWhen: { key: 'CLAUDE_MEM_PROVIDER', equals: 'openrouter' }
        }
      ]
    }
  ]
};

export const SECTION_PRIVACY: SettingsSectionDef = {
  id: 'privacy',
  title: 'Privacy',
  description:
    '<private>…</private> stripping runs at the hook layer before data reaches the worker or database. That guarantee is always on and not configurable.',
  fields: [
    {
      id: 'privacy-excluded-projects',
      key: 'CLAUDE_MEM_EXCLUDED_PROJECTS',
      label: 'Excluded projects',
      hint:
        'Comma-separated glob patterns for project paths that should never be captured. Example: **/secret-*,**/private/**',
      kind: 'text',
      placeholder: '**/private/**'
    },
    {
      id: 'privacy-folder-md-exclude',
      key: 'CLAUDE_MEM_FOLDER_MD_EXCLUDE',
      label: 'Folder CLAUDE.md excludes',
      hint: 'JSON array of folder paths to skip when generating CLAUDE.md.',
      kind: 'textarea',
      multiline: { rows: 3 },
      placeholder: '[]'
    }
  ]
};

export const SECTION_MCP: SettingsSectionDef = {
  id: 'mcp',
  title: 'MCP',
  description:
    'Claude-mem ships an MCP server (`plugin/scripts/mcp-server.cjs`) that exposes memory to IDE agents. Toggle it here; the change takes effect on next agent reconnect.',
  fields: []
};

export const SECTION_ABOUT: SettingsSectionDef = {
  id: 'about',
  title: 'About',
  description: 'Worker, database, and build information.',
  fields: []
};

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  SECTION_GENERAL,
  SECTION_SOURCES,
  SECTION_SEARCH,
  SECTION_CONTEXT,
  SECTION_PRIVACY,
  SECTION_MCP,
  SECTION_ABOUT
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  fieldId: string;
  key: string;
  message: string;
}

export function validateField(field: SettingsField, raw: unknown): ValidationIssue | null {
  const value = raw == null ? '' : String(raw);

  if (field.kind === 'number') {
    if (value === '') {
      return { fieldId: field.id, key: String(field.key), message: 'Required.' };
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return { fieldId: field.id, key: String(field.key), message: 'Must be a number.' };
    }
    const { min, max } = field.number ?? {};
    if (min !== undefined && n < min) {
      return { fieldId: field.id, key: String(field.key), message: `Must be ≥ ${min}.` };
    }
    if (max !== undefined && n > max) {
      return { fieldId: field.id, key: String(field.key), message: `Must be ≤ ${max}.` };
    }
  }

  if (field.kind === 'toggle') {
    if (value !== 'true' && value !== 'false') {
      return {
        fieldId: field.id,
        key: String(field.key),
        message: 'Must be true or false.'
      };
    }
  }

  if (field.kind === 'select' && field.options) {
    if (value && !field.options.some(o => o.value === value)) {
      return {
        fieldId: field.id,
        key: String(field.key),
        message: `Must be one of ${field.options.map(o => o.value).join(', ')}.`
      };
    }
  }

  // textarea special-case: CLAUDE_MEM_FOLDER_MD_EXCLUDE must parse as JSON array.
  if (field.key === 'CLAUDE_MEM_FOLDER_MD_EXCLUDE' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return { fieldId: field.id, key: String(field.key), message: 'Must be a JSON array.' };
      }
    } catch {
      return { fieldId: field.id, key: String(field.key), message: 'Must be valid JSON.' };
    }
  }

  return null;
}

export function validateAll(
  fields: SettingsField[],
  formState: Record<string, unknown>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    // Respect visibility — do not validate hidden fields
    if (field.visibleWhen) {
      const depVal = String(formState[String(field.visibleWhen.key)] ?? '');
      if (depVal !== field.visibleWhen.equals) continue;
    }
    if (field.visibleWhenIn) {
      const depVal = String(formState[String(field.visibleWhenIn.key)] ?? '');
      if (!field.visibleWhenIn.in.includes(depVal)) continue;
    }
    const issue = validateField(field, formState[String(field.key)]);
    if (issue) issues.push(issue);
  }
  return issues;
}

/** Flatten a section's fields (including groups) for iteration. */
export function sectionFields(section: SettingsSectionDef): SettingsField[] {
  const flat: SettingsField[] = [];
  if (section.fields) flat.push(...section.fields);
  if (section.groups) {
    for (const g of section.groups) flat.push(...g.fields);
  }
  return flat;
}
