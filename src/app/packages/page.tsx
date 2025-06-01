'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const packages = [
  {
    id: 'free',
    name: 'Ücretsiz',
    price: '0 ₺',
    description: 'Temel özellikler ile başlayın',
    features: [
      'Aylık 100 işletme arama',
      'Temel istatistikler',
      'Excel dışa aktarma',
    ],
  },
  {
    id: 'pro',
    name: 'Profesyonel',
    price: '199 ₺/ay',
    description: 'İşletmenizi büyütün',
    features: [
      'Sınırsız işletme arama',
      'Detaylı analiz ve raporlar',
      'Otomatik veri güncelleme',
      'Öncelikli destek',
    ],
  },
  {
    id: 'enterprise',
    name: 'Kurumsal',
    price: '499 ₺/ay',
    description: 'Tam kapsamlı çözüm',
    features: [
      'Tüm Pro özellikleri',
      'API erişimi',
      'Özel entegrasyonlar',
      '7/24 öncelikli destek',
      'Özel raporlama',
    ],
  },
];

export default function PackagesPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user && !session.user.first_login) {
      router.push('/');
    }
  }, [session, router]);

  const handleSelectPackage = async (packageId: string) => {
    try {
      const response = await fetch('/api/user/select-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId }),
      });

      if (!response.ok) {
        throw new Error('Paket seçimi başarısız oldu');
      }

      await update();
      toast.success('Paket başarıyla seçildi');
      router.push('/');
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="container px-4 max-w-6xl mx-auto py-24">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            Paket Seçin
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto">
            İhtiyaçlarınıza en uygun paketi seçerek Crawlify'ın güçlü özelliklerinden yararlanmaya başlayın.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>
                  <div className="flex flex-col items-center text-center">
                    <h3 className="text-xl font-semibold">{pkg.name}</h3>
                    <p className="text-3xl font-bold mt-4">{pkg.price}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-zinc-500 text-center mb-6">{pkg.description}</p>
                <ul className="space-y-3">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg
                        className="h-5 w-5 text-green-500 mr-2"
                        fill="none"
                        strokeWidth="2"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-zinc-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pkg.id === 'free' ? 'outline' : 'default'}
                  onClick={() => handleSelectPackage(pkg.id)}
                >
                  {pkg.id === 'free' ? 'Ücretsiz Başla' : 'Paketi Seç'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}