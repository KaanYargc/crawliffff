import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-6xl font-bold text-zinc-900 dark:text-zinc-100">404</h1>
      <h2 className="text-2xl font-semibold mt-4 text-zinc-800 dark:text-zinc-200">Sayfa Bulunamadı</h2>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-md">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Button 
        asChild 
        className="mt-8"
      >
        <Link href="/">
          Ana Sayfaya Dön
        </Link>
      </Button>
    </div>
  );
}