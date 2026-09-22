import { McpLogEntry, McpServerConfig } from '@/types';
import { serverEnv } from '@/lib/env/server';

export const MCP_VERSION = '1.1.0';

export const SERVER_INFO = {
  name: 'Offer Miner MCP',
  version: MCP_VERSION,
};

// In-memory request log & rate limiter stores (Node Server lifetime)
const mcpLogs: (McpLogEntry & { origin?: 'local' | 'remote' })[] = [];
const requestBucket: Record<string, { count: number; resetTime: number }> = {};
const serverStartTime = Date.now();

export const CANONICAL_PRODUCTION_MCP_URL = 'https://saasmineracao.netlify.app/api/mcp';
export const CANONICAL_DEVELOPMENT_MCP_URL = 'http://localhost:3000/api/mcp';
export const CANONICAL_RESOURCE_METADATA_URL = 'https://saasmineracao.netlify.app/.well-known/oauth-protected-resource';
export const SUPABASE_OAUTH_ISSUER = 'https://hofrcxldtmdjchbhdcno.supabase.co/auth/v1';

export function isMcpEnabled(): boolean {
  if (process.env.MCP_ENABLED === 'false') return false;
  return true;
}

export function getMcpToken(): string | null {
  return serverEnv.OFFER_MINER_MCP_TOKEN;
}

export function getMcpLocalUrl(): string {
  return CANONICAL_DEVELOPMENT_MCP_URL;
}

export function getMcpPublicUrl(): string {
  const raw = process.env.MCP_PUBLIC_URL?.trim();
  // In production or Netlify environment, never use trycloudflare tunnel as primary URL
  if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
    if (raw && !raw.includes('trycloudflare.com') && raw.startsWith('https://')) {
      return raw;
    }
    return CANONICAL_PRODUCTION_MCP_URL;
  }
  // In local development, return configured tunnel/custom URL if explicitly set, else canonical
  if (raw && raw !== '') {
    return raw;
  }
  return CANONICAL_PRODUCTION_MCP_URL;
}

/**
 * Validate remote HTTPS URL requirement
 */
export function isMcpPublicUrlValid(): { valid: boolean; reason?: string; url: string } {
  const url = getMcpPublicUrl();
  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (!isLocal && parsed.protocol !== 'https:') {
      return {
        valid: false,
        reason: 'HTTPS_REQUIRED',
        url,
      };
    }
    return { valid: true, url };
  } catch {
    return { valid: false, reason: 'INVALID_URL_FORMAT', url };
  }
}

export function checkRateLimit(token: string): { allowed: boolean; resetInSeconds: number } {
  const now = Date.now();
  const current = requestBucket[token] || { count: 0, resetTime: now + 60000 };

  if (now > current.resetTime) {
    current.count = 1;
    current.resetTime = now + 60000;
  } else {
    current.count += 1;
  }
  requestBucket[token] = current;

  if (current.count > 120) {
    return {
      allowed: false,
      resetInSeconds: Math.ceil((current.resetTime - now) / 1000),
    };
  }

  return { allowed: true, resetInSeconds: 0 };
}

export function verifyMcpToken(authHeader: string | null): boolean {
  if (!isMcpEnabled()) return false;
  const configuredToken = getMcpToken();
  if (!configuredToken) return false;
  if (!authHeader) return false;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return false;
  }

  const providedToken = parts[1].trim();
  return providedToken === configuredToken;
}

export function logMcpActivity(
  tool: string,
  durationMs: number,
  success: boolean,
  errorMessage?: string,
  origin: 'local' | 'remote' = 'local'
) {
  const entry = {
    id: `mcp_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    tool,
    durationMs,
    success,
    errorMessage,
    origin,
  };

  mcpLogs.unshift(entry);
  if (mcpLogs.length > 100) {
    mcpLogs.pop();
  }
}

export function logMcpRequest(
  tool: string,
  durationMs: number,
  success: boolean,
  errorMessage?: string,
  origin: 'local' | 'remote' = 'local'
) {
  logMcpActivity(tool, durationMs, success, errorMessage, origin);
}

export function getMcpLogs() {
  return mcpLogs;
}

export function getMcpUptimeSeconds(): number {
  return Math.floor((Date.now() - serverStartTime) / 1000);
}

export function getMcpHealth(toolsCount: number = 26) {
  const tokenConfigured = Boolean(getMcpToken());
  const enabled = isMcpEnabled();
  const remoteCheck = isMcpPublicUrlValid();

  return {
    status: !enabled ? 'disabled' : tokenConfigured ? 'ok' : 'unconfigured',
    version: MCP_VERSION,
    transport: 'streamable-http',
    mode: 'read-only',
    tools: toolsCount,
    productionUrl: CANONICAL_PRODUCTION_MCP_URL,
    developmentUrl: CANONICAL_DEVELOPMENT_MCP_URL,
    remoteConfigured: remoteCheck.valid,
    remoteUrl: remoteCheck.url,
    remoteStatus: remoteCheck.valid
      ? 'CONFIGURED_HTTPS'
      : remoteCheck.reason === 'HTTPS_REQUIRED'
      ? 'INSECURE_HTTP_REJECTED'
      : 'NOT_CONFIGURED',
    uptimeSeconds: getMcpUptimeSeconds(),
  };
}

export function getMcpConfig(toolsCount: number): McpServerConfig {
  const token = getMcpToken();
  const remoteCheck = isMcpPublicUrlValid();

  return {
    enabled: isMcpEnabled(),
    tokenConfigured: Boolean(token),
    endpointUrl: remoteCheck.url || getMcpLocalUrl(),
    version: MCP_VERSION,
    toolsCount,
  };
}
