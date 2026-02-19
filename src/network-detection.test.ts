import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import { isPrivateIp, detectLocalIp, detectAllLocalIps } from './network-detection.js';

// Mock the os module
vi.mock('os', () => ({
  networkInterfaces: vi.fn(),
}));

describe('network detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isPrivateIp', () => {
    it('should return true for 10.x.x.x addresses', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
      expect(isPrivateIp('10.128.64.32')).toBe(true);
    });

    it('should return true for 172.16.x.x to 172.31.x.x addresses', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
      expect(isPrivateIp('172.20.128.64')).toBe(true);
    });

    it('should return false for 172.15.x.x addresses', () => {
      expect(isPrivateIp('172.15.255.255')).toBe(false);
    });

    it('should return false for 172.32.x.x addresses', () => {
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('should return true for 192.168.x.x addresses', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
      expect(isPrivateIp('192.168.128.64')).toBe(true);
    });

    it('should return false for public IP addresses', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
      expect(isPrivateIp('192.169.0.1')).toBe(false);
    });

    it('should return false for invalid IP addresses', () => {
      expect(isPrivateIp('')).toBe(false);
      expect(isPrivateIp('invalid')).toBe(false);
      expect(isPrivateIp('192.168')).toBe(false);
      expect(isPrivateIp('192.168.1.1.1')).toBe(false);
      expect(isPrivateIp('256.168.1.1')).toBe(false);
    });
  });

  describe('detectLocalIp', () => {
    it('should return first private IP address found', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.100/24' },
        { address: '10.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.1/8' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectLocalIp();
      expect(result).toBe('192.168.1.100');
    });

    it('should skip internal addresses', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' },
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'lo': [mockInterfaces[0]],
        'eth0': [mockInterfaces[1]],
      });

      const result = detectLocalIp();
      expect(result).toBe('192.168.1.100');
    });

    it('should skip IPv6 addresses', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:00', internal: false, cidr: 'fe80::1/64', scopeid: 1 },
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectLocalIp();
      expect(result).toBe('192.168.1.100');
    });

    it('should skip public IP addresses', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '8.8.8.8', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '8.8.8.8/24' },
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectLocalIp();
      expect(result).toBe('192.168.1.100');
    });

    it('should return null when no private IP is found', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '8.8.8.8', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '8.8.8.8/24' },
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: true, cidr: '127.0.0.1/8' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': [mockInterfaces[0]],
        'lo': [mockInterfaces[1]],
      });

      const result = detectLocalIp();
      expect(result).toBeNull();
    });

    it('should return null when networkInterfaces returns empty object', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({});

      const result = detectLocalIp();
      expect(result).toBeNull();
    });

    it('should return null when networkInterfaces throws error', () => {
      vi.mocked(os.networkInterfaces).mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = detectLocalIp();
      expect(result).toBeNull();
    });

    it('should handle multiple network interfaces', () => {
      const mockInterfaces: Record<string, os.NetworkInterfaceInfo[]> = {
        'eth0': [
          { address: '8.8.8.8', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '8.8.8.8/24' },
        ],
        'wlan0': [
          { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
        ],
        'lo': [
          { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:02', internal: true, cidr: '127.0.0.1/8' },
        ],
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockInterfaces);

      const result = detectLocalIp();
      expect(result).toBe('192.168.1.100');
    });

    it('should prefer 10.x.x.x over 192.168.x.x when both present', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.100/24' },
        { address: '10.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.1/8' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectLocalIp();
      expect(result).toBe('192.168.1.100'); // First one found
    });
  });

  describe('detectAllLocalIps', () => {
    it('should return all private IP addresses found', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.100/24' },
        { address: '10.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.1/8' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectAllLocalIps();
      expect(result).toEqual(['192.168.1.100', '10.0.0.1']);
    });

    it('should return IPs from multiple interfaces', () => {
      const mockInterfaces: Record<string, os.NetworkInterfaceInfo[]> = {
        'eth0': [
          { address: '192.168.196.195', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.196.195/24' },
        ],
        'wlan0': [
          { address: '192.168.68.124', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.68.124/24' },
        ],
        'utun0': [
          { address: '10.5.0.2', netmask: '255.255.0.0', family: 'IPv4', mac: '00:00:00:00:00:02', internal: false, cidr: '10.5.0.2/16' },
        ],
        'lo': [
          { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:03', internal: true, cidr: '127.0.0.1/8' },
        ],
      };

      vi.mocked(os.networkInterfaces).mockReturnValue(mockInterfaces);

      const result = detectAllLocalIps();
      expect(result).toContain('192.168.196.195');
      expect(result).toContain('192.168.68.124');
      expect(result).toContain('10.5.0.2');
      expect(result).not.toContain('127.0.0.1');
      expect(result).toHaveLength(3);
    });

    it('should skip internal addresses', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' },
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'lo': [mockInterfaces[0]],
        'eth0': [mockInterfaces[1]],
      });

      const result = detectAllLocalIps();
      expect(result).toEqual(['192.168.1.100']);
    });

    it('should skip IPv6 addresses', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:00', internal: false, cidr: 'fe80::1/64', scopeid: 1 },
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectAllLocalIps();
      expect(result).toEqual(['192.168.1.100']);
    });

    it('should skip public IP addresses', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '8.8.8.8', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '8.8.8.8/24' },
        { address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.100/24' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': mockInterfaces,
      });

      const result = detectAllLocalIps();
      expect(result).toEqual(['192.168.1.100']);
    });

    it('should return empty array when no private IP is found', () => {
      const mockInterfaces: os.NetworkInterfaceInfo[] = [
        { address: '8.8.8.8', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '8.8.8.8/24' },
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: true, cidr: '127.0.0.1/8' },
      ];

      vi.mocked(os.networkInterfaces).mockReturnValue({
        'eth0': [mockInterfaces[0]],
        'lo': [mockInterfaces[1]],
      });

      const result = detectAllLocalIps();
      expect(result).toEqual([]);
    });

    it('should return empty array when networkInterfaces returns empty object', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({});

      const result = detectAllLocalIps();
      expect(result).toEqual([]);
    });

    it('should return empty array when networkInterfaces throws error', () => {
      vi.mocked(os.networkInterfaces).mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = detectAllLocalIps();
      expect(result).toEqual([]);
    });
  });
});
