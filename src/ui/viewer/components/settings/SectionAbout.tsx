import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SECTION_ABOUT } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';
import { Row } from '../primitives/Row';
import { Panel } from '../primitives/Panel';
import { Badge } from '../primitives/Badge';

interface Health {
  worker?: { uptime?: number; activeSessions?: number; sseClients?: number };
  database?: { path?: string; size?: number };
  queue?: { depth?: number };
}

function formatBytes(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SectionAbout() {
  const [health, setHealth] = React.useState<Health | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard/health');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Health;
        if (!cancelled) setHealth(data);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    }
    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <SettingsSection id={SECTION_ABOUT.id} title={SECTION_ABOUT.title} description={SECTION_ABOUT.description}>
      <Stack gap="3">
        <Panel elevation={0} padding="3" radius="md">
          <Stack gap="2">
            <Row gap="2" align="center">
              <Badge tone={err ? 'error' : 'success'}>{err ? 'offline' : 'online'}</Badge>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                Worker
              </strong>
            </Row>
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                columnGap: 'var(--space-4)',
                rowGap: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)'
              }}
            >
              <dt style={{ color: 'var(--color-text-muted)' }}>Uptime</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                {formatUptime(health?.worker?.uptime)}
              </dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Active sessions</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                {health?.worker?.activeSessions ?? '—'}
              </dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>SSE clients</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                {health?.worker?.sseClients ?? '—'}
              </dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Queue depth</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                {health?.queue?.depth ?? '—'}
              </dd>
            </dl>
          </Stack>
        </Panel>

        <Panel elevation={0} padding="3" radius="md">
          <Stack gap="2">
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              Database
            </strong>
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                columnGap: 'var(--space-4)',
                rowGap: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)'
              }}
            >
              <dt style={{ color: 'var(--color-text-muted)' }}>Path</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                {health?.database?.path ?? '—'}
              </dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Size</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
                {formatBytes(health?.database?.size)}
              </dd>
            </dl>
          </Stack>
        </Panel>

        <Panel elevation={0} padding="3" radius="md">
          <Stack gap="2">
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              Verification
            </strong>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.55 }}>
              Run <code>npm run check</code> in the project root to exercise typecheck, unit,
              integration, e2e, and dist-shape gates. Run{' '}
              <code>node scripts/verification-matrix.js</code> to see the 15/15 integration matrix.
            </p>
          </Stack>
        </Panel>

        <Panel elevation={0} padding="3" radius="md">
          <Stack gap="2">
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              Documentation
            </strong>
            <Row gap="2" wrap>
              <a
                href="https://docs.claude-mem.ai"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-primary)' }}
              >
                docs.claude-mem.ai ↗
              </a>
              <a
                href="https://github.com/CBaileyDev/AiMemory"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-primary)' }}
              >
                Source on GitHub ↗
              </a>
            </Row>
          </Stack>
        </Panel>
      </Stack>
    </SettingsSection>
  );
}
