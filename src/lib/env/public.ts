/**
 * ==============================================================================
 * OFFER MINER - PUBLIC CLIENT ENVIRONMENT CONFIGURATION
 * ==============================================================================
 * Explicitly separates public variables that are bundled for client-side use
 * from server-only secrets.
 *
 * NOTE: These are NOT secrets. NEXT_PUBLIC_SUPABASE_ANON_KEY is a publishable
 * anon key protected by Supabase Row Level Security (RLS).
 */

export const publicEnv = {
  get SUPABASE_URL(): string {
    return (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  },

  get SUPABASE_ANON_KEY(): string {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    ).trim();
  },

  get SUPABASE_PUBLISHABLE_KEY(): string {
    return this.SUPABASE_ANON_KEY;
  },

  get MCP_PUBLIC_URL(): string | null {
    const raw = process.env.MCP_PUBLIC_URL?.trim();
    return raw || null;
  },

  get isConfigured(): boolean {
    const url = this.SUPABASE_URL;
    const key = this.SUPABASE_ANON_KEY;
    return Boolean(
      url &&
      key &&
      !url.includes('your-project') &&
      !key.includes('your-anon-public-key')
    );
  },
};
