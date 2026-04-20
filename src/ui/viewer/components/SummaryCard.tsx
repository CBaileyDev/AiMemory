import React, { memo } from 'react';
import { Summary } from '../types';
import { BaseCard } from './BaseCard';
import { Badge } from './primitives';

interface SummaryCardProps {
  summary: Summary;
  pulseOnMount?: boolean;
}

const SECTIONS: Array<{
  key: keyof Summary;
  label: string;
  icon: string;
}> = [
  { key: 'investigated', label: 'Investigated', icon: '/icon-thick-investigated.svg' },
  { key: 'learned',      label: 'Learned',      icon: '/icon-thick-learned.svg' },
  { key: 'completed',    label: 'Completed',    icon: '/icon-thick-completed.svg' },
  { key: 'next_steps',   label: 'Next Steps',   icon: '/icon-thick-next-steps.svg' }
];

function SummaryCardImpl({ summary, pulseOnMount }: SummaryCardProps) {
  const active = SECTIONS.filter((s) => summary[s.key]);

  return (
    <BaseCard
      id={summary.id}
      idPrefix="session"
      source={summary.platform_source}
      project={summary.project}
      type="summary"
      typeBadge={<Badge tone="warning" caps>session</Badge>}
      createdAtEpoch={summary.created_at_epoch}
      title={summary.request || 'Session Summary'}
      accent="summary"
      pulseOnMount={pulseOnMount}
    >
      {active.length > 0 && (
        <div className="am-summary-sections">
          {active.map((section) => (
            <section key={String(section.key)} className="am-summary-section">
              <header className="am-summary-section__head">
                <img
                  src={section.icon}
                  alt=""
                  className={`am-summary-section__icon am-summary-section__icon--${String(section.key)}`}
                />
                <h4 className="am-summary-section__label">{section.label}</h4>
              </header>
              <div className="am-summary-section__body">{String(summary[section.key] ?? '')}</div>
            </section>
          ))}
        </div>
      )}
    </BaseCard>
  );
}

export const SummaryCard = memo(SummaryCardImpl, (prev, next) =>
  prev.summary.id === next.summary.id &&
  prev.pulseOnMount === next.pulseOnMount
);
