import { McpAuthMode, AiGatewayAuthResult } from './types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { getMcpPublicUrl, CANONICAL_RESOURCE_METADATA_URL, SUPABASE_OAUTH_ISSUER } from '@/lib/mcp/config';

export function getAuthMode(): McpAuthMode {
  const mode = process.env.MCP_AUTH_MODE || process.env.AI_GATEWAY_AUTH_MODE;
  if (mode?.toLowerCase() === 'oauth') return 'oauth';
  if (mode?.toLowerCase() === 'token') return 'token';
  return 'hybrid';
}

export function getGatewayToken(): string | null {
  const token = process.env.OFFER_MINER_MCP_TOKEN || process.env.OFFER_MINER_AI_TOKEN;
  if (!token || token.trim() === '') return null;
  return token.trim();
}

export function getSupabaseAuthIssuer(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url || !url.trim()) return SUPABASE_OAUTH_ISSUER;
  const cleanUrl = url.trim().replace(/\/$/, '');
  return `${cleanUrl}/auth/v1`;
}

export function getProtectedResourceMetadataUrl(): string {
  const publicUrl = getMcpPublicUrl();
  if (publicUrl) {
    try {
      const parsed = new URL(publicUrl);
      return `${parsed.origin}/.well-known/oauth-protected-resource`;
    } catch {
      // Fallback
    }
  }
  return CANONICAL_RESOURCE_METADATA_URL;
}

export function getWwwAuthenticateHeader(): string {
  return `Bearer resource_metadata="${getProtectedResourceMetadataUrl()}"`;
}

/**
 * Universal Hybrid Auth Verifier for HTTP MCP, STDIO and REST requests.
 * Evaluates:
 * 1. Static OFFER_MINER_MCP_TOKEN
 * 2. Supabase OAuth 2.1 Access Token / JWT
 */
export async function verifyGatewayAuthAsync(authHeader: string | null): Promise<AiGatewayAuthResult> {
  const mode = getAuthMode();
  const wwwAuth = getWwwAuthenticateHeader();

  if (!authHeader) {
    return {
      valid: false,
      reason: 'MISSING_AUTHORIZATION_HEADER',
      authMode: mode,
      authMethod: 'none',
      wwwAuthenticateHeader: wwwAuth,
    };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return {
      valid: false,
      reason: 'INVALID_HEADER_FORMAT',
      authMode: mode,
      authMethod: 'none',
      wwwAuthenticateHeader: wwwAuth,
    };
  }

  const providedToken = parts[1].trim();

  // 1. Check Static Bearer Token
  const configuredStaticToken = getGatewayToken();
  if (configuredStaticToken && providedToken === configuredStaticToken) {
    return {
      valid: true,
      authMode: mode,
      authMethod: 'static_token',
    };
  }

  // 2. Check Supabase OAuth Access Token / JWT
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(providedToken);
      if (!error && data?.user) {
        return {
          valid: true,
          authMode: mode,
          authMethod: 'oauth_token',
          userId: data.user.id,
          email: data.user.email,
        };
      }
    } catch {
      // OAuth validation failed
    }
  }

  return {
    valid: false,
    reason: 'INVALID_TOKEN',
    authMode: mode,
    authMethod: 'none',
    wwwAuthenticateHeader: wwwAuth,
  };
}

/**
 * Synchronous fallback for simple static token checks
 */
export function verifyGatewayAuth(authHeader: string | null): AiGatewayAuthResult {
  const configuredToken = getGatewayToken();
  const wwwAuth = getWwwAuthenticateHeader();

  if (!authHeader) {
    return {
      valid: false,
      reason: 'MISSING_AUTHORIZATION_HEADER',
      authMode: 'hybrid',
      authMethod: 'none',
      wwwAuthenticateHeader: wwwAuth,
    };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return {
      valid: false,
      reason: 'INVALID_HEADER_FORMAT',
      authMode: 'hybrid',
      authMethod: 'none',
      wwwAuthenticateHeader: wwwAuth,
    };
  }

  const providedToken = parts[1].trim();
  if (configuredToken && providedToken === configuredToken) {
    return { valid: true, authMode: 'hybrid', authMethod: 'static_token' };
  }

  return {
    valid: false,
    reason: 'INVALID_TOKEN',
    authMode: 'hybrid',
    authMethod: 'none',
    wwwAuthenticateHeader: wwwAuth,
  };
}
