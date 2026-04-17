/**
 * Session module tests
 * Tests modular session functions with in-memory database
 *
 * Sources:
 * - API patterns from src/services/sqlite/sessions/create.ts
 * - API patterns from src/services/sqlite/sessions/get.ts
 * - Test pattern from tests/session_store.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import {
  createSDKSession,
  getSessionById,
  updateMemorySessionId,
} from '../../src/services/sqlite/Sessions.js';
import type { Database } from 'bun:sqlite';

describe('Sessions Module', () => {
  let db: Database;
  let sessionStore: SessionStore;

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
    sessionStore = new SessionStore(':memory:');
  });

  afterEach(() => {
    db.close();
    sessionStore.close();
  });

  describe('createSDKSession', () => {
    it('should create a new session and return numeric ID', () => {
      const contentSessionId = 'content-session-123';
      const project = 'test-project';
      const userPrompt = 'Initial user prompt';

      const sessionId = createSDKSession(db, contentSessionId, project, userPrompt);

      expect(typeof sessionId).toBe('number');
      expect(sessionId).toBeGreaterThan(0);
    });

    it('should be idempotent - return same ID for same content_session_id', () => {
      const contentSessionId = 'content-session-456';
      const project = 'test-project';
      const userPrompt = 'Initial user prompt';

      const sessionId1 = createSDKSession(db, contentSessionId, project, userPrompt);
      const sessionId2 = createSDKSession(db, contentSessionId, project, 'Different prompt');

      expect(sessionId1).toBe(sessionId2);
    });

    it('should create different sessions for different content_session_ids', () => {
      const sessionId1 = createSDKSession(db, 'session-a', 'project', 'prompt');
      const sessionId2 = createSDKSession(db, 'session-b', 'project', 'prompt');

      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('getSessionById', () => {
    it('should retrieve session by ID', () => {
      const contentSessionId = 'content-session-get';
      const project = 'test-project';
      const userPrompt = 'Test prompt';

      const sessionId = createSDKSession(db, contentSessionId, project, userPrompt);
      const session = getSessionById(db, sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(sessionId);
      expect(session?.content_session_id).toBe(contentSessionId);
      expect(session?.project).toBe(project);
      expect(session?.user_prompt).toBe(userPrompt);
      // memory_session_id should be null initially (set via updateMemorySessionId)
      expect(session?.memory_session_id).toBeNull();
    });

    it('should return null for non-existent session', () => {
      const session = getSessionById(db, 99999);

      expect(session).toBeNull();
    });
  });

  describe('custom_title', () => {
    it('should store custom_title when provided at creation', () => {
      const sessionId = createSDKSession(db, 'session-title-1', 'project', 'prompt', 'My Agent');
      const session = getSessionById(db, sessionId);

      expect(session?.custom_title).toBe('My Agent');
    });

    it('should default custom_title to null when not provided', () => {
      const sessionId = createSDKSession(db, 'session-title-2', 'project', 'prompt');
      const session = getSessionById(db, sessionId);

      expect(session?.custom_title).toBeNull();
    });

    it('should backfill custom_title on idempotent call if not already set', () => {
      const sessionId = createSDKSession(db, 'session-title-3', 'project', 'prompt');
      let session = getSessionById(db, sessionId);
      expect(session?.custom_title).toBeNull();

      // Second call with custom_title should backfill
      createSDKSession(db, 'session-title-3', 'project', 'prompt', 'Backfilled Title');
      session = getSessionById(db, sessionId);
      expect(session?.custom_title).toBe('Backfilled Title');
    });

    it('should not overwrite existing custom_title on idempotent call', () => {
      const sessionId = createSDKSession(db, 'session-title-4', 'project', 'prompt', 'Original');
      let session = getSessionById(db, sessionId);
      expect(session?.custom_title).toBe('Original');

      // Second call should NOT overwrite
      createSDKSession(db, 'session-title-4', 'project', 'prompt', 'Attempted Override');
      session = getSessionById(db, sessionId);
      expect(session?.custom_title).toBe('Original');
    });

    it('should handle empty string custom_title as no title', () => {
      const sessionId = createSDKSession(db, 'session-title-5', 'project', 'prompt', '');
      const session = getSessionById(db, sessionId);

      // Empty string becomes null via the || null conversion
      expect(session?.custom_title).toBeNull();
    });
  });

  describe('platform_source', () => {
    it('should default new sessions to claude when platformSource is omitted', () => {
      const sessionId = createSDKSession(db, 'session-platform-1', 'project', 'prompt');
      const session = getSessionById(db, sessionId);

      expect(session?.platform_source).toBe('claude');
    });

    it('should preserve a non-default platform_source for legacy callers that omit platformSource', () => {
      const sessionId = createSDKSession(db, 'session-platform-2', 'project', 'prompt', undefined, 'codex');
      let session = getSessionById(db, sessionId);
      expect(session?.platform_source).toBe('codex');

      createSDKSession(db, 'session-platform-2', 'project', 'prompt');
      session = getSessionById(db, sessionId);
      expect(session?.platform_source).toBe('codex');
    });

    it('should reject explicit platform_source conflicts for the same session', () => {
      createSDKSession(db, 'session-platform-3', 'project', 'prompt', undefined, 'codex');

      expect(() => createSDKSession(
        db,
        'session-platform-3',
        'project',
        'prompt',
        undefined,
        'claude'
      )).toThrow(/Platform source conflict/);
    });
  });

  describe('updateMemorySessionId', () => {
    it('should update memory_session_id for existing session', () => {
      const contentSessionId = 'content-session-update';
      const project = 'test-project';
      const userPrompt = 'Test prompt';
      const memorySessionId = 'memory-session-abc123';

      const sessionId = createSDKSession(db, contentSessionId, project, userPrompt);

      // Verify memory_session_id is null initially
      let session = getSessionById(db, sessionId);
      expect(session?.memory_session_id).toBeNull();

      // Update memory session ID
      updateMemorySessionId(db, sessionId, memorySessionId);

      // Verify update
      session = getSessionById(db, sessionId);
      expect(session?.memory_session_id).toBe(memorySessionId);
    });

    it('should allow updating to different memory_session_id', () => {
      const sessionId = createSDKSession(db, 'session-x', 'project', 'prompt');

      updateMemorySessionId(db, sessionId, 'memory-1');
      let session = getSessionById(db, sessionId);
      expect(session?.memory_session_id).toBe('memory-1');

      updateMemorySessionId(db, sessionId, 'memory-2');
      session = getSessionById(db, sessionId);
      expect(session?.memory_session_id).toBe('memory-2');
    });
  });

  describe('SessionStore helpers', () => {
    it('getStaleActiveSessionIds returns only active sessions older than the threshold', () => {
      const now = Date.now();
      const oldSessionId = createSDKSession(sessionStore.db, 'stale-session', 'project', 'prompt');
      const freshSessionId = createSDKSession(sessionStore.db, 'fresh-session', 'project', 'prompt');
      const failedSessionId = createSDKSession(sessionStore.db, 'failed-session', 'project', 'prompt');

      sessionStore.db.prepare(`
        UPDATE sdk_sessions SET started_at_epoch = ? WHERE id = ?
      `).run(now - 10_000, oldSessionId);
      sessionStore.db.prepare(`
        UPDATE sdk_sessions SET started_at_epoch = ? WHERE id = ?
      `).run(now + 10_000, freshSessionId);
      sessionStore.db.prepare(`
        UPDATE sdk_sessions SET status = 'failed', started_at_epoch = ? WHERE id = ?
      `).run(now - 10_000, failedSessionId);

      const staleIds = sessionStore.getStaleActiveSessionIds(now);

      expect(staleIds).toContain(oldSessionId);
      expect(staleIds).not.toContain(freshSessionId);
      expect(staleIds).not.toContain(failedSessionId);
    });

    it('markSessionsFailed updates only the requested sessions and ignores empty input', () => {
      const session1 = createSDKSession(sessionStore.db, 'mark-failed-1', 'project', 'prompt');
      const session2 = createSDKSession(sessionStore.db, 'mark-failed-2', 'project', 'prompt');
      const getStatusRow = (sessionId: number) => sessionStore.db.prepare(`
        SELECT status, completed_at_epoch FROM sdk_sessions WHERE id = ?
      `).get(sessionId) as { status: string; completed_at_epoch: number | null } | undefined;

      sessionStore.markSessionsFailed([]);
      expect(getStatusRow(session1)?.status).toBe('active');

      sessionStore.markSessionsFailed([session1]);

      expect(getStatusRow(session1)?.status).toBe('failed');
      expect(typeof getStatusRow(session1)?.completed_at_epoch).toBe('number');
      expect(getStatusRow(session2)?.status).toBe('active');
    });

    it('getSessionStartedAtEpoch returns the stored epoch or null when missing', () => {
      const sessionId = createSDKSession(sessionStore.db, 'started-at-session', 'project', 'prompt');

      expect(typeof sessionStore.getSessionStartedAtEpoch(sessionId)).toBe('number');
      expect(sessionStore.getSessionStartedAtEpoch(999999)).toBeNull();
    });
  });
});
