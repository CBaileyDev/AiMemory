import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { SettingsPage } from './components/settings/SettingsPage';
import { LogsDrawer } from './components/LogsModal';
import { SourceStrip } from './components/SourceStrip';
import { FilterSummary } from './components/FilterSummary';
import { SourcesDashboard } from './components/SourcesDashboard';
import { CommandPalette, PaletteAction } from './components/CommandPalette';
import { AskPanel } from './components/AskPanel';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { usePagination } from './hooks/usePagination';
import { useTheme } from './hooks/useTheme';
import { useRoute } from './hooks/useRoute';
import { useFilterState } from './hooks/useFilterState';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';
import { matchesFilter } from './state/filterReducer';

const FRESH_ID_TTL_MS = 4000;

export function App() {
  const [contextPreviewOpen, setContextPreviewOpen] = useState(false);
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
  const { preference, resolvedTheme: _resolvedTheme, setThemePreference } = useTheme();

  // Primary project filter fed to legacy pagination hook.
  const primaryProject = filterState.projects[0] ?? '';
  const primarySource = filterState.sources[0] ?? 'all';
  const pagination = usePagination(primaryProject, primarySource);

  const matches = useCallback((item: {
    project: string;
    platform_source: string;
    type?: string;
    created_at_epoch: number;
    title?: string | null;
    narrative?: string | null;
    prompt_text?: string;
    request?: string;
  }) => matchesFilter({
    platform_source: item.platform_source,
    project: item.project,
    type: item.type,
    created_at_epoch: item.created_at_epoch,
    title: item.title ?? null,
    narrative: item.narrative ?? null,
    prompt_text: item.prompt_text ?? null,
    request: item.request ?? null
  }, filterState), [filterState]);

  const allObservations = useMemo(() => {
    const live = observations.filter(matches);
    const paginated = paginatedObservations.filter(matches);
    return mergeAndDeduplicateByProject(live, paginated);
  }, [observations, paginatedObservations, matches]);

  const allSummaries = useMemo(() => {
    const live = summaries.filter(matches);
    const paginated = paginatedSummaries.filter(matches);
    return mergeAndDeduplicateByProject(live, paginated);
  }, [summaries, paginatedSummaries, matches]);

  const allPrompts = useMemo(() => {
    const live = prompts.filter(matches);
    const paginated = paginatedPrompts.filter(matches);
    return mergeAndDeduplicateByProject(live, paginated);
  }, [prompts, paginatedPrompts, matches]);

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

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const obs of [...observations, ...paginatedObservations]) {
      const s = obs.platform_source || 'claude';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [observations, paginatedObservations]);

  const handleLoadMore = useCallback(async () => {
    try {
      const [newObs, newSum, newP] = await Promise.all([
        pagination.observations.loadMore(),
        pagination.summaries.loadMore(),
        pagination.prompts.loadMore()
      ]);
      if (newObs.length) setPaginatedObservations(prev => [...prev, ...newObs]);
      if (newSum.length) setPaginatedSummaries(prev => [...prev, ...newSum]);
      if (newP.length)   setPaginatedPrompts(prev => [...prev, ...newP]);
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
      // g then h/s/c for route navigation
      if (e.key.toLowerCase() === 'g') {
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => { gTimer = null; }, 700);
        return;
      }
      if (gTimer) {
        const k = e.key.toLowerCase();
        if (k === 'h') { go('feed'); gTimer = null; }
        else if (k === 's') { go('sources'); gTimer = null; }
        else if (k === 'c') { setContextPreviewOpen(true); gTimer = null; }
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
    // Let React flush before scroll
    window.setTimeout(() => setHighlightedId(null), 1500);
  }, [go]);

  const paletteActions = useMemo<PaletteAction[]>(() => [
    { id: 'open-feed', label: 'Open feed', shortcut: ['g', 'h'], run: () => go('feed') },
    { id: 'open-sources', label: 'Open sources dashboard', shortcut: ['g', 's'], run: () => go('sources') },
    { id: 'open-settings', label: 'Open settings', shortcut: ['g', 'c'], run: () => setContextPreviewOpen(true) },
    { id: 'open-logs', label: 'Open logs', run: () => setLogsModalOpen(true) },
    { id: 'toggle-theme', label: 'Toggle theme', run: () => {
      const next = preference === 'dark' ? 'light' : preference === 'light' ? 'dark' : 'dark';
      setThemePreference(next);
    } },
    { id: 'open-ask', label: 'Open ask panel', shortcut: ['⌘', 'J'], run: () => { setAskInitial(undefined); setAskOpen(true); } },
    { id: 'clear-filters', label: 'Clear all filters', shortcut: ['Esc'], run: () => filterDispatch({ kind: 'clearAll' }) },
    { id: 'docs', label: 'Open documentation', run: () => window.open('https://docs.claude-mem.ai', '_blank') }
  ], [go, preference, setThemePreference, filterDispatch]);

  return (
    <>
      <Header
        route={route}
        onRouteChange={go}
        isConnected={isConnected}
        isProcessing={isProcessing}
        queueDepth={queueDepth}
        themePreference={preference}
        onThemeChange={setThemePreference}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenSettings={() => setContextPreviewOpen(true)}
        searchQuery={filterState.query}
        onSearchChange={(q) => filterDispatch({ kind: 'setQuery', value: q })}
      />

      {route === 'feed' && (
        <>
          <SourceStrip
            sources={sources}
            selected={filterState.sources}
            counts={sourceCounts}
            onToggle={(s, exclusive) => filterDispatch({ kind: 'toggleSource', value: s, exclusive })}
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

      {route === 'sources' && <SourcesDashboard />}

      {contextPreviewOpen && (
        <SettingsPage
          settings={settings}
          onSave={saveSettings}
          isSaving={isSaving}
          saveStatus={saveStatus}
          theme={preference}
          onThemeChange={setThemePreference}
          detectedSources={sources}
          onClose={() => setContextPreviewOpen(false)}
        />
      )}

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
    </>
  );
}
