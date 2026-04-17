import { useCallback, useEffect, useState } from 'react';

interface SourceRow {
  id: string;
  total: number;
  sevenDay: number[];
  lastSeenMs: number | null;
  wowDelta: number | null;
}

interface SourcesDashboardResponse {
  sources: SourceRow[];
  totals: {
    total: number;
    thisWeek: number;
    lastWeek: number;
    wowDelta: number;
    activeSources: number;
    totalSources: number;
    lastSeenMs: number | null;
  };
}

export function useSourcesDashboard(enabled: boolean) {
  const [data, setData] = useState<SourcesDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/sources');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SourcesDashboardResponse = await res.json();
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const t = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(t);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
