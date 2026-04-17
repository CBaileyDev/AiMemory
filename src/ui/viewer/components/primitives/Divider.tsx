import React from 'react';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  style?: React.CSSProperties;
}

export function Divider({ orientation = 'horizontal', style }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      style={{
        background: 'var(--color-border-primary)',
        ...(orientation === 'horizontal'
          ? { height: '1px', width: '100%' }
          : { width: '1px', alignSelf: 'stretch' }),
        ...style
      }}
    />
  );
}
