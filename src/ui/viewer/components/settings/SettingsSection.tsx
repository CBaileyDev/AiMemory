import React from 'react';
import { Panel } from '../primitives/Panel';
import { Stack } from '../primitives/Stack';

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Section wrapper used by the Phase 12 Settings page.
 * Renders a `<section>` with an anchor id so the left nav's
 * `<a href="#{id}">` entries scroll into view.
 */
export function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  return (
    <section
      id={`settings-section-${id}`}
      aria-labelledby={`settings-heading-${id}`}
      className="am-settings-section"
      style={{ scrollMarginTop: 'var(--space-9)' }}
    >
      <Panel elevation={1} padding="card-padding">
        <Stack gap="4">
          <header>
            <h2
              id={`settings-heading-${id}`}
              style={{
                margin: 0,
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--color-text-title)',
                lineHeight: 1.25
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                style={{
                  margin: 'var(--space-2) 0 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1.5
                }}
              >
                {description}
              </p>
            )}
          </header>

          <div>{children}</div>
        </Stack>
      </Panel>
    </section>
  );
}

interface SettingsGroupProps {
  id: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Optional subdivision within a section.
 * Renders a labelled group with a muted heading.
 */
export function SettingsGroup({ id, title, description, children }: SettingsGroupProps) {
  return (
    <div
      className="am-settings-group"
      data-group-id={id}
      style={{
        marginTop: 'var(--space-4)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid var(--color-border-primary)'
      }}
    >
      {(title || description) && (
        <header style={{ marginBottom: 'var(--space-3)' }}>
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)'
              }}
            >
              {title}
            </h3>
          )}
          {description && (
            <p
              style={{
                margin: 'var(--space-1) 0 0',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                lineHeight: 1.5
              }}
            >
              {description}
            </p>
          )}
        </header>
      )}
      <Stack gap="3">{children}</Stack>
    </div>
  );
}
