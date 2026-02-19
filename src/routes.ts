import { Hono } from 'hono';
import { z } from 'zod';
import { MemoryStorage, SecretData } from './storage.js';
import { defaultRateLimiter } from './rate-limiter.js';
import { detectLocalIp } from './network-detection.js';
import { getRequestFormHtml } from './templates/request-form.js';

/**
 * API Routes
 * 
 * Defines the API endpoints for the Confidant secret handoff system.
 * Implements RESTful endpoints for creating, retrieving, deleting, and checking status of secrets.
 * 
 * Security Considerations:
 * - Secret IDs are UUID v4 (cryptographically random), making guessing infeasible
 * - No authentication is implemented; anyone with the secret ID can access it
 * - Secrets are stored in memory only; server restart loses all data
 * - No rate limiting is implemented; API could be abused to exhaust memory
 * 
 * MemoryStorage Integration:
 * - Uses a singleton MemoryStorage instance at module level
 * - All endpoints access the same data store
 * - Automatic cleanup runs every 60 seconds to remove expired secrets
 */

// Create singleton MemoryStorage instance with 60-second cleanup interval
const storage = new MemoryStorage(60000, true);

/**
 * Zod schema for validating POST /secrets request body
 */
const createSecretSchema = z.object({
  secret: z.string().min(1, "Secret cannot be empty"),
  ttl: z.number().positive("TTL must be a positive number").optional(),
  maxAccessCount: z.number().positive("Max access count must be a positive number").optional()
});

/**
 * Zod schema for validating secret ID parameter
 * Note: We use a more lenient validation to allow non-existent IDs to pass through
 * and be handled by the storage layer (which returns null for non-existent secrets)
 */
const secretIdSchema = z.string().min(1, "Secret ID is required");

/**
 * Helper function for consistent error responses
 * @param message - Error message
 * @returns JSON object with error field
 */
function errorResponse(message: string) {
  return { error: message };
}

const routes = new Hono();

/**
 * GET /api/urls
 *
 * Returns all accessible URLs with context and recommendations.
 *
 * Response (200 OK):
 * - urls (array): Array of URL objects with url, context, type, and address
 * - recommended (object): The URL object recommended for the current client
 * - serverInfo (object): Object with port and protocol information
 *
 * Response (500 Internal Server Error): Error detecting URLs
 * - error (string): Error message
 */
routes.get('/api/urls', async (c) => {
  try {
    // Get the server port from environment or default
    const port = parseInt(process.env.PORT || '3000');

    // Detect local IP for network URL
    const localIp = detectLocalIp();

    // Generate URLs
    const urls = {
      localhost: `http://localhost:${port}`,
      network: localIp ? `http://${localIp}:${port}` : null,
    };

    // Return response
    return c.json({
      urls,
      serverInfo: {
        port,
        protocol: 'http',
        localIp,
      },
    }, 200);
  } catch (error) {
    return c.json(errorResponse('Internal server error'), 500);
  }
});

/**
 * POST /secrets
 * 
 * Creates a new secret with optional TTL and max access count parameters.
 * 
 * Request Body:
 * - secret (string, required): The secret value to store
 * - ttl (number, optional): Time to live in milliseconds (default: 1 hour)
 * - maxAccessCount (number, optional): Maximum number of times the secret can be accessed
 * 
 * Response (201 Created):
 * - id (string): The unique secret ID (UUID v4)
 * - createdAt (string): ISO 8601 timestamp of creation
 * - expiresAt (string): ISO 8601 timestamp of expiration
 * - maxAccessCount (number|null): Maximum access count, if provided
 * 
 * Response (400 Bad Request): Validation error
 * - error (string): Error message describing the validation failure
 */
routes.post('/secrets', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validationResult = createSecretSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json(errorResponse(validationResult.error.errors[0].message), 400);
    }
    
    const { secret, ttl, maxAccessCount } = validationResult.data;
    
    // Store the secret
    const id = await storage.store(secret, { ttl, maxAccessCount });
    
    // Calculate timestamps without retrieving (to avoid incrementing access count)
    const now = new Date();
    const expiresAt = ttl ? new Date(now.getTime() + ttl) : new Date(now.getTime() + 3600000); // Default 1 hour
    
    // Return success response
    const response: any = {
      id: id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    
    if (maxAccessCount !== undefined) {
      response.maxAccessCount = maxAccessCount;
    }
    
    return c.json(response, 201);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

/**
 * GET /secrets/:id
 * 
 * Retrieves a secret by ID and increments the access count.
 * 
 * Path Parameters:
 * - id (string): The secret ID (UUID v4)
 * 
 * Response (200 OK):
 * - id (string): The secret ID
 * - secret (string): The secret value
 * - accessCount (number): Current access count
 * - maxAccessCount (number|null): Maximum access count, if set
 * - createdAt (string): ISO 8601 timestamp of creation
 * - expiresAt (string): ISO 8601 timestamp of expiration
 * 
 * Response (404 Not Found): Secret does not exist
 * - error (string): "Secret not found"
 * 
 * Response (410 Gone): Secret is expired or access limit exceeded
 * - error (string): "Secret has expired" or "Secret access limit exceeded"
 * 
 * Response (400 Bad Request): Invalid secret ID format
 * - error (string): Error message
 */
routes.get('/secrets/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate secret ID
    const validationResult = secretIdSchema.safeParse(id);
    if (!validationResult.success) {
      return c.json(errorResponse(validationResult.error.errors[0].message), 400);
    }
    
    // Retrieve the secret
    const secretData = await storage.retrieve(id);
    
    if (!secretData) {
      // Check if secret exists (might be expired or access limit exceeded)
      // Since retrieve() returns null for both not found and expired/limit exceeded,
      // we can't distinguish without additional logic. For simplicity, return 404.
      return c.json(errorResponse("Secret not found"), 404);
    }
    
    // Note: This check is a safety net. After retrieve() increments accessCount,
    // accessCount can equal maxAccessCount on the last valid access, which is correct.
    // We only reject if accessCount somehow exceeded the limit.
    if (secretData.maxAccessCount !== undefined && secretData.accessCount > secretData.maxAccessCount) {
      return c.json(errorResponse("Secret access limit exceeded"), 410);
    }
    
    // Return secret data
    return c.json({
      id: secretData.id,
      secret: secretData.secret,
      accessCount: secretData.accessCount,
      maxAccessCount: secretData.maxAccessCount || null,
      createdAt: secretData.createdAt.toISOString(),
      expiresAt: secretData.expiresAt.toISOString()
    }, 200);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

/**
 * DELETE /secrets/:id
 * 
 * Deletes a secret by ID before expiration.
 * 
 * Path Parameters:
 * - id (string): The secret ID (UUID v4)
 * 
 * Response (200 OK):
 * - id (string): The secret ID
 * - deleted (boolean): Always true
 * 
 * Response (404 Not Found): Secret does not exist
 * - error (string): "Secret not found"
 * 
 * Response (400 Bad Request): Invalid secret ID format
 * - error (string): Error message
 */
routes.delete('/secrets/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate secret ID
    const validationResult = secretIdSchema.safeParse(id);
    if (!validationResult.success) {
      return c.json(errorResponse(validationResult.error.errors[0].message), 400);
    }
    
    // Delete the secret
    const deleted = await storage.delete(id);
    
    if (!deleted) {
      return c.json(errorResponse("Secret not found"), 404);
    }
    
    return c.json({ id, deleted: true }, 200);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

/**
 * GET /secrets/:id/status
 * 
 * Returns secret metadata without incrementing the access count.
 * Allows clients to check if a secret exists and is valid.
 * 
 * Path Parameters:
 * - id (string): The secret ID (UUID v4)
 * 
 * Response (200 OK) - Valid secret:
 * - id (string): The secret ID
 * - exists (boolean): true
 * - expired (boolean): false
 * - accessCount (number): Current access count
 * - maxAccessCount (number|null): Maximum access count, if set
 * - createdAt (string): ISO 8601 timestamp of creation
 * - expiresAt (string): ISO 8601 timestamp of expiration
 * 
 * Response (200 OK) - Expired secret:
 * - id (string): The secret ID
 * - exists (boolean): false
 * - expired (boolean): true
 * 
 * Response (200 OK) - Non-existent secret:
 * - id (string): The secret ID
 * - exists (boolean): false
 * - expired (boolean): false
 * 
 * Response (200 OK) - Access limit exceeded:
 * - id (string): The secret ID
 * - exists (boolean): false
 * - expired (boolean): false
 * - accessLimitExceeded (boolean): true
 * 
 * Response (400 Bad Request): Invalid secret ID format
 * - error (string): Error message
 */
routes.get('/secrets/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate secret ID
    const validationResult = secretIdSchema.safeParse(id);
    if (!validationResult.success) {
      return c.json(errorResponse(validationResult.error.errors[0].message), 400);
    }
    
    // Use peek() to check status without incrementing access count
    const secretData = await storage.peek(id);

    if (!secretData) {
      // Secret doesn't exist, is expired, or access limit exceeded
      return c.json({ id, exists: false, expired: false }, 200);
    }
    
    // Secret is valid
    return c.json({
      id: secretData.id,
      exists: true,
      expired: false,
      accessCount: secretData.accessCount,
      maxAccessCount: secretData.maxAccessCount || null,
      createdAt: secretData.createdAt.toISOString(),
      expiresAt: secretData.expiresAt.toISOString()
    }, 200);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

// ==================== Secret Request Endpoints ====================

/**
 * Zod schema for validating POST /requests request body
 */
const createRequestSchema = z.object({
  expiresIn: z.number().min(60).max(86400).optional(),
  label: z.string().min(1).max(200).optional()
});

/**
 * Zod schema for validating secret submission request body
 */
const submitSecretSchema = z.object({
  secret: z.string().min(1).max(65536)
});

/**
 * Helper function to get client IP address
 */
function getClientIp(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0] || 
         c.req.header('x-real-ip') || 
         'unknown';
}

/**
 * POST /requests
 * 
 * Creates a new secret request and returns the request details.
 * 
 * Request Body:
 * - expiresIn (number, optional): Time to live in seconds (default: 86400, min: 60, max: 86400)
 * 
 * Response (201 Created):
 * - id (string): The unique request ID (UUID v4)
 * - hash (string): The access hash
 * - url (string): The complete URL for secret submission
 * - expiresAt (string): ISO 8601 timestamp of expiration
 * - status (string): "pending"
 * 
 * Response (400 Bad Request): Validation error
 * - error (string): Error message describing the validation failure
 */
routes.post('/requests', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validationResult = createRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json(errorResponse(validationResult.error.errors[0].message), 400);
    }
    
    const { expiresIn = 86400, label } = validationResult.data;

    // Create the request
    const request = storage.createRequest(expiresIn, label);

    // Construct the URL
    const protocol = c.req.header('x-forwarded-proto') || 'http';
    const host = c.req.header('host') || 'localhost:3000';
    const url = `${protocol}://${host}/requests/${request.hash}`;

    // Return success response
    const response: any = {
      id: request.id,
      hash: request.hash,
      url: url,
      expiresAt: request.expiresAt.toISOString(),
      status: request.status
    };

    if (label) {
      response.label = label;
    }

    return c.json(response, 201);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

/**
 * GET /requests/:hash
 * 
 * Returns an HTML form for secret submission.
 * 
 * Path Parameters:
 * - hash (string): The request hash
 * 
 * Response (200 OK): HTML form
 * 
 * Response (404 Not Found): Invalid hash
 * - error (string): Error message
 * 
 * Response (410 Gone): Expired or completed request
 * - error (string): Error message
 */
routes.get('/requests/:hash', async (c) => {
  try {
    const hash = c.req.param('hash');
    
    // Get the request
    const request = storage.getRequestByHash(hash);
    
    if (!request) {
      return c.html(getRequestFormHtml({ hash, type: 'not-found', expiresAt: new Date() }), 404);
    }
    
    // Check if expired
    if (request.status === 'expired') {
      return c.html(getRequestFormHtml({ hash, type: 'expired', expiresAt: request.expiresAt }), 410);
    }
    
    // Check if already completed
    if (request.status === 'completed' || request.status === 'retrieved') {
      return c.html(getRequestFormHtml({ hash, type: 'completed', expiresAt: request.expiresAt }), 200);
    }
    
    // Return the form
    return c.html(getRequestFormHtml({ hash, label: request.label, expiresAt: request.expiresAt, type: 'form' }), 200);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

/**
 * POST /requests/:hash
 * 
 * Accepts secret submissions via the web form.
 * 
 * Path Parameters:
 * - hash (string): The request hash
 * 
 * Request Body:
 * - secret (string, required): The secret value
 * 
 * Response (200 OK): Success
 * - message (string): Success message
 * 
 * Response (400 Bad Request): Validation error
 * - error (string): Error message
 * 
 * Response (404 Not Found): Invalid hash
 * - error (string): Error message
 * 
 * Response (409 Conflict): Already completed
 * - error (string): Error message
 * 
 * Response (410 Gone): Expired
 * - error (string): Error message
 * 
 * Response (413 Payload Too Large): Secret too large
 * - error (string): Error message
 */
routes.post('/requests/:hash', async (c) => {
  try {
    const hash = c.req.param('hash');
    
    // Parse and validate request body
    const body = await c.req.json();
    const validationResult = submitSecretSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json(errorResponse(validationResult.error.errors[0].message), 400);
    }
    
    const { secret } = validationResult.data;
    
    // Get the request
    const request = storage.getRequestByHash(hash);
    
    if (!request) {
      return c.json(errorResponse("Request not found"), 404);
    }
    
    // Check if expired
    if (request.status === 'expired' || request.expiresAt < new Date()) {
      return c.json(errorResponse("Request has expired"), 410);
    }
    
    // Check if already completed
    if (request.status !== 'pending') {
      return c.json(errorResponse("Secret has already been submitted for this request"), 409);
    }
    
    // Submit the secret
    const updatedRequest = storage.submitSecret(hash, secret);
    
    if (!updatedRequest) {
      return c.json(errorResponse("Failed to submit secret"), 500);
    }
    
    return c.json({ message: "Secret submitted successfully" }, 200);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

/**
 * GET /requests/:id/poll
 * 
 * Polls for secret availability and retrieves the secret if available.
 * 
 * Path Parameters:
 * - id (string): The request ID (UUID v4)
 * 
 * Response (200 OK): Success
 * - id (string): The request ID
 * - status (string): The request status
 * - secret (string|null): The secret value if available
 * 
 * Response (404 Not Found): Request not found or already retrieved
 * - error (string): Error message
 * 
 * Response (410 Gone): Expired
 * - error (string): Error message
 */
routes.get('/requests/:id/poll', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Get the request
    const request = storage.getRequestById(id);
    
    if (!request) {
      return c.json(errorResponse("Request not found"), 404);
    }
    
    // Check if expired
    if (request.status === 'expired' || request.expiresAt < new Date()) {
      return c.json(errorResponse("Request has expired"), 410);
    }
    
    // Check if already retrieved
    if (request.status === 'retrieved') {
      return c.json(errorResponse("Secret has already been retrieved"), 404);
    }
    
    // If pending, return pending status
    if (request.status === 'pending') {
      const response: any = {
        id: request.id,
        status: request.status,
        secret: null
      };

      if (request.label) {
        response.label = request.label;
      }

      return c.json(response, 200);
    }

    // If completed, get and delete the secret
    if (request.status === 'completed') {
      const secret = storage.getAndDeleteSecret(id);

      if (secret === null) {
        return c.json(errorResponse("Failed to retrieve secret"), 500);
      }

      const response: any = {
        id: request.id,
        status: 'retrieved',
        secret: secret
      };

      if (request.label) {
        response.label = request.label;
      }

      return c.json(response, 200);
    }
    
    return c.json(errorResponse("Unexpected request status"), 500);
  } catch (error) {
    return c.json(errorResponse("Internal server error"), 500);
  }
});

export { routes };
