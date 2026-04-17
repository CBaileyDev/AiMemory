import { useCallback, useEffect, useState } from 'react';

export type Route = 'feed' | 'sources' | 'settings';

function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '').split('?')[0];
  if (h === 'sources') return 'sources';
  if (h === 'settings') return 'settings';
  return 'feed';
}

export function useRoute(): { route: Route; go: (r: Route) => void } {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? 'feed' : parseRoute(window.location.hash)
  );

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((r: Route) => {
    const nextHash = r === 'feed' ? '' : `#${r}`;
    const existingQuery = window.location.hash.split('?')[1];
    const qs = existingQuery ? `?${existingQuery}` : '';
    const newHash = r === 'feed' ? qs : `${nextHash}${qs}`;
    if (newHash !== window.location.hash) {
      if (newHash === '' && window.history) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setRoute('feed');
      } else {
        window.location.hash = newHash;
      }
    }
  }, []);

  return { route, go };
}
