import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateUrls, formatUrlsForDisplay } from './url-helper.js';

describe('url-helper', () => {
  describe('generateUrls', () => {
    it('should generate localhost URL', () => {
      const result = generateUrls('http://localhost:3000', 'abc123', null);
      expect(result.localhost).toBe('http://localhost:3000/requests/abc123');
      expect(result.network).toBeNull();
    });

    it('should generate network URL when local IP is provided', () => {
      const result = generateUrls('http://localhost:3000', 'abc123', '192.168.1.100');
      expect(result.localhost).toBe('http://localhost:3000/requests/abc123');
      expect(result.network).toBe('http://192.168.1.100:3000/requests/abc123');
    });

    it('should handle custom port', () => {
      const result = generateUrls('http://localhost:8080', 'abc123', '192.168.1.100');
      expect(result.localhost).toBe('http://localhost:8080/requests/abc123');
      expect(result.network).toBe('http://192.168.1.100:8080/requests/abc123');
    });

    it('should handle HTTPS', () => {
      const result = generateUrls('https://localhost:443', 'abc123', '192.168.1.100');
      expect(result.localhost).toBe('https://localhost:443/requests/abc123');
      expect(result.network).toBe('https://192.168.1.100:443/requests/abc123');
    });

    it('should handle API URL with path', () => {
      const result = generateUrls('http://localhost:3000/api', 'abc123', '192.168.1.100');
      expect(result.localhost).toBe('http://localhost:3000/requests/abc123');
      expect(result.network).toBe('http://192.168.1.100:3000/requests/abc123');
    });

    it('should return null network URL when local IP is null', () => {
      const result = generateUrls('http://localhost:3000', 'abc123', null);
      expect(result.localhost).toBe('http://localhost:3000/requests/abc123');
      expect(result.network).toBeNull();
    });
  });

  describe('formatUrlsForDisplay', () => {
    it('should format both URLs when network URL is available', () => {
      const urls = {
        localhost: 'http://localhost:3000/request/abc123',
        network: 'http://192.168.1.100:3000/request/abc123'
      };
      const result = formatUrlsForDisplay(urls);
      expect(result).toEqual([
        'Network URL (for other devices): http://192.168.1.100:3000/request/abc123',
        'Localhost URL (for this device): http://localhost:3000/request/abc123'
      ]);
    });

    it('should format only localhost URL when network URL is null', () => {
      const urls = {
        localhost: 'http://localhost:3000/request/abc123',
        network: null
      };
      const result = formatUrlsForDisplay(urls);
      expect(result).toEqual([
        'Localhost URL (for this device): http://localhost:3000/request/abc123'
      ]);
    });

    it('should handle empty network URL', () => {
      const urls = {
        localhost: 'http://localhost:3000/request/abc123',
        network: ''
      };
      const result = formatUrlsForDisplay(urls);
      expect(result).toEqual([
        'Localhost URL (for this device): http://localhost:3000/request/abc123'
      ]);
    });
  });
});
