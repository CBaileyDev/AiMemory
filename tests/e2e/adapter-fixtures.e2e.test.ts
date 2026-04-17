/**
 * Hook-payload fixture tests.
 *
 * Phase 1 defined per-IDE fixtures as "the single source of truth for
 * whether our adapter still understands this IDE's hook format." This
 * file replays real-shaped payloads through each adapter and asserts
 * the normalized output is well-formed.
 *
 * Fixtures live inline for auditability — each test's payload is an
 * exact quote of what the IDE emits to stdin.
 */

import { describe, it, expect } from 'bun:test';
import { claudeCodeAdapter } from '../../src/cli/adapters/claude-code.js';
import { geminiCliAdapter } from '../../src/cli/adapters/gemini-cli.js';
import { windsurfAdapter } from '../../src/cli/adapters/windsurf.js';
import { cursorAdapter } from '../../src/cli/adapters/cursor.js';

// ---------------------------------------------------------------------------
// Claude Code
// ---------------------------------------------------------------------------

describe('adapter: claude-code', () => {
  it('normalizes a PostToolUse payload', () => {
    const payload = {
      session_id: 'sess-abc',
      cwd: '/workspace',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_response: { output: 'file.txt\n' },
      transcript_path: '/tmp/transcript.jsonl',
    };
    const out = claudeCodeAdapter.normalizeInput(payload);
    expect(out.sessionId).toBe('sess-abc');
    expect(out.cwd).toBe('/workspace');
    expect(out.toolName).toBe('Bash');
    expect(out.toolResponse).toEqual({ output: 'file.txt\n' });
    expect(out.transcriptPath).toBe('/tmp/transcript.jsonl');
  });

  it('handles SessionStart with undefined stdin gracefully', () => {
    const out = claudeCodeAdapter.normalizeInput(undefined);
    expect(out.cwd).toBe(process.cwd());
    expect(out.sessionId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Gemini CLI — 11 lifecycle events, 8 mapped
// Source of truth: packages/core/src/hooks/types.ts in google-gemini/gemini-cli
// ---------------------------------------------------------------------------

describe('adapter: gemini-cli', () => {
  it('normalizes AfterTool with tool_name + tool_input + tool_response', () => {
    const payload = {
      session_id: 'gsess-1',
      cwd: '/proj',
      hook_event_name: 'AfterTool',
      timestamp: '2026-04-17T00:00:00Z',
      transcript_path: '/tmp/tx',
      tool_name: 'ReadFile',
      tool_input: { path: '/proj/file.ts' },
      tool_response: { content: 'ok' },
    };
    const out = geminiCliAdapter.normalizeInput(payload);
    expect(out.sessionId).toBe('gsess-1');
    expect(out.cwd).toBe('/proj');
    expect(out.toolName).toBe('ReadFile');
    expect(out.toolInput).toEqual({ path: '/proj/file.ts' });
    expect(out.toolResponse).toEqual({ content: 'ok' });
    expect(out.metadata?.hook_event_name).toBe('AfterTool');
  });

  it('synthesizes an observation shape for AfterAgent', () => {
    const payload = {
      session_id: 'gsess-2',
      cwd: '/proj',
      hook_event_name: 'AfterAgent',
      prompt: 'what changed?',
      prompt_response: 'A file was edited.',
      stop_hook_active: true,
    };
    const out = geminiCliAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('GeminiAgent');
    expect((out.toolInput as any).prompt).toBe('what changed?');
    expect((out.toolResponse as any).response).toBe('A file was edited.');
    expect(out.metadata?.stop_hook_active).toBe(true);
  });

  it('marks BeforeTool with pre-execution marker', () => {
    const payload = {
      session_id: 'gsess-3',
      cwd: '/proj',
      hook_event_name: 'BeforeTool',
      tool_name: 'Edit',
      tool_input: { file: '/proj/x.ts' },
    };
    const out = geminiCliAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('Edit');
    expect((out.toolResponse as any)._preExecution).toBe(true);
  });

  it('captures PreCompress trigger in metadata', () => {
    const payload = {
      session_id: 'gsess-4',
      cwd: '/proj',
      hook_event_name: 'PreCompress',
      trigger: 'auto',
    };
    const out = geminiCliAdapter.normalizeInput(payload);
    expect(out.metadata?.trigger).toBe('auto');
  });

  it('captures Notification details as observation', () => {
    const payload = {
      session_id: 'gsess-5',
      cwd: '/proj',
      hook_event_name: 'Notification',
      notification_type: 'ToolPermission',
      message: 'Permission requested for Bash',
      details: { tool: 'Bash' },
    };
    const out = geminiCliAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('GeminiNotification');
    expect(out.metadata?.notification_type).toBe('ToolPermission');
  });

  it('formatOutput always sets continue:true by default and strips ANSI', () => {
    const out = geminiCliAdapter.formatOutput({
      systemMessage: '\u001b[31mred text\u001b[0m and plain',
    }) as any;
    expect(out.continue).toBe(true);
    expect(out.systemMessage).toBe('red text and plain');
  });
});

// ---------------------------------------------------------------------------
// Windsurf — 11 Cascade hooks, 5 post-action hooks mapped
// Source of truth: docs.windsurf.com/windsurf/cascade/hooks
// ---------------------------------------------------------------------------

describe('adapter: windsurf', () => {
  it('normalizes pre_user_prompt to prompt', () => {
    const payload = {
      agent_action_name: 'pre_user_prompt',
      trajectory_id: 'traj-1',
      execution_id: 'exec-1',
      timestamp: '2026-04-17T00:00:00Z',
      tool_info: { user_prompt: 'fix the bug' },
    };
    const out = windsurfAdapter.normalizeInput(payload);
    expect(out.sessionId).toBe('traj-1');
    expect(out.prompt).toBe('fix the bug');
  });

  it('normalizes post_write_code with file_path and edits', () => {
    const payload = {
      agent_action_name: 'post_write_code',
      trajectory_id: 'traj-2',
      tool_info: {
        file_path: '/proj/index.ts',
        edits: [{ old_string: 'a', new_string: 'b' }],
      },
    };
    const out = windsurfAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('Write');
    expect(out.filePath).toBe('/proj/index.ts');
    expect(out.edits).toHaveLength(1);
  });

  it('normalizes post_run_command with cwd override', () => {
    const payload = {
      agent_action_name: 'post_run_command',
      trajectory_id: 'traj-3',
      tool_info: { command_line: 'npm test', cwd: '/proj/subdir' },
    };
    const out = windsurfAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('Bash');
    expect((out.toolInput as any).command).toBe('npm test');
    expect(out.cwd).toBe('/proj/subdir');
  });

  it('normalizes post_mcp_tool_use preserving server + tool name', () => {
    const payload = {
      agent_action_name: 'post_mcp_tool_use',
      trajectory_id: 'traj-4',
      tool_info: {
        mcp_server_name: 'context7',
        mcp_tool_name: 'fetch',
        mcp_tool_arguments: { url: 'https://example.com' },
        mcp_result: '<html>...</html>',
      },
    };
    const out = windsurfAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('fetch');
    expect((out.toolInput as any).url).toBe('https://example.com');
    expect(out.toolResponse).toContain('<html>');
  });

  it('normalizes post_cascade_response as full AI response', () => {
    const payload = {
      agent_action_name: 'post_cascade_response',
      trajectory_id: 'traj-5',
      tool_info: { response: '# Done\n\nAll tests pass.' },
    };
    const out = windsurfAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('cascade_response');
    expect(out.toolResponse).toContain('All tests pass.');
  });

  it('gracefully degrades on unknown action', () => {
    const out = windsurfAdapter.normalizeInput({
      agent_action_name: 'post_future_hook',
      trajectory_id: 'traj-x',
      tool_info: {},
    });
    expect(out.sessionId).toBe('traj-x');
    expect(out.toolName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cursor — limited adapter; at minimum it must not crash on known payloads
// ---------------------------------------------------------------------------

describe('adapter: cursor', () => {
  it('normalizes beforeSubmitPrompt with conversation_id + workspace_roots', () => {
    const payload = {
      conversation_id: 'c-sess',
      workspace_roots: ['/proj'],
      prompt: 'hello',
    };
    const out = cursorAdapter.normalizeInput(payload);
    expect(out.sessionId).toBe('c-sess');
    expect(out.cwd).toBe('/proj');
    expect(out.prompt).toBe('hello');
  });

  it('normalizes afterShellExecution with command/output', () => {
    const payload = {
      conversation_id: 'c-sess-2',
      workspace_roots: ['/proj'],
      command: 'echo hi',
      output: 'hi\n',
    };
    const out = cursorAdapter.normalizeInput(payload);
    expect(out.toolName).toBe('Bash');
    expect((out.toolInput as any).command).toBe('echo hi');
    expect((out.toolResponse as any).output).toBe('hi\n');
  });

  it('normalizes afterFileEdit with edits array', () => {
    const payload = {
      conversation_id: 'c-sess-3',
      workspace_roots: ['/proj'],
      file_path: '/proj/a.ts',
      edits: [{ old_string: 'x', new_string: 'y' }],
    };
    const out = cursorAdapter.normalizeInput(payload);
    expect(out.filePath).toBe('/proj/a.ts');
    expect(out.edits).toHaveLength(1);
  });
});
