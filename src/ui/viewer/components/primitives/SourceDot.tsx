import React from 'react';

interface SourceDotProps {
  source: string | null | undefined;
  size?: number;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * Colored dot per Phase 0 source hue palette. Consumes --source-* tokens
 * via the .source-dot[data-source="..."] rules in tokens.css.
 */
export function SourceDot({ source, size = 8, title, style }: SourceDotProps) {
  const src = source || 'default';
  return (
    <span
      className="source-dot"
      data-source={src}
      aria-hidden={!title}
      title={title ?? src}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style
      }}
    />
  );
}
