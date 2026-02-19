import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { routes } from './routes.js';
import { storageRegistry, validatorRegistry, transformerRegistry, MemoryStorageModule, BasicValidatorModule, UppercaseTransformerModule } from './registry.js';
import { detectAllLocalIps } from './network-detection.js';
export { MemoryStorage, TTLStorage, SecretData, StorageOptions } from './storage.js';

const app = new Hono();

// Register routes
app.route('/', routes);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', message: 'Confidant is running' });
});

// Initialize registries with example modules
async function initializeRegistries() {
  try {
    // Register example storage module
    await storageRegistry.register('memory', MemoryStorageModule);
    console.log('✅ Storage registry initialized with memory module');
    
    // Register example validator module
    await validatorRegistry.register('basic', BasicValidatorModule);
    console.log('✅ Validator registry initialized with basic module');
    
    // Register example transformer module
    await transformerRegistry.register('uppercase', UppercaseTransformerModule);
    console.log('✅ Transformer registry initialized with uppercase module');
  } catch (error) {
    console.error('❌ Failed to initialize registries:', error);
    throw error;
  }
}

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`Starting Confidant server on port ${port}...`);

// Initialize registries before starting server
initializeRegistries().then(() => {
  serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0', // Listen on all interfaces
  }, (info) => {
    console.log(`✅ Confidant running at:`);

    // Detect all local IPs for network URLs
    const localIps = detectAllLocalIps();

    console.log(`  - http://localhost:${info.port} (localhost)`);
    for (const ip of localIps) {
      console.log(`  - http://${ip}:${info.port} (rede local)`);
    }
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
