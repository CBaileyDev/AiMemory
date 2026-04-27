import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SECTION_SOURCES, SOURCE_IDS, SOURCE_LABELS } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';
import { Row } from '../primitives/Row';
import { Panel } from '../primitives/Panel';
import { SourceDot } from '../primitives/SourceDot';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Chip } from '../primitives/Chip';

type SourcesBlock = Record<string, Record<string, unknown>>;

interface Props {
  /**
   * Current sources block parsed from the settings file. Keys are IDE ids,
   * values are per-IDE option maps. Schema:
   *   { "windsurf": { captureFileReads: false, summarizeThreshold: 20 }, ... }
   */
  sources: SourcesBlock;
  onChange: (next: SourcesBlock) => void;
  /** Source ids that have produced at least one observation recently. */
  detectedSourceIds: string[];
}

type ToggleKey = 'captureFileReads' | 'captureAfterTool' | 'captureAfterAgent';

const TOGGLES: Array<{ key: ToggleKey; label: string; hint: string }> = [
  { key: 'captureFileReads', label: 'Capture file reads', hint: 'High-volume; off by default for noisy IDEs.' },
  { key: 'captureAfterTool', label: 'Capture after-tool events', hint: 'Recommended on; main signal stream.' },
  { key: 'captureAfterAgent', label: 'Capture after-agent events', hint: 'Captures model outputs directly.' }
];

export function SectionSources({ sources, onChange, detectedSourceIds }: Props) {
  const detected = new Set(detectedSourceIds);
  const [copyStatus, setCopyStatus] = React.useState<string>('');

  const setPerSource = (id: string, partial: Record<string, unknown>) => {
    const next: SourcesBlock = { ...sources, [id]: { ...(sources[id] ?? {}), ...partial } };
    onChange(next);
  };

  const handleCopyJson = async () => {
    try {
      const blob = JSON.stringify({ sources }, null, 2);
      await navigator.clipboard.writeText(blob);
      setCopyStatus('Copied.');
    } catch {
      setCopyStatus('Copy failed — select manually.');
    }
    setTimeout(() => setCopyStatus(''), 2500);
  };

  return (
    <SettingsSection
      id={SECTION_SOURCES.id}
      title={SECTION_SOURCES.title}
      description={SECTION_SOURCES.description}
    >
      <Stack gap="4">
        <Row gap="3" justify="end" align="center" wrap>
          {copyStatus && (
            <small style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {copyStatus}
            </small>
          )}
          <Button variant="secondary" size="sm" onClick={handleCopyJson}>
            Copy JSON
          </Button>
        </Row>

        <div className="am-source-settings-grid">
          {SOURCE_IDS.map(id => {
            const block = (sources[id] ?? {}) as Record<string, unknown>;
            const enabled = block.enabled !== false;
            const summarizeThreshold = String(block.summarizeThreshold ?? '');
            const isDetected = detected.has(id);

            return (
              <Panel
                key={id}
                elevation={0}
                padding="3"
                radius="md"
                className={`am-source-settings-card ${enabled ? 'is-enabled' : 'is-disabled'} ${isDetected ? 'is-detected' : ''}`.trim()}
              >
                <Stack gap="2">
                  <Row gap="3" align="center" justify="space-between" wrap>
                    <Row gap="2" align="center">
                      <SourceDot source={id} size={10} />
                      <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                        {SOURCE_LABELS[id] ?? id}
                      </strong>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {id}
                      </code>
                      {isDetected && <Badge tone="success">live</Badge>}
                    </Row>

                    <Chip
                      active={enabled}
                      onClick={() => setPerSource(id, { enabled: !enabled })}
                      aria-label={`Toggle ${SOURCE_LABELS[id] ?? id} capture`}
                    >
                      {enabled ? 'capture on' : 'capture off'}
                    </Chip>
                  </Row>

                  {enabled && (
                    <Stack gap="2">
                      <Row className="am-source-toggle-row" gap="2" wrap>
                        {TOGGLES.map(t => {
                          const on = block[t.key] === true;
                          return (
                            <Chip
                              key={t.key}
                              active={on}
                              onClick={() => setPerSource(id, { [t.key]: !on })}
                            >
                              {t.label}
                            </Chip>
                          );
                        })}
                      </Row>

                      <Row className="am-source-threshold-row" gap="2" align="center" wrap>
                        <label
                          htmlFor={`src-${id}-summarize`}
                          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                        >
                          Summarize threshold
                        </label>
                        <input
                          id={`src-${id}-summarize`}
                          type="number"
                          min={0}
                          max={500}
                          step={1}
                          placeholder="unset"
                          value={summarizeThreshold}
                          onChange={e => {
                            const v = e.target.value;
                            const next = { ...block };
                            if (v === '') {
                              delete next.summarizeThreshold;
                            } else {
                              next.summarizeThreshold = Number(v);
                            }
                            onChange({ ...sources, [id]: next });
                          }}
                          style={{
                            width: '100px',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-primary)',
                            background: 'var(--color-bg-input)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--text-xs)'
                          }}
                        />
                      </Row>
                    </Stack>
                  )}
                </Stack>
              </Panel>
            );
          })}
        </div>
      </Stack>
    </SettingsSection>
  );
}
