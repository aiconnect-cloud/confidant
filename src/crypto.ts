/**
 * Cryptography Utilities
 * 
 * Provides encryption/decryption functions for secret storage using AES-256-GCM.
 * Uses per-request keys derived from the request hash for security.
 */

import * as crypto from 'node:crypto';

/**
 * Generate a cryptographically secure random hash for secret requests
 * @returns 64-character hex string (256 bits of entropy)
 */
export function generateHash(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Derive an encryption key from the request hash using scrypt
 * @param hash The request hash
 * @returns 32-byte encryption key
 */
function deriveKey(hash: string): Buffer {
  // Use scrypt with a fixed salt to derive a key from the hash
  // The hash itself provides enough entropy, so the salt can be fixed
  return crypto.scryptSync(hash, 'confidant-secret-request-salt', 32);
}

/**
 * Encrypt a secret using AES-256-GCM
 * @param secret The secret to encrypt
 * @param hash The request hash (used to derive the encryption key)
 * @returns Encrypted secret in format: iv:authTag:encryptedData
 */
export function encryptSecret(secret: string, hash: string): string {
  const key = deriveKey(hash);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a secret using AES-256-GCM
 * @param encryptedSecret The encrypted secret in format: iv:authTag:encryptedData
 * @param hash The request hash (used to derive the encryption key)
 * @returns The decrypted secret
 * @throws Error if decryption fails (invalid hash or corrupted data)
 */
export function decryptSecret(encryptedSecret: string, hash: string): string {
  try {
    const parts = encryptedSecret.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted secret format');
    }
    
    const [ivHex, authTagHex, encryptedData] = parts;
    const key = deriveKey(hash);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt secret: invalid hash or corrupted data');
  }
}

/**
 * Generate a cryptographically secure UUID v4 for request IDs
 * @returns UUID v4 string
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
