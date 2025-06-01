'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor.');
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kayıt işlemi başarısız oldu.');
      }

      toast.success('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error.message || 'Kayıt sırasında bir hata oluştu.');
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
            Hesap Oluşturun
          </CardTitle>
          <CardDescription>
            Crawlify'a üye olarak hemen başlayın
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Ad Soyad
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={isLoading}
                className="h-10"
              />
            </div>

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
                minLength={6}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Şifre Tekrar
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                minLength={6}
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {isLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 text-center">
          <div className="text-sm text-muted-foreground">
            Zaten hesabınız var mı?{' '}
            <Link 
              href="/login"
              className="text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
            >
              Giriş Yapın
            </Link>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}