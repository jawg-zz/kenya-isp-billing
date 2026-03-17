import { NextRequest, NextResponse } from 'next/server';

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/api',
  '/_next',
  '/favicon',
  '/robots',
  '/sitemap',
];

// Routes that require admin role
const ADMIN_PATHS = ['/admin'];

// Routes that require customer role
const CUSTOMER_PATHS = ['/dashboard', '/subscribe', '/usage', '/invoices', '/payments', '/profile'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Read tokens from cookies (we set them via middleware; the auth context reads from localStorage
  // but for SSR protection we check cookies)
  const accessToken = request.cookies.get('isp_access_token')?.value;
  const userRole = request.cookies.get('isp_user_role')?.value;

  // If no token, redirect to login (unless already on a public path)
  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes — require ADMIN or SUPPORT role
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (userRole !== 'ADMIN' && userRole !== 'SUPPORT') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Customer routes — redirect admins to admin dashboard
  if (CUSTOMER_PATHS.some((p) => pathname.startsWith(p))) {
    if (userRole === 'ADMIN' || userRole === 'SUPPORT') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and api
    '/((?!_next/static|_next/image|favicon|public).*)',
  ],
};
