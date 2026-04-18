import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SettingsField } from './SettingsField';
import { SECTION_PRIVACY, sectionFields } from '../../state/settingsSchema';
import type { ValidationIssue } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';
import { Panel } from '../primitives/Panel';
import { Row } from '../primitives/Row';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';

interface Props {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  issues: ValidationIssue[];
}

export function SectionPrivacy({ values, onChange, issues }: Props) {
  const issueByKey = new Map(issues.map(i => [i.key, i]));
  const fields = sectionFields(SECTION_PRIVACY);

  const [confirmText, setConfirmText] = React.useState('');
  const [deleteStatus, setDeleteStatus] = React.useState<string>('');

  const handleClearPendingQueue = async () => {
    setDeleteStatus('Clearing pending queue…');
    try {
      const res = await fetch('/api/pending-queue/all', { method: 'DELETE' });
      if (res.ok) {
        setDeleteStatus('Pending queue cleared.');
      } else {
        setDeleteStatus('Failed to clear pending queue.');
      }
    } catch (e) {
      setDeleteStatus(`Error: ${(e as Error).message}`);
    }
    setTimeout(() => setDeleteStatus(''), 4000);
  };

  return (
    <SettingsSection id={SECTION_PRIVACY.id} title={SECTION_PRIVACY.title} description={SECTION_PRIVACY.description}>
      <Stack gap="4">
        <Panel elevation={0} padding="4" radius="md">
          <Stack gap="2">
            <Row gap="2" align="center">
              <Badge tone="success">always on</Badge>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                &lt;private&gt;…&lt;/private&gt; tag stripping
              </strong>
            </Row>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                lineHeight: 1.55
              }}
            >
              Content inside <code>&lt;private&gt;…&lt;/private&gt;</code> tags is stripped
              at the hook layer before any data reaches the worker or database. This guarantee
              cannot be disabled. Source: <code>src/utils/tag-stripping.ts</code>.
            </p>
          </Stack>
        </Panel>

        <Stack gap="3">
          {fields.map(f => (
            <SettingsField
              key={f.id}
              field={f}
              value={values[String(f.key)] ?? ''}
              onChange={v => onChange(String(f.key), v)}
              issue={issueByKey.get(String(f.key)) ?? null}
            />
          ))}
        </Stack>

        <Panel elevation={0} padding="4" radius="md">
          <Stack gap="3">
            <Row gap="2" align="center">
              <Badge tone="warning">destructive</Badge>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                Clear pending ingestion queue
              </strong>
            </Row>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                lineHeight: 1.55
              }}
            >
              Removes every queued message awaiting ingestion. Durable observations already
              stored in SQLite are <strong>not</strong> affected. Type{' '}
              <code>clear</code> below to enable the button.
            </p>
            <Row gap="2" align="center" wrap>
              <input
                id="privacy-clear-confirm"
                type="text"
                value={confirmText}
                placeholder="clear"
                aria-label="Type 'clear' to enable the destructive action"
                onChange={e => setConfirmText(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '160px',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-primary)',
                  background: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)'
                }}
              />
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearPendingQueue}
                disabled={confirmText !== 'clear'}
              >
                Clear queue
              </Button>
            </Row>
            {deleteStatus && (
              <small style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {deleteStatus}
              </small>
            )}
          </Stack>
        </Panel>
      </Stack>
    </SettingsSection>
  );
}
