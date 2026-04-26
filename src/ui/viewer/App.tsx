import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AskPanel } from './components/AskPanel';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';
import {
  Rail,
  AppHeader,
  StatusBar,
  ConsoleDrawer,
  OfflineBanner,
  NewMemoryToast,
  type ConsoleEvent
} from './components/Shell';
import { CommandPaletteV2 } from './components/CommandPaletteV2';
import { FeedRoute } from './components/FeedRoute';
import { GraphRoute } from './components/GraphRoute';
import { SourcesRoute } from './components/SourcesRoute';
import { SettingsRoute } from './components/SettingsRoute';
import {
  observationToFeedItem,
  summaryToFeedItem,
  promptToFeedItem,
  type FeedItem
} from './components/feedTypes';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { useSourcesDashboard } from './hooks/useSourcesDashboard';
import { useTheme, type NeonScheme } from './hooks/useTheme';
import { useRoute } from './hooks/useRoute';
import { usePagination } from './hooks/usePagination';
import { sourceMeta, normalizeTypeKey } from './components/registry';
import type { Observation, Summary, UserPrompt } from './types';

const FRESH_TTL_MS = 4000;
const MAX_CONSOLE_EVENTS = 200;

function App() {
  const { route, go } = useRoute();
  const { observations, summaries, prompts, sources: detectedSources, isProcessing, queueDepth, isConnected } = useSSE();
  const { settings, saveSettings, isSaving, saveStatus } = useSettings();
  const { scheme, setScheme, cycleScheme } = useTheme();
  const { data: dashboard, refresh: refreshDashboard } = useSourcesDashboard(true);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askInitial, setAskInitial] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());

  const [paginatedObs, setPaginatedObs] = useState<Observation[]>([]);
  const [paginatedSum, setPaginatedSum] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);

  const [consoleLog, setConsoleLog] = useState<ConsoleEvent[]>([]);
  const [toastInfo, setToastInfo] = useState<{
    visible: boolean;
    obsId: number | null;
    source: string | null;
    type: string | null;
    saved: number;
  }>({ visible: false, obsId: null, source: null, type: null, saved: 0 });

  const [workerVersion, setWorkerVersion] = useState<string>('—');

  // Pull /api/stats once for worker version label
  useEffect(() => {
    fetch('/api/stats')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j?.worker?.version) setWorkerVersion(`v${j.worker.version}`);
      })
      .catch(() => {});
  }, []);

  const pagination = usePagination('', 'all');
  const handleLoadMore = useCallback(async () => {
    try {
      const [newObs, newSum, newP] = await Promise.all([
        pagination.observations.loadMore(),
        pagination.summaries.loadMore(),
        pagination.prompts.loadMore()
      ]);
      if (newObs.length) setPaginatedObs(prev => [...prev, ...(newObs as Observation[])]);
      if (newSum.length) setPaginatedSum(prev => [...prev, ...(newSum as Summary[])]);
      if (newP.length) setPaginatedPrompts(prev => [...prev, ...(newP as UserPrompt[])]);
    } catch (err) {
      pushConsole('err', 'paginate', `loadMore failed: ${(err as Error).message}`);
    }
  }, [pagination.observations, pagination.summaries, pagination.prompts]);

  // Initial paginated load on mount
  useEffect(() => {
    handleLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushConsole = useCallback(
    (level: ConsoleEvent['level'], channel: string, message: string) => {
      setConsoleLog(prev => {
        const next = [{ ts: Date.now(), level, channel, message }, ...prev];
        return next.slice(0, MAX_CONSOLE_EVENTS);
      });
    },
    []
  );

  // Track fresh observations from SSE for the ringIn animation + toast
  const prevLiveIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    const current = new Set(observations.map(o => o.id));
    const newlyArrived: Observation[] = [];
    observations.forEach(o => {
      if (!prevLiveIds.current.has(o.id)) newlyArrived.push(o);
    });
    prevLiveIds.current = current;
    if (newlyArrived.length === 0) return;

    setFreshIds(prev => {
      const next = new Set(prev);
      newlyArrived.forEach(o => next.add(o.id));
      return next;
    });

    const latest = newlyArrived[0];
    const item = observationToFeedItem(latest);
    setToastInfo({
      visible: true,
      obsId: latest.id,
      source: sourceMeta(latest.platform_source).name,
      type: normalizeTypeKey(latest.type),
      saved: item.tokens.saved
    });
    pushConsole(
      'ok',
      'ingest',
      `obs#${latest.id} created → ${normalizeTypeKey(latest.type)} · ${
        latest.platform_source || 'claude'
      }`
    );
    refreshDashboard();

    const t1 = window.setTimeout(() => {
      setToastInfo(s => ({ ...s, visible: false }));
    }, 6500);
    const t2 = window.setTimeout(() => {
      setFreshIds(prev => {
        const next = new Set(prev);
        newlyArrived.forEach(o => next.delete(o.id));
        return next;
      });
    }, FRESH_TTL_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [observations, pushConsole, refreshDashboard]);

  // SSE connection state → console
  useEffect(() => {
    pushConsole(
      isConnected ? 'ok' : 'warn',
      'sse',
      isConnected ? 'connected to /sse' : 'connection lost — reconnecting'
    );
  }, [isConnected, pushConsole]);
  useEffect(() => {
    if (!isProcessing) return;
    pushConsole('info', 'worker', `processing queue · depth=${queueDepth}`);
  }, [isProcessing, queueDepth, pushConsole]);

  // Combined feed items, deduped by id+kind, newest first
  const feedItems: FeedItem[] = useMemo(() => {
    const merged = [
      ...mergeUniqueById(observations, paginatedObs).map(observationToFeedItem),
      ...mergeUniqueById(summaries, paginatedSum).map(summaryToFeedItem),
      ...mergeUniqueById(prompts, paginatedPrompts).map(promptToFeedItem)
    ];
    merged.sort((a, b) => b.created_at_epoch - a.created_at_epoch);
    return merged;
  }, [observations, paginatedObs, summaries, paginatedSum, prompts, paginatedPrompts]);

  // Project counts for the rail
  const projectCounts = useMemo(() => {
    const m: Record<string, number> = {};
    feedItems.forEach(it => {
      if (it.project) m[it.project] = (m[it.project] || 0) + 1;
    });
    return m;
  }, [feedItems]);

  const projects = useMemo(() => Object.keys(projectCounts), [projectCounts]);

  // Keyboard shortcuts
  useEffect(() => {
    let gTimer: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      const cmd = e.metaKey || e.ctrlKey;

      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(p => !p);
        return;
      }
      if (cmd && e.key === '\\') {
        e.preventDefault();
        setConsoleOpen(c => !c);
        return;
      }
      if (cmd && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAskInitial(undefined);
        setAskOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setAskOpen(false);
        setHelpOpen(false);
        return;
      }
      if (inField) return;
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          gTimer = null;
        }, 700);
        return;
      }
      if (gTimer) {
        const k = e.key.toLowerCase();
        if (k === 'h') {
          go('feed');
          gTimer = null;
        } else if (k === 'v') {
          go('graph');
          gTimer = null;
        } else if (k === 's') {
          go('sources');
          gTimer = null;
        } else if (k === 'c') {
          go('settings');
          gTimer = null;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [go]);

  // Listeners for header doctor button
  useEffect(() => {
    const onDoctor = () => pushConsole('info', 'doctor', 'doctor invoked from header');
    window.addEventListener('aimemory:doctor', onDoctor);
    return () => window.removeEventListener('aimemory:doctor', onDoctor);
  }, [pushConsole]);

  const onJump = useCallback(
    (id: number) => {
      go('feed');
      setHighlightedId(id);
      window.setTimeout(() => setHighlightedId(null), 1500);
    },
    [go]
  );

  const onAsk = useCallback((q: string) => {
    setAskInitial(q);
    setAskOpen(true);
  }, []);

  const onResync = useCallback(() => {
    refreshDashboard();
    pushConsole('info', 'sync', 'manual resync triggered');
  }, [refreshDashboard, pushConsole]);

  const onDoctor = useCallback(() => {
    pushConsole('info', 'doctor', 'doctor invoked from header');
  }, [pushConsole]);

  const sseSubs = isConnected ? 1 : 0;
  const totalsForSettings = dashboard
    ? {
        total: dashboard.totals.total,
        activeSources: dashboard.totals.activeSources,
        totalSources: dashboard.totals.totalSources
      }
    : null;

  return (
    <div className="app">
      <Rail
        route={route}
        setRoute={go}
        isConnected={isConnected}
        totalMemories={dashboard?.totals.total ?? 0}
        activeSources={dashboard?.totals.activeSources ?? 0}
        totalSources={dashboard?.totals.totalSources ?? 0}
        projects={projects}
        projectCounts={projectCounts}
        workerVersion={workerVersion}
      />

      <AppHeader
        isConnected={isConnected}
        isProcessing={isProcessing}
        consoleOpen={consoleOpen}
        onTogglePalette={() => setPaletteOpen(true)}
        onToggleConsole={() => setConsoleOpen(c => !c)}
        onResync={onResync}
        onDoctor={onDoctor}
      />

      <main className="main">
        <OfflineBanner
          visible={!isConnected}
          onRetry={() => window.location.reload()}
          onOpenConsole={() => setConsoleOpen(true)}
        />

        {route === 'feed' && (
          <FeedRoute
            items={feedItems}
            freshIds={freshIds}
            isConnected={isConnected}
            dashboard={dashboard}
            onLoadMore={handleLoadMore}
            hasMore={
              pagination.observations.hasMore ||
              pagination.summaries.hasMore ||
              pagination.prompts.hasMore
            }
            isLoading={
              pagination.observations.isLoading ||
              pagination.summaries.isLoading ||
              pagination.prompts.isLoading
            }
            highlightedId={highlightedId}
            onJump={(id: number) => {
              setAskInitial(`obs#${id}`);
              setAskOpen(true);
            }}
          />
        )}

        {route === 'graph' && (
          <GraphRoute items={feedItems} isConnected={isConnected} onJump={onJump} />
        )}

        {route === 'sources' && (
          <SourcesRoute
            dashboard={dashboard}
            detectedSources={detectedSources}
            isConnected={isConnected}
          />
        )}

        {route === 'settings' && (
          <SettingsRoute
            settings={settings}
            scheme={scheme}
            onSchemeChange={s => setScheme(s as NeonScheme)}
            onSave={saveSettings}
            saveStatus={mapSaveStatus(saveStatus, isSaving)}
            detectedSources={detectedSources}
            workerVersion={workerVersion}
            totals={totalsForSettings}
          />
        )}

        <ConsoleDrawer
          open={consoleOpen}
          isConnected={isConnected}
          isProcessing={isProcessing}
          queueDepth={queueDepth}
          recentEvents={consoleLog}
        />
      </main>

      <StatusBar
        isConnected={isConnected}
        observationCount={observations.length + paginatedObs.length}
        sseSubs={sseSubs}
        consoleOpen={consoleOpen}
        onToggleConsole={() => setConsoleOpen(c => !c)}
      />

      <CommandPaletteV2
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={r => go(r)}
        onJump={onJump}
        onAsk={onAsk}
        onCycleScheme={cycleScheme}
        onToggleConsole={() => setConsoleOpen(c => !c)}
        items={feedItems}
      />

      <NewMemoryToast
        visible={toastInfo.visible && route === 'feed'}
        obsId={toastInfo.obsId}
        source={toastInfo.source}
        type={toastInfo.type}
        saved={toastInfo.saved}
        onView={() => {
          if (toastInfo.obsId != null) onJump(toastInfo.obsId);
          setToastInfo(s => ({ ...s, visible: false }));
        }}
      />

      <AskPanel
        isOpen={askOpen}
        initialQuestion={askInitial}
        onClose={() => setAskOpen(false)}
        onCiteClick={(id: number) => {
          setAskOpen(false);
          onJump(id);
        }}
      />

      <KeyboardHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function mapSaveStatus(raw: string, isSaving: boolean): 'idle' | 'saving' | 'saved' | 'error' {
  if (isSaving) return 'saving';
  if (raw === 'saved' || raw === 'success') return 'saved';
  if (raw === 'error' || raw === 'failed') return 'error';
  return 'idle';
}

function mergeUniqueById<T extends { id: number }>(a: T[], b: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const x of a) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  for (const x of b) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

export function AppRoot() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

// Re-export App for compatibility
export { App };
