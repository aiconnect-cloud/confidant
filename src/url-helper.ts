import { ApiClient } from './api-client.js';

/**
 * Generate URLs for accessing a secret request
 * Returns both localhost and network URLs for cross-device access
 */
export function generateUrls(
  apiUrl: string,
  hash: string,
  localIp: string | null
): { localhost: string; network: string | null } {
  // Parse the API URL to get the protocol and port
  const url = new URL(apiUrl);
  const protocol = url.protocol.replace(':', '');
  const port = url.port || (protocol === 'https' ? '443' : '3000');

  // Generate localhost URL (uses /requests/:hash path)
  const localhost = `${protocol}://localhost:${port}/requests/${hash}`;

  // Generate network URL if local IP is available
  const network = localIp ? `${protocol}://${localIp}:${port}/requests/${hash}` : null;

  return { localhost, network };
}

/**
 * Generate URLs for accessing a secret request with multiple network IPs
 * Returns localhost and all network URLs for cross-device access
 */
export function generateAllUrls(
  apiUrl: string,
  hash: string,
  localIps: string[]
): { localhost: string; networkUrls: string[] } {
  // Parse the API URL to get the protocol and port
  const url = new URL(apiUrl);
  const protocol = url.protocol.replace(':', '');
  const port = url.port || (protocol === 'https' ? '443' : '3000');

  // Generate localhost URL (uses /requests/:hash path)
  const localhost = `${protocol}://localhost:${port}/requests/${hash}`;

  // Generate network URLs for all local IPs
  const networkUrls = localIps.map(ip => `${protocol}://${ip}:${port}/requests/${hash}`);

  return { localhost, networkUrls };
}

/**
 * Format URLs for display in CLI output
 */
export function formatUrlsForDisplay(
  urls: { localhost: string; network: string | null }
): string[] {
  const displayUrls: string[] = [];

  if (urls.network) {
    displayUrls.push(`Network URL (for other devices): ${urls.network}`);
  }
  displayUrls.push(`Localhost URL (for this device): ${urls.localhost}`);

  return displayUrls;
}
