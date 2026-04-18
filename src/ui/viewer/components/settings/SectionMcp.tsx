import React from 'react';
import { SettingsSection } from './SettingsSection';
import { SECTION_MCP, SOURCE_LABELS } from '../../state/settingsSchema';
import { Stack } from '../primitives/Stack';
import { Row } from '../primitives/Row';
import { Panel } from '../primitives/Panel';
import { Badge } from '../primitives/Badge';

interface McpStatus {
  enabled?: boolean;
  tools?: string[];
  ides?: string[];
  // other fields ignored on the client
}

export function SectionMcp() {
  const [status, setStatus] = React.useState<McpStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/mcp/status');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as McpStatus;
      setStatus(data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async () => {
    setToggleBusy(true);
    try {
      const res = await fetch('/api/mcp/toggle', { method: 'POST' });
      if (res.ok) {
        await refresh();
      } else {
        setErr(`Toggle failed: ${res.status}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setToggleBusy(false);
    }
  };

  const enabled = status?.enabled !== false;
  const ides = Array.isArray(status?.ides) ? status!.ides! : [];
  const tools = Array.isArray(status?.tools) && status!.tools!.length > 0
    ? status!.tools!
    : ['claude_mem_search', 'claude_mem_timeline', 'claude_mem_ask'];

  return (
    <SettingsSection id={SECTION_MCP.id} title={SECTION_MCP.title} description={SECTION_MCP.description}>
      <Stack gap="3">
        <Panel elevation={0} padding="3" radius="md">
          <Row gap="3" align="center" justify="space-between" wrap>
            <Row gap="2" align="center">
              <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'enabled' : 'disabled'}</Badge>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                MCP server
              </strong>
              {loading && <small style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Loading…</small>}
              {err && (
                <small style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-error)' }}>Error: {err}</small>
              )}
            </Row>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Toggle MCP server"
              onClick={handleToggle}
              disabled={toggleBusy}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                width: '40px',
                height: '22px',
                padding: '2px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border-primary)',
                background: enabled ? 'var(--accent-primary)' : 'var(--color-bg-secondary)',
                cursor: toggleBusy ? 'progress' : 'pointer',
                transition: `background var(--motion-ui) var(--ease-out)`
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--color-bg-card)',
                  boxShadow: 'var(--elev-1)',
                  transform: enabled ? 'translateX(18px)' : 'translateX(0)',
                  transition: `transform var(--motion-ui) var(--ease-out)`
                }}
              />
            </button>
          </Row>
        </Panel>

        <Panel elevation={0} padding="3" radius="md">
          <Stack gap="2">
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              Exposed tools
            </strong>
            <Row gap="2" wrap>
              {tools.map(t => (
                <Badge key={t} tone="accent" mono>
                  {t}
                </Badge>
              ))}
            </Row>
            <small style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Tools are advertised to every IDE that references the claude-mem MCP server in its
              config. To change per-tool exposure, edit <code>plugin/scripts/mcp-server.cjs</code>.
            </small>
          </Stack>
        </Panel>

        <Panel elevation={0} padding="3" radius="md">
          <Stack gap="2">
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              IDEs referencing MCP
            </strong>
            {ides.length === 0 ? (
              <small style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                No IDE configs currently reference the claude-mem MCP server. Run{' '}
                <code>npx claude-mem install --ide &lt;id&gt;</code> to add one.
              </small>
            ) : (
              <Row gap="2" wrap>
                {ides.map(id => (
                  <Badge key={id} tone="info">
                    {SOURCE_LABELS[id] ?? id}
                  </Badge>
                ))}
              </Row>
            )}
          </Stack>
        </Panel>
      </Stack>
    </SettingsSection>
  );
}
