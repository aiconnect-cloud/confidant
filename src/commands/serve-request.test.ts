/**
 * Tests for serve-request command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, readFile, unlink, rmdir } from 'fs/promises';
import { join } from 'path';
import { validateSaveOptions, saveSecret, checkFileExists } from '../file-save.js';

describe('serve-request command integration', () => {
  const testDir = `/tmp/confidant-serve-test-${process.pid}`;
  const testSecret = 'test-secret-12345';
  let fileCounter = 0;

  function getTestFileName(prefix: string = 'secret'): string {
    return `${prefix}-${fileCounter++}.txt`;
  }

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

  describe('--save flag', () => {
    it('should save secret to specified file', async () => {
      const testFile = join(testDir, getTestFileName('save'));
      await saveSecret(testSecret, { path: testFile, quiet: true });

      const exists = await checkFileExists(testFile);
      expect(exists).toBe(true);

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should create parent directories if they do not exist', async () => {
      const testFile = join(testDir, 'nested', 'dir', getTestFileName('mkdir'));
      await saveSecret(testSecret, { path: testFile, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should overwrite existing file in quiet mode', async () => {
      const testFile = join(testDir, getTestFileName('overwrite'));
      const initialSecret = 'initial-secret';

      await saveSecret(initialSecret, { path: testFile, quiet: true });
      await saveSecret(testSecret, { path: testFile, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });
  });

  describe('--service flag', () => {
    it('should save raw secret with service flag', async () => {
      const testFile = join(testDir, getTestFileName('service-comment'));
      const serviceName = 'MyAPI';

      await saveSecret(testSecret, { path: testFile, service: serviceName, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should return service in save result', async () => {
      const testFile = join(testDir, getTestFileName('service-result'));
      const serviceName = 'MyAPI';

      const result = await saveSecret(testSecret, { path: testFile, service: serviceName, quiet: true });

      expect(result.service).toBe(serviceName);
    });

    it('should validate service name is not empty', () => {
      const validation = validateSaveOptions(undefined, '', undefined);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('cannot be empty');
    });

    it('should validate service name does not exceed max length', () => {
      const longName = 'a'.repeat(201);
      const validation = validateSaveOptions(undefined, longName, undefined);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('exceed 200 characters');
    });
  });

  describe('--env flag', () => {
    it('should format secret as environment variable', async () => {
      const testFile = join(testDir, getTestFileName('env-format'));
      const envVar = 'API_KEY';

      await saveSecret(testSecret, { path: testFile, envVar, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(`${envVar}=${testSecret}`);
    });

    it('should return envVar in save result', async () => {
      const testFile = join(testDir, getTestFileName('env-result'));
      const envVar = 'API_KEY';

      const result = await saveSecret(testSecret, { path: testFile, envVar, quiet: true });

      expect(result.envVar).toBe(envVar);
    });

    it('should validate env variable name is not empty', () => {
      const validation = validateSaveOptions(undefined, undefined, '');
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('cannot be empty');
    });

    it('should validate env variable name format', () => {
      const invalidNames = ['my-var', 'MY VAR', 'MY.VAR', '1_VAR'];
      for (const name of invalidNames) {
        const validation = validateSaveOptions(undefined, undefined, name);
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('must contain only uppercase letters');
      }
    });
  });

  describe('flag combinations', () => {
    it('should combine --save and --service — raw secret', async () => {
      const testFile = join(testDir, getTestFileName('save-service'));
      const serviceName = 'MyAPI';

      await saveSecret(testSecret, { path: testFile, service: serviceName, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should combine --save and --env', async () => {
      const testFile = join(testDir, getTestFileName('save-env'));
      const envVar = 'API_KEY';

      await saveSecret(testSecret, { path: testFile, envVar, quiet: true });

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(`${envVar}=${testSecret}`);
    });

    it('should combine --service and --env — raw secret', async () => {
      const serviceName = 'MyAPI';
      const envVar = 'API_KEY';

      const result = await saveSecret(testSecret, {
        path: join(testDir, getTestFileName('service-env')),
        service: serviceName,
        envVar,
        quiet: true
      });

      expect(result.service).toBe(serviceName);
      expect(result.envVar).toBe(envVar);

      const content = await readFile(result.savedTo, 'utf8');
      expect(content).toBe(testSecret);
    });

    it('should combine all three flags — raw secret', async () => {
      const testFile = join(testDir, getTestFileName('all-flags'));
      const serviceName = 'MyAPI';
      const envVar = 'API_KEY';

      const result = await saveSecret(testSecret, {
        path: testFile,
        service: serviceName,
        envVar,
        quiet: true
      });

      expect(result.savedTo).toBe(testFile);
      expect(result.service).toBe(serviceName);
      expect(result.envVar).toBe(envVar);

      const content = await readFile(testFile, 'utf8');
      expect(content).toBe(testSecret);
    });
  });

  describe('validation', () => {
    it('should reject --save and --service together', () => {
      const validation = validateSaveOptions('/path/to/file', 'myservice', undefined);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('mutually exclusive');
    });

    it('should reject --env without --save or --service', () => {
      const validation = validateSaveOptions(undefined, undefined, 'MY_VAR');
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('--env requires --save or --service');
    });

    it('should accept --env with --save', () => {
      const validation = validateSaveOptions('/path/to/file', undefined, 'MY_VAR');
      expect(validation.valid).toBe(true);
    });

    it('should accept --env with --service', () => {
      const validation = validateSaveOptions(undefined, 'myservice', 'MY_VAR');
      expect(validation.valid).toBe(true);
    });
  });
});
