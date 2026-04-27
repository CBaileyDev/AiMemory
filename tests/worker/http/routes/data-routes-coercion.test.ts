/**
 * DataRoutes Type Coercion Tests
 *
 * Tests that MCP clients sending string-encoded arrays for `ids` and
 * `memorySessionIds` are properly coerced before validation.
 *
 * Mock Justification:
 * - Express req/res mocks: Required because route handlers expect Express objects
 * - DatabaseManager/SessionStore: Avoids database setup; we test coercion logic, not queries
 * - Logger spies: Suppress console output during tests
 */

import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { rmSync, writeFileSync } from 'fs';
import type { Request, Response } from 'express';
import { logger } from '../../../../src/utils/logger.js';

const MOCK_DB_PATH = '/tmp/claude-mem-data-routes-test.db';

// Mock dependencies before importing DataRoutes
mock.module('../../../../src/shared/paths.js', () => ({
  DB_PATH: MOCK_DB_PATH,
  getPackageRoot: () => process.cwd(),
}));
mock.module('../../../../src/shared/worker-utils.js', () => ({
  getWorkerPort: () => 37777,
}));

import { DataRoutes } from '../../../../src/services/worker/http/routes/DataRoutes.js';

let loggerSpies: ReturnType<typeof spyOn>[] = [];

// Helper to create mock req/res
function createMockReqRes(body: any): { req: Partial<Request>; res: Partial<Response>; jsonSpy: ReturnType<typeof mock>; statusSpy: ReturnType<typeof mock> } {
  const jsonSpy = mock(() => {});
  const statusSpy = mock(() => ({ json: jsonSpy }));
  return {
    req: { body, path: '/test', query: {} } as Partial<Request>,
    res: { json: jsonSpy, status: statusSpy } as unknown as Partial<Response>,
    jsonSpy,
    statusSpy,
  };
}

describe('DataRoutes Type Coercion', () => {
  let routes: DataRoutes;
  let mockGetObservationsByIds: ReturnType<typeof mock>;
  let mockGetSdkSessionsBySessionIds: ReturnType<typeof mock>;
  let mockPrepare: ReturnType<typeof mock>;

  beforeEach(() => {
    loggerSpies = [
      spyOn(logger, 'info').mockImplementation(() => {}),
      spyOn(logger, 'debug').mockImplementation(() => {}),
      spyOn(logger, 'warn').mockImplementation(() => {}),
      spyOn(logger, 'error').mockImplementation(() => {}),
      spyOn(logger, 'failure').mockImplementation(() => {}),
    ];

    mockGetObservationsByIds = mock(() => [{ id: 1 }, { id: 2 }]);
    mockGetSdkSessionsBySessionIds = mock(() => [{ id: 'abc' }]);
    mockPrepare = mock((sql: string) => ({
      get: mock(() => {
        if (sql.includes('FROM observations')) return { count: 7 };
        if (sql.includes('FROM sdk_sessions')) return { count: 3 };
        if (sql.includes('FROM session_summaries')) return { count: 2 };
        return { count: 0 };
      })
    }));

    const mockDbManager = {
      getSessionStore: () => ({
        db: { prepare: mockPrepare },
        getObservationsByIds: mockGetObservationsByIds,
        getSdkSessionsBySessionIds: mockGetSdkSessionsBySessionIds,
      }),
    };

    routes = new DataRoutes(
      {} as any, // paginationHelper
      mockDbManager as any,
      { getActiveSessionCount: mock(() => 0) } as any, // sessionManager
      { getClientCount: mock(() => 0) } as any, // sseBroadcaster
      {} as any, // workerService
      Date.now()
    );
  });

  afterEach(() => {
    rmSync(MOCK_DB_PATH, { force: true });
    loggerSpies.forEach(spy => spy.mockRestore());
    mock.restore();
  });

  describe('handleGetStats', () => {
    let handler: (req: Request, res: Response) => void;

    beforeEach(() => {
      const mockApp = {
        get: mock((path: string, fn: any) => {
          if (path === '/api/stats') handler = fn;
        }),
        post: mock(() => {}),
        delete: mock(() => {}),
      };
      routes.setupRoutes(mockApp as any);
    });

    it('reports the configured database path and size instead of a hard-coded production DB', () => {
      writeFileSync(MOCK_DB_PATH, 'test database bytes');

      const { req, res, jsonSpy } = createMockReqRes({});
      handler(req as Request, res as Response);

      expect(jsonSpy).toHaveBeenCalled();
      const payload = jsonSpy.mock.calls[0][0] as any;
      expect(payload.database.path).toBe(MOCK_DB_PATH);
      expect(payload.database.size).toBe(19);
      expect(payload.database.observations).toBe(7);
      expect(payload.database.sessions).toBe(3);
      expect(payload.database.summaries).toBe(2);
      expect(payload.worker.port).toBe(37777);
    });
  });

  describe('handleGetObservationsByIds — ids coercion', () => {
    // Access the handler via setupRoutes
    let handler: (req: Request, res: Response) => void;

    beforeEach(() => {
      const mockApp = {
        get: mock(() => {}),
        post: mock((path: string, fn: any) => {
          if (path === '/api/observations/batch') handler = fn;
        }),
        delete: mock(() => {}),
      };
      routes.setupRoutes(mockApp as any);
    });

    it('should accept a native array of numbers', () => {
      const { req, res, jsonSpy } = createMockReqRes({ ids: [1, 2, 3] });
      handler(req as Request, res as Response);

      expect(mockGetObservationsByIds).toHaveBeenCalledWith([1, 2, 3], expect.anything());
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should coerce a JSON-encoded string array "[1,2,3]" to native array', () => {
      const { req, res, jsonSpy } = createMockReqRes({ ids: '[1,2,3]' });
      handler(req as Request, res as Response);

      expect(mockGetObservationsByIds).toHaveBeenCalledWith([1, 2, 3], expect.anything());
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should coerce a comma-separated string "1,2,3" to native array', () => {
      const { req, res, jsonSpy } = createMockReqRes({ ids: '1,2,3' });
      handler(req as Request, res as Response);

      expect(mockGetObservationsByIds).toHaveBeenCalledWith([1, 2, 3], expect.anything());
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should reject non-integer values after coercion', () => {
      const { req, res, statusSpy } = createMockReqRes({ ids: 'foo,bar' });
      handler(req as Request, res as Response);

      // NaN values should fail the Number.isInteger check
      expect(statusSpy).toHaveBeenCalledWith(400);
    });

    it('should reject missing ids', () => {
      const { req, res, statusSpy } = createMockReqRes({});
      handler(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
    });

    it('should return empty array for empty ids array', () => {
      const { req, res, jsonSpy } = createMockReqRes({ ids: [] });
      handler(req as Request, res as Response);

      expect(jsonSpy).toHaveBeenCalledWith([]);
    });
  });

  describe('handleGetSdkSessionsByIds — memorySessionIds coercion', () => {
    let handler: (req: Request, res: Response) => void;

    beforeEach(() => {
      const mockApp = {
        get: mock(() => {}),
        post: mock((path: string, fn: any) => {
          if (path === '/api/sdk-sessions/batch') handler = fn;
        }),
        delete: mock(() => {}),
      };
      routes.setupRoutes(mockApp as any);
    });

    it('should accept a native array of strings', () => {
      const { req, res, jsonSpy } = createMockReqRes({ memorySessionIds: ['abc', 'def'] });
      handler(req as Request, res as Response);

      expect(mockGetSdkSessionsBySessionIds).toHaveBeenCalledWith(['abc', 'def']);
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should coerce a JSON-encoded string array to native array', () => {
      const { req, res, jsonSpy } = createMockReqRes({ memorySessionIds: '["abc","def"]' });
      handler(req as Request, res as Response);

      expect(mockGetSdkSessionsBySessionIds).toHaveBeenCalledWith(['abc', 'def']);
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should coerce a comma-separated string to native array', () => {
      const { req, res, jsonSpy } = createMockReqRes({ memorySessionIds: 'abc,def' });
      handler(req as Request, res as Response);

      expect(mockGetSdkSessionsBySessionIds).toHaveBeenCalledWith(['abc', 'def']);
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should trim whitespace from comma-separated values', () => {
      const { req, res, jsonSpy } = createMockReqRes({ memorySessionIds: 'abc, def , ghi' });
      handler(req as Request, res as Response);

      expect(mockGetSdkSessionsBySessionIds).toHaveBeenCalledWith(['abc', 'def', 'ghi']);
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should reject non-array, non-string values', () => {
      const { req, res, statusSpy } = createMockReqRes({ memorySessionIds: 42 });
      handler(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
    });
  });
});
