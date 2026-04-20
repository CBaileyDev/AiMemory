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

function normalizeCardType(type?: string): string | undefined {
  if (!type) return undefined;
  const normalized = type.trim().toLowerCase().replace(/_/g, '-');

  switch (normalized) {
    case 'learned':
    case 'decision':
      return 'learned';
    case 'completed':
    case 'feature':
      return 'completed';
    case 'investigated':
    case 'refactor':
      return 'investigated';
    case 'next-steps':
    case 'discovery':
      return 'next-steps';
    case 'bug':
    case 'bugfix':
      return 'bugfix';
    case 'summary':
    case 'prompt':
      return normalized;
    default:
      return normalized;
  }
}

function formatCardType(type?: string): string | undefined {
  if (!type) return undefined;
  return type.trim().replace(/_/g, '-');
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
  const normalizedType = normalizeCardType(type);
  const normalizedSource = (source ?? 'unknown').trim().toLowerCase();
  const displayType = formatCardType(type);

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
      data-type={normalizedType}
      data-source={normalizedSource}
      onKeyDown={onKeyDown}
    >
      <div className="am-card__head">
        <Row justify="space-between" align="start" wrap className="am-card__meta" style={{ width: '100%', gap: 'var(--space-3)' }}>
          <Row gap="2" align="center" wrap className="am-card__meta-main" style={{ minWidth: 0, flex: 1 }}>
            {type && (typeBadge ?? <span className="am-card__type">{displayType}</span>)}
            <span className="am-card__sourceline">
              <SourceDot source={source} size={6} title={source ?? undefined} />
              <span className="am-card__source">{source || 'unknown'}</span>
            </span>
          </Row>
          <Row gap="2" align="center" wrap className="am-card__actions">
            <time className="am-card__time" dateTime={dateIso} title={dateIso}>{date}</time>
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
        </Row>
      </div>

      {title && <h3 className="am-card__title">{title}</h3>}
      {subtitle && <p className="am-card__subtitle">{subtitle}</p>}
      <p className="am-card__projectline" title={project}>{project}</p>

      {children && <div className="am-card__body">{children}</div>}

      {footer && <div className="am-card__footer">{footer}</div>}
    </article>
  );
}
