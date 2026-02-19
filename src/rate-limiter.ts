/**
 * Rate Limiter
 * 
 * Implements in-memory rate limiting using a sliding window algorithm.
 * Prevents brute-force attacks on hash space and API abuse.
 */

/**
 * Rate limit record for a single IP
 */
interface RateLimitRecord {
  count: number;
  windowStart: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  maxRequests: number; // Maximum requests per window
  windowMs: number; // Window duration in milliseconds
}

/**
 * Rate limiter result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp when the window resets
}

/**
 * In-memory rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private records: Map<string, RateLimitRecord>;
  private config: RateLimiterConfig;

  /**
   * Creates a new rate limiter
   * @param config Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.records = new Map();
    this.config = config;
  }

  /**
   * Check if a request from the given IP is allowed
   * @param ip The client IP address
   * @returns Rate limit result
   */
  check(ip: string): RateLimitResult {
    const now = Date.now();
    const record = this.records.get(ip);

    // No existing record, create a new one
    if (!record) {
      this.records.set(ip, {
        count: 1,
        windowStart: now
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    // Check if the window has expired
    const windowAge = now - record.windowStart;
    if (windowAge >= this.config.windowMs) {
      // Reset the window
      record.count = 1;
      record.windowStart = now;

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    // Check if the limit has been exceeded
    if (record.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.windowStart + this.config.windowMs
      };
    }

    // Increment the count
    record.count++;

    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetTime: record.windowStart + this.config.windowMs
    };
  }

  /**
   * Reset the rate limit for a specific IP
   * @param ip The client IP address
   */
  reset(ip: string): void {
    this.records.delete(ip);
  }

  /**
   * Clean up old records to prevent memory leaks
   * @param maxAge Maximum age of records to keep in milliseconds
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [ip, record] of Array.from(this.records.entries())) {
      const recordAge = now - record.windowStart;
      if (recordAge > maxAge) {
        this.records.delete(ip);
      }
    }
  }

  /**
   * Get the current rate limit status for an IP without incrementing
   * @param ip The client IP address
   * @returns Rate limit result
   */
  getStatus(ip: string): RateLimitResult {
    const now = Date.now();
    const record = this.records.get(ip);

    if (!record) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    // Check if the window has expired
    const windowAge = now - record.windowStart;
    if (windowAge >= this.config.windowMs) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    return {
      allowed: record.count < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - record.count),
      resetTime: record.windowStart + this.config.windowMs
    };
  }
}

/**
 * Default rate limiter for secret request endpoints
 * 10 requests per minute per IP
 */
export const defaultRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000 // 1 minute
});
