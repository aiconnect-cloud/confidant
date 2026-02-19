/**
 * English translations for CLI messages
 */
export const translations = {
  // Error messages
  secretCannotBeEmpty: 'Secret cannot be empty',
  ttlMustBePositive: 'TTL must be a positive number',
  maxAccessCountMustBePositive: 'Max access count must be a positive number',
  secretNotFound: 'Secret not found',
  secretHasExpired: 'Secret has expired',
  maxAccessCountExceeded: 'Max access count exceeded',
  connectionFailed: 'Failed to connect to server',
  requestTimedOut: 'Request timed out',
  invalidApiEndpoint: 'Invalid API endpoint',
  invalidJsonResponse: 'Invalid JSON response from server',
  networkError: 'Network error',
  invalidUrlOrHash: 'Invalid URL or hash',
  secretAlreadySubmitted: 'Secret has already been submitted for this request',
  secretRequired: 'Secret is required (use --secret)',
  secretCannotBeEmptyFill: 'Secret cannot be empty',
  requestNotFound: 'Request not found',
  requestExpired: 'Request has expired',
  saveServiceMutuallyExclusive: '--save and --service are mutually exclusive',
  envRequiresSaveOrService: '--env requires --save or --service',
  invalidServiceName: 'Service name must contain only letters, numbers, hyphens, and underscores',
  failedToSaveSecret: 'Failed to save secret: %s',

  // Help descriptions
  programDescription: 'CLI tool for the Confidant secret handoff system',
  createDescription: 'Create a new secret',
  getDescription: 'Retrieve a secret by ID',
  deleteDescription: 'Delete a secret by ID',
  statusDescription: 'Check a secret status by ID',
  serveDescription: 'Start the Confidant server',
  serveRequestDescription: 'Start the server and request a secret',
  fillDescription: 'Submit a secret for an existing request (agent-to-agent)',

  // Option descriptions
  secretOption: 'Secret value (required)',
  ttlOption: 'Time-to-live in milliseconds (optional)',
  maxAccessCountOption: 'Max access count (optional)',
  apiUrlOption: 'API endpoint URL',
  portOption: 'Server port (default: 3000)',
  hostOption: 'Server host (default: localhost)',
  fillUrlArgument: 'Request URL or hash (64 hex characters)',
  fillSecretOption: 'Secret value (use "-" to read from stdin)',
  saveOption: 'Save secret to specified file path',
  serveRequestSaveOption: 'Save the received secret to the specified file path',
  serviceOption: 'Save secret to service config directory (~/.config/<name>/api_key)',
  serveRequestServiceOption: 'Associate the secret with a service name for metadata',
  envOption: 'Set environment variable with secret value',
  serveRequestEnvOption: 'Format the secret as an environment variable (e.g., NAME=value)',

  // Examples
  createExample: 'Example: confidant create --secret "my secret" --ttl 60000 --max-access-count 3',
  getExample: 'Example: confidant get abc123',
  deleteExample: 'Example: confidant delete abc123',
  statusExample: 'Example: confidant status abc123',

  // Success messages
  secretCreated: 'Secret created successfully',
  secretRetrieved: 'Secret retrieved successfully',
  secretDeleted: 'Secret deleted successfully',
  secretStatus: 'Secret status',
  serverStarting: 'Starting Confidant server...',
  serverRunning: '✅ Confidant running at:',
  serverShutdown: 'Shutting down Confidant server...',
  serverStopped: 'Server stopped',
  secretSubmitted: 'Secret submitted successfully',
  secretSaved: 'Secret saved to %s (mode: %s)',
  envVarSet: 'Set environment variable: %s',
  saveAndEnvVarSuccess: 'Secret saved to %s (mode: %s) and set environment variable: %s',

  // Usage information
  usage: 'Usage',
  options: 'Options',
  commands: 'Commands',
  arguments: 'Arguments',
  required: '(required)',
  optional: '(optional)',

  // Server messages
  localhostUrl: '  - %s (localhost)',
  networkUrl: '  - %s (local network)',
  pressCtrlCToStop: 'Press Ctrl+C to stop the server',
} as const;

export type TranslationKey = keyof typeof translations;

/**
 * Get a translation by key
 */
export function t(key: TranslationKey): string {
  return translations[key];
}
