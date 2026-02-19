/**
 * Tests for rate limiter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000
    });
  });

  describe('check', () => {
    it('should allow requests within the limit', () => {
      const result1 = rateLimiter.check('127.0.0.1');
      const result2 = rateLimiter.check('127.0.0.1');
      const result3 = rateLimiter.check('127.0.0.1');

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
      
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
      
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(2);
    });

    it('should block requests exceeding the limit', () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.check('127.0.0.1');
        expect(result.allowed).toBe(true);
      }

      // 6th request should be blocked
      const result = rateLimiter.check('127.0.0.1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track requests separately for different IPs', () => {
      // Make 5 requests from IP1
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('127.0.0.1');
      }

      // IP1 should be blocked
      const result1 = rateLimiter.check('127.0.0.1');
      expect(result1.allowed).toBe(false);

      // IP2 should still be allowed
      const result2 = rateLimiter.check('192.168.1.1');
      expect(result2.allowed).toBe(true);
    });

    it('should reset the window after it expires', async () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('127.0.0.1');
      }

      // 6th request should be blocked
      let result = rateLimiter.check('127.0.0.1');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      result = rateLimiter.check('127.0.0.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should provide correct reset time', () => {
      const result = rateLimiter.check('127.0.0.1');
      const now = Date.now();
      
      expect(result.resetTime).toBeGreaterThan(now);
      expect(result.resetTime).toBeLessThanOrEqual(now + 1000);
    });
  });

  describe('reset', () => {
    it('should reset the rate limit for a specific IP', () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('127.0.0.1');
      }

      // 6th request should be blocked
      let result = rateLimiter.check('127.0.0.1');
      expect(result.allowed).toBe(false);

      // Reset the IP
      rateLimiter.reset('127.0.0.1');

      // Should be allowed again
      result = rateLimiter.check('127.0.0.1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove old records', async () => {
      // Make requests from two IPs
      rateLimiter.check('127.0.0.1');
      rateLimiter.check('192.168.1.1');

      // Wait for records to become old
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup with max age of 50ms
      rateLimiter.cleanup(50);

      // Both records should be removed (old enough)
      const status1 = rateLimiter.getStatus('127.0.0.1');
      const status2 = rateLimiter.getStatus('192.168.1.1');
      
      expect(status1.remaining).toBe(5); // Reset to full limit
      expect(status2.remaining).toBe(5); // Reset to full limit
    });
  });

  describe('getStatus', () => {
    it('should return status without incrementing count', () => {
      const status1 = rateLimiter.getStatus('127.0.0.1');
      expect(status1.allowed).toBe(true);
      expect(status1.remaining).toBe(5);

      const status2 = rateLimiter.getStatus('127.0.0.1');
      expect(status2.allowed).toBe(true);
      expect(status2.remaining).toBe(5); // Still 5, not decremented
    });

    it('should return correct status for IPs that have made requests', () => {
      rateLimiter.check('127.0.0.1');
      rateLimiter.check('127.0.0.1');

      const status = rateLimiter.getStatus('127.0.0.1');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(3);
    });

    it('should return not allowed for IPs that have exceeded the limit', () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('127.0.0.1');
      }

      const status = rateLimiter.getStatus('127.0.0.1');
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });
});
