/**
 * Tests for crypto utilities
 */

import { describe, it, expect } from 'vitest';
import { generateHash, encryptSecret, decryptSecret, generateUUID } from './crypto.js';

describe('crypto', () => {
  describe('generateHash', () => {
    it('should generate a 64-character hex string', () => {
      const hash = generateHash();
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique hashes', () => {
      const hash1 = generateHash();
      const hash2 = generateHash();
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('encryptSecret and decryptSecret', () => {
    it('should encrypt and decrypt a secret correctly', () => {
      const secret = 'my-secret-password';
      const hash = generateHash();
      
      const encrypted = encryptSecret(secret, hash);
      const decrypted = decryptSecret(encrypted, hash);
      
      expect(decrypted).toBe(secret);
    });

    it('should produce different encrypted values for the same secret with different hashes', () => {
      const secret = 'my-secret-password';
      const hash1 = generateHash();
      const hash2 = generateHash();
      
      const encrypted1 = encryptSecret(secret, hash1);
      const encrypted2 = encryptSecret(secret, hash2);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt multi-line secrets', () => {
      const secret = 'line1\nline2\nline3';
      const hash = generateHash();
      
      const encrypted = encryptSecret(secret, hash);
      const decrypted = decryptSecret(encrypted, hash);
      
      expect(decrypted).toBe(secret);
    });

    it('should encrypt special characters', () => {
      const secret = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = generateHash();
      
      const encrypted = encryptSecret(secret, hash);
      const decrypted = decryptSecret(encrypted, hash);
      
      expect(decrypted).toBe(secret);
    });

    it('should throw error when decrypting with wrong hash', () => {
      const secret = 'my-secret-password';
      const hash1 = generateHash();
      const hash2 = generateHash();
      
      const encrypted = encryptSecret(secret, hash1);
      
      expect(() => {
        decryptSecret(encrypted, hash2);
      }).toThrow();
    });

    it('should throw error when decrypting invalid format', () => {
      const hash = generateHash();
      
      expect(() => {
        decryptSecret('invalid-format', hash);
      }).toThrow();
    });
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID v4 format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});
