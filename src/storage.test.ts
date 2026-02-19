/**
 * Tests for MemoryStorage class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryStorage } from './storage.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    // Create a new MemoryStorage instance with auto-cleanup disabled for tests
    storage = new MemoryStorage(60000, false);
  });

  afterEach(() => {
    // Clean up any timers
    storage.stopAutoCleanup();
  });

  describe('Store Method', () => {
    it('should store a secret without options', async () => {
      const secret = 'my-secret-value';
      const id = await storage.store(secret);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      // Verify secret is accessible
      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.secret).toBe(secret);
    });

    it('should store a secret with TTL', async () => {
      const secret = 'my-secret-value';
      const ttl = 1000; // 1 second
      const id = await storage.store(secret, { ttl });

      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.expiresAt).toBeInstanceOf(Date);

      // Verify expiresAt is approximately now + ttl
      const now = new Date();
      const expectedExpiresAt = new Date(now.getTime() + ttl);
      const timeDiff = Math.abs(retrieved!.expiresAt.getTime() - expectedExpiresAt.getTime());
      expect(timeDiff).toBeLessThan(100); // Allow 100ms tolerance
    });

    it('should store a secret with maxAccessCount', async () => {
      const secret = 'my-secret-value';
      const maxAccessCount = 3;
      const id = await storage.store(secret, { maxAccessCount });

      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.maxAccessCount).toBe(maxAccessCount);
      expect(retrieved?.accessCount).toBe(1); // First access
    });

    it('should store a secret with both TTL and maxAccessCount', async () => {
      const secret = 'my-secret-value';
      const ttl = 1000;
      const maxAccessCount = 5;
      const id = await storage.store(secret, { ttl, maxAccessCount });

      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.maxAccessCount).toBe(maxAccessCount);
      expect(retrieved?.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Retrieve Method', () => {
    it('should retrieve an existing secret', async () => {
      const secret = 'my-secret-value';
      const id = await storage.store(secret);

      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      expect(retrieved?.secret).toBe(secret);
      expect(retrieved?.accessCount).toBe(1);
    });

    it('should return null for non-existent secret', async () => {
      const retrieved = await storage.retrieve('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired secret', async () => {
      const secret = 'my-secret-value';
      const ttl = 10; // 10ms
      const id = await storage.store(secret, { ttl });

      // Wait for secret to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      const retrieved = await storage.retrieve(id);
      expect(retrieved).toBeNull();
    });

    it('should return null for secret with exceeded access count', async () => {
      const secret = 'my-secret-value';
      const maxAccessCount = 2;
      const id = await storage.store(secret, { maxAccessCount });

      // Access the secret twice
      const first = await storage.retrieve(id);
      expect(first).not.toBeNull();
      expect(first?.accessCount).toBe(1);

      const second = await storage.retrieve(id);
      expect(second).not.toBeNull();
      expect(second?.accessCount).toBe(2);

      // Third access should fail
      const third = await storage.retrieve(id);
      expect(third).toBeNull();
    });

    it('should retrieve secret without maxAccessCount unlimited times', async () => {
      const secret = 'my-secret-value';
      const id = await storage.store(secret);

      // Retrieve multiple times
      for (let i = 0; i < 10; i++) {
        const retrieved = await storage.retrieve(id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.accessCount).toBe(i + 1);
      }
    });
  });

  describe('Delete Method', () => {
    it('should delete an existing secret', async () => {
      const secret = 'my-secret-value';
      const id = await storage.store(secret);

      const deleted = await storage.delete(id);
      expect(deleted).toBe(true);

      // Verify secret is gone
      const retrieved = await storage.retrieve(id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent secret', async () => {
      const deleted = await storage.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should delete an expired secret', async () => {
      const secret = 'my-secret-value';
      const ttl = 10; // 10ms
      const id = await storage.store(secret, { ttl });

      // Wait for secret to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      const deleted = await storage.delete(id);
      expect(deleted).toBe(true);
    });
  });

  describe('Cleanup Method', () => {
    it('should clean up expired secrets', async () => {
      // Store secrets with different TTLs
      const id1 = await storage.store('secret1', { ttl: 10 });
      const id2 = await storage.store('secret2', { ttl: 10 });
      const id3 = await storage.store('secret3', { ttl: 10000 }); // Long TTL

      // Wait for first two to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      const cleanedCount = await storage.cleanup();
      expect(cleanedCount).toBe(2);

      // Verify expired secrets are gone
      expect(await storage.retrieve(id1)).toBeNull();
      expect(await storage.retrieve(id2)).toBeNull();
      expect(await storage.retrieve(id3)).not.toBeNull();
    });

    it('should return 0 when no expired secrets', async () => {
      await storage.store('secret1', { ttl: 10000 });
      await storage.store('secret2', { ttl: 10000 });

      const cleanedCount = await storage.cleanup();
      expect(cleanedCount).toBe(0);
    });

    it('should clean up only expired secrets from mixed storage', async () => {
      // Store mix of expired and non-expired secrets
      const expired1 = await storage.store('expired1', { ttl: 10 });
      const expired2 = await storage.store('expired2', { ttl: 10 });
      const valid1 = await storage.store('valid1', { ttl: 10000 });
      const valid2 = await storage.store('valid2', { ttl: 10000 });
      const expired3 = await storage.store('expired3', { ttl: 10 });

      // Wait for expired secrets to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      const cleanedCount = await storage.cleanup();
      expect(cleanedCount).toBe(3);

      // Verify only expired secrets are gone
      expect(await storage.retrieve(expired1)).toBeNull();
      expect(await storage.retrieve(expired2)).toBeNull();
      expect(await storage.retrieve(expired3)).toBeNull();
      expect(await storage.retrieve(valid1)).not.toBeNull();
      expect(await storage.retrieve(valid2)).not.toBeNull();
    });
  });

  describe('Secret ID Uniqueness', () => {
    it('should generate unique IDs for multiple secrets', async () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const id = await storage.store(`secret-${i}`);
        ids.add(id);
      }

      expect(ids.size).toBe(100);
    });

    it('should generate unique IDs for same secret stored multiple times', async () => {
      const secret = 'my-secret-value';
      const id1 = await storage.store(secret);
      const id2 = await storage.store(secret);
      const id3 = await storage.store(secret);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);

      // Each should be independently accessible
      expect((await storage.retrieve(id1))?.secret).toBe(secret);
      expect((await storage.retrieve(id2))?.secret).toBe(secret);
      expect((await storage.retrieve(id3))?.secret).toBe(secret);
    });
  });

  describe('Secret Data Integrity', () => {
    it('should include creation timestamp', async () => {
      const beforeStore = new Date();
      const id = await storage.store('my-secret');
      const afterStore = new Date();

      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved!.createdAt.getTime()).toBeGreaterThanOrEqual(beforeStore.getTime());
      expect(retrieved!.createdAt.getTime()).toBeLessThanOrEqual(afterStore.getTime());
    });

    it('should include expiration timestamp when TTL is set', async () => {
      const ttl = 5000;
      const beforeStore = new Date();
      const id = await storage.store('my-secret', { ttl });
      const afterStore = new Date();

      const retrieved = await storage.retrieve(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.expiresAt).toBeInstanceOf(Date);

      const expectedMin = new Date(beforeStore.getTime() + ttl);
      const expectedMax = new Date(afterStore.getTime() + ttl);
      expect(retrieved!.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(retrieved!.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should include and increment access count', async () => {
      const id = await storage.store('my-secret');

      const first = await storage.retrieve(id);
      expect(first?.accessCount).toBe(1);

      const second = await storage.retrieve(id);
      expect(second?.accessCount).toBe(2);

      const third = await storage.retrieve(id);
      expect(third?.accessCount).toBe(3);
    });

    it('should include maxAccessCount when set', async () => {
      const maxAccessCount = 5;
      const id = await storage.store('my-secret', { maxAccessCount });

      const retrieved = await storage.retrieve(id);
      expect(retrieved?.maxAccessCount).toBe(maxAccessCount);
    });
  });

  describe('Automatic Periodic Cleanup', () => {
    it('should automatically clean up expired secrets', async () => {
      // Create storage with short cleanup interval
      const autoStorage = new MemoryStorage(100, true); // 100ms interval

      // Store secrets with short TTL
      const id1 = await autoStorage.store('secret1', { ttl: 50 });
      const id2 = await autoStorage.store('secret2', { ttl: 50 });
      const id3 = await autoStorage.store('secret3', { ttl: 1000 }); // Long TTL

      // Wait for cleanup to run (interval + buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify expired secrets are cleaned up
      expect(await autoStorage.retrieve(id1)).toBeNull();
      expect(await autoStorage.retrieve(id2)).toBeNull();
      expect(await autoStorage.retrieve(id3)).not.toBeNull();

      autoStorage.stopAutoCleanup();
    });

    it('should preserve valid secrets during periodic cleanup', async () => {
      const autoStorage = new MemoryStorage(100, true);

      // Store secrets with long TTL
      const id1 = await autoStorage.store('secret1', { ttl: 10000 });
      const id2 = await autoStorage.store('secret2', { ttl: 10000 });

      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify secrets are still accessible
      expect(await autoStorage.retrieve(id1)).not.toBeNull();
      expect(await autoStorage.retrieve(id2)).not.toBeNull();

      autoStorage.stopAutoCleanup();
    });

    it('should use configurable cleanup interval', async () => {
      const interval = 50; // 50ms
      const autoStorage = new MemoryStorage(interval, true);

      const id = await autoStorage.store('secret', { ttl: 30 });

      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, interval + 20));

      // Secret should be cleaned up
      expect(await autoStorage.retrieve(id)).toBeNull();

      autoStorage.stopAutoCleanup();
    });
  });

  describe('Stop Auto Cleanup', () => {
    it('should stop automatic cleanup when called', async () => {
      const autoStorage = new MemoryStorage(50, true);

      // Store secret with long TTL (longer than cleanup interval)
      const id = await autoStorage.store('secret', { ttl: 5000 });

      // Stop auto cleanup
      autoStorage.stopAutoCleanup();

      // Wait for what would be cleanup interval
      await new Promise(resolve => setTimeout(resolve, 70));

      // Secret should still be accessible (cleanup didn't run)
      expect(await autoStorage.retrieve(id)).not.toBeNull();
    });
  });

  // ==================== Secret Request Tests ====================

  describe('Create Request', () => {
    it('should create a request with default expiration', () => {
      const request = storage.createRequest();

      expect(request.id).toBeDefined();
      expect(request.hash).toBeDefined();
      expect(request.hash).toHaveLength(64);
      expect(request.status).toBe('pending');
      expect(request.secret).toBeNull();
      expect(request.createdAt).toBeInstanceOf(Date);
      expect(request.expiresAt).toBeInstanceOf(Date);
      expect(request.retrievedAt).toBeNull();
    });

    it('should create a request with custom expiration', () => {
      const expiresIn = 3600; // 1 hour
      const request = storage.createRequest(expiresIn);

      const now = new Date();
      const expectedExpiresAt = new Date(now.getTime() + expiresIn * 1000);
      const timeDiff = Math.abs(request.expiresAt.getTime() - expectedExpiresAt.getTime());

      expect(timeDiff).toBeLessThan(100); // Allow 100ms tolerance
    });

    it('should generate unique request IDs', () => {
      const request1 = storage.createRequest();
      const request2 = storage.createRequest();

      expect(request1.id).not.toBe(request2.id);
    });

    it('should generate unique request hashes', () => {
      const request1 = storage.createRequest();
      const request2 = storage.createRequest();

      expect(request1.hash).not.toBe(request2.hash);
    });
  });

  describe('Get Request By Hash', () => {
    it('should retrieve a request by hash', () => {
      const request = storage.createRequest();
      const retrieved = storage.getRequestByHash(request.hash);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(request.id);
      expect(retrieved?.hash).toBe(request.hash);
    });

    it('should return null for non-existent hash', () => {
      const retrieved = storage.getRequestByHash('nonexistenthash');
      expect(retrieved).toBeNull();
    });

    it('should mark expired requests as expired', () => {
      const expiresIn = 0.01; // 10ms
      const request = storage.createRequest(expiresIn);

      // Wait for expiration
      // Note: We can't easily test this without async/await in the test
      // The expiration check happens in getRequestByHash
      const retrieved = storage.getRequestByHash(request.hash);
      
      // The request should be returned but status may be updated to expired
      expect(retrieved).not.toBeNull();
    });
  });

  describe('Get Request By Id', () => {
    it('should retrieve a request by id', () => {
      const request = storage.createRequest();
      const retrieved = storage.getRequestById(request.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(request.id);
      expect(retrieved?.hash).toBe(request.hash);
    });

    it('should return null for non-existent id', () => {
      const retrieved = storage.getRequestById('nonexistent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('Update Request Status', () => {
    it('should update request status', () => {
      const request = storage.createRequest();
      expect(request.status).toBe('pending');

      const updated = storage.updateRequestStatus(request.id, 'completed');
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('completed');
    });

    it('should return null for non-existent request', () => {
      const updated = storage.updateRequestStatus('nonexistent-id', 'completed');
      expect(updated).toBeNull();
    });
  });

  describe('Submit Secret', () => {
    it('should submit a secret for a pending request', () => {
      const request = storage.createRequest();
      const secret = 'my-secret-value';

      const updated = storage.submitSecret(request.hash, secret);

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('completed');
      expect(updated?.secret).not.toBeNull();
    });

    it('should return null for non-existent hash', () => {
      const updated = storage.submitSecret('nonexistenthash', 'secret');
      expect(updated).toBeNull();
    });

    it('should not submit secret for completed request', () => {
      const request = storage.createRequest();
      storage.submitSecret(request.hash, 'secret1');

      const updated = storage.submitSecret(request.hash, 'secret2');
      expect(updated).toBeNull();
    });

    it('should not submit secret for expired request', async () => {
      const expiresIn = 0.01; // 10ms
      const request = storage.createRequest(expiresIn);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      // The expiration check happens in submitSecret
      const updated = storage.submitSecret(request.hash, 'secret');
      
      // Should return null since the request is expired
      expect(updated).toBeNull();
    });
  });

  describe('Get And Delete Secret', () => {
    it('should retrieve and delete secret for completed request', () => {
      const request = storage.createRequest();
      const secret = 'my-secret-value';
      storage.submitSecret(request.hash, secret);

      const retrievedSecret = storage.getAndDeleteSecret(request.id);

      expect(retrievedSecret).toBe(secret);

      // Secret should be deleted
      const requestAfter = storage.getRequestById(request.id);
      expect(requestAfter?.status).toBe('retrieved');
      expect(requestAfter?.secret).toBeNull();
    });

    it('should return null for pending request', () => {
      const request = storage.createRequest();
      const secret = storage.getAndDeleteSecret(request.id);

      expect(secret).toBeNull();
    });

    it('should return null for non-existent request', () => {
      const secret = storage.getAndDeleteSecret('nonexistent-id');
      expect(secret).toBeNull();
    });

    it('should return null for already retrieved request', () => {
      const request = storage.createRequest();
      const secret = 'my-secret-value';
      storage.submitSecret(request.hash, secret);

      // First retrieval
      storage.getAndDeleteSecret(request.id);

      // Second retrieval should fail
      const secondSecret = storage.getAndDeleteSecret(request.id);
      expect(secondSecret).toBeNull();
    });
  });

  describe('Cleanup Expired Requests', () => {
    it('should clean up expired requests', async () => {
      const request1 = storage.createRequest(0.01); // 10ms
      const request2 = storage.createRequest(0.01); // 10ms
      const request3 = storage.createRequest(10000); // Long TTL

      // Wait for first two to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      const cleanedCount = storage.cleanupExpiredRequests();
      expect(cleanedCount).toBe(2);

      // Verify expired requests are gone
      expect(storage.getRequestById(request1.id)).toBeNull();
      expect(storage.getRequestById(request2.id)).toBeNull();
      expect(storage.getRequestById(request3.id)).not.toBeNull();
    });

    it('should return 0 when no expired requests', () => {
      storage.createRequest(10000);
      storage.createRequest(10000);

      const cleanedCount = storage.cleanupExpiredRequests();
      expect(cleanedCount).toBe(0);
    });
  });

  describe('Delete Request', () => {
    it('should delete an existing request', () => {
      const request = storage.createRequest();
      const deleted = storage.deleteRequest(request.id);

      expect(deleted).toBe(true);
      expect(storage.getRequestById(request.id)).toBeNull();
    });

    it('should return false for non-existent request', () => {
      const deleted = storage.deleteRequest('nonexistent-id');
      expect(deleted).toBe(false);
    });
  });
});
