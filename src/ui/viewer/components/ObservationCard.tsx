import React, { memo, useMemo, useState } from 'react';
import { Observation } from '../types';
import { BaseCard } from './BaseCard';
import { Badge } from './primitives';

interface ObservationCardProps {
  observation: Observation;
  pulseOnMount?: boolean;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const val = JSON.parse(raw);
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

function stripProjectRoot(filePath: string): string {
  const markers = ['/Scripts/', '/src/', '/plugin/', '/docs/'];
  for (const marker of markers) {
    const i = filePath.indexOf(marker);
    if (i !== -1) return filePath.substring(i + 1);
  }
  const projIdx = filePath.indexOf('claude-mem/');
  if (projIdx !== -1) return filePath.substring(projIdx + 'claude-mem/'.length);
  const parts = filePath.split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : filePath;
}

/**
 * ObservationCard — one observation row. 3-line collapsed narrative, expand
 * via button or Enter; `y` copies cite key (handled in BaseCard).
 */
function ObservationCardImpl({ observation, pulseOnMount }: ObservationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { facts, concepts, filesRead, filesModified, hasDetails } = useMemo(() => {
    const f = parseJsonArray(observation.facts);
    const c = parseJsonArray(observation.concepts);
    const r = parseJsonArray(observation.files_read).map(stripProjectRoot);
    const m = parseJsonArray(observation.files_modified).map(stripProjectRoot);
    return {
      facts: f, concepts: c, filesRead: r, filesModified: m,
      hasDetails: f.length + c.length + r.length + m.length > 0
    };
  }, [observation.facts, observation.concepts, observation.files_read, observation.files_modified]);

  const toneForType =
    observation.type === 'bugfix' || observation.type === 'bug' ? 'error' :
    observation.type === 'decision' ? 'accent' :
    observation.type === 'feature' ? 'success' :
    observation.type === 'refactor' ? 'info' :
    observation.type === 'discovery' ? 'warning' :
    'neutral';

  return (
    <BaseCard
      id={observation.id}
      idPrefix="obs"
      source={observation.platform_source}
      project={observation.project}
      type={observation.type || undefined}
      typeBadge={<Badge tone={toneForType}>{observation.type}</Badge>}
      createdAtEpoch={observation.created_at_epoch}
      title={observation.title || 'Untitled'}
      subtitle={!expanded ? observation.subtitle || undefined : undefined}
      pulseOnMount={pulseOnMount}
      accent="neutral"
      footer={
        (concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0) && (
          <div className="am-card__tags">
            {concepts.slice(0, 6).map((c) => (
              <Badge key={c} tone="accent">{c}</Badge>
            ))}
            {filesModified.slice(0, 3).map((f) => (
              <span key={`m:${f}`} className="am-card__file" title={`modified ${f}`}>{f}</span>
            ))}
            {filesRead.slice(0, 2).map((f) => (
              <span key={`r:${f}`} className="am-card__file am-card__file--read" title={`read ${f}`}>{f}</span>
            ))}
          </div>
        )
      }
    >
      {expanded && observation.narrative && (
        <p className="am-card__narrative">{observation.narrative}</p>
      )}
      {expanded && facts.length > 0 && (
        <ul className="am-card__facts">
          {facts.map((fact, i) => <li key={i}>{fact}</li>)}
        </ul>
      )}
      {(observation.narrative || hasDetails) && (
        <button
          type="button"
          className="am-card__toggle"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </BaseCard>
  );
}

export const ObservationCard = memo(ObservationCardImpl, (prev, next) =>
  prev.observation.id === next.observation.id &&
  prev.observation.title === next.observation.title &&
  prev.observation.narrative === next.observation.narrative &&
  prev.pulseOnMount === next.pulseOnMount
);
