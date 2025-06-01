import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip authentication for login, register, public API routes, and home page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/' // Allow home page to be accessed without authentication
  ) {
    return NextResponse.next();
  }

  // Get the NextAuth.js token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'crawlify-nextauth-secret',
  });

  // If the user is not authenticated, redirect to login
  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }

  // Allow admin to access all routes
  if (token.role === 'admin') {
    return NextResponse.next();
  }

  // Regular users can only access certain routes
  // Add admin-only routes here
  const adminOnlyRoutes = [
    '/admin',
    '/admin/'
  ];

  if (adminOnlyRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    // Redirect regular users away from admin routes
    return NextResponse.redirect(new URL('/', request.url));
  }

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