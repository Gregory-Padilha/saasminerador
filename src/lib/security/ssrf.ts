/**
 * SSRF Defense and URL Sanitization Utility
 * Validates outgoing URLs to prevent Server-Side Request Forgery against internal services,
 * localhost, cloud metadata endpoints (169.254.169.254), and private networks.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.internal',
  '.local',
  '.localhost',
  '.lan',
]);

function isPrivateIpV4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link Local & AWS/GCP/Azure Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0/8 (Broadcast/Invalid)
  if (parts[0] === 0) return true;

  return false;
}

export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  reason?: string;
}

export function validateScrapingUrl(rawUrl: string | null | undefined): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { valid: false, reason: 'EMPTY_URL' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return { valid: false, reason: 'MALFORMED_URL' };
  }

  // 1. Only HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'UNSUPPORTED_PROTOCOL' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Block direct loopback/metadata hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, reason: 'BLOCKED_INTERNAL_HOST' };
  }

  // 3. Block private domain suffixes
  for (const ext of BLOCKED_EXTENSIONS) {
    if (hostname.endsWith(ext)) {
      return { valid: false, reason: 'BLOCKED_INTERNAL_DOMAIN' };
    }
  }

  // 4. Block private IPv4 addresses
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIpV4(hostname)) {
      return { valid: false, reason: 'BLOCKED_PRIVATE_IP' };
    }
  }

  // 5. Block IPv6 brackets and colon-separated
  if (hostname.startsWith('[') || hostname.includes(':')) {
    return { valid: false, reason: 'BLOCKED_IPV6' };
  }

  return {
    valid: true,
    sanitizedUrl: parsed.toString(),
  };
}
