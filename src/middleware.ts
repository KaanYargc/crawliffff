import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip authentication for login, register, public API routes, and home page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/user') || // Allow all user API routes
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/' // Allow home page to be accessed without authentication
  ) {
    return NextResponse.next();
  }

  // Check if session token exists
  const hasSessionToken = request.cookies.has('next-auth.session-token') || 
                         request.cookies.has('__Secure-next-auth.session-token');
  
  // If no token exists, redirect to login
  if (!hasSessionToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }

  // For role-based and first_login checks, we'll need to rely on client-side checks
  // or API routes since we can't safely decode JWT tokens in Edge middleware
  // without causing compatibility issues
  
  // This is a simplified approach that just checks for token existence
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (e.g. robots.txt)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
};