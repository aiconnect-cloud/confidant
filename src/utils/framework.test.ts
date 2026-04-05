import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectFramework,
  isOpenClawWorkspace,
  isInAgentFramework,
  getOpenClawConfigPath,
  type AgentFramework,
} from './framework.js';

describe('detectFramework', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all framework-related env vars
    delete process.env.OPENCLAW_WORKSPACE;
    delete process.env.OPENCLAW_VERSION;
    delete process.env.CURSOR_AGENT_ID;
    delete process.env.CURSOR_WORKSPACE;
    delete process.env.NANOBOT_ENV;
    delete process.env.NANOBOT_VERSION;
    delete process.env.CODEX_SANDBOX;
    delete process.env.GEMINI_CLI_VERSION;
    delete process.env.QWEN_AGENT;
    delete process.env.KIRO_AGENT;
    delete process.env.FACTORY_DROID_ENV;
    delete process.env.KILOCODE_ENV;
    delete process.env.IFLOW_ENV;
    delete process.env.OPENCODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns unknown when no framework env vars are set', () => {
    const info = detectFramework();
    expect(info.framework).toBe('unknown');
    expect(info.displayName).toBe('Unknown');
    expect(info.detectedVia).toEqual([]);
  });

  it('detects OpenClaw via OPENCLAW_WORKSPACE', () => {
    process.env.OPENCLAW_WORKSPACE = '/some/path';
    const info = detectFramework();
    expect(info.framework).toBe('openclaw');
    expect(info.displayName).toBe('OpenClaw');
    expect(info.detectedVia).toContain('OPENCLAW_WORKSPACE');
    expect(info.configPath).toBe('skills.entries.<label>.env');
  });

  it('detects OpenClaw via OPENCLAW_VERSION', () => {
    process.env.OPENCLAW_VERSION = '1.0.0';
    const info = detectFramework();
    expect(info.framework).toBe('openclaw');
    expect(info.displayName).toBe('OpenClaw');
  });

  it('detects Cursor via CURSOR_AGENT_ID', () => {
    process.env.CURSOR_AGENT_ID = 'abc123';
    const info = detectFramework();
    expect(info.framework).toBe('cursor');
    expect(info.displayName).toBe('Cursor');
  });

  it('detects Nanobot via NANOBOT_ENV', () => {
    process.env.NANOBOT_ENV = '1';
    const info = detectFramework();
    expect(info.framework).toBe('nanobot');
    expect(info.displayName).toBe('Nanobot');
  });

  it('detects Gemini CLI via GEMINI_CLI_VERSION', () => {
    process.env.GEMINI_CLI_VERSION = '1.0.0';
    const info = detectFramework();
    expect(info.framework).toBe('gemini-cli');
    expect(info.displayName).toBe('Gemini CLI');
  });

  it('detects Qwen via QWEN_AGENT', () => {
    process.env.QWEN_AGENT = '1';
    const info = detectFramework();
    expect(info.framework).toBe('qwen');
    expect(info.displayName).toBe('Qwen');
  });

  it('detects Kiro via KIRO_AGENT', () => {
    process.env.KIRO_AGENT = '1';
    const info = detectFramework();
    expect(info.framework).toBe('kiro');
    expect(info.displayName).toBe('Kiro');
  });

  it('detects Factory Droid via FACTORY_DROID_ENV', () => {
    process.env.FACTORY_DROID_ENV = '1';
    const info = detectFramework();
    expect(info.framework).toBe('factory-droid');
    expect(info.displayName).toBe('Factory Droid');
  });

  it('detects Kilocode via KILOCODE_ENV', () => {
    process.env.KILOCODE_ENV = '1';
    const info = detectFramework();
    expect(info.framework).toBe('kilocode');
    expect(info.displayName).toBe('Kilocode');
  });

  it('detects iFlow via IFLOW_ENV', () => {
    process.env.IFLOW_ENV = '1';
    const info = detectFramework();
    expect(info.framework).toBe('iflow');
    expect(info.displayName).toBe('iFlow');
  });

  it('detects OpenCode via OPENCODE_ENV', () => {
    process.env.OPENCODE_ENV = '1';
    const info = detectFramework();
    expect(info.framework).toBe('opencode');
    expect(info.displayName).toBe('OpenCode');
  });

  it('detects Codex via CODEX_SANDBOX', () => {
    process.env.CODEX_SANDBOX = '1';
    const info = detectFramework();
    expect(info.framework).toBe('codex');
    expect(info.displayName).toBe('Codex');
  });

  it('prioritizes OpenClaw when multiple env vars are set', () => {
    // OpenClaw is first in the signal list, so it should win
    process.env.OPENCLAW_WORKSPACE = '/path';
    process.env.CURSOR_AGENT_ID = 'abc';
    const info = detectFramework();
    expect(info.framework).toBe('openclaw');
  });
});

describe('isOpenClawWorkspace', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENCLAW_WORKSPACE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true when OPENCLAW_WORKSPACE is set', () => {
    process.env.OPENCLAW_WORKSPACE = '/workspace';
    expect(isOpenClawWorkspace()).toBe(true);
  });

  it('returns false when OPENCLAW_WORKSPACE is not set', () => {
    expect(isOpenClawWorkspace()).toBe(false);
  });
});

describe('isInAgentFramework', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENCLAW_WORKSPACE;
    delete process.env.OPENCLAW_VERSION;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true when a framework is detected', () => {
    process.env.OPENCLAW_WORKSPACE = '/path';
    expect(isInAgentFramework()).toBe(true);
  });

  it('returns false when no framework is detected', () => {
    expect(isInAgentFramework()).toBe(false);
  });
});

describe('getOpenClawConfigPath', () => {
  it('generates correct path for simple label', () => {
    const path = getOpenClawConfigPath('openai', 'OPENAI_API_KEY');
    expect(path).toBe('skills.entries.openai.env.OPENAI_API_KEY');
  });

  it('sanitizes labels with special characters', () => {
    const path = getOpenClawConfigPath('My Service!', 'API_KEY');
    expect(path).toBe('skills.entries.my-service.env.API_KEY');
  });

  it('handles labels with spaces', () => {
    const path = getOpenClawConfigPath('my service', 'TOKEN');
    expect(path).toBe('skills.entries.my-service.env.TOKEN');
  });

  it('strips leading/trailing hyphens', () => {
    const path = getOpenClawConfigPath('--test--', 'KEY');
    expect(path).toBe('skills.entries.test.env.KEY');
  });

  it('preserves underscores and numbers in labels', () => {
    const path = getOpenClawConfigPath('my_service_2', 'SECRET');
    expect(path).toBe('skills.entries.my_service_2.env.SECRET');
  });
});
