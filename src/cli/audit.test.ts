import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditLogger, type AuditEvent, type AuditEventType } from './audit.js';

describe('AuditLogger', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
  });

  it('does not emit when disabled', () => {
    const logger = new AuditLogger(false);
    logger.create({ resourceId: 'abc', expiresAt: '2024-01-01T00:00:00Z', ttlSeconds: 3600 });
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('does not emit when disabled but CONFIDANT_AUDIT is not set', () => {
    const origAudit = process.env.CONFIDANT_AUDIT;
    delete process.env.CONFIDANT_AUDIT;
    const logger = new AuditLogger();
    logger.create({ resourceId: 'abc', expiresAt: '2024-01-01T00:00:00Z', ttlSeconds: 3600 });
    expect(stdoutWrite).not.toHaveBeenCalled();
    process.env.CONFIDANT_AUDIT = origAudit;
  });

  it('emits when enabled via constructor', () => {
    const logger = new AuditLogger(true);
    logger.create({ resourceId: 'abc', expiresAt: '2024-01-01T00:00:00Z', ttlSeconds: 3600 });

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const call = stdoutWrite.mock.calls[0][0] as string;
    const event: AuditEvent = JSON.parse(call);

    expect(event.type).toBe('create');
    expect(event.resourceId).toBe('abc');
    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.ttlSeconds).toBe(3600);
  });

  it('emits when enabled via CONFIDANT_AUDIT env var', () => {
    const origAudit = process.env.CONFIDANT_AUDIT;
    process.env.CONFIDANT_AUDIT = '1';
    const logger = new AuditLogger();
    logger.retrieve({ resourceId: 'xyz', savedTo: '/tmp/secret' });
    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    process.env.CONFIDANT_AUDIT = origAudit;
  });

  it('can be toggled at runtime', () => {
    const logger = new AuditLogger(false);
    expect(logger.isActive).toBe(false);

    logger.setEnabled(true);
    expect(logger.isActive).toBe(true);

    logger.create({ resourceId: 'abc', expiresAt: '2024-01-01T00:00:00Z' });
    expect(stdoutWrite).toHaveBeenCalledTimes(1);

    logger.setEnabled(false);
    logger.create({ resourceId: 'def', expiresAt: '2024-01-01T00:00:00Z' });
    expect(stdoutWrite).toHaveBeenCalledTimes(1); // still 1, second was skipped
  });

  it('emit produces valid JSON on a single line', () => {
    const logger = new AuditLogger(true);
    logger.emit({ type: 'delete', resourceId: 'del-1' });

    const call = stdoutWrite.mock.calls[0][0] as string;
    // Should be a single line ending with \n
    expect(call.endsWith('\n')).toBe(true);
    expect(call.split('\n').length).toBe(2); // one line + trailing newline

    const parsed = JSON.parse(call);
    expect(parsed.type).toBe('delete');
    expect(parsed.resourceId).toBe('del-1');
  });

  it('includes framework info when provided', () => {
    const logger = new AuditLogger(true);
    logger.retrieve({
      resourceId: 'abc',
      savedTo: '/tmp/key',
      framework: 'openclaw',
    });

    const parsed = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(parsed.framework).toBe('openclaw');
    expect(parsed.savedTo).toBe('/tmp/key');
  });
});

describe('AuditLogger convenience methods', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
  });

  it('create method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.create({
      resourceId: 'sec-1',
      expiresAt: '2024-06-01T00:00:00Z',
      ttlSeconds: 86400,
      label: 'API Key',
    });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('create');
    expect(event.resourceId).toBe('sec-1');
    expect(event.label).toBe('API Key');
  });

  it('retrieve method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.retrieve({
      resourceId: 'sec-1',
      savedTo: '/tmp/secret',
      envVar: 'MY_KEY',
    });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('retrieve');
    expect(event.savedTo).toBe('/tmp/secret');
    expect(event.envVar).toBe('MY_KEY');
  });

  it('consume method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.consume({ resourceId: 'sec-1' });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('consume');
  });

  it('expire method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.expire({ resourceId: 'sec-1', label: 'Old Key' });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('expire');
    expect(event.label).toBe('Old Key');
  });

  it('delete method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.delete({ resourceId: 'sec-1' });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('delete');
  });

  it('requestCreate method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.requestCreate({
      resourceId: 'req-1',
      resourceHash: 'abc123',
      expiresAt: '2024-06-01T00:00:00Z',
      ttlSeconds: 3600,
      label: 'Token',
    });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('request_create');
    expect(event.resourceHash).toBe('abc123');
    expect(event.ttlSeconds).toBe(3600);
  });

  it('requestPoll method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.requestPoll({ resourceId: 'req-1', status: 'pending' });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('request_poll');
  });

  it('requestCompleted method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.requestCompleted({ resourceId: 'req-1', savedTo: '/tmp/key' });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('request_completed');
    expect(event.savedTo).toBe('/tmp/key');
  });

  it('requestExpired method emits correct type', () => {
    const logger = new AuditLogger(true);
    logger.requestExpired({ resourceId: 'req-1', label: 'Old Request' });

    const event = JSON.parse(stdoutWrite.mock.calls[0][0] as string) as AuditEvent;
    expect(event.type).toBe('request_expired');
    expect(event.label).toBe('Old Request');
  });
});

describe('AuditEventType', () => {
  it('includes all required event types', () => {
    const types: AuditEventType[] = [
      'create', 'retrieve', 'consume', 'expire', 'delete',
      'request_create', 'request_poll', 'request_completed', 'request_expired',
      'server_start', 'server_stop',
    ];
    // TypeScript compilation ensures the union type includes these
    expect(types).toHaveLength(11);
  });
});
