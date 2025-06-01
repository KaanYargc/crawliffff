"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

type ProtectedRouteProps = {
  children: React.ReactNode;
  adminOnly?: boolean;
};

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = session?.user?.role === "admin";
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  const isFirstLogin = session?.user?.first_login;

  useEffect(() => {
    if (isLoading) return;

    // Eğer oturum açılmamışsa login sayfasına yönlendir
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // İlk kez giriş yapan kullanıcıyı paket seçme sayfasına yönlendir
    // Ancak zaten paket seçme sayfasındaysa yönlendirme yapma
    if (isFirstLogin && pathname !== "/packages") {
      router.push("/packages");
      return;
    }

    // Admin kontrolü
    if (adminOnly && !isAdmin) {
      router.push("/");
    }
  }, [isAuthenticated, isAdmin, adminOnly, isLoading, router, isFirstLogin, pathname]);

  // Yükleme sırasında veya yönlendirme durumunda loading göster
  if (
    isLoading ||
    (!isAuthenticated) ||
    (adminOnly && !isAdmin) ||
    (isFirstLogin && pathname !== "/packages")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-zinc-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}