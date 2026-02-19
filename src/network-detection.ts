import * as os from 'os';

/**
 * Check if an IP address is in a private range
 * Private ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
 */
export function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  
  if (parts.length !== 4) {
    return false;
  }
  
  // 10.0.0.0 - 10.255.255.255
  if (parts[0] === 10) {
    return true;
  }
  
  // 172.16.0.0 - 172.31.255.255
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  
  // 192.168.0.0 - 192.168.255.255
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  
  return false;
}

/**
 * Detect local network IP address for cross-device access
 * Returns first private IP address found, or null if none detected
 * @deprecated Use detectAllLocalIps() instead to get all available IPs
 */
export function detectLocalIp(): string | null {
  const ips = detectAllLocalIps();
  return ips.length > 0 ? ips[0] : null;
}

/**
 * Detect all local network IP addresses for cross-device access
 * Returns all private IP addresses found (useful when machine has multiple network interfaces)
 */
export function detectAllLocalIps(): string[] {
  try {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const networkInterface = interfaces[name];
      if (!networkInterface) continue;

      for (const iface of networkInterface) {
        // Skip internal and non-IPv4 addresses
        if (iface.internal || iface.family !== 'IPv4') {
          continue;
        }

        // Check if IP is in private range
        if (isPrivateIp(iface.address)) {
          ips.push(iface.address);
        }
      }
    }

    return ips;
  } catch (error) {
    // If detection fails, return empty array gracefully
    return [];
  }
}
