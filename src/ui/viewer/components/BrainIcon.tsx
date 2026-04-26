import React from 'react';

interface BrainIconProps {
  className?: string;
  glow?: boolean;
  thinking?: boolean;
}

/** Solid rounded-square logomark with neural-core glyph (design handoff). */
export function BrainIcon({ className, glow = false }: BrainIconProps) {
  return (
    <svg
      className={`${className} am-brain-icon ${thinking ? 'is-thinking' : ''}`}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={glow ? { filter: 'drop-shadow(0 0 12px currentColor) drop-shadow(0 0 2px currentColor)' } : undefined}
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        fill="currentColor"
        opacity="0.92"
      />
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      <rect
        x="9"
        y="9"
        width="14"
        height="14"
        rx="3"
        stroke="rgba(8,8,12,0.85)"
        strokeWidth="1.6"
        fill="none"
      />
      <circle cx="16" cy="16" r="2.2" fill="rgba(8,8,12,0.85)" />
    </svg>
  );
}
