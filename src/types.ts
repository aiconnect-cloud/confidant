/**
 * Shared TypeScript Types
 * 
 * Common type definitions used throughout the Confidant application.
 */

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Secret creation request
 */
export interface CreateSecretRequest {
  secret: string;
  ttl?: number; // Time to live in milliseconds
  maxAccessCount?: number; // Maximum number of times secret can be accessed
}

/**
 * Secret creation response
 */
export interface CreateSecretResponse {
  id: string;
  expiresAt: string; // ISO 8601 date string
  accessUrl: string;
}

/**
 * Secret retrieval response
 */
export interface RetrieveSecretResponse {
  id: string;
  secret: string;
  expiresAt: string;
  remainingAccessCount?: number;
}

/**
 * Secret status response
 */
export interface SecretStatusResponse {
  id: string;
  exists: boolean;
  expired: boolean;
  expiresAt?: string;
  accessCount: number;
  remainingAccessCount?: number;
}

/**
 * Error types
 */
export class SecretNotFoundError extends Error {
  constructor(id: string) {
    super(`Secret not found: ${id}`);
    this.name = 'SecretNotFoundError';
  }
}

export class SecretExpiredError extends Error {
  constructor(id: string) {
    super(`Secret has expired: ${id}`);
    this.name = 'SecretExpiredError';
  }
}

export class MaxAccessCountExceededError extends Error {
  constructor(id: string) {
    super(`Maximum access count exceeded for secret: ${id}`);
    this.name = 'MaxAccessCountExceededError';
  }
}

/**
 * Secret Request Types
 */

/**
 * Secret request status
 */
export type SecretRequestStatus = 'pending' | 'completed' | 'retrieved' | 'expired';

/**
 * Secret request data model
 */
export interface SecretRequest {
  id: string;
  hash: string;
  secret: string | null;
  status: SecretRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  retrievedAt: Date | null;
  label?: string;
}

/**
 * Secret request creation request
 */
export interface CreateSecretRequestRequest {
  expiresIn?: number; // Time to live in seconds (default: 86400 = 24 hours)
  label?: string;
}

/**
 * Secret request creation response
 */
export interface CreateSecretRequestResponse {
  id: string;
  hash: string;
  url: string;
  expiresAt: string; // ISO 8601 date string
  status: SecretRequestStatus;
  label?: string;
}

/**
 * Secret submission request
 */
export interface SubmitSecretRequest {
  secret: string;
}

/**
 * Secret submission response
 */
export interface SubmitSecretResponse {
  message: string;
}

/**
 * Secret poll response
 */
export interface PollSecretResponse {
  id: string;
  status: SecretRequestStatus;
  secret: string | null;
  label?: string;
}

/**
 * Error types for secret requests
 */
export class SecretRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Secret request not found: ${id}`);
    this.name = 'SecretRequestNotFoundError';
  }
}

export class SecretRequestExpiredError extends Error {
  constructor(id: string) {
    super(`Secret request has expired: ${id}`);
    this.name = 'SecretRequestExpiredError';
  }
}

export class SecretRequestAlreadyRetrievedError extends Error {
  constructor(id: string) {
    super(`Secret request has already been retrieved: ${id}`);
    this.name = 'SecretRequestAlreadyRetrievedError';
  }
}

export class SecretRequestAlreadyCompletedError extends Error {
  constructor(id: string) {
    super(`Secret request has already been completed: ${id}`);
    this.name = 'SecretRequestAlreadyCompletedError';
  }
}

/**
 * Registry Module Types
 * Re-exported from registry.ts for convenience
 */

export type { Module, StorageModule, ValidatorModule, TransformerModule } from './registry.js';
export { Registry, storageRegistry, validatorRegistry, transformerRegistry } from './registry.js';
export { MemoryStorageModule, BasicValidatorModule, UppercaseTransformerModule } from './registry.js';
