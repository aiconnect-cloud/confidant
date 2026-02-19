import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { routes } from './routes.js';
import { storageRegistry, validatorRegistry, transformerRegistry, MemoryStorageModule, BasicValidatorModule, UppercaseTransformerModule } from './registry.js';
import { detectAllLocalIps } from './network-detection.js';

/**
 * Server configuration options
 */
export interface ServerOptions {
  port?: number;
  host?: string;
}

/**
 * Initialize the registries with default modules
 */
async function initializeRegistries(): Promise<void> {
  try {
    // Register example storage module
    await storageRegistry.register('memory', MemoryStorageModule);
    
    // Register example validator module
    await validatorRegistry.register('basic', BasicValidatorModule);
    
    // Register example transformer module
    await transformerRegistry.register('uppercase', UppercaseTransformerModule);
  } catch (error) {
    throw new Error(`Failed to initialize registries: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start the Confidant server
 * 
 * @param options - Server configuration options
 * @returns A promise that resolves when the server is ready, with a cleanup function
 */
export async function startServer(options: ServerOptions = {}): Promise<() => Promise<void>> {
  const port = options.port ?? parseInt(process.env.CONFIDANT_PORT || process.env.PORT || '3000');
  const host = options.host ?? 'localhost';

  // Create Hono app
  const app = new Hono();

  // Register routes
  app.route('/', routes);

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok', message: 'Confidant is running' });
  });

  // Initialize registries before starting server
  await initializeRegistries();

  // Create a promise that resolves when the server is ready
  let serverReadyResolve: () => void;
  const serverReady = new Promise<void>((resolve) => {
    serverReadyResolve = resolve;
  });

  // Start the server
  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  }, (info) => {
    serverReadyResolve();
  });

  // Wait for server to be ready
  await serverReady;

  // Return cleanup function
  return async () => {
    server.close();
    await storageRegistry.clear();
    await validatorRegistry.clear();
    await transformerRegistry.clear();
  };
}

/**
 * Get server URLs for display
 *
 * @param port - Server port
 * @param host - Server host
 * @returns Object with localhost and network URLs
 */
export function getServerUrls(port: number, host: string) {
  const localIps = detectAllLocalIps();

  // For display, use localhost if host is 0.0.0.0
  const displayHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;

  return {
    localhost: `http://${displayHost}:${port}`,
    networkUrls: localIps.map(ip => `http://${ip}:${port}`),
    localIps,
    // Keep backward compatibility
    network: localIps.length > 0 ? `http://${localIps[0]}:${port}` : null,
    localIp: localIps.length > 0 ? localIps[0] : null,
  };
}
