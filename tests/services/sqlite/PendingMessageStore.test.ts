import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../../../src/services/sqlite/Database.js';
import { PendingMessageStore } from '../../../src/services/sqlite/PendingMessageStore.js';
import { createSDKSession } from '../../../src/services/sqlite/Sessions.js';
import type { PendingMessage } from '../../../src/services/worker-types.js';
import type { Database } from 'bun:sqlite';

describe('PendingMessageStore - Self-Healing claimNextMessage', () => {
  let db: Database;
  let store: PendingMessageStore;
  let sessionDbId: number;
  const CONTENT_SESSION_ID = 'test-self-heal';

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
    store = new PendingMessageStore(db, 3);
    sessionDbId = createSDKSession(db, CONTENT_SESSION_ID, 'test-project', 'Test prompt');
  });

  afterEach(() => {
    db.close();
  });

  function enqueueMessage(overrides: Partial<PendingMessage> = {}): number {
    const message: PendingMessage = {
      type: 'observation',
      tool_name: 'TestTool',
      tool_input: { test: 'input' },
      tool_response: { test: 'response' },
      prompt_number: 1,
      ...overrides,
    };
    return store.enqueue(sessionDbId, CONTENT_SESSION_ID, message);
  }

  /**
   * Helper to simulate a stuck processing message by directly updating the DB
   * to set started_processing_at_epoch to a time in the past (>60s ago)
   */
  function makeMessageStaleProcessing(messageId: number): void {
    const staleTimestamp = Date.now() - 120_000; // 2 minutes ago (well past 60s threshold)
    db.run(
      `UPDATE pending_messages SET status = 'processing', started_processing_at_epoch = ? WHERE id = ?`,
      [staleTimestamp, messageId]
    );
  }

  test('stuck processing messages are recovered on next claim', () => {
    // Enqueue a message and make it stuck in processing
    const msgId = enqueueMessage();
    makeMessageStaleProcessing(msgId);

    // Verify it's stuck (status = processing)
    const beforeClaim = db.query('SELECT status FROM pending_messages WHERE id = ?').get(msgId) as { status: string };
    expect(beforeClaim.status).toBe('processing');

    // claimNextMessage should self-heal: reset the stuck message, then claim it
    const claimed = store.claimNextMessage(sessionDbId);

    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(msgId);
    // It should now be in 'processing' status again (freshly claimed)
    const afterClaim = db.query('SELECT status FROM pending_messages WHERE id = ?').get(msgId) as { status: string };
    expect(afterClaim.status).toBe('processing');
  });

  test('actively processing messages are NOT recovered', () => {
    // Enqueue two messages
    const activeId = enqueueMessage();
    const pendingId = enqueueMessage();

    // Make the first one actively processing (recent timestamp, NOT stale)
    const recentTimestamp = Date.now() - 5_000; // 5 seconds ago (well within 60s threshold)
    db.run(
      `UPDATE pending_messages SET status = 'processing', started_processing_at_epoch = ? WHERE id = ?`,
      [recentTimestamp, activeId]
    );

    // claimNextMessage should NOT reset the active one — should claim the pending one instead
    const claimed = store.claimNextMessage(sessionDbId);

    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(pendingId);

    // The active message should still be processing
    const activeMsg = db.query('SELECT status FROM pending_messages WHERE id = ?').get(activeId) as { status: string };
    expect(activeMsg.status).toBe('processing');
  });

  test('recovery and claim is atomic within single call', () => {
    // Enqueue three messages
    const stuckId = enqueueMessage();
    const pendingId1 = enqueueMessage();
    const pendingId2 = enqueueMessage();

    // Make the first one stuck
    makeMessageStaleProcessing(stuckId);

    // Single claimNextMessage should reset stuck AND claim oldest pending (which is the reset stuck one)
    const claimed = store.claimNextMessage(sessionDbId);

    expect(claimed).not.toBeNull();
    // The stuck message was reset to pending, and being oldest, it gets claimed
    expect(claimed!.id).toBe(stuckId);

    // The other two should still be pending
    const msg1 = db.query('SELECT status FROM pending_messages WHERE id = ?').get(pendingId1) as { status: string };
    const msg2 = db.query('SELECT status FROM pending_messages WHERE id = ?').get(pendingId2) as { status: string };
    expect(msg1.status).toBe('pending');
    expect(msg2.status).toBe('pending');
  });

  test('no messages returns null without error', () => {
    const claimed = store.claimNextMessage(sessionDbId);
    expect(claimed).toBeNull();
  });

  test('self-healing only affects the specified session', () => {
    // Create a second session
    const session2Id = createSDKSession(db, 'other-session', 'test-project', 'Test');

    // Enqueue and make stuck in session 1
    const stuckInSession1 = enqueueMessage();
    makeMessageStaleProcessing(stuckInSession1);

    // Enqueue in session 2
    const msg: PendingMessage = {
      type: 'observation',
      tool_name: 'TestTool',
      tool_input: { test: 'input' },
      tool_response: { test: 'response' },
      prompt_number: 1,
    };
    const session2MsgId = store.enqueue(session2Id, 'other-session', msg);
    makeMessageStaleProcessing(session2MsgId);

    // Claim for session 2 — should only heal session 2's stuck message
    const claimed = store.claimNextMessage(session2Id);
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(session2MsgId);

    // Session 1's stuck message should still be stuck (not healed by session 2's claim)
    const session1Msg = db.query('SELECT status FROM pending_messages WHERE id = ?').get(stuckInSession1) as { status: string };
    expect(session1Msg.status).toBe('processing');
  });

  test('markAllSessionsMessagesAbandoned marks pending and processing messages across sessions', () => {
    const session2Id = createSDKSession(db, 'bulk-abandon-session', 'test-project', 'Test');
    const session3Id = createSDKSession(db, 'untouched-session', 'test-project', 'Test');

    const session1Pending = enqueueMessage();
    const session1Processing = enqueueMessage();
    const session2Pending = store.enqueue(session2Id, 'bulk-abandon-session', {
      type: 'observation',
      tool_name: 'TestTool',
      tool_input: { test: 'input' },
      tool_response: { test: 'response' },
      prompt_number: 1,
    });
    const untouched = store.enqueue(session3Id, 'untouched-session', {
      type: 'observation',
      tool_name: 'TestTool',
      tool_input: { test: 'input' },
      tool_response: { test: 'response' },
      prompt_number: 1,
    });

    db.run(
      `UPDATE pending_messages SET status = 'processing', started_processing_at_epoch = ? WHERE id = ?`,
      [Date.now(), session1Processing]
    );

    const abandoned = store.markAllSessionsMessagesAbandoned([sessionDbId, session2Id]);

    expect(abandoned).toBe(3);

    const failedRows = db.query(`
      SELECT id, status, failed_at_epoch FROM pending_messages WHERE id IN (?, ?, ?)
    `).all(session1Pending, session1Processing, session2Pending) as Array<{
      id: number;
      status: string;
      failed_at_epoch: number | null;
    }>;

    expect(failedRows).toHaveLength(3);
    for (const row of failedRows) {
      expect(row.status).toBe('failed');
      expect(typeof row.failed_at_epoch).toBe('number');
    }

    const untouchedRow = db.query('SELECT status FROM pending_messages WHERE id = ?').get(untouched) as { status: string };
    expect(untouchedRow.status).toBe('pending');
  });

  test('markAllSessionsMessagesAbandoned returns 0 for empty input', () => {
    expect(store.markAllSessionsMessagesAbandoned([])).toBe(0);
  });
});
