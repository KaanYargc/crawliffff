'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    toast.success('Başarıyla çıkış yapıldı');
  };

  return (
    <nav className="border-b border-gray-200 bg-white py-4">
      <div className="container mx-auto flex items-center justify-between px-4">
        <div>
          <Link href="/" className="text-xl font-bold">
            Crawlify
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {status === 'authenticated' ? (
            <>
              <span className="text-sm text-gray-700">
                {isAdmin ? (
                  <span className="inline-flex items-center">
                    <span className="mr-2">{session.user?.name}</span>
                    <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                      Admin
                    </span>
                  </span>
                ) : (
                  <span>{session.user?.name}</span>
                )}
              </span>
              
              {isAdmin && (
                <Link href="/admin" passHref>
                  <Button variant="secondary" size="sm">
                    Admin Panel
                  </Button>
                </Link>
              )}
              
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Çıkış Yap
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" passHref>
                <Button variant="outline" size="sm">
                  Giriş Yap
                </Button>
              </Link>
              <Link href="/register" passHref>
                <Button size="sm">Kayıt Ol</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}