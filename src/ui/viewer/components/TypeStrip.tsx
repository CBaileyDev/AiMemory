import React from 'react';

interface TypeOption {
  value: string;
  label: string;
}

interface TypeStripProps {
  options: TypeOption[];
  selected: string[];
  onToggle: (value: string, exclusive?: boolean) => void;
  onClear: () => void;
}

export function TypeStrip({ options, selected, onToggle, onClear }: TypeStripProps) {
  const isAll = selected.length === 0;

  return (
    <div className="am-type-rail" role="tablist" aria-label="Filter feed by memory type">
      <button
        type="button"
        role="tab"
        aria-selected={isAll}
        className={`am-type-rail__chip ${isAll ? 'is-active' : ''}`}
        onClick={onClear}
      >
        All
      </button>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`am-type-rail__chip ${active ? 'is-active' : ''}`}
            onClick={(event) => onToggle(option.value, !event.shiftKey)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
