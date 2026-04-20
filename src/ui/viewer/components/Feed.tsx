import React, { useEffect, useMemo, useRef } from 'react';
import { Observation, Summary, UserPrompt, FeedItem } from '../types';
import { ObservationCard } from './ObservationCard';
import { SummaryCard } from './SummaryCard';
import { PromptCard } from './PromptCard';
import { ScrollToTop } from './ScrollToTop';
import { UI } from '../constants/ui';

interface FeedProps {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
  highlightedId?: number | null;
  freshIds: Set<number>;
  sourcesDetected: string[];
}

export function Feed({
  observations, summaries, prompts, onLoadMore, isLoading, hasMore,
  highlightedId, freshIds, sourcesDetected
}: FeedProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) onLoadMoreRef.current?.();
      },
      { threshold: UI.LOAD_MORE_THRESHOLD }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // Scroll to + pulse a highlighted observation (from ask panel)
  useEffect(() => {
    if (highlightedId == null) return;
    const node = cardRefs.current.get(highlightedId);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const target = (node.querySelector('.am-card') as HTMLElement | null) ?? node;
    target.classList.add('am-card--fresh');
    const timer = window.setTimeout(() => target.classList.remove('am-card--fresh'), 1200);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  const items = useMemo<FeedItem[]>(() => {
    const combined = [
      ...observations.map(o => ({ ...o, itemType: 'observation' as const })),
      ...summaries.map(s => ({ ...s, itemType: 'summary' as const })),
      ...prompts.map(p => ({ ...p, itemType: 'prompt' as const }))
    ];
    return combined.sort((a, b) => b.created_at_epoch - a.created_at_epoch);
  }, [observations, summaries, prompts]);

  const isTrulyEmpty = items.length === 0 && !isLoading;

  return (
    <div className="am-feed" ref={feedRef}>
      <ScrollToTop targetRef={feedRef} />
      {isTrulyEmpty ? (
        <EmptyState sourcesDetected={sourcesDetected} />
      ) : (
        <div className="am-feed__content">
          {items.map((item, index) => {
            const cardKey = `${item.itemType}-${item.id}`;
            const registerRef = (node: HTMLElement | null) => {
              if (item.itemType === 'observation') {
                if (node) cardRefs.current.set(item.id, node);
                else cardRefs.current.delete(item.id);
              }
            };
            const cardProps = {
              pulseOnMount: item.itemType === 'observation' && freshIds.has(item.id)
            };
            if (item.itemType === 'observation') {
              return (
                <div
                  key={cardKey}
                  ref={registerRef as (el: HTMLDivElement | null) => void}
                  className={`am-feed__item${index < 12 ? ' am-feed__item--intro' : ''}`}
                  style={index < 12 ? { animationDelay: `${index * 30}ms` } : undefined}
                >
                  <ObservationCard observation={item} {...cardProps} />
                </div>
              );
            }
            if (item.itemType === 'summary') {
              return (
                <div
                  key={cardKey}
                  className={`am-feed__item${index < 12 ? ' am-feed__item--intro' : ''}`}
                  style={index < 12 ? { animationDelay: `${index * 30}ms` } : undefined}
                >
                  <SummaryCard summary={item} />
                </div>
              );
            }
            return (
              <div
                key={cardKey}
                className={`am-feed__item${index < 12 ? ' am-feed__item--intro' : ''}`}
                style={index < 12 ? { animationDelay: `${index * 30}ms` } : undefined}
              >
                <PromptCard prompt={item} />
              </div>
            );
          })}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
              <div className="spinner" style={{ display: 'inline-block', marginRight: 'var(--space-2)' }}></div>
              Loading more…
            </div>
          )}
          {hasMore && !isLoading && items.length > 0 && (
            <div ref={loadMoreRef} style={{ height: '20px', margin: 'var(--space-2) 0' }} />
          )}
          {!hasMore && items.length > 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              End of feed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ sourcesDetected }: { sourcesDetected: string[] }) {
  return (
    <div className="am-empty">
      <div className="am-empty__headline">No memories yet</div>
      <p className="am-empty__sub">
        Start a session in any supported tool. Memories will appear here live.
      </p>
      {sourcesDetected.length > 0 && (
        <div className="am-empty__sources">
          {sourcesDetected.map(s => (
            <span key={s} className="am-empty__source">
              <span className="source-dot" data-source={s} /> {s}
            </span>
          ))}
        </div>
      )}
      <a
        href="https://docs.claude-mem.ai"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-sm)' }}
      >
        Read the setup guide →
      </a>
    </div>
  );
}
