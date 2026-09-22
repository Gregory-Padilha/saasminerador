import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
}

function getSupabaseKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return false;
  if (
    url.includes('your-project') ||
    url.includes('placeholder') ||
    url.includes('example.com') ||
    key.includes('your-anon-public-key') ||
    key.length < 20
  ) {
    return false;
  }
  return url.startsWith('https://');
};

let _cachedClient: SupabaseClient | null = null;
let _cachedUrl = '';
let _cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const currentUrl = getSupabaseUrl();
  const currentKey = getSupabaseKey();

  if (!_cachedClient || _cachedUrl !== currentUrl || _cachedKey !== currentKey) {
    if (typeof window !== 'undefined') {
      _cachedClient = createBrowserClient(currentUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || currentKey);
    } else {
      _cachedClient = createClient(currentUrl, currentKey);
    }
    _cachedUrl = currentUrl;
    _cachedKey = currentKey;
  }
  return _cachedClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) return undefined;
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

export function createAuthenticatedSupabaseClient(bearerToken: string): SupabaseClient | null {
  const url = getSupabaseUrl();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || getSupabaseKey()).trim();
  if (!url || !anonKey || !bearerToken) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken.trim()}`,
      },
    },
  });
}

export function createAdminSupabaseClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { persistSession: false },
  });
}

