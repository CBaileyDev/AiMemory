import React, { useEffect } from 'react';
import { FilterState, FilterAction, isEmpty } from '../state/filterReducer';
import { Chip } from './primitives/Chip';

interface FilterSummaryProps {
  state: FilterState;
  dispatch: (action: FilterAction) => void;
}

export function FilterSummary({ state, dispatch }: FilterSummaryProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEmpty(state)) {
        dispatch({ kind: 'clearAll' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, dispatch]);

  const hasSecondaryFilters =
    state.sources.length > 0 ||
    state.projects.length > 0 ||
    state.query.length > 0 ||
    state.since !== null ||
    state.until !== null;

  if (isEmpty(state) || !hasSecondaryFilters) return null;

  return (
    <div className="am-filter-summary" role="region" aria-label="Active filters">
      <span className="am-filter-summary__label">Active filters</span>
      {state.sources.map(s => (
        <Chip key={`s:${s}`} active removable onClick={() => dispatch({ kind: 'removeSource', value: s })}
              onRemove={() => dispatch({ kind: 'removeSource', value: s })}>
          {s}
        </Chip>
      ))}
      {state.projects.map(p => (
        <Chip key={`p:${p}`} active removable onClick={() => dispatch({ kind: 'removeProject', value: p })}
              onRemove={() => dispatch({ kind: 'removeProject', value: p })}>
          project:{p}
        </Chip>
      ))}
      {state.query && (
        <Chip active removable
              onClick={() => dispatch({ kind: 'setQuery', value: '' })}
              onRemove={() => dispatch({ kind: 'setQuery', value: '' })}>
          q:{state.query}
        </Chip>
      )}
      <span className="am-filter-summary__hint">Esc clears all</span>
    </div>
  );
}
