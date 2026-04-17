import { buildContinuationPrompt, buildInitPrompt, buildObservationPrompt, buildSummaryPrompt } from '../../sdk/prompts.js';
import { logger } from '../../utils/logger.js';
import { ModeManager } from '../domain/ModeManager.js';
import type { ActiveSession, ConversationMessage, PendingMessageWithId } from '../worker-types.js';
import { DatabaseManager } from './DatabaseManager.js';
import { SessionManager } from './SessionManager.js';
import {
  isAbortError,
  processAgentResponse,
  shouldFallbackToClaude,
  type FallbackAgent,
  type WorkerRef
} from './agents/index.js';

export interface ModelQueryResult {
  content: string;
  tokensUsed?: number;
  modelId?: string;
}

export abstract class BaseRESTAgent {
  protected dbManager: DatabaseManager;
  protected sessionManager: SessionManager;
  protected fallbackAgent: FallbackAgent | null = null;

  constructor(dbManager: DatabaseManager, sessionManager: SessionManager) {
    this.dbManager = dbManager;
    this.sessionManager = sessionManager;
  }

  setFallbackAgent(agent: FallbackAgent): void {
    this.fallbackAgent = agent;
  }

  protected abstract get providerName(): string;
  protected abstract get sessionIdPrefix(): string;
  protected abstract queryModel(history: ConversationMessage[]): Promise<ModelQueryResult>;
  protected abstract validateConfig(): void;

  async startSession(session: ActiveSession, worker?: WorkerRef): Promise<void> {
    try {
      this.validateConfig();

      if (!session.memorySessionId) {
        const syntheticMemorySessionId = `${this.sessionIdPrefix}-${session.contentSessionId}-${Date.now()}`;
        session.memorySessionId = syntheticMemorySessionId;
        this.dbManager.getSessionStore().updateMemorySessionId(session.sessionDbId, syntheticMemorySessionId);
        logger.info('SESSION', `MEMORY_ID_GENERATED | sessionDbId=${session.sessionDbId} | provider=${this.providerName}`);
      }

      const mode = ModeManager.getInstance().getActiveMode();
      const initPrompt = session.lastPromptNumber === 1
        ? buildInitPrompt(session.project, session.contentSessionId, session.userPrompt, mode)
        : buildContinuationPrompt(session.userPrompt, session.lastPromptNumber, session.contentSessionId, mode);

      session.conversationHistory.push({ role: 'user', content: initPrompt });
      const initResponse = await this.queryModel(session.conversationHistory);

      if (initResponse.content) {
        session.conversationHistory.push({ role: 'assistant', content: initResponse.content });
        this.trackTokenUsage(session, initResponse.tokensUsed || 0);

        await processAgentResponse(
          initResponse.content,
          session,
          this.dbManager,
          this.sessionManager,
          worker,
          initResponse.tokensUsed || 0,
          null,
          this.providerName,
          undefined,
          initResponse.modelId
        );
      } else {
        logger.error('SDK', `Empty ${this.providerName} init response - session may lack context`, {
          sessionId: session.sessionDbId,
          model: initResponse.modelId
        });
      }

      let lastCwd: string | undefined;
      let lastModelId = initResponse.modelId;

      for await (const message of this.sessionManager.getMessageIterator(session.sessionDbId)) {
        session.processingMessageIds.push(message._persistentId);

        if (message.cwd) {
          lastCwd = message.cwd;
        }
        const originalTimestamp = session.earliestPendingTimestamp;

        const prompt = this.buildMessagePrompt(session, message, mode, originalTimestamp);
        if (prompt === null) {
          continue;
        }

        session.conversationHistory.push({ role: 'user', content: prompt });
        const response = await this.queryModel(session.conversationHistory);
        lastModelId = response.modelId ?? lastModelId;

        let tokensUsed = 0;
        if (response.content) {
          session.conversationHistory.push({ role: 'assistant', content: response.content });
          tokensUsed = response.tokensUsed || 0;
          this.trackTokenUsage(session, tokensUsed);
        }

        if (response.content) {
          await processAgentResponse(
            response.content,
            session,
            this.dbManager,
            this.sessionManager,
            worker,
            tokensUsed,
            originalTimestamp,
            this.providerName,
            lastCwd,
            response.modelId
          );
        } else {
          logger.warn('SDK', `Empty ${this.providerName} ${message.type} response, skipping processing to preserve message`, {
            sessionId: session.sessionDbId,
            messageId: session.processingMessageIds[session.processingMessageIds.length - 1]
          });
        }
      }

      const sessionDuration = Date.now() - session.startTime;
      logger.success('SDK', `${this.providerName} agent completed`, {
        sessionId: session.sessionDbId,
        duration: `${(sessionDuration / 1000).toFixed(1)}s`,
        historyLength: session.conversationHistory.length,
        model: lastModelId
      });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        logger.warn('SDK', `${this.providerName} agent aborted`, { sessionId: session.sessionDbId });
        throw error;
      }

      if (shouldFallbackToClaude(error) && this.fallbackAgent) {
        logger.warn('SDK', `${this.providerName} API failed, falling back to Claude SDK`, {
          sessionDbId: session.sessionDbId,
          error: error instanceof Error ? error.message : String(error),
          historyLength: session.conversationHistory.length
        });

        return this.fallbackAgent.startSession(session, worker);
      }

      logger.failure('SDK', `${this.providerName} agent error`, { sessionDbId: session.sessionDbId }, error as Error);
      throw error;
    }
  }

  private trackTokenUsage(session: ActiveSession, tokensUsed: number): void {
    session.cumulativeInputTokens += Math.floor(tokensUsed * 0.7);
    session.cumulativeOutputTokens += Math.floor(tokensUsed * 0.3);
  }

  private buildMessagePrompt(
    session: ActiveSession,
    message: PendingMessageWithId,
    mode: ReturnType<ModeManager['getActiveMode']>,
    originalTimestamp: number | null
  ): string | null {
    if (message.type === 'observation') {
      if (message.prompt_number !== undefined) {
        session.lastPromptNumber = message.prompt_number;
      }

      if (!session.memorySessionId) {
        throw new Error('Cannot process observations: memorySessionId not yet captured. This session may need to be reinitialized.');
      }

      return buildObservationPrompt({
        id: 0,
        tool_name: message.tool_name!,
        tool_input: JSON.stringify(message.tool_input),
        tool_output: JSON.stringify(message.tool_response),
        created_at_epoch: originalTimestamp ?? Date.now(),
        cwd: message.cwd
      });
    }

    if (message.type === 'summarize') {
      if (!session.memorySessionId) {
        throw new Error('Cannot process summary: memorySessionId not yet captured. This session may need to be reinitialized.');
      }

      return buildSummaryPrompt({
        id: session.sessionDbId,
        memory_session_id: session.memorySessionId,
        project: session.project,
        user_prompt: session.userPrompt,
        last_assistant_message: message.last_assistant_message || ''
      }, mode);
    }

    return null;
  }
}
