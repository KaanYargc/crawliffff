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
    <nav className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto">
        <div className="flex h-16 items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Crawlify
          </Link>

          <div className="flex items-center gap-4">
            {status === 'authenticated' ? (
              <>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {isAdmin ? (
                    <span className="flex items-center gap-2">
                      <span>{session.user?.name}</span>
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 ring-1 ring-inset ring-zinc-600/10 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                        Admin
                      </span>
                    </span>
                  ) : (
                    <span>{session.user?.name}</span>
                  )}
                </span>
                
                {isAdmin && (
                  <Button 
                    asChild 
                    variant="ghost" 
                    size="sm"
                    className="h-9"
                  >
                    <Link href="/admin">
                      Admin Panel
                    </Link>
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="h-9"
                >
                  Çıkış Yap
                </Button>
              </>
            ) : (
              <>
                <Button 
                  asChild 
                  variant="ghost" 
                  size="sm"
                  className="h-9"
                >
                  <Link href="/login">
                    Giriş Yap
                  </Link>
                </Button>
                <Button 
                  asChild 
                  size="sm"
                  className="h-9 bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  <Link href="/register">
                    Kayıt Ol
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}