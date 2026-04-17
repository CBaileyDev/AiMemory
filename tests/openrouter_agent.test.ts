import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { OpenRouterAgent } from '../src/services/worker/OpenRouterAgent';
import { DatabaseManager } from '../src/services/worker/DatabaseManager';
import { SessionManager } from '../src/services/worker/SessionManager';
import { ModeManager } from '../src/services/domain/ModeManager';
import { SettingsDefaultsManager } from '../src/shared/SettingsDefaultsManager';

const mockMode = {
  name: 'code',
  prompts: {
    init: 'init prompt',
    observation: 'obs prompt',
    summary: 'summary prompt'
  },
  observation_types: [{ id: 'discovery' }, { id: 'bugfix' }],
  observation_concepts: []
};

let loadFromFileSpy: ReturnType<typeof spyOn>;
let modeManagerSpy: ReturnType<typeof spyOn>;

describe('OpenRouterAgent', () => {
  let agent: OpenRouterAgent;
  let originalFetch: typeof global.fetch;

  let mockStoreObservations: any;
  let mockSyncObservation: any;
  let mockSyncSummary: any;
  let mockDbManager: DatabaseManager;
  let mockSessionManager: SessionManager;

  beforeEach(() => {
    modeManagerSpy = spyOn(ModeManager, 'getInstance').mockImplementation(() => ({
      getActiveMode: () => mockMode,
      loadMode: () => {},
    } as any));

    loadFromFileSpy = spyOn(SettingsDefaultsManager, 'loadFromFile').mockImplementation(() => ({
      ...SettingsDefaultsManager.getAllDefaults(),
      CLAUDE_MEM_OPENROUTER_API_KEY: 'test-openrouter-key',
      CLAUDE_MEM_OPENROUTER_MODEL: 'openrouter/test-model',
      CLAUDE_MEM_DATA_DIR: '/tmp/claude-mem-test',
    }));

    mockStoreObservations = mock(() => ({
      observationIds: [1],
      summaryId: null,
      createdAtEpoch: Date.now()
    }));
    mockSyncObservation = mock(() => Promise.resolve());
    mockSyncSummary = mock(() => Promise.resolve());

    const mockSessionStore = {
      storeObservations: mockStoreObservations,
      markSessionCompleted: mock(() => {}),
      getSessionById: mock(() => ({ memory_session_id: 'mem-session-123' })),
      ensureMemorySessionIdRegistered: mock(() => {}),
      updateMemorySessionId: mock(() => {})
    };

    const mockChromaSync = {
      syncObservation: mockSyncObservation,
      syncSummary: mockSyncSummary
    };

    mockDbManager = {
      getSessionStore: () => mockSessionStore,
      getChromaSync: () => mockChromaSync
    } as unknown as DatabaseManager;

    const mockPendingMessageStore = {
      confirmProcessed: mock(() => {}),
      cleanupProcessed: mock(() => 0),
      resetStuckMessages: mock(() => 0)
    };

    mockSessionManager = {
      getMessageIterator: async function* () { yield* []; },
      getPendingMessageStore: () => mockPendingMessageStore
    } as unknown as SessionManager;

    agent = new OpenRouterAgent(mockDbManager, mockSessionManager);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (modeManagerSpy) modeManagerSpy.mockRestore();
    if (loadFromFileSpy) loadFromFileSpy.mockRestore();
    mock.restore();
  });

  it('includes prior assistant responses in follow-up context', async () => {
    const session = {
      sessionDbId: 1,
      contentSessionId: 'test-session',
      memorySessionId: 'mem-session-123',
      project: 'test-project',
      platformSource: 'claude-code',
      userPrompt: 'test prompt',
      conversationHistory: [],
      lastPromptNumber: 1,
      cumulativeInputTokens: 0,
      cumulativeOutputTokens: 0,
      pendingMessages: [],
      abortController: new AbortController(),
      generatorPromise: null,
      earliestPendingTimestamp: null,
      currentProvider: null,
      consecutiveRestarts: 0,
      lastGeneratorActivity: Date.now(),
      startTime: Date.now(),
      processingMessageIds: []
    } as any;

    mockSessionManager.getMessageIterator = async function* () {
      yield {
        _persistentId: 101,
        _originalTimestamp: Date.now(),
        type: 'observation',
        tool_name: 'Read',
        tool_input: { file_path: 'src/index.ts' },
        tool_response: { content: 'export const x = 1;' },
        prompt_number: 2,
        cwd: '/tmp/project'
      };
    };

    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: '<observation><type>discovery</type><title>Test</title></observation>'
        }
      }],
      usage: { total_tokens: 42 }
    }))));

    await agent.startSession(session);

    const secondRequest = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    expect(
      secondRequest.messages.some((message: { role: string; content: string }) =>
        message.role === 'assistant' && message.content.includes('<observation><type>discovery</type><title>Test</title></observation>')
      )
    ).toBe(true);
  });

  it('skips processing empty follow-up responses to preserve the claimed message', async () => {
    const session = {
      sessionDbId: 1,
      contentSessionId: 'test-session',
      memorySessionId: 'mem-session-123',
      project: 'test-project',
      platformSource: 'claude-code',
      userPrompt: 'test prompt',
      conversationHistory: [],
      lastPromptNumber: 1,
      cumulativeInputTokens: 0,
      cumulativeOutputTokens: 0,
      pendingMessages: [],
      abortController: new AbortController(),
      generatorPromise: null,
      earliestPendingTimestamp: null,
      currentProvider: null,
      consecutiveRestarts: 0,
      lastGeneratorActivity: Date.now(),
      startTime: Date.now(),
      processingMessageIds: []
    } as any;

    mockSessionManager.getMessageIterator = async function* () {
      yield {
        _persistentId: 202,
        _originalTimestamp: Date.now(),
        type: 'observation',
        tool_name: 'Read',
        tool_input: { file_path: 'src/index.ts' },
        tool_response: { content: 'export const x = 1;' },
        prompt_number: 2,
        cwd: '/tmp/project'
      };
    };

    (global.fetch as any) = mock()
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: '<observation><type>discovery</type><title>Init</title></observation>'
          }
        }],
        usage: { total_tokens: 20 }
      }))))
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: ''
          }
        }]
      }))));

    await agent.startSession(session);

    expect(mockStoreObservations).toHaveBeenCalledTimes(1);
    expect(session.processingMessageIds).toEqual([202]);
  });

  it('preserves assistant context across summarize turns and stores the summary response', async () => {
    const session = {
      sessionDbId: 1,
      contentSessionId: 'test-session',
      memorySessionId: 'mem-session-123',
      project: 'test-project',
      platformSource: 'claude-code',
      userPrompt: 'test prompt',
      conversationHistory: [],
      lastPromptNumber: 1,
      cumulativeInputTokens: 0,
      cumulativeOutputTokens: 0,
      pendingMessages: [],
      abortController: new AbortController(),
      generatorPromise: null,
      earliestPendingTimestamp: null,
      currentProvider: null,
      consecutiveRestarts: 0,
      lastGeneratorActivity: Date.now(),
      startTime: Date.now(),
      processingMessageIds: []
    } as any;

    mockSessionManager.getMessageIterator = async function* () {
      yield {
        _persistentId: 303,
        _originalTimestamp: Date.now(),
        type: 'summarize',
        last_assistant_message: 'assistant wrap-up',
      };
    };

    mockStoreObservations
      .mockImplementationOnce(() => ({
        observationIds: [1],
        summaryId: null,
        createdAtEpoch: Date.now()
      }))
      .mockImplementationOnce(() => ({
        observationIds: [],
        summaryId: 99,
        createdAtEpoch: Date.now()
      }));

    (global.fetch as any) = mock()
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: '<observation><type>discovery</type><title>Init context</title></observation>'
          }
        }],
        usage: { total_tokens: 20 }
      }))))
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: `<summary>
              <request>test prompt</request>
              <investigated>Summarize the session state</investigated>
              <learned>The shared loop kept context</learned>
              <completed>Stored the summary</completed>
              <next_steps>None</next_steps>
            </summary>`
          }
        }],
        usage: { total_tokens: 25 }
      }))));

    await agent.startSession(session);

    const secondRequest = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    expect(
      secondRequest.messages.some((message: { role: string; content: string }) =>
        message.role === 'assistant' && message.content.includes('Init context')
      )
    ).toBe(true);
    expect(mockStoreObservations).toHaveBeenCalledTimes(2);
    expect(mockSyncSummary).toHaveBeenCalled();
    expect(session.lastSummaryStored).toBe(true);
  });
});
