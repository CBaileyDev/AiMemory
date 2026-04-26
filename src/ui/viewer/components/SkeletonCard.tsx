import React from 'react';

export function SkeletonCard() {
  return (
    <div className="am-card am-card--skeleton">
      <div className="am-card__head">
        <div className="am-skeleton am-skeleton--meta" />
        <div className="am-skeleton am-skeleton--title" />
        <div className="am-skeleton am-skeleton--subtitle" />
      </div>
      <div className="am-card__body">
        <div className="am-skeleton am-skeleton--line" />
        <div className="am-skeleton am-skeleton--line" style={{ width: '80%' }} />
      </div>
      <style>{`
        .am-card--skeleton {
          pointer-events: none;
          background: rgb(255 255 255 / 1.5%);
          border-color: rgb(255 255 255 / 4%);
          box-shadow: none;
        }
        .am-skeleton {
          background: linear-gradient(
            90deg,
            var(--neutral-300) 25%,
            var(--neutral-400) 50%,
            var(--neutral-300) 75%
          );
          background-size: 200% 100%;
          animation: am-skeleton-shimmer 1.5s infinite;
          border-radius: var(--radius-sm);
        }
        @keyframes am-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .am-skeleton--meta { height: 0.8rem; width: 6rem; margin-bottom: 0.5rem; opacity: 0.3; }
        .am-skeleton--title { height: 1.2rem; width: 14rem; margin-bottom: 0.5rem; }
        .am-skeleton--subtitle { height: 1rem; width: 100%; margin-bottom: 0.5rem; opacity: 0.6; }
        .am-skeleton--line { height: 0.8rem; width: 100%; margin-bottom: 0.4rem; opacity: 0.4; }
      `}</style>
    </div>
  );
}
