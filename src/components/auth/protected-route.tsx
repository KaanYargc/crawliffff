'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type ProtectedRouteProps = {
  children: React.ReactNode;
  adminOnly?: boolean;
};

export default function ProtectedRoute({ 
  children, 
  adminOnly = false 
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'admin';
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  useEffect(() => {
    // If the authentication is still loading, do nothing
    if (isLoading) return;

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // If admin only route and user is not admin, redirect to home
    if (adminOnly && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, isAdmin, adminOnly, isLoading, router]);

  // Show nothing while loading or redirecting
  if (isLoading || (!isAuthenticated) || (adminOnly && !isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Yükleniyor...</p>
      </div>
    );
  }

  // If authenticated and has proper permissions, show the children
  return <>{children}</>;
}