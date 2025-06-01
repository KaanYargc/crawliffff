'use client';

import { useSession } from "next-auth/react";
import BusinessFinder from "@/components/lead/business-finder";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardNavbar from "@/components/auth/dashboard-navbar";
import Navbar from "@/components/auth/navbar";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthenticated = status === 'authenticated';
  
  // Check if we need to redirect to packages page for first login users
  useEffect(() => {
    // Only redirect to packages if user is authenticated, first_login is true,
    // and they don't have a package or package is empty string
    if (isAuthenticated && 
        session?.user?.first_login && 
        (!session?.user?.package || session?.user?.package === '')) {
      console.log("User is in first login state with no package, redirecting to packages");
      router.push("/packages");
    }
  }, [isAuthenticated, session, router]);

  // If user is already logged in, show the original content with BusinessFinder
  if (isAuthenticated && !session?.user?.first_login) {
    return (
      <>
        <DashboardNavbar />
        <main className="flex min-h-screen flex-col items-center p-4 md:p-12 bg-gradient-to-b from-background to-muted pt-20">
          <div className="container max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                İşletme Arama Platformu
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Crawlify teknolojisi ile Türkiye'deki işletmeleri bulun,
                bilgilerini Excel veya PDF olarak dışa aktarın.
              </p>
            </div>

            <BusinessFinder />
          </div>

          <footer className="mt-12 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Crawlify. Tüm hakları saklıdır.
          </footer>
        </main>
      </>
    );
  }

  // Loading state while checking session
  if (isAuthenticated && session?.user?.first_login) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-zinc-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show landing page for non-authenticated users
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="w-full pt-20 md:pt-24">
          <div className="container px-4 md:px-6 max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-6">
              <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl/none">
                Crawlify
              </h1>
              <p className="mx-auto max-w-[600px] text-zinc-500 md:text-xl/relaxed dark:text-zinc-400">
                Gelişmiş işletme arama ve ürün analiz platformu ile pazarlama süreçlerinizi hızlandırın.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 min-[400px]:gap-6 w-full justify-center pt-2">
                <Button 
                  asChild 
                  size="lg" 
                  className="w-full sm:w-[200px] h-11"
                >
                  <Link href="/register">Ücretsiz Başlayın</Link>
                </Button>
                <Button 
                  asChild 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-[200px] h-11"
                >
                  <Link href="/login">Giriş Yap</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-20 bg-zinc-50">
          <div className="container px-4 md:px-6 max-w-5xl mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl">
                Crawlify ile Neler Yapabilirsiniz?
              </h2>
              <p className="mx-auto max-w-[600px] text-zinc-500 md:text-lg/relaxed dark:text-zinc-400">
                İşletmenizi büyütmek için ihtiyaç duyduğunuz tüm araçlar.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="relative overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="p-3 rounded-lg bg-zinc-50">
                    <svg
                      className="w-8 h-8 text-zinc-900"
                      fill="none"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">İşletme Arama</h3>
                  <p className="text-zinc-500">
                    Harita üzerinde işletmeleri arayın, bilgilerini toplayın ve Excel veya PDF olarak dışa aktarın.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="p-3 rounded-lg bg-zinc-50">
                    <svg
                      className="w-8 h-8 text-zinc-900"
                      fill="none"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">Ürün Analizi</h3>
                  <p className="text-zinc-500">
                    Rakip web sitelerinden ürün bilgilerini analiz edin, fiyat ve özellik karşılaştırması yapın.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="p-3 rounded-lg bg-zinc-50">
                    <svg
                      className="w-8 h-8 text-zinc-900"
                      fill="none"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">Veri Dışa Aktarma</h3>
                  <p className="text-zinc-500">
                    Tüm verileri Excel veya PDF formatında dışa aktarın, pazarlama kampanyalarınızda kullanın.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-24 bg-white">
          <div className="container px-4 md:px-6 max-w-5xl mx-auto">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2 max-w-[500px]">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                    Pazarlama Süreçlerinizi<br />Otomatikleştirin
                  </h2>
                  <p className="text-zinc-500 text-lg/relaxed">
                    Crawlify ile vakit kaybetmeden potansiyel müşterilerinize ulaşın. Hemen başlayın ve işletmenizi büyütün.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button 
                    asChild 
                    size="lg" 
                    className="w-full sm:w-[200px] h-11"
                  >
                    <Link href="/register">
                      Hemen Başlayın
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center lg:justify-end">
                <div className="relative w-[360px] h-[360px] lg:w-[420px] lg:h-[420px]">
                  <Image
                    src="/globe.svg"
                    alt="Globe illustration"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="container px-4 md:px-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-zinc-500 dark:text-zinc-400">
                © {new Date().getFullYear()} Crawlify. Tüm hakları saklıdır.
              </p>
              <nav className="flex gap-6">
                <Link
                  href="/login"
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Kayıt Ol
                </Link>
              </nav>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
