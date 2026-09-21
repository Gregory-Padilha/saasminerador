import 'server-only';

/**
 * ==============================================================================
 * OFFER MINER - SERVER-ONLY ENVIRONMENT VARIABLES
 * ==============================================================================
 * Centralized, strict server-side secrets access.
 * Protected by Next.js 'server-only' package: attempting to import this file
 * in any Client Component ("use client") causes an immediate compile-time error.
 */

export const serverEnv = {
  get OPENAI_API_KEY(): string | null {
    return process.env.OPENAI_API_KEY?.trim() || null;
  },

  get ANTHROPIC_API_KEY(): string | null {
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  },

  get GEMINI_API_KEY(): string | null {
    return process.env.GEMINI_API_KEY?.trim() || null;
  },

  get SUPABASE_SERVICE_ROLE_KEY(): string | null {
    return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
  },

  get SUPABASE_SECRET_KEY(): string | null {
    return this.SUPABASE_SERVICE_ROLE_KEY;
  },

  get OFFER_MINER_MCP_TOKEN(): string | null {
    return process.env.OFFER_MINER_MCP_TOKEN?.trim() || process.env.OFFER_MINER_AI_TOKEN?.trim() || null;
  },
};

/**
 * Type-safe helper to retrieve a server secret
 */
export function getServerSecret(key: keyof typeof serverEnv): string | null {
  return serverEnv[key];
}

/**
 * Audit server credentials presence safely without exposing secret values
 */
export function auditServerSecrets(): Record<string, boolean> {
  return {
    OPENAI_API_KEY: Boolean(serverEnv.OPENAI_API_KEY),
    ANTHROPIC_API_KEY: Boolean(serverEnv.ANTHROPIC_API_KEY),
    GEMINI_API_KEY: Boolean(serverEnv.GEMINI_API_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(serverEnv.SUPABASE_SERVICE_ROLE_KEY),
    OFFER_MINER_MCP_TOKEN: Boolean(serverEnv.OFFER_MINER_MCP_TOKEN),
  };
}
