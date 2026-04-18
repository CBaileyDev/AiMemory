/**
 * Dashboard Routes — Viewer UI 2.0
 *
 * - GET /api/dashboard/sources  — per-source lifetime + 7-day counts + last-seen
 * - GET /api/dashboard/health   — worker uptime, DB size, queue depth, recent errors
 *
 * All queries run against SQLite with aggregates; at 10k+ rows the `observations`
 * ➜ `sdk_sessions` join with GROUP BY platform_source is O(sources) after the
 * idx_sdk_sessions_platform_source index.
 */

import express, { Request, Response } from 'express';
import { statSync, existsSync } from 'fs';
import { logger } from '../../../../utils/logger.js';
import { DB_PATH } from '../../../../shared/paths.js';
import { BaseRouteHandler } from '../BaseRouteHandler.js';
import { DatabaseManager } from '../../DatabaseManager.js';
import { SessionManager } from '../../SessionManager.js';
import { SSEBroadcaster } from '../../SSEBroadcaster.js';

const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAY_MS = 14 * 24 * 60 * 60 * 1000;

interface SourceDashboardRow {
  id: string;
  total: number;
  sevenDay: number[];
  lastSeenMs: number | null;
  wowDelta: number | null;
}

export class DashboardRoutes extends BaseRouteHandler {
  constructor(
    private dbManager: DatabaseManager,
    private sessionManager: SessionManager,
    private sseBroadcaster: SSEBroadcaster,
    private startTime: number
  ) {
    super();
  }

  setupRoutes(app: express.Application): void {
    app.get('/api/dashboard/sources', this.handleSources.bind(this));
    app.get('/api/dashboard/health', this.handleHealth.bind(this));
  }

  private handleSources = this.wrapHandler((_req: Request, res: Response): void => {
    const db = this.dbManager.getSessionStore().db;
    const now = Date.now();
    const weekStart = now - SEVEN_DAY_MS;
    const twoWeekStart = now - FOURTEEN_DAY_MS;

    // Aggregate totals + last-seen per source.
    const totals = db.prepare(`
      SELECT
        COALESCE(s.platform_source, 'claude') AS source,
        COUNT(o.id)                            AS total,
        MAX(o.created_at_epoch)                AS last_seen
      FROM observations o
      JOIN sdk_sessions s ON s.memory_session_id = o.memory_session_id
      GROUP BY COALESCE(s.platform_source, 'claude')
    `).all() as Array<{ source: string; total: number; last_seen: number | null }>;

    // Week-over-week bucket counts per source.
    const weekly = db.prepare(`
      SELECT
        COALESCE(s.platform_source, 'claude') AS source,
        COUNT(CASE WHEN o.created_at_epoch >= ? THEN 1 END) AS this_week,
        COUNT(CASE WHEN o.created_at_epoch >= ? AND o.created_at_epoch < ? THEN 1 END) AS last_week
      FROM observations o
      JOIN sdk_sessions s ON s.memory_session_id = o.memory_session_id
      GROUP BY COALESCE(s.platform_source, 'claude')
    `).all(weekStart, twoWeekStart, weekStart) as Array<{ source: string; this_week: number; last_week: number }>;

    // Per-day buckets for the sparkline (7 days).
    const dayBuckets = db.prepare(`
      SELECT
        COALESCE(s.platform_source, 'claude') AS source,
        CAST((? - o.created_at_epoch) / (24 * 60 * 60 * 1000) AS INTEGER) AS days_ago,
        COUNT(o.id) AS count
      FROM observations o
      JOIN sdk_sessions s ON s.memory_session_id = o.memory_session_id
      WHERE o.created_at_epoch >= ?
      GROUP BY COALESCE(s.platform_source, 'claude'),
               CAST((? - o.created_at_epoch) / (24 * 60 * 60 * 1000) AS INTEGER)
    `).all(now, weekStart, now) as Array<{ source: string; days_ago: number; count: number }>;

    const bySource: Record<string, SourceDashboardRow> = {};
    for (const row of totals) {
      bySource[row.source] = {
        id: row.source,
        total: row.total,
        lastSeenMs: row.last_seen,
        sevenDay: Array(7).fill(0),
        wowDelta: null
      };
    }
    for (const w of weekly) {
      const entry = bySource[w.source];
      if (!entry) continue;
      if (w.last_week > 0) {
        entry.wowDelta = (w.this_week - w.last_week) / w.last_week;
      } else if (w.this_week > 0) {
        entry.wowDelta = 1;
      } else {
        entry.wowDelta = 0;
      }
    }
    for (const b of dayBuckets) {
      const entry = bySource[b.source];
      if (!entry) continue;
      const idx = Math.min(6, Math.max(0, 6 - b.days_ago));
      entry.sevenDay[idx] += b.count;
    }

    logger.debug('HTTP', 'dashboard sources snapshot', { sourceCount: Object.keys(bySource).length });

    // Overall totals
    const totalObservations = Object.values(bySource).reduce((a, b) => a + b.total, 0);
    const thisWeek = weekly.reduce((a, b) => a + b.this_week, 0);
    const lastWeek = weekly.reduce((a, b) => a + b.last_week, 0);
    const wowDelta = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : (thisWeek > 0 ? 1 : 0);
    const lastSeenMs = totals.reduce((m, r) => Math.max(m, r.last_seen ?? 0), 0) || null;

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      sources: Object.values(bySource).sort((a, b) => b.total - a.total),
      totals: {
        total: totalObservations,
        thisWeek,
        lastWeek,
        wowDelta,
        activeSources: Object.values(bySource).filter(s => (s.lastSeenMs ?? 0) > weekStart).length,
        totalSources: Object.keys(bySource).length,
        lastSeenMs
      }
    });
  });

  private handleHealth = this.wrapHandler((_req: Request, res: Response): void => {
    const dbPath = DB_PATH;
    const dbSize = existsSync(dbPath) ? statSync(dbPath).size : 0;
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      worker: {
        uptime,
        activeSessions: this.sessionManager.getActiveSessionCount(),
        sseClients: this.sseBroadcaster.getClientCount()
      },
      database: {
        path: dbPath,
        size: dbSize
      },
      queue: {
        depth: this.sessionManager.getTotalActiveWork()
      }
    });
  });
}
