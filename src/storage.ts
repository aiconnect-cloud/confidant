/**
 * TTL Storage Interface
 * 
 * Defines the contract for storing and retrieving secrets with time-to-live expiration.
 * This is a placeholder interface - implementation will be added in a future change.
 */

import * as crypto from 'node:crypto';
import { SecretRequest, SecretRequestStatus } from './types.js';
import { generateHash, encryptSecret, decryptSecret } from './crypto.js';

export interface SecretData {
  id: string;
  secret: string;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  maxAccessCount?: number;
}

export interface StorageOptions {
  ttl?: number; // Time to live in milliseconds
  maxAccessCount?: number; // Maximum number of times secret can be accessed
}

export interface TTLStorage {
  /**
   * Store a secret with TTL
   * @param secret The secret string to store
   * @param options Storage options including TTL and max access count
   * @returns The secret ID for retrieval
   */
  store(secret: string, options?: StorageOptions): Promise<string>;

  /**
   * Retrieve a secret by ID
   * @param id The secret ID
   * @returns The secret data or null if not found/expired
   */
  retrieve(id: string): Promise<SecretData | null>;

  /**
   * Peek at a secret by ID without incrementing access count
   * @param id The secret ID
   * @returns The secret data or null if not found/expired
   */
  peek(id: string): Promise<SecretData | null>;

  /**
   * Delete a secret by ID
   * @param id The secret ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Clean up expired secrets
   * @returns Number of secrets cleaned up
   */
  cleanup(): Promise<number>;
}

/**
 * Memory-based implementation of TTLStorage interface.
 * Stores secrets in memory with automatic TTL expiration and access count limits.
 */
export class MemoryStorage implements TTLStorage {
  private storage: Map<string, SecretData>;
  private requests: Map<string, SecretRequest>;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null;

  /**
   * Creates a new MemoryStorage instance.
   * @param cleanupIntervalMs Interval in milliseconds for automatic cleanup (default: 60000ms/60s)
   * @param enableAutoCleanup Enable automatic periodic cleanup (default: true)
   */
  constructor(cleanupIntervalMs: number = 60000, enableAutoCleanup: boolean = true) {
    this.storage = new Map();
    this.requests = new Map();
    this.cleanupInterval = cleanupIntervalMs;
    this.cleanupTimer = null;

    if (enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Store a secret with TTL
   * @param secret The secret string to store
   * @param options Storage options including TTL and max access count
   * @returns The secret ID for retrieval
   */
  async store(secret: string, options?: StorageOptions): Promise<string> {
    // Generate unique secret ID
    const id = this.generateSecretId();

    // Create SecretData object
    const now = new Date();
    const secretData: SecretData = {
      id,
      secret,
      createdAt: now,
      expiresAt: options?.ttl ? new Date(now.getTime() + options.ttl) : new Date(now.getTime() + 3600000), // Default 1 hour TTL
      accessCount: 0,
      maxAccessCount: options?.maxAccessCount
    };

    // Store in Map
    this.storage.set(id, secretData);

    // Return the generated ID
    return id;
  }

  /**
   * Retrieve a secret by ID
   * @param id The secret ID
   * @returns The secret data or null if not found/expired
   */
  async retrieve(id: string): Promise<SecretData | null> {
    // Look up secret by ID in Map
    const secretData = this.storage.get(id);

    // Return null if secret not found
    if (!secretData) {
      return null;
    }

    // Check if secret has expired
    const now = new Date();
    if (secretData.expiresAt < now) {
      // Remove expired secret
      this.storage.delete(id);
      return null;
    }

    // Check if maxAccessCount is set and accessCount has reached limit
    if (secretData.maxAccessCount !== undefined && secretData.accessCount >= secretData.maxAccessCount) {
      return null;
    }

    // Increment accessCount for successful retrieval
    secretData.accessCount++;

    // Return SecretData object for successful retrieval
    return secretData;
  }

  /**
   * Peek at a secret by ID without incrementing access count
   * Used for checking status without consuming an access
   * @param id The secret ID
   * @returns The secret data or null if not found/expired/access limit exceeded
   */
  async peek(id: string): Promise<SecretData | null> {
    // Look up secret by ID in Map
    const secretData = this.storage.get(id);

    // Return null if secret not found
    if (!secretData) {
      return null;
    }

    // Check if secret has expired
    const now = new Date();
    if (secretData.expiresAt < now) {
      // Remove expired secret
      this.storage.delete(id);
      return null;
    }

    // Check if maxAccessCount is set and accessCount has reached limit
    if (secretData.maxAccessCount !== undefined && secretData.accessCount >= secretData.maxAccessCount) {
      return null;
    }

    // Return SecretData WITHOUT incrementing accessCount
    return secretData;
  }

  /**
   * Delete a secret by ID
   * @param id The secret ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    // Check if secret ID exists in Map and delete it
    const existed = this.storage.delete(id);

    // Return true if deleted, false if not found
    return existed;
  }

  /**
   * Clean up expired secrets
   * @returns Number of secrets cleaned up
   */
  async cleanup(): Promise<number> {
    let deletedCount = 0;
    const now = new Date();

    // Iterate through all secrets in Map
    // Using Array.from to safely iterate while deleting
    for (const [id, secretData] of Array.from(this.storage.entries())) {
      // Check each secret for expiration
      if (secretData.expiresAt < now) {
        // Delete expired secrets from Map
        this.storage.delete(id);
        deletedCount++;
      }
    }

    // Count and return number of deleted secrets
    return deletedCount;
  }

  /**
   * Stop automatic periodic cleanup
   * Call this method to disable the automatic cleanup timer
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Start automatic periodic cleanup
   */
  private startAutoCleanup(): void {
    // Implement periodic cleanup using setInterval
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Generate a unique secret ID using cryptographically secure UUID v4
   * @returns A unique secret ID
   */
  private generateSecretId(): string {
    return crypto.randomUUID();
  }

  // ==================== Secret Request Methods ====================

  /**
   * Create a new secret request
   * @param expiresIn Time to live in seconds (default: 86400 = 24 hours)
   * @param label Optional label to describe what secret is being requested
   * @returns The secret request with id and hash
   */
  createRequest(expiresIn: number = 86400, label?: string): SecretRequest {
    const id = crypto.randomUUID();
    const hash = generateHash();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    const request: SecretRequest = {
      id,
      hash,
      secret: null,
      status: 'pending',
      createdAt: now,
      expiresAt,
      retrievedAt: null,
      label
    };

    this.requests.set(id, request);
    return request;
  }

  /**
   * Get a request by hash (for form access)
   * @param hash The request hash
   * @returns The secret request or null if not found
   */
  getRequestByHash(hash: string): SecretRequest | null {
    // Find request by hash (need to iterate since we index by id)
    for (const request of this.requests.values()) {
      if (request.hash === hash) {
        // Check if expired
        if (request.expiresAt < new Date()) {
          request.status = 'expired';
        }
        return request;
      }
    }
    return null;
  }

  /**
   * Get a request by id (for polling)
   * @param id The request id
   * @returns The secret request or null if not found
   */
  getRequestById(id: string): SecretRequest | null {
    const request = this.requests.get(id);
    if (!request) {
      return null;
    }

    // Check if expired
    if (request.expiresAt < new Date()) {
      request.status = 'expired';
    }

    return request;
  }

  /**
   * Update a request's status
   * @param id The request id
   * @param status The new status
   * @returns The updated request or null if not found
   */
  updateRequestStatus(id: string, status: SecretRequestStatus): SecretRequest | null {
    const request = this.requests.get(id);
    if (!request) {
      return null;
    }

    request.status = status;
    return request;
  }

  /**
   * Submit a secret for a request
   * @param hash The request hash
   * @param secret The secret to submit
   * @returns The updated request or null if not found
   */
  submitSecret(hash: string, secret: string): SecretRequest | null {
    const request = this.getRequestByHash(hash);
    if (!request) {
      return null;
    }

    // Check if request is still pending
    if (request.status !== 'pending') {
      return null;
    }

    // Check if expired
    if (request.expiresAt < new Date()) {
      request.status = 'expired';
      return request;
    }

    // Encrypt and store the secret
    request.secret = encryptSecret(secret, hash);
    request.status = 'completed';

    return request;
  }

  /**
   * Get and delete the secret for a request (one-time retrieval)
   * @param id The request id
   * @returns The decrypted secret or null if not found/retrieved
   */
  getAndDeleteSecret(id: string): string | null {
    const request = this.requests.get(id);
    if (!request) {
      return null;
    }

    // Check if request is completed
    if (request.status !== 'completed') {
      return null;
    }

    // Check if expired
    if (request.expiresAt < new Date()) {
      request.status = 'expired';
      return null;
    }

    // Decrypt the secret
    if (!request.secret) {
      return null;
    }

    const decryptedSecret = decryptSecret(request.secret, request.hash);

    // Mark as retrieved and delete the secret
    request.status = 'retrieved';
    request.retrievedAt = new Date();
    request.secret = null;

    return decryptedSecret;
  }

  /**
   * Clean up expired requests
   * @returns Number of requests cleaned up
   */
  cleanupExpiredRequests(): number {
    let deletedCount = 0;
    const now = new Date();

    for (const [id, request] of Array.from(this.requests.entries())) {
      if (request.expiresAt < now) {
        this.requests.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Delete a request by id
   * @param id The request id
   * @returns True if deleted, false if not found
   */
  deleteRequest(id: string): boolean {
    return this.requests.delete(id);
  }
}
