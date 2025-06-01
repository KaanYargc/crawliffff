'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        toast.error('Giriş başarısız. Lütfen email ve şifrenizi kontrol edin.');
      } else {
        toast.success('Giriş başarılı!');
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      toast.error('Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-white to-gray-50/50 dark:from-background dark:to-background/50">
      <Link 
        href="/" 
        className="text-lg font-semibold text-indigo-500 hover:text-indigo-600 transition-colors mb-8"
      >
        Crawlify
      </Link>
      
      <Card className="w-full max-w-sm border-0 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Hoş Geldiniz
          </CardTitle>
          <CardDescription>
            Hesabınıza giriş yapın
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                disabled={isLoading}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Şifre
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4 text-center">
          <div className="text-sm text-muted-foreground">
            Hesabınız yok mu?{' '}
            <Link 
              href="/register" 
              className="text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
            >
              Kayıt Olun
            </Link>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}