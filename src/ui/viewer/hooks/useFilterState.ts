import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  filterReducer,
  initialFilterState,
  encodeFilterState,
  decodeFilterState,
  FilterState,
  FilterAction
} from '../state/filterReducer';

/**
 * Filter state hook with bidirectional URL roundtrip.
 * Query string lives on window.location.hash after the route fragment:
 *   #sources?src=claude-code,cursor&type=bugfix
 */
function readFromUrl(): FilterState {
  if (typeof window === 'undefined') return initialFilterState;
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return initialFilterState;
  return decodeFilterState(hash.slice(qIdx + 1));
}

function writeToUrl(state: FilterState): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  const routeFragment = qIdx === -1 ? hash : hash.slice(0, qIdx);
  const encoded = encodeFilterState(state);
  const next = encoded ? `${routeFragment}?${encoded}` : routeFragment;
  if (next !== hash) {
    if (next === '') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
    }
  }
}

export function useFilterState(): {
  state: FilterState;
  dispatch: (action: FilterAction) => void;
} {
  const [state, dispatch] = useReducer(filterReducer, undefined as unknown as FilterState, readFromUrl);

  useEffect(() => {
    writeToUrl(state);
  }, [state]);

  useEffect(() => {
    const onHashChange = () => {
      const fromUrl = readFromUrl();
      dispatch({ kind: 'replace', value: fromUrl });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return useMemo(() => ({ state, dispatch }), [state]);
}
