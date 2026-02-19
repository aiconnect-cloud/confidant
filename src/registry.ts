/**
 * Modular Registry System
 * 
 * A generic, type-safe registry system for managing components/modules.
 * Enables dynamic registration, retrieval, and lifecycle management of modules.
 */

/**
 * Base Module interface with optional lifecycle hooks
 * All modules must implement this interface to be registered in a registry.
 */
export interface Module {
  /** Unique identifier for the module */
  name: string;
  
  /** Optional initialization hook called when module is registered */
  init?(): Promise<void> | void;
  
  /** Optional cleanup hook called when module is unregistered */
  destroy?(): Promise<void> | void;
}

/**
 * Generic Registry class for managing modules
 * @template T - The module type (must extend Module)
 */
export class Registry<T extends Module> {
  private modules: Map<string, T> = new Map();

  /**
   * Registers a module with the given name
   * @param name - Unique identifier for the module
   * @param module - Module instance to register
   * @throws Error if a module with the same name is already registered
   */
  async register(name: string, module: T): Promise<void> {
    if (this.modules.has(name)) {
      throw new Error(`Module with name '${name}' is already registered`);
    }

    // Call init hook if present
    if (module.init) {
      await module.init();
    }

    this.modules.set(name, module);
  }

  /**
   * Unregisters a module by name
   * @param name - Name of the module to unregister
   * @throws Error if module is not found
   */
  async unregister(name: string): Promise<void> {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module '${name}' not found`);
    }

    // Call destroy hook if present
    if (module.destroy) {
      await module.destroy();
    }

    this.modules.delete(name);
  }

  /**
   * Retrieves a registered module by name
   * @param name - Name of the module to retrieve
   * @returns Module instance if found, undefined otherwise
   */
  get(name: string): T | undefined {
    return this.modules.get(name);
  }

  /**
   * Checks if a module is registered
   * @param name - Name of the module to check
   * @returns true if module is registered, false otherwise
   */
  has(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Returns list of all registered module names
   * @returns Array of module names
   */
  list(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Clears all registered modules
   * Calls destroy hook on all modules if present
   */
  async clear(): Promise<void> {
    const promises = Array.from(this.modules.values()).map(async (module) => {
      if (module.destroy) {
        await module.destroy();
      }
    });
    await Promise.all(promises);
    this.modules.clear();
  }
}

/**
 * Storage Module interface for storage backends
 */
export interface StorageModule extends Module {
  /** Retrieve a value by key */
  get(key: string): Promise<any>;
  
  /** Set a value with optional TTL */
  set(key: string, value: any, ttl?: number): Promise<void>;
  
  /** Delete a value by key */
  delete(key: string): Promise<void>;
}

/**
 * Validator Module interface for data validation
 */
export interface ValidatorModule extends Module {
  /** Validate data and return true if valid */
  validate(data: any): boolean | Promise<boolean>;
  
  /** Get validation errors */
  getErrors(): string[];
}

/**
 * Transformer Module interface for data transformation
 */
export interface TransformerModule extends Module {
  /** Transform data and return the result */
  transform(data: any): any | Promise<any>;
}

/**
 * Singleton registry instances for different module types
 */

/**
 * Registry for storage modules
 */
export const storageRegistry = new Registry<StorageModule>();

/**
 * Registry for validator modules
 */
export const validatorRegistry = new Registry<ValidatorModule>();

/**
 * Registry for transformer modules
 */
export const transformerRegistry = new Registry<TransformerModule>();

/**
 * Example: Memory Storage Module
 * Simple in-memory storage implementation for demonstration
 */
class MemoryStorageModuleImpl implements StorageModule {
  name = 'memory-storage';
  private storage: Map<string, { value: any; expiresAt?: number }> = new Map();
  
  async init() {
    // Module ready
  }

  async destroy() {
    this.storage.clear();
  }
  
  async get(key: string): Promise<any> {
    const entry = this.storage.get(key);
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.storage.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl : undefined;
    this.storage.set(key, { value, expiresAt });
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
}

export const MemoryStorageModule = new MemoryStorageModuleImpl();

/**
 * Example: Basic Validator Module
 * Simple validator that checks if data is not empty
 */
class BasicValidatorModuleImpl implements ValidatorModule {
  name = 'basic-validator';
  private errors: string[] = [];
  
  async init() {
    // Module ready
  }

  async destroy() {
    this.errors = [];
  }
  
  validate(data: any): boolean {
    this.errors = [];
    
    if (data === null || data === undefined) {
      this.errors.push('Data cannot be null or undefined');
      return false;
    }
    
    if (typeof data === 'string' && data.trim() === '') {
      this.errors.push('String cannot be empty');
      return false;
    }
    
    return true;
  }
  
  getErrors(): string[] {
    return [...this.errors];
  }
}

export const BasicValidatorModule = new BasicValidatorModuleImpl();

/**
 * Example: Uppercase Transformer Module
 * Transforms strings to uppercase
 */
export const UppercaseTransformerModule: TransformerModule = {
  name: 'uppercase-transformer',
  
  async init() {
    // Module ready
  },

  async destroy() {
    // Module cleanup
  },
  
  transform(data: any): any {
    if (typeof data === 'string') {
      return data.toUpperCase();
    }
    return data;
  }
};
