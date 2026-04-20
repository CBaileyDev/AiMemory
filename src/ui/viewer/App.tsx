import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { SettingsPage } from './components/settings/SettingsPage';
import { LogsDrawer } from './components/LogsModal';
import { FilterSummary } from './components/FilterSummary';
import { SourcesDashboard } from './components/SourcesDashboard';
import { CommandPalette, PaletteAction } from './components/CommandPalette';
import { AskPanel } from './components/AskPanel';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';
import { GraphPage } from './components/GraphPage';
import { TokenSavingsPanel } from './components/TokenSavingsPanel';
import { TypeStrip } from './components/TypeStrip';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { usePagination } from './hooks/usePagination';
import { useTheme } from './hooks/useTheme';
import { useRoute } from './hooks/useRoute';
import { useFilterState } from './hooks/useFilterState';
import { useSourcesDashboard } from './hooks/useSourcesDashboard';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';
import { matchesFilter } from './state/filterReducer';
import { formatDashboardCount, formatDashboardRelative } from './utils/dashboardFormat';

const FRESH_ID_TTL_MS = 4000;
const FEED_TYPE_OPTIONS = [
  { value: 'learned', label: 'Learned' },
  { value: 'completed', label: 'Completed' },
  { value: 'investigated', label: 'Investigated' },
  { value: 'next-steps', label: 'Next-Steps' }
];

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

export function App() {
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askInitial, setAskInitial] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);

  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const prevLiveIds = useRef<Set<number>>(new Set());

  const { route, go } = useRoute();
  const { state: filterState, dispatch: filterDispatch } = useFilterState();
  const { observations, summaries, prompts, sources, isProcessing, queueDepth, isConnected } = useSSE();
  const { settings, saveSettings, isSaving, saveStatus } = useSettings();
  const { scheme, setScheme, cycleScheme } = useTheme();

  const { data: dashboardData } = useSourcesDashboard(route === 'feed');

  // Primary project filter fed to legacy pagination hook.
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

  // Detect SSE-inserted observation rows and mark them fresh for the pulse
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

  const projectCount = useMemo(() => {
    const projects = new Set<string>();
    for (const item of [...graphObservations, ...graphSummaries, ...graphPrompts]) {
      if (item.project) projects.add(item.project);
    }
    return projects.size;
  }, [graphObservations, graphSummaries, graphPrompts]);

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

  // Global keyboard map
  useEffect(() => {
    let gTimer: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      const isModifierOnly = e.ctrlKey || e.metaKey;

      if (isModifierOnly && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPaletteOpen(true); return;
      }
      if (isModifierOnly && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAskInitial(undefined);
        setAskOpen(true);
        return;
      }
      if (inField) return;
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); return; }
      if (e.key === 'Escape') { setPaletteOpen(false); setAskOpen(false); setHelpOpen(false); return; }
      if (e.key === '/') { e.preventDefault(); (document.querySelector('.am-search input') as HTMLInputElement | null)?.focus(); return; }
      if (e.key.toLowerCase() === 'g') {
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => { gTimer = null; }, 700);
        return;
      }
      if (gTimer) {
        const k = e.key.toLowerCase();
        if (k === 'h') { go('feed'); gTimer = null; }
        else if (k === 's') { go('sources'); gTimer = null; }
        else if (k === 'v') { go('graph'); gTimer = null; }
        else if (k === 'c') { go('settings'); gTimer = null; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (gTimer) window.clearTimeout(gTimer); };
  }, [go]);

  const onAskSubmit = useCallback((question: string) => {
    setAskInitial(question);
    setAskOpen(true);
  }, []);

  const onJumpToObservation = useCallback((id: number) => {
    go('feed');
    setHighlightedId(id);
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

  const tokenRows = useMemo(
    () => (dashboardData?.sources ?? []).map(s => ({ id: s.id, total: s.total })),
    [dashboardData]
  );

  return (
    <div className="am-app-shell">
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
        searchQuery={filterState.query}
        onSearchChange={(q) => filterDispatch({ kind: 'setQuery', value: q })}
      />

      <main className="am-app-main">
        {route === 'feed' && (
          <>
            {dashboardData && (
              <section className="am-feed-overview" aria-label="Overview">
                <div className="am-feed-overview__stats">
                  <div className="am-stat-card">
                    <div className="am-stat-card__label">Total Memories</div>
                    <div className="am-stat-card__value am-mono">{formatDashboardCount(dashboardData.totals.total)}</div>
                    <div className="am-stat-card__sub">+{formatDashboardCount(dashboardData.totals.thisWeek)} this week</div>
                  </div>
                  <div className="am-stat-card am-stat-card--accent">
                    <div className="am-stat-card__label">Active Sources</div>
                    <div className="am-stat-card__value am-mono">{dashboardData.totals.activeSources}</div>
                    <div className="am-stat-card__sub">{dashboardData.totals.totalSources} detected</div>
                  </div>
                  <div className="am-stat-card">
                    <div className="am-stat-card__label">Projects</div>
                    <div className="am-stat-card__value am-mono">{formatDashboardCount(projectCount)}</div>
                    <div className="am-stat-card__sub">visible now</div>
                  </div>
                  <div className="am-stat-card">
                    <div className="am-stat-card__label">Last Sync</div>
                    <div className="am-stat-card__value am-mono">{formatDashboardRelative(dashboardData.totals.lastSeenMs, '—')}</div>
                    <div className="am-stat-card__sub">{isConnected ? 'connected' : 'reconnecting'}</div>
                  </div>
                </div>
                <TokenSavingsPanel sourceRows={tokenRows} />
              </section>
            )}
            <TypeStrip
              options={FEED_TYPE_OPTIONS}
              selected={filterState.types}
              onToggle={(type, exclusive) => filterDispatch({ kind: 'toggleType', value: type, exclusive })}
              onClear={() => filterDispatch({ kind: 'replace', value: { ...filterState, types: [] } })}
            />
            <FilterSummary state={filterState} dispatch={filterDispatch} />
            <Feed
              observations={allObservations}
              summaries={allSummaries}
              prompts={allPrompts}
              onLoadMore={handleLoadMore}
              isLoading={pagination.observations.isLoading || pagination.summaries.isLoading || pagination.prompts.isLoading}
              hasMore={pagination.observations.hasMore || pagination.summaries.hasMore || pagination.prompts.hasMore}
              highlightedId={highlightedId}
              freshIds={freshIds}
              sourcesDetected={sources}
            />
          </>
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

      <button
        type="button"
        className="console-toggle-btn"
        onClick={() => setLogsModalOpen(v => !v)}
        title="Toggle Console"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </button>

      <LogsDrawer isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} />
    </div>
  );
}
