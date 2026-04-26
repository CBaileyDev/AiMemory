import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { SettingsPage } from './components/settings/SettingsPage';
import { LogsDrawer } from './components/LogsModal';
import { SourcesDashboard } from './components/SourcesDashboard';
import { CommandPalette, PaletteAction } from './components/CommandPalette';
import { AskPanel } from './components/AskPanel';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';
import { GraphPage } from './components/GraphPage';
import { Sidebar } from './components/Sidebar';
import { RightRail } from './components/RightRail';
import { StatusBar } from './components/StatusBar';
import { MemoryEconomy } from './components/MemoryEconomy';
import { FilterBar } from './components/FilterBar';
import { MemoryCard, MemoryCardItem } from './components/MemoryCard';
import { Inspector } from './components/Inspector';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { usePagination } from './hooks/usePagination';
import { useTheme } from './hooks/useTheme';
import { useRoute } from './hooks/useRoute';
import { useFilterState } from './hooks/useFilterState';
import { useSourcesDashboard } from './hooks/useSourcesDashboard';
import { useStats } from './hooks/useStats';
import { tauri, useTauri } from './hooks/useTauri';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';
import { matchesFilter } from './state/filterReducer';

const APP_VERSION = '12.1.5';
const WORKER_PORT = 37777;
const FRESH_ID_TTL_MS = 4000;

function normalizeFeedType(type?: string | null): string | undefined {
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
    default:
      return normalized;
  }
}

function inferSummaryType(summary: Summary): string {
  if (summary.learned?.trim()) return 'learned';
  if (summary.completed?.trim()) return 'completed';
  if (summary.investigated?.trim()) return 'investigated';
  if (summary.next_steps?.trim()) return 'next-steps';
  return 'completed';
}

function dayBucket(epochMs: number): string {
  const d = new Date(epochMs);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  if (startOfDay.getTime() === today.getTime()) return 'Today';
  if (startOfDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeOfDay(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function parseFileList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // not JSON
  }
  return raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

function obsToCard(o: Observation, fresh: boolean): MemoryCardItem {
  const files = [...parseFileList(o.files_modified), ...parseFileList(o.files_read)];
  return {
    id: o.id,
    type: normalizeFeedType(o.type) ?? 'completed',
    source: o.platform_source ?? 'claude',
    title: o.title ?? 'Observation',
    summary: o.narrative ?? o.text ?? '',
    project: o.project ?? '',
    files: Array.from(new Set(files)).slice(0, 8),
    time: formatTimeOfDay(o.created_at_epoch),
    tokensSaved: 0,
    isFresh: fresh
  };
}

function summaryToCard(s: Summary): MemoryCardItem {
  const text = [s.learned, s.completed, s.investigated, s.next_steps].filter(Boolean).join(' ');
  return {
    id: s.id,
    type: inferSummaryType(s),
    source: s.platform_source ?? 'claude',
    title: s.request ?? 'Session summary',
    summary: text,
    project: s.project ?? '',
    files: [],
    time: formatTimeOfDay(s.created_at_epoch),
    tokensSaved: 0
  };
}

function promptToCard(p: UserPrompt): MemoryCardItem {
  return {
    id: p.id,
    type: 'prompt',
    source: p.platform_source ?? 'claude',
    title: 'Prompt',
    summary: p.prompt_text ?? '',
    project: p.project ?? '',
    files: [],
    time: formatTimeOfDay(p.created_at_epoch),
    tokensSaved: 0
  };
}

export function App() {
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askInitial, setAskInitial] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [selectedMemId, setSelectedMemId] = useState<number | null>(null);

  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);

  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const prevLiveIds = useRef<Set<number>>(new Set());

  useTauri();
  const { route, go } = useRoute();
  const { state: filterState, dispatch: filterDispatch } = useFilterState();
  const { observations, summaries, prompts, sources, isProcessing, queueDepth, isConnected } = useSSE();
  const { settings, saveSettings, isSaving, saveStatus } = useSettings();
  const { scheme, setScheme, cycleScheme } = useTheme();
  const { stats } = useStats();

  const { data: dashboardData } = useSourcesDashboard(true);

  const primaryProject = filterState.projects[0] ?? '';
  const primarySource = filterState.sources[0] ?? 'all';
  const pagination = usePagination(primaryProject, primarySource);

  const matchesObservation = useCallback((item: Observation) => matchesFilter({
    platform_source: item.platform_source,
    project: item.project,
    type: normalizeFeedType(item.type),
    created_at_epoch: item.created_at_epoch,
    title: item.title ?? null,
    narrative: item.narrative ?? null
  }, filterState), [filterState]);

  const matchesSummary = useCallback((item: Summary) => matchesFilter({
    platform_source: item.platform_source,
    project: item.project,
    type: inferSummaryType(item),
    created_at_epoch: item.created_at_epoch,
    request: item.request ?? null,
    narrative: [item.learned, item.completed, item.investigated, item.next_steps].filter(Boolean).join(' ')
  }, filterState), [filterState]);

  const matchesPrompt = useCallback((item: UserPrompt) => matchesFilter({
    platform_source: item.platform_source,
    project: item.project,
    type: 'prompt',
    created_at_epoch: item.created_at_epoch,
    prompt_text: item.prompt_text ?? null
  }, filterState), [filterState]);

  const allObservations = useMemo(() => {
    const live = observations.filter(matchesObservation);
    const paginated = paginatedObservations.filter(matchesObservation);
    return mergeAndDeduplicateByProject(live, paginated);
  }, [observations, paginatedObservations, matchesObservation]);

  const allSummaries = useMemo(() => {
    const live = summaries.filter(matchesSummary);
    const paginated = paginatedSummaries.filter(matchesSummary);
    return mergeAndDeduplicateByProject(live, paginated);
  }, [summaries, paginatedSummaries, matchesSummary]);

  const allPrompts = useMemo(() => {
    const live = prompts.filter(matchesPrompt);
    const paginated = paginatedPrompts.filter(matchesPrompt);
    return mergeAndDeduplicateByProject(live, paginated);
  }, [prompts, paginatedPrompts, matchesPrompt]);

  const graphObservations = useMemo(
    () => mergeAndDeduplicateByProject(observations, paginatedObservations),
    [observations, paginatedObservations]
  );
  const graphSummaries = useMemo(
    () => mergeAndDeduplicateByProject(summaries, paginatedSummaries),
    [summaries, paginatedSummaries]
  );
  const graphPrompts = useMemo(
    () => mergeAndDeduplicateByProject(prompts, paginatedPrompts),
    [prompts, paginatedPrompts]
  );

  useEffect(() => {
    const current = new Set(observations.map(o => o.id));
    const newlyArrived: number[] = [];
    current.forEach(id => { if (!prevLiveIds.current.has(id)) newlyArrived.push(id); });
    prevLiveIds.current = current;
    if (newlyArrived.length === 0) return;
    setFreshIds(prev => {
      const next = new Set(prev);
      newlyArrived.forEach(id => next.add(id));
      return next;
    });
    const timer = window.setTimeout(() => {
      setFreshIds(prev => {
        const next = new Set(prev);
        newlyArrived.forEach(id => next.delete(id));
        return next;
      });
    }, FRESH_ID_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [observations]);

  const projectCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of [...graphObservations, ...graphSummaries, ...graphPrompts]) {
      if (item.project) map.set(item.project, (map.get(item.project) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [graphObservations, graphSummaries, graphPrompts]);

  const totalsSpark = useMemo(() => {
    const buckets = new Array<number>(14).fill(0);
    (dashboardData?.sources ?? []).forEach((row) => {
      const arr = row.sevenDay ?? [];
      arr.forEach((v, i) => {
        const bucketIdx = Math.min(buckets.length - 1, Math.max(0, buckets.length - arr.length + i));
        buckets[bucketIdx] += v;
      });
    });
    return buckets;
  }, [dashboardData]);

  const sourceTotals = useMemo(
    () => (dashboardData?.sources ?? []).map((s) => ({ id: s.id, total: s.total })),
    [dashboardData]
  );

  const handleLoadMore = useCallback(async () => {
    try {
      const [newObs, newSum, newP] = await Promise.all([
        pagination.observations.loadMore(),
        pagination.summaries.loadMore(),
        pagination.prompts.loadMore()
      ]);
      if (newObs.length) setPaginatedObservations(prev => [...prev, ...newObs]);
      if (newSum.length) setPaginatedSummaries(prev => [...prev, ...newSum]);
      if (newP.length) setPaginatedPrompts(prev => [...prev, ...newP]);
    } catch (e) {
      console.error('[App] loadMore failed:', e);
    }
  }, [pagination.observations, pagination.summaries, pagination.prompts]);

  useEffect(() => {
    setPaginatedObservations([]);
    setPaginatedSummaries([]);
    setPaginatedPrompts([]);
    handleLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryProject, primarySource]);

  useEffect(() => {
    let gTimer: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      const isModifierOnly = e.ctrlKey || e.metaKey;
      if (isModifierOnly && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); return; }
      if (isModifierOnly && e.key === '\\') { e.preventDefault(); setLogsModalOpen(v => !v); return; }
      if (isModifierOnly && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAskInitial(undefined);
        setAskOpen(true);
        return;
      }
      if (inField) return;
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); return; }
      if (e.key === 'Escape') { setPaletteOpen(false); setAskOpen(false); setHelpOpen(false); return; }
      if (e.key.toLowerCase() === 'g') {
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => { gTimer = null; }, 700);
        return;
      }
      if (gTimer) {
        const k = e.key.toLowerCase();
        if (k === 'h' || k === 'f') { go('feed'); gTimer = null; }
        else if (k === 's') { go('sources'); gTimer = null; }
        else if (k === 'v' || k === 'g') { go('graph'); gTimer = null; }
        else if (k === 'c' || k === ',') { go('settings'); gTimer = null; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (gTimer) window.clearTimeout(gTimer); };
  }, [go]);

  // Tauri tray + global-shortcut bridge: lets ⌘⇧K / ⌘⇧J / tray menu open the
  // palette and Ask panel even when the window isn't focused.
  useEffect(() => {
    let unlistenPalette: (() => void) | null = null;
    let unlistenAsk: (() => void) | null = null;
    let cancelled = false;
    tauri
      .listen<string>('claude-mem://palette', () => setPaletteOpen(true))
      .then((u) => {
        if (cancelled) u();
        else unlistenPalette = u;
      });
    tauri
      .listen<string>('claude-mem://ask', () => {
        setAskInitial(undefined);
        setAskOpen(true);
      })
      .then((u) => {
        if (cancelled) u();
        else unlistenAsk = u;
      });
    return () => {
      cancelled = true;
      unlistenPalette?.();
      unlistenAsk?.();
    };
  }, []);

  const onAskSubmit = useCallback((question: string) => {
    setAskInitial(question);
    setAskOpen(true);
  }, []);

  const onJumpToObservation = useCallback((id: number) => {
    go('feed');
    setHighlightedId(id);
    setSelectedMemId(id);
    window.setTimeout(() => setHighlightedId(null), 1500);
  }, [go]);

  const paletteActions = useMemo<PaletteAction[]>(() => [
    { id: 'open-feed', label: 'Open feed', shortcut: ['g', 'h'], run: () => go('feed') },
    { id: 'open-graph', label: 'Open memory graph', shortcut: ['g', 'v'], run: () => go('graph') },
    { id: 'open-sources', label: 'Open sources dashboard', shortcut: ['g', 's'], run: () => go('sources') },
    { id: 'open-settings', label: 'Open settings', shortcut: ['g', 'c'], run: () => go('settings') },
    { id: 'open-logs', label: 'Open logs', run: () => setLogsModalOpen(true) },
    { id: 'cycle-scheme', label: 'Cycle color scheme', run: () => cycleScheme() },
    { id: 'open-ask', label: 'Open ask panel', shortcut: ['⌘', 'J'], run: () => { setAskInitial(undefined); setAskOpen(true); } },
    { id: 'clear-filters', label: 'Clear all filters', shortcut: ['Esc'], run: () => filterDispatch({ kind: 'clearAll' }) },
    { id: 'docs', label: 'Open documentation', run: () => window.open('https://docs.claude-mem.ai', '_blank') }
  ], [go, cycleScheme, filterDispatch]);

  const totalMemories = dashboardData?.totals.total ?? graphObservations.length + graphSummaries.length + graphPrompts.length;

  const todayCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();
    let count = 0;
    for (const item of [...graphObservations, ...graphSummaries, ...graphPrompts]) {
      if (item.created_at_epoch && item.created_at_epoch >= startMs) count++;
    }
    return count;
  }, [graphObservations, graphSummaries, graphPrompts]);

  const handleProjectChange = useCallback((project: string | null) => {
    if (project == null) {
      filterDispatch({ kind: 'replace', value: { ...filterState, projects: [] } });
    } else {
      filterDispatch({ kind: 'replace', value: { ...filterState, projects: [project] } });
    }
  }, [filterDispatch, filterState]);

  const dayGroups = useMemo(() => {
    type Item = { card: MemoryCardItem; epoch: number };
    const items: Item[] = [
      ...allObservations.map((o) => ({ card: obsToCard(o, freshIds.has(o.id)), epoch: o.created_at_epoch })),
      ...allSummaries.map((s) => ({ card: summaryToCard(s), epoch: s.created_at_epoch })),
      ...allPrompts.map((p) => ({ card: promptToCard(p), epoch: p.created_at_epoch }))
    ];
    items.sort((a, b) => b.epoch - a.epoch);
    const groups = new Map<string, MemoryCardItem[]>();
    items.forEach((it) => {
      const day = dayBucket(it.epoch);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(it.card);
    });
    return Array.from(groups.entries()).map(([day, list]) => ({ day, list }));
  }, [allObservations, allSummaries, allPrompts, freshIds]);

  const allCards = useMemo(() => dayGroups.flatMap((g) => g.list), [dayGroups]);
  const selectedCard = useMemo(
    () => allCards.find((c) => c.id === selectedMemId) ?? allCards[0] ?? null,
    [allCards, selectedMemId]
  );
  const selectedDay = useMemo(() => {
    if (!selectedCard) return undefined;
    for (const g of dayGroups) {
      if (g.list.some((c) => c.id === selectedCard.id)) return g.day;
    }
    return undefined;
  }, [dayGroups, selectedCard]);

  const sseSubscribers = stats?.worker?.sseClients ?? 1;

  return (
    <div className="app">
      <Sidebar
        route={route}
        onRouteChange={go}
        isConnected={isConnected}
        totalMemories={totalMemories}
        graphCount={graphObservations.length + graphSummaries.length}
        activeSources={dashboardData?.totals.activeSources ?? sources.length}
        totalSources={dashboardData?.totals.totalSources ?? sources.length}
        projectCounts={projectCounts}
        selectedProject={filterState.projects[0] ?? null}
        onProjectChange={handleProjectChange}
        workerPort={WORKER_PORT}
        workerUptimeMs={stats?.worker?.uptime ? stats.worker.uptime * 1000 : null}
        pendingJobs={queueDepth}
        dbSizeBytes={stats?.database?.size ?? null}
        appVersion={APP_VERSION}
      />

      <Header
        route={route}
        onRouteChange={go}
        isConnected={isConnected}
        isProcessing={isProcessing}
        queueDepth={queueDepth}
        scheme={scheme}
        onSchemeChange={setScheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onToggleConsole={() => setLogsModalOpen(v => !v)}
        consoleOpen={logsModalOpen}
        searchQuery={filterState.query}
        onSearchChange={(q) => filterDispatch({ kind: 'setQuery', value: q })}
        workerPort={WORKER_PORT}
      />

      <main className="main">
        {route === 'feed' && (
          <div className="route" data-screen-label="01 Feed">
            <div className="route-head">
              <h1 className="route-title">Feed</h1>
              <span className="route-sub mono">Audit trail of what AiMemory learned · live</span>
            </div>

            <div className="dash-grid">
              <MemoryEconomy
                sourceRows={dashboardData?.sources ?? []}
                windowDays={30}
                scope="GLOBAL"
                liveBeacon
              />
              <RightRail
                totalMemories={totalMemories}
                todayCount={todayCount}
                projectCount={projectCounts.length}
                totalsSpark={totalsSpark}
                activeSources={dashboardData?.totals.activeSources ?? sources.length}
                totalSources={dashboardData?.totals.totalSources ?? sources.length}
                sourceRows={dashboardData?.sources ?? []}
                lastSeenMs={dashboardData?.totals.lastSeenMs ?? null}
                isConnected={isConnected}
                workerPort={WORKER_PORT}
              />
            </div>

            <FilterBar
              state={filterState}
              dispatch={filterDispatch}
              sourceTotals={sourceTotals}
              selectedProject={filterState.projects[0] ?? null}
            />

            <div className="feed-layout">
              <div className="feed-stream">
                {dayGroups.map(({ day, list }) => (
                  <React.Fragment key={day}>
                    <div className="daygroup-head">
                      <span>{day}</span>
                      <span className="line" />
                      <span>
                        {list.length} {list.length === 1 ? 'memory' : 'memories'}
                        {list.some((m) => m.tokensSaved) && (
                          <> · {list.reduce((s, m) => s + m.tokensSaved, 0).toLocaleString('en-US')} tok saved</>
                        )}
                      </span>
                    </div>
                    {list.map((card) => (
                      <MemoryCard
                        key={card.id}
                        item={card}
                        selected={selectedCard?.id === card.id || highlightedId === card.id}
                        onSelect={setSelectedMemId}
                      />
                    ))}
                  </React.Fragment>
                ))}
                {dayGroups.length === 0 && (
                  <div style={{ padding: 'var(--sp-9) var(--sp-5)', textAlign: 'center', color: 'var(--ink-2)' }}>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>No memories match your filters</div>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => filterDispatch({ kind: 'clearAll' })}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
              <Inspector
                memory={selectedCard}
                day={selectedDay}
                tokensCost={4820}
                tokensReused={12300}
                onCite={() => {
                  if (selectedCard) {
                    setAskInitial(`obs#${selectedCard.id}`);
                    setAskOpen(true);
                  }
                }}
                onShowInGraph={() => go('graph')}
              />
            </div>
          </div>
        )}

        {route === 'graph' && (
          <GraphPage
            observations={graphObservations}
            summaries={graphSummaries}
            prompts={graphPrompts}
            onJumpToObservation={onJumpToObservation}
          />
        )}

        {route === 'sources' && <SourcesDashboard />}

        {route === 'settings' && (
          <SettingsPage
            variant="page"
            settings={settings}
            onSave={saveSettings}
            isSaving={isSaving}
            saveStatus={saveStatus}
            scheme={scheme}
            onSchemeChange={setScheme}
            detectedSources={sources}
            onClose={() => go('feed')}
          />
        )}
      </main>

      <StatusBar
        workerPort={WORKER_PORT}
        isConnected={isConnected}
        rowCount={totalMemories}
        chromaIndexed={isConnected && (dashboardData?.totals.totalSources ?? 0) > 0}
        sseSubscribers={sseSubscribers}
        consoleOpen={logsModalOpen}
        onOpenConsole={() => setLogsModalOpen(v => !v)}
      />

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        observations={[...observations, ...paginatedObservations]}
        actions={paletteActions}
        onJumpToObservation={onJumpToObservation}
        onAsk={onAskSubmit}
      />

      <AskPanel
        isOpen={askOpen}
        initialQuestion={askInitial}
        onClose={() => setAskOpen(false)}
        onCiteClick={(id) => { setAskOpen(false); onJumpToObservation(id); }}
      />

      <KeyboardHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      <LogsDrawer isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} />
    </div>
  );
}
