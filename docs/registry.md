# Modular Registry System

Confidant includes a modular registry system that enables dynamic registration and management of components. This provides extensibility and allows for plugin-like architecture.

## Overview

The registry system provides:
- **Type-safe module registration** using TypeScript generics
- **Lifecycle hooks** (`init`, `destroy`) for module initialization and cleanup
- **Multiple registry types** for different component categories
- **Singleton instances** for consistent access across the application

## Module Types

### Storage Modules

Storage modules handle data persistence and retrieval:

```typescript
import { StorageModule, storageRegistry } from './registry.js';

const myStorage: StorageModule = {
  name: 'my-storage',

  async init() {
    console.log('Initializing storage...');
  },

  async get(key: string) {
    // Retrieve value by key
    return value;
  },

  async set(key: string, value: any, ttl?: number) {
    // Store value with optional TTL
  },

  async delete(key: string) {
    // Delete value by key
  }
};

// Register the module
await storageRegistry.register('my-storage', myStorage);

// Retrieve and use the module
const storage = storageRegistry.get('my-storage');
await storage?.set('key', 'value');
```

### Validator Modules

Validator modules handle data validation:

```typescript
import { ValidatorModule, validatorRegistry } from './registry.js';

const myValidator: ValidatorModule = {
  name: 'my-validator',

  private errors: string[] = [],

  async init() {
    console.log('Initializing validator...');
  },

  validate(data: any): boolean {
    this.errors = [];
    // Validation logic
    if (!data) {
      this.errors.push('Data is required');
      return false;
    }
    return true;
  },

  getErrors(): string[] {
    return [...this.errors];
  }
};

await validatorRegistry.register('my-validator', myValidator);
```

### Transformer Modules

Transformer modules handle data transformation:

```typescript
import { TransformerModule, transformerRegistry } from './registry.js';

const myTransformer: TransformerModule = {
  name: 'my-transformer',

  async init() {
    console.log('Initializing transformer...');
  },

  transform(data: any): any {
    // Transform data
    if (typeof data === 'string') {
      return data.toUpperCase();
    }
    return data;
  }
};

await transformerRegistry.register('my-transformer', myTransformer);
```

## Lifecycle Hooks

Modules can implement optional lifecycle hooks:

```typescript
const moduleWithLifecycle = {
  name: 'lifecycle-module',

  // Called when module is registered
  async init() {
    console.log('Module initializing...');
    // Setup resources, connections, etc.
  },

  // Called when module is unregistered
  async destroy() {
    console.log('Module cleaning up...');
    // Release resources, close connections, etc.
  }
};
```

## Registry API

### `register(name: string, module: T): Promise<void>`

Register a module with the given name.

```typescript
await storageRegistry.register('redis', redisStorageModule);
```

### `unregister(name: string): Promise<void>`

Unregister a module by name.

```typescript
await storageRegistry.unregister('redis');
```

### `get(name: string): T | undefined`

Retrieve a registered module by name.

```typescript
const storage = storageRegistry.get('redis');
if (storage) {
  await storage.get('key');
}
```

### `has(name: string): boolean`

Check if a module is registered.

```typescript
if (storageRegistry.has('redis')) {
  console.log('Redis storage is available');
}
```

### `list(): string[]`

Get list of all registered module names.

```typescript
const modules = storageRegistry.list();
console.log('Available modules:', modules);
```

### `clear(): Promise<void>`

Clear all registered modules.

```typescript
await storageRegistry.clear();
```

## Error Handling

The registry throws errors for invalid operations:

```typescript
try {
  await storageRegistry.register('redis', redisModule);
  await storageRegistry.register('redis', redisModule); // Error: duplicate
} catch (error) {
  console.error('Registration failed:', error.message);
}

try {
  await storageRegistry.unregister('non-existent'); // Error: not found
} catch (error) {
  console.error('Unregistration failed:', error.message);
}
```

## Example Modules

Confidant includes example modules:

- **MemoryStorageModule**: In-memory storage with TTL support
- **BasicValidatorModule**: Simple validation for non-empty data
- **UppercaseTransformerModule**: Transforms strings to uppercase

These are automatically registered on application startup.
