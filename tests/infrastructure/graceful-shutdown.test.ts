import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import http from 'http';
import {
  performGracefulShutdown,
  writePidFile,
  removePidFile,
  type GracefulShutdownConfig,
  type ShutdownableService,
  type CloseableClient,
  type CloseableDatabase
} from '../../src/services/infrastructure/index.js';

describe('GracefulShutdown', () => {
  const originalPlatform = process.platform;
  let testDataDir: string;
  let pidFilePath: string;

  beforeEach(() => {
    testDataDir = path.join(tmpdir(), `claude-mem-graceful-shutdown-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    pidFilePath = path.join(testDataDir, 'worker.pid');
    process.env.CLAUDE_MEM_DATA_DIR = testDataDir;
    mkdirSync(testDataDir, { recursive: true });

    // Ensure we're testing on non-Windows to avoid child process enumeration
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    delete process.env.CLAUDE_MEM_DATA_DIR;
    rmSync(testDataDir, { recursive: true, force: true });

    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  describe('performGracefulShutdown', () => {
    it('should call shutdown steps in correct order', async () => {
      const callOrder: string[] = [];

      const mockServer = {
        closeAllConnections: mock(() => {
          callOrder.push('closeAllConnections');
        }),
        close: mock((cb: (err?: Error) => void) => {
          callOrder.push('serverClose');
          cb();
        })
      } as unknown as http.Server;

      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {
          callOrder.push('sessionManager.shutdownAll');
        })
      };

      const mockMcpClient: CloseableClient = {
        close: mock(async () => {
          callOrder.push('mcpClient.close');
        })
      };

      const mockDbManager: CloseableDatabase = {
        close: mock(async () => {
          callOrder.push('dbManager.close');
        })
      };

      const mockChromaMcpManager = {
        stop: mock(async () => {
          callOrder.push('chromaMcpManager.stop');
        })
      };

      // Create a PID file so we can verify it's removed
      writePidFile({ pid: 12345, port: 37777, startedAt: new Date().toISOString() });
      expect(existsSync(pidFilePath)).toBe(true);

      const config: GracefulShutdownConfig = {
        server: mockServer,
        sessionManager: mockSessionManager,
        mcpClient: mockMcpClient,
        dbManager: mockDbManager,
        chromaMcpManager: mockChromaMcpManager
      };

      await performGracefulShutdown(config);

      // Verify order: PID removal happens first (synchronous), then server, then session, then MCP, then Chroma, then DB
      expect(callOrder).toContain('closeAllConnections');
      expect(callOrder).toContain('serverClose');
      expect(callOrder).toContain('sessionManager.shutdownAll');
      expect(callOrder).toContain('mcpClient.close');
      expect(callOrder).toContain('chromaMcpManager.stop');
      expect(callOrder).toContain('dbManager.close');

      // Verify server closes before session manager
      expect(callOrder.indexOf('serverClose')).toBeLessThan(callOrder.indexOf('sessionManager.shutdownAll'));

      // Verify session manager shuts down before MCP client
      expect(callOrder.indexOf('sessionManager.shutdownAll')).toBeLessThan(callOrder.indexOf('mcpClient.close'));

      // Verify MCP closes before database
      expect(callOrder.indexOf('mcpClient.close')).toBeLessThan(callOrder.indexOf('dbManager.close'));

      // Verify Chroma stops before DB closes
      expect(callOrder.indexOf('chromaMcpManager.stop')).toBeLessThan(callOrder.indexOf('dbManager.close'));
    });

    it('should remove PID file during shutdown', async () => {
      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {})
      };

      // Create PID file
      writePidFile({ pid: 99999, port: 37777, startedAt: new Date().toISOString() });
      expect(existsSync(pidFilePath)).toBe(true);

      const config: GracefulShutdownConfig = {
        server: null,
        sessionManager: mockSessionManager
      };

      await performGracefulShutdown(config);

      // PID file should be removed
      expect(existsSync(pidFilePath)).toBe(false);
    });

    it('should handle missing optional services gracefully', async () => {
      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {})
      };

      const config: GracefulShutdownConfig = {
        server: null,
        sessionManager: mockSessionManager
        // mcpClient and dbManager are undefined
      };

      // Should not throw
      await expect(performGracefulShutdown(config)).resolves.toBeUndefined();

      // Session manager should still be called
      expect(mockSessionManager.shutdownAll).toHaveBeenCalled();
    });

    it('should handle null server gracefully', async () => {
      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {})
      };

      const config: GracefulShutdownConfig = {
        server: null,
        sessionManager: mockSessionManager
      };

      // Should not throw
      await expect(performGracefulShutdown(config)).resolves.toBeUndefined();
    });

    it('should call sessionManager.shutdownAll even without server', async () => {
      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {})
      };

      const config: GracefulShutdownConfig = {
        server: null,
        sessionManager: mockSessionManager
      };

      await performGracefulShutdown(config);

      expect(mockSessionManager.shutdownAll).toHaveBeenCalledTimes(1);
    });

    it('should stop chroma server before database close', async () => {
      const callOrder: string[] = [];

      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {
          callOrder.push('sessionManager');
        })
      };

      const mockMcpClient: CloseableClient = {
        close: mock(async () => {
          callOrder.push('mcpClient');
        })
      };

      const mockDbManager: CloseableDatabase = {
        close: mock(async () => {
          callOrder.push('dbManager');
        })
      };

      const mockChromaMcpManager = {
        stop: mock(async () => {
          callOrder.push('chromaMcpManager');
        })
      };

      const config: GracefulShutdownConfig = {
        server: null,
        sessionManager: mockSessionManager,
        mcpClient: mockMcpClient,
        dbManager: mockDbManager,
        chromaMcpManager: mockChromaMcpManager
      };

      await performGracefulShutdown(config);

      expect(callOrder).toEqual(['sessionManager', 'mcpClient', 'chromaMcpManager', 'dbManager']);
    });

    it('should handle shutdown when PID file does not exist', async () => {
      // Ensure PID file doesn't exist
      removePidFile();
      expect(existsSync(pidFilePath)).toBe(false);

      const mockSessionManager: ShutdownableService = {
        shutdownAll: mock(async () => {})
      };

      const config: GracefulShutdownConfig = {
        server: null,
        sessionManager: mockSessionManager
      };

      // Should not throw
      await expect(performGracefulShutdown(config)).resolves.toBeUndefined();
    });
  });
});
