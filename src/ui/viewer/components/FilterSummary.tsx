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

  if (isEmpty(state)) return null;

  return (
    <div className="am-filter-summary" role="region" aria-label="Active filters">
      <span>filters:</span>
      {state.sources.map(s => (
        <Chip key={`s:${s}`} active removable onClick={() => dispatch({ kind: 'removeSource', value: s })}
              onRemove={() => dispatch({ kind: 'removeSource', value: s })}>
          {s}
        </Chip>
      ))}
      {state.types.map(t => (
        <Chip key={`t:${t}`} active removable onClick={() => dispatch({ kind: 'removeType', value: t })}
              onRemove={() => dispatch({ kind: 'removeType', value: t })}>
          type:{t}
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
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>press Esc to clear all</span>
    </div>
  );
}
