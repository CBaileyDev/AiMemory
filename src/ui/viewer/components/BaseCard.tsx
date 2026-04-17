import React, { useCallback, useRef } from 'react';
import { Row } from './primitives';
import { SourceDot } from './primitives/SourceDot';
import { formatDate } from '../utils/formatters';

export interface BaseCardProps {
  id: number | string;
  idPrefix?: string;
  source: string | null | undefined;
  project: string;
  type?: string;
  typeBadge?: React.ReactNode;
  createdAtEpoch: number;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  pulseOnMount?: boolean;
  elementRef?: React.Ref<HTMLElement>;
  role?: string;
  ariaLabel?: string;
  onCopyCiteKey?: () => void;
  accent?: 'neutral' | 'summary' | 'prompt';
}

/**
 * Shared card shell consumed by ObservationCard, SummaryCard, PromptCard.
 * Owns: source dot, id chip (copyable), project, type, timestamp, footer.
 * Children render below title+subtitle.
 */
export function BaseCard({
  id,
  idPrefix = 'obs',
  source,
  project,
  type,
  typeBadge,
  createdAtEpoch,
  title,
  subtitle,
  children,
  footer,
  pulseOnMount = false,
  elementRef,
  role = 'article',
  ariaLabel,
  onCopyCiteKey,
  accent = 'neutral'
}: BaseCardProps) {
  const date = formatDate(createdAtEpoch);
  const dateIso = new Date(createdAtEpoch).toISOString();
  const citeKey = `${idPrefix}#${id}`;
  const copiedRef = useRef<HTMLSpanElement>(null);

  const copyCite = useCallback(() => {
    try {
      navigator.clipboard?.writeText(citeKey);
      onCopyCiteKey?.();
      const el = copiedRef.current;
      if (el) {
        el.setAttribute('data-copied', 'true');
        window.setTimeout(() => el?.removeAttribute('data-copied'), 900);
      }
    } catch {
      /* clipboard unavailable; no-op */
    }
  }, [citeKey, onCopyCiteKey]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      copyCite();
    }
    if (e.key.toLowerCase() === 'y') {
      copyCite();
    }
  }, [copyCite]);

  return (
    <article
      ref={elementRef as React.Ref<HTMLElement>}
      className={`am-card am-card--${accent} ${pulseOnMount ? 'am-card--fresh' : ''}`}
      role={role}
      aria-label={ariaLabel ?? `${citeKey} in ${project}`}
      tabIndex={0}
      data-id={String(id)}
      onKeyDown={onKeyDown}
    >
      <Row justify="space-between" align="center" style={{ width: '100%', gap: 'var(--space-3)' }}>
        <Row gap="2" align="center" wrap style={{ minWidth: 0, flex: 1 }}>
          <SourceDot source={source} size={8} title={source ?? undefined} />
          <span className="am-card__source">{source || 'unknown'}</span>
          <span className="am-card__sep">/</span>
          <span className="am-card__project" title={project}>{project}</span>
          {type && (
            <>
              <span className="am-card__sep">/</span>
              {typeBadge ?? <span className="am-card__type">{type}</span>}
            </>
          )}
          <span className="am-card__sep">•</span>
          <time className="am-card__time" dateTime={dateIso} title={dateIso}>{date}</time>
        </Row>
        <button
          type="button"
          className="am-card__id"
          onClick={copyCite}
          title={`Copy ${citeKey}`}
          aria-label={`Copy cite key ${citeKey}`}
        >
          <span ref={copiedRef} className="am-card__id-text">{citeKey}</span>
        </button>
      </Row>

      {title && <h3 className="am-card__title">{title}</h3>}
      {subtitle && <p className="am-card__subtitle">{subtitle}</p>}

      {children && <div className="am-card__body">{children}</div>}

      {footer && <div className="am-card__footer">{footer}</div>}
    </article>
  );
}
