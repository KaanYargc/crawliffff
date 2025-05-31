'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ProtectedRoute from '@/components/auth/protected-route';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <ProtectedRoute adminOnly={true}>
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-8">Admin Paneli</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Sistem Bilgileri</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Yönetici Adı:</span>
                <span className="font-medium">{session?.user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Yönetici Email:</span>
                <span className="font-medium">{session?.user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Kullanıcı Rolü:</span>
                <span className="font-medium">{session?.user?.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Erişim Durumu:</span>
                <span className="font-medium text-green-600">Sınırsız Erişim</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => router.push('/')}>Ana Sayfaya Dön</Button>
          </Card>
          
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Crawlify Kullanımı</h2>
            <p className="text-gray-600 mb-6">
              Admin hesabı ile uygulamanın tüm özelliklerine sınırsız erişebilirsiniz. 
              Kullanıcı verilerini yönetebilir ve sistem ayarlarını değiştirebilirsiniz.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full" disabled>Kullanıcı Yönetimi</Button>
              <Button variant="outline" className="w-full" disabled>Sistem Ayarları</Button>
              <Button variant="outline" className="w-full" disabled>Raporlar</Button>
            </div>
          </Card>
          
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Sistem Durumu</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Veritabanı:</span>
                <span className="font-medium text-green-600">Aktif</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">API Bağlantısı:</span>
                <span className="font-medium text-green-600">Aktif</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sunucu Durumu:</span>
                <span className="font-medium text-green-600">Çalışıyor</span>
              </div>
            </div>
            <Button variant="destructive" className="w-full" disabled>
              Sistemi Yeniden Başlat
            </Button>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}