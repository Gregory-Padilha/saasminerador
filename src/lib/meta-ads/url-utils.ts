// ==============================================================================
// META ADS - BROWSER-SAFE URL UTILITIES & VALIDATION (CLIENT-SAFE)
// ==============================================================================

export interface MetaUrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  originalUrl: string;
  error?: string;
}

/**
 * Checks if a string looks like a Meta Ads Library URL without throwing.
 */
export function isMetaAdsLibraryUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;

  const isMetaDomain =
    lower.includes('facebook.com') || lower.includes('meta.com') || lower.includes('fb.com');

  const isAdsPath =
    lower.includes('/ads/library') ||
    lower.includes('/ad_library') ||
    lower.includes('id=') ||
    lower.includes('view_all_page_id=');

  return isMetaDomain && isAdsPath;
}

/**
 * Validates a Meta Ads Library URL before triggering browser or API execution.
 * Checks protocol, domain (facebook.com/meta.com), Ads Library path/query parameters,
 * and enforces SSRF protection against private IP ranges.
 */
export function validateMetaAdsLibraryUrl(rawUrl?: string | null): MetaUrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      isValid: false,
      originalUrl: rawUrl || '',
      error: 'URL não fornecida.',
    };
  }

  const trimmed = rawUrl.trim();

  // Protocol check
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      originalUrl: trimmed,
      error: 'Este link não parece ser uma URL válida da Meta Ads Library.',
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // 1. SSRF Protection (Block local/private IPs and internal hostnames)
    const privateIpRegex =
      /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\S+\.local|\S+\.internal)$/i;

    if (privateIpRegex.test(host)) {
      return {
        isValid: false,
        originalUrl: trimmed,
        error: 'Endereço privado ou interno não permitido (SSRF Protection).',
      };
    }

    // 2. Domain check
    const isMetaDomain =
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'meta.com' ||
      host.endsWith('.meta.com') ||
      host === 'fb.com' ||
      host.endsWith('.fb.com');

    if (!isMetaDomain) {
      return {
        isValid: false,
        originalUrl: trimmed,
        error: 'Este link não parece ser uma URL válida da Meta Ads Library.',
      };
    }

    // 3. Path / query check for Ads Library
    const isAdsLibraryPath =
      pathname.includes('/ads/library') ||
      pathname.includes('/ad_library') ||
      search.includes('id=') ||
      search.includes('active_status=') ||
      search.includes('view_all_page_id=') ||
      search.includes('content_owner_id=');

    if (!isAdsLibraryPath) {
      return {
        isValid: false,
        originalUrl: trimmed,
        error: 'Este link não parece ser uma URL válida da Meta Ads Library.',
      };
    }

    return {
      isValid: true,
      normalizedUrl: parsed.toString(),
      originalUrl: trimmed,
    };
  } catch {
    return {
      isValid: false,
      originalUrl: trimmed,
      error: 'Este link não parece ser uma URL válida da Meta Ads Library.',
    };
  }
}
