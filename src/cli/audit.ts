/**
 * Audit Logger — JSON audit events emitted to stdout (one per line).
 *
 * Each event is a single JSON object with a consistent schema, suitable
 * for consumption by external systems (Convex, log processors, SIEM, etc.).
 *
 * Usage: import { auditLogger, AuditEvent, AuditEventType } from './cli/audit.js';
 *        auditLogger.emit({ type: 'create', ... });
 */

import { randomUUID } from 'crypto';

// ── Event Types ─────────────────────────────────────────────────────────────

export type AuditEventType = 'create' | 'retrieve' | 'consume' | 'expire' | 'delete' | 'request_create' | 'request_poll' | 'request_completed' | 'request_expired' | 'server_start' | 'server_stop';

export interface AuditEvent {
  /** Unique event ID (UUID v4) */
  eventId: string;
  /** Event type discriminator */
  type: AuditEventType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Confidant version (if available) */
  version?: string;
  /** Target resource ID (secret id, request id, etc.) */
  resourceId?: string;
  /** Resource hash (for request URLs) */
  resourceHash?: string;
  /** Optional label associated with the resource */
  label?: string;
  /** Expiration ISO timestamp (if applicable) */
  expiresAt?: string;
  /** TTL in seconds (if applicable) */
  ttlSeconds?: number;
  /** Output path where secret was saved (if applicable) */
  savedTo?: string;
  /** Environment variable name (if applicable) */
  envVar?: string;
  /** Framework that initiated the operation (if detected) */
  framework?: string;
  /** Server host/port (for server events) */
  serverHost?: string;
  serverPort?: number;
  /** Free-form metadata for extensibility */
  metadata?: Record<string, unknown>;
  /** Error message if the operation failed */
  error?: string;
}

// ── Logger ──────────────────────────────────────────────────────────────────

export class AuditLogger {
  /**
   * Whether audit logging is enabled.
   * Controlled by the --audit flag or CONFIDANT_AUDIT env var.
   */
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled || process.env.CONFIDANT_AUDIT === '1';
  }

  /** Enable or disable audit logging at runtime */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Whether audit logging is currently active */
  get isActive(): boolean {
    return this.enabled;
  }

  /**
   * Emit an audit event to stdout as a single JSON line.
   * Safe to call even when disabled (no-op).
   */
  emit(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): void {
    if (!this.enabled) return;

    const fullEvent: AuditEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Write to stdout as a single line — consumers can parse line-by-line
    process.stdout.write(JSON.stringify(fullEvent) + '\n');
  }

  /** Convenience: create a 'create' event */
  create(params: {
    resourceId: string;
    expiresAt: string;
    ttlSeconds?: number;
    label?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'create',
      resourceId: params.resourceId,
      expiresAt: params.expiresAt,
      ttlSeconds: params.ttlSeconds,
      label: params.label,
      metadata: params.metadata,
    });
  }

  /** Convenience: create a 'retrieve' event */
  retrieve(params: {
    resourceId: string;
    savedTo?: string;
    envVar?: string;
    framework?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'retrieve',
      resourceId: params.resourceId,
      savedTo: params.savedTo,
      envVar: params.envVar,
      framework: params.framework,
      metadata: params.metadata,
    });
  }

  /** Convenience: create a 'consume' event (secret was viewed/displayed) */
  consume(params: {
    resourceId: string;
    savedTo?: string;
    envVar?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'consume',
      resourceId: params.resourceId,
      savedTo: params.savedTo,
      envVar: params.envVar,
      metadata: params.metadata,
    });
  }

  /** Convenience: create an 'expire' event */
  expire(params: {
    resourceId: string;
    label?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'expire',
      resourceId: params.resourceId,
      label: params.label,
      metadata: params.metadata,
    });
  }

  /** Convenience: create a 'delete' event */
  delete(params: {
    resourceId: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'delete',
      resourceId: params.resourceId,
      metadata: params.metadata,
    });
  }

  /** Convenience: create a 'request_create' event */
  requestCreate(params: {
    resourceId: string;
    resourceHash: string;
    expiresAt: string;
    ttlSeconds: number;
    label?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'request_create',
      resourceId: params.resourceId,
      resourceHash: params.resourceHash,
      expiresAt: params.expiresAt,
      ttlSeconds: params.ttlSeconds,
      label: params.label,
      metadata: params.metadata,
    });
  }

  /** Convenience: create a 'request_poll' event */
  requestPoll(params: {
    resourceId: string;
    status: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'request_poll',
      resourceId: params.resourceId,
      metadata: { status: params.status, ...(params.metadata ?? {}) },
    });
  }

  /** Convenience: create a 'request_completed' event */
  requestCompleted(params: {
    resourceId: string;
    savedTo?: string;
    envVar?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'request_completed',
      resourceId: params.resourceId,
      savedTo: params.savedTo,
      envVar: params.envVar,
      metadata: params.metadata,
    });
  }

  /** Convenience: create a 'request_expired' event */
  requestExpired(params: {
    resourceId: string;
    label?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'request_expired',
      resourceId: params.resourceId,
      label: params.label,
      metadata: params.metadata,
    });
  }
}

/** Shared singleton instance — consumers can import and use directly */
export const auditLogger = new AuditLogger();
