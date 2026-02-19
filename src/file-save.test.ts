/**
 * Tests for file-save utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, readFile, chmod, stat, unlink, rmdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { saveSecret, resolvePath, validateServiceName, getServicePath, validateSaveOptions, validateEnvVarName, formatServiceComment, formatAsEnvVar } from './file-save.js';

describe('file-save', () => {
  const testDir = `/tmp/confidant-test-${process.pid}`;
  const testSecret = 'my-test-secret-12345';

  beforeEach(async () => {
    try {
      await mkdir(testDir, { recursive: true });
    } catch {
    }
  });

  afterEach(async () => {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await unlink(join(testDir, file));
      }
      await rmdir(testDir);
    } catch {
    }
  });

  describe('resolvePath', () => {
    it('should expand ~ to home directory', () => {
      const result = resolvePath('~/test/path');
      expect(result).not.toContain('~');
      expect(result).toMatch(new RegExp(`^${homedir()}`));
    });

    it('should resolve relative paths', () => {
      const result = resolvePath('./test/path');
      expect(result.startsWith('/')).toBe(true);
    });

    it('should keep absolute paths as-is', () => {
      const absolutePath = '/test/path';
      const result = resolvePath(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('should handle paths with multiple ~', () => {
      const result = resolvePath('~/test/path~');
      expect(result).not.toMatch(/^~/);
      expect(result).toMatch(new RegExp(`^${homedir()}`));
    });
  });

  describe('validateServiceName', () => {
    it('should accept valid service names', () => {
      expect(validateServiceName('myservice')).toEqual({ valid: true });
      expect(validateServiceName('my-service')).toEqual({ valid: true });
      expect(validateServiceName('my_service')).toEqual({ valid: true });
      expect(validateServiceName('service123')).toEqual({ valid: true });
      expect(validateServiceName('Service123')).toEqual({ valid: true });
    });

    it('should reject invalid service names', () => {
      expect(validateServiceName('service/name')).toEqual({ valid: false, error: expect.stringContaining('letters, numbers, hyphens, and underscores') });
      expect(validateServiceName('service.name')).toEqual({ valid: false, error: expect.stringContaining('letters, numbers, hyphens, and underscores') });
      expect(validateServiceName('service@name')).toEqual({ valid: false, error: expect.stringContaining('letters, numbers, hyphens, and underscores') });
      expect(validateServiceName('service name')).toEqual({ valid: false, error: expect.stringContaining('letters, numbers, hyphens, and underscores') });
      expect(validateServiceName('')).toEqual({ valid: false, error: 'Service name cannot be empty' });
    });

    it('should reject service names exceeding max length', () => {
      const longName = 'a'.repeat(201);
      expect(validateServiceName(longName)).toEqual({ valid: false, error: 'Service name must not exceed 200 characters' });
    });

    it('should accept service names at max length', () => {
      const name = 'a'.repeat(200);
      expect(validateServiceName(name)).toEqual({ valid: true });
    });
  });

  describe('getServicePath', () => {
    it('should generate correct service path', () => {
      const result = getServicePath('serpapi');
      expect(result).toBe('~/.config/serpapi/api_key');
    });

    it('should generate path with hyphens', () => {
      const result = getServicePath('my-awesome-service');
      expect(result).toBe('~/.config/my-awesome-service/api_key');
    });

    it('should generate path with underscores', () => {
      const result = getServicePath('my_service');
      expect(result).toBe('~/.config/my_service/api_key');
    });
  });

  describe('validateSaveOptions', () => {
    it('should accept valid --save option', () => {
      const result = validateSaveOptions('/path/to/file', undefined, undefined);
      expect(result.valid).toBe(true);
    });

    it('should accept valid --service option', () => {
      const result = validateSaveOptions(undefined, 'myservice', undefined);
      expect(result.valid).toBe(true);
    });

    it('should accept --env with --save', () => {
      const result = validateSaveOptions('/path/to/file', undefined, 'MY_VAR');
      expect(result.valid).toBe(true);
    });

    it('should accept --env with --service', () => {
      const result = validateSaveOptions(undefined, 'myservice', 'MY_VAR');
      expect(result.valid).toBe(true);
    });

    it('should reject both --save and --service', () => {
      const result = validateSaveOptions('/path/to/file', 'myservice', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('--save and --service are mutually exclusive');
    });

    it('should reject --env without --save or --service', () => {
      const result = validateSaveOptions(undefined, undefined, 'MY_VAR');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('--env requires --save or --service');
    });

    it('should reject invalid service name', () => {
      const result = validateSaveOptions(undefined, 'service/name', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Service name must contain only');
    });

    it('should reject invalid env variable name', () => {
      const result = validateSaveOptions('/path/to/file', undefined, 'INVALID-NAME');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Environment variable name must contain only uppercase letters');
    });
  });

  describe('validateEnvVarName', () => {
    it('should accept valid env variable names', () => {
      expect(validateEnvVarName('MY_VAR')).toEqual({ valid: true });
      expect(validateEnvVarName('MYVAR')).toEqual({ valid: true });
      expect(validateEnvVarName('MY_VAR_123')).toEqual({ valid: true });
      expect(validateEnvVarName('_PRIVATE_VAR')).toEqual({ valid: true });
      expect(validateEnvVarName('A')).toEqual({ valid: true });
    });

    it('should reject env variable names with lowercase', () => {
      expect(validateEnvVarName('my_var')).toEqual({ valid: false, error: expect.stringContaining('uppercase letters') });
    });

    it('should reject env variable names with special characters', () => {
      expect(validateEnvVarName('MY-VAR')).toEqual({ valid: false, error: expect.stringContaining('uppercase letters') });
      expect(validateEnvVarName('MY VAR')).toEqual({ valid: false, error: expect.stringContaining('uppercase letters') });
      expect(validateEnvVarName('MY.VAR')).toEqual({ valid: false, error: expect.stringContaining('uppercase letters') });
    });

    it('should reject env variable names starting with numbers', () => {
      expect(validateEnvVarName('1_VAR')).toEqual({ valid: false, error: expect.stringContaining('start with a letter or underscore') });
      expect(validateEnvVarName('123MYVAR')).toEqual({ valid: false, error: expect.stringContaining('start with a letter or underscore') });
    });

    it('should reject empty env variable names', () => {
      expect(validateEnvVarName('')).toEqual({ valid: false, error: 'Environment variable name cannot be empty' });
    });
  });

  describe('formatServiceComment', () => {
    it('should format service name as comment', () => {
      expect(formatServiceComment('MyAPI')).toBe('# Service: MyAPI');
      expect(formatServiceComment('service-123')).toBe('# Service: service-123');
    });
  });

  describe('formatAsEnvVar', () => {
    it('should format secret as environment variable', () => {
      expect(formatAsEnvVar('API_KEY', 'secret123')).toBe('API_KEY=secret123');
      expect(formatAsEnvVar('MY_VAR', 'my-secret-value')).toBe('MY_VAR=my-secret-value');
    });
  });

  describe('saveSecret', () => {
    it('should save secret to file with parent directory creation', async () => {
      const testFile = join(testDir, 'nested', 'dir', 'secret.txt');
      const result = await saveSecret(testSecret, { path: testFile, quiet: true });

      expect(result.savedTo).toBe(testFile);
      expect(result.permissions).toBe('600');

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should set file permissions to 600', async () => {
      const testFile = join(testDir, 'secret.txt');
      await saveSecret(testSecret, { path: testFile, quiet: true });

      const stats = await stat(testFile);
      const mode = (stats.mode & parseInt('777', 8)).toString(8);
      expect(mode).toBe('600');
    });

    it('should set environment variable when specified', async () => {
      const testFile = join(testDir, 'secret.txt');
      const envVar = 'TEST_SECRET_VAR';
      delete process.env[envVar];

      await saveSecret(testSecret, { path: testFile, envVar, quiet: true });

      expect(process.env[envVar]).toBe(testSecret);
      delete process.env[envVar];
    });

    it('should not set environment variable when not specified', async () => {
      const testFile = join(testDir, 'secret.txt');
      const envVar = 'TEST_SECRET_VAR';
      const originalValue = 'original';
      process.env[envVar] = originalValue;

      await saveSecret(testSecret, { path: testFile, quiet: true });

      expect(process.env[envVar]).toBe(originalValue);
      delete process.env[envVar];
    });

    it('should expand ~ in path', async () => {
      const testFile = `~/confidant-test-secret-${Date.now()}.txt`;
      const result = await saveSecret(testSecret, { path: testFile, quiet: true });

      expect(result.savedTo).not.toContain('~');

      const content = await readFile(result.savedTo, 'utf8');
      expect(content).toBe(testSecret);

      await unlink(result.savedTo);
    });

    it('should handle paths with tilde expansion and nested directories', async () => {
      const uniqueId = Date.now();
      const testFile = `~/confidant-test-${uniqueId}/nested/secret.txt`;
      const result = await saveSecret(testSecret, { path: testFile, quiet: true });

      expect(result.savedTo).not.toContain('~');

      const content = await readFile(result.savedTo, 'utf8');
      expect(content).toBe(testSecret);

      await unlink(result.savedTo);
      try {
        await rmdir(join(homedir(), `confidant-test-${uniqueId}`, 'nested'));
        await rmdir(join(homedir(), `confidant-test-${uniqueId}`));
      } catch {
      }
    });

    it('should return envVar in result when specified', async () => {
      const testFile = join(testDir, 'secret.txt');
      const envVar = 'MY_ENV_VAR';

      const result = await saveSecret(testSecret, { path: testFile, envVar, quiet: true });

      expect(result.envVar).toBe(envVar);
      delete process.env[envVar];
    });

    it('should not return envVar in result when not specified', async () => {
      const testFile = join(testDir, 'secret.txt');

      const result = await saveSecret(testSecret, { path: testFile, quiet: true });

      expect(result.envVar).toBeUndefined();
    });

    it('should handle secret with special characters', async () => {
      const specialSecret = 'test\nsecret\twith\rspecial\nchars';
      const testFile = join(testDir, 'secret.txt');

      await saveSecret(specialSecret, { path: testFile, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(specialSecret);
    });

    it('should save secret with service comment', async () => {
      const testFile = join(testDir, 'secret.txt');
      const serviceName = 'MyAPI';

      await saveSecret(testSecret, { path: testFile, service: serviceName, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should save secret with env variable format', async () => {
      const testFile = join(testDir, 'secret.txt');
      const envVar = 'API_KEY';

      await saveSecret(testSecret, { path: testFile, envVar, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(`${envVar}=${testSecret}`);
    });

    it('should save secret with service and env — raw secret only', async () => {
      const testFile = join(testDir, 'secret.txt');
      const serviceName = 'MyAPI';
      const envVar = 'API_KEY';

      await saveSecret(testSecret, { path: testFile, service: serviceName, envVar, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should return service in result when specified', async () => {
      const testFile = join(testDir, 'secret.txt');
      const serviceName = 'MyAPI';

      const result = await saveSecret(testSecret, { path: testFile, service: serviceName, quiet: true });

      expect(result.service).toBe(serviceName);
    });

    it('should overwrite existing file in quiet mode', async () => {
      const testFile = join(testDir, 'secret.txt');
      const initialSecret = 'initial-secret';

      await saveSecret(initialSecret, { path: testFile, quiet: true });

      const newSecret = 'new-secret';
      await saveSecret(newSecret, { path: testFile, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(newSecret);
    });
  });
});
