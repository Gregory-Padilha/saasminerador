import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes explicitly accessible without a human web session
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/unauthorized',
  '/.well-known',
  '/api/mcp',
  '/oauth',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((allowed) => pathname === allowed || pathname.startsWith(allowed + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Session refresh and cookie synchronization
  const { supabaseResponse, user } = await updateSession(request);

  // 2. Root Route Handler
  if (pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 3. Allow Public Routes & Assets
  if (isPublicPath(pathname)) {
    applySecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  // 4. Protect APIs (401 JSON)
  if (pathname.startsWith('/api/')) {
    if (!user) {
      const response = NextResponse.json(
        {
          error: 'Authentication required. Sessão privada do Offer Miner.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
      applySecurityHeaders(response);
      return response;
    }
    applySecurityHeaders(supabaseResponse);
    return supabaseResponse;
  }

  // 5. Protect Web Pages (Redirect to /login)
  if (!user) {
    const nextParam = encodeURIComponent(pathname + search);
    const loginUrl = new URL(`/login?next=${nextParam}`, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse);
    return redirectResponse;
  }

  applySecurityHeaders(supabaseResponse);
  return supabaseResponse;
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  // Defense in depth Content-Security-Policy
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'self';"
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/fonts/media with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
};
