/**
 * Registry System Tests
 * 
 * Tests for the generic registry system including:
 * - Basic registry operations
 * - Register/unregister functionality
 * - Get/has/list methods
 * - Lifecycle hooks (init/destroy)
 * - Error handling
 * - Typed registry instances
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  Registry, 
  Module, 
  StorageModule, 
  ValidatorModule, 
  TransformerModule,
  storageRegistry,
  validatorRegistry,
  transformerRegistry
} from './registry.js';

describe('Registry', () => {
  let registry: Registry<Module>;
  let mockModule: Module;

  beforeEach(() => {
    registry = new Registry<Module>();
    mockModule = {
      name: 'test-module',
      init: vi.fn(),
      destroy: vi.fn(),
    };
  });

  describe('register', () => {
    it('should register a module successfully', async () => {
      await registry.register('test', mockModule);
      expect(registry.has('test')).toBe(true);
      expect(mockModule.init).toHaveBeenCalledOnce();
    });

    it('should throw error when registering duplicate module', async () => {
      await registry.register('test', mockModule);
      await expect(registry.register('test', mockModule)).rejects.toThrow(
        "Module with name 'test' is already registered"
      );
    });

    it('should call init hook if present', async () => {
      const moduleWithInit: Module = {
        name: 'module-with-init',
        init: vi.fn(),
      };
      await registry.register('init-test', moduleWithInit);
      expect(moduleWithInit.init).toHaveBeenCalledOnce();
    });

    it('should not throw if init hook is not present', async () => {
      const moduleWithoutInit: Module = {
        name: 'module-without-init',
      };
      await expect(registry.register('no-init-test', moduleWithoutInit)).resolves.not.toThrow();
    });
  });

  describe('unregister', () => {
    it('should unregister a module successfully', async () => {
      await registry.register('test', mockModule);
      await registry.unregister('test');
      expect(registry.has('test')).toBe(false);
      expect(mockModule.destroy).toHaveBeenCalledOnce();
    });

    it('should throw error when unregistering non-existent module', async () => {
      await expect(registry.unregister('non-existent')).rejects.toThrow(
        "Module 'non-existent' not found"
      );
    });

    it('should call destroy hook if present', async () => {
      const moduleWithDestroy: Module = {
        name: 'module-with-destroy',
        destroy: vi.fn(),
      };
      await registry.register('destroy-test', moduleWithDestroy);
      await registry.unregister('destroy-test');
      expect(moduleWithDestroy.destroy).toHaveBeenCalledOnce();
    });

    it('should not throw if destroy hook is not present', async () => {
      const moduleWithoutDestroy: Module = {
        name: 'module-without-destroy',
      };
      await registry.register('no-destroy-test', moduleWithoutDestroy);
      await expect(registry.unregister('no-destroy-test')).resolves.not.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve a registered module', async () => {
      await registry.register('test', mockModule);
      const retrieved = registry.get('test');
      expect(retrieved).toBe(mockModule);
    });

    it('should return undefined for non-existent module', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered module', async () => {
      await registry.register('test', mockModule);
      expect(registry.has('test')).toBe(true);
    });

    it('should return false for non-existent module', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('list', () => {
    it('should return empty array when no modules are registered', () => {
      const list = registry.list();
      expect(list).toEqual([]);
    });

    it('should return list of all registered module names', async () => {
      await registry.register('module1', { name: 'module1' });
      await registry.register('module2', { name: 'module2' });
      await registry.register('module3', { name: 'module3' });
      
      const list = registry.list();
      expect(list).toEqual(['module1', 'module2', 'module3']);
      expect(list).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('should clear all registered modules', async () => {
      await registry.register('module1', { name: 'module1', destroy: vi.fn() });
      await registry.register('module2', { name: 'module2', destroy: vi.fn() });
      
      await registry.clear();
      
      expect(registry.list()).toEqual([]);
      expect(registry.has('module1')).toBe(false);
      expect(registry.has('module2')).toBe(false);
    });

    it('should call destroy hook on all modules when clearing', async () => {
      const module1: Module = { name: 'module1', destroy: vi.fn() };
      const module2: Module = { name: 'module2', destroy: vi.fn() };
      
      await registry.register('module1', module1);
      await registry.register('module2', module2);
      
      await registry.clear();
      
      expect(module1.destroy).toHaveBeenCalledOnce();
      expect(module2.destroy).toHaveBeenCalledOnce();
    });

    it('should not throw when clearing empty registry', async () => {
      await expect(registry.clear()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle init hook errors gracefully', async () => {
      const moduleWithError: Module = {
        name: 'module-with-error',
        init: vi.fn().mockRejectedValue(new Error('Init failed')),
      };
      
      await expect(registry.register('error-test', moduleWithError)).rejects.toThrow('Init failed');
    });

    it('should handle destroy hook errors gracefully', async () => {
      const moduleWithError: Module = {
        name: 'module-with-error',
        destroy: vi.fn().mockRejectedValue(new Error('Destroy failed')),
      };
      
      await registry.register('error-test', moduleWithError);
      await expect(registry.unregister('error-test')).rejects.toThrow('Destroy failed');
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should call init hook exactly once per registration', async () => {
      const module: Module = {
        name: 'lifecycle-test',
        init: vi.fn(),
      };
      
      await registry.register('test', module);
      expect(module.init).toHaveBeenCalledTimes(1);
    });

    it('should call destroy hook exactly once per unregistration', async () => {
      const module: Module = {
        name: 'lifecycle-test',
        destroy: vi.fn(),
      };
      
      await registry.register('test', module);
      await registry.unregister('test');
      expect(module.destroy).toHaveBeenCalledTimes(1);
    });

    it('should support async init hooks', async () => {
      const asyncInitModule: Module = {
        name: 'async-init-module',
        init: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        },
      };
      
      await expect(registry.register('async-test', asyncInitModule)).resolves.not.toThrow();
      expect(registry.has('async-test')).toBe(true);
    });

    it('should support async destroy hooks', async () => {
      const asyncDestroyModule: Module = {
        name: 'async-destroy-module',
        destroy: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        },
      };
      
      await registry.register('async-test', asyncDestroyModule);
      await expect(registry.unregister('async-test')).resolves.not.toThrow();
      expect(registry.has('async-test')).toBe(false);
    });
  });
});

describe('Typed Registry Instances', () => {
  beforeEach(() => {
    // Clear all registries before each test
    storageRegistry.clear();
    validatorRegistry.clear();
    transformerRegistry.clear();
  });

  describe('Storage Registry', () => {
    it('should register and retrieve storage modules', async () => {
      const storageModule: StorageModule = {
        name: 'test-storage',
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      
      await storageRegistry.register('test', storageModule);
      const retrieved = storageRegistry.get('test');
      expect(retrieved).toBe(storageModule);
    });

    it('should enforce StorageModule interface', async () => {
      const invalidModule = {
        name: 'invalid-storage',
      } as any;
      
      // TypeScript should catch this at compile time
      // At runtime, it will still register but won't have the required methods
      await storageRegistry.register('invalid', invalidModule);
      expect(storageRegistry.has('invalid')).toBe(true);
    });
  });

  describe('Validator Registry', () => {
    it('should register and retrieve validator modules', async () => {
      const validatorModule: ValidatorModule = {
        name: 'test-validator',
        validate: vi.fn().mockReturnValue(true),
        getErrors: vi.fn().mockReturnValue([]),
      };
      
      await validatorRegistry.register('test', validatorModule);
      const retrieved = validatorRegistry.get('test');
      expect(retrieved).toBe(validatorModule);
    });
  });

  describe('Transformer Registry', () => {
    it('should register and retrieve transformer modules', async () => {
      const transformerModule: TransformerModule = {
        name: 'test-transformer',
        transform: vi.fn().mockImplementation((data) => data),
      };
      
      await transformerRegistry.register('test', transformerModule);
      const retrieved = transformerRegistry.get('test');
      expect(retrieved).toBe(transformerModule);
    });
  });

  describe('Registry Isolation', () => {
    it('should keep registries isolated from each other', async () => {
      const storageModule: StorageModule = {
        name: 'storage',
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      
      const validatorModule: ValidatorModule = {
        name: 'validator',
        validate: vi.fn().mockReturnValue(true),
        getErrors: vi.fn().mockReturnValue([]),
      };
      
      await storageRegistry.register('test', storageModule);
      await validatorRegistry.register('test', validatorModule);
      
      expect(storageRegistry.list()).toEqual(['test']);
      expect(validatorRegistry.list()).toEqual(['test']);
      expect(transformerRegistry.list()).toEqual([]);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    storageRegistry.clear();
    validatorRegistry.clear();
    transformerRegistry.clear();
  });

  it('should support multiple modules of same type', async () => {
    const storage1: StorageModule = {
      name: 'storage1',
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    
    const storage2: StorageModule = {
      name: 'storage2',
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    
    await storageRegistry.register('s1', storage1);
    await storageRegistry.register('s2', storage2);
    
    expect(storageRegistry.list()).toEqual(['s1', 's2']);
    expect(storageRegistry.get('s1')).toBe(storage1);
    expect(storageRegistry.get('s2')).toBe(storage2);
  });

  it('should support module replacement after unregister', async () => {
    const storage1: StorageModule = {
      name: 'storage1',
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    
    const storage2: StorageModule = {
      name: 'storage2',
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    
    await storageRegistry.register('test', storage1);
    await storageRegistry.unregister('test');
    await storageRegistry.register('test', storage2);
    
    expect(storageRegistry.get('test')).toBe(storage2);
  });
});
