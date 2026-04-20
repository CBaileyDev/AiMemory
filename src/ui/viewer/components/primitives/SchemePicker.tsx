import React, { useCallback, useMemo, useRef } from 'react';
import type { NeonScheme } from '../../hooks/useTheme';

interface SchemeOption {
  id: NeonScheme;
  color: string;
  label: string;
}

interface SchemePickerProps {
  scheme: NeonScheme;
  onSchemeChange: (scheme: NeonScheme) => void;
  className?: string;
  label?: string;
}

export const NEON_SCHEME_OPTIONS: SchemeOption[] = [
  { id: 'cyan', color: '#22d3ee', label: 'Cyan Pulse' },
  { id: 'violet', color: '#c4b5fd', label: 'Violet Storm' },
  { id: 'neon-matrix', color: '#4ade80', label: 'Neon Matrix' }
];

export function SchemePicker({
  scheme,
  onSchemeChange,
  className,
  label = 'Accent scheme'
}: SchemePickerProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = useMemo(
    () => NEON_SCHEME_OPTIONS.findIndex((option) => option.id === scheme),
    [scheme]
  );

  const moveFocus = useCallback((nextIndex: number) => {
    const option = NEON_SCHEME_OPTIONS[nextIndex];
    optionRefs.current[nextIndex]?.focus();
    onSchemeChange(option.id);
  }, [onSchemeChange]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (activeIndex === -1) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus((activeIndex + 1) % NEON_SCHEME_OPTIONS.length);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus((activeIndex - 1 + NEON_SCHEME_OPTIONS.length) % NEON_SCHEME_OPTIONS.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveFocus(NEON_SCHEME_OPTIONS.length - 1);
    }
  }, [activeIndex, moveFocus]);

  return (
    <div
      className={className ? `am-scheme-picker ${className}` : 'am-scheme-picker'}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {NEON_SCHEME_OPTIONS.map((option, index) => {
        const isActive = option.id === scheme;
        return (
          <button
            key={option.id}
            ref={(node) => { optionRefs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            className={`am-scheme-picker__option${isActive ? ' is-active' : ''}`}
            data-scheme={option.id}
            tabIndex={isActive ? 0 : -1}
            title={option.label}
            onClick={() => onSchemeChange(option.id)}
            style={{ '--scheme-color': option.color } as React.CSSProperties}
          >
            <span className="am-scheme-picker__swatch" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
