/**
 * Feed filter reducer. The entire feed's filter state lives here. URL-serializable (see
 * encodeFilterState / decodeFilterState).
 */

export interface FilterState {
  sources: string[];       // empty = all
  types: string[];         // empty = all
  projects: string[];      // empty = all
  query: string;
  since: number | null;    // epoch ms
  until: number | null;    // epoch ms
}

export const initialFilterState: FilterState = {
  sources: [],
  types: [],
  projects: [],
  query: '',
  since: null,
  until: null
};

export type FilterAction =
  | { kind: 'toggleSource'; value: string; exclusive?: boolean }
  | { kind: 'toggleType'; value: string; exclusive?: boolean }
  | { kind: 'toggleProject'; value: string; exclusive?: boolean }
  | { kind: 'setQuery'; value: string }
  | { kind: 'setRange'; since: number | null; until: number | null }
  | { kind: 'removeSource'; value: string }
  | { kind: 'removeType'; value: string }
  | { kind: 'removeProject'; value: string }
  | { kind: 'clearAll' }
  | { kind: 'replace'; value: FilterState };

function toggleIn(list: string[], value: string, exclusive?: boolean): string[] {
  if (exclusive) {
    return list.length === 1 && list[0] === value ? [] : [value];
  }
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

export function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.kind) {
    case 'toggleSource': return { ...state, sources: toggleIn(state.sources, action.value, action.exclusive) };
    case 'toggleType':   return { ...state, types:   toggleIn(state.types, action.value, action.exclusive) };
    case 'toggleProject':return { ...state, projects:toggleIn(state.projects, action.value, action.exclusive) };
    case 'setQuery':     return { ...state, query: action.value };
    case 'setRange':     return { ...state, since: action.since, until: action.until };
    case 'removeSource': return { ...state, sources: state.sources.filter(v => v !== action.value) };
    case 'removeType':   return { ...state, types:   state.types.filter(v => v !== action.value) };
    case 'removeProject':return { ...state, projects:state.projects.filter(v => v !== action.value) };
    case 'clearAll':     return initialFilterState;
    case 'replace':      return action.value;
  }
}

export function isEmpty(state: FilterState): boolean {
  return !state.sources.length && !state.types.length && !state.projects.length
    && !state.query && state.since === null && state.until === null;
}

/* URL helpers — roundtrip via window.location.hash */

export function encodeFilterState(state: FilterState): string {
  const p = new URLSearchParams();
  if (state.sources.length) p.set('src', state.sources.join(','));
  if (state.types.length)   p.set('type', state.types.join(','));
  if (state.projects.length)p.set('proj', state.projects.join(','));
  if (state.query)          p.set('q', state.query);
  if (state.since)          p.set('since', String(state.since));
  if (state.until)          p.set('until', String(state.until));
  return p.toString();
}

export function decodeFilterState(raw: string): FilterState {
  const q = new URLSearchParams(raw);
  const splitList = (v: string | null): string[] =>
    v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
  return {
    sources:  splitList(q.get('src')),
    types:    splitList(q.get('type')),
    projects: splitList(q.get('proj')),
    query:    q.get('q') ?? '',
    since:    q.get('since') ? Number(q.get('since')) : null,
    until:    q.get('until') ? Number(q.get('until')) : null
  };
}

export function matchesFilter(item: {
  platform_source?: string | null;
  project?: string | null;
  type?: string | null;
  created_at_epoch: number;
  title?: string | null;
  narrative?: string | null;
  prompt_text?: string | null;
  request?: string | null;
}, state: FilterState): boolean {
  const src = item.platform_source || 'claude';
  if (state.sources.length && !state.sources.includes(src)) return false;
  if (state.projects.length && !state.projects.includes(item.project || '')) return false;
  if (state.types.length && !state.types.includes(item.type || '')) return false;
  if (state.since !== null && item.created_at_epoch < state.since) return false;
  if (state.until !== null && item.created_at_epoch > state.until) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const corpus = [item.title, item.narrative, item.prompt_text, item.request]
      .filter(Boolean).join(' ').toLowerCase();
    if (!corpus.includes(q)) return false;
  }
  return true;
}
