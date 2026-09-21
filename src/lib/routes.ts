// OFFER MINER - CENTRALIZED CANONICAL ROUTES REGISTRY

export const APP_ROUTES = {
  home: '/dashboard',
  root: '/',
  dashboard: '/dashboard',
  offers: '/offers',
  mapping: '/mapping',
  imports: '/imports',
  radar: '/radar',
  opportunities: '/opportunities',
  intelligence: '/intelligence',
  workerPromptStudio: '/intelligence/mining-prompts',
  office: '/office',
  knowledge: '/knowledge',
  niches: '/niches',
  compare: '/compare',
  watchlist: '/watchlist',
  favorites: '/favorites',
  deepDives: '/deep-dives',
  settings: '/settings',
  login: '/login',
  oauthConsent: '/oauth/consent',
} as const;

/**
 * Sanitizes and validates a return URL to prevent open-redirect vulnerabilities.
 * Ensures the destination is an internal route.
 */
export function getSafeInternalReturnUrl(url: string | null | undefined, fallback: string = APP_ROUTES.dashboard): string {
  if (!url) return fallback;
  try {
    const decoded = decodeURIComponent(url);
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('://')) {
      return decoded;
    }
  } catch {
    if (url.startsWith('/') && !url.startsWith('//') && !url.includes('://')) {
      return url;
    }
  }
  return fallback;
}
