/**
 * Shared formatters for `/api/dashboard/sources` totals (feed overview + Sources page).
 */

export function formatDashboardCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

/** Relative age from epoch ms; `empty` when timestamp is missing. */
export function formatDashboardRelative(ms: number | null, empty: 'never' | '—' = 'never'): string {
  if (!ms) return empty;
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
