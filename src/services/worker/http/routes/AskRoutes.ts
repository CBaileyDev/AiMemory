/**
 * Ask Routes — Viewer UI 2.0 Phase 7
 *
 * POST /api/ask { question, limit?, project? } → { synthesis | null, citations[] }
 *
 * Synthesis is always null in this open-source path; the default surface is
 * the citation list. A future extension may plug in a model (gated on
 * settings) but MUST not regress the no-model default.
 */

import express, { Request, Response } from 'express';
import { BaseRouteHandler } from '../BaseRouteHandler.js';
import { SearchManager } from '../../SearchManager.js';

interface AskCitation {
  id: number;
  title: string | null;
  subtitle: string | null;
  narrative_snippet: string | null;
  project: string;
  platform_source: string;
  type: string;
  created_at_epoch: number;
}

export class AskRoutes extends BaseRouteHandler {
  constructor(private searchManager: SearchManager) {
    super();
  }

  setupRoutes(app: express.Application): void {
    app.post('/api/ask', this.handleAsk.bind(this));
  }

  private handleAsk = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { question, limit, project } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      this.badRequest(res, 'question is required and must be a non-empty string');
      return;
    }
    const cap = Math.min(Math.max(parseInt(String(limit ?? 8), 10) || 8, 1), 20);

    const result: any = await this.searchManager.search({
      query: question,
      type: 'observations',
      limit: cap,
      format: 'json',
      ...(project ? { project } : {})
    });

    const raw: any[] = Array.isArray(result?.observations)
      ? result.observations
      : Array.isArray(result)
        ? result
        : Array.isArray(result?.results)
          ? result.results
          : [];

    const citations: AskCitation[] = raw.map((r: any): AskCitation => ({
      id: Number(r.id),
      title: r.title ?? null,
      subtitle: r.subtitle ?? null,
      narrative_snippet: r.narrative
        ? String(r.narrative).slice(0, 220)
        : (r.subtitle ?? null),
      project: r.project,
      platform_source: r.platform_source ?? 'claude',
      type: r.type ?? 'discovery',
      created_at_epoch: Number(r.created_at_epoch ?? Date.now())
    })).filter(c => Number.isFinite(c.id));

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      synthesis: null,
      citations
    });
  });
}
